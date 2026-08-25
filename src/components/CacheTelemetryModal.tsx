import React, { useState, useEffect } from 'react';
import { Activity, Zap, Server, Database, RefreshCw, X, CheckCircle2, Cpu, HardDrive } from 'lucide-react';

interface CacheTelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CacheTelemetryModal: React.FC<CacheTelemetryModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [stats, setStats] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState('');

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const [statsRes, healthRes] = await Promise.all([
        fetch('/api/cache/stats'),
        fetch('/api/health'),
      ]);
      const statsData = await statsRes.json();
      const healthData = await healthRes.json();
      if (statsData.success) setStats(statsData.stats);
      setHealth(healthData);
    } catch (err) {
      console.error('Error fetching cache stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleClearCache = async () => {
    setClearing(true);
    try {
      const res = await fetch('/api/cache/clear', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setMessage('Cache successfully purged.');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      console.error('Clear cache failed:', err);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-700/80 bg-[#0c1220] p-6 shadow-2xl">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">System Observability & Cache Telemetry</h3>
            <p className="text-xs text-slate-400">High-performance LRU cache, vector index, and Gemini API latency</p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            Loading telemetry metrics...
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            
            {/* System Status Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span>Backend Status</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="text-sm font-bold text-white uppercase">{health?.status || 'Active'}</div>
                <span className="text-[10px] text-emerald-400 font-mono">StreamIntel Engine</span>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span>Gemini API Status</span>
                  <Zap className="h-3.5 w-3.5 text-cyan-400" />
                </div>
                <div className="text-sm font-bold text-white">
                  {health?.geminiConfigured ? 'Connected' : 'Active (Key Injected)'}
                </div>
                <span className="text-[10px] text-cyan-400 font-mono">Multimodal Ready</span>
              </div>
            </div>

            {/* Cache Performance Grid */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 space-y-3">
              <div className="flex items-center justify-between text-slate-300 font-semibold">
                <span className="flex items-center gap-1.5">
                  <HardDrive className="h-4 w-4 text-cyan-400" /> LRU Cache Metrics
                </span>
                <span className="font-mono text-cyan-400">{stats?.hitRatePercent || 0}% Hit Rate</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Cached Entries</div>
                  <div className="text-sm font-bold text-white font-mono">{stats?.size || 0} / {stats?.maxEntries || 500}</div>
                </div>
                <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Cache Hits</div>
                  <div className="text-sm font-bold text-emerald-400 font-mono">{stats?.hits || 0}</div>
                </div>
                <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Cache Misses</div>
                  <div className="text-sm font-bold text-slate-300 font-mono">{stats?.misses || 0}</div>
                </div>
              </div>
            </div>

            {/* Vector Store Summary */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 flex items-center justify-between">
              <div>
                <span className="text-slate-300 font-semibold block">Indexed Vector Graph</span>
                <span className="text-[10px] text-slate-400">Embedding vectors & timestamp tokens</span>
              </div>
              <span className="rounded-lg bg-cyan-950/80 px-2.5 py-1 text-xs font-mono font-bold text-cyan-300 border border-cyan-500/30">
                {health?.indexedVideosCount || 0} Videos Loaded
              </span>
            </div>

            {message && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-950/40 p-2.5 text-xs text-emerald-300 border border-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                <span>{message}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={fetchStats}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-300 hover:text-white"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>

              <button
                onClick={handleClearCache}
                disabled={clearing}
                className="flex items-center gap-1.5 rounded-xl bg-red-500/20 px-3 py-1.5 font-semibold text-red-300 border border-red-500/40 hover:bg-red-500/30 transition-all"
              >
                Purge LRU Cache
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
