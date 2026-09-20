/**
 * Private-key normalization utilities for GitHub App JWT generation.
 *
 * This module is SERVER-ONLY. It must never be imported into client-side code.
 * GitHub App private keys are PEM-encoded and may be stored as escaped
 * multiline strings (e.g., "\\n" literals) in environment variables or config.
 */

/**
 * Normalize a GitHub App private key from an environment variable or config string.
 *
 * Converts escaped newlines ("\\n") into real newlines and trims surrounding whitespace.
 *
 * @param raw - The raw private key string as read from the environment.
 * @returns The normalized PEM key.
 */
export function normalizePrivateKey(raw: string): string {
  // Replace escaped newline sequences with real newlines
  const unescaped = raw.replace(/\\n/g, "\n");
  return unescaped.trim();
}

/**
 * Validate that a normalized private key looks like a PEM-encoded RSA key.
 *
 * This is a lightweight structural check; it does not verify cryptographic validity.
 *
 * @param key - The normalized private key to validate.
 * @returns True if the key appears to be a valid PEM block.
 */
export function isValidPrivateKeyFormat(key: string): boolean {
  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim();
  // Must contain the expected header/footer markers
  return (
    trimmed.includes("BEGIN RSA PRIVATE KEY") ||
    trimmed.includes("BEGIN PRIVATE KEY")
  ) &&
    (trimmed.includes("END RSA PRIVATE KEY") ||
     trimmed.includes("END PRIVATE KEY"));
}
