import { useCallback, useEffect, useMemo, useState } from "react";
import { useTransactions } from "./hooks/useTransactions";
import { useProgress, type MatchEvent } from "./hooks/useProgress";
import { useFxRates, convertAmount, CURRENCY_SYMBOLS } from "./hooks/useFxRates";
import { useTheme } from "./hooks/useTheme";
import { TransactionTable } from "./components/TransactionTable";
import { FilterBar } from "./components/FilterBar";
import { DateFilter } from "./components/DateFilter";
import { CurrencyPicker } from "./components/CurrencyPicker";
import { DropZone } from "./components/DropZone";
import { ProgressBadge } from "./components/ProgressBadge";
import { ModelPicker } from "./components/ModelPicker";
import { ManualMatchModal } from "./components/ManualMatchModal";
import { ChartsView } from "./components/ChartsView";
import { ThemeToggle } from "./components/ui/ThemeToggle";
import type { Transaction } from "./types";


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
  const [categories, setCategories] = useState<string[]>([]);
  const { rates, loading: ratesLoading, error: ratesError } = useFxRates();
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((d: { categories: string[] }) => setCategories(d.categories))
      .catch(() => {});
  }, []);

  const addCategory = useCallback(async (name: string) => {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const d: { categories: string[] } = await res.json();
    setCategories(d.categories);
  }, []);

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
    applyCategory,
    updateCategory,
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

  const handleManualMatched = useCallback((): void => {
    setManualMatchTx(null);
  }, []);

  const progress = useProgress(handleMatch, applyCategory);

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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-fg)' }}>
      <DropZone />

      {/* Match toast notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => scrollToTransaction(toast.tx.transferWiseId)}
            className="flex flex-col gap-1 px-4 py-3 rounded-xl shadow-xl text-sm max-w-sm w-full border cursor-pointer transition-all hover:brightness-110"
            style={{
              background: 'var(--color-elev-1)',
              borderColor: 'var(--color-accent-25)',
              color: 'var(--color-fg)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: '3px', background: 'var(--color-accent)',
              boxShadow: '0 0 12px var(--color-accent-25)'
            }}></div>
            <div className="flex items-start justify-between gap-3" style={{ marginLeft: '8px' }}>
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center justify-between text-xs uppercase tracking-wider" style={{ color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>
                  <span>Match found</span>
                  <span onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }} style={{ cursor: 'pointer', opacity: 0.7 }}>✕</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-white)', wordBreak: 'break-all', marginBottom: '6px' }}>
                  {toast.filename}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-fg-muted)' }}>
                  {toast.tx.date} · <strong>{toast.tx.amount} {toast.tx.currency}</strong>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-fg-muted)' }}>
                  {toast.tx.payerName || toast.tx.payeeName || toast.tx.merchant || toast.tx.description}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-fg-subtle)', marginTop: '8px', letterSpacing: '0.04em' }}>
                  {toast.tx.transferWiseId}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Header */}
      <header
        className="sticky top-0 z-30"
        style={{
          background: 'rgba(18,20,24,0.78)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--color-border-dim)'
        }}
      >
        <div style={{ height: '72px', padding: '0 24px', display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '20px' }}>
          {/* Left: branding + tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* SIÁN brand */}
            <a href="#" style={{ display: 'inline-flex', alignItems: 'baseline', gap: '8px', textDecoration: 'none', color: 'inherit' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '20px', letterSpacing: '0.02em', color: 'var(--color-white)' }}>SIÁN</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--color-fg-subtle)' }}>AGENCY</span>
            </a>
            <span style={{ width: '1px', height: '22px', background: 'var(--color-border-dim)' }}></span>

            {/* Pair product */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                width: '24px', height: '24px',
                display: 'grid', placeItems: 'center',
                border: '1px solid var(--color-border-dim)',
                borderRadius: '6px',
                background: 'var(--color-elev-1)'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="7" height="12" rx="1.2" stroke="#A4ACBC"/>
                  <rect x="14" y="8" width="7" height="12" rx="1.2" stroke="#A4ACBC"/>
                  <path d="M10 9h4" stroke="#1AE392"/>
                  <path d="M10 13h4" stroke="#1AE392" strokeDasharray="2 2"/>
                </svg>
              </span>
              <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '15px', letterSpacing: '0.01em', color: 'var(--color-white)' }}>Pair</span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px',
                letterSpacing: '0.2em', textTransform: 'uppercase',
                color: 'var(--color-accent)',
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                paddingLeft: '10px', marginLeft: '2px',
                borderLeft: '1px solid var(--color-border-dim)'
              }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: 'var(--color-accent)',
                  boxShadow: '0 0 0 0 var(--color-accent-25)',
                  animation: 'pulse 1.6s ease-out infinite'
                }}></span>
                <span>Live</span>
              </span>
            </div>

            {/* Segmented controls */}
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              border: '1px solid var(--color-border-dim)',
              borderRadius: '9999px',
              padding: '3px',
              background: 'var(--color-elev-1)'
            }}>
              <button
                onClick={() => setView("transactions")}
                style={{
                  fontSize: '12px', fontWeight: 500, padding: '6px 14px', borderRadius: '9999px',
                  color: view === "transactions" ? 'var(--color-dark)' : 'var(--color-fg-muted)',
                  background: view === "transactions" ? 'var(--color-accent)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  transition: 'color 200ms cubic-bezier(0.22, 1, 0.36, 1), background 200ms cubic-bezier(0.22, 1, 0.36, 1)'
                }}
              >
                Transactions
              </button>
              <button
                onClick={() => setView("charts")}
                style={{
                  fontSize: '12px', fontWeight: 500, padding: '6px 14px', borderRadius: '9999px',
                  color: view === "charts" ? 'var(--color-dark)' : 'var(--color-fg-muted)',
                  background: view === "charts" ? 'var(--color-accent)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  transition: 'color 200ms cubic-bezier(0.22, 1, 0.36, 1), background 200ms cubic-bezier(0.22, 1, 0.36, 1)'
                }}
              >
                Charts
              </button>
            </div>
          </div>

          {/* Center: KPI strip */}
          {stats && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '18px', lineHeight: 1, letterSpacing: '-0.01em', color: 'var(--color-white)', fontVariantNumeric: 'tabular-nums' }}>{stats.total}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-fg-subtle)', marginTop: '6px' }}>Tx</span>
              </div>
              <span style={{ width: '1px', height: '28px', background: 'var(--color-border-dim)' }}></span>

              <button
                onClick={() => setDocFilter(documentFilter === "filled" ? "all" : "filled")}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', border: 'none', background: 'none', color: 'inherit'
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '18px', lineHeight: 1, letterSpacing: '-0.01em', color: 'var(--color-accent)', fontVariantNumeric: 'tabular-nums' }}>{linked}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-fg-subtle)', marginTop: '6px' }}>Linked</span>
              </button>
              <span style={{ width: '1px', height: '28px', background: 'var(--color-border-dim)' }}></span>

              <button
                onClick={() => setDocFilter(documentFilter === "empty" ? "all" : "empty")}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', border: 'none', background: 'none', color: 'inherit'
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '18px', lineHeight: 1, letterSpacing: '-0.01em', color: 'var(--color-warn)', fontVariantNumeric: 'tabular-nums' }}>{missing}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-fg-subtle)', marginTop: '6px' }}>Missing</span>
              </button>
              <span style={{ width: '1px', height: '28px', background: 'var(--color-border-dim)' }}></span>

              <button
                onClick={() => addFilter("_direction", "income")}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', border: 'none', background: 'none', color: 'inherit'
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '18px', lineHeight: 1, letterSpacing: '-0.01em', color: 'var(--color-accent)', fontVariantNumeric: 'tabular-nums' }}>{fmtAmount(income, baseCurrency)}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-fg-subtle)', marginTop: '6px' }}>Income</span>
              </button>
              <span style={{ width: '1px', height: '28px', background: 'var(--color-border-dim)' }}></span>

              <button
                onClick={() => addFilter("_direction", "expense")}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', border: 'none', background: 'none', color: 'inherit'
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '18px', lineHeight: 1, letterSpacing: '-0.01em', color: 'var(--color-danger)', fontVariantNumeric: 'tabular-nums' }}>{fmtAmount(expenses, baseCurrency)}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-fg-subtle)', marginTop: '6px' }}>Expenses</span>
              </button>
              <span style={{ width: '1px', height: '28px', background: 'var(--color-border-dim)' }}></span>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '18px', lineHeight: 1, letterSpacing: '-0.01em', color: net >= 0 ? 'var(--color-accent)' : 'var(--color-danger)', fontVariantNumeric: 'tabular-nums' }}>{fmtAmount(net, baseCurrency)}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-fg-subtle)', marginTop: '6px' }}>Net</span>
              </div>
            </div>
          )}

          {/* Right: currency + model + progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ThemeToggle theme={theme} toggle={toggleTheme} />
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
        leftContent={
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <DateFilter dateRange={dateRange} onChange={setDateRange} />
            <select
              value=""
              onChange={(e) => { if (e.target.value) addFilter("_category", e.target.value); }}
              className="text-xs px-2.5 py-1 rounded border border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer focus:outline-none"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        }
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
            categories={categories}
            onCategoryChange={updateCategory}
            onAddCategory={addCategory}
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
