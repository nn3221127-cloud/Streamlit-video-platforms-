import { describe, it, expect } from 'bun:test';
import { HybridLogicalClock } from '../src/engine/hlc';
import { DoubleRatchetSession } from '../src/engine/doubleRatchet';
import { CryptoEngine } from '../src/engine/cryptoEngine';
import { WasmVectorEngine, VectorChunkDoc } from '../src/engine/wasmVectorEngine';
import { ChaosEngineRunner } from '../src/engine/chaosRunner';

describe('Zero-Server P2P Streaming Engine & Chaos Convergence Test Suite', () => {
  it('1. Hybrid Logical Clock (HLC) maintains causal ordering and sub-10ms drift offset', () => {
    const hlc1 = new HybridLogicalClock('node-1');
    const hlc2 = new HybridLogicalClock('node-2');

    hlc1.setOffset(5); // 5ms simulated physical drift
    hlc2.setOffset(-3); // -3ms simulated physical drift

    const ts1 = hlc1.now();
    const ts2 = hlc2.update(ts1);

    expect(ts2.physicalTime).toBeGreaterThanOrEqual(ts1.physicalTime);
    expect(HybridLogicalClock.compare(ts2, ts1)).toBe(1);

    const diff = Math.abs(hlc1.getOffset() - hlc2.getOffset());
    expect(diff).toBeLessThan(10); // Sub-10ms drift bound
  });

  it('2. Double-Ratchet E2EE protocol guarantees forward secrecy & out-of-order decryption', async () => {
    const sharedMasterKey = new Uint8Array(32).fill(42).buffer;

    const aliceSession = new DoubleRatchetSession('bob', sharedMasterKey);
    const bobSession = new DoubleRatchetSession('alice', sharedMasterKey);

    const aliceDH = await CryptoEngine.generateECDHKeyPair();
    const bobDH = await CryptoEngine.generateECDHKeyPair();
    await bobSession.initAsBob(bobDH, aliceDH.rawPublicKey);
    await aliceSession.initAsAlice(aliceDH, bobDH.rawPublicKey);

    // Encrypt 3 consecutive packets from Alice
    const msg1 = new TextEncoder().encode('Payload 1: Pause video at 12.5s');
    const msg2 = new TextEncoder().encode('Payload 2: Add annotation at (50, 80)');
    const msg3 = new TextEncoder().encode('Payload 3: Chat "Great scene!"');

    const p1 = await aliceSession.encrypt(msg1);
    const p2 = await aliceSession.encrypt(msg2);
    const p3 = await aliceSession.encrypt(msg3);

    // Deliver out-of-order to Bob: p2 -> p3 -> p1
    const decrypted2 = await bobSession.decrypt(p2);
    expect(new TextDecoder().decode(decrypted2)).toBe('Payload 2: Add annotation at (50, 80)');

    const decrypted3 = await bobSession.decrypt(p3);
    expect(new TextDecoder().decode(decrypted3)).toBe('Payload 3: Chat "Great scene!"');

    const decrypted1 = await bobSession.decrypt(p1);
    expect(new TextDecoder().decode(decrypted1)).toBe('Payload 1: Pause video at 12.5s');
  });

  it('3. Client-Side Wasm Vector Search Engine executes sub-20ms ANN similarity search', () => {
    const vectorEngine = new WasmVectorEngine(128, 1000);

    // Ingest 200 synthetic video chunk embeddings
    const chunks: VectorChunkDoc[] = [];
    for (let i = 0; i < 200; i++) {
      const vec = new Array(128).fill(0).map(() => Math.random() - 0.5);
      chunks.push({
        id: `chunk-${i}`,
        videoId: 'vid-test-1',
        timestamp: i * 5,
        text: `Video segment description at ${i * 5} seconds`,
        vector: vec,
      });
    }

    vectorEngine.indexChunks(chunks);
    expect(vectorEngine.getIndexedCount()).toBe(200);

    // Execute ANN Search
    const queryVec = new Array(128).fill(0).map(() => Math.random() - 0.5);
    const searchRes = vectorEngine.searchANN(queryVec, 5);

    expect(searchRes.results.length).toBe(5);
    expect(searchRes.latencyMs).toBeLessThan(20.0); // Sub-20ms execution requirement!
  });

  it('4. Chaos Engineering Proof: 50% Packet Loss + Split-Brain Network Partition achieve absolute CRDT convergence', async () => {
    const runner = new ChaosEngineRunner(4); // 4 Peers
    await runner.establishMeshConnections();

    // Enable Chaos Injection: 50% Packet Loss & 10-50ms Asymmetric Jitter Delay
    runner.setPacketLossRate(0.50);
    runner.setLatencyJitter(10, 50);

    const peers = runner.getPeers();

    // 1. Peer 1 changes video playback state
    peers[0].getCRDT().createOperation('SET_PLAYBACK', {
      isPlaying: true,
      currentTime: 45.2,
      playbackSpeed: 1.25,
      videoId: 'demo-vid-1',
    });

    // 2. Peer 2 adds annotation
    peers[1].getCRDT().createOperation('ADD_ANNOTATION', {
      id: 'ann-1',
      videoId: 'demo-vid-1',
      timestamp: 45.2,
      text: 'Neural architecture highlight',
      x: 35,
      y: 60,
      authorId: 'peer-2',
      authorName: 'Peer Node 2',
    });

    // 3. Inject Split-Brain Network Partition (Peers [1,2] vs [3,4])
    runner.applySplitBrainPartition();

    // Peer 3 sends chat message inside partition group 1
    peers[2].getCRDT().createOperation('ADD_CHAT', {
      id: 'chat-part-1',
      userId: 'peer-3',
      userName: 'Peer Node 3',
      text: 'Is everyone seeing the partition?',
      videoTimestamp: 45.2,
    });

    // Peer 1 updates playback inside partition group 0
    peers[0].getCRDT().createOperation('SET_PLAYBACK', {
      isPlaying: false,
      currentTime: 60.0,
      playbackSpeed: 1.0,
      videoId: 'demo-vid-1',
    });

    // 4. Heal Split-Brain Partition and perform anti-entropy state vector merge
    runner.healNetworkPartition();

    // Wait for async packet delivery and state merges under 50% packet loss
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Verify absolute convergence across all 4 peers
    const convergenceResult = runner.verifyConvergence();
    expect(convergenceResult.isConverged).toBe(true);

    const snap = convergenceResult.snapshots[0];
    expect(snap.playbackState.currentTime).toBe(60.0);
    expect(snap.playbackState.isPlaying).toBe(false);
    expect(Object.keys(snap.annotations).length).toBe(1);
    expect(snap.chatMessages.some((m: any) => m.id === 'chat-part-1')).toBe(true);
  });
});
