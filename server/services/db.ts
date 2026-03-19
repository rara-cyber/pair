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
  `);
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

// ── Clear All ─────────────────────────────────────────────────────────────────

export function clearAll(): void {
  db.exec("DROP TABLE IF EXISTS matches; DROP TABLE IF EXISTS enrichments;");
  createTables();
  console.log("[db] cleared all tables");
}
