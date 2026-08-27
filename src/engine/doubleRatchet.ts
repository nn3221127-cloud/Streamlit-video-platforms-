/**
 * Double Ratchet E2EE Protocol Implementation
 * Provides end-to-end encryption with forward secrecy and post-compromise security
 * for P2P video stream metadata, CRDT operations, and chat packet headers.
 */

import { CryptoEngine, KeyPair } from './cryptoEngine';

export interface EncryptedMessageHeader {
  dhPublicKeyHex: string; // Sender's current DH ratchet public key
  pn: number;            // Number of messages in previous sending chain
  n: number;             // Message number in current sending chain
}

export interface EncryptedPacket {
  header: EncryptedMessageHeader;
  ciphertextHex: string;
  ivHex: string;
}

export class DoubleRatchetSession {
  private readonly peerId: string;

  // Diffie-Hellman Ratchet State
  private dhs: KeyPair | null = null;            // DH Sending Key Pair
  private dhr: CryptoKey | null = null;          // DH Receiving Public Key
  private dhrRaw: ArrayBuffer | null = null;     // DH Receiving Public Key Raw

  // KDF Chain Keys
  private rk: ArrayBuffer;                       // Root Key (32 bytes)
  private cks: ArrayBuffer | null = null;        // Chain Key Sending (32 bytes)
  private ckr: ArrayBuffer | null = null;        // Chain Key Receiving (32 bytes)

  // Message Numbers
  private ns: number = 0;                        // Number of sent messages in current chain
  private nr: number = 0;                        // Number of received messages in current chain
  private pn: number = 0;                        // Number of messages in previous send chain

  // Skipped Message Keys Store: (dhPublicKeyHex + ':' + messageNum) -> Message Key
  private skippedMessageKeys: Map<string, ArrayBuffer> = new Map();
  private maxSkippedKeys = 100;

  constructor(peerId: string, sharedMasterKey: ArrayBuffer) {
    this.peerId = peerId;
    this.rk = sharedMasterKey;
  }

  /**
   * Initializes session for peer node with symmetric initial chain derived from pairwise PSK.
   */
  public async initWithPsk(isInitiator: boolean, localDH: KeyPair, remoteDHRaw: ArrayBuffer): Promise<void> {
    this.dhs = localDH;
    this.dhrRaw = remoteDHRaw;
    this.dhr = await CryptoEngine.importPublicKey(remoteDHRaw);

    const infoSend = isInitiator ? 'INIT_CHAIN_A_TO_B' : 'INIT_CHAIN_B_TO_A';
    const infoRecv = isInitiator ? 'INIT_CHAIN_B_TO_A' : 'INIT_CHAIN_A_TO_B';

    this.cks = await CryptoEngine.hkdf(this.rk, new Uint8Array(32), infoSend, 32);
    this.ckr = await CryptoEngine.hkdf(this.rk, new Uint8Array(32), infoRecv, 32);

    this.ns = 0;
    this.nr = 0;
    this.pn = 0;
  }

  /**
   * Initializes session as Alice (the initiator who sends first).
   */
  public async initAsAlice(aliceDH: KeyPair, bobDHPubKeyRaw: ArrayBuffer): Promise<void> {
    await this.initWithPsk(true, aliceDH, bobDHPubKeyRaw);
  }

  /**
   * Initializes session as Bob (the receiver).
   */
  public async initAsBob(bobDHKeyPair: KeyPair, aliceDHPubKeyRaw: ArrayBuffer): Promise<void> {
    await this.initWithPsk(false, bobDHKeyPair, aliceDHPubKeyRaw);
  }

  /**
   * Symmetric chain ratchet step for generating next message key in chain.
   */
  private async ratchetSymmetricChain(
    chainKey: ArrayBuffer
  ): Promise<{ nextChainKey: ArrayBuffer; messageKey: ArrayBuffer }> {
    const mkBytes = await CryptoEngine.hmac(chainKey, new TextEncoder().encode('MESSAGE_KEY'));
    const nextCkBytes = await CryptoEngine.hmac(chainKey, new TextEncoder().encode('CHAIN_KEY'));

    return {
      nextChainKey: nextCkBytes,
      messageKey: mkBytes,
    };
  }

  /**
   * Encrypts a plaintext payload using the Double Ratchet protocol.
   */
  public async encrypt(plaintext: Uint8Array): Promise<EncryptedPacket> {
    if (!this.cks || !this.dhs) {
      throw new Error('Double Ratchet session not properly initialized for sending');
    }

    // Advance sending symmetric chain
    const { nextChainKey, messageKey } = await this.ratchetSymmetricChain(this.cks);
    this.cks = nextChainKey;

    const header: EncryptedMessageHeader = {
      dhPublicKeyHex: CryptoEngine.bufToHex(this.dhs.rawPublicKey),
      pn: this.pn,
      n: this.ns,
    };

    this.ns += 1;

    // Associated data = header serialized deterministically
    const ad = new TextEncoder().encode(`${header.dhPublicKeyHex}:${header.pn}:${header.n}`);
    const encrypted = await CryptoEngine.encryptAESGCM(messageKey, plaintext, ad);

    return {
      header,
      ciphertextHex: CryptoEngine.bufToHex(encrypted.ciphertext),
      ivHex: CryptoEngine.bufToHex(encrypted.iv),
    };
  }

  /**
   * Decrypts an incoming encrypted packet, performing DH ratchets and skipped key caching as needed.
   */
  public async decrypt(packet: EncryptedPacket): Promise<Uint8Array> {
    const header = packet.header;
    const remoteDHBytes = CryptoEngine.hexToBuf(header.dhPublicKeyHex);
    const remoteDHRaw = remoteDHBytes.buffer.slice(remoteDHBytes.byteOffset, remoteDHBytes.byteOffset + remoteDHBytes.byteLength) as ArrayBuffer;

    const ad = new TextEncoder().encode(`${header.dhPublicKeyHex}:${header.pn}:${header.n}`);
    const ciphertext = CryptoEngine.hexToBuf(packet.ciphertextHex);
    const iv = CryptoEngine.hexToBuf(packet.ivHex);

    // 1. Check if message key was previously skipped and stored
    const skippedKeyId = `${header.dhPublicKeyHex}:${header.n}`;
    if (this.skippedMessageKeys.has(skippedKeyId)) {
      const mk = this.skippedMessageKeys.get(skippedKeyId)!;
      this.skippedMessageKeys.delete(skippedKeyId);
      return await CryptoEngine.decryptAESGCM(mk, ciphertext, iv, ad);
    }

    // 2. If new DH public key received (and not initial handshake key), perform DH Ratchet step
    if (this.dhrRaw && !this.areBuffersEqual(remoteDHRaw, this.dhrRaw)) {
      await this.skipMessageKeys(header.pn);
      await this.dhRatchet(remoteDHRaw as ArrayBuffer);
    }

    // 3. Skip missing keys in current receive chain
    await this.skipMessageKeys(header.n);

    // 4. Advance receive symmetric chain
    if (!this.ckr) {
      throw new Error('Receive chain key uninitialized');
    }

    const { nextChainKey, messageKey } = await this.ratchetSymmetricChain(this.ckr);
    this.ckr = nextChainKey;
    this.nr += 1;

    return await CryptoEngine.decryptAESGCM(messageKey, ciphertext, iv, ad);
  }

  /**
   * DH Ratchet step executed when receiving a packet with a new ephemeral DH public key.
   */
  private async dhRatchet(remoteDHRaw: ArrayBuffer): Promise<void> {
    this.pn = this.ns;
    this.ns = 0;
    this.nr = 0;

    this.dhrRaw = remoteDHRaw;
    this.dhr = await CryptoEngine.importPublicKey(remoteDHRaw);

    // Receive DH Step: dhOutput1 = DH(dhs.privateKey, dhr)
    const dhOutput1 = await CryptoEngine.computeDH(this.dhs!.privateKey, this.dhr);
    const derivedRecv = await CryptoEngine.hkdf(dhOutput1, this.rk, 'StreamIntelDoubleRatchetKDF', 64);
    this.rk = derivedRecv.slice(0, 32);
    this.ckr = derivedRecv.slice(32, 64);

    // Generate new local DH KeyPair for sending step
    this.dhs = await CryptoEngine.generateECDHKeyPair();

    // Send DH Step: dhOutput2 = DH(dhs.privateKey, dhr)
    const dhOutput2 = await CryptoEngine.computeDH(this.dhs.privateKey, this.dhr);
    const derivedSend = await CryptoEngine.hkdf(dhOutput2, this.rk, 'StreamIntelDoubleRatchetKDF', 64);
    this.rk = derivedSend.slice(0, 32);
    this.cks = derivedSend.slice(32, 64);
  }

  /**
   * Saves message keys for out-of-order / skipped packets.
   */
  private async skipMessageKeys(untilMessageNum: number): Promise<void> {
    if (this.ckr) {
      while (this.nr < untilMessageNum) {
        const { nextChainKey, messageKey } = await this.ratchetSymmetricChain(this.ckr);
        this.ckr = nextChainKey;
        const keyId = `${CryptoEngine.bufToHex(this.dhrRaw!)}:${this.nr}`;
        this.skippedMessageKeys.set(keyId, messageKey);

        if (this.skippedMessageKeys.size > this.maxSkippedKeys) {
          const firstKey = this.skippedMessageKeys.keys().next().value;
          if (firstKey) this.skippedMessageKeys.delete(firstKey);
        }

        this.nr += 1;
      }
    }
  }

  private areBuffersEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
    if (a.byteLength !== b.byteLength) return false;
    const u1 = new Uint8Array(a);
    const u2 = new Uint8Array(b);
    for (let i = 0; i < u1.length; i++) {
      if (u1[i] !== u2[i]) return false;
    }
    return true;
  }

  public getPeerId(): string {
    return this.peerId;
  }

  public getSkippedKeyCount(): number {
    return this.skippedMessageKeys.size;
  }
}
