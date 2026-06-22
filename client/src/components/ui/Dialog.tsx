import type { CSSProperties, ReactNode } from "react";

interface DialogProps { open: boolean; onClose: () => void; children: ReactNode; width?: string; }
interface BoxProps { children?: ReactNode; style?: CSSProperties; }

export function Dialog({ open, onClose, children, width = "640px" }: DialogProps) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", padding: "1.5rem",
        background: "rgba(0,0,0,0.10)", backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: width, maxHeight: "90vh", overflow: "auto",
          background: "var(--popover)", color: "var(--popover-foreground)",
          borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)",
          border: "1px solid var(--border)", padding: "1.25rem",
        }}
      >{children}</div>
    </div>
  );
}

export function DialogHeader({ children, style }: BoxProps) {
  return <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", ...style }}>{children}</div>;
}
export function DialogTitle({ children, style }: BoxProps) {
  return <div style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: 500, ...style }}>{children}</div>;
}
export function DialogDescription({ children, style }: BoxProps) {
  return <div style={{ fontSize: "0.875rem", color: "var(--muted-foreground)", ...style }}>{children}</div>;
}
export function DialogBody({ children, style }: BoxProps) {
  return <div style={style}>{children}</div>;
}
export function DialogFooter({ children, style }: BoxProps) {
  return <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end", gap: "0.5rem", ...style }}>{children}</div>;
}
