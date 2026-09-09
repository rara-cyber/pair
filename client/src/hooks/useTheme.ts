import { useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark";

/* Mirrors the boot script in index.html — keep the two in step or the first
   paint flashes the wrong theme before React hydrates. */
function readInitial(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const t = localStorage.getItem("pair-theme");
    if (t === "light" || t === "dark") return t;
  } catch { /* private mode */ }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readInitial);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0a0a0a" : "#ffffff");
    try { localStorage.setItem("pair-theme", theme); } catch { /* theme just won't persist */ }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle };
}
