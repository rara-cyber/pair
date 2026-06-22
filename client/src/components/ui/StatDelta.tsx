interface Props { value: string; positive: boolean; }

export function StatDelta({ value, positive }: Props) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.1875rem",
      fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 500,
      fontVariantNumeric: "tabular-nums",
      color: positive ? "var(--positive-fg)" : "var(--negative-fg)",
    }}>
      <span aria-hidden style={{ fontSize: "0.625rem" }}>{positive ? "▲" : "▼"}</span>
      {value}
    </span>
  );
}
