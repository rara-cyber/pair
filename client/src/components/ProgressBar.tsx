import type { ProgressState } from "../hooks/useProgress";

export function ProgressBar({ progress }: { progress: ProgressState | null }) {
  if (!progress || progress.status === "idle") {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-400">
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
      <p className="text-zinc-300 font-medium text-base">
        {progress.status === "done" ? "Matching complete" : "Matching documents…"}
      </p>

      {/* Progress bar */}
      <div className="w-96 bg-zinc-800 rounded-full h-1.5">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-x-10 gap-y-1.5 text-sm text-center">
        <div className="text-zinc-500">Processed</div>
        <div className="text-zinc-200 font-mono">
          {progress.processed} <span className="text-zinc-600">/ {progress.totalWithCache}</span>
        </div>

        <div className="text-zinc-500">From cache</div>
        <div className="text-zinc-200 font-mono">{progress.fromCache}</div>

        <div className="text-zinc-500">Matched</div>
        <div className="text-emerald-400 font-mono">{progress.matched}</div>

        <div className="text-zinc-500">API calls</div>
        <div className="text-blue-400 font-mono">{progress.apiCalls}</div>

        {progress.status !== "done" && pending > 0 && (
          <>
            <div className="text-zinc-500">Remaining</div>
            <div className="text-zinc-400 font-mono">{pending}</div>
          </>
        )}
      </div>

      {/* Current file */}
      {progress.current && (
        <p className="text-zinc-600 text-xs font-mono truncate max-w-80" title={progress.current}>
          {progress.current}
        </p>
      )}
    </div>
  );
}
