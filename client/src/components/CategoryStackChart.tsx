import { useMemo, useState } from "react";
import { ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import type { Transaction } from "../types";
import type { FxRates } from "../hooks/useFxRates";
import { categoryMonthly, monthlySeries, fmtAbbrev } from "../lib/derive";
import { Card } from "./ui/Card";
import { FilterTabs } from "./ui/FilterTabs";
import { activePresetKey, nextRangeKey, rangeForKey, labelForKey } from "../lib/dateRanges";

const RAMP = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
// Subtler than --foreground: the net line reads as an overlay, not a fourth bar.
const NET = "var(--muted-foreground)";

type Mode = "flow" | "income" | "expenses";

interface Props { transactions: Transaction[]; baseCurrency: string; rates: FxRates | null; dateRange: { from: string | null; to: string | null }; onRangeChange: (from: string | null, to: string | null) => void; }

export function CategoryStackChart({ transactions, baseCurrency, rates, dateRange, onRangeChange }: Props) {
  const [mode, setMode] = useState<Mode>("flow");

  // Category breakdown is only needed by the stacked modes.
  const { data: catData, categories } = useMemo(
    () => categoryMonthly(transactions, baseCurrency, rates, mode === "flow" ? "income" : mode),
    [transactions, baseCurrency, rates, mode],
  );

  // monthlySeries already returns { income, expenses, net } with expenses
  // stored negative — exactly what a money-in-above / money-out-below chart
  // needs, so nothing is re-derived for the flow mode.
  const flowData = useMemo(() => monthlySeries(transactions, baseCurrency, rates), [transactions, baseCurrency, rates]);

  const totals = useMemo(
    () => flowData.reduce((a, m) => ({ income: a.income + m.income, expenses: a.expenses + m.expenses, net: a.net + m.net }), { income: 0, expenses: 0, net: 0 }),
    [flowData],
  );

  const colorFor = (i: number) => RAMP[i % RAMP.length];
  const rangeLabel = labelForKey(activePresetKey(dateRange));
  const cycleRange = () => { const r = rangeForKey(nextRangeKey(activePresetKey(dateRange))); onRangeChange(r.from, r.to); };

  const isFlow = mode === "flow";
  const data = isFlow ? flowData : catData;

  const axisProps = {
    tick: { fill: "var(--muted-foreground)", fontSize: 11 },
    axisLine: false as const,
    tickLine: false as const,
  };
  const tooltipStyle = {
    background: "var(--popover)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-popover)",
    fontFamily: "var(--font-mono)", fontSize: 12,
  };

  return (
    <Card style={{ padding: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.25rem" }}>
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: 500 }}>Cash flow</div>
          <div style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
            {isFlow
              ? `Money in and out per month, net as the line · ${rangeLabel}`
              : `Monthly ${mode}, stacked by category · ${rangeLabel}`}
          </div>
        </div>
        <FilterTabs
          tabs={[{ value: "flow", label: "Flow" }, { value: "income", label: "Income" }, { value: "expenses", label: "Expenses" }]}
          value={mode}
          onChange={setMode}
        />
      </div>

      {/* In flow mode the legend doubles as the period summary. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1rem", margin: "0.75rem 0 1rem" }}>
        {isFlow ? (
          <>
            <FlowKey color={RAMP[0]} label="In" value={fmtAbbrev(totals.income, baseCurrency)} />
            <FlowKey color={RAMP[2]} label="Out" value={fmtAbbrev(Math.abs(totals.expenses), baseCurrency)} />
            <FlowKey color={NET} label="Net" value={fmtAbbrev(totals.net, baseCurrency)} line />
          </>
        ) : (
          categories.map((cat, i) => (
            <span key={cat} style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: colorFor(i), display: "inline-block" }} />
              {cat}
            </span>
          ))
        )}
      </div>

      <div onClick={cycleRange} style={{ cursor: "pointer" }} title="Click to cycle the date range">
        {data.length === 0 ? (
          <div style={{ height: "240px", display: "grid", placeItems: "center", color: "var(--muted-foreground)", fontSize: "0.875rem" }}>
            {isFlow ? "No transactions in range" : `No ${mode} in range`}
          </div>
        ) : isFlow ? (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={flowData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} stackOffset="sign" accessibilityLayer={false}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis tickFormatter={(v) => fmtAbbrev(Number(v), baseCurrency)} width={56} {...axisProps} />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={tooltipStyle}
                // Expenses are negative in the data; show them as a magnitude.
                formatter={(v, name) => [fmtAbbrev(name === "Out" ? Math.abs(Number(v ?? 0)) : Number(v ?? 0), baseCurrency), String(name ?? "")]}
              />
              {/* The waterline: above is cash in, below is cash out. */}
              <ReferenceLine y={0} stroke="var(--border)" />
              {/* One stack per month: money in above the waterline, out below. */}
              <Bar dataKey="income" name="In" stackId="cur" fill={RAMP[0]} radius={[2, 2, 0, 0]} />
              <Bar dataKey="expenses" name="Out" stackId="cur" fill={RAMP[2]} radius={[0, 0, 2, 2]} />
              <Line type="monotone" dataKey="net" name="Net" stroke={NET} strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={catData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} accessibilityLayer={false}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis tickFormatter={(v) => fmtAbbrev(Number(v), baseCurrency)} width={56} {...axisProps} />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={tooltipStyle}
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

function FlowKey({ color, label, value, line }: { color: string; label: string; value: string; line?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
      <span style={{ width: "10px", height: line ? "2px" : "10px", borderRadius: line ? "1px" : "2px", background: color, display: "inline-block" }} />
      {label}
      <span style={{ fontFamily: "var(--font-mono)", color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </span>
  );
}
