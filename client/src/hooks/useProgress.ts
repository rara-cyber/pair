import { useState, useEffect, useRef } from "react";
import type { PdfLink, Transaction } from "../types";

export interface ProgressState {
  status: "idle" | "running" | "done";
  total: number;
  processed: number;
  totalWithCache: number;
  matched: number;
  apiCalls: number;
  fromCache: number;
  current: string;
}

export interface MatchEvent {
  transferWiseId: string;
  linkType: "Sales" | "Expenses";
  link: PdfLink;
}

export function useProgress(onMatch?: (event: MatchEvent) => void) {
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const onMatchRef = useRef(onMatch);
  useEffect(() => { onMatchRef.current = onMatch; }, [onMatch]);

  useEffect(() => {
    let es: EventSource;
    let retryTimer: ReturnType<typeof setTimeout>;

    function connect() {
      es = new EventSource("/api/progress");
      es.addEventListener("progress", (e) => setProgress(JSON.parse((e as MessageEvent).data)));
      es.addEventListener("match", (e) => {
        onMatchRef.current?.(JSON.parse((e as MessageEvent).data));
      });
      es.onerror = () => {
        es.close();
        retryTimer = setTimeout(connect, 3000);
      };
    }

    connect();
    return () => { es.close(); clearTimeout(retryTimer); };
  }, []);

  return progress;
}
