import { useState, useRef, useCallback, useEffect } from "react";
import type { Transaction, PdfLink as PdfLinkType, SortConfig } from "../types";
import { PdfLink } from "./PdfLink";
import { CURRENCY_SYMBOLS } from "../hooks/useFxRates";

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
    <div
      style={{
        overflowY: "auto",
        maxHeight: "calc(100vh - 8rem)",
      }}
    >
      <div
        style={{
          border: "1px solid var(--color-border-dim)",
          borderRadius: "12px",
          background: "var(--color-elev-1)",
          overflow: "hidden",
        }}
      >
        <table
          style={{
            width: "max-content",
            minWidth: "100%",
            borderCollapse: "collapse",
            fontSize: "13px",
          }}
        >
          <thead>
            <tr>
              {/* Status indicator column */}
              <th style={{ width: 4, padding: 0 }} />

              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  style={{
                    width: colWidths[col.key],
                    position: "sticky",
                    top: 0,
                    background: "var(--color-elev-1)",
                    textAlign: "left",
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    fontWeight: 500,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "var(--color-fg-subtle)",
                    padding: "14px 14px",
                    borderBottom: "1px solid var(--color-border-dim)",
                    whiteSpace: "nowrap",
                    userSelect: "none",
                  }}
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
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: "2px",
                      cursor: "col-resize",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span
                      style={{
                        width: "1px",
                        height: "12px",
                        background: "var(--color-border-dim)",
                        transition: "background 120ms cubic-bezier(0.22, 1, 0.36, 1)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--color-fg-muted)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "var(--color-border-dim)";
                      }}
                    />
                  </span>
                </th>
              ))}

              <th
                onClick={onDocumentFilterCycle}
                style={{
                  width: docsWidth,
                  position: "sticky",
                  top: 0,
                  background: "var(--color-elev-1)",
                  textAlign: "left",
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  fontWeight: 500,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--color-fg-subtle)",
                  padding: "14px 14px",
                  borderBottom: "1px solid var(--color-border-dim)",
                  whiteSpace: "nowrap",
                  userSelect: "none",
                  cursor: "pointer",
                }}
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
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: "2px",
                    cursor: "col-resize",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span
                    style={{
                      width: "1px",
                      height: "12px",
                      background: "var(--color-border-dim)",
                      transition: "background 120ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--color-fg-muted)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "var(--color-border-dim)";
                    }}
                  />
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
                style={{
                  transition: "background 120ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
                onMouseEnter={(e) => {
                  if (!isHighlighted) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isHighlighted) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {/* Status bar */}
                <td
                  style={{
                    width: 4,
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      width: "3px",
                      height: "100%",
                      minHeight: "38px",
                      borderRadius: "0 2px 2px 0",
                      background: hasDoc
                        ? "var(--color-accent)"
                        : "transparent",
                      boxShadow: hasDoc
                        ? "0 0 8px var(--color-accent-25)"
                        : "none",
                    }}
                  />
                </td>
                {COLUMNS.map((col) => {
                  const value = tx[col.key];
                  let display: string | React.ReactNode;
                  if (col.key === "amount") {
                    const amount = value as number;
                    const isNegative = amount < 0;
                    display = (
                      <>
                        {isNegative && "− "}
                        {symbol} {Math.abs(amount).toFixed(2)}
                        <span style={{ marginLeft: "4px", fontSize: "0.85em", color: "var(--color-fg-subtle)" }}>
                          {tx.currency}
                        </span>
                      </>
                    );
                  } else if (col.key === "date") {
                    const [datePart, timePart] = String(value ?? "").split("T");
                    display = (
                      <>
                        {datePart}
                        {timePart && (
                          <span style={{ color: "var(--color-fg-subtle)" }}>
                            {" · "}{timePart.slice(0, 5)}
                          </span>
                        )}
                      </>
                    );
                  } else {
                    display = String(value ?? "");
                  }
                  const isNegative = col.key === "amount" && (value as number) < 0;
                  const isId = col.key === "transferWiseId";
                  return (
                    <td
                      key={col.key}
                      style={{
                        width: colWidths[col.key],
                        maxWidth: colWidths[col.key],
                        padding: "12px 14px",
                        borderBottom: "1px solid var(--color-border-faint)",
                        color: "var(--color-fg)",
                        verticalAlign: "middle",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        cursor: "pointer",
                      }}
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
                      title={isId ? "Click to link a document manually" : String(display)}
                    >
                      {display}
                    </td>
                  );
                })}
                <td
                  style={{
                    width: docsWidth,
                    maxWidth: docsWidth,
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--color-border-faint)",
                  }}
                >
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
  </div>
  );
}
