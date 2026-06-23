import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  value?: string[];
  categories: string[];
  onChange: (categories: string[]) => void;
  onAddCategory: (name: string) => void;
  maxWidth?: number;
}

const MAX = 3;

export function CategoryPicker({ value, categories, onChange, onAddCategory, maxWidth }: Props) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const selected = value ?? [];
  const atMax = selected.length >= MAX;
  const sortedCategories = [...categories].sort((a, b) => a.localeCompare(b));

  const openMenu = () => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 200) });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    const reposition = () => {
      const r = buttonRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 200) });
    };
    const onScroll = (e: Event) => {
      // scrolling inside the menu's own list → leave it alone;
      // page/table scroll → follow the trigger instead of vanishing
      if (popRef.current?.contains(e.target as Node)) return;
      reposition();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", onScroll, true); // capture: also catch the table's scroll container
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", onScroll, true);
    };
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
        ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : openMenu(); }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--muted)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--card)"; }}
        onFocus={(e) => { e.currentTarget.style.boxShadow = "var(--ring-focus)"; }}
        onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.25rem",
          width: "100%",
          maxWidth: maxWidth ? `${maxWidth}px` : undefined,
          overflow: "hidden",
          outline: "none",
          fontSize: "0.75rem",
          padding: "0 0.5rem",
          height: "2rem",
          borderRadius: "var(--radius-lg)",
          border: selected.length ? "1px solid var(--border)" : "1px solid var(--input)",
          background: "var(--card)",
          color: selected.length ? "var(--foreground)" : "var(--muted-foreground)",
          cursor: "pointer",
          textAlign: "left",
          transition: "border-color 120ms ease",
        }}
      >
        {selected.length === 0 && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Set category</span>}
        {selected.map((c) => (
          <span
            key={c}
            style={{
              padding: "0.125rem 0.375rem",
              borderRadius: "var(--radius-sm)",
              background: "var(--secondary)",
              color: "var(--secondary-foreground)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flexShrink: 1,
              minWidth: 0,
            }}
          >
            {c}
          </span>
        ))}
      </button>

      {open && pos && createPortal(
        <div
          ref={popRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            zIndex: 100,
            width: "12rem",
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-popover)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "0.5rem 0.75rem 0.25rem",
              fontSize: "0.625rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--muted-foreground)",
            }}
          >
            Up to {MAX} · {selected.length} selected
          </div>
          <div style={{ maxHeight: "12rem", overflowY: "auto", overscrollBehavior: "contain" }}>
            {categories.length === 0 && (
              <div style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem", color: "var(--muted-foreground)" }}>No categories yet</div>
            )}
            {sortedCategories.map((category) => {
              const isSelected = selected.includes(category);
              const disabled = !isSelected && atMax;
              return (
                <button
                  key={category}
                  disabled={disabled}
                  onClick={(e) => { e.stopPropagation(); toggle(category); }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    textAlign: "left",
                    padding: "0.375rem 0.75rem",
                    fontSize: "0.75rem",
                    background: isSelected ? "var(--secondary)" : "transparent",
                    color: isSelected ? "var(--secondary-foreground)" : disabled ? "var(--muted-foreground)" : "var(--foreground)",
                    cursor: disabled ? "not-allowed" : "pointer",
                    border: "none",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    transition: "background 80ms ease",
                  }}
                  onMouseEnter={(e) => { if (!disabled && !isSelected) e.currentTarget.style.background = "var(--muted)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? "var(--secondary)" : "transparent"; }}
                >
                  <span
                    style={{
                      width: "0.75rem",
                      height: "0.75rem",
                      flexShrink: 0,
                      borderRadius: "0.125rem",
                      border: isSelected ? "1px solid var(--foreground)" : "1px solid var(--border)",
                      background: isSelected ? "var(--foreground)" : "transparent",
                      color: isSelected ? "var(--background)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.5rem",
                    }}
                  >
                    {isSelected && "✓"}
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{category}</span>
                </button>
              );
            })}
          </div>

          <div style={{ height: "1px", background: "var(--border)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.5rem" }}>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
              placeholder="New category"
              style={{
                flex: 1,
                minWidth: 0,
                background: "var(--muted)",
                border: "1px solid var(--input)",
                borderRadius: "var(--radius-md)",
                padding: "0.25rem 0.5rem",
                fontSize: "0.75rem",
                color: "var(--foreground)",
                outline: "none",
                transition: "box-shadow 120ms ease",
              }}
              onFocus={(e) => { e.currentTarget.style.boxShadow = "var(--ring-focus)"; }}
              onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
            />
            <button
              disabled={!newName.trim() || atMax}
              onClick={(e) => { e.stopPropagation(); add(); }}
              style={{
                fontSize: "0.75rem",
                background: "var(--foreground)",
                color: "var(--background)",
                borderRadius: "var(--radius-md)",
                padding: "0.25rem 0.5rem",
                border: "none",
                cursor: !newName.trim() || atMax ? "not-allowed" : "pointer",
                opacity: !newName.trim() || atMax ? 0.4 : 1,
                transition: "opacity 120ms ease",
              }}
            >
              Add
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
