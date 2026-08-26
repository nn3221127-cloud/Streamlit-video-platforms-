import React, { useState, useEffect, useRef } from 'react';
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
  Globe,
  Languages,
  RotateCw,
  Copy,
  Check,
  Download,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  Cpu,
  Layers,
  ArrowRightLeft,
  Volume2,
} from 'lucide-react';
import {
  VideoItem,
  ChapterMarker,
  BookmarkItem,
  UserNote,
  TranscriptSegment,
  VideoSummaryPayload,
} from '../types';

interface VideoIntelligenceTabsProps {
  video: VideoItem;
  currentTime: number;
  onSeek: (time: number) => void;
  bookmarks: BookmarkItem[];
  userNotes: UserNote[];
  onAddNote: (text: string, timestamp: number) => void;
  onDeleteNote: (id: string) => void;
  onDeleteBookmark: (id: string) => void;
  onVideoUpdated?: (updatedVideo: VideoItem) => void;
}

type TabType = 'summary' | 'chapters' | 'transcript' | 'takeaways' | 'scenes' | 'clips' | 'notes';

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English (Original)', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish (Español)', flag: '🇪🇸' },
  { code: 'fr', name: 'French (Français)', flag: '🇫🇷' },
  { code: 'de', name: 'German (Deutsch)', flag: '🇩🇪' },
  { code: 'ja', name: 'Japanese (日本語)', flag: '🇯🇵' },
  { code: 'zh', name: 'Chinese (中文)', flag: '🇨🇳' },
  { code: 'hi', name: 'Hindi (हिन्दी)', flag: '🇮🇳' },
  { code: 'pt', name: 'Portuguese (Português)', flag: '🇧🇷' },
  { code: 'ko', name: 'Korean (한국어)', flag: '🇰🇷' },
  { code: 'it', name: 'Italian (Italiano)', flag: '🇮🇹' },
  { code: 'ar', name: 'Arabic (العربية)', flag: '🇸🇦' },
  { code: 'ru', name: 'Russian (Русский)', flag: '🇷🇺' },
];

export const VideoIntelligenceTabs: React.FC<VideoIntelligenceTabsProps> = ({
  video,
  currentTime,
  onSeek,
  bookmarks,
  userNotes,
  onAddNote,
  onDeleteNote,
  onDeleteBookmark,
  onVideoUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [noteInput, setNoteInput] = useState('');

  // Translation State
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [showOriginalWithTranslation, setShowOriginalWithTranslation] = useState<boolean>(false);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translationError, setTranslationError] = useState<string>('');

  // Summarization State
  const [summaryComplexity, setSummaryComplexity] = useState<'Executive' | 'Standard' | 'Deep Dive'>('Standard');
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [summaryData, setSummaryData] = useState<VideoSummaryPayload | null>(
    video.summaryData || {
      overview: video.description || `Overview of "${video.title}" covering core architectural milestones.`,
      keyTopics: [
        { topic: video.category || 'Overview', timestamp: 0, description: 'Foundational concepts and context introduction.' },
        { topic: 'Key Technical Demonstration', timestamp: Math.floor((video.duration || 300) * 0.4), description: 'Live performance metrics and benchmarking.' },
      ],
      keyEvents: [
        { timestamp: 0, title: 'Opening Remarks', eventDescription: 'Speaker introduces architectural problem statement.', importance: 'normal' },
        { timestamp: Math.floor((video.duration || 300) * 0.5), title: 'Core Metric Demonstration', eventDescription: 'Critical proof-of-concept walkthrough.', importance: 'high' },
        { timestamp: Math.floor((video.duration || 300) * 0.85), title: 'Strategic Synthesis', eventDescription: 'Roadmap and best practices.', importance: 'normal' },
      ],
      takeaways: video.keyTakeaways && video.keyTakeaways.length > 0 ? video.keyTakeaways : [
        'Understand the core principles and design trade-offs.',
        'Apply high-efficiency streaming patterns in production.',
      ],
      readingTimeMinutes: 2,
      complexityLevel: 'Standard',
      generatedAt: Date.now(),
    }
  );

  // Chapter Detection State
  const [isDetectingChapters, setIsDetectingChapters] = useState<boolean>(false);
  const [chapterSensitivity, setChapterSensitivity] = useState<'high' | 'medium' | 'standard'>('medium');

  // Copy / Download Feedback
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);

  // Auto-scroll transcript ref
  const activeTranscriptRef = useRef<HTMLDivElement | null>(null);

  // Sync state when video changes
  useEffect(() => {
    setSelectedLanguage('en');
    setTranscriptSearch('');
    if (video.summaryData) {
      setSummaryData(video.summaryData);
    }
  }, [video.id]);

  // Current active transcript segments (original or translated)
  const currentTranscript: TranscriptSegment[] =
    selectedLanguage === 'en'
      ? video.transcript || []
      : (video.translations && video.translations[selectedLanguage]) || video.transcript || [];

  // Filtered transcript search
  const filteredTranscript = currentTranscript.filter((t) => {
    if (!transcriptSearch) return true;
    const matchText = t.text.toLowerCase().includes(transcriptSearch.toLowerCase());
    const matchSpeaker = t.speaker && t.speaker.toLowerCase().includes(transcriptSearch.toLowerCase());
    return matchText || matchSpeaker;
  });

  // Handle Translate Request
  const handleTranslate = async (langCode: string) => {
    setSelectedLanguage(langCode);
    if (langCode === 'en') return;

    // Check if already available in video object
    if (video.translations && video.translations[langCode]) {
      return;
    }

    const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
    const targetName = langObj ? langObj.name : langCode;

    setIsTranslating(true);
    setTranslationError('');

    try {
      const res = await fetch(`/api/videos/${video.id}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetLanguageCode: langCode,
          targetLanguageName: targetName,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Translation failed');
      }

      // Update video object
      const updatedTranslations = {
        ...(video.translations || {}),
        [langCode]: data.segments,
      };
      video.translations = updatedTranslations;
      if (onVideoUpdated) {
        onVideoUpdated({ ...video, translations: updatedTranslations });
      }
    } catch (err: any) {
      console.error(err);
      setTranslationError(err.message || 'Translation failed');
    } finally {
      setIsTranslating(false);
    }
  };

  // Handle Summarize Request
  const handleGenerateSummary = async (complexity: 'Executive' | 'Standard' | 'Deep Dive') => {
    setSummaryComplexity(complexity);
    setIsSummarizing(true);

    try {
      const res = await fetch(`/api/videos/${video.id}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complexity }),
      });

      const data = await res.json();
      if (data.success && data.summary) {
        setSummaryData(data.summary);
        video.summaryData = data.summary;
        if (onVideoUpdated) {
          onVideoUpdated({ ...video, summaryData: data.summary });
        }
      }
    } catch (err) {
      console.error('Summary error:', err);
    } finally {
      setIsSummarizing(false);
    }
  };

  // Handle Detect Chapters Request
  const handleDetectChapters = async (sensitivity: 'high' | 'medium' | 'standard') => {
    setChapterSensitivity(sensitivity);
    setIsDetectingChapters(true);

    try {
      const res = await fetch(`/api/videos/${video.id}/detect-chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sensitivity }),
      });

      const data = await res.json();
      if (data.success && data.chapters) {
        video.chapters = data.chapters;
        if (onVideoUpdated) {
          onVideoUpdated({ ...video, chapters: data.chapters });
        }
      }
    } catch (err) {
      console.error('Detect chapters error:', err);
    } finally {
      setIsDetectingChapters(false);
    }
  };

  // Copy Summary to Clipboard
  const handleCopySummary = () => {
    if (!summaryData) return;
    const text = `## AI Executive Summary: ${video.title}\n\n${summaryData.overview}\n\n### Key Topics:\n${summaryData.keyTopics
      .map((t) => `- [${formatTime(t.timestamp || 0)}] **${t.topic}**: ${t.description}`)
      .join('\n')}\n\n### Key Chronological Events:\n${summaryData.keyEvents
      .map((e) => `- [${formatTime(e.timestamp)}] **${e.title}** (${e.importance}): ${e.eventDescription}`)
      .join('\n')}\n\n### Strategic Takeaways:\n${summaryData.takeaways.map((t) => `- ${t}`).join('\n')}`;

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // Download Transcript
  const handleDownloadTranscript = () => {
    const text = currentTranscript
      .map((t) => `[${formatTime(t.startTime)} - ${formatTime(t.endTime)}] ${t.speaker ? t.speaker + ': ' : ''}${t.text}`)
      .join('\n\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${video.title.replace(/[^a-zA-Z0-9]/g, '_')}_transcript_${selectedLanguage}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

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
    <div className="flex flex-col rounded-2xl border border-slate-800/80 bg-[#0c1220]/70 backdrop-blur-xl shadow-xl overflow-hidden">
      
      {/* Tabs Header */}
      <div className="flex items-center gap-1 border-b border-slate-800 p-2 overflow-x-auto scrollbar-none">
        
        {/* 1. AI Summary Tab */}
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all shrink-0 ${
            activeTab === 'summary'
              ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <span>AI Summary</span>
        </button>

        {/* 2. Live Transcript & Multi-Language Translation Tab */}
        <button
          onClick={() => setActiveTab('transcript')}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all shrink-0 ${
            activeTab === 'transcript'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Live Transcript {selectedLanguage !== 'en' && `(${selectedLanguage.toUpperCase()})`}</span>
        </button>

        {/* 3. Chapters & Topic Shifts Tab */}
        <button
          onClick={() => setActiveTab('chapters')}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all shrink-0 ${
            activeTab === 'chapters'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <ListTree className="h-4 w-4" />
          <span>Chapters & Shifts ({video.chapters?.length || 0})</span>
        </button>

        {/* 4. Visual Scenes */}
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

        {/* 5. AI Clips */}
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

        {/* 6. Notes & Bookmarks */}
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
        
        {/* ========================================================= */}
        {/* 1. AI-POWERED VIDEO SUMMARIZATION TAB                    */}
        {/* ========================================================= */}
        {activeTab === 'summary' && (
          <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
            
            {/* Top Toolbar: Complexity Selector & Re-Summarize Action */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-800 bg-slate-900/80">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Depth Level:</span>
                <div className="flex rounded-lg bg-slate-950 p-0.5 border border-slate-800">
                  {(['Executive', 'Standard', 'Deep Dive'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => handleGenerateSummary(lvl)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                        summaryComplexity === lvl
                          ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleGenerateSummary(summaryComplexity)}
                  disabled={isSummarizing}
                  className="flex items-center gap-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 px-3 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
                >
                  <RotateCw className={`h-3 w-3 ${isSummarizing ? 'animate-spin' : ''}`} />
                  <span>{isSummarizing ? 'Synthesizing with Gemini...' : 'Regenerate'}</span>
                </button>

                <button
                  onClick={handleCopySummary}
                  className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  {copiedSummary ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedSummary ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Overview Card */}
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  <Sparkles className="h-4 w-4" /> AI Executive Overview
                </div>
                {summaryData?.readingTimeMinutes && (
                  <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono text-cyan-300 border border-cyan-500/20">
                    ~{summaryData.readingTimeMinutes} min read
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal">
                {summaryData?.overview || video.description}
              </p>
            </div>

            {/* Key Topics & Concepts */}
            {summaryData?.keyTopics && summaryData.keyTopics.length > 0 && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-cyan-400" /> Key Thematic Pillars
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {summaryData.keyTopics.map((topic, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-1.5 hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-100">{topic.topic}</span>
                        {topic.timestamp !== undefined && (
                          <button
                            onClick={() => onSeek(topic.timestamp!)}
                            className="flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-cyan-400 hover:bg-slate-700 transition-colors shrink-0"
                          >
                            <Clock className="h-2.5 w-2.5" /> {formatTime(topic.timestamp)}
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{topic.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Significant Chronological Events Breakdown */}
            {summaryData?.keyEvents && summaryData.keyEvents.length > 0 && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> Chronological Milestone Timeline
                </h4>
                <div className="space-y-2">
                  {summaryData.keyEvents.map((evt, idx) => (
                    <div
                      key={idx}
                      onClick={() => onSeek(evt.timestamp)}
                      className="group cursor-pointer rounded-xl border border-slate-800 bg-slate-900/60 p-3 hover:border-cyan-500/50 hover:bg-slate-800/60 transition-all flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100 group-hover:text-cyan-300 transition-colors truncate">
                            {evt.title}
                          </span>
                          {evt.importance === 'high' && (
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 border border-emerald-500/30">
                              HIGH IMPACT
                            </span>
                          )}
                        </div>
                        <p className="text-slate-300 leading-relaxed">{evt.eventDescription}</p>
                      </div>

                      <div className="flex items-center gap-1 font-mono text-[11px] text-cyan-400 bg-slate-900 px-2 py-1 rounded-md shrink-0 border border-slate-800">
                        <Play className="h-2.5 w-2.5 fill-current" /> {formatTime(evt.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strategic Actionable Takeaways */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Strategic Actionable Takeaways
              </h4>
              <div className="space-y-2">
                {(summaryData?.takeaways || video.keyTakeaways || []).map((point, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{point}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 2. REAL-TIME TRANSCRIPT & MULTI-LANGUAGE TRANSLATION     */}
        {/* ========================================================= */}
        {activeTab === 'transcript' && (
          <div className="space-y-3.5">
            
            {/* Language Selection & Translation Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-800 bg-slate-900/80">
              
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <Globe className="h-4 w-4 text-cyan-400 shrink-0" />
                <span className="text-xs font-medium text-slate-300 shrink-0">Language:</span>
                <select
                  value={selectedLanguage}
                  onChange={(e) => handleTranslate(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 py-1 px-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name}
                    </option>
                  ))}
                </select>

                {selectedLanguage !== 'en' && (
                  <button
                    onClick={() => setShowOriginalWithTranslation(!showOriginalWithTranslation)}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all ${
                      showOriginalWithTranslation
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <ArrowRightLeft className="h-3 w-3" />
                    <span>Dual View</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadTranscript}
                  className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <Download className="h-3 w-3 text-slate-400" />
                  <span>Export TXT</span>
                </button>
              </div>
            </div>

            {/* Translation Loading State */}
            {isTranslating && (
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3 text-xs text-cyan-300 flex items-center gap-2 animate-pulse">
                <RotateCw className="h-4 w-4 animate-spin text-cyan-400" />
                <span>Translating synchronized transcript into {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage)?.name}...</span>
              </div>
            )}

            {/* Translation Error */}
            {translationError && (
              <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <span>{translationError}</span>
              </div>
            )}

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

            {/* Transcript Lines Feed */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {filteredTranscript.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No matching transcript lines found.
                </div>
              ) : (
                filteredTranscript.map((item, idx) => {
                  const isActive = currentTime >= item.startTime && currentTime <= item.endTime;
                  const origItem = video.transcript?.[idx];

                  return (
                    <div
                      key={item.id || idx}
                      onClick={() => onSeek(item.startTime)}
                      ref={isActive ? activeTranscriptRef : null}
                      className={`cursor-pointer rounded-xl p-3 transition-all text-xs border ${
                        isActive
                          ? 'border-cyan-500/80 bg-cyan-950/40 text-slate-100 shadow-md shadow-cyan-950/50'
                          : 'border-slate-800/80 bg-slate-900/50 hover:bg-slate-800/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
                        <span className="font-semibold text-cyan-400 flex items-center gap-1.5">
                          {isActive && <Volume2 className="h-3 w-3 text-cyan-400 animate-pulse" />}
                          {item.speaker || 'Speaker'}
                        </span>
                        <span className={`rounded px-1.5 py-0.5 text-xs ${isActive ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-cyan-300'}`}>
                          {formatTime(item.startTime)}
                        </span>
                      </div>

                      <p className={`leading-relaxed ${isActive ? 'font-semibold text-cyan-100 text-sm' : 'text-slate-200'}`}>
                        {item.text}
                      </p>

                      {/* Dual View: Show original beneath translation */}
                      {showOriginalWithTranslation && selectedLanguage !== 'en' && origItem && (
                        <div className="mt-1.5 pt-1.5 border-t border-slate-800 text-[11px] text-slate-400 italic">
                          <span className="text-[10px] uppercase font-mono text-slate-500 mr-1.5">EN:</span>
                          {origItem.text}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. CHAPTERS & TOPIC SHIFTS DETECTION                     */}
        {/* ========================================================= */}
        {activeTab === 'chapters' && (
          <div className="space-y-3.5">
            
            {/* Top Toolbar: Topic Shift Sensitivity & Re-detection */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-800 bg-slate-900/80">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Shift Sensitivity:</span>
                <div className="flex rounded-lg bg-slate-950 p-0.5 border border-slate-800">
                  {(['standard', 'medium', 'high'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => handleDetectChapters(lvl)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all capitalize ${
                        chapterSensitivity === lvl
                          ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleDetectChapters(chapterSensitivity)}
                disabled={isDetectingChapters}
                className="flex items-center gap-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 px-3 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
              >
                <RotateCw className={`h-3 w-3 ${isDetectingChapters ? 'animate-spin' : ''}`} />
                <span>{isDetectingChapters ? 'Detecting Shifts...' : 'Detect Shifts'}</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {video.chapters?.map((ch, idx) => {
                const isActive = currentTime >= ch.startTime && currentTime <= ch.endTime;
                
                const shiftColor =
                  ch.topicShiftType === 'technical_deep_dive'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                    : ch.topicShiftType === 'scene_change'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : ch.topicShiftType === 'conclusion'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';

                return (
                  <div
                    key={ch.id || idx}
                    onClick={() => onSeek(ch.startTime)}
                    className={`group cursor-pointer rounded-xl p-3 border transition-all ${
                      isActive
                        ? 'border-cyan-500/80 bg-cyan-950/40 shadow-md shadow-cyan-950/50'
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

                    <div className="mt-2.5 pl-8 flex flex-wrap items-center gap-2 text-[11px]">
                      {ch.topicShiftType && (
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold border ${shiftColor}`}>
                          Shift: {ch.topicShiftType.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      )}
                      {ch.confidence && (
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 font-mono">
                          Confidence: {Math.round(ch.confidence * 100)}%
                        </span>
                      )}
                      {ch.keyVisual && (
                        <span className="text-[11px] text-slate-400 italic">
                          Anchor: {ch.keyVisual}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 4. VISUAL SCENES BREAKDOWN                                */}
        {/* ========================================================= */}
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

        {/* ========================================================= */}
        {/* 5. AI CLIPS & SHORTS                                      */}
        {/* ========================================================= */}
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

        {/* ========================================================= */}
        {/* 6. TIMECODED NOTES & BOOKMARKS                            */}
        {/* ========================================================= */}
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
