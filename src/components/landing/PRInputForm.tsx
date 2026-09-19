"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const EXAMPLE_PR = "https://github.com/example/ecommerce/pull/42";

const GITHUB_PR_REGEX =
  /^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+\/pull\/\d+$/;

export function PRInputForm() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const validate = useCallback((url: string): string | null => {
    if (!url.trim()) return "Please enter a PR URL";
    if (!GITHUB_PR_REGEX.test(url))
      return "Invalid URL. Use: https://github.com/{owner}/{repo}/pull/{number}";
    return null;
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const validationError = validate(value);
      if (validationError) return;
      router.push(`/analyze?pr=${encodeURIComponent(value)}`);
    },
    [value, validate, router]
  );

  const handleExample = useCallback(() => {
    setValue(EXAMPLE_PR);
    setError(null);
    router.push(`/analyze?pr=${encodeURIComponent(EXAMPLE_PR)}`);
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    if (error) setError(null);
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <label htmlFor="pr-url" className="sr-only">
          GitHub PR URL
        </label>
        <input
          id="pr-url"
          type="url"
          placeholder="https://github.com/owner/repo/pull/123"
          value={value}
          onChange={handleChange}
          className="flex-1 px-4 py-3 rounded-xl border border-[#273449] bg-[#111827] text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent"
          aria-invalid={!!error}
          aria-describedby={error ? "pr-url-error" : undefined}
        />
        <button
          type="submit"
          className="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#8B5CF6] to-[#22D3EE] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:ring-offset-2 focus:ring-offset-[#090D18] transition-opacity"
        >
          Generate impact map
        </button>
      </form>

      {error && (
        <p
          id="pr-url-error"
          role="alert"
          className="mt-2 text-sm text-[#EF4444]"
        >
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 text-sm">
        <button
          type="button"
          onClick={handleExample}
          className="text-[#22D3EE] hover:underline focus:outline-none focus:underline"
        >
          Try an example
        </button>
        <span className="text-[#64748B]">
          Prototype supports public repositories only
        </span>
      </div>
    </div>
  );
}
