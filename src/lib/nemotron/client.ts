import { ReportDataSchema } from "@/lib/analysis/schema";
import {
  ENV_NEMOTRON_BASE_URL,
  ENV_NEMOTRON_MODEL,
  ENV_NVIDIA_API_KEY,
  MAX_REPAIR_ATTEMPTS,
} from "./constants";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import type {
  NemotronClientOptions,
  NemotronContext,
  NemotronError,
  NemotronResult,
} from "./types";
import { DEFAULT_TIMEOUT_MS } from "./types";

/**
 * Validates that required environment variables are present.
 * Returns an error if configuration is missing.
 */
function validateConfig(): NemotronError | null {
  const baseUrl = process.env[ENV_NEMOTRON_BASE_URL];
  const model = process.env[ENV_NEMOTRON_MODEL];

  if (!baseUrl) {
    return {
      code: "MISSING_CONFIG",
      message: `${ENV_NEMOTRON_BASE_URL} environment variable is not set.`,
    };
  }

  if (!model) {
    return {
      code: "MISSING_CONFIG",
      message: `${ENV_NEMOTRON_MODEL} environment variable is not set.`,
    };
  }

  return null;
}

/**
 * Builds the Authorization header if an API key is configured.
 * Returns undefined when no key is set (for NIM endpoints that don't require auth).
 */
function buildAuthHeader(): string | undefined {
  const apiKey = process.env[ENV_NVIDIA_API_KEY];
  if (apiKey) {
    return `Bearer ${apiKey}`;
  }
  return undefined;
}

/**
 * Maps an HTTP response to a NemotronError or null if the response is OK.
 */
function errorFromResponse(response: Response): NemotronError | null {
  if (response.ok) {
    return null;
  }

  switch (response.status) {
    case 401:
    case 403:
      return {
        code: "AUTH_FAILURE",
        message: `Authentication failed with status ${response.status}.`,
      };
    case 429:
      return {
        code: "RATE_LIMITED",
        message: `Rate limited by upstream service (status ${response.status}).`,
      };
    default:
      return {
        code: "UPSTREAM_ERROR",
        message: `Upstream error: HTTP ${response.status}.`,
      };
  }
}

/**
 * Attempts to parse a JSON string, returning the parsed value or null.
 */
function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Formats Zod validation errors into a concise string for the repair prompt.
 */
function formatValidationErrors(
  result: ReturnType<typeof ReportDataSchema.safeParse>
): string {
  if (result.success) {
    return "";
  }

  const issues = result.error.issues;
  const lines = issues
    .slice(0, 20)
    .map((i) => {
      const path = i.path?.join(".") || "root";
      return `- ${path}: ${i.message}`;
    });

  if (issues.length > 20) {
    lines.push(`- ... and ${issues.length - 20} more errors`);
  }

  return lines.join("\n");
}

/**
 * Sends a single request to the Nemotron endpoint and returns the parsed result.
 */
async function sendRequest(
  baseUrl: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  signal: AbortSignal,
  repairErrors?: string
): Promise<{ ok: true; data: unknown } | { ok: false; error: NemotronError }> {
  const authHeader = buildAuthHeader();

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  if (repairErrors) {
    messages.push({
      role: "assistant",
      content:
        "I apologize for the invalid response. Here is the corrected output:",
    });
    messages.push({
      role: "user",
      content: `The previous response was invalid. Please fix the following issues and return valid JSON only:

${repairErrors}

Return ONLY valid JSON matching the schema. No prose, no markdown fences.`,
    });
  }

  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const body = JSON.stringify({
    model,
    messages,
    temperature: 0.2,
    max_tokens: 8192,
    response_format: { type: "json_object" },
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (authHeader) {
    headers["Authorization"] = authHeader;
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body,
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        ok: false,
        error: {
          code: "TIMEOUT",
          message: "Request timed out.",
        },
      };
    }
    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Network request failed.",
      },
    };
  }

  const httpError = errorFromResponse(response);
  if (httpError) {
    return { ok: false, error: httpError };
  }

  let text: string;
  try {
    text = await response.text();
  } catch {
    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Failed to read response body.",
      },
    };
  }

  const parsed = safeParseJson(text);
  if (parsed === null) {
    return {
      ok: false,
      error: {
        code: "INVALID_JSON",
        message: "Response is not valid JSON.",
      },
    };
  }

  return { ok: true, data: parsed };
}

/**
 * Extracts the content from a chat completion response.
 * Handles both standard OpenAI-compatible and NIM response shapes.
 */
function extractContent(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const obj = data as Record<string, unknown>;
  const choices = obj.choices;

  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }

  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== "object") {
    return null;
  }

  const message = (firstChoice as Record<string, unknown>).message;
  if (!message || typeof message !== "object") {
    return null;
  }

  const content = (message as Record<string, unknown>).content;
  if (typeof content === "string") {
    return content;
  }

  return null;
}

/**
 * Analyzes a pull request using the Nemotron model.
 *
 * @param context - The PR and repository context to analyze.
 * @param options - Optional client configuration.
 * @returns A validated ReportData or a typed error.
 */
export async function analyzeWithNemotron(
  context: NemotronContext,
  options: NemotronClientOptions = {}
): Promise<NemotronResult> {
  const configError = validateConfig();
  if (configError) {
    return { ok: false, error: configError };
  }

  const baseUrl = process.env[ENV_NEMOTRON_BASE_URL]!;
  const model = process.env[ENV_NEMOTRON_MODEL]!;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(context);

  let lastError: NemotronError | null = null;

  for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const repairErrors = attempt > 0 && lastError ? lastError.message : undefined;

    const result = await sendRequest(
      baseUrl,
      model,
      systemPrompt,
      userPrompt,
      controller.signal,
      repairErrors
    );

    clearTimeout(timeoutId);

    if (!result.ok) {
      lastError = result.error;
      // Don't retry on non-parseable errors (network, auth, timeout, etc.)
      if (
        result.error.code !== "INVALID_JSON" &&
        result.error.code !== "SCHEMA_INVALID"
      ) {
        return { ok: false, error: result.error };
      }
      continue;
    }

    const content = extractContent(result.data);
    if (!content) {
      lastError = {
        code: "INVALID_JSON",
        message: "Response missing expected content field.",
      };
      continue;
    }

    const parsed = safeParseJson(content);
    if (parsed === null) {
      lastError = {
        code: "INVALID_JSON",
        message: "Model response content is not valid JSON.",
      };
      continue;
    }

    const schemaResult = ReportDataSchema.safeParse(parsed);
    if (!schemaResult.success) {
      const validationDetails = formatValidationErrors(schemaResult);
      lastError = {
        code: "SCHEMA_INVALID",
        message: `Response does not match schema:\n${validationDetails}`,
      };
      continue;
    }

    // Merge deterministic affectedFiles from context into the report.
    const report = schemaResult.data;
    report.affectedFiles = context.changedFiles.map((cf) => ({
      path: cf.path,
      status: cf.status,
      additions: cf.additions,
      deletions: cf.deletions,
      changeType:
        report.affectedFiles.find((af) => af.path === cf.path)?.changeType ??
        `${cf.status} file`,
    }));

    return { ok: true, report };
  }

  return {
    ok: false,
    error: lastError ?? {
      code: "UPSTREAM_ERROR",
      message: "Analysis failed after all attempts.",
    },
  };
}
