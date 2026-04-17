import { useCallback, useMemo, useState } from "react";
import { useTransactions } from "./hooks/useTransactions";
import { useProgress, type MatchEvent } from "./hooks/useProgress";
import { useFxRates, convertAmount, CURRENCY_SYMBOLS } from "./hooks/useFxRates";
import { TransactionTable } from "./components/TransactionTable";
import { FilterBar } from "./components/FilterBar";
import { DateFilter } from "./components/DateFilter";
import { CurrencyPicker } from "./components/CurrencyPicker";
import { DropZone } from "./components/DropZone";
import { ProgressBadge } from "./components/ProgressBadge";
import { ModelPicker } from "./components/ModelPicker";
import { ManualMatchModal } from "./components/ManualMatchModal";
import { ChartsView } from "./components/ChartsView";
import type { Transaction, PdfLink } from "./types";


function fmtAmount(value: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const abs = Math.abs(value);
  if (abs >= 1000) return `${sym}${(value / 1000).toFixed(1)}k`;
  return `${sym}${value.toFixed(0)}`;
}

interface MatchToast {
  id: number;
  tx: Transaction;
  filename: string;
}

let toastId = 0;

function App() {
  const [toasts, setToasts] = useState<MatchToast[]>([]);
  const [manualMatchTx, setManualMatchTx] = useState<Transaction | null>(null);
  const [highlightedTxIds, setHighlightedTxIds] = useState<Set<string>>(new Set());
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [view, setView] = useState<"transactions" | "charts">("transactions");
  const { rates, loading: ratesLoading, error: ratesError } = useFxRates();

  const removeToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const removeHighlight = useCallback((txId: string) => {
    setHighlightedTxIds((prev) => {
      const next = new Set(prev);
      next.delete(txId);
      return next;
    });
  }, []);

  const {
    transactions,
    allTransactions,
    stats,
    loading,
    error,
    sort,
    toggleSort,
    filters,
    addFilter,
    removeFilter,
    clearFilters,
    documentFilter,
    cycleDocumentFilter,
    setDocFilter,
    deleteLink,
    applyLiveMatch,
    dateRange,
    setDateRange,
    filterByMonth,
  } = useTransactions();

  const activeMonth = useMemo(
    () => filters.find((f) => f.key === "_month")?.value ?? null,
    [filters]
  );

  const scrollToTransaction = useCallback((txId: string) => {
    setTimeout(() => {
      const row = document.querySelector(`[data-tx-id="${txId}"]`);
      if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, []);

  const handleMatch = useCallback((event: MatchEvent) => {
    applyLiveMatch(event);
    const tx = allTransactions.find((t) => t.transferWiseId === event.transferWiseId);
    if (tx) {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, tx, filename: event.link.filename }]);
      // Highlight the row
      setHighlightedTxIds((prev) => new Set(prev).add(event.transferWiseId));
      // Remove toast and highlight after 8 seconds
      setTimeout(() => {
        removeToast(id);
        removeHighlight(event.transferWiseId);
      }, 8000);
      scrollToTransaction(event.transferWiseId);
    }
  }, [applyLiveMatch, allTransactions, scrollToTransaction, removeToast, removeHighlight]);

  const handleManualMatched = useCallback((_pdfLink: PdfLink) => {
    setManualMatchTx(null);
  }, []);

  const progress = useProgress(handleMatch);

  const linked = stats ? stats.withInvoice + stats.withRemittance : 0;
  const missing = stats ? stats.total - linked : 0;

  // Unique currencies present in the loaded data for the picker
  const availableCurrencies = useMemo(() => {
    const seen = new Set<string>(["EUR"]);
    for (const tx of allTransactions) if (tx.currency) seen.add(tx.currency);
    return Array.from(seen).sort();
  }, [allTransactions]);

  const toBase = (t: Transaction) => convertAmount(t.amount, t.currency, baseCurrency, rates);
  const income = transactions.filter((t) => t.amount >= 0).reduce((s, t) => s + toBase(t), 0);
  const expenses = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + toBase(t), 0);
  const net = income + expenses;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <DropZone />

      {/* Match toast notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => scrollToTransaction(toast.tx.transferWiseId)}
            className="flex flex-col gap-1 px-4 py-3 rounded-xl shadow-xl text-sm max-w-sm w-full border animate-in slide-in-from-right-4 fade-in duration-300 bg-zinc-900 border-emerald-700 text-zinc-100 cursor-pointer hover:border-emerald-500"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-medium truncate text-xs text-zinc-500">{toast.filename}</span>
                <span className="text-emerald-400 font-semibold">Match found</span>
                <span className="text-zinc-300">
                  {toast.tx.date} &mdash; <strong>{toast.tx.amount} {toast.tx.currency}</strong>
                </span>
                <span className="text-zinc-400 truncate">
                  {toast.tx.payerName || toast.tx.payeeName || toast.tx.merchant || toast.tx.description}
                </span>
                <span className="text-zinc-600 text-xs font-mono">{toast.tx.transferWiseId}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }}
                className="text-zinc-600 hover:text-zinc-300 shrink-0 mt-0.5"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between gap-8">
          {/* Left: title + view tabs */}
          <div className="flex items-center gap-5 shrink-0">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="10" rx="1" className="text-zinc-600 stroke-current" />
                <rect x="14" y="7" width="7" height="10" rx="1" className="text-zinc-600 stroke-current" />
                <path d="M10 8h4" className="text-emerald-500 stroke-current" />
                <path d="M10 12h4" className="text-emerald-500 stroke-current" strokeDasharray="2 2" />
              </svg>
              <h1 className="text-lg font-semibold tracking-wide text-zinc-100" style={{ fontVariant: "small-caps" }}>Pair</h1>
            </div>
            <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
              <button
                onClick={() => setView("transactions")}
                className={`px-3 py-1 rounded-md transition-colors ${
                  view === "transactions"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Transactions
              </button>
              <button
                onClick={() => setView("charts")}
                className={`px-3 py-1 rounded-md transition-colors ${
                  view === "charts"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Charts
              </button>
            </div>
          </div>

          {/* Center: KPI stats */}
          {stats && (
            <div className="flex items-center gap-5">
              <div className="text-center">
                <div className="text-lg font-bold tabular-nums text-zinc-100 leading-none">{stats.total}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wide">Transactions</div>
              </div>

              <div className="w-px h-6 bg-zinc-800" />

              <button
                onClick={() => setDocFilter(documentFilter === "filled" ? "all" : "filled")}
                className="text-center group cursor-pointer"
              >
                <div className={`text-lg font-bold tabular-nums leading-none transition-colors ${documentFilter === "filled" ? "text-emerald-400" : "text-emerald-500 group-hover:text-emerald-400"}`}>
                  {linked}
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wide group-hover:text-zinc-400 transition-colors">Linked</div>
              </button>

              <div className="w-px h-6 bg-zinc-800" />

              <button
                onClick={() => setDocFilter(documentFilter === "empty" ? "all" : "empty")}
                className="text-center group cursor-pointer"
              >
                <div className={`text-lg font-bold tabular-nums leading-none transition-colors ${documentFilter === "empty" ? "text-amber-400" : "text-zinc-400 group-hover:text-amber-400"}`}>
                  {missing}
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wide group-hover:text-zinc-400 transition-colors">Missing</div>
              </button>

              <div className="w-px h-6 bg-zinc-800" />

              <button
                onClick={() => addFilter("_direction", "income")}
                className="text-center group cursor-pointer"
              >
                <div className="text-lg font-bold tabular-nums text-emerald-400 leading-none">{fmtAmount(income, baseCurrency)}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wide group-hover:text-zinc-400 transition-colors">Income</div>
              </button>

              <div className="w-px h-6 bg-zinc-800" />

              <button
                onClick={() => addFilter("_direction", "expense")}
                className="text-center group cursor-pointer"
              >
                <div className="text-lg font-bold tabular-nums text-red-400 leading-none">{fmtAmount(expenses, baseCurrency)}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wide group-hover:text-zinc-400 transition-colors">Expenses</div>
              </button>

              <div className="w-px h-6 bg-zinc-800" />

              <div className="text-center">
                <div className={`text-lg font-bold tabular-nums leading-none ${net >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtAmount(net, baseCurrency)}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wide">Net</div>
              </div>
            </div>
          )}

          {/* Right: currency picker, model picker + progress badge */}
          <div className="shrink-0 flex items-center gap-3">
            <CurrencyPicker
              value={baseCurrency}
              currencies={availableCurrencies}
              loading={ratesLoading}
              error={ratesError}
              onChange={setBaseCurrency}
            />
            <ModelPicker />
            <ProgressBadge progress={progress} />
          </div>
        </div>
      </header>

      <FilterBar
        filters={filters}
        onRemove={removeFilter}
        onClear={clearFilters}
        leftContent={<DateFilter dateRange={dateRange} onChange={setDateRange} />}
      />

      <main>
        {error && (
          <div className="flex items-center justify-center py-20 text-red-400">
            Error: {error}
          </div>
        )}
        {loading && !transactions.length && (
          <div className="flex items-center justify-center py-20 text-zinc-500 text-sm">
            Loading transactions…
          </div>
        )}
        {!loading && view === "transactions" && (
          <TransactionTable
            transactions={transactions}
            sort={sort}
            onSort={toggleSort}
            onFilter={addFilter}
            documentFilter={documentFilter}
            onDocumentFilterCycle={cycleDocumentFilter}
            onDeleteLink={deleteLink}
            onManualMatch={setManualMatchTx}
            highlightedTxIds={highlightedTxIds}
          />
        )}
        {!loading && view === "charts" && (
          <ChartsView
            transactions={transactions}
            baseCurrency={baseCurrency}
            rates={rates}
            onMonthClick={filterByMonth}
            activeMonth={activeMonth}
          />
        )}
      </main>

      {manualMatchTx && (
        <ManualMatchModal
          transaction={manualMatchTx}
          onClose={() => setManualMatchTx(null)}
          onMatched={handleManualMatched}
        />
      )}
    </div>
  );
}

export default App;
