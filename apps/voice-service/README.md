# voice-service

Pipecat pipeline: Exotel AgentStream (telephony) -> Sarvam Saaras (STT) -> Claude Haiku 4.5 (dialogue) -> Sarvam Bulbul (TTS).

Not part of the Turborepo task graph — run and tested independently with `uv`.

```
uv sync
uv run pytest
uv run mypy src
uv run ruff check src
```
