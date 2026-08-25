import sqlite3
import json
import time
from typing import Dict, Any, List, Optional
import streamlit as st

DB_FILE = "streamintel_studio.db"

class StateManager:
    """
    SQLite database persistence and Streamlit session state manager.
    Persists watch history, bookmarks, liked videos, user notes, active category filters, and user preferences.
    Provides atomic CRUD helpers and avoids full-page layout jumps by synchronizing with st.session_state.
    """
    def __init__(self, db_path: str = DB_FILE):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()

            # 1. Videos Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS videos (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    url TEXT NOT NULL,
                    stream_type TEXT,
                    duration REAL,
                    thumbnail TEXT,
                    author TEXT,
                    author_avatar TEXT,
                    published_at TEXT,
                    views INTEGER,
                    likes INTEGER,
                    category TEXT,
                    tags TEXT,
                    chapters TEXT,
                    transcript TEXT,
                    key_takeaways TEXT,
                    topic_affinities TEXT,
                    visual_scenes TEXT,
                    ai_generated_clips TEXT,
                    specs TEXT
                );
            """)

            # 2. Watch History Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS watch_history (
                    video_id TEXT PRIMARY KEY,
                    watched_at REAL,
                    progress_percent REAL,
                    last_timestamp REAL
                );
            """)

            # 3. Bookmarks Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS bookmarks (
                    id TEXT PRIMARY KEY,
                    video_id TEXT NOT NULL,
                    timestamp REAL NOT NULL,
                    title TEXT,
                    note TEXT,
                    created_at REAL
                );
            """)

            # 4. Likes Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS liked_videos (
                    video_id TEXT PRIMARY KEY,
                    liked_at REAL
                );
            """)

            # 5. User Notes Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_notes (
                    id TEXT PRIMARY KEY,
                    video_id TEXT NOT NULL,
                    timestamp REAL NOT NULL,
                    text TEXT NOT NULL,
                    updated_at REAL
                );
            """)

            # 6. Preferences & State Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_preferences (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );
            """)

            conn.commit()

    # --- VIDEO CRUD ---
    def get_all_videos(self) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM videos")
            rows = cursor.fetchall()
            videos = []
            for r in rows:
                v = dict(r)
                v["tags"] = json.loads(v["tags"]) if v["tags"] else []
                v["chapters"] = json.loads(v["chapters"]) if v["chapters"] else []
                v["transcript"] = json.loads(v["transcript"]) if v["transcript"] else []
                v["keyTakeaways"] = json.loads(v["key_takeaways"]) if v["key_takeaways"] else []
                v["topicAffinities"] = json.loads(v["topic_affinities"]) if v["topic_affinities"] else []
                v["visualScenes"] = json.loads(v["visual_scenes"]) if v["visual_scenes"] else []
                v["aiGeneratedClips"] = json.loads(v["ai_generated_clips"]) if v["ai_generated_clips"] else []
                v["specs"] = json.loads(v["specs"]) if v["specs"] else {}
                v["streamType"] = v.pop("stream_type", "mp4")
                v["authorAvatar"] = v.pop("author_avatar", "")
                v["publishedAt"] = v.pop("published_at", "")
                videos.append(v)
            return videos

    def save_video(self, video: Dict[str, Any]):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO videos (
                    id, title, description, url, stream_type, duration, thumbnail,
                    author, author_avatar, published_at, views, likes, category,
                    tags, chapters, transcript, key_takeaways, topic_affinities,
                    visual_scenes, ai_generated_clips, specs
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                video["id"],
                video.get("title", ""),
                video.get("description", ""),
                video.get("url", ""),
                video.get("streamType", "mp4"),
                video.get("duration", 300.0),
                video.get("thumbnail", ""),
                video.get("author", "StreamIntel User"),
                video.get("authorAvatar", ""),
                video.get("publishedAt", ""),
                video.get("views", 1),
                video.get("likes", 0),
                video.get("category", "Technology"),
                json.dumps(video.get("tags", [])),
                json.dumps(video.get("chapters", [])),
                json.dumps(video.get("transcript", [])),
                json.dumps(video.get("keyTakeaways", [])),
                json.dumps(video.get("topicAffinities", [])),
                json.dumps(video.get("visualScenes", [])),
                json.dumps(video.get("aiGeneratedClips", [])),
                json.dumps(video.get("specs", {}))
            ))
            conn.commit()

    # --- LIKES CRUD ---
    def toggle_like(self, video_id: str) -> Dict[str, Any]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT video_id FROM liked_videos WHERE video_id = ?", (video_id,))
            exists = cursor.fetchone()
            is_liked = False
            if exists:
                cursor.execute("DELETE FROM liked_videos WHERE video_id = ?", (video_id,))
                cursor.execute("UPDATE videos SET likes = MAX(0, likes - 1) WHERE id = ?", (video_id,))
                is_liked = False
            else:
                cursor.execute("INSERT INTO liked_videos (video_id, liked_at) VALUES (?, ?)", (video_id, time.time()))
                cursor.execute("UPDATE videos SET likes = likes + 1 WHERE id = ?", (video_id,))
                is_liked = True

            cursor.execute("SELECT likes FROM videos WHERE id = ?", (video_id,))
            row = cursor.fetchone()
            likes_count = row["likes"] if row else 0
            conn.commit()

        self.update_session_state()
        return {"isLiked": is_liked, "likesCount": likes_count}

    def get_liked_video_ids(self) -> List[str]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT video_id FROM liked_videos")
            return [r["video_id"] for r in cursor.fetchall()]

    # --- BOOKMARKS CRUD ---
    def add_bookmark(self, video_id: str, timestamp: float, title: Optional[str] = None, note: str = "") -> Dict[str, Any]:
        bm_id = f"bm-{int(time.time()*1000)}"
        title = title or f"Bookmark at {int(timestamp)}s"
        created_at = time.time()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO bookmarks (id, video_id, timestamp, title, note, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (bm_id, video_id, timestamp, title, note, created_at))
            conn.commit()

        bookmark = {
            "id": bm_id,
            "videoId": video_id,
            "timestamp": timestamp,
            "title": title,
            "note": note,
            "createdAt": created_at
        }
        self.update_session_state()
        return bookmark

    def delete_bookmark(self, bookmark_id: str):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM bookmarks WHERE id = ?", (bookmark_id,))
            conn.commit()
        self.update_session_state()

    def get_bookmarks(self) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM bookmarks ORDER BY created_at DESC")
            return [
                {
                    "id": r["id"],
                    "videoId": r["video_id"],
                    "timestamp": r["timestamp"],
                    "title": r["title"],
                    "note": r["note"],
                    "createdAt": r["created_at"]
                }
                for r in cursor.fetchall()
            ]

    # --- USER NOTES CRUD ---
    def save_note(self, video_id: str, text: str, timestamp: float = 0.0, note_id: Optional[str] = None) -> Dict[str, Any]:
        n_id = note_id or f"note-{int(time.time()*1000)}"
        updated_at = time.time()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO user_notes (id, video_id, timestamp, text, updated_at)
                VALUES (?, ?, ?, ?, ?)
            """, (n_id, video_id, timestamp, text, updated_at))
            conn.commit()

        note = {
            "id": n_id,
            "videoId": video_id,
            "timestamp": timestamp,
            "text": text,
            "updatedAt": updated_at
        }
        self.update_session_state()
        return note

    def delete_note(self, note_id: str):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM user_notes WHERE id = ?", (note_id,))
            conn.commit()
        self.update_session_state()

    def get_notes(self) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM user_notes ORDER BY updated_at DESC")
            return [
                {
                    "id": r["id"],
                    "videoId": r["video_id"],
                    "timestamp": r["timestamp"],
                    "text": r["text"],
                    "updatedAt": r["updated_at"]
                }
                for r in cursor.fetchall()
            ]

    # --- WATCH HISTORY CRUD ---
    def update_watch_progress(self, video_id: str, timestamp: float, duration: float):
        progress = min(100.0, max(0.0, (timestamp / duration * 100.0))) if duration > 0 else 0.0
        now = time.time()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO watch_history (video_id, watched_at, progress_percent, last_timestamp)
                VALUES (?, ?, ?, ?)
            """, (video_id, now, progress, timestamp))
            conn.commit()
        self.update_session_state()

    def get_watch_history(self) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM watch_history ORDER BY watched_at DESC")
            return [
                {
                    "videoId": r["video_id"],
                    "watchedAt": r["watched_at"],
                    "progressPercent": r["progress_percent"],
                    "lastTimestamp": r["last_timestamp"]
                }
                for r in cursor.fetchall()
            ]

    # --- STREAMLIT SESSION STATE SYNC ---
    def update_session_state(self):
        """Cleanly synchronizes database state into st.session_state."""
        if hasattr(st, "session_state"):
            st.session_state["liked_video_ids"] = self.get_liked_video_ids()
            st.session_state["bookmarks"] = self.get_bookmarks()
            st.session_state["notes"] = self.get_notes()
            st.session_state["watch_history"] = self.get_watch_history()
            if "active_category" not in st.session_state:
                st.session_state["active_category"] = "All"

    def get_full_state(self) -> Dict[str, Any]:
        return {
            "likedVideoIds": self.get_liked_video_ids(),
            "bookmarks": self.get_bookmarks(),
            "notes": self.get_notes(),
            "watchHistory": self.get_watch_history(),
            "activeCategory": getattr(st, "session_state", {}).get("active_category", "All") if hasattr(st, "session_state") else "All"
        }
