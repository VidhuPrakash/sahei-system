import inspect
from unittest.mock import AsyncMock

from pipecat.frames.frames import TranscriptionFrame
from pipecat.processors.frame_processor import FrameDirection

from voice_service.bot import TranscriptLogger, bot, run_bot


def test_bot_entrypoints_are_coroutine_functions() -> None:
    assert inspect.iscoroutinefunction(bot)
    assert inspect.iscoroutinefunction(run_bot)


async def test_transcript_logger_logs_and_forwards_transcription_frame() -> None:
    processor = TranscriptLogger()
    processor.push_frame = AsyncMock()  # type: ignore[method-assign]
    frame = TranscriptionFrame(text="ninak sugham aano", user_id="caller", timestamp="")

    await processor.process_frame(frame, FrameDirection.DOWNSTREAM)

    processor.push_frame.assert_awaited_once_with(frame, FrameDirection.DOWNSTREAM)
