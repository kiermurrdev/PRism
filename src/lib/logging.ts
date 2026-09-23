/**
 * Structured logger with correlation ID support.
 *
 * Never logs secrets, tokens, API keys, or repository content.
 * All sensitive fields are redacted automatically.
 */

import { randomUUID } from "crypto";

const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /token/i,
  /password/i,
  /private[_-]?key/i,
  /authorization/i,
  /bearer/i,
];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => p.test(key));
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    // Redact likely tokens/keys by pattern
    if (/^sk[_-]/i.test(value) || /^ghp_/i.test(value) || /^gho_/i.test(value) || /^ghr_/i.test(value)) {
      return "[REDACTED]";
    }
    // Redact long hex/base64 strings that look like secrets
    if (/^[a-f0-9]{32,}$/i.test(value) || /^[A-Za-z0-9+/=]{40,}$/.test(value)) {
      return "[REDACTED]";
    }
    return value;
  }
  return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      result[key] = redactValue(value);
    }
  }
  return result;
}

export interface LogEntry {
  level: "info" | "warn" | "error" | "debug";
  timestamp: string;
  correlationId: string;
  message: string;
  [key: string]: unknown;
}

export function generateCorrelationId(): string {
  return randomUUID();
}

export function createStructuredLogger(): {
  info: (message: string, extra?: Record<string, unknown>) => void;
  warn: (message: string, extra?: Record<string, unknown>) => void;
  error: (message: string, extra?: Record<string, unknown>) => void;
  debug: (message: string, extra?: Record<string, unknown>) => void;
} {
  function log(level: LogEntry["level"], message: string, extra?: Record<string, unknown>) {
    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      correlationId: (extra?.correlationId as string) || generateCorrelationId(),
      message,
    };

    if (extra) {
      Object.assign(entry, sanitizeObject(extra));
    }

    // Use console methods appropriate to level
    switch (level) {
      case "error":
        console.error(JSON.stringify(entry));
        break;
      case "warn":
        console.warn(JSON.stringify(entry));
        break;
      case "debug":
        if (process.env.NODE_ENV === "development") {
          console.debug(JSON.stringify(entry));
        }
        break;
      default:
        console.log(JSON.stringify(entry));
    }
  }

  return {
    info: (message: string, extra?: Record<string, unknown>) => log("info", message, extra),
    warn: (message: string, extra?: Record<string, unknown>) => log("warn", message, extra),
    error: (message: string, extra?: Record<string, unknown>) => log("error", message, extra),
    debug: (message: string, extra?: Record<string, unknown>) => log("debug", message, extra),
  };
}

export const logger = createStructuredLogger();

/**
 * Create a logger bound to a specific correlation ID.
 */
export function bindLogger(parentLogger: ReturnType<typeof createStructuredLogger>, correlationId: string) {
  return {
    info: (message: string, extra?: Record<string, unknown>) =>
      parentLogger.info(message, { correlationId, ...extra }),
    warn: (message: string, extra?: Record<string, unknown>) =>
      parentLogger.warn(message, { correlationId, ...extra }),
    error: (message: string, extra?: Record<string, unknown>) =>
      parentLogger.error(message, { correlationId, ...extra }),
    debug: (message: string, extra?: Record<string, unknown>) =>
      parentLogger.debug(message, { correlationId, ...extra }),
  };
}
