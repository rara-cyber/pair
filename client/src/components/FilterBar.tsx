import type { ReactNode } from "react";
import type { Filter } from "../types";

interface Props {
  filters: Filter[];
  onRemove: (index: number) => void;
  onClear: () => void;
  leftContent?: ReactNode;
}

export function FilterBar({ filters, onRemove, onClear, leftContent }: Props) {
  const hasFilters = filters.length > 0;
  if (!leftContent && !hasFilters) return null;

  return (
    <div className="flex items-center gap-2 px-6 py-2 bg-zinc-900 border-b border-zinc-800 flex-wrap">
      {leftContent}
      {leftContent && hasFilters && <div className="w-px h-4 bg-zinc-700 mx-1" />}
      {hasFilters && (
        <>
          <span className="text-xs text-zinc-400">Filters:</span>
          {filters.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300"
            >
              <span className="text-zinc-500">{f.key === "_month" ? "month" : f.key}:</span>
              <span className="truncate max-w-40">{f.value}</span>
              <button
                onClick={() => onRemove(i)}
                className="ml-1 text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                ×
              </button>
            </span>
          ))}
          <button
            onClick={onClear}
            className="text-xs text-zinc-500 hover:text-zinc-300 ml-2 cursor-pointer"
          >
            Clear all
          </button>
        </>
      )}
    </div>
  );
}
