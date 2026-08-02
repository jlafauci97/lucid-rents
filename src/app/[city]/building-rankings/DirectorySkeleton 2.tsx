/* ─── Bento style tokens (subset used by this skeleton) ─────────── */
const SANS = `"Geist", "Inter", system-ui, sans-serif`;
const MONO = `"Geist Mono", ui-monospace, monospace`;
const INK = "#0a0e1a";
const INK_SOFT = "#3a3f54";
const INK_MUTE = "#73798f";
const BORDER = "rgba(10,14,26,0.08)";
const ACCENT_SKY = "#3b82f6";
const SHADOW = "0 1px 2px rgba(10,14,26,0.04), 0 8px 24px -12px rgba(10,14,26,0.08)";

const SORT_LABELS = ["Violations", "Complaints", "Evictions", "Lawsuits", "Per-unit"];

interface DirectorySkeletonProps {
  regionLabel: string;
}

export function DirectorySkeleton({ regionLabel }: DirectorySkeletonProps) {
  return (
    <section id="directory" className="mb-14 scroll-mt-24">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-6">
        <div>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT_SKY, fontWeight: 600 }}>
            Section 10
          </span>
          <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
            Browse the directory
          </h2>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: INK_MUTE, fontWeight: 600 }}>
          Loading…
        </span>
      </div>

      {/* Sort pills (static, non-interactive placeholders) */}
      <div className="flex flex-wrap gap-2 mb-3">
        {SORT_LABELS.map((label, i) => (
          <span
            key={label}
            className="px-4 py-2 text-sm font-semibold"
            style={{
              background: i === 0 ? INK : "#fff",
              color: i === 0 ? "#fff" : INK_SOFT,
              borderRadius: 999,
              border: `1px solid ${i === 0 ? INK : BORDER}`,
              fontFamily: SANS,
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Borough filter pills placeholder — single "All" pill so the row keeps shape */}
      <div className="flex flex-wrap gap-2 mb-5">
        <span
          className="px-3 py-1.5 text-sm"
          style={{
            background: INK,
            color: "#fff",
            borderRadius: 8,
            border: `1px solid ${INK}`,
            fontFamily: SANS,
            fontWeight: 500,
          }}
        >
          All {regionLabel.toLowerCase()}s
        </span>
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            aria-hidden
            style={{
              display: "inline-block",
              height: 30,
              width: 80,
              borderRadius: 8,
              background: "#eef0f4",
              border: `1px solid ${BORDER}`,
            }}
          />
        ))}
      </div>

      {/* 25 row-shaped placeholders */}
      <div style={{ background: "#fff", borderRadius: 20, border: `1px solid ${BORDER}`, boxShadow: SHADOW, overflow: "hidden" }}>
        <ol className="m-0 p-0 list-none">
          {Array.from({ length: 25 }).map((_, idx) => (
            <li
              key={idx}
              aria-hidden
              style={{ borderTop: idx > 0 ? `1px solid ${BORDER}` : "none" }}
            >
              <div className="flex items-center gap-4 sm:gap-6 px-5 sm:px-7 py-4 sm:py-5">
                <span style={{ minWidth: 40, fontFamily: MONO, fontSize: 18, fontWeight: 700, color: INK_MUTE, fontVariantNumeric: "tabular-nums" }}>
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <div style={{ height: 16, width: "55%", background: "#eef0f4", borderRadius: 4, marginBottom: 8 }} />
                  <div style={{ height: 11, width: "35%", background: "#f3f5f8", borderRadius: 4, marginBottom: 10 }} />
                  <div style={{ height: 10, width: "70%", background: "#f3f5f8", borderRadius: 4 }} />
                </div>
                <span className="hidden sm:inline-flex" style={{ width: 32, height: 32, borderRadius: 10, background: "#f3f5f8" }} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
