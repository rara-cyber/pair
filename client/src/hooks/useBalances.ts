import { useState, useEffect } from "react";

export interface Balance {
  source: "wise" | "paypal";
  currency: string;
  amount: number;
  profile?: "personal" | "business";
  label?: string;
}

export function useBalances() {
  const [balances, setBalances] = useState<Balance[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/balances", { signal: controller.signal })
      .then((r) => r.json())
      .then((data: { balances: Balance[] }) => {
        setBalances(data.balances ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setBalances([]);
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return { balances, loading };
}
