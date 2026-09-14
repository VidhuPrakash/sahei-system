"""Redis-backed structured booking state for a single call, keyed by call_sid.

Holds only the structured fields a tool handler has learned so far (never a
transcript or LLMContext snapshot) — see `CallSession`. A normal, unbroken
call never needs this: pipecat's in-memory `LLMContext` already holds full
conversation history for the life of one `run_bot()` process.

This store exists for one specific, unverified scenario: Exotel's WebSocket
to our server drops mid-call (a network blip) while the phone call is still
live on Exotel's side, and Exotel reconnects with a *new* WebSocket for that
same call, carrying the same call_sid. If that reconnect behavior is real,
the fresh `run_bot()` invocation it triggers can look up the same call_sid
here and pick up where the last invocation left off instead of re-asking
everything. Whether Exotel's AgentStream actually reuses the call_sid on such
a reconnect has not been confirmed — this is cheap, harmless defensive code:
if the assumption is wrong, every lookup simply misses and behaves like a
fresh call.

Note this is unrelated to pipecat's `PipelineWorker` idle timeout, which by
default cancels the worker *and* the runner — a full call teardown/hangup,
not a resume-in-place restart. Idle-timeout is just one more path that must
reach the cleanup in `bot.run_bot`'s `finally` block, not a rehydration
trigger.

Stored as a Redis hash (not a JSON blob) because fields arrive incrementally
from independent tool handlers — a hash's per-field HSET is a single,
race-free round trip; a JSON string would need a GET-merge-SET cycle for
every partial update.

Every method here fails soft: a Redis outage must never crash the call's
audio pipeline, so RedisError is caught, logged, and degrades to a no-op /
None rather than propagating — mirroring `tools.py`'s handling of
httpx.HTTPError, but centralized here instead of repeated at each call site.
"""

from dataclasses import dataclass

from loguru import logger
from redis.asyncio import Redis
from redis.exceptions import RedisError

_KEY_PREFIX = "voice-service:call-session:"

# Crash-safety net, independent of the explicit delete-on-call-end path: long
# enough to survive a brief reconnect gap, short enough that a session
# orphaned by a hard crash doesn't hold caller PII indefinitely.
DEFAULT_TTL_SECONDS = 3600


@dataclass
class CallSession:
    """Structured booking-progress snapshot for one call. All optional
    fields start unknown and are filled in as tool handlers learn them."""

    call_sid: str
    business_id: str
    customer_phone: str
    service: str | None = None
    date: str | None = None
    time: str | None = None
    customer_name: str | None = None
    customer_area: str | None = None
    created_at: str | None = None


def _as_str(value: bytes | str) -> str:
    """redis-py's stubs type hash values as `bytes | str` unconditionally
    (they don't vary the return type on `decode_responses`), even though this
    store always constructs its client with `decode_responses=True` and so
    only ever actually receives `str` at runtime. Decoding defensively here
    keeps that guarantee true even if a client were ever misconfigured."""
    return value.decode() if isinstance(value, bytes) else value


class CallSessionStore:
    """Wraps a `redis.asyncio.Redis` client for get/upsert/delete of a
    `CallSession` by call_sid. One instance is built per call in `bot.run_bot`
    and threaded through `CallContext` so tool handlers can reach it."""

    def __init__(self, client: Redis, ttl_seconds: int = DEFAULT_TTL_SECONDS) -> None:
        self._client = client
        self._ttl_seconds = ttl_seconds

    @staticmethod
    def _key(call_sid: str) -> str:
        return f"{_KEY_PREFIX}{call_sid}"

    async def get(self, call_sid: str) -> CallSession | None:
        try:
            data = await self._client.hgetall(self._key(call_sid))
        except RedisError as exc:
            logger.error("session_store get failed for call_sid={}: {}", call_sid, exc)
            return None
        if not data:
            return None
        fields = {_as_str(key): _as_str(value) for key, value in data.items()}
        return CallSession(
            call_sid=call_sid,
            business_id=fields.get("business_id", ""),
            customer_phone=fields.get("customer_phone", ""),
            service=fields.get("service") or None,
            date=fields.get("date") or None,
            time=fields.get("time") or None,
            customer_name=fields.get("customer_name") or None,
            customer_area=fields.get("customer_area") or None,
            created_at=fields.get("created_at") or None,
        )

    async def upsert(self, call_sid: str, **fields: str) -> None:
        """Partial merge-write: only non-empty fields are written, so a tool
        handler that only just learned service/date/time never clobbers
        customer_name/customer_area written by an earlier or later call.
        Refreshes the TTL on every write so an active call's session doesn't
        expire mid-conversation."""
        mapping = {key: value for key, value in fields.items() if value}
        if not mapping:
            return
        key = self._key(call_sid)
        try:
            await self._client.hset(key, mapping=mapping)  # type: ignore[arg-type]
            await self._client.expire(key, self._ttl_seconds)
        except RedisError as exc:
            logger.error("session_store upsert failed for call_sid={}: {}", call_sid, exc)

    async def delete(self, call_sid: str) -> None:
        try:
            await self._client.delete(self._key(call_sid))
        except RedisError as exc:
            logger.error("session_store delete failed for call_sid={}: {}", call_sid, exc)

    async def aclose(self) -> None:
        try:
            await self._client.aclose()
        except RedisError as exc:
            logger.error("session_store client close failed: {}", exc)


__all__ = ["DEFAULT_TTL_SECONDS", "CallSession", "CallSessionStore"]
