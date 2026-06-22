export type TierStatus = "passed" | "next" | "upcoming";
export interface Tier { label: string; value: number; status: TierStatus; reached?: string; }

interface Props {
  title: string;
  unitLabel: string;
  current: string;
  nextLabel?: string;
  pct: number;          // absolute progress 0..100 (drives the green fill)
  pctToNext?: number;   // % toward next tier (header text only)
  tiers: Tier[];
}

export function MilestoneLadder({ title, unitLabel, current, nextLabel, pct, pctToNext, tiers }: Props) {
  const fill = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>{title}</span>
          {unitLabel && (
            <span style={{ fontSize: "var(--text-2xs)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)", color: "var(--muted-foreground)" }}>{unitLabel}</span>
          )}
        </div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--muted-foreground)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, color: "var(--foreground)" }}>{current}</span>
          {nextLabel != null && pctToNext != null && <span> · {Math.round(pctToNext)}% to {nextLabel}</span>}
        </div>
      </div>

      <div style={{ position: "relative", height: "42px" }}>
        {/* grey track */}
        <div style={{ position: "absolute", top: "6px", left: "7px", right: "7px", height: "3px", borderRadius: "9999px", background: "var(--muted)" }} />
        {/* green fill */}
        <div style={{ position: "absolute", top: "6px", left: "7px", height: "3px", borderRadius: "9999px", background: "var(--positive)", width: `calc((100% - 14px) * ${fill / 100})` }} />
        {/* dots + labels, positioned by value along the track */}
        {tiers.map((t, i) => {
          const passed = t.status === "passed";
          const next = t.status === "next";
          const dotBg = passed ? "var(--positive)" : next ? "var(--background)" : "var(--muted)";
          const dotBorder = passed || next ? "var(--positive)" : "var(--border)";
          const pos = Math.max(0, Math.min(100, t.value));
          const left = `calc(7px + (100% - 14px) * ${pos / 100})`;
          const sub = passed && t.reached ? t.reached : next ? "next" : "";
          return (
            <div key={i}>
              <span style={{ position: "absolute", top: "0px", left, transform: "translateX(-50%)", width: "14px", height: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {next && <span style={{ position: "absolute", width: "14px", height: "14px", borderRadius: "9999px", background: "color-mix(in oklab, var(--positive) 40%, transparent)", animation: "ds-ping 2s cubic-bezier(0,0,0.2,1) infinite" }} />}
                <span style={{ position: "relative", width: "14px", height: "14px", borderRadius: "9999px", border: `2px solid ${dotBorder}`, background: dotBg, boxSizing: "border-box" }} />
              </span>
              <span style={{ position: "absolute", top: "19px", left, transform: "translateX(-50%)", whiteSpace: "nowrap", fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: t.status === "upcoming" ? "var(--muted-foreground)" : "var(--foreground)", fontWeight: t.status === "upcoming" ? 400 : 500 }}>{t.label}</span>
              {sub && <span style={{ position: "absolute", top: "31px", left, transform: "translateX(-50%)", whiteSpace: "nowrap", fontSize: "0.5625rem", lineHeight: "0.75rem", color: "var(--muted-foreground)" }}>{sub}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
