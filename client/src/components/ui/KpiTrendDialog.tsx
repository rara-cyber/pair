import {
  BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import type { MonthPoint } from "../../lib/derive";
import { fmtAbbrev } from "../../lib/derive";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "./Dialog";
import { Button } from "./Button";

interface Props {
  open: boolean;
  onClose: () => void;
  metric: "income" | "expenses" | "net";
  baseCurrency: string;
  series: MonthPoint[];
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function KpiTrendDialog({ open, onClose, metric, baseCurrency, series }: Props) {
  if (!open) return null;
  const shown = series.slice(-12);

  return (
    <Dialog open={open} onClose={onClose} width="560px">
      <DialogHeader>
        <div>
          <DialogTitle>{cap(metric)} · monthly</DialogTitle>
          <DialogDescription>Last {shown.length} months · {baseCurrency}</DialogDescription>
        </div>
      </DialogHeader>

      <DialogBody>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={shown} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-popover)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
              }}
              formatter={(v) => [fmtAbbrev(Number(v ?? 0), baseCurrency), cap(metric)]}
            />
            <Bar dataKey={metric}>
              {shown.map((_, i) => (
                <Cell
                  key={i}
                  fill={i === shown.length - 1 ? "var(--foreground)" : "var(--chart-3)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div style={{ marginTop: "1rem" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr auto",
            padding: "0.375rem 0",
            borderBottom: "1px solid var(--border)",
            fontSize: "0.75rem",
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--muted-foreground)",
          }}>
            <span>Month</span>
            <span style={{ textAlign: "right" }}>{cap(metric)}</span>
          </div>
          {[...shown].reverse().map((pt, i) => {
            const val = pt[metric];
            return (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "1fr auto",
                padding: "0.375rem 0",
                borderBottom: "1px solid var(--border)",
                fontSize: "0.8125rem",
              }}>
                <span style={{ color: "var(--muted-foreground)" }}>{pt.label}</span>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontVariantNumeric: "tabular-nums",
                  color: val < 0 ? "var(--negative)" : "var(--foreground)",
                  textAlign: "right",
                }}>{fmtAbbrev(val, baseCurrency)}</span>
              </div>
            );
          })}
        </div>
      </DialogBody>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </DialogFooter>
    </Dialog>
  );
}

