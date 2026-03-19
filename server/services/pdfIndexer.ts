import { readdirSync, existsSync, statSync } from "fs";
import { join } from "path";
import type { PdfLink } from "./csvParser";
import { extractPdfData } from "./pdfExtractor";

export interface EnrichedPdfLink extends PdfLink {
  amounts: number[];
  dates: string[];
  text: string;
  filePath: string; // absolute path to the file in dump
}

export interface PdfIndex {
  allLinks: EnrichedPdfLink[];
}

function collectPdfs(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectPdfs(full));
    } else if (entry.toLowerCase().endsWith(".pdf")) {
      results.push(full);
    }
  }
  return results;
}

export async function indexAllPdfs(baseDir: string): Promise<PdfIndex> {
  const dumpDir = join(baseDir, "document-dump");
  const allLinks: EnrichedPdfLink[] = [];

  if (!existsSync(dumpDir)) return { allLinks };

  const filePaths = collectPdfs(dumpDir);

  for (const filePath of filePaths) {
    const file = filePath.split("/").pop()!;
    let amounts: number[] = [];
    let dates: string[] = [];
    let text = "";
    try {
      const pdfData = await extractPdfData(filePath);
      amounts = pdfData.amounts;
      dates = pdfData.dates;
      text = pdfData.text;
    } catch {
      // continue without content
    }

    // Derive month (YYYY-MM) from first extracted date; empty string if none found
    const month = dates.length > 0 ? dates[0].substring(0, 7) : "";

    allLinks.push({ filename: file, month, url: "", amounts, dates, text, filePath });
  }

  console.log(`[dump] found ${allLinks.length} PDFs to process`);
  return { allLinks };
}
