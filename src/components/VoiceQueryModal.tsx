import React, { useState, useRef } from 'react';
import { Mic, MicOff, Sparkles, X, Check, AlertCircle, ArrowRight } from 'lucide-react';

interface VoiceQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscriptSubmitted: (queryText: string) => void;
}

export const VoiceQueryModal: React.FC<VoiceQueryModalProps> = ({
  isOpen,
  onClose,
  onTranscriptSubmitted,
}) => {
  if (!isOpen) return null;

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      setErrorMessage('');
      setTranscribedText('');
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Stop audio tracks
        stream.getTracks().forEach((t) => t.stop());
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error('Microphone access failed:', err);
      setErrorMessage('Microphone access denied or not available in this browser.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        const res = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: base64Audio,
            mimeType: 'audio/webm',
          }),
        });

        const data = await res.json();
        if (data.success && data.transcription) {
          setTranscribedText(data.transcription);
        } else {
          setTranscribedText('Could not transcribe audio accurately.');
        }
        setIsTranscribing(false);
      };
      reader.readAsDataURL(audioBlob);
    } catch (err) {
      console.error('Transcription error:', err);
      setIsTranscribing(false);
      setErrorMessage('Failed to send audio to Gemini transcribe engine.');
    }
  };

  const handleSubmit = () => {
    if (transcribedText.trim()) {
      onTranscriptSubmitted(transcribedText.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-700/80 bg-[#0c1220] p-6 shadow-2xl text-center">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 mb-4">
          <Mic className="h-7 w-7" />
        </div>

        <h3 className="text-base font-bold text-white mb-1">
          Gemini Multimodal Voice Commander
        </h3>
        <p className="text-xs text-slate-400 mb-6">
          Speak your query or prompt naturally. Gemini will transcribe and ground answers in the video stream.
        </p>

        {/* Live Audio Visualizer Circle */}
        <div className="my-6 flex flex-col items-center justify-center">
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isTranscribing}
            className={`relative flex h-24 w-24 items-center justify-center rounded-full transition-all ${
              isRecording
                ? 'bg-rose-500 text-white shadow-2xl shadow-rose-500/50 scale-110 animate-pulse'
                : 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-xl shadow-cyan-500/30 hover:scale-105 active:scale-95'
            }`}
          >
            {isRecording ? (
              <MicOff className="h-10 w-10" />
            ) : (
              <Mic className="h-10 w-10" />
            )}

            {isRecording && (
              <span className="absolute inset-0 rounded-full border-4 border-rose-400 animate-ping opacity-75" />
            )}
          </button>

          <span className="mt-3 text-xs font-semibold text-slate-300">
            {isRecording
              ? 'Listening... Click to stop'
              : isTranscribing
              ? 'Transcribing audio with Gemini...'
              : 'Click to start speaking'}
          </span>
        </div>

        {/* Transcribed Text Output */}
        {transcribedText && (
          <div className="mb-4 rounded-xl border border-cyan-500/40 bg-cyan-950/20 p-3 text-left">
            <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider block mb-1">
              Gemini Transcription
            </span>
            <p className="text-xs text-slate-200">{transcribedText}</p>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-950/40 p-2.5 text-xs text-red-300 border border-red-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-center gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800"
          >
            Cancel
          </button>
          {transcribedText && (
            <button
              onClick={handleSubmit}
              className="flex items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-md shadow-cyan-500/30 hover:bg-cyan-400"
            >
              <span>Ask Copilot</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
