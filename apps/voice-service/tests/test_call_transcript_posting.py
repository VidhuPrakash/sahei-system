import json
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock

import httpx
import pytest
from fakeredis import FakeAsyncRedis

from voice_service import tools
from voice_service.call_context import CallContext
from voice_service.session_store import CallSessionStore


def _make_call_context(**overrides: Any) -> CallContext:
    defaults: dict[str, Any] = {
        "business_id": "test-business",
        "customer_phone": "+910000000000",
        "http_client": httpx.AsyncClient(base_url="http://booking-api.test"),
        "session_store": CallSessionStore(FakeAsyncRedis(decode_responses=True)),
        "call_sid": "test-call-sid",
    }
    defaults.update(overrides)
    return CallContext(**defaults)


def _fake_params(call_context: CallContext, arguments: dict[str, Any]) -> Any:
    # tools.py's handlers only touch app_resources/arguments/result_callback —
    # a SimpleNamespace stands in for FunctionCallParams without the rest of
    # its (llm/pipeline_worker/context) machinery.
    return SimpleNamespace(
        app_resources=call_context, arguments=arguments, result_callback=AsyncMock()
    )


@pytest.mark.asyncio
async def test_book_appointment_sets_booking_reference_on_confirmed_status() -> None:
    def _fake_backend(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"status": "confirmed", "bookingReference": "TESTREF1"})

    call_context = _make_call_context(
        http_client=httpx.AsyncClient(
            base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_backend)
        )
    )
    params = _fake_params(
        call_context,
        {"service": "Haircut", "date": "2026-09-15", "time": "10:00"},
    )

    await tools._handle_book_appointment(params)

    assert call_context.booking_reference == "TESTREF1"
    await call_context.http_client.aclose()


@pytest.mark.asyncio
async def test_book_appointment_leaves_booking_reference_unset_when_slot_unavailable() -> None:
    def _fake_backend(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"status": "failed", "reason": "outside business hours"})

    call_context = _make_call_context(
        http_client=httpx.AsyncClient(
            base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_backend)
        )
    )
    params = _fake_params(
        call_context,
        {"service": "Haircut", "date": "2026-09-15", "time": "10:00"},
    )

    await tools._handle_book_appointment(params)

    assert call_context.booking_reference is None
    await call_context.http_client.aclose()


@pytest.mark.asyncio
async def test_log_inquiry_sets_inquiry_logged_on_success() -> None:
    def _fake_backend(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"logged": True, "inquiryId": "inq-1"})

    call_context = _make_call_context(
        http_client=httpx.AsyncClient(
            base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_backend)
        )
    )
    params = _fake_params(call_context, {"category": "off_topic", "summary": "asked about parking"})

    await tools._handle_log_inquiry(params)

    assert call_context.inquiry_logged is True
    await call_context.http_client.aclose()


@pytest.mark.asyncio
async def test_cancel_appointment_sets_cancelled_booking_reference_on_success() -> None:
    def _fake_backend(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"status": "cancelled", "bookingReference": "AAAA1111"})

    call_context = _make_call_context(
        http_client=httpx.AsyncClient(
            base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_backend)
        )
    )
    params = _fake_params(call_context, {})

    await tools._handle_cancel_appointment(params)
    await call_context.http_client.aclose()

    assert call_context.cancelled_booking_reference == "AAAA1111"


@pytest.mark.asyncio
async def test_cancel_appointment_passes_through_appointment_not_found() -> None:
    attempts = 0

    def _fake_backend(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(404, json={"error": "appointment_not_found", "message": "none"})

    call_context = _make_call_context(
        http_client=httpx.AsyncClient(
            base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_backend)
        )
    )
    params = _fake_params(call_context, {})

    await tools._handle_cancel_appointment(params)
    await call_context.http_client.aclose()

    assert attempts == 1
    result = params.result_callback.call_args.args[0]
    assert result == {"error": "appointment_not_found"}
    assert call_context.cancelled_booking_reference is None


@pytest.mark.asyncio
async def test_cancel_appointment_passes_through_ambiguous_appointment_with_candidates() -> None:
    candidates = [
        {"scheduledAt": "2026-09-20T10:00:00.000Z", "bookingReference": "AAAA1111"},
        {"scheduledAt": "2026-09-22T15:00:00.000Z", "bookingReference": "BBBB2222"},
    ]

    def _fake_backend(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            400,
            json={"error": "ambiguous_appointment", "message": "pick one", "candidates": candidates},
        )

    call_context = _make_call_context(
        http_client=httpx.AsyncClient(
            base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_backend)
        )
    )
    params = _fake_params(call_context, {})

    await tools._handle_cancel_appointment(params)
    await call_context.http_client.aclose()

    result = params.result_callback.call_args.args[0]
    assert result == {"error": "ambiguous_appointment", "candidates": candidates}


@pytest.mark.asyncio
async def test_post_call_transcript_reports_booked_outcome() -> None:
    captured: list[httpx.Request] = []

    def _fake_backend(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json={})

    call_context = _make_call_context(
        http_client=httpx.AsyncClient(
            base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_backend)
        ),
        booking_reference="TESTREF1",
    )
    transcript = [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}]
    started_at = datetime(2026, 9, 15, 10, 0, tzinfo=UTC)
    ended_at = datetime(2026, 9, 15, 10, 5, tzinfo=UTC)

    await tools.post_call_transcript(call_context, transcript, started_at, ended_at)
    await call_context.http_client.aclose()

    assert len(captured) == 1
    request = captured[0]
    assert request.url.path == "/call-transcripts"
    body = json.loads(request.content)
    assert body == {
        "businessId": "test-business",
        "callId": "test-call-sid",
        "customerPhone": "+910000000000",
        "outcome": "BOOKED",
        "bookingReference": "TESTREF1",
        "transcript": transcript,
        "startedAt": started_at.isoformat(),
        "endedAt": ended_at.isoformat(),
    }


@pytest.mark.asyncio
async def test_post_call_transcript_reports_inquiry_outcome_when_no_booking() -> None:
    captured: list[httpx.Request] = []

    def _fake_backend(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json={})

    call_context = _make_call_context(
        http_client=httpx.AsyncClient(
            base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_backend)
        ),
        inquiry_logged=True,
    )
    started_at = datetime(2026, 9, 15, 10, 0, tzinfo=UTC)
    ended_at = datetime(2026, 9, 15, 10, 5, tzinfo=UTC)

    await tools.post_call_transcript(call_context, [], started_at, ended_at)
    await call_context.http_client.aclose()

    body = json.loads(captured[0].content)
    assert body["outcome"] == "INQUIRY"
    assert body["bookingReference"] is None


@pytest.mark.asyncio
async def test_post_call_transcript_reports_cancelled_outcome() -> None:
    captured: list[httpx.Request] = []

    def _fake_backend(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json={})

    call_context = _make_call_context(
        http_client=httpx.AsyncClient(
            base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_backend)
        ),
        cancelled_booking_reference="AAAA1111",
    )
    started_at = datetime(2026, 9, 15, 10, 0, tzinfo=UTC)
    ended_at = datetime(2026, 9, 15, 10, 5, tzinfo=UTC)

    await tools.post_call_transcript(call_context, [], started_at, ended_at)
    await call_context.http_client.aclose()

    body = json.loads(captured[0].content)
    assert body["outcome"] == "CANCELLED"
    assert body["bookingReference"] == "AAAA1111"


@pytest.mark.asyncio
async def test_post_call_transcript_reports_no_outcome_by_default() -> None:
    captured: list[httpx.Request] = []

    def _fake_backend(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json={})

    call_context = _make_call_context(
        http_client=httpx.AsyncClient(
            base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_backend)
        )
    )
    started_at = datetime(2026, 9, 15, 10, 0, tzinfo=UTC)
    ended_at = datetime(2026, 9, 15, 10, 5, tzinfo=UTC)

    await tools.post_call_transcript(call_context, [], started_at, ended_at)
    await call_context.http_client.aclose()

    body = json.loads(captured[0].content)
    assert body["outcome"] == "NO_OUTCOME"


@pytest.mark.asyncio
async def test_post_call_transcript_never_raises_on_backend_failure() -> None:
    def _fake_backend(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    call_context = _make_call_context(
        http_client=httpx.AsyncClient(
            base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_backend)
        )
    )
    started_at = datetime(2026, 9, 15, 10, 0, tzinfo=UTC)
    ended_at = datetime(2026, 9, 15, 10, 5, tzinfo=UTC)

    await tools.post_call_transcript(call_context, [], started_at, ended_at)
    await call_context.http_client.aclose()


@pytest.mark.asyncio
async def test_check_availability_retries_once_on_connection_timeout() -> None:
    attempts = 0

    def _fake_backend(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise httpx.ConnectTimeout("timed out", request=request)
        return httpx.Response(200, json={"available": True})

    call_context = _make_call_context(
        http_client=httpx.AsyncClient(
            base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_backend)
        )
    )
    params = _fake_params(call_context, {"service": "Haircut", "date": "2026-09-15", "time": "10:00"})

    await tools._handle_check_availability(params)
    await call_context.http_client.aclose()

    assert attempts == 2
    result = params.result_callback.call_args.args[0]
    assert result == {"available": True}


@pytest.mark.asyncio
async def test_check_availability_gives_up_after_max_attempts_on_5xx() -> None:
    attempts = 0

    def _fake_backend(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(500)

    call_context = _make_call_context(
        http_client=httpx.AsyncClient(
            base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_backend)
        )
    )
    params = _fake_params(call_context, {"service": "Haircut", "date": "2026-09-15", "time": "10:00"})

    await tools._handle_check_availability(params)
    await call_context.http_client.aclose()

    assert attempts == 2
    result = params.result_callback.call_args.args[0]
    assert result == {"error": "backend_unavailable"}


@pytest.mark.asyncio
async def test_check_availability_passes_through_ambiguous_service_without_retry() -> None:
    attempts = 0

    def _fake_backend(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(400, json={"error": "ambiguous_service", "message": "pick one"})

    call_context = _make_call_context(
        http_client=httpx.AsyncClient(
            base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_backend)
        )
    )
    params = _fake_params(call_context, {"service": "hair", "date": "2026-09-15", "time": "10:00"})

    await tools._handle_check_availability(params)
    await call_context.http_client.aclose()

    assert attempts == 1
    result = params.result_callback.call_args.args[0]
    assert result == {"error": "ambiguous_service"}


@pytest.mark.asyncio
async def test_check_availability_falls_back_to_backend_unavailable_on_unrecognized_4xx() -> None:
    def _fake_backend(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"message": "boom"})

    call_context = _make_call_context(
        http_client=httpx.AsyncClient(
            base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_backend)
        )
    )
    params = _fake_params(call_context, {"service": "Haircut", "date": "2026-09-15", "time": "10:00"})

    await tools._handle_check_availability(params)
    await call_context.http_client.aclose()

    result = params.result_callback.call_args.args[0]
    assert result == {"error": "backend_unavailable"}
