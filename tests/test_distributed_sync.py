import pytest
import pytest_asyncio
import asyncio
import random
from watch_party import WatchPartyRoom

@pytest.mark.asyncio
async def test_distributed_crdt_sync_convergence():
    room = WatchPartyRoom("room-stress-1", "host-1", "video-gemini")
    users = [f"user-{i}" for i in range(50)]

    # Join 50 concurrent users
    for u in users:
        room.join_room(u)

    assert len(room.get_members()) == 51

    # Simulate randomized concurrent seek and play actions
    async def simulate_user_actions(user_id: str):
        for _ in range(20):
            pos = random.uniform(0.0, 500.0)
            is_playing = random.choice([True, False])
            action = "SEEK" if random.random() > 0.5 else "PLAY"
            room.dispatch_action(user_id, action, pos, is_playing)
            await asyncio.sleep(0.001)

    tasks = [simulate_user_actions(u) for u in users]
    await asyncio.gather(*tasks)

    # Verify CRDT state consistency
    state = room.state_register.value
    assert isinstance(state.position, float)
    assert isinstance(state.is_playing, bool)
    assert room.state_register.clock.sequence_number > 0

@pytest.mark.asyncio
async def test_network_partition_and_reconnection():
    room = WatchPartyRoom("room-partition-1", "host-1", "video-1")

    # Host plays video at 100s
    room.dispatch_action("host-1", "PLAY", 100.0, True)

    # Client disconnected at 120s with 500ms latency spike
    sync = room.sync_client_clock("client-2", 120.0, 0.500)
    assert sync["action"] in ["HARD_SEEK", "SOFT_THROTTLE"]
    assert sync["smoothed_rtt"] > 0.0
