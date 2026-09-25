"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/auth-fetch";

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

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadJobs() {
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (statusFilter) params.set("status", statusFilter);
        const res = await authFetch(`/api/dashboard/jobs?${params}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || "Failed to load jobs");
        setJobs(data.jobs || []);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load jobs";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadJobs();
  }, [statusFilter]);

  const handleRetry = async (jobId: string) => {
    setRetryingId(jobId);
    try {
      const res = await authFetch(`/api/dashboard/jobs/${jobId}/retry`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to retry job");

      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? { ...j, status: "queued", errorMessage: null }
            : j
        )
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to retry job";
      setError(message);
    } finally {
      setRetryingId(null);
    }
  };

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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-blue-600 hover:text-blue-800">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="queued">Queued</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center border border-gray-200">
          <p className="text-gray-500">No jobs found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Repository</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PR</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attempts</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{job.repositoryFullName}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {job.prNumber > 0 ? `#${job.prNumber}` : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${statusBadgeColor(job.status)}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{job.attemptCount}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(job.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {job.status === "failed" && (
                      <button
                        onClick={() => handleRetry(job.id)}
                        disabled={retryingId === job.id}
                        className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                      >
                        {retryingId === job.id ? "Retrying..." : "Retry"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
