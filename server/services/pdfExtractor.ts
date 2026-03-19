import { readFileSync } from "fs";
import { PDFParse } from "pdf-parse";

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

function extractAmounts(text: string): number[] {
  const amounts = new Set<number>();

  // Match patterns like $58.28, €30.50, 34.37 EUR, 61.29 USD, 13,55 USD
  // Also: $1,234.56 and €1.234,56 (European format)
  const patterns = [
    // $123.45 or €123.45 or £123.45 (with optional thousands separators)
    /[$€£]\s?([\d,]+\.?\d*)/g,
    // 123.45 USD/EUR/GBP or 123,45 USD/EUR/GBP
    /([\d.,]+)\s*(?:USD|EUR|GBP|CZK)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const raw = match[1];
      let val: number;

      // Detect European format: 1.234,56 or 34,37
      if (raw.includes(",") && (!raw.includes(".") || raw.lastIndexOf(",") > raw.lastIndexOf("."))) {
        // European: dots are thousands, comma is decimal
        val = parseFloat(raw.replace(/\./g, "").replace(",", "."));
      } else {
        // US format: commas are thousands, dot is decimal
        val = parseFloat(raw.replace(/,/g, ""));
      }

      if (!isNaN(val) && val > 0 && val < 100000) {
        amounts.add(Math.round(val * 100) / 100);
      }
    }
  }

  return Array.from(amounts);
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

export async function extractPdfData(filePathOrBuffer: string | Buffer): Promise<PdfData> {
  const buf = typeof filePathOrBuffer === "string"
    ? readFileSync(filePathOrBuffer)
    : filePathOrBuffer;
  const parser = new PDFParse({ data: buf });
  const data = await parser.getText();
  await parser.destroy();
  const text = data.text;

  return {
    amounts: extractAmounts(text),
    dates: extractDates(text),
    text: text.substring(0, 3000),
  };
}
