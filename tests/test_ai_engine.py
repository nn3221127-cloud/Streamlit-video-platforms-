import pytest
from ai_engine import (
    analyze_video_content,
    generate_grounded_video_answer,
    generate_fallback_video_analysis,
    generate_fallback_chat_answer,
    format_timestamp
)

def test_format_timestamp():
    assert format_timestamp(0) == "00:00"
    assert format_timestamp(65) == "01:05"
    assert format_timestamp(3605) == "60:05"

def test_fallback_video_analysis():
    res = generate_fallback_video_analysis("Test Multimodal Stream", "Description text", 400.0)
    assert "summary" in res
    assert "keyTakeaways" in res
    assert "chapters" in res
    assert len(res["chapters"]) == 4
    assert res["chapters"][0]["startTime"] == 0

def test_analyze_video_content_fallback():
    # Without valid API key, analyze_video_content falls back safely
    res = analyze_video_content("Offline Stream Title", "Description", duration_seconds=300)
    assert "summary" in res
    assert len(res["keyTakeaways"]) > 0

def test_generate_grounded_video_answer():
    video = {
        "title": "Grounded AI Test",
        "duration": 300,
        "category": "Technology",
        "chapters": [{"startTime": 0, "endTime": 60, "title": "Intro", "summary": "Start point"}],
        "transcript": [{"startTime": 10, "endTime": 30, "speaker": "Dr. Vance", "text": "Multimodal video indexing."}]
    }
    chat_hist = [{"role": "user", "content": "What is covered at 00:10?"}]

    ans = generate_grounded_video_answer(
        message="Explain the intro chapter",
        chat_history=chat_hist,
        video=video,
        current_playback_time=15.0
    )

    assert "content" in ans
    assert "citations" in ans
    assert isinstance(ans["citations"], list)
