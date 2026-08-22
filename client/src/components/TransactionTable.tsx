import { useState, useRef, useCallback, useEffect } from "react";
import type { Transaction, PdfLink as PdfLinkType, SortConfig } from "../types";
import { PdfLink } from "./PdfLink";
import { CategoryPicker } from "./CategoryPicker";
import { CURRENCY_SYMBOLS } from "../hooks/useFxRates";
import { Badge } from "./ui/Badge";

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
  categories: string[];
  onCategoryChange: (transferWiseId: string, categories: string[]) => void;
  onAddCategory: (name: string) => void;
  projects: string[];
  onProjectChange: (transferWiseId: string, project: string) => void;
}


const COLUMNS: { key: keyof Transaction; label: string; align?: string; defaultWidth: number }[] = [
  { key: "date",              label: "Date",        defaultWidth: 112 },
  { key: "transferWiseId",    label: "ID",           defaultWidth: 144 },
  { key: "amount",            label: "Amount",       align: "right", defaultWidth: 112 },
  { key: "description",       label: "Description",  defaultWidth: 160 },
  { key: "paymentReference",  label: "Payment Ref",  defaultWidth: 112 },
  { key: "payerName",         label: "Payer Name",   defaultWidth: 112 },
  { key: "project",           label: "Project",      defaultWidth: 120 },
];

const DOCS_DEFAULT_WIDTH = 128;
const CATEGORY_DEFAULT_WIDTH = 144;

function SortArrow({ column, sort }: { column: string; sort: SortConfig | null }) {
  if (!sort || sort.key !== column) return null;
  return <span className="ml-1">{sort.direction === "asc" ? "↑" : "↓"}</span>;
}

function LinkFilterIndicator({ filter }: { filter: LinkFilter }) {
  if (filter === "filled") return <Badge style={{ color: "var(--positive-fg)", borderColor: "var(--positive-fg)" }}>●</Badge>;
  if (filter === "empty")  return <Badge style={{ color: "var(--muted-foreground)" }}>○</Badge>;
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
  categories,
  onCategoryChange,
  onAddCategory,
  projects,
  onProjectChange,
}: Props) {
  const [colWidths, setColWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth]))
  );
  const [docsWidth, setDocsWidth] = useState(DOCS_DEFAULT_WIDTH);
  const [categoryWidth, setCategoryWidth] = useState(CATEGORY_DEFAULT_WIDTH);

  // Refs for the active drag
  const dragRef = useRef<{
    colKey: string;
    startX: number;
    startWidth: number;
    isDocs: boolean;
    isCategory: boolean;
  } | null>(null);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return;
    const delta = e.clientX - dragRef.current.startX;
    const newWidth = Math.max(60, dragRef.current.startWidth + delta);
    if (dragRef.current.isCategory) {
      setCategoryWidth(newWidth);
    } else if (dragRef.current.isDocs) {
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

  const startResize = (colKey: string, startX: number, startWidth: number, isDocs = false, isCategory = false) => {
    dragRef.current = { colKey, startX, startWidth, isDocs, isCategory };
    // eslint-disable-next-line react-hooks/immutability
    document.body.style.cursor = "col-resize";
    // eslint-disable-next-line react-hooks/immutability
    document.body.style.userSelect = "none";
  };

  return (
    <div
      style={{
        overflow: "auto",
        maxHeight: "calc(100vh - 8rem)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        background: "var(--card)",
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
                  onClick={() => onSort(col.key)}
                  style={{
                    width: colWidths[col.key],
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                    background: "var(--card)",
                    textAlign: "left",
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    fontWeight: 500,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: sort?.key === col.key ? "var(--foreground)" : "var(--muted-foreground)",
                    padding: "14px 14px",
                    borderBottom: "1px solid var(--border)",
                    whiteSpace: "nowrap",
                    userSelect: "none",
                    cursor: "pointer",
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
                        background: "var(--border)",
                        transition: "background 120ms cubic-bezier(0.22, 1, 0.36, 1)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--muted-foreground)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "var(--border)";
                      }}
                    />
                  </span>
                </th>
              ))}

              <th
                style={{
                  width: categoryWidth,
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  background: "var(--card)",
                  textAlign: "left",
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  fontWeight: 500,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--muted-foreground)",
                  padding: "14px 14px",
                  borderBottom: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                  userSelect: "none",
                }}
              >
                Category
                <span
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    startResize("_category", e.clientX, categoryWidth, false, true);
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
                      background: "var(--border)",
                      transition: "background 120ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--muted-foreground)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "var(--border)";
                    }}
                  />
                </span>
              </th>

              <th
                onClick={onDocumentFilterCycle}
                style={{
                  width: docsWidth,
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  background: "var(--card)",
                  textAlign: "left",
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  fontWeight: 500,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--muted-foreground)",
                  padding: "14px 14px",
                  borderBottom: "1px solid var(--border)",
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
                      background: "var(--border)",
                      transition: "background 120ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--muted-foreground)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "var(--border)";
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
                    e.currentTarget.style.background = "var(--muted)";
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
                        ? "var(--foreground)"
                        : "transparent",
                    }}
                  />
                </td>
                {COLUMNS.map((col) => {
                  const value = tx[col.key];
                  let display: string | React.ReactNode;
                  const isNegative = col.key === "amount" && (value as number) < 0;
                  if (col.key === "amount") {
                    const amount = value as number;
                    display = (
                      <>
                        {isNegative && "− "}
                        {symbol} {Math.abs(amount).toFixed(2)}
                        <span style={{ marginLeft: "4px", fontSize: "0.85em", color: "var(--muted-foreground)" }}>
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
                          <span style={{ color: "var(--muted-foreground)" }}>
                            {" · "}{timePart.slice(0, 5)}
                          </span>
                        )}
                      </>
                    );
                  } else {
                    display = String(value ?? "");
                  }
                  // The Project cell is editable: a manual pick overrides the
                  // rule for this row only.
                  if (col.key === "project") {
                    display = (
                      <select
                        value={tx.project ?? ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => { e.stopPropagation(); onProjectChange(tx.transferWiseId, e.target.value); }}
                        style={{
                          width: "100%", background: "transparent", border: "none",
                          color: tx.project ? "var(--foreground)" : "var(--muted-foreground)",
                          font: "inherit", cursor: "pointer", outline: "none", padding: 0,
                        }}
                        title="Pick a project for this transaction (overrides the rule)"
                      >
                        <option value="">—</option>
                        {projects.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    );
                  }
                  const isId = col.key === "transferWiseId";
                  const isNumeric = col.key === "amount";
                  return (
                    <td
                      key={col.key}
                      style={{
                        width: colWidths[col.key],
                        maxWidth: colWidths[col.key],
                        padding: "12px 14px",
                        borderBottom: "1px solid var(--border)",
                        color: isNegative ? "var(--negative)" : "var(--foreground)",
                        verticalAlign: "middle",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        cursor: "pointer",
                        ...(isNumeric ? { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } : {}),
                      }}
                      onClick={() => {
                        if (isId) {
                          onManualMatch(tx);
                        } else if (col.key === "date") {
                          const month = String(value ?? "").slice(0, 7);
                          onFilter("_month", month);
                        } else if (col.key === "amount") {
                          onFilter("currency", tx.currency);
                        } else if (col.key !== "project") {
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
                    width: categoryWidth,
                    maxWidth: categoryWidth,
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <CategoryPicker
                    value={tx.categories}
                    categories={categories}
                    onChange={(cats) => onCategoryChange(tx.transferWiseId, cats)}
                    onAddCategory={onAddCategory}
                    maxWidth={categoryWidth - 28}
                  />
                </td>
                <td
                  style={{
                    width: docsWidth,
                    maxWidth: docsWidth,
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--border)",
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
  );
}
