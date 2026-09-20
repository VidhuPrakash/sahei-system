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
    return SimpleNamespace(
        app_resources=call_context, arguments=arguments, result_callback=AsyncMock()
    )


@pytest.mark.asyncio
async def test_lookup_authority_returns_true_and_name_when_registered() -> None:
    captured: list[httpx.Request] = []

    def _fake_backend(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json={"isAuthority": True, "name": "Priya"})

    http_client = httpx.AsyncClient(
        base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_backend)
    )

    is_authority, name = await tools.lookup_authority(http_client, "test-business", "+910000000001")
    await http_client.aclose()

    assert is_authority is True
    assert name == "Priya"
    assert captured[0].url.path == "/authority/lookup"
    assert json.loads(captured[0].content) == {
        "businessId": "test-business",
        "phoneNumber": "+910000000001",
    }


@pytest.mark.asyncio
async def test_lookup_authority_returns_false_when_not_registered() -> None:
    def _fake_backend(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"isAuthority": False})

    http_client = httpx.AsyncClient(
        base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_backend)
    )

    is_authority, name = await tools.lookup_authority(http_client, "test-business", "+910000000002")
    await http_client.aclose()

    assert is_authority is False
    assert name is None


@pytest.mark.asyncio
async def test_lookup_authority_fails_open_on_backend_error() -> None:
    def _fake_backend(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    http_client = httpx.AsyncClient(
        base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_backend)
    )

    is_authority, name = await tools.lookup_authority(http_client, "test-business", "+910000000003")
    await http_client.aclose()

    assert is_authority is False
    assert name is None


@pytest.mark.asyncio
async def test_get_appointments_summary_returns_backend_result_on_success() -> None:
    captured: list[httpx.Request] = []

    def _fake_backend(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(
            200,
            json={
                "count": 1,
                "appointments": [
                    {
                        "date": "2026-09-20",
                        "time": "11:00",
                        "customerName": "Anu",
                        "service": "Haircut",
                        "status": "CONFIRMED",
                    }
                ],
            },
        )

    call_context = _make_call_context(
        http_client=httpx.AsyncClient(
            base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_backend)
        )
    )
    params = _fake_params(call_context, {"date": "2026-09-20"})

    await tools._handle_get_appointments_summary(params)
    await call_context.http_client.aclose()

    result = params.result_callback.call_args.args[0]
    assert result["count"] == 1
    assert captured[0].url.path == "/authority/appointments"
    assert json.loads(captured[0].content) == {
        "businessId": "test-business",
        "date": "2026-09-20",
    }


@pytest.mark.asyncio
async def test_get_appointments_summary_falls_back_to_backend_unavailable_on_failure() -> None:
    def _fake_backend(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    call_context = _make_call_context(
        http_client=httpx.AsyncClient(
            base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_backend)
        )
    )
    params = _fake_params(call_context, {})

    await tools._handle_get_appointments_summary(params)
    await call_context.http_client.aclose()

    result = params.result_callback.call_args.args[0]
    assert result == {"error": "backend_unavailable"}


@pytest.mark.asyncio
async def test_post_call_transcript_reports_authority_query_outcome() -> None:
    captured: list[httpx.Request] = []

    def _fake_backend(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json={})

    call_context = _make_call_context(
        http_client=httpx.AsyncClient(
            base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_backend)
        ),
        is_authority=True,
    )
    started_at = datetime(2026, 9, 15, 10, 0, tzinfo=UTC)
    ended_at = datetime(2026, 9, 15, 10, 5, tzinfo=UTC)

    await tools.post_call_transcript(call_context, [], started_at, ended_at)
    await call_context.http_client.aclose()

    body = json.loads(captured[0].content)
    assert body["outcome"] == "AUTHORITY_QUERY"
    assert body["bookingReference"] is None
