import { useEffect, useState } from "react";
import { Card } from "./ui/Card";

interface Project { name: string; sortOrder: number; patterns: string[] }

const inputStyle: React.CSSProperties = {
  padding: "0.4rem 0.6rem", borderRadius: "var(--radius-lg)",
  border: "1px solid var(--input)", background: "var(--background)",
  color: "var(--foreground)", fontSize: "0.8125rem", fontFamily: "var(--font-sans)",
  outline: "none", width: "100%",
};

const linkStyle: React.CSSProperties = {
  fontSize: "0.6875rem", color: "var(--muted-foreground)", background: "none",
  border: "none", cursor: "pointer", padding: 0, fontFamily: "var(--font-sans)",
};

export function ProjectsSettings({ onChanged }: { onChanged?: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [newPatterns, setNewPatterns] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d: { projects: Project[] }) => {
        setProjects(d.projects);
        setDrafts(Object.fromEntries(d.projects.map((p) => [p.name, p.patterns.join(", ")])));
      })
      .catch(() => {});

  useEffect(() => { load(); }, []);

  const save = async (name: string, patternsCsv: string, sortOrder: number) => {
    setBusy(true);
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, patterns: patternsCsv.split(",").map((s) => s.trim()).filter(Boolean), sortOrder }),
    });
    await load();
    setBusy(false);
    onChanged?.();
  };

  const remove = async (name: string) => {
    setBusy(true);
    await fetch(`/api/projects/${encodeURIComponent(name)}`, { method: "DELETE" });
    await load();
    setBusy(false);
    onChanged?.();
  };

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    await save(name, newPatterns, projects.length);
    setNewName("");
    setNewPatterns("");
  };

  return (
    <Card style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "34rem" }}>
      <div>
        <div style={{ fontSize: "0.875rem", fontWeight: 500 }}>Projects</div>
        <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
          Comma-separated patterns, matched case-insensitively against merchant, payer, payee,
          reference and description. First project in the list that matches wins.
        </div>
      </div>

      {projects.map((p, i) => (
        <div key={p.name} style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{p.name}</span>
            <span style={{ display: "inline-flex", gap: "0.6rem" }}>
              {drafts[p.name] !== p.patterns.join(", ") && (
                <button style={{ ...linkStyle, color: "var(--positive)" }} disabled={busy}
                        onClick={() => save(p.name, drafts[p.name] ?? "", p.sortOrder)}>
                  save
                </button>
              )}
              <button style={linkStyle} disabled={busy} onClick={() => remove(p.name)}>delete</button>
            </span>
          </div>
          <input
            style={inputStyle}
            value={drafts[p.name] ?? ""}
            placeholder="No patterns — this project matches nothing"
            onChange={(e) => setDrafts((d) => ({ ...d, [p.name]: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") save(p.name, drafts[p.name] ?? "", p.sortOrder); }}
          />
          {i < projects.length - 1 && <div style={{ height: "1px", background: "var(--border)", marginTop: "0.6rem" }} />}
        </div>
      ))}

      <div style={{ height: "1px", background: "var(--border)" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <input style={inputStyle} placeholder="New project name" value={newName}
               onChange={(e) => setNewName(e.target.value)} />
        <input style={inputStyle} placeholder="Patterns, comma separated (e.g. stripe, shopify)" value={newPatterns}
               onChange={(e) => setNewPatterns(e.target.value)}
               onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <button
          onClick={add}
          disabled={busy || !newName.trim()}
          style={{
            alignSelf: "flex-start", padding: "0.35rem 0.7rem", borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)",
            fontSize: "0.75rem", cursor: newName.trim() ? "pointer" : "not-allowed",
            opacity: newName.trim() ? 1 : 0.5,
          }}
        >
          Add project
        </button>
      </div>
    </Card>
  );
}
