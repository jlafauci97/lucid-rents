// Heights are 90th-percentile estimates as of 2026-05-27.
// minHeight (not height) so over-estimation doesn't leave dead space below
// content once data resolves. Update only if a section's content density
// changes meaningfully. Undersizing causes CLS — always err high.

interface Props {
  num: string;
  title: string;
  sub?: string;
  id?: string;
}

const MIN_HEIGHTS: Record<string, number> = {
  rent: 740,
  "submarket-trends": 460,
  "neighborhood-risks": 420,
  issues: 700,
  reviews: 820,
  amenities: 380,
  landlord: 580,
  location: 540,
  "about-this-area": 340,
  history: 540,
  similar: 600,
  faq: 380,
  "la-insights": 420,
  "chicago-insights": 420,
  "miami-insights": 420,
  "houston-insights": 420,
  "nyc-insights": 420,
};
const DEFAULT_MIN_HEIGHT = 320;

/**
 * SectionSkeleton — placeholder rendered in Suspense fallback position while
 * a section's data is still loading. Keeps the section-head visible so the
 * scroll position and anchor links don't jump, and shows a soft pulse bar
 * in the body slot. The v2-pulse keyframes are declared inline because the
 * streaming fallbacks can mount before loading.tsx' style tag applies.
 */
export function SectionSkeleton({ num, title, sub, id }: Props) {
  const minHeight = id ? (MIN_HEIGHTS[id] ?? DEFAULT_MIN_HEIGHT) : DEFAULT_MIN_HEIGHT;
  return (
    <section className="section" id={id}>
      <style>{`
        @keyframes v2-pulse {
          0%   { opacity: 0.6; }
          50%  { opacity: 0.3; }
          100% { opacity: 0.6; }
        }
      `}</style>
      <div className="section-head">
        <div>
          <div className="num">{num}</div>
          <h2>{title}</h2>
          {sub ? <p className="ww-sub" style={{ marginTop: 4 }}>{sub}</p> : null}
        </div>
        <div className="meta"></div>
      </div>
      <div
        className="ri-card"
        style={{
          minHeight,
          background: "rgba(0,0,0,0.03)",
          animation: "v2-pulse 1.4s ease-in-out infinite",
        }}
        aria-hidden="true"
      />
    </section>
  );
}
