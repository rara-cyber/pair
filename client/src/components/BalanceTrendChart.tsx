import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useMemo } from "react";
import type { Transaction } from "../types";
import { CURRENCY_SYMBOLS, convertAmount, type FxRates } from "../hooks/useFxRates";

interface Props {
  transactions: Transaction[];
  baseCurrency: string;
  rates: FxRates | null;
}

interface Point {
  date: string;
  cumulative: number;
  delta: number;
}

function formatAmount(value: number, symbol: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}${symbol}${(abs / 1000).toFixed(1)}k`;
  return `${sign}${symbol}${abs.toFixed(0)}`;
}

function buildSeries(
  transactions: Transaction[],
  baseCurrency: string,
  rates: FxRates | null
): Point[] {
  if (transactions.length === 0) return [];
  const byDate = new Map<string, number>();
  for (const tx of transactions) {
    const amount = convertAmount(tx.amount, tx.currency, baseCurrency, rates);
    byDate.set(tx.date, (byDate.get(tx.date) ?? 0) + amount);
  }
  const dates = Array.from(byDate.keys()).sort();
  let cumulative = 0;
  return dates.map((date) => {
    const delta = byDate.get(date) ?? 0;
    cumulative += delta;
    return {
      date,
      cumulative: Math.round(cumulative * 100) / 100,
      delta: Math.round(delta * 100) / 100,
    };
  });
}

const TooltipBody = ({ active, payload, label, symbol }: any) => {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as Point;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-lg min-w-[160px]">
      <div className="font-medium text-zinc-200 mb-1">{label}</div>
      <div className="flex justify-between gap-4 text-zinc-300">
        <span>Cumulative</span>
        <span className={`font-mono ${point.cumulative >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {formatAmount(point.cumulative, symbol)}
        </span>
      </div>
      <div className="flex justify-between gap-4 text-zinc-400 mt-0.5">
        <span>Day Δ</span>
        <span className={`font-mono ${point.delta >= 0 ? "text-emerald-300" : "text-red-300"}`}>
          {point.delta >= 0 ? "+" : ""}
          {formatAmount(point.delta, symbol)}
        </span>
      </div>
    </div>
  );
};

export function BalanceTrendChart({ transactions, baseCurrency, rates }: Props) {
  const data = useMemo(
    () => buildSeries(transactions, baseCurrency, rates),
    [transactions, baseCurrency, rates]
  );
  const symbol = CURRENCY_SYMBOLS[baseCurrency] ?? `${baseCurrency} `;
  const finalValue = data.length ? data[data.length - 1].cumulative : 0;
  const positive = finalValue >= 0;
  const gradientId = "balanceGradient";
  const stroke = positive ? "#10b981" : "#f43f5e";

  return (
    <div className="px-6 py-4 border-b border-zinc-800">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-sm font-medium text-zinc-200">Cumulative cash flow</div>
          <div className="text-[11px] text-zinc-500">
            Starts at 0 on the first transaction of the selected timeframe — not an account balance.
          </div>
        </div>
        {data.length > 0 && (
          <div className={`text-xl font-bold tabular-nums ${positive ? "text-emerald-400" : "text-red-400"}`}>
            {positive ? "+" : ""}
            {formatAmount(finalValue, symbol)}
          </div>
        )}
      </div>

      {data.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-zinc-600 text-sm">
          No transactions in range
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={224}>
          <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.4} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#52525b" }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#52525b" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatAmount(v, symbol)}
              width={60}
            />
            <ReferenceLine y={0} stroke="#3f3f46" strokeDasharray="2 2" />
            <Tooltip content={<TooltipBody symbol={symbol} />} />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke={stroke}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, stroke: stroke, strokeWidth: 2, fill: "#18181b" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
