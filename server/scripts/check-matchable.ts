/**
 * Self-check for the matcher's skip rules (`bun run check` / `npm run check`).
 *
 * blockReason decides whether a document is handed to the model or dropped
 * straight back into document-unmatched/ without an API call. Too strict and an
 * invoice silently stops being looked at; too loose and every retry pays for
 * 158 doomed calls. Both directions are asserted here.
 */
import assert from "node:assert/strict";
import { amountMatches, blockReason } from "../services/aiMatcher";
import type { Transaction } from "../services/csvParser";

/** A transaction with only the fields the amount rules read. */
function tx(amount: number, exchangeToAmount = ""): Transaction {
  return { transferWiseId: "T1", date: "2026-01-15", amount, exchangeToAmount } as Transaction;
}

const doc = (amounts: number[], zeroValue = false) => ({ amounts, zeroValue });

// ── Still matchable ─────────────────────────────────────────────────────────

// The plain case: the amount is on a transaction that has no document yet.
assert.equal(blockReason(doc([30.5]), [tx(-30.5)], []), undefined);

// No amount extracted and no zero on the page is NOT evidence of no match — the
// model can still match on invoice number, reference or merchant. Letting these
// through is the difference between a filter and a shredder.
assert.equal(blockReason(doc([]), [tx(-99)], []), undefined);

// A card payment abroad settles in the account currency while the invoice is in
// the merchant's, so the foreign leg counts too.
assert.equal(blockReason(doc([522.41]), [tx(-76.79, "522.41")], []), undefined);

// Any one of several extracted amounts is enough — an invoice carries a total,
// line items, and often a net and a gross.
assert.equal(blockReason(doc([1418.53, 952.42]), [tx(-952.42)], []), undefined);

// An undocumented match wins over a documented one: still worth the call.
assert.equal(blockReason(doc([30.5]), [tx(-30.5)], [tx(-30.5)]), undefined);

// ── Dead ends ───────────────────────────────────────────────────────────────

// Every figure on the page is zero: a free-tier invoice evidences no payment,
// so no transaction will ever correspond to it. Permanent.
assert.equal(blockReason(doc([], true), [tx(-30.5)], []), "zero-value");

// The amount belongs to a transaction that already has a document — one
// document per transaction, so this is the receipt half of a matched pair.
assert.equal(blockReason(doc([30.5]), [tx(-99)], [tx(-30.5)]), "already-documented");

// On no transaction at all: the invoice arrived before its statement did. This
// is the only reason a later import can clear, and what retrying is for.
assert.equal(blockReason(doc([30.5]), [tx(-99)], [tx(-42)]), "no-transaction");

// Nothing to match against at all.
assert.equal(blockReason(doc([30.5]), [], []), "no-transaction");

// ── Amount tolerance ────────────────────────────────────────────────────────

// Rounding tolerance is 0.02, exclusive at the boundary.
assert.equal(amountMatches(doc([30.51]), tx(-30.5)), true);
assert.equal(amountMatches(doc([30.53]), tx(-30.5)), false);

// An empty exchangeToAmount parses to NaN and must never count as a match.
assert.equal(amountMatches(doc([30.5]), tx(-99, "")), false);

console.log("check-matchable: all assertions passed");
