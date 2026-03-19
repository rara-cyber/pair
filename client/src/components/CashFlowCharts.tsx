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

interface Props {
  transactions: Transaction[];
  onMonthClick?: (month: string) => void;
  activeMonth?: string | null;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€", USD: "$", GBP: "£", CZK: "Kč", CHF: "Fr",
};

function formatAmount(value: number, symbol = "€") {
  if (Math.abs(value) >= 1000) return `${symbol}${(value / 1000).toFixed(1)}k`;
  return `${symbol}${value.toFixed(0)}`;
}

function detectCurrency(transactions: Transaction[]): string {
  const counts = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.currency) counts.set(tx.currency, (counts.get(tx.currency) ?? 0) + 1);
  }
  if (counts.size === 0) return "€";
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return CURRENCY_SYMBOLS[dominant] ?? dominant;
}

function toEur(tx: Transaction): number {
  if (tx.currency === "EUR") return tx.amount;
  const rate = parseFloat(tx.exchangeRate);
  if (!rate) return tx.amount;
  if (tx.exchangeFrom === tx.currency && tx.exchangeTo === "EUR") return tx.amount * rate;
  if (tx.exchangeFrom === "EUR" && tx.exchangeTo === tx.currency) return tx.amount / rate;
  return tx.amount;
}

function buildMonthlyData(transactions: Transaction[], convertToEur: boolean) {
  const map = new Map<string, { income: number; expenses: number }>();

  for (const tx of transactions) {
    const month = tx.date.substring(0, 7);
    const entry = map.get(month) ?? { income: 0, expenses: 0 };
    const amount = convertToEur ? toEur(tx) : tx.amount;
    if (amount >= 0) {
      entry.income += amount;
    } else {
      entry.expenses += Math.abs(amount);
    }
    map.set(month, entry);
  }

  const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));

  let runningNet = 0;
  return sorted.map(([month, { income, expenses }]) => {
    const net = income - expenses;
    runningNet += net;
    return {
      month: month.substring(5),
      fullMonth: month,
      income: Math.round(income * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      net: Math.round(net * 100) / 100,
      runningNet: Math.round(runningNet * 100) / 100,
    };
  });
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <div className="font-medium text-zinc-200 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-4" style={{ color: p.color }}>
          <span>{p.name}</span>
          <span className="font-mono">{formatAmount(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export function CashFlowCharts({ transactions, onMonthClick, activeMonth }: Props) {
  const multiCurrency = new Set(transactions.map((t) => t.currency)).size > 1;
  const symbol = multiCurrency ? "€" : detectCurrency(transactions);
  const data = buildMonthlyData(transactions, multiCurrency);
  if (data.length === 0) return null;
  const totalIncome   = data.reduce((s, d) => s + d.income, 0);
  const totalExpenses = data.reduce((s, d) => s + d.expenses, 0);
  const totalNet      = totalIncome - totalExpenses;

  return (
    <div className="px-6 py-4 border-b border-zinc-800 flex gap-8 items-center">
      {/* Summary — prominently sized */}
      <div className="flex gap-8 shrink-0">
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

      {/* Divider */}
      <div className="w-px self-stretch bg-zinc-800 shrink-0" />

      {/* Chart */}
      <div className="flex-1 min-w-0">
        <ResponsiveContainer width="100%" height={96}>
          <ComposedChart
            data={data}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            onClick={(e) => {
              if (e?.activePayload?.[0]?.payload?.fullMonth && onMonthClick) {
                onMonthClick(e.activePayload[0].payload.fullMonth);
              }
            }}
            style={{ cursor: onMonthClick ? "pointer" : "default" }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#52525b" }} axisLine={false} tickLine={false} />
            <YAxis hide tickFormatter={(v) => formatAmount(v, symbol)} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="income" name="Income" radius={[2, 2, 0, 0]} maxBarSize={24}>
              {data.map((entry) => {
                const isActive = !activeMonth || entry.fullMonth === activeMonth;
                return <Cell key={entry.fullMonth} fill="#10b981" opacity={isActive ? 0.85 : 0.2} />;
              })}
            </Bar>
            <Bar dataKey="expenses" name="Expenses" radius={[2, 2, 0, 0]} maxBarSize={24}>
              {data.map((entry) => {
                const isActive = !activeMonth || entry.fullMonth === activeMonth;
                return <Cell key={entry.fullMonth} fill="#f43f5e" opacity={isActive ? 0.85 : 0.2} />;
              })}
            </Bar>
            <Line dataKey="net" name="Net" stroke="#a78bfa" strokeWidth={1.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
