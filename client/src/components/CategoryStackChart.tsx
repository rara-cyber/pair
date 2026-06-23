import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Transaction } from "../types";
import type { FxRates } from "../hooks/useFxRates";
import { categoryMonthly, fmtAbbrev } from "../lib/derive";
import { Card } from "./ui/Card";
import { FilterTabs } from "./ui/FilterTabs";
import { activePresetKey, nextRangeKey, rangeForKey, labelForKey } from "../lib/dateRanges";

const RAMP = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

interface Props { transactions: Transaction[]; baseCurrency: string; rates: FxRates | null; dateRange: { from: string | null; to: string | null }; onRangeChange: (from: string | null, to: string | null) => void; }

export function CategoryStackChart({ transactions, baseCurrency, rates, dateRange, onRangeChange }: Props) {
  const [mode, setMode] = useState<"income" | "expenses">("income");
  const { data, categories } = useMemo(
    () => categoryMonthly(transactions, baseCurrency, rates, mode),
    [transactions, baseCurrency, rates, mode],
  );
  const colorFor = (i: number) => RAMP[i % RAMP.length];
  const rangeLabel = labelForKey(activePresetKey(dateRange));
  const cycleRange = () => { const r = rangeForKey(nextRangeKey(activePresetKey(dateRange))); onRangeChange(r.from, r.to); };

  return (
    <Card style={{ padding: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.25rem" }}>
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: 500 }}>Cash flow by category</div>
          <div style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>{`Monthly ${mode}, stacked by category · ${rangeLabel}`}</div>
        </div>
        <FilterTabs
          tabs={[{ value: "income", label: "Income" }, { value: "expenses", label: "Expenses" }]}
          value={mode}
          onChange={setMode}
        />
      </div>

      {/* legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1rem", margin: "0.75rem 0 1rem" }}>
        {categories.map((cat, i) => (
          <span key={cat} style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: colorFor(i), display: "inline-block" }} />
            {cat}
          </span>
        ))}
      </div>

      <div onClick={cycleRange} style={{ cursor: "pointer" }} title="Click to cycle the date range">
        {data.length === 0 ? (
          <div style={{ height: "240px", display: "grid", placeItems: "center", color: "var(--muted-foreground)", fontSize: "0.875rem" }}>No {mode} in range</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => fmtAbbrev(Number(v), baseCurrency)} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-popover)", fontFamily: "var(--font-mono)", fontSize: 12 }}
                formatter={(v, name) => [fmtAbbrev(Number(v ?? 0), baseCurrency), String(name ?? "")]}
              />
              {categories.map((cat, i) => (
                <Bar key={cat} dataKey={cat} stackId="a" fill={colorFor(i)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
