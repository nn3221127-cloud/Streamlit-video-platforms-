import os
import math
import re
from typing import List, Dict, Any, Optional
import chromadb
from ai_engine import get_genai_client, with_retry

class VectorSearchStore:
    """
    Vector Store using ChromaDB and Google GenAI `text-embedding-004` (with hybrid fallback).
    Indexes video titles, descriptions, tags, key takeaways, chapter summaries, and transcripts.
    """
    def __init__(self, initial_videos: Optional[List[Dict[str, Any]]] = None) -> None:
        self.chroma_client: Optional[Any] = None
        self.collection: Optional[Any] = None
        try:
            self.chroma_client = chromadb.Client()
            if self.chroma_client:
                self.collection = self.chroma_client.get_or_create_collection(name="video_intelligence_index")
        except Exception as e:
            print(f"[VectorStore] ChromaDB init fallback: {e}")
            self.chroma_client = None
            self.collection = None

        self.indexed_videos: Dict[str, Dict[str, Any]] = {}
        self.vocabulary: Dict[str, float] = {}
        self.tfidf_vectors: Dict[str, Dict[str, float]] = {}

        if initial_videos:
            self.index_videos(initial_videos)

    def _get_embedding(self, text: str) -> Optional[List[float]]:
        """Generates embedding using text-embedding-004 via Google GenAI SDK if key is available."""
        client = get_genai_client()
        if not client:
            return None
        try:
            def call_embed() -> Any:
                return client.models.embed_content(
                    model="text-embedding-004",
                    contents=text
                )
            res = with_retry(call_embed)
            if res and hasattr(res, 'embedding') and hasattr(res.embedding, 'values'):
                return list(res.embedding.values)
            elif res and hasattr(res, 'embeddings') and len(res.embeddings) > 0:
                return list(res.embeddings[0].values)
        except Exception as e:
            print(f"[VectorStore] Embedding API error: {e}")
        return None

    def index_videos(self, videos: List[Dict[str, Any]]) -> None:
        """Indexes or re-indexes a list of video objects."""
        self.indexed_videos.clear()
        self.tfidf_vectors.clear()
        self.vocabulary.clear()

        doc_count = len(videos)
        doc_tokens_map: Dict[str, List[str]] = {}

        for video in videos:
            vid = video["id"]
            self.indexed_videos[vid] = video

            parts = [
                video.get("title", ""),
                video.get("description", ""),
                video.get("category", ""),
                " ".join(video.get("tags", [])),
                " ".join(video.get("keyTakeaways", [])),
                " ".join([f"{c.get('title', '')} {c.get('summary', '')}" for c in video.get("chapters", [])]),
                " ".join([t.get("text", "") for t in video.get("transcript", [])])
            ]
            full_text = " ".join(parts).lower()
            tokens = self._tokenize(full_text)
            doc_tokens_map[vid] = tokens

            if self.collection:
                try:
                    embedding = self._get_embedding(full_text)
                    meta = {
                        "title": video.get("title", ""),
                        "category": video.get("category", ""),
                    }
                    if embedding:
                        self.collection.upsert(
                            ids=[vid],
                            embeddings=[embedding],
                            documents=[full_text[:1000]],
                            metadatas=[meta]
                        )
                    else:
                        self.collection.upsert(
                            ids=[vid],
                            documents=[full_text[:1000]],
                            metadatas=[meta]
                        )
                except Exception as e:
                    print(f"[VectorStore] ChromaDB upsert warning for {vid}: {e}")

        term_doc_freq: Dict[str, int] = {}
        for tokens in doc_tokens_map.values():
            unique_terms = set(tokens)
            for t in unique_terms:
                term_doc_freq[t] = term_doc_freq.get(t, 0) + 1

        for t, count in term_doc_freq.items():
            self.vocabulary[t] = math.log((doc_count + 1) / (count + 1)) + 1.0

        for vid, tokens in doc_tokens_map.items():
            tf_map: Dict[str, int] = {}
            for t in tokens:
                tf_map[t] = tf_map.get(t, 0) + 1

            vec: Dict[str, float] = {}
            norm_sq = 0.0
            for t, count in tf_map.items():
                idf = self.vocabulary.get(t, 1.0)
                weight = count * idf
                vec[t] = weight
                norm_sq += weight * weight

            norm = math.sqrt(norm_sq) or 1.0
            self.tfidf_vectors[vid] = {t: w / norm for t, w in vec.items()}

    def add_or_update_video(self, video: Dict[str, Any]) -> None:
        existing = list(self.indexed_videos.values())
        filtered = [v for v in existing if v["id"] != video["id"]]
        filtered.insert(0, video)
        self.index_videos(filtered)

    def search(self, query: str, category_filter: str = "All", limit: int = 10) -> List[Dict[str, Any]]:
        """
        Executes hybrid semantic search matching query against title, transcript, chapters, and tags.
        """
        if not query or not query.strip():
            results = []
            for vid, v in self.indexed_videos.items():
                if category_filter != "All" and v.get("category") != category_filter:
                    continue
                results.append({
                    "video": v,
                    "score": 1.0,
                    "matchType": "default"
                })
            return results[:limit]

        clean_q = query.strip().lower()
        q_tokens = self._tokenize(clean_q)

        semantic_scores: Dict[str, float] = {}
        if self.collection:
            try:
                q_embedding = self._get_embedding(clean_q)
                if q_embedding:
                    res = self.collection.query(
                        query_embeddings=[q_embedding],
                        n_results=min(limit * 2, len(self.indexed_videos))
                    )
                else:
                    res = self.collection.query(
                        query_texts=[clean_q],
                        n_results=min(limit * 2, len(self.indexed_videos))
                    )
                ids = res.get("ids", [[]])[0] if res else []
                distances = res.get("distances", [[]])[0] if (res and res.get("distances")) else []
                for idx, vid in enumerate(ids):
                    dist = distances[idx] if idx < len(distances) else 0.5
                    similarity = max(0.0, 1.0 - (dist / 2.0 if dist > 1.0 else dist))
                    semantic_scores[vid] = similarity
            except Exception as e:
                print(f"[VectorStore] ChromaDB query fallback: {e}")

        results = []
        for vid, video in self.indexed_videos.items():
            if category_filter != "All" and video.get("category") != category_filter:
                continue

            tfidf_vec = self.tfidf_vectors.get(vid, {})
            score_tfidf = sum(tfidf_vec.get(qt, 0.0) * self.vocabulary.get(qt, 1.0) for qt in q_tokens)

            title = video.get("title", "").lower()
            title_boost = 0.4 if clean_q in title else 0.0
            tag_boost = 0.25 if any(clean_q in t.lower() for t in video.get("tags", [])) else 0.0

            sem_score = semantic_scores.get(vid, 0.0)
            hybrid_score = (sem_score * 0.5) + (score_tfidf * 0.3) + title_boost + tag_boost

            matched_segment = None
            for tr in video.get("transcript", []):
                if any(qt in tr.get("text", "").lower() for qt in q_tokens):
                    matched_segment = {
                        "startTime": tr.get("startTime", 0),
                        "text": tr.get("text", "")
                    }
                    break

            if hybrid_score > 0.05 or clean_q in title or title_boost > 0:
                results.append({
                    "video": video,
                    "score": round(min(0.99, hybrid_score), 4),
                    "matchType": "hybrid" if sem_score > 0.3 else "lexical",
                    "matchedSegment": matched_segment
                })

        results.sort(key=lambda x: float(str(x["score"])), reverse=True)
        return results[:limit]

    def _tokenize(self, text: str) -> List[str]:
        words = re.findall(r'\w+', text.lower())
        return [w for w in words if len(w) >= 2]


class RecommendationEngine:
    """
    Content-based recommendation graph populating 'Up Next', 'Recommended', 'Trending', and 'Deep Dives'
    based on active video context, watch history, and tag/category affinities.
    """
    def __init__(self) -> None:
        pass

    def get_recommendations(
        self,
        all_videos: List[Dict[str, Any]],
        current_video_id: Optional[str] = None,
        watch_history: Optional[List[Dict[str, Any]]] = None,
        liked_video_ids: Optional[List[str]] = None,
        bookmarked_video_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        watch_history = watch_history or []
        liked_video_ids = liked_video_ids or []
        bookmarked_video_ids = bookmarked_video_ids or []

        current_video = None
        if current_video_id:
            current_video = next((v for v in all_videos if v["id"] == current_video_id), None)
        if not current_video and all_videos:
            current_video = all_videos[0]

        other_videos = [v for v in all_videos if current_video and v["id"] != current_video["id"]]

        affinity_map: Dict[str, float] = {}

        for h in watch_history:
            vid = h.get("videoId")
            v_item = next((v for v in all_videos if v["id"] == vid), None)
            if v_item:
                prog = float(h.get("progressPercent", 50)) / 100.0
                weight = prog * 2.0 + 1.0
                cat = v_item.get("category", "")
                affinity_map[cat] = affinity_map.get(cat, 0.0) + weight * 1.5
                for t in v_item.get("tags", []):
                    affinity_map[t] = affinity_map.get(t, 0.0) + weight

        for lid in liked_video_ids:
            v_item = next((v for v in all_videos if v["id"] == lid), None)
            if v_item:
                cat = v_item.get("category", "")
                affinity_map[cat] = affinity_map.get(cat, 0.0) + 3.0
                for t in v_item.get("tags", []):
                    affinity_map[t] = affinity_map.get(t, 0.0) + 2.0

        for bid in bookmarked_video_ids:
            v_item = next((v for v in all_videos if v["id"] == bid), None)
            if v_item:
                cat = v_item.get("category", "")
                affinity_map[cat] = affinity_map.get(cat, 0.0) + 2.5
                for t in v_item.get("tags", []):
                    affinity_map[t] = affinity_map.get(t, 0.0) + 1.8

        scored_up_next: List[Dict[str, Any]] = []
        for v in other_videos:
            score = 0.0
            if current_video:
                if v.get("category") == current_video.get("category"):
                    score += 3.0
                shared_tags = set(v.get("tags", [])).intersection(set(current_video.get("tags", [])))
                score += len(shared_tags) * 1.5

                v_topics = {t["topic"].lower(): float(t.get("weight", 0.5)) for t in v.get("topicAffinities", [])}
                c_topics = {t["topic"].lower(): float(t.get("weight", 0.5)) for t in (current_video.get("topicAffinities", []) if current_video else [])}
                for t, w in c_topics.items():
                    if t in v_topics:
                        score += w * v_topics[t] * 2.5
            scored_up_next.append({"video": v, "score": score})
        scored_up_next.sort(key=lambda x: float(x["score"]), reverse=True)

        scored_personalized: List[Dict[str, Any]] = []
        for v in all_videos:
            score = 0.0
            cat_score = affinity_map.get(v.get("category", ""), 0.0)
            score += cat_score * 2.0
            for t in v.get("tags", []):
                score += affinity_map.get(t, 0.0)
            score += (float(v.get("likes", 0)) / 10000.0) * 0.5
            scored_personalized.append({"video": v, "score": score})
        scored_personalized.sort(key=lambda x: float(x["score"]), reverse=True)

        trending_videos = sorted(
            all_videos,
            key=lambda v: (int(v.get("views", 0)) + int(v.get("likes", 0)) * 10),
            reverse=True
        )

        deep_dives = sorted(
            [v for v in all_videos if float(v.get("duration", 0)) >= 400],
            key=lambda v: float(v.get("duration", 0)),
            reverse=True
        )

        return [
            {
                "id": "rail-up-next",
                "title": "Up Next & Contextually Linked",
                "subtitle": "Algorithmically sequenced based on current video embeddings",
                "tag": "Instant Auto-Play",
                "videos": [item["video"] for item in scored_up_next[:6]]
            },
            {
                "id": "rail-personalized",
                "title": "Recommended For You",
                "subtitle": "Tuned dynamically to your active watch time & topic affinities",
                "tag": "Personalized Graph",
                "videos": [item["video"] for item in scored_personalized[:6]]
            },
            {
                "id": "rail-trending",
                "title": "Trending & High-Engagement",
                "subtitle": "Fastest-growing tech explorations across the network",
                "tag": "Trending",
                "videos": trending_videos[:6]
            },
            {
                "id": "rail-deep-dives",
                "title": "Deep Architecture & Long-Context",
                "subtitle": "Comprehensive masterclasses with dense semantic indexing",
                "tag": "In-Depth",
                "videos": deep_dives[:6]
            }
        ]
