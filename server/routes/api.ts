import { Router, type Request, type Response } from "express";
import { join, basename } from "path";
import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync, statSync } from "fs";
import multer from "multer";
import { parseAllCsvs } from "../services/csvParser";
import { indexAllPdfs } from "../services/pdfIndexer";
import { aiMatchTransactions, getModel, setModel, AVAILABLE_MODELS } from "../services/aiMatcher";
import { deleteMatch, loadAllMatches, saveMatch } from "../services/db";
import { progressEmitter, currentProgress, emitMatch } from "../services/progress";
import { extractPdfData } from "../services/pdfExtractor";
import { readdirSync } from "fs";
import type { Transaction } from "../services/csvParser";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const router = Router();

const DATA_DIR = join(__dirname, "../../data");

let cachedData: {
  transactions: Transaction[];
  stats: { total: number; withInvoice: number; withRemittance: number };
} | null = null;

let loading: Promise<void> | null = null;

async function loadData(forceRematch = false) {
  const transactions = parseAllCsvs();

  // On first load, set empty state immediately so the table can render while matching runs.
  // On subsequent loads, keep existing cached data to avoid wiping visible links.
  if (!cachedData) {
    cachedData = {
      transactions: transactions.map((tx) => ({ ...tx, invoiceLinks: [], remittanceLinks: [] })),
      stats: { total: transactions.length, withInvoice: 0, withRemittance: 0 },
    };
  }

  const index = await indexAllPdfs(DATA_DIR);
  const matched = await aiMatchTransactions(transactions, index, DATA_DIR, forceRematch);

  cachedData = {
    transactions: matched,
    stats: {
      total: matched.length,
      withInvoice: matched.filter((t) => t.invoiceLinks && t.invoiceLinks.length > 0).length,
      withRemittance: matched.filter((t) => t.remittanceLinks && t.remittanceLinks.length > 0).length,
    },
  };
}

router.get("/progress", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendProgress = (data: object) => res.write(`event: progress\ndata: ${JSON.stringify(data)}\n\n`);
  const sendMatch = (data: object) => res.write(`event: match\ndata: ${JSON.stringify(data)}\n\n`);

  sendProgress(currentProgress);

  progressEmitter.on("update", sendProgress);
  progressEmitter.on("match", sendMatch);
  req.on("close", () => {
    progressEmitter.off("update", sendProgress);
    progressEmitter.off("match", sendMatch);
  });
});

router.get("/model", (_req: Request, res: Response) => {
  res.json({ current: getModel(), available: AVAILABLE_MODELS });
});

router.post("/model", (req: Request, res: Response) => {
  const { model } = req.body as { model: string };
  const valid = AVAILABLE_MODELS.find((m) => m.id === model);
  if (!valid) { res.status(400).json({ error: "Unknown model" }); return; }
  setModel(model as ReturnType<typeof getModel>);
  res.json({ current: getModel() });
});

router.get("/transactions", async (req: Request, res: Response) => {
  const rematch = req.query.rematch === "true";
  // Always check for new dump files unless a load is already in progress
  if (!loading) {
    loading = loadData(rematch).finally(() => { loading = null; });
  }
  if (!cachedData) await loading;
  res.json(cachedData);
});

router.post("/match-pdf", upload.single("file"), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const dumpDir = join(DATA_DIR, "document-dump");
  mkdirSync(dumpDir, { recursive: true });
  const safeFilename = basename(req.file.originalname);
  writeFileSync(join(dumpDir, safeFilename), req.file.buffer);

  // If this file was previously marked unmatched, clear it so the matcher retries it
  const unmatchedPath = join(DATA_DIR, "document-unmatched", safeFilename);
  if (existsSync(unmatchedPath)) unlinkSync(unmatchedPath);

  // Trigger matching pipeline; if already running, queue a new run after it finishes
  const triggerLoad = () => {
    if (!loading) loading = loadData().finally(() => { loading = null; });
  };
  if (loading) loading.finally(triggerLoad);
  else triggerLoad();

  res.json({ queued: true });
});

router.delete("/match", (req: Request, res: Response) => {
  const { filename, type } = req.body as { filename?: string; type?: string };
  if (!filename || (type !== "Sales" && type !== "Expenses")) {
    res.status(400).json({ error: "filename and type required (Sales or Expenses)" });
    return;
  }
  const existing = loadAllMatches().find((m) => m.filename === filename && m.type === type);
  deleteMatch(filename, type);

  if (existing) {
    const [year, mm] = existing.month.split("-");
    const src = join(DATA_DIR, "documents", year, mm, type, filename);
    if (existsSync(src)) {
      const unmatchedDir = join(DATA_DIR, "document-unmatched");
      mkdirSync(unmatchedDir, { recursive: true });
      renameSync(src, join(unmatchedDir, filename));
    }
  }

  if (cachedData) {
    cachedData.transactions = cachedData.transactions.map((tx) => {
      const key = type === "Expenses" ? "invoiceLinks" : "remittanceLinks";
      const links = tx[key]?.filter((l) => l.filename !== filename);
      return { ...tx, [key]: links };
    });
    cachedData.stats.withInvoice = cachedData.transactions.filter((t) => t.invoiceLinks && t.invoiceLinks.length > 0).length;
    cachedData.stats.withRemittance = cachedData.transactions.filter((t) => t.remittanceLinks && t.remittanceLinks.length > 0).length;
  }
  res.json({ ok: true });
});

// Serve PDFs from organized archive: data/documents/{year}/{month}/{type}/{filename}
router.get("/pdf/documents/:year/:month/:type/:filename", (req: Request, res: Response) => {
  const { year, month, type, filename } = req.params;

  if (type !== "Sales" && type !== "Expenses") {
    res.status(400).json({ error: "Invalid type" });
    return;
  }
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) {
    res.status(400).json({ error: "Invalid year/month format" });
    return;
  }
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  const filePath = join(DATA_DIR, "documents", year, month, type, filename);

  if (!existsSync(filePath)) {
    console.error(`[pdf] file not found: ${filePath}`);
    res.status(404).json({ error: "File not found" });
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  const safeForHeader1 = filename.replace(/["\r\n\\]/g, "_");
  res.setHeader("Content-Disposition", `inline; filename="${safeForHeader1}"`);
  res.sendFile(filePath);
});

// Serve PDFs from document-unmatched/ for manual matching preview
router.get("/pdf/unmatched/:filename", (req: Request, res: Response) => {
  const { filename } = req.params;
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }
  const filePath = join(DATA_DIR, "document-unmatched", filename);
  if (!existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.setHeader("Content-Type", "application/pdf");
  const safeForHeader2 = filename.replace(/["\r\n\\]/g, "_");
  res.setHeader("Content-Disposition", `inline; filename="${safeForHeader2}"`);
  res.sendFile(filePath);
});

// List PDFs in document-unmatched/ with extracted metadata
router.get("/unmatched-pdfs", async (req: Request, res: Response) => {
  const unmatchedDir = join(DATA_DIR, "document-unmatched");
  if (!existsSync(unmatchedDir)) {
    res.json({ pdfs: [] });
    return;
  }
  const files = readdirSync(unmatchedDir)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .map((f) => ({ name: f, mtime: statSync(join(unmatchedDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime) // newest first
    .map((f) => f.name);
  const pdfs = await Promise.all(
    files.map(async (filename) => {
      const filePath = join(unmatchedDir, filename);
      try {
        const { text, dates, amounts } = await extractPdfData(filePath);
        return { filename, text: text.substring(0, 800), dates, amounts, previewUrl: `/api/pdf/unmatched/${encodeURIComponent(filename)}` };
      } catch {
        return { filename, text: "", dates: [], amounts: [], previewUrl: `/api/pdf/unmatched/${encodeURIComponent(filename)}` };
      }
    })
  );
  res.json({ pdfs });
});

// Manually link an unmatched PDF to a transaction
router.post("/match-manual", (req: Request, res: Response) => {
  const { filename, transferWiseId } = req.body as { filename?: string; transferWiseId?: string };
  if (!filename || !transferWiseId) {
    res.status(400).json({ error: "filename and transferWiseId required" });
    return;
  }
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  const srcPath = join(DATA_DIR, "document-unmatched", filename);
  if (!existsSync(srcPath)) {
    res.status(404).json({ error: "File not found in document-unmatched" });
    return;
  }

  const tx = cachedData?.transactions.find((t) => t.transferWiseId === transferWiseId);
  if (!tx) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  const type: "Sales" | "Expenses" = tx.amount < 0 ? "Expenses" : "Sales";
  const year = tx.date.substring(0, 4);
  const monthNum = tx.date.substring(5, 7);
  const yearMonth = tx.date.substring(0, 7);

  const destDir = join(DATA_DIR, "documents", year, monthNum, type);
  mkdirSync(destDir, { recursive: true });
  renameSync(srcPath, join(destDir, filename));

  const url = `/api/pdf/documents/${year}/${monthNum}/${type}/${encodeURIComponent(filename)}`;
  const row = { filename, month: yearMonth, type, transferWiseId, matchMethod: "manual", url };
  saveMatch(row);

  const pdfLink = { filename, month: yearMonth, url, matchMethod: "manual", linkType: type };
  emitMatch(transferWiseId, type, pdfLink);

  if (cachedData) {
    cachedData.transactions = cachedData.transactions.map((t) => {
      if (t.transferWiseId !== transferWiseId) return t;
      return {
        ...t,
        invoiceLinks:    type === "Expenses" ? [pdfLink] : t.invoiceLinks,
        remittanceLinks: type === "Sales"    ? [pdfLink] : t.remittanceLinks,
      };
    });
  }

  res.json({ ok: true, pdfLink });
});

export default router;
