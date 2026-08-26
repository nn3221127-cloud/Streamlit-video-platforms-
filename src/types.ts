export interface ChapterMarker {
  id: string;
  startTime: number;
  endTime: number;
  title: string;
  summary: string;
  keyVisual?: string;
  confidence?: number;
  topicShiftType?: 'major_theme' | 'scene_change' | 'technical_deep_dive' | 'conclusion';
}

export interface TranscriptSegment {
  id: string;
  startTime: number;
  endTime: number;
  speaker?: string;
  text: string;
}

export interface TranslatedTranscript {
  languageCode: string;
  languageName: string;
  segments: TranscriptSegment[];
}

export interface VideoSummaryPayload {
  overview: string;
  keyTopics: { topic: string; timestamp?: number; description: string }[];
  keyEvents: { timestamp: number; title: string; eventDescription: string; importance: 'high' | 'medium' | 'normal' }[];
  takeaways: string[];
  readingTimeMinutes: number;
  complexityLevel: 'Executive' | 'Standard' | 'Deep Dive';
  generatedAt?: number;
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
  translations?: Record<string, TranscriptSegment[]>; // langCode -> segments
  summaryData?: VideoSummaryPayload;
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

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  avatar: string;
  role: 'admin' | 'creator' | 'viewer';
  badge?: string;
  createdAt: number;
  preferences: {
    playbackSpeed: number;
    quality: string;
    autoplayNext: boolean;
    theme: string;
    preferredLanguage: string;
  };
}

export interface UserState {
  user?: UserAccount | null;
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
    preferredLanguage?: string;
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

// Watch Party & Real-time Collaboration Types
export interface PartyParticipant {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  joinedAt: number;
  lastPing: number;
}

export interface PartyPlaybackState {
  isPlaying: boolean;
  currentTime: number;
  playbackSpeed: number;
  lastUpdated: number;
  updatedBy: string;
  updatedByName: string;
}

export interface PartyChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  timestamp: number;
  videoTimestamp?: number;
}

export interface PartyReaction {
  id: string;
  userId: string;
  userName: string;
  emoji: string;
  timestamp: number;
  x: number; // percentage across player (10 to 90)
}

export interface PartyTimelineComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  timestamp: number;
  text: string;
  createdAt: number;
  likes: number;
}

export interface WatchPartyRoom {
  roomId: string;
  name: string;
  hostId: string;
  hostName: string;
  videoId: string;
  videoTitle: string;
  playbackState: PartyPlaybackState;
  participants: PartyParticipant[];
  messages: PartyChatMessage[];
  reactions: PartyReaction[];
  timelineComments: PartyTimelineComment[];
  createdAt: number;
}
