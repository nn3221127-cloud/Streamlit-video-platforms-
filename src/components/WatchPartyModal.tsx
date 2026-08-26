import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Radio,
  Play,
  Pause,
  Send,
  Sparkles,
  Flame,
  Heart,
  Lightbulb,
  Zap,
  MessageSquare,
  Copy,
  Check,
  Share2,
  Tv,
  Clock,
} from 'lucide-react';
import { WatchPartyRoom, VideoItem, UserAccount } from '../types';

interface WatchPartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: VideoItem;
  currentTime: number;
  currentUser: UserAccount | null;
  activeRoom: WatchPartyRoom | null;
  onJoinOrCreateRoom: (room: WatchPartyRoom) => void;
  onLeaveRoom: () => void;
  onSeek: (time: number) => void;
  onSendPartyReaction: (emoji: string) => void;
}

export const WatchPartyModal: React.FC<WatchPartyModalProps> = ({
  isOpen,
  onClose,
  video,
  currentTime,
  currentUser,
  activeRoom,
  onJoinOrCreateRoom,
  onLeaveRoom,
  onSeek,
  onSendPartyReaction,
}) => {
  const [viewMode, setViewMode] = useState<'create' | 'join' | 'active'>(activeRoom ? 'active' : 'create');
  const [roomNameInput, setRoomNameInput] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [timelineCommentText, setTimelineCommentText] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [publicRooms, setPublicRooms] = useState<WatchPartyRoom[]>([]);

  // Keep viewMode synced if activeRoom changes
  useEffect(() => {
    if (activeRoom) {
      setViewMode('active');
    }
  }, [activeRoom]);

  // Load public rooms
  useEffect(() => {
    if (isOpen && !activeRoom) {
      fetch('/api/rooms')
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.rooms) setPublicRooms(d.rooms);
        })
        .catch(() => {});
    }
  }, [isOpen, activeRoom]);

  if (!isOpen) return null;

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const token = localStorage.getItem('streamintel_auth_token');
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          videoId: video.id,
          roomName: roomNameInput.trim() || `${currentUser?.name || 'Collaborative'} Stream Watch`,
          userName: currentUser?.name || 'Host User',
          userAvatar: currentUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=Host`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create room');

      onJoinOrCreateRoom(data.room);
      setViewMode('active');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create room');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (targetRoomId: string) => {
    setIsLoading(true);
    setErrorMsg('');

    try {
      const token = localStorage.getItem('streamintel_auth_token');
      const res = await fetch(`/api/rooms/${encodeURIComponent(targetRoomId.trim())}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userName: currentUser?.name || 'Participant',
          userAvatar: currentUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=Viewer`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to join room');

      onJoinOrCreateRoom(data.room);
      setViewMode('active');
    } catch (err: any) {
      setErrorMsg(err.message || 'Room not found or invalid');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !activeRoom) return;

    const token = localStorage.getItem('streamintel_auth_token');
    try {
      await fetch(`/api/rooms/${activeRoom.roomId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text: chatMessage.trim(),
          userName: currentUser?.name || 'Participant',
          userAvatar: currentUser?.avatar || '',
          videoTimestamp: currentTime,
        }),
      });
      setChatMessage('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTimelineComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timelineCommentText.trim() || !activeRoom) return;

    const token = localStorage.getItem('streamintel_auth_token');
    try {
      await fetch(`/api/rooms/${activeRoom.roomId}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text: timelineCommentText.trim(),
          timestamp: Math.round(currentTime),
          userName: currentUser?.name || 'Participant',
          userAvatar: currentUser?.avatar || '',
        }),
      });
      setTimelineCommentText('');
    } catch (err) {
      console.error(err);
    }
  };

  const copyRoomLink = () => {
    if (!activeRoom) return;
    navigator.clipboard.writeText(activeRoom.roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-[#0c1220] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Top Gradient Header */}
        <div className="h-1 bg-gradient-to-r from-cyan-500 via-emerald-500 to-purple-500" />

        {/* Modal Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-400 border border-emerald-500/30">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
                Live Watch Party & Collaboration
                {activeRoom && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400 border border-emerald-500/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE ({activeRoom.participants.length})
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-[340px] sm:max-w-md">
                {activeRoom ? `${activeRoom.name} • Room Code: ${activeRoom.roomId}` : 'Synchronized video streaming with real-time chat and floating reactions.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeRoom && (
              <button
                onClick={copyRoomLink}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
                <span>{activeRoom.roomId}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mx-4 mt-3 rounded-xl border border-red-500/30 bg-red-950/40 p-2.5 text-xs text-red-300">
            {errorMsg}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeRoom ? (
            /* Active Room Controls & Chat */
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* Left Column: Room Info & Participants (Cols 1-5) */}
              <div className="md:col-span-5 space-y-3.5">
                
                {/* Sync status card */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Target Video:</span>
                    <span className="font-semibold text-cyan-400 truncate max-w-[140px]">{video.title}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Playback State:</span>
                    <span className="font-mono text-emerald-400 flex items-center gap-1 font-bold">
                      {activeRoom.playbackState.isPlaying ? <Play className="h-3 w-3 fill-current" /> : <Pause className="h-3 w-3" />}
                      {formatTime(activeRoom.playbackState.currentTime)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800">
                    <span>Host: {activeRoom.hostName}</span>
                    <span>Speed: {activeRoom.playbackState.playbackSpeed}x</span>
                  </div>
                </div>

                {/* Floating Reactions Bar */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Send Live Reactions
                  </label>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800">
                    {['🔥', '🚀', '💡', '❤️', '👏', '🤯', '⚡', '🎉'].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => onSendPartyReaction(emoji)}
                        className="h-8 w-8 text-base rounded-lg hover:bg-slate-800 hover:scale-125 transition-all flex items-center justify-center"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Participants list */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span>Participants ({activeRoom.participants.length})</span>
                  </label>
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                    {activeRoom.participants.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2.5 rounded-lg border border-slate-800/80 bg-slate-900/60 p-2 text-xs"
                      >
                        <img
                          src={p.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=User'}
                          alt={p.name}
                          className="h-6 w-6 rounded-full border border-slate-700 object-cover"
                        />
                        <span className="font-semibold text-slate-200 truncate flex-1">{p.name}</span>
                        {p.isHost && (
                          <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300">
                            HOST
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Leave Party Button */}
                <button
                  onClick={onLeaveRoom}
                  className="w-full rounded-xl border border-red-500/30 bg-red-950/20 py-2 text-xs font-bold text-red-400 hover:bg-red-950/40 transition-colors"
                >
                  Leave Watch Party
                </button>
              </div>

              {/* Right Column: Live Room Chat & Timeline Comments (Cols 6-12) */}
              <div className="md:col-span-7 flex flex-col h-[380px] rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-cyan-400" /> Watch Room Chat
                  </span>
                  <span className="text-[10px] text-slate-500">Live stream sync</span>
                </div>

                {/* Chat Messages Feed */}
                <div className="flex-1 overflow-y-auto py-2 space-y-2 pr-1">
                  {activeRoom.messages.map((m) => {
                    const isMe = m.userName === (currentUser?.name || 'Participant');
                    return (
                      <div
                        key={m.id}
                        className={`rounded-xl p-2.5 text-xs max-w-[90%] space-y-1 ${
                          m.userId === 'system'
                            ? 'mx-auto bg-slate-800/80 text-center text-slate-400 text-[11px] py-1 px-3'
                            : isMe
                            ? 'ml-auto bg-cyan-950/60 border border-cyan-500/40 text-slate-100'
                            : 'mr-auto bg-slate-800/90 border border-slate-700 text-slate-200'
                        }`}
                      >
                        {m.userId !== 'system' && (
                          <div className="flex items-center justify-between text-[10px] text-slate-400 gap-2">
                            <span className="font-bold text-cyan-300">{m.userName}</span>
                            {m.videoTimestamp !== undefined && (
                              <button
                                onClick={() => onSeek(m.videoTimestamp!)}
                                className="font-mono text-cyan-400 hover:underline flex items-center gap-0.5"
                              >
                                <Clock className="h-2.5 w-2.5" /> {formatTime(m.videoTimestamp)}
                              </button>
                            )}
                          </div>
                        )}
                        <p className="leading-relaxed">{m.text}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Chat Input */}
                <form onSubmit={handleSendMessage} className="pt-2 border-t border-slate-800 flex gap-1.5">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Send a live message..."
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-900 py-1.5 px-3 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 flex items-center gap-1"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* Create / Join Room Mode */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Create Room Card */}
                <form onSubmit={handleCreateRoom} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3.5">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                    <Radio className="h-4 w-4 text-emerald-400" /> Host a New Watch Party
                  </div>
                  <p className="text-xs text-slate-400">
                    Host a synchronized viewing room for "{video.title.slice(0, 45)}...".
                  </p>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-300">Room Title</label>
                    <input
                      type="text"
                      value={roomNameInput}
                      onChange={(e) => setRoomNameInput(e.target.value)}
                      placeholder={`${currentUser?.name || 'Team'} Intelligence Sync`}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 px-3 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors shadow-md shadow-emerald-500/20"
                  >
                    {isLoading ? 'Creating Room...' : 'Start Watch Party (Host)'}
                  </button>
                </form>

                {/* Join by Code Card */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3.5">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                    <Users className="h-4 w-4 text-cyan-400" /> Join via Room Code
                  </div>
                  <p className="text-xs text-slate-400">
                    Enter the 4-digit or custom Room Code provided by your host.
                  </p>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-300">Room Code</label>
                    <input
                      type="text"
                      value={roomIdInput}
                      onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                      placeholder="e.g. STREAM-7890 or PARTY-1234"
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 px-3 text-xs font-mono text-cyan-300 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={isLoading || !roomIdInput.trim()}
                    onClick={() => handleJoinRoom(roomIdInput)}
                    className="w-full rounded-xl bg-cyan-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors shadow-md shadow-cyan-500/20 disabled:opacity-50"
                  >
                    {isLoading ? 'Joining...' : 'Join Stream'}
                  </button>
                </div>
              </div>

              {/* Public Available Rooms */}
              {publicRooms.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Active Community Watch Rooms
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {publicRooms.map((r) => (
                      <div
                        key={r.roomId}
                        className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 flex items-center justify-between gap-2 hover:border-slate-700 transition-all"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                            <h5 className="text-xs font-bold text-slate-200 truncate">{r.name}</h5>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">{r.videoTitle}</p>
                          <span className="text-[10px] font-mono text-cyan-400">{r.participants.length} watching</span>
                        </div>
                        <button
                          onClick={() => handleJoinRoom(r.roomId)}
                          className="rounded-lg bg-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 transition-colors shrink-0"
                        >
                          Join
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
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
