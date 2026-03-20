import { useState, useEffect } from "react";

export const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€", USD: "$", GBP: "£", CZK: "Kč", CHF: "Fr", JPY: "¥", CNY: "¥",
};

export interface FxRates {
  // rates relative to EUR (1 EUR = X currency)
  [currency: string]: number;
}

export function useFxRates() {
  const [rates, setRates] = useState<FxRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("https://api.frankfurter.app/latest?from=EUR", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setRates({ EUR: 1, ...data.rates });
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(true);
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return { rates, loading, error };
}

/**
 * Convert an amount from one currency to another using EUR-based rates.
 * Falls back to the raw amount if rates are unavailable.
 */
export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: FxRates | null
): number {
  if (!rates || fromCurrency === toCurrency) return amount;
  const fromRate = rates[fromCurrency] ?? 1;
  const toRate = rates[toCurrency] ?? 1;
  // amount → EUR → target
  return (amount / fromRate) * toRate;
}
