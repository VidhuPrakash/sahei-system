"""Per-call state threaded through Pipecat's `app_resources` mechanism.

Built once per call in `bot.run_bot` from the Exotel handshake
(`runner_args.call_data`) and a shared `httpx.AsyncClient`, then handed to
`PipelineWorker(app_resources=...)` so every tool handler in `tools.py` can
reach it via `FunctionCallParams.app_resources`.
"""

from dataclasses import dataclass

import httpx

from voice_service.session_store import CallSessionStore


@dataclass
class CallContext:
    """business_id is hardcoded pilot-scope (see prompts.ORG_CONTEXT); real
    phone-number-to-business resolution is a later multi-tenant session."""

    business_id: str
    customer_phone: str
    http_client: httpx.AsyncClient
    session_store: CallSessionStore
    call_sid: str
    # Set by tools.py's handlers on a successful booking/inquiry; read at call
    # end (bot.run_bot's finally block) to derive the call's outcome.
    booking_reference: str | None = None
    inquiry_logged: bool = False
