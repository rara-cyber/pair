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
      className="text-xs bg-zinc-900 border border-zinc-700 text-zinc-300 rounded-md px-2 py-1 focus:outline-none focus:border-zinc-500 hover:border-zinc-500 transition-colors cursor-pointer"
    >
      {available.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
