export interface DateRange { from: string | null; to: string | null; }

const fmt = (d: Date) => d.toISOString().slice(0, 10);

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

// Curated, short-labeled set for the on-chart toggle (no "last 6").
export const RANGE_TOGGLE: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "last-3", label: "3M" },
  { key: "this-year", label: "This year" },
  { key: "last-year", label: "Last year" },
];

// Order the chart click cycles through.
export const RANGE_CYCLE = ["all", "this-month", "last-month", "last-3", "this-year", "last-year"];

export function nextRangeKey(current: string): string {
  const i = RANGE_CYCLE.indexOf(current);
  return RANGE_CYCLE[(i + 1) % RANGE_CYCLE.length];
}

export function labelForKey(key: string): string {
  const found = RANGE_TOGGLE.find((r) => r.key === key);
  return found ? found.label : "Custom";
}
