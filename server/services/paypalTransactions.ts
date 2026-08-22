import type { Transaction } from "./csvParser";
import { paypalAccessToken, PAYPAL_BASE } from "./balances";

// PayPal splits every incoming payment into three balance-affecting rows:
//   T0001  +3915.64 USD   the actual payment
//   T0200  -3915.64 USD   currency conversion, debit leg
//   T0200  +3251.62 EUR   currency conversion, credit leg
// Ingesting all three triples the row count and double-counts income, because
// the USD payment and the EUR credit both look like revenue. Only T0001 is a
// real business event; the conversion is a move between our own balances.
//
// The credit leg points back at its payment via `paypal_reference_id`, so we
// fold it into the exchange* fields instead — the same shape the Wise CSV uses
// for conversions. Verified 14/14 against live data.
const PAYMENT_CODES = /^T0[01]/; // T00xx payments, T01xx refunds/reversals

const WINDOW_DAYS = 31; // hard API cap on a single query range

// PayPal rejects start_date older than 1095 days. Counting in calendar years is
// a trap: `setFullYear(y - 3)` spans 1096 days across a leap year and 400s.
const MAX_LOOKBACK_DAYS = 1090;

interface TxInfo {
  transaction_id: string;
  paypal_reference_id?: string;
  transaction_event_code: string;
  transaction_initiation_date: string;
  transaction_amount: { currency_code: string; value: string };
  fee_amount?: { value: string };
  ending_balance?: { value: string };
  transaction_status?: string;
  transaction_note?: string;
  transaction_subject?: string;
  custom_field?: string;
  invoice_id?: string;
}

interface PayerInfo {
  email_address?: string;
  payer_name?: { given_name?: string; surname?: string; alternate_full_name?: string };
}

function payerName(p: PayerInfo | undefined): string {
  const n = p?.payer_name;
  if (!n) return "";
  return (n.alternate_full_name || `${n.given_name ?? ""} ${n.surname ?? ""}`.trim() || "").trim();
}

async function fetchWindow(token: string, start: Date, end: Date): Promise<any> {
  const qs = new URLSearchParams({
    // Must be UTC with a trailing Z — a "+HH:MM" offset decodes `+` as a space and 400s.
    start_date: start.toISOString().replace(/\.\d{3}Z$/, "Z"),
    end_date: end.toISOString().replace(/\.\d{3}Z$/, "Z"),
    fields: "all",
    page_size: "500",
  });

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${PAYPAL_BASE}/v1/reporting/transactions?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) return res.json();
      const body = await res.text();
      // On Mondays, for a few hours after UTC midnight, PayPal returns this for
      // an otherwise valid range. It means "no data yet", not a bad request.
      if (res.status === 400 && /not available/i.test(body)) return { transaction_details: [] };
      throw new Error(`PayPal transactions ${res.status}: ${body.slice(0, 200)}`);
    } catch (e) {
      lastErr = e as Error;
      // Transient TLS/network failures are common across a long window sweep.
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastErr ?? new Error("PayPal transactions: unknown error");
}

function toTransaction(info: TxInfo, payer: PayerInfo | undefined, converted?: TxInfo): Transaction {
  const amount = parseFloat(info.transaction_amount.value) || 0;
  const currency = info.transaction_amount.currency_code;
  const name = payerName(payer);
  const reference = info.transaction_note || info.custom_field || info.invoice_id || info.transaction_subject || "";

  const convValue = converted ? parseFloat(converted.transaction_amount.value) || 0 : 0;

  return {
    // Namespaced so it can never collide with Wise's TRANSFER-/CARD- ids.
    transferWiseId: `PAYPAL-${info.transaction_id}`,
    date: info.transaction_initiation_date.slice(0, 10),
    dateTime: info.transaction_initiation_date,
    amount,
    currency,
    // Phrased like the Wise CSV's descriptions — aiMatcher and categorizer are
    // prompted on that style, so consistency helps them.
    description: amount >= 0
      ? `Received money from ${name || "PayPal"}${reference ? ` with reference ${reference}` : ""}`
      : `Sent money to ${name || "PayPal"}${reference ? ` with reference ${reference}` : ""}`,
    paymentReference: reference,
    runningBalance: parseFloat(info.ending_balance?.value ?? "0") || 0,
    // PayPal's own conversion rate, folded in from the paired credit leg.
    exchangeFrom: converted ? currency : "",
    exchangeTo: converted ? converted.transaction_amount.currency_code : "",
    exchangeRate: converted && amount !== 0 ? (convValue / Math.abs(amount)).toFixed(6) : "",
    exchangeToAmount: converted ? converted.transaction_amount.value : "",
    payerName: amount >= 0 ? name : "",
    payeeName: amount < 0 ? name : "",
    payeeAccountNumber: payer?.email_address ?? "",
    merchant: name,
    cardLastFourDigits: "",
    cardHolderFullName: "",
    attachment: "",
    note: info.transaction_note ?? "",
    totalFees: Math.abs(parseFloat(info.fee_amount?.value ?? "0") || 0),
    transactionType: amount >= 0 ? "CREDIT" : "DEBIT",
    transactionDetailsType: info.transaction_event_code,
    source: "paypal",
  };
}

/**
 * Pull PayPal transactions for the last `years` years (PayPal retains 3).
 *
 * ponytail: full resync every time, no incremental watermark. At this volume
 * (~14 payments over 7 months) re-fetching costs ~36 requests and sidesteps the
 * classic watermark data-loss bug entirely — a transaction that lands inside
 * PayPal's ~3h ingestion lag is permanently skipped if you checkpoint on
 * wall-clock time. Add a `last_refreshed_datetime` watermark only if volume
 * makes the full sweep too slow.
 */
export async function syncPaypalTransactions(
  lookbackDays = MAX_LOOKBACK_DAYS,
  onProgress?: (done: number, total: number) => void
): Promise<Transaction[]> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) return [];

  const token = await paypalAccessToken(id, secret);

  const end = new Date();
  const start = new Date(end.getTime() - Math.min(lookbackDays, MAX_LOOKBACK_DAYS) * 864e5);

  const windows: [Date, Date][] = [];
  for (let s = new Date(start); s < end; ) {
    const e = new Date(Math.min(s.getTime() + WINDOW_DAYS * 864e5, end.getTime()));
    windows.push([new Date(s), e]);
    s = e;
  }

  const byId = new Map<string, { info: TxInfo; payer?: PayerInfo }>();
  for (const [i, [s, e]] of windows.entries()) {
    const data = await fetchWindow(token, s, e);
    for (const d of data.transaction_details ?? []) {
      // Windows share boundaries, so the same row can appear twice.
      byId.set(d.transaction_info.transaction_id, { info: d.transaction_info, payer: d.payer_info });
    }
    onProgress?.(i + 1, windows.length);
  }

  const all = [...byId.values()];

  // Index conversion credit legs by the payment they belong to.
  const convByPayment = new Map<string, TxInfo>();
  for (const { info } of all) {
    if (info.transaction_event_code !== "T0200") continue;
    if ((parseFloat(info.transaction_amount.value) || 0) <= 0) continue;
    if (info.paypal_reference_id) convByPayment.set(info.paypal_reference_id, info);
  }

  return all
    .filter(({ info }) => PAYMENT_CODES.test(info.transaction_event_code))
    .map(({ info, payer }) => toTransaction(info, payer, convByPayment.get(info.transaction_id)))
    .sort((a, b) => b.date.localeCompare(a.date));
}
