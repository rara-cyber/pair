import { useState, useRef, useEffect } from "react";

interface DateRange {
  from: string | null;
  to: string | null;
}

interface Props {
  dateRange: DateRange;
  onChange: (from: string | null, to: string | null) => void;
}

interface Preset {
  key: string;
  label: string;
  getRange: () => DateRange;
}

function buildPresets(): Preset[] {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  return [
    {
      key: "this-month",
      label: "This month",
      getRange: () => ({
        from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)),
        to: fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
      }),
    },
    {
      key: "last-month",
      label: "Last month",
      getRange: () => ({
        from: fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        to: fmt(new Date(today.getFullYear(), today.getMonth(), 0)),
      }),
    },
    {
      key: "last-3",
      label: "Last 3 months",
      getRange: () => ({
        from: fmt(new Date(today.getFullYear(), today.getMonth() - 3, today.getDate())),
        to: fmt(today),
      }),
    },
    {
      key: "last-6",
      label: "Last 6 months",
      getRange: () => ({
        from: fmt(new Date(today.getFullYear(), today.getMonth() - 6, today.getDate())),
        to: fmt(today),
      }),
    },
    {
      key: "this-year",
      label: "This year",
      getRange: () => ({
        from: fmt(new Date(today.getFullYear(), 0, 1)),
        to: fmt(new Date(today.getFullYear(), 11, 31)),
      }),
    },
    {
      key: "last-year",
      label: "Last year",
      getRange: () => ({
        from: fmt(new Date(today.getFullYear() - 1, 0, 1)),
        to: fmt(new Date(today.getFullYear() - 1, 11, 31)),
      }),
    },
  ];
}

const PRESETS = buildPresets();

export function DateFilter({ dateRange, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(dateRange.from ?? "");
  const [customTo, setCustomTo] = useState(dateRange.to ?? "");
  const ref = useRef<HTMLDivElement>(null);

  // Sync custom inputs when dateRange changes externally (e.g. clear)
  useEffect(() => {
    setCustomFrom(dateRange.from ?? "");
    setCustomTo(dateRange.to ?? "");
  }, [dateRange.from, dateRange.to]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const presets = PRESETS;
  const isActive = dateRange.from !== null || dateRange.to !== null;

  const activePreset = presets.find((p) => {
    const r = p.getRange();
    return r.from === dateRange.from && r.to === dateRange.to;
  });

  let label = "All dates";
  if (activePreset) {
    label = activePreset.label;
  } else if (isActive) {
    label = [dateRange.from, dateRange.to].filter(Boolean).join(" → ");
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
          fontSize: "0.75rem",
          padding: "0 0.625rem",
          height: "2rem",
          borderRadius: "var(--radius-lg)",
          border: isActive ? "1px solid var(--border)" : "1px solid var(--input)",
          background: isActive ? "var(--secondary)" : "var(--card)",
          color: isActive ? "var(--secondary-foreground)" : "var(--muted-foreground)",
          cursor: "pointer",
          transition: "background 120ms ease, color 120ms ease, border-color 120ms ease",
        }}
      >
        <svg style={{ width: "0.75rem", height: "0.75rem", flexShrink: 0 }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="12" height="11" rx="1.5" />
          <path d="M5 1v4M11 1v4M2 7h12" />
        </svg>
        <span>{label}</span>
        {isActive && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onChange(null, null); }}
            style={{ marginLeft: "0.125rem", color: "var(--muted-foreground)", cursor: "pointer", lineHeight: 1 }}
          >
            ×
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 50,
            width: "13rem",
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-popover)",
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => { onChange(null, null); setOpen(false); }}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "0.5rem 0.75rem",
              fontSize: "0.75rem",
              background: "transparent",
              border: "none",
              color: !isActive ? "var(--foreground)" : "var(--muted-foreground)",
              fontWeight: !isActive ? 500 : 400,
              cursor: "pointer",
              transition: "background 80ms ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--muted)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            All dates
          </button>

          <div style={{ height: "1px", background: "var(--border)" }} />

          {presets.map((preset) => {
            const range = preset.getRange();
            const isSelected = activePreset?.key === preset.key;
            return (
              <button
                key={preset.key}
                onClick={() => { onChange(range.from, range.to); setOpen(false); }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.75rem",
                  background: isSelected ? "var(--secondary)" : "transparent",
                  border: "none",
                  color: isSelected ? "var(--secondary-foreground)" : "var(--foreground)",
                  fontWeight: isSelected ? 500 : 400,
                  cursor: "pointer",
                  transition: "background 80ms ease",
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--muted)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? "var(--secondary)" : "transparent"; }}
              >
                {preset.label}
              </button>
            );
          })}

          <div style={{ height: "1px", background: "var(--border)" }} />

          <div style={{ padding: "0.625rem 0.75rem" }}>
            <div style={{ fontSize: "0.625rem", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              Custom range
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                style={{
                  width: "100%",
                  background: "var(--muted)",
                  border: "1px solid var(--input)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.25rem 0.5rem",
                  fontSize: "0.75rem",
                  color: "var(--foreground)",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "box-shadow 120ms ease",
                }}
                onFocus={(e) => { e.currentTarget.style.boxShadow = "var(--ring-focus)"; }}
                onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
              />
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                style={{
                  width: "100%",
                  background: "var(--muted)",
                  border: "1px solid var(--input)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.25rem 0.5rem",
                  fontSize: "0.75rem",
                  color: "var(--foreground)",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "box-shadow 120ms ease",
                }}
                onFocus={(e) => { e.currentTarget.style.boxShadow = "var(--ring-focus)"; }}
                onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
              />
              <button
                disabled={!customFrom && !customTo}
                onClick={() => { onChange(customFrom || null, customTo || null); setOpen(false); }}
                style={{
                  width: "100%",
                  fontSize: "0.75rem",
                  background: "var(--foreground)",
                  color: "var(--background)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.375rem 0.5rem",
                  border: "none",
                  cursor: !customFrom && !customTo ? "not-allowed" : "pointer",
                  opacity: !customFrom && !customTo ? 0.4 : 1,
                  transition: "opacity 120ms ease",
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
