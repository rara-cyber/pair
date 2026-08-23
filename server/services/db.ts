import Database from "better-sqlite3";
import { join } from "path";

const DB_PATH = join(__dirname, "../../data/matches.db");

// Ensure data directory exists
import { mkdirSync } from "fs";
mkdirSync(join(__dirname, "../../data"), { recursive: true });

const db = new Database(DB_PATH);

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS matches (
      filename       TEXT NOT NULL,
      month          TEXT NOT NULL,
      type           TEXT NOT NULL CHECK (type IN ('Sales', 'Expenses')),
      transferWiseId TEXT NOT NULL,
      matchMethod    TEXT NOT NULL DEFAULT 'ai',
      url            TEXT NOT NULL,
      PRIMARY KEY (filename, type)
    );

    -- OCR output for PDFs with no text layer. Keyed on a hash of the file's
    -- BYTES, not its path: a document moves between document-dump/,
    -- documents/ and document-unmatched/ over its life, and a path key would
    -- re-run a 20-second OCR pass on every move.
    CREATE TABLE IF NOT EXISTS ocr_cache (
      hash TEXT PRIMARY KEY,
      text TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enrichments (
      transferWiseId   TEXT PRIMARY KEY,
      payerName        TEXT,
      payeeName        TEXT,
      paymentReference TEXT,
      merchant         TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      transferWiseId TEXT PRIMARY KEY,
      category       TEXT NOT NULL,
      method         TEXT NOT NULL DEFAULT 'ai'
    );

    CREATE TABLE IF NOT EXISTS category_list (
      name      TEXT PRIMARY KEY,
      sortOrder INTEGER
    );

    -- Business lines. The patterns column is a JSON array of case-insensitive substrings
    -- matched against a transaction's merchant/payer/payee/reference/description.
    -- Assignments are derived at load time, never stored per transaction, so
    -- editing a rule cannot leave stale assignments behind.
    CREATE TABLE IF NOT EXISTS projects (
      name      TEXT PRIMARY KEY,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      patterns  TEXT NOT NULL
    );

    -- Per-transaction project overrides. Rules cover the recurring counterparties;
    -- this pins the exceptions. An empty string means "deliberately unassigned",
    -- which is distinct from having no row at all (fall through to the rules).
    CREATE TABLE IF NOT EXISTS project_overrides (
      transferWiseId TEXT PRIMARY KEY,
      project        TEXT NOT NULL
    );

    -- Transactions pulled from an API rather than a CSV. CSV rows are re-derived
    -- from disk on every load, but API rows have no local file to re-read, so
    -- they must persist. Stored as whole JSON: the shape is Transaction, and a
    -- column-per-field table would need migrating every time that type changes.
    CREATE TABLE IF NOT EXISTS api_transactions (
      transferWiseId TEXT PRIMARY KEY,
      source         TEXT NOT NULL,
      json           TEXT NOT NULL,
      syncedAt       TEXT NOT NULL
    );
  `);
}

const SEED_CATEGORIES = [
  "Sales / Revenue",
  "Refunds & Reversals",
  "Software & SaaS",
  "Advertising & Marketing",
  "Professional Services",
  "Bank & Payment Fees",
  "Office & Supplies",
  "Travel & Transport",
  "Meals & Entertainment",
  "Taxes & Government",
  "Salaries & Contractors",
  "Transfers & Owner Draws",
  "Other",
];

function seedCategoryList() {
  const count = (db.prepare("SELECT COUNT(*) AS c FROM category_list").get() as { c: number }).c;
  if (count > 0) return;
  const insert = db.prepare("INSERT INTO category_list (name, sortOrder) VALUES (?, ?)");
  SEED_CATEGORIES.forEach((name, i) => insert.run(name, i));
  console.log("[db] seeded category_list");
}

// Migrate: if old schema (invoices/remittance) is detected, drop and recreate
const schemaRow = db.prepare(
  "SELECT sql FROM sqlite_master WHERE type='table' AND name='matches'"
).get() as { sql: string } | undefined;

if (schemaRow?.sql?.includes("'invoices'")) {
  console.log("[db] migrating: dropping tables with old schema (invoices/remittance → Sales/Expenses)");
  db.exec("DROP TABLE IF EXISTS matches; DROP TABLE IF EXISTS enrichments;");
}

createTables();
seedCategoryList();

// ── Matches ──────────────────────────────────────────────────────────────────

export interface MatchRow {
  filename: string;
  month: string;
  type: "Sales" | "Expenses";
  transferWiseId: string;
  matchMethod: string;
  url: string;
}

const stmtInsertMatch = db.prepare<MatchRow>(`
  INSERT OR REPLACE INTO matches (filename, month, type, transferWiseId, matchMethod, url)
  VALUES (@filename, @month, @type, @transferWiseId, @matchMethod, @url)
`);

const stmtAllMatches = db.prepare<[], MatchRow>("SELECT * FROM matches");
const stmtDeleteMatches = db.prepare("DELETE FROM matches");
const stmtDeleteOneMatch = db.prepare("DELETE FROM matches WHERE filename = @filename AND type = @type");

export function saveMatch(row: MatchRow): void {
  stmtInsertMatch.run(row);
}

export function loadAllMatches(): MatchRow[] {
  return stmtAllMatches.all();
}

export function clearMatches(): void {
  stmtDeleteMatches.run();
}

export function deleteMatch(filename: string, type: "Sales" | "Expenses"): void {
  stmtDeleteOneMatch.run({ filename, type });
}

// ── Enrichments ───────────────────────────────────────────────────────────────

export interface EnrichmentRow {
  transferWiseId: string;
  payerName: string | null;
  payeeName: string | null;
  paymentReference: string | null;
  merchant: string | null;
}

const stmtGetOcr = db.prepare<[string], { text: string }>("SELECT text FROM ocr_cache WHERE hash = ?");
const stmtPutOcr = db.prepare("INSERT OR REPLACE INTO ocr_cache (hash, text) VALUES (?, ?)");

export function getCachedOcr(hash: string): string | null {
  return stmtGetOcr.get(hash)?.text ?? null;
}

/** Empty text is cached too — a failed OCR should not be retried on every scan. */
export function putCachedOcr(hash: string, text: string): void {
  stmtPutOcr.run(hash, text);
}

const stmtInsertEnrichment = db.prepare<EnrichmentRow>(`
  INSERT OR REPLACE INTO enrichments (transferWiseId, payerName, payeeName, paymentReference, merchant)
  VALUES (@transferWiseId, @payerName, @payeeName, @paymentReference, @merchant)
`);

const stmtAllEnrichments = db.prepare<[], EnrichmentRow>("SELECT * FROM enrichments");
const stmtDeleteEnrichments = db.prepare("DELETE FROM enrichments");

export function saveEnrichment(row: EnrichmentRow): void {
  stmtInsertEnrichment.run(row);
}

export function loadAllEnrichments(): EnrichmentRow[] {
  return stmtAllEnrichments.all();
}

export function clearEnrichments(): void {
  stmtDeleteEnrichments.run();
}

// ── Categories ────────────────────────────────────────────────────────────────

export interface CategoryRow {
  transferWiseId: string;
  categories: string[];
  method: string;
}

// Raw DB shape: the `category` column holds a JSON-encoded string[].
// Legacy rows may hold a bare category name (pre-multi-category) — handled by parseCategories.
interface CategoryRowRaw {
  transferWiseId: string;
  category: string;
  method: string;
}

const stmtInsertCategory = db.prepare<CategoryRowRaw>(`
  INSERT OR REPLACE INTO categories (transferWiseId, category, method)
  VALUES (@transferWiseId, @category, @method)
`);

const stmtAllCategories = db.prepare<[], CategoryRowRaw>("SELECT * FROM categories");
const stmtDeleteAiCategories = db.prepare("DELETE FROM categories WHERE method = 'ai'");
const stmtDeleteCategories = db.prepare("DELETE FROM categories");
const stmtCategoryList = db.prepare<[], { name: string }>("SELECT name FROM category_list ORDER BY sortOrder, name");
const stmtAddCategory = db.prepare<[string]>(
  "INSERT OR IGNORE INTO category_list (name, sortOrder) VALUES (?, (SELECT COALESCE(MAX(sortOrder), -1) + 1 FROM category_list))"
);

function parseCategories(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  } catch { /* legacy: bare category name, not JSON */ }
  return raw ? [raw] : [];
}

export function saveCategory(row: { transferWiseId: string; categories: string[]; method: string }): void {
  stmtInsertCategory.run({
    transferWiseId: row.transferWiseId,
    category: JSON.stringify(row.categories),
    method: row.method,
  });
}

export function loadAllCategories(): CategoryRow[] {
  return stmtAllCategories.all().map((r) => ({
    transferWiseId: r.transferWiseId,
    categories: parseCategories(r.category),
    method: r.method,
  }));
}

export function clearAiCategories(): void {
  stmtDeleteAiCategories.run();
}

export function clearCategories(): void {
  stmtDeleteCategories.run();
}

export function getCategoryList(): string[] {
  return stmtCategoryList.all().map((r) => r.name);
}

export function addCategory(name: string): void {
  stmtAddCategory.run(name);
}

// ── Projects ──────────────────────────────────────────────────────────────────

export interface ProjectRow { name: string; sortOrder: number; patterns: string[] }

const stmtAllProjects = db.prepare<[], { name: string; sortOrder: number; patterns: string }>(
  "SELECT * FROM projects ORDER BY sortOrder, name"
);
const stmtUpsertProject = db.prepare(`
  INSERT INTO projects (name, sortOrder, patterns) VALUES (@name, @sortOrder, @patterns)
  ON CONFLICT(name) DO UPDATE SET sortOrder = excluded.sortOrder, patterns = excluded.patterns
`);
const stmtDeleteProject = db.prepare("DELETE FROM projects WHERE name = ?");

export function getProjects(): ProjectRow[] {
  return stmtAllProjects.all().map((r) => {
    let patterns: string[] = [];
    try { const p = JSON.parse(r.patterns); if (Array.isArray(p)) patterns = p.map(String); } catch { /* corrupt row → no patterns */ }
    return { name: r.name, sortOrder: r.sortOrder, patterns };
  });
}

export function saveProject(name: string, patterns: string[], sortOrder: number): void {
  stmtUpsertProject.run({ name, sortOrder, patterns: JSON.stringify(patterns) });
}

export function deleteProject(name: string): void {
  stmtDeleteProject.run(name);
}

// Seeded from the real recurring payers/payees in this account. Only applied
// when the table is empty, so user edits are never overwritten.
const SEED_PROJECTS: { name: string; patterns: string[] }[] = [
  // Actor revenue plus the upstream APIs those actors wrap.
  { name: "Apify", patterns: ["apify", "openrouter", "justoneapi", "open web ninja", "openwebninja", "lemonfox", "anthropic", "claude.ai", "z.ai", "replicate", "scrapfly", "realtyapi", "deepinfra", "grok", "xai", "openai", "spider"] },
  { name: "Amazon KDP/MBA", patterns: ["amazon", "amz*marketin", "kdp"] },
  // NOKIA.COM is RapidAPI's payment descriptor, confirmed against the statements.
  { name: "RapidAPI", patterns: ["rapidapi", "nokia"] },
  // Print-on-demand, a separate line from KDP.
  { name: "Merch", patterns: ["sprd.net", "spreadshirt", "lazymerch"] },
  { name: "Speakeasy", patterns: ["tryspeakeasy", "speakeasy"] },
  // Company admin, shared infrastructure, and Wise card cashback. Deliberately
  // no "stripe" pattern: Stripe appears as income and would misfile revenue.
  { name: "Overhead", patterns: ["comistar", "hostinger", "cashback", "vercel", "cloudflare", "neon", "convex", "deepl"] },
];

function seedProjects() {
  const count = (db.prepare("SELECT COUNT(*) AS c FROM projects").get() as { c: number }).c;
  if (count > 0) return;
  SEED_PROJECTS.forEach((p, i) => saveProject(p.name, p.patterns, i));
  console.log("[db] seeded projects");
}

// Called here, not beside seedCategoryList(): the prepared statements above are
// module-level `const`s, so an earlier call hits the temporal dead zone.
seedProjects();

const stmtSetOverride = db.prepare(
  "INSERT INTO project_overrides (transferWiseId, project) VALUES (?, ?) ON CONFLICT(transferWiseId) DO UPDATE SET project = excluded.project"
);
const stmtClearOverride = db.prepare("DELETE FROM project_overrides WHERE transferWiseId = ?");
const stmtAllOverrides = db.prepare<[], { transferWiseId: string; project: string }>("SELECT * FROM project_overrides");

/** Pass an empty string to pin a row as unassigned; pass null to fall back to the rules. */
export function setProjectOverride(transferWiseId: string, project: string | null): void {
  if (project === null) stmtClearOverride.run(transferWiseId);
  else stmtSetOverride.run(transferWiseId, project);
}

export function loadProjectOverrides(): Map<string, string> {
  return new Map(stmtAllOverrides.all().map((r) => [r.transferWiseId, r.project]));
}

// ── API transactions ──────────────────────────────────────────────────────────

const stmtUpsertApiTx = db.prepare(`
  INSERT INTO api_transactions (transferWiseId, source, json, syncedAt)
  VALUES (@transferWiseId, @source, @json, @syncedAt)
  ON CONFLICT(transferWiseId) DO UPDATE SET
    source = excluded.source, json = excluded.json, syncedAt = excluded.syncedAt
`);
const stmtAllApiTx = db.prepare<[], { json: string }>("SELECT json FROM api_transactions");
const stmtDeleteApiTxBySource = db.prepare("DELETE FROM api_transactions WHERE source = ?");

/** Upsert a batch of API-sourced transactions. `rows` are whole Transaction objects. */
export function saveApiTransactions(source: string, rows: { transferWiseId: string }[]): number {
  const syncedAt = new Date().toISOString();
  const run = db.transaction((items: { transferWiseId: string }[]) => {
    for (const r of items) {
      stmtUpsertApiTx.run({ transferWiseId: r.transferWiseId, source, json: JSON.stringify(r), syncedAt });
    }
  });
  run(rows);
  return rows.length;
}

export function loadApiTransactions<T>(): T[] {
  return stmtAllApiTx.all().map((r) => JSON.parse(r.json) as T);
}

/** Newest syncedAt for a source, or null if it has never been synced. */
export function lastSyncedAt(source: string): string | null {
  const row = db.prepare("SELECT MAX(syncedAt) AS at FROM api_transactions WHERE source = ?").get(source) as { at: string | null };
  return row?.at ?? null;
}

export function countApiTransactions(source: string): number {
  return (db.prepare("SELECT COUNT(*) AS c FROM api_transactions WHERE source = ?").get(source) as { c: number }).c;
}

export function clearApiTransactions(source: string): void {
  stmtDeleteApiTxBySource.run(source);
}

// ── Clear All ─────────────────────────────────────────────────────────────────

export function clearAll(): void {
  db.exec("DROP TABLE IF EXISTS matches; DROP TABLE IF EXISTS enrichments; DROP TABLE IF EXISTS categories; DROP TABLE IF EXISTS category_list; DROP TABLE IF EXISTS api_transactions; DROP TABLE IF EXISTS projects; DROP TABLE IF EXISTS project_overrides;");
  createTables();
  seedCategoryList();
  seedProjects();
  console.log("[db] cleared all tables");
}
