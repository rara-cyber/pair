import { useCallback, useEffect, useMemo, useState } from "react";
import { useTransactions } from "./hooks/useTransactions";
import { useProgress, type MatchEvent } from "./hooks/useProgress";
import { useFxRates, convertAmount, CURRENCY_SYMBOLS } from "./hooks/useFxRates";
import { useTheme } from "./hooks/useTheme";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { TransactionTable } from "./components/TransactionTable";
import { FilterBar } from "./components/FilterBar";
import { MonthRangeSlider } from "./components/MonthRangeSlider";
import { DropZone } from "./components/DropZone";
import { ProgressBadge } from "./components/ProgressBadge";
import { ManualMatchModal } from "./components/ManualMatchModal";
import { ThemeToggle } from "./components/ui/ThemeToggle";
import { Select } from "./components/ui/Select";
import { Dashboard } from "./components/Dashboard";
import { FilterTabs } from "./components/ui/FilterTabs";
import { Settings } from "./components/Settings";
import type { Transaction } from "./types";


interface MatchToast {
  id: number;
  tx: Transaction;
  filename: string;
}

let toastId = 0;

function fmtAmount(value: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const abs = Math.abs(value);
  if (abs >= 1000) return `${sym}${(value / 1000).toFixed(1)}k`;
  return `${sym}${value.toFixed(0)}`;
}

// One source of truth for the view tabs — they render in two places
// (mobile and desktop headers) and previously drifted apart.
type View = "overview" | "transactions" | "settings";
const VIEW_TABS: { value: View; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "transactions", label: "Transactions" },
  { value: "settings", label: "Settings" },
];

function App() {
  const [toasts, setToasts] = useState<MatchToast[]>([]);
  const [manualMatchTx, setManualMatchTx] = useState<Transaction | null>(null);
  const [highlightedTxIds, setHighlightedTxIds] = useState<Set<string>>(new Set());
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [view, setView] = useState<View>("overview");
  const [categories, setCategories] = useState<string[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const { rates, loading: ratesLoading, error: ratesError } = useFxRates();
  const { theme, toggle: toggleTheme } = useTheme();
  const isCompact = useMediaQuery("(max-width: 960px)");

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((d: { categories: string[] }) => setCategories(d.categories))
      .catch(() => {});
    fetch("/api/projects")
      .then((res) => res.json())
      .then((d: { projects: { name: string }[] }) => setProjects(d.projects.map((p) => p.name)))
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
    refetch,
  } = useTransactions();

  const setTransactionProject = useCallback(async (transferWiseId: string, project: string) => {
    await fetch(`/api/transaction/${encodeURIComponent(transferWiseId)}/project`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project }),
    });
    refetch();
  }, [refetch]);

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

  const toBase = (t: Transaction) => convertAmount(t.amount, t.currency, baseCurrency, rates);
  const income = transactions.filter((t) => t.amount >= 0).reduce((s, t) => s + toBase(t), 0);
  const expenses = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + toBase(t), 0);
  const net = income + expenses;

  // Unique currencies present in the loaded data for the picker
  const availableCurrencies = useMemo(() => {
    const seen = new Set<string>(["EUR"]);
    for (const tx of allTransactions) if (tx.currency) seen.add(tx.currency);
    return Array.from(seen).sort();
  }, [allTransactions]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
      <DropZone onIngested={refetch} />

      {/* Match toast notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => scrollToTransaction(toast.tx.transferWiseId)}
            className="flex flex-col gap-1 px-4 py-3 rounded-xl text-sm max-w-sm w-full border cursor-pointer transition-all hover:brightness-110"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-popover)',
            }}
          >
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: '3px', background: 'var(--positive)',
            }}></div>
            <div className="flex items-start justify-between gap-3" style={{ marginLeft: '8px' }}>
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center justify-between text-xs uppercase tracking-wider" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>
                  <span>Match found</span>
                  <span onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }} style={{ cursor: 'pointer', opacity: 0.7 }}>✕</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--foreground)', wordBreak: 'break-all', marginBottom: '6px' }}>
                  {toast.filename}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>
                  {toast.tx.date} · <strong>{toast.tx.amount} {toast.tx.currency}</strong>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>
                  {toast.tx.payerName || toast.tx.payeeName || toast.tx.merchant || toast.tx.description}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--muted-foreground)', marginTop: '8px', letterSpacing: '0.04em' }}>
                  {toast.tx.transferWiseId}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Header + filter bar stick together. Wrapping them in one sticky
          container avoids hardcoding the header height as the filter bar's
          `top`, which differs between the compact and desktop layouts. */}
      <div className="sticky top-0 z-30">
      {/* Header */}
      <header
        style={{
          background: "var(--background)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {isCompact ? (
          /* Compact header: two-row layout */
          <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '18px', letterSpacing: '0.02em', color: 'var(--foreground)' }}>SIÁN</span>
                <span style={{ width: '1px', height: '18px', background: 'var(--border)' }} />
                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '15px', color: 'var(--foreground)' }}>Pair</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ThemeToggle theme={theme} toggle={toggleTheme} />
                <ProgressBadge progress={progress} />
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <FilterTabs tabs={VIEW_TABS} value={view} onChange={setView} />
            </div>
          </div>
        ) : (
          /* Full desktop header: 3-column grid */
          <div style={{ height: '72px', padding: '0 24px', maxWidth: 'var(--container-max)', margin: '0 auto', display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '16px' }}>
            {/* Left: branding + tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* SIÁN brand */}
              <a href="#" style={{ display: 'inline-flex', alignItems: 'baseline', gap: '8px', textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '20px', letterSpacing: '0.02em', color: 'var(--foreground)' }}>SIÁN</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>AGENCY</span>
              </a>
              <span style={{ width: '1px', height: '22px', background: 'var(--border)' }}></span>

              {/* Pair product */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  width: '24px', height: '24px',
                  display: 'grid', placeItems: 'center',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'var(--card)'
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="7" height="12" rx="1.2" stroke="var(--muted-foreground)"/>
                    <rect x="14" y="8" width="7" height="12" rx="1.2" stroke="var(--muted-foreground)"/>
                    <path d="M10 9h4" stroke="var(--positive)"/>
                    <path d="M10 13h4" stroke="var(--positive)" strokeDasharray="2 2"/>
                  </svg>
                </span>
                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '15px', letterSpacing: '0.01em', color: 'var(--foreground)' }}>Pair</span>
              </div>

              {/* View tabs */}
              <FilterTabs tabs={VIEW_TABS} value={view} onChange={setView} />
            </div>

            {/* Center: KPI strip */}
            {stats && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '18px', lineHeight: 1, letterSpacing: '-0.01em', color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>{stats.total}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginTop: '6px' }}>Tx</span>
                </div>
                <span style={{ width: '1px', height: '28px', background: 'var(--border)' }}></span>

                <button
                  onClick={() => setDocFilter(documentFilter === "filled" ? "all" : "filled")}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', border: 'none', background: 'none', color: 'inherit' }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '18px', lineHeight: 1, letterSpacing: '-0.01em', color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>{linked}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginTop: '6px' }}>Linked</span>
                </button>
                <span style={{ width: '1px', height: '28px', background: 'var(--border)' }}></span>

                <button
                  onClick={() => setDocFilter(documentFilter === "empty" ? "all" : "empty")}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', border: 'none', background: 'none', color: 'inherit' }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '18px', lineHeight: 1, letterSpacing: '-0.01em', color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>{missing}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginTop: '6px' }}>Missing</span>
                </button>
                <span style={{ width: '1px', height: '28px', background: 'var(--border)' }}></span>

                <button
                  onClick={() => addFilter("_direction", "income")}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', border: 'none', background: 'none', color: 'inherit' }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '18px', lineHeight: 1, letterSpacing: '-0.01em', color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>{fmtAmount(income, baseCurrency)}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginTop: '6px' }}>Income</span>
                </button>
                <span style={{ width: '1px', height: '28px', background: 'var(--border)' }}></span>

                <button
                  onClick={() => addFilter("_direction", "expense")}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', border: 'none', background: 'none', color: 'inherit' }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '18px', lineHeight: 1, letterSpacing: '-0.01em', color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>{fmtAmount(expenses, baseCurrency)}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginTop: '6px' }}>Expenses</span>
                </button>
                <span style={{ width: '1px', height: '28px', background: 'var(--border)' }}></span>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '18px', lineHeight: 1, letterSpacing: '-0.01em', color: net >= 0 ? 'var(--positive)' : 'var(--negative)', fontVariantNumeric: 'tabular-nums' }}>{fmtAmount(net, baseCurrency)}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginTop: '6px' }}>Net</span>
                </div>
              </div>
            )}

            {/* Right: theme + progress only */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ThemeToggle theme={theme} toggle={toggleTheme} />
              <ProgressBadge progress={progress} />
            </div>
          </div>
        )}
      </header>

      {view !== "settings" && (
        <FilterBar
          filters={filters}
          onRemove={removeFilter}
          onClear={clearFilters}
          rightContent={<MonthRangeSlider dateRange={dateRange} onChange={setDateRange} />}
          leftContent={
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Select
                value=""
                onChange={(e) => { if (e.target.value) addFilter("_category", e.target.value); }}
              >
                <option value="">All categories</option>
                {[...categories].sort((a, b) => a.localeCompare(b)).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              <Select
                value=""
                onChange={(e) => { if (e.target.value) addFilter("project", e.target.value); }}
              >
                <option value="">All projects</option>
                {projects.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
            </div>
          }
        />
      )}
      </div>

      <main>
        {error && (
          <div className="flex items-center justify-center py-20" style={{ color: "var(--destructive)" }}>
            Error: {error}
          </div>
        )}
        {loading && !transactions.length && (
          <div className="flex items-center justify-center py-20 text-sm" style={{ color: "var(--muted-foreground)" }}>
            Loading transactions…
          </div>
        )}
        {!loading && view === "overview" && (
          <Dashboard
            transactions={transactions}
            stats={stats}
            baseCurrency={baseCurrency}
            rates={rates}
            dateRange={dateRange}
            onRangeChange={setDateRange}
            onFilter={addFilter}
          />
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
            projects={projects}
            onProjectChange={setTransactionProject}
          />
        )}
        {!loading && view === "settings" && (
          <Settings
            baseCurrency={baseCurrency}
            currencies={availableCurrencies}
            ratesLoading={ratesLoading}
            ratesError={ratesError}
            onCurrencyChange={setBaseCurrency}
            onProjectsChanged={() => {
              fetch("/api/projects").then((r) => r.json())
                .then((d: { projects: { name: string }[] }) => setProjects(d.projects.map((p) => p.name)))
                .catch(() => {});
              refetch();
            }}
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
