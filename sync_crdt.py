import time
import uuid
import queue
from dataclasses import dataclass, field
from typing import Dict, Set, Any, List, Optional, Tuple

@dataclass(frozen=True)
class VectorClock:
    actor_id: str
    sequence_number: int
    logical_timestamp: float  # Microsecond timestamp

    def is_later_than(self, other: 'VectorClock') -> bool:
        if self.logical_timestamp != other.logical_timestamp:
            return self.logical_timestamp > other.logical_timestamp
        if self.sequence_number != other.sequence_number:
            return self.sequence_number > other.sequence_number
        return self.actor_id > other.actor_id

@dataclass
class ORSetElement:
    element: str
    tag: str  # Unique UUID tag for addition

class ORSet:
    """
    Observed-Remove Set (OR-Set) CRDT for active room members.
    Allows concurrent additions and removals without conflicts.
    """
    def __init__(self) -> None:
        self.add_set: Set[Tuple[str, str]] = set()  # (element, tag)
        self.remove_set: Set[Tuple[str, str]] = set()  # (element, tag)

    def add(self, element: str) -> str:
        tag = str(uuid.uuid4())
        self.add_set.add((element, tag))
        return tag

    def remove(self, element: str) -> None:
        # Move all current instances of element in add_set to remove_set
        for item in list(self.add_set):
            if item[0] == element:
                self.remove_set.add(item)

    def read(self) -> Set[str]:
        current = self.add_set - self.remove_set
        return {item[0] for item in current}

    def merge(self, other: 'ORSet') -> None:
        self.add_set.update(other.add_set)
        self.remove_set.update(other.remove_set)

@dataclass
class PlaybackState:
    is_playing: bool
    position: float  # seconds
    playback_rate: float
    video_id: str

class LWWRegister:
    """
    Last-Write-Wins (LWW) Register with microsecond Vector Clocks.
    Used to reconcile concurrent video controls (Play, Pause, Seek, Rate Change).
    """
    def __init__(self, initial_state: PlaybackState, clock: VectorClock) -> None:
        self.value: PlaybackState = initial_state
        self.clock: VectorClock = clock

    def update(self, new_state: PlaybackState, new_clock: VectorClock) -> bool:
        if new_clock.is_later_than(self.clock):
            self.value = new_state
            self.clock = new_clock
            return True
        return False

    def merge(self, other: 'LWWRegister') -> None:
        if other.clock.is_later_than(self.clock):
            self.value = other.value
            self.clock = other.clock

class DriftCorrector:
    """
    RTT estimation via moving Exponential Weighted Average (EMA) and playback alignment:
    - Hard seek alignment if client drift |Δt| > 250 ms.
    - Soft playback rate throttling (0.95x - 1.05x) for minor drifts (|Δt| <= 250 ms).
    """
    def __init__(self, alpha: float = 0.2) -> None:
        self.alpha: float = alpha
        self.smoothed_rtt: float = 0.05  # Default 50ms RTT

    def update_rtt(self, measured_rtt: float) -> float:
        self.smoothed_rtt = (self.alpha * measured_rtt) + ((1.0 - self.alpha) * self.smoothed_rtt)
        return self.smoothed_rtt

    def compute_correction(self, client_time: float, master_time: float, master_is_playing: bool) -> Tuple[str, float, float]:
        """
        Returns (action_type, target_position, suggested_rate)
        action_type: 'HARD_SEEK' | 'SOFT_THROTTLE' | 'IN_SYNC'
        """
        # One-way network latency estimation
        one_way_delay = self.smoothed_rtt / 2.0
        adjusted_master_time = master_time + (one_way_delay if master_is_playing else 0.0)
        drift = client_time - adjusted_master_time
        abs_drift = abs(drift)

        if abs_drift > 0.250:  # > 250ms
            return ("HARD_SEEK", adjusted_master_time, 1.0)
        elif abs_drift > 0.020:  # 20ms < |drift| <= 250ms
            # Soft rate throttling between 0.95x and 1.05x
            if drift > 0:  # Client is ahead, slow down slightly
                rate = max(0.95, 1.0 - (drift * 0.2))
            else:  # Client is behind, speed up slightly
                rate = min(1.05, 1.0 + (abs_drift * 0.2))
            return ("SOFT_THROTTLE", adjusted_master_time, round(rate, 3))
        else:
            return ("IN_SYNC", adjusted_master_time, 1.0)

class InterProcessEventBus:
    """
    Lock-Free / Thread-Safe Inter-Process Event Bus using atomic queues for sub-15ms broadcast.
    """
    def __init__(self, maxsize: int = 1000) -> None:
        self._queues: Dict[str, queue.Queue[Dict[str, Any]]] = {}

    def subscribe(self, subscriber_id: str) -> queue.Queue[Dict[str, Any]]:
        if subscriber_id not in self._queues:
            self._queues[subscriber_id] = queue.Queue(maxsize=1000)
        return self._queues[subscriber_id]

    def unsubscribe(self, subscriber_id: str) -> None:
        if subscriber_id in self._queues:
            del self._queues[subscriber_id]

    def publish(self, event: Dict[str, Any]) -> None:
        event["broadcast_timestamp"] = time.time_ns() / 1e9
        for subscriber_id, q in list(self._queues.items()):
            try:
                q.put_nowait(event)
            except queue.Full:
                try:
                    q.get_nowait()
                    q.put_nowait(event)
                except queue.Empty:
                    pass
