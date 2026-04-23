import type { FAQItem, FAQGroup } from "@/lib/faq/types";

const GROUP_ORDER: FAQGroup[] = ["Rent", "Landlord", "Safety", "Amenities", "Location", "Building"];

// Server-only component. Uses a radio-group + :checked CSS so users can
// switch the visible group without JavaScript. No client boundary means
// no Suspense/RSC streaming hazard.
export function S09FAQInteractive({ faqs }: { faqs: FAQItem[] }) {
  const counts = GROUP_ORDER.reduce<Record<string, number>>((acc, g) => {
    acc[g] = faqs.filter((f) => f.group === g).length;
    return acc;
  }, {});
  const visibleGroups = GROUP_ORDER.filter((g) => counts[g] > 0);
  if (visibleGroups.length === 0) return null;
  const defaultGroup = visibleGroups[0];

  return (
    <div className="faq-layout">
      {visibleGroups.map((g) => (
        <input
          key={g}
          type="radio"
          name="faq-group"
          id={`faq-tab-${g}`}
          defaultChecked={g === defaultGroup}
          className="faq-tab-input"
          aria-label={`Show ${g} questions`}
        />
      ))}
      <aside className="faq-side">
        <div className="faq-side-label">Topics</div>
        <ul className="faq-side-list">
          {visibleGroups.map((g) => (
            <li key={g}>
              <label htmlFor={`faq-tab-${g}`} className={`faq-side-btn faq-side-btn-${g}`}>
                <span>{g}</span>
                <span className="faq-side-count">{counts[g]}</span>
              </label>
            </li>
          ))}
        </ul>
      </aside>
      <div className="faq-panes">
        {visibleGroups.map((g) => {
          const items = faqs.filter((f) => f.group === g);
          return (
            <ul key={g} className={`faq-list faq-pane faq-pane-${g}`}>
              {items.map((f, i) => (
                <li key={i} className="faq-item">
                  <details>
                    <summary>
                      <span>{f.question}</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                    </summary>
                    <div className="faq-body">{f.answer}</div>
                  </details>
                </li>
              ))}
            </ul>
          );
        })}
      </div>
    </div>
  );
}
