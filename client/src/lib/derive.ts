import type { Transaction } from "../types";
import { convertAmount, CURRENCY_SYMBOLS, type FxRates } from "../hooks/useFxRates";

export function sym(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? `${currency} `;
}

export function fmtAbbrev(value: number, currency: string): string {
  const s = sym(currency);
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1000) return `${sign}${s}${(abs / 1000).toFixed(1)}k`;
  return `${sign}${s}${abs.toFixed(0)}`;
}

function monthKey(t: Transaction): string {
  // tx.date is an ISO-ish date string (YYYY-MM-DD…); fall back to Date parsing.
  if (/^\d{4}-\d{2}/.test(t.date)) return t.date.slice(0, 7);
  const d = new Date(t.date);
  return Number.isNaN(d.getTime()) ? "unknown" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  // "2026-03" -> "Mar '26"
  const [y, m] = key.split("-");
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const idx = Number(m) - 1;
  if (!y || Number.isNaN(idx) || idx < 0 || idx > 11) return key;
  return `${names[idx]} '${y.slice(2)}`;
}

export function periodTotals(txns: Transaction[], base: string, rates: FxRates | null) {
  let income = 0, expenses = 0;
  for (const t of txns) {
    const v = convertAmount(t.amount, t.currency, base, rates);
    if (v >= 0) income += v; else expenses += v;
  }
  return { income, expenses, net: income + expenses };
}

export function monthlyNet(txns: Transaction[], base: string, rates: FxRates | null) {
  const map = new Map<string, number>();
  for (const t of txns) {
    const k = monthKey(t);
    map.set(k, (map.get(k) ?? 0) + convertAmount(t.amount, t.currency, base, rates));
  }
  return [...map.entries()]
    .filter(([k]) => k !== "unknown")
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, net]) => ({ month, net }));
}

export interface LadderData {
  title: string;
  unitLabel: string;
  current: string;
  nextLabel?: string;
  pct: number;
  pctToNext: number;
  tiers: { label: string; value: number; status: "passed" | "next" | "upcoming"; reached?: string }[];
}

export function coverageLadder(stats: { total: number; withInvoice: number; withRemittance: number }): LadderData {
  const linked = stats.withInvoice + stats.withRemittance;
  const pct = stats.total > 0 ? (linked / stats.total) * 100 : 0;
  const thresholds = [25, 50, 75, 100];
  let nextSet = false;
  const tiers = thresholds.map((th) => {
    if (pct >= th) return { label: `${th}%`, value: th, status: "passed" as const };
    if (!nextSet) { nextSet = true; return { label: `${th}%`, value: th, status: "next" as const }; }
    return { label: `${th}%`, value: th, status: "upcoming" as const };
  });
  const next = thresholds.find((th) => pct < th);
  return {
    title: "Document coverage",
    unitLabel: `${linked} of ${stats.total} linked`,
    current: `${Math.round(pct)}%`,
    nextLabel: next ? `${next}%` : undefined,
    pct,
    pctToNext: next ? (pct / next) * 100 : 100,
    tiers,
  };
}

export interface MonthPoint { key: string; label: string; income: number; expenses: number; net: number; }

export function monthlySeries(txns: Transaction[], base: string, rates: FxRates | null): MonthPoint[] {
  const map = new Map<string, { income: number; expenses: number }>();
  for (const t of txns) {
    const k = monthKey(t);
    if (k === "unknown") continue;
    const v = convertAmount(t.amount, t.currency, base, rates);
    const cur = map.get(k) ?? { income: 0, expenses: 0 };
    if (v >= 0) cur.income += v; else cur.expenses += v;
    map.set(k, cur);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, v]) => ({ key, label: monthLabel(key), income: v.income, expenses: v.expenses, net: v.income + v.expenses }));
}

export interface KpiData { value: string; delta: { value: string; positive: boolean } | null; sub: string; }

export function kpisFor(txns: Transaction[], base: string, rates: FxRates | null): { income: KpiData; expenses: KpiData; net: KpiData; period: string } {
  const months = monthlyNet(txns, base, rates).map((m) => m.month);
  const uniq = months;
  const cur = uniq[uniq.length - 1];
  const prev = uniq[uniq.length - 2];
  const inMonth = (k?: string) => txns.filter((t) => (/^\d{4}-\d{2}/.test(t.date) ? t.date.slice(0, 7) : "") === k);
  const curT = cur ? periodTotals(inMonth(cur), base, rates) : { income: 0, expenses: 0, net: 0 };
  const prevT = prev ? periodTotals(inMonth(prev), base, rates) : null;

  const pctDelta = (now: number, before: number | undefined): { value: string; positive: boolean } | null => {
    if (before === undefined || before === 0) return null;
    const change = ((now - before) / Math.abs(before)) * 100;
    return { value: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`, positive: change >= 0 };
  };

  return {
    income: { value: fmtAbbrev(curT.income, base), delta: pctDelta(curT.income, prevT?.income), sub: "" },
    expenses: { value: fmtAbbrev(curT.expenses, base), delta: pctDelta(curT.expenses, prevT?.expenses), sub: "" },
    net: { value: fmtAbbrev(curT.net, base), delta: pctDelta(curT.net, prevT?.net), sub: "income − expenses" },
    period: cur ? monthLabel(cur) : "—",
  };
}

export interface CategoryMonthly {
  data: Array<Record<string, string | number>>; // each row: { key, label, total, [category]: amount }
  categories: string[];                          // categories present, sorted by total desc
}

export function categoryTotals(
  txns: Transaction[],
  base: string,
  rates: FxRates | null,
  direction: "income" | "expenses",
): { name: string; amount: number; pct: number }[] {
  const isIncome = direction === "income";
  const totals = new Map<string, number>();
  for (const t of txns) {
    if (isIncome ? t.amount < 0 : t.amount >= 0) continue;
    const v = Math.abs(convertAmount(t.amount, t.currency, base, rates));
    const cat = t.categories && t.categories[0] ? t.categories[0] : "Uncategorized";
    totals.set(cat, (totals.get(cat) ?? 0) + v);
  }
  const grand = [...totals.values()].reduce((s, x) => s + x, 0);
  return [...totals.entries()]
    .map(([name, amount]) => ({ name, amount, pct: grand > 0 ? (amount / grand) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

export function topMerchants(
  txns: Transaction[],
  base: string,
  rates: FxRates | null,
  limit = 8,
): { name: string; amount: number }[] {
  const totals = new Map<string, number>();
  for (const t of txns) {
    if (t.amount >= 0) continue; // expenses only
    const name = t.merchant || t.payeeName || t.description || "Unknown";
    totals.set(name, (totals.get(name) ?? 0) + Math.abs(convertAmount(t.amount, t.currency, base, rates)));
  }
  const sorted = [...totals.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  if (sorted.length <= limit) return sorted;
  const top = sorted.slice(0, limit);
  const other = sorted.slice(limit).reduce((s, x) => s + x.amount, 0);
  return [...top, { name: "Other", amount: other }];
}

export function categoryMonthly(
  txns: Transaction[],
  base: string,
  rates: FxRates | null,
  direction: "income" | "expenses",
): CategoryMonthly {
  const isIncome = direction === "income";
  const months = new Map<string, Record<string, number>>();
  const totals = new Map<string, number>();
  for (const t of txns) {
    if (isIncome ? t.amount < 0 : t.amount >= 0) continue;
    const k = monthKey(t);
    if (k === "unknown") continue;
    const v = Math.abs(convertAmount(t.amount, t.currency, base, rates));
    const cat = t.categories && t.categories[0] ? t.categories[0] : "Uncategorized";
    const row = months.get(k) ?? {};
    row[cat] = (row[cat] ?? 0) + v;
    months.set(k, row);
    totals.set(cat, (totals.get(cat) ?? 0) + v);
  }
  const categories = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const data = [...months.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, row]) => {
      const total = Object.values(row).reduce((s, x) => s + x, 0);
      return { key, label: monthLabel(key), total, ...row };
    });
  return { data, categories };
}
