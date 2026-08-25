export interface ChapterMarker {
  id: string;
  startTime: number;
  endTime: number;
  title: string;
  summary: string;
  keyVisual?: string;
  confidence?: number;
}

export interface TranscriptSegment {
  id: string;
  startTime: number;
  endTime: number;
  speaker?: string;
  text: string;
}

export interface VisualScene {
  timestamp: number;
  sceneDescription: string;
  objects: string[];
  sentiment: string;
}

export interface AIClip {
  id: string;
  startTime: number;
  endTime: number;
  title: string;
  hook: string;
  viralityScore: number;
}

export interface VideoItem {
  id: string;
  title: string;
  description: string;
  url: string;
  streamType: 'mp4' | 'hls' | 'youtube' | 'uploaded';
  duration: number; // in seconds
  thumbnail: string;
  author: string;
  authorAvatar: string;
  publishedAt: string;
  views: number;
  likes: number;
  category: string;
  tags: string[];
  chapters: ChapterMarker[];
  transcript: TranscriptSegment[];
  keyTakeaways: string[];
  topicAffinities: { topic: string; weight: number }[];
  visualScenes?: VisualScene[];
  aiGeneratedClips?: AIClip[];
  specs?: {
    resolution: string;
    codec: string;
    bitrate: string;
    aspectRatio: string;
  };
}

export interface ChatCitation {
  timestamp: number;
  label: string;
  text: string;
}

export interface WebGroundingSource {
  uri: string;
  title: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  citations?: ChatCitation[];
  groundedWebUrls?: WebGroundingSource[];
  modelUsed?: string;
  thinkingContent?: string;
}

export interface BookmarkItem {
  id: string;
  videoId: string;
  timestamp: number;
  title: string;
  note?: string;
  createdAt: number;
}

export interface UserNote {
  id: string;
  videoId: string;
  timestamp: number;
  text: string;
  updatedAt?: number;
  createdAt?: number;
}

export interface WatchHistoryEntry {
  videoId: string;
  watchedAt: number;
  progressPercent: number;
  lastTimestamp: number;
  watchDuration?: number;
}

export interface UserState {
  watchHistory: WatchHistoryEntry[];
  likedVideoIds: string[];
  bookmarkedTimestamps: BookmarkItem[];
  notes: UserNote[];
  customCategories: string[];
  preferences: {
    playbackSpeed: number;
    quality: string;
    autoplayNext: boolean;
    theme: string;
  };
}

export interface CacheStats {
  size: number;
  maxEntries: number;
  hitRate: string;
  vectorStoreDocsCount: number;
  estimatedLatencyMs: number;
}

export interface SearchResult {
  video: VideoItem;
  score: number;
  matchType: 'vector' | 'lexical' | 'hybrid';
  matchedSegment?: {
    startTime: number;
    text: string;
  };
}

export interface RecommendationRail {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  videos: VideoItem[];
}
