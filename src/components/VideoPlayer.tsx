import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  Bookmark,
  BookmarkCheck,
  Heart,
  Share2,
  Settings,
  Sparkles,
  Layers,
  Cpu,
  Check,
  Tv,
  MessageSquarePlus,
  HelpCircle,
  Scissors
} from 'lucide-react';
import { VideoItem, ChapterMarker } from '../types';

interface VideoPlayerProps {
  video: VideoItem;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  seekToTime?: number | null;
  onSeekComplete?: () => void;
  isLiked: boolean;
  onToggleLike: () => void;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onAddBookmarkAtCurrentTime: (time: number) => void;
  theaterMode: boolean;
  onToggleTheaterMode: () => void;
  onOpenClipExtractor?: () => void;
}

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const QUALITY_OPTIONS = ['Auto (1080p)', '4K (2160p)', '1080p FHD', '720p HD', '480p SD'];

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  video,
  currentTime,
  onTimeUpdate,
  seekToTime,
  onSeekComplete,
  isLiked,
  onToggleLike,
  isBookmarked,
  onToggleBookmark,
  onAddBookmarkAtCurrentTime,
  theaterMode,
  onToggleTheaterMode,
  onOpenClipExtractor,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(video.duration || 300);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [selectedQuality, setSelectedQuality] = useState('Auto (1080p)');
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [copiedShare, setCopiedShare] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle external seek request
  useEffect(() => {
    if (seekToTime !== null && seekToTime !== undefined && videoRef.current) {
      videoRef.current.currentTime = seekToTime;
      onTimeUpdate(seekToTime);
      if (onSeekComplete) onSeekComplete();
    }
  }, [seekToTime]);

  // Video duration load
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || video.duration);
    }
  };

  // Time update
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      onTimeUpdate(t);
    }
  };

  // Toggle Play
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Seek relative
  const skipTime = (seconds: number) => {
    if (videoRef.current) {
      const nextTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
      videoRef.current.currentTime = nextTime;
      onTimeUpdate(nextTime);
    }
  };

  // Scrub bar click / drag
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(duration, pos * duration));
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      onTimeUpdate(newTime);
    }
  };

  // Timeline hover
  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoveredTime(pos * duration);
  };

  // Volume
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    videoRef.current.muted = nextMuted;
  };

  // Speed
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSettings(false);
  };

  // Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Copy share link
  const handleShare = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?v=${video.id}&t=${Math.floor(currentTime)}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  // Active Chapter detection
  const currentChapter = video.chapters?.find(
    (c) => currentTime >= c.startTime && currentTime <= c.endTime
  );

  // Auto-hide controls
  const handleMouseMove = () => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setControlsVisible(false);
    }, 3000);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Player Container */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setControlsVisible(false)}
        className="group relative w-full overflow-hidden rounded-2xl bg-black shadow-2xl shadow-cyan-950/20 ring-1 ring-slate-800"
        style={{ aspectRatio: '16/9' }}
      >
        {/* Core Video Element */}
        <video
          ref={videoRef}
          src={video.url}
          poster={video.thumbnail}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onClick={togglePlay}
          playsInline
          className="h-full w-full object-contain cursor-pointer"
        />

        {/* Big Central Play/Pause Overlay on Click */}
        {!isPlaying && (
          <div
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px] transition-all cursor-pointer"
          >
            <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-cyan-500/90 text-slate-950 shadow-2xl shadow-cyan-500/50 transition-transform hover:scale-110 active:scale-95">
              <Play className="h-8 w-8 sm:h-10 sm:w-10 fill-current translate-x-0.5" />
            </div>
          </div>
        )}

        {/* Current Active Chapter Banner Overlay (Top Left) */}
        {currentChapter && (
          <div className="pointer-events-none absolute top-4 left-4 z-20 flex items-center gap-2 rounded-xl bg-slate-950/80 px-3 py-1.5 backdrop-blur-md border border-cyan-500/30 text-xs text-slate-200">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-semibold text-cyan-400">{currentChapter.title}</span>
          </div>
        )}

        {/* Custom Controls Bar (Bottom) */}
        <div
          className={`absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 sm:p-4 transition-opacity duration-300 ${
            controlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Timeline Scrub Bar with Chapter Pins */}
          <div
            onMouseMove={handleTimelineMouseMove}
            onMouseLeave={() => setHoveredTime(null)}
            onClick={handleTimelineClick}
            className="group/timeline relative mb-3 h-2 w-full cursor-pointer rounded-full bg-slate-700/60 transition-all hover:h-3"
          >
            {/* Progress Fill */}
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />

            {/* Chapter Breakpoint Segment Markers */}
            {video.chapters?.map((ch) => {
              const leftPercent = (ch.startTime / duration) * 100;
              return (
                <div
                  key={ch.id}
                  title={`${ch.title} (${formatTime(ch.startTime)})`}
                  className="absolute top-0 bottom-0 w-[2px] bg-slate-900/90 z-10 hover:bg-cyan-300"
                  style={{ left: `${leftPercent}%` }}
                />
              );
            })}

            {/* Hover Indicator & Tooltip */}
            {hoveredTime !== null && (
              <>
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-cyan-300 z-20 pointer-events-none"
                  style={{ left: `${hoverPosition}%` }}
                />
                <div
                  className="absolute bottom-5 -translate-x-1/2 rounded-lg bg-slate-900/95 px-2 py-1 text-[10px] text-white shadow-xl border border-slate-700 pointer-events-none z-30 whitespace-nowrap"
                  style={{ left: `${hoverPosition}%` }}
                >
                  <span className="font-mono text-cyan-400">{formatTime(hoveredTime)}</span>
                  {video.chapters?.find((c) => hoveredTime >= c.startTime && hoveredTime <= c.endTime) && (
                    <span className="ml-1 text-slate-300">
                      • {video.chapters.find((c) => hoveredTime >= c.startTime && hoveredTime <= c.endTime)?.title}
                    </span>
                  )}
                </div>
              </>
            )}

            {/* Scrub Handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-md shadow-black scale-0 transition-transform group-hover/timeline:scale-100"
              style={{ left: `${(currentTime / duration) * 100}%` }}
            />
          </div>

          {/* Controls Bottom Row */}
          <div className="flex items-center justify-between gap-2 text-white">
            
            {/* Left Controls: Play, Skip, Volume, Time */}
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={togglePlay}
                className="rounded-lg p-1.5 text-slate-200 hover:bg-white/10 hover:text-white transition-all"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
              </button>

              <button
                onClick={() => skipTime(-10)}
                title="Rewind 10s (J)"
                className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-all"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              <button
                onClick={() => skipTime(10)}
                title="Forward 10s (L)"
                className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-all"
              >
                <RotateCw className="h-4 w-4" />
              </button>

              {/* Volume Slider */}
              <div className="group/vol flex items-center gap-1.5">
                <button
                  onClick={toggleMute}
                  className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  {isMuted || volume === 0 ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="h-1 w-12 sm:w-16 cursor-pointer rounded-lg bg-slate-600 accent-cyan-400 transition-all opacity-80 group-hover/vol:opacity-100"
                />
              </div>

              {/* Time Display */}
              <div className="font-mono text-xs text-slate-300">
                <span className="text-cyan-400">{formatTime(currentTime)}</span>
                <span className="text-slate-500"> / </span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right Controls: Bookmark current time, Speed/Quality, Fullscreen */}
            <div className="relative flex items-center gap-2">
              
              {/* Quick Bookmark at Current Time */}
              <button
                onClick={() => onAddBookmarkAtCurrentTime(currentTime)}
                title="Save timecoded bookmark"
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-300 hover:bg-white/10 hover:text-cyan-300 transition-all"
              >
                <Bookmark className="h-4 w-4 text-cyan-400" />
                <span className="hidden sm:inline">Mark</span>
              </button>

              {/* Settings / Speed Popover Toggle */}
              <div className="relative">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  title="Playback Settings"
                  className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-all"
                >
                  <Settings className="h-4 w-4" />
                </button>

                {/* Settings Dropdown */}
                {showSettings && (
                  <div className="absolute bottom-full right-0 mb-2 w-48 rounded-xl border border-slate-700 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-xl z-50 text-xs">
                    <div className="mb-1 px-2 py-1 font-semibold text-slate-400 border-b border-slate-800">
                      Playback Speed
                    </div>
                    <div className="grid grid-cols-3 gap-1 py-1">
                      {SPEED_OPTIONS.map((speed) => (
                        <button
                          key={speed}
                          onClick={() => handleSpeedChange(speed)}
                          className={`rounded px-1.5 py-1 text-center font-mono ${
                            playbackSpeed === speed ? 'bg-cyan-500 text-slate-950 font-bold' : 'hover:bg-slate-800 text-slate-200'
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>

                    <div className="mt-2 mb-1 px-2 py-1 font-semibold text-slate-400 border-b border-slate-800">
                      Stream Quality
                    </div>
                    <div className="space-y-0.5 py-1">
                      {QUALITY_OPTIONS.map((q) => (
                        <button
                          key={q}
                          onClick={() => {
                            setSelectedQuality(q);
                            setShowSettings(false);
                          }}
                          className={`w-full flex items-center justify-between rounded px-2 py-1 text-left ${
                            selectedQuality === q ? 'bg-slate-800 text-cyan-400 font-medium' : 'hover:bg-slate-800/60 text-slate-300'
                          }`}
                        >
                          <span>{q}</span>
                          {selectedQuality === q && <Check className="h-3 w-3" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Theater Mode */}
              <button
                onClick={onToggleTheaterMode}
                title={theaterMode ? 'Exit Cinema View' : 'Cinema Theater Mode'}
                className="hidden sm:block rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-all"
              >
                <Tv className="h-4 w-4" />
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                title="Fullscreen (F)"
                className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-all"
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Video Information & Action Header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 backdrop-blur-md">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-[280px]">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-cyan-950/60 px-2 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-500/30">
                {video.category}
              </span>
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                {selectedQuality}
              </span>
            </div>
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-white">
              {video.title}
            </h1>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <img src={video.authorAvatar} alt={video.author} className="h-5 w-5 rounded-full object-cover" />
                <span className="font-medium text-slate-200">{video.author}</span>
              </div>
              <span>•</span>
              <span>{video.views.toLocaleString()} views</span>
              <span>•</span>
              <span>Published {video.publishedAt}</span>
            </div>
          </div>

          {/* Action Buttons: Like, Bookmark, Share, Clip Generator */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Like Button */}
            <button
              onClick={onToggleLike}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                isLiked
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm shadow-rose-500/20'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
              }`}
            >
              <Heart className={`h-4 w-4 ${isLiked ? 'fill-current text-rose-400' : ''}`} />
              <span>{video.likes.toLocaleString()}</span>
            </button>

            {/* Bookmark Video */}
            <button
              onClick={onToggleBookmark}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                isBookmarked
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
              }`}
            >
              {isBookmarked ? <BookmarkCheck className="h-4 w-4 text-cyan-400" /> : <Bookmark className="h-4 w-4" />}
              <span>{isBookmarked ? 'Saved' : 'Save'}</span>
            </button>

            {/* Share Timestamp */}
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60 transition-all"
            >
              <Share2 className="h-4 w-4" />
              <span>{copiedShare ? 'Copied Link!' : 'Share'}</span>
            </button>

            {/* AI Clip Extractor Trigger */}
            {onOpenClipExtractor && (
              <button
                onClick={onOpenClipExtractor}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 px-3.5 py-2 text-xs font-semibold text-emerald-400 border border-emerald-500/40 hover:from-emerald-500/30 hover:to-teal-500/30 transition-all"
              >
                <Scissors className="h-4 w-4 text-emerald-400" />
                <span className="hidden sm:inline">Extract Clips</span>
              </button>
            )}
          </div>
        </div>

        {/* Technical Video Specs Bar */}
        {video.specs && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1 text-slate-300">
              <Cpu className="h-3.5 w-3.5 text-cyan-400" /> Resolution: {video.specs.resolution}
            </span>
            <span>•</span>
            <span>Codec: {video.specs.codec}</span>
            <span>•</span>
            <span>Bitrate: {video.specs.bitrate}</span>
            <span>•</span>
            <span>Aspect: {video.specs.aspectRatio}</span>
          </div>
        )}
      </div>
    </div>
  );
};

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
