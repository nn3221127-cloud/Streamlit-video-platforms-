import pytest
from recommendation_engine import VectorSearchStore, RecommendationEngine

@pytest.fixture
def sample_videos():
    return [
        {
            "id": "v1",
            "title": "Gemini Multimodal Reasoning Architecture",
            "description": "Deep dive into cross-modal tensors and video understanding",
            "category": "AI & Machine Learning",
            "tags": ["Gemini", "Multimodal", "AI"],
            "views": 1000,
            "likes": 100,
            "duration": 500,
            "topicAffinities": [{"topic": "AI", "weight": 0.9}],
            "transcript": [{"startTime": 10, "text": "Gemini architecture processes continuous tensors."}]
        },
        {
            "id": "v2",
            "title": "Quantum Computing & Topological Qubits",
            "description": "Exploration of Majorana zero modes and surface codes",
            "category": "Quantum Computing",
            "tags": ["Quantum", "Physics"],
            "views": 500,
            "likes": 50,
            "duration": 600,
            "topicAffinities": [{"topic": "Quantum", "weight": 0.9}]
        },
        {
            "id": "v3",
            "title": "Autonomous Humanoid Robotics",
            "description": "Vision Language Action models for dexterous manipulation",
            "category": "Robotics & Automation",
            "tags": ["Robotics", "AI"],
            "views": 2000,
            "likes": 200,
            "duration": 450,
            "topicAffinities": [{"topic": "Robotics", "weight": 0.9}]
        }
    ]

def test_vector_search_store(sample_videos):
    store = VectorSearchStore(sample_videos)
    results = store.search("Gemini Multimodal")
    assert len(results) > 0
    assert results[0]["video"]["id"] == "v1"
    assert results[0]["matchType"] in ["hybrid", "lexical", "vector", "default"]

def test_recommendation_rails(sample_videos):
    engine = RecommendationEngine()
    rails = engine.get_recommendations(
        all_videos=sample_videos,
        current_video_id="v1",
        watch_history=[{"videoId": "v1", "progressPercent": 80}],
        liked_video_ids=["v1"],
        bookmarked_video_ids=["v1"]
    )

    assert len(rails) == 4
    rail_ids = [r["id"] for r in rails]
    assert "rail-up-next" in rail_ids
    assert "rail-personalized" in rail_ids
    assert "rail-trending" in rail_ids
    assert "rail-deep-dives" in rail_ids

    up_next_vids = [v["id"] for v in rails[0]["videos"]]
    assert "v3" in up_next_vids  # Shared AI tag with v1
