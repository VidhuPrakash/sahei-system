import inspect

from voice_service.authority_prompts import AUTHORITY_SYSTEM_PROMPT
from voice_service.bot import _select_llm_config, bot, run_bot
from voice_service.prompts import BOOKING_SYSTEM_PROMPT
from voice_service.tools import AUTHORITY_TOOLS, BOOKING_TOOLS


def test_bot_entrypoints_are_coroutine_functions() -> None:
    assert inspect.iscoroutinefunction(bot)
    assert inspect.iscoroutinefunction(run_bot)


def test_select_llm_config_picks_authority_prompt_and_tools_when_authority() -> None:
    prompt, tools = _select_llm_config(is_authority=True)
    assert prompt == AUTHORITY_SYSTEM_PROMPT
    assert tools is AUTHORITY_TOOLS


def test_select_llm_config_picks_booking_prompt_and_tools_when_not_authority() -> None:
    prompt, tools = _select_llm_config(is_authority=False)
    assert prompt == BOOKING_SYSTEM_PROMPT
    assert tools is BOOKING_TOOLS
