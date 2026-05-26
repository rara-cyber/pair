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

// ── Clear All ─────────────────────────────────────────────────────────────────

export function clearAll(): void {
  db.exec("DROP TABLE IF EXISTS matches; DROP TABLE IF EXISTS enrichments; DROP TABLE IF EXISTS categories; DROP TABLE IF EXISTS category_list;");
  createTables();
  seedCategoryList();
  console.log("[db] cleared all tables");
}
