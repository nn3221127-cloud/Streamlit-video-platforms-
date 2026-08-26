import time
from typing import Dict, Any, List, Optional, Set
from sync_crdt import ORSet, LWWRegister, VectorClock, PlaybackState, DriftCorrector, InterProcessEventBus

class WatchPartyRoom:
    """
    High-concurrency Watch Party Room managing active members via OR-Set CRDT
    and video state reconciliation via LWW-Register with microsecond vector clocks.
    """
    def __init__(self, room_id: str, host_id: str, video_id: str) -> None:
        self.room_id: str = room_id
        self.host_id: str = host_id
        self.members_crdt: ORSet = ORSet()
        self.members_crdt.add(host_id)

        initial_state = PlaybackState(
            is_playing=False,
            position=0.0,
            playback_rate=1.0,
            video_id=video_id
        )
        initial_clock = VectorClock(
            actor_id=host_id,
            sequence_number=1,
            logical_timestamp=time.time_ns() / 1e3
        )
        self.state_register: LWWRegister = LWWRegister(initial_state, initial_clock)
        self.drift_corrector: DriftCorrector = DriftCorrector()
        self.event_bus: InterProcessEventBus = InterProcessEventBus()
        self._seq_counter: Dict[str, int] = {host_id: 1}

    def join_room(self, actor_id: str) -> str:
        tag = self.members_crdt.add(actor_id)
        if actor_id not in self._seq_counter:
            self._seq_counter[actor_id] = 0

        self.event_bus.publish({
            "type": "MEMBER_JOINED",
            "room_id": self.room_id,
            "actor_id": actor_id,
            "members": list(self.members_crdt.read())
        })
        return tag

    def leave_room(self, actor_id: str) -> None:
        self.members_crdt.remove(actor_id)
        self.event_bus.publish({
            "type": "MEMBER_LEFT",
            "room_id": self.room_id,
            "actor_id": actor_id,
            "members": list(self.members_crdt.read())
        })

    def get_members(self) -> Set[str]:
        return self.members_crdt.read()

    def dispatch_action(self, actor_id: str, action_type: str, position: float, is_playing: bool, playback_rate: float = 1.0) -> Dict[str, Any]:
        """
        Dispatches a control action (PLAY, PAUSE, SEEK, RATE_CHANGE) with LWW Vector Clock reconciliation.
        """
        self._seq_counter[actor_id] = self._seq_counter.get(actor_id, 0) + 1
        seq = self._seq_counter[actor_id]
        now_us = time.time_ns() / 1e3

        clock = VectorClock(actor_id=actor_id, sequence_number=seq, logical_timestamp=now_us)
        new_state = PlaybackState(
            is_playing=is_playing,
            position=position,
            playback_rate=playback_rate,
            video_id=self.state_register.value.video_id
        )

        updated = self.state_register.update(new_state, clock)
        result_event = {
            "type": "SYNC_EVENT",
            "action": action_type,
            "room_id": self.room_id,
            "actor_id": actor_id,
            "updated": updated,
            "state": {
                "is_playing": self.state_register.value.is_playing,
                "position": self.state_register.value.position,
                "playback_rate": self.state_register.value.playback_rate,
                "video_id": self.state_register.value.video_id
            },
            "clock": {
                "actor_id": self.state_register.clock.actor_id,
                "seq": self.state_register.clock.sequence_number,
                "ts": self.state_register.clock.logical_timestamp
            }
        }
        self.event_bus.publish(result_event)
        return result_event

    def sync_client_clock(self, client_id: str, client_position: float, measured_rtt: float) -> Dict[str, Any]:
        """
        Computes RTT EMA drift and returns alignment recommendations.
        """
        self.drift_corrector.update_rtt(measured_rtt)
        master_state = self.state_register.value
        action, target_pos, target_rate = self.drift_corrector.compute_correction(
            client_time=client_position,
            master_time=master_state.position,
            master_is_playing=master_state.is_playing
        )
        return {
            "client_id": client_id,
            "action": action,
            "target_position": target_pos,
            "target_rate": target_rate,
            "smoothed_rtt": self.drift_corrector.smoothed_rtt
        }
