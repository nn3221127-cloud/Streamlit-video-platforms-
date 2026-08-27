/**
 * Operation-Based Conflict-Free Replicated Data Type (CRDT) Engine
 * Manages video playback state, live annotations, timeline comments, and chat messages
 * across dynamic WebRTC mesh networks with sub-10ms clock drift synchronization.
 */

import { HLCTimestamp, HybridLogicalClock } from './hlc';

export type CRDTOpType =
  | 'SET_PLAYBACK'
  | 'ADD_ANNOTATION'
  | 'DELETE_ANNOTATION'
  | 'ADD_CHAT'
  | 'ADD_REACTION';

export interface PlaybackPayload {
  isPlaying: boolean;
  currentTime: number;
  playbackSpeed: number;
  videoId: string;
}

export interface AnnotationPayload {
  id: string;
  videoId: string;
  timestamp: number;
  text: string;
  x?: number;
  y?: number;
  color?: string;
  authorId: string;
  authorName: string;
}

export interface ChatPayload {
  id: string;
  userId: string;
  userName: string;
  text: string;
  videoTimestamp?: number;
}

export interface ReactionPayload {
  id: string;
  userId: string;
  userName: string;
  emoji: string;
  x: number;
}

export interface CRDTOperation {
  opId: string;
  type: CRDTOpType;
  hlc: HLCTimestamp;
  nodeId: string;
  payload: PlaybackPayload | AnnotationPayload | ChatPayload | ReactionPayload | { id: string };
}

export interface CRDTStateSnapshot {
  playbackState: {
    isPlaying: boolean;
    currentTime: number;
    playbackSpeed: number;
    videoId: string;
    lastUpdatedHLC: HLCTimestamp;
  };
  annotations: Record<string, AnnotationPayload>;
  chatMessages: ChatPayload[];
  reactions: ReactionPayload[];
  vectorClock: Record<string, number>; // nodeId -> max physical/logical time
}

export class OperationBasedCRDT {
  private hlc: HybridLogicalClock;
  private nodeId: string;

  // CRDT State
  private currentPlayback: {
    isPlaying: boolean;
    currentTime: number;
    playbackSpeed: number;
    videoId: string;
    lastUpdatedHLC: HLCTimestamp;
  };

  private annotations: Map<string, { data: AnnotationPayload; hlc: HLCTimestamp; deleted: boolean }> = new Map();
  private chatMessages: Map<string, { data: ChatPayload; hlc: HLCTimestamp }> = new Map();
  private reactions: Map<string, { data: ReactionPayload; hlc: HLCTimestamp }> = new Map();

  // Operation log & vector clock tracking
  private opLog: CRDTOperation[] = [];
  private appliedOpIds: Set<string> = new Set();
  private vectorClock: Map<string, HLCTimestamp> = new Map();

  private onStateChangeCallbacks: Array<(snapshot: CRDTStateSnapshot, op: CRDTOperation, isLocal: boolean) => void> = [];

  constructor(nodeId: string) {
    this.nodeId = nodeId;
    this.hlc = new HybridLogicalClock(nodeId);

    const initHLC = this.hlc.now();
    this.currentPlayback = {
      isPlaying: false,
      currentTime: 0,
      playbackSpeed: 1.0,
      videoId: '',
      lastUpdatedHLC: initHLC,
    };
    this.vectorClock.set(nodeId, initHLC);
  }

  public getNodeId(): string {
    return this.nodeId;
  }

  public getHLC(): HybridLogicalClock {
    return this.hlc;
  }

  public subscribe(callback: (snapshot: CRDTStateSnapshot, op: CRDTOperation, isLocal: boolean) => void): () => void {
    this.onStateChangeCallbacks.push(callback);
    return () => {
      this.onStateChangeCallbacks = this.onStateChangeCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Generates and applies a new local CRDT operation.
   */
  public createOperation(
    type: CRDTOpType,
    payload: PlaybackPayload | AnnotationPayload | ChatPayload | ReactionPayload | { id: string }
  ): CRDTOperation {
    const ts = this.hlc.now();
    const op: CRDTOperation = {
      opId: `op-${this.nodeId}-${ts.physicalTime}-${ts.logicalTime}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      hlc: ts,
      nodeId: this.nodeId,
      payload,
    };

    this.applyOperation(op, true);
    return op;
  }

  /**
   * Applies an operation (local or remote) enforcing deterministic LWW / CRDT convergence rules.
   */
  public applyOperation(op: CRDTOperation, isLocal = false): boolean {
    if (this.appliedOpIds.has(op.opId)) {
      return false; // Idempotent duplicate rejection
    }

    // Update local HLC with remote timestamp if remote
    if (!isLocal) {
      this.hlc.update(op.hlc);
    }

    this.appliedOpIds.add(op.opId);
    this.opLog.push(op);

    // Update vector clock for peer node
    const prevVC = this.vectorClock.get(op.nodeId);
    if (!prevVC || HybridLogicalClock.compare(op.hlc, prevVC) > 0) {
      this.vectorClock.set(op.nodeId, op.hlc);
    }

    let applied = false;

    switch (op.type) {
      case 'SET_PLAYBACK': {
        const payload = op.payload as PlaybackPayload;
        // Last-Write-Wins (LWW) resolution based on HLC comparison
        if (HybridLogicalClock.compare(op.hlc, this.currentPlayback.lastUpdatedHLC) > 0) {
          this.currentPlayback = {
            isPlaying: payload.isPlaying,
            currentTime: payload.currentTime,
            playbackSpeed: payload.playbackSpeed || 1.0,
            videoId: payload.videoId || this.currentPlayback.videoId,
            lastUpdatedHLC: op.hlc,
          };
          applied = true;
        }
        break;
      }

      case 'ADD_ANNOTATION': {
        const payload = op.payload as AnnotationPayload;
        const existing = this.annotations.get(payload.id);
        if (!existing || HybridLogicalClock.compare(op.hlc, existing.hlc) > 0) {
          this.annotations.set(payload.id, {
            data: payload,
            hlc: op.hlc,
            deleted: existing ? existing.deleted : false,
          });
          applied = true;
        }
        break;
      }

      case 'DELETE_ANNOTATION': {
        const payload = op.payload as { id: string };
        const existing = this.annotations.get(payload.id);
        if (existing) {
          if (HybridLogicalClock.compare(op.hlc, existing.hlc) >= 0) {
            existing.deleted = true;
            existing.hlc = op.hlc;
            applied = true;
          }
        } else {
          // Tombstone pre-record
          this.annotations.set(payload.id, {
            data: { id: payload.id } as AnnotationPayload,
            hlc: op.hlc,
            deleted: true,
          });
          applied = true;
        }
        break;
      }

      case 'ADD_CHAT': {
        const payload = op.payload as ChatPayload;
        if (!this.chatMessages.has(payload.id)) {
          this.chatMessages.set(payload.id, { data: payload, hlc: op.hlc });
          applied = true;
        }
        break;
      }

      case 'ADD_REACTION': {
        const payload = op.payload as ReactionPayload;
        if (!this.reactions.has(payload.id)) {
          this.reactions.set(payload.id, { data: payload, hlc: op.hlc });
          applied = true;
        }
        break;
      }
    }

    if (applied) {
      const snap = this.getSnapshot();
      for (const cb of this.onStateChangeCallbacks) {
        cb(snap, op, isLocal);
      }
    }

    return applied;
  }

  /**
   * Merges remote operations and vector clocks during network synchronization or partition healing.
   */
  public mergeStateVector(remoteOps: CRDTOperation[]): number {
    // Sort remote operations in causal order using HLC
    const sorted = [...remoteOps].sort((a, b) => HybridLogicalClock.compare(a.hlc, b.hlc));
    let appliedCount = 0;

    for (const op of sorted) {
      if (this.applyOperation(op, false)) {
        appliedCount++;
      }
    }

    return appliedCount;
  }

  /**
   * Returns missing operations for a remote peer given its vector clock snapshot.
   */
  public getDeltaOperations(remoteVC: Record<string, HLCTimestamp>): CRDTOperation[] {
    return this.opLog.filter((op) => {
      const remotePeerTs = remoteVC[op.nodeId];
      if (!remotePeerTs) return true; // Peer has not seen ops from op.nodeId
      return HybridLogicalClock.compare(op.hlc, remotePeerTs) > 0;
    });
  }

  public getOpLog(): CRDTOperation[] {
    return [...this.opLog];
  }

  public getVectorClock(): Record<string, HLCTimestamp> {
    const vc: Record<string, HLCTimestamp> = {};
    this.vectorClock.forEach((ts, nodeId) => {
      vc[nodeId] = { ...ts };
    });
    return vc;
  }

  /**
   * Returns clean current state snapshot.
   */
  public getSnapshot(): CRDTStateSnapshot {
    const activeAnnotations: Record<string, AnnotationPayload> = {};
    this.annotations.forEach((val, key) => {
      if (!val.deleted) {
        activeAnnotations[key] = val.data;
      }
    });

    const chats = Array.from(this.chatMessages.values())
      .sort((a, b) => HybridLogicalClock.compare(a.hlc, b.hlc))
      .map((item) => item.data);

    const reactList = Array.from(this.reactions.values())
      .sort((a, b) => HybridLogicalClock.compare(a.hlc, b.hlc))
      .map((item) => item.data);

    const vcNum: Record<string, number> = {};
    this.vectorClock.forEach((ts, nodeId) => {
      vcNum[nodeId] = ts.physicalTime;
    });

    return {
      playbackState: { ...this.currentPlayback },
      annotations: activeAnnotations,
      chatMessages: chats,
      reactions: reactList,
      vectorClock: vcNum,
    };
  }
}
