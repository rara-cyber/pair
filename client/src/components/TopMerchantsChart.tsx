import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Transaction } from "../types";
import type { FxRates } from "../hooks/useFxRates";
import { topMerchants, fmtAbbrev } from "../lib/derive";
import { Card } from "./ui/Card";
import { RangeToggle } from "./ui/RangeToggle";

interface Props { transactions: Transaction[]; baseCurrency: string; rates: FxRates | null; dateRange: { from: string | null; to: string | null }; onRangeChange: (from: string | null, to: string | null) => void; }

export function TopMerchantsChart({ transactions, baseCurrency, rates, dateRange, onRangeChange }: Props) {
  const data = useMemo(() => topMerchants(transactions, baseCurrency, rates, 8), [transactions, baseCurrency, rates]);

  return (
    <Card style={{ padding: "1.25rem" }}>
      <div style={{ marginBottom: "0.25rem" }}>
        <div style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: 500 }}>Top merchants by spend</div>
        <div style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>Largest payees (expenses)</div>
      </div>

      <div style={{ margin: "0 0 0.75rem" }}><RangeToggle dateRange={dateRange} onChange={onRangeChange} /></div>

      {data.length === 0 ? (
        <div style={{ height: "240px", display: "grid", placeItems: "center", color: "var(--muted-foreground)", fontSize: "0.875rem" }}>No expenses in range</div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(240, data.length * 34)}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" tickFormatter={(v) => fmtAbbrev(Number(v), baseCurrency)} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={140} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-popover)", fontFamily: "var(--font-mono)", fontSize: 12 }}
              formatter={(v) => [fmtAbbrev(Number(v ?? 0), baseCurrency), "Spend"]}
            />
            <Bar dataKey="amount" fill="var(--chart-3)" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
