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

      <div className="ll-faq-grid">
        {items.map((item) => (
          <div key={item.q} className="ll-faq-card">
            <h4>{item.q}</h4>
            <p>{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
