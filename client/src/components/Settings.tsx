import type { ReactNode } from "react";
import { CurrencyPicker } from "./CurrencyPicker";
import { ModelPicker } from "./ModelPicker";
import { Card } from "./ui/Card";
import { ProjectsSettings } from "./ProjectsSettings";
import { UnmatchedDocuments } from "./UnmatchedDocuments";
import { PaypalSync } from "./PaypalSync";

interface Props {
  baseCurrency: string;
  currencies: string[];
  ratesLoading: boolean;
  ratesError: boolean;
  onCurrencyChange: (c: string) => void;
  tax: { on: boolean; rate: number };
  onTaxChange: (next: { on: boolean; rate: number }) => void;
  onProjectsChanged?: () => void;
  onSynced?: () => void;
}

function SettingRow({ label, desc, children }: { label: string; desc: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
      <div>
        <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--foreground)" }}>{label}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{desc}</div>
      </div>
      {children}
    </div>
  );
}

export function Settings({ baseCurrency, currencies, ratesLoading, ratesError, onCurrencyChange, tax, onTaxChange, onProjectsChanged, onSynced }: Props) {
  return (
    <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "40px 24px 80px" }}>
      <header style={{ marginBottom: "28px" }}>
        <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginBottom: "8px" }}>SIÁN Portfolio · Internal</div>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 600, letterSpacing: "-0.02em" }}>Settings</h1>
        <p style={{ margin: "6px 0 0", fontSize: "14px", color: "var(--muted-foreground)" }}>App preferences</p>
      </header>
      {/* Two columns: the preference cards are short rows of label + control and
          never needed the full 72rem, while the document list is the one thing
          here with real content. Pairing them puts that width to use instead of
          stacking three narrow cards down the left edge.
          minmax(0,1fr) not 1fr — a bare 1fr floors at the content's min width,
          which lets the document filenames push the column wider than half. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 30rem), 1fr))", gap: "12px", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
          <Card style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <SettingRow label="Base currency" desc="Currency for KPI totals and charts">
              <CurrencyPicker value={baseCurrency} currencies={currencies} loading={ratesLoading} error={ratesError} onChange={onCurrencyChange} />
            </SettingRow>
            <div style={{ height: "1px", background: "var(--border)" }} />
            <SettingRow label="Tax on net" desc="Deducted from the Net KPI only — income and expenses stay gross">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={tax.rate}
                  disabled={!tax.on}
                  onChange={(e) => onTaxChange({ ...tax, rate: Math.min(100, Math.max(0, Number(e.target.value))) })}
                  style={{
                    width: "4rem", height: "2rem", padding: "0 0.5rem", fontSize: "0.75rem",
                    fontFamily: "var(--font-mono)", textAlign: "right",
                    color: tax.on ? "var(--foreground)" : "var(--muted-foreground)",
                    background: "var(--card)", border: "1px solid var(--input)",
                    borderRadius: "var(--radius-lg)", outline: "none",
                  }}
                />
                <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>%</span>
                <input
                  type="checkbox"
                  checked={tax.on}
                  onChange={(e) => onTaxChange({ ...tax, on: e.target.checked })}
                  aria-label="Apply tax to net"
                  style={{ cursor: "pointer", accentColor: "var(--foreground)", width: "1rem", height: "1rem" }}
                />
              </div>
            </SettingRow>
            <div style={{ height: "1px", background: "var(--border)" }} />
            <SettingRow label="AI model" desc="Model used for document matching">
              <ModelPicker />
            </SettingRow>
            <div style={{ height: "1px", background: "var(--border)" }} />
            <SettingRow label="PayPal transactions" desc="Pulled on demand — nothing runs on a schedule">
              <PaypalSync onSynced={onSynced} />
            </SettingRow>
          </Card>
          <ProjectsSettings onChanged={onProjectsChanged} />
        </div>
        <div style={{ minWidth: 0 }}>
          <UnmatchedDocuments />
        </div>
      </div>
    </div>
  );
}
