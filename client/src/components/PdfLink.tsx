import { useState } from "react";
import type { PdfLink as PdfLinkType } from "../types";

interface Props {
  links?: PdfLinkType[];
  onDelete?: (filename: string, type: "Sales" | "Expenses") => void;
}

const METHOD_COLORS: Record<string, string> = {
  reference: "var(--color-accent)",
  "amount+date": "var(--color-warn)",
  "amount+month": "#FF8C42",
  ai: "var(--color-accent)",
};

function MethodLabel({ method }: { method: string }) {
  const label = method === "reference" ? "ref" : method === "amount+date" ? "amt" : method === "ai" ? "ai" : "~amt";
  return (
    <span
      style={{
        fontSize: "9px",
        fontWeight: 500,
        color: METHOD_COLORS[method] ?? "var(--color-fg-subtle)",
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
      title={`Matched by: ${method}`}
    >
      {label}
    </span>
  );
}

export function PdfLink({ links, onDelete }: Props) {
  const [confirming, setConfirming] = useState<string | null>(null);

  if (!links || links.length === 0) {
    return (
      <span
        style={{
          color: "var(--color-fg-subtle)",
          fontSize: "12px",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.04em",
        }}
      >
        —
      </span>
    );
  }

  return (
    <span style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {links.map((link, i) => {
        const isSales = link.linkType === "Sales";
        return (
          <span
            key={i}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 8px",
              borderRadius: "6px",
              border: isSales ? "1px solid var(--color-accent-25)" : "1px solid var(--color-border-dim)",
              background: "var(--color-elev-2)",
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.02em",
              transition: "background 120ms cubic-bezier(0.22, 1, 0.36, 1), border-color 120ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
            onMouseEnter={(e) => {
              if (!confirming) {
                e.currentTarget.style.background = "var(--color-elev-1)";
                if (isSales) {
                  e.currentTarget.style.borderColor = "var(--color-accent-25)";
                } else {
                  e.currentTarget.style.borderColor = "var(--color-border-dim)";
                }
              }
            }}
            onMouseLeave={(e) => {
              if (!confirming) {
                e.currentTarget.style.background = "var(--color-elev-2)";
                if (isSales) {
                  e.currentTarget.style.borderColor = "var(--color-accent-25)";
                } else {
                  e.currentTarget.style.borderColor = "var(--color-border-dim)";
                }
              }
            }}
          >
            <span
              style={{
                fontSize: "8px",
                fontWeight: 600,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: isSales ? "var(--color-accent)" : "var(--color-danger)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {isSales ? "Sales" : "Expense"}
            </span>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--color-fg)",
                textDecoration: "none",
                maxWidth: "140px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                transition: "color 120ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--color-accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--color-fg)";
              }}
              title={link.filename}
            >
              {link.filename}
            </a>
            {link.matchMethod && <MethodLabel method={link.matchMethod} />}

            {onDelete && confirming !== link.filename && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirming(link.filename);
                }}
                style={{
                  opacity: 0,
                  marginLeft: "2px",
                  color: "var(--color-fg-subtle)",
                  fontSize: "10px",
                  lineHeight: 1,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  padding: "2px",
                  transition: "opacity 120ms cubic-bezier(0.22, 1, 0.36, 1), color 120ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "1";
                  e.currentTarget.style.color = "var(--color-danger)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "";
                  e.currentTarget.style.color = "var(--color-fg-subtle)";
                }}
                title="Remove link"
              >
                ✕
              </button>
            )}

            {onDelete && confirming === link.filename && (
              <span style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "4px" }}>
                <span style={{ fontSize: "10px", color: "var(--color-fg-subtle)" }}>Remove?</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(link.filename, link.linkType ?? "Expenses");
                    setConfirming(null);
                  }}
                  style={{
                    fontSize: "10px",
                    color: "var(--color-danger)",
                    fontWeight: 500,
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    padding: "2px 4px",
                    transition: "color 120ms cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#FF6B6B";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--color-danger)";
                  }}
                >
                  Yes
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirming(null);
                  }}
                  style={{
                    fontSize: "10px",
                    color: "var(--color-fg-subtle)",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    padding: "2px 4px",
                    transition: "color 120ms cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--color-fg)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--color-fg-subtle)";
                  }}
                >
                  No
                </button>
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
