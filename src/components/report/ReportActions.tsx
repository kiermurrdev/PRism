"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Printer,
  RotateCw,
  Link as LinkIcon,
  Check,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { exportReportAsJson } from "@/lib/analysis/export";
import { buildAnalysisLink } from "@/lib/analysis/analysis-link";
import { copyToClipboard } from "@/lib/clipboard";
import type { AnalysisResult } from "@/types/analysis";

export type ToastType = "success" | "error";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

/**
 * Minimal toast notification system for report actions feedback.
 */
function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg",
            toast.type === "success"
              ? "border-[var(--accent-cyan)]/40 bg-[var(--surface-elevated)] text-[var(--text-primary)]"
              : "border-red-500/40 bg-[var(--surface-elevated)] text-[var(--text-primary)]"
          )}
        >
          {toast.type === "success" ? (
            <Check className="h-4 w-4 text-[var(--accent-cyan)]" aria-hidden="true" />
          ) : (
            <X className="h-4 w-4 text-red-400" aria-hidden="true" />
          )}
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="ml-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            aria-label="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

export interface ReportActionsProps {
  result: AnalysisResult;
  onAnalyzeAgain: (prUrl: string) => void;
}

export default function ReportActions({
  result,
  onAnalyzeAgain,
}: ReportActionsProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Auto-dismiss after 4 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 4000);
    return () => clearTimeout(timer);
  }, [toasts]);

  const handleExportJson = useCallback(async () => {
    const outcome = await exportReportAsJson(result);
    if (outcome.error) {
      addToast(outcome.error.message, "error");
    } else {
      addToast("Report exported successfully.", "success");
    }
  }, [result, addToast]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleAnalyzeAgain = useCallback(() => {
    onAnalyzeAgain(result.prUrl);
  }, [result.prUrl, onAnalyzeAgain]);

  const handleCopyLink = useCallback(async () => {
    const link = buildAnalysisLink(result.prUrl);
    const outcome = await copyToClipboard(link);
    if (outcome.error) {
      addToast(outcome.error.message, "error");
    } else {
      addToast("Analysis link copied to clipboard.", "success");
    }
  }, [result.prUrl, addToast]);

  const buttonBase =
    "inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-purple)]";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleExportJson}
          className={buttonBase}
          aria-label="Export report as JSON"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Export report
        </button>

        <button
          type="button"
          onClick={handlePrint}
          className={buttonBase}
          aria-label="Print report or save as PDF"
        >
          <Printer className="h-3.5 w-3.5" aria-hidden="true" />
          Print
        </button>

        <button
          type="button"
          onClick={handleAnalyzeAgain}
          className={buttonBase}
          aria-label="Analyze this PR again"
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
          Analyze again
        </button>

        <button
          type="button"
          onClick={handleCopyLink}
          className={buttonBase}
          aria-label="Copy analysis link"
        >
          <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Copy link
        </button>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
