from collections.abc import AsyncIterator
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock

import pytest
from pipecat.frames.frames import LLMRunFrame, TranscriptionFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.services.groq.llm import GroqLLMService
from pipecat.tests.utils import SleepFrame, run_test
from pipecat.transcriptions.language import Language
from pipecat.utils.time import time_now_iso8601

from voice_service.bot import AssistantResponseLogger
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
