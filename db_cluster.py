import sqlite3
import queue
from typing import Dict, Any, List, Optional
from contextlib import contextmanager

DB_FILE = "streamintel_studio.db"

class DatabaseClusterMVCC:
    """
    High-Throughput SQLite WAL Engine with MVCC connection pools.
    Configures PRAGMA journal_mode=WAL, PRAGMA synchronous=NORMAL,
    PRAGMA cache_size=-64000, and PRAGMA busy_timeout=5000.
    Decouples read-heavy analytic queries from write-heavy telemetry.
    """
    def __init__(self, db_path: str = DB_FILE, pool_size: int = 5) -> None:
        self.db_path: str = db_path
        self.pool_size: int = pool_size
        self._read_pool: queue.Queue[sqlite3.Connection] = queue.Queue(maxsize=pool_size)
        self._write_conn: Optional[sqlite3.Connection] = None
        self._init_cluster()

    def _configure_connection(self, conn: sqlite3.Connection) -> None:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        conn.execute("PRAGMA cache_size=-64000;")  # 64MB Cache
        conn.execute("PRAGMA busy_timeout=5000;")  # 5s timeout

    def _init_cluster(self) -> None:
        # Initialize single write connection
        self._write_conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._configure_connection(self._write_conn)

        # Initialize read connection pool
        for _ in range(self.pool_size):
            conn = sqlite3.connect(self.db_path, check_same_thread=False)
            self._configure_connection(conn)
            self._read_pool.put(conn)

        # Initialize FTS5 Full-Text Search Table
        with self.get_write_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE VIRTUAL TABLE IF NOT EXISTS chat_fts USING fts5(
                    video_id,
                    sender_id,
                    content,
                    timestamp
                );
            """)
            conn.commit()

    @contextmanager
    def get_read_connection(self):
        conn = self._read_pool.get()
        try:
            yield conn
        finally:
            self._read_pool.put(conn)

    @contextmanager
    def get_write_connection(self):
        if not self._write_conn:
            self._write_conn = sqlite3.connect(self.db_path, check_same_thread=False)
            self._configure_connection(self._write_conn)
        yield self._write_conn

    def execute_fts_search(self, query: str, video_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with self.get_read_connection() as conn:
            cursor = conn.cursor()
            if video_id:
                cursor.execute("""
                    SELECT * FROM chat_fts WHERE video_id = ? AND content MATCH ? ORDER BY rank
                """, (video_id, query))
            else:
                cursor.execute("""
                    SELECT * FROM chat_fts WHERE content MATCH ? ORDER BY rank
                """, (query,))
            return [dict(r) for r in cursor.fetchall()]

    def index_fts_message(self, video_id: str, sender_id: str, content: str, timestamp: float) -> None:
        with self.get_write_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO chat_fts (video_id, sender_id, content, timestamp)
                VALUES (?, ?, ?, ?)
            """, (video_id, sender_id, content, str(timestamp)))
            conn.commit()

    def close(self) -> None:
        if self._write_conn:
            self._write_conn.close()
            self._write_conn = None
        while not self._read_pool.empty():
            try:
                conn = self._read_pool.get_nowait()
                conn.close()
            except queue.Empty:
                break
