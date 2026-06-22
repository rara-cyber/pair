import {
  ComposedChart,
  Bar,
  Line,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Transaction } from "../types";
import { CURRENCY_SYMBOLS, convertAmount, type FxRates } from "../hooks/useFxRates";

interface Props {
  transactions: Transaction[];
  onMonthClick?: (month: string) => void;
  activeMonth?: string | null;
  baseCurrency: string;
  rates: FxRates | null;
}

function formatAmount(value: number, symbol: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}${symbol}${(abs / 1000).toFixed(1)}k`;
  return `${sign}${symbol}${abs.toFixed(0)}`;
}

function buildMonthlyData(
  transactions: Transaction[],
  baseCurrency: string,
  rates: FxRates | null
) {
  const map = new Map<string, { income: number; expenses: number }>();

  for (const tx of transactions) {
    const month = tx.date.substring(0, 7);
    const entry = map.get(month) ?? { income: 0, expenses: 0 };
    const amount = convertAmount(tx.amount, tx.currency, baseCurrency, rates);
    if (amount >= 0) {
      entry.income += amount;
    } else {
      entry.expenses += Math.abs(amount);
    }
    map.set(month, entry);
  }

  const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));

  let cumulative = 0;
  return sorted.map(([month, { income, expenses }]) => {
    const net = income - expenses;
    cumulative += net;
    return {
      month: month.substring(5),
      fullMonth: month,
      income: Math.round(income * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      net: Math.round(net * 100) / 100,
      cumulative: Math.round(cumulative * 100) / 100,
    };
  });
}

const tooltipStyle: React.CSSProperties = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  boxShadow: "var(--shadow-popover)",
  borderRadius: "var(--radius-xl)",
  padding: "8px 12px",
  minWidth: 160,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label, symbol }: any) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as {
    income: number;
    expenses: number;
    net: number;
    cumulative: number;
  };
  return (
    <div style={tooltipStyle}>
      <div
        className="text-xs font-medium mb-1"
        style={{ color: "var(--popover-foreground)" }}
      >
        {label}
      </div>
      <div className="text-xs flex justify-between gap-4" style={{ color: "var(--muted-foreground)" }}>
        <span>Income</span>
        <span className="font-mono" style={{ color: "var(--popover-foreground)" }}>
          {formatAmount(p.income, symbol)}
        </span>
      </div>
      <div className="text-xs flex justify-between gap-4" style={{ color: "var(--muted-foreground)" }}>
        <span>Expenses</span>
        <span className="font-mono" style={{ color: "var(--popover-foreground)" }}>
          {formatAmount(p.expenses, symbol)}
        </span>
      </div>
      <div className="text-xs flex justify-between gap-4" style={{ color: "var(--muted-foreground)" }}>
        <span>Net</span>
        <span className="font-mono" style={{ color: "var(--popover-foreground)" }}>
          {p.net >= 0 ? "+" : ""}{formatAmount(p.net, symbol)}
        </span>
      </div>
      <div className="text-xs flex justify-between gap-4" style={{ color: "var(--muted-foreground)" }}>
        <span>Cumulative</span>
        <span className="font-mono" style={{ color: "var(--popover-foreground)" }}>
          {formatAmount(p.cumulative, symbol)}
        </span>
      </div>
    </div>
  );
};

export function CashFlowCharts({ transactions, onMonthClick, activeMonth, baseCurrency, rates }: Props) {
  const symbol = CURRENCY_SYMBOLS[baseCurrency] ?? `${baseCurrency} `;
  const data = buildMonthlyData(transactions, baseCurrency, rates);
  if (data.length === 0) return null;
  const totalIncome   = data.reduce((s, d) => s + d.income, 0);
  const totalExpenses = data.reduce((s, d) => s + d.expenses, 0);
  const totalNet      = totalIncome - totalExpenses;

  return (
    <div
      className="px-6 py-4"
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--card)",
        boxShadow: "var(--ring-card)",
        borderRadius: "var(--radius-xl)",
      }}
    >
      {/* Summary — horizontal row above the chart */}
      <div className="flex gap-8 mb-4">
        <div>
          <div
            className="text-[11px] uppercase tracking-wider mb-1"
            style={{ color: "var(--muted-foreground)" }}
          >
            Income
          </div>
          <div
            className="text-2xl font-bold tabular-nums leading-none"
            style={{ color: "var(--foreground)" }}
          >
            {formatAmount(totalIncome, symbol)}
          </div>
        </div>
        <div>
          <div
            className="text-[11px] uppercase tracking-wider mb-1"
            style={{ color: "var(--muted-foreground)" }}
          >
            Expenses
          </div>
          <div
            className="text-2xl font-bold tabular-nums leading-none"
            style={{ color: "var(--foreground)" }}
          >
            {formatAmount(totalExpenses, symbol)}
          </div>
        </div>
        <div>
          <div
            className="text-[11px] uppercase tracking-wider mb-1"
            style={{ color: "var(--muted-foreground)" }}
          >
            Net
          </div>
          <div
            className="text-2xl font-bold tabular-nums leading-none"
            style={{ color: "var(--foreground)" }}
          >
            {totalNet >= 0 ? "+" : ""}{formatAmount(totalNet, symbol)}
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          onClick={(e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            if (e?.activePayload?.[0]?.payload?.fullMonth && onMonthClick) {
              onMonthClick(e.activePayload[0].payload.fullMonth);
            }
          }}
          style={{ cursor: onMonthClick ? "pointer" : "default" }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatAmount(v, symbol)}
            width={56}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatAmount(v, symbol)}
            width={56}
          />
          <Tooltip content={(props) => <CustomTooltip {...props} symbol={symbol} />} />
          {/* Income bars — lighter step (chart-1) */}
          <Bar yAxisId="left" dataKey="income" name="Income" radius={[2, 2, 0, 0]} maxBarSize={28}>
            {data.map((entry) => {
              const isActive = !activeMonth || entry.fullMonth === activeMonth;
              return (
                <Cell
                  key={entry.fullMonth}
                  fill={isActive ? "var(--chart-1)" : "var(--chart-1)"}
                  opacity={isActive ? 0.85 : 0.25}
                />
              );
            })}
          </Bar>
          {/* Expenses bars — mid-dark step (chart-4) */}
          <Bar yAxisId="left" dataKey="expenses" name="Expenses" radius={[2, 2, 0, 0]} maxBarSize={28}>
            {data.map((entry) => {
              const isActive = !activeMonth || entry.fullMonth === activeMonth;
              return (
                <Cell
                  key={entry.fullMonth}
                  fill={isActive ? "var(--chart-4)" : "var(--chart-4)"}
                  opacity={isActive ? 0.85 : 0.25}
                />
              );
            })}
          </Bar>
          {/* Cumulative line — darkest step (chart-5) */}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cumulative"
            name="Cumulative"
            stroke="var(--chart-5)"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
