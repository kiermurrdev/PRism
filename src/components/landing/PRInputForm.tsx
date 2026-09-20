"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { PR_URL_PATTERN } from "@/lib/landing-data";
import { useIsMac } from "@/hooks/useLanding";

/**
 * Behaviour is preserved from issue #3: a valid URL navigates to
 * /analyze?pr={encodedUrl}, empty and malformed input show inline
 * errors, the error clears when the input becomes valid, and Enter
 * submits. Adds a command-or-control Enter shortcut from anywhere.
 */
export default function PRInputForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const mac = useIsMac();

  const submit = () => {
    const v = (inputRef.current?.value ?? value).trim();
    if (!v) {
      setError("Paste a pull request URL to start.");
      return;
    }
    if (!PR_URL_PATTERN.test(v)) {
      setError(
        "That isn't a GitHub pull request URL. It should look like github.com/owner/repo/pull/123."
      );
      return;
    }
    setError("");
    router.push(`/analyze?pr=${encodeURIComponent(v)}`);
  };

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (mac ? !e.metaKey : !e.ctrlKey) return;
      e.preventDefault();
      inputRef.current?.focus();
      if (inputRef.current?.value.trim()) submit();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mac]);

  return (
    <div className="form rise" data-r="3">
      <div className={`field-box${error ? " is-bad" : ""}`}>
        <span className="field-glyph" aria-hidden="true">
          &#8599;
        </span>
        <label className="sr-only" htmlFor="pr">
          Public GitHub pull request URL
        </label>
        <input
          id="pr"
          ref={inputRef}
          type="url"
          inputMode="url"
          spellCheck={false}
          autoComplete="off"
          placeholder="github.com/owner/repo/pull/123"
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setValue(e.target.value);
            if (error && PR_URL_PATTERN.test(e.target.value.trim())) setError("");
          }}
          onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") submit();
          }}
        />
        <span className="kbd" aria-hidden="true">
          {mac ? "\u2318 \u23CE" : "Ctrl \u23CE"}
        </span>
        <button className="cta" type="button" onClick={submit}>
          Analyze
        </button>
      </div>

      <div className="form-foot">
        <p className="err" role="status">
          {error}
        </p>
        <p className="notice">
          Public GitHub repository &middot; No installation required
        </p>
        <p className="notice">
          <a
            href="/analyze?pr=https%3A%2F%2Fgithub.com%2Fplausible%2Fanalytics%2Fpull%2F6232"
            className="text-[#8B5CF6] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] rounded"
          >
            Try an example
          </a>
        </p>
      </div>
    </div>
  );
}
