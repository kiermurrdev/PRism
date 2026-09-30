"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/auth-fetch";

type Credential = {
  id: string;
  provider: string;
  model: string;
  label: string | null;
  maskedSuffix: string;
  createdAt: string;
};

type TestResult = {
  success: boolean;
  message: string;
  responseTimeMs?: number;
};

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editModel, setEditModel] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Test state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  useEffect(() => {
    loadCredentials();
  }, []);

  async function loadCredentials() {
    try {
      const res = await authFetch("/api/vault/credentials");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to load credentials");
      }

      setCredentials(data.credentials || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load credentials");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await authFetch("/api/vault/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey, label, model }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to create credential");
      }

      setSuccess("Credential created successfully");
      setShowForm(false);
      setApiKey("");
      setLabel("");
      setModel("");
      loadCredentials();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create credential");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(credentialId: string) {
    setSavingEdit(true);
    setError(null);

    try {
      const res = await authFetch(`/api/vault/credentials/${credentialId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: editLabel, model: editModel }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to update credential");
      }

      setSuccess("Credential updated successfully");
      setEditingId(null);
      loadCredentials();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update credential");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleTest(credentialId: string) {
    setTestingId(credentialId);
    setError(null);

    try {
      const res = await authFetch(`/api/vault/credentials/${credentialId}/test`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Test failed");
      }

      setTestResults((prev) => ({
        ...prev,
        [credentialId]: data,
      }));
    } catch (e) {
      setTestResults((prev) => ({
        ...prev,
        [credentialId]: { success: false, message: e instanceof Error ? e.message : "Test failed" },
      }));
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(credentialId: string) {
    if (!confirm("Are you sure you want to delete this credential?")) return;

    setError(null);

    try {
      const res = await authFetch(`/api/vault/credentials/${credentialId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to delete credential");
      }

      setSuccess("Credential deleted successfully");
      loadCredentials();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete credential");
    }
  }

  function startEditing(credential: Credential) {
    setEditingId(credential.id);
    setEditLabel(credential.label || "");
    setEditModel(credential.model);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditLabel("");
    setEditModel("");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Back to Dashboard
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Connections</h1>
                <p className="text-sm text-gray-500">
                  Manage your AI provider connections securely
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {showForm ? "Cancel" : "+ Add Credential"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {success}
          </div>
        )}

        {/* Create Form */}
        {showForm && (
          <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Add New Credential
            </h2>
            <form onSubmit={handleCreate}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Provider */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Provider
                  </label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google (Gemini)</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="azure">Azure OpenAI</option>
                  </select>
                </div>

                {/* API Key */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="sk-..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Your key is encrypted at rest and never exposed in responses
                  </p>
                </div>

                {/* Label */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Label
                  </label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. Production, Testing"
                  />
                </div>

                {/* Model */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Model
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. gpt-4o, claude-3.5-sonnet"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Optional — can be overridden per repository
                  </p>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Creating..." : "Create Credential"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Credentials List */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading credentials...</div>
        ) : credentials.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <p className="text-gray-500 mb-2">No credentials yet</p>
            <p className="text-sm text-gray-400">
              Add your first API credential to get started with code analysis
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {credentials.map((cred) => (
              <div
                key={cred.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
              >
                {editingId === cred.id ? (
                  /* Edit Mode */
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Label
                        </label>
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Default Model
                        </label>
                        <input
                          type="text"
                          value={editModel}
                          onChange={(e) => setEditModel(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(cred.id)}
                        disabled={savingEdit}
                        className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {savingEdit ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900">
                          {cred.label || `${cred.provider} (${cred.model})`}
                        </h3>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                          {cred.provider}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Key: ••••{cred.maskedSuffix}</span>
                        {cred.model && <span>Model: {cred.model}</span>}
                        <span className="text-xs">
                          Created {new Date(cred.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {/* Test Result */}
                      {testResults[cred.id] && (
                        <div
                          className={`mt-2 text-xs px-2 py-1 rounded ${
                            testResults[cred.id].success
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {testResults[cred.id].success ? "✓ " : "✗ "}
                          {testResults[cred.id].message}
                          {testResults[cred.id].responseTimeMs && (
                            <span className="ml-1 opacity-75">
                              ({testResults[cred.id].responseTimeMs}ms)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTest(cred.id)}
                        disabled={testingId === cred.id}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 disabled:opacity-50"
                      >
                        {testingId === cred.id ? "Testing..." : "Test"}
                      </button>
                      <button
                        onClick={() => startEditing(cred)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(cred.id)}
                        className="px-3 py-1.5 bg-red-50 text-red-600 text-sm rounded-md hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
