import { useMemo, useState } from "react";
import type { Transaction } from "../types";
import { type FxRates } from "../hooks/useFxRates";
import { Card } from "./ui/Card";
import { KpiTile } from "./ui/KpiTile";
import { MilestoneLadder } from "./ui/MilestoneLadder";
import { KpiTrendDialog } from "./ui/KpiTrendDialog";
import { kpisFor, coverageLadder, monthlySeries } from "../lib/derive";
import { CategoryStackChart } from "./CategoryStackChart";

interface Props {
  transactions: Transaction[];
  stats: { total: number; withInvoice: number; withRemittance: number } | null;
  baseCurrency: string;
  rates: FxRates | null;
}

export function Dashboard({ transactions, stats, baseCurrency, rates }: Props) {
  const kpis = useMemo(() => kpisFor(transactions, baseCurrency, rates), [transactions, baseCurrency, rates]);
  const coverage = useMemo(() => (stats ? coverageLadder(stats) : null), [stats]);
  const series = useMemo(() => monthlySeries(transactions, baseCurrency, rates), [transactions, baseCurrency, rates]);
  const [openMetric, setOpenMetric] = useState<null | "income" | "expenses" | "net">(null);

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

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "28px" }}>
        <KpiTile label={`Income · ${kpis.period}`} value={kpis.income.value} delta={kpis.income.delta} sub={kpis.income.sub} onClick={() => setOpenMetric("income")} />
        <KpiTile label={`Expenses · ${kpis.period}`} value={kpis.expenses.value} delta={kpis.expenses.delta} sub={kpis.expenses.sub} onClick={() => setOpenMetric("expenses")} />
        <KpiTile label={`Net · ${kpis.period}`} value={kpis.net.value} delta={kpis.net.delta} sub={kpis.net.sub} onClick={() => setOpenMetric("net")} />
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
        <CategoryStackChart transactions={transactions} baseCurrency={baseCurrency} rates={rates} />
      </div>
    </div>
  );
}
