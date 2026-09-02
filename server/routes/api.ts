import { Router, type Request, type Response } from "express";
import { join, basename } from "path";
import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync, statSync, rmSync } from "fs";
import multer from "multer";
import { parseAllCsvs } from "../services/csvParser";
import { indexAllPdfs } from "../services/pdfIndexer";
import { aiMatchTransactions, getModel, setModel, AVAILABLE_MODELS, blockReason } from "../services/aiMatcher";
import { deleteMatch, loadAllMatches, saveMatch, loadAllCategories, getCategoryList, addCategory, saveCategory } from "../services/db";
import { categorizeTransactions } from "../services/categorizer";
import { progressEmitter, currentProgress, emitMatch } from "../services/progress";
import { extractPdfData } from "../services/pdfExtractor";
import { getBalances } from "../services/balances";
import { syncPaypalTransactions } from "../services/paypalTransactions";
import { assignProjects } from "../services/projects";
import { saveApiTransactions, loadApiTransactions, getProjects, saveProject, deleteProject, setProjectOverride, lastSyncedAt, countApiTransactions, saveSimulated, loadSimulated, deleteSimulated } from "../services/db";
import { readdirSync } from "fs";
import AdmZip from "adm-zip";
import type { Transaction, PdfLink } from "../services/csvParser";

/** Every Transaction field, empty — a simulated row fills in only what it has. */
const EMPTY_TRANSACTION = {
  transferWiseId: "", date: "", dateTime: "", amount: 0, currency: "", description: "",
  paymentReference: "", runningBalance: 0, exchangeFrom: "", exchangeTo: "", exchangeRate: "",
  payerName: "", payeeName: "", payeeAccountNumber: "", merchant: "", cardLastFourDigits: "",
  cardHolderFullName: "", attachment: "", note: "", totalFees: 0, exchangeToAmount: "",
  transactionType: "", transactionDetailsType: "", invoiceLinks: [], remittanceLinks: [],
} satisfies Transaction;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const router = Router();

const DATA_DIR = join(__dirname, "../../data");
const CSV_BASE_DIR = join(__dirname, "../../account-statements");

let cachedData: {
  transactions: Transaction[];
  stats: { total: number; withInvoice: number; withRemittance: number };
} | null = null;

let loading: Promise<void> | null = null;
let pendingCategorizeForce = false;

// True once a full loadData() has finished at least once. Needed because
// loadData sets `cachedData` to a placeholder *synchronously*, before its first
// await — so `if (!cachedData)` is already false by the time a caller checks it,
// and the very first request would ship the empty placeholder.
let hasLoaded = false;

/**
 * All transactions, from every source: Wise CSVs on disk plus anything pulled
 * from an API and persisted. CSV rows win on an id collision — they are the
 * authoritative bookkeeping record. Ids are namespaced (TRANSFER-/CARD- vs
 * PAYPAL-) so in practice collisions cannot happen.
 */
function loadAllTransactions(): Transaction[] {
  const csv = parseAllCsvs();
  const seen = new Set(csv.map((t) => t.transferWiseId));
  const api = loadApiTransactions<Transaction>().filter((t) => !seen.has(t.transferWiseId));
  return assignProjects([...csv, ...api].sort((a, b) => b.date.localeCompare(a.date)));
}

function refreshCachedFromCsvs() {
  const parsed = loadAllTransactions();
  const prev = new Map((cachedData?.transactions ?? []).map((t) => [t.transferWiseId, t]));
  const transactions: Transaction[] = parsed.map((tx) => {
    const old = prev.get(tx.transferWiseId);
    return old
      ? { ...tx, invoiceLinks: old.invoiceLinks ?? [], remittanceLinks: old.remittanceLinks ?? [], categories: old.categories }
      : { ...tx, invoiceLinks: [] as PdfLink[], remittanceLinks: [] as PdfLink[] };
  });
  cachedData = {
    transactions,
    stats: {
      total: transactions.length,
      withInvoice: transactions.filter((t) => (t.invoiceLinks?.length ?? 0) > 0).length,
      withRemittance: transactions.filter((t) => (t.remittanceLinks?.length ?? 0) > 0).length,
    },
  };
}

/**
 * Move everything in document-unmatched back into document-dump so the matcher
 * reconsiders it.
 *
 * A PDF is only ever matched against the transactions that existed when it was
 * processed, and nothing retries it afterwards — so a document that arrives
 * before its transaction stays unmatched forever. That is exactly what happened
 * to the Apify payout invoices: they were processed before the PayPal
 * transactions were pulled. Called whenever new transactions land.
 */
function requeueUnmatched(): number {
  const unmatchedDir = join(DATA_DIR, "document-unmatched");
  const dumpDir = join(DATA_DIR, "document-dump");
  if (!existsSync(unmatchedDir)) return 0;
  let moved = 0;
  for (const f of readdirSync(unmatchedDir)) {
    if (!f.toLowerCase().endsWith(".pdf")) continue;
    try {
      renameSync(join(unmatchedDir, f), join(dumpDir, f));
      moved++;
    } catch { /* leave it; a later run will pick it up */ }
  }
  if (moved > 0) console.log(`[requeue] ${moved} unmatched PDFs back into the dump`);
  return moved;
}

async function loadData(forceRematch = false, categorizeForce = false) {
  const transactions = loadAllTransactions();

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

  // (a) Merge persisted categories onto every transaction
  const persistedCategories = new Map(loadAllCategories().map((r) => [r.transferWiseId, r.categories]));
  for (const tx of matched) {
    const cats = persistedCategories.get(tx.transferWiseId);
    if (cats) tx.categories = cats;
  }

  // (b) Run LLM categorization for any uncategorized transactions, then merge results
  const categoryMap = await categorizeTransactions(matched, { force: categorizeForce });
  for (const tx of matched) {
    const cats = categoryMap.get(tx.transferWiseId);
    if (cats) tx.categories = cats;
  }

  cachedData = {
    transactions: matched,
    stats: {
      total: matched.length,
      withInvoice: matched.filter((t) => t.invoiceLinks && t.invoiceLinks.length > 0).length,
      withRemittance: matched.filter((t) => t.remittanceLinks && t.remittanceLinks.length > 0).length,
    },
  };
  hasLoaded = true;
}

/**
 * Start a matching pass, or queue one behind the pass already running.
 *
 * Every caller that has just changed what is on disk — a dropped PDF, a new
 * statement, a requeue — needs exactly this, and a second copy of it would be
 * a second place for the "already loading" rule to drift.
 */
function scheduleLoad() {
  const run = () => {
    if (!loading) {
      const force = pendingCategorizeForce; pendingCategorizeForce = false;
      loading = loadData(false, force).finally(() => { loading = null; });
    }
  };
  if (loading) loading.finally(run);
  else run();
}

router.get("/progress", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendProgress = (data: object) => res.write(`event: progress\ndata: ${JSON.stringify(data)}\n\n`);
  const sendMatch = (data: object) => res.write(`event: match\ndata: ${JSON.stringify(data)}\n\n`);
  const sendCategory = (data: object) => res.write(`event: category\ndata: ${JSON.stringify(data)}\n\n`);

  sendProgress(currentProgress);

  progressEmitter.on("update", sendProgress);
  progressEmitter.on("match", sendMatch);
  progressEmitter.on("category", sendCategory);
  req.on("close", () => {
    progressEmitter.off("update", sendProgress);
    progressEmitter.off("match", sendMatch);
    progressEmitter.off("category", sendCategory);
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

// Deliberately not wired into loadData() — that kicks off a full CSV reparse +
// PDF index + AI matching, and balances must not be coupled to it.
router.get("/balances", async (_req: Request, res: Response) => {
  res.json(await getBalances());
});

// Sync status, so the UI can show when PayPal was last pulled rather than
// leaving the user guessing whether the data is current.
router.get("/sync-paypal", (_req: Request, res: Response) => {
  res.json({
    configured: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
    lastSyncedAt: lastSyncedAt("paypal"),
    count: countApiTransactions("paypal"),
  });
});

// Pull PayPal transactions, persist them, then re-run the normal load so the
// new rows go through PDF matching and categorization like any other row.
router.post("/sync-paypal", async (_req: Request, res: Response) => {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    res.status(400).json({ error: "PayPal credentials not configured" });
    return;
  }
  try {
    const rows = await syncPaypalTransactions();
    saveApiTransactions("paypal", rows);
    requeueUnmatched(); // new transactions may match documents that failed before
    refreshCachedFromCsvs(); // reflect immediately; matching follows below
    if (!loading) loading = loadData().finally(() => { loading = null; });
    res.json({ synced: rows.length, lastSyncedAt: lastSyncedAt("paypal"), count: countApiTransactions("paypal") });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[sync-paypal]", message);
    res.status(502).json({ error: message });
  }
});

router.get("/transactions", async (req: Request, res: Response) => {
  const rematch = req.query.rematch === "true";
  // Always check for new dump files unless a load is already in progress
  if (!loading) {
    const force = pendingCategorizeForce; pendingCategorizeForce = false;
    loading = loadData(rematch, force).finally(() => { loading = null; });
  }
  // Wait for the first real load, but never fail the request because of it —
  // a partial result beats a 500, and the client patches the rest in over SSE.
  if (!hasLoaded) {
    try { await loading; } catch { /* serve whatever cachedData holds */ }
  }
  // Merged here rather than in loadData(): simulated rows must never reach the
  // matcher, the categorizer or the archive export. `stats` stays as it is —
  // it counts document coverage, and an invented payment has no document.
  const simulated = loadSimulated<Transaction>();
  res.json(
    simulated.length && cachedData
      ? { ...cachedData, transactions: [...simulated, ...cachedData.transactions].sort((a, b) => b.date.localeCompare(a.date)) }
      : cachedData,
  );
});

/**
 * Simulated incoming payments — "what if this invoice lands?".
 *
 * They are shown everywhere the real rows are, so the KPIs and charts answer
 * that question, and they are excluded from every export by construction: the
 * archive script reads the CSVs and api_transactions, neither of which they
 * are in.
 */
router.get("/simulated", (_req: Request, res: Response) => {
  res.json({ simulated: loadSimulated<Transaction>() });
});

router.post("/simulated", (req: Request, res: Response) => {
  const { date, amount, currency, payerName, description, project } = req.body ?? {};
  const value = Number(amount);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !Number.isFinite(value) || value <= 0) {
    res.status(400).json({ error: "date (YYYY-MM-DD) and a positive amount are required" });
    return;
  }
  const row = {
    ...EMPTY_TRANSACTION,
    transferWiseId: `SIM-${Date.now()}`,
    date: String(date),
    dateTime: `${date}T00:00:00`,
    amount: value,
    currency: String(currency || "EUR").toUpperCase(),
    description: String(description || "Simulated incoming payment"),
    payerName: String(payerName || ""),
    transactionType: "CREDIT",
    simulated: true as const,
    ...(project ? { project: String(project) } : {}),
  };
  saveSimulated(row);
  res.json({ simulated: row });
});

router.delete("/simulated/:transferWiseId", (req: Request, res: Response) => {
  res.json({ deleted: deleteSimulated(req.params.transferWiseId) });
});

router.post("/match-pdf", upload.single("file"), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const safeFilename = basename(req.file.originalname);

  // Re-dropping a document that is already attached used to look like nothing
  // happened: the file was written to the dump, and aiMatchTransactions then
  // deleted it as a stale duplicate with only a server-console line to show for
  // it. Answer here instead, where there is someone to tell.
  const existing = loadAllMatches().find((m) => m.filename === safeFilename);
  if (existing) {
    res.json({ alreadyLinked: true, filename: safeFilename, transferWiseId: existing.transferWiseId, url: existing.url });
    return;
  }

  const dumpDir = join(DATA_DIR, "document-dump");
  mkdirSync(dumpDir, { recursive: true });
  writeFileSync(join(dumpDir, safeFilename), req.file.buffer);

  // If this file was previously marked unmatched, clear it so the matcher retries it
  const unmatchedPath = join(DATA_DIR, "document-unmatched", safeFilename);
  if (existsSync(unmatchedPath)) unlinkSync(unmatchedPath);

  scheduleLoad();

  res.json({ queued: true });
});

router.post("/ingest-zip", upload.single("file"), (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
  const original = basename(req.file.originalname);
  if (!original.toLowerCase().endsWith(".zip")) { res.status(400).json({ error: "Expected a .zip file" }); return; }

  // Folder named after the zip (e.g. statement_2026-05-01_2026-05-31_csv), sanitized.
  // Strip a browser-added " (1)" duplicate suffix so re-downloading the SAME month
  // resolves to the same folder and replaces it (instead of accumulating "…__1_" folders).
  const folderName = original
    .replace(/\.zip$/i, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/[^A-Za-z0-9._-]/g, "_");
  if (!folderName) { res.status(400).json({ error: "Invalid archive name" }); return; }
  const destDir = join(CSV_BASE_DIR, folderName);
  // Replace the folder wholesale so the month reflects exactly this archive (no stale CSVs).
  rmSync(destDir, { recursive: true, force: true });
  mkdirSync(destDir, { recursive: true });

  let added = 0;
  try {
    const zip = new AdmZip(req.file.buffer);
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      const name = basename(entry.entryName);
      if (!name.toLowerCase().endsWith(".csv")) continue;
      writeFileSync(join(destDir, name), entry.getData());
      added++;
    }
  } catch {
    res.status(400).json({ error: "Could not read the zip archive" });
    return;
  }
  if (added === 0) { res.status(400).json({ error: "No CSV files found in the archive" }); return; }

  // Reflect the new month immediately (preserving current matches/categories)…
  requeueUnmatched(); // new statement rows may match documents that failed before
  refreshCachedFromCsvs();
  // …then re-run matching/categorization for the newly-added transactions in the background.
  scheduleLoad();

  res.json({ ok: true, added, folder: folderName });
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

/**
 * Retry everything in document-unmatched/.
 *
 * A document is only ever matched against the transactions that existed when
 * it was processed, so an invoice that arrives before its Wise statement does
 * is unmatchable at that moment — and nothing looks at it again. requeueUnmatched
 * already runs when a statement upload or a PayPal pull brings new rows in, but
 * transactions also arrive by other routes and the judgement of "there should
 * be a match by now" is the user's. This is the button behind that judgement.
 */
router.post("/rematch-unmatched", (_req: Request, res: Response) => {
  const requeued = requeueUnmatched();
  if (requeued > 0) scheduleLoad();
  res.json({ requeued });
});

// List PDFs in document-unmatched/ with extracted metadata
router.get("/unmatched-pdfs", async (req: Request, res: Response) => {
  const unmatchedDir = join(DATA_DIR, "document-unmatched");
  if (!existsSync(unmatchedDir)) {
    res.json({ pdfs: [] });
    return;
  }

  // Which of these could still land somewhere? Same rule the matcher skips on,
  // so the card and the run cannot disagree about what is a dead end. Before
  // the first load there is nothing to compare against, so a document is
  // reported matchable rather than falsely written off.
  const txs = cachedData?.transactions ?? [];
  const documented = txs.filter((t) => t.invoiceLinks?.length || t.remittanceLinks?.length);
  const undocumented = txs.filter((t) => !t.invoiceLinks?.length && !t.remittanceLinks?.length);
  const canJudge = hasLoaded && txs.length > 0;

  const files = readdirSync(unmatchedDir)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .map((f) => ({ name: f, mtime: statSync(join(unmatchedDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime) // newest first
    .map((f) => f.name);
  const pdfs = await Promise.all(
    files.map(async (filename) => {
      const filePath = join(unmatchedDir, filename);
      try {
        const { text, dates, amounts, zeroValue } = await extractPdfData(filePath);
        // A zero-value document is certain without knowing any transaction, so
        // it is reported even before the first load has finished; the other two
        // reasons depend on what exists to match against.
        const blocked = zeroValue
          ? ("zero-value" as const)
          : canJudge
            ? blockReason({ amounts, zeroValue }, undocumented, documented)
            : undefined;
        // The whole extracted text, not an 800-char head: the manual-match
        // modal searches this, and the invoice number or payer name routinely
        // sits past the opening block of boilerplate. extractPdfData already
        // caps at 3000 chars, so that is the real ceiling — do not add a second
        // one here. `hasText` separates "no hits" from "nothing to search": a
        // scanned PDF has no text layer at all, and we do not run OCR yet.
        return {
          filename,
          text,
          hasText: text.trim().length >= 20,
          dates,
          amounts,
          blocked,
          previewUrl: `/api/pdf/unmatched/${encodeURIComponent(filename)}`,
        };
      } catch {
        return { filename, text: "", hasText: false, dates: [], amounts: [], blocked: undefined, previewUrl: `/api/pdf/unmatched/${encodeURIComponent(filename)}` };
      }
    })
  );
  res.json({ pdfs });
});

// A filename that arrives over the wire is joined onto a data directory, so it
// must not be able to climb out of one.
const unsafeName = (f: string) => f.includes("..") || f.includes("/") || f.includes("\\");

/**
 * Attach a document to a transaction and record it everywhere that matters.
 *
 * The archive path, the DB row, the SSE event and the in-memory cache patch are
 * identical whether the document came from `document-unmatched/` or straight off
 * the user's disk — only how the bytes reach the destination differs, which is
 * what `deliver` supplies. Both routes below go through here so the
 * one-document-per-transaction bookkeeping has a single source of truth.
 */
function linkToTransaction(
  filename: string,
  transferWiseId: string,
  deliver: (destPath: string) => void,
): { ok: true; pdfLink: PdfLink } | { ok: false; status: number; error: string } {
  if (unsafeName(filename)) return { ok: false, status: 400, error: "Invalid filename" };

  const tx = cachedData?.transactions.find((t) => t.transferWiseId === transferWiseId);
  if (!tx) return { ok: false, status: 404, error: "Transaction not found" };

  const type: "Sales" | "Expenses" = tx.amount < 0 ? "Expenses" : "Sales";
  const year = tx.date.substring(0, 4);
  const monthNum = tx.date.substring(5, 7);
  const yearMonth = tx.date.substring(0, 7);

  const destDir = join(DATA_DIR, "documents", year, monthNum, type);
  mkdirSync(destDir, { recursive: true });
  deliver(join(destDir, filename));

  const url = `/api/pdf/documents/${year}/${monthNum}/${type}/${encodeURIComponent(filename)}`;
  saveMatch({ filename, month: yearMonth, type, transferWiseId, matchMethod: "manual", url });

  const pdfLink: PdfLink = { filename, month: yearMonth, url, matchMethod: "manual", linkType: type };
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

  return { ok: true, pdfLink };
}

// Manually link a PDF that is already sitting in document-unmatched/
router.post("/match-manual", (req: Request, res: Response) => {
  const { filename, transferWiseId } = req.body as { filename?: string; transferWiseId?: string };
  if (!filename || !transferWiseId) {
    res.status(400).json({ error: "filename and transferWiseId required" });
    return;
  }
  if (unsafeName(filename)) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  const srcPath = join(DATA_DIR, "document-unmatched", filename);
  if (!existsSync(srcPath)) {
    res.status(404).json({ error: "File not found in document-unmatched" });
    return;
  }

  const result = linkToTransaction(filename, transferWiseId, (dest) => renameSync(srcPath, dest));
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({ ok: true, pdfLink: result.pdfLink });
});

// Upload a document straight onto one transaction, for when nothing in
// document-unmatched/ fits. Deliberately NOT /match-pdf: that drops into
// document-dump/ and kicks off a full AI matching pass, which is free to attach
// the file to some *other* transaction. Here the user has already decided.
router.post("/match-upload", upload.single("file"), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const { transferWiseId } = req.body as { transferWiseId?: string };
  if (!transferWiseId) {
    res.status(400).json({ error: "transferWiseId required" });
    return;
  }
  const filename = basename(req.file.originalname);
  if (!filename.toLowerCase().endsWith(".pdf")) {
    res.status(400).json({ error: "Expected a .pdf file" });
    return;
  }
  if (unsafeName(filename)) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  const buffer = req.file.buffer;
  const result = linkToTransaction(filename, transferWiseId, (dest) => writeFileSync(dest, buffer));
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({ ok: true, pdfLink: result.pdfLink });
});

// ── Categories ──────────────────────────────────────────────────────────────

router.get("/projects", (_req: Request, res: Response) => {
  res.json({ projects: getProjects() });
});

router.post("/projects", (req: Request, res: Response) => {
  const { name, patterns, sortOrder } = req.body as { name?: string; patterns?: unknown; sortOrder?: number };
  const clean = String(name ?? "").trim();
  if (!clean) { res.status(400).json({ error: "Name required" }); return; }
  // Patterns are matched with includes(), so blanks would match everything.
  const list = Array.isArray(patterns) ? patterns.map((p) => String(p).trim()).filter(Boolean) : [];
  const order = typeof sortOrder === "number" ? sortOrder : getProjects().length;
  saveProject(clean, list, order);
  cachedData = null; hasLoaded = false; // rules changed → assignments must be re-derived
  res.json({ projects: getProjects() });
});

router.delete("/projects/:name", (req: Request, res: Response) => {
  deleteProject(req.params.name);
  cachedData = null; hasLoaded = false;
  res.json({ projects: getProjects() });
});

// Pin one transaction to a project. Empty string = deliberately unassigned;
// null clears the pin so the rules apply again.
router.post("/transaction/:transferWiseId/project", (req: Request, res: Response) => {
  const id = req.params.transferWiseId;
  const { project } = req.body as { project?: string | null };
  const value = project === null || project === undefined ? null : String(project).trim();
  setProjectOverride(id, value);

  // Patch the cache in place so the change shows without a full reload.
  const tx = cachedData?.transactions.find((t) => t.transferWiseId === id);
  if (tx) {
    tx.project = undefined;
    // Clearing the pin must hand the row back to the rules, not blank it —
    // otherwise "use rule" looks like it unassigned the transaction.
    if (value === null) assignProjects([tx]);
    else if (value) tx.project = value;
  }
  res.json({ transferWiseId: id, project: tx?.project ?? value });
});

router.get("/categories", (_req: Request, res: Response) => {
  res.json({ categories: getCategoryList() });
});

router.post("/categories", (req: Request, res: Response) => {
  const { name } = req.body as { name?: string };
  if (!name || !name.trim()) {
    res.status(400).json({ error: "name required" });
    return;
  }
  addCategory(name.trim());
  res.json({ categories: getCategoryList() });
});

router.post("/transaction/:transferWiseId/category", (req: Request, res: Response) => {
  const { transferWiseId } = req.params;
  const { categories } = req.body as { categories?: string[] };
  if (!Array.isArray(categories)) {
    res.status(400).json({ error: "categories array required" });
    return;
  }
  const clean = Array.from(new Set(categories.map((c) => String(c).trim()).filter(Boolean))).slice(0, 3);
  saveCategory({ transferWiseId, categories: clean, method: "manual" });
  if (cachedData) {
    const tx = cachedData.transactions.find((t) => t.transferWiseId === transferWiseId);
    if (tx) tx.categories = clean;
  }
  res.json({ ok: true });
});

router.post("/categorize", (req: Request, res: Response) => {
  const { force } = req.body as { force?: boolean };
  if (force) pendingCategorizeForce = true;

  scheduleLoad();

  res.json({ queued: true });
});

export default router;
