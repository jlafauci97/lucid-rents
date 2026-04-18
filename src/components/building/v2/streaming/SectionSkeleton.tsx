/**
 * SectionSkeleton — shared placeholder used by every streamed section wrapper.
 *
 * Preserves the section header (e.g. "03 / 09 Tenant reviews.") so the page
 * structure is visibly "what's coming" while chunks stream in. The body is a
 * gently pulsing block that sits inside the real `.section` container so the
 * layout doesn't shift when the real content replaces it.
 */

interface Props {
  num: string;
  title: string;
  id?: string;
  /** Approximate height of the real section body — tune per section. */
  height?: number;
}

export function SectionSkeleton({ num, title, id, height = 240 }: Props) {
  return (
    <section className="section" id={id}>
      <div className="section-head">
        <div>
          <div className="num">{num}</div>
          <h2>{title}</h2>
        </div>
        <div className="meta"></div>
      </div>
      <div
        className="v2-skeleton"
        style={{
          height,
          background: "var(--v2-border, rgba(0,0,0,0.06))",
          borderRadius: 14,
        }}
      />
    </section>
  );
}

/**
 * SideRail skeleton — mimics the right rail's stack of cards so the layout
 * column holds the same width while streaming.
 */
export function SideRailSkeleton() {
  return (
    <aside className="sr" aria-label="Building side info" style={{ display: "grid", gap: 16 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="v2-skeleton"
          style={{
            height: i === 0 ? 200 : 160,
            background: "rgba(219, 234, 254, 0.4)",
            borderRadius: 14,
          }}
        />
      ))}
    </aside>
  );
}
