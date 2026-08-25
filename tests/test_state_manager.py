import os
import pytest
from state_manager import StateManager

@pytest.fixture
def sm():
    db_name = "test_state_mgr.db"
    if os.path.exists(db_name):
        os.remove(db_name)
    manager = StateManager(db_name)
    yield manager
    if os.path.exists(db_name):
        os.remove(db_name)

def test_save_and_get_videos(sm):
    video = {
        "id": "v-test-1",
        "title": "Test Stream",
        "description": "Stream testing",
        "url": "https://sample.mp4",
        "category": "Technology",
        "tags": ["AI", "Test"],
        "duration": 300.0
    }
    sm.save_video(video)
    videos = sm.get_all_videos()
    assert len(videos) == 1
    assert videos[0]["id"] == "v-test-1"
    assert videos[0]["title"] == "Test Stream"
    assert videos[0]["tags"] == ["AI", "Test"]

def test_toggle_like(sm):
    video = {"id": "v-like-1", "title": "Like Video", "url": "https://sample.mp4", "likes": 5}
    sm.save_video(video)

    res1 = sm.toggle_like("v-like-1")
    assert res1["isLiked"] is True
    assert res1["likesCount"] == 6
    assert "v-like-1" in sm.get_liked_video_ids()

    res2 = sm.toggle_like("v-like-1")
    assert res2["isLiked"] is False
    assert res2["likesCount"] == 5
    assert "v-like-1" not in sm.get_liked_video_ids()

def test_bookmarks_crud(sm):
    bm = sm.add_bookmark("v-like-1", 45.5, "Important moment")
    assert bm["videoId"] == "v-like-1"
    assert bm["timestamp"] == 45.5

    bms = sm.get_bookmarks()
    assert len(bms) == 1
    assert bms[0]["title"] == "Important moment"

    sm.delete_bookmark(bm["id"])
    assert len(sm.get_bookmarks()) == 0

def test_user_notes_crud(sm):
    note = sm.save_note("v-like-1", "This is a key note", 120.0)
    assert note["text"] == "This is a key note"

    notes = sm.get_notes()
    assert len(notes) == 1
    assert notes[0]["text"] == "This is a key note"

    sm.delete_note(note["id"])
    assert len(sm.get_notes()) == 0

def test_watch_history(sm):
    sm.update_watch_progress("v-like-1", 150.0, 300.0)
    history = sm.get_watch_history()
    assert len(history) == 1
    assert history[0]["videoId"] == "v-like-1"
    assert history[0]["progressPercent"] == 50.0
