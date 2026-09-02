import { useState, useEffect, useCallback } from "react";
import type { Transaction } from "../types";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { CURRENCY_SYMBOLS } from "../hooks/useFxRates";

interface Props {
  projects: string[];
  /** Refetch the table: a simulated row changes every KPI on screen. */
  onChanged: () => void;
}

const field: React.CSSProperties = {
  height: "2rem", padding: "0 0.5rem", fontSize: "0.8125rem", minWidth: 0,
  fontFamily: "var(--font-sans)", color: "var(--foreground)", background: "var(--card)",
  border: "1px solid var(--input)", borderRadius: "var(--radius-lg)", outline: "none",
};

const today = () => new Date().toISOString().slice(0, 10);

/**
 * "What if this invoice lands?" — incoming payments you expect but have not
 * been paid. They count everywhere the real rows count, and are excluded from
 * every export by construction: the archive reads the CSVs and the API table,
 * and these live in neither.
 */
export function SimulatedPayments({ projects, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [payerName, setPayerName] = useState("");
  const [project, setProject] = useState("");

  const load = useCallback(() => {
    fetch("/api/simulated")
      .then((r) => r.json())
      .then((d: { simulated: Transaction[] }) => setRows(d.simulated))
      .catch(() => {});
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const add = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    await fetch("/api/simulated", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, amount: value, currency, payerName, project: project || undefined }),
    });
    setAmount("");
    setPayerName("");
    load();
    onChanged();
  };

  const remove = async (transferWiseId: string) => {
    await fetch(`/api/simulated/${encodeURIComponent(transferWiseId)}`, { method: "DELETE" });
    load();
    onChanged();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Simulated incoming payments — counted on screen, never exported"
        style={{
          flexShrink: 0, height: "1.75rem", padding: "0 0.625rem", fontSize: "0.6875rem",
          fontFamily: "var(--font-sans)", color: "var(--muted-foreground)",
          background: "transparent", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        + Expected payment
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} width="520px">
        <DialogHeader>
          <DialogTitle>Expected payments</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Incoming payments you expect but have not received. They count in the KPIs and charts so
          you can see the month as it would land, and are left out of every export.
        </DialogDescription>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", margin: "1rem 0" }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...field, width: "9rem" }} />
          <input
            type="number" min="0" step="0.01" placeholder="Amount" value={amount}
            onChange={(e) => setAmount(e.target.value)} style={{ ...field, width: "7rem", textAlign: "right" }}
          />
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ ...field, width: "5rem" }}>
            {Object.keys(CURRENCY_SYMBOLS).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            placeholder="Payer" value={payerName}
            onChange={(e) => setPayerName(e.target.value)} style={{ ...field, flex: 1, minWidth: "8rem" }}
          />
          <select value={project} onChange={(e) => setProject(e.target.value)} style={{ ...field, width: "9rem" }}>
            <option value="">No project</option>
            {projects.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <Button onClick={add} disabled={!(Number(amount) > 0)}>Add</Button>
        </div>

        {rows.length > 0 && (
          <div style={{ borderTop: "1px solid var(--border)" }}>
            {rows.map((r) => (
              <div
                key={r.transferWiseId}
                style={{
                  display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0",
                  borderBottom: "1px solid var(--border)", fontSize: "0.8125rem",
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted-foreground)" }}>{r.date}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
                  {CURRENCY_SYMBOLS[r.currency] ?? r.currency} {r.amount.toFixed(2)}
                </span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.payerName || r.description}
                  {r.project && <span style={{ color: "var(--muted-foreground)" }}> · {r.project}</span>}
                </span>
                <button
                  onClick={() => remove(r.transferWiseId)}
                  style={{
                    background: "none", border: "none", padding: 0, cursor: "pointer",
                    color: "var(--muted-foreground)", fontSize: "0.6875rem", fontFamily: "var(--font-sans)",
                  }}
                >
                  remove
                </button>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Done</Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
