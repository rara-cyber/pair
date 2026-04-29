import { useState, useEffect } from "react";
import type { ProgressState } from "../hooks/useProgress";

export function ProgressBadge({ progress }: { progress: ProgressState | null }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (progress?.status === "done") {
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setVisible(true);
    }
  }, [progress?.status]);

  if (!progress || progress.status === "idle" || !visible) return null;

  // Only track progress on new PDFs (exclude cache hits)
  const newTotal = progress.total;
  const newProcessed = progress.processed - progress.fromCache;
  const pct = newTotal > 0 ? Math.round((newProcessed / newTotal) * 100) : 100;

  const isDone = progress.status === "done";
  const isProcessing = !isDone && newTotal > 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        transition: "opacity 1000ms cubic-bezier(0.22, 1, 0.36, 1)",
        opacity: isDone ? 0.5 : 1,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
        {isProcessing && progress.current && (
          <div
            style={{
              fontSize: "10px",
              color: "var(--color-fg-subtle)",
              fontFamily: "var(--font-mono)",
              maxWidth: "160px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={progress.current}
          >
            {progress.current}
          </div>
        )}
        <div
          style={{
            width: "128px",
            height: "6px",
            background: "var(--color-elev-2)",
            borderRadius: "9999px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: isDone ? "var(--color-accent)" : "var(--color-accent-90)",
              borderRadius: "9999px",
              transition: "width 500ms cubic-bezier(0.22, 1, 0.36, 1), background 300ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: "16px",
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            color: "var(--color-white)",
            lineHeight: 1,
          }}
        >
          {pct}%
        </div>
        <div
          style={{
            fontSize: "10px",
            color: "var(--color-fg-subtle)",
            marginTop: "2px",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          {isProcessing ? `${newProcessed}/${newTotal} new` : `${progress.matched} matched`}
        </div>
      </div>
    </div>
  );
}
