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
    <div className={`flex items-center gap-3 transition-opacity duration-1000 ${isDone ? "opacity-50" : ""}`}>
      <div className="flex flex-col gap-1 items-end">
        {isProcessing && progress.current && (
          <div className="text-[10px] text-zinc-400 truncate max-w-[160px]" title={progress.current}>
            {progress.current}
          </div>
        )}
        <div className="w-32 bg-zinc-800 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${isDone ? "bg-emerald-600" : "bg-blue-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold tabular-nums text-zinc-100 leading-none">{pct}%</div>
        <div className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wide">
          {isProcessing ? `${newProcessed}/${newTotal} new` : `${progress.matched} matched`}
        </div>
      </div>
    </div>
  );
}
