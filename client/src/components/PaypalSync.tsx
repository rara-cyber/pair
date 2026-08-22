import { useEffect, useState } from "react";

interface Status {
  configured: boolean;
  lastSyncedAt: string | null;
  count: number;
}

function ago(iso: string | null): string {
  if (!iso) return "never synced";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function PaypalSync({ onSynced }: { onSynced?: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    fetch("/api/sync-paypal").then((r) => r.json()).then(setStatus).catch(() => {});

  useEffect(() => { load(); }, []);

  const sync = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sync-paypal", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      setStatus((s) => (s ? { ...s, lastSyncedAt: d.lastSyncedAt, count: d.count } : s));
      onSynced?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || status?.configured === false;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
      <button
        onClick={sync}
        disabled={disabled}
        title={status?.configured === false ? "PAYPAL_CLIENT_ID / SECRET not set" : "Pull the last ~3 years of PayPal transactions"}
        style={{
          padding: "0.4rem 0.7rem", borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)", background: "var(--card)",
          color: "var(--foreground)", fontSize: "0.8125rem",
          cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {busy ? "Syncing…" : "Sync now"}
      </button>
      <span style={{ fontSize: "0.6875rem", color: error ? "var(--negative)" : "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>
        {error
          ? error.slice(0, 46)
          : status?.configured === false
            ? "not configured"
            : `${status?.count ?? 0} txns · ${ago(status?.lastSyncedAt ?? null)}`}
      </span>
    </div>
  );
}
