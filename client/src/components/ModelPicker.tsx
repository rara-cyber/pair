import { useEffect, useState } from "react";

interface ModelOption {
  id: string;
  label: string;
}

export function ModelPicker() {
  const [current, setCurrent] = useState<string>("");
  const [available, setAvailable] = useState<ModelOption[]>([]);

  useEffect(() => {
    fetch("/api/model")
      .then((r) => r.json())
      .then((data) => {
        setCurrent(data.current);
        setAvailable(data.available);
      })
      .catch(() => {});
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const model = e.target.value;
    fetch("/api/model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    })
      .then((r) => r.json())
      .then((data) => setCurrent(data.current))
      .catch(() => {});
  }

  if (!available.length) return null;

  return (
    <select
      value={current}
      onChange={handleChange}
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
      {available.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
