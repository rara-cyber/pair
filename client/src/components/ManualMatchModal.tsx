import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Transaction, PdfLink } from "../types";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "./ui/Dialog";
import { Button } from "./ui/Button";

interface UnmatchedPdf {
  filename: string;
  text: string;
  /** False when the PDF carries no text layer — a scan. Nothing to search. */
  hasText: boolean;
  dates: string[];
  amounts: number[];
  previewUrl: string;
}

interface Props {
  transaction: Transaction;
  onClose: () => void;
  onMatched: (pdfLink: PdfLink) => void;
}

function extractPaymentInfo(text: string): { date?: string; amount?: string; currency?: string; payer?: string } {
  const dateMatch   = text.match(/Payment date:\s*([^\n\r]+)/i);
  const amountMatch = text.match(/Payment amount:\s*([^\n\r]+)/i);
  const currMatch   = text.match(/Payment currency:\s*([^\n\r]+)/i);
  const payerMatch  = text.match(/Payment made to:\s*([^\n\r]+)/i);
  return {
    date:     dateMatch?.[1]?.trim(),
    amount:   amountMatch?.[1]?.trim(),
    currency: currMatch?.[1]?.trim(),
    payer:    payerMatch?.[1]?.trim(),
  };
}

function PdfCard({
  pdf,
  selected,
  onClick,
}: {
  pdf: UnmatchedPdf;
  selected: boolean;
  onClick: () => void;
}) {
  const info = extractPaymentInfo(pdf.text);
  const shortName = pdf.filename.replace(/\.pdf$/i, "").substring(0, 60);

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "0.75rem 1rem",
        borderRadius: "var(--radius-lg)",
        border: selected ? "1px solid var(--border)" : "1px solid transparent",
        background: selected ? "var(--secondary)" : "transparent",
        cursor: "pointer",
        transition: "background 120ms ease, border-color 120ms ease",
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = "var(--muted)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = selected ? "var(--secondary)" : "transparent"; }}
    >
      <p
        style={{
          fontSize: "0.75rem",
          color: "var(--muted-foreground)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          marginBottom: "0.375rem",
        }}
        title={pdf.filename}
      >
        {shortName}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0 1rem" }}>
        {info.date && (
          <span style={{ fontSize: "0.75rem", color: "var(--foreground)" }}>
            <span style={{ color: "var(--muted-foreground)" }}>Date </span>{info.date}
          </span>
        )}
        {info.amount && (
          <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--foreground)" }}>
            {info.currency ? `${info.currency} ` : ""}{info.amount}
          </span>
        )}
        {info.payer && (
          <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>
            {info.payer}
          </span>
        )}
        {!info.date && !info.amount && pdf.dates[0] && (
          <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{pdf.dates[0]}</span>
        )}
        {/* A scan has no text layer, so search can never reach it. Say so on the
            card rather than letting it look like an empty document. */}
        {!pdf.hasText && (
          <span style={{ fontSize: "0.6875rem", color: "var(--muted-foreground)", fontStyle: "italic" }}>
            no text — not searchable
          </span>
        )}
      </div>
    </button>
  );
}

export function ManualMatchModal({ transaction, onClose, onMatched }: Props) {
  const [pdfs, setPdfs] = useState<UnmatchedPdf[]>([]);
  const [selected, setSelected] = useState<UnmatchedPdf | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/unmatched-pdfs")
      .then((r) => r.json())
      .then((data) => { setPdfs(data.pdfs ?? []); setLoading(false); })
      .catch(() => { setError("Failed to load unmatched files"); setLoading(false); });
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleLink = useCallback(async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/match-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: selected.filename, transferWiseId: transaction.transferWiseId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Request failed");
      }
      const { pdfLink } = await res.json();
      onMatched(pdfLink);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setSubmitting(false);
    }
  }, [selected, transaction, onMatched, onClose]);

  // Search covers the extracted text, not just the filename: invoices are named
  // things like "INV-20260219-001.pdf", so the payer, the invoice number and the
  // amount only exist inside the document. Lowercasing the haystack once keeps
  // it off the keystroke path.
  const haystacks = useMemo(
    () => pdfs.map((p) => `${p.filename}\n${p.text}`.toLowerCase()),
    [pdfs],
  );
  const needle = q.trim().toLowerCase();
  const filtered = useMemo(
    () => (needle ? pdfs.filter((_, i) => haystacks[i].includes(needle)) : pdfs),
    [pdfs, haystacks, needle],
  );

  const handleUpload = useCallback(async (file: File) => {
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("transferWiseId", transaction.transferWiseId);
      const res = await fetch("/api/match-upload", { method: "POST", body: form });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Upload failed");
      }
      const { pdfLink } = await res.json();
      onMatched(pdfLink);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setSubmitting(false);
    }
  }, [transaction, onMatched, onClose]);

  const txLabel = [
    transaction.date,
    `${transaction.amount > 0 ? "+" : ""}${transaction.amount} ${transaction.currency}`,
    transaction.payerName || transaction.payeeName || transaction.description.substring(0, 40),
  ].filter(Boolean).join(" · ");

  return (
    <Dialog open onClose={onClose} width="900px">
      <DialogHeader>
        <div>
          <DialogTitle>Link document manually</DialogTitle>
          <DialogDescription style={{ marginTop: "0.25rem" }}>
            <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "600px" }}>{txLabel}</span>
            <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: "0.125rem" }}>{transaction.transferWiseId}</span>
          </DialogDescription>
        </div>
      </DialogHeader>

      <DialogBody
        style={{
          display: "flex",
          height: "calc(75vh - 10rem)",
          maxHeight: "500px",
          margin: "0 -1.25rem",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          overflow: "hidden",
        }}
      >
        {/* Left: PDF list */}
        <div
          style={{
            width: "340px",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              padding: "0.625rem 1rem",
              borderBottom: "1px solid var(--border)",
              flexShrink: 0,
            }}
          >
            <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", marginBottom: "0.5rem" }}>
              {loading
                ? "Loading…"
                : needle
                  ? `${filtered.length} of ${pdfs.length} files`
                  : `${pdfs.length} unmatched file${pdfs.length !== 1 ? "s" : ""}`}
            </p>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or contents…"
              style={{
                width: "100%",
                padding: "0.375rem 0.5rem",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--input)",
                background: "var(--background)",
                color: "var(--foreground)",
                fontSize: "0.75rem",
                outline: "none",
              }}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {loading && (
              <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", textAlign: "center", marginTop: "2rem" }}>Loading files…</p>
            )}
            {!loading && pdfs.length === 0 && (
              <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", textAlign: "center", marginTop: "2rem" }}>No unmatched files</p>
            )}
            {!loading && pdfs.length > 0 && filtered.length === 0 && (
              <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", textAlign: "center", marginTop: "2rem" }}>
                Nothing matches “{q.trim()}”
              </p>
            )}
            {filtered.map((pdf) => (
              <PdfCard
                key={pdf.filename}
                pdf={pdf}
                selected={selected?.filename === pdf.filename}
                onClick={() => setSelected(pdf)}
              />
            ))}
          </div>

          {/* The escape hatch from the list above: when none of the unmatched
              files is the right one, put the right one in directly. This links
              to THIS transaction rather than going through /match-pdf, which
              would hand the file to the AI matcher to place wherever it liked. */}
          <div style={{ padding: "0.625rem 1rem", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,.pdf"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Reset so picking the same file twice still fires a change.
                e.target.value = "";
                if (file) void handleUpload(file);
              }}
            />
            <button
              onClick={() => fileInput.current?.click()}
              disabled={submitting}
              style={{
                width: "100%",
                padding: "0.375rem",
                borderRadius: "var(--radius-lg)",
                border: "1px dashed var(--border)",
                background: "transparent",
                color: "var(--muted-foreground)",
                fontSize: "0.75rem",
                fontFamily: "var(--font-sans)",
                cursor: submitting ? "default" : "pointer",
              }}
            >
              None of these? Upload a PDF
            </button>
          </div>
        </div>

        {/* Right: PDF preview */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--muted)" }}>
          {selected ? (
            <iframe
              key={selected.previewUrl}
              src={selected.previewUrl}
              style={{
                flex: 1,
                width: "100%",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
              }}
              title={selected.filename}
            />
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>Select a file to preview</p>
            </div>
          )}
        </div>
      </DialogBody>

      <DialogFooter style={{ alignItems: "center", justifyContent: "space-between" }}>
        {error ? (
          <p style={{ fontSize: "0.75rem", color: "var(--destructive)" }}>{error}</p>
        ) : (
          <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
            {selected ? `Selected: ${selected.filename}` : "No file selected"}
          </p>
        )}
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleLink}
            disabled={!selected || submitting}
          >
            {submitting ? "Linking…" : "Link to transaction"}
          </Button>
        </div>
      </DialogFooter>
    </Dialog>
  );
}
