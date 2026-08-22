import { useEffect, useState } from "react";
import { Card } from "./ui/Card";

interface UnmatchedPdf {
  filename: string;
  dates?: string[];
  amounts?: number[];
  previewUrl?: string;
}

const PAGE = 25;

export function UnmatchedDocuments() {
  const [pdfs, setPdfs] = useState<UnmatchedPdf[] | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/unmatched-pdfs")
      .then((r) => r.json())
      .then((d) => setPdfs(Array.isArray(d) ? d : (d.pdfs ?? d.unmatched ?? [])))
      .catch(() => setPdfs([]));
  }, []);

  const filtered = (pdfs ?? []).filter((p) => p.filename.toLowerCase().includes(q.toLowerCase()));

  return (
    <Card style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.875rem", maxWidth: "34rem" }}>
      <div>
        <div style={{ fontSize: "0.875rem", fontWeight: 500 }}>
          Unmatched documents
          {pdfs && (
            <span style={{ marginLeft: "0.4rem", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
              {pdfs.length}
            </span>
          )}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
          PDFs the matcher could not attach. Many are the receipt half of an invoice/receipt
          pair whose transaction already has a document — only one document per transaction.
          To attach one by hand, open its transaction in the table and click the ID column.
        </div>
      </div>

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

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "24rem", overflowY: "auto", overscrollBehavior: "contain" }}>
            {filtered.slice(0, shown).map((p) => {
              const date = p.dates?.[0];
              const amount = p.amounts?.[0];
              return (
                <div key={p.filename} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.75rem" }}>
                  <a
                    href={p.previewUrl ?? `/api/pdf/unmatched/${encodeURIComponent(p.filename)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: "0.75rem", color: "var(--foreground)", textDecoration: "none",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0,
                    }}
                    title={`Open ${p.filename}`}
                  >
                    {p.filename}
                  </a>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                    {/* What the extractor found — blank here is why a match was impossible. */}
                    {date ?? "no date"} · {amount != null ? amount : "no amount"}
                  </span>
                </div>
              );
            })}
          </div>

          {filtered.length > shown && (
            <button
              onClick={() => setShown((n) => n + PAGE)}
              style={{
                alignSelf: "flex-start", fontSize: "0.6875rem", color: "var(--muted-foreground)",
                background: "none", border: "none", cursor: "pointer", padding: 0,
              }}
            >
              show {Math.min(PAGE, filtered.length - shown)} more of {filtered.length}
            </button>
          )}
        </>
      )}
    </Card>
  );
}
