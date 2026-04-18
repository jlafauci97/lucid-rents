interface Props {
  num: string;
  title: string;
  sub?: string;
  id?: string;
}

/**
 * SectionSkeleton — placeholder rendered in Suspense fallback position while
 * a section's data is still loading. Keeps the section-head visible so the
 * scroll position and anchor links don't jump, and shows a soft pulse bar
 * in the body slot. The v2-pulse keyframes are declared inline because the
 * streaming fallbacks can mount before loading.tsx' style tag applies.
 */
export function SectionSkeleton({ num, title, sub, id }: Props) {
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
          height: 280,
          background: "rgba(0,0,0,0.03)",
          animation: "v2-pulse 1.4s ease-in-out infinite",
        }}
        aria-hidden="true"
      />
    </section>
  );
}
