import { useEffect, useRef, useState, type ReactNode } from "react";

export function HeaderControlsMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        aria-expanded={open}
        style={{
          width: "32px",
          height: "32px",
          display: "grid",
          placeItems: "center",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)",
          background: open ? "var(--muted)" : "transparent",
          color: "var(--foreground)",
          cursor: "pointer",
          transition: "background 120ms ease",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            zIndex: 50,
            minWidth: "220px",
            background: "var(--popover)",
            color: "var(--popover-foreground)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-popover)",
            padding: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
