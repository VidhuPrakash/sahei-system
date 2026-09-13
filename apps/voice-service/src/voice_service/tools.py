"""Tool schemas for the booking flow's side-effecting actions.

Three tools, each a `FunctionSchema` with its handler attached directly (the
LLM service auto-registers any schema that carries a `handler` the moment it's
advertised via `LLMContext.tools` — no separate `register_function` call
needed):

- `check_availability` / `book_appointment`: the actions in the scripted
  booking flow (see `prompts.BOOKING_SYSTEM_PROMPT`) that need a real backend
  round-trip. Stubbed for now — always succeeds, returns fake reference ids.
  A real availability/booking backend is Session 07/11 scope.
- `log_inquiry`: telemetry, not a Q&A tool. Fired whenever a turn goes off the
  booking rails (a business question answered from org context, an off-topic
  remark, an explicit non-booking call) so the outcome is recorded somewhere,
  without adding a tool per possible question.
"""

from typing import Any
from uuid import uuid4

from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.services.llm_service import FunctionCallParams


async def _handle_check_availability(params: FunctionCallParams) -> None:
    service = params.arguments.get("service", "")
    date = params.arguments.get("date", "")
    time = params.arguments.get("time", "")
    await params.result_callback(
        {
            "available": True,
            "service": service,
            "date": date,
            "time": time,
            "slot_reference": f"SLOT-{uuid4().hex[:8]}",
        }
    )


async def _handle_book_appointment(params: FunctionCallParams) -> None:
    service = params.arguments.get("service", "")
    date = params.arguments.get("date", "")
    time = params.arguments.get("time", "")
    customer_name = params.arguments.get("customer_name", "")
    customer_area = params.arguments.get("customer_area", "")
    await params.result_callback(
        {
            "status": "confirmed",
            "booking_id": f"BOOK-{uuid4().hex[:8]}",
            "service": service,
            "date": date,
            "time": time,
            "customer_name": customer_name,
            "customer_area": customer_area,
        }
    )


async def _handle_log_inquiry(params: FunctionCallParams) -> None:
    await params.result_callback(
        {
            "logged": True,
            "inquiry_id": f"INQ-{uuid4().hex[:8]}",
        }
    )


_CHECK_AVAILABILITY_SCHEMA = FunctionSchema(
    name="check_availability",
    description=(
        "Check whether a requested service and time slot is available, before "
        "confirming a booking with the caller."
    ),
    properties={
        "service": {
            "type": "string",
            "description": "The service requested, in the caller's own words.",
        },
        "date": {
            "type": "string",
            "description": "The requested date, as the caller stated it.",
        },
        "time": {
            "type": "string",
            "description": "The requested time, as the caller stated it.",
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
            "description": "The confirmed service.",
        },
        "date": {
            "type": "string",
            "description": "The confirmed date.",
        },
        "time": {
            "type": "string",
            "description": "The confirmed time.",
        },
        "customer_name": {
            "type": "string",
            "description": "The caller's name.",
        },
        "customer_area": {
            "type": "string",
            "description": "The caller's home area/locality.",
        },
        "slot_reference": {
            "type": "string",
            "description": "The slot_reference returned by check_availability, if available.",
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

# Re-exported for tests that want to wrap/monkeypatch the real stub logic.
_STUB_HANDLERS: dict[str, Any] = {
    "check_availability": _handle_check_availability,
    "book_appointment": _handle_book_appointment,
    "log_inquiry": _handle_log_inquiry,
}
