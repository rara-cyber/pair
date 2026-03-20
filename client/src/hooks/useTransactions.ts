import { useState, useEffect, useMemo, useCallback } from "react";
import type { Transaction, ApiResponse, SortConfig, Filter } from "../types";

type LinkFilter = "all" | "filled" | "empty";

export function useTransactions() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortConfig | null>(null);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [documentFilter, setDocumentFilter] = useState<LinkFilter>("all");
  const [dateRange, setDateRangeState] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });

  useEffect(() => {
    fetch("/api/transactions")
      .then((res) => res.json())
      .then((d: ApiResponse) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const toggleSort = (key: keyof Transaction) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  const addFilter = (key: string, value: string) => {
    if (!value) return;
    setFilters((prev) => {
      if (prev.some((f) => f.key === key && f.value === value)) return prev;
      return [...prev, { key, value }];
    });
  };

  const removeFilter = (index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  };

  const clearFilters = useCallback(() => {
    setFilters([]);
    setDocumentFilter("all");
    setDateRangeState({ from: null, to: null });
    setSort(null);
  }, []);

  const setDateRange = useCallback((from: string | null, to: string | null) => {
    setDateRangeState({ from, to });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearFilters();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [clearFilters]);

  const applyLiveMatch = useCallback((event: import("./useProgress").MatchEvent) => {
    setData((prev) => {
      if (!prev) return prev;
      const key = event.linkType === "Expenses" ? "invoiceLinks" : "remittanceLinks";
      const transactions = prev.transactions.map((tx) => {
        if (tx.transferWiseId !== event.transferWiseId) return tx;
        // Enforce one document per transaction
        const hasDoc = (tx.invoiceLinks?.length ?? 0) + (tx.remittanceLinks?.length ?? 0) > 0;
        if (hasDoc) return tx;
        return { ...tx, [key]: [event.link] };
      });
      const stats = {
        ...prev.stats,
        withInvoice: transactions.filter((t) => (t.invoiceLinks?.length ?? 0) > 0).length,
        withRemittance: transactions.filter((t) => (t.remittanceLinks?.length ?? 0) > 0).length,
      };
      return { transactions, stats };
    });
  }, []);

  const deleteLink = async (transferWiseId: string, filename: string, type: "Sales" | "Expenses") => {
    await fetch("/api/match", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, type }),
    });
    // Optimistically update local state
    setData((prev) => {
      if (!prev) return prev;
      const key = type === "Expenses" ? "invoiceLinks" : "remittanceLinks";
      const transactions = prev.transactions.map((tx) => {
        if (tx.transferWiseId !== transferWiseId) return tx;
        return { ...tx, [key]: tx[key]?.filter((l) => l.filename !== filename) ?? [] };
      });
      const stats = {
        ...prev.stats,
        withInvoice: transactions.filter((t) => (t.invoiceLinks?.length ?? 0) > 0).length,
        withRemittance: transactions.filter((t) => (t.remittanceLinks?.length ?? 0) > 0).length,
      };
      return { transactions, stats };
    });
  };

  const cycleDocumentFilter = () =>
    setDocumentFilter((f) => (f === "all" ? "filled" : f === "filled" ? "empty" : "all"));

  const setDocFilter = (f: LinkFilter) => setDocumentFilter(f);

  const filtered = useMemo(() => {
    if (!data) return [];
    let result = data.transactions;

    for (const filter of filters) {
      result = result.filter((tx) => {
        if (filter.key === "_month") return tx.date.startsWith(filter.value);
        if (filter.key === "_direction") {
          if (filter.value === "income") return tx.amount >= 0;
          if (filter.value === "expense") return tx.amount < 0;
          return true;
        }
        const val = String(tx[filter.key as keyof Transaction] ?? "");
        return val === filter.value;
      });
    }

    if (dateRange.from) result = result.filter((tx) => tx.date >= dateRange.from!);
    if (dateRange.to)   result = result.filter((tx) => tx.date <= dateRange.to!);

    const docCount = (tx: typeof result[0]) => (tx.invoiceLinks?.length ?? 0) + (tx.remittanceLinks?.length ?? 0);
    if (documentFilter === "filled") result = result.filter((tx) => docCount(tx) > 0);
    if (documentFilter === "empty")  result = result.filter((tx) => docCount(tx) === 0);

    if (sort && sort.direction) {
      result = [...result].sort((a, b) => {
        const aVal = a[sort.key];
        const bVal = b[sort.key];
        const dir = sort.direction === "asc" ? 1 : -1;

        if (typeof aVal === "number" && typeof bVal === "number") {
          return (aVal - bVal) * dir;
        }
        return String(aVal ?? "").localeCompare(String(bVal ?? "")) * dir;
      });
    }

    return result;
  }, [data, sort, filters, documentFilter, dateRange]);

  const filterByMonth = (month: string) => {
    setFilters((prev) => {
      const without = prev.filter((f) => f.key !== "_month");
      const existing = prev.find((f) => f.key === "_month" && f.value === month);
      return existing ? without : [...without, { key: "_month", value: month }];
    });
  };

  return {
    transactions: filtered,
    allTransactions: data?.transactions ?? [],
    stats: data?.stats ?? null,
    loading,
    error,
    sort,
    toggleSort,
    filters,
    addFilter,
    removeFilter,
    clearFilters,
    documentFilter,
    cycleDocumentFilter,
    deleteLink,
    applyLiveMatch,
    setDocFilter,
    filterByMonth,
    dateRange,
    setDateRange,
  };
}
