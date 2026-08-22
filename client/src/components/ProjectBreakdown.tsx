import { useMemo } from "react";
import type { Transaction } from "../types";
import type { FxRates } from "../hooks/useFxRates";
import { projectTotals, fmtAbbrev } from "../lib/derive";
import { Card } from "./ui/Card";

interface Props {
  transactions: Transaction[];
  baseCurrency: string;
  rates: FxRates | null;
  onFilter: (key: string, value: string) => void;
}

export function ProjectBreakdown({ transactions, baseCurrency, rates, onFilter }: Props) {
  const rows = useMemo(() => projectTotals(transactions, baseCurrency, rates), [transactions, baseCurrency, rates]);

  // Bars are scaled against the largest absolute figure in view so income and
  // spend stay visually comparable across projects.
  const scale = useMemo(
    () => Math.max(1, ...rows.map((r) => Math.max(r.income, Math.abs(r.expenses)))),
    [rows],
  );

  if (rows.length === 0) return null;

  return (
    <Card style={{ padding: "1.25rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: 500 }}>By project</div>
        <div style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
          Income, spend and net per business line · click a row to filter
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {rows.map((r) => {
          const unassigned = r.name === "Unassigned";
          return (
            <div
              key={r.name}
              onClick={() => { if (!unassigned) onFilter("project", r.name); }}
              style={{ cursor: unassigned ? "default" : "pointer", opacity: unassigned ? 0.6 : 1 }}
              title={unassigned ? "No project rule matches these rows" : `Filter to ${r.name}`}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.3rem" }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
                  {r.name}
                  <span style={{ marginLeft: "0.4rem", fontSize: "0.6875rem", color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>
                    {r.count}
                  </span>
                </span>
                <span style={{ display: "inline-flex", gap: "0.75rem", fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontVariantNumeric: "tabular-nums" }}>
                  <span style={{ color: "var(--muted-foreground)" }}>{fmtAbbrev(r.income, baseCurrency)}</span>
                  <span style={{ color: "var(--muted-foreground)" }}>{fmtAbbrev(Math.abs(r.expenses), baseCurrency)}</span>
                  <span style={{ color: r.net >= 0 ? "var(--positive)" : "var(--negative)", fontWeight: 500, minWidth: "58px", textAlign: "right" }}>
                    {fmtAbbrev(r.net, baseCurrency)}
                  </span>
                </span>
              </div>

              {/* income above the axis, spend below — same convention as the cash flow chart */}
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <div style={{ height: "6px", background: "var(--muted)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(r.income / scale) * 100}%`, background: "var(--chart-1)" }} />
                </div>
                <div style={{ height: "6px", background: "var(--muted)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(Math.abs(r.expenses) / scale) * 100}%`, background: "var(--chart-3)" }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
