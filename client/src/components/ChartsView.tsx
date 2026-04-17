import type { Transaction } from "../types";
import type { FxRates } from "../hooks/useFxRates";
import { CashFlowCharts } from "./CashFlowCharts";
import { BalanceTrendChart } from "./BalanceTrendChart";

interface Props {
  transactions: Transaction[];
  baseCurrency: string;
  rates: FxRates | null;
  onMonthClick?: (month: string) => void;
  activeMonth?: string | null;
}

export function ChartsView({ transactions, baseCurrency, rates, onMonthClick, activeMonth }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="px-6 py-20 text-center text-zinc-500 text-sm">
        No transactions match the current filters.
      </div>
    );
  }

  return (
    <div>
      <CashFlowCharts
        transactions={transactions}
        onMonthClick={onMonthClick}
        activeMonth={activeMonth}
      />
      <BalanceTrendChart
        transactions={transactions}
        baseCurrency={baseCurrency}
        rates={rates}
      />
    </div>
  );
}
