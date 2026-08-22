import { useMemo } from "react";
import { activePresetKey, labelForKey, nextRangeKey, rangeForKey } from "../lib/dateRanges";

interface Props {
  dateRange: { from: string | null; to: string | null };
  onChange: (from: string | null, to: string | null) => void;
  /** How many months the slider spans, ending with the current month. */
  months?: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Month boundaries are built from LOCAL date parts, never via
 * `new Date(...).toISOString()`. That round-trip converts local midnight to UTC
 * and rolls the date back a day in any timezone ahead of UTC — which is how the
 * old presets resolved "this month" to Jul 31 – Aug 30 in Asia/Shanghai.
 */
const firstOf = (y: number, m: number) => `${y}-${pad(m + 1)}-01`;
const lastOf = (y: number, m: number) => `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`;

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function MonthRangeSlider({ dateRange, onChange, months = 12 }: Props) {
  const stops = useMemo(() => {
    const now = new Date();
    return Array.from({ length: months }, (_, k) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - k), 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      return { y, m, from: firstOf(y, m), to: lastOf(y, m), label: MONTH_LABELS[m], year: y };
    });
  }, [months]);

  const last = stops.length - 1;

  // Map the current range back onto stop indices. An unset range means "all",
  // which we show as the full span rather than an empty selection.
  // Overlap, not containment: a preset like "3M" starts mid-month, and testing
  // whether a whole month fits inside the range would leave both end months dim
  // even though their transactions are included.
  const startIdx = useMemo(() => {
    if (!dateRange.from) return 0;
    const i = stops.findIndex((s) => s.to >= dateRange.from!);
    return i === -1 ? last : i;
  }, [dateRange.from, stops, last]);

  const endIdx = useMemo(() => {
    if (!dateRange.to) return last;
    for (let i = last; i >= 0; i--) if (stops[i].from <= dateRange.to!) return i;
    return 0;
  }, [dateRange.to, stops, last]);

  const emit = (a: number, b: number) => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    onChange(stops[lo].from, stops[hi].to);
  };

  const pct = (i: number) => (last === 0 ? 0 : (i / last) * 100);
  const fillLeft = pct(startIdx);
  const fillWidth = pct(endIdx) - pct(startIdx);

  const rangeInput: React.CSSProperties = {
    position: "absolute", left: 0, top: 0, width: "100%", height: "20px",
    appearance: "none", WebkitAppearance: "none", background: "transparent",
    margin: 0, pointerEvents: "none", outline: "none",
  };

  const linkStyle: React.CSSProperties = {
    fontSize: "0.6875rem", color: "var(--muted-foreground)", background: "none",
    border: "none", cursor: "pointer", padding: 0, fontFamily: "var(--font-sans)",
  };

  // The slider only spans 12 months, but the range can be set from elsewhere
  // (the timeframe toggle, the chart) to something outside that window — "last
  // year" reaches back further than the leftmost stop. Naming a month span the
  // handles can represent would then misstate the filter actually in effect, so
  // defer to the preset's own name whenever the range matches one.
  const preset = activePresetKey(dateRange);
  const isAll = preset === "all";
  const next = nextRangeKey(preset);
  const label = preset !== "custom"
    ? labelForKey(preset)
    : `${stops[startIdx].label} '${String(stops[startIdx].year).slice(2)} – ${stops[endIdx].label} '${String(stops[endIdx].year).slice(2)}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", minWidth: "260px", flex: "1 1 260px", maxWidth: "420px" }}>
      <style>{`
        .mrs-thumb::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none; pointer-events: auto;
          width: 14px; height: 14px; border-radius: 9999px; cursor: grab;
          background: var(--background); border: 2px solid var(--positive);
          box-shadow: var(--ring-card);
        }
        .mrs-thumb::-moz-range-thumb {
          pointer-events: auto; width: 14px; height: 14px; border-radius: 9999px;
          cursor: grab; background: var(--background); border: 2px solid var(--positive);
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.5rem" }}>
        {/* The label is the control: clicking it cycles the timeframe, which
            saves a button and keeps the row to two affordances. */}
        <button
          onClick={() => { const r = rangeForKey(next); onChange(r.from, r.to); }}
          title={`Showing ${label} · click for ${labelForKey(next)}`}
          style={{
            fontSize: "0.8125rem", fontFamily: "var(--font-mono)", color: "var(--foreground)",
            fontVariantNumeric: "tabular-nums", background: "none", border: "none",
            padding: 0, cursor: "pointer", textAlign: "left",
          }}
        >
          {label}
        </button>
        {!isAll && (
          <button onClick={() => onChange(null, null)} style={linkStyle} title="Show all dates">
            reset
          </button>
        )}
      </div>

      <div style={{ position: "relative", height: "20px" }}>
        <div style={{ position: "absolute", top: "9px", left: "7px", right: "7px", height: "3px", borderRadius: "9999px", background: "var(--muted)" }} />
        <div style={{
          position: "absolute", top: "9px", height: "3px", borderRadius: "9999px", background: "var(--positive)",
          left: `calc(7px + (100% - 14px) * ${fillLeft / 100})`,
          width: `calc((100% - 14px) * ${fillWidth / 100})`,
        }} />
        <input
          className="mrs-thumb" type="range" min={0} max={last} step={1} value={startIdx}
          onChange={(e) => emit(Number(e.target.value), endIdx)}
          style={rangeInput} aria-label="Range start month"
        />
        <input
          className="mrs-thumb" type="range" min={0} max={last} step={1} value={endIdx}
          onChange={(e) => emit(startIdx, Number(e.target.value))}
          style={rangeInput} aria-label="Range end month"
        />
      </div>

      {/* Labels are positioned at the thumb coordinates, not spread with
          space-between: the track is inset 7px at each end (half a thumb), so
          an evenly-spread row drifts up to ~4px out at the edges and the letters
          stop lining up with the months they mark. */}
      <div style={{ position: "relative", height: "0.75rem" }}>
        {stops.map((s, i) => (
          <span
            key={`${s.y}-${s.m}`}
            style={{
              position: "absolute",
              left: `calc(7px + (100% - 14px) * ${last === 0 ? 0 : i / last})`,
              transform: "translateX(-50%)",
              fontSize: "0.5625rem",
              fontFamily: "var(--font-mono)",
              color: "var(--muted-foreground)",
              opacity: i >= startIdx && i <= endIdx ? 1 : 0.4,
            }}
          >
            {s.label[0]}
          </span>
        ))}
      </div>
    </div>
  );
}
