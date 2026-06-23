import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { Transaction } from "../types";
import type { FxRates } from "../hooks/useFxRates";
import { categoryTotals, fmtAbbrev } from "../lib/derive";
import { Card } from "./ui/Card";
import { FilterTabs } from "./ui/FilterTabs";
import { activePresetKey, nextRangeKey, rangeForKey, labelForKey } from "../lib/dateRanges";

const RAMP = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

interface Props { transactions: Transaction[]; baseCurrency: string; rates: FxRates | null; dateRange: { from: string | null; to: string | null }; onRangeChange: (from: string | null, to: string | null) => void; }

export function CategoryDonut({ transactions, baseCurrency, rates, dateRange, onRangeChange }: Props) {
  const [mode, setMode] = useState<"income" | "expenses">("expenses");
  const [hovering, setHovering] = useState(false);
  const all = useMemo(() => categoryTotals(transactions, baseCurrency, rates, mode), [transactions, baseCurrency, rates, mode]);
  // top 6 + Other for legibility
  const slices = useMemo(() => {
    if (all.length <= 7) return all;
    const top = all.slice(0, 6);
    const rest = all.slice(6);
    const amount = rest.reduce((s, x) => s + x.amount, 0);
    const pct = rest.reduce((s, x) => s + x.pct, 0);
    return [...top, { name: "Other", amount, pct }];
  }, [all]);
  const total = useMemo(() => all.reduce((s, x) => s + x.amount, 0), [all]);
  const colorFor = (i: number) => RAMP[i % RAMP.length];
  const rangeLabel = labelForKey(activePresetKey(dateRange));
  const cycleRange = () => { const r = rangeForKey(nextRangeKey(activePresetKey(dateRange))); onRangeChange(r.from, r.to); };

  return (
    <Card style={{ padding: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: 500 }}>Costs by category</div>
          <div style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>{`Share of ${mode} · ${rangeLabel}`}</div>
        </div>
        <FilterTabs tabs={[{ value: "income", label: "Income" }, { value: "expenses", label: "Expenses" }]} value={mode} onChange={setMode} />
      </div>

      {slices.length === 0 ? (
        <div style={{ height: "240px", display: "grid", placeItems: "center", color: "var(--muted-foreground)", fontSize: "0.875rem" }}>No {mode} in range</div>
      ) : (
        <>
          <div onClick={cycleRange} style={{ position: "relative", cursor: "pointer" }} title="Click to cycle the date range" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart accessibilityLayer={false}>
                <Pie data={slices} dataKey="amount" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={1} stroke="var(--card)" strokeWidth={2}>
                  {slices.map((_, i) => <Cell key={i} fill={colorFor(i)} />)}
                </Pie>
                <Tooltip
                  wrapperStyle={{ zIndex: 20 }}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-popover)", fontFamily: "var(--font-mono)", fontSize: 12 }}
                  formatter={(v, name) => [fmtAbbrev(Number(v ?? 0), baseCurrency), String(name ?? "")]}
                />
              </PieChart>
            </ResponsiveContainer>
            {!hovering && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.25rem", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{fmtAbbrev(total, baseCurrency)}</div>
                <div style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)", color: "var(--muted-foreground)" }}>total</div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginTop: "1rem" }}>
            {slices.map((s, i) => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: colorFor(i), flexShrink: 0 }} />
                <span style={{ flex: 1, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted-foreground)", fontVariantNumeric: "tabular-nums" }}>{fmtAbbrev(s.amount, baseCurrency)}</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--foreground)", fontVariantNumeric: "tabular-nums", width: "44px", textAlign: "right" }}>{Math.round(s.pct)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
