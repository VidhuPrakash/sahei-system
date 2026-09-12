from dotenv import load_dotenv
from loguru import logger
from pipecat.frames.frames import Frame, InputAudioRawFrame, OutputAudioRawFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.transports.base_transport import BaseTransport
from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams
from pipecat.workers.runner import WorkerRunner

load_dotenv(override=True)


class AudioEchoConverter(FrameProcessor):
    """Turns incoming caller audio into outgoing audio so the transport writes it back.

    The output transport only serializes ``OutputAudioRawFrame``, but the input
    transport emits ``InputAudioRawFrame`` — without this conversion, audio
    passed straight through is silently dropped instead of echoed.
    """

    async def process_frame(self, frame: Frame, direction: FrameDirection) -> None:
        await super().process_frame(frame, direction)
        if isinstance(frame, InputAudioRawFrame):
            await self.push_frame(
                OutputAudioRawFrame(
                    audio=frame.audio,
                    sample_rate=frame.sample_rate,
                    num_channels=frame.num_channels,
                ),
                FrameDirection.DOWNSTREAM,
            )
        else:
            await self.push_frame(frame, direction)


async def run_bot(transport: BaseTransport, runner_args: RunnerArguments) -> None:
    """Wire an echo pipeline: audio in -> audio out, unprocessed."""
    logger.info("Starting echo bot")

    pipeline = Pipeline([transport.input(), AudioEchoConverter(), transport.output()])
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
