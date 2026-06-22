import type { ReactNode, CSSProperties } from "react";

interface Props { children: ReactNode; variant?: "default" | "outline"; style?: CSSProperties; }

export function Badge({ children, variant = "outline", style }: Props) {
  const base: CSSProperties = variant === "default"
    ? { background: "var(--secondary)", color: "var(--secondary-foreground)", border: "1px solid transparent" }
    : { background: "transparent", color: "var(--muted-foreground)", border: "1px solid var(--border)" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.25rem",
      fontFamily: "var(--font-sans)", fontSize: "0.75rem", fontWeight: 500, lineHeight: 1,
      padding: "0.1875rem 0.5rem", borderRadius: "var(--radius-full)", whiteSpace: "nowrap",
      ...base, ...style,
    }}>{children}</span>
  );
}
