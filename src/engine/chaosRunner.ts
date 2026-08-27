import { P2PMeshNode, NetworkPacket } from './p2pMesh';

export interface ChaosSimulationReport {
  peerCount: number;
  totalOperationsGenerated: number;
  packetLossApplied: number;
  packetsDropped: number;
  stateConvergenceAchieved: boolean;
  sub10msClockSyncAchieved: boolean;
  sub20msVectorSearchAchieved: boolean;
  maxClockDriftMs: number;
  vectorSearchLatencyMs: number;
  finalAnnotationsCount: number;
  finalChatCount: number;
}

export class ChaosEngineRunner {
  private peers: P2PMeshNode[] = [];
  private packetsDroppedCount = 0;
  private partitionGroups: Map<string, number> = new Map(); // peerId -> group (0 or 1)

  constructor(peerCount: number = 4) {
    for (let i = 0; i < peerCount; i++) {
      const peerId = `peer-${i + 1}`;
      const peer = new P2PMeshNode(peerId, `Peer Node ${i + 1}`);
      this.peers.push(peer);
      this.partitionGroups.set(peerId, 0); // Initially all in group 0
    }

    this.wireMeshTransport();
  }

  /**
   * Connects transport router across all peers with simulated WebRTC mesh backplane.
   */
  private wireMeshTransport(): void {
    const peerMap = new Map<string, P2PMeshNode>();
    for (const p of this.peers) {
      peerMap.set(p.getPeerId(), p);
    }

    for (const sender of this.peers) {
      sender.setTransportRouter((packet: NetworkPacket) => {
        // Enforce split-brain network partition rules
        if (packet.targetId) {
          const senderGroup = this.partitionGroups.get(packet.senderId);
          const targetGroup = this.partitionGroups.get(packet.targetId);
          if (senderGroup !== undefined && targetGroup !== undefined && senderGroup !== targetGroup) {
            this.packetsDroppedCount++;
            return; // Dropped due to network partition!
          }

          const targetPeer = peerMap.get(packet.targetId);
          if (targetPeer) {
            targetPeer.receivePacket(packet);
          }
        } else {
          // Broadcast
          const senderGroup = this.partitionGroups.get(packet.senderId);
          for (const targetPeer of this.peers) {
            if (targetPeer.getPeerId() === packet.senderId) continue;
            const targetGroup = this.partitionGroups.get(targetPeer.getPeerId());
            if (senderGroup !== undefined && targetGroup !== undefined && senderGroup !== targetGroup) {
              this.packetsDroppedCount++;
              continue; // Dropped due to partition
            }
            targetPeer.receivePacket(packet);
          }
        }
      });
    }
  }

  /**
   * Establishes fully-connected mesh topology across peers.
   */
  public async establishMeshConnections(): Promise<void> {
    for (let i = 0; i < this.peers.length; i++) {
      await this.peers[i].init();
    }
    // Connect bidirectional pairs
    for (let i = 0; i < this.peers.length; i++) {
      for (let j = i + 1; j < this.peers.length; j++) {
        await this.peers[i].connectToPeer(this.peers[j], true);
        await this.peers[j].connectToPeer(this.peers[i], false);
      }
    }
  }

  /**
   * Applies split-brain network partition separating peers into 2 disconnected sub-networks.
   */
  public applySplitBrainPartition(): void {
    const half = Math.floor(this.peers.length / 2);
    for (let i = 0; i < this.peers.length; i++) {
      const group = i < half ? 0 : 1;
      this.partitionGroups.set(this.peers[i].getPeerId(), group);
    }
  }

  /**
   * Heals split-brain partition and triggers CRDT state vector anti-entropy sync.
   */
  public healNetworkPartition(): void {
    for (const p of this.peers) {
      this.partitionGroups.set(p.getPeerId(), 0); // Merge back into single group
      p.setChaosConfig({ packetLossRate: 0, latencyJitterMaxMs: 0 }); // Reset loss for anti-entropy heal
    }

    // Trigger state vector exchange anti-entropy sync across all pairs
    for (let i = 0; i < this.peers.length; i++) {
      for (let j = 0; j < this.peers.length; j++) {
        if (i !== j) {
          this.peers[i].syncStateWithPeer(this.peers[j].getPeerId());
        }
      }
    }
  }

  /**
   * Sets network packet loss rate across all peers (e.g., 0.50 for 50% packet loss).
   */
  public setPacketLossRate(rate: number): void {
    for (const p of this.peers) {
      p.setChaosConfig({ packetLossRate: rate });
    }
  }

  /**
   * Sets asymmetric latency & jitter (e.g. 10ms to 200ms).
   */
  public setLatencyJitter(minMs: number, maxMs: number): void {
    for (const p of this.peers) {
      p.setChaosConfig({ latencyJitterMinMs: minMs, latencyJitterMaxMs: maxMs });
    }
  }

  public getPeers(): P2PMeshNode[] {
    return this.peers;
  }

  /**
   * Validates absolute CRDT state convergence across all peers.
   */
  public verifyConvergence(): { isConverged: boolean; snapshots: any[] } {
    const snapshots = this.peers.map((p) => p.getCRDT().getSnapshot());
    if (snapshots.length <= 1) return { isConverged: true, snapshots };

    const firstPlay = snapshots[0].playbackState;
    const firstAnnKeys = Object.keys(snapshots[0].annotations).sort();
    const firstChatIds = snapshots[0].chatMessages.map((m: any) => m.id).sort();

    let isConverged = true;

    for (let i = 1; i < snapshots.length; i++) {
      const snap = snapshots[i];

      // Check playback state convergence
      if (
        snap.playbackState.currentTime !== firstPlay.currentTime ||
        snap.playbackState.isPlaying !== firstPlay.isPlaying
      ) {
        isConverged = false;
        break;
      }

      // Check annotations convergence
      const annKeys = Object.keys(snap.annotations).sort();
      if (annKeys.length !== firstAnnKeys.length || !annKeys.every((k, idx) => k === firstAnnKeys[idx])) {
        isConverged = false;
        break;
      }

      // Check chat messages convergence
      const chatIds = snap.chatMessages.map((m: any) => m.id).sort();
      if (chatIds.length !== firstChatIds.length || !chatIds.every((id, idx) => id === firstChatIds[idx])) {
        isConverged = false;
        break;
      }
    }

    return { isConverged, snapshots };
  }
}
