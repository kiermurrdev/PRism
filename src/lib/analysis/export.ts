import { AnalysisResultSchema } from "./schema";

/**
 * Options for exporting an analysis result.
 */
export interface ExportOptions {
  /** Filename without extension. Defaults to "prism-report". */
  filename?: string;
}

/**
 * Error returned when export fails.
 */
export interface ExportError {
  kind: "validation" | "serialization" | "download";
  message: string;
}

/**
 * Validate and serialize an AnalysisResult to a JSON blob for download.
 * Returns the blob and suggested filename, or an error.
 */
export function serializeReport(
  result: unknown,
  options?: ExportOptions,
):
  | { blob: Blob; filename: string }
  | { error: ExportError } {
  // Validate against schema
  const validation = AnalysisResultSchema.safeParse(result);
  if (!validation.success) {
    return {
      error: {
        kind: "validation",
        message:
          "Report data is invalid and cannot be exported. Please run a new analysis.",
      },
    };
  }

  const filename =
    options?.filename ?? "prism-report";

  try {
    const json = JSON.stringify(validation.data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    return { blob, filename: `${filename}.json` };
  } catch {
    return {
      error: {
        kind: "serialization",
        message: "Failed to serialize report data.",
      },
    };
  }
}

/**
 * Trigger a browser download of a blob.
 * Returns an error object if the download cannot be initiated.
 */
export function downloadBlob(
  blob: Blob,
  filename: string,
): { error?: ExportError } {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return {};
  } catch {
    return {
      error: {
        kind: "download",
        message: "Download failed. Your browser may be blocking it.",
      },
    };
  }
}

/**
 * Export the analysis result as a JSON file.
 */
export async function exportReportAsJson(
  result: unknown,
  options?: ExportOptions,
): Promise<{ error?: ExportError }> {
  const serialized = serializeReport(result, options);
  if ("error" in serialized) {
    return { error: serialized.error };
  }
  return downloadBlob(serialized.blob, serialized.filename);
}
