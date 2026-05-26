import { useState, useRef, useEffect } from "react";

interface Props {
  value?: string[];
  categories: string[];
  onChange: (categories: string[]) => void;
  onAddCategory: (name: string) => void;
}

const MAX = 3;

export function CategoryPicker({ value, categories, onChange, onAddCategory }: Props) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = value ?? [];
  const atMax = selected.length >= MAX;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (category: string) => {
    if (selected.includes(category)) {
      onChange(selected.filter((c) => c !== category));
    } else if (selected.length < MAX) {
      onChange([...selected, category]);
    }
  };

  const add = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAddCategory(trimmed);
    setNewName("");
    if (!selected.includes(trimmed) && selected.length < MAX) {
      onChange([...selected, trimmed]);
    }
  };

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={`flex items-center gap-1 w-full overflow-hidden text-xs px-2 py-1 rounded border transition-colors cursor-pointer text-left ${
          selected.length
            ? "border-zinc-600 bg-zinc-800/60 hover:border-zinc-500"
            : "border-zinc-700 bg-zinc-800/40 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
        }`}
      >
        {selected.length === 0 && <span className="truncate">Set category</span>}
        {selected.map((c) => (
          <span key={c} className="px-1.5 py-0.5 rounded bg-zinc-700/70 text-zinc-200 truncate shrink min-w-0">
            {c}
          </span>
        ))}
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden">
          <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-zinc-500">
            Up to {MAX} · {selected.length} selected
          </div>
          <div className="max-h-48 overflow-y-auto">
            {categories.length === 0 && (
              <div className="px-3 py-2 text-xs text-zinc-500">No categories yet</div>
            )}
            {categories.map((category) => {
              const isSelected = selected.includes(category);
              const disabled = !isSelected && atMax;
              return (
                <button
                  key={category}
                  disabled={disabled}
                  onClick={(e) => { e.stopPropagation(); toggle(category); }}
                  className={`w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs transition-colors hover:bg-zinc-800 truncate ${
                    isSelected ? "text-blue-300 font-medium" : disabled ? "text-zinc-600 cursor-not-allowed" : "text-zinc-300 cursor-pointer"
                  }`}
                >
                  <span className={`w-3 h-3 shrink-0 rounded-sm border flex items-center justify-center ${isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-zinc-600"}`}>
                    {isSelected && "✓"}
                  </span>
                  <span className="truncate">{category}</span>
                </button>
              );
            })}
          </div>

          <div className="h-px bg-zinc-800" />

          <div className="flex items-center gap-1 px-2 py-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
              placeholder="New category"
              className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
            />
            <button
              disabled={!newName.trim() || atMax}
              onClick={(e) => { e.stopPropagation(); add(); }}
              className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded px-2 py-1 transition-colors cursor-pointer"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
