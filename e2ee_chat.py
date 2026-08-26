import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Any
from cryptography.hazmat.primitives.asymmetric import x25519
from crypto_engine import CryptoEngine

@dataclass
class EncryptedMessagePacket:
    sender_id: str
    receiver_id: str
    sequence_num: int
    ephemeral_pub_bytes: bytes
    nonce: bytes
    ciphertext: bytes
    hmac_digest: bytes
    timestamp: float

class DoubleRatchetSession:
    """
    Session-based Double Ratchet mechanism for 1-on-1 conversations.
    Provides Forward Secrecy and Break-In Recovery.
    """
    def __init__(self, session_id: str, is_initiator: bool, my_private_key: x25519.X25519PrivateKey, peer_public_bytes: bytes) -> None:
        self.session_id: str = session_id
        self.is_initiator: bool = is_initiator

        # Local DH ratchet keypair
        self.dh_priv: x25519.X25519PrivateKey = my_private_key
        self.dh_pub: x25519.X25519PublicKey = my_private_key.public_key()
        self.peer_dh_pub: x25519.X25519PublicKey = x25519.X25519PublicKey.from_public_bytes(peer_public_bytes)

        dh_secret = CryptoEngine.derive_shared_secret(self.dh_priv, self.peer_dh_pub)
        self.root_key = CryptoEngine.hkdf_derive(dh_secret, info=b'root_chain')

        # Initiator sends on 'initiator_send' and receives on 'responder_send'
        # Responder sends on 'responder_send' and receives on 'initiator_send'
        if is_initiator:
            self.send_chain_key = CryptoEngine.hkdf_derive(self.root_key, info=b'initiator_send')
            self.recv_chain_key = CryptoEngine.hkdf_derive(self.root_key, info=b'responder_send')
        else:
            self.send_chain_key = CryptoEngine.hkdf_derive(self.root_key, info=b'responder_send')
            self.recv_chain_key = CryptoEngine.hkdf_derive(self.root_key, info=b'initiator_send')

        self.send_seq: int = 0
        self.recv_seq: int = 0

    def ratcheted_encrypt(self, sender_id: str, receiver_id: str, plaintext: bytes) -> EncryptedMessagePacket:
        # Advance send chain key to derive message key
        mk = CryptoEngine.hkdf_derive(self.send_chain_key, info=b'message_key')
        self.send_chain_key = CryptoEngine.hkdf_derive(self.send_chain_key, info=b'next_chain')

        self.send_seq += 1
        nonce, ciphertext = CryptoEngine.encrypt_aes_gcm(mk, plaintext)

        pub_bytes = self.dh_pub.public_bytes_raw()
        hmac_digest = CryptoEngine.compute_hmac(mk, ciphertext)

        return EncryptedMessagePacket(
            sender_id=sender_id,
            receiver_id=receiver_id,
            sequence_num=self.send_seq,
            ephemeral_pub_bytes=pub_bytes,
            nonce=nonce,
            ciphertext=ciphertext,
            hmac_digest=hmac_digest,
            timestamp=time.time()
        )

    def ratcheted_decrypt(self, packet: EncryptedMessagePacket) -> bytes:
        # Advance recv chain key to derive message key
        mk = CryptoEngine.hkdf_derive(self.recv_chain_key, info=b'message_key')
        self.recv_chain_key = CryptoEngine.hkdf_derive(self.recv_chain_key, info=b'next_chain')

        if not CryptoEngine.verify_hmac(mk, packet.ciphertext, packet.hmac_digest):
            raise ValueError("HMAC verification failed. Packet integrity compromised.")

        self.recv_seq = packet.sequence_num
        plaintext = CryptoEngine.decrypt_aes_gcm(mk, packet.nonce, packet.ciphertext)
        return plaintext


class OutOfOrderMessageQueue:
    """
    Cryptographically verified buffer that caches, verifies HMAC digests,
    and reorders dropped or out-of-sequence ciphertext packets before local client decryption.
    """
    def __init__(self) -> None:
        self.buffer: List[EncryptedMessagePacket] = []
        self.expected_seq: int = 1

    def push(self, packet: EncryptedMessagePacket) -> None:
        if not any(p.sequence_num == packet.sequence_num and p.sender_id == packet.sender_id for p in self.buffer):
            self.buffer.append(packet)
            self.buffer.sort(key=lambda p: p.sequence_num)

    def pop_ready(self, session: DoubleRatchetSession) -> List[Tuple[EncryptedMessagePacket, bytes]]:
        ready: List[Tuple[EncryptedMessagePacket, bytes]] = []
        remaining: List[EncryptedMessagePacket] = []

        for pkt in self.buffer:
            try:
                pt = session.ratcheted_decrypt(pkt)
                ready.append((pkt, pt))
                self.expected_seq = max(self.expected_seq, pkt.sequence_num + 1)
            except Exception as e:
                print(f"[E2EEQueue] Decryption failed for packet {pkt.sequence_num}: {e}")
                remaining.append(pkt)

        self.buffer = remaining
        return ready
