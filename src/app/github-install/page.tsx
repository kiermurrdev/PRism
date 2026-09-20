/**
 * GET /github-install
 *
 * GitHub App installation callback page.
 *
 * Handles the redirect from GitHub after the user installs/uninstalls/updates
 * the PRism app. This page is honest about what it knows: it confirms the
 * installation callback was received, but does not claim webhook success
 * without verification.
 */

import Link from "next/link";
import { parseInstallationCallback } from "@/lib/github/app/installation";

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function GitHubInstallPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === "string") {
      params.set(key, value);
    }
  }
  const result = parseInstallationCallback(params);

  if (!result.ok) {
    return <InvalidCallback reason={result.reason ?? "Unknown error."} />;
  }

  if (result.setupAction === "installed") {
    return <InstalledSuccess installationId={result.installationId ?? 0} />;
  }

  if (result.setupAction === "uninstalled") {
    return <UninstalledNotice />;
  }

  if (result.setupAction === "updated") {
    return <UpdatedSuccess installationId={result.installationId ?? 0} />;
  }

  return <InvalidCallback reason="Unknown installation action." />;
}

function InstalledSuccess({ installationId }: { installationId: number }) {
  return (
    <div className="github-install">
      <div className="github-install-content">
        <div className="github-install-icon" aria-hidden="true">&#10003;</div>
        <h1>PRism installed</h1>
        <p className="github-install-message">
          PRism is now installed on your account (installation #{installationId}).
        </p>
        <div className="github-install-details" role="status" aria-live="polite">
          <p>
            <strong>What happens next:</strong>
          </p>
          <ul>
            <li>
              When you open a pull request on a repository where PRism is installed,
              PRism will automatically post a comment with an analysis link.
            </li>
            <li>
              Opening the analysis link runs the architectural impact report.
            </li>
          </ul>
          <p className="github-install-note">
            We have received your installation confirmation. Webhook delivery will be
            verified automatically when the first pull request event arrives.
          </p>
        </div>
        <div className="github-install-actions">
          <Link href="/analyze" className="github-install-btn">
            Analyze a PR now
          </Link>
          <Link href="/" className="github-install-link">
            Return to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}

function UpdatedSuccess({ installationId }: { installationId: number }) {
  return (
    <div className="github-install">
      <div className="github-install-content">
        <div className="github-install-icon" aria-hidden="true">&#8635;</div>
        <h1>PRism updated</h1>
        <p className="github-install-message">
          Your PRism installation has been updated (installation #{installationId}).
        </p>
        <p className="github-install-note">
          Existing repositories remain configured. Webhook delivery will be
          verified automatically when the next pull request event arrives.
        </p>
        <div className="github-install-actions">
          <Link href="/analyze" className="github-install-btn">
            Analyze a PR now
          </Link>
          <Link href="/" className="github-install-link">
            Return to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}

function UninstalledNotice() {
  return (
    <div className="github-install">
      <div className="github-install-content">
        <div className="github-install-icon github-install-icon-warn" aria-hidden="true">&#9888;</div>
        <h1>PRism uninstalled</h1>
        <p className="github-install-message">
          PRism has been uninstalled from your account.
        </p>
        <p className="github-install-note">
          You can still use PRism to analyze public pull requests manually.
          Automatic webhook-based analysis requires the app to be installed.
        </p>
        <div className="github-install-actions">
          <Link href="/analyze" className="github-install-btn">
            Analyze a PR manually
          </Link>
          <Link href="/" className="github-install-link">
            Return to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}

function InvalidCallback({ reason }: { reason: string }) {
  return (
    <div className="github-install">
      <div className="github-install-content">
        <div className="github-install-icon github-install-icon-error" aria-hidden="true">&#10008;</div>
        <h1>Installation callback error</h1>
        <p className="github-install-message">
          We could not verify your installation status.
        </p>
        <p className="github-install-error" role="alert">
          {reason}
        </p>
        <p className="github-install-note">
          If you recently installed PRism, try installing again from the
          homepage. If the problem persists, contact support.
        </p>
        <div className="github-install-actions">
          <Link href="/" className="github-install-btn">
            Return to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
