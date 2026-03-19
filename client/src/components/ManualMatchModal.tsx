import { useState, useEffect, useCallback } from "react";
import type { Transaction, PdfLink } from "../types";

interface UnmatchedPdf {
  filename: string;
  text: string;
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
      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
        selected
          ? "border-emerald-500 bg-emerald-950/40"
          : "border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900/50"
      }`}
    >
      <p className="text-xs text-zinc-400 truncate mb-1.5" title={pdf.filename}>{shortName}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
        {info.date && (
          <span className="text-xs text-zinc-300"><span className="text-zinc-500">Date </span>{info.date}</span>
        )}
        {info.amount && (
          <span className="text-xs font-mono text-emerald-400">
            {info.currency ? `${info.currency} ` : ""}{info.amount}
          </span>
        )}
        {info.payer && (
          <span className="text-xs text-zinc-400 truncate max-w-[200px]">{info.payer}</span>
        )}
        {!info.date && !info.amount && pdf.dates[0] && (
          <span className="text-xs text-zinc-400">{pdf.dates[0]}</span>
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

  const txLabel = [
    transaction.date,
    `${transaction.amount > 0 ? "+" : ""}${transaction.amount} ${transaction.currency}`,
    transaction.payerName || transaction.payeeName || transaction.description.substring(0, 40),
  ].filter(Boolean).join(" · ");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex flex-col w-[900px] max-w-[95vw] h-[75vh] max-h-[700px] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Link document manually</h2>
            <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[600px]">{txLabel}</p>
            <p className="text-xs text-zinc-600 font-mono mt-0.5">{transaction.transferWiseId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors ml-4 mt-0.5 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body: two panels */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left: PDF list */}
          <div className="w-[340px] shrink-0 flex flex-col border-r border-zinc-800">
            <div className="px-4 py-2.5 border-b border-zinc-800/50 shrink-0">
              <p className="text-xs text-zinc-500">
                {loading ? "Loading…" : `${pdfs.length} unmatched file${pdfs.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {loading && (
                <p className="text-xs text-zinc-600 text-center mt-8">Loading files…</p>
              )}
              {!loading && pdfs.length === 0 && (
                <p className="text-xs text-zinc-600 text-center mt-8">No unmatched files</p>
              )}
              {pdfs.map((pdf) => (
                <PdfCard
                  key={pdf.filename}
                  pdf={pdf}
                  selected={selected?.filename === pdf.filename}
                  onClick={() => setSelected(pdf)}
                />
              ))}
            </div>
          </div>

          {/* Right: PDF preview */}
          <div className="flex-1 flex flex-col bg-zinc-900/30">
            {selected ? (
              <iframe
                key={selected.previewUrl}
                src={selected.previewUrl}
                className="flex-1 w-full"
                title={selected.filename}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-zinc-600">Select a file to preview</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-800 shrink-0">
          {error ? (
            <p className="text-xs text-red-400">{error}</p>
          ) : (
            <p className="text-xs text-zinc-600">
              {selected ? `Selected: ${selected.filename}` : "No file selected"}
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLink}
              disabled={!selected || submitting}
              className="px-4 py-1.5 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {submitting ? "Linking…" : "Link to transaction"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
