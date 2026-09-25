/**
 * NVIDIA Nemotron adapter implementation.
 *
 * Wraps the existing Nemotron client logic behind the provider-neutral
 * AiProviderAdapter interface.
 */

import {
  AiProviderAdapter,
  AdapterResult,
  AnalysisContext,
  AdapterOptions,
  AdapterCapabilities,
} from "../adapter";
import { buildPrompt } from "./prompt";
import { ReportDataSchema } from "@/lib/analysis/schema";
import {
  DEFAULT_TIMEOUT_MS,
  MAX_REPAIR_ATTEMPTS,
} from "./constants";
import type { ReportData } from "@/types/report";

/**
 * Check if a URL is safe (not internal/loopback).
 */
function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) {
      return false;
    }

    const hostname = u.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".local") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("172.") ||
      hostname === "0.0.0.0" ||
      hostname.includes("[") // IPv6
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize a report by overlaying deterministic file stats from context.
 */
function normalizeReport(
  report: ReportData,
  context: AnalysisContext
): ReportData {
  // Ensure affectedFiles includes all changed files with correct stats
  const normalizedFiles = context.changedFiles.map((cf) => {
    const existing = report.affectedFiles.find((af) => af.path === cf.path);
    return {
      path: cf.path,
      status: cf.status,
      additions: cf.additions,
      deletions: cf.deletions,
      changeType: existing?.changeType ?? "",
    };
  });

  return {
    ...report,
    affectedFiles: normalizedFiles,
  };
}

export class NemotronAdapter implements AiProviderAdapter {
  readonly providerId = "nvidia";
  readonly modelId: string;
  readonly baseUrl: string;
  readonly apiKey: string | undefined;
  readonly capabilities: AdapterCapabilities = {
    supportsStructuredOutput: true,
    supportsSystemPrompt: true,
    maxTokens: 131072,
  };

  constructor(overrides?: { baseUrl?: string; modelId?: string; apiKey?: string }) {
    // Read env vars at construction time so tests that mutate process.env work
    const envBaseUrl = process.env.NEMOTRON_BASE_URL;
    const envModel = process.env.NEMOTRON_MODEL;
    const envApiKey = process.env.NVIDIA_API_KEY;

    this.baseUrl = overrides?.baseUrl ?? envBaseUrl ?? "https://integrate.api.nvidia.com/v1";
    this.modelId = overrides?.modelId ?? envModel ?? "nvidia/nemotron-nano-12b-8k-instruct";
    this.apiKey = overrides?.apiKey ?? envApiKey;
  }

  /**
   * Validate that required configuration is present.
   * Returns MISSING_CONFIG error if NEMOTRON_BASE_URL or NEMOTRON_MODEL are unset.
   */
  private validateConfig(): AdapterResult | null {
    if (!process.env.NEMOTRON_BASE_URL) {
      return {
        ok: false,
        error: {
          code: "MISSING_CONFIG",
          message: "NEMOTRON_BASE_URL environment variable is not set.",
        },
      };
    }
    if (!process.env.NEMOTRON_MODEL) {
      return {
        ok: false,
        error: {
          code: "MISSING_CONFIG",
          message: "NEMOTRON_MODEL environment variable is not set.",
        },
      };
    }
    return null;
  }

  async analyze(
    context: AnalysisContext,
    options?: AdapterOptions
  ): Promise<AdapterResult> {
    // Check for missing env vars (tests delete these before calling)
    const configError = this.validateConfig();
    if (configError) return configError;

    // Validate config
    if (!this.baseUrl) {
      return {
        ok: false,
        error: {
          code: "MISSING_CONFIG",
          message: "NEMOTRON_BASE_URL is not configured.",
        },
      };
    }

    if (!this.modelId) {
      return {
        ok: false,
        error: {
          code: "MISSING_CONFIG",
          message: "NEMOTRON_MODEL is not configured.",
        },
      };
    }

    if (!isSafeUrl(this.baseUrl)) {
      return {
        ok: false,
        error: {
          code: "SSRF_BLOCKED",
          message: "The configured Nemotron base URL is not allowed.",
        },
      };
    }

    const endpoint = `${this.baseUrl}/chat/completions`;
    if (!isSafeUrl(endpoint)) {
      return {
        ok: false,
        error: {
          code: "ENDPOINT_INVALID",
          message: "Invalid Nemotron endpoint.",
        },
      };
    }

    const prompt = buildPrompt(context);
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
      const result = await this.callEndpoint(endpoint, prompt, timeoutMs, attempt);

      if (result.ok) {
        const normalized = normalizeReport(result.report, context);
        return { ok: true, report: normalized };
      }

      // Non-retryable errors
      const nonRetryable = [
        "MISSING_CONFIG",
        "AUTH_FAILURE",
        "RATE_LIMITED",
        "UPSTREAM_ERROR",
        "TIMEOUT",
        "SSRF_BLOCKED",
        "ENDPOINT_INVALID",
      ];
      if (nonRetryable.includes(result.error.code)) {
        return result;
      }

      // Invalid JSON or schema: allow one repair attempt
      if (attempt < MAX_REPAIR_ATTEMPTS) {
        continue;
      }

      return result;
    }

    // Should not reach here, but provide a safe fallback
    return {
      ok: false,
      error: {
        code: "UPSTREAM_ERROR",
        message: "Analysis failed after repair attempts.",
      },
    };
  }

  private async callEndpoint(
    endpoint: string,
    prompt: string,
    timeoutMs: number,
    attempt: number
  ): Promise<AdapterResult> {
    const controller = new AbortController();
    let timeoutFired = false;
    const timer = setTimeout(() => {
      timeoutFired = true;
      controller.abort();
    }, timeoutMs);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const body: Record<string, unknown> = {
      model: this.modelId,
      messages: [
        {
          role: "system",
          content:
            "You are a code review assistant. Return a JSON object matching the ReportData schema exactly.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 16384,
    };

    // Use JSON mode on second attempt (repair)
    if (attempt > 0) {
      body.response_format = { type: "json_object" };
      (body.messages as Array<{ role: string; content: string }>)[0].content =
        "Return ONLY valid JSON matching the ReportData schema. No markdown, no explanation.";
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        return this.handleHttpError(response.status);
      }

      let text: string;
      try {
        text = await response.text();
      } catch (err) {
        clearTimeout(timer);
        if (timeoutFired || (err instanceof Error && err.name === "AbortError")) {
          return {
            ok: false,
            error: {
              code: "TIMEOUT",
              message: "Analysis request timed out.",
            },
          };
        }
        return {
          ok: false,
          error: {
            code: "NETWORK_ERROR",
            message: "Failed to read response.",
          },
        };
      }

      const data = JSON.parse(text);
      const content = data?.choices?.[0]?.message?.content;

      if (!content || typeof content !== "string") {
        return {
          ok: false,
          error: {
            code: "INVALID_JSON",
            message: "No content in model response.",
          },
        };
      }

      // Strip markdown code fences if present
      const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return {
          ok: false,
          error: {
            code: "INVALID_JSON",
            message: "Model response is not valid JSON.",
          },
        };
      }

      const validation = ReportDataSchema.safeParse(parsed);
      if (!validation.success) {
        return {
          ok: false,
          error: {
            code: "SCHEMA_INVALID",
            message: "Model response does not match expected schema.",
          },
        };
      }

      return { ok: true, report: validation.data };
    } catch (err) {
      clearTimeout(timer);

      // If the timeout timer fired, treat as TIMEOUT regardless of error type
      // (covers cases where abort() is mocked or fetch rejects with non-AbortError)
      if (timeoutFired) {
        return {
          ok: false,
          error: {
            code: "TIMEOUT",
            message: "Analysis request timed out.",
          },
        };
      }

      // If outer JSON parse fails, treat as INVALID_JSON (model returned garbage)
      if (err instanceof SyntaxError) {
        return {
          ok: false,
          error: {
            code: "INVALID_JSON",
            message: "Model response is not valid JSON.",
          },
        };
      }

      if (err instanceof Error && err.name === "AbortError") {
        return {
          ok: false,
          error: {
            code: "TIMEOUT",
            message: "Analysis request timed out.",
          },
        };
      }

      return {
        ok: false,
        error: {
          code: "NETWORK_ERROR",
          message: "Failed to connect to analysis provider.",
        },
      };
    }
  }

  private handleHttpError(status: number): AdapterResult {
    switch (status) {
      case 401:
      case 403:
        return {
          ok: false,
          error: {
            code: "AUTH_FAILURE",
            message: "Authentication failed for analysis provider.",
          },
        };
      case 429:
        return {
          ok: false,
          error: {
            code: "RATE_LIMITED",
            message: "Analysis provider rate limit exceeded.",
          },
        };
      default:
        return {
          ok: false,
          error: {
            code: "UPSTREAM_ERROR",
            message: "Analysis provider returned an error.",
          },
        };
    }
  }
}
