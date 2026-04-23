import type { LandlordFAQItem } from "@/app/[city]/landlord/[name]/_data";

interface Props {
  items: LandlordFAQItem[];
}

export function S09_FAQ({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <section className="section" id="faq">
      <div className="section-head">
        <div>
          <div className="num">09 / 09</div>
          <h2>Questions, answered.</h2>
        </div>
        <div className="meta">
          from tenant research
          <br />
          updated from the record
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 12,
          marginTop: "var(--s-5)",
        }}
      >
        {items.map((item) => (
          <div
            key={item.q}
            style={{
              background: "var(--paper)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "16px 18px",
            }}
          >
            <h4 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.005em" }}>
              {item.q}
            </h4>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.55 }}>{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
