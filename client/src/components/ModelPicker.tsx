import { useEffect, useState } from "react";
import { Select } from "./ui/Select";

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
    <Select value={current} onChange={handleChange}>
      {available.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label}
        </option>
      ))}
    </Select>
  );
}
