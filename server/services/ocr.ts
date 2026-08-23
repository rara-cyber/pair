import { execFileSync } from "child_process";
import { mkdtempSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

/**
 * OCR for PDFs that carry no text layer — a scan or a photographed invoice.
 *
 * `pdf-parse` returns an empty string for those, so they extract no amounts and
 * no dates: the matcher gets nothing to narrow candidates by, and the manual
 * matching modal cannot search them at all.
 *
 * Shells out to poppler's `pdftoppm` and `tesseract` rather than pulling in
 * tesseract.js. Both are already installed here, the WASM build is ~10MB of
 * language data, and rasterising a PDF in-process would additionally need a
 * canvas with native bindings. If either binary is missing we return "" and the
 * caller behaves exactly as it did before OCR existed — this is a bonus path,
 * never a required one.
 */

let available: boolean | null = null;

/** Cached because it shells out, and the answer cannot change mid-process. */
export function ocrAvailable(): boolean {
  if (available !== null) return available;
  try {
    execFileSync("pdftoppm", ["-v"], { stdio: "ignore" });
    execFileSync("tesseract", ["--version"], { stdio: "ignore" });
    available = true;
  } catch {
    available = false;
    console.log("[ocr] pdftoppm or tesseract not found — scanned PDFs stay unreadable");
  }
  return available;
}

/** Pages beyond this are ignored: an invoice's total is never on page 9. */
const MAX_PAGES = 4;

/**
 * Render each page to PNG and read it. Returns "" on any failure — a document
 * we cannot OCR must not take the indexing pass down with it.
 */
export function ocrPdf(filePath: string): string {
  if (!ocrAvailable()) return "";

  const dir = mkdtempSync(join(tmpdir(), "pair-ocr-"));
  try {
    // 300 DPI is the resolution tesseract's models are trained around; 150
    // measurably drops digits from amounts, which is the one thing we need.
    execFileSync("pdftoppm", ["-png", "-r", "300", "-l", String(MAX_PAGES), filePath, join(dir, "page")], {
      stdio: "ignore",
      timeout: 60_000,
    });

    const pages = readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
    if (!pages.length) return "";

    const out: string[] = [];
    for (const page of pages) {
      const text = execFileSync("tesseract", [join(dir, page), "stdout"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 60_000,
        maxBuffer: 10 * 1024 * 1024,
      });
      out.push(text);
    }
    return out.join("\n");
  } catch (e) {
    console.log(`[ocr] failed on ${filePath}: ${e instanceof Error ? e.message : e}`);
    return "";
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
