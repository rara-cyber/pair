# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run both server and client concurrently
npm run dev

# Run server only (port 3001)
npm run dev:server

# Run client only (port 5173, proxies /api to 3001)
npm run dev:client

# Build everything
npm run build
```

Environment: requires `OPENROUTER_API_KEY` in `.env.local` at repo root.

## Architecture

**Monorepo** with `server/` (Express + TypeScript, tsx watch) and `client/` (React + Vite + Tailwind).

### Server (`server/`)

- `index.ts` — entry point; mounts routes, starts on port 3001
- `routes/api.ts` — all REST endpoints + SSE:
  - `GET /api/transactions`, `GET /api/progress` — data loading and SSE progress
  - `POST /api/match-pdf`, `DELETE /api/match` — upload/delete document matches
  - `POST /api/match-manual`, `GET /api/unmatched-pdfs` — manual matching workflow
  - `GET /api/pdf/documents/:year/:month/:type/:filename`, `GET /api/pdf/unmatched/:filename` — serve PDFs
- `services/csvParser.ts` — parses TransferWise CSVs from `account-statements/statement_2025-01-01_2025-12-31_csv/` into `Transaction[]`
- `services/pdfIndexer.ts` — scans `data/document-dump/` recursively for PDFs; extracts text/amounts/dates from each
- `services/pdfExtractor.ts` — extracts text from PDF buffers using `pdf-parse`
- `services/aiMatcher.ts` — AI-only matching via OpenRouter (`google/gemini-2.5-flash`); moves matched PDFs to `data/documents/{year}/{MM}/{Sales|Expenses}/`, unmatched to `data/document-unmatched/`; enriches empty transaction fields from matched PDF content
- `services/db.ts` — SQLite at `data/matches.db`; persists matches and enrichments across restarts; auto-migrates old `invoices/remittance` schema to `Sales/Expenses`
- `services/progress.ts` — EventEmitter-based progress state; `emitMatch` fires SSE events to clients
- `scripts/inspect-pdfs.ts` — utility for debugging PDF extraction (run with `npx tsx server/scripts/inspect-pdfs.ts`)

### Client (`client/src/`)

- `hooks/useTransactions.ts` — fetches transactions, manages sort/filter/documentFilter state; `applyLiveMatch` patches rows live from SSE; `applyDroppedMatch` patches after drag-and-drop
- `hooks/useProgress.ts` — `EventSource("/api/progress")` for SSE; calls `onMatch` callback on match events
- `components/TransactionTable.tsx` — main table with sort, filter, and document link columns
- `components/DropZone.tsx` — drag-and-drop PDF matching; calls `onTransactionUpdated` after successful match
- `components/PdfLink.tsx` — renders a PDF link with hover-delete (inline confirm)
- `components/ProgressBadge.tsx` — header badge showing live progress during AI matching
- `components/FilterBar.tsx` — displays active filters as removable chips
- `components/CashFlowCharts.tsx` — monthly cash flow visualization; clicking a month filters the table
- `components/ManualMatchModal.tsx` — modal for manually linking unmatched PDFs to transactions; fetches `/api/unmatched-pdfs`, previews via `/api/pdf/unmatched/:filename`, submits to `/api/match-manual`

### Data Directories

```
data/
  document-dump/       ← drop PDFs here for AI matching (input)
  document-unmatched/  ← PDFs the AI could not match
  documents/           ← organized archive after matching
    {year}/{MM}/Sales/
    {year}/{MM}/Expenses/
  matches.db           ← SQLite persistence
account-statements/
  statement_2025-01-01_2025-12-31_csv/  ← TransferWise CSV exports
```

### Data Flow

1. Server starts → `loadData()` reads CSVs, indexes `document-dump/` PDFs, returns transactions with empty links immediately → `cachedData` set
2. AI matching runs in background → each match moves the PDF to `documents/`, emits SSE `match` event → client patches the row live
3. Matches and enrichments persisted in SQLite → subsequent server restarts skip already-matched PDFs (matched files are no longer in `document-dump/`)

### Rematch

`GET /api/transactions?rematch=true` clears all DB records and re-processes all PDFs currently in `document-dump/`. Already-moved files are absent from the dump, so manually move them back if needed.

### Manual Matching

When AI fails to match a PDF, it lands in `document-unmatched/`. Users can manually link via `ManualMatchModal`:
1. Modal fetches unmatched PDFs with extracted metadata (dates, amounts, preview text)
2. User selects PDF → preview renders in iframe
3. Submit calls `POST /api/match-manual` → moves file to `documents/{year}/{MM}/{type}/`, persists to DB, emits SSE

### Key Invariants

- **One document per transaction** — enforced by `docMap: Map<transferWiseId, PdfLink | null>` (server), DB restore skips duplicates, client `applyLiveMatch` checks `hasDoc`
- **One match per PDF filename** — `claimedDocs: Set<string>` prevents same PDF from matching multiple transactions
- `linkType: "Sales" | "Expenses"` on `PdfLink` — `"Expenses"` for negative amounts (invoices paid), `"Sales"` for positive (remittances received); determines archive folder and which array (`invoiceLinks` / `remittanceLinks`) the link appears in
- Candidate window for AI matching: PDFs with a detected date match against transactions ±1 month; PDFs with no date match against all transactions
