import { VideoItem, RecommendationRail, WatchHistoryEntry } from '../src/types';

export class RecommendationEngine {
  public getRecommendations(
    allVideos: VideoItem[],
    currentVideoId?: string,
    watchHistory: WatchHistoryEntry[] = [],
    likedVideoIds: string[] = [],
    bookmarkedVideoIds: string[] = []
  ): RecommendationRail[] {
    const currentVideo = allVideos.find((v) => v.id === currentVideoId) || allVideos[0];
    const otherVideos = allVideos.filter((v) => v.id !== currentVideo?.id);

    // 1. Build User Affinity Vector from watch history & interactions
    const affinityMap = new Map<string, number>();

    for (const h of watchHistory) {
      const vid = allVideos.find((v) => v.id === h.videoId);
      if (vid) {
        const weight = (h.progressPercent / 100) * 2 + 1;
        this.addAffinity(affinityMap, vid.category, weight * 1.5);
        for (const tag of vid.tags || []) {
          this.addAffinity(affinityMap, tag, weight);
        }
      }
    }

    for (const id of likedVideoIds) {
      const vid = allVideos.find((v) => v.id === id);
      if (vid) {
        this.addAffinity(affinityMap, vid.category, 3.0);
        for (const tag of vid.tags || []) {
          this.addAffinity(affinityMap, tag, 2.0);
        }
      }
    }

    for (const id of bookmarkedVideoIds) {
      const vid = allVideos.find((v) => v.id === id);
      if (vid) {
        this.addAffinity(affinityMap, vid.category, 2.5);
        for (const tag of vid.tags || []) {
          this.addAffinity(affinityMap, tag, 1.8);
        }
      }
    }

    // 2. Score "Up Next" rail (direct semantic affinity with current video)
    const scoredUpNext = otherVideos.map((v) => {
      let score = 0;
      if (currentVideo) {
        if (v.category === currentVideo.category) score += 3.0;
        const sharedTags = (v.tags || []).filter((t) => (currentVideo.tags || []).includes(t));
        score += sharedTags.length * 1.5;
        // Shared topic affinities
        if (currentVideo.topicAffinities && v.topicAffinities) {
          for (const ca of currentVideo.topicAffinities) {
            for (const va of v.topicAffinities) {
              if (ca.topic.toLowerCase() === va.topic.toLowerCase()) {
                score += ca.weight * va.weight * 2.0;
              }
            }
          }
        }
      }
      return { video: v, score };
    });
    scoredUpNext.sort((a, b) => b.score - a.score);

    // 3. Score "Recommended For You" rail (personalized to user's overall history)
    const scoredPersonalized = allVideos.map((v) => {
      let score = 0;
      const catScore = affinityMap.get(v.category) || 0;
      score += catScore * 2;
      for (const t of v.tags || []) {
        score += affinityMap.get(t) || 0;
      }
      // Add slight novelty boost
      score += (v.likes / 10000) * 0.5;
      return { video: v, score };
    });
    scoredPersonalized.sort((a, b) => b.score - a.score);

    // 4. "Trending Now" rail (views and likes)
    const trendingVideos = [...allVideos].sort((a, b) => b.views + b.likes * 10 - (a.views + a.likes * 10));

    // 5. "Deep Dives & Research" rail
    const deepDives = [...allVideos].filter((v) => v.duration >= 480).sort((a, b) => b.duration - a.duration);

    return [
      {
        id: 'rail-up-next',
        title: 'Up Next & Contextually Linked',
        subtitle: 'Algorithmically sequenced based on current video embeddings',
        tag: 'Instant Auto-Play',
        videos: scoredUpNext.map((s) => s.video).slice(0, 6),
      },
      {
        id: 'rail-personalized',
        title: 'Recommended For You',
        subtitle: 'Tuned dynamically to your active watch time & topic affinities',
        tag: 'Personalized Graph',
        videos: scoredPersonalized.map((s) => s.video).slice(0, 6),
      },
      {
        id: 'rail-trending',
        title: 'Trending & High-Engagement',
        subtitle: 'Fastest-growing tech explorations across the network',
        tag: 'Trending',
        videos: trendingVideos.slice(0, 6),
      },
      {
        id: 'rail-deep-dives',
        title: 'Deep Architecture & Long-Context',
        subtitle: 'Comprehensive masterclasses with dense semantic indexing',
        tag: 'In-Depth',
        videos: deepDives.slice(0, 6),
      },
    ];
  }

  private addAffinity(map: Map<string, number>, key: string, weight: number) {
    if (!key) return;
    map.set(key, (map.get(key) || 0) + weight);
  }
}
