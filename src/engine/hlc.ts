/**
 * Hybrid Logical Clock (HLC) Implementation
 * Provides strict causal ordering for distributed operations across peers
 * without relying on perfectly synchronized physical clocks.
 */

export interface HLCTimestamp {
  physicalTime: number; // Wall-clock time in ms
  logicalTime: number;  // Monotonic counter for concurrent events
  nodeId: string;       // Unique peer identifier
}

export class HybridLogicalClock {
  private physicalTime: number = 0;
  private logicalTime: number = 0;
  private readonly nodeId: string;
  private clockOffset: number = 0; // Calculated clock offset via NTP-style sync

  constructor(nodeId: string) {
    this.nodeId = nodeId;
    this.physicalTime = this.getPhysicalTime();
    this.logicalTime = 0;
  }

  public getNodeId(): string {
    return this.nodeId;
  }

  public getOffset(): number {
    return this.clockOffset;
  }

  public setOffset(offsetMs: number): void {
    this.clockOffset = offsetMs;
  }

  private getPhysicalTime(): number {
    return Date.now() + this.clockOffset;
  }

  /**
   * Generates a new HLC timestamp for a local operation.
   */
  public now(): HLCTimestamp {
    const phys = this.getPhysicalTime();
    if (phys > this.physicalTime) {
      this.physicalTime = phys;
      this.logicalTime = 0;
    } else {
      this.logicalTime += 1;
    }

    return {
      physicalTime: this.physicalTime,
      logicalTime: this.logicalTime,
      nodeId: this.nodeId,
    };
  }

  /**
   * Updates local HLC state given a timestamp received from a remote peer.
   * Ensures physical time advances monotonically and logical counters resolve concurrent events.
   */
  public update(remote: HLCTimestamp): HLCTimestamp {
    const localPhys = this.getPhysicalTime();

    if (localPhys > this.physicalTime && localPhys > remote.physicalTime) {
      this.physicalTime = localPhys;
      this.logicalTime = 0;
    } else if (remote.physicalTime === this.physicalTime) {
      this.logicalTime = Math.max(this.logicalTime, remote.logicalTime) + 1;
    } else if (remote.physicalTime > this.physicalTime) {
      this.physicalTime = remote.physicalTime;
      this.logicalTime = remote.logicalTime + 1;
    } else {
      this.logicalTime += 1;
    }

    return {
      physicalTime: this.physicalTime,
      logicalTime: this.logicalTime,
      nodeId: this.nodeId,
    };
  }

  /**
   * Compares two HLC timestamps.
   * Returns -1 if a < b, 1 if a > b, or 0 if equal.
   */
  public static compare(a: HLCTimestamp, b: HLCTimestamp): number {
    if (a.physicalTime !== b.physicalTime) {
      return a.physicalTime < b.physicalTime ? -1 : 1;
    }
    if (a.logicalTime !== b.logicalTime) {
      return a.logicalTime < b.logicalTime ? -1 : 1;
    }
    if (a.nodeId !== b.nodeId) {
      return a.nodeId < b.nodeId ? -1 : 1;
    }
    return 0;
  }

  public static toString(ts: HLCTimestamp): string {
    return `${ts.physicalTime.toString(36)}-${ts.logicalTime.toString(36)}-${ts.nodeId}`;
  }

  public static parse(str: string): HLCTimestamp | null {
    const parts = str.split('-');
    if (parts.length < 3) return null;
    return {
      physicalTime: parseInt(parts[0], 36),
      logicalTime: parseInt(parts[1], 36),
      nodeId: parts.slice(2).join('-'),
    };
  }
}

/**
 * NTP-Style Clock Sync Helper
 * Calculates sub-10ms clock drift offset using round-trip delay measurement.
 */
export interface ClockSyncMessage {
  type: 'CLOCK_SYNC_REQ' | 'CLOCK_SYNC_RESP';
  senderId: string;
  targetId: string;
  t0: number; // Sender send time
  t1?: number; // Receiver receive time
  t2?: number; // Receiver send time
  t3?: number; // Sender receive time
}

export class ClockSyncEstimator {
  private offsetSamples: number[] = [];
  private readonly maxSamples = 10;

  /**
   * Processes a completed clock sync round trip and returns calculated offset.
   * t0: Client send time
   * t1: Remote receive time
   * t2: Remote respond time
   * t3: Client receive response time
   */
  public processSyncRoundTrip(t0: number, t1: number, t2: number, t3: number): { offset: number; rtt: number } {
    const rtt = (t3 - t0) - (t2 - t1);
    const offset = ((t1 - t0) + (t2 - t3)) / 2;

    this.offsetSamples.push(offset);
    if (this.offsetSamples.length > this.maxSamples) {
      this.offsetSamples.shift();
    }

    return { offset: this.getFilteredOffset(), rtt };
  }

  /**
   * Computes median offset to reject network jitter spikes.
   */
  public getFilteredOffset(): number {
    if (this.offsetSamples.length === 0) return 0;
    const sorted = [...this.offsetSamples].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }
}
