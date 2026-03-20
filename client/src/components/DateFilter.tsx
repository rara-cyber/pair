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
  ];
}

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

  const presets = buildPresets();
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
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border transition-colors cursor-pointer ${
          isActive
            ? "border-blue-600 bg-blue-950/60 text-blue-300"
            : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
        }`}
      >
        <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="12" height="11" rx="1.5" />
          <path d="M5 1v4M11 1v4M2 7h12" />
        </svg>
        <span>{label}</span>
        {isActive && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onChange(null, null); }}
            className="ml-0.5 text-zinc-500 hover:text-zinc-200 cursor-pointer leading-none"
          >
            ×
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-52 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden">
          <button
            onClick={() => { onChange(null, null); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-zinc-800 cursor-pointer ${
              !isActive ? "text-zinc-200 font-medium" : "text-zinc-400"
            }`}
          >
            All dates
          </button>

          <div className="h-px bg-zinc-800" />

          {presets.map((preset) => {
            const range = preset.getRange();
            const isSelected = activePreset?.key === preset.key;
            return (
              <button
                key={preset.key}
                onClick={() => { onChange(range.from, range.to); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-zinc-800 cursor-pointer ${
                  isSelected ? "text-blue-300 font-medium" : "text-zinc-300"
                }`}
              >
                {preset.label}
              </button>
            );
          })}

          <div className="h-px bg-zinc-800" />

          <div className="px-3 py-2.5">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Custom range</div>
            <div className="flex flex-col gap-1.5">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
              />
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
              />
              <button
                disabled={!customFrom && !customTo}
                onClick={() => { onChange(customFrom || null, customTo || null); setOpen(false); }}
                className="w-full text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded px-2 py-1.5 transition-colors cursor-pointer"
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
