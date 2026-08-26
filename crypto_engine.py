import os
import hmac
import hashlib
from typing import Tuple, Dict, Any, Optional
from cryptography.hazmat.primitives.asymmetric import x25519
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.hashes import SHA256
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

class CryptoEngine:
    """
    Localized cryptographic primitives:
    - Curve25519 / X25519 for Key Exchange
    - HKDF-SHA256 for Key Derivation
    - AES-256-GCM for Authenticated Symmetric Encryption
    """
    @staticmethod
    def generate_key_pair() -> Tuple[x25519.X25519PrivateKey, x25519.X25519PublicKey]:
        private_key = x25519.X25519PrivateKey.generate()
        public_key = private_key.public_key()
        return private_key, public_key

    @staticmethod
    def derive_shared_secret(private_key: x25519.X25519PrivateKey, peer_public_key: x25519.X25519PublicKey) -> bytes:
        return private_key.exchange(peer_public_key)

    @staticmethod
    def hkdf_derive(secret: bytes, salt: Optional[bytes] = None, info: bytes = b'e2ee_ratchet', length: int = 32) -> bytes:
        salt = salt or b'\x00' * 32
        hkdf = HKDF(
            algorithm=SHA256(),
            length=length,
            salt=salt,
            info=info,
        )
        return hkdf.derive(secret)

    @staticmethod
    def encrypt_aes_gcm(key: bytes, plaintext: bytes, associated_data: Optional[bytes] = None) -> Tuple[bytes, bytes]:
        """
        Encrypts plaintext using AES-256-GCM.
        Returns (nonce, ciphertext_with_tag)
        """
        aesgcm = AESGCM(key)
        nonce = os.urandom(12)
        ciphertext = aesgcm.encrypt(nonce, plaintext, associated_data)
        return nonce, ciphertext

    @staticmethod
    def decrypt_aes_gcm(key: bytes, nonce: bytes, ciphertext: bytes, associated_data: Optional[bytes] = None) -> bytes:
        """
        Decrypts ciphertext using AES-256-GCM.
        """
        aesgcm = AESGCM(key)
        return aesgcm.decrypt(nonce, ciphertext, associated_data)

    @staticmethod
    def compute_hmac(key: bytes, message: bytes) -> bytes:
        return hmac.new(key, message, hashlib.sha256).digest()

    @staticmethod
    def verify_hmac(key: bytes, message: bytes, expected_hmac: bytes) -> bool:
        computed = hmac.new(key, message, hashlib.sha256).digest()
        return hmac.compare_digest(computed, expected_hmac)
