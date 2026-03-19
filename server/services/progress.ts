import { EventEmitter } from "events";

export interface ProgressState {
  status: "idle" | "running" | "done";
  total: number;       // PDFs to process via AI (excludes cache hits)
  processed: number;   // PDFs processed so far (including cache)
  totalWithCache: number; // total PDFs including cache hits
  matched: number;     // successful matches
  apiCalls: number;    // LLM API calls made this session
  fromCache: number;   // matches loaded from DB (no API call needed)
  current: string;     // filename currently being processed
}

export const progressEmitter = new EventEmitter();
progressEmitter.setMaxListeners(100);

export let currentProgress: ProgressState = {
  status: "idle",
  total: 0,
  processed: 0,
  totalWithCache: 0,
  matched: 0,
  apiCalls: 0,
  fromCache: 0,
  current: "",
};

export function initProgress(totalPdfs: number, fromCache: number) {
  currentProgress = {
    status: "running",
    total: totalPdfs,
    processed: fromCache,
    totalWithCache: totalPdfs + fromCache,
    matched: 0,
    apiCalls: 0,
    fromCache,
    current: "",
  };
  progressEmitter.emit("update", currentProgress);
}

export function updateProgress(patch: Partial<Omit<ProgressState, "status">>) {
  currentProgress = { ...currentProgress, ...patch };
  progressEmitter.emit("update", currentProgress);
}

export function finishProgress() {
  currentProgress = { ...currentProgress, status: "done", current: "" };
  progressEmitter.emit("update", currentProgress);
}

// Emit a single matched transaction so the client can update its row live
export function emitMatch(transferWiseId: string, linkType: "Sales" | "Expenses", link: {
  filename: string; month: string; url: string; matchMethod?: string; linkType?: string;
}) {
  progressEmitter.emit("match", { transferWiseId, linkType, link });
}
