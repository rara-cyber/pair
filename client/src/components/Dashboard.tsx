import { useMemo, useState } from "react";
import type { Transaction } from "../types";
import { type FxRates, convertAmount } from "../hooks/useFxRates";
import { useBalances } from "../hooks/useBalances";
import { Card } from "./ui/Card";
import { KpiTile } from "./ui/KpiTile";
import { MilestoneLadder } from "./ui/MilestoneLadder";
import { KpiTrendDialog } from "./ui/KpiTrendDialog";
import { kpisFor, coverageLadder, monthlySeries, fmtAbbrev, sym } from "../lib/derive";
import { CategoryStackChart } from "./CategoryStackChart";
import { CategoryDonut } from "./CategoryDonut";
import { TopMerchantsChart } from "./TopMerchantsChart";

interface Props {
  transactions: Transaction[];
  stats: { total: number; withInvoice: number; withRemittance: number } | null;
  baseCurrency: string;
  rates: FxRates | null;
  dateRange: { from: string | null; to: string | null };
  onRangeChange: (from: string | null, to: string | null) => void;
}

export function Dashboard({ transactions, stats, baseCurrency, rates, dateRange, onRangeChange }: Props) {
  const kpis = useMemo(() => kpisFor(transactions, baseCurrency, rates), [transactions, baseCurrency, rates]);
  const coverage = useMemo(() => (stats ? coverageLadder(stats) : null), [stats]);
  const series = useMemo(() => monthlySeries(transactions, baseCurrency, rates), [transactions, baseCurrency, rates]);
  const [openMetric, setOpenMetric] = useState<null | "income" | "expenses" | "net">(null);
  const { balances, loading: balancesLoading } = useBalances();

  // Live balance across every connected account, normalised to baseCurrency.
  // Shows "—" rather than a partial figure when nothing is connected — a wrong
  // balance is worse than a visibly absent one.
  const liveBalance = useMemo(() => {
    if (balancesLoading) return { value: "…", sub: "" };
    if (!balances?.length) return { value: "—", sub: "Not connected" };
    const total = balances.reduce((s, b) => s + convertAmount(b.amount, b.currency, baseCurrency, rates), 0);
    const byCurrency = new Map<string, number>();
    for (const b of balances) byCurrency.set(b.currency, (byCurrency.get(b.currency) ?? 0) + b.amount);
    const sub = [...byCurrency.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cur, amt]) => `${sym(cur)}${Math.round(amt).toLocaleString()}`)
      .join(" · ");
    return { value: fmtAbbrev(total, baseCurrency), sub };
  }, [balances, balancesLoading, baseCurrency, rates]);

  return (
    <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "40px 24px 80px" }}>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", marginBottom: "28px" }}>
        <div>
          <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginBottom: "8px" }}>SIÁN Portfolio · Internal</div>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 600, letterSpacing: "-0.02em" }}>Pair Overview</h1>
          <p style={{ margin: "6px 0 0", fontSize: "14px", color: "var(--muted-foreground)" }}>
            {stats ? `${stats.total} transactions · ${stats.withInvoice + stats.withRemittance} with a document` : "Loading…"}
          </p>
        </div>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "28px" }}>
        <KpiTile label={`Income · ${kpis.period}`} value={kpis.income.value} delta={kpis.income.delta} sub={kpis.income.sub} onClick={() => setOpenMetric("income")} />
        <KpiTile label={`Expenses · ${kpis.period}`} value={kpis.expenses.value} delta={kpis.expenses.delta} sub={kpis.expenses.sub} onClick={() => setOpenMetric("expenses")} />
        <KpiTile label={`Net · ${kpis.period}`} value={kpis.net.value} delta={kpis.net.delta} sub={kpis.net.sub} onClick={() => setOpenMetric("net")} />
        <KpiTile label="Live balance" value={liveBalance.value} sub={liveBalance.sub} />
        <Card style={{ padding: "1.25rem" }}>
          {coverage && <MilestoneLadder {...coverage} />}
        </Card>
      </section>

      <KpiTrendDialog
        open={openMetric !== null}
        onClose={() => setOpenMetric(null)}
        metric={openMetric ?? "income"}
        baseCurrency={baseCurrency}
        series={series}
      />

      <div style={{ marginTop: "28px" }}>
        <CategoryStackChart transactions={transactions} baseCurrency={baseCurrency} rates={rates} dateRange={dateRange} onRangeChange={onRangeChange} />
      </div>
      <div style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "12px" }}>
        <CategoryDonut transactions={transactions} baseCurrency={baseCurrency} rates={rates} dateRange={dateRange} onRangeChange={onRangeChange} />
        <TopMerchantsChart transactions={transactions} baseCurrency={baseCurrency} rates={rates} dateRange={dateRange} onRangeChange={onRangeChange} />
      </div>
    </div>
  );
}
