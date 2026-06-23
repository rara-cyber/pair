import { useEffect, useLayoutEffect, useRef } from "react";

interface Tab<T extends string> { value: T; label: string; }
interface Props<T extends string> { tabs: Tab<T>[]; value: T; onChange: (v: T) => void; }

const EASE = "linear";

export function FilterTabs<T extends string>({ tabs, value, onChange }: Props<T>) {
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const indRef = useRef<HTMLSpanElement>(null);
  const first = useRef(true);

  // Slide the active-tab indicator to the selected button. Position is animated
  // via `transform: translateX` (GPU-composited → smooth); width transitions too.
  // Done imperatively (no setState → no extra render); the first position is
  // applied without a transition so only subsequent changes animate.
  const place = () => {
    const btn = btnRefs.current[value];
    const ind = indRef.current;
    if (!btn || !ind) return;
    if (first.current) ind.style.transition = "none";
    ind.style.transform = `translateX(${btn.offsetLeft}px)`;
    ind.style.width = `${btn.offsetWidth}px`;
    ind.style.opacity = "1";
    if (first.current) {
      void ind.offsetWidth; // flush layout so the next change animates
      ind.style.transition = `transform 200ms ${EASE}, width 200ms ${EASE}`;
      first.current = false;
    }
  };

  useLayoutEffect(place); // re-position on every render (value/label/width changes)

  useEffect(() => {
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div style={{
      position: "relative",
      display: "inline-flex", alignItems: "center", gap: "2px", padding: "3px",
      border: "1px solid var(--border)", borderRadius: "var(--radius-full)", background: "var(--card)",
    }}>
      <span
        ref={indRef}
        aria-hidden
        style={{
          position: "absolute", top: "3px", bottom: "3px", left: 0, width: 0, opacity: 0,
          transform: "translateX(0)", willChange: "transform, width",
          background: "var(--primary)", borderRadius: "var(--radius-full)", zIndex: 0,
        }}
      />
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => { btnRefs.current[t.value] = el; }}
            onClick={() => onChange(t.value)}
            style={{
              position: "relative", zIndex: 1,
              fontFamily: "var(--font-sans)", fontSize: "0.75rem", fontWeight: 500,
              padding: "0.375rem 0.875rem", borderRadius: "var(--radius-full)", border: "none", cursor: "pointer",
              background: "transparent", whiteSpace: "nowrap",
              color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
              transition: "color 200ms ease",
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "var(--foreground)"; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "var(--muted-foreground)"; }}
          >{t.label}</button>
        );
      })}
    </div>
  );
}
