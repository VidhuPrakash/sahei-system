import asyncio

import pytest
from fakeredis import FakeAsyncRedis
from redis.exceptions import RedisError

from voice_service.session_store import CallSessionStore


@pytest.fixture
def store() -> CallSessionStore:
    return CallSessionStore(FakeAsyncRedis(decode_responses=True))


async def test_get_missing_session_returns_none(store: CallSessionStore) -> None:
    assert await store.get("unknown-sid") is None


async def test_upsert_then_get_round_trips_fields(store: CallSessionStore) -> None:
    await store.upsert("sid-1", business_id="biz-1", customer_phone="+910000000000")

    session = await store.get("sid-1")

    assert session is not None
    assert session.call_sid == "sid-1"
    assert session.business_id == "biz-1"
    assert session.customer_phone == "+910000000000"
    assert session.service is None


async def test_partial_upsert_merges_without_clobbering(store: CallSessionStore) -> None:
    await store.upsert("sid-1", service="Haircut", date="2026-01-01", time="10:00")
    await store.upsert("sid-1", customer_name="Jane", customer_area="Kaloor")

    session = await store.get("sid-1")

    assert session is not None
    assert session.service == "Haircut"
    assert session.date == "2026-01-01"
    assert session.time == "10:00"
    assert session.customer_name == "Jane"
    assert session.customer_area == "Kaloor"


async def test_upsert_with_falsy_values_does_not_blank_known_fields(
    store: CallSessionStore,
) -> None:
    await store.upsert("sid-1", customer_name="Jane")

    await store.upsert("sid-1", customer_name="", customer_area="")

    session = await store.get("sid-1")
    assert session is not None
    assert session.customer_name == "Jane"
    assert session.customer_area is None


async def test_upsert_with_no_fields_is_a_noop(store: CallSessionStore) -> None:
    await store.upsert("sid-never-created")

    assert await store.get("sid-never-created") is None


async def test_delete_removes_session(store: CallSessionStore) -> None:
    await store.upsert("sid-1", business_id="biz-1", customer_phone="+910000000000")

    await store.delete("sid-1")

    assert await store.get("sid-1") is None


async def test_ttl_is_set_on_upsert(store: CallSessionStore) -> None:
    client = FakeAsyncRedis(decode_responses=True)
    ttl_store = CallSessionStore(client, ttl_seconds=60)

    await ttl_store.upsert("sid-1", business_id="biz-1", customer_phone="+910000000000")

    ttl = await client.ttl("voice-service:call-session:sid-1")
    assert 0 < ttl <= 60


async def test_session_expires_after_ttl(store: CallSessionStore) -> None:
    client = FakeAsyncRedis(decode_responses=True)
    short_ttl_store = CallSessionStore(client, ttl_seconds=1)

    await short_ttl_store.upsert("sid-1", business_id="biz-1", customer_phone="+910000000000")
    await asyncio.sleep(1.2)

    assert await short_ttl_store.get("sid-1") is None


async def test_get_fails_soft_on_redis_error(
    store: CallSessionStore, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _raise(*args: object, **kwargs: object) -> None:
        raise RedisError("boom")

    monkeypatch.setattr(store._client, "hgetall", _raise)

    assert await store.get("sid-1") is None


async def test_upsert_fails_soft_on_redis_error(
    store: CallSessionStore, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _raise(*args: object, **kwargs: object) -> None:
        raise RedisError("boom")

    monkeypatch.setattr(store._client, "hset", _raise)

    await store.upsert("sid-1", business_id="biz-1")  # must not raise


async def test_delete_fails_soft_on_redis_error(
    store: CallSessionStore, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _raise(*args: object, **kwargs: object) -> None:
        raise RedisError("boom")

    monkeypatch.setattr(store._client, "delete", _raise)

    await store.delete("sid-1")  # must not raise
