import { useState } from "react";
import type { PdfLink as PdfLinkType } from "../types";

interface Props {
  links?: PdfLinkType[];
  onDelete?: (filename: string, type: "Sales" | "Expenses") => void;
}

const METHOD_COLORS: Record<string, string> = {
  reference: "text-emerald-500",
  "amount+date": "text-amber-500",
  "amount+month": "text-orange-500",
};

function MethodLabel({ method }: { method: string }) {
  const label = method === "reference" ? "ref" : method === "amount+date" ? "amt" : method === "ai" ? "ai" : "~amt";
  return (
    <span
      className={`text-[10px] ${METHOD_COLORS[method] || "text-zinc-500"}`}
      title={`Matched by: ${method}`}
    >
      {label}
    </span>
  );
}

export function PdfLink({ links, onDelete }: Props) {
  const [confirming, setConfirming] = useState<string | null>(null);

  if (!links || links.length === 0) {
    return <span className="text-zinc-600">—</span>;
  }

  return (
    <span className="flex flex-col gap-0.5">
      {links.map((link, i) => (
        <span key={i} className="flex items-center gap-1 group">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 text-xs truncate max-w-44 inline-block"
            title={link.filename}
          >
            {link.filename}
          </a>
          {link.matchMethod && <MethodLabel method={link.matchMethod} />}

          {onDelete && confirming !== link.filename && (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirming(link.filename); }}
              className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 text-[10px] leading-none ml-0.5 transition-opacity"
              title="Remove link"
            >
              ✕
            </button>
          )}

          {onDelete && confirming === link.filename && (
            <span className="flex items-center gap-1 ml-1">
              <span className="text-[10px] text-zinc-400">Remove?</span>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(link.filename, link.linkType ?? "Expenses"); setConfirming(null); }}
                className="text-[10px] text-red-400 hover:text-red-300 font-medium"
              >
                Yes
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirming(null); }}
                className="text-[10px] text-zinc-500 hover:text-zinc-300"
              >
                No
              </button>
            </span>
          )}
        </span>
      ))}
    </span>
  );
}
