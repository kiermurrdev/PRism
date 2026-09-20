import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { copyToClipboard } from "@/lib/clipboard";

describe("clipboard helpers", () => {
  it("returns an error when clipboard APIs are unavailable", async () => {
    // In Node.js, navigator.clipboard does not exist; fallback uses document which also doesn't exist
    const result = await copyToClipboard("test text");
    assert.ok(result.error, "Should return an error in Node.js environment");
  });
});
