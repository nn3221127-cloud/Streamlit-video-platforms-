import React from 'react';
import { Sparkles, Flame, Clock, Play, TrendingUp, Compass, Cpu } from 'lucide-react';
import { RecommendationRail, VideoItem } from '../types';

interface RecommendationRailsProps {
  rails: RecommendationRail[];
  activeVideoId: string;
  onSelectVideo: (video: VideoItem) => void;
}

export const RecommendationRails: React.FC<RecommendationRailsProps> = ({
  rails,
  activeVideoId,
  onSelectVideo,
}) => {
  if (!rails || rails.length === 0) return null;

  return (
    <div className="space-y-8">
      {rails.map((rail) => {
        // Skip empty rails
        if (!rail.videos || rail.videos.length === 0) return null;

        return (
          <div key={rail.id} className="space-y-3">
            
            {/* Rail Header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                    {rail.title}
                  </h3>
                  <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-400 border border-cyan-500/20">
                    {rail.tag}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{rail.subtitle}</p>
              </div>
            </div>

            {/* Video Cards Grid / Carousel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {rail.videos.map((video) => {
                const isActive = video.id === activeVideoId;
                return (
                  <div
                    key={video.id}
                    onClick={() => onSelectVideo(video)}
                    className={`group cursor-pointer rounded-2xl border bg-[#0d1424]/80 p-2.5 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-950/30 ${
                      isActive
                        ? 'border-cyan-500/80 ring-2 ring-cyan-500/30 shadow-lg shadow-cyan-950/40'
                        : 'border-slate-800/80 hover:border-slate-700/90'
                    }`}
                  >
                    {/* Thumbnail Container */}
                    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-800">
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      
                      {/* Play overlay on hover */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500 text-slate-950 shadow-lg">
                          <Play className="h-5 w-5 fill-current translate-x-0.5" />
                        </div>
                      </div>

                      {/* Duration Badge */}
                      <div className="absolute bottom-2 right-2 rounded-md bg-black/85 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-200 backdrop-blur-sm">
                        {formatDuration(video.duration)}
                      </div>

                      {/* Category Chip */}
                      <div className="absolute top-2 left-2 rounded-md bg-slate-950/80 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 backdrop-blur-sm border border-cyan-500/20">
                        {video.category.split(' ')[0]}
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="mt-2.5 space-y-1">
                      <h4 className="line-clamp-2 text-xs sm:text-sm font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors">
                        {video.title}
                      </h4>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <div className="flex items-center gap-1">
                          <img
                            src={video.authorAvatar}
                            alt={video.author}
                            className="h-4 w-4 rounded-full object-cover"
                          />
                          <span className="truncate max-w-[120px]">{video.author}</span>
                        </div>
                        <span>•</span>
                        <span>{formatViews(video.views)}</span>
                      </div>

                      {/* Topic Tags */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {video.tags?.slice(0, 2).map((t, idx) => (
                          <span
                            key={idx}
                            className="rounded bg-slate-800/60 px-1.5 py-0.5 text-[9px] text-slate-400"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatViews(views: number): string {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K views`;
  return `${views} views`;
}
