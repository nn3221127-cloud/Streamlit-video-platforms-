import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Sparkles,
  UploadCloud,
  Mic,
  Activity,
  Maximize2,
  Tv,
  Layers,
  ChevronDown,
  CheckCircle2,
  Flame,
  Clock,
  X,
  Play,
  User,
  Users,
  ShieldCheck,
} from 'lucide-react';
import { VideoItem, SearchResult, UserAccount, WatchPartyRoom } from '../types';

interface NavbarProps {
  onOpenIngest: () => void;
  onOpenVoiceQuery: () => void;
  onOpenCacheStats: () => void;
  onSelectVideo: (video: VideoItem, seekTime?: number) => void;
  theaterMode: boolean;
  onToggleTheaterMode: () => void;
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  currentUser?: UserAccount | null;
  onOpenAuthModal?: () => void;
  onOpenWatchParty?: () => void;
  activeWatchRoom?: WatchPartyRoom | null;
}

const CATEGORIES = ['All', 'AI & Machine Learning', 'Quantum Computing', 'Robotics & Automation', 'Space & Astronomy', 'Biotech & Genomics', 'Cybersecurity & Cloud'];

export const Navbar: React.FC<NavbarProps> = ({
  onOpenIngest,
  onOpenVoiceQuery,
  onOpenCacheStats,
  onSelectVideo,
  theaterMode,
  onToggleTheaterMode,
  activeCategory,
  onSelectCategory,
  currentUser,
  onOpenAuthModal,
  onOpenWatchParty,
  activeWatchRoom,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&category=${encodeURIComponent(activeCategory)}`);
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.results || []);
        }
      } catch (err) {
        console.error('Search query failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [searchQuery, activeCategory]);

  // Click outside to close search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#0a0f1d]/90 backdrop-blur-xl transition-all">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/40">
            <Sparkles className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white sm:text-lg">
                Stream<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">Intel</span>
              </span>
              <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-400 border border-cyan-500/20">
                Studio AI
              </span>
            </div>
            <p className="hidden text-[10px] text-slate-400 sm:block">Multimodal Video & Temporal Grounding</p>
          </div>
        </div>

        {/* Global Hybrid Vector Search Bar */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-lg">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              placeholder="Search concepts, transcripts, timestamps, or scenes (e.g. 'KV cache', 'Qubits')..."
              className="w-full rounded-xl border border-slate-700/70 bg-slate-900/90 py-2 pl-10 pr-10 text-xs sm:text-sm text-slate-100 placeholder-slate-400 transition-all focus:border-cyan-500 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Search Dropdown Results */}
          {isSearchOpen && (searchQuery.trim() !== '' || searchResults.length > 0) && (
            <div className="absolute left-0 right-0 top-full mt-2 max-h-96 overflow-y-auto rounded-2xl border border-slate-700/80 bg-[#0d1424] p-2 shadow-2xl shadow-black/80 backdrop-blur-2xl z-50">
              <div className="mb-2 flex items-center justify-between px-2 pt-1 text-[11px] text-slate-400 border-b border-slate-800 pb-1.5">
                <span className="flex items-center gap-1.5 font-medium text-cyan-400">
                  <Sparkles className="h-3 w-3" /> Hybrid Vector & Lexical Matches
                </span>
                <span>{searchResults.length} indexed videos</span>
              </div>

              {isSearching ? (
                <div className="flex items-center justify-center py-8 text-xs text-slate-400">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent mr-2" />
                  Searching neural embeddings...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No matching video streams or transcript segments found.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {searchResults.map(({ video, score, matchType, matchedSegment }) => (
                    <button
                      key={video.id}
                      onClick={() => {
                        onSelectVideo(video, matchedSegment?.startTime);
                        setIsSearchOpen(false);
                      }}
                      className="w-full rounded-xl p-2.5 text-left transition-all hover:bg-slate-800/80 flex items-start gap-3 group border border-transparent hover:border-slate-700/60"
                    >
                      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                        <img src={video.thumbnail} alt={video.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                        <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[9px] font-medium text-slate-200">
                          {formatDuration(video.duration)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs font-semibold text-slate-100 group-hover:text-cyan-300">
                            {video.title}
                          </span>
                        </div>
                        
                        {matchedSegment && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-cyan-400/90 bg-cyan-950/40 rounded px-1.5 py-0.5 max-w-fit">
                            <Clock className="h-3 w-3" />
                            <span>Matched at {formatTime(matchedSegment.startTime)}: "{matchedSegment.text.slice(0, 50)}..."</span>
                          </div>
                        )}

                        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">{video.category}</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-mono">Similarity: {Math.round(score * 100)}%</span>
                          <span className="text-[9px] uppercase px-1 rounded bg-slate-800/60 text-slate-400">{matchType}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          
          {/* Watch Party Trigger */}
          {onOpenWatchParty && (
            <button
              onClick={onOpenWatchParty}
              title="Join or host a synchronized watch party"
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
                activeWatchRoom
                  ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300 shadow-sm shadow-emerald-500/20'
                  : 'border-slate-700/70 bg-slate-900/80 text-slate-200 hover:border-emerald-500/50 hover:bg-slate-800 hover:text-emerald-300'
              }`}
            >
              <Users className="h-4 w-4 text-emerald-400" />
              <span className="hidden sm:inline">{activeWatchRoom ? 'Party (Live)' : 'Watch Party'}</span>
            </button>
          )}

          {/* Voice Query Button */}
          <button
            onClick={onOpenVoiceQuery}
            title="Record Voice Query with Gemini Transcribe"
            className="flex items-center gap-1.5 rounded-xl border border-slate-700/70 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition-all hover:border-cyan-500/50 hover:bg-slate-800 hover:text-cyan-300"
          >
            <Mic className="h-4 w-4 text-cyan-400" />
            <span className="hidden md:inline">Voice Query</span>
          </button>

          {/* Ingest Video Button */}
          <button
            onClick={onOpenIngest}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-cyan-500/20 transition-all hover:from-cyan-400 hover:to-blue-500 active:scale-95"
          >
            <UploadCloud className="h-4 w-4" />
            <span>Ingest Media</span>
          </button>

          {/* Cache Telemetry */}
          <button
            onClick={onOpenCacheStats}
            title="Cache & Latency Telemetry"
            className="hidden sm:flex items-center justify-center h-8 w-8 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700"
          >
            <Activity className="h-4 w-4 text-emerald-400" />
          </button>

          {/* Theater Mode Toggle */}
          <button
            onClick={onToggleTheaterMode}
            title={theaterMode ? 'Exit Cinema View' : 'Cinema Theater Mode'}
            className={`hidden md:flex items-center justify-center h-8 w-8 rounded-xl border transition-all ${
              theaterMode
                ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-400'
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Tv className="h-4 w-4" />
          </button>

          {/* User Auth Profile Button */}
          {onOpenAuthModal && (
            <button
              onClick={onOpenAuthModal}
              title={currentUser ? `${currentUser.name} (${currentUser.role})` : 'Sign In / Register'}
              className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/90 py-1 px-2.5 text-xs font-semibold text-slate-200 hover:border-cyan-500/60 hover:bg-slate-800 transition-all"
            >
              {currentUser ? (
                <>
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="h-5 w-5 rounded-full object-cover border border-cyan-500/50"
                  />
                  <span className="hidden lg:inline truncate max-w-[90px]">{currentUser.name.split(' ')[0]}</span>
                </>
              ) : (
                <>
                  <User className="h-4 w-4 text-cyan-400" />
                  <span className="hidden sm:inline">Sign In</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Chips Bar */}
      <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-1.5 sm:px-6 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className={`shrink-0 rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                isActive
                  ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm shadow-cyan-500/30'
                  : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </header>
  );
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
