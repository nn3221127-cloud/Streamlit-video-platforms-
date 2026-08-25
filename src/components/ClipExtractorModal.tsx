import React, { useState } from 'react';
import { Scissors, Sparkles, Flame, Clock, Play, CheckCircle2, X, Download, Share2 } from 'lucide-react';
import { VideoItem, AIClip } from '../types';

interface ClipExtractorModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: VideoItem;
  currentTime: number;
  onSeek: (time: number) => void;
  onClipCreated?: (clip: AIClip) => void;
}

export const ClipExtractorModal: React.FC<ClipExtractorModalProps> = ({
  isOpen,
  onClose,
  video,
  currentTime,
  onSeek,
  onClipCreated,
}) => {
  if (!isOpen) return null;

  const [prompt, setPrompt] = useState('Extract the top 3 most engaging, high-retention 30-60 second clips for social media and quick learning.');
  const [isGenerating, setIsGenerating] = useState(false);
  const [clips, setClips] = useState(video.aiGeneratedClips || []);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/videos/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: video.title,
          description: video.description,
          url: video.url,
          category: video.category,
          duration: video.duration,
        }),
      });
      const data = await res.json();
      if (data.success && data.video?.aiGeneratedClips) {
        setClips(data.video.aiGeneratedClips);
      }
    } catch (err) {
      console.error('Clip generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShareClip = (clip: any) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?v=${video.id}&t=${clip.startTime}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedId(clip.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700/80 bg-[#0c1220] p-6 shadow-2xl">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
            <Scissors className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">AI Virality & Highlight Clip Extractor</h3>
            <p className="text-xs text-slate-400">Gemini analyzes audio prosody, visual novelty, and speech density to extract moments.</p>
          </div>
        </div>

        {/* Action / Re-generate banner */}
        <div className="flex items-center gap-2 mb-4">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-900 py-2 px-3 text-xs text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
          />
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50 transition-all shrink-0"
          >
            {isGenerating ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                <span>Extracting...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Re-Extract</span>
              </>
            )}
          </button>
        </div>

        {/* Clips Grid */}
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {clips.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No clips extracted yet. Click Re-Extract to generate with Gemini.
            </div>
          ) : (
            clips.map((clip) => (
              <div
                key={clip.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-all hover:border-emerald-500/50"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      {clip.title}
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-400 border border-emerald-500/20">
                        {clip.endTime - clip.startTime}s duration
                      </span>
                    </h4>
                    <p className="text-xs text-slate-300 italic mt-1">"{clip.hook}"</p>
                  </div>

                  <div className="flex items-center gap-1 rounded-lg bg-emerald-950/80 px-2.5 py-1 text-xs font-mono font-bold text-emerald-300 border border-emerald-500/30 shrink-0">
                    <Flame className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Virality: {clip.viralityScore}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                  <span className="font-mono text-slate-400 flex items-center gap-1">
                    <Clock className="h-3 w-3 text-cyan-400" />
                    {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleShareClip(clip)}
                      className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-slate-300 hover:text-white"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      <span>{copiedId === clip.id ? 'Copied Link!' : 'Share'}</span>
                    </button>
                    <button
                      onClick={() => {
                        onSeek(clip.startTime);
                        onClose();
                      }}
                      className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3.5 py-1.5 font-semibold text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Jump to Timestamp</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
