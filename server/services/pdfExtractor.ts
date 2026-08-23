import { readFileSync } from "fs";
import { createHash } from "crypto";
import { PDFParse } from "pdf-parse";
import { ocrPdf } from "./ocr";
import { getCachedOcr, putCachedOcr } from "./db";

export interface PdfData {
  amounts: number[];
  dates: string[]; // YYYY-MM-DD
  text: string;
}

const MONTH_MAP: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
  jan: "01", feb: "02", mar: "03", apr: "04",
  jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

// Currency codes that appear on documents this account actually receives. It
// holds USD, EUR, GBP and CNY; the rest are what suppliers have invoiced in. A
// code missing here means the document extracts NO amounts at all — that is how
// a CN¥522.41 invoice became unmatchable. Add codes here, not to a pattern.
const CURRENCY_CODES = "USD|EUR|GBP|CZK|CNY|RMB|CHF|CAD|AUD|SGD|INR|THB|JPY|PLN|SEK|NOK|DKK|HUF";

function extractAmounts(text: string): number[] {
  const amounts = new Set<number>();

  // Match patterns like $58.28, €30.50, 34.37 EUR, 61.29 USD, 13,55 USD
  // Also: $1,234.56 and €1.234,56 (European format)
  const patterns = [
    // $123.45, €123.45, £123.45, ¥123.45 (also matches the ¥ inside "CN¥123.45")
    /[$€£¥]\s?([\d,]+\.?\d*)/g,
    // 123.45 USD / 123,45 EUR / 522.41 CNY …
    new RegExp(`([\\d.,]+)\\s*(?:${CURRENCY_CODES})\\b`, "g"),
    // The mirror image: "Total (USD): 37.20", "USD 37.20", "EUR: 30.50". The
    // code comes *first* here, which the pattern above cannot see — a 2Checkout
    // invoice writes every figure that way and so extracted no amounts at all,
    // leaving the matcher nothing to narrow candidates by.
    //
    // Horizontal whitespace only, never `\s`: a code routinely ends a line and
    // the next line starts with a number that is not an amount. Crossing the
    // newline read "0.00 USD⏎24% European VAT" as 24 and "4,29 EUR⏎11/2025" as
    // 11 — a VAT rate and a month, both landing in the candidate filter.
    new RegExp(`(?:${CURRENCY_CODES})\\b[)\\]]?[ \\t]*:?[ \\t]*([\\d.,]+)`, "g"),
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const raw = match[1];
      let val: number;

      // Detect European format: 1.234,56 or 34,37
      if (raw.includes(",") && (!raw.includes(".") || raw.lastIndexOf(",") > raw.lastIndexOf("."))) {
        // ...unless exactly three digits follow the last comma. A decimal comma
        // takes two — "34,37", "1.234,56" — so "30,000" is a US thousands
        // separator, not thirty. Read the European way it became 30, turning a
        // $30,000 invoice into a €30 one.
        if (raw.length - raw.lastIndexOf(",") - 1 === 3) {
          val = parseFloat(raw.replace(/[.,]/g, ""));
        } else {
          // European: dots are thousands, comma is decimal
          val = parseFloat(raw.replace(/\./g, "").replace(",", "."));
        }
      } else {
        // US format: commas are thousands, dot is decimal
        val = parseFloat(raw.replace(/,/g, ""));
      }

      if (!isNaN(val) && val > 0 && val < 100000) {
        amounts.add(Math.round(val * 100) / 100);
      }
    }
  }

  // Largest first: on a multi-line invoice the total is the biggest figure,
  // and callers that peek at amounts[0] want the total, not the first line item.
  // (An Apify payout invoice starts with a $952.42 line and totals $1,418.53.)
  return Array.from(amounts).sort((a, b) => b - a);
}

function extractDates(text: string): string[] {
  const dates = new Set<string>();

  // "25 January 2025" or "25th November 2025"
  // match[1]=day, match[2]=month name, match[3]=year
  const monthNamePattern = /(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})/gi;
  let match;
  while ((match = monthNamePattern.exec(text)) !== null) {
    const day = match[1].padStart(2, "0");
    const month = MONTH_MAP[match[2].toLowerCase()];
    const year = match[3];
    if (month) {
      dates.add(`${year}-${month}-${day}`);
    }
  }

  // "January 25, 2025" format (month first)
  const monthFirstPattern = /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/gi;
  while ((match = monthFirstPattern.exec(text)) !== null) {
    const month = MONTH_MAP[match[1].toLowerCase()];
    const day = match[2].padStart(2, "0");
    if (month) {
      dates.add(`${match[3]}-${month}-${day}`);
    }
  }

  // "2025-09-09" ISO format
  const isoPattern = /(\d{4})-(\d{2})-(\d{2})/g;
  while ((match = isoPattern.exec(text)) !== null) {
    const year = parseInt(match[1]);
    if (year >= 2024 && year <= 2026) {
      dates.add(match[0]);
    }
  }

  // "09/09/2025" or "09.09.2025" (DD/MM/YYYY)
  const slashPattern = /(\d{2})[./](\d{2})[./](\d{4})/g;
  while ((match = slashPattern.exec(text)) !== null) {
    const year = parseInt(match[3]);
    if (year >= 2024 && year <= 2026) {
      dates.add(`${match[3]}-${match[2]}-${match[1]}`);
    }
  }

  return Array.from(dates);
}

/**
 * Below this, a PDF has no usable text layer — it is a scan. A handful of
 * stray glyphs from page furniture is not a document we can match on.
 */
const MIN_TEXT = 20;

export async function extractPdfData(filePathOrBuffer: string | Buffer): Promise<PdfData> {
  const buf = typeof filePathOrBuffer === "string"
    ? readFileSync(filePathOrBuffer)
    : filePathOrBuffer;
  const parser = new PDFParse({ data: buf });
  const data = await parser.getText();
  await parser.destroy();
  let text = data.text;

  // Only scans reach the OCR path — 2 of 490 documents here — so the common
  // case never pays for it. The result is cached against the file's content
  // hash because extractPdfData runs on every /unmatched-pdfs request, and a
  // 20-second OCR pass per request would make that endpoint unusable.
  if (text.trim().length < MIN_TEXT && typeof filePathOrBuffer === "string") {
    const hash = createHash("sha1").update(buf).digest("hex");
    const cached = getCachedOcr(hash);
    if (cached !== null) {
      text = cached;
    } else {
      const ocr = ocrPdf(filePathOrBuffer);
      putCachedOcr(hash, ocr);
      if (ocr) console.log(`[ocr] read ${ocr.length} chars from ${filePathOrBuffer}`);
      text = ocr;
    }
  }

  return {
    amounts: extractAmounts(text),
    dates: extractDates(text),
    text: text.substring(0, 3000),
  };
}
