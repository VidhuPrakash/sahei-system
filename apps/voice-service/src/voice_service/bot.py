import os

from dotenv import load_dotenv
from loguru import logger
from pipecat.frames.frames import (
    Frame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMRunFrame,
    LLMTextFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.services.groq.llm import GroqLLMService
from pipecat.services.sarvam.stt import SarvamSTTService
from pipecat.transcriptions.language import Language
from pipecat.transports.base_transport import BaseTransport
from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams
from pipecat.workers.runner import WorkerRunner

from voice_service.prompts import BOOKING_SYSTEM_PROMPT

load_dotenv(override=True)


class AssistantResponseLogger(FrameProcessor):
    """Logs the LLM's full text reply via Loguru; passes all frames through unchanged.

    Must sit before ``context_aggregator.assistant()`` — that aggregator consumes
    LLMTextFrame internally without forwarding it, so this is the only point
    downstream of the LLM where the streamed text is observable (stand-in for
    where a TTS service will eventually consume it).
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


async def run_bot(transport: BaseTransport, runner_args: RunnerArguments) -> None:
    """Wire Sarvam STT -> Groq dialogue LLM -> logged text response (no TTS yet)."""
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
    context = LLMContext()
    context_aggregator = LLMContextAggregatorPair(context)
    assistant_logger = AssistantResponseLogger()

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            context_aggregator.user(),
            llm,
            assistant_logger,
            context_aggregator.assistant(),
            transport.output(),
        ]
    )
    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(
            audio_in_sample_rate=8000,
            audio_out_sample_rate=8000,
        ),
        # Exotel's telephony WebSocket never sends the RTVI client-ready handshake,
        # so the default RTVI processor blocks pipeline setup until it times out.
        enable_rtvi=False,
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

    await runner.run()


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
