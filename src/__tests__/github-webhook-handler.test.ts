/**
 * Tests for GitHub App webhook handler.
 *
 * Verifies event normalization, action filtering, signature verification,
 * and error handling. No network access, no real secrets.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { handleWebhook } from "@/lib/github/app/webhook-handler";
import { computeSignature } from "@/lib/github/app/webhook";
import {
  TEST_WEBHOOK_SECRET,
  PULL_REQUEST_OPENED_PAYLOAD,
  PULL_REQUEST_REOPENED_PAYLOAD,
  PULL_REQUEST_SYNCHRONIZE_PAYLOAD,
  PULL_REQUEST_CLOSED_PAYLOAD,
  PUSH_PAYLOAD,
} from "./github-webhook-fixtures";

/**
 * Create a mock NextRequest from a payload and headers.
 */
function mockRequest(payload: unknown, headers: Record<string, string>) {
  const body = JSON.stringify(payload);
  const buffer = Buffer.from(body);
  return {
    headers: new Headers(headers),
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    json: async () => payload,
  } as any;
}

describe("webhook handler", () => {
  describe("signature verification", () => {
    it("returns 401 when X-Hub-Signature-256 is missing", async () => {
      const req = mockRequest(PULL_REQUEST_OPENED_PAYLOAD, {
        "X-GitHub-Event": "pull_request",
      });
      const res = await handleWebhook(req, {
        webhookSecret: TEST_WEBHOOK_SECRET,
        handler: async () => {},
      });
      assert.strictEqual(res.status, 401);
      const body = await res.json();
      assert.strictEqual(body.code, "MISSING_SIGNATURE");
    });

    it("returns 401 for an invalid signature", async () => {
      const req = mockRequest(PULL_REQUEST_OPENED_PAYLOAD, {
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": "sha256=invalid",
      });
      const res = await handleWebhook(req, {
        webhookSecret: TEST_WEBHOOK_SECRET,
        handler: async () => {},
      });
      assert.strictEqual(res.status, 401);
      const body = await res.json();
      assert.strictEqual(body.code, "INVALID_SIGNATURE");
    });

    it("accepts a valid signature", async () => {
      const body = JSON.stringify(PULL_REQUEST_OPENED_PAYLOAD);
      const sig = computeSignature(TEST_WEBHOOK_SECRET, body);
      const req = mockRequest(PULL_REQUEST_OPENED_PAYLOAD, {
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": sig,
      });
      const res = await handleWebhook(req, {
        webhookSecret: TEST_WEBHOOK_SECRET,
        handler: async () => {},
      });
      assert.strictEqual(res.status, 200);
    });
  });

  describe("malformed payloads", () => {
    function signedRequest(payload: unknown) {
      const body = JSON.stringify(payload);
      const sig = computeSignature(TEST_WEBHOOK_SECRET, body);
      return mockRequest(payload, {
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": sig,
      });
    }

    it("returns 400 for malformed JSON", async () => {
      const raw = Buffer.from("{invalid-json");
      const sig = computeSignature(TEST_WEBHOOK_SECRET, raw);
      const req = mockRequest({}, {
        "X-Hub-Signature-256": sig,
        "X-GitHub-Event": "pull_request",
      });
      // Override arrayBuffer to return malformed content
      req.arrayBuffer = async () => raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
      const res = await handleWebhook(req, {
        webhookSecret: TEST_WEBHOOK_SECRET,
        handler: async () => {},
      });
      assert.strictEqual(res.status, 400);
      const jsonBody = await res.json();
      assert.strictEqual(jsonBody.code, "MALFORMED_JSON");
    });

    it("returns 400 for missing X-GitHub-Event", async () => {
      const payloadBody = JSON.stringify(PULL_REQUEST_OPENED_PAYLOAD);
      const sig = computeSignature(TEST_WEBHOOK_SECRET, payloadBody);
      const req = mockRequest(PULL_REQUEST_OPENED_PAYLOAD, {
        "X-Hub-Signature-256": sig,
      });
      const res = await handleWebhook(req, {
        webhookSecret: TEST_WEBHOOK_SECRET,
        handler: async () => {},
      });
      assert.strictEqual(res.status, 400);
      const jsonBody = await res.json();
      assert.strictEqual(jsonBody.code, "MISSING_EVENT_TYPE");
    });

    it("returns 400 for invalid payload structure", async () => {
      const req = signedRequest({ not_a_pr_event: true });
      const res = await handleWebhook(req, {
        webhookSecret: TEST_WEBHOOK_SECRET,
        handler: async () => {},
      });
      assert.strictEqual(res.status, 400);
    });

    it("returns 400 when installation is missing", async () => {
      const payload = { ...PULL_REQUEST_OPENED_PAYLOAD };
      delete (payload as any).installation;
      const req = signedRequest(payload);
      const res = await handleWebhook(req, {
        webhookSecret: TEST_WEBHOOK_SECRET,
        handler: async () => {},
      });
      assert.strictEqual(res.status, 400);
    });

    it("returns 400 when pull_request object is missing", async () => {
      const payload = { ...PULL_REQUEST_OPENED_PAYLOAD };
      delete (payload as any).pull_request;
      const req = signedRequest(payload);
      const res = await handleWebhook(req, {
        webhookSecret: TEST_WEBHOOK_SECRET,
        handler: async () => {},
      });
      assert.strictEqual(res.status, 400);
    });
  });

  describe("event filtering", () => {
    function signedRequest(payload: unknown, eventType: string) {
      const body = JSON.stringify(payload);
      const sig = computeSignature(TEST_WEBHOOK_SECRET, body);
      return mockRequest(payload, {
        "X-GitHub-Event": eventType,
        "X-Hub-Signature-256": sig,
      });
    }

    it("invokes handler for pull_request.opened", async () => {
      let received: any = null;
      const req = signedRequest(PULL_REQUEST_OPENED_PAYLOAD, "pull_request");
      await handleWebhook(req, {
        webhookSecret: TEST_WEBHOOK_SECRET,
        handler: async (event) => { received = event; },
      });
      assert.ok(received);
      assert.strictEqual(received.type, "pull_request");
      assert.strictEqual(received.action, "opened");
    });

    it("invokes handler for pull_request.reopened", async () => {
      let received: any = null;
      const req = signedRequest(PULL_REQUEST_REOPENED_PAYLOAD, "pull_request");
      await handleWebhook(req, {
        webhookSecret: TEST_WEBHOOK_SECRET,
        handler: async (event) => { received = event; },
      });
      assert.strictEqual(received?.action, "reopened");
    });

    it("invokes handler for pull_request.synchronize", async () => {
      let received: any = null;
      const req = signedRequest(PULL_REQUEST_SYNCHRONIZE_PAYLOAD, "pull_request");
      await handleWebhook(req, {
        webhookSecret: TEST_WEBHOOK_SECRET,
        handler: async (event) => { received = event; },
      });
      assert.strictEqual(received?.action, "synchronize");
    });

    it("returns 200 without invoking handler for pull_request.closed", async () => {
      let handlerCalled = false;
      const req = signedRequest(PULL_REQUEST_CLOSED_PAYLOAD, "pull_request");
      const res = await handleWebhook(req, {
        webhookSecret: TEST_WEBHOOK_SECRET,
        handler: async () => { handlerCalled = true; },
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(handlerCalled, false);
    });

    it("returns 200 for unsupported event types (push)", async () => {
      let handlerCalled = false;
      const req = signedRequest(PUSH_PAYLOAD, "push");
      const res = await handleWebhook(req, {
        webhookSecret: TEST_WEBHOOK_SECRET,
        handler: async () => { handlerCalled = true; },
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(handlerCalled, false);
    });
  });

  describe("event normalization", () => {
    function signedRequest(payload: unknown) {
      const body = JSON.stringify(payload);
      const sig = computeSignature(TEST_WEBHOOK_SECRET, body);
      return mockRequest(payload, {
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": sig,
      });
    }

    it("normalizes all required fields", async () => {
      let received: any = null;
      const req = signedRequest(PULL_REQUEST_OPENED_PAYLOAD);
      await handleWebhook(req, {
        webhookSecret: TEST_WEBHOOK_SECRET,
        handler: async (event) => { received = event; },
      });
      assert.deepStrictEqual(received.type, "pull_request");
      assert.deepStrictEqual(received.action, "opened");
      assert.deepStrictEqual(received.deliveryId, "test-delivery-123");
      assert.deepStrictEqual(received.installationId, 99999);
      assert.deepStrictEqual(received.repositoryFullName, "test-owner/test-repo");
      assert.deepStrictEqual(received.prNumber, 42);
      assert.deepStrictEqual(received.prUrl, "https://github.com/test-owner/test-repo/pull/42");
      assert.deepStrictEqual(received.prTitle, "Test pull request");
      assert.deepStrictEqual(received.headSha, "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2");
    });
  });

  describe("configuration", () => {
    it("returns 500 when webhook secret is not configured", async () => {
      const req = mockRequest(PULL_REQUEST_OPENED_PAYLOAD, {
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": "sha256=test",
      });
      const res = await handleWebhook(req, {
        webhookSecret: "",
        handler: async () => {},
      });
      assert.strictEqual(res.status, 500);
      const body = await res.json();
      assert.strictEqual(body.code, "MISSING_CONFIGURATION");
    });
  });

  describe("handler error resilience", () => {
    function signedRequest(payload: unknown) {
      const body = JSON.stringify(payload);
      const sig = computeSignature(TEST_WEBHOOK_SECRET, body);
      return mockRequest(payload, {
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": sig,
      });
    }

    it("returns 200 even when handler throws", async () => {
      const req = signedRequest(PULL_REQUEST_OPENED_PAYLOAD);
      const res = await handleWebhook(req, {
        webhookSecret: TEST_WEBHOOK_SECRET,
        handler: async () => { throw new Error("handler failure"); },
      });
      assert.strictEqual(res.status, 200);
    });
  });

  describe("secret redaction", () => {
    it("does not leak webhook secret in error responses", async () => {
      const req = mockRequest(PULL_REQUEST_OPENED_PAYLOAD, {
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": "sha256=invalid",
      });
      const res = await handleWebhook(req, {
        webhookSecret: TEST_WEBHOOK_SECRET,
        handler: async () => {},
      });
      const text = await res.text();
      assert.ok(!text.includes(TEST_WEBHOOK_SECRET), "Webhook secret must not appear in response");
    });
  });
});
