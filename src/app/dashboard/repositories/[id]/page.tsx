"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/lib/auth-fetch";

type RepositorySettings = {
  id: string;
  repositoryId: string;
  autoReview: boolean;
  credentialId: string | null;
  promptVersion: string;
  createdAt: string;
  updatedAt: string;
};

type Credential = {
  id: string;
  provider: string;
  model: string;
  label: string | null;
  maskedSuffix: string;
};

export default function RepositorySettingsPage() {
  const params = useParams();
  const repositoryId = params.id as string;

  const [settings, setSettings] = useState<RepositorySettings | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [autoReview, setAutoReview] = useState(true);
  const [credentialId, setCredentialId] = useState("");
  const [promptVersion, setPromptVersion] = useState("v1");

  useEffect(() => {
    async function loadData() {
      try {
        const [settingsRes, credsRes] = await Promise.all([
          authFetch(`/api/dashboard/repositories/${repositoryId}/settings`),
          authFetch("/api/vault/credentials"),
        ]);

        const settingsData = await settingsRes.json();
        if (!settingsRes.ok) {
          throw new Error(settingsData.message || "Failed to load settings");
        }

        if (settingsData.settings) {
          setSettings(settingsData.settings);
          setAutoReview(settingsData.settings.autoReview);
          setCredentialId(settingsData.settings.credentialId || "");
          setPromptVersion(settingsData.settings.promptVersion);
        }

        const credsData = await credsRes.json();
        if (credsRes.ok) {
          setCredentials(credsData.credentials || []);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load repository settings";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [repositoryId]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await authFetch(`/api/dashboard/repositories/${repositoryId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoReview,
          credentialId: credentialId || null,
          promptVersion,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to save settings");
      }

      setSettings(data.settings);
      setSuccess("Settings saved successfully");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save settings";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="p-6 min-h-screen bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-medium">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
        <Link href="/dashboard" className="text-sm text-blue-600 hover:text-blue-800 mt-4 inline-block">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <div className="max-w-2xl">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Repository Settings</h1>

        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">
            {success}
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
          {/* Auto Review Toggle */}
          <div>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-medium text-gray-900">Auto Review</div>
                <div className="text-sm text-gray-500">
                  Automatically post PRism analysis comments on new pull requests
                </div>
              </div>
              <div
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoReview ? "bg-blue-600" : "bg-gray-300"
                }`}
                onClick={() => setAutoReview(!autoReview)}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoReview ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </div>
            </label>
          </div>

          {/* Credential Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Credential
            </label>
            <select
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Use default credentials</option>
              {credentials.map((cred) => (
                <option key={cred.id} value={cred.id}>
                  {cred.label || `${cred.provider} (${cred.model})`} — {cred.maskedSuffix}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Required for code analysis. Leave blank to use default credentials.
            </p>
            <Link
              href="/dashboard/credentials"
              className="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-block"
            >
              Manage credentials →
            </Link>
          </div>

          {/* Prompt Version */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prompt Version
            </label>
            <select
              value={promptVersion}
              onChange={(e) => setPromptVersion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="v1">v1 - Standard Analysis</option>
              <option value="v2">v2 - Enhanced Analysis</option>
            </select>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
