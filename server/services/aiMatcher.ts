import { mkdirSync, renameSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import type { Transaction, PdfLink } from "./csvParser";
import type { PdfIndex, EnrichedPdfLink } from "./pdfIndexer";
import { extractPdfData } from "./pdfExtractor";
import {
  saveMatch, loadAllMatches, clearMatches,
  saveEnrichment, loadAllEnrichments, clearEnrichments,
} from "./db";
import { initProgress, updateProgress, finishProgress, emitMatch } from "./progress";

// Only models reachable from this machine's region. OpenRouter geo-blocks
// closed models whose sole upstream is a US provider that does not serve
// mainland China — Gemini, GPT-4o Mini and Claude 3 Haiku all return
// `403 This model is not available in your region` from here. Open-weight
// models routed via StreamLake / Alibaba / DeepInfra work fine.
//
// Benchmarked on the real categorizer prompt against 30 already-labelled rows:
//   deepseek-chat    73% agreement, 30/30 covered, 0 invalid, 335 out-tok, $0.04/1000tx
//   qwen3-235b-a22b  73% agreement, 30/30 covered, 0 invalid, 2041 out-tok, $0.29/1000tx
// Qwen3 is a reasoning model and burns ~6x the output tokens for the same
// answer, so DeepSeek is the default on cost and latency, not on accuracy.
const MODELS = [
  { id: "deepseek/deepseek-chat",            label: "DeepSeek Chat (default)" },
  { id: "qwen/qwen3-235b-a22b",              label: "Qwen3 235B" },
  { id: "qwen/qwen-2.5-72b-instruct",        label: "Qwen 2.5 72B" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
] as const;

export type ModelId = typeof MODELS[number]["id"];
export const AVAILABLE_MODELS = MODELS;

let currentModel: ModelId = "deepseek/deepseek-chat";
export function getModel(): ModelId { return currentModel; }
export function setModel(id: ModelId): void { currentModel = id; }

let sessionApiCalls = 0;

export async function callLlm(prompt: string, maxTokens = 64): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getModel(),
      max_tokens: maxTokens,
      // Matching and categorisation are classification, not composition. Without
      // this the provider default (1.0) makes identical prompts disagree: an
      // exact amount+date match returned "none" on roughly one run in three.
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter error: ${res.status} ${await res.text()}`);
  updateProgress({ apiCalls: ++sessionApiCalls });
  const json = await res.json() as any;
  return json.choices?.[0]?.message?.content?.trim() ?? "none";
}

/** Does any amount extracted from the document equal this transaction's value? */
function amountMatches(link: EnrichedPdfLink, tx: Transaction): boolean {
  if (!link.amounts.length) return false;
  // A card payment abroad settles in the account currency but the invoice is in
  // the merchant's, so compare the foreign-currency leg too — a CN¥522.41
  // invoice pairs with a -76.79 USD charge via exchangeToAmount.
  const foreign = parseFloat(tx.exchangeToAmount);
  return link.amounts.some(
    (a) => Math.abs(a - Math.abs(tx.amount)) < 0.02 || (!isNaN(foreign) && Math.abs(a - Math.abs(foreign)) < 0.02),
  );
}

// If link.month is empty (no date in PDF), return all transactions as candidates
function getCandidates(link: EnrichedPdfLink, transactions: Transaction[]): Transaction[] {
  let candidates = transactions;
  if (link.month) {
    const [year, month] = link.month.split("-").map(Number);
    const from = new Date(year, month - 2, 1);
    const to = new Date(year, month, 31);
    candidates = transactions.filter((tx) => {
      const d = new Date(tx.date);
      return d >= from && d <= to;
    });
  }

  // Narrow by amount when the document gave us one. The date window alone can
  // leave 130+ candidates for a 400-character invoice — a needle in a haystack
  // the model was demonstrably failing to find. Only ever a narrowing: if no
  // amount lines up, fall back to the full window rather than returning nothing.
  const byAmount = candidates.filter((tx) => amountMatches(link, tx));
  return byAmount.length > 0 ? byAmount : candidates;
}

function formatTx(tx: Transaction): string {
  const parts = [
    `ID: ${tx.transferWiseId}`,
    `Date: ${tx.date}`,
    `Amount: ${tx.amount} ${tx.currency}`,
  ];
  if (tx.payerName) parts.push(`Payer: ${tx.payerName}`);
  if (tx.payeeName) parts.push(`Payee: ${tx.payeeName}`);
  if (tx.merchant) parts.push(`Merchant: ${tx.merchant}`);
  if (tx.paymentReference) parts.push(`Ref: ${tx.paymentReference}`);
  if (tx.description) parts.push(`Desc: ${tx.description.substring(0, 120)}`);
  return parts.join(" | ");
}

async function matchOneLink(
  link: EnrichedPdfLink,
  candidates: Transaction[]
): Promise<string | null> {
  if (!link.text || candidates.length === 0) return null;

  const prompt = `You are matching a payment document (invoice or remittance advice) to a bank transaction.

Rules:
- For remittance advices (Amazon royalty payments): match on the PAYMENT DATE and AMOUNT PAID (after withholding, not the gross invoice amount). The payment date is labelled "Payment date:" in the document. The bank transaction may arrive 1–5 business days after that date — allow this tolerance.
- For invoices: match on invoice amount and invoice date. Allow up to 3 days tolerance on the date.
- A card payment abroad settles in the account currency, so the invoice currency and the transaction Amount often differ. The original amount is in the transaction's Desc, e.g. "Card transaction of 522.41 CNY". When the currencies differ, match on that original amount, not on the settled Amount.
- The document email/sent date is NOT the payment date — ignore it for matching.
- If there is a clear amount and date match, return the transaction ID. Otherwise reply "none".

Document filename: ${link.filename}
Document content:
${link.text}

Candidate bank transactions:
${candidates.map(formatTx).join("\n")}

Which transaction ID matches? Reply with ONLY the TransferWise ID or "none".`;

  const text = await callLlm(prompt);
  if (/^\s*none\b/i.test(text)) return null;

  // Extract rather than compare: the reply is frequently "ID: CARD-123" or
  // wrapped in backticks/prose, and exact equality silently discarded a correct
  // answer. Only ids from the candidate set can be returned, so this cannot
  // invent a match.
  const validIds = candidates.map((t) => t.transferWiseId);
  return validIds.find((id) => text.includes(id)) ?? null;
}

type Enrichment = { payerName: string; payeeName: string; paymentReference: string; merchant: string };

async function enrichFromPdf(tx: Transaction, pdfText: string): Promise<Partial<Enrichment>> {
  const missing = (["payerName", "payeeName", "paymentReference", "merchant"] as const)
    .filter((f) => !tx[f]);

  if (missing.length === 0) return {};

  const prompt = `Extract the following fields from this invoice/document. Only include fields you can clearly identify.
Fields needed: ${missing.join(", ")}

Document content:
${pdfText}

Reply with ONLY a JSON object, e.g. {"payerName":"Acme Ltd","paymentReference":"INV-123"}.
Use only the keys listed above. Omit keys you cannot find.`;

  try {
    const raw = await callLlm(prompt, 256);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, string>;
    const result: Partial<Enrichment> = {};
    for (const key of missing) {
      if (parsed[key] && typeof parsed[key] === "string" && parsed[key].trim()) {
        result[key] = parsed[key].trim();
      }
    }
    return result;
  } catch {
    return {};
  }
}

export async function aiMatchTransactions(
  transactions: Transaction[],
  index: PdfIndex,
  baseDir: string,
  forceRematch = false
): Promise<Transaction[]> {
  sessionApiCalls = 0;

  const dumpDir = join(baseDir, "document-dump");
  const unmatchedDir = join(baseDir, "document-unmatched");
  const documentsDir = join(baseDir, "documents");

  if (forceRematch) {
    clearMatches();
    clearEnrichments();
    console.log("AI matcher: cleared existing matches and enrichments (rematch requested)");
  }

  // Load persisted matches from DB
  const stored = loadAllMatches();
  const claimedDocs = new Set<string>();
  const docMap = new Map<string, PdfLink | null>();

  for (const tx of transactions) {
    docMap.set(tx.transferWiseId, null);
  }

  for (const row of stored) {
    if (docMap.get(row.transferWiseId) !== null) {
      console.log(`[db] skipping duplicate match for ${row.transferWiseId}: ${row.filename}`);
      continue;
    }
    const link: PdfLink = { filename: row.filename, month: row.month, url: row.url, matchMethod: row.matchMethod, linkType: row.type };
    docMap.set(row.transferWiseId, link);
    claimedDocs.add(row.filename);
  }

  // Load persisted enrichments from DB
  const storedEnrichments = loadAllEnrichments();
  const enrichmentMap = new Map<string, Partial<Enrichment>>();
  for (const row of storedEnrichments) {
    enrichmentMap.set(row.transferWiseId, {
      ...(row.payerName        ? { payerName: row.payerName }               : {}),
      ...(row.payeeName        ? { payeeName: row.payeeName }               : {}),
      ...(row.paymentReference ? { paymentReference: row.paymentReference } : {}),
      ...(row.merchant         ? { merchant: row.merchant }                 : {}),
    });
  }

  console.log(`AI matcher: ${stored.length} matches and ${storedEnrichments.length} enrichments loaded from DB`);

  // Delete dump files that are already matched (stale duplicates)
  for (const link of index.allLinks) {
    if (claimedDocs.has(link.filename)) {
      unlinkSync(link.filePath);
      console.log(`[dedup] deleted stale dump copy: ${link.filename}`);
    }
  }

  // Skip PDFs already claimed (DB) or already moved to document-unmatched/
  const allPending = index.allLinks.filter((l) => {
    if (claimedDocs.has(l.filename)) return false;
    if (existsSync(join(unmatchedDir, l.filename))) return false;
    return true;
  });

  console.log(`AI matcher: ${index.allLinks.length} PDFs in dump, ${allPending.length} need AI matching (${stored.length} from cache)`);

  initProgress(allPending.length, stored.length);

  let processedCount = stored.length;
  let matchedCount = 0;

  const txById = new Map(transactions.map((tx) => [tx.transferWiseId, tx]));

  async function processLink(link: EnrichedPdfLink) {
    updateProgress({ current: link.filename });
    const candidates = getCandidates(link, transactions).filter(
      (tx) => docMap.get(tx.transferWiseId) === null
    );
    try {
      const matchedId = await matchOneLink(link, candidates);
      if (matchedId && docMap.get(matchedId) === null) {
        const tx = txById.get(matchedId)!;
        const type: "Sales" | "Expenses" = tx.amount < 0 ? "Expenses" : "Sales";
        const year = tx.date.substring(0, 4);
        const yearMonth = tx.date.substring(0, 7); // "YYYY-MM" for DB
        const monthNum = tx.date.substring(5, 7);  // "MM" for folder/URL

        // Move file from dump to organized folder
        const destDir = join(documentsDir, year, monthNum, type);
        mkdirSync(destDir, { recursive: true });
        renameSync(link.filePath, join(destDir, link.filename));
        console.log(`[move] document-dump/${link.filename} → documents/${year}/${monthNum}/${type}/${link.filename}`);

        const url = `/api/pdf/documents/${year}/${monthNum}/${type}/${encodeURIComponent(link.filename)}`;
        const pdfLink: PdfLink = { filename: link.filename, month: yearMonth, url, matchMethod: "ai", linkType: type };
        docMap.set(matchedId, pdfLink);
        claimedDocs.add(link.filename);
        saveMatch({ filename: link.filename, month: yearMonth, type, transferWiseId: matchedId, matchMethod: "ai", url });
        updateProgress({ processed: ++processedCount, matched: ++matchedCount });
        emitMatch(matchedId, type, pdfLink);
        console.log(`[match] ${link.filename} → ${matchedId} (${type})`);

        // Enrich empty fields from PDF
        if (!enrichmentMap.has(matchedId) && link.text) {
          const enriched = await enrichFromPdf(tx, link.text);
          if (Object.keys(enriched).length > 0) {
            enrichmentMap.set(matchedId, enriched);
            saveEnrichment({
              transferWiseId: matchedId,
              payerName: enriched.payerName ?? null,
              payeeName: enriched.payeeName ?? null,
              paymentReference: enriched.paymentReference ?? null,
              merchant: enriched.merchant ?? null,
            });
            console.log(`Enriched ${matchedId}:`, enriched);
          }
        }
      } else {
        // Move to unmatched
        mkdirSync(unmatchedDir, { recursive: true });
        renameSync(link.filePath, join(unmatchedDir, link.filename));
        console.log(`[unmatched] ${link.filename} → document-unmatched/`);
        updateProgress({ processed: ++processedCount });
      }
    } catch (err) {
      updateProgress({ processed: ++processedCount });
      console.error(`AI match failed for ${link.filename}:`, err);
    }
  }

  // Most payments arrive as an invoice AND a receipt with identical amounts and
  // dates. Only one can attach (one document per transaction), so whichever is
  // processed first wins — and directory order was deciding that, leaving
  // receipts linked where an invoice existed. Invoices first, deterministically.
  const documentRank = (filename: string): number => {
    const f = filename.toLowerCase();
    if (f.includes("invoice")) return 0;
    if (f.includes("receipt")) return 2;
    return 1;
  };
  allPending.sort((a, b) => documentRank(a.filename) - documentRank(b.filename) || a.filename.localeCompare(b.filename));

  for (const link of allPending) await processLink(link);

  finishProgress();

  return transactions.map((tx) => {
    const doc = docMap.get(tx.transferWiseId);
    const enriched = enrichmentMap.get(tx.transferWiseId) ?? {};
    return {
      ...tx,
      payerName:        tx.payerName        || enriched.payerName        || tx.payerName,
      payeeName:        tx.payeeName        || enriched.payeeName        || tx.payeeName,
      paymentReference: tx.paymentReference || enriched.paymentReference || tx.paymentReference,
      merchant:         tx.merchant         || enriched.merchant         || tx.merchant,
      invoiceLinks:    doc?.linkType === "Expenses" ? [doc] : [],
      remittanceLinks: doc?.linkType === "Sales"    ? [doc] : [],
    };
  });
}

