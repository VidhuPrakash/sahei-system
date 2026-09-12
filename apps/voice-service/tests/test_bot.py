import inspect

from voice_service.bot import bot, run_bot


def test_bot_entrypoints_are_coroutine_functions() -> None:
    assert inspect.iscoroutinefunction(bot)
    assert inspect.iscoroutinefunction(run_bot)
