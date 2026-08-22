export interface DateRange { from: string | null; to: string | null; }

// Format from LOCAL date parts. `toISOString()` converts local midnight to UTC,
// which rolls the date back a day in any timezone ahead of UTC — in
// Asia/Shanghai that made "this month" resolve to Jul 31 – Aug 30, pulling a
// neighbouring month's transactions into every preset.
const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function buildPresets(): { key: string; label: string; getRange: () => DateRange }[] {
  const today = new Date();
  return [
    { key: "this-month", label: "This month", getRange: () => ({ from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0)) }) },
    { key: "last-month", label: "Last month", getRange: () => ({ from: fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1)), to: fmt(new Date(today.getFullYear(), today.getMonth(), 0)) }) },
    { key: "last-3", label: "Last 3 months", getRange: () => ({ from: fmt(new Date(today.getFullYear(), today.getMonth() - 3, today.getDate())), to: fmt(today) }) },
    { key: "last-6", label: "Last 6 months", getRange: () => ({ from: fmt(new Date(today.getFullYear(), today.getMonth() - 6, today.getDate())), to: fmt(today) }) },
    { key: "this-year", label: "This year", getRange: () => ({ from: fmt(new Date(today.getFullYear(), 0, 1)), to: fmt(new Date(today.getFullYear(), 11, 31)) }) },
    { key: "last-year", label: "Last year", getRange: () => ({ from: fmt(new Date(today.getFullYear() - 1, 0, 1)), to: fmt(new Date(today.getFullYear() - 1, 11, 31)) }) },
  ];
}

export const DATE_PRESETS = buildPresets();

export function activePresetKey(dr: DateRange): string {
  if (!dr.from && !dr.to) return "all";
  const p = DATE_PRESETS.find((p) => { const r = p.getRange(); return r.from === dr.from && r.to === dr.to; });
  return p ? p.key : "custom";
}

export function rangeForKey(key: string): DateRange {
  if (key === "all") return { from: null, to: null };
  const p = DATE_PRESETS.find((p) => p.key === key);
  return p ? p.getRange() : { from: null, to: null };
}

// Curated, short-labeled set for the on-chart toggle and the timeframe button.
// Must cover every key in RANGE_CYCLE or the toggle renders "Custom".
export const RANGE_TOGGLE: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "last-3", label: "3M" },
  { key: "last-6", label: "6M" },
  { key: "this-year", label: "This year" },
  { key: "last-year", label: "Last year" },
];

// Order the chart click and the timeframe toggle cycle through.
// Starts at "this-year" because that is the app's default range.
export const RANGE_CYCLE = ["this-year", "last-month", "last-3", "last-6", "last-year", "this-month", "all"];

export function nextRangeKey(current: string): string {
  const i = RANGE_CYCLE.indexOf(current);
  return RANGE_CYCLE[(i + 1) % RANGE_CYCLE.length];
}

export function labelForKey(key: string): string {
  const found = RANGE_TOGGLE.find((r) => r.key === key);
  return found ? found.label : "Custom";
}
