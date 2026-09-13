import os
import time
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx
from dotenv import load_dotenv
from loguru import logger
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import (
    Frame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMRunFrame,
    LLMTextFrame,
    MetricsFrame,
    TranscriptionFrame,
    TTSStartedFrame,
)
from pipecat.metrics.metrics import (
    LLMUsageMetricsData,
    MetricsData,
    ProcessingMetricsData,
    TTFAMetricsData,
    TTFBMetricsData,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.services.groq.llm import GroqLLMService
from pipecat.services.sarvam.stt import SarvamSTTService
from pipecat.services.sarvam.tts import SarvamTTSService
from pipecat.transcriptions.language import Language
from pipecat.transports.base_transport import BaseTransport
from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams
from pipecat.workers.runner import WorkerRunner

from voice_service.call_context import CallContext
from voice_service.prompts import BOOKING_SYSTEM_PROMPT, ORG_CONTEXT, current_date_context
from voice_service.tools import BOOKING_TOOLS

load_dotenv(override=True)

# Pilot scope: every call is assumed to be for this one hardcoded business,
# operating on India Standard Time (matches ORG_CONTEXT). Real phone-number
# to business/timezone resolution is a later multi-tenant session.
BUSINESS_TIMEZONE = ZoneInfo("Asia/Kolkata")


class AssistantResponseLogger(FrameProcessor):
    """Logs the LLM's full text reply via Loguru; passes all frames through unchanged.

    Must sit before the TTS service — TTS consumes LLMTextFrame internally without
    forwarding it, so this is the only point downstream of the LLM where the
    streamed text is observable.
    """

    def __init__(self) -> None:
        super().__init__()
        self._buffer: list[str] = []
        self.last_response = ""

    async def process_frame(self, frame: Frame, direction: FrameDirection) -> None:
        await super().process_frame(frame, direction)
        if isinstance(frame, LLMFullResponseStartFrame):
            self._buffer = []
        elif isinstance(frame, LLMTextFrame):
            self._buffer.append(frame.text)
        elif isinstance(frame, LLMFullResponseEndFrame):
            self.last_response = "".join(self._buffer)
            logger.info("Assistant response: {}", self.last_response)
        await self.push_frame(frame, direction)


@dataclass
class TurnTracker:
    """Per-call turn-sequencing state shared between the transcript and metrics loggers."""

    turn_id: int = 0
    turn_started_at: float | None = None


class TranscriptInLogger(FrameProcessor):
    """Logs each finalized user transcript and marks the start of a new turn.

    Must sit before context_aggregator.user() — that aggregator consumes
    TranscriptionFrame internally without forwarding it, so this is the only
    point downstream of STT where the transcript text is observable.
    """

    def __init__(self, turns: TurnTracker) -> None:
        super().__init__()
        self._turns = turns

    async def process_frame(self, frame: Frame, direction: FrameDirection) -> None:
        await super().process_frame(frame, direction)
        if isinstance(frame, TranscriptionFrame):
            self._turns.turn_id += 1
            self._turns.turn_started_at = time.monotonic()
            logger.info("Turn {} transcript: {}", self._turns.turn_id, frame.text)
        await self.push_frame(frame, direction)


class MetricsAndLatencyLogger(FrameProcessor):
    """Logs per-stage MetricsFrame data and round-trip turn latency.

    Must sit after tts (and thus after stt/llm too, since MetricsFrames are
    pushed downstream from whichever service generated them) — a single
    processor here sees every stage's metrics in frame order, plus the
    TTSStartedFrame that marks the moment the caller starts hearing the reply.
    """

    def __init__(self, turns: TurnTracker) -> None:
        super().__init__()
        self._turns = turns

    async def process_frame(self, frame: Frame, direction: FrameDirection) -> None:
        await super().process_frame(frame, direction)
        if isinstance(frame, MetricsFrame):
            for datum in frame.data:
                self._log_metric(datum)
        elif isinstance(frame, TTSStartedFrame):
            self._log_latency()
        await self.push_frame(frame, direction)

    def _log_metric(self, datum: MetricsData) -> None:
        turn_id = self._turns.turn_id
        if isinstance(datum, TTFBMetricsData):
            logger.info(
                "Turn {} metric: processor={} model={} ttfb={:.3f}s",
                turn_id,
                datum.processor,
                datum.model,
                datum.value,
            )
        elif isinstance(datum, TTFAMetricsData):
            logger.info(
                "Turn {} metric: processor={} model={} ttfa={:.3f}s "
                "(ttfb={:.3f}s leading_silence={:.3f}s)",
                turn_id,
                datum.processor,
                datum.model,
                datum.ttfa,
                datum.ttfb,
                datum.leading_silence,
            )
        elif isinstance(datum, ProcessingMetricsData):
            logger.info(
                "Turn {} metric: processor={} model={} processing={:.3f}s",
                turn_id,
                datum.processor,
                datum.model,
                datum.value,
            )
        elif isinstance(datum, LLMUsageMetricsData):
            logger.info(
                "Turn {} metric: processor={} model={} tokens prompt={} completion={} total={}",
                turn_id,
                datum.processor,
                datum.model,
                datum.value.prompt_tokens,
                datum.value.completion_tokens,
                datum.value.total_tokens,
            )

    def _log_latency(self) -> None:
        if self._turns.turn_started_at is None:
            return
        latency = time.monotonic() - self._turns.turn_started_at
        logger.info("Turn {} round-trip latency: {:.3f}s", self._turns.turn_id, latency)
        self._turns.turn_started_at = None


async def run_bot(transport: BaseTransport, runner_args: RunnerArguments) -> None:
    """Wire Sarvam STT -> Groq dialogue LLM -> Sarvam TTS -> spoken reply."""
    logger.info("Starting dialogue bot")

    stt = SarvamSTTService(
        api_key=os.environ["SARVAM_API_KEY"],
        settings=SarvamSTTService.Settings(model="saaras:v4", language=Language.ML_IN),
    )
    llm = GroqLLMService(
        api_key=os.environ["GROQ_API_KEY"],
        settings=GroqLLMService.Settings(
            model=os.environ["GROQ_MODEL"],
            system_instruction=BOOKING_SYSTEM_PROMPT,
        ),
    )
    llm.append_system_instruction(ORG_CONTEXT)
    llm.append_system_instruction(current_date_context(datetime.now(BUSINESS_TIMEZONE)))
    tts = SarvamTTSService(
        api_key=os.environ["SARVAM_API_KEY"],
        sample_rate=8000,
        settings=SarvamTTSService.Settings(
            model="bulbul:v3", voice="roopa", language=Language.ML_IN
        ),
    )
    context = LLMContext(tools=BOOKING_TOOLS)
    context_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer()),
    )
    assistant_logger = AssistantResponseLogger()
    turns = TurnTracker()
    transcript_logger = TranscriptInLogger(turns)
    metrics_logger = MetricsAndLatencyLogger(turns)

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            transcript_logger,
            context_aggregator.user(),
            llm,
            assistant_logger,
            tts,
            metrics_logger,
            transport.output(),
            context_aggregator.assistant(),
        ]
    )

    call_data = runner_args.call_data
    customer_phone = (call_data.from_number if call_data else None) or "unknown"
    call_context = CallContext(
        business_id=os.environ["BUSINESS_ID"],
        customer_phone=customer_phone,
        http_client=httpx.AsyncClient(
            base_url=os.environ["BOOKING_API_URL"],
            headers={"x-api-key": os.environ["BOOKING_API_KEY"]},
            timeout=10.0,
        ),
    )

    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(
            audio_in_sample_rate=8000,
            audio_out_sample_rate=8000,
            enable_metrics=True,
        ),
        # Exotel's telephony WebSocket never sends the RTVI client-ready handshake,
        # so the default RTVI processor blocks pipeline setup until it times out.
        enable_rtvi=False,
        app_resources=call_context,
    )

    runner = WorkerRunner(handle_sigint=runner_args.handle_sigint)
    await runner.add_workers(worker)

    @transport.event_handler("on_client_connected")  # type: ignore[untyped-decorator]
    async def on_client_connected(transport: BaseTransport, client: object) -> None:
        logger.info("Exotel call connected")
        await worker.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")  # type: ignore[untyped-decorator]
    async def on_client_disconnected(transport: BaseTransport, client: object) -> None:
        logger.info("Exotel call disconnected")
        await runner.cancel()

    try:
        await runner.run()
    finally:
        await call_context.http_client.aclose()


async def bot(runner_args: RunnerArguments) -> None:
    transport_params = {
        "exotel": lambda: FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
        ),
    }
    transport = await create_transport(runner_args, transport_params)
    await run_bot(transport, runner_args)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
