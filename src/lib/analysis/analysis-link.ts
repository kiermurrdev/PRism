/**
 * Encode a GitHub PR URL into a query parameter value.
 * Uses base64 so the encoded URL is safe in query strings.
 */
export function encodePrUrl(prUrl: string): string {
  return btoa(prUrl);
}

/**
 * Decode a base64-encoded PR URL from a query parameter.
 * Returns null if the value is invalid.
 */
export function decodePrUrl(encoded: string | null | undefined): string | null {
  if (!encoded) return null;
  try {
    return atob(encoded);
  } catch {
    return null;
  }
}

/**
 * Build a deterministic analysis link for a given PR URL.
 * Format: /analyze?pr=<base64-encoded-pr-url>
 */
export function buildAnalysisLink(prUrl: string): string {
  const encoded = encodePrUrl(prUrl);
  return `/analyze?pr=${encoded}`;
}

/**
 * Extract the original PR URL from an analysis link.
 * Returns null if the link or pr parameter is invalid.
 * base is used as the origin when parsing relative links.
 */
export function extractPrUrlFromLink(
  link: string,
  base = "http://localhost",
): string | null {
  try {
    const url = new URL(link, base);
    const encoded = url.searchParams.get("pr");
    return decodePrUrl(encoded);
  } catch {
    return null;
  }
}
