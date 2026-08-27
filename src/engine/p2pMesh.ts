/**
 * Zero-Server P2P WebRTC Mesh Manager
 * Manages peer discovery, WebRTC data channel mesh topology, E2EE Double Ratchet wrapping,
 * CRDT operation broadcasting, clock synchronization messages, and partition recovery.
 */

import { OperationBasedCRDT, CRDTOperation } from './crdtEngine';
import { DoubleRatchetSession, EncryptedPacket } from './doubleRatchet';
import { ClockSyncEstimator, ClockSyncMessage } from './hlc';
import { CryptoEngine, KeyPair } from './cryptoEngine';

export interface PeerNodeInfo {
  peerId: string;
  name: string;
  isHost: boolean;
  connectedAt: number;
  rttMs: number;
  clockOffsetMs: number;
}

export interface NetworkPacket {
  type: 'E2EE_CRDT_OP' | 'CLOCK_SYNC_REQ' | 'CLOCK_SYNC_RESP' | 'STATE_VECTOR_SYNC';
  senderId: string;
  targetId?: string; // Optional target peer for direct unicast
  payload: EncryptedPacket | ClockSyncMessage | { vectorClock: Record<string, any>; opLog: CRDTOperation[] };
}

export interface NetworkChaosConfig {
  packetLossRate: number;      // e.g. 0.50 = 50% packet loss
  latencyJitterMinMs: number;  // e.g. 10ms
  latencyJitterMaxMs: number;  // e.g. 200ms
  isPartitioned: boolean;       // Split-brain scenario toggle
  partitionGroup: number;       // Partition group ID (0 or 1)
}

export class P2PMeshNode {
  private readonly peerId: string;
  private readonly peerName: string;
  private crdt: OperationBasedCRDT;
  private clockEstimator: ClockSyncEstimator;

  // Active Peers & Double Ratchet E2EE Sessions
  private peers: Map<string, PeerNodeInfo> = new Map();
  private e2eeSessions: Map<string, DoubleRatchetSession> = new Map();

  // Simulated WebRTC Transport layer callbacks / router
  private transportRouter: ((packet: NetworkPacket) => void) | null = null;

  // Chaos Engineering Configuration
  private chaosConfig: NetworkChaosConfig = {
    packetLossRate: 0.0,
    latencyJitterMinMs: 0,
    latencyJitterMaxMs: 0,
    isPartitioned: false,
    partitionGroup: 0,
  };

  // Shared pre-shared master key for mesh pairwise Double Ratchet setup
  private sharedMasterKey: ArrayBuffer;
  private identityDHKeyPair: KeyPair | null = null;

  constructor(peerId: string, peerName: string, sharedMasterKeyHex?: string) {
    this.peerId = peerId;
    this.peerName = peerName;
    this.crdt = new OperationBasedCRDT(peerId);
    this.clockEstimator = new ClockSyncEstimator();

    if (sharedMasterKeyHex) {
      const bytes = CryptoEngine.hexToBuf(sharedMasterKeyHex);
      this.sharedMasterKey = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    } else {
      // Default 256-bit key for room
      const bytes = new Uint8Array(32).fill(7);
      this.sharedMasterKey = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    }

    // Subscribe ONLY local CRDT changes to broadcast E2EE packets (avoid echo loops)
    this.crdt.subscribe((snapshot, op, isLocal) => {
      if (isLocal) {
        this.broadcastCRDTOperation(op);
      }
    });
  }

  public async init(): Promise<void> {
    if (!this.identityDHKeyPair) {
      this.identityDHKeyPair = await CryptoEngine.generateECDHKeyPair();
    }
  }

  public getIdentityPublicKey(): ArrayBuffer {
    if (!this.identityDHKeyPair) {
      throw new Error('P2PMeshNode identity keypair not initialized');
    }
    return this.identityDHKeyPair.rawPublicKey;
  }

  public getIdentityKeyPair(): KeyPair {
    if (!this.identityDHKeyPair) {
      throw new Error('P2PMeshNode identity keypair not initialized');
    }
    return this.identityDHKeyPair;
  }

  public getPeerId(): string {
    return this.peerId;
  }

  public getPeerName(): string {
    return this.peerName;
  }

  public getCRDT(): OperationBasedCRDT {
    return this.crdt;
  }

  public setTransportRouter(router: (packet: NetworkPacket) => void): void {
    this.transportRouter = router;
  }

  public setChaosConfig(config: Partial<NetworkChaosConfig>): void {
    this.chaosConfig = { ...this.chaosConfig, ...config };
  }

  public getChaosConfig(): NetworkChaosConfig {
    return { ...this.chaosConfig };
  }

  /**
   * Connects to a remote peer in the WebRTC mesh and establishes Double-Ratchet E2EE session.
   */
  public async connectToPeer(remotePeerNode: P2PMeshNode, isInitiator = true): Promise<void> {
    const remotePeerId = remotePeerNode.getPeerId();
    const remotePeerName = remotePeerNode.getPeerName();
    if (this.peers.has(remotePeerId)) return;

    await this.init();

    this.peers.set(remotePeerId, {
      peerId: remotePeerId,
      name: remotePeerName,
      isHost: false,
      connectedAt: Date.now(),
      rttMs: 0,
      clockOffsetMs: 0,
    });

    // Initialize pairwise Double Ratchet session for THIS node communicating with remotePeerId
    const session = new DoubleRatchetSession(remotePeerId, this.sharedMasterKey);

    if (isInitiator) {
      await session.initAsAlice(this.getIdentityKeyPair(), remotePeerNode.getIdentityPublicKey());
    } else {
      await session.initAsBob(this.getIdentityKeyPair(), remotePeerNode.getIdentityPublicKey());
    }

    this.e2eeSessions.set(remotePeerId, session);

    // Initiate Clock Synchronization
    this.sendClockSyncRequest(remotePeerId);
  }

  /**
   * Encrypts and broadcasts a CRDT operation across all connected mesh peers.
   */
  private async broadcastCRDTOperation(op: CRDTOperation): Promise<void> {
    const payloadBytes = new TextEncoder().encode(JSON.stringify(op));

    for (const [targetPeerId, session] of this.e2eeSessions.entries()) {
      try {
        const encryptedPacket = await session.encrypt(payloadBytes);
        const packet: NetworkPacket = {
          type: 'E2EE_CRDT_OP',
          senderId: this.peerId,
          targetId: targetPeerId,
          payload: encryptedPacket,
        };

        this.sendPacketWithChaos(packet);
      } catch (e) {
        console.error(`[P2PMeshNode ${this.peerId}] Encryption/Send error to peer ${targetPeerId}:`, e);
      }
    }
  }

  /**
   * Initiates NTP clock synchronization request to a target peer.
   */
  public sendClockSyncRequest(targetPeerId: string): void {
    const syncMsg: ClockSyncMessage = {
      type: 'CLOCK_SYNC_REQ',
      senderId: this.peerId,
      targetId: targetPeerId,
      t0: Date.now() + this.crdt.getHLC().getOffset(),
    };

    const packet: NetworkPacket = {
      type: 'CLOCK_SYNC_REQ',
      senderId: this.peerId,
      targetId: targetPeerId,
      payload: syncMsg,
    };

    this.sendPacketWithChaos(packet);
  }

  /**
   * Triggers an explicit full state vector delta synchronization (used when network partition heals).
   */
  public syncStateWithPeer(targetPeerId: string): void {
    const packet: NetworkPacket = {
      type: 'STATE_VECTOR_SYNC',
      senderId: this.peerId,
      targetId: targetPeerId,
      payload: {
        vectorClock: this.crdt.getVectorClock(),
        opLog: this.crdt.getOpLog(),
      },
    };

    this.sendPacketWithChaos(packet);
  }

  /**
   * Handles an incoming packet from WebRTC data channel layer.
   */
  public async receivePacket(packet: NetworkPacket): Promise<void> {
    // If targeted unicast, ignore if not intended for this node
    if (packet.targetId && packet.targetId !== this.peerId) {
      return;
    }

    switch (packet.type) {
      case 'E2EE_CRDT_OP': {
        const session = this.e2eeSessions.get(packet.senderId);
        if (!session) return;

        try {
          const encryptedPacket = packet.payload as EncryptedPacket;
          const decryptedBytes = await session.decrypt(encryptedPacket);
          const opStr = new TextDecoder().decode(decryptedBytes);
          const op = JSON.parse(opStr) as CRDTOperation;

          this.crdt.applyOperation(op, false);
        } catch (err) {
          console.error(`[P2PMeshNode ${this.peerId}] E2EE Decryption error from ${packet.senderId}:`, err);
        }
        break;
      }

      case 'CLOCK_SYNC_REQ': {
        const req = packet.payload as ClockSyncMessage;
        const t1 = Date.now() + this.crdt.getHLC().getOffset();

        const respMsg: ClockSyncMessage = {
          type: 'CLOCK_SYNC_RESP',
          senderId: this.peerId,
          targetId: req.senderId,
          t0: req.t0,
          t1,
          t2: Date.now() + this.crdt.getHLC().getOffset(),
        };

        const respPacket: NetworkPacket = {
          type: 'CLOCK_SYNC_RESP',
          senderId: this.peerId,
          targetId: req.senderId,
          payload: respMsg,
        };

        this.sendPacketWithChaos(respPacket);
        break;
      }

      case 'CLOCK_SYNC_RESP': {
        const resp = packet.payload as ClockSyncMessage;
        const t3 = Date.now() + this.crdt.getHLC().getOffset();

        if (resp.t0 && resp.t1 && resp.t2) {
          const { offset, rtt } = this.clockEstimator.processSyncRoundTrip(resp.t0, resp.t1, resp.t2, t3);
          this.crdt.getHLC().setOffset(offset);

          const peerInfo = this.peers.get(resp.senderId);
          if (peerInfo) {
            peerInfo.rttMs = Math.round(rtt);
            peerInfo.clockOffsetMs = Math.round(offset);
          }
        }
        break;
      }

      case 'STATE_VECTOR_SYNC': {
        const syncPayload = packet.payload as { vectorClock: Record<string, any>; opLog: CRDTOperation[] };
        this.crdt.mergeStateVector(syncPayload.opLog || []);
        break;
      }
    }
  }

  /**
   * Applies Chaos Engineering simulation rules (50% packet loss, jitter delay, network partition)
   * before routing packet to transport destination.
   */
  private sendPacketWithChaos(packet: NetworkPacket): void {
    if (!this.transportRouter) return;

    // 1. Simulate 50% Packet Loss
    if (this.chaosConfig.packetLossRate > 0) {
      if (Math.random() < this.chaosConfig.packetLossRate) {
        return; // Packet dropped!
      }
    }

    // 2. Simulate Asymmetric Latency & Jitter
    let jitterMs = 0;
    if (this.chaosConfig.latencyJitterMaxMs > this.chaosConfig.latencyJitterMinMs) {
      const range = this.chaosConfig.latencyJitterMaxMs - this.chaosConfig.latencyJitterMinMs;
      jitterMs = this.chaosConfig.latencyJitterMinMs + Math.floor(Math.random() * range);
    }

    if (jitterMs > 0) {
      setTimeout(() => {
        if (this.transportRouter) this.transportRouter(packet);
      }, jitterMs);
    } else {
      this.transportRouter(packet);
    }
  }

  public getConnectedPeers(): PeerNodeInfo[] {
    return Array.from(this.peers.values());
  }
}
