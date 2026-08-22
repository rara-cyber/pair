import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { parse } from "csv-parse/sync";

export interface Transaction {
  transferWiseId: string;
  date: string;
  dateTime: string;
  amount: number;
  currency: string;
  description: string;
  paymentReference: string;
  runningBalance: number;
  exchangeFrom: string;
  exchangeTo: string;
  exchangeRate: string;
  payerName: string;
  payeeName: string;
  payeeAccountNumber: string;
  merchant: string;
  cardLastFourDigits: string;
  cardHolderFullName: string;
  attachment: string;
  note: string;
  totalFees: number;
  exchangeToAmount: string;
  transactionType: string;
  transactionDetailsType: string;
  /** Which system the row came from. Absent means Wise CSV (the original source). */
  source?: "wise" | "paypal";
  /** Business line, derived from project patterns at load time. */
  project?: string;
  invoiceLinks?: PdfLink[];
  remittanceLinks?: PdfLink[];
  categories?: string[];
}

export interface PdfLink {
  filename: string;
  month: string;
  url: string;
  matchMethod?: string;
  linkType?: "Sales" | "Expenses";
}

const CSV_BASE_DIR = join(__dirname, "../../account-statements");

function convertDate(ddmmyyyy: string): string {
  const [dd, mm, yyyy] = ddmmyyyy.split("-");
  return `${yyyy}-${mm}-${dd}`;
}

export function parseAllCsvs(): Transaction[] {
  // Keyed on the fields that make a row distinct, not on the id alone. Statement
  // periods overlap (a full-year export plus monthly ones), so the same row
  // genuinely appears in several files and must still collapse to one — but Wise
  // also reuses a single id for two DIFFERENT rows, and keying on the id alone
  // silently discarded one of them.
  const transactionMap = new Map<string, Transaction>();

  const subdirs = readdirSync(CSV_BASE_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const subdir of subdirs) {
    const subdirPath = join(CSV_BASE_DIR, subdir);
    const files = readdirSync(subdirPath).filter((f) => f.endsWith(".csv"));

    for (const file of files) {
      const content = readFileSync(join(subdirPath, file), "utf-8");
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
      });

      if (records.length === 0) continue;

      for (const r of records) {
        const id = r["TransferWise ID"] || "";
        if (!id) continue;
        const rowKey = [id, r["Currency"], r["Amount"], r["Date Time"]].join("|");
        transactionMap.set(rowKey, {
          transferWiseId: id,
          date: convertDate(r["Date"]),
          dateTime: r["Date Time"] || "",
          amount: parseFloat(r["Amount"]) || 0,
          currency: r["Currency"] || "",
          description: r["Description"] || "",
          paymentReference: r["Payment Reference"] || "",
          runningBalance: parseFloat(r["Running Balance"]) || 0,
          exchangeFrom: r["Exchange From"] || "",
          exchangeTo: r["Exchange To"] || "",
          exchangeRate: r["Exchange Rate"] || "",
          payerName: r["Payer Name"] || "",
          payeeName: r["Payee Name"] || "",
          payeeAccountNumber: r["Payee Account Number"] || "",
          merchant: r["Merchant"] || "",
          cardLastFourDigits: r["Card Last Four Digits"] || "",
          cardHolderFullName: r["Card Holder Full Name"] || "",
          attachment: r["Attachment"] || "",
          note: r["Note"] || "",
          totalFees: parseFloat(r["Total fees"]) || 0,
          exchangeToAmount: r["Exchange To Amount"] || "",
          transactionType: r["Transaction Type"] || "",
          transactionDetailsType: r["Transaction Details Type"] || "",
        });
      }
    }
  }

  const allTransactions = Array.from(transactionMap.values());
  disambiguateIds(allTransactions);
  allTransactions.sort((a, b) => b.date.localeCompare(a.date));
  return allTransactions;
}

/**
 * Wise reuses one TransferWise ID for two distinct rows in two situations:
 * a currency conversion (debit leg in the source currency file, credit leg in
 * the target's), and a card authorisation with its reversal (both in the same
 * file, equal and opposite). Everything downstream — the docMap invariant and
 * all four DB tables — keys on this id, so the extras need their own.
 *
 * The first row of a colliding group keeps the bare id, so existing matches,
 * categories, enrichments and project pins continue to resolve. Ordering is by
 * row content rather than file read order, so a given row keeps the same id
 * across runs regardless of how the directory happens to be listed.
 */
function disambiguateIds(transactions: Transaction[]): void {
  const byId = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const group = byId.get(tx.transferWiseId);
    if (group) group.push(tx);
    else byId.set(tx.transferWiseId, [tx]);
  }

  for (const [id, group] of byId) {
    if (group.length < 2) continue;
    group.sort(
      (a, b) =>
        a.currency.localeCompare(b.currency) ||
        a.amount - b.amount ||
        a.dateTime.localeCompare(b.dateTime),
    );
    // "~" is unreserved in URLs, so ids stay safe in the /api/transaction/:id routes.
    group.forEach((tx, i) => { if (i > 0) tx.transferWiseId = `${id}~${i + 1}`; });
  }
}
