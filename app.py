import os
import json
import time
from dotenv import load_dotenv
import streamlit as st
from typing import Dict, Any, List

from state_manager import StateManager
from recommendation_engine import VectorSearchStore, RecommendationEngine
from ai_engine import analyze_video_content, generate_grounded_video_answer, format_timestamp
from sample_videos import INITIAL_VIDEOS

load_dotenv()

# Set Streamlit page configuration
st.set_page_config(
    page_title="StreamIntel Studio | AI Video Intelligence Platform",
    page_icon="🎬",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# -------------------------------------------------------------
# STREAMLIT CACHED RESOURCES & HELPERS
# -------------------------------------------------------------

@st.cache_resource
def get_state_manager() -> StateManager:
    sm = StateManager()
    existing = sm.get_all_videos()
    if not existing:
        for vid in INITIAL_VIDEOS:
            sm.save_video(vid)
    return sm

@st.cache_resource
def get_vector_store() -> VectorSearchStore:
    sm = get_state_manager()
    videos = sm.get_all_videos()
    return VectorSearchStore(videos)

@st.cache_resource
def get_recommendation_engine() -> RecommendationEngine:
    return RecommendationEngine()

@st.cache_data(ttl=3600)
def cached_analyze_video(title: str, description: str, transcript: str, duration: float) -> Dict[str, Any]:
    return analyze_video_content(title, description, transcript, duration)

# -------------------------------------------------------------
# SESSION STATE INITIALIZATION
# -------------------------------------------------------------
state_mgr = get_state_manager()
vector_store = get_vector_store()
rec_engine = get_recommendation_engine()

state_mgr.update_session_state()

all_videos = state_mgr.get_all_videos()
if not all_videos:
    all_videos = INITIAL_VIDEOS

if "active_video_id" not in st.session_state or not st.session_state["active_video_id"]:
    st.session_state["active_video_id"] = all_videos[0]["id"]

if "current_time" not in st.session_state:
    st.session_state["current_time"] = 0.0

if "active_category" not in st.session_state:
    st.session_state["active_category"] = "All"

if "chat_history" not in st.session_state:
    st.session_state["chat_history"] = {}

if "search_query" not in st.session_state:
    st.session_state["search_query"] = ""

active_video = next((v for v in all_videos if v["id"] == st.session_state["active_video_id"]), all_videos[0])

# -------------------------------------------------------------
# FRONTEND TEMPLATE INJECTION & STYLES (STRICT FREEZE COMPLIANCE)
# -------------------------------------------------------------
st.markdown("""
<style>
    .stApp { background-color: #070b14; color: #f8fafc; }
    .neon-card { background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 12px; padding: 16px; }
    .neon-badge { background: linear-gradient(135deg, #06b6d4, #3b82f6); color: white; border-radius: 9999px; padding: 2px 10px; font-size: 12px; font-weight: 600; }
    .timestamp-btn { background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8; border-radius: 6px; padding: 2px 8px; font-size: 12px; }
</style>
""", unsafe_allow_html=True)

# -------------------------------------------------------------
# NAVIGATION & HEADER
# -------------------------------------------------------------
col_logo, col_search, col_actions = st.columns([3, 5, 4])

with col_logo:
    st.markdown("### ⚡ **StreamIntel** Studio")

with col_search:
    search_q = st.text_input("🔍 Hybrid Vector & Lexical Search", value=st.session_state["search_query"], placeholder="Query transcripts, visual scenes, topics...", label_visibility="collapsed")
    if search_q != st.session_state["search_query"]:
        st.session_state["search_query"] = search_q
        st.rerun()

with col_actions:
    col_a1, col_a2 = st.columns(2)
    with col_a1:
        if st.button("➕ Ingest Video", use_container_width=True):
            st.session_state["show_ingest"] = True
    with col_a2:
        st.caption(f"🤖 Model: Gemini 2.5 Flash")

# Category Filter Rail
categories = ["All", "AI & Machine Learning", "Quantum Computing", "Robotics & Automation", "Space & Astronomy", "Biotech & Genomics", "Cybersecurity & Cloud"]
cat_cols = st.columns(len(categories))
for idx, cat in enumerate(categories):
    with cat_cols[idx]:
        is_selected = (st.session_state["active_category"] == cat)
        if st.button(cat, key=f"cat_{idx}", type="primary" if is_selected else "secondary", use_container_width=True):
            st.session_state["active_category"] = cat
            st.rerun()

st.divider()

# Search Results Handling
if st.session_state["search_query"].strip():
    st.subheader(f"Search Results for '{st.session_state['search_query']}'")
    search_results = vector_store.search(st.session_state["search_query"], st.session_state["active_category"])
    if not search_results:
        st.warning("No matching videos found.")
    else:
        res_cols = st.columns(min(3, len(search_results)))
        for idx, item in enumerate(search_results[:6]):
            v = item["video"]
            with res_cols[idx % 3]:
                st.image(v.get("thumbnail", ""), use_container_width=True)
                st.markdown(f"**{v['title']}**")
                st.caption(f"Score: {item['score']} | Category: {v['category']}")
                if st.button(f"Play Stream", key=f"s_play_{v['id']}"):
                    st.session_state["active_video_id"] = v["id"]
                    st.session_state["search_query"] = ""
                    st.rerun()
    st.divider()

# Ingest Stream Modal
if st.session_state.get("show_ingest", False):
    with st.expander("📥 Multimodal Video Stream Ingestion", expanded=True):
        st.markdown("Ingest MP4, HLS (.m3u8), or YouTube URLs for automated Gemini indexing.")
        with st.form("ingest_form"):
            in_title = st.text_input("Stream Title", placeholder="e.g. Gemini 2.5 Architecture Masterclass")
            in_url = st.text_input("Video URL (MP4 / YouTube / HLS)", value="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4")
            in_desc = st.text_area("Video Description / Context")
            in_transcript = st.text_area("Raw Spoken Transcript (Optional)")
            in_cat = st.selectbox("Category", categories[1:])
            submitted = st.form_submit_button("Start AI Multimodal Analysis")

            if submitted and in_title:
                with st.spinner("Analyzing stream with Gemini 2.5 Flash..."):
                    analysis = cached_analyze_video(in_title, in_desc, in_transcript, 300.0)
                    new_vid = {
                        "id": f"vid-custom-{int(time.time())}",
                        "title": in_title,
                        "description": analysis.get("summary", in_desc),
                        "url": in_url,
                        "streamType": "youtube" if "youtube" in in_url or "youtu.be" in in_url else "hls" if "m3u8" in in_url else "mp4",
                        "duration": 300.0,
                        "thumbnail": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
                        "author": "Custom Stream Ingest",
                        "authorAvatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80",
                        "publishedAt": "2026-08-25",
                        "views": 1,
                        "likes": 0,
                        "category": in_cat,
                        "tags": analysis.get("tags", ["Ingested"]),
                        "chapters": analysis.get("chapters", []),
                        "transcript": analysis.get("transcript", []),
                        "keyTakeaways": analysis.get("keyTakeaways", []),
                        "topicAffinities": analysis.get("topicAffinities", []),
                        "visualScenes": analysis.get("visualScenes", []),
                        "aiGeneratedClips": analysis.get("aiGeneratedClips", []),
                        "specs": {"resolution": "1080p", "codec": "H.264", "bitrate": "8.0 Mbps", "aspectRatio": "16:9"}
                    }
                    state_mgr.save_video(new_vid)
                    vector_store.add_or_update_video(new_vid)
                    st.session_state["active_video_id"] = new_vid["id"]
                    st.session_state["show_ingest"] = False
                    st.success("Video Ingested Successfully!")
                    st.rerun()

# -------------------------------------------------------------
# MAIN STUDIO WORKSPACE (MEDIA PLAYER + TABS + COPILOT SIDEBAR)
# -------------------------------------------------------------
left_col, right_col = st.columns([8, 4])

with left_col:
    # 1. Media Player with Fallback Handling
    st.markdown(f"#### 📺 **{active_video['title']}**")
    video_url = active_video.get("url", "")

    try:
        st.video(video_url, start_time=int(st.session_state["current_time"]))
    except Exception as err:
        st.error(f"Stream playback error: {err}. Rendering fallback container.")
        st.warning(f"Fallback Stream Source: {video_url}")

    # Interactive Actions Bar
    act_c1, act_c2, act_c3, act_c4 = st.columns(4)
    liked_ids = state_mgr.get_liked_video_ids()
    is_liked = active_video["id"] in liked_ids

    with act_c1:
        like_label = f"❤️ Liked ({active_video.get('likes', 0)})" if is_liked else f"🤍 Like ({active_video.get('likes', 0)})"
        if st.button(like_label, key="btn_like", use_container_width=True):
            state_mgr.toggle_like(active_video["id"])
            st.rerun()

    with act_c2:
        if st.button("🔖 Save Bookmark", key="btn_bm", use_container_width=True):
            state_mgr.add_bookmark(active_video["id"], st.session_state["current_time"])
            st.toast("Bookmark saved at current timestamp!")

    with act_c3:
        st.caption(f"👀 {active_video.get('views', 0):,} views")

    with act_c4:
        st.caption(f"📁 {active_video.get('category', 'General')}")

    st.markdown(f"*{active_video.get('description', '')}*")
    st.divider()

    # 2. Video Intelligence Tabs
    tab_overview, tab_chapters, tab_transcript, tab_notes = st.tabs(["💡 Overview & Takeaways", "📌 Chapters & Keyframes", "📝 Transcript", "✏️ User Notes"])

    with tab_overview:
        st.markdown("##### **Executive Summary**")
        st.write(active_video.get("description", "No summary available."))

        st.markdown("##### **Key Takeaways**")
        for kt in active_video.get("keyTakeaways", []):
            st.markdown(f"- {kt}")

        st.markdown("##### **Topic Affinities**")
        aff_cols = st.columns(len(active_video.get("topicAffinities", [])) or 1)
        for i, aff in enumerate(active_video.get("topicAffinities", [])):
            with aff_cols[i % len(aff_cols)]:
                st.metric(label=aff.get("topic", "Topic"), value=f"{int(aff.get('weight', 0.5)*100)}%")

    with tab_chapters:
        st.markdown("##### **Interactive Chapter Timeline**")
        chapters = active_video.get("chapters", [])
        if not chapters:
            st.info("No chapter markers indexed for this stream.")
        for ch in chapters:
            c1, c2, c3 = st.columns([2, 6, 2])
            with c1:
                start_fmt = format_timestamp(ch.get("startTime", 0))
                end_fmt = format_timestamp(ch.get("endTime", 0))
                if st.button(f"⏱️ [{start_fmt} - {end_fmt}]", key=f"seek_{ch.get('id')}"):
                    st.session_state["current_time"] = float(ch.get("startTime", 0))
                    st.rerun()
            with c2:
                st.markdown(f"**{ch.get('title')}**")
                st.caption(ch.get("summary", ""))
            with c3:
                st.caption(f"Confidence: {int(ch.get('confidence', 0.95)*100)}%")

    with tab_transcript:
        st.markdown("##### **Synchronized Speech Transcript**")
        transcript = active_video.get("transcript", [])
        if not transcript:
            st.info("No synchronized speech transcript available.")
        for tr in transcript:
            t_col1, t_col2 = st.columns([2, 8])
            with t_col1:
                t_fmt = format_timestamp(tr.get("startTime", 0))
                if st.button(f"▶ [{t_fmt}]", key=f"tr_seek_{tr.get('id')}"):
                    st.session_state["current_time"] = float(tr.get("startTime", 0))
                    st.rerun()
            with t_col2:
                spk = tr.get("speaker", "Speaker")
                st.markdown(f"**{spk}:** {tr.get('text')}")

    with tab_notes:
        st.markdown("##### **Personal Notes & Annotations**")
        with st.form("add_note_form"):
            note_text = st.text_input("Add timestamped note", placeholder="Key insight at current moment...")
            note_sub = st.form_submit_button("Save Note")
            if note_sub and note_text:
                state_mgr.save_note(active_video["id"], note_text, st.session_state["current_time"])
                st.success("Note saved!")
                st.rerun()

        user_notes = [n for n in state_mgr.get_notes() if n["videoId"] == active_video["id"]]
        for n in user_notes:
            n_c1, n_c2 = st.columns([8, 2])
            with n_c1:
                st.markdown(f"⏱️ **[{format_timestamp(n['timestamp'])}]**: {n['text']}")
            with n_c2:
                if st.button("🗑️", key=f"del_note_{n['id']}"):
                    state_mgr.delete_note(n["id"])
                    st.rerun()

# -------------------------------------------------------------
# RIGHT SIDEBAR: GROUNDED COPILOT CHAT ASSISTANT
# -------------------------------------------------------------
with right_col:
    st.markdown("#### 🤖 **Video Copilot Grounded Chat**")
    st.caption("Ask questions strictly grounded in the video's transcript, timestamps, and visual scenes.")

    use_thinking = st.checkbox("🧠 High Thinking Mode (Deep Context)")
    use_search = st.checkbox("🌐 Web Search Grounding")

    v_chat_history = st.session_state["chat_history"].get(active_video["id"], [
        {
            "role": "assistant",
            "content": f"Hello! I am your AI Video Copilot for **'{active_video['title']}'**. Ask me about specific timestamps, chapters, or spoken topics!"
        }
    ])

    chat_container = st.container(height=400)
    with chat_container:
        for msg in v_chat_history:
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])
                if "citations" in msg and msg["citations"]:
                    st.caption("Timestamps:")
                    for cite in msg["citations"]:
                        if st.button(cite["label"], key=f"cite_{cite['timestamp']}_{time.time()}"):
                            st.session_state["current_time"] = float(cite["timestamp"])
                            st.rerun()

    user_query = st.chat_input("Ask about this video...")
    if user_query:
        # Append User Message
        v_chat_history.append({"role": "user", "content": user_query})

        # Generate Grounded AI Answer
        with st.spinner("Analyzing transcript & grounded timestamps..."):
            ans = generate_grounded_video_answer(
                message=user_query,
                chat_history=v_chat_history,
                video=active_video,
                current_playback_time=st.session_state["current_time"],
                use_thinking_high=use_thinking,
                use_search_grounding=use_search
            )

        v_chat_history.append({
            "role": "assistant",
            "content": ans["content"],
            "citations": ans.get("citations", [])
        })

        st.session_state["chat_history"][active_video["id"]] = v_chat_history
        st.rerun()

# -------------------------------------------------------------
# PERSONALIZED RECOMMENDATION RAILS
# -------------------------------------------------------------
st.divider()
st.markdown("### 🎬 **Personalized Video Discovery Rails**")

rails = rec_engine.get_recommendations(
    all_videos=all_videos,
    current_video_id=active_video["id"],
    watch_history=state_mgr.get_watch_history(),
    liked_video_ids=state_mgr.get_liked_video_ids(),
    bookmarked_video_ids=[b["videoId"] for b in state_mgr.get_bookmarks()]
)

for rail in rails:
    st.markdown(f"#### **{rail['title']}**")
    st.caption(rail["subtitle"])
    r_vids = rail["videos"]
    if r_vids:
        r_cols = st.columns(min(4, len(r_vids)))
        for idx, r_vid in enumerate(r_vids[:4]):
            with r_cols[idx % 4]:
                st.image(r_vid.get("thumbnail", ""), use_container_width=True)
                st.markdown(f"**{r_vid['title'][:40]}...**")
                st.caption(f"{r_vid['category']} • {format_timestamp(r_vid.get('duration', 300))}")
                if st.button("Watch Stream", key=f"r_play_{rail['id']}_{r_vid['id']}"):
                    st.session_state["active_video_id"] = r_vid["id"]
                    st.session_state["current_time"] = 0.0
                    st.rerun()
