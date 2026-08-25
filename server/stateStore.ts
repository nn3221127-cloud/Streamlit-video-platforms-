import { VideoItem, BookmarkItem, UserNote, WatchHistoryEntry, ChatMessage } from '../src/types';
import { INITIAL_VIDEOS } from '../src/data/sampleVideos';

export class StateStore {
  private videos: VideoItem[] = [];
  private activeVideoId: string = '';
  private playbackTime: number = 0;
  private likedVideoIds: Set<string> = new Set(['vid-gemini-multimodal']);
  private bookmarkedVideoIds: Set<string> = new Set();
  private bookmarks: BookmarkItem[] = [];
  private userNotes: UserNote[] = [];
  private watchHistory: WatchHistoryEntry[] = [];
  private chatHistories: Map<string, ChatMessage[]> = new Map();

  constructor() {
    this.videos = [...INITIAL_VIDEOS];
    this.activeVideoId = this.videos[0]?.id || '';
    
    // Seed initial history
    this.watchHistory.push({
      videoId: 'vid-gemini-multimodal',
      watchedAt: Date.now() - 3600000,
      progressPercent: 42,
      lastTimestamp: 250,
    });
  }

  public getVideos(): VideoItem[] {
    return this.videos;
  }

  public getVideoById(id: string): VideoItem | undefined {
    return this.videos.find((v) => v.id === id);
  }

  public addVideo(video: VideoItem) {
    this.videos.unshift(video);
  }

  public getActiveVideoId(): string {
    return this.activeVideoId;
  }

  public setActiveVideoId(id: string) {
    if (this.videos.some((v) => v.id === id)) {
      this.activeVideoId = id;
    }
  }

  public getSessionState() {
    return {
      activeVideoId: this.activeVideoId,
      playbackTime: this.playbackTime,
      likedVideoIds: Array.from(this.likedVideoIds),
      bookmarkedVideoIds: Array.from(this.bookmarkedVideoIds),
      bookmarks: this.bookmarks,
      userNotes: this.userNotes,
      watchHistory: this.watchHistory,
    };
  }

  public toggleLike(videoId: string): { isLiked: boolean; likesCount: number } {
    const video = this.getVideoById(videoId);
    let isLiked = false;
    if (this.likedVideoIds.has(videoId)) {
      this.likedVideoIds.delete(videoId);
      if (video) video.likes = Math.max(0, video.likes - 1);
      isLiked = false;
    } else {
      this.likedVideoIds.add(videoId);
      if (video) video.likes += 1;
      isLiked = true;
    }
    return { isLiked, likesCount: video?.likes || 0 };
  }

  public toggleBookmark(videoId: string): boolean {
    if (this.bookmarkedVideoIds.has(videoId)) {
      this.bookmarkedVideoIds.delete(videoId);
      return false;
    } else {
      this.bookmarkedVideoIds.add(videoId);
      return true;
    }
  }

  public addBookmark(bookmark: BookmarkItem) {
    this.bookmarks.unshift(bookmark);
    this.bookmarkedVideoIds.add(bookmark.videoId);
    return bookmark;
  }

  public removeBookmark(id: string) {
    this.bookmarks = this.bookmarks.filter((b) => b.id !== id);
  }

  public addOrUpdateNote(note: UserNote) {
    const idx = this.userNotes.findIndex((n) => n.id === note.id);
    if (idx >= 0) {
      this.userNotes[idx] = note;
    } else {
      this.userNotes.unshift(note);
    }
    return note;
  }

  public deleteNote(id: string) {
    this.userNotes = this.userNotes.filter((n) => n.id !== id);
  }

  public updateWatchProgress(videoId: string, timestamp: number, duration: number) {
    this.playbackTime = timestamp;
    const progressPercent = duration > 0 ? Math.min(100, Math.round((timestamp / duration) * 100)) : 0;
    const existingIdx = this.watchHistory.findIndex((w) => w.videoId === videoId);
    if (existingIdx >= 0) {
      this.watchHistory[existingIdx].watchedAt = Date.now();
      this.watchHistory[existingIdx].progressPercent = Math.max(this.watchHistory[existingIdx].progressPercent, progressPercent);
      this.watchHistory[existingIdx].lastTimestamp = timestamp;
    } else {
      this.watchHistory.unshift({
        videoId,
        watchedAt: Date.now(),
        progressPercent,
        lastTimestamp: timestamp,
      });
    }
  }

  public getChatHistory(videoId: string): ChatMessage[] {
    if (!this.chatHistories.has(videoId)) {
      // Initialize with welcome message
      const video = this.getVideoById(videoId);
      const initialMsgs: ChatMessage[] = [
        {
          id: 'welcome-1',
          role: 'assistant',
          content: `Hello! I am your AI Video Copilot for **"${video?.title || 'this stream'}"**. I have indexed the full multimodal transcript, timestamps, and visual scenes.\n\nAsk me anything like:\n- *"What are the core architectural takeaways?"*\n- *"Explain the concept introduced in Chapter 2"*\n- *"Summarize the speaker's key argument with timestamps"*`,
          timestamp: Date.now(),
        },
      ];
      this.chatHistories.set(videoId, initialMsgs);
    }
    return this.chatHistories.get(videoId) || [];
  }

  public addChatMessage(videoId: string, message: ChatMessage) {
    const history = this.getChatHistory(videoId);
    history.push(message);
    this.chatHistories.set(videoId, history);
  }

  public clearChatHistory(videoId: string) {
    this.chatHistories.delete(videoId);
  }
}
