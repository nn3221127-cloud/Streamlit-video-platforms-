import pytest
from crypto_engine import CryptoEngine
from e2ee_chat import DoubleRatchetSession, OutOfOrderMessageQueue

def test_crypto_double_ratchet_invariants():
    priv_a, pub_a = CryptoEngine.generate_key_pair()
    priv_b, pub_b = CryptoEngine.generate_key_pair()

    sess_a = DoubleRatchetSession("session-1", True, priv_a, pub_b.public_bytes_raw())
    sess_b = DoubleRatchetSession("session-1", False, priv_b, pub_a.public_bytes_raw())

    # Dispatch 100 sequential encrypted messages
    for i in range(1, 101):
        msg_text = f"E2EE Secret Payload Message #{i}".encode()
        pkt = sess_a.ratcheted_encrypt("alice", "bob", msg_text)

        # Verify HMAC and Decryption
        decrypted = sess_b.ratcheted_decrypt(pkt)
        assert decrypted == msg_text

def test_out_of_order_message_queue():
    priv_a, pub_a = CryptoEngine.generate_key_pair()
    priv_b, pub_b = CryptoEngine.generate_key_pair()

    sess_a = DoubleRatchetSession("session-2", True, priv_a, pub_b.public_bytes_raw())
    sess_b = DoubleRatchetSession("session-2", False, priv_b, pub_a.public_bytes_raw())

    queue = OutOfOrderMessageQueue()

    # Generate 5 encrypted packets
    packets = []
    for i in range(5):
        pkt = sess_a.ratcheted_encrypt("alice", "bob", f"Packet #{i+1}".encode())
        packets.append(pkt)

    # Push packets out-of-order (3, 1, 2, 5, 4)
    out_of_order_indices = [2, 0, 1, 4, 3]
    for idx in out_of_order_indices:
        queue.push(packets[idx])

    # Pop ready packets and verify reordering & decryption
    ready = queue.pop_ready(sess_b)
    assert len(ready) == 5
    for idx, (pkt, pt) in enumerate(ready):
        assert pt.decode() == f"Packet #{idx+1}"

def test_tampered_packet_rejection():
    priv_a, pub_a = CryptoEngine.generate_key_pair()
    priv_b, pub_b = CryptoEngine.generate_key_pair()

    sess_a = DoubleRatchetSession("session-3", True, priv_a, pub_b.public_bytes_raw())
    sess_b = DoubleRatchetSession("session-3", False, priv_b, pub_a.public_bytes_raw())

    pkt = sess_a.ratcheted_encrypt("alice", "bob", b"Secret data")

    # Tamper with ciphertext
    tampered_ciphertext = bytearray(pkt.ciphertext)
    tampered_ciphertext[0] ^= 0xFF
    pkt.ciphertext = bytes(tampered_ciphertext)

    with pytest.raises(ValueError, match="HMAC verification failed"):
        sess_b.ratcheted_decrypt(pkt)
