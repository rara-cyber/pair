# Monochrome Design-System Rebrand — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the `pair` client from dark+neon-green to the imported monochrome "paper" design system (light + dark), and add an Overview dashboard (from `InternalDashboard.dc.html`) wired to real data.

**Architecture:** Token-first. Rewrite `client/src/index.css` with the DS oklch tokens (light `:root` + `.dark`), Geist fonts, and a Tailwind v4 `@theme` map; keep **temporary legacy `--color-*` aliases** pointing at the new tokens so existing components keep rendering during the sweep. Build a `components/ui/` primitive layer mirroring the DS, compose the Overview dashboard from it, then sweep every existing component onto tokens/primitives, and finally delete the legacy aliases.

**Tech Stack:** React 19 + TypeScript, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), Recharts 3. No server changes.

## Global Constraints

- **Package manager: `bun`** (e.g. `bunx tsc -b`, `bun run lint`, `bun run dev`). Never `npm`.
- **No new runtime dependencies.** Icons are inlined 2px-stroke SVG (Lucide-style); no `lucide-react`. Charts keep the existing Recharts dependency.
- **Monochrome rule.** The only chromatic tokens are `--destructive` / `--positive` / `--negative`, used **only** on deltas, goal progress, and error states — never decoration, never as chart series. Chart series use the gray `--chart-1…5` ramp.
- **Numbers** render in `var(--font-mono)` (Geist Mono) with `font-variant-numeric: tabular-nums`.
- **Cards** = 14px radius (`--radius-xl`) + 1px hairline ring `var(--ring-card)`, **never a shadow**. Shadows only on popover/dialog.
- **Copy:** sentence case; middle dot `·` joins metric→window; deltas carry an explicit sign (`+15.1%`); no emoji, no `!`.
- **Theme:** `.dark` class toggled on `document.documentElement`; default **light**; persisted to `localStorage["pair-theme"]`.
- **Client-only.** Do not change `server/`, the data hooks' logic, or API contracts. Restyle = visual change only.
- **Per-task verify gate** (no unit-test harness exists in this repo): from repo root unless noted —
  1. `cd client && bunx tsc -b` → expect **0 errors**.
  2. `cd client && bunx eslint <changed files>` → expect **0 errors/warnings**.
  3. Manual visual check per the task's "Verify" note in `bun run dev` (light **and** dark).
  Then commit.

---

## File Structure

**Rewrite**
- `client/src/index.css` — DS tokens (`:root` + `.dark`), Geist fonts, Tailwind `@theme` color map, keyframes, temporary legacy aliases.
- `client/src/App.tsx` — Overview tab (default) via `FilterTabs`, render `<Dashboard>`, header restyle, mount `ThemeToggle`, restyle toasts.

**New**
- `client/src/hooks/useTheme.ts`
- `client/src/lib/derive.ts`
- `client/src/components/ui/Button.tsx`
- `client/src/components/ui/Card.tsx`
- `client/src/components/ui/Badge.tsx`
- `client/src/components/ui/StatDelta.tsx`
- `client/src/components/ui/KpiTile.tsx`
- `client/src/components/ui/MilestoneLadder.tsx`
- `client/src/components/ui/FilterTabs.tsx`
- `client/src/components/ui/Dialog.tsx`
- `client/src/components/ui/ThemeToggle.tsx`
- `client/src/components/Dashboard.tsx`

**Restyle (token/primitive sweep, no logic change)**
- `client/src/components/{TransactionTable,ChartsView,CashFlowCharts,FilterBar,DropZone,PdfLink,ProgressBadge,ProgressBar,ManualMatchModal,CurrencyPicker,ModelPicker,CategoryPicker,DateFilter}.tsx`

### Legacy → DS token mapping (used by every sweep task)

| Legacy `var(--color-*)` | Replace with | Notes |
|---|---|---|
| `--color-bg`, `--color-dark` | `var(--background)` | page paper |
| `--color-fg`, `--color-white` | `var(--foreground)` | primary ink |
| `--color-fg-muted` | `var(--muted-foreground)` | secondary text |
| `--color-fg-subtle` | `var(--muted-foreground)` | labels/captions |
| `--color-elev-1` | `var(--card)` | card surface |
| `--color-elev-2` | `var(--muted)` | secondary fill |
| `--color-border-dim`, `--color-border-faint` | `var(--border)` | hairlines |
| `--color-danger` | `var(--destructive)` | errors/delete |
| `--color-danger-soft` | `color-mix(in oklab, var(--destructive) 14%, transparent)` | soft error fill |
| `--color-warn` | `var(--muted-foreground)` | DS has no warn hue → neutral |
| `--color-accent` (+ `-90/-25/-10/-06`) | `var(--foreground)` / `color-mix(... foreground N%)` | **neon removed**; for *active controls* use `var(--primary)` + `var(--primary-foreground)` (or `FilterTabs`) |
| `--font-serif` | `var(--font-sans)` | DS has no serif |
| `--font-sans` (Inter) / `--font-mono` (JetBrains) | unchanged names → now Geist / Geist Mono | redefined in Task 1 |

**KPI/value coloring rule during sweeps:** counts (Tx/Linked/Missing) render in `var(--foreground)` (neutral ink); income/expenses/net values render neutral ink, and only a **delta** or the **net sign** may use `var(--positive)`/`var(--negative)`. Drop neon-green from "Linked" and amber from "Missing".

---

## Task 1: Design tokens, fonts & legacy aliases (`index.css`)

**Files:**
- Rewrite: `client/src/index.css`

**Interfaces:**
- Produces: CSS custom properties on `:root` and `.dark` — `--background --foreground --card --card-foreground --popover --popover-foreground --primary --primary-foreground --secondary --secondary-foreground --muted --muted-foreground --accent --accent-foreground --border --input --ring --destructive --positive --positive-fg --negative --negative-fg --chart-1..5 --sidebar*`; type tokens `--font-sans --font-mono --font-heading` + scale; spacing/radius `--radius --radius-sm..4xl --radius-full`, `--ring-card --ring-focus --shadow-popover --shadow-dialog --container-max`; keyframes `ds-ping`, `pulse`. Tailwind utilities `bg-background bg-card bg-muted text-foreground text-muted-foreground border-border` etc. Temporary legacy `--color-*` aliases.

- [ ] **Step 1: Rewrite `client/src/index.css`**

```css
@import url("https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap");
@import "tailwindcss";

/* ---- DS tokens — light (default) ---------------------------------------- */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --positive: oklch(0.596 0.145 163.225);
  --positive-fg: oklch(0.696 0.17 162.48);
  --negative: oklch(0.586 0.222 17.585);
  --negative-fg: oklch(0.645 0.246 16.439);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-border: oklch(0.922 0 0);

  /* type */
  --font-sans: "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --font-heading: var(--font-sans);

  /* shape / depth */
  --radius: 0.625rem;
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-4xl: calc(var(--radius) * 2.6);
  --radius-full: 9999px;
  --ring-card: 1px solid color-mix(in oklab, var(--foreground) 10%, transparent);
  --ring-focus: 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent);
  --shadow-popover: 0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.06);
  --shadow-dialog: 0 10px 30px -10px rgb(0 0 0 / 0.18);
  --container-max: 72rem;

  /* ---- TEMPORARY legacy aliases — removed in Task 12 ------------------- */
  --color-bg: var(--background);
  --color-dark: var(--background);
  --color-fg: var(--foreground);
  --color-white: var(--foreground);
  --color-fg-muted: var(--muted-foreground);
  --color-fg-subtle: var(--muted-foreground);
  --color-elev-1: var(--card);
  --color-elev-2: var(--muted);
  --color-border-dim: var(--border);
  --color-border-faint: var(--border);
  --color-danger: var(--destructive);
  --color-danger-soft: color-mix(in oklab, var(--destructive) 14%, transparent);
  --color-warn: var(--muted-foreground);
  --color-accent: var(--foreground);
  --color-accent-90: color-mix(in oklab, var(--foreground) 90%, transparent);
  --color-accent-25: color-mix(in oklab, var(--foreground) 25%, transparent);
  --color-accent-10: color-mix(in oklab, var(--foreground) 10%, transparent);
  --color-accent-06: color-mix(in oklab, var(--foreground) 6%, transparent);
  --font-serif: var(--font-sans);
}

/* ---- DS tokens — dark --------------------------------------------------- */
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --positive: oklch(0.696 0.17 162.48);
  --positive-fg: oklch(0.696 0.17 162.48);
  --negative: oklch(0.645 0.246 16.439);
  --negative-fg: oklch(0.645 0.246 16.439);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
}

/* ---- Tailwind v4 color map (so bg-card / text-muted-foreground work) ---- */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-destructive: var(--destructive);
  --color-positive: var(--positive);
  --color-negative: var(--negative);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
}

@keyframes ds-ping {
  75%, 100% { transform: scale(2); opacity: 0; }
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--positive) 45%, transparent); }
  70% { box-shadow: 0 0 0 6px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}

body {
  margin: 0;
  background-color: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
}
::selection { background: var(--foreground); color: var(--background); }
#root { min-height: 100vh; }
```

- [ ] **Step 2: Typecheck + lint**

Run: `cd client && bunx tsc -b && bunx eslint src/index.css` (eslint will skip CSS; tsc must pass). Expected: 0 errors.

- [ ] **Step 3: Manual verify**

Run `bun run dev`. The app loads in **light** monochrome: white background, near-black text, **no neon green, no dotted grid**. Existing components still render (via legacy aliases) but now grayscale. Temporarily add `class="dark"` to `<html>` in devtools → everything inverts to the dark paper palette.

- [ ] **Step 4: Commit**

```bash
git add client/src/index.css
git commit -m "feat(design): swap index.css to monochrome DS tokens + legacy aliases"
```

---

## Task 2: Theme hook + toggle

**Files:**
- Create: `client/src/hooks/useTheme.ts`
- Create: `client/src/components/ui/ThemeToggle.tsx`
- Modify: `client/src/App.tsx` (call `useTheme`, mount `<ThemeToggle>` in the header right cluster)

**Interfaces:**
- Produces: `useTheme(): { theme: "light" | "dark"; toggle: () => void }`; `<ThemeToggle theme toggle />`.

- [ ] **Step 1: Create `client/src/hooks/useTheme.ts`**

```ts
import { useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark";

function readInitial(): Theme {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem("pair-theme") === "dark" ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readInitial);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("pair-theme", theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle };
}
```

- [ ] **Step 2: Create `client/src/components/ui/ThemeToggle.tsx`**

```tsx
import type { Theme } from "../../hooks/useTheme";

interface Props {
  theme: Theme;
  toggle: () => void;
}

export function ThemeToggle({ theme, toggle }: Props) {
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
      style={{
        width: "32px", height: "32px", display: "grid", placeItems: "center",
        borderRadius: "var(--radius-lg)", border: "1px solid var(--border)",
        background: "transparent", color: "var(--muted-foreground)", cursor: "pointer",
        transition: "background 120ms ease, color 120ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--muted)"; e.currentTarget.style.color = "var(--foreground)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--muted-foreground)"; }}
    >
      {isDark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
```

- [ ] **Step 3: Wire into `App.tsx`**

Add imports near the other hook/component imports:
```tsx
import { useTheme } from "./hooks/useTheme";
import { ThemeToggle } from "./components/ui/ThemeToggle";
```
Inside `function App()`, near the other hooks (e.g. after `const { rates, ... } = useFxRates();`):
```tsx
const { theme, toggle: toggleTheme } = useTheme();
```
In the header **right cluster** `<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>` (currently holding CurrencyPicker/ModelPicker/ProgressBadge), add as the first child:
```tsx
<ThemeToggle theme={theme} toggle={toggleTheme} />
```

- [ ] **Step 4: Verify gate**

`cd client && bunx tsc -b && bunx eslint src/hooks/useTheme.ts src/components/ui/ThemeToggle.tsx src/App.tsx` → 0 errors. In `bun run dev`, clicking the toggle flips light/dark; reload preserves the choice.

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useTheme.ts client/src/components/ui/ThemeToggle.tsx client/src/App.tsx
git commit -m "feat(design): theme toggle (light/dark) with persistence"
```

---

## Task 3: Core primitives — Button, Card, Badge

**Files:**
- Create: `client/src/components/ui/Button.tsx`, `client/src/components/ui/Card.tsx`, `client/src/components/ui/Badge.tsx`

**Interfaces:**
- Produces:
  - `<Button variant? size? …buttonProps>` — `variant: "default"|"outline"|"ghost"|"destructive"` (default `"default"`), `size: "sm"|"default"|"lg"` (default `"default"`).
  - `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` — all `(props: {children, style?, className?}) => JSX`.
  - `<Badge variant? children>` — `variant: "default"|"outline"` (default `"outline"`).

- [ ] **Step 1: Create `client/src/components/ui/Button.tsx`**

```tsx
import type { ButtonHTMLAttributes, CSSProperties } from "react";

type Variant = "default" | "outline" | "ghost" | "destructive";
type Size = "sm" | "default" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const SIZES: Record<Size, CSSProperties> = {
  sm: { height: "1.75rem", padding: "0 0.625rem", fontSize: "var(--text-sm, 0.875rem)" },
  default: { height: "2rem", padding: "0 0.875rem", fontSize: "var(--text-sm, 0.875rem)" },
  lg: { height: "2.25rem", padding: "0 1.125rem", fontSize: "1rem" },
};

const VARIANTS: Record<Variant, CSSProperties> = {
  default: { background: "var(--primary)", color: "var(--primary-foreground)", border: "1px solid transparent" },
  outline: { background: "transparent", color: "var(--foreground)", border: "1px solid var(--border)" },
  ghost: { background: "transparent", color: "var(--foreground)", border: "1px solid transparent" },
  destructive: { background: "var(--destructive)", color: "oklch(0.985 0 0)", border: "1px solid transparent" },
};

export function Button({ variant = "default", size = "default", style, onMouseDown, onMouseUp, ...rest }: Props) {
  return (
    <button
      {...rest}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
        fontFamily: "var(--font-sans)", fontWeight: 500, lineHeight: 1, whiteSpace: "nowrap",
        borderRadius: "var(--radius-lg)", cursor: "pointer",
        transition: "background 120ms ease, color 120ms ease, transform 80ms ease",
        ...SIZES[size], ...VARIANTS[variant], ...style,
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = "translateY(1px)"; onMouseDown?.(e); }}
      onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(0)"; onMouseUp?.(e); }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
    />
  );
}
```

- [ ] **Step 2: Create `client/src/components/ui/Card.tsx`**

```tsx
import type { CSSProperties, ReactNode } from "react";

interface BoxProps { children?: ReactNode; style?: CSSProperties; className?: string; }

export function Card({ children, style, className }: BoxProps) {
  return (
    <div className={className} style={{
      background: "var(--card)", color: "var(--card-foreground)",
      borderRadius: "var(--radius-xl)", boxShadow: "var(--ring-card)",
      padding: "1rem", ...style,
    }}>{children}</div>
  );
}

export function CardHeader({ children, style }: BoxProps) {
  return <div style={{ marginBottom: "0.75rem", ...style }}>{children}</div>;
}
export function CardTitle({ children, style }: BoxProps) {
  return <div style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: 500, ...style }}>{children}</div>;
}
export function CardDescription({ children, style }: BoxProps) {
  return <div style={{ fontSize: "0.875rem", color: "var(--muted-foreground)", ...style }}>{children}</div>;
}
export function CardContent({ children, style }: BoxProps) {
  return <div style={style}>{children}</div>;
}
export function CardFooter({ children, style }: BoxProps) {
  return <div style={{ marginTop: "0.75rem", ...style }}>{children}</div>;
}
```

> Note: `Card` uses `boxShadow` for the hairline ring on purpose — `--ring-card` is a 1px inset-style ring, which is the DS's "no drop shadow" card treatment. Real shadows (`--shadow-dialog`) appear only in `Dialog`.

- [ ] **Step 3: Create `client/src/components/ui/Badge.tsx`**

```tsx
import type { ReactNode, CSSProperties } from "react";

interface Props { children: ReactNode; variant?: "default" | "outline"; style?: CSSProperties; }

export function Badge({ children, variant = "outline", style }: Props) {
  const base: CSSProperties = variant === "default"
    ? { background: "var(--secondary)", color: "var(--secondary-foreground)", border: "1px solid transparent" }
    : { background: "transparent", color: "var(--muted-foreground)", border: "1px solid var(--border)" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.25rem",
      fontFamily: "var(--font-sans)", fontSize: "0.75rem", fontWeight: 500, lineHeight: 1,
      padding: "0.1875rem 0.5rem", borderRadius: "var(--radius-full)", whiteSpace: "nowrap",
      ...base, ...style,
    }}>{children}</span>
  );
}
```

- [ ] **Step 4: Verify gate**

`cd client && bunx tsc -b && bunx eslint src/components/ui/Button.tsx src/components/ui/Card.tsx src/components/ui/Badge.tsx` → 0 errors. (Visual verification happens in Task 6 where they're first rendered.)

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ui/Button.tsx client/src/components/ui/Card.tsx client/src/components/ui/Badge.tsx
git commit -m "feat(ui): Button, Card, Badge primitives"
```

---

## Task 4: Data primitives — StatDelta, KpiTile, MilestoneLadder

**Files:**
- Create: `client/src/components/ui/StatDelta.tsx`, `client/src/components/ui/KpiTile.tsx`, `client/src/components/ui/MilestoneLadder.tsx`

**Interfaces:**
- Consumes: `Card` from `./Card`.
- Produces:
  - `<StatDelta value: string; positive: boolean />` — renders `▲`/`▼` + value in positive/negative hue.
  - `<KpiTile label: string; value: string; delta?: { value: string; positive: boolean } | null; sub?: string />`.
  - Types `TierStatus = "passed" | "next" | "upcoming"`, `Tier = { label: string; status: TierStatus; reached?: string }`, and `<MilestoneLadder title: string; unitLabel: string; current: string; nextLabel?: string; pctToNext: number; tiers: Tier[] />`.

- [ ] **Step 1: Create `client/src/components/ui/StatDelta.tsx`**

```tsx
interface Props { value: string; positive: boolean; }

export function StatDelta({ value, positive }: Props) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.1875rem",
      fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 500,
      fontVariantNumeric: "tabular-nums",
      color: positive ? "var(--positive-fg)" : "var(--negative-fg)",
    }}>
      <span aria-hidden style={{ fontSize: "0.625rem" }}>{positive ? "▲" : "▼"}</span>
      {value}
    </span>
  );
}
```

- [ ] **Step 2: Create `client/src/components/ui/KpiTile.tsx`**

```tsx
import { Card } from "./Card";
import { StatDelta } from "./StatDelta";

interface Props {
  label: string;
  value: string;
  delta?: { value: string; positive: boolean } | null;
  sub?: string;
}

export function KpiTile({ label, value, delta, sub }: Props) {
  return (
    <Card style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      <div style={{
        fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.05em",
        textTransform: "uppercase", color: "var(--muted-foreground)",
      }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "1.5rem", fontWeight: 500,
          letterSpacing: "-0.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums",
          color: "var(--foreground)",
        }}>{value}</span>
        {delta && <StatDelta value={delta.value} positive={delta.positive} />}
      </div>
      {sub && <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{sub}</div>}
    </Card>
  );
}
```

- [ ] **Step 3: Create `client/src/components/ui/MilestoneLadder.tsx`**

```tsx
export type TierStatus = "passed" | "next" | "upcoming";
export interface Tier { label: string; status: TierStatus; reached?: string; }

interface Props {
  title: string;
  unitLabel: string;
  current: string;
  nextLabel?: string;
  pctToNext: number; // 0..100
  tiers: Tier[];
}

export function MilestoneLadder({ title, unitLabel, current, nextLabel, pctToNext, tiers }: Props) {
  const pct = Math.max(0, Math.min(100, pctToNext));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.5rem" }}>
        <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--foreground)" }}>{title}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--muted-foreground)", fontVariantNumeric: "tabular-nums" }}>
          <span style={{ color: "var(--foreground)" }}>{current}</span>
          <span> · {unitLabel}</span>
          {nextLabel && <span> → {nextLabel}</span>}
        </div>
      </div>

      {/* progress track */}
      <div style={{ height: "6px", borderRadius: "var(--radius-full)", background: "var(--muted)", overflow: "hidden", marginBottom: "0.75rem" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "var(--positive)", borderRadius: "var(--radius-full)", transition: "width 200ms ease" }} />
      </div>

      {/* tier dots */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
        {tiers.map((t, i) => {
          const dotColor = t.status === "upcoming" ? "var(--border)" : "var(--foreground)";
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem", flex: 1, minWidth: 0 }}>
              <span style={{ position: "relative", width: "10px", height: "10px", display: "grid", placeItems: "center" }}>
                {t.status === "next" && (
                  <span style={{ position: "absolute", inset: 0, borderRadius: "var(--radius-full)", background: "color-mix(in oklab, var(--positive) 60%, transparent)", animation: "ds-ping 2s cubic-bezier(0,0,0.2,1) infinite" }} />
                )}
                <span style={{ width: "8px", height: "8px", borderRadius: "var(--radius-full)", background: t.status === "next" ? "var(--positive)" : dotColor, position: "relative" }} />
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontVariantNumeric: "tabular-nums", color: t.status === "upcoming" ? "var(--muted-foreground)" : "var(--foreground)", textAlign: "center" }}>{t.label}</span>
              {t.reached && <span style={{ fontSize: "0.625rem", color: "var(--muted-foreground)", textAlign: "center" }}>{t.reached}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify gate**

`cd client && bunx tsc -b && bunx eslint src/components/ui/StatDelta.tsx src/components/ui/KpiTile.tsx src/components/ui/MilestoneLadder.tsx` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ui/StatDelta.tsx client/src/components/ui/KpiTile.tsx client/src/components/ui/MilestoneLadder.tsx
git commit -m "feat(ui): StatDelta, KpiTile, MilestoneLadder primitives"
```

---

## Task 5: Nav & feedback primitives — FilterTabs, Dialog

**Files:**
- Create: `client/src/components/ui/FilterTabs.tsx`, `client/src/components/ui/Dialog.tsx`

**Interfaces:**
- Produces:
  - `<FilterTabs<T> tabs: { value: T; label: string }[]; value: T; onChange: (v: T) => void />` (generic over a string union).
  - `Dialog`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogBody`, `DialogFooter`. `Dialog` props: `{ open: boolean; onClose: () => void; children; width?: string }`.

- [ ] **Step 1: Create `client/src/components/ui/FilterTabs.tsx`**

```tsx
interface Tab<T extends string> { value: T; label: string; }
interface Props<T extends string> { tabs: Tab<T>[]; value: T; onChange: (v: T) => void; }

export function FilterTabs<T extends string>({ tabs, value, onChange }: Props<T>) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: "2px", padding: "3px",
      border: "1px solid var(--border)", borderRadius: "var(--radius-full)", background: "var(--card)",
    }}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            style={{
              fontFamily: "var(--font-sans)", fontSize: "0.75rem", fontWeight: 500,
              padding: "0.375rem 0.875rem", borderRadius: "var(--radius-full)", border: "none", cursor: "pointer",
              background: active ? "var(--primary)" : "transparent",
              color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
              transition: "background 120ms ease, color 120ms ease",
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--muted)"; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
          >{t.label}</button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create `client/src/components/ui/Dialog.tsx`**

```tsx
import type { CSSProperties, ReactNode } from "react";

interface DialogProps { open: boolean; onClose: () => void; children: ReactNode; width?: string; }
interface BoxProps { children?: ReactNode; style?: CSSProperties; }

export function Dialog({ open, onClose, children, width = "640px" }: DialogProps) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", padding: "1.5rem",
        background: "rgba(0,0,0,0.10)", backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: width, maxHeight: "90vh", overflow: "auto",
          background: "var(--popover)", color: "var(--popover-foreground)",
          borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)",
          border: "1px solid var(--border)", padding: "1.25rem",
        }}
      >{children}</div>
    </div>
  );
}

export function DialogHeader({ children, style }: BoxProps) {
  return <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", ...style }}>{children}</div>;
}
export function DialogTitle({ children, style }: BoxProps) {
  return <div style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: 500, ...style }}>{children}</div>;
}
export function DialogDescription({ children, style }: BoxProps) {
  return <div style={{ fontSize: "0.875rem", color: "var(--muted-foreground)", ...style }}>{children}</div>;
}
export function DialogBody({ children, style }: BoxProps) {
  return <div style={style}>{children}</div>;
}
export function DialogFooter({ children, style }: BoxProps) {
  return <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end", gap: "0.5rem", ...style }}>{children}</div>;
}
```

- [ ] **Step 3: Verify gate**

`cd client && bunx tsc -b && bunx eslint src/components/ui/FilterTabs.tsx src/components/ui/Dialog.tsx` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/ui/FilterTabs.tsx client/src/components/ui/Dialog.tsx
git commit -m "feat(ui): FilterTabs and Dialog primitives"
```

---

## Task 6: Derive helpers + Overview Dashboard

**Files:**
- Create: `client/src/lib/derive.ts`
- Create: `client/src/components/Dashboard.tsx`

**Interfaces:**
- Consumes: `Transaction` from `../types`; `FxRates`, `convertAmount`, `CURRENCY_SYMBOLS` from `../hooks/useFxRates`; `KpiTile`, `MilestoneLadder` (+ `Tier`), `Card`/`CardContent`, `Button` primitives.
- Produces (`derive.ts`):
  - `fmtAbbrev(value: number, currency: string): string` — e.g. `€2.9k` / `€-420`.
  - `periodTotals(txns, base, rates): { income: number; expenses: number; net: number }`.
  - `monthlyNet(txns, base, rates): { month: string; net: number }[]` sorted ascending by month.
  - `coverageLadder(stats): { title; unitLabel; current; nextLabel?; pctToNext; tiers }` (a `MilestoneLadder`-ready object).
  - `monthlyNetLadder(txns, base, rates): { title; unitLabel; current; nextLabel?; pctToNext; tiers }`.
  - `kpisFor(txns, base, rates): { income; expenses; net }` with current-month values + prior-month deltas, shaped as `{ value: string; delta: {value;positive}|null; sub: string }` per metric.

- [ ] **Step 1: Create `client/src/lib/derive.ts`**

```ts
import type { Transaction } from "../types";
import { convertAmount, CURRENCY_SYMBOLS, type FxRates } from "../hooks/useFxRates";

export function sym(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? `${currency} `;
}

export function fmtAbbrev(value: number, currency: string): string {
  const s = sym(currency);
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1000) return `${sign}${s}${(abs / 1000).toFixed(1)}k`;
  return `${sign}${s}${abs.toFixed(0)}`;
}

function monthKey(t: Transaction): string {
  // tx.date is an ISO-ish date string (YYYY-MM-DD…); fall back to Date parsing.
  if (/^\d{4}-\d{2}/.test(t.date)) return t.date.slice(0, 7);
  const d = new Date(t.date);
  return Number.isNaN(d.getTime()) ? "unknown" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  // "2026-03" -> "Mar '26"
  const [y, m] = key.split("-");
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const idx = Number(m) - 1;
  if (!y || Number.isNaN(idx) || idx < 0 || idx > 11) return key;
  return `${names[idx]} '${y.slice(2)}`;
}

export function periodTotals(txns: Transaction[], base: string, rates: FxRates | null) {
  let income = 0, expenses = 0;
  for (const t of txns) {
    const v = convertAmount(t.amount, t.currency, base, rates);
    if (v >= 0) income += v; else expenses += v;
  }
  return { income, expenses, net: income + expenses };
}

export function monthlyNet(txns: Transaction[], base: string, rates: FxRates | null) {
  const map = new Map<string, number>();
  for (const t of txns) {
    const k = monthKey(t);
    map.set(k, (map.get(k) ?? 0) + convertAmount(t.amount, t.currency, base, rates));
  }
  return [...map.entries()]
    .filter(([k]) => k !== "unknown")
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, net]) => ({ month, net }));
}

export interface LadderData {
  title: string; unitLabel: string; current: string;
  nextLabel?: string; pctToNext: number;
  tiers: { label: string; status: "passed" | "next" | "upcoming"; reached?: string }[];
}

export function coverageLadder(stats: { total: number; withInvoice: number; withRemittance: number }): LadderData {
  const linked = stats.withInvoice + stats.withRemittance;
  const pct = stats.total > 0 ? (linked / stats.total) * 100 : 0;
  const thresholds = [50, 75, 90, 100];
  let nextSet = false;
  const tiers = thresholds.map((th) => {
    if (pct >= th) return { label: `${th}%`, status: "passed" as const };
    if (!nextSet) { nextSet = true; return { label: `${th}%`, status: "next" as const }; }
    return { label: `${th}%`, status: "upcoming" as const };
  });
  const next = thresholds.find((th) => pct < th);
  return {
    title: "Document coverage",
    unitLabel: `${linked} of ${stats.total} linked`,
    current: `${Math.round(pct)}%`,
    nextLabel: next ? `${next}%` : undefined,
    pctToNext: next ? (pct / next) * 100 : 100,
    tiers,
  };
}

export function monthlyNetLadder(txns: Transaction[], base: string, rates: FxRates | null): LadderData {
  const months = monthlyNet(txns, base, rates);
  const best = months.reduce((m, x) => (x.net > m.net ? x : m), { month: "", net: 0 });
  const thresholds = [1000, 2500, 5000, 10000]; // base-currency net milestones
  let nextSet = false;
  const tiers = thresholds.map((th) => {
    if (best.net >= th) {
      const firstHit = months.find((x) => x.net >= th);
      return { label: fmtAbbrev(th, base), status: "passed" as const, reached: firstHit ? monthLabel(firstHit.month) : undefined };
    }
    if (!nextSet) { nextSet = true; return { label: fmtAbbrev(th, base), status: "next" as const }; }
    return { label: fmtAbbrev(th, base), status: "upcoming" as const };
  });
  const next = thresholds.find((th) => best.net < th);
  return {
    title: "Monthly net",
    unitLabel: "best month",
    current: fmtAbbrev(best.net, base),
    nextLabel: next ? fmtAbbrev(next, base) : undefined,
    pctToNext: next ? (best.net / next) * 100 : 100,
    tiers,
  };
}

export interface KpiData { value: string; delta: { value: string; positive: boolean } | null; sub: string; }

export function kpisFor(txns: Transaction[], base: string, rates: FxRates | null): { income: KpiData; expenses: KpiData; net: KpiData } {
  const months = monthlyNet(txns, base, rates).map((m) => m.month);
  const uniq = [...new Set(months)].sort();
  const cur = uniq[uniq.length - 1];
  const prev = uniq[uniq.length - 2];
  const inMonth = (k?: string) => txns.filter((t) => (/^\d{4}-\d{2}/.test(t.date) ? t.date.slice(0, 7) : "") === k);
  const curT = cur ? periodTotals(inMonth(cur), base, rates) : { income: 0, expenses: 0, net: 0 };
  const prevT = prev ? periodTotals(inMonth(prev), base, rates) : null;

  const pctDelta = (now: number, before: number | undefined): { value: string; positive: boolean } | null => {
    if (before === undefined || before === 0) return null;
    const change = ((now - before) / Math.abs(before)) * 100;
    return { value: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`, positive: change >= 0 };
  };

  return {
    income: { value: fmtAbbrev(curT.income, base), delta: pctDelta(curT.income, prevT?.income), sub: "this month" },
    expenses: { value: fmtAbbrev(curT.expenses, base), delta: pctDelta(Math.abs(curT.expenses), prevT ? Math.abs(prevT.expenses) : undefined), sub: "this month" },
    net: { value: fmtAbbrev(curT.net, base), delta: pctDelta(curT.net, prevT?.net), sub: "income − expenses" },
  };
}
```

- [ ] **Step 2: Create `client/src/components/Dashboard.tsx`**

```tsx
import { useMemo } from "react";
import type { Transaction } from "../types";
import { type FxRates } from "../hooks/useFxRates";
import { Card, CardContent } from "./ui/Card";
import { Button } from "./ui/Button";
import { KpiTile } from "./ui/KpiTile";
import { MilestoneLadder } from "./ui/MilestoneLadder";
import { kpisFor, coverageLadder, monthlyNetLadder } from "../lib/derive";

interface Props {
  transactions: Transaction[];
  stats: { total: number; withInvoice: number; withRemittance: number } | null;
  baseCurrency: string;
  rates: FxRates | null;
}

export function Dashboard({ transactions, stats, baseCurrency, rates }: Props) {
  const kpis = useMemo(() => kpisFor(transactions, baseCurrency, rates), [transactions, baseCurrency, rates]);
  const coverage = useMemo(() => (stats ? coverageLadder(stats) : null), [stats]);
  const netLadder = useMemo(() => monthlyNetLadder(transactions, baseCurrency, rates), [transactions, baseCurrency, rates]);

  return (
    <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "40px 24px 80px" }}>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", marginBottom: "28px" }}>
        <div>
          <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginBottom: "8px" }}>SIÁN Portfolio · Internal</div>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 600, letterSpacing: "-0.02em" }}>Pair Overview</h1>
          <p style={{ margin: "6px 0 0", fontSize: "14px", color: "var(--muted-foreground)" }}>
            {stats ? `${stats.total} transactions · ${stats.withInvoice + stats.withRemittance} with a document` : "Loading…"}
          </p>
        </div>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "28px" }}>
        <KpiTile label="Income · this month" value={kpis.income.value} delta={kpis.income.delta} sub={kpis.income.sub} />
        <KpiTile label="Expenses · this month" value={kpis.expenses.value} delta={kpis.expenses.delta} sub={kpis.expenses.sub} />
        <KpiTile label="Net · this month" value={kpis.net.value} delta={kpis.net.delta} sub={kpis.net.sub} />
      </section>

      <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted-foreground)", marginBottom: "14px" }}>Goals</div>

      <Card style={{ padding: "1.25rem" }}>
        <CardContent>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: "16px", fontWeight: 500, marginBottom: "4px" }}>Coverage &amp; goals</div>
          <div style={{ fontSize: "14px", color: "var(--muted-foreground)", marginBottom: "18px" }}>Document matching and monthly net milestones</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {coverage && <MilestoneLadder {...coverage} />}
            <MilestoneLadder {...netLadder} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

> The `Button` import is used in Task 7 for the header "Export CSV" action moved into App; if unused here, omit the import to keep eslint clean. (The dashboard header intentionally has no Export button in this build — Export lives in the table view.)

**Correction:** remove the `Button` import line from `Dashboard.tsx` (not used). Keep imports limited to what's rendered.

- [ ] **Step 3: Verify gate**

`cd client && bunx tsc -b && bunx eslint src/lib/derive.ts src/components/Dashboard.tsx` → 0 errors (ensure no unused `Button` import).

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/derive.ts client/src/components/Dashboard.tsx
git commit -m "feat(dashboard): Overview view + derive helpers (real-data KPIs & ladders)"
```

---

## Task 7: App integration — Overview tab, header restyle, toasts

**Files:**
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `FilterTabs`, `Dashboard`, `ThemeToggle` (mounted in Task 2).

- [ ] **Step 1: Add imports**

```tsx
import { Dashboard } from "./components/Dashboard";
import { FilterTabs } from "./components/ui/FilterTabs";
```

- [ ] **Step 2: Extend the view union to include Overview (default)**

Change:
```tsx
const [view, setView] = useState<"transactions" | "charts">("transactions");
```
to:
```tsx
const [view, setView] = useState<"overview" | "transactions" | "charts">("overview");
```

- [ ] **Step 3: Replace the bespoke segmented control with `FilterTabs`**

Replace the entire neon segmented-control `<div style={{ display:'inline-flex', … padding:'3px', background:'var(--color-elev-1)' }}> … two <button>s … </div>` block with:
```tsx
<FilterTabs
  tabs={[
    { value: "overview", label: "Overview" },
    { value: "transactions", label: "Transactions" },
    { value: "charts", label: "Charts" },
  ]}
  value={view}
  onChange={setView}
/>
```

- [ ] **Step 4: Restyle the header shell onto tokens**

In the `<header>` element, change the inline style object from the dark blur/neon values to:
```tsx
style={{
  background: "var(--background)",
  borderBottom: "1px solid var(--border)",
}}
```
(Remove `backdropFilter` and the `rgba(18,20,24,…)` background.) The SIÁN/Pair brand text colors: change `var(--color-white)` → `var(--foreground)`, the "AGENCY"/subtle bits stay `var(--muted-foreground)`. The "Live" badge: change the accent green to `var(--positive)` (dot + text), keep the `pulse` animation.

- [ ] **Step 5: Recolor the header KPI strip**

In the center KPI strip, set every value to neutral ink except where a sign is meaningful:
- `Tx`, `Linked`, `Missing` values → `color: "var(--foreground)"` (was accent/warn).
- `Income` value → `var(--foreground)`; `Expenses` value → `var(--foreground)`.
- `Net` value → `net >= 0 ? "var(--positive)" : "var(--negative)"`.
Divider lines `var(--color-border-dim)` → `var(--border)` (or leave; alias still maps). Labels stay `var(--muted-foreground)`.

- [ ] **Step 6: Restyle match toasts**

In the toast `.map(...)`, change the toast container `background: 'var(--color-elev-1)'` → `var(--card)`, `borderColor: 'var(--color-accent-25)'` → `var(--border)`, the 3px left bar `background: 'var(--color-accent)'` + glow → `background: "var(--positive)"`, remove `boxShadow` glow. Replace `var(--color-white)` → `var(--foreground)`, `var(--color-fg-muted)`/`var(--color-fg-subtle)` stay mapped. Add `boxShadow: "var(--shadow-popover)"` to the toast (it's a floating layer).

- [ ] **Step 7: Render the Overview view**

In `<main>`, add before the `view === "transactions"` block:
```tsx
{!loading && view === "overview" && (
  <Dashboard
    transactions={allTransactions}
    stats={stats}
    baseCurrency={baseCurrency}
    rates={rates}
  />
)}
```

- [ ] **Step 8: Verify gate**

`cd client && bunx tsc -b && bunx eslint src/App.tsx` → 0 errors. In `bun run dev`: Overview is the default tab and renders KPI tiles + two ladders from real data; tabs switch between Overview/Transactions/Charts; header is flat monochrome with the theme toggle; toasts are on-brand. Confirm in **light and dark**.

- [ ] **Step 9: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat(app): Overview tab (default), monochrome header, restyled toasts"
```

---

## Task 8: Sweep — TransactionTable

**Files:**
- Modify: `client/src/components/TransactionTable.tsx`

- [ ] **Step 1: Read the file**, then apply the **Legacy → DS token mapping** table (top of plan) to every `var(--color-*)` reference and any `text-zinc-*/bg-zinc-*/border-zinc-*` Tailwind defaults (replace zinc utilities with token equivalents: `text-zinc-400`→`style={{color:"var(--muted-foreground)"}}` or `text-muted-foreground`, borders → `border-border`). Specifics:
  - Row separators → `borderBottom: "1px solid var(--border)"`.
  - Row hover → fill `var(--muted)` (no neon).
  - All numeric cells (amount, balance, fees) → `fontFamily: "var(--font-mono)"`, `fontVariantNumeric: "tabular-nums"`; positive amounts neutral ink, negative amounts `var(--negative)` only if the table currently color-codes them (keep existing semantics but use `--positive`/`--negative` instead of accent/danger).
  - Document state chips → use `Badge` (`import { Badge } from "./ui/Badge"`).
  - Sort header active state → ink `var(--foreground)`, inactive `var(--muted-foreground)`.

- [ ] **Step 2: Verify gate**

`cd client && bunx tsc -b && bunx eslint src/components/TransactionTable.tsx` → 0 errors. In `bun run dev`, the Transactions table reads on-brand (hairline rows, mono numbers, Badge doc state) in light **and** dark; sort/filter/doc-filter still work.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/TransactionTable.tsx
git commit -m "style(table): sweep TransactionTable onto DS tokens + Badge"
```

---

## Task 9: Sweep — Charts (ChartsView + CashFlowCharts)

**Files:**
- Modify: `client/src/components/ChartsView.tsx`, `client/src/components/CashFlowCharts.tsx`

- [ ] **Step 1: Read both files.** Recolor all Recharts series to the **gray ramp** (no neon, no red/green series): bars/lines use `var(--chart-1)` (light, e.g. gross/income) through `var(--chart-5)` (darkest, e.g. net/cumulative). Replace `--color-accent`/`--color-danger` series fills/strokes with chart-ramp steps. Axis text → `var(--muted-foreground)`; gridlines/`CartesianGrid` stroke → `var(--border)`; tooltip surface → `var(--popover)` + `var(--shadow-popover)` + `1px solid var(--border)`. Card wrappers → `Card` or `boxShadow: var(--ring-card)`. Active/selected month highlight → `var(--foreground)` fill (not neon).

> Recharts colors can be passed as CSS `var(--…)` strings to `fill`/`stroke` props. Read the actual `<Bar>/<Line>/<Area>` props in the files and swap their color values; do not change data/series logic.

- [ ] **Step 2: Verify gate**

`cd client && bunx tsc -b && bunx eslint src/components/ChartsView.tsx src/components/CashFlowCharts.tsx` → 0 errors. In `bun run dev` → Charts tab: series render as the gray ramp, gridlines are hairlines, tooltip on-brand, month-click still filters. Check light **and** dark.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ChartsView.tsx client/src/components/CashFlowCharts.tsx
git commit -m "style(charts): recolor series to monochrome gray ramp"
```

---

## Task 10: Sweep — FilterBar, DropZone, PdfLink, ProgressBadge, ProgressBar

**Files:**
- Modify: `client/src/components/{FilterBar,DropZone,PdfLink,ProgressBadge,ProgressBar}.tsx`

- [ ] **Step 1: Read each file** and apply the token mapping:
  - **FilterBar** — filter chips → `Badge`-style pills (`var(--secondary)` fill, `var(--border)`); the `<select>` for categories (currently `border-zinc-700 bg-zinc-800/60 text-zinc-400`) → token styling: `border:"1px solid var(--input)"`, `background:"var(--card)"`, `color:"var(--muted-foreground)"`, focus halo `boxShadow:"var(--ring-focus)"`.
  - **DropZone** — base surfaces → `var(--card)`/`var(--border)`; drag-active state → border `var(--foreground)` + fill `var(--muted)` (no neon glow); any error text → `var(--destructive)`.
  - **PdfLink** — default link ink `var(--foreground)`; hover-delete affordance → `var(--destructive)` on hover (ghost/destructive treatment).
  - **ProgressBadge** / **ProgressBar** — track → `var(--muted)`; fill → `var(--foreground)` (neutral ink, not neon); text → `var(--muted-foreground)`.

- [ ] **Step 2: Verify gate**

`cd client && bunx tsc -b && bunx eslint src/components/FilterBar.tsx src/components/DropZone.tsx src/components/PdfLink.tsx src/components/ProgressBadge.tsx src/components/ProgressBar.tsx` → 0 errors. Visually confirm each (drop a PDF to see DropZone active + ProgressBadge; hover a PdfLink) in light **and** dark.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/FilterBar.tsx client/src/components/DropZone.tsx client/src/components/PdfLink.tsx client/src/components/ProgressBadge.tsx client/src/components/ProgressBar.tsx
git commit -m "style: sweep filter/dropzone/pdflink/progress onto DS tokens"
```

---

## Task 11: Sweep — pickers + ManualMatchModal → Dialog

**Files:**
- Modify: `client/src/components/{CurrencyPicker,ModelPicker,CategoryPicker,DateFilter,ManualMatchModal}.tsx`

- [ ] **Step 1: Pickers** — read each and apply token mapping: control surface `var(--card)`, border `var(--input)`, text `var(--foreground)`/`var(--muted-foreground)`, hover `var(--muted)`, focus `boxShadow:"var(--ring-focus)"`, radius `var(--radius-lg)`, height `2rem`. Any dropdown/popover panel → `var(--popover)` + `var(--shadow-popover)` + `1px solid var(--border)`. Remove neon active states (active option → `var(--secondary)` fill / ink text).

- [ ] **Step 2: ManualMatchModal → Dialog** — read the file; replace its bespoke modal shell (fixed overlay + panel) with the `Dialog` primitive:
```tsx
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "./ui/Dialog";
import { Button } from "./ui/Button";
```
Wrap the existing modal body in `<Dialog open onClose={onClose} width="900px"> … </Dialog>` (this component only renders when mounted, so `open` is always true; keep `onClose={onClose}`). Move the title/subtitle into `DialogHeader`/`DialogTitle`/`DialogDescription`, the PDF list + iframe preview into `DialogBody`, and the submit/cancel actions into `DialogFooter` using `<Button variant="default">`/`<Button variant="outline">`. Recolor selected-PDF state → `var(--secondary)` fill + `var(--border)`. The iframe preview frame → `1px solid var(--border)`, `var(--radius-lg)`. Keep all fetch/submit logic identical.

- [ ] **Step 3: Verify gate**

`cd client && bunx tsc -b && bunx eslint src/components/CurrencyPicker.tsx src/components/ModelPicker.tsx src/components/CategoryPicker.tsx src/components/DateFilter.tsx src/components/ManualMatchModal.tsx` → 0 errors. In `bun run dev`: open each picker (on-brand popovers); open the manual-match modal (DS Dialog with faint blurred backdrop), select a PDF, confirm preview + submit still work. Light **and** dark.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/CurrencyPicker.tsx client/src/components/ModelPicker.tsx client/src/components/CategoryPicker.tsx client/src/components/DateFilter.tsx client/src/components/ManualMatchModal.tsx
git commit -m "style: sweep pickers + migrate ManualMatchModal to Dialog primitive"
```

---

## Task 12: Cleanup — remove legacy aliases + final audit

**Files:**
- Modify: `client/src/index.css` (delete the temporary legacy block)
- Modify: any file flagged by the grep below

- [ ] **Step 1: Grep for stragglers**

```bash
cd client && grep -rnE "color-accent|color-bg|color-dark|color-elev|color-fg|color-white|color-border-(dim|faint)|color-danger|color-warn|font-serif|#1AE392|1AE392|JetBrains|Instrument|Inter'|dotted" src
```
Expected after sweeps: only hits should be inside `index.css`'s legacy alias block (to be deleted) — nothing in components. If any component still references a legacy var, fix it using the mapping table.

- [ ] **Step 2: Delete the legacy alias block** from `client/src/index.css` (the `/* TEMPORARY legacy aliases */` section and the `--font-serif` line).

- [ ] **Step 3: Full build + lint + grep re-run**

```bash
cd client && bunx tsc -b && bun run lint
cd client && grep -rnE "color-accent|color-bg|color-dark|color-elev|color-fg|color-white|color-danger|color-warn|font-serif|1AE392|JetBrains|Instrument" src
```
Expected: build + lint pass with 0 errors; grep returns **no matches**.

- [ ] **Step 4: Full manual smoke**

`bun run dev` — walk every view (Overview, Transactions, Charts), open the manual-match modal, drop a PDF to confirm live SSE matching still patches a row + shows a toast and the coverage ladder updates. Toggle light↔dark on each view; reload to confirm theme persists. Confirm zero neon-green / dotted-grid anywhere.

- [ ] **Step 5: Commit**

```bash
git add client/src/index.css
git commit -m "chore(design): drop legacy color aliases after full DS sweep"
```

---

## Self-Review

**Spec coverage:**
- §3.1 tokens → Task 1. §3.2 theme toggle → Task 2. §3.3 primitives → Tasks 3–5. §3.4 dashboard + derive → Task 6. §3.5 App integration → Tasks 2 (toggle mount) + 7. §3.6 component sweep → Tasks 8–11. §5 edge handling → covered in `derive.ts` guards (Task 6) and loading copy (Task 6/7). §6 verification → per-task gates + Task 12. §7 file inventory → matches File Structure. ✅ All sections mapped.
- Milestone ladders (Document coverage + Monthly net) → Task 6 (`coverageLadder`, `monthlyNetLadder`). ✅
- Default light theme → Task 2 `readInitial` defaults to "light". ✅

**Placeholder scan:** No TBD/TODO. Sweep tasks (8–11) intentionally say "read the file, apply the mapping table" because exact current source isn't reproduced here — the mapping table + per-component specifics give exact replacements; this is the correct granularity for a mechanical token swap on files the implementer reads. New files (Tasks 1–6) contain complete code.

**Type consistency:** `LadderData`/`Tier` fields (`title, unitLabel, current, nextLabel?, pctToNext, tiers[{label,status,reached?}]`) match `MilestoneLadder`'s props (Task 4) and `coverageLadder`/`monthlyNetLadder` returns (Task 6). `KpiData` (`{value, delta:{value,positive}|null, sub}`) matches `KpiTile` props (Task 4) and `kpisFor` return (Task 6). `useTheme(): {theme, toggle}` matches `ThemeToggle` props and App usage (Task 2). `view` union `"overview"|"transactions"|"charts"` consistent across Task 7. `FilterTabs` generic `T` instantiated with the view union. ✅

**Note for implementer:** In Task 6 Step 2, do **not** import `Button` in `Dashboard.tsx` (the correction line) — it would trip the no-unused-vars lint gate.
