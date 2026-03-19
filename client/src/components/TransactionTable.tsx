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

const COLUMNS: { key: keyof Transaction; label: string; align?: string; width?: string }[] = [
  { key: "date", label: "Date", width: "w-28" },
  { key: "transferWiseId", label: "ID", width: "w-36" },
  { key: "amount", label: "Amount", align: "right", width: "w-28" },
  { key: "description", label: "Description", width: "w-40" },
  { key: "paymentReference", label: "Payment Ref", width: "w-28" },
  { key: "payerName", label: "Payer Name", width: "w-28" },
];

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
  return (
    <div className="overflow-y-auto max-h-[calc(100vh-8rem)]">
      <table className="w-full text-sm table-fixed">
        <thead className="sticky top-0 z-10 bg-zinc-950">
          <tr className="border-b border-zinc-800">
            {/* Status indicator column */}
            <th className="w-1 p-0" />
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => onSort(col.key)}
                className={`px-3 py-2 text-xs font-medium text-zinc-400 cursor-pointer hover:text-zinc-200 select-none whitespace-nowrap ${col.width ?? ""} ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {col.label}
                <SortArrow column={col.key} sort={sort} />
              </th>
            ))}
            <th
              onClick={onDocumentFilterCycle}
              className="px-3 py-2 text-xs font-medium text-zinc-400 text-left whitespace-nowrap cursor-pointer hover:text-zinc-200 select-none w-32"
              title="Click to filter: all → linked → unlinked"
            >
              Documents
              <LinkFilterIndicator filter={documentFilter} />
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
                <td className="p-0 w-1">
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
                      className={`px-3 py-2 cursor-pointer hover:bg-zinc-800/50 truncate ${
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
                <td className="px-3 py-2">
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
