/**
 * AES-256-GCM encryption utilities for the credential vault.
 *
 * Design:
 * - Master key loaded from env (VAULT_MASTER_KEY) — hex-encoded 32 bytes.
 * - Per-key-version data key derived from master key + version (simple HKDF-style).
 * - Each credential encrypted with random 12-byte nonce + AES-256-GCM.
 * - Stored format: base64(nonce || ciphertext || auth_tag).
 * - Tampered ciphertext fails authentication and throws.
 */

import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const NONCE_LENGTH = 12; // 96-bit recommended for GCM
const KEY_LENGTH = 32; // 256-bit

/**
 * Derive a data key for a given key version from the master key.
 * Simple but deterministic: masterKey || version, then SHA-256.
 */
function deriveDataKey(masterKey: Buffer, version: number): Buffer {
  const { createHash } = require("crypto");
  const input = Buffer.concat([masterKey, Buffer.from(version.toString())]);
  return createHash("sha256").update(input).digest();
}

/**
 * Get the master key from environment.
 */
function getMasterKey(): Buffer {
  const raw = process.env.VAULT_MASTER_KEY;
  if (!raw) {
    throw new Error("VAULT_MASTER_KEY environment variable not set");
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `VAULT_MASTER_KEY must be ${KEY_LENGTH} bytes (32 bytes) hex-encoded`,
    );
  }
  return key;
}

/**
 * Encrypt plaintext with AES-256-GCM.
 *
 * Returns: base64(nonce || ciphertext || auth_tag)
 * Throws: if ciphertext is tampered (GCM auth failure).
 */
export function encrypt(
  plaintext: string,
  keyVersion: number = 1,
): string {
  const masterKey = getMasterKey();
  const dataKey = deriveDataKey(masterKey, keyVersion);
  const nonce = randomBytes(NONCE_LENGTH);

  const cipher = createCipheriv(ALGORITHM, dataKey, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Pack: nonce || ciphertext || auth_tag
  const packed = Buffer.concat([nonce, ciphertext, authTag]);
  return packed.toString("base64");
}

/**
 * Decrypt ciphertext encrypted with encrypt().
 *
 * Expects: base64(nonce || ciphertext || auth_tag)
 * Throws: if tampered or wrong key.
 */
export function decrypt(ciphertextB64: string, keyVersion: number): string {
  const masterKey = getMasterKey();
  const dataKey = deriveDataKey(masterKey, keyVersion);

  const packed = Buffer.from(ciphertextB64, "base64");
  if (packed.length < NONCE_LENGTH + 16) {
    throw new Error("Invalid ciphertext: too short");
  }

  const nonce = packed.subarray(0, NONCE_LENGTH);
  const authTag = packed.subarray(packed.length - 16);
  const ciphertext = packed.subarray(NONCE_LENGTH, packed.length - 16);

  const decipher = createDecipheriv(ALGORITHM, dataKey, nonce);
  decipher.setAuthTag(authTag);

  try {
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch (err: any) {
    // GCM authentication failure — tampered or wrong key
    throw new Error("Decryption failed: ciphertext tampered or wrong key");
  }
}

/**
 * Verify that a ciphertext is valid (decrypts successfully).
 * Used for integrity checks without exposing the plaintext.
 */
export function verifyIntegrity(ciphertextB64: string, keyVersion: number): boolean {
  try {
    decrypt(ciphertextB64, keyVersion);
    return true;
  } catch {
    return false;
  }
}

/**
 * Re-encrypt data from one key version to another (for key rotation).
 */
export function reencrypt(
  ciphertextB64: string,
  fromVersion: number,
  toVersion: number,
): string {
  const plaintext = decrypt(ciphertextB64, fromVersion);
  return encrypt(plaintext, toVersion);
}

/**
 * Generate a new master key (for initial setup or rotation).
 * Returns hex-encoded 32-byte key.
 */
export function generateMasterKey(): string {
  return randomBytes(KEY_LENGTH).toString("hex");
}
