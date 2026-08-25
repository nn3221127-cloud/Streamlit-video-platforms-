import React, { useState } from 'react';
import {
  ListTree,
  FileText,
  Sparkles,
  Eye,
  Scissors,
  Bookmark,
  Search,
  Clock,
  Play,
  CheckCircle2,
  Trash2,
  Plus,
  Flame,
  Tag,
  Lightbulb
} from 'lucide-react';
import { VideoItem, ChapterMarker, BookmarkItem, UserNote } from '../types';

interface VideoIntelligenceTabsProps {
  video: VideoItem;
  currentTime: number;
  onSeek: (time: number) => void;
  bookmarks: BookmarkItem[];
  userNotes: UserNote[];
  onAddNote: (text: string, timestamp: number) => void;
  onDeleteNote: (id: string) => void;
  onDeleteBookmark: (id: string) => void;
}

type TabType = 'chapters' | 'transcript' | 'takeaways' | 'scenes' | 'clips' | 'notes';

export const VideoIntelligenceTabs: React.FC<VideoIntelligenceTabsProps> = ({
  video,
  currentTime,
  onSeek,
  bookmarks,
  userNotes,
  onAddNote,
  onDeleteNote,
  onDeleteBookmark,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('chapters');
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [noteInput, setNoteInput] = useState('');

  // Filtered transcript search
  const filteredTranscript = (video.transcript || []).filter((t) =>
    transcriptSearch ? t.text.toLowerCase().includes(transcriptSearch.toLowerCase()) || (t.speaker && t.speaker.toLowerCase().includes(transcriptSearch.toLowerCase())) : true
  );

  // Video notes for current video
  const currentVideoNotes = userNotes.filter((n) => n.videoId === video.id);
  const currentVideoBookmarks = bookmarks.filter((b) => b.videoId === video.id);

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    onAddNote(noteInput.trim(), currentTime);
    setNoteInput('');
  };

  return (
    <div className="flex flex-col rounded-2xl border border-slate-800/80 bg-[#0c1220]/70 backdrop-blur-xl shadow-xl">
      
      {/* Tabs Header */}
      <div className="flex items-center gap-1 border-b border-slate-800 p-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('chapters')}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all shrink-0 ${
            activeTab === 'chapters'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <ListTree className="h-4 w-4" />
          <span>Chapters ({video.chapters?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('transcript')}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all shrink-0 ${
            activeTab === 'transcript'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Live Transcript</span>
        </button>

        <button
          onClick={() => setActiveTab('takeaways')}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all shrink-0 ${
            activeTab === 'takeaways'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <Lightbulb className="h-4 w-4" />
          <span>Key Insights</span>
        </button>

        <button
          onClick={() => setActiveTab('scenes')}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all shrink-0 ${
            activeTab === 'scenes'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <Eye className="h-4 w-4" />
          <span>Visual Scenes</span>
        </button>

        <button
          onClick={() => setActiveTab('clips')}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all shrink-0 ${
            activeTab === 'clips'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <Scissors className="h-4 w-4" />
          <span>AI Clips ({video.aiGeneratedClips?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all shrink-0 ${
            activeTab === 'notes'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <Bookmark className="h-4 w-4" />
          <span>Notes ({currentVideoNotes.length + currentVideoBookmarks.length})</span>
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="p-4">
        
        {/* 1. CHAPTERS TIMELINE */}
        {activeTab === 'chapters' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Deep Semantic Chapter Breaks</span>
              <span className="text-[11px] text-cyan-400">Click any chapter to jump video</span>
            </div>

            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
              {video.chapters?.map((ch, idx) => {
                const isActive = currentTime >= ch.startTime && currentTime <= ch.endTime;
                return (
                  <div
                    key={ch.id}
                    onClick={() => onSeek(ch.startTime)}
                    className={`group cursor-pointer rounded-xl p-3 border transition-all ${
                      isActive
                        ? 'border-cyan-500/60 bg-cyan-950/40 shadow-md shadow-cyan-950/50'
                        : 'border-slate-800/80 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold ${
                            isActive ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300 group-hover:bg-slate-700'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <h4 className={`text-xs sm:text-sm font-semibold ${isActive ? 'text-cyan-300' : 'text-slate-100 group-hover:text-cyan-400'}`}>
                          {ch.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded-md shrink-0">
                        <Clock className="h-3 w-3 text-cyan-400" />
                        <span>{formatTime(ch.startTime)} - {formatTime(ch.endTime)}</span>
                      </div>
                    </div>

                    <p className="mt-2 text-xs text-slate-300 leading-relaxed pl-8">
                      {ch.summary}
                    </p>

                    {ch.keyVisual && (
                      <div className="mt-2 pl-8 flex items-center gap-2 text-[11px] text-slate-400">
                        <Eye className="h-3 w-3 text-slate-500" />
                        <span className="italic text-slate-400">Key Visual: {ch.keyVisual}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. SYNCHRONIZED TRANSCRIPT */}
        {activeTab === 'transcript' && (
          <div className="space-y-3">
            {/* Transcript Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
                placeholder="Search words inside transcript..."
                className="w-full rounded-xl border border-slate-700/80 bg-slate-900/90 py-1.5 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-400 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {filteredTranscript.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No matching transcript lines found.
                </div>
              ) : (
                filteredTranscript.map((item) => {
                  const isActive = currentTime >= item.startTime && currentTime <= item.endTime;
                  return (
                    <div
                      key={item.id}
                      onClick={() => onSeek(item.startTime)}
                      className={`cursor-pointer rounded-xl p-2.5 transition-all text-xs border ${
                        isActive
                          ? 'border-cyan-500/60 bg-cyan-950/40 text-slate-100 shadow-sm'
                          : 'border-transparent hover:bg-slate-800/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
                        <span className="font-semibold text-cyan-400/90">{item.speaker || 'Speaker'}</span>
                        <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-cyan-300">{formatTime(item.startTime)}</span>
                      </div>
                      <p className={`leading-relaxed ${isActive ? 'font-medium text-cyan-200' : 'text-slate-300'}`}>
                        {item.text}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* 3. KEY INSIGHTS & TAKEAWAYS */}
        {activeTab === 'takeaways' && (
          <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
            {/* Executive Abstract */}
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1.5">
                <Sparkles className="h-4 w-4" /> Executive Abstract
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                {video.description}
              </p>
            </div>

            {/* Core Takeaways */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Core Conceptual Anchors
              </h4>
              <div className="space-y-2">
                {video.keyTakeaways?.map((point, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{point}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Topic Affinity Distribution */}
            {video.topicAffinities && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Topic Affinity Weights
                </h4>
                <div className="space-y-2">
                  {video.topicAffinities.map((aff, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-300">
                        <span>{aff.topic}</span>
                        <span className="font-mono text-cyan-400">{Math.round(aff.weight * 100)}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                          style={{ width: `${aff.weight * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. VISUAL SCENES BREAKDOWN */}
        {activeTab === 'scenes' && (
          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            <div className="text-xs text-slate-400">
              Frame-level object detection, visual embeddings, and scene sentiment.
            </div>

            <div className="space-y-2.5">
              {video.visualScenes && video.visualScenes.length > 0 ? (
                video.visualScenes.map((sc, idx) => (
                  <div
                    key={idx}
                    onClick={() => onSeek(sc.timestamp)}
                    className="cursor-pointer rounded-xl border border-slate-800 bg-slate-900/60 p-3 hover:border-cyan-500/50 hover:bg-slate-800/60 transition-all text-xs"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono font-semibold text-cyan-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatTime(sc.timestamp)}
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                        {sc.sentiment}
                      </span>
                    </div>
                    <p className="text-slate-200 leading-relaxed mb-2">
                      {sc.sceneDescription}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {sc.objects.map((obj, i) => (
                        <span key={i} className="rounded-md bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-400 border border-slate-700/60">
                          {obj}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  Visual scene analysis generated on video ingest.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. AI CLIPS & SHORTS */}
        {activeTab === 'clips' && (
          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Auto-Extracted High Virality Short Segments</span>
              <span className="text-emerald-400 font-medium">Gemini Clip Ranking</span>
            </div>

            <div className="space-y-3">
              {video.aiGeneratedClips && video.aiGeneratedClips.length > 0 ? (
                video.aiGeneratedClips.map((clip) => (
                  <div
                    key={clip.id}
                    className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-3.5 space-y-2 hover:border-emerald-500/60 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-emerald-300">
                        {clip.title}
                      </h4>
                      <span className="flex items-center gap-1 rounded bg-emerald-900/60 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300 shrink-0">
                        <Flame className="h-3 w-3 text-emerald-400" /> Virality: {clip.viralityScore}%
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 italic">
                      "{clip.hook}"
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-emerald-900/40">
                      <span className="font-mono text-xs text-slate-400">
                        {formatTime(clip.startTime)} - {formatTime(clip.endTime)} ({clip.endTime - clip.startTime}s)
                      </span>
                      <button
                        onClick={() => onSeek(clip.startTime)}
                        className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 transition-all"
                      >
                        <Play className="h-3 w-3 fill-current" /> Play Clip
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No clips extracted yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6. TIMECODED NOTES & BOOKMARKS */}
        {activeTab === 'notes' && (
          <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
            {/* Create Note Input */}
            <form onSubmit={handleCreateNote} className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Add Note at <span className="font-mono text-cyan-400">{formatTime(currentTime)}</span></span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Type an observation or key note..."
                  className="flex-1 rounded-xl border border-slate-700/80 bg-slate-900/90 py-2 px-3 text-xs text-slate-100 placeholder-slate-400 focus:border-cyan-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1 rounded-xl bg-cyan-500 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-sm shadow-cyan-500/30 hover:bg-cyan-400"
                >
                  <Plus className="h-3.5 w-3.5" /> Save
                </button>
              </div>
            </form>

            {/* List of notes & bookmarks */}
            <div className="space-y-2.5">
              {currentVideoNotes.length === 0 && currentVideoBookmarks.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No annotations or bookmarks saved yet for this video.
                </div>
              ) : (
                <>
                  {currentVideoNotes.map((note) => (
                    <div
                      key={note.id}
                      className="group rounded-xl border border-purple-500/30 bg-purple-950/15 p-3 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <button
                          onClick={() => onSeek(note.timestamp)}
                          className="flex items-center gap-1 font-mono text-[11px] font-bold text-purple-400 hover:underline"
                        >
                          <Clock className="h-3 w-3" /> {formatTime(note.timestamp)}
                        </button>
                        <p className="text-slate-200 leading-relaxed">{note.text}</p>
                      </div>
                      <button
                        onClick={() => onDeleteNote(note.id)}
                        className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {currentVideoBookmarks.map((bm) => (
                    <div
                      key={bm.id}
                      className="group rounded-xl border border-cyan-500/30 bg-cyan-950/15 p-3 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <button
                          onClick={() => onSeek(bm.timestamp)}
                          className="flex items-center gap-1 font-mono text-[11px] font-bold text-cyan-400 hover:underline"
                        >
                          <Bookmark className="h-3 w-3" /> Bookmark at {formatTime(bm.timestamp)}
                        </button>
                        <p className="text-slate-300">{bm.title || 'Saved moment'}</p>
                      </div>
                      <button
                        onClick={() => onDeleteBookmark(bm.id)}
                        className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
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
