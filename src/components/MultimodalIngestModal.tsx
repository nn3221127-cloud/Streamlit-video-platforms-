import React, { useState } from 'react';
import {
  UploadCloud,
  Link2,
  FileVideo,
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react';
import { VideoItem } from '../types';

interface MultimodalIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoIngested: (video: VideoItem) => void;
}

export const MultimodalIngestModal: React.FC<MultimodalIngestModalProps> = ({
  isOpen,
  onClose,
  onVideoIngested,
}) => {
  if (!isOpen) return null;

  const [mode, setMode] = useState<'url' | 'upload' | 'transcript'>('url');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [category, setCategory] = useState('AI & Machine Learning');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadedBase64, setUploadedBase64] = useState<string | undefined>();
  const [uploadMime, setUploadMime] = useState<string>('video/mp4');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFileName(file.name);
    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
    }
    setUploadMime(file.type || 'video/mp4');

    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = reader.result as string;
      const base64Content = resultStr.split(',')[1];
      setUploadedBase64(base64Content);
    };
    reader.readAsDataURL(file);
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please provide a video title.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/videos/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          url: videoUrl || (mode === 'upload' ? 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' : undefined),
          transcriptText: transcriptText || undefined,
          uploadedVideoBase64: uploadedBase64,
          mimeType: uploadMime,
          category,
          duration: 360,
        }),
      });

      const data = await res.json();
      if (data.success && data.video) {
        onVideoIngested(data.video);
        onClose();
      } else {
        setErrorMsg(data.error || 'Failed to ingest and index video stream.');
      }
    } catch (err: any) {
      console.error('Ingest error:', err);
      setErrorMsg('Network error while communicating with Gemini Video Intelligence engine.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-700/80 bg-[#0c1220] p-6 shadow-2xl shadow-cyan-950/50">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md text-white">
            <UploadCloud className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Multimodal Video Ingestion</h2>
            <p className="text-xs text-slate-400">
              Ingest MP4/HLS streams or transcripts for instant Gemini semantic indexing.
            </p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-3 gap-2 mb-4 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-semibold transition-all ${
              mode === 'url' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Link2 className="h-3.5 w-3.5" /> Video URL
          </button>
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-semibold transition-all ${
              mode === 'upload' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileVideo className="h-3.5 w-3.5" /> Upload File
          </button>
          <button
            type="button"
            onClick={() => setMode('transcript')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-semibold transition-all ${
              mode === 'transcript' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="h-3.5 w-3.5" /> Transcript/Text
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleIngest} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Video Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Next-Gen Space Telescopes & Spectral Discovery"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 px-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 px-3 text-slate-100 focus:border-cyan-500 focus:outline-none"
              >
                <option>AI & Machine Learning</option>
                <option>Quantum Computing</option>
                <option>Robotics & Automation</option>
                <option>Space & Astronomy</option>
                <option>Biotech & Genomics</option>
                <option>Cybersecurity & Cloud</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Topic Tag</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary or domain"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 px-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          {mode === 'url' && (
            <div>
              <label className="block text-slate-300 font-medium mb-1">Video Stream URL (MP4 / HLS .m3u8)</label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://example.com/stream.mp4"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 px-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none font-mono text-[11px]"
              />
            </div>
          )}

          {mode === 'upload' && (
            <div>
              <label className="block text-slate-300 font-medium mb-1">Upload MP4/WebM Video</label>
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-xl cursor-pointer bg-slate-900/60 p-4 transition-colors">
                <UploadCloud className="h-6 w-6 text-cyan-400 mb-1" />
                <span className="text-slate-300 font-medium">{uploadFileName || 'Click to select video or drag & drop'}</span>
                <span className="text-[10px] text-slate-500">MP4, WebM, MKV up to 50MB</span>
                <input type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          )}

          {mode === 'transcript' && (
            <div>
              <label className="block text-slate-300 font-medium mb-1">Raw Speech or Lecture Transcript</label>
              <textarea
                rows={3}
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                placeholder="Paste speech transcript or lecture notes here. Gemini will segment into chapters and timestamps."
                className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 px-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none text-[11px]"
              />
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-red-950/50 p-2.5 text-red-300 border border-red-800 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="rounded-xl px-4 py-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 font-bold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 transition-all"
            >
              {isProcessing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Indexing Video with Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Analyze & Index Stream</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
