import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { VideoPlayer } from './components/VideoPlayer';
import { VideoIntelligenceTabs } from './components/VideoIntelligenceTabs';
import { VideoCopilotChat } from './components/VideoCopilotChat';
import { RecommendationRails } from './components/RecommendationRails';
import { MultimodalIngestModal } from './components/MultimodalIngestModal';
import { VoiceQueryModal } from './components/VoiceQueryModal';
import { CacheTelemetryModal } from './components/CacheTelemetryModal';
import { ClipExtractorModal } from './components/ClipExtractorModal';
import { AuthModal } from './components/AuthModal';
import { WatchPartyModal } from './components/WatchPartyModal';
import { P2PEngineDashboard } from './components/P2PEngineDashboard';
import {
  VideoItem,
  UserState,
  RecommendationRail,
  AIClip,
  UserAccount,
  WatchPartyRoom,
  PartyReaction,
} from './types';

export default function App() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [seekToTime, setSeekToTime] = useState<number | null>(null);
  const [userState, setUserState] = useState<UserState>({
    watchHistory: [],
    likedVideoIds: [],
    bookmarkedTimestamps: [],
    notes: [],
    customCategories: [],
    preferences: { playbackSpeed: 1.0, quality: 'Auto', autoplayNext: true, theme: 'dark' },
  });
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [rails, setRails] = useState<RecommendationRail[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [theaterMode, setTheaterMode] = useState<boolean>(false);

  // Watch Party & Real-Time Collaboration State
  const [activeWatchRoom, setActiveWatchRoom] = useState<WatchPartyRoom | null>(null);
  const [floatingReactions, setFloatingReactions] = useState<PartyReaction[]>([]);
  const lastSyncTimestampRef = useRef<number>(0);

  // Modals state
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [isVoiceQueryOpen, setIsVoiceQueryOpen] = useState(false);
  const [isCacheStatsOpen, setIsCacheStatsOpen] = useState(false);
  const [isClipExtractorOpen, setIsClipExtractorOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isWatchPartyOpen, setIsWatchPartyOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Initial Data Fetch & Auth Check
  useEffect(() => {
    const initApp = async () => {
      try {
        setIsLoading(true);

        // Check Auth token
        const token = localStorage.getItem('streamintel_auth_token');
        if (token) {
          try {
            const authRes = await fetch('/api/auth/me', {
              headers: { Authorization: `Bearer ${token}` },
            });
            const authData = await authRes.json();
            if (authData.success && authData.user) {
              setCurrentUser(authData.user);
            }
          } catch (e) {
            console.error('Auth verification error:', e);
          }
        }

        // Fetch videos
        const vRes = await fetch('/api/videos');
        const vData = await vRes.json();

        // Fetch user state
        const sRes = await fetch('/api/state', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const sData = await sRes.json();

        if (vData.success && vData.videos && vData.videos.length > 0) {
          setVideos(vData.videos);

          // Check if URL has ?v= parameter
          const urlParams = new URLSearchParams(window.location.search);
          const paramVideoId = urlParams.get('v');
          const paramTime = urlParams.get('t');

          const initialVid =
            (paramVideoId && vData.videos.find((v: VideoItem) => v.id === paramVideoId)) ||
            vData.videos[0];
          setActiveVideo(initialVid);

          if (paramTime) {
            setSeekToTime(Number(paramTime));
          }
        }

        if (sData.success && sData.state) {
          setUserState(sData.state);
        }
      } catch (err) {
        console.error('Initial data load error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    initApp();
  }, []);

  // 2. Fetch recommendations whenever active video changes
  useEffect(() => {
    if (!activeVideo) return;

    const fetchRecs = async () => {
      try {
        const res = await fetch(
          `/api/recommendations?videoId=${encodeURIComponent(activeVideo.id)}`
        );
        const data = await res.json();
        if (data.success && data.rails) {
          setRails(data.rails);
        }
      } catch (err) {
        console.error('Failed to fetch recommendations:', err);
      }
    };

    fetchRecs();

    // Record watch history
    const token = localStorage.getItem('streamintel_auth_token');
    fetch('/api/history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        videoId: activeVideo.id,
        progressSeconds: 0,
      }),
    }).catch(() => {});
  }, [activeVideo?.id]);

  // 3. Real-time Watch Party synchronization loop
  useEffect(() => {
    if (!activeWatchRoom) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${activeWatchRoom.roomId}`);
        const data = await res.json();
        if (data.success && data.room) {
          setActiveWatchRoom(data.room);

          // Collect new floating reactions
          if (data.room.reactions && data.room.reactions.length > 0) {
            const recent = data.room.reactions.filter(
              (r: PartyReaction) => Date.now() - r.timestamp < 3500
            );
            setFloatingReactions(recent);
          }

          // If room video is different from current active video, sync it
          if (activeVideo && data.room.videoId !== activeVideo.id) {
            const targetVid = videos.find((v) => v.id === data.room.videoId);
            if (targetVid) {
              setActiveVideo(targetVid);
            }
          }

          // If time drift is large (> 3 seconds), sync playback time
          if (
            data.room.playbackState &&
            Math.abs(data.room.playbackState.currentTime - currentTime) > 3.5
          ) {
            setSeekToTime(data.room.playbackState.currentTime);
          }
        }
      } catch (e) {
        console.error('Watch party sync error:', e);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeWatchRoom?.roomId, activeVideo?.id, currentTime, videos]);

  // Handle Video Selection
  const handleSelectVideo = useCallback(
    (video: VideoItem, initialSeekTime?: number) => {
      setActiveVideo(video);
      setCurrentTime(initialSeekTime || 0);
      if (initialSeekTime !== undefined) {
        setSeekToTime(initialSeekTime);
      } else {
        setSeekToTime(0);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // If active in a watch party, update the room video
      if (activeWatchRoom) {
        fetch(`/api/rooms/${activeWatchRoom.roomId}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentTime: initialSeekTime || 0,
            isPlaying: true,
          }),
        }).catch(() => {});
      }
    },
    [activeWatchRoom]
  );

  // Seek handler from transcript/chapters
  const handleSeek = (time: number) => {
    setSeekToTime(time);
    if (activeWatchRoom) {
      fetch(`/api/rooms/${activeWatchRoom.roomId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentTime: time,
          isPlaying: true,
        }),
      }).catch(() => {});
    }
  };

  // Playback state change from player
  const handlePlaybackStateChange = (isPlaying: boolean, currentSec: number) => {
    if (!activeWatchRoom) return;
    const now = Date.now();
    if (now - lastSyncTimestampRef.current > 1000) {
      lastSyncTimestampRef.current = now;
      fetch(`/api/rooms/${activeWatchRoom.roomId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentTime: Math.round(currentSec),
          isPlaying,
        }),
      }).catch(() => {});
    }
  };

  // Send Live Party Reaction
  const handleSendPartyReaction = async (emoji: string) => {
    if (!activeWatchRoom) return;
    try {
      const token = localStorage.getItem('streamintel_auth_token');
      await fetch(`/api/rooms/${activeWatchRoom.roomId}/reaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          emoji,
          userName: currentUser?.name || 'Viewer',
        }),
      });

      // Optimistically add to floating reactions
      const newReact: PartyReaction = {
        id: `react_${Date.now()}_${Math.random()}`,
        userId: currentUser?.id || 'viewer',
        userName: currentUser?.name || 'Viewer',
        emoji,
        timestamp: Date.now(),
        x: Math.floor(Math.random() * 80) + 10,
      };
      setFloatingReactions((prev) => [...prev, newReact]);
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle Like
  const handleToggleLike = async () => {
    if (!activeVideo) return;
    try {
      const token = localStorage.getItem('streamintel_auth_token');
      const res = await fetch(`/api/like/${activeVideo.id}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setUserState((prev) => ({
          ...prev,
          likedVideoIds: data.isLiked
            ? [...prev.likedVideoIds, activeVideo.id]
            : prev.likedVideoIds.filter((id) => id !== activeVideo.id),
        }));
        setActiveVideo((prev) =>
          prev ? { ...prev, likes: prev.likes + (data.isLiked ? 1 : -1) } : null
        );
      }
    } catch (err) {
      console.error('Toggle like failed:', err);
    }
  };

  // Toggle Video Bookmark
  const handleToggleBookmark = () => {
    if (!activeVideo) return;
    const isCurrentlySaved = userState.bookmarkedTimestamps.some(
      (b) => b.videoId === activeVideo.id
    );
    if (isCurrentlySaved) {
      const bm = userState.bookmarkedTimestamps.find((b) => b.videoId === activeVideo.id);
      if (bm) handleDeleteBookmark(bm.id);
    } else {
      handleAddBookmarkAtTime(currentTime);
    }
  };

  // Add Bookmark at Time
  const handleAddBookmarkAtTime = async (timestamp: number) => {
    if (!activeVideo) return;
    try {
      const token = localStorage.getItem('streamintel_auth_token');
      const res = await fetch('/api/bookmark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          videoId: activeVideo.id,
          timestamp,
          title: `Saved moment at ${formatTime(timestamp)}`,
        }),
      });
      const data = await res.json();
      if (data.success && data.bookmark) {
        setUserState((prev) => ({
          ...prev,
          bookmarkedTimestamps: [data.bookmark, ...prev.bookmarkedTimestamps],
        }));
      }
    } catch (err) {
      console.error('Bookmark error:', err);
    }
  };

  // Delete Bookmark
  const handleDeleteBookmark = async (id: string) => {
    try {
      const token = localStorage.getItem('streamintel_auth_token');
      const res = await fetch(`/api/bookmark/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setUserState((prev) => ({
          ...prev,
          bookmarkedTimestamps: prev.bookmarkedTimestamps.filter((b) => b.id !== id),
        }));
      }
    } catch (err) {
      console.error('Delete bookmark failed:', err);
    }
  };

  // Add User Note
  const handleAddNote = async (text: string, timestamp: number) => {
    if (!activeVideo) return;
    try {
      const token = localStorage.getItem('streamintel_auth_token');
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          videoId: activeVideo.id,
          text,
          timestamp,
        }),
      });
      const data = await res.json();
      if (data.success && data.note) {
        setUserState((prev) => ({
          ...prev,
          notes: [data.note, ...prev.notes],
        }));
      }
    } catch (err) {
      console.error('Add note error:', err);
    }
  };

  // Delete User Note
  const handleDeleteNote = async (id: string) => {
    try {
      const token = localStorage.getItem('streamintel_auth_token');
      const res = await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setUserState((prev) => ({
          ...prev,
          notes: prev.notes.filter((n) => n.id !== id),
        }));
      }
    } catch (err) {
      console.error('Delete note failed:', err);
    }
  };

  // On new video ingested
  const handleVideoIngested = (newVideo: VideoItem) => {
    setVideos((prev) => [newVideo, ...prev]);
    setActiveVideo(newVideo);
    setCurrentTime(0);
    setSeekToTime(0);
  };

  // On video updated (e.g. from translation, summary, chapter shifts)
  const handleVideoUpdated = (updatedVideo: VideoItem) => {
    setActiveVideo(updatedVideo);
    setVideos((prev) => prev.map((v) => (v.id === updatedVideo.id ? updatedVideo : v)));
  };

  // On AI clip created
  const handleClipCreated = (clip: AIClip) => {
    if (!activeVideo) return;
    const updatedClips = [...(activeVideo.aiGeneratedClips || []), clip];
    const updatedVideo = { ...activeVideo, aiGeneratedClips: updatedClips };
    handleVideoUpdated(updatedVideo);
  };

  // Check if active video is liked/bookmarked
  const isCurrentVideoLiked = activeVideo
    ? userState.likedVideoIds.includes(activeVideo.id)
    : false;
  const isCurrentVideoBookmarked = activeVideo
    ? userState.bookmarkedTimestamps.some((b) => b.videoId === activeVideo.id)
    : false;

  if (isLoading || !activeVideo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070b14] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <span className="text-xs font-semibold text-slate-300">
            Initializing StreamIntel Studio Neural Mesh...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 selection:bg-cyan-500 selection:text-slate-950 font-sans antialiased">
      {/* Top Navigation */}
      <Navbar
        onOpenIngest={() => setIsIngestOpen(true)}
        onOpenVoiceQuery={() => setIsVoiceQueryOpen(true)}
        onOpenCacheStats={() => setIsCacheStatsOpen(true)}
        onSelectVideo={handleSelectVideo}
        theaterMode={theaterMode}
        onToggleTheaterMode={() => setTheaterMode(!theaterMode)}
        activeCategory={activeCategory}
        onSelectCategory={(cat) => setActiveCategory(cat)}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthOpen(true)}
        onOpenWatchParty={() => setIsWatchPartyOpen(true)}
        activeWatchRoom={activeWatchRoom}
      />

      {/* Main Studio Viewport */}
      <main className="mx-auto max-w-7xl px-3 sm:px-6 py-5">
        {/* Cinema / Theater Mode View */}
        {theaterMode ? (
          <div className="space-y-6">
            {/* Full-width Video Player in Theater Mode */}
            <div className="w-full">
              <VideoPlayer
                video={activeVideo}
                currentTime={currentTime}
                onTimeUpdate={setCurrentTime}
                seekToTime={seekToTime}
                onSeekComplete={() => setSeekToTime(null)}
                isLiked={isCurrentVideoLiked}
                onToggleLike={handleToggleLike}
                isBookmarked={isCurrentVideoBookmarked}
                onToggleBookmark={handleToggleBookmark}
                onAddBookmarkAtCurrentTime={handleAddBookmarkAtTime}
                theaterMode={theaterMode}
                onToggleTheaterMode={() => setTheaterMode(!theaterMode)}
                onOpenClipExtractor={() => setIsClipExtractorOpen(true)}
                activeWatchRoom={activeWatchRoom}
                onOpenWatchParty={() => setIsWatchPartyOpen(true)}
                floatingReactions={floatingReactions}
                onPlaybackStateChange={handlePlaybackStateChange}
              />
            </div>

            {/* Two-Column Below: Intelligence Tabs + Copilot Chat */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <VideoIntelligenceTabs
                video={activeVideo}
                currentTime={currentTime}
                onSeek={handleSeek}
                bookmarks={userState.bookmarkedTimestamps}
                userNotes={userState.notes}
                onAddNote={handleAddNote}
                onDeleteNote={handleDeleteNote}
                onDeleteBookmark={handleDeleteBookmark}
                onVideoUpdated={handleVideoUpdated}
              />
              <VideoCopilotChat
                video={activeVideo}
                currentTime={currentTime}
                onSeek={handleSeek}
                onOpenVoiceQuery={() => setIsVoiceQueryOpen(true)}
              />
            </div>
          </div>
        ) : (
          /* Standard Pro Layout: 8-Column Player & Tabs, 4-Column Copilot Sidebar */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Primary Left Workstage (Cols 1-8) */}
            <div className="lg:col-span-8 space-y-6">
              <VideoPlayer
                video={activeVideo}
                currentTime={currentTime}
                onTimeUpdate={setCurrentTime}
                seekToTime={seekToTime}
                onSeekComplete={() => setSeekToTime(null)}
                isLiked={isCurrentVideoLiked}
                onToggleLike={handleToggleLike}
                isBookmarked={isCurrentVideoBookmarked}
                onToggleBookmark={handleToggleBookmark}
                onAddBookmarkAtCurrentTime={handleAddBookmarkAtTime}
                theaterMode={theaterMode}
                onToggleTheaterMode={() => setTheaterMode(!theaterMode)}
                onOpenClipExtractor={() => setIsClipExtractorOpen(true)}
                activeWatchRoom={activeWatchRoom}
                onOpenWatchParty={() => setIsWatchPartyOpen(true)}
                floatingReactions={floatingReactions}
                onPlaybackStateChange={handlePlaybackStateChange}
              />

              <VideoIntelligenceTabs
                video={activeVideo}
                currentTime={currentTime}
                onSeek={handleSeek}
                bookmarks={userState.bookmarkedTimestamps}
                userNotes={userState.notes}
                onAddNote={handleAddNote}
                onDeleteNote={handleDeleteNote}
                onDeleteBookmark={handleDeleteBookmark}
                onVideoUpdated={handleVideoUpdated}
              />
            </div>

            {/* Secondary Right Sidebar (Cols 9-12): Grounded Copilot Chat */}
            <div className="lg:col-span-4 lg:sticky lg:top-20">
              <VideoCopilotChat
                video={activeVideo}
                currentTime={currentTime}
                onSeek={handleSeek}
                onOpenVoiceQuery={() => setIsVoiceQueryOpen(true)}
              />
            </div>
          </div>
        )}

        {/* Zero-Server P2P Streaming Engine & Chaos Telemetry Dashboard */}
        <div className="mt-12">
          <P2PEngineDashboard videoId={activeVideo.id} videoTitle={activeVideo.title} />
        </div>

        {/* Personalized Content Rails & Context Graph */}
        <div className="mt-12 pt-8 border-t border-slate-800/80">
          <RecommendationRails
            rails={rails}
            activeVideoId={activeVideo.id}
            onSelectVideo={handleSelectVideo}
          />
        </div>
      </main>

      {/* Multimodal Ingest Modal */}
      <MultimodalIngestModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onVideoIngested={handleVideoIngested}
      />

      {/* Voice Query Modal */}
      <VoiceQueryModal
        isOpen={isVoiceQueryOpen}
        onClose={() => setIsVoiceQueryOpen(false)}
        onTranscriptSubmitted={(query) => {
          console.log('Voice query submitted:', query);
        }}
      />

      {/* Cache & Latency Telemetry Modal */}
      <CacheTelemetryModal
        isOpen={isCacheStatsOpen}
        onClose={() => setIsCacheStatsOpen(false)}
      />

      {/* AI Clip & Short Extractor Modal */}
      <ClipExtractorModal
        isOpen={isClipExtractorOpen}
        onClose={() => setIsClipExtractorOpen(false)}
        video={activeVideo}
        currentTime={currentTime}
        onSeek={handleSeek}
        onClipCreated={handleClipCreated}
      />

      {/* User Authentication & Profile Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
        }}
        onLogout={() => {
          setCurrentUser(null);
        }}
      />

      {/* Collaborative Watch Party Modal */}
      <WatchPartyModal
        isOpen={isWatchPartyOpen}
        onClose={() => setIsWatchPartyOpen(false)}
        video={activeVideo}
        currentTime={currentTime}
        currentUser={currentUser}
        activeRoom={activeWatchRoom}
        onJoinOrCreateRoom={(room) => {
          setActiveWatchRoom(room);
        }}
        onLeaveRoom={() => {
          setActiveWatchRoom(null);
          setFloatingReactions([]);
        }}
        onSeek={handleSeek}
        onSendPartyReaction={handleSendPartyReaction}
      />
    </div>
  );
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
