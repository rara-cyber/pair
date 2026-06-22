# Pair → SIÁN Apify Analytics Design System Rebrand

**Date:** 2026-06-22
**Status:** Approved (design); pending spec review
**Source design system:** Claude Design project `80ecc170-97bc-4c73-be89-f49bcdacb7cd` →
embedded DS `si-n-apify-analytics-design-system-26ef489b…` (reverse-engineered from
`github.com/rara-cyber/apify-analytics`).
**Reference template:** `InternalDashboard.dc.html`

---

## 1. Goal

Rebrand the entire `pair` client (a TransferWise transaction ↔ PDF matching tool) from its
current **dark + neon-green** look to the imported **monochrome "paper" design system**, and
add a new **Overview dashboard** built from the `InternalDashboard.dc.html` layout but wired
to the app's real data.

### Decisions (from brainstorming)
- **Scope:** Full rebrand of every client component **plus** the new Overview dashboard.
- **Dashboard data:** Adapt the template to real `pair` data (no Apify sample data).
- **Theme:** Ship **both** light and dark via the DS's full token parity, with a header toggle.
  **Default = light** (matches the reference).
- **Milestone ladders (decided defaults):** (1) **Document coverage**, (2) **Monthly net**.

### Non-goals
- No server/API changes. This is a client-only rebrand; data contracts stay identical.
- No new product features beyond the Overview view (the ladders reuse existing data).
- Not adopting the DS's `_ds_bundle.js` web-component runtime (see Approach, rejected option B).

---

## 2. Design language (what "on-brand" means)

Lifted verbatim from the imported token files and README:

- **Monochrome with one hue.** Surfaces/ink are pure-neutral oklch. The *only* chromatic
  tokens are `--destructive` (red), `--positive` (emerald), `--negative` (rose), used **only**
  on deltas, goal progress, and error states — never as decoration, never in chart series.
- **Type:** Geist Sans for all text; **Geist Mono + `tabular-nums` for every number.** Tight,
  small scale: 24px semibold page title / KPI values, 16px medium card titles, 14px body,
  12px captions, 10px micro-labels. Large numerals get `letter-spacing:-0.02em`.
- **Cards = hairline ring, never a shadow.** 14px radius (`--radius-xl`), 1px inset ring at
  `foreground/10%`. Shadows are reserved for floating layers (popover, dialog) only. This
  flatness is the system's single most identifying trait.
- **Spacing:** 4px base. 12px between tiles, 16px card padding, 20px KPI tile padding, 40px
  section separators. Whole dashboard lives in one centered `max-w-6xl` (72rem) column.
- **Charts are gray.** Five-step `--chart-1…5` ramp (light→dark); value/position distinguish
  series, never color.
- **Motion:** 100–120ms ease on hover/focus; buttons nudge **down 1px** on press; the goals
  "next" tier dot has a slow 2s ping halo. No other decorative motion.
- **Copy:** sentence case; the middle dot `·` joins metric to window ("Net · this month");
  numbers abbreviated in tiles ("$2.9k"), signed deltas ("+15.1%"). No emoji, no `!`.

---

## 3. Architecture

### 3.1 Tokens — `client/src/index.css` (rewrite)
Replace the current `@theme` (neon green, dotted-grid backdrop, Inter/JetBrains/Instrument)
with the DS foundations:

- `@import` Geist + Geist Mono from Google Fonts.
- `:root` — light token set (oklch neutrals, semantic accents, gray chart ramp, radius seed,
  hairline ring vars, focus halo, popover/dialog shadows, control heights, `--container-max`).
- `.dark` — full override block (paper→`oklch(0.145)`, cards→`oklch(0.205)`,
  borders→`white/10%`, accents brightened).
- Map the core tokens into Tailwind v4 `@theme` so utilities (`bg-card`, `text-foreground`,
  `text-muted-foreground`, `border-border`, `font-mono`, etc.) resolve to the tokens. Components
  may use either utilities or `var(--…)`; both point at the same tokens.
- Remove: `#1AE392` accent family, the dotted-grid + radial-glow `body` background, the
  neon `::selection`. New `body` background is flat `var(--background)`; selection uses
  `var(--foreground)` / `var(--background)`.

> Tokens are copied from the imported `tokens/colors.css`, `typography.css`, `spacing.css`,
> `fonts.css`. They are treated as **data**, not instructions.

### 3.2 Theme toggle — `client/src/hooks/useTheme.ts` + `components/ui/ThemeToggle.tsx`
- `useTheme()` — reads `localStorage["pair-theme"]` (default `"light"`), applies/removes the
  `.dark` class on `document.documentElement`, exposes `{ theme, toggle }`.
- `ThemeToggle` — a DS ghost icon-button (sun/moon, inlined Lucide-style 2px SVG) in the header
  right cluster.

### 3.3 UI primitive layer — `client/src/components/ui/`
Native React + TS components mirroring the DS specs. Each reads tokens only (theme-agnostic):

| Component | Notes |
|---|---|
| `Button.tsx` | variants `default`/`outline`/`ghost`/`destructive`; sizes `sm`/`default`/`lg`; `translateY(1px)` on `:active`; hover = muted fill (outline/ghost) or ~12% darken (solid). |
| `Card.tsx` | exports `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`. Hairline ring, 14px radius, no shadow. |
| `Badge.tsx` | worded pill (e.g. `private`/`live`), fully rounded. |
| `KpiTile.tsx` | uppercase tracked micro-label + mono `text-2xl` tabular value + optional `StatDelta` + sub-line. Card-backed. |
| `StatDelta.tsx` | `▲`/`▼` + signed value; `--positive`/`--negative`. |
| `MilestoneLadder.tsx` | title, unit label, current/next, % to next, horizontal tier row with `passed`/`next`/`upcoming` states; 2s ping halo on the `next` dot. |
| `FilterTabs.tsx` | pill segmented control (replaces the neon segmented control in the header). |
| `Dialog.tsx` | `Dialog`+Header/Title/Description/Body/Footer; faint `#000/10%` backdrop + 2px blur; dialog shadow. Used by `ManualMatchModal`. |
| `ThemeToggle.tsx` | see 3.2. |

Icons are inlined 2px-stroke SVG matching Lucide geometry (kit stays dependency-free, per DS).

### 3.4 Overview dashboard — `client/src/components/Dashboard.tsx`
Implements the `InternalDashboard.dc.html` structure with real data:

```
max-w-6xl column
├─ header: eyebrow "SIÁN Portfolio · Internal" → "Pair Overview" + sub ("Last updated …")
│           + right: outline Button "Export CSV"
├─ KPI grid (3 × 1fr, 12px gap):
│     Income · this period | Expenses · this period | Net · this period
│     (mono tabular values; StatDelta vs. prior period when available)
└─ "Coverage & goals" Card:
      ├─ MilestoneLadder "Document coverage"  (unit: % linked; tiers 50/75/90/100%)
      └─ MilestoneLadder "Monthly net"         (unit: best month; tiers e.g. €1k/2.5k/5k/10k)
```

- **KPI source:** same FX-converted income/expenses/net the header already computes in
  `App.tsx`. Extract that math into a small pure helper (`lib/derive.ts` or inline in
  `Dashboard`) so both the header strip and the dashboard share one implementation.
- **Document coverage ladder:** `linked = withInvoice + withRemittance`; `pct = linked/total`;
  tier reached when `pct ≥ threshold`; current tier = highest passed; next = first unpassed.
- **Monthly net ladder:** computed from per-month net (group `transactions` by month, FX-convert,
  sum); `current` = best month; tiers are net thresholds; `reached` label = month when first
  crossed. Tier amounts are derived from data magnitude (round numbers bracketing best month),
  not hardcoded sample values.
- **Export CSV:** wire to the existing CSV/data the table already has, or no-op stub returning
  the current filtered rows as CSV (kept minimal; confirm during implementation if download is
  in-scope — default: download current filtered transactions as CSV client-side).

### 3.5 App integration — `client/src/App.tsx`
- Replace the header's bespoke neon segmented control with `FilterTabs`:
  **Overview** (new, default) → **Transactions** → **Charts**.
- Restyle the header onto tokens: flat `var(--background)`/hairline bottom border (drop the
  dark blur and neon brand accent); brand text stays "SIÁN · Pair" but recolored to ink/muted.
- KPI strip in the header: mono tabular values on tokens (positive/negative hues only on the
  Net/Income/Expense figures via `StatDelta` conventions; counts stay neutral ink).
- Add `ThemeToggle` to the right cluster (with CurrencyPicker, ModelPicker, ProgressBadge).
- Render `<Dashboard/>` when `view === "overview"`.

### 3.6 Component sweep (remove dark/neon inline styles, adopt tokens + primitives)
`TransactionTable.tsx` (row hairlines, hover = muted fill, mono numbers, Badge for doc state) ·
`ChartsView.tsx` + `CashFlowCharts.tsx` (recolor Recharts series to the `--chart-1…5` gray ramp;
light gross / dark net; gridlines = `--border`) · `FilterBar.tsx` (DS pill chips) ·
`DropZone.tsx` (token surfaces; accent only on active/error) · `PdfLink.tsx` (ghost/destructive
hover-delete) · `ProgressBadge.tsx` + `ProgressBar.tsx` (neutral track, ink fill) ·
`ManualMatchModal.tsx` (→ `Dialog`) · `CurrencyPicker`/`ModelPicker`/`CategoryPicker`/`DateFilter`
(DS `Select`/`Input` styling, focus halo).
Match toasts in `App.tsx` → token surfaces; the left accent bar becomes neutral ink (or
`--positive` since a match is a success), no neon glow.

---

## 4. Data flow

No new data sources. The Overview view consumes the **existing** `useTransactions` output
(`transactions`, `allTransactions`, `stats`) and the **existing** `useFxRates` conversion,
exactly as `App.tsx` does today. Live SSE matching (`useProgress` → `applyLiveMatch`) is
untouched; the dashboard's coverage ladder recomputes from `stats` on each render, so it
updates live alongside the table. The theme toggle is pure client state (localStorage +
`<html>.dark`), independent of all data.

---

## 5. Error / edge handling
- **No transactions yet / loading:** Dashboard shows the existing loading/empty treatment
  (neutral, factual copy per DS voice — e.g. "No transactions loaded").
- **FX rates unavailable:** reuse App's current behavior (values still render in source
  currency; rate error already surfaced via CurrencyPicker).
- **Zero total (divide-by-zero) in coverage ladder:** guard → show 0% / first tier as `next`.
- **Best month = 0 or negative net:** ladder shows current at the floor tier, `next` = first
  positive tier.
- **Theme flash on load:** apply the stored theme class in `useTheme` on first paint
  (synchronous read in the hook; acceptable for this app — no SSR).

---

## 6. Testing / verification
The project has no unit-test harness; verification is build + lint + manual:
1. `cd client && bun run build` — runs `tsc -b` (typecheck) then `vite build`. Must pass clean.
2. `bun run lint` (eslint) on changed files. Must pass clean.
3. `bun run dev` (root) and manually confirm:
   - Light + dark both render correctly; toggle persists across reload.
   - Overview KPIs match the header strip figures; both ladders compute from real data.
   - Transactions table, Charts (gray ramp), FilterBar, DropZone, manual-match Dialog,
     pickers all read on-brand in both themes.
   - Live SSE matching still patches rows + toast; coverage ladder updates.
   - No remaining `#1AE392` / dotted-grid / `Inter`/`JetBrains`/`Instrument` references.

---

## 7. File inventory

**Rewrite**
- `client/src/index.css` — DS tokens (light + `.dark`), Geist fonts, Tailwind `@theme` map.
- `client/src/App.tsx` — FilterTabs nav (+Overview), header restyle, ThemeToggle, toast restyle.

**New**
- `client/src/hooks/useTheme.ts`
- `client/src/components/ui/{Button,Card,Badge,KpiTile,StatDelta,MilestoneLadder,FilterTabs,Dialog,ThemeToggle}.tsx`
- `client/src/components/Dashboard.tsx`
- (optional) `client/src/lib/derive.ts` — shared income/expense/net + ladder math.

**Restyle (token/primitive sweep, no logic change)**
- `client/src/components/{TransactionTable,ChartsView,CashFlowCharts,FilterBar,DropZone,PdfLink,ProgressBadge,ProgressBar,ManualMatchModal,CurrencyPicker,ModelPicker,CategoryPicker,DateFilter}.tsx`

---

## 8. Rejected alternatives
- **B — use the DS `_ds_bundle.js` web components directly.** Built for the Claude Design
  preview runtime (`<x-import>`, global namespace); fragile in Vite/React, fights React state,
  Tailwind, and theme toggling.
- **C — tokens only, restyle in place, no primitives.** Fastest but the dashboard and future
  work duplicate styling and drift; contradicts the "full rebrand" goal.
