import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "./ui/Card";
import { useProgress } from "../hooks/useProgress";

interface UnmatchedPdf {
  filename: string;
  dates?: string[];
  amounts?: number[];
  /**
   * Why this document cannot attach to anything. Absent means it still can —
   * or that the server had not loaded enough to say.
   */
  blocked?: "zero-value" | "already-documented" | "no-transaction";
  previewUrl?: string;
}

// Only "no-transaction" is temporary; the other two will read the same after
// any future import, which is what the wording has to convey.
const BLOCKED_REASON: Record<NonNullable<UnmatchedPdf["blocked"]>, string> = {
  "zero-value": "every figure on it is zero — no payment to match",
  "already-documented": "its transaction already has a document",
  "no-transaction": "no transaction carries this amount yet",
};

const PAGE = 25;

type SortKey = "name" | "date" | "amount";
type Sort = { key: SortKey; dir: "asc" | "desc" };

// One definition of the column geometry, shared by the header and every row —
// they are separate grids, so a width that lives in two places drifts and the
// header stops sitting above its column.
const COLS = "minmax(0, 1fr) 6rem 5rem";

function SortHeader({
  label,
  col,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  col: SortKey;
  sort: Sort;
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === col;
  return (
    <button
      onClick={() => onSort(col)}
      title={`Sort by ${label.toLowerCase()}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.25rem",
        justifyContent: align === "right" ? "flex-end" : "flex-start",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: "0.625rem",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: active ? "var(--foreground)" : "var(--muted-foreground)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
      {/* The caret occupies its slot even when inactive, so the labels do not
          shift sideways as the sort moves between columns. */}
      <span style={{ opacity: active ? 1 : 0, fontSize: "0.5rem", lineHeight: 1 }}>
        {sort.dir === "asc" ? "▲" : "▼"}
      </span>
    </button>
  );
}

export function UnmatchedDocuments() {
  const [pdfs, setPdfs] = useState<UnmatchedPdf[] | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "date", dir: "desc" });
  const [hideHopeless, setHideHopeless] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetch("/api/unmatched-pdfs")
        .then((r) => r.json())
        .then((d) => setPdfs(Array.isArray(d) ? d : (d.pdfs ?? d.unmatched ?? [])))
        .catch(() => setPdfs([])),
    [],
  );

  useEffect(() => { load(); }, [load]);

  // A retry hands the documents to a background pass, so what is on screen goes
  // stale the moment it starts. The matcher already announces the end of a pass
  // over SSE — listen for it rather than making the user reload.
  const status = useProgress()?.status;
  useEffect(() => { if (status === "done") load(); }, [status, load]);

  const retry = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/rematch-unmatched", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      setNote(d.requeued > 0 ? `Requeued ${d.requeued} — matching runs in the background` : "Nothing to retry");
      await load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const blockedTally = useMemo(() => {
    const counts = { total: 0, "zero-value": 0, "already-documented": 0, "no-transaction": 0 };
    for (const p of pdfs ?? []) if (p.blocked) { counts.total++; counts[p.blocked]++; }
    return counts;
  }, [pdfs]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = (pdfs ?? []).filter(
      (p) => p.filename.toLowerCase().includes(needle) && !(hideHopeless && p.blocked),
    );
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.key === "name") return a.filename.localeCompare(b.filename) * dir;
      const av = sort.key === "date" ? a.dates?.[0] : a.amounts?.[0];
      const bv = sort.key === "date" ? b.dates?.[0] : b.amounts?.[0];
      // Missing values sort last in BOTH directions. A document the extractor
      // found no date in is not "the earliest" — it is unknown, and burying it
      // under every real date in one direction only would hide it by accident.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
    });
  }, [pdfs, q, sort, hideHopeless]);

  // Clicking the active column flips direction; a new column starts descending,
  // which is what you want for both dates and amounts.
  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  return (
    <Card style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <div>
          <div style={{ fontSize: "0.875rem", fontWeight: 500 }}>
            Unmatched documents
            {pdfs && (
              <span style={{ marginLeft: "0.4rem", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                {pdfs.length}
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: "0.25rem" }}>
            PDFs the matcher could not attach. Many are the receipt half of an invoice/receipt
            pair whose transaction already has a document — only one document per transaction.
            Others are simply early: the invoice is here but its transaction has not been
            imported from Wise yet. Retry once the statement is in. To attach one by hand,
            find its transaction in the table and click + Link in the Documents column.
          </div>
        </div>
        <button
          onClick={retry}
          disabled={busy || status === "running" || pdfs?.length === 0}
          title="Move every unmatched document back into the queue and match it against the transactions loaded now"
          style={{
            padding: "0.4rem 0.7rem", borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border)", background: "var(--card)",
            color: "var(--foreground)", fontSize: "0.8125rem",
            cursor: busy || status === "running" ? "not-allowed" : "pointer",
            opacity: busy || status === "running" || pdfs?.length === 0 ? 0.5 : 1,
            whiteSpace: "nowrap", flexShrink: 0,
          }}
        >
          {status === "running" ? "Matching…" : busy ? "Requeuing…" : "Retry matching"}
        </button>
      </div>

      {note && (
        <div style={{ fontSize: "0.6875rem", fontFamily: "var(--font-mono)", color: "var(--muted-foreground)" }}>
          {note}
        </div>
      )}

      {pdfs === null && <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Loading…</div>}
      {pdfs?.length === 0 && <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Nothing unmatched — every document is attached.</div>}

      {pdfs && pdfs.length > 0 && (
        <>
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setShown(PAGE); }}
            placeholder="Filter by filename"
            style={{
              padding: "0.4rem 0.6rem", borderRadius: "var(--radius-lg)",
              border: "1px solid var(--input)", background: "var(--background)",
              color: "var(--foreground)", fontSize: "0.8125rem", outline: "none",
            }}
          />

          {/* Not a defect list — these are documents with nothing to attach to.
              Hiding them leaves the ones a person can actually act on. */}
          {blockedTally.total > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
              <button
                onClick={() => { setHideHopeless((h) => !h); setShown(PAGE); }}
                style={{
                  alignSelf: "flex-start", fontSize: "0.6875rem", color: "var(--muted-foreground)",
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                }}
              >
                {hideHopeless ? "show" : "hide"} {blockedTally.total} with nothing to attach to
              </button>
              <span style={{ fontSize: "0.625rem", color: "var(--border)", fontFamily: "var(--font-mono)" }}>
                {blockedTally["no-transaction"]} awaiting a transaction ·{" "}
                {blockedTally["already-documented"]} already documented ·{" "}
                {blockedTally["zero-value"]} zero-value
              </span>
            </div>
          )}

          <div>
            {/* The header lives INSIDE the scroll container, stuck to its top.
                Outside it, the two grids have different widths — scrollbarGutter
                only reserves space on an actual scroller — and the columns drift
                apart by a scrollbar. Sticky keeps them on one grid and keeps the
                header visible while scrolling. */}
            <div
              style={{
                maxHeight: "24rem",
                overflowY: "auto",
                overscrollBehavior: "contain",
                scrollbarGutter: "stable",
              }}
            >
              <div
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  display: "grid",
                  gridTemplateColumns: COLS,
                  gap: "0.75rem",
                  alignItems: "center",
                  padding: "0 0.5rem 0.5rem",
                  background: "var(--card)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <SortHeader label="Document" col="name" sort={sort} onSort={onSort} />
                <SortHeader label="Date" col="date" sort={sort} onSort={onSort} align="right" />
                <SortHeader label="Amount" col="amount" sort={sort} onSort={onSort} align="right" />
              </div>

              {rows.slice(0, shown).map((p) => {
                const date = p.dates?.[0];
                const amount = p.amounts?.[0];
                return (
                  <a
                    key={p.filename}
                    href={p.previewUrl ?? `/api/pdf/unmatched/${encodeURIComponent(p.filename)}`}
                    target="_blank"
                    rel="noreferrer"
                    title={p.blocked ? `${p.filename} — ${BLOCKED_REASON[p.blocked]}` : `Open ${p.filename}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: COLS,
                      gap: "0.75rem",
                      alignItems: "center",
                      padding: "0.4rem 0.5rem",
                      borderRadius: "var(--radius-lg)",
                      textDecoration: "none",
                      color: "var(--foreground)",
                      // Nothing to attach to — still openable, just not
                      // something to spend attention on.
                      opacity: p.blocked ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--muted)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.filename}
                    </span>
                    {/* What the extractor found — blank here is why a match was impossible. */}
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: date ? "var(--muted-foreground)" : "var(--border)", textAlign: "right", whiteSpace: "nowrap" }}>
                      {date ?? "no date"}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: amount != null ? "var(--muted-foreground)" : "var(--border)", textAlign: "right", whiteSpace: "nowrap" }}>
                      {amount != null ? amount.toFixed(2) : "—"}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>

          {rows.length > shown && (
            <button
              onClick={() => setShown((n) => n + PAGE)}
              style={{
                alignSelf: "flex-start", fontSize: "0.6875rem", color: "var(--muted-foreground)",
                background: "none", border: "none", cursor: "pointer", padding: 0,
              }}
            >
              show {Math.min(PAGE, rows.length - shown)} more of {rows.length}
            </button>
          )}
        </>
      )}
    </Card>
  );
}
