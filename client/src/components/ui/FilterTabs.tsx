import { useEffect, useLayoutEffect, useRef } from "react";

interface Tab<T extends string> { value: T; label: string; }
interface Props<T extends string> { tabs: Tab<T>[]; value: T; onChange: (v: T) => void; }

/* transitions.dev "tabs sliding": JS writes the active tab's offsetLeft/offsetWidth
   onto the pill, CSS owns the tween on --ease-smooth-out. */
const DURATION = 250;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const TWEEN = `transform ${DURATION}ms ${EASE}, width ${DURATION}ms ${EASE}`;

export function FilterTabs<T extends string>({ tabs, value, onChange }: Props<T>) {
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const indRef = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);

  useLayoutEffect(() => {
    const btn = btnRefs.current[value];
    const ind = indRef.current;
    if (!btn || !ind) return;
    const moveTo = () => {
      ind.style.width = `${btn.offsetWidth}px`;
      ind.style.transform = `translateX(${btn.offsetLeft}px)`;
    };
    if (!placed.current) {
      // first paint — snap into place without animating
      ind.style.transition = "none";
      moveTo();
      void ind.offsetWidth; // flush before re-arming the tween
      ind.style.transition = TWEEN;
      ind.style.opacity = "1";
      placed.current = true;
    } else {
      moveTo();
    }
  }, [value]);

  useEffect(() => {
    const onResize = () => {
      const btn = btnRefs.current[value];
      const ind = indRef.current;
      if (!btn || !ind) return;
      ind.style.transition = "none";
      ind.style.width = `${btn.offsetWidth}px`;
      ind.style.transform = `translateX(${btn.offsetLeft}px)`;
      void ind.offsetWidth;
      ind.style.transition = TWEEN;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [value]);

  return (
    <div className="filter-tabs" style={{
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
              transition: `color ${DURATION}ms ${EASE}`,
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "var(--foreground)"; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "var(--muted-foreground)"; }}
          >{t.label}</button>
        );
      })}
    </div>
  );
}
