import { useCallback, useEffect, useRef, useState } from "react";

export function DropZone() {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const dragCounter = useRef(0);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".pdf")) return;
    setLoading(true);
    const form = new FormData();
    form.append("file", file);
    await fetch("/api/match-pdf", { method: "POST", body: form });
    setLoading(false);
  }, []);

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

  if (!dragging && !loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm pointer-events-none">
      <div className="flex flex-col items-center gap-3 border-2 border-dashed border-blue-500 rounded-2xl px-16 py-12 text-blue-400">
        {loading ? (
          <>
            <svg className="w-10 h-10 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M12 3v3m0 12v3M3 12h3m12 0h3" strokeLinecap="round" />
            </svg>
            <span className="text-lg font-medium">Uploading…</span>
          </>
        ) : (
          <span className="text-lg font-medium">Drop PDF to match</span>
        )}
      </div>
    </div>
  );
}
