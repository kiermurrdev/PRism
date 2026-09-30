"use client";

import { useState, useEffect, useRef } from "react";
import { authFetch } from "@/lib/auth-fetch";
import "./credentials.css";

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
      <div id="field">
        <div className="bloom" />
      </div>
      <div id="page">
        {/* Nav */}
        <nav className="nav is-scrolled">
          <div className="wrap nav-in">
            <a href="/" className="logo">
              <img
                src="/logo.svg"
                alt="PRism"
                className="logo-mark"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <span className="logo-word">PRism</span>
            </a>
            <div className="nav-right">
              <a href="/" className="nav-link">Home</a>
              <a href="/dashboard" className="nav-link">Dashboard</a>
              <a href="/credentials" className="nav-link is-active">Connections</a>
            </div>
          </div>
        </nav>
        <div className="nav-spacer" />

        {/* Header */}
        <section className="section">
          <div className="wrap">
            <div className="s-head">
              <h1 className="s-title">Connections</h1>
              <p className="s-note">
                Manage your AI provider connections. Keys are encrypted at rest and never exposed.
              </p>
            </div>

            {/* Messages */}
            {error && (
              <div className="err" style={{ maxWidth: "600px", margin: "0 auto 16px", textAlign: "center" }}>
                {error}
              </div>
            )}
            {success && (
              <div className="notice" style={{ maxWidth: "600px", margin: "0 auto 16px", textAlign: "center", color: "var(--accent-cyan)" }}>
                {success}
              </div>
            )}

            {/* Add Credential Button / Form */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "32px" }}>
              {!showForm ? (
                <button
                  onClick={() => setShowForm(true)}
                  className="nav-primary"
                  style={{ padding: "12px 24px", fontSize: "14px" }}
                >
                  + Add Connection
                </button>
              ) : (
                <div
                  ref={formRef}
                  className="glass"
                  style={{
                    maxWidth: "600px",
                    width: "100%",
                    padding: "20px 24px",
                    borderRadius: "var(--radius)",
                  }}
                >
                  <form onSubmit={handleCreate}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      {/* Provider */}
                      <div>
                        <label className="sr-only">Provider</label>
                        <select
                          value={provider}
                          onChange={(e) => setProvider(e.target.value)}
                          required
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            background: "var(--glass-thin)",
                            border: "1px solid var(--glass-line)",
                            borderRadius: "8px",
                            color: "var(--text-primary)",
                            fontSize: "13.5px",
                            fontFamily: "inherit",
                            outline: "none",
                          }}
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
                        <label className="sr-only">API Key</label>
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          required
                          placeholder="sk-..."
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            background: "var(--glass-thin)",
                            border: "1px solid var(--glass-line)",
                            borderRadius: "8px",
                            color: "var(--text-primary)",
                            fontSize: "13.5px",
                            fontFamily: "var(--font-mono)",
                            outline: "none",
                          }}
                        />
                      </div>

                      {/* Label */}
                      <div>
                        <label className="sr-only">Label</label>
                        <input
                          type="text"
                          value={label}
                          onChange={(e) => setLabel(e.target.value)}
                          placeholder="e.g. Production"
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            background: "var(--glass-thin)",
                            border: "1px solid var(--glass-line)",
                            borderRadius: "8px",
                            color: "var(--text-primary)",
                            fontSize: "13.5px",
                            outline: "none",
                          }}
                        />
                      </div>

                      {/* Model */}
                      <div>
                        <label className="sr-only">Default Model</label>
                        <input
                          type="text"
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          placeholder="e.g. gpt-4o"
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            background: "var(--glass-thin)",
                            border: "1px solid var(--glass-line)",
                            borderRadius: "8px",
                            color: "var(--text-primary)",
                            fontSize: "13.5px",
                            fontFamily: "var(--font-mono)",
                            outline: "none",
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="nav-link"
                        style={{ padding: "8px 14px" }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="cta"
                        style={{ padding: "8px 18px", fontSize: "13.5px" }}
                      >
                        {saving ? "Creating..." : "Create"}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Credentials List */}
            {loading ? (
              <div style={{ textAlign: "center", color: "var(--ink-faint)", padding: "40px 0" }}>
                Loading connections...
              </div>
            ) : credentials.length === 0 ? (
              <div
                className="panel"
                style={{
                  textAlign: "center",
                  padding: "40px 24px",
                  maxWidth: "480px",
                  margin: "0 auto",
                }}
              >
                <p style={{ color: "var(--text-muted)", marginBottom: "4px" }}>
                  No connections yet
                </p>
                <p style={{ color: "var(--ink-faint)", fontSize: "13px" }}>
                  Add your first AI provider connection to get started
                </p>
              </div>
            ) : (
              <div style={{ maxWidth: "720px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                {credentials.map((cred) => (
                  <div
                    key={cred.id}
                    className="panel"
                    style={{
                      padding: "14px 18px",
                      borderRadius: "var(--radius)",
                    }}
                  >
                    {editingId === cred.id ? (
                      /* Edit Mode */
                      <div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                          <input
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            placeholder="Label"
                            style={{
                              padding: "8px 10px",
                              background: "var(--glass-thin)",
                              border: "1px solid var(--glass-line)",
                              borderRadius: "8px",
                              color: "var(--text-primary)",
                              fontSize: "13.5px",
                              outline: "none",
                            }}
                          />
                          <input
                            type="text"
                            value={editModel}
                            onChange={(e) => setEditModel(e.target.value)}
                            placeholder="Default model"
                            style={{
                              padding: "8px 10px",
                              background: "var(--glass-thin)",
                              border: "1px solid var(--glass-line)",
                              borderRadius: "8px",
                              color: "var(--text-primary)",
                              fontSize: "13.5px",
                              fontFamily: "var(--font-mono)",
                              outline: "none",
                            }}
                          />
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => handleUpdate(cred.id)}
                            disabled={savingEdit}
                            className="cta"
                            style={{ padding: "6px 14px", fontSize: "12.5px" }}
                          >
                            {savingEdit ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="nav-link"
                            style={{ padding: "6px 12px" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span style={{ fontSize: "14px" }}>{providerIcon(cred.provider)}</span>
                            <span style={{ fontWeight: 500, fontSize: "14.5px" }}>
                              {cred.label || `${cred.provider}`}
                            </span>
                            <span
                              style={{
                                fontSize: "10px",
                                padding: "2px 7px",
                                borderRadius: "100px",
                                background: "var(--glass-thin)",
                                border: "1px solid var(--glass-line)",
                                color: "var(--text-muted)",
                                fontFamily: "var(--font-mono)",
                              }}
                            >
                              {cred.provider}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "12px", color: "var(--ink-faint)", flexWrap: "wrap" }}>
                            <span className="mono">••••{cred.maskedSuffix}</span>
                            {cred.model && (
                              <span className="mono">
                                {cred.model}
                              </span>
                            )}
                            <span>
                              {new Date(cred.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          {/* Test Result */}
                          {testResults[cred.id] && (
                            <div
                              style={{
                                marginTop: "6px",
                                fontSize: "11.5px",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                background: testResults[cred.id].success
                                  ? "color-mix(in srgb, var(--accent-cyan) 10%, transparent)"
                                  : "color-mix(in srgb, var(--status-possible) 12%, transparent)",
                                color: testResults[cred.id].success
                                  ? "var(--accent-cyan)"
                                  : "var(--status-possible)",
                              }}
                            >
                              {testResults[cred.id].success ? "✓" : "✗"}
                              {testResults[cred.id].message}
                              {testResults[cred.id].responseTimeMs && (
                                <span style={{ opacity: 0.7 }}>
                                  ({testResults[cred.id].responseTimeMs}ms)
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                          <button
                            onClick={() => handleTest(cred.id)}
                            disabled={testingId === cred.id}
                            style={{
                              padding: "5px 10px",
                              fontSize: "12px",
                              borderRadius: "6px",
                              border: "1px solid var(--glass-line)",
                              background: "var(--glass-thin)",
                              color: "var(--text-muted)",
                              cursor: "pointer",
                              transition: "all 0.2s",
                            }}
                          >
                            {testingId === cred.id ? "..." : "Test"}
                          </button>
                          <button
                            onClick={() => startEditing(cred)}
                            style={{
                              padding: "5px 10px",
                              fontSize: "12px",
                              borderRadius: "6px",
                              border: "1px solid var(--glass-line)",
                              background: "var(--glass-thin)",
                              color: "var(--text-muted)",
                              cursor: "pointer",
                              transition: "all 0.2s",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(cred.id)}
                            style={{
                              padding: "5px 10px",
                              fontSize: "12px",
                              borderRadius: "6px",
                              border: "1px solid color-mix(in srgb, var(--status-possible) 30%, transparent)",
                              background: "color-mix(in srgb, var(--status-possible) 8%, transparent)",
                              color: "var(--status-possible)",
                              cursor: "pointer",
                              transition: "all 0.2s",
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
