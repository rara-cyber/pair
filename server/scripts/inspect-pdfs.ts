import { join } from "path";
import { readdirSync } from "fs";
import { extractPdfData } from "../services/pdfExtractor";

const INVOICES_DIR = join(__dirname, "../../invoices");

async function main() {
  const months = readdirSync(INVOICES_DIR).filter((d) => d.startsWith("20")).sort();

  for (const month of months) {
    const files = readdirSync(join(INVOICES_DIR, month)).filter(
      (f) => f.endsWith(".pdf") && !f.startsWith("Receipt-") && !f.startsWith("Refund-")
    );

    for (const file of files) {
      try {
        const data = await extractPdfData(join(INVOICES_DIR, month, file));
        if (data.amounts.length > 0 || data.dates.length > 0) {
          console.log(`${month}/${file}`);
          console.log(`  amounts: ${JSON.stringify(data.amounts)}`);
          console.log(`  dates:   ${JSON.stringify(data.dates)}`);
        }
      } catch (e: any) {
        console.log(`ERR: ${month}/${file}: ${e.message}`);
      }
    }
  }
}

main();
