FROM python:3.11-slim

RUN pip install --no-cache-dir uv

# Large wheels (numpy, onnxruntime, etc.) can exceed uv's default 30s
# per-request timeout on a slow connection.
ENV UV_HTTP_TIMEOUT=120

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY . .
RUN uv sync --frozen --no-dev

EXPOSE 7860
CMD ["uv", "run", "python", "src/voice_service/bot.py", "-t", "exotel", "--host", "0.0.0.0"]
