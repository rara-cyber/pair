import type { ReactNode } from "react";
import type { Filter } from "../types";

interface Props {
  filters: Filter[];
  onRemove: (index: number) => void;
  onClear: () => void;
  leftContent?: ReactNode;
}

export function FilterBar({ filters, onRemove, onClear, leftContent }: Props) {
  const hasFilters = filters.length > 0;
  if (!leftContent && !hasFilters) return null;

  const isMonthFilter = (filter: Filter) => filter.key === "_month";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "14px 24px",
        borderBottom: "1px solid var(--color-border-dim)",
        background: "rgba(18,20,24,0.4)",
      }}
    >
      {leftContent}
      {leftContent && hasFilters && (
        <span
          style={{
            width: "1px",
            height: "18px",
            background: "var(--color-border-dim)",
          }}
        />
      )}
      {hasFilters && (
        <>
          <div style={{ display: "inline-flex", gap: "8px", flexWrap: "wrap" }}>
            {filters.map((f, i) => (
              <span
                key={i}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "5px 8px 5px 12px",
                  border: isMonthFilter(f)
                    ? "1px solid var(--color-accent-25)"
                    : "1px solid var(--color-border-dim)",
                  borderRadius: "9999px",
                  fontSize: "12px",
                  background: isMonthFilter(f)
                    ? "var(--color-accent-10)"
                    : "var(--color-elev-1)",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.02em",
                }}
              >
                <span
                  style={{
                    color: "var(--color-fg-subtle)",
                  }}
                >
                  {f.key === "_month" ? "month" : f.key}
                </span>
                <span
                  style={{
                    color: isMonthFilter(f)
                    ? "var(--color-accent)"
                    : "var(--color-white)",
                  }}
                >
                  {f.value}
                </span>
                <button
                  onClick={() => onRemove(i)}
                  style={{
                    width: "16px",
                    height: "16px",
                    display: "grid",
                    placeItems: "center",
                    borderRadius: "9999px",
                    color: "var(--color-fg-subtle)",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    transition:
                      "color 120ms cubic-bezier(0.22, 1, 0.36, 1), background 120ms cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--color-white)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--color-fg-subtle)";
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <button
            onClick={onClear}
            style={{
              marginLeft: "4px",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: "var(--color-fg-subtle)",
              padding: "5px 10px",
              borderRadius: "9999px",
              border: "1px solid transparent",
              background: "none",
              cursor: "pointer",
              transition: "color 200ms cubic-bezier(0.22, 1, 0.36, 1), border-color 200ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-white)";
              e.currentTarget.style.borderColor = "var(--color-border-dim)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--color-fg-subtle)";
              e.currentTarget.style.borderColor = "transparent";
            }}
          >
            Clear all
          </button>
        </>
      )}
    </div>
  );
}
