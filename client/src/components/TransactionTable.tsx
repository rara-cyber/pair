import { useState, useRef, useCallback, useEffect } from "react";
import type { Transaction, PdfLink as PdfLinkType, SortConfig } from "../types";
import { PdfLink } from "./PdfLink";

type LinkFilter = "all" | "filled" | "empty";

interface Props {
  transactions: Transaction[];
  sort: SortConfig | null;
  onSort: (key: keyof Transaction) => void;
  onFilter: (key: string, value: string) => void;
  documentFilter: LinkFilter;
  onDocumentFilterCycle: () => void;
  onDeleteLink: (transferWiseId: string, filename: string, type: "Sales" | "Expenses") => void;
  onManualMatch: (tx: Transaction) => void;
  highlightedTxIds?: Set<string>;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€", USD: "$", GBP: "£", CZK: "Kč", CHF: "Fr",
};

const COLUMNS: { key: keyof Transaction; label: string; align?: string; defaultWidth: number }[] = [
  { key: "date",              label: "Date",        defaultWidth: 112 },
  { key: "transferWiseId",    label: "ID",           defaultWidth: 144 },
  { key: "amount",            label: "Amount",       align: "right", defaultWidth: 112 },
  { key: "description",       label: "Description",  defaultWidth: 160 },
  { key: "paymentReference",  label: "Payment Ref",  defaultWidth: 112 },
  { key: "payerName",         label: "Payer Name",   defaultWidth: 112 },
];

const DOCS_DEFAULT_WIDTH = 128;

function SortArrow({ column, sort }: { column: string; sort: SortConfig | null }) {
  if (!sort || sort.key !== column) return null;
  return <span className="ml-1">{sort.direction === "asc" ? "↑" : "↓"}</span>;
}

function LinkFilterIndicator({ filter }: { filter: LinkFilter }) {
  if (filter === "filled") return <span className="ml-1 text-emerald-400">●</span>;
  if (filter === "empty")  return <span className="ml-1 text-amber-400">○</span>;
  return null;
}

export function TransactionTable({
  transactions,
  sort,
  onSort,
  onFilter,
  documentFilter,
  onDocumentFilterCycle,
  onDeleteLink,
  onManualMatch,
  highlightedTxIds,
}: Props) {
  const [colWidths, setColWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth]))
  );
  const [docsWidth, setDocsWidth] = useState(DOCS_DEFAULT_WIDTH);

  // Refs for the active drag
  const dragRef = useRef<{
    colKey: string;
    startX: number;
    startWidth: number;
    isDocs: boolean;
  } | null>(null);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return;
    const delta = e.clientX - dragRef.current.startX;
    const newWidth = Math.max(60, dragRef.current.startWidth + delta);
    if (dragRef.current.isDocs) {
      setDocsWidth(newWidth);
    } else {
      setColWidths((prev) => ({ ...prev, [dragRef.current!.colKey]: newWidth }));
    }
  }, []);

  const onMouseUp = useCallback(() => {
    dragRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const startResize = (colKey: string, startX: number, startWidth: number, isDocs = false) => {
    dragRef.current = { colKey, startX, startWidth, isDocs };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div className="overflow-y-auto max-h-[calc(100vh-8rem)]">
      <table className="text-sm table-fixed" style={{ width: "max-content", minWidth: "100%" }}>
        <thead className="sticky top-0 z-10 bg-zinc-950">
          <tr className="border-b border-zinc-800">
            {/* Status indicator column */}
            <th className="w-1 p-0" style={{ width: 4 }} />

            {COLUMNS.map((col) => (
              <th
                key={col.key}
                style={{ width: colWidths[col.key] }}
                className={`relative px-3 py-2 text-xs font-medium text-zinc-400 cursor-pointer hover:text-zinc-200 select-none whitespace-nowrap ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
                onClick={() => onSort(col.key)}
              >
                {col.label}
                <SortArrow column={col.key} sort={sort} />
                {/* Resize handle */}
                <span
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    startResize(col.key, e.clientX, colWidths[col.key]);
                  }}
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize flex items-center justify-center group"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="w-px h-3 bg-zinc-700 group-hover:bg-zinc-400 transition-colors" />
                </span>
              </th>
            ))}

            <th
              onClick={onDocumentFilterCycle}
              style={{ width: docsWidth }}
              className="relative px-3 py-2 text-xs font-medium text-zinc-400 text-left whitespace-nowrap cursor-pointer hover:text-zinc-200 select-none"
              title="Click to filter: all → linked → unlinked"
            >
              Documents
              <LinkFilterIndicator filter={documentFilter} />
              <span
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  startResize("_docs", e.clientX, docsWidth, true);
                }}
                className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize flex items-center justify-center group"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="w-px h-3 bg-zinc-700 group-hover:bg-zinc-400 transition-colors" />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx, i) => {
            const allLinks: PdfLinkType[] = [
              ...(tx.invoiceLinks ?? []).map((l) => ({ ...l, linkType: "Expenses" as const })),
              ...(tx.remittanceLinks ?? []).map((l) => ({ ...l, linkType: "Sales" as const })),
            ];
            const hasDoc = allLinks.length > 0;
            const symbol = CURRENCY_SYMBOLS[tx.currency] ?? tx.currency;
            const isHighlighted = highlightedTxIds?.has(tx.transferWiseId);

            return (
              <tr
                key={`${tx.transferWiseId}-${i}`}
                data-tx-id={tx.transferWiseId}
                className={`border-b border-zinc-800/50 hover:bg-zinc-900/50 ${
                  isHighlighted ? "bg-emerald-950/50 ring-2 ring-emerald-500/50 animate-pulse" : ""
                }`}
              >
                {/* Status dot */}
                <td className="p-0" style={{ width: 4 }}>
                  <div className={`h-full w-0.5 min-h-[2.25rem] ${hasDoc ? "bg-emerald-500/50" : "bg-transparent"}`} />
                </td>
                {COLUMNS.map((col) => {
                  const value = tx[col.key];
                  let display: string;
                  if (col.key === "amount") {
                    display = `${symbol} ${(value as number).toFixed(2)}`;
                  } else {
                    display = String(value ?? "");
                  }
                  const isNegative = col.key === "amount" && (value as number) < 0;
                  const isId = col.key === "transferWiseId";
                  return (
                    <td
                      key={col.key}
                      style={{ width: colWidths[col.key], maxWidth: colWidths[col.key] }}
                      onClick={() => {
                        if (isId) {
                          onManualMatch(tx);
                        } else if (col.key === "date") {
                          const month = String(value ?? "").slice(0, 7);
                          onFilter("_month", month);
                        } else if (col.key === "amount") {
                          onFilter("currency", tx.currency);
                        } else {
                          onFilter(col.key, String(value ?? ""));
                        }
                      }}
                      className={`px-3 py-2 cursor-pointer hover:bg-zinc-800/50 truncate overflow-hidden ${
                        col.align === "right" ? "text-right font-mono" : ""
                      } ${isNegative ? "text-red-400" : ""} ${
                        isId ? "text-zinc-500 hover:text-emerald-400 font-mono text-xs" : ""
                      }`}
                      title={isId ? "Click to link a document manually" : display}
                    >
                      {display}
                    </td>
                  );
                })}
                <td className="px-3 py-2" style={{ width: docsWidth, maxWidth: docsWidth }}>
                  <PdfLink
                    links={allLinks}
                    onDelete={(filename, type) => onDeleteLink(tx.transferWiseId, filename, type)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
