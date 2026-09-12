import time
from collections.abc import AsyncIterator
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock

import pytest
from pipecat.frames.frames import LLMRunFrame, MetricsFrame, TranscriptionFrame, TTSStartedFrame
from pipecat.metrics.metrics import LLMTokenUsage, LLMUsageMetricsData, TTFBMetricsData
from pipecat.pipeline.pipeline import Pipeline
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.services.groq.llm import GroqLLMService
from pipecat.tests.utils import SleepFrame, run_test
from pipecat.transcriptions.language import Language
from pipecat.utils.time import time_now_iso8601

from voice_service.bot import (
    AssistantResponseLogger,
    MetricsAndLatencyLogger,
    TranscriptInLogger,
    TurnTracker,
)
from voice_service.prompts import BOOKING_SYSTEM_PROMPT

CANNED_REPLY = "എന്ത് സഹായമാണ് വേണ്ടത്?"


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

    context = LLMContext()
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
async def test_transcript_in_logger_starts_a_new_turn() -> None:
    turns = TurnTracker()
    transcript_logger = TranscriptInLogger(turns)

    await run_test(
        Pipeline([transcript_logger]),
        frames_to_send=[
            TranscriptionFrame(
                text="ഹലോ", user_id="test-user", timestamp=time_now_iso8601(), language=Language.ML_IN
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
                        value=LLMTokenUsage(
                            prompt_tokens=10, completion_tokens=5, total_tokens=15
                        ),
                    ),
                ]
            ),
            SleepFrame(sleep=0.1),
        ],
    )

    # Turn id is untouched by metrics frames — only TranscriptInLogger advances it.
    assert turns.turn_id == 1
