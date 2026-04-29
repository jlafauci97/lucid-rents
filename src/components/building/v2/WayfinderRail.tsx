"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Props {
  grade: string;
  buildingName: string;
  city: string;
  buildingPath: string;
  buildingId: string;
}

const SECTIONS = [
  { id: "rent", label: "Rental intelligence", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
  { id: "issues", label: "Violations, 311, & more", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg> },
  { id: "reviews", label: "Tenant Reviews", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
  { id: "amenities", label: "Amenities", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8 5.8 21.3l2.4-7.4L2 9.4h7.6z"/></svg> },
  { id: "landlord", label: "Landlord", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg> },
  { id: "location", label: "Location", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
  { id: "history", label: "History", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { id: "similar", label: "Similar buildings", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
  { id: "faq", label: "FAQ", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg> },
];

export function WayfinderRail({ grade, buildingName, city, buildingPath, buildingId }: Props) {
  const router = useRouter();
  const [activeId, setActiveId] = useState("rent");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          // Pick the one closest to the top of the viewport
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-10% 0px -60% 0px", threshold: 0 }
    );

    for (const el of els) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // On mobile the wayfinder is a horizontal scroll strip pinned to the bottom.
  // Keep the active tab centered so users can see what's next as they scroll.
  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth > 900) return;
    const activeEl = document.querySelector(".v2 .waylist li.active") as HTMLElement | null;
    const parent = activeEl?.closest(".waylist") as HTMLElement | null;
    if (!activeEl || !parent) return;
    const targetLeft = activeEl.offsetLeft - parent.clientWidth / 2 + activeEl.clientWidth / 2;
    parent.scrollTo({ left: targetLeft, behavior: "smooth" });
  }, [activeId]);

  // Split the name into two lines
  const spaceIdx = (() => {
    if (!buildingName.includes(" ")) return -1;
    const target = Math.floor(buildingName.length / 2);
    let best = -1; let bestDist = Infinity;
    for (let i = 0; i < buildingName.length; i++) {
      if (buildingName[i] === " ") {
        const d = Math.abs(i - target);
        if (d < bestDist) { bestDist = d; best = i; }
      }
    }
    return best;
  })();
  const firstLine = spaceIdx > 0 ? buildingName.slice(0, spaceIdx) : buildingName;
  const secondLine = spaceIdx > 0 ? buildingName.slice(spaceIdx + 1) : null;

  return (
    <aside className="wayfinder">
      <header className="way-head">
        <div className="way-grade">{grade}</div>
        <div className="way-meta">
          <div className="way-eyebrow">LucidIQ Score</div>
          <div className="way-name">{firstLine}{secondLine ? <><br />{secondLine}</> : null}</div>
        </div>
      </header>

      <ol className="waylist">
        {SECTIONS.map((s) => (
          <li key={s.id} className={activeId === s.id ? "active" : undefined}>
            <a href={`#${s.id}`}>
              <span className="wicon">{s.icon}</span>
              {s.label}
            </a>
          </li>
        ))}
      </ol>

      <div className="tools">
        <a
          className="tool"
          style={{ cursor: saving ? "wait" : "pointer" }}
          onClick={async () => {
            if (saving) return;
            setSaving(true);
            try {
              const method = saved ? "DELETE" : "POST";
              const res = await fetch("/api/save", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ buildingId }),
              });
              if (res.status === 401) { router.push("/login"); return; }
              if (res.ok || res.status === 409) setSaved(!saved);
            } catch { /* network error */ } finally { setSaving(false); }
          }}
        ><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill={saved ? "currentColor" : "none"}/></svg>{saved ? "Saved" : "Save"}</a>
        <a
          className="tool"
          style={{ cursor: "pointer" }}
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          {copied ? "Copied!" : "Share"}
        </a>
        <Link href={`/${city}/review/new`} className="tool"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>Write a review</Link>
      </div>
    </aside>
  );
}
