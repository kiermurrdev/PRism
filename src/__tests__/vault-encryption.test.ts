import { strict as assert } from "node:assert";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  encrypt,
  decrypt,
  verifyIntegrity,
  reencrypt,
  generateMasterKey,
} from "@/lib/vault/encryption";

describe("Vault Encryption", () => {
  const ORIGINAL_KEY = process.env.VAULT_MASTER_KEY;

  beforeEach(() => {
    // Set a deterministic master key for tests
    process.env.VAULT_MASTER_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  afterEach(() => {
    process.env.VAULT_MASTER_KEY = ORIGINAL_KEY;
  });

  it("should encrypt and decrypt correctly", () => {
    const plaintext = "test-api-key-12345";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted, 1);
    assert.strictEqual(decrypted, plaintext);
  });

  it("should produce different ciphertext for same plaintext (random nonce)", () => {
    const plaintext = "same-key";
    const enc1 = encrypt(plaintext);
    const enc2 = encrypt(plaintext);
    assert.notStrictEqual(enc1, enc2);
  });

  it("should fail to decrypt with wrong key version", () => {
    const plaintext = "secret-key";
    const encrypted = encrypt(plaintext, 1);

    // Change the master key to simulate wrong key
    process.env.VAULT_MASTER_KEY =
      "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

    assert.throws(() => decrypt(encrypted, 1), /tampered or wrong key/);
  });

  it("should detect tampered ciphertext", () => {
    const plaintext = "original-key";
    let encrypted = encrypt(plaintext);

    // Tamper with the base64 payload
    const tampered = encrypted.slice(0, -5) + "XXXXX";

    assert.throws(() => decrypt(tampered, 1), /tampered or wrong key/);
  });

  it("should verify integrity of valid ciphertext", () => {
    const encrypted = encrypt("valid-key");
    assert.strictEqual(verifyIntegrity(encrypted, 1), true);
  });

  it("should reject invalid integrity", () => {
    assert.strictEqual(verifyIntegrity("not-valid-base64!!", 1), false);
    assert.strictEqual(verifyIntegrity("", 1), false);
  });

  it("should reencrypt from one version to another", () => {
    const plaintext = "my-api-key";
    const encV1 = encrypt(plaintext, 1);

    const encV2 = reencrypt(encV1, 1, 2);
    assert.notStrictEqual(encV2, encV1);

    // Decrypt with v2 key
    const decrypted = decrypt(encV2, 2);
    assert.strictEqual(decrypted, plaintext);
  });

  it("should generate a valid master key", () => {
    const key = generateMasterKey();
    assert.strictEqual(key.length, 64); // 32 bytes hex-encoded
    assert.match(key, /^[0-9a-f]+$/);
  });

  it("should fail without VAULT_MASTER_KEY", () => {
    delete process.env.VAULT_MASTER_KEY;
    assert.throws(() => encrypt("test"), /VAULT_MASTER_KEY/);
  });

  it("should fail with wrong-length master key", () => {
    process.env.VAULT_MASTER_KEY = "short";
    assert.throws(() => encrypt("test"), /must be 32 bytes/);
  });
});
