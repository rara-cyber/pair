import { RANGE_TOGGLE, rangeForKey, activePresetKey, type DateRange } from "../../lib/dateRanges";

interface Props {
  dateRange: DateRange;
  onChange: (from: string | null, to: string | null) => void;
}

export function RangeToggle({ dateRange, onChange }: Props) {
  const active = activePresetKey(dateRange);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
      {RANGE_TOGGLE.map(({ key, label }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => { const r = rangeForKey(key); onChange(r.from, r.to); }}
            style={{
              fontFamily: "var(--font-sans)", fontSize: "0.6875rem", fontWeight: 500,
              padding: "0.25rem 0.5rem", borderRadius: "var(--radius-full)", cursor: "pointer",
              border: isActive ? "1px solid transparent" : "1px solid var(--border)",
              background: isActive ? "var(--primary)" : "transparent",
              color: isActive ? "var(--primary-foreground)" : "var(--muted-foreground)",
              transition: "background 120ms ease, color 120ms ease",
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--muted)"; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
