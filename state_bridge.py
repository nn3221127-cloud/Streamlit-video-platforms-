import time
import queue
import threading
from typing import Dict, Any, Callable, Optional, List
import streamlit as st

class ComponentStateBridge:
    """
    Non-blocking bi-directional state bridge:
    Communicates via background worker threads and session dispatch queues
    to sync external socket/CRDT/crypto state into st.session_state without full-page DOM teardowns.
    """
    def __init__(self) -> None:
        self.dispatch_queue: queue.Queue[Dict[str, Any]] = queue.Queue(maxsize=1000)
        self.is_running: bool = False
        self._worker_thread: Optional[threading.Thread] = None

    def start_background_worker(self) -> None:
        if not self.is_running:
            self.is_running = True
            self._worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
            self._worker_thread.start()

    def stop_background_worker(self) -> None:
        self.is_running = False

    def _worker_loop(self) -> None:
        while self.is_running:
            try:
                event = self.dispatch_queue.get(timeout=0.1)
                self.process_incoming_event(event)
            except queue.Empty:
                continue
            except Exception as e:
                print(f"[StateBridge] Event worker error: {e}")

    def dispatch_async_event(self, event_type: str, payload: Dict[str, Any]) -> None:
        event = {
            "type": event_type,
            "payload": payload,
            "timestamp": time.time()
        }
        try:
            self.dispatch_queue.put_nowait(event)
        except queue.Full:
            pass

    def process_incoming_event(self, event: Dict[str, Any]) -> None:
        # Buffer events for session state hydration
        if "pending_bridge_events" not in st.session_state:
            st.session_state["pending_bridge_events"] = []
        st.session_state["pending_bridge_events"].append(event)

    def hydrate_session_state(self) -> List[Dict[str, Any]]:
        """Hydrates pending background bridge events into active session state."""
        events = st.session_state.get("pending_bridge_events", [])
        st.session_state["pending_bridge_events"] = []
        return events

    @staticmethod
    def render_js_message_bridge() -> None:
        """Injects non-blocking JS postMessage listener bridge."""
        st.markdown("""
        <script>
            if (!window.streamIntelBridgeInitialized) {
                window.streamIntelBridgeInitialized = true;
                window.addEventListener("message", (event) => {
                    if (event.data && event.data.type === "STREAMINTEL_SYNC") {
                        console.log("[StreamIntel Bridge] Received non-blocking sync payload:", event.data);
                    }
                });
            }
        </script>
        """, unsafe_allow_html=True)
