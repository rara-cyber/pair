import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  onIngested?: () => void;
}

export function DropZone({ onIngested }: Props = {}) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const dragCounter = useRef(0);

  const handleFile = useCallback(async (file: File) => {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".pdf")) {
      setLoading(true);
      const form = new FormData(); form.append("file", file);
      const res = await fetch("/api/match-pdf", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      setLoading(false);
      // The server refuses a document it has already attached. Say so — the
      // alternative is a file that appears to vanish.
      if (json.alreadyLinked) setNotice(`Already attached to ${json.transferWiseId}`);
    } else if (lower.endsWith(".zip")) {
      setLoading(true);
      const form = new FormData(); form.append("file", file);
      await fetch("/api/ingest-zip", { method: "POST", body: form });
      setLoading(false);
      onIngested?.();
    }
  }, [onIngested]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current++;
      if (e.dataTransfer?.types.includes("Files")) setDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current === 0) setDragging(false);
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      for (const file of files) await handleFile(file);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleFile]);

  if (!dragging && !loading && !notice) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "color-mix(in srgb, var(--background) 85%, transparent)",
        backdropFilter: "blur(8px)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          padding: "48px 64px",
          borderRadius: "16px",
          border: dragging ? "2px dashed var(--foreground)" : "2px dashed var(--border)",
          background: dragging ? "var(--muted)" : "var(--card)",
          transition: "border-color 200ms cubic-bezier(0.22, 1, 0.36, 1), background 200ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {notice ? (
          <>
            <div
              style={{
                width: "48px", height: "48px", display: "grid", placeItems: "center",
                borderRadius: "12px", background: "var(--muted)", border: "1px solid var(--border)",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--foreground)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div style={{ textAlign: "center", maxWidth: "300px" }}>
              <div style={{ fontSize: "16px", fontWeight: 500, color: "var(--foreground)" }}>
                Nothing to do
              </div>
              <div style={{ fontSize: "13px", color: "var(--muted-foreground)", marginTop: "6px", fontFamily: "var(--font-mono)" }}>
                {notice}
              </div>
            </div>
          </>
        ) : loading ? (
          <>
            <svg
              style={{ width: "40px", height: "40px", color: "var(--foreground)", animation: "spin 1s linear infinite" }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path d="M12 3v3m0 12v3M3 12h3m12 0h3" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: "16px", fontWeight: 500, color: "var(--foreground)" }}>
              Uploading…
            </span>
          </>
        ) : (
          <>
            <div
              style={{
                width: "48px",
                height: "48px",
                display: "grid",
                placeItems: "center",
                borderRadius: "12px",
                background: "var(--muted)",
                border: "1px solid var(--border)",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--foreground)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M12 18v-6" />
                <path d="M9 15l3 3 3-3" />
              </svg>
            </div>
            <div style={{ textAlign: "center", maxWidth: "280px" }}>
              <div style={{ fontSize: "16px", fontWeight: 500, color: "var(--foreground)" }}>
                Drop a PDF to{" "}
                <span style={{ fontFamily: "var(--font-sans)", fontStyle: "italic" }}>
                  match
                </span>
              </div>
              <div style={{ fontSize: "13px", color: "var(--muted-foreground)", marginTop: "6px" }}>
                or a statement .zip to import
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
