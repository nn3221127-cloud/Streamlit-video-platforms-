import os
import json
import time
import asyncio
import re
import base64
from typing import Dict, Any, List, Optional
from google import genai
from google.genai import types

def get_genai_client() -> Optional[genai.Client]:
    """
    Initializes and returns the Google GenAI SDK Client using GEMINI_API_KEY from environment.
    Returns None if key is missing or invalid.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or api_key == "YOUR_GEMINI_API_KEY" or api_key == "dummy-key":
        return None
    try:
        return genai.Client(api_key=api_key)
    except Exception as e:
        print(f"[AIEngine] Failed to initialize GenAI Client: {e}")
        return None

def with_retry(fn: Any, max_retries: int = 3, initial_delay: float = 1.0) -> Any:
    """
    Helper function executing fn with exponential backoff for rate limits or transient errors.
    """
    delay = initial_delay
    last_err: Optional[Exception] = None
    for attempt in range(1, max_retries + 1):
        try:
            return fn()
        except Exception as err:
            if isinstance(err, Exception):
                last_err = err
            else:
                last_err = Exception(str(err))
            print(f"[AIEngine] Gemini API call attempt {attempt}/{max_retries} failed: {err}")
            if attempt < max_retries:
                time.sleep(delay)
                delay *= 2.0
    if last_err:
        raise last_err
    raise RuntimeError("Max retries exceeded")

def format_timestamp(seconds: float) -> str:
    """Formats seconds into MM:SS format."""
    if seconds is None or seconds < 0:
        return "00:00"
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"{m:02d}:{s:02d}"

def analyze_video_content(
    video_title: str,
    video_description: str = "",
    transcript_text: Optional[str] = None,
    duration_seconds: float = 300,
    uploaded_video_base64: Optional[str] = None,
    mime_type: str = "video/mp4"
) -> Dict[str, Any]:
    """
    Asynchronously/synchronously analyzes video content and transcript to extract:
    - Executive summary & key takeaways
    - Structured chapter markers with temporal timestamps
    - Synchronized transcript segments
    - Visual scene summaries
    - Topic affinities & tags
    - AI-generated short clip candidates
    """
    client = get_genai_client()
    if not client:
        return generate_fallback_video_analysis(video_title, video_description, duration_seconds)

    prompt = f"""You are an elite Multimodal Video Intelligence Agent powered by Gemini.
Analyze the following video stream and transcript:

Video Title: {video_title}
Video Description: {video_description}
Duration: {duration_seconds} seconds
{f'Raw Transcript Data:\\n{transcript_text}' if transcript_text else 'Synthesize a realistic synchronized transcript and temporal chapter breakdown.'}

Return your output strictly as valid JSON adhering to this schema:
{{
  "summary": "Concise executive summary of the video content",
  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3", "Takeaway 4"],
  "category": "Technology/AI/Science/Education/Engineering",
  "tags": ["tag1", "tag2", "tag3"],
  "chapters": [
    {{
      "id": "c1",
      "startTime": 0,
      "endTime": 60,
      "title": "01. Introduction",
      "summary": "Chapter summary",
      "keyVisual": "Visual anchor description",
      "confidence": 0.98
    }}
  ],
  "transcript": [
    {{
      "id": "t1",
      "startTime": 0,
      "endTime": 15,
      "speaker": "Presenter",
      "text": "Spoken text line"
    }}
  ],
  "visualScenes": [
    {{
      "timestamp": 10,
      "sceneDescription": "Visual scene breakdown description",
      "objects": ["diagram", "code editor", "presenter"],
      "sentiment": "Technical / Informative"
    }}
  ],
  "aiGeneratedClips": [
    {{
      "id": "clip-1",
      "startTime": 15,
      "endTime": 45,
      "title": "Viral Hook Clip Title",
      "hook": "Engaging hook line for clip",
      "viralityScore": 94
    }}
  ],
  "topicAffinities": [
    {{ "topic": "Primary Concept", "weight": 0.95 }},
    {{ "topic": "Secondary Concept", "weight": 0.82 }}
  ]
}}"""

    try:
        contents: List[Any] = []
        if uploaded_video_base64:
            # Decode base64 string to raw binary bytes
            video_bytes = base64.b64decode(uploaded_video_base64)
            contents.append(
                types.Part.from_bytes(
                    data=video_bytes,
                    mime_type=mime_type
                )
            )
        contents.append(types.Part.from_text(text=prompt))

        def call_api() -> Any:
            return client.models.generate_content(
                model='gemini-2.5-flash',
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    system_instruction="You are a deep video intelligence system. Always respond in strict valid JSON."
                )
            )

        response = with_retry(call_api)
        response_text = response.text or "{}"
        parsed = json.loads(response_text)
        return parsed
    except Exception as e:
        print(f"[AIEngine] Analysis API call failed: {e}. Falling back to structured response.")
        return generate_fallback_video_analysis(video_title, video_description, duration_seconds)

def generate_grounded_video_answer(
    message: str,
    chat_history: List[Dict[str, Any]],
    video: Dict[str, Any],
    current_playback_time: float = 0.0,
    use_thinking_high: bool = False,
    use_search_grounding: bool = False
) -> Dict[str, Any]:
    """
    Context-aware grounded video Q&A. Takes current video transcript, metadata, visual scenes,
    and returns grounded, conversational answers with timestamp citations [MM:SS].
    """
    client = get_genai_client()
    if not client:
        return generate_fallback_chat_answer(message, video, current_playback_time)

    title = video.get("title", "Active Video")
    duration = video.get("duration", 300)
    category = video.get("category", "General")
    chapters = video.get("chapters", [])
    transcript = video.get("transcript", [])
    scenes = video.get("visualScenes", [])

    chapters_formatted = "\n".join([
        f"[{format_timestamp(c.get('startTime', 0))} - {format_timestamp(c.get('endTime', 0))}] {c.get('title')}: {c.get('summary')}"
        for c in chapters
    ])
    transcript_formatted = "\n".join([
        f"[{format_timestamp(t.get('startTime', 0))} - {format_timestamp(t.get('endTime', 0))}] {t.get('speaker', 'Speaker')}: {t.get('text')}"
        for t in transcript
    ])
    scenes_formatted = "\n".join([
        f"[{format_timestamp(s.get('timestamp', 0))}] Visual: {s.get('sceneDescription')} (Objects: {', '.join(s.get('objects', []))})"
        for s in scenes
    ])

    system_instruction = f"""You are StreamIntel Video Copilot, an expert grounded AI video assistant.
Answer user questions strictly based on the following video metadata, timeline chapters, transcript, and visual scene data.

VIDEO CONTEXT:
Title: "{title}"
Duration: {format_timestamp(duration)} ({duration}s)
Category: {category}
User Active Playback Position: {format_timestamp(current_playback_time)} ({int(current_playback_time)}s)

CHAPTER TIMELINE:
{chapters_formatted or 'N/A'}

SYNCHRONIZED TRANSCRIPT:
{transcript_formatted or 'N/A'}

VISUAL SCENE DATA:
{scenes_formatted or 'N/A'}

GUIDELINES:
1. Always ground your answer in the video events and spoken transcript.
2. Whenever citing a specific moment, event, or statement, include timestamp markers in the format [MM:SS] (e.g., [01:24] or [03:45]).
3. Be concise, direct, technically accurate, and conversational.
4. If the user asks what is happening right now, explain the segment at position ~{format_timestamp(current_playback_time)}."""

    model_name = "gemini-2.5-flash"
    if use_thinking_high:
        model_name = "gemini-2.5-pro"

    # Filter out duplicate trailing message if caller already appended message to chat_history
    filtered_history = list(chat_history)
    if filtered_history and filtered_history[-1].get("role") == "user" and filtered_history[-1].get("content") == message:
        filtered_history.pop()

    contents_payload: Any = []
    for turn in filtered_history[-6:]:
        role = "model" if turn.get("role") in ["assistant", "model"] else "user"
        contents_payload.append(types.Content(
            role=role,
            parts=[types.Part.from_text(text=turn.get("content", ""))]
        ))

    contents_payload.append(types.Content(
        role="user",
        parts=[types.Part.from_text(text=message)]
    ))

    config_kwargs: Dict[str, Any] = {
        "system_instruction": system_instruction,
    }

    if use_search_grounding:
        config_kwargs["tools"] = [{"google_search": {}}]

    try:
        def call_chat() -> Any:
            return client.models.generate_content(
                model=model_name,
                contents=contents_payload,
                config=types.GenerateContentConfig(**config_kwargs)
            )

        response = with_retry(call_chat)
        response_text = response.text or "I parsed the video data but could not generate a response."

        citations: List[Dict[str, Any]] = []
        matches = re.findall(r'\[(\d{1,2}):(\d{2})\]', response_text)
        for m_min, m_sec in matches:
            total_sec = int(m_min) * 60 + int(m_sec)
            label = f"[{int(m_min):02d}:{int(m_sec):02d}]"
            if not any(c["timestamp"] == total_sec for c in citations):
                citations.append({
                    "timestamp": total_sec,
                    "label": label,
                    "text": f"Jump to {label}"
                })

        return {
            "content": response_text,
            "citations": citations,
            "groundedWebUrls": [],
            "modelUsed": model_name,
            "thinkingUsed": use_thinking_high
        }
    except Exception as e:
        print(f"[AIEngine] Grounded Q&A API call failed: {e}. Returning fallback response.")
        return generate_fallback_chat_answer(message, video, current_playback_time)

def generate_fallback_video_analysis(video_title: str, video_description: str, duration: float) -> Dict[str, Any]:
    """Provides a deterministic fallback structure when Gemini API is offline/unconfigured."""
    step = max(30, int(duration // 4))
    return {
        "summary": f"Comprehensive AI intelligence breakdown for '{video_title}'. Evaluates underlying architecture, technical execution, and domain methodology.",
        "keyTakeaways": [
            f"Detailed exploration of core principles presented in {video_title}.",
            "High-throughput low-latency stream processing and multimodal alignment.",
            "Fine-grained temporal indexing with structured chapter segmentation.",
            "Production deployment guidelines and optimization strategies."
        ],
        "category": "Technology",
        "tags": ["Video AI", "Multimodal", "Intelligence", "Machine Learning"],
        "chapters": [
            {
                "id": "c1",
                "startTime": 0,
                "endTime": step,
                "title": f"01. Introduction to {video_title[:24]}",
                "summary": "Overview of foundational goals, problem formulation, and system architecture.",
                "keyVisual": "Title overview slide & speaker introduction",
                "confidence": 0.98
            },
            {
                "id": "c2",
                "startTime": step,
                "endTime": step * 2,
                "title": "02. Core Architecture & Pipeline Analysis",
                "summary": "Technical deep dive into algorithmic design and data structures.",
                "keyVisual": "System sequence flow diagram",
                "confidence": 0.95
            },
            {
                "id": "c3",
                "startTime": step * 2,
                "endTime": step * 3,
                "title": "03. Empirical Benchmarks & Performance",
                "summary": "Quantitative results, latency benchmarks, and comparative metrics.",
                "keyVisual": "Interactive performance metrics dashboard",
                "confidence": 0.96
            },
            {
                "id": "c4",
                "startTime": step * 3,
                "endTime": int(duration),
                "title": "04. Conclusion & Production Deployment",
                "summary": "Summary of insights and future research directions.",
                "keyVisual": "Summary takeaways slide",
                "confidence": 0.97
            }
        ],
        "transcript": [
            {"id": "t1", "startTime": 0, "endTime": step // 2, "speaker": "Speaker", "text": f"Welcome everyone. Today we are examining {video_title}."},
            {"id": "t2", "startTime": step // 2, "endTime": step, "speaker": "Speaker", "text": "Let us examine the primary architectural components and workflow."},
            {"id": "t3", "startTime": step, "endTime": step + step // 2, "speaker": "Speaker", "text": "As seen in this chart, latency is reduced significantly using parallel indexing."},
            {"id": "t4", "startTime": step * 2, "endTime": step * 2 + step // 2, "speaker": "Speaker", "text": "Our empirical evaluations confirm robust accuracy across all test parameters."}
        ],
        "visualScenes": [
            {
                "timestamp": 5,
                "sceneDescription": "Speaker introduction and title presentation slide",
                "objects": ["speaker", "title slide", "presentation deck"],
                "sentiment": "Educational"
            },
            {
                "timestamp": step + 10,
                "sceneDescription": "Live code demonstration and architectural workflow walkthrough",
                "objects": ["code editor", "terminal", "architecture diagram"],
                "sentiment": "Technical"
            }
        ],
        "aiGeneratedClips": [
            {
                "id": "clip-1",
                "startTime": int(step * 0.8),
                "endTime": int(step * 1.5),
                "title": f"Key Breakdown: {video_title[:20]}",
                "hook": "Here is how this architecture solves high-scale throughput challenges...",
                "viralityScore": 92
            }
        ],
        "topicAffinities": [
            {"topic": "AI & Machine Learning", "weight": 0.95},
            {"topic": "Software Engineering", "weight": 0.88}
        ]
    }

def generate_fallback_chat_answer(message: str, video: Dict[str, Any], current_playback_time: float) -> Dict[str, Any]:
    """Fallback conversational response grounded in video metadata."""
    title = video.get("title", "this video stream")
    chapters = video.get("chapters", [])
    first_ch_time = chapters[0].get("startTime", 0) if chapters else 0
    formatted_current = format_timestamp(current_playback_time)
    formatted_ch1 = format_timestamp(first_ch_time)

    content = f"""Regarding **"{title}"** around timestamp **[{formatted_current}]**:

- The video presents an in-depth analysis of key technical concepts.
- Refer to chapter 1 at timestamp **[{formatted_ch1}]** for the foundational background.
- At your current playback moment (**[{formatted_current}]**), the presentation focuses on implementation details and architectural tradeoffs.

*(Note: Operating in offline mode with grounded local metadata indexing.)*"""

    return {
        "content": content,
        "citations": [
            {"timestamp": current_playback_time, "label": f"[{formatted_current}]", "text": "Current playback position"},
            {"timestamp": first_ch_time, "label": f"[{formatted_ch1}]", "text": "Chapter 1 start"}
        ],
        "groundedWebUrls": [],
        "modelUsed": "offline-fallback",
        "thinkingUsed": False
    }
