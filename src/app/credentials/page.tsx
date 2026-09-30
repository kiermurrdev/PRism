"use client";

import { useState, useEffect, useRef } from "react";
import { authFetch } from "@/lib/auth-fetch";
import "./credentials.css";
import BrandedNav from "@/components/landing/BrandedNav";
import ReferenceField from "@/components/landing/ReferenceField";

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

  const formRef = useRef<HTMLDivElement>(null);

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

  const providerIcon = (p: string) => {
    switch (p) {
      case "openai": return "⟁";
      case "anthropic": return "◈";
      case "google": return "◉";
      case "openrouter": return "◐";
      case "azure": return "☁";
      default: return "•";
    }
  };

  return (
    <div className="lp">
      <ReferenceField />
      <div id="page">
        <BrandedNav />

        <main id="top">
          <div className="wrap hero">
            <h1 className="hero-h1 rise" data-r="1">
              <span className="l">Manage your AI credentials.</span>
            </h1>

            <p className="hero-sub rise" data-r="2">
              Add API keys for OpenAI, Anthropic, Google, OpenRouter, or custom endpoints.
              Test connections, update labels, or remove credentials anytime.
            </p>
          </div>

          <section className="wrap section">
            {/* Messages */}
            {error && (
              <div className="glass-card p-4 mb-6 border border-[#EF4444]/30">
                <p className="text-[#EF4444] text-sm">{error}</p>
              </div>
            )}
            {success && (
              <div className="glass-card p-4 mb-6 border border-[#22D3EE]/30">
                <p className="text-[#22D3EE] text-sm">{success}</p>
              </div>
            )}

            {/* Add credential button */}
            {!showForm && (
              <button
                className="glass-btn credentials-btn mb-6"
                onClick={() => setShowForm(true)}
              >
                Add credential
              </button>
            )}

            {/* Add form */}
            {showForm && (
              <div ref={formRef} className="glass-card p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Add new credential</h2>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className="block text-sm text-[#94A3B8] mb-1">Provider</label>
                    <select
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#273449] bg-[#111827]/80 text-[#F8FAFC] text-sm"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="google">Google (Gemini)</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="azure">Azure OpenAI</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-[#94A3B8] mb-1">API Key</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                      required
                      className="w-full px-3 py-2 rounded-lg border border-[#273449] bg-[#111827]/80 text-[#F8FAFC] text-sm font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-[#94A3B8] mb-1">Label (optional)</label>
                      <input
                        type="text"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder="e.g. Production"
                        className="w-full px-3 py-2 rounded-lg border border-[#273449] bg-[#111827]/80 text-[#F8FAFC] text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-[#94A3B8] mb-1">Model (optional)</label>
                      <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="e.g. gpt-4o"
                        className="w-full px-3 py-2 rounded-lg border border-[#273449] bg-[#111827]/80 text-[#F8FAFC] text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button type="submit" className="glass-btn credentials-btn" disabled={saving || !apiKey.trim()}>
                      {saving ? "Saving..." : "Save credential"}
                    </button>
                    <button
                      type="button"
                      className="glass-btn credentials-btn"
                      onClick={() => {
                        setShowForm(false);
                        setApiKey("");
                        setLabel("");
                        setModel("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Credentials list */}
            {loading ? (
              <p className="text-[#94A3B8] text-sm">Loading...</p>
            ) : credentials.length === 0 ? (
              <p className="text-[#94A3B8] text-sm">No credentials added yet.</p>
            ) : (
              <div className="space-y-4">
                {credentials.map((c) => {
                  const result = testResults[c.id];
                  const isEditing = editingId === c.id;

                  return (
                    <div key={c.id} className="glass-card p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="inline-flex items-center rounded-full bg-[#8B5CF6]/20 text-[#8B5CF6] text-xs px-2 py-0.5 font-medium">
                              {providerIcon(c.provider)} {c.provider}
                            </span>
                            {c.label && (
                              <span className="text-[#F8FAFC] text-sm">{c.label}</span>
                            )}
                          </div>
                          <p className="text-[#94A3B8] text-xs font-mono">
                            {c.maskedSuffix}
                          </p>
                          {c.model && (
                            <p className="text-[#94A3B8] text-xs mt-1">
                              Model: {c.model}
                            </p>
                          )}
                          {result && (
                            <p className={`text-xs mt-1 ${result.success ? "text-[#22D3EE]" : "text-[#EF4444]"}`}>
                              {result.message}
                              {result.responseTimeMs != null && ` (${result.responseTimeMs}ms)`}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {!isEditing && (
                            <>
                              <button
                                className="glass-btn credentials-btn text-xs"
                                onClick={() => handleTest(c.id)}
                                disabled={testingId === c.id}
                              >
                                {testingId === c.id ? "Testing..." : "Test"}
                              </button>
                              <button
                                className="glass-btn credentials-btn text-xs"
                                onClick={() => startEditing(c)}
                              >
                                Edit
                              </button>
                              <button
                                className="glass-btn credentials-btn credentials-btn-remove text-xs"
                                onClick={() => handleDelete(c.id)}
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Edit form */}
                      {isEditing && (
                        <div className="mt-4 pt-4 border-t border-[#273449] space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-[#94A3B8] mb-1">Label</label>
                              <input
                                type="text"
                                value={editLabel}
                                onChange={(e) => setEditLabel(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-[#273449] bg-[#111827]/80 text-[#F8FAFC] text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-[#94A3B8] mb-1">Model</label>
                              <input
                                type="text"
                                value={editModel}
                                onChange={(e) => setEditModel(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-[#273449] bg-[#111827]/80 text-[#F8FAFC] text-sm font-mono"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              className="glass-btn credentials-btn text-xs"
                              onClick={() => handleUpdate(c.id)}
                              disabled={savingEdit}
                            >
                              {savingEdit ? "Saving..." : "Save"}
                            </button>
                            <button
                              className="glass-btn credentials-btn text-xs"
                              onClick={cancelEditing}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
