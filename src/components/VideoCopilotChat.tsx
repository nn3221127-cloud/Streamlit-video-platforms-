import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  BrainCircuit,
  Globe,
  Trash2,
  Clock,
  ExternalLink,
  Bot,
  User,
  Zap,
  Mic,
  Lightbulb,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { VideoItem, ChatMessage } from '../types';

interface VideoCopilotChatProps {
  video: VideoItem;
  currentTime: number;
  onSeek: (time: number) => void;
  onOpenVoiceQuery: () => void;
}

const QUICK_PROMPTS = [
  'Summarize the core technical architecture',
  'What is being discussed at the current timestamp?',
  'List 3 challenging quiz questions based on this video',
  'Explain the practical applications and benchmarks',
];

export const VideoCopilotChat: React.FC<VideoCopilotChatProps> = ({
  video,
  currentTime,
  onSeek,
  onOpenVoiceQuery,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useThinkingHigh, setUseThinkingHigh] = useState(false);
  const [useSearchGrounding, setUseSearchGrounding] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history for current video
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/chat/${video.id}`);
        const data = await res.json();
        if (data.success && data.history) {
          setMessages(data.history);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    };
    fetchHistory();
  }, [video.id]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (customPrompt?: string) => {
    const query = (customPrompt || inputMessage).trim();
    if (!query || isLoading) return;

    setInputMessage('');
    setIsLoading(true);

    // Optimistic user message
    const tempUserMsg: ChatMessage = {
      id: `user-temp-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.id,
          message: query,
          currentPlaybackTime: currentTime,
          useThinkingHigh,
          useSearchGrounding,
        }),
      });

      const data = await res.json();
      if (data.success && data.history) {
        setMessages(data.history);
      }
    } catch (err) {
      console.error('Chat query failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = async () => {
    try {
      const res = await fetch(`/api/chat/${video.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setMessages(data.history || []);
      }
    } catch (err) {
      console.error('Failed to clear chat:', err);
    }
  };

  // Render clickable timestamp tags inside message text
  const renderMessageContent = (content: string) => {
    const parts = content.split(/(\[\d{1,2}:\d{2}\])/g);
    return parts.map((part, i) => {
      const match = part.match(/\[(\d{1,2}):(\d{2})\]/);
      if (match) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const totalSec = min * 60 + sec;
        return (
          <button
            key={i}
            onClick={() => onSeek(totalSec)}
            className="inline-flex items-center gap-0.5 rounded bg-cyan-950/80 px-1.5 py-0.5 font-mono text-[11px] font-bold text-cyan-300 border border-cyan-500/40 hover:bg-cyan-900 transition-colors mx-0.5 align-baseline"
          >
            <Clock className="h-2.5 w-2.5" />
            {part}
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-800/80 bg-[#0c1220]/80 backdrop-blur-xl shadow-xl overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 p-3.5 bg-slate-900/50">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-1.5">
              Gemini Video Copilot
              <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[9px] font-mono text-emerald-400 border border-emerald-500/20">
                Grounded
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">Context: {video.title.slice(0, 32)}...</p>
          </div>
        </div>

        <button
          onClick={handleClearChat}
          title="Reset Conversation"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Intelligence Config Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950/40 px-3.5 py-2 text-xs">
        
        {/* Thinking High Toggle */}
        <button
          onClick={() => setUseThinkingHigh(!useThinkingHigh)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
            useThinkingHigh
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/10'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
          }`}
        >
          <BrainCircuit className={`h-3.5 w-3.5 ${useThinkingHigh ? 'text-purple-400' : ''}`} />
          <span>Deep Thinking {useThinkingHigh ? '(HIGH)' : 'Off'}</span>
        </button>

        {/* Google Search Grounding Toggle */}
        <button
          onClick={() => setUseSearchGrounding(!useSearchGrounding)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
            useSearchGrounding
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm shadow-blue-500/10'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
          }`}
        >
          <Globe className={`h-3.5 w-3.5 ${useSearchGrounding ? 'text-blue-400' : ''}`} />
          <span>Web Grounding</span>
        </button>
      </div>

      {/* Chat Messages Stream */}
      <div className="flex-1 space-y-3.5 overflow-y-auto p-3.5 max-h-[480px]">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 text-xs ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 mt-0.5">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3 leading-relaxed ${
                  isUser
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-900/30'
                    : 'bg-slate-900/90 text-slate-200 border border-slate-800 shadow-sm'
                }`}
              >
                <div className="whitespace-pre-wrap">{renderMessageContent(msg.content)}</div>

                {/* Grounding Web Links */}
                {msg.groundedWebUrls && msg.groundedWebUrls.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1">
                    <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider block">
                      Google Search Sources
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {msg.groundedWebUrls.map((g, idx) => (
                        <a
                          key={idx}
                          href={g.uri}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] text-blue-300 hover:bg-slate-700 transition-colors"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          <span className="truncate max-w-[160px]">{g.title || g.uri}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300 mt-0.5">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-2.5 text-xs">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 animate-pulse">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-slate-900/90 px-3.5 py-2.5 text-slate-400 border border-slate-800">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
              <span>Analyzing multimodal context & transcript...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Questions */}
      <div className="border-t border-slate-800/80 bg-slate-950/30 p-2 overflow-x-auto scrollbar-none flex gap-1.5">
        {QUICK_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(prompt)}
            className="shrink-0 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-[11px] text-slate-300 hover:border-cyan-500/50 hover:bg-slate-800 hover:text-cyan-300 transition-all flex items-center gap-1"
          >
            <Lightbulb className="h-3 w-3 text-cyan-400" />
            <span>{prompt}</span>
          </button>
        ))}
      </div>

      {/* Message Input Bar */}
      <div className="border-t border-slate-800 p-2.5 bg-slate-900/80">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <button
            type="button"
            onClick={onOpenVoiceQuery}
            title="Voice input"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:border-cyan-500 hover:text-cyan-300 transition-all"
          >
            <Mic className="h-4 w-4 text-cyan-400" />
          </button>

          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={`Ask about this video (at ${formatTime(currentTime)})...`}
            className="flex-1 rounded-xl border border-slate-700/80 bg-slate-950/80 py-2 px-3 text-xs text-slate-100 placeholder-slate-400 focus:border-cyan-500 focus:outline-none"
          />

          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 transition-all"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
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
