"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnalysisProgress } from "@/components/analysis/AnalysisProgress";
import type { AnalysisSnapshot } from "@/types/analysis";

type AnalysisState =
  | { type: "idle" }
  | { type: "analyzing"; snapshot?: AnalysisSnapshot }
  | { type: "success" }
  | { type: "error"; message: string };

const JOB_STATUS_POLL_INTERVAL = 1500;

export default function AnalyzeContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<AnalysisState>({ type: "idle" });
  const [prUrl, setPrUrl] = useState<string | null>(null);

  // Decode and validate the PR URL from query params
  useEffect(() => {
    const raw = searchParams.get("pr");
    if (!raw) {
      setState({ type: "error", message: "No pull request URL provided." });
      return;
    }

    let decoded: string;
    try {
      // Try base64 first (used by "Analyze again" flow), then URL decode
      try {
        decoded = atob(raw);
      } catch {
        decoded = decodeURIComponent(raw);
      }
    } catch {
      setState({ type: "error", message: "Invalid pull request URL." });
      return;
    }

    if (!decoded || !decoded.includes("/pull/")) {
      setState({ type: "error", message: "Invalid pull request URL." });
      return;
    }

    setPrUrl(decoded);
  }, [searchParams]);

  // Start analysis when we have a valid PR URL
  useEffect(() => {
    if (!prUrl || state.type !== "idle") return;

    let cancelled = false;
    const controller = new AbortController();

    const startAnalysis = async () => {
      setState({ type: "analyzing", snapshot: { stage: "initiating", message: "Starting analysis..." } });

      try {
        const res = await fetch("/api/analyze/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prUrl }),
          signal: controller.signal,
        });

        if (cancelled) return;

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setState({
            type: "error",
            message: data.error || `Failed to start analysis (${res.status}).`,
          });
          return;
        }

        const { jobId } = await res.json();
        await pollJobStatus(jobId, controller.signal, cancelled);
      } catch (err: any) {
        if (cancelled || err.name === "AbortError") return;
        setState({
          type: "error",
          message: err.message || "Analysis failed to start.",
        });
      }
    };

    startAnalysis();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [prUrl, state.type]);

  const pollJobStatus = async (
    jobId: string,
    signal: AbortSignal,
    cancelledRef: boolean
  ) => {
    const poll = async () => {
      if (cancelledRef || signal.aborted) return;

      try {
        const res = await fetch(`/api/jobs/${jobId}/status`, { signal });
        if (cancelledRef) return;

        if (!res.ok) {
          // If job not found, treat as error
          if (res.status === 404) {
            setState({ type: "error", message: "Analysis job not found." });
            return;
          }
          // Retry on transient errors
          setTimeout(poll, JOB_STATUS_POLL_INTERVAL);
          return;
        }

        const data = await res.json();
        if (cancelledRef) return;

        const { status, message } = data;

        if (status === "completed") {
          setState({ type: "success" });
          return;
        }

        if (status === "failed" || status === "cancelled") {
          setState({
            type: "error",
            message: message || "Analysis job failed.",
          });
          return;
        }

        // pending / running — update snapshot
        setState({
          type: "analyzing",
          snapshot: {
            stage: status,
            message: message || "Analyzing...",
          },
        });

        setTimeout(poll, JOB_STATUS_POLL_INTERVAL);
      } catch (err: any) {
        if (cancelledRef || err.name === "AbortError") return;
        // Retry on transient network errors
        setTimeout(poll, JOB_STATUS_POLL_INTERVAL);
      }
    };

    poll();
  };

  const handleRetry = () => {
    window.location.reload();
  };

  const handleBack = () => {
    window.location.href = "/";
  };

  // Show progress UI once we're past idle
  if (state.type === "idle") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-[#94A3B8] text-sm">Preparing analysis...</div>
      </div>
    );
  }

  if (!prUrl) {
    return null;
  }

  return (
    <AnalysisProgress
      prUrl={prUrl}
      state={state}
      onRetry={handleRetry}
      onBack={handleBack}
    />
  );
}
