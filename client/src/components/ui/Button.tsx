import type { ButtonHTMLAttributes, CSSProperties } from "react";

type Variant = "default" | "outline" | "ghost" | "destructive";
type Size = "sm" | "default" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const SIZES: Record<Size, CSSProperties> = {
  sm: { height: "1.75rem", padding: "0 0.625rem", fontSize: "var(--text-sm, 0.875rem)" },
  default: { height: "2rem", padding: "0 0.875rem", fontSize: "var(--text-sm, 0.875rem)" },
  lg: { height: "2.25rem", padding: "0 1.125rem", fontSize: "1rem" },
};

const VARIANTS: Record<Variant, CSSProperties> = {
  default: { background: "var(--primary)", color: "var(--primary-foreground)", border: "1px solid transparent" },
  outline: { background: "transparent", color: "var(--foreground)", border: "1px solid var(--border)" },
  ghost: { background: "transparent", color: "var(--foreground)", border: "1px solid transparent" },
  destructive: { background: "var(--destructive)", color: "var(--destructive-foreground)", border: "1px solid transparent" },
};

export function Button({ variant = "default", size = "default", style, onMouseDown, onMouseUp, ...rest }: Props) {
  return (
    <button
      {...rest}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
        fontFamily: "var(--font-sans)", fontWeight: 500, lineHeight: 1, whiteSpace: "nowrap",
        borderRadius: "var(--radius-lg)", cursor: "pointer",
        transition: "background 120ms ease, color 120ms ease, transform 80ms ease",
        ...SIZES[size], ...VARIANTS[variant], ...style,
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = "translateY(1px)"; onMouseDown?.(e); }}
      onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(0)"; onMouseUp?.(e); }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
    />
  );
}
