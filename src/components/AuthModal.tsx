import React, { useState } from 'react';
import {
  X,
  User,
  Mail,
  Lock,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  LogIn,
  UserPlus,
  Tv,
  Globe,
  Sliders,
  LogOut,
} from 'lucide-react';
import { UserAccount } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  onLoginSuccess: (user: UserAccount, token: string) => void;
  onLogout: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
  onLogout,
}) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'profile'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'viewer' | 'creator' | 'admin'>('viewer');
  const [preferredLang, setPreferredLang] = useState('en');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [quality, setQuality] = useState('Auto (1080p)');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  // Switch to profile if already logged in
  const isProfile = !!currentUser;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid credentials');
      }

      localStorage.setItem('streamintel_auth_token', data.token);
      onLoginSuccess(data.user, data.token);
      setSuccessMsg('Successfully authenticated!');
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, role }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Signup failed');
      }

      localStorage.setItem('streamintel_auth_token', data.token);
      onLoginSuccess(data.user, data.token);
      setSuccessMsg('Account created successfully!');
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const token = localStorage.getItem('streamintel_auth_token');
      await fetch('/api/user/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          preferences: {
            preferredLanguage: preferredLang,
            playbackSpeed,
            quality,
          },
        }),
      });
      setSuccessMsg('Preferences updated.');
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-[#0c1220] shadow-2xl p-6 overflow-hidden">
        
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-100">
              {isProfile
                ? 'User Account & Preferences'
                : mode === 'login'
                ? 'Sign in to StreamIntel'
                : 'Create StreamIntel Account'}
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            {isProfile
              ? 'Manage synchronized watch history, saved notes, and playback settings.'
              : 'Unlock personalized multi-device watch history, custom playlists, and collaborative viewing.'}
          </p>
        </div>

        {/* Error / Success Notifications */}
        {errorMsg && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            {successMsg}
          </div>
        )}

        {/* Profile Mode */}
        {isProfile ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3.5 rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="h-12 w-12 rounded-full border border-cyan-500/40 object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-100 truncate">{currentUser.name}</h3>
                  <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 border border-cyan-500/30">
                    {currentUser.badge || currentUser.role}
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate">{currentUser.email}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Member since {new Date(currentUser.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Playback Preferences Form */}
            <form onSubmit={handleSavePreferences} className="space-y-3.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-cyan-400" /> Playback & Audio Preferences
              </h4>

              <div className="space-y-1">
                <label className="text-xs text-slate-300">Default Subtitle & Translation Language</label>
                <select
                  value={preferredLang}
                  onChange={(e) => setPreferredLang(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 py-2 px-3 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="en">English (US)</option>
                  <option value="es">Spanish (Español)</option>
                  <option value="fr">French (Français)</option>
                  <option value="de">German (Deutsch)</option>
                  <option value="ja">Japanese (日本語)</option>
                  <option value="zh">Chinese (中文)</option>
                  <option value="hi">Hindi (हिन्दी)</option>
                  <option value="pt">Portuguese (Português)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Default Speed</label>
                  <select
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/90 py-2 px-3 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="0.75">0.75x</option>
                    <option value="1.0">1.0x (Normal)</option>
                    <option value="1.25">1.25x</option>
                    <option value="1.5">1.5x</option>
                    <option value="2.0">2.0x</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Streaming Quality</label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/90 py-2 px-3 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="Auto (1080p)">Auto (1080p)</option>
                    <option value="4K (2160p)">4K (2160p)</option>
                    <option value="1080p FHD">1080p FHD</option>
                    <option value="720p HD">720p HD</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors shadow-sm shadow-cyan-500/20"
                >
                  {isLoading ? 'Saving...' : 'Save Preferences'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('streamintel_auth_token');
                    onLogout();
                    onClose();
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-950/20 px-3.5 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-950/40 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign Out
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div>
            {/* Mode Switcher */}
            <div className="flex rounded-xl bg-slate-900 p-1 mb-5 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg('');
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  mode === 'login'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LogIn className="h-3.5 w-3.5" /> Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg('');
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  mode === 'signup'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" /> Register
              </button>
            </div>

            {/* Login Form */}
            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex.vance@multimodal.ai"
                      className="w-full rounded-xl border border-slate-700/80 bg-slate-900/90 py-2 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full rounded-xl border border-slate-700/80 bg-slate-900/90 py-2 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-xl bg-cyan-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors shadow-md shadow-cyan-500/20 mt-2"
                >
                  {isLoading ? 'Authenticating...' : 'Sign In'}
                </button>

                {/* Quick Demo Credentials */}
                <div className="pt-4 border-t border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-2">
                    Or select a pre-configured demo account:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickDemoLogin('alex.vance@multimodal.ai', 'password123')}
                      className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-left hover:border-cyan-500/40 transition-colors"
                    >
                      <div className="text-[11px] font-bold text-slate-200">Alex Vance</div>
                      <div className="text-[10px] text-cyan-400">AI Architect (Admin)</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDemoLogin('elena@streamintel.io', 'stream2026')}
                      className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-left hover:border-cyan-500/40 transition-colors"
                    >
                      <div className="text-[11px] font-bold text-slate-200">Elena Rostova</div>
                      <div className="text-[10px] text-purple-400">Lead Creator</div>
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              /* Signup Form */
              <form onSubmit={handleSignup} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Dr. Jordan Hayes"
                      className="w-full rounded-xl border border-slate-700/80 bg-slate-900/90 py-2 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jordan@neuralmedia.com"
                      className="w-full rounded-xl border border-slate-700/80 bg-slate-900/90 py-2 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full rounded-xl border border-slate-700/80 bg-slate-900/90 py-2 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Account Type</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-900/90 py-2 px-3 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="viewer">Viewer (Stream & Save)</option>
                    <option value="creator">Creator (Ingest & Extract Clips)</option>
                    <option value="admin">AI Administrator</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-xl bg-cyan-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors shadow-md shadow-cyan-500/20 mt-2"
                >
                  {isLoading ? 'Creating Account...' : 'Complete Registration'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
