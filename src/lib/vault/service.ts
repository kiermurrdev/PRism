/**
 * Credential vault service.
 *
 * Responsibilities:
 * - Encrypt/decrypt user credentials using AES-256-GCM.
 * - Store only encrypted key material + metadata (provider, label, masked suffix, key version).
 * - Never return decrypted keys after creation.
 * - Enforce ownership: users can only access their own credentials.
 * - Support testing credentials against provider endpoints.
 * - Support credential rotation and deletion with dependency checks.
 */

import { encrypt, decrypt } from "./encryption";
import { db } from "@/lib/db/client";
import { eq, and, notInArray } from "drizzle-orm";
import {
  providerCredentials,
  repositorySettings,
  analysisJobs,
} from "@/lib/db/schema";
import type { NewProviderCredential } from "@/lib/db/schema";

/**
 * Masked credential for display. Shows provider, label, and last 4 chars.
 */
export interface CredentialSummary {
  id: string;
  provider: string;
  model: string;
  label: string | null;
  maskedSuffix: string; // e.g. "****abcd"
  keyVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new credential for a user.
 *
 * The plaintext key is encrypted immediately and never returned.
 * Only the masked summary is returned.
 */
export async function createCredential(
  userId: string,
  provider: string,
  model: string,
  apiKey: string,
  label?: string,
): Promise<CredentialSummary> {
  if (!apiKey || apiKey.length < 8) {
    throw new Error("API key must be at least 8 characters");
  }

  const keyVersion = 1;
  const encryptedApiKey = encrypt(apiKey, keyVersion);
  const maskedSuffix = "****" + apiKey.slice(-4);

  const data: NewProviderCredential = {
    userId,
    provider: provider.toLowerCase(),
    model,
    encryptedApiKey,
    maskedSuffix,
    keyVersion,
    label: label || null,
  };

  const [record] = await db
    .insert(providerCredentials)
    .values(data)
    .returning();

  return toSummary(record);
}

/**
 * List all credentials for a user (masked).
 */
export async function listCredentials(userId: string): Promise<CredentialSummary[]> {
  const records = await db
    .select()
    .from(providerCredentials)
    .where(eq(providerCredentials.userId, userId))
    .orderBy(providerCredentials.createdAt);

  return records.map(toSummary);
}

/**
 * Get a single credential summary by ID (ownership-checked).
 */
export async function getCredentialSummary(
  userId: string,
  credentialId: string,
): Promise<CredentialSummary | null> {
  const [record] = await db
    .select()
    .from(providerCredentials)
    .where(eq(providerCredentials.id, credentialId))
    .limit(1);

  if (!record || record.userId !== userId) {
    return null;
  }
  return toSummary(record);
}

/**
 * Test a credential by ID against its provider.
 *
 * Returns { success: boolean, message?: string }.
 * The decrypted key is used only in memory and never returned.
 */
export async function testCredential(
  userId: string,
  credentialId: string,
): Promise<{ success: boolean; message?: string }> {
  const [record] = await db
    .select()
    .from(providerCredentials)
    .where(eq(providerCredentials.id, credentialId))
    .limit(1);

  if (!record || record.userId !== userId) {
    throw new Error("Credential not found or access denied");
  }

  const apiKey = decrypt(record.encryptedApiKey, record.keyVersion);

  try {
    const result = await testProviderKey(record.provider, record.model, apiKey);
    return result;
  } catch (err: any) {
    return {
      success: false,
      message: sanitizeError(err.message || "Test failed"),
    };
  }
}

/**
 * Update a credential's label or model (re-encrypts with the same key).
 * To rotate the actual API key, create a new credential.
 */
export async function updateCredential(
  userId: string,
  credentialId: string,
  updates: { label?: string; model?: string },
): Promise<CredentialSummary> {
  const [record] = await db
    .select()
    .from(providerCredentials)
    .where(eq(providerCredentials.id, credentialId))
    .limit(1);

  if (!record || record.userId !== userId) {
    throw new Error("Credential not found or access denied");
  }

  const [updated] = await db
    .update(providerCredentials)
    .set({
      label: updates.label !== undefined ? updates.label : record.label,
      model: updates.model !== undefined ? updates.model : record.model,
      updatedAt: new Date(),
    })
    .where(eq(providerCredentials.id, credentialId))
    .returning();

  return toSummary(updated);
}

/**
 * Delete a credential.
 *
 * If the credential is in use by repository settings or active jobs,
 * returns an error with the conflicting references.
 */
export async function deleteCredential(
  userId: string,
  credentialId: string,
): Promise<{ success: true } | { success: false; message: string }> {
  const [record] = await db
    .select()
    .from(providerCredentials)
    .where(eq(providerCredentials.id, credentialId))
    .limit(1);

  if (!record || record.userId !== userId) {
    throw new Error("Credential not found or access denied");
  }

  // Check repository settings dependencies
  const inUseSettings = await db
    .select({ id: repositorySettings.id, repositoryId: repositorySettings.repositoryId })
    .from(repositorySettings)
    .where(eq(repositorySettings.credentialId, credentialId));

  if (inUseSettings.length > 0) {
    return {
      success: false,
      message: `Credential is used by ${inUseSettings.length} repository setting(s). Reassign or disable those repositories first.`,
    };
  }

  // Check active (non-terminal) jobs
  const activeJobs = await db
    .select({ id: analysisJobs.id, status: analysisJobs.status })
    .from(analysisJobs)
    .where(
      and(
        eq(analysisJobs.credentialId, credentialId),
        notInArray(analysisJobs.status, ["completed", "failed"]),
      ),
    );

  if (activeJobs.length > 0) {
    return {
      success: false,
      message: `Credential is used by ${activeJobs.length} active analysis job(s). Wait for completion or cancel them first.`,
    };
  }

  await db
    .delete(providerCredentials)
    .where(eq(providerCredentials.id, credentialId));

  return { success: true };
}

/**
 * Test an API key against a provider's endpoint.
 */
async function testProviderKey(
  provider: string,
  model: string,
  apiKey: string,
): Promise<{ success: boolean; message?: string }> {
  switch (provider) {
    case "openai":
      return await testOpenAI(apiKey, model);
    case "anthropic":
      return await testAnthropic(apiKey, model);
    case "nvidia":
      return await testNVIDIA(apiKey, model);
    case "gemini":
      return await testGemini(apiKey, model);
    default:
      return { success: false, message: `Unsupported provider: ${provider}` };
  }
}

async function testOpenAI(
  apiKey: string,
  model: string,
): Promise<{ success: boolean; message?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });

    if (response.ok) {
      return { success: true };
    }

    const body = await response.text().catch(() => "");
    return {
      success: false,
      message: `OpenAI returned ${response.status}: ${body.slice(0, 100)}`,
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { success: false, message: "Request timed out" };
    }
    return { success: false, message: "Connection failed" };
  } finally {
    clearTimeout(timeout);
  }
}

async function testAnthropic(
  apiKey: string,
  model: string,
): Promise<{ success: boolean; message?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "claude-3-haiku-20240307",
        max_tokens: 1,
        messages: [{ role: "user", content: "ok" }],
      }),
      signal: controller.signal,
    });

    if (response.ok || response.status === 400) {
      // 400 with valid auth means key works but params may be wrong
      return { success: true };
    }

    const body = await response.text().catch(() => "");
    return {
      success: false,
      message: `Anthropic returned ${response.status}: ${body.slice(0, 100)}`,
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { success: false, message: "Request timed out" };
    }
    return { success: false, message: "Connection failed" };
  } finally {
    clearTimeout(timeout);
  }
}

async function testNVIDIA(
  apiKey: string,
  model: string,
): Promise<{ success: boolean; message?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      "https://integrate.api.nvidia.com/v1/models",
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      },
    );

    if (response.ok) {
      return { success: true };
    }

    const body = await response.text().catch(() => "");
    return {
      success: false,
      message: `NVIDIA returned ${response.status}: ${body.slice(0, 100)}`,
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { success: false, message: "Request timed out" };
    }
    return { success: false, message: "Connection failed" };
  } finally {
    clearTimeout(timeout);
  }
}

async function testGemini(
  apiKey: string,
  model: string,
): Promise<{ success: boolean; message?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${model || "gemini-1.5-flash"}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "ok" }] }],
        }),
        signal: controller.signal,
      },
    );

    if (response.ok || response.status === 400) {
      return { success: true };
    }

    const body = await response.text().catch(() => "");
    return {
      success: false,
      message: `Gemini returned ${response.status}: ${body.slice(0, 100)}`,
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { success: false, message: "Request timed out" };
    }
    return { success: false, message: "Connection failed" };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Convert a database record to a safe summary.
 */
function toSummary(record: {
  id: string;
  provider: string;
  model: string;
  label: string | null;
  maskedSuffix: string;
  keyVersion: number;
  createdAt: Date;
  updatedAt: Date;
}): CredentialSummary {
  return {
    id: record.id,
    provider: record.provider,
    model: record.model,
    label: record.label,
    maskedSuffix: record.maskedSuffix,
    keyVersion: record.keyVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Sanitize an error message to prevent leaking secrets or internal details.
 */
function sanitizeError(message: string): string {
  // Remove any potential key/token patterns
  return message
    .replace(/(Bearer\s+)[A-Za-z0-9_-]{16,}/g, "$1[REDACTED]")
    .replace(/(x-api-key:\s*|api_key=)[A-Za-z0-9_-]{16,}/gi, "$1[REDACTED]")
    .replace(/(key=)[A-Za-z0-9_-]{16,}/g, "$1[REDACTED]");
}
