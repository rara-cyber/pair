import { Select } from "./ui/Select";

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
      <Select value={value} onChange={(e) => onChange(e.target.value)} title="Base currency for KPI totals">
        {currencies.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </Select>
      {loading && (
        <span style={{ fontSize: "0.625rem", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>rates…</span>
      )}
      {error && (
        <span
          style={{ fontSize: "0.625rem", color: "var(--destructive)", textTransform: "uppercase", letterSpacing: "0.05em" }}
          title="FX rates unavailable — totals may be in mixed currencies"
        >no fx</span>
      )}
    </div>
  );
}
