export type TierStatus = "passed" | "next" | "upcoming";
export interface Tier { label: string; status: TierStatus; reached?: string; }

interface Props {
  title: string;
  unitLabel: string;
  current: string;
  nextLabel?: string;
  pctToNext: number; // 0..100
  tiers: Tier[];
}

export function MilestoneLadder({ title, unitLabel, current, nextLabel, pctToNext, tiers }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontFamily: "var(--font-sans)" }}>
      <style>{`@keyframes ds-ping{75%,100%{transform:scale(2);opacity:0}}`}</style>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>{title}</span>
          {unitLabel && (
            <span style={{ fontSize: "var(--text-2xs)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)", color: "var(--muted-foreground)" }}>{unitLabel}</span>
          )}
        </div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--muted-foreground)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, color: "var(--foreground)" }}>{current}</span>
          {nextLabel != null && <span> · {Math.round(pctToNext ?? 0)}% to {nextLabel}</span>}
        </div>
      </div>

      <div style={{ position: "relative", padding: "0 0.25rem" }}>
        <div style={{ position: "absolute", top: "7px", left: "0.5rem", right: "0.5rem", height: "1px", background: "var(--border)" }} />
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between" }}>
          {tiers.map((t, i) => {
            const isFirst = i === 0;
            const isLast = i === tiers.length - 1;
            const passed = t.status === "passed";
            const next = t.status === "next";
            const dotBg = passed ? "var(--positive)" : next ? "var(--background)" : "var(--muted)";
            const dotBorder = passed || next ? "var(--positive)" : "var(--border)";
            return (
              <div key={i} style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: isFirst ? "flex-start" : isLast ? "flex-end" : "center", gap: "0.25rem", textAlign: "center" }}>
                <span style={{ position: "relative", display: "flex", width: "14px", height: "14px", alignItems: "center", justifyContent: "center" }}>
                  {next && (
                    <span style={{ position: "absolute", width: "14px", height: "14px", borderRadius: "9999px", background: "color-mix(in oklab, var(--positive) 40%, transparent)", animation: "ds-ping 2s cubic-bezier(0,0,0.2,1) infinite" }} />
                  )}
                  <span style={{ position: "relative", width: "14px", height: "14px", borderRadius: "9999px", border: `2px solid ${dotBorder}`, background: dotBg, boxSizing: "border-box" }} />
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: t.status === "upcoming" ? "var(--muted-foreground)" : "var(--foreground)", fontWeight: t.status === "upcoming" ? 400 : 500 }}>{t.label}</span>
                <span style={{ height: "0.75rem", fontSize: "0.5625rem", lineHeight: "0.75rem", color: "var(--muted-foreground)" }}>{passed && t.reached ? t.reached : next ? "next" : ""}</span>
              </div>
            );
          })}
        </div>
      </div>

      {nextLabel != null && (
        <div style={{ height: "0.25rem", width: "100%", overflow: "hidden", borderRadius: "9999px", background: "var(--muted)" }}>
          <div style={{ height: "100%", borderRadius: "9999px", background: "var(--positive)", width: `${Math.min(100, pctToNext ?? 0)}%` }} />
        </div>
      )}
    </div>
  );
}
