import { useState } from "react";
import { Card } from "./Card";
import { StatDelta } from "./StatDelta";

interface Props {
  label: string;
  value: string;
  delta?: { value: string; positive: boolean } | null;
  sub?: string;
  onClick?: () => void;
}

export function KpiTile({ label, value, delta, sub, onClick }: Props) {
  const [hovered, setHovered] = useState(false);
  return (
    <Card
      style={{
        padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.625rem",
        cursor: onClick ? "pointer" : undefined,
        boxShadow: onClick && hovered ? "var(--shadow-popover)" : undefined,
      }}
      onClick={onClick}
      onMouseEnter={onClick ? () => setHovered(true) : undefined}
      onMouseLeave={onClick ? () => setHovered(false) : undefined}
    >
      <div style={{
        fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.05em",
        textTransform: "uppercase", color: "var(--muted-foreground)",
      }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "1.5rem", fontWeight: 500,
          letterSpacing: "-0.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums",
          color: "var(--foreground)",
        }}>{value}</span>
        {delta && <StatDelta value={delta.value} positive={delta.positive} />}
      </div>
      {sub && <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{sub}</div>}
    </Card>
  );
}
