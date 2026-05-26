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

const CustomTooltip = ({ active, payload, label, symbol }: any) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as {
    income: number;
    expenses: number;
    net: number;
    cumulative: number;
  };
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-lg min-w-[160px]">
      <div className="font-medium text-zinc-200 mb-1">{label}</div>
      <div className="flex justify-between gap-4 text-emerald-400">
        <span>Income</span>
        <span className="font-mono">{formatAmount(p.income, symbol)}</span>
      </div>
      <div className="flex justify-between gap-4 text-red-400">
        <span>Expenses</span>
        <span className="font-mono">{formatAmount(p.expenses, symbol)}</span>
      </div>
      <div className={`flex justify-between gap-4 ${p.net >= 0 ? "text-emerald-300" : "text-red-300"}`}>
        <span>Net</span>
        <span className="font-mono">{formatAmount(p.net, symbol)}</span>
      </div>
      <div className="flex justify-between gap-4 text-violet-400">
        <span>Cumulative</span>
        <span className="font-mono">{formatAmount(p.cumulative, symbol)}</span>
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
    <div className="px-6 py-4 border-b border-zinc-800">
      {/* Summary — horizontal row above the chart */}
      <div className="flex gap-8 mb-4">
        <div>
          <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Income</div>
          <div className="text-2xl font-bold text-emerald-400 tabular-nums leading-none">
            {formatAmount(totalIncome, symbol)}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Expenses</div>
          <div className="text-2xl font-bold text-red-400 tabular-nums leading-none">
            {formatAmount(totalExpenses, symbol)}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Net</div>
          <div className={`text-2xl font-bold tabular-nums leading-none ${totalNet >= 0 ? "text-emerald-300" : "text-red-300"}`}>
            {totalNet >= 0 ? "+" : ""}{formatAmount(totalNet, symbol)}
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          onClick={(e: any) => {
            if (e?.activePayload?.[0]?.payload?.fullMonth && onMonthClick) {
              onMonthClick(e.activePayload[0].payload.fullMonth);
            }
          }}
          style={{ cursor: onMonthClick ? "pointer" : "default" }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#52525b" }} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: "#52525b" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatAmount(v, symbol)}
            width={56}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fill: "#52525b" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatAmount(v, symbol)}
            width={56}
          />
          <Tooltip content={(props) => <CustomTooltip {...props} symbol={symbol} />} />
          <Bar yAxisId="left" dataKey="income" name="Income" radius={[2, 2, 0, 0]} maxBarSize={28}>
            {data.map((entry) => {
              const isActive = !activeMonth || entry.fullMonth === activeMonth;
              return <Cell key={entry.fullMonth} fill="#10b981" opacity={isActive ? 0.85 : 0.2} />;
            })}
          </Bar>
          <Bar yAxisId="left" dataKey="expenses" name="Expenses" radius={[2, 2, 0, 0]} maxBarSize={28}>
            {data.map((entry) => {
              const isActive = !activeMonth || entry.fullMonth === activeMonth;
              return <Cell key={entry.fullMonth} fill="#f43f5e" opacity={isActive ? 0.85 : 0.2} />;
            })}
          </Bar>
          <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative" stroke="#a78bfa" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
