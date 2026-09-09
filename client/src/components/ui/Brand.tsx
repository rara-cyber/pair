/* One source of truth for the SIÁN lockup — it renders in both the compact and
   desktop headers, for the same reason VIEW_TABS is hoisted: the two copies
   drifted apart before. Matches the house lockup in data-playground exactly
   (mono {·} mark, SIÁN at 600/15px, "Agency" in muted sentence case). */
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
      <span
        aria-hidden="true"
        style={{ fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 400, color: "var(--foreground)", flex: "none" }}
      >
        {"{·}"}
      </span>
      <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "15px", letterSpacing: "-0.02em", color: "var(--foreground)" }}>
        SIÁN
      </span>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--muted-foreground)" }}>
        Agency
      </span>
    </a>
  );
}
