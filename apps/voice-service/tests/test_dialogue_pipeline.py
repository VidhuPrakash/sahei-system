import time
from collections.abc import AsyncIterator
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock

import httpx
import pytest
from fakeredis import FakeAsyncRedis
from pipecat.frames.frames import LLMRunFrame, MetricsFrame, TranscriptionFrame, TTSStartedFrame
from pipecat.metrics.metrics import LLMTokenUsage, LLMUsageMetricsData, TTFBMetricsData
from pipecat.pipeline.pipeline import Pipeline
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.services.groq.llm import GroqLLMService
from pipecat.tests.utils import SleepFrame, run_test
from pipecat.transcriptions.language import Language
from pipecat.utils.time import time_now_iso8601

from voice_service import tools
from voice_service.bot import (
    AssistantResponseLogger,
    MetricsAndLatencyLogger,
    TranscriptInLogger,
    TurnTracker,
)
from voice_service.call_context import CallContext
from voice_service.prompts import BOOKING_SYSTEM_PROMPT
from voice_service.session_store import CallSessionStore
from voice_service.tools import BOOKING_TOOLS

CANNED_REPLY = "എന്ത് സഹായമാണ് വേണ്ടത്?"
TOOL_CALL_ID = "call_1"
FAKE_ARGS = '{"service": "ഹെയർകട്ട്", "date": "നാളെ", "time": "രാവിലെ 10 മണി"}'


def _mock_stream_chunks() -> AsyncIterator[Any]:
    async def _gen() -> AsyncIterator[Any]:
        yield SimpleNamespace(
            model="llama-3.3-70b-versatile",
            usage=None,
            choices=[
                SimpleNamespace(
                    delta=SimpleNamespace(content=CANNED_REPLY, tool_calls=None),
                    finish_reason=None,
                )
            ],
        )
        yield SimpleNamespace(
            model="llama-3.3-70b-versatile",
            usage=None,
            choices=[
                SimpleNamespace(
                    delta=SimpleNamespace(content=None, tool_calls=None), finish_reason="stop"
                )
            ],
        )

    return _gen()


def _mock_tool_call_chunks() -> AsyncIterator[Any]:
    async def _gen() -> AsyncIterator[Any]:
        yield SimpleNamespace(
            model="llama-3.3-70b-versatile",
            usage=None,
            choices=[
                SimpleNamespace(
                    delta=SimpleNamespace(
                        content=None,
                        tool_calls=[
                            SimpleNamespace(
                                index=0,
                                id=TOOL_CALL_ID,
                                function=SimpleNamespace(name="check_availability", arguments=None),
                            )
                        ],
                    ),
                    finish_reason=None,
                )
            ],
        )
        yield SimpleNamespace(
            model="llama-3.3-70b-versatile",
            usage=None,
            choices=[
                SimpleNamespace(
                    delta=SimpleNamespace(
                        content=None,
                        tool_calls=[
                            SimpleNamespace(
                                index=0,
                                id=TOOL_CALL_ID,
                                function=SimpleNamespace(name=None, arguments=FAKE_ARGS),
                            )
                        ],
                    ),
                    finish_reason=None,
                )
            ],
        )
        yield SimpleNamespace(
            model="llama-3.3-70b-versatile",
            usage=None,
            choices=[
                SimpleNamespace(
                    delta=SimpleNamespace(content=None, tool_calls=None),
                    finish_reason="tool_calls",
                )
            ],
        )

    return _gen()


@pytest.mark.asyncio
async def test_dialogue_pipeline_wiring() -> None:
    llm = GroqLLMService(
        api_key="test-key",
        settings=GroqLLMService.Settings(
            model="llama-3.3-70b-versatile",
            system_instruction=BOOKING_SYSTEM_PROMPT,
        ),
    )
    llm._client.chat.completions.create = AsyncMock(  # type: ignore[attr-defined]
        return_value=_mock_stream_chunks()
    )

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

    await run_test(
        pipeline,
        frames_to_send=[
            TranscriptionFrame(
                text="ഹലോ",
                user_id="test-user",
                timestamp=time_now_iso8601(),
                language=Language.ML_IN,
            ),
            LLMRunFrame(),
            SleepFrame(sleep=0.5),
        ],
    )

    # context_aggregator.assistant() consumes LLMTextFrame/LLMFullResponse*Frame
    # internally without forwarding them, so the streamed reply is only
    # observable via AssistantResponseLogger, which sits upstream of it.
    assert assistant_logger.last_response == CANNED_REPLY

    messages = context.get_messages()
    assert any("ഹലോ" in str(m.get("content", "")) for m in messages)
    assert any(CANNED_REPLY in str(m.get("content", "")) for m in messages)


@pytest.mark.asyncio
async def test_dialogue_pipeline_tool_call_round_trip(monkeypatch: pytest.MonkeyPatch) -> None:
    # `run_test` builds its own PipelineWorker with no app_resources, so the
    # real check_availability handler needs one injected onto `params`
    # directly, backed by a fake transport standing in for apps/api.
    def _fake_booking_api(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"available": True})

    call_context = CallContext(
        business_id="test-business",
        customer_phone="+910000000000",
        http_client=httpx.AsyncClient(
            base_url="http://booking-api.test", transport=httpx.MockTransport(_fake_booking_api)
        ),
        session_store=CallSessionStore(FakeAsyncRedis(decode_responses=True)),
        call_sid="test-call-sid",
    )
    real_check = tools._HANDLERS["check_availability"]

    async def _wrapped_check(params: Any) -> None:
        params.app_resources = call_context
        await real_check(params)

    monkeypatch.setattr(tools._CHECK_AVAILABILITY_SCHEMA, "_handler", _wrapped_check, raising=False)

    llm = GroqLLMService(
        api_key="test-key",
        settings=GroqLLMService.Settings(
            model="llama-3.3-70b-versatile",
            system_instruction=BOOKING_SYSTEM_PROMPT,
        ),
    )
    llm._client.chat.completions.create = AsyncMock(  # type: ignore[attr-defined]
        side_effect=[_mock_tool_call_chunks(), _mock_stream_chunks()]
    )

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

    await run_test(
        pipeline,
        frames_to_send=[
            TranscriptionFrame(
                text="നാളെ രാവിലെ 10 മണിക്ക് ഒരു ഹെയർകട്ട് വേണം",
                user_id="test-user",
                timestamp=time_now_iso8601(),
                language=Language.ML_IN,
            ),
            LLMRunFrame(),
            SleepFrame(sleep=0.5),
        ],
    )

    # Confirms the schema's handler actually ran (hitting the fake booking API
    # and reporting availability) and the LLM service auto-continued into a
    # second completion afterward.
    messages = context.get_messages()
    tool_messages = [m for m in messages if m.get("role") == "tool"]
    assert len(tool_messages) == 1
    assert '"available": true' in str(tool_messages[0].get("content", "")).lower()

    # The second (post-tool-result) completion round produced the final reply.
    assert assistant_logger.last_response == CANNED_REPLY

    await call_context.http_client.aclose()


@pytest.mark.asyncio
async def test_transcript_in_logger_starts_a_new_turn() -> None:
    turns = TurnTracker()
    transcript_logger = TranscriptInLogger(turns)

    await run_test(
        Pipeline([transcript_logger]),
        frames_to_send=[
            TranscriptionFrame(
                text="ഹലോ",
                user_id="test-user",
                timestamp=time_now_iso8601(),
                language=Language.ML_IN,
            ),
            SleepFrame(sleep=0.1),
        ],
    )

    assert turns.turn_id == 1
    first_started_at = turns.turn_started_at
    assert first_started_at is not None

    await run_test(
        Pipeline([transcript_logger]),
        frames_to_send=[
            TranscriptionFrame(
                text="ബുക്ക് ചെയ്യണം",
                user_id="test-user",
                timestamp=time_now_iso8601(),
                language=Language.ML_IN,
            ),
            SleepFrame(sleep=0.1),
        ],
    )

    assert turns.turn_id == 2
    assert turns.turn_started_at is not None
    assert turns.turn_started_at >= first_started_at


@pytest.mark.asyncio
async def test_transcript_in_logger_ignores_blank_transcript() -> None:
    turns = TurnTracker()
    transcript_logger = TranscriptInLogger(turns)

    await run_test(
        Pipeline([transcript_logger]),
        frames_to_send=[
            TranscriptionFrame(
                text="   ",
                user_id="test-user",
                timestamp=time_now_iso8601(),
                language=Language.ML_IN,
            ),
            SleepFrame(sleep=0.1),
        ],
    )

    assert turns.turn_id == 0
    assert turns.turn_started_at is None


@pytest.mark.asyncio
async def test_metrics_logger_computes_latency_from_transcript_to_tts_start() -> None:
    turns = TurnTracker(turn_id=1, turn_started_at=time.monotonic())
    metrics_logger = MetricsAndLatencyLogger(turns)

    await run_test(
        Pipeline([metrics_logger]),
        frames_to_send=[
            TTSStartedFrame(),
            SleepFrame(sleep=0.1),
        ],
    )

    assert turns.turn_started_at is None


@pytest.mark.asyncio
async def test_metrics_logger_logs_each_metrics_kind_without_error() -> None:
    turns = TurnTracker(turn_id=1)
    metrics_logger = MetricsAndLatencyLogger(turns)

    await run_test(
        Pipeline([metrics_logger]),
        frames_to_send=[
            MetricsFrame(
                data=[
                    TTFBMetricsData(processor="stt", model="saaras:v4", value=0.12),
                    LLMUsageMetricsData(
                        processor="llm",
                        model="llama-3.3-70b-versatile",
                        value=LLMTokenUsage(prompt_tokens=10, completion_tokens=5, total_tokens=15),
                    ),
                ]
            ),
            SleepFrame(sleep=0.1),
        ],
    )

    # Turn id is untouched by metrics frames — only TranscriptInLogger advances it.
    assert turns.turn_id == 1
