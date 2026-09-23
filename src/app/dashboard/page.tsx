"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/auth-fetch";

type Installation = {
  id: string;
  githubInstallationId: number;
  accountId: string;
  appSlug: string;
  accountName: string;
};

type Repository = {
  id: string;
  fullName: string;
  installationId: string;
  isPrivate: boolean;
  settings: {
    autoReview: boolean;
    credentialId: string | null;
    isConfigured: boolean;
  } | null;
};

type Job = {
  id: string;
  repositoryId: string;
  repositoryFullName: string;
  prNumber: number;
  headSha: string;
  status: string;
  attemptCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

type Report = {
  id: string;
  jobId: string;
  repositoryId: string;
  repositoryFullName: string;
  prNumber: number;
  headCommit: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export default function DashboardPage() {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [instRes, repoRes, jobsRes, reportsRes] = await Promise.all([
          authFetch("/api/dashboard/installations"),
          authFetch("/api/dashboard/repositories"),
          authFetch("/api/dashboard/jobs?limit=10"),
          authFetch("/api/dashboard/reports?limit=10"),
        ]);

        if (!instRes.ok || !repoRes.ok || !jobsRes.ok || !reportsRes.ok) {
          const err = await (instRes.text() || repoRes.text() || jobsRes.text() || reportsRes.text());
          throw new Error(err || "Failed to load dashboard");
        }

        const [instData, repoData, jobsData, reportsData] = await Promise.all([
          instRes.json(),
          repoRes.json(),
          jobsRes.json(),
          reportsRes.json(),
        ]);

        setInstallations(instData.installations || []);
        setRepositories(repoData.repositories || []);
        setJobs(jobsData.jobs || []);
        setReports(reportsData.reports || []);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load dashboard";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="p-6 min-h-screen bg-gray-50">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 min-h-screen bg-gray-50">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-medium">Error loading dashboard</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const configuredRepos = repositories.filter((r) => r.settings?.isConfigured).length;
  const unconfiguredRepos = repositories.length - configuredRepos;
  const activeJobs = jobs.filter((j) => j.status === "running" || j.status === "queued").length;
  const failedJobs = jobs.filter((j) => j.status === "failed").length;
  const completedReports = reports.filter((r) => r.status === "completed").length;

  const statusBadgeColor = (status: string) => {
    switch (status) {
      case "running":
      case "queued":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Installations</div>
          <div className="text-2xl font-semibold text-gray-900">{installations.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Configured Repositories</div>
          <div className="text-2xl font-semibold text-gray-900">{configuredRepos}</div>
          {unconfiguredRepos > 0 && (
            <div className="text-xs text-amber-600 mt-1">
              {unconfiguredRepos} needs configuration
            </div>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Active Jobs</div>
          <div className="text-2xl font-semibold text-blue-600">{activeJobs}</div>
          {failedJobs > 0 && (
            <div className="text-xs text-red-600 mt-1">{failedJobs} failed</div>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Reports Generated</div>
          <div className="text-2xl font-semibold text-green-600">{completedReports}</div>
        </div>
      </div>

      {/* Repository Status Cards */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Repositories</h2>
          <Link
            href="/dashboard/repositories"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            View all
          </Link>
        </div>

        {repositories.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center border border-gray-200">
            <p className="text-gray-500">No repositories connected yet.</p>
            <p className="text-sm text-gray-400 mt-2">
              Install the PRism GitHub App on your repositories to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {repositories.slice(0, 6).map((repo) => (
              <div
                key={repo.id}
                className="bg-white rounded-lg shadow-sm p-4 border border-gray-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/dashboard/repositories/${repo.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600 truncate block"
                    >
                      {repo.fullName}
                    </Link>
                  </div>
                  {repo.isPrivate && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded ml-2">
                      Private
                    </span>
                  )}
                </div>

                {repo.settings?.isConfigured ? (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    <span className="text-xs text-green-700">Configured</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                    <span className="text-xs text-amber-700">Needs configuration</span>
                  </div>
                )}

                <Link
                  href={`/dashboard/repositories/${repo.id}`}
                  className="text-xs text-blue-600 hover:text-blue-800 mt-2 inline-block"
                >
                  Manage →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity Feed */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-100">
          {jobs.length === 0 && reports.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No recent activity.</p>
            </div>
          ) : (
            <>
              {jobs
                .slice(0, 5)
                .map((job) => (
                  <div key={`job-${job.id}`} className="p-4 flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-xs text-blue-700 font-medium">JOB</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900 truncate">
                        Analysis job for <span className="font-medium">{job.repositoryFullName}</span>
                        {job.prNumber > 0 && ` (PR #${job.prNumber})`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(job.updatedAt).toLocaleString()}
                      </div>
                    </div>
                    <span className={`flex-shrink-0 text-xs px-2 py-1 rounded-full ${statusBadgeColor(job.status)}`}>
                      {job.status}
                    </span>
                  </div>
                ))}

              {reports
                .slice(0, 5)
                .map((report) => (
                  <div key={`report-${report.id}`} className="p-4 flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                        <span className="text-xs text-green-700 font-medium">RPT</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900 truncate">
                        Report for <span className="font-medium">{report.repositoryFullName}</span>
                        {report.prNumber > 0 && ` (PR #${report.prNumber})`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(report.updatedAt).toLocaleString()}
                      </div>
                    </div>
                    <span className={`flex-shrink-0 text-xs px-2 py-1 rounded-full ${statusBadgeColor(report.status)}`}>
                      {report.status}
                    </span>
                  </div>
                ))}
            </>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/dashboard/repositories"
            className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 hover:border-blue-300 transition-colors"
          >
            <div className="font-medium text-gray-900">Manage Repositories</div>
            <div className="text-sm text-gray-500 mt-1">Configure credentials and review settings</div>
          </Link>
          <Link
            href="/dashboard/jobs"
            className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 hover:border-blue-300 transition-colors"
          >
            <div className="font-medium text-gray-900">View Jobs</div>
            <div className="text-sm text-gray-500 mt-1">Track analysis job progress and failures</div>
          </Link>
          <Link
            href="/dashboard/reports"
            className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 hover:border-blue-300 transition-colors"
          >
            <div className="font-medium text-gray-900">Browse Reports</div>
            <div className="text-sm text-gray-500 mt-1">View generated analysis reports</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
