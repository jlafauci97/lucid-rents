"use client";

import { useState } from "react";
import type { FAQItem, FAQGroup } from "@/lib/faq/types";

const GROUP_ORDER: FAQGroup[] = ["Rent", "Landlord", "Safety", "Amenities", "Location", "Building"];

export function S09FAQInteractive({ faqs }: { faqs: FAQItem[] }) {
  const counts = GROUP_ORDER.reduce<Record<string, number>>((acc, g) => {
    acc[g] = faqs.filter((f) => f.group === g).length;
    return acc;
  }, {});
  const visibleGroups = GROUP_ORDER.filter((g) => counts[g] > 0);
  const [active, setActive] = useState<FAQGroup>(visibleGroups[0] ?? "Rent");
  const items = faqs.filter((f) => f.group === active || (!f.group && active === visibleGroups[0]));

  return (
    <div className="faq-layout">
      <aside className="faq-side">
        <div className="faq-side-label">Topics</div>
        <ul className="faq-side-list">
          {visibleGroups.map((g) => (
            <li key={g}>
              <button
                type="button"
                onClick={() => setActive(g)}
                className={`faq-side-btn${g === active ? " is-active" : ""}`}
              >
                <span>{g}</span>
                <span className="faq-side-count">{counts[g]}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <ul className="faq-list">
        {items.map((f, i) => (
          <li key={`${active}-${i}`} className="faq-item">
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
    </div>
  );
}
