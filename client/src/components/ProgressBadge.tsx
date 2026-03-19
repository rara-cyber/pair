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

  const pct = progress.totalWithCache > 0
    ? Math.round((progress.processed / progress.totalWithCache) * 100)
    : 0;

  const isDone = progress.status === "done";

  return (
    <div className={`flex items-center gap-3 transition-opacity duration-1000 ${isDone ? "opacity-50" : ""}`}>
      <div className="w-16 bg-zinc-800 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${isDone ? "bg-emerald-600" : "bg-blue-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-center">
        <div className="text-lg font-bold tabular-nums text-zinc-100 leading-none">{pct}%</div>
        <div className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wide">
          {progress.matched}/{progress.totalWithCache}
        </div>
      </div>
    </div>
  );
}
