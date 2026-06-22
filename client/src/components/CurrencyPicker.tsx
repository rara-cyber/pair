interface Props {
  value: string;
  currencies: string[];
  loading: boolean;
  error: boolean;
  onChange: (currency: string) => void;
}

export function CurrencyPicker({ value, currencies, loading, error, onChange }: Props) {
  if (currencies.length <= 1) return null;

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title="Base currency for KPI totals"
        style={{
          fontSize: "0.75rem",
          background: "var(--card)",
          border: "1px solid var(--input)",
          color: "var(--foreground)",
          borderRadius: "var(--radius-lg)",
          padding: "0 0.5rem",
          height: "2rem",
          cursor: "pointer",
          outline: "none",
          transition: "border-color 120ms ease, box-shadow 120ms ease",
        }}
        onFocus={(e) => { e.currentTarget.style.boxShadow = "var(--ring-focus)"; }}
        onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
      >
        {currencies.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      {loading && (
        <span style={{ fontSize: "0.625rem", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>rates…</span>
      )}
      {error && (
        <span
          style={{ fontSize: "0.625rem", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}
          title="FX rates unavailable — totals may be in mixed currencies"
        >no fx</span>
      )}
    </div>
  );
}
