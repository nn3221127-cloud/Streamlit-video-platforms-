import { VideoItem, SearchResult } from '../src/types';

interface IndexedDoc {
  video: VideoItem;
  fullText: string;
  tokens: Set<string>;
  tf: Map<string, number>;
  vector: number[];
  segments: {
    startTime: number;
    text: string;
    tokens: Set<string>;
  }[];
}

export class InMemoryVectorStore {
  private docs: Map<string, IndexedDoc> = new Map();
  private vocabulary: Map<string, number> = new Map(); // term -> idf
  private isIndexed: boolean = false;

  constructor(initialVideos: VideoItem[] = []) {
    this.indexVideos(initialVideos);
  }

  public indexVideos(videos: VideoItem[]) {
    this.docs.clear();
    this.vocabulary.clear();

    const allTokenDocs: string[][] = [];

    // 1. Build document representations
    for (const video of videos) {
      const parts: string[] = [
        video.title,
        video.description,
        video.category,
        ...(video.tags || []),
        ...(video.keyTakeaways || []),
        ...(video.chapters || []).map((c) => `${c.title} ${c.summary}`),
        ...(video.transcript || []).map((t) => t.text),
      ];

      const fullText = parts.join(' ').toLowerCase();
      const tokens = this.tokenize(fullText);
      const tokenArray = Array.from(tokens);
      allTokenDocs.push(tokenArray);

      // Term Frequency
      const tf = new Map<string, number>();
      for (const token of tokenArray) {
        tf.set(token, (tf.get(token) || 0) + 1);
      }

      // Segments for fine-grained timestamp matching
      const segments: { startTime: number; text: string; tokens: Set<string> }[] = [];
      if (video.transcript && video.transcript.length > 0) {
        for (const tr of video.transcript) {
          segments.push({
            startTime: tr.startTime,
            text: tr.text,
            tokens: this.tokenize(tr.text.toLowerCase()),
          });
        }
      } else if (video.chapters && video.chapters.length > 0) {
        for (const ch of video.chapters) {
          segments.push({
            startTime: ch.startTime,
            text: `${ch.title}: ${ch.summary}`,
            tokens: this.tokenize(`${ch.title} ${ch.summary}`.toLowerCase()),
          });
        }
      }

      this.docs.set(video.id, {
        video,
        fullText,
        tokens,
        tf,
        vector: [],
        segments,
      });
    }

    // 2. Compute IDF
    const totalDocs = videos.length;
    for (const docTokens of allTokenDocs) {
      const uniqueTokens = new Set(docTokens);
      for (const token of uniqueTokens) {
        this.vocabulary.set(token, (this.vocabulary.get(token) || 0) + 1);
      }
    }

    for (const [term, docCount] of this.vocabulary.entries()) {
      this.vocabulary.set(term, Math.log((totalDocs + 1) / (docCount + 1)) + 1);
    }

    // 3. Generate dense-like normalized TF-IDF vector embeddings
    const vocabList = Array.from(this.vocabulary.keys());
    for (const doc of this.docs.values()) {
      const vector: number[] = new Array(vocabList.length).fill(0);
      let normSq = 0;
      for (let i = 0; i < vocabList.length; i++) {
        const term = vocabList[i];
        const tfVal = doc.tf.get(term) || 0;
        const idfVal = this.vocabulary.get(term) || 1;
        const weight = tfVal * idfVal;
        vector[i] = weight;
        normSq += weight * weight;
      }
      const norm = Math.sqrt(normSq) || 1;
      doc.vector = vector.map((v) => v / norm);
    }

    this.isIndexed = true;
  }

  public addOrUpdateVideo(video: VideoItem) {
    const existing = Array.from(this.docs.values()).map((d) => d.video);
    const filtered = existing.filter((v) => v.id !== video.id);
    filtered.unshift(video);
    this.indexVideos(filtered);
  }

  public search(query: string, categoryFilter?: string, limit: number = 10): SearchResult[] {
    if (!query || query.trim().length === 0) {
      // Return top videos
      return Array.from(this.docs.values())
        .filter((d) => !categoryFilter || categoryFilter === 'All' || d.video.category === categoryFilter)
        .slice(0, limit)
        .map((d) => ({
          video: d.video,
          score: 1.0,
          matchType: 'lexical',
        }));
    }

    const cleanQuery = query.toLowerCase();
    const queryTokens = this.tokenize(cleanQuery);
    const vocabList = Array.from(this.vocabulary.keys());

    // Compute Query Vector
    const queryVector: number[] = new Array(vocabList.length).fill(0);
    let qNormSq = 0;
    for (let i = 0; i < vocabList.length; i++) {
      const term = vocabList[i];
      if (queryTokens.has(term)) {
        const idf = this.vocabulary.get(term) || 1;
        queryVector[i] = idf;
        qNormSq += idf * idf;
      }
    }
    const qNorm = Math.sqrt(qNormSq) || 1;
    const normQueryVector = queryVector.map((v) => v / qNorm);

    const results: SearchResult[] = [];

    for (const doc of this.docs.values()) {
      if (categoryFilter && categoryFilter !== 'All' && doc.video.category !== categoryFilter) {
        continue;
      }

      // 1. Vector Cosine Similarity
      let dotProduct = 0;
      for (let i = 0; i < doc.vector.length; i++) {
        dotProduct += doc.vector[i] * normQueryVector[i];
      }
      const vectorScore = Math.max(0, dotProduct);

      // 2. Lexical & Exact Substring Match
      let lexicalHits = 0;
      for (const qt of queryTokens) {
        if (doc.tokens.has(qt)) {
          lexicalHits += 1;
        }
      }
      const lexicalCoverage = queryTokens.size > 0 ? lexicalHits / queryTokens.size : 0;
      const exactTitleBoost = doc.video.title.toLowerCase().includes(cleanQuery) ? 0.35 : 0;
      const tagBoost = (doc.video.tags || []).some((t) => t.toLowerCase().includes(cleanQuery)) ? 0.2 : 0;

      // 3. Find closest temporal segment
      let bestSegment: { startTime: number; text: string } | undefined;
      let maxSegHits = 0;
      for (const seg of doc.segments) {
        let segHits = 0;
        for (const qt of queryTokens) {
          if (seg.tokens.has(qt)) segHits++;
        }
        if (segHits > maxSegHits) {
          maxSegHits = segHits;
          bestSegment = {
            startTime: seg.startTime,
            text: seg.text,
          };
        }
      }

      // Combined Hybrid Score
      const hybridScore = vectorScore * 0.5 + lexicalCoverage * 0.3 + exactTitleBoost + tagBoost;

      if (hybridScore > 0.05 || lexicalCoverage > 0.3) {
        results.push({
          video: doc.video,
          score: Math.min(0.99, Number(hybridScore.toFixed(4))),
          matchType: vectorScore > 0.4 ? 'hybrid' : lexicalHits > 0 ? 'lexical' : 'vector',
          matchedSegment: bestSegment,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  private tokenize(text: string): Set<string> {
    const raw = text.replace(/[^\w\s]/g, ' ').split(/\s+/);
    const tokens = new Set<string>();
    for (const word of raw) {
      if (word.length >= 2) {
        tokens.add(word);
      }
    }
    return tokens;
  }
}
