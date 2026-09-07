import type { Theme } from "../../hooks/useTheme";
import { flushSync } from "react-dom";

interface Props {
  theme: Theme;
  toggle: () => void;
}

/* Both icons render always; index.css crossfades them on html.dark. */
const SunIcon = (
  <svg className="icon-sun" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);
const MoonIcon = (
  <svg className="icon-moon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
  </svg>
);

export function ThemeToggle({ theme, toggle }: Props) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
      onClick={(e) => {
        const btn = e.currentTarget;
        document.documentElement.style.setProperty("--theme-reveal-x", `${e.clientX}px`);
        document.documentElement.style.setProperty("--theme-reveal-y", `${e.clientY}px`);
        btn.classList.remove("theme-sting");
        void btn.offsetWidth; // restart the glow animation
        btn.classList.add("theme-sting");
        const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const vt = (document as Document & { startViewTransition?: (cb: () => void) => void }).startViewTransition;
        if (reduced || !vt) { toggle(); return; }
        vt.call(document, () => flushSync(toggle));
      }}
    >
      {SunIcon}
      {MoonIcon}
    </button>
  );
}
