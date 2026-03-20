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
        className="text-xs bg-zinc-900 border border-zinc-700 text-zinc-300 rounded-md px-2 py-1 focus:outline-none focus:border-zinc-500 hover:border-zinc-500 transition-colors cursor-pointer"
        title="Base currency for KPI totals"
      >
        {currencies.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      {loading && (
        <span className="text-[10px] text-zinc-600 uppercase tracking-wide">rates…</span>
      )}
      {error && (
        <span className="text-[10px] text-amber-600 uppercase tracking-wide" title="FX rates unavailable — totals may be in mixed currencies">no fx</span>
      )}
    </div>
  );
}
