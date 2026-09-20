/**
 * Tests for GitHub App webhook signature verification.
 *
 * Verifies HMAC-SHA256 computation, timing-safe comparison, and error handling.
 * No network access, no real secrets.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { computeSignature, verifySignature, signaturesMatch } from "@/lib/github/app/webhook";

describe("webhook signature", () => {
  const secret = "test-secret-123";
  const payload = '{"test":"payload"}';

  describe("computeSignature", () => {
    it("produces a sha256-prefixed hex digest", () => {
      const sig = computeSignature(secret, payload);
      assert.match(sig, /^sha256=[0-9a-f]{64}$/);
    });

    it("is deterministic for the same input", () => {
      const a = computeSignature(secret, payload);
      const b = computeSignature(secret, payload);
      assert.strictEqual(a, b);
    });

    it("differs for different payloads", () => {
      const a = computeSignature(secret, payload);
      const b = computeSignature(secret, payload + "x");
      assert.notStrictEqual(a, b);
    });

    it("differs for different secrets", () => {
      const a = computeSignature(secret, payload);
      const b = computeSignature("other-secret", payload);
      assert.notStrictEqual(a, b);
    });

    it("works with Buffer payloads", () => {
      const a = computeSignature(secret, payload);
      const b = computeSignature(secret, Buffer.from(payload));
      assert.strictEqual(a, b);
    });
  });

  describe("signaturesMatch", () => {
    it("returns true for identical signatures", () => {
      const sig = computeSignature(secret, payload);
      assert.strictEqual(signaturesMatch(sig, sig), true);
    });

    it("returns false for different signatures", () => {
      const a = computeSignature(secret, payload);
      const b = computeSignature(secret, payload + "x");
      assert.strictEqual(signaturesMatch(a, b), false);
    });

    it("returns false for empty signatures", () => {
      assert.strictEqual(signaturesMatch("", ""), false);
    });
  });

  describe("verifySignature", () => {
    it("returns null for a valid signature", () => {
      const sig = computeSignature(secret, payload);
      const result = verifySignature(secret, sig, payload);
      assert.strictEqual(result, null);
    });

    it("returns MISSING_SIGNATURE when header is absent", () => {
      const result = verifySignature(secret, null, payload);
      assert.deepStrictEqual(result, {
        code: "MISSING_SIGNATURE",
        message: "X-Hub-Signature-256 header is missing.",
      });
    });

    it("returns MISSING_SIGNATURE when header is empty", () => {
      const result = verifySignature(secret, "", payload);
      assert.strictEqual(result?.code, "MISSING_SIGNATURE");
    });

    it("returns INVALID_SIGNATURE for a wrong signature", () => {
      const result = verifySignature(secret, "sha256=0000000000000000000000000000000000000000000000000000000000000000", payload);
      assert.deepStrictEqual(result, {
        code: "INVALID_SIGNATURE",
        message: "Webhook signature verification failed.",
      });
    });

    it("rejects signatures computed with a different secret", () => {
      const sig = computeSignature("wrong-secret", payload);
      const result = verifySignature(secret, sig, payload);
      assert.strictEqual(result?.code, "INVALID_SIGNATURE");
    });

    it("works with Buffer payloads", () => {
      const sig = computeSignature(secret, payload);
      const result = verifySignature(secret, sig, Buffer.from(payload));
      assert.strictEqual(result, null);
    });
  });
});
