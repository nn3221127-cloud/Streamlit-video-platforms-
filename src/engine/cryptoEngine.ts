/**
 * Low-level Cryptographic Utilities for Double Ratchet E2EE Protocol
 * Uses Web Crypto API (crypto.subtle) available in Node / Browser / Bun environments.
 */

export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  rawPublicKey: ArrayBuffer;
}

export class CryptoEngine {
  /**
   * Generates an ECDH P-256 keypair for DH ratchet.
   */
  public static async generateECDHKeyPair(): Promise<KeyPair> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey', 'deriveBits']
    );

    const rawPublicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);

    return {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      rawPublicKey,
    };
  }

  /**
   * Imports a raw ECDH P-256 public key.
   */
  public static async importPublicKey(rawKey: ArrayBuffer | Uint8Array): Promise<CryptoKey> {
    const keyBytes = rawKey instanceof Uint8Array ? rawKey : new Uint8Array(rawKey);
    return await crypto.subtle.importKey(
      'raw',
      keyBytes,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      []
    );
  }

  /**
   * Performs ECDH key agreement.
   */
  public static async computeDH(privateKey: CryptoKey, publicKey: CryptoKey): Promise<ArrayBuffer> {
    return await crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: publicKey,
      },
      privateKey,
      256
    );
  }

  /**
   * HKDF (HMAC-SHA256) Key Derivation Function.
   */
  public static async hkdf(
    ikm: ArrayBuffer,
    salt: ArrayBuffer | Uint8Array,
    infoStr: string,
    outputLenBytes: number = 64
  ): Promise<ArrayBuffer> {
    const saltBuffer = salt instanceof Uint8Array ? salt.buffer : salt;
    const actualSalt = saltBuffer.byteLength === 0 ? new Uint8Array(32) : new Uint8Array(saltBuffer);

    const baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    const info = new TextEncoder().encode(infoStr);

    return await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: actualSalt,
        info,
      },
      baseKey,
      outputLenBytes * 8
    );
  }

  /**
   * HMAC-SHA256 calculation for symmetric key ratchet.
   */
  public static async hmac(keyBytes: ArrayBuffer, dataBytes: Uint8Array): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    return await crypto.subtle.sign('HMAC', cryptoKey, dataBytes);
  }

  /**
   * AES-256-GCM Encryption.
   */
  public static async encryptAESGCM(
    keyBytes: ArrayBuffer,
    plaintext: Uint8Array,
    associatedData?: Uint8Array
  ): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);

    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: associatedData || new Uint8Array(0),
      },
      cryptoKey,
      plaintext
    );

    return {
      ciphertext: new Uint8Array(encrypted),
      iv,
    };
  }

  /**
   * AES-256-GCM Decryption.
   */
  public static async decryptAESGCM(
    keyBytes: ArrayBuffer,
    ciphertext: Uint8Array,
    iv: Uint8Array,
    associatedData?: Uint8Array
  ): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: associatedData || new Uint8Array(0),
      },
      cryptoKey,
      ciphertext
    );

    return new Uint8Array(decrypted);
  }

  /**
   * ArrayBuffer to Hex helper
   */
  public static bufToHex(buf: ArrayBuffer | Uint8Array): string {
    const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Hex to Uint8Array helper
   */
  public static hexToBuf(hex: string): Uint8Array {
    const match = hex.match(/.{1,2}/g);
    if (!match) return new Uint8Array(0);
    return new Uint8Array(match.map((byte) => parseInt(byte, 16)));
  }

  /**
   * Concatenates two Uint8Arrays
   */
  public static concatBuffers(a: Uint8Array, b: Uint8Array): Uint8Array {
    const res = new Uint8Array(a.length + b.length);
    res.set(a, 0);
    res.set(b, a.length);
    return res;
  }
}
