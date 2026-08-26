import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { StateStore } from './server/stateStore';
import { InMemoryVectorStore } from './server/vectorStore';
import { RecommendationEngine } from './server/recommendationEngine';
import { LRUCacheService } from './server/cacheService';
import {
  analyzeVideoContent,
  generateGroundedVideoAnswer,
  transcribeAudioStream,
  generateVideoSummary,
  translateTranscript,
  detectTopicShiftsAndChapters,
} from './server/geminiService';
import { VideoItem, BookmarkItem, UserNote } from './src/types';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Initialize Core Services
  const stateStore = new StateStore();
  const vectorStore = new InMemoryVectorStore(stateStore.getVideos());
  const recEngine = new RecommendationEngine();
  const cacheService = new LRUCacheService(1000);

  console.log(`[StreamIntel Studio] Initialized with ${stateStore.getVideos().length} pre-indexed videos.`);

  // Helper middleware for auth token extraction
  const getAuthUser = (req: express.Request) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      return stateStore.getUserByToken(token);
    }
    return null;
  };

  // -------------------------------------------------------------
  // API ROUTES
  // -------------------------------------------------------------

  // 1. Health & Status
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'online',
      system: 'StreamIntel Video Intelligence Backend',
      geminiConfigured: !!process.env.GEMINI_API_KEY,
      indexedVideosCount: stateStore.getVideos().length,
      cacheStats: cacheService.getStats(),
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Video Catalog
  app.get('/api/videos', (req, res) => {
    const videos = stateStore.getVideos();
    res.json({ success: true, videos });
  });

  app.get('/api/videos/:id', (req, res) => {
    const video = stateStore.getVideoById(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }
    res.json({ success: true, video });
  });

  // 3. AI-Powered Video Summarization
  app.post('/api/videos/:id/summarize', async (req, res) => {
    try {
      const video = stateStore.getVideoById(req.params.id);
      if (!video) {
        return res.status(404).json({ success: false, error: 'Video not found' });
      }

      const complexity = (req.body.complexity as 'Executive' | 'Standard' | 'Deep Dive') || 'Standard';
      const cacheKey = `summary:${video.id}:${complexity}`;
      let summary = cacheService.get<any>(cacheKey);

      if (!summary) {
        console.log(`[StreamIntel API] Generating AI summary for "${video.title}" with complexity "${complexity}"...`);
        summary = await generateVideoSummary(video, complexity);
        cacheService.set(cacheKey, summary, 7200);
      }

      stateStore.saveVideoSummary(video.id, summary);

      res.json({
        success: true,
        videoId: video.id,
        summary,
      });
    } catch (error: any) {
      console.error('[StreamIntel API] Summarization failed:', error);
      res.status(500).json({ success: false, error: error?.message || 'Failed to generate video summary' });
    }
  });

  // 4. Real-time Transcript Translation
  app.post('/api/videos/:id/translate', async (req, res) => {
    try {
      const video = stateStore.getVideoById(req.params.id);
      if (!video) {
        return res.status(404).json({ success: false, error: 'Video not found' });
      }

      const { targetLanguageCode, targetLanguageName } = req.body;
      if (!targetLanguageCode || !targetLanguageName) {
        return res.status(400).json({ success: false, error: 'targetLanguageCode and targetLanguageName are required' });
      }

      // Check if already stored or cached
      if (video.translations && video.translations[targetLanguageCode]) {
        return res.json({
          success: true,
          videoId: video.id,
          languageCode: targetLanguageCode,
          languageName: targetLanguageName,
          segments: video.translations[targetLanguageCode],
          cached: true,
        });
      }

      const cacheKey = `trans:${video.id}:${targetLanguageCode}`;
      let segments = cacheService.get<any>(cacheKey);

      if (!segments) {
        console.log(`[StreamIntel API] Translating transcript for "${video.title}" into ${targetLanguageName}...`);
        segments = await translateTranscript(video.transcript || [], targetLanguageCode, targetLanguageName);
        cacheService.set(cacheKey, segments, 14400);
      }

      stateStore.saveVideoTranslation(video.id, targetLanguageCode, segments);

      res.json({
        success: true,
        videoId: video.id,
        languageCode: targetLanguageCode,
        languageName: targetLanguageName,
        segments,
      });
    } catch (error: any) {
      console.error('[StreamIntel API] Translation failed:', error);
      res.status(500).json({ success: false, error: error?.message || 'Failed to translate transcript' });
    }
  });

  // 5. Topic Shifts & Scene Chapters Detection
  app.post('/api/videos/:id/detect-chapters', async (req, res) => {
    try {
      const video = stateStore.getVideoById(req.params.id);
      if (!video) {
        return res.status(404).json({ success: false, error: 'Video not found' });
      }

      const sensitivity = (req.body.sensitivity as 'high' | 'medium' | 'standard') || 'medium';
      console.log(`[StreamIntel API] Detecting topic shifts and chapters for "${video.title}" (sensitivity: ${sensitivity})...`);

      const chapters = await detectTopicShiftsAndChapters(
        video.title,
        video.duration || 300,
        video.transcript || [],
        sensitivity
      );

      stateStore.saveVideoChapters(video.id, chapters);

      res.json({
        success: true,
        videoId: video.id,
        chapters,
      });
    } catch (error: any) {
      console.error('[StreamIntel API] Chapter detection failed:', error);
      res.status(500).json({ success: false, error: error?.message || 'Failed to detect chapters' });
    }
  });

  // 6. Multimodal Video Intelligence Ingestion
  app.post('/api/videos/analyze', async (req, res) => {
    try {
      const { title, description, url, duration, transcriptText, uploadedVideoBase64, mimeType, category } = req.body;

      if (!title) {
        return res.status(400).json({ success: false, error: 'Title is required' });
      }

      const cacheKey = `analysis:${title}:${(transcriptText || '').slice(0, 100)}`;
      let analysisResult = cacheService.get<any>(cacheKey);

      if (!analysisResult) {
        console.log(`[StreamIntel API] Triggering Gemini multimodal analysis for "${title}"...`);
        analysisResult = await analyzeVideoContent(
          title,
          description || 'Custom ingested video stream for analysis',
          transcriptText,
          duration || 300,
          uploadedVideoBase64,
          mimeType || 'video/mp4'
        );
        cacheService.set(cacheKey, analysisResult, 7200);
      } else {
        console.log(`[StreamIntel API] Retrieved cached analysis for "${title}".`);
      }

      const newId = `vid-custom-${Date.now()}`;
      const newVideo: VideoItem = {
        id: newId,
        title,
        description: analysisResult.summary || description || 'AI-analyzed video stream',
        url: url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        streamType: uploadedVideoBase64 ? 'uploaded' : url?.includes('m3u8') ? 'hls' : url?.includes('youtube') ? 'youtube' : 'mp4',
        duration: duration || 300,
        thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
        author: 'User Stream Ingest',
        authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
        publishedAt: new Date().toISOString().split('T')[0],
        views: 1,
        likes: 0,
        category: category || analysisResult.category || 'AI & Machine Learning',
        tags: analysisResult.tags || ['Custom Video', 'AI Index'],
        chapters: analysisResult.chapters || [],
        transcript: analysisResult.transcript || [],
        keyTakeaways: analysisResult.keyTakeaways || [],
        topicAffinities: analysisResult.topicAffinities || [{ topic: 'Custom Media', weight: 1.0 }],
        visualScenes: analysisResult.visualScenes || [],
        aiGeneratedClips: analysisResult.aiGeneratedClips || [],
        summaryData: {
          overview: analysisResult.summary || `Cohesive analysis of ${title}.`,
          keyTopics: [
            { topic: 'Overview', timestamp: 0, description: 'Foundational introduction.' },
            { topic: 'Core Demonstration', timestamp: Math.floor((duration || 300) * 0.4), description: 'Deep architectural walkthrough.' },
          ],
          keyEvents: [
            { timestamp: 0, title: 'Introduction', eventDescription: 'Opening remarks', importance: 'normal' },
            { timestamp: Math.floor((duration || 300) * 0.5), title: 'Key Demonstration', eventDescription: 'Core technical walkthrough', importance: 'high' },
          ],
          takeaways: analysisResult.keyTakeaways || ['High-performance temporal understanding.'],
          readingTimeMinutes: 2,
          complexityLevel: 'Standard',
          generatedAt: Date.now(),
        },
        specs: {
          resolution: '1920x1080 (HD)',
          codec: 'H.264 / AAC',
          bitrate: '8.0 Mbps',
          aspectRatio: '16:9',
        },
      };

      stateStore.addVideo(newVideo);
      vectorStore.addOrUpdateVideo(newVideo);
      stateStore.setActiveVideoId(newId);

      res.json({ success: true, video: newVideo });
    } catch (error: any) {
      console.error('[StreamIntel API] Video analyze failed:', error);
      res.status(500).json({ success: false, error: error?.message || 'Failed to analyze video' });
    }
  });

  // 7. Hybrid Vector & Lexical Search
  app.get('/api/search', (req, res) => {
    try {
      const q = (req.query.q as string) || '';
      const category = (req.query.category as string) || 'All';
      const limit = parseInt((req.query.limit as string) || '10', 10);

      const cacheKey = `search:${q}:${category}:${limit}`;
      let results = cacheService.get<any>(cacheKey);

      if (!results) {
        results = vectorStore.search(q, category, limit);
        cacheService.set(cacheKey, results, 300);
      }

      res.json({ success: true, query: q, category, results });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Search failed' });
    }
  });

  // 8. Dynamic Recommendations
  app.get('/api/recommendations', (req, res) => {
    try {
      const currentVideoId = (req.query.videoId as string) || stateStore.getActiveVideoId();
      const authUser = getAuthUser(req);
      const userState = stateStore.getUserState(authUser?.id);

      const rails = recEngine.getRecommendations(
        stateStore.getVideos(),
        currentVideoId,
        userState.watchHistory,
        userState.likedVideoIds,
        userState.bookmarkedTimestamps.map((b) => b.videoId)
      );

      res.json({ success: true, rails });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Recommendations failed' });
    }
  });

  // 9. Grounded Video Q&A Assistant
  app.get('/api/chat/:videoId', (req, res) => {
    const history = stateStore.getChatHistory(req.params.videoId);
    res.json({ success: true, history });
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const { videoId, message, currentPlaybackTime, useThinkingHigh, useSearchGrounding } = req.body;
      const video = stateStore.getVideoById(videoId);

      if (!video) {
        return res.status(404).json({ success: false, error: 'Target video not found' });
      }

      if (!message || message.trim().length === 0) {
        return res.status(400).json({ success: false, error: 'Message cannot be empty' });
      }

      const userMsg = {
        id: `user-${Date.now()}`,
        role: 'user' as const,
        content: message,
        timestamp: Date.now(),
      };
      stateStore.addChatMessage(videoId, userMsg);

      const history = stateStore.getChatHistory(videoId);

      const response = await generateGroundedVideoAnswer({
        message,
        chatHistory: history,
        video,
        currentPlaybackTime: currentPlaybackTime || 0,
        useThinkingHigh: !!useThinkingHigh,
        useSearchGrounding: !!useSearchGrounding,
      });

      const assistantMsg = {
        id: `assistant-${Date.now()}`,
        role: 'assistant' as const,
        content: response.content,
        timestamp: Date.now(),
        citations: response.citations,
        groundedWebUrls: response.groundedWebUrls,
        modelUsed: response.modelUsed,
      };

      stateStore.addChatMessage(videoId, assistantMsg);

      res.json({
        success: true,
        message: assistantMsg,
        history: stateStore.getChatHistory(videoId),
      });
    } catch (error: any) {
      console.error('[StreamIntel API] Chat generation failed:', error);
      res.status(500).json({ success: false, error: error?.message || 'Chat assistant error' });
    }
  });

  app.delete('/api/chat/:videoId', (req, res) => {
    stateStore.clearChatHistory(req.params.videoId);
    res.json({ success: true, history: stateStore.getChatHistory(req.params.videoId) });
  });

  // 10. Audio Transcription & Speech-to-Text
  app.post('/api/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ success: false, error: 'Audio data is required' });
      }

      const result = await transcribeAudioStream(audioBase64, mimeType);
      res.json({ success: true, transcription: result.text, confidence: result.confidence });
    } catch (error: any) {
      console.error('[StreamIntel API] Audio transcribe error:', error);
      res.status(500).json({ success: false, error: error?.message || 'Audio transcription failed' });
    }
  });

  // 11. User Authentication System
  app.post('/api/auth/signup', (req, res) => {
    try {
      const { email, password, name, role } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ success: false, error: 'Email, password, and name are required' });
      }

      const { user, token } = stateStore.registerUser(email, password, name, role || 'viewer');
      res.json({
        success: true,
        user,
        token,
        state: stateStore.getUserState(user.id),
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || 'Signup failed' });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required' });
      }

      const { user, token } = stateStore.loginUser(email, password);
      res.json({
        success: true,
        user,
        token,
        state: stateStore.getUserState(user.id),
      });
    } catch (error: any) {
      res.status(401).json({ success: false, error: error.message || 'Login failed' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      stateStore.logoutUser(authHeader.substring(7));
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });

  app.get('/api/auth/me', (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      return res.json({ success: true, user: null, state: stateStore.getUserState() });
    }
    res.json({
      success: true,
      user,
      state: stateStore.getUserState(user.id),
    });
  });

  app.post('/api/user/preferences', (req, res) => {
    const user = getAuthUser(req);
    const updated = stateStore.updateUserPreferences(user?.id, req.body.preferences || {});
    res.json({ success: true, preferences: updated });
  });

  // 12. User Actions Dispatcher (Watch progress, bookmarks, notes, likes)
  app.get('/api/state', (req, res) => {
    const authUser = getAuthUser(req);
    res.json({ success: true, state: stateStore.getUserState(authUser?.id) });
  });

  app.post('/api/state/action', (req, res) => {
    try {
      const authUser = getAuthUser(req);
      const userId = authUser?.id;
      const { action, payload } = req.body;
      let result: any = null;

      switch (action) {
        case 'SET_ACTIVE_VIDEO':
          stateStore.setActiveVideoId(payload.videoId);
          result = { activeVideoId: stateStore.getActiveVideoId() };
          break;

        case 'TOGGLE_LIKE':
          result = stateStore.toggleLike(payload.videoId, userId);
          break;

        case 'ADD_BOOKMARK':
          const newBookmark: BookmarkItem = {
            id: `bm-${Date.now()}`,
            videoId: payload.videoId,
            timestamp: payload.timestamp || 0,
            title: payload.title || `Bookmark at ${Math.round(payload.timestamp || 0)}s`,
            note: payload.note || '',
            createdAt: Date.now(),
          };
          result = stateStore.addBookmark(newBookmark, userId);
          break;

        case 'REMOVE_BOOKMARK':
          stateStore.removeBookmark(payload.id, userId);
          result = { removedId: payload.id };
          break;

        case 'SAVE_NOTE':
          const note: UserNote = {
            id: payload.id || `note-${Date.now()}`,
            videoId: payload.videoId,
            timestamp: payload.timestamp || 0,
            text: payload.text,
            updatedAt: Date.now(),
          };
          result = stateStore.addOrUpdateNote(note, userId);
          break;

        case 'DELETE_NOTE':
          stateStore.deleteNote(payload.id, userId);
          result = { deletedId: payload.id };
          break;

        case 'UPDATE_WATCH_PROGRESS':
          stateStore.updateWatchProgress(payload.videoId, payload.timestamp, payload.duration, userId);
          result = { updated: true, timestamp: payload.timestamp };
          break;

        default:
          return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
      }

      res.json({
        success: true,
        action,
        result,
        state: stateStore.getUserState(userId),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Action dispatch error' });
    }
  });

  // 13. Real-Time Watch Party & Collaboration
  app.get('/api/rooms', (req, res) => {
    res.json({ success: true, rooms: stateStore.getAllWatchPartyRooms() });
  });

  app.post('/api/rooms/create', (req, res) => {
    try {
      const authUser = getAuthUser(req);
      const user = authUser
        ? { id: authUser.id, name: authUser.name, avatar: authUser.avatar }
        : {
            id: req.body.userId || `guest-${Date.now()}`,
            name: req.body.userName || 'Guest Host',
            avatar: req.body.userAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Guest',
          };

      const { videoId, roomName } = req.body;
      const room = stateStore.createWatchPartyRoom(user, videoId, roomName);
      res.json({ success: true, room });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to create watch party room' });
    }
  });

  app.get('/api/rooms/:roomId', (req, res) => {
    const room = stateStore.getWatchPartyRoom(req.params.roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    res.json({ success: true, room });
  });

  app.post('/api/rooms/:roomId/join', (req, res) => {
    try {
      const authUser = getAuthUser(req);
      const user = authUser
        ? { id: authUser.id, name: authUser.name, avatar: authUser.avatar }
        : {
            id: req.body.userId || `guest-${Date.now()}`,
            name: req.body.userName || 'Guest Viewer',
            avatar: req.body.userAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.body.userName || 'Guest'}`,
          };

      const room = stateStore.joinWatchPartyRoom(req.params.roomId, user);
      res.json({ success: true, room });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || 'Failed to join room' });
    }
  });

  app.post('/api/rooms/:roomId/leave', (req, res) => {
    const authUser = getAuthUser(req);
    const userId = authUser?.id || req.body.userId;
    if (userId) {
      stateStore.leaveWatchPartyRoom(req.params.roomId, userId);
    }
    res.json({ success: true, message: 'Left room' });
  });

  app.post('/api/rooms/:roomId/sync-playback', (req, res) => {
    try {
      const authUser = getAuthUser(req);
      const user = authUser
        ? { id: authUser.id, name: authUser.name }
        : { id: req.body.userId || 'guest', name: req.body.userName || 'Guest' };

      const { isPlaying, currentTime, playbackSpeed } = req.body;
      const room = stateStore.updateRoomPlaybackState(
        req.params.roomId,
        !!isPlaying,
        typeof currentTime === 'number' ? currentTime : 0,
        playbackSpeed || 1.0,
        user
      );

      res.json({ success: true, playbackState: room.playbackState });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/rooms/:roomId/message', (req, res) => {
    try {
      const authUser = getAuthUser(req);
      const message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        userId: authUser?.id || req.body.userId || 'guest',
        userName: authUser?.name || req.body.userName || 'Guest',
        userAvatar: authUser?.avatar || req.body.userAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Guest',
        text: req.body.text,
        timestamp: Date.now(),
        videoTimestamp: req.body.videoTimestamp,
      };

      const room = stateStore.addRoomMessage(req.params.roomId, message);
      res.json({ success: true, messages: room.messages, newMessage: message });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/rooms/:roomId/reaction', (req, res) => {
    try {
      const authUser = getAuthUser(req);
      const reaction = {
        id: `react-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        userId: authUser?.id || req.body.userId || 'guest',
        userName: authUser?.name || req.body.userName || 'Guest',
        emoji: req.body.emoji || '🔥',
        timestamp: Date.now(),
        x: typeof req.body.x === 'number' ? req.body.x : Math.floor(15 + Math.random() * 70),
      };

      const room = stateStore.addRoomReaction(req.params.roomId, reaction);
      res.json({ success: true, reaction, reactions: room.reactions });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/rooms/:roomId/comment', (req, res) => {
    try {
      const authUser = getAuthUser(req);
      const comment = {
        id: `tl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        userId: authUser?.id || req.body.userId || 'guest',
        userName: authUser?.name || req.body.userName || 'Guest',
        userAvatar: authUser?.avatar || req.body.userAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Guest',
        timestamp: req.body.timestamp || 0,
        text: req.body.text,
        createdAt: Date.now(),
        likes: 0,
      };

      const room = stateStore.addRoomTimelineComment(req.params.roomId, comment);
      res.json({ success: true, comment, timelineComments: room.timelineComments });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // 14. Cache Controls
  app.get('/api/cache/stats', (req, res) => {
    res.json({ success: true, stats: cacheService.getStats() });
  });

  app.post('/api/cache/clear', (req, res) => {
    cacheService.clear();
    res.json({ success: true, message: 'Cache successfully cleared', stats: cacheService.getStats() });
  });

  // -------------------------------------------------------------
  // VITE MIDDLEWARE / PRODUCTION SERVING
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[StreamIntel Studio] Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
