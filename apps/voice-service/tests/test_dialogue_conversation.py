import os
import re
import sys

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

MALAYALAM_SCRIPT = re.compile(r"[ഀ-ൿ]")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(
        encoding="utf-8"
    )  # Windows consoles default to cp1252, which can't print Malayalam.

pytestmark = pytest.mark.skipif(
    not os.environ.get("GROQ_API_KEY"),
    reason="requires a live GROQ_API_KEY",
)


async def _run_turn(
    pipeline: Pipeline, assistant_logger: AssistantResponseLogger, text: str
) -> str:
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
            SleepFrame(sleep=5.0),
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
    return pipeline, assistant_logger


@pytest.mark.asyncio
async def test_happy_path_greet_ask_confirm() -> None:
    pipeline, assistant_logger = _make_pipeline()

    greeting = await _run_turn(pipeline, assistant_logger, "ഹലോ")
    assert MALAYALAM_SCRIPT.search(greeting)

    ask_time = await _run_turn(pipeline, assistant_logger, "എനിക്ക് ഒരു ഹെയർകട്ട് വേണം")
    assert MALAYALAM_SCRIPT.search(ask_time)

    confirmation = await _run_turn(pipeline, assistant_logger, "നാളെ രാവിലെ പത്ത് മണിക്ക്")
    assert MALAYALAM_SCRIPT.search(confirmation)


@pytest.mark.asyncio
async def test_fallback_on_unclear_input() -> None:
    pipeline, assistant_logger = _make_pipeline()

    reply = await _run_turn(pipeline, assistant_logger, "ഇന്ന് മഴ പെയ്യുമോ?")
    assert MALAYALAM_SCRIPT.search(reply)
    assert reply.strip() != ""
