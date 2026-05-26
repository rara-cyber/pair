import { callLlm } from "./aiMatcher";
import { saveCategory, loadAllCategories, clearAiCategories, getCategoryList } from "./db";
import { emitCategory } from "./progress";
import type { Transaction } from "./csvParser";

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

const BATCH_SIZE = 15;

export async function categorizeTransactions(
  transactions: Transaction[],
  opts?: { force?: boolean }
): Promise<Map<string, string[]>> {
  if (opts?.force) clearAiCategories();

  const existing = new Map<string, string[]>(
    loadAllCategories().map((r) => [r.transferWiseId, r.categories])
  );
  const list = getCategoryList();

  const targets = transactions.filter((tx) => !existing.has(tx.transferWiseId));
  if (targets.length === 0) return existing;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const targetIds = new Set(batch.map((tx) => tx.transferWiseId));

    const prompt = `You are categorizing bank transactions for a business. Assign each transaction to ONE OR MORE (up to 3) of the allowed categories below, most relevant first.

Allowed categories:
${list.map((c) => `- ${c}`).join("\n")}

Transactions:
${batch.map(formatTx).join("\n")}

Reply with ONLY a JSON array, e.g. [{"id":"<TransferWise ID>","categories":["<category>","<category>"]}]. Assign 1 to 3 allowed categories per transaction. Include every transaction exactly once. Use only the allowed category names.`;

    try {
      const raw = await callLlm(prompt, 2048);
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) continue;
      const parsed = JSON.parse(jsonMatch[0]) as Array<{ id?: string; categories?: string[]; category?: string }>;
      for (const entry of parsed) {
        const id = entry.id;
        if (!id || !targetIds.has(id)) continue;
        const raw = entry.categories ?? (entry.category ? [entry.category] : []);
        let cats = Array.from(new Set(raw.filter((c) => list.includes(c)))).slice(0, 3);
        if (cats.length === 0) cats = ["Other"];
        saveCategory({ transferWiseId: id, categories: cats, method: "ai" });
        existing.set(id, cats);
        emitCategory(id, cats);
      }
    } catch (err) {
      console.error(`Categorization failed for batch starting at ${i}:`, err);
    }
  }

  return existing;
}
