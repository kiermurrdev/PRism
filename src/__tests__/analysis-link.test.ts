import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { encodePrUrl, decodePrUrl, buildAnalysisLink, extractPrUrlFromLink } from "@/lib/analysis/analysis-link";

describe("analysis-link helpers", () => {
  const samplePrUrl = "https://github.com/owner/repo/pull/42";

  it("encodes a PR URL to base64", () => {
    const encoded = encodePrUrl(samplePrUrl);
    assert.strictEqual(atob(encoded), samplePrUrl);
  });

  it("decodes a base64-encoded PR URL", () => {
    const encoded = btoa(samplePrUrl);
    const decoded = decodePrUrl(encoded);
    assert.strictEqual(decoded, samplePrUrl);
  });

  it("returns null when decoding an invalid base64 string", () => {
    assert.strictEqual(decodePrUrl("not-base64!!!"), null);
  });

  it("returns null when decoding null/undefined", () => {
    assert.strictEqual(decodePrUrl(null), null);
    assert.strictEqual(decodePrUrl(undefined), null);
    assert.strictEqual(decodePrUrl(""), null);
  });

  it("builds a deterministic analysis link", () => {
    const link = buildAnalysisLink(samplePrUrl);
    assert.ok(link.startsWith("/analyze?pr="));
    const encoded = link.slice("/analyze?pr=".length);
    assert.strictEqual(atob(encoded), samplePrUrl);
  });

  it("extracts the PR URL from a valid analysis link", () => {
    const link = buildAnalysisLink(samplePrUrl);
    const extracted = extractPrUrlFromLink(link);
    assert.strictEqual(extracted, samplePrUrl);
  });

  it("returns null when extracting from an invalid link", () => {
    assert.strictEqual(extractPrUrlFromLink("https://example.com/no-pr-param"), null);
    assert.strictEqual(extractPrUrlFromLink("not-a-url"), null);
  });

  it("returns null when the pr param is invalid base64", () => {
    const link = "https://example.com/analyze?pr=not-base64!!!";
    assert.strictEqual(extractPrUrlFromLink(link), null);
  });
});
