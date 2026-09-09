/* One source of truth for the SIÁN lockup — it renders in both the compact and
   desktop headers, for the same reason VIEW_TABS is hoisted: the two copies
   drifted apart before. Takes the house lockup's proportions from
   data-playground (SIÁN at 600/15px, "Agency" muted 13px sentence case) but
   leads with pair's own mark instead of the {·} — same geometry and emerald
   links as the favicon, drawn bare so it sits inline like a glyph rather than
   dropping a black tile into the header. */
export function Brand() {
  return (
    <a
      href="#"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        textDecoration: "none",
        color: "inherit",
        minWidth: 0,
      }}
    >
      {/* viewBox is cropped to the mark's stroked bounds, not the 24-grid it is
          drawn on — a 0 0 24 24 box leaves a third of the width empty, which
          renders the glyph a third smaller than the cap height beside it.
          Stroke is 1.9 rather than the favicon's 2.2 so the two links keep a
          visible gap at this size instead of merging into one bar. */}
      <svg
        width="24"
        height="19"
        viewBox="1.9 1.9 20.2 16.2"
        fill="none"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ flex: "none" }}
      >
        <rect x="3" y="3" width="7" height="10" rx="1" stroke="var(--foreground)" />
        <rect x="14" y="7" width="7" height="10" rx="1" stroke="var(--foreground)" />
        <path d="M10 8h4" stroke="var(--positive)" />
        <path d="M10 12h4" stroke="var(--positive)" strokeDasharray="2 2" />
      </svg>
      <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "15px", letterSpacing: "-0.02em", color: "var(--foreground)" }}>
        SIÁN
      </span>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--muted-foreground)" }}>
        Agency
      </span>
    </a>
  );
}
