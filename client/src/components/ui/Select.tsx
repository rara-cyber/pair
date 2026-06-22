import type { SelectHTMLAttributes, ReactNode } from "react";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
}

export function Select({ children, style, onFocus, onBlur, ...rest }: Props) {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", maxWidth: "100%" }}>
      <select
        {...rest}
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          fontFamily: "var(--font-sans)",
          fontSize: "0.75rem",
          background: "var(--card)",
          color: "var(--foreground)",
          border: "1px solid var(--input)",
          borderRadius: "var(--radius-lg)",
          height: "2rem",
          padding: "0 1.75rem 0 0.625rem",
          maxWidth: "100%",
          textOverflow: "ellipsis",
          cursor: "pointer",
          outline: "none",
          transition: "border-color 120ms ease, box-shadow 120ms ease",
          ...style,
        }}
        onFocus={(e) => { e.currentTarget.style.boxShadow = "var(--ring-focus)"; e.currentTarget.style.borderColor = "var(--ring)"; onFocus?.(e); }}
        onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "var(--input)"; onBlur?.(e); }}
      >
        {children}
      </select>
      <svg
        width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ position: "absolute", right: "0.5rem", pointerEvents: "none" }}
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </span>
  );
}
