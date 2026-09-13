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

from typing import Any

import httpx
from loguru import logger
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.services.llm_service import FunctionCallParams

from voice_service.call_context import CallContext

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
    payload = {
        "businessId": ctx.business_id,
        "service": params.arguments.get("service", ""),
        "date": params.arguments.get("date", ""),
        "time": params.arguments.get("time", ""),
    }
    try:
        response = await ctx.http_client.post("/booking/check-availability", json=payload)
        response.raise_for_status()
        result = response.json()
    except httpx.HTTPError as exc:
        logger.error("check_availability request failed: {}", exc)
        result = {"error": "backend_unavailable"}
    await params.result_callback(result)


async def _handle_book_appointment(params: FunctionCallParams) -> None:
    ctx: CallContext = params.app_resources
    payload = {
        "businessId": ctx.business_id,
        "service": params.arguments.get("service", ""),
        "date": params.arguments.get("date", ""),
        "time": params.arguments.get("time", ""),
        "customerName": params.arguments.get("customer_name", ""),
        "customerArea": params.arguments.get("customer_area", ""),
    }
    try:
        response = await ctx.http_client.post(
            "/booking/book-appointment",
            json=payload,
            headers={"x-customer-phone": ctx.customer_phone},
        )
        response.raise_for_status()
        result = response.json()
    except httpx.HTTPError as exc:
        logger.error("book_appointment request failed: {}", exc)
        result = {"error": "backend_unavailable"}
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
    except httpx.HTTPError as exc:
        logger.error("log_inquiry request failed: {}", exc)
        result = {"logged": False}
    await params.result_callback(result)


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

__all__: list[str] = ["BOOKING_TOOLS"]

# Re-exported for tests that want to wrap/monkeypatch the real handler logic.
_HANDLERS: dict[str, Any] = {
    "check_availability": _handle_check_availability,
    "book_appointment": _handle_book_appointment,
    "log_inquiry": _handle_log_inquiry,
}
