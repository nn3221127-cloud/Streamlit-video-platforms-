import {
  VideoItem,
  BookmarkItem,
  UserNote,
  WatchHistoryEntry,
  ChatMessage,
  UserAccount,
  UserState,
  WatchPartyRoom,
  PartyParticipant,
  PartyChatMessage,
  PartyReaction,
  PartyTimelineComment,
  TranscriptSegment,
  VideoSummaryPayload,
  ChapterMarker,
} from '../src/types';
import { INITIAL_VIDEOS } from '../src/data/sampleVideos';

export interface StoredUserAccount extends UserAccount {
  passwordHash: string;
}

export class StateStore {
  private videos: VideoItem[] = [];
  private activeVideoId: string = '';
  private playbackTime: number = 0;

  // Global fallbacks / guest state
  private defaultGuestState: UserState = {
    user: null,
    watchHistory: [
      {
        videoId: 'vid-gemini-multimodal',
        watchedAt: Date.now() - 3600000,
        progressPercent: 42,
        lastTimestamp: 250,
      },
    ],
    likedVideoIds: ['vid-gemini-multimodal'],
    bookmarkedTimestamps: [],
    notes: [],
    customCategories: ['AI Systems', 'Next-Gen Video'],
    preferences: {
      playbackSpeed: 1.0,
      quality: 'Auto (1080p)',
      autoplayNext: true,
      theme: 'neon-dark',
      preferredLanguage: 'en',
    },
  };

  // User database & token store
  private users: Map<string, StoredUserAccount> = new Map();
  private userStates: Map<string, UserState> = new Map(); // userId -> UserState
  private sessions: Map<string, string> = new Map(); // token -> userId

  // Watch Party Collaboration Rooms
  private watchPartyRooms: Map<string, WatchPartyRoom> = new Map();

  // Chat histories per video
  private chatHistories: Map<string, ChatMessage[]> = new Map();

  constructor() {
    this.videos = [...INITIAL_VIDEOS];
    this.activeVideoId = this.videos[0]?.id || '';

    // Initialize default seed users
    this.seedInitialUsers();
    this.seedInitialRooms();
  }

  private seedInitialUsers() {
    const demoUsers: (StoredUserAccount & { initialWatched?: string })[] = [
      {
        id: 'usr-alex-vance',
        email: 'alex.vance@multimodal.ai',
        passwordHash: 'password123',
        name: 'Alex Vance',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        role: 'admin',
        badge: 'AI Architect',
        createdAt: Date.now() - 86400000 * 30,
        preferences: {
          playbackSpeed: 1.0,
          quality: '4K (2160p)',
          autoplayNext: true,
          theme: 'neon-dark',
          preferredLanguage: 'en',
        },
      },
      {
        id: 'usr-elena-rostova',
        email: 'elena@streamintel.io',
        passwordHash: 'stream2026',
        name: 'Elena Rostova',
        avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
        role: 'creator',
        badge: 'Lead Subtitler',
        createdAt: Date.now() - 86400000 * 14,
        preferences: {
          playbackSpeed: 1.25,
          quality: '1080p FHD',
          autoplayNext: true,
          theme: 'neon-dark',
          preferredLanguage: 'es',
        },
      },
    ];

    for (const u of demoUsers) {
      this.users.set(u.email.toLowerCase(), u);
      this.userStates.set(u.id, {
        user: {
          id: u.id,
          email: u.email,
          name: u.name,
          avatar: u.avatar,
          role: u.role,
          badge: u.badge,
          createdAt: u.createdAt,
          preferences: u.preferences,
        },
        watchHistory: [
          {
            videoId: 'vid-gemini-multimodal',
            watchedAt: Date.now() - 7200000,
            progressPercent: 68,
            lastTimestamp: 410,
          },
          {
            videoId: 'vid-realtime-transcription',
            watchedAt: Date.now() - 86400000,
            progressPercent: 100,
            lastTimestamp: 360,
          },
        ],
        likedVideoIds: ['vid-gemini-multimodal', 'vid-realtime-transcription'],
        bookmarkedTimestamps: [
          {
            id: 'bm-1',
            videoId: 'vid-gemini-multimodal',
            timestamp: 145,
            title: 'Multimodal Video Ingestion Architecture',
            note: 'Essential architecture diagram for zero-shot video indexing',
            createdAt: Date.now() - 3600000,
          },
        ],
        notes: [
          {
            id: 'note-1',
            videoId: 'vid-gemini-multimodal',
            timestamp: 210,
            text: 'Need to review benchmark latency comparison for live RTMP streams vs HLS chunks.',
            createdAt: Date.now() - 3600000,
          },
        ],
        customCategories: ['AI Systems', 'Video Intelligence', 'Deep Learning'],
        preferences: u.preferences,
      });
    }
  }

  private seedInitialRooms() {
    const defaultRoomId = 'STREAM-7890';
    const firstVideo = this.videos[0];
    this.watchPartyRooms.set(defaultRoomId, {
      roomId: defaultRoomId,
      name: 'Global AI Video Intelligence Sync',
      hostId: 'usr-alex-vance',
      hostName: 'Alex Vance',
      videoId: firstVideo?.id || 'vid-gemini-multimodal',
      videoTitle: firstVideo?.title || 'Gemini 2.5 Flash Multimodal Video Understanding & Realtime RAG',
      playbackState: {
        isPlaying: false,
        currentTime: 45,
        playbackSpeed: 1.0,
        lastUpdated: Date.now(),
        updatedBy: 'usr-alex-vance',
        updatedByName: 'Alex Vance',
      },
      participants: [
        {
          id: 'usr-alex-vance',
          name: 'Alex Vance (Host)',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          isHost: true,
          joinedAt: Date.now() - 1200000,
          lastPing: Date.now(),
        },
        {
          id: 'usr-elena-rostova',
          name: 'Elena Rostova',
          avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
          isHost: false,
          joinedAt: Date.now() - 600000,
          lastPing: Date.now(),
        },
      ],
      messages: [
        {
          id: 'msg-1',
          userId: 'usr-alex-vance',
          userName: 'Alex Vance',
          userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          text: 'Welcome to the synchronized viewing session! We are reviewing the new Gemini 2.5 video understanding benchmarks.',
          timestamp: Date.now() - 1100000,
          videoTimestamp: 10,
        },
        {
          id: 'msg-2',
          userId: 'usr-elena-rostova',
          userName: 'Elena Rostova',
          userAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
          text: 'The translation quality at 01:15 is remarkably crisp!',
          timestamp: Date.now() - 500000,
          videoTimestamp: 75,
        },
      ],
      reactions: [],
      timelineComments: [
        {
          id: 'tl-1',
          userId: 'usr-alex-vance',
          userName: 'Alex Vance',
          userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          timestamp: 45,
          text: 'Notice the visual embeddings pipeline diagram here.',
          createdAt: Date.now() - 800000,
          likes: 4,
        },
        {
          id: 'tl-2',
          userId: 'usr-elena-rostova',
          userName: 'Elena Rostova',
          userAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
          timestamp: 120,
          text: 'Sub-second chapter marker detection triggers right at this transition.',
          createdAt: Date.now() - 400000,
          likes: 6,
        },
      ],
      createdAt: Date.now() - 1200000,
    });
  }

  // Video Management
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

  public saveVideoTranslation(videoId: string, langCode: string, segments: TranscriptSegment[]) {
    const video = this.getVideoById(videoId);
    if (video) {
      if (!video.translations) video.translations = {};
      video.translations[langCode] = segments;
    }
  }

  public saveVideoSummary(videoId: string, summary: VideoSummaryPayload) {
    const video = this.getVideoById(videoId);
    if (video) {
      video.summaryData = summary;
      if (summary.takeaways && summary.takeaways.length > 0) {
        video.keyTakeaways = summary.takeaways;
      }
    }
  }

  public saveVideoChapters(videoId: string, chapters: ChapterMarker[]) {
    const video = this.getVideoById(videoId);
    if (video) {
      video.chapters = chapters;
    }
  }

  // Authentication & User State
  public registerUser(email: string, passwordHash: string, name: string, role: 'admin' | 'creator' | 'viewer' = 'viewer'): { user: UserAccount; token: string } {
    const normalizedEmail = email.toLowerCase().trim();
    if (this.users.has(normalizedEmail)) {
      throw new Error('An account with this email address already exists.');
    }

    const userId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;

    const newUser: StoredUserAccount = {
      id: userId,
      email: normalizedEmail,
      passwordHash,
      name,
      avatar,
      role,
      badge: role === 'creator' ? 'Verified Creator' : role === 'admin' ? 'Administrator' : 'Stream Pro',
      createdAt: Date.now(),
      preferences: {
        playbackSpeed: 1.0,
        quality: 'Auto (1080p)',
        autoplayNext: true,
        theme: 'neon-dark',
        preferredLanguage: 'en',
      },
    };

    this.users.set(normalizedEmail, newUser);

    // Initialize per-user state
    const userState: UserState = {
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        avatar: newUser.avatar,
        role: newUser.role,
        badge: newUser.badge,
        createdAt: newUser.createdAt,
        preferences: newUser.preferences,
      },
      watchHistory: [],
      likedVideoIds: [],
      bookmarkedTimestamps: [],
      notes: [],
      customCategories: ['Favorites', 'Watch Later'],
      preferences: newUser.preferences,
    };
    this.userStates.set(userId, userState);

    const token = `token-${userId}-${Date.now()}`;
    this.sessions.set(token, userId);

    return { user: userState.user!, token };
  }

  public loginUser(email: string, passwordHash: string): { user: UserAccount; token: string } {
    const normalizedEmail = email.toLowerCase().trim();
    const stored = this.users.get(normalizedEmail);
    if (!stored || stored.passwordHash !== passwordHash) {
      throw new Error('Invalid email or password credentials.');
    }

    const token = `token-${stored.id}-${Date.now()}`;
    this.sessions.set(token, stored.id);

    const userAccount: UserAccount = {
      id: stored.id,
      email: stored.email,
      name: stored.name,
      avatar: stored.avatar,
      role: stored.role,
      badge: stored.badge,
      createdAt: stored.createdAt,
      preferences: stored.preferences,
    };

    return { user: userAccount, token };
  }

  public getUserByToken(token: string): UserAccount | null {
    const userId = this.sessions.get(token);
    if (!userId) return null;
    for (const u of this.users.values()) {
      if (u.id === userId) {
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          avatar: u.avatar,
          role: u.role,
          badge: u.badge,
          createdAt: u.createdAt,
          preferences: u.preferences,
        };
      }
    }
    return null;
  }

  public logoutUser(token: string) {
    this.sessions.delete(token);
  }

  public getUserState(userId?: string): UserState {
    if (userId && this.userStates.has(userId)) {
      return this.userStates.get(userId)!;
    }
    return this.defaultGuestState;
  }

  public updateUserPreferences(userId: string | undefined, preferences: Partial<UserAccount['preferences']>) {
    const state = this.getUserState(userId);
    state.preferences = { ...state.preferences, ...preferences };
    if (state.user) {
      state.user.preferences = { ...state.user.preferences, ...preferences };
      const stored = this.users.get(state.user.email.toLowerCase());
      if (stored) stored.preferences = state.user.preferences;
    }
    return state.preferences;
  }

  public toggleLike(videoId: string, userId?: string): { isLiked: boolean; likesCount: number } {
    const video = this.getVideoById(videoId);
    const state = this.getUserState(userId);
    const likedSet = new Set(state.likedVideoIds);

    let isLiked = false;
    if (likedSet.has(videoId)) {
      likedSet.delete(videoId);
      if (video) video.likes = Math.max(0, video.likes - 1);
      isLiked = false;
    } else {
      likedSet.add(videoId);
      if (video) video.likes += 1;
      isLiked = true;
    }
    state.likedVideoIds = Array.from(likedSet);
    return { isLiked, likesCount: video?.likes || 0 };
  }

  public addBookmark(bookmark: BookmarkItem, userId?: string) {
    const state = this.getUserState(userId);
    state.bookmarkedTimestamps.unshift(bookmark);
    return bookmark;
  }

  public removeBookmark(id: string, userId?: string) {
    const state = this.getUserState(userId);
    state.bookmarkedTimestamps = state.bookmarkedTimestamps.filter((b) => b.id !== id);
  }

  public addOrUpdateNote(note: UserNote, userId?: string) {
    const state = this.getUserState(userId);
    const idx = state.notes.findIndex((n) => n.id === note.id);
    if (idx >= 0) {
      state.notes[idx] = { ...note, updatedAt: Date.now() };
    } else {
      state.notes.unshift({ ...note, createdAt: Date.now() });
    }
    return note;
  }

  public deleteNote(id: string, userId?: string) {
    const state = this.getUserState(userId);
    state.notes = state.notes.filter((n) => n.id !== id);
  }

  public updateWatchProgress(videoId: string, timestamp: number, duration: number, userId?: string) {
    this.playbackTime = timestamp;
    const state = this.getUserState(userId);
    const progressPercent = duration > 0 ? Math.min(100, Math.round((timestamp / duration) * 100)) : 0;
    const existingIdx = state.watchHistory.findIndex((w) => w.videoId === videoId);
    if (existingIdx >= 0) {
      state.watchHistory[existingIdx].watchedAt = Date.now();
      state.watchHistory[existingIdx].progressPercent = Math.max(state.watchHistory[existingIdx].progressPercent, progressPercent);
      state.watchHistory[existingIdx].lastTimestamp = timestamp;
    } else {
      state.watchHistory.unshift({
        videoId,
        watchedAt: Date.now(),
        progressPercent,
        lastTimestamp: timestamp,
      });
    }
  }

  // AI Chat Copilot History
  public getChatHistory(videoId: string): ChatMessage[] {
    if (!this.chatHistories.has(videoId)) {
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

  // ==========================================
  // Watch Party & Real-Time Collaboration
  // ==========================================
  public createWatchPartyRoom(
    user: { id: string; name: string; avatar: string },
    videoId: string,
    roomName?: string
  ): WatchPartyRoom {
    const video = this.getVideoById(videoId) || this.videos[0];
    const roomId = `PARTY-${Math.floor(1000 + Math.random() * 9000)}`;
    const room: WatchPartyRoom = {
      roomId,
      name: roomName || `${user.name}'s Watch Room`,
      hostId: user.id,
      hostName: user.name,
      videoId: video.id,
      videoTitle: video.title,
      playbackState: {
        isPlaying: false,
        currentTime: 0,
        playbackSpeed: 1.0,
        lastUpdated: Date.now(),
        updatedBy: user.id,
        updatedByName: user.name,
      },
      participants: [
        {
          id: user.id,
          name: `${user.name} (Host)`,
          avatar: user.avatar,
          isHost: true,
          joinedAt: Date.now(),
          lastPing: Date.now(),
        },
      ],
      messages: [
        {
          id: `msg-${Date.now()}`,
          userId: user.id,
          userName: user.name,
          userAvatar: user.avatar,
          text: `Created watch party room for "${video.title}"!`,
          timestamp: Date.now(),
        },
      ],
      reactions: [],
      timelineComments: [],
      createdAt: Date.now(),
    };

    this.watchPartyRooms.set(roomId, room);
    return room;
  }

  public getWatchPartyRoom(roomId: string): WatchPartyRoom | undefined {
    return this.watchPartyRooms.get(roomId.toUpperCase());
  }

  public getAllWatchPartyRooms(): WatchPartyRoom[] {
    return Array.from(this.watchPartyRooms.values());
  }

  public joinWatchPartyRoom(roomId: string, user: { id: string; name: string; avatar: string }): WatchPartyRoom {
    const room = this.getWatchPartyRoom(roomId);
    if (!room) {
      throw new Error(`Room with ID "${roomId}" not found.`);
    }

    const existing = room.participants.find((p) => p.id === user.id);
    if (existing) {
      existing.lastPing = Date.now();
      existing.name = user.name;
      existing.avatar = user.avatar;
    } else {
      room.participants.push({
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        isHost: false,
        joinedAt: Date.now(),
        lastPing: Date.now(),
      });

      room.messages.push({
        id: `join-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        userId: 'system',
        userName: 'System',
        userAvatar: '',
        text: `${user.name} joined the watch party! 🎉`,
        timestamp: Date.now(),
      });
    }

    return room;
  }

  public leaveWatchPartyRoom(roomId: string, userId: string) {
    const room = this.getWatchPartyRoom(roomId);
    if (!room) return;
    room.participants = room.participants.filter((p) => p.id !== userId);
  }

  public updateRoomPlaybackState(
    roomId: string,
    isPlaying: boolean,
    currentTime: number,
    playbackSpeed: number,
    user: { id: string; name: string }
  ): WatchPartyRoom {
    const room = this.getWatchPartyRoom(roomId);
    if (!room) throw new Error('Room not found');

    room.playbackState = {
      isPlaying,
      currentTime,
      playbackSpeed: playbackSpeed || 1.0,
      lastUpdated: Date.now(),
      updatedBy: user.id,
      updatedByName: user.name,
    };

    return room;
  }

  public addRoomMessage(roomId: string, message: PartyChatMessage): WatchPartyRoom {
    const room = this.getWatchPartyRoom(roomId);
    if (!room) throw new Error('Room not found');
    room.messages.push(message);
    if (room.messages.length > 100) room.messages.shift();
    return room;
  }

  public addRoomReaction(roomId: string, reaction: PartyReaction): WatchPartyRoom {
    const room = this.getWatchPartyRoom(roomId);
    if (!room) throw new Error('Room not found');
    room.reactions.push(reaction);
    // Keep last 30 reactions
    if (room.reactions.length > 30) room.reactions.shift();
    return room;
  }

  public addRoomTimelineComment(roomId: string, comment: PartyTimelineComment): WatchPartyRoom {
    const room = this.getWatchPartyRoom(roomId);
    if (!room) throw new Error('Room not found');
    room.timelineComments.push(comment);
    return room;
  }
}
