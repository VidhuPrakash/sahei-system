# voice-service

Pipecat pipeline: Exotel AgentStream (telephony) -> Sarvam Saaras (STT) -> Groq openai/gpt-oss-120b (dialogue) -> Sarvam Bulbul v3 (TTS) -> spoken Malayalam reply.

Not part of the Turborepo task graph — run and tested independently with `uv`.

```
uv sync
uv run pytest
uv run mypy src
uv run ruff check src
```
