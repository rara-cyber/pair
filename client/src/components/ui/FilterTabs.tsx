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
