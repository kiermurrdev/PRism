"use client";

import { isGitHubAppConfigured, getGitHubAppSlug, buildInstallationUrl } from "@/lib/github/app/installation";

/**
 * ConnectGitHub button for the navigation bar.
 *
 * - When configured: links to GitHub App installation page.
 * - When unconfigured: shows a tooltip-like notice explaining setup is required.
 */
export default function ConnectGitHub() {
  const configured = isGitHubAppConfigured();

  if (configured) {
    const appSlug = getGitHubAppSlug();
    if (!appSlug) return null;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    const redirectUrl = `${appUrl}/github-install`;
    const installUrl = buildInstallationUrl({ appSlug, redirectUrl });

    return (
      <a
        className="nav-primary"
        href={installUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Connect your GitHub account to install PRism"
      >
        Connect GitHub
      </a>
    );
  }

  // Unconfigured state: still visible, but explains it needs setup.
  return (
    <div className="connect-unconfigured" role="status" aria-live="polite">
      <button
        className="nav-primary"
        type="button"
        disabled
        aria-label="GitHub installation not yet configured"
      >
        Connect GitHub
      </button>
      <span className="unconfigured-note">
        Setup required
      </span>
    </div>
  );
}
