import os
import re
import sys
from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest
from fakeredis import FakeAsyncRedis
from pipecat.frames.frames import LLMRunFrame, TranscriptionFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.services.groq.llm import GroqLLMService
from pipecat.tests.utils import SleepFrame, run_test
from pipecat.transcriptions.language import Language
from pipecat.utils.time import time_now_iso8601

from voice_service import tools
from voice_service.bot import AssistantResponseLogger
from voice_service.call_context import CallContext
from voice_service.prompts import BOOKING_SYSTEM_PROMPT, ORG_CONTEXT
from voice_service.session_store import CallSessionStore
from voice_service.tools import BOOKING_TOOLS

MALAYALAM_SCRIPT = re.compile(r"[ഀ-ൿ]")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(
        encoding="utf-8"
    )  # Windows consoles default to cp1252, which can't print Malayalam.

pytestmark = pytest.mark.skipif(
    not os.environ.get("GROQ_API_KEY"),
    reason="requires a live GROQ_API_KEY",
)


def _fake_booking_api(request: httpx.Request) -> httpx.Response:
    if request.url.path == "/booking/check-availability":
        return httpx.Response(200, json={"available": True})
    if request.url.path == "/booking/book-appointment":
        return httpx.Response(200, json={"status": "confirmed", "bookingReference": "TESTREF1"})
    if request.url.path == "/booking/log-inquiry":
        return httpx.Response(200, json={"logged": True, "inquiryId": "test-inquiry"})
    return httpx.Response(404)


@pytest.fixture(autouse=True)
async def _wire_tool_handlers_to_fake_backend(
    monkeypatch: pytest.MonkeyPatch,
) -> AsyncIterator[CallContext]:
    """These tests build a raw Pipeline (see `_make_pipeline`), never a
    PipelineWorker, so there's no `app_resources` for the real tool handlers
    to read — inject a CallContext backed by a fake apps/api instead, so
    check_availability/book_appointment/log_inquiry behave like a real,
    healthy backend rather than hitting tools.py's network-failure fallback."""
    call_context = CallContext(
        business_id="test-business",
        customer_phone="+910000000000",
        http_client=httpx.AsyncClient(
            base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_booking_api)
        ),
        session_store=CallSessionStore(FakeAsyncRedis(decode_responses=True)),
        call_sid="test-call-sid",
    )

    def _inject(handler: Any) -> Any:
        async def _wrapped(params: Any) -> None:
            params.app_resources = call_context
            await handler(params)

        return _wrapped

    monkeypatch.setattr(
        tools._CHECK_AVAILABILITY_SCHEMA,
        "_handler",
        _inject(tools._HANDLERS["check_availability"]),
        raising=False,
    )
    monkeypatch.setattr(
        tools._BOOK_APPOINTMENT_SCHEMA,
        "_handler",
        _inject(tools._HANDLERS["book_appointment"]),
        raising=False,
    )
    monkeypatch.setattr(
        tools._LOG_INQUIRY_SCHEMA,
        "_handler",
        _inject(tools._HANDLERS["log_inquiry"]),
        raising=False,
    )

    yield call_context
    await call_context.http_client.aclose()


async def _run_turn(
    pipeline: Pipeline,
    assistant_logger: AssistantResponseLogger,
    text: str,
    *,
    sleep: float = 5.0,
) -> str:
    """`sleep` should be increased for turns expected to trigger a tool call —
    those need a second Groq completion round-trip after the tool result lands,
    on top of the first one that detects the tool call, so 5s (fine for a
    plain conversational turn) isn't consistently enough."""
    await run_test(
        pipeline,
        frames_to_send=[
            TranscriptionFrame(
                text=text,
                user_id="test-user",
                timestamp=time_now_iso8601(),
                language=Language.ML_IN,
            ),
            LLMRunFrame(),
            SleepFrame(sleep=sleep),
        ],
    )
    # context_aggregator.assistant() consumes LLMTextFrame/LLMFullResponse*Frame
    # internally without forwarding them, so the reply is only observable via
    # AssistantResponseLogger, which sits upstream of it.
    reply = assistant_logger.last_response
    print(f"caller: {text}\nassistant: {reply}\n")
    return reply


def _make_pipeline() -> tuple[Pipeline, AssistantResponseLogger]:
    llm = GroqLLMService(
        api_key=os.environ["GROQ_API_KEY"],
        settings=GroqLLMService.Settings(
            model=os.environ["GROQ_MODEL"],
            system_instruction=BOOKING_SYSTEM_PROMPT,
        ),
    )
    llm.append_system_instruction(ORG_CONTEXT)
    context = LLMContext(tools=BOOKING_TOOLS)
    context_aggregator = LLMContextAggregatorPair(context)
    assistant_logger = AssistantResponseLogger()
    pipeline = Pipeline(
        [
            context_aggregator.user(),
            llm,
            assistant_logger,
            context_aggregator.assistant(),
        ]
    )
    return pipeline, assistant_logger


@pytest.mark.asyncio
async def test_happy_path_greet_ask_confirm() -> None:
    pipeline, assistant_logger = _make_pipeline()

    greeting = await _run_turn(pipeline, assistant_logger, "ഹലോ")
    assert MALAYALAM_SCRIPT.search(greeting)

    ask_time = await _run_turn(pipeline, assistant_logger, "എനിക്ക് ഒരു ഹെയർകട്ട് വേണം")
    assert MALAYALAM_SCRIPT.search(ask_time)

    # check_availability fires here — needs time for the tool round-trip plus
    # the follow-up completion, not just the initial one.
    confirmation = await _run_turn(
        pipeline, assistant_logger, "നാളെ രാവിലെ പത്ത് മണിക്ക്", sleep=15.0
    )
    assert MALAYALAM_SCRIPT.search(confirmation)


@pytest.mark.asyncio
async def test_fallback_on_unclear_input() -> None:
    pipeline, assistant_logger = _make_pipeline()

    reply = await _run_turn(pipeline, assistant_logger, "ഇന്ന് മഴ പെയ്യുമോ?")
    assert MALAYALAM_SCRIPT.search(reply)
    assert reply.strip() != ""


@pytest.mark.asyncio
async def test_off_flow_question_answered_from_org_context() -> None:
    """Mid-conversation business questions should get answered, not stall the flow."""
    pipeline, assistant_logger = _make_pipeline()

    await _run_turn(pipeline, assistant_logger, "ഹലോ")

    # log_inquiry may fire alongside the spoken answer here, adding a second
    # completion round-trip — same reasoning as the tool-call test above.
    parking_reply = await _run_turn(
        pipeline, assistant_logger, "നിങ്ങളുടെ അടുത്ത് പാർക്കിംഗ് ഉണ്ടോ?", sleep=15.0
    )
    assert MALAYALAM_SCRIPT.search(parking_reply)
    assert parking_reply.strip() != ""

    hours_reply = await _run_turn(
        pipeline, assistant_logger, "നിങ്ങളുടെ പ്രവർത്തന സമയം എന്താണ്?", sleep=15.0
    )
    assert MALAYALAM_SCRIPT.search(hours_reply)
    assert hours_reply.strip() != ""


@pytest.mark.asyncio
async def test_tools_fire_during_happy_path_booking(monkeypatch: pytest.MonkeyPatch) -> None:
    """Confirms check_availability and book_appointment actually get called
    (not just that the reply looks plausible) against the live model."""
    calls: dict[str, int] = {"check_availability": 0, "book_appointment": 0}
    # The autouse fixture already wired these to the fake backend — layer
    # call counting on top of that, rather than the raw stub handlers.
    real_check = tools._CHECK_AVAILABILITY_SCHEMA._handler
    real_book = tools._BOOK_APPOINTMENT_SCHEMA._handler

    async def _wrapped_check(params: object) -> None:
        calls["check_availability"] += 1
        await real_check(params)

    async def _wrapped_book(params: object) -> None:
        calls["book_appointment"] += 1
        await real_book(params)

    monkeypatch.setattr(tools._CHECK_AVAILABILITY_SCHEMA, "_handler", _wrapped_check, raising=False)
    monkeypatch.setattr(tools._BOOK_APPOINTMENT_SCHEMA, "_handler", _wrapped_book, raising=False)

    pipeline, assistant_logger = _make_pipeline()

    await _run_turn(pipeline, assistant_logger, "ഹലോ")
    await _run_turn(pipeline, assistant_logger, "എനിക്ക് ഒരു ഹെയർകട്ട് വേണം")
    # check_availability fires here — needs time for the tool round-trip
    # plus the follow-up completion, not just the initial one.
    await _run_turn(pipeline, assistant_logger, "നാളെ രാവിലെ പത്ത് മണിക്ക്", sleep=15.0)
    # The flow now asks for name + area before confirming — supply both.
    confirmation = await _run_turn(
        pipeline, assistant_logger, "എന്റെ പേര് അനു, ഞാൻ എറണാകുളത്താണ്", sleep=15.0
    )
    # book_appointment fires here — same reasoning.
    final = await _run_turn(pipeline, assistant_logger, "അതെ, ശരിയാണ്", sleep=15.0)

    assert MALAYALAM_SCRIPT.search(confirmation)
    assert MALAYALAM_SCRIPT.search(final)
    assert calls["check_availability"] >= 1
    assert calls["book_appointment"] >= 1
