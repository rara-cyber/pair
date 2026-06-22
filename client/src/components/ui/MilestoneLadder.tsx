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
  const pct = Math.max(0, Math.min(100, pctToNext));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.5rem" }}>
        <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--foreground)" }}>{title}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--muted-foreground)", fontVariantNumeric: "tabular-nums" }}>
          <span style={{ color: "var(--foreground)" }}>{current}</span>
          <span> · {unitLabel}</span>
          {nextLabel && <span> → {nextLabel}</span>}
        </div>
      </div>

      {/* progress track */}
      <div style={{ height: "6px", borderRadius: "var(--radius-full)", background: "var(--muted)", overflow: "hidden", marginBottom: "0.75rem" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "var(--positive)", borderRadius: "var(--radius-full)", transition: "width 200ms ease" }} />
      </div>

      {/* tier dots */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
        {tiers.map((t, i) => {
          const dotColor = t.status === "upcoming" ? "var(--border)" : "var(--foreground)";
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem", flex: 1, minWidth: 0 }}>
              <span style={{ position: "relative", width: "10px", height: "10px", display: "grid", placeItems: "center" }}>
                {t.status === "next" && (
                  <span style={{ position: "absolute", inset: 0, borderRadius: "var(--radius-full)", background: "color-mix(in oklab, var(--positive) 60%, transparent)", animation: "ds-ping 2s cubic-bezier(0,0,0.2,1) infinite" }} />
                )}
                <span style={{ width: "8px", height: "8px", borderRadius: "var(--radius-full)", background: t.status === "next" ? "var(--positive)" : dotColor, position: "relative" }} />
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontVariantNumeric: "tabular-nums", color: t.status === "upcoming" ? "var(--muted-foreground)" : "var(--foreground)", textAlign: "center" }}>{t.label}</span>
              {t.reached && <span style={{ fontSize: "0.625rem", color: "var(--muted-foreground)", textAlign: "center" }}>{t.reached}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
