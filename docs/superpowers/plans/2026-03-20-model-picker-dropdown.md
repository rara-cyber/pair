# Model Picker Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dropdown in the app header that lets users switch the OpenRouter LLM model used for AI matching, session-only, defaulting to `google/gemini-2.5-flash`.

**Architecture:** Server exposes `GET /api/model` and `POST /api/model` endpoints that read/write an in-memory variable in `aiMatcher.ts`. The client renders a `<ModelPicker>` dropdown in the header (next to `ProgressBadge`) that calls the API on change.

**Tech Stack:** Express (server), React + Tailwind (client), no additional dependencies.

---

## File Map

| File | Change |
|------|--------|
| `server/services/aiMatcher.ts` | Replace hardcoded `MODEL` const with exported `getModel()` / `setModel()` |
| `server/routes/api.ts` | Add `GET /api/model` and `POST /api/model` routes |
| `client/src/components/ModelPicker.tsx` | New: dropdown component |
| `client/src/App.tsx` | Mount `<ModelPicker>` in the header next to `ProgressBadge` |

---

## Task 1: Expose model getter/setter in aiMatcher.ts

**Files:**
- Modify: `server/services/aiMatcher.ts:12`

- [ ] **Step 1: Replace the hardcoded constant with module-level state**

  Find line 12:
  ```ts
  const MODEL = "google/gemini-2.5-flash";
  ```
  Replace with:
  ```ts
  const MODELS = [
    { id: "google/gemini-2.5-flash",              label: "Gemini 2.5 Flash (default)" },
    { id: "google/gemini-2.0-flash-lite",          label: "Gemini 2.0 Flash Lite" },
    { id: "openai/gpt-4o-mini",                    label: "GPT-4o Mini" },
    { id: "anthropic/claude-3-haiku",              label: "Claude 3 Haiku" },
    { id: "meta-llama/llama-3.3-70b-instruct",     label: "Llama 3.3 70B" },
  ] as const;

  export type ModelId = typeof MODELS[number]["id"];
  export const AVAILABLE_MODELS = MODELS;

  let currentModel: ModelId = "google/gemini-2.5-flash";
  export function getModel(): ModelId { return currentModel; }
  export function setModel(id: ModelId): void { currentModel = id; }
  ```

- [ ] **Step 2: Update `callLlm` to use `getModel()`**

  Find inside `callLlm`:
  ```ts
  model: MODEL,
  ```
  Replace with:
  ```ts
  model: getModel(),
  ```

- [ ] **Step 3: Verify the server still compiles**

  Run: `cd /path/to/invoice-checker && npx tsx server/index.ts --check 2>&1 | head -20` (or just start dev server and watch for errors)

- [ ] **Step 4: Commit**

  ```bash
  git add server/services/aiMatcher.ts
  git commit -m "feat: make AI model configurable via getModel/setModel"
  ```

---

## Task 2: Add API endpoints for model selection

**Files:**
- Modify: `server/routes/api.ts`

- [ ] **Step 1: Import the new exports at the top of `api.ts`**

  Add to the existing aiMatcher import:
  ```ts
  import { aiMatchTransactions, getModel, setModel, AVAILABLE_MODELS } from "../services/aiMatcher";
  ```

- [ ] **Step 2: Add the two routes** (place them near the top of the route definitions, after the `/progress` route)

  ```ts
  router.get("/model", (_req: Request, res: Response) => {
    res.json({ current: getModel(), available: AVAILABLE_MODELS });
  });

  router.post("/model", (req: Request, res: Response) => {
    const { model } = req.body as { model: string };
    const valid = AVAILABLE_MODELS.find((m) => m.id === model);
    if (!valid) return res.status(400).json({ error: "Unknown model" });
    setModel(model as ReturnType<typeof getModel>);
    res.json({ current: getModel() });
  });
  ```

- [ ] **Step 3: Smoke-test the endpoints**

  With the server running:
  ```bash
  curl http://localhost:3001/api/model
  # Expected: {"current":"google/gemini-2.5-flash","available":[...]}

  curl -X POST http://localhost:3001/api/model \
    -H "Content-Type: application/json" \
    -d '{"model":"openai/gpt-4o-mini"}'
  # Expected: {"current":"openai/gpt-4o-mini"}

  curl http://localhost:3001/api/model
  # Expected: {"current":"openai/gpt-4o-mini",...}
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add server/routes/api.ts
  git commit -m "feat: add GET/POST /api/model endpoints"
  ```

---

## Task 3: Build the ModelPicker client component

**Files:**
- Create: `client/src/components/ModelPicker.tsx`

- [ ] **Step 1: Create the component**

  ```tsx
  import { useEffect, useState } from "react";

  interface ModelOption {
    id: string;
    label: string;
  }

  export function ModelPicker() {
    const [current, setCurrent] = useState<string>("");
    const [available, setAvailable] = useState<ModelOption[]>([]);

    useEffect(() => {
      fetch("/api/model")
        .then((r) => r.json())
        .then((data) => {
          setCurrent(data.current);
          setAvailable(data.available);
        })
        .catch(() => {});
    }, []);

    function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
      const model = e.target.value;
      fetch("/api/model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      })
        .then((r) => r.json())
        .then((data) => setCurrent(data.current))
        .catch(() => {});
    }

    if (!available.length) return null;

    return (
      <select
        value={current}
        onChange={handleChange}
        className="text-xs bg-zinc-900 border border-zinc-700 text-zinc-300 rounded-md px-2 py-1 focus:outline-none focus:border-zinc-500 hover:border-zinc-500 transition-colors cursor-pointer"
      >
        {available.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
    );
  }
  ```

- [ ] **Step 2: Verify it renders without errors** (mount it temporarily in App.tsx and check browser console)

- [ ] **Step 3: Commit**

  ```bash
  git add client/src/components/ModelPicker.tsx
  git commit -m "feat: add ModelPicker dropdown component"
  ```

---

## Task 4: Mount ModelPicker in the header

**Files:**
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Import ModelPicker**

  Add to the imports at the top of `App.tsx`:
  ```ts
  import { ModelPicker } from "./components/ModelPicker";
  ```

- [ ] **Step 2: Place it in the header's right slot**

  Find the right section of the header (around line 224):
  ```tsx
  {/* Right: progress badge */}
  <div className="shrink-0">
    <ProgressBadge progress={progress} />
  </div>
  ```
  Replace with:
  ```tsx
  {/* Right: model picker + progress badge */}
  <div className="shrink-0 flex items-center gap-3">
    <ModelPicker />
    <ProgressBadge progress={progress} />
  </div>
  ```

- [ ] **Step 3: Verify visually**

  Open the app at `http://localhost:5173`. The dropdown should appear in the top-right header. Changing the model should reflect immediately (verify with `curl http://localhost:3001/api/model` on the server).

- [ ] **Step 4: Final commit**

  ```bash
  git add client/src/App.tsx
  git commit -m "feat: mount ModelPicker in app header"
  ```
