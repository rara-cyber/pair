import type { ProgressState } from "../hooks/useProgress";

export function ProgressBar({ progress }: { progress: ProgressState | null }) {
  if (!progress || progress.status === "idle") {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: "var(--muted-foreground)" }}>
        Loading transactions...
      </div>
    );
  }

  const pending = progress.total - (progress.processed - progress.fromCache);
  const pct = progress.totalWithCache > 0
    ? Math.round((progress.processed / progress.totalWithCache) * 100)
    : 0;

  return (
    <div className="flex flex-col items-center gap-5 py-20">
      <p className="font-medium text-base" style={{ color: "var(--foreground)" }}>
        {progress.status === "done" ? "Matching complete" : "Matching documents…"}
      </p>

      {/* Progress bar */}
      <div className="w-96 rounded-full h-1.5" style={{ background: "var(--muted)" }}>
        <div
          className="h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: "var(--foreground)" }}
        />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-x-10 gap-y-1.5 text-sm text-center">
        <div style={{ color: "var(--muted-foreground)" }}>Processed</div>
        <div className="font-mono" style={{ color: "var(--foreground)" }}>
          {progress.processed} <span style={{ color: "var(--muted-foreground)" }}>/ {progress.totalWithCache}</span>
        </div>

        <div style={{ color: "var(--muted-foreground)" }}>From cache</div>
        <div className="font-mono" style={{ color: "var(--foreground)" }}>{progress.fromCache}</div>

        <div style={{ color: "var(--muted-foreground)" }}>Matched</div>
        <div className="font-mono" style={{ color: "var(--foreground)" }}>{progress.matched}</div>

        <div style={{ color: "var(--muted-foreground)" }}>API calls</div>
        <div className="font-mono" style={{ color: "var(--foreground)" }}>{progress.apiCalls}</div>

        {progress.status !== "done" && pending > 0 && (
          <>
            <div style={{ color: "var(--muted-foreground)" }}>Remaining</div>
            <div className="font-mono" style={{ color: "var(--muted-foreground)" }}>{pending}</div>
          </>
        )}
      </div>

      {/* Current file */}
      {progress.current && (
        <p className="text-xs font-mono truncate max-w-80" style={{ color: "var(--muted-foreground)" }} title={progress.current}>
          {progress.current}
        </p>
      )}
    </div>
  );
}
