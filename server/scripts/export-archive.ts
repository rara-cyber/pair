/**
 * Yearly archive export — the format-longevity half of the retention duty.
 *
 * RPS §12 lg 5 requires preserved records to stay reproducible in writing,
 * legible IN PLAIN TEXT, and evidentially sound for the whole seven-year
 * period. `data/matches.db` is a bespoke SQLite store: perfectly readable
 * today, and exactly the kind of app-specific format that fails that test in
 * year six when the app is gone. The PDFs under `data/documents/` are already
 * fine; what needs escaping into plain text is the *bookkeeping* around them —
 * which transaction a document belongs to, what it was categorised as, what
 * the matcher enriched.
 *
 * Note the retention clock is the LATER of two rules: RPS §12 lg 1 runs from
 * the end of the financial year in which the transaction was recorded, MKS §58
 * from 1 January of the year FOLLOWING the document. The manifest states both
 * so whoever finds this folder in 2033 does not have to work it out.
 *
 * Run:  npx tsx server/scripts/export-archive.ts [year]
 * Default year is the previous calendar year — the one whose books have closed.
 */

import { cpSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { parseAllCsvs, type Transaction } from "../services/csvParser";
import { loadAllCategories, loadAllEnrichments, loadAllMatches, loadApiTransactions } from "../services/db";

const DATA_DIR = join(__dirname, "../../data");

/** RFC 4180: quote everything, double any embedded quote. Cheap and never wrong. */
function csv(rows: (string | number)[][]): string {
  return rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function main() {
  const year = process.argv[2] ?? String(new Date().getFullYear() - 1);
  if (!/^\d{4}$/.test(year)) {
    console.error(`Usage: npx tsx server/scripts/export-archive.ts [YYYY]  (got "${year}")`);
    process.exit(1);
  }

  const outDir = join(DATA_DIR, "archive", year);
  mkdirSync(outDir, { recursive: true });

  // Same merge the server does on load: CSV wins over api_transactions on a
  // collision, because the Wise export carries all 25 fields and the API does not.
  const csvTx = parseAllCsvs();
  const seen = new Set(csvTx.map((t) => t.transferWiseId));
  const apiTx = loadApiTransactions<Transaction>().filter((t) => !seen.has(t.transferWiseId));
  const all = [...csvTx, ...apiTx].filter((t) => t.date?.startsWith(year));

  const matches = loadAllMatches();
  const docByTx = new Map(matches.map((m) => [m.transferWiseId, m]));
  const catByTx = new Map(loadAllCategories().map((c) => [c.transferWiseId, c.categories]));

  const txRows: (string | number)[][] = [
    [
      "transferWiseId", "date", "amount", "currency", "description", "paymentReference",
      "payerName", "payeeName", "merchant", "totalFees",
      "exchangeFrom", "exchangeTo", "exchangeRate", "exchangeToAmount",
      "source", "categories", "documentFilename", "documentType", "documentPath",
    ],
  ];
  for (const t of all.sort((a, b) => a.date.localeCompare(b.date))) {
    const doc = docByTx.get(t.transferWiseId);
    txRows.push([
      t.transferWiseId, t.date, t.amount, t.currency, t.description, t.paymentReference,
      t.payerName, t.payeeName, t.merchant, t.totalFees,
      t.exchangeFrom, t.exchangeTo, t.exchangeRate, t.exchangeToAmount,
      t.source ?? "wise",
      (catByTx.get(t.transferWiseId) ?? []).join("; "),
      doc?.filename ?? "", doc?.type ?? "", doc?.url ?? "",
    ]);
  }
  writeFileSync(join(outDir, "transactions.csv"), csv(txRows), "utf8");

  const yearMatches = matches.filter((m) => m.month?.startsWith(year));
  writeFileSync(
    join(outDir, "documents.csv"),
    csv([
      ["filename", "transferWiseId", "type", "month", "url", "matchMethod"],
      ...yearMatches.map((m) => [m.filename, m.transferWiseId, m.type, m.month, m.url, m.matchMethod ?? ""]),
    ]),
    "utf8",
  );

  // Enrichments are keyed by transaction, not by month, so filter via this year's ids.
  const idsThisYear = new Set(all.map((t) => t.transferWiseId));
  const enrich = loadAllEnrichments().filter((e) => idsThisYear.has(e.transferWiseId));
  writeFileSync(
    join(outDir, "enrichments.csv"),
    csv([
      ["transferWiseId", "field", "value"],
      ...enrich.flatMap((e) =>
        Object.entries(e).filter(([k]) => k !== "transferWiseId").map(([k, v]) => [e.transferWiseId, k, String(v ?? "")]),
      ),
    ]),
    "utf8",
  );

  // The PDFs are the evidence; the CSVs are only the index into them. Copying
  // rather than referencing means the folder stands alone if `pair` is gone.
  const srcDocs = join(DATA_DIR, "documents", year);
  let copied = 0;
  if (existsSync(srcDocs)) {
    cpSync(srcDocs, join(outDir, "documents"), { recursive: true });
    copied = yearMatches.length;
  }

  // Split by direction on purpose. TuMS §51 lg 2 p 3 taxes PAYMENTS — money out —
  // for which no compliant source document exists. An undocumented credit is not
  // that: it is income, evidenced by the bank record itself. Most of the incoming
  // gaps here are Wise cashback of a euro or two. Filing them under §51 would
  // overstate the exposure to whoever reads this folder years from now.
  const undocOut = all.filter((t) => !docByTx.has(t.transferWiseId) && t.amount < 0);
  const undocIn = all.filter((t) => !docByTx.has(t.transferWiseId) && t.amount >= 0);
  const keepUntil = Number(year) + 8; // MKS §58: from 1 Jan of the following year, 7 years on.

  writeFileSync(
    join(outDir, "MANIFEST.txt"),
    [
      `SIÁN OÜ (registry 16038482) — accounting archive for ${year}`,
      `Generated ${new Date().toISOString().slice(0, 10)} by pair/server/scripts/export-archive.ts`,
      ``,
      `WHY THIS FOLDER EXISTS`,
      `RPS §12 lg 5 requires preserved accounting records to remain reproducible in`,
      `writing, legible in plain text and evidentially sound for the full retention`,
      `period. The live system stores this data in SQLite (data/matches.db), which`,
      `is app-specific. These CSVs are the plain-text equivalent.`,
      ``,
      `RETENTION`,
      `RPS §12 lg 1 — 7 years from the end of the financial year of recording.`,
      `MKS §58    — at least 7 years from 1 January of the year FOLLOWING the document.`,
      `Keep to the later of the two: DO NOT DESTROY BEFORE 31 DECEMBER ${keepUntil}.`,
      `Documents evidencing long-term liabilities or rights run 7 years from the`,
      `EXPIRY of their validity instead (RPS §12 lg 3) and may need keeping longer.`,
      ``,
      `CONTENTS`,
      `  transactions.csv  ${all.length} transactions, with categories and the linked document`,
      `  documents.csv     ${yearMatches.length} document links`,
      `  enrichments.csv   ${enrich.length} enriched transactions`,
      `  documents/        ${copied} source PDFs, filed {month}/{Sales|Expenses}/`,
      ``,
      `COMPLETENESS`,
      `  ${all.length - undocOut.length - undocIn.length} of ${all.length} transactions have a source document.`,
      ``,
      `  Outgoing payments with no document: ${undocOut.length}`,
      `  These are the ones that matter. A payment for which no source document meeting`,
      `  accounting-law requirements is held is taxable under TuMS §51 lg 2 p 3 (22/78).`,
      ...undocOut.map((t) => `    ${t.date}  ${String(t.amount).padStart(10)} ${t.currency}  ${t.merchant || t.payeeName || t.description}`),
      ``,
      `  Incoming credits with no document: ${undocIn.length}`,
      `  Not a §51 exposure — §51 lg 2 p 3 reaches payments out, not receipts. These are`,
      `  income, evidenced by the bank record itself; most are small Wise cashback lines.`,
      ...undocIn.map((t) => `    ${t.date}  ${String(t.amount).padStart(10)} ${t.currency}  ${t.payerName || t.merchant || t.description}`),
    ].join("\n") + "\n",
    "utf8",
  );

  console.log(`archive ${year} -> ${outDir}`);
  console.log(`  transactions ${all.length}  documents ${yearMatches.length}  enrichments ${enrich.length}`);
  console.log(`  undocumented: ${undocOut.length} outgoing (TuMS §51 exposure), ${undocIn.length} incoming`);
  console.log(`  keep until 31 December ${keepUntil}`);
}

main();
