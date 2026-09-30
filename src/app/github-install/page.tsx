/**
 * Authenticated GitHub App installation page.
 *
 * Requires a signed-in user, generates a signed state token, and redirects
 * to GitHub's installation page. On callback, the user is redirected to
 * /api/github-install/callback where the installation is linked to their account.
 *
 * This replaces the hackathon installation page that did not require auth.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import {
  buildInstallationUrl,
  getGitHubAppSlug,
} from "@/lib/github/app/installation";

export default function GitHubInstallPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      // Redirect to sign in, then back to this page
      signIn("github", {
        callbackUrl: "/github-install",
      });
      return;
    }

    const appSlug = getGitHubAppSlug();
    if (!appSlug) {
      setError("GitHub App is not configured. Contact your administrator.");
      return;
    }

    // Redirect to the server-side handler that generates the signed state
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    const callbackUrl = `${appUrl}/api/github-install/callback`;

    // Use the server endpoint to get a signed state token
    fetch("/api/github-install/link")
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => {
            throw new Error(data.message ?? "Failed to initialize installation");
          });
        }
        return res.json();
      })
      .then((data) => {
        const installationUrl = buildInstallationUrl({
          appSlug,
          redirectUrl: `${callbackUrl}?state=${encodeURIComponent(data.stateToken)}`,
        });
        window.location.href = installationUrl;
      })
      .catch((err) => {
        setError(err.message);
      });
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-primary"></div>
          <p className="text-gray-600">Initializing installation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="mb-2 text-xl font-semibold text-red-700">Installation Error</h1>
          <p className="mb-4 text-gray-600">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-primary"></div>
        <p className="text-gray-600">Redirecting to GitHub...</p>
      </div>
    </div>
  );
}
