"""Tool schemas for the booking flow's side-effecting actions.

Three tools, each a `FunctionSchema` with its handler attached directly (the
LLM service auto-registers any schema that carries a `handler` the moment it's
advertised via `LLMContext.tools` — no separate `register_function` call
needed):

- `check_availability` / `book_appointment`: the actions in the scripted
  booking flow (see `prompts.BOOKING_SYSTEM_PROMPT`) that need a real backend
  round-trip. Each handler POSTs to the `apps/api` booking endpoints via the
  shared `httpx.AsyncClient` on `CallContext` (see `call_context.py`),
  reachable through `FunctionCallParams.app_resources`.
- `log_inquiry`: telemetry, not a Q&A tool. Fired whenever a turn goes off the
  booking rails (a business question answered from org context, an off-topic
  remark, an explicit non-booking call) so the outcome is recorded somewhere,
  without adding a tool per possible question.

On a backend/network failure, handlers return a safe failure result to the
LLM instead of raising — a backend hiccup should end the tool call, not crash
the call's audio pipeline.
"""

import asyncio
from collections.abc import Sequence
from datetime import datetime
from typing import Any

import httpx
from loguru import logger
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.services.llm_service import FunctionCallParams

from voice_service.call_context import CallContext

# Error codes apps/api's booking.service.ts returns in a 4xx JSON body's
# "error" field that mean something distinct from a technical outage — passed
# through to the LLM verbatim so it can react (see prompts.BOOKING_SYSTEM_PROMPT)
# instead of apologizing for a fake backend_unavailable.
_KNOWN_BACKEND_ERROR_CODES = {"ambiguous_service", "service_not_found"}

_MAX_ATTEMPTS = 2
_RETRY_BACKOFF_SECONDS = 0.5


async def _post_with_retry(client: httpx.AsyncClient, url: str, **kwargs: Any) -> httpx.Response:
    """POST with one retry after a short backoff for a connection/timeout failure
    or 5xx. A 4xx means the request itself is wrong (bad service match, etc.) —
    retrying changes nothing, so it's raised immediately instead."""
    last_exc: httpx.HTTPError | None = None
    for attempt in range(_MAX_ATTEMPTS):
        try:
            response = await client.post(url, **kwargs)
            response.raise_for_status()
            return response
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code < 500 or attempt == _MAX_ATTEMPTS - 1:
                raise
            last_exc = exc
        except httpx.HTTPError as exc:
            if attempt == _MAX_ATTEMPTS - 1:
                raise
            last_exc = exc
        logger.warning("POST {} failed (attempt {}), retrying: {}", url, attempt + 1, last_exc)
        await asyncio.sleep(_RETRY_BACKOFF_SECONDS)
    assert last_exc is not None  # unreachable: the final attempt above always raises instead
    raise last_exc


def _backend_error_result(exc: httpx.HTTPError) -> dict[str, str]:
    """Maps a failed booking-API call to the {"error": ...} shape the LLM sees.
    A recognized structured code (e.g. ambiguous_service) passes through
    verbatim; anything else — a 5xx, a network failure, an unrecognized 4xx —
    collapses to the generic backend_unavailable apology."""
    if isinstance(exc, httpx.HTTPStatusError):
        try:
            error_code = exc.response.json().get("error")
        except ValueError:
            error_code = None
        if error_code in _KNOWN_BACKEND_ERROR_CODES:
            return {"error": error_code}
    return {"error": "backend_unavailable"}

# Pilot scope: the one hardcoded business's exact service names, both the
# English catalog name (Service.name) and Malayalam name (Service.nameLocal)
# in apps/api's seed data. Constraining the LLM to this enum avoids
# fuzzy-matching free-form spoken Malayalam against the backend — e.g.
# "ഹെയർ കട്ടിങ്" (a caller's natural phrasing) and "ഹെയർകട്ട്" (the catalog
# name) are different letter sequences, not just spacing, so no
# normalization on the backend can reliably bridge them. Both language forms
# are offered so the LLM can pick whichever it naturally reaches for.
_SERVICE_NAMES = [
    "Haircut",
    "ഹെയർകട്ട്",
    "Hair Coloring",
    "ഹെയർ കളറിംഗ്",
    "Facial",
    "ഫേഷ്യൽ",
    "Beauty Treatment",
    "ബ്യൂട്ടി ട്രീറ്റ്മെന്റുകൾ",
]


async def _handle_check_availability(params: FunctionCallParams) -> None:
    ctx: CallContext = params.app_resources
    service = params.arguments.get("service", "")
    date = params.arguments.get("date", "")
    time_ = params.arguments.get("time", "")
    payload = {
        "businessId": ctx.business_id,
        "service": service,
        "date": date,
        "time": time_,
    }
    try:
        response = await _post_with_retry(
            ctx.http_client, "/booking/check-availability", json=payload
        )
        result = response.json()
        # Written regardless of whether the slot is available — these are the
        # caller's stated preferences, not a confirmed booking. If unavailable,
        # the flow re-asks and a later check_availability call overwrites these
        # same fields before book_appointment ever fires.
        await ctx.session_store.upsert(ctx.call_sid, service=service, date=date, time=time_)
    except httpx.HTTPError as exc:
        logger.error("check_availability request failed: {}", exc)
        result = _backend_error_result(exc)
    await params.result_callback(result)


async def _handle_book_appointment(params: FunctionCallParams) -> None:
    ctx: CallContext = params.app_resources
    service = params.arguments.get("service", "")
    date = params.arguments.get("date", "")
    time_ = params.arguments.get("time", "")
    customer_name = params.arguments.get("customer_name", "")
    customer_area = params.arguments.get("customer_area", "")
    payload = {
        "businessId": ctx.business_id,
        "service": service,
        "date": date,
        "time": time_,
        "customerName": customer_name,
        "customerArea": customer_area,
    }
    try:
        response = await _post_with_retry(
            ctx.http_client,
            "/booking/book-appointment",
            json=payload,
            headers={"x-customer-phone": ctx.customer_phone},
        )
        result = response.json()
        if result.get("status") == "confirmed":
            ctx.booking_reference = result.get("bookingReference")
        # Booking is the terminal state of the scripted flow (see
        # prompts.BOOKING_SYSTEM_PROMPT) — nothing left to resume, so clear
        # the session's PII now rather than waiting for call end.
        await ctx.session_store.delete(ctx.call_sid)
    except httpx.HTTPError as exc:
        logger.error("book_appointment request failed: {}", exc)
        result = _backend_error_result(exc)
    await params.result_callback(result)


async def _handle_log_inquiry(params: FunctionCallParams) -> None:
    ctx: CallContext = params.app_resources
    payload = {
        "businessId": ctx.business_id,
        "category": params.arguments.get("category", "other"),
        "summary": params.arguments.get("summary", ""),
    }
    try:
        response = await ctx.http_client.post("/booking/log-inquiry", json=payload)
        response.raise_for_status()
        result = response.json()
        ctx.inquiry_logged = True
    except httpx.HTTPError as exc:
        logger.error("log_inquiry request failed: {}", exc)
        result = {"logged": False}
    await params.result_callback(result)


async def post_call_transcript(
    ctx: CallContext,
    transcript: Sequence[Any],
    started_at: datetime,
    ended_at: datetime,
) -> None:
    """POSTs the full call transcript + outcome to apps/api. Called from
    bot.run_bot's finally block at call end — never raises, since call-end
    cleanup must complete even if this backend round-trip fails."""
    if ctx.booking_reference:
        outcome = "BOOKED"
    elif ctx.inquiry_logged:
        outcome = "INQUIRY"
    else:
        outcome = "NO_OUTCOME"
    payload = {
        "businessId": ctx.business_id,
        "callId": ctx.call_sid,
        "customerPhone": ctx.customer_phone,
        "outcome": outcome,
        "bookingReference": ctx.booking_reference,
        "transcript": transcript,
        "startedAt": started_at.isoformat(),
        "endedAt": ended_at.isoformat(),
    }
    try:
        response = await ctx.http_client.post("/call-transcripts", json=payload)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.error("post_call_transcript request failed: {}", exc)


_CHECK_AVAILABILITY_SCHEMA = FunctionSchema(
    name="check_availability",
    description=(
        "Check whether a requested service and time slot is available, before "
        "confirming a booking with the caller."
    ),
    properties={
        "service": {
            "type": "string",
            "enum": _SERVICE_NAMES,
            "description": "The catalog service name matching what the caller asked for.",
        },
        "date": {
            "type": "string",
            "description": "The requested date as an ISO 8601 date (YYYY-MM-DD), resolved from what the caller said.",
        },
        "time": {
            "type": "string",
            "description": "The requested time as 24-hour HH:mm, resolved from what the caller said.",
        },
    },
    required=["service", "date", "time"],
    handler=_handle_check_availability,
)

_BOOK_APPOINTMENT_SCHEMA = FunctionSchema(
    name="book_appointment",
    description="Book the appointment once the caller has confirmed the service, date, and time.",
    properties={
        "service": {
            "type": "string",
            "enum": _SERVICE_NAMES,
            "description": "The confirmed catalog service name.",
        },
        "date": {
            "type": "string",
            "description": "The confirmed date as an ISO 8601 date (YYYY-MM-DD).",
        },
        "time": {
            "type": "string",
            "description": "The confirmed time as 24-hour HH:mm.",
        },
        "customer_name": {
            "type": "string",
            "description": "The caller's name.",
        },
        "customer_area": {
            "type": "string",
            "description": "The caller's home area/locality.",
        },
    },
    required=["service", "date", "time", "customer_name", "customer_area"],
    handler=_handle_book_appointment,
)

_LOG_INQUIRY_SCHEMA = FunctionSchema(
    name="log_inquiry",
    description=(
        "Quietly record a turn that isn't part of the booking flow — a business "
        "question, an off-topic remark, or a call that isn't about booking at all. "
        "Call this in addition to your normal spoken reply, never instead of it."
    ),
    properties={
        "category": {
            "type": "string",
            "enum": ["business_question", "off_topic", "no_booking_needed", "other"],
            "description": "What kind of non-booking turn this was.",
        },
        "summary": {
            "type": "string",
            "description": "One short line describing what the caller asked or said.",
        },
    },
    required=["category", "summary"],
    handler=_handle_log_inquiry,
)

BOOKING_TOOLS: ToolsSchema = ToolsSchema(
    standard_tools=[
        _CHECK_AVAILABILITY_SCHEMA,
        _BOOK_APPOINTMENT_SCHEMA,
        _LOG_INQUIRY_SCHEMA,
    ]
)

__all__: list[str] = ["BOOKING_TOOLS", "post_call_transcript"]

# Re-exported for tests that want to wrap/monkeypatch the real handler logic.
_HANDLERS: dict[str, Any] = {
    "check_availability": _handle_check_availability,
    "book_appointment": _handle_book_appointment,
    "log_inquiry": _handle_log_inquiry,
}
