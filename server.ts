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

  // 3. Multimodal Video Intelligence Ingestion
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

  // 4. Hybrid Vector & Lexical Search
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

  // 5. Dynamic Personalized Recommendations
  app.get('/api/recommendations', (req, res) => {
    try {
      const currentVideoId = (req.query.videoId as string) || stateStore.getActiveVideoId();
      const state = stateStore.getSessionState();

      const rails = recEngine.getRecommendations(
        stateStore.getVideos(),
        currentVideoId,
        state.watchHistory,
        state.likedVideoIds,
        state.bookmarkedVideoIds
      );

      res.json({ success: true, rails });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Recommendations failed' });
    }
  });

  // 6. Grounded Video Q&A Assistant
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

      // Add user message to history
      const userMsg = {
        id: `user-${Date.now()}`,
        role: 'user' as const,
        content: message,
        timestamp: Date.now(),
      };
      stateStore.addChatMessage(videoId, userMsg);

      const history = stateStore.getChatHistory(videoId);

      // Query Gemini
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

  // 7. Audio Transcription
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

  // 8. Session State & Action Dispatcher
  app.get('/api/state', (req, res) => {
    res.json({ success: true, state: stateStore.getSessionState() });
  });

  app.post('/api/state/action', (req, res) => {
    try {
      const { action, payload } = req.body;
      let result: any = null;

      switch (action) {
        case 'SET_ACTIVE_VIDEO':
          stateStore.setActiveVideoId(payload.videoId);
          result = { activeVideoId: stateStore.getActiveVideoId() };
          break;

        case 'TOGGLE_LIKE':
          result = stateStore.toggleLike(payload.videoId);
          break;

        case 'TOGGLE_BOOKMARK':
          result = { isBookmarked: stateStore.toggleBookmark(payload.videoId) };
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
          result = stateStore.addBookmark(newBookmark);
          break;

        case 'REMOVE_BOOKMARK':
          stateStore.removeBookmark(payload.id);
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
          result = stateStore.addOrUpdateNote(note);
          break;

        case 'DELETE_NOTE':
          stateStore.deleteNote(payload.id);
          result = { deletedId: payload.id };
          break;

        case 'UPDATE_WATCH_PROGRESS':
          stateStore.updateWatchProgress(payload.videoId, payload.timestamp, payload.duration);
          result = { updated: true, timestamp: payload.timestamp };
          break;

        default:
          return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
      }

      res.json({
        success: true,
        action,
        result,
        state: stateStore.getSessionState(),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Action dispatch error' });
    }
  });

  // 9. Cache Controls
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
