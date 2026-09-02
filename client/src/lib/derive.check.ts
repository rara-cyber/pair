/**
 * Self-check for `isInternalTransfer` (`npm run check`).
 *
 * This predicate decides what counts as revenue. Get it wrong in one direction
 * and a customer payment silently vanishes from income; wrong in the other and
 * the PayPal sweep is double-counted again, which is the bug it exists to fix.
 * The five rows below are real shapes from the 2026 data.
 */
import { isInternalTransfer } from "./derive";
import type { Transaction } from "../types";

const row = (o: Partial<Transaction>): Transaction => o as Transaction;

function check(label: string, ok: boolean): void {
  if (!ok) throw new Error(`derive.check: ${label}`);
}

check("the PayPal sweep into Wise is internal", isInternalTransfer(row({
  transferWiseId: "TRANSFER-2330038793", amount: 11500,
  description: "Received money from PAYPAL with reference INSTANT TRANSFER/2",
})));

check("a PayPal payment from a customer is revenue", !isInternalTransfer(row({
  transferWiseId: "PAYPAL-7XM12345", amount: 3915.64,
  description: "PayPal payment", payerName: "Apify Technologies s.r.o.",
})));

// Both legs of a conversion, so neither balance's side of it is counted.
check("the conversion credit is internal", isInternalTransfer(row({
  transferWiseId: "BALANCE-5436004211", amount: 676.65,
  description: "Converted 100.00 USD to 676.65 CNY (fee: 0.32 USD)",
})));
check("the conversion debit is internal", isInternalTransfer(row({
  transferWiseId: "BALANCE-5436004211~2", amount: -99.68,
  description: "Converted 100.00 USD to 676.65 CNY (fee: 0.32 USD)",
})));

// Carries exchangeFrom/exchangeTo like a conversion, but it is a real cost.
check("a card payment abroad is a real expense", !isInternalTransfer(row({
  transferWiseId: "CARD-3814966389", amount: -76.79,
  description: "Card transaction of 522.41 CNY issued by JustOneAPI",
  exchangeFrom: "USD", exchangeTo: "CNY",
})));

check("ordinary income is untouched", !isInternalTransfer(row({
  transferWiseId: "TRANSFER-2341465208", amount: 4.18,
  description: "Received money from AMAZON SERVICES", payerName: "AMAZON SERVICES INT",
})));

console.log("derive.check: ok");
