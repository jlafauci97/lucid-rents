/**
 * WayfinderRail — verbatim port of mockup at public/mockups/building-v1.html,
 * lines 3123–3176.
 *
 *   <aside class="wayfinder">
 *     <header class="way-head">
 *       <div class="way-grade">B+</div>
 *       <div class="way-meta">
 *         <div class="way-eyebrow">LucidIQ Score</div>
 *         <div class="way-name">Manhattan<br/>Plaza</div>
 *       </div>
 *     </header>
 *     <ol class="waylist">
 *       <li [class="active"]><a href="#anchor">
 *         <span class="wicon"><svg>…</svg></span>
 *         Label
 *       </a></li>
 *       … 9 links
 *     </ol>
 *     <div class="tools">
 *       <a class="tool"><svg>…</svg>Save</a>
 *       <a class="tool"><svg>…</svg>Share</a>
 *       <a class="tool"><svg>…</svg>Write a review</a>
 *     </div>
 *   </aside>
 *
 * Only mechanical changes: class→className, stroke-width→strokeWidth, <br/>→<br />.
 */

interface Props {
  grade: string;
  buildingName: string;
}

export function WayfinderRail({ grade, buildingName }: Props) {
  // Split the name into two lines for the way-name <br/> break. We prefer to
  // break at a space near the middle; if no space exists we render one line.
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
        <li className="active"><a href="#rent">
          <span className="wicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>
          Rental intelligence
        </a></li>
        <li><a href="#issues">
          <span className="wicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg></span>
          Violations, 311, &amp; more
        </a></li>
        <li><a href="#reviews">
          <span className="wicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
          Tenant Reviews
        </a></li>
        <li><a href="#amenities">
          <span className="wicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8 5.8 21.3l2.4-7.4L2 9.4h7.6z"/></svg></span>
          Amenities
        </a></li>
        <li><a href="#landlord">
          <span className="wicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg></span>
          Landlord
        </a></li>
        <li><a href="#location">
          <span className="wicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></span>
          Location
        </a></li>
        <li><a href="#history">
          <span className="wicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
          History
        </a></li>
        <li><a href="#similar">
          <span className="wicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></span>
          Similar buildings
        </a></li>
        <li><a href="#faq">
          <span className="wicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg></span>
          FAQ
        </a></li>
      </ol>

      <div className="tools">
        <a className="tool"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>Save</a>
        <a className="tool"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Share</a>
        <a className="tool"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>Write a review</a>
      </div>
    </aside>
  );
}
