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
  invoiceLinks?: PdfLink[];
  remittanceLinks?: PdfLink[];
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
        transactionMap.set(id, {
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
  allTransactions.sort((a, b) => b.date.localeCompare(a.date));
  return allTransactions;
}
