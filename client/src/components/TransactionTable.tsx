import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { Transaction, PdfLink as PdfLinkType, SortConfig } from "../types";
import { PdfLink } from "./PdfLink";
import { CategoryPicker } from "./CategoryPicker";
import { ProjectPicker } from "./ProjectPicker";
import { CURRENCY_SYMBOLS } from "../hooks/useFxRates";
import { isInternalTransfer } from "../lib/derive";
import { SimulatedPayments } from "./SimulatedPayments";
import { Badge } from "./ui/Badge";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/Dialog";
import { Button } from "./ui/Button";

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
  onProjectChange: (transferWiseId: string, project: string | null) => void;
  onBulkProjectChange: (transferWiseIds: string[], project: string | null) => void;
  onSimulatedChanged: () => void;
  onAddProject: (name: string) => void;
}


const COLUMNS: { key: keyof Transaction; label: string; align?: string; defaultWidth: number }[] = [
  { key: "date",              label: "Date",        defaultWidth: 112 },
  { key: "transferWiseId",    label: "ID",           defaultWidth: 144 },
  { key: "amount",            label: "Amount",       align: "right", defaultWidth: 112 },
  { key: "description",       label: "Description",  defaultWidth: 160 },
  { key: "paymentReference",  label: "Payment Ref",  defaultWidth: 112 },
  { key: "payerName",         label: "Payer Name",   defaultWidth: 112 },
  { key: "project",           label: "Project",      defaultWidth: 132 },
];

// ponytail: the header row is 14px padding + a 13px line + 14px. Hard-coded so
// the bulk row can stick right under it without measuring the DOM every render.
const HEADER_H = 41;

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
  onBulkProjectChange,
  onSimulatedChanged,
  onAddProject,
}: Props) {
  const [colWidths, setColWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth]))
  );
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [docsWidth, setDocsWidth] = useState(DOCS_DEFAULT_WIDTH);
  const [categoryWidth, setCategoryWidth] = useState(CATEGORY_DEFAULT_WIDTH);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Anchor for shift-click, which is what makes selecting a run of rows bearable.
  const lastPickedRef = useRef<number | null>(null);
  // A bulk edit is confirmed before it fires: it rewrites rows you may have
  // scrolled past, and there is no undo.
  const [pendingBulk, setPendingBulk] = useState<
    { kind: "project"; value: string | null } | { kind: "category"; value: string } | null
  >(null);

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

  // Search lives here rather than in the shared `filters` array on purpose: those
  // feed the dashboard too, and a stale search term silently reshaping the KPIs
  // and charts would be worse than useless on a bookkeeping screen.
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((tx) =>
      [
        tx.description, tx.paymentReference, tx.payerName, tx.payeeName, tx.merchant,
        tx.transferWiseId, tx.project, tx.currency,
        tx.categories?.join(" "),
        String(tx.amount),
      ]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q)),
    );
  }, [transactions, query]);

  // Derived, never synced: a row that scrolls out of the search results simply
  // stops counting, so "apply" can never touch a row you cannot see.
  const selectedRows = searched.filter((tx) => selected.has(tx.transferWiseId));
  const allSelected = searched.length > 0 && selectedRows.length === searched.length;

  const toggleRow = (index: number, shiftKey: boolean) => {
    const id = searched[index].transferWiseId;
    const anchorIndex = lastPickedRef.current;
    setSelected((prev) => {
      const next = new Set(prev);
      if (shiftKey && anchorIndex !== null) {
        const [from, to] = anchorIndex < index ? [anchorIndex, index] : [index, anchorIndex];
        const turningOn = !next.has(id);
        for (let i = from; i <= to; i++) {
          const rowId = searched[i].transferWiseId;
          if (turningOn) next.add(rowId); else next.delete(rowId);
        }
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastPickedRef.current = index;
  };

  // A category is added, never replaced — a row can hold three, and blowing away
  // the other two to write one is not what "apply to selection" means. Rows that
  // already carry it, or are full, are not touched.
  const bulkTargets =
    pendingBulk?.kind === "category"
      ? selectedRows.filter((tx) => {
          const current = tx.categories ?? [];
          return !current.includes(pendingBulk.value) && current.length < 3;
        })
      : selectedRows;

  const bulkCell: React.CSSProperties = {
    position: "sticky", top: HEADER_H, zIndex: 1, background: "var(--card)",
    borderBottom: "1px solid var(--border)", padding: "6px 14px",
    textAlign: "left", fontWeight: 400,
  };

  const applyBulk = () => {
    if (!pendingBulk) return;
    if (pendingBulk.kind === "project") {
      onBulkProjectChange(bulkTargets.map((tx) => tx.transferWiseId), pendingBulk.value);
    } else {
      for (const tx of bulkTargets) {
        onCategoryChange(tx.transferWiseId, [...(tx.categories ?? []), pendingBulk.value]);
      }
    }
    setSelected(new Set());
    setPendingBulk(null);
  };

  return (
    // One card: the search is the table's header, not a floating field above it.
    // overflow:hidden lets the scroll area's top edge meet the header cleanly at
    // the rounded corners.
    <div
      style={{
        // Sits flush under the filter bar, whose bottom border already draws the
        // line between them — a top border here would double it. Square top
        // corners for the same reason: this reads as one continuous surface.
        borderBottom: "1px solid var(--border)",
        borderRadius: "0 0 12px 12px",
        background: "var(--card)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex", alignItems: "center", gap: "0.6rem",
          padding: "0 14px", height: "44px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={focused || query ? "var(--foreground)" : "var(--muted-foreground)"}
          strokeWidth="2" strokeLinecap="round"
          style={{ flexShrink: 0, transition: "stroke 140ms ease" }}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search description, payer, merchant, reference, ID, amount…"
          style={{
            // Borderless and transparent: the card already provides the frame,
            // and a second border here fights the table's own edge.
            flex: 1, minWidth: 0, background: "transparent", border: "none",
            outline: "none", padding: 0, height: "100%",
            color: "var(--foreground)", fontSize: "0.8125rem",
            fontFamily: "var(--font-sans)",
          }}
        />
        {query && (
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.6rem",
              fontSize: "0.6875rem", color: "var(--muted-foreground)",
              fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            {/* Matches the uppercase tracked treatment of the column headers below. */}
            <span style={{ textTransform: "uppercase", letterSpacing: "var(--tracking-wide)" }}>
              {searched.length} / {transactions.length}
            </span>
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
                color: "var(--muted-foreground)", fontSize: "0.6875rem",
                fontFamily: "var(--font-sans)",
              }}
            >
              clear
            </button>
          </span>
        )}
        <SimulatedPayments projects={projects} onChanged={onSimulatedChanged} />
      </div>
    <div
      style={{
        overflow: "auto",
        // The card owns the border now; the scroll area sits flush inside it.
        maxHeight: "calc(100vh - 8rem - 44px)",
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

              <th
                style={{
                  width: 32, padding: "14px 0 14px 10px", position: "sticky", top: 0, zIndex: 1,
                  background: "var(--card)", borderBottom: "1px solid var(--border)",
                }}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(searched.map((tx) => tx.transferWiseId)))}
                  aria-label="Select all rows"
                  style={{ cursor: "pointer", accentColor: "var(--foreground)" }}
                />
              </th>

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

            {/* Bulk edit, aligned to the columns it writes: the Project cell
                holds a project picker, the Category cell a category picker.
                Same components as the rows, so there is one project menu in the
                app and one category menu, not four. */}
            {selectedRows.length > 0 && (
              <tr>
                <th style={{ ...bulkCell, width: 4, padding: 0 }} />
                <th style={{ ...bulkCell, width: 32 }} />
                {COLUMNS.map((col) => (
                  <th key={col.key} style={{ ...bulkCell, width: colWidths[col.key], maxWidth: colWidths[col.key] }}>
                    {col.key === "date" && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 500,
                          letterSpacing: "0.16em", textTransform: "uppercase",
                          color: "var(--foreground)", whiteSpace: "nowrap",
                        }}
                      >
                        {selectedRows.length} selected
                      </span>
                    )}
                    {col.key === "transferWiseId" && (
                      <button
                        onClick={() => setSelected(new Set())}
                        style={{
                          background: "none", border: "none", padding: 0, cursor: "pointer",
                          fontFamily: "var(--font-sans)", fontSize: "0.6875rem", color: "var(--muted-foreground)",
                        }}
                      >
                        clear
                      </button>
                    )}
                    {col.key === "project" && (
                      <ProjectPicker
                        projects={projects}
                        onChange={(project) => setPendingBulk({ kind: "project", value: project })}
                        onAddProject={onAddProject}
                        maxWidth={colWidths["project"] - 28}
                      />
                    )}
                  </th>
                ))}
                <th style={{ ...bulkCell, width: categoryWidth, maxWidth: categoryWidth }}>
                  <CategoryPicker
                    categories={categories}
                    onChange={(picked) => {
                      const value = picked[picked.length - 1];
                      if (value) setPendingBulk({ kind: "category", value });
                    }}
                    onAddCategory={onAddCategory}
                    maxWidth={categoryWidth - 28}
                  />
                </th>
                <th style={{ ...bulkCell, width: docsWidth }} />
              </tr>
            )}
          </thead>
        <tbody>
          {searched.map((tx, i) => {
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
                <td style={{ width: 32, padding: "12px 0 12px 10px", borderBottom: "1px solid var(--border)" }}>
                  <input
                    type="checkbox"
                    checked={selected.has(tx.transferWiseId)}
                    onChange={() => {}}
                    onClick={(e) => toggleRow(i, e.shiftKey)}
                    aria-label={`Select ${tx.transferWiseId}`}
                    style={{ cursor: "pointer", accentColor: "var(--foreground)" }}
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
                  // A sweep between our own accounts stays in the table but is
                  // not income; without a mark, a €11,500 credit missing from
                  // the KPIs reads as a bug.
                  if (col.key === "description" && tx.simulated) {
                    display = (
                      <>
                        <Badge style={{ marginRight: "6px", color: "var(--positive-fg)", borderColor: "var(--positive-fg)" }}>simulated</Badge>
                        {String(value ?? "")}
                      </>
                    );
                  }
                  if (col.key === "description" && isInternalTransfer(tx)) {
                    display = (
                      <>
                        <Badge style={{ marginRight: "6px", color: "var(--muted-foreground)" }}>internal</Badge>
                        {String(value ?? "")}
                      </>
                    );
                  }
                  // The Project cell is editable: a manual pick overrides the
                  // rule for this row only.
                  if (col.key === "project") {
                    display = (
                      <ProjectPicker
                        value={tx.project}
                        projects={projects}
                        onChange={(p) => onProjectChange(tx.transferWiseId, p)}
                        onAddProject={onAddProject}
                        maxWidth={colWidths["project"] - 28}
                      />
                    );
                  }
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
                        if (col.key === "date") {
                          const month = String(value ?? "").slice(0, 7);
                          onFilter("_month", month);
                        } else if (col.key === "amount") {
                          onFilter("currency", tx.currency);
                        } else if (col.key !== "project") {
                          onFilter(col.key, String(value ?? ""));
                        }
                      }}
                      title={String(display)}
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
                  {tx.simulated ? null : hasDoc ? (
                    <PdfLink
                      links={allLinks}
                      onDelete={(filename, type) => onDeleteLink(tx.transferWiseId, filename, type)}
                    />
                  ) : (
                    // Manual linking used to be an unmarked click on the ID cell,
                    // which is to say it was invisible. An empty Documents cell is
                    // exactly where someone looks when a document is missing.
                    <button
                      onClick={(e) => { e.stopPropagation(); onManualMatch(tx); }}
                      title="Link a document to this transaction"
                      style={{
                        padding: "2px 8px",
                        borderRadius: "var(--radius-lg)",
                        border: "1px dashed var(--border)",
                        background: "transparent",
                        color: "var(--muted-foreground)",
                        fontSize: "0.6875rem",
                        fontFamily: "var(--font-sans)",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--foreground)"; e.currentTarget.style.borderColor = "var(--foreground)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted-foreground)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                    >
                      + Link
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

      <Dialog open={pendingBulk !== null} onClose={() => setPendingBulk(null)} width="420px">
        {pendingBulk && (
          <>
            <DialogHeader>
              <DialogTitle>{pendingBulk.kind === "project" ? "Set project" : "Add category"}</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              {pendingBulk.kind === "project"
                ? pendingBulk.value
                  ? <>“{pendingBulk.value}” on <b>{bulkTargets.length}</b> transactions. Replaces the project they have now.</>
                  : <>Clears the project on <b>{bulkTargets.length}</b> transactions, so the rules apply again.</>
                : <>“{pendingBulk.value}” added to <b>{bulkTargets.length}</b> transactions. Their existing categories stay.</>}
              {pendingBulk.kind === "category" && bulkTargets.length < selectedRows.length && (
                <div style={{ marginTop: "0.5rem" }}>
                  {selectedRows.length - bulkTargets.length} skipped — already have it, or are at the three-category limit.
                </div>
              )}
            </DialogDescription>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPendingBulk(null)}>Cancel</Button>
              <Button onClick={applyBulk} disabled={bulkTargets.length === 0}>Apply</Button>
            </DialogFooter>
          </>
        )}
      </Dialog>
    </div>
  );
}
