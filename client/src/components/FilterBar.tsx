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
        borderBottom: "1px solid var(--border)",
        background: "var(--card)",
      }}
    >
      <div
        style={{
          maxWidth: "var(--container-max)",
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
      >
        {leftContent}
        {leftContent && hasFilters && (
          <span
            style={{
              width: "1px",
              height: "18px",
              background: "var(--border)",
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
                    border: "1px solid var(--border)",
                    borderRadius: "9999px",
                    fontSize: "12px",
                    background: isMonthFilter(f) ? "var(--muted)" : "var(--card)",
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.02em",
                  }}
                >
                  <span
                    style={{
                      color: "var(--muted-foreground)",
                    }}
                  >
                    {f.key === "_month" ? "month" : f.key}
                  </span>
                  <span
                    style={{
                      color: "var(--foreground)",
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
                      color: "var(--muted-foreground)",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      transition:
                        "color 120ms cubic-bezier(0.22, 1, 0.36, 1), background 120ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--foreground)";
                      e.currentTarget.style.background = "var(--muted)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--muted-foreground)";
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
                color: "var(--muted-foreground)",
                padding: "5px 10px",
                borderRadius: "9999px",
                border: "1px solid transparent",
                background: "none",
                cursor: "pointer",
                transition: "color 200ms cubic-bezier(0.22, 1, 0.36, 1), border-color 200ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--foreground)";
                e.currentTarget.style.borderColor = "var(--border)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--muted-foreground)";
                e.currentTarget.style.borderColor = "transparent";
              }}
            >
              Clear all
            </button>
          </>
        )}
      </div>
    </div>
  );
}
