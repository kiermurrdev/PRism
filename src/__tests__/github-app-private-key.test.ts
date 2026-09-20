import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { normalizePrivateKey, isValidPrivateKeyFormat } from "@/lib/github/app/private-key";

describe("Private key normalization", () => {
  it("converts escaped newlines to real newlines", () => {
    const raw = "-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBg\\n-----END PRIVATE KEY-----";
    const normalized = normalizePrivateKey(raw);

    assert.ok(normalized.includes("\n"), "Should contain real newlines");
    assert.ok(!normalized.includes("\\n"), "Should not contain escaped newlines");
  });

  it("trims surrounding whitespace", () => {
    const raw = "  -----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBg\\n-----END PRIVATE KEY-----  ";
    const normalized = normalizePrivateKey(raw);

    assert.strictEqual(normalized[0], "-", "Should not have leading whitespace");
    assert.strictEqual(normalized[normalized.length - 1], "-", "Should not have trailing whitespace");
  });

  it("handles already-normalized keys unchanged", () => {
    const raw = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg\n-----END PRIVATE KEY-----";
    const normalized = normalizePrivateKey(raw);

    assert.strictEqual(normalized, raw, "Should preserve already-normalized key");
  });

  it("handles empty string", () => {
    const normalized = normalizePrivateKey("");
    assert.strictEqual(normalized, "");
  });
});

describe("Private key format validation", () => {
  it("accepts RSA PRIVATE KEY format", () => {
    const key = "-----BEGIN RSA PRIVATE KEY-----\nMIIEvgIBADANBg\n-----END RSA PRIVATE KEY-----";
    assert.ok(isValidPrivateKeyFormat(key));
  });

  it("accepts PRIVATE KEY (PKCS#8) format", () => {
    const key = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg\n-----END PRIVATE KEY-----";
    assert.ok(isValidPrivateKeyFormat(key));
  });

  it("rejects empty string", () => {
    assert.ok(!isValidPrivateKeyFormat(""));
  });

  it("rejects non-PEM string", () => {
    assert.ok(!isValidPrivateKeyFormat("not a key"));
  });

  it("rejects string with only a header", () => {
    assert.ok(!isValidPrivateKeyFormat("-----BEGIN PRIVATE KEY-----"));
  });

  it("rejects null", () => {
    assert.ok(!isValidPrivateKeyFormat(null as unknown as string));
  });

  it("rejects undefined", () => {
    assert.ok(!isValidPrivateKeyFormat(undefined as unknown as string));
  });
});
