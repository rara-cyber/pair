import type { ReactNode } from "react";
import { CurrencyPicker } from "./CurrencyPicker";
import { ModelPicker } from "./ModelPicker";
import { Card } from "./ui/Card";
import { ProjectsSettings } from "./ProjectsSettings";

interface Props {
  baseCurrency: string;
  currencies: string[];
  ratesLoading: boolean;
  ratesError: boolean;
  onCurrencyChange: (c: string) => void;
  onProjectsChanged?: () => void;
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

export function Settings({ baseCurrency, currencies, ratesLoading, ratesError, onCurrencyChange, onProjectsChanged }: Props) {
  return (
    <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "40px 24px 80px" }}>
      <header style={{ marginBottom: "28px" }}>
        <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginBottom: "8px" }}>SIÁN Portfolio · Internal</div>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 600, letterSpacing: "-0.02em" }}>Settings</h1>
        <p style={{ margin: "6px 0 0", fontSize: "14px", color: "var(--muted-foreground)" }}>App preferences</p>
      </header>
      <Card style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: "34rem" }}>
        <SettingRow label="Base currency" desc="Currency for KPI totals and charts">
          <CurrencyPicker value={baseCurrency} currencies={currencies} loading={ratesLoading} error={ratesError} onChange={onCurrencyChange} />
        </SettingRow>
        <div style={{ height: "1px", background: "var(--border)" }} />
        <SettingRow label="AI model" desc="Model used for document matching">
          <ModelPicker />
        </SettingRow>
      </Card>

      <div style={{ marginTop: "12px" }}>
        <ProjectsSettings onChanged={onProjectsChanged} />
      </div>
    </div>
  );
}
