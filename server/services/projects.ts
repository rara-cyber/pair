import type { Transaction } from "./csvParser";
import { getProjects, loadProjectOverrides, type ProjectRow } from "./db";

/**
 * The text a project's patterns are matched against. Merchant and payer/payee
 * carry the counterparty name; reference and description catch the cases where
 * Wise leaves the structured fields empty and puts everything in the blurb.
 */
function haystack(tx: Transaction): string {
  return [tx.merchant, tx.payerName, tx.payeeName, tx.paymentReference, tx.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Assign each transaction to the first project (by sortOrder) whose patterns
 * match. Derived on every load rather than stored per transaction, so editing a
 * rule takes effect immediately instead of leaving old assignments behind.
 */
export function assignProjects(transactions: Transaction[]): Transaction[] {
  const projects: ProjectRow[] = getProjects();
  const overrides = loadProjectOverrides();

  // Lower-case the patterns once rather than per row.
  const prepared = projects.map((p) => ({ name: p.name, patterns: p.patterns.map((s) => s.toLowerCase()).filter(Boolean) }));

  for (const tx of transactions) {
    // A manual override always wins, including the empty string, which pins the
    // row as unassigned so a rule cannot silently reclaim it.
    const override = overrides.get(tx.transferWiseId);
    if (override !== undefined) {
      tx.project = override || undefined;
      continue;
    }
    if (prepared.length === 0) continue;
    const text = haystack(tx);
    if (!text) continue;
    const hit = prepared.find((p) => p.patterns.some((pat) => text.includes(pat)));
    if (hit) tx.project = hit.name;
  }
  return transactions;
}
