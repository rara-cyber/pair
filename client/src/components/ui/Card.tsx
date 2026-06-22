import type { CSSProperties, ReactNode } from "react";

interface BoxProps { children?: ReactNode; style?: CSSProperties; className?: string; }

export function Card({ children, style, className }: BoxProps) {
  return (
    <div className={className} style={{
      background: "var(--card)", color: "var(--card-foreground)",
      borderRadius: "var(--radius-xl)", boxShadow: "var(--ring-card)",
      padding: "1rem", ...style,
    }}>{children}</div>
  );
}

export function CardHeader({ children, style }: BoxProps) {
  return <div style={{ marginBottom: "0.75rem", ...style }}>{children}</div>;
}
export function CardTitle({ children, style }: BoxProps) {
  return <div style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: 500, ...style }}>{children}</div>;
}
export function CardDescription({ children, style }: BoxProps) {
  return <div style={{ fontSize: "0.875rem", color: "var(--muted-foreground)", ...style }}>{children}</div>;
}
export function CardContent({ children, style }: BoxProps) {
  return <div style={style}>{children}</div>;
}
export function CardFooter({ children, style }: BoxProps) {
  return <div style={{ marginTop: "0.75rem", ...style }}>{children}</div>;
}
