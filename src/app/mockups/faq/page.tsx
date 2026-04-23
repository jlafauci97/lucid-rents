"use client";

import { useState } from "react";
import "@/styles/v2-tokens.css";

const ADDR = "57 Thomas Street, Staten Island";

type FaqItem = { q: string; a: string; group: Group };
type Group = "Rent" | "Landlord" | "Safety" | "Location" | "Building";

const FAQS: FaqItem[] = [
  { group: "Rent", q: `What is the rent for a studio at ${ADDR}?`, a: `Based on recent listing data, rent for a studio at ${ADDR} ranges from $1,828 to $2,473 per month, with a median of $2,150.` },
  { group: "Rent", q: `What is the rent for a 1-bedroom at ${ADDR}?`, a: `Rent for a 1-bedroom at ${ADDR} ranges from $1,879 to $2,542 per month, with a median of $2,210.` },
  { group: "Rent", q: `What is the rent for a 2-bedroom at ${ADDR}?`, a: `Rent for a 2-bedroom at ${ADDR} ranges from $2,108 to $2,852 per month, with a median of $2,480.` },
  { group: "Rent", q: `What is the rent for a 3-bedroom at ${ADDR}?`, a: `Rent for a 3-bedroom at ${ADDR} ranges from $2,635 to $3,565 per month, with a median of $3,100.` },
  { group: "Rent", q: `What is the rent for a 4-bedroom at ${ADDR}?`, a: `Rent for a 4-bedroom at ${ADDR} ranges from $2,831 to $3,829 per month, with a median of $3,330.` },
  { group: "Rent", q: `How does rent at ${ADDR} compare to the neighborhood?`, a: `1-bedroom rents are about 13% above the 10306 neighborhood median; 3-bedroom rents are about 11% below.` },
  { group: "Rent", q: `Is ${ADDR} rent stabilized?`, a: `Based on available records, ${ADDR} is not currently registered as rent stabilized. Rents are likely set at market rate.` },
  { group: "Landlord", q: `Who is the landlord of ${ADDR}?`, a: `The registered owner is LIN, CHENGJIE. You can view their full portfolio on Lucid Rents.` },
  { group: "Landlord", q: `Is the landlord of ${ADDR} a good landlord?`, a: `${ADDR}, owned by LIN, CHENGJIE, has an overall grade of A (5.0/5). The building has 1 recorded violation.` },
  { group: "Safety", q: `What is the building rating for ${ADDR}?`, a: `${ADDR} has an overall grade of A with a score of 5.0 out of 5 on Lucid Rents. Based on violations, complaints, and tenant reviews.` },
  { group: "Safety", q: `Are there violations or complaints at ${ADDR}?`, a: `Yes, ${ADDR} has 1 housing violation and 10 complaints on record.` },
  { group: "Location", q: `What schools are near ${ADDR}?`, a: `There are 5 schools near ${ADDR}, including 2 public and 3 private. P.S. 023 Richmondtown is 6 min walk.` },
  { group: "Location", q: `What public transit is near ${ADDR}?`, a: `${ADDR} has 4 transit options nearby. The closest: bus AMBOY RD/THOMAS ST (SIM15, S57), 0.10 mi away.` },
  { group: "Building", q: `When was ${ADDR} built and how many units does it have?`, a: `${ADDR} was built in 1960, has 2 floors, and contains 2 total units.` },
];

const GROUPS: Group[] = ["Rent", "Landlord", "Safety", "Location", "Building"];
const GROUP_COUNTS = GROUPS.reduce<Record<Group, number>>((acc, g) => { acc[g] = FAQS.filter((f) => f.group === g).length; return acc; }, {} as Record<Group, number>);

// ──────────────────────────────────────────────────────────────
// Shared bits
// ──────────────────────────────────────────────────────────────

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
  );
}

function AccordionItem({ item }: { item: FaqItem }) {
  return (
    <li className="faq-item">
      <details>
        <summary>
          <span>{item.q}</span>
          <Chevron />
        </summary>
        <div className="faq-body">{item.a}</div>
      </details>
    </li>
  );
}

// ──────────────────────────────────────────────────────────────
// Variant 1 — Numbered editorial groups
// ──────────────────────────────────────────────────────────────
function Variant1() {
  return (
    <section className="section" id="v1">
      <div className="section-head">
        <div>
          <div className="num">01 / 05  ·  Grouped editorial</div>
          <h2>Frequently asked questions.</h2>
        </div>
      </div>
      {GROUPS.map((g, i) => {
        const items = FAQS.filter((f) => f.group === g);
        if (items.length === 0) return null;
        return (
          <div key={g} style={{ marginTop: i === 0 ? 24 : 36 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, color: "var(--ink-mute)", fontFamily: "var(--sans)", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              <span style={{ color: "var(--sky-deep)", fontWeight: 700 }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ fontWeight: 700, color: "var(--ink)" }}>{g}</span>
              <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span>{items.length} question{items.length !== 1 ? "s" : ""}</span>
            </div>
            <ul className="faq-list">
              {items.map((it, j) => <AccordionItem key={j} item={it} />)}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

// ──────────────────────────────────────────────────────────────
// Variant 2 — Tabbed filter
// ──────────────────────────────────────────────────────────────
function Variant2() {
  const [active, setActive] = useState<Group | "All">("All");
  const items = active === "All" ? FAQS : FAQS.filter((f) => f.group === active);
  const tabs: Array<{ key: Group | "All"; label: string; count: number }> = [
    { key: "All", label: "All", count: FAQS.length },
    ...GROUPS.map((g) => ({ key: g, label: g, count: GROUP_COUNTS[g] })),
  ];
  return (
    <section className="section" id="v2">
      <div className="section-head">
        <div>
          <div className="num">02 / 05  ·  Tabbed filter</div>
          <h2>Frequently asked questions.</h2>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "20px 0 12px" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: `1px solid ${active === t.key ? "var(--ink)" : "var(--border)"}`,
              background: active === t.key ? "var(--ink)" : "var(--paper)",
              color: active === t.key ? "var(--paper)" : "var(--ink)",
              fontFamily: "var(--sans)", fontSize: 13, fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "-0.005em",
            }}
          >
            {t.label} <span style={{ opacity: 0.6, fontWeight: 500, marginLeft: 4 }}>{t.count}</span>
          </button>
        ))}
      </div>
      <ul className="faq-list">
        {items.map((it, i) => <AccordionItem key={i} item={it} />)}
      </ul>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────
// Variant 3 — Ask-bar (AI-style)
// ──────────────────────────────────────────────────────────────
function Variant3() {
  const [query, setQuery] = useState("");
  const filtered = query
    ? FAQS.filter((f) => f.q.toLowerCase().includes(query.toLowerCase()) || f.a.toLowerCase().includes(query.toLowerCase()))
    : FAQS;
  const suggestions = ["rent", "landlord", "violations", "schools", "transit"];
  return (
    <section className="section" id="v3">
      <div className="section-head">
        <div>
          <div className="num">03 / 05  ·  Ask-bar</div>
          <h2>Frequently asked questions.</h2>
        </div>
      </div>
      <div style={{ position: "relative", marginTop: 24 }}>
        <div style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", color: "var(--ink-mute)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Ask about ${ADDR}…`}
          style={{
            width: "100%",
            padding: "18px 18px 18px 50px",
            borderRadius: 14,
            border: "1px solid var(--border-hi)",
            background: "var(--paper)",
            fontFamily: "var(--sans)", fontSize: 16,
            color: "var(--ink)",
            outline: "none",
            letterSpacing: "-0.005em",
          }}
        />
      </div>
      {!query && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "12px 0 20px" }}>
          <span style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-mute)", marginRight: 6, alignSelf: "center" }}>Try:</span>
          {suggestions.map((s) => (
            <button key={s} onClick={() => setQuery(s)} style={{
              padding: "6px 12px", borderRadius: 999, border: "1px solid var(--border)",
              background: "transparent", color: "var(--ink-soft)",
              fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, cursor: "pointer",
            }}>{s}</button>
          ))}
        </div>
      )}
      <ul className="faq-list" style={{ marginTop: 12 }}>
        {filtered.length === 0 ? (
          <li style={{ padding: 20, color: "var(--ink-mute)", fontFamily: "var(--sans)", fontSize: 14 }}>No matches for “{query}”.</li>
        ) : (
          filtered.map((it, i) => <AccordionItem key={i} item={it} />)
        )}
      </ul>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────
// Variant 4 — Key-stat cards + collapsible full list
// ──────────────────────────────────────────────────────────────
function Variant4() {
  const [showAll, setShowAll] = useState(false);
  const cards = [
    { label: "Median rent (1BR)", value: "$2,210", note: "13% above 10306 zip median" },
    { label: "Landlord", value: "LIN, CHENGJIE", note: "Grade A · 5.0 / 5" },
    { label: "Violations", value: "1", note: "+10 complaints on record" },
    { label: "Nearest transit", value: "SIM15, S57", note: "0.10 mi · bus" },
    { label: "Built · Units", value: "1960 · 2", note: "2 floors, residential" },
  ];
  return (
    <section className="section" id="v4">
      <div className="section-head">
        <div>
          <div className="num">04 / 05  ·  TL;DR cards</div>
          <h2>Frequently asked questions.</h2>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 20 }}>
        {cards.map((c) => (
          <div key={c.label} style={{
            background: "var(--paper)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "16px 18px",
          }}>
            <div style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{c.label}</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 22, color: "var(--ink)", marginTop: 6, letterSpacing: "-0.01em" }}>{c.value}</div>
            <div style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-soft)", marginTop: 4 }}>{c.note}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24 }}>
        <button
          onClick={() => setShowAll((v) => !v)}
          style={{
            width: "100%",
            padding: "14px 18px",
            borderRadius: 10,
            border: "1px solid var(--border-hi)",
            background: "var(--paper)",
            color: "var(--ink)",
            fontFamily: "var(--sans)", fontSize: 14, fontWeight: 600,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            letterSpacing: "-0.005em",
          }}
        >
          <span>{showAll ? "Hide" : "See all"} {FAQS.length} questions</span>
          <span style={{ transform: showAll ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><Chevron /></span>
        </button>
        {showAll && (
          <ul className="faq-list" style={{ marginTop: 12 }}>
            {FAQS.map((it, i) => <AccordionItem key={i} item={it} />)}
          </ul>
        )}
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────
// Variant 5 — Sticky sidebar + content pane
// ──────────────────────────────────────────────────────────────
function Variant5() {
  const [active, setActive] = useState<Group>("Rent");
  const items = FAQS.filter((f) => f.group === active);
  return (
    <section className="section" id="v5">
      <div className="section-head">
        <div>
          <div className="num">05 / 05  ·  Sidebar index</div>
          <h2>Frequently asked questions.</h2>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 36, marginTop: 24, alignItems: "start" }}>
        <aside style={{ position: "sticky", top: 20 }}>
          <div style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Topics</div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {GROUPS.map((g) => {
              const count = GROUP_COUNTS[g];
              const isActive = g === active;
              return (
                <li key={g}>
                  <button
                    onClick={() => setActive(g)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: isActive ? "var(--ink)" : "transparent",
                      color: isActive ? "var(--paper)" : "var(--ink-soft)",
                      fontFamily: "var(--sans)", fontSize: 14, fontWeight: isActive ? 600 : 500,
                      cursor: "pointer",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      letterSpacing: "-0.005em",
                    }}
                  >
                    <span>{g}</span>
                    <span style={{ opacity: isActive ? 0.7 : 0.5, fontSize: 12 }}>{count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
        <ul className="faq-list" style={{ margin: 0 }}>
          {items.map((it, i) => <AccordionItem key={i} item={it} />)}
        </ul>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────

export default function FaqMockups() {
  return (
    <div className="v2" style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px 80px" }}>
      <header style={{ marginBottom: 40, borderBottom: "1px solid var(--border)", paddingBottom: 24 }}>
        <div style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Mockups</div>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: 44, color: "var(--ink)", margin: "6px 0 8px", letterSpacing: "-0.015em" }}>FAQ presentation explorations</h1>
        <p style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--ink-soft)", margin: 0, maxWidth: 640 }}>
          Five ways to shorten the perceived length of the 14-question FAQ on the building page. All use the real data from 57 Thomas Street, Staten Island.
        </p>
        <nav style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
          {["v1 · Grouped", "v2 · Tabbed", "v3 · Ask-bar", "v4 · TL;DR cards", "v5 · Sidebar"].map((lbl, i) => (
            <a key={lbl} href={`#v${i + 1}`} style={{
              padding: "6px 12px", borderRadius: 999, border: "1px solid var(--border)",
              background: "var(--paper)", color: "var(--ink)",
              fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600,
              textDecoration: "none",
            }}>{lbl}</a>
          ))}
        </nav>
      </header>
      <Variant1 />
      <Variant2 />
      <Variant3 />
      <Variant4 />
      <Variant5 />
    </div>
  );
}
