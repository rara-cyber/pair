import { useEffect, useLayoutEffect, useRef } from "react";

interface Tab<T extends string> { value: T; label: string; }
interface Props<T extends string> { tabs: Tab<T>[]; value: T; onChange: (v: T) => void; }

const DURATION = 260;
const EASE = "linear"; // constant speed — no accelerate-in / decelerate-out

export function FilterTabs<T extends string>({ tabs, value, onChange }: Props<T>) {
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const indRef = useRef<HTMLSpanElement>(null);
  const prevRect = useRef<{ left: number; width: number } | null>(null);
  const lastValue = useRef<T | null>(null);

  // Move the active-tab indicator. Uses the FLIP trick: the real width is set
  // instantly, then ONLY `transform` (translateX + scaleX) is animated, so the
  // whole motion runs on the GPU compositor (no per-frame layout/paint). It
  // settles at scaleX(1) so the resting pill is never distorted.
  useLayoutEffect(() => {
    const btn = btnRefs.current[value];
    const ind = indRef.current;
    if (!btn || !ind) return;
    const left = btn.offsetLeft;
    const width = btn.offsetWidth;
    const prev = prevRect.current;

    if (prev && lastValue.current !== null && lastValue.current !== value) {
      // final geometry now (no transition), shown at the previous rect via transform…
      ind.style.transition = "none";
      ind.style.width = `${width}px`;
      ind.style.transform = `translateX(${prev.left}px) scaleX(${prev.width / width})`;
      void ind.offsetWidth; // flush, then play transform to identity
      ind.style.transition = `transform ${DURATION}ms ${EASE}`;
      ind.style.transform = `translateX(${left}px) scaleX(1)`;
    } else {
      // initial placement — no animation
      ind.style.transition = "none";
      ind.style.width = `${width}px`;
      ind.style.transform = `translateX(${left}px) scaleX(1)`;
      ind.style.opacity = "1";
    }
    prevRect.current = { left, width };
    lastValue.current = value;
  }, [value]);

  useEffect(() => {
    const onResize = () => {
      const btn = btnRefs.current[value];
      const ind = indRef.current;
      if (!btn || !ind) return;
      ind.style.transition = "none";
      ind.style.width = `${btn.offsetWidth}px`;
      ind.style.transform = `translateX(${btn.offsetLeft}px) scaleX(1)`;
      prevRect.current = { left: btn.offsetLeft, width: btn.offsetWidth };
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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
          transform: "translateX(0) scaleX(1)", transformOrigin: "left center", willChange: "transform",
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
