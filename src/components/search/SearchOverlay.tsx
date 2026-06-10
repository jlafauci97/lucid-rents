"use client";

/**
 * Site-wide search overlay. Triggered by the toolbar pill or ⌘K. Renders a
 * centered, blurred-backdrop modal with live autocomplete across:
 *   • Buildings     (via /api/search)
 *   • Landlords     (via /api/landlords?search=…)
 *   • Neighborhoods (client-side filter of getAllNeighborhoodsByCity)
 *
 * Empty state: city-scoped popular buildings, neighborhood suggestions,
 * and largest landlords (fetched once on open).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  X,
  Building2,
  MapPin,
  Users,
  ArrowRight,
  Loader2,
  CornerDownLeft,
  Sparkles,
} from "lucide-react";
import { CITY_META, type City } from "@/lib/cities";
import { buildingUrl, landlordUrl } from "@/lib/seo";
import {
  getAllNeighborhoodsByCity,
  neighborhoodPageSlugByCity,
} from "@/lib/neighborhoods";

interface BuildingSuggestion {
  kind: "building";
  id: string;
  full_address: string;
  borough: string;
  slug: string;
  review_count?: number | null;
  violation_count?: number | null;
}
interface LandlordSuggestion {
  kind: "landlord";
  name: string;
  slug: string;
  building_count?: number | null;
  total_violations?: number | null;
}
interface NeighborhoodSuggestion {
  kind: "neighborhood";
  zipCode: string;
  name: string;
  region: string;
  slug: string;
}
type Suggestion =
  | BuildingSuggestion
  | LandlordSuggestion
  | NeighborhoodSuggestion;

/** Interpretation block returned by POST /api/search/natural. */
interface NlInterpretation {
  city: string;
  borough: string | null;
  neighborhood: string | null;
  zip: string | null;
  keywords: string;
  filters: {
    rentStabilized: boolean | null;
    maxViolations: "none" | "low" | null;
    minScore: number | null;
  };
  sort: string;
}

type NlStatus = "idle" | "loading" | "done" | "error";

/** One-line human summary, e.g. "Astoria · rent-stabilized · no violations". */
function summarizeInterpretation(i: NlInterpretation | null): string {
  if (!i) return "";
  const parts: string[] = [];
  if (i.neighborhood) parts.push(i.neighborhood);
  else if (i.borough) parts.push(i.borough);
  else if (i.zip) parts.push(i.zip);
  if (i.filters?.rentStabilized) parts.push("rent-stabilized");
  if (i.filters?.maxViolations === "none") parts.push("no violations");
  else if (i.filters?.maxViolations === "low") parts.push("few violations");
  if (typeof i.filters?.minScore === "number")
    parts.push(`score ${i.filters.minScore}+`);
  if (i.sort === "score-desc") parts.push("top-rated first");
  else if (i.sort === "reviews-desc") parts.push("most reviewed first");
  if (i.keywords) parts.push(`“${i.keywords}”`);
  return parts.join(" · ");
}

interface Props {
  city: City;
  onClose: () => void;
}

export function SearchOverlay({ city, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const [mounted, setMounted] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [buildings, setBuildings] = useState<BuildingSuggestion[]>([]);
  const [landlords, setLandlords] = useState<LandlordSuggestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [popularBuildings, setPopularBuildings] = useState<
    BuildingSuggestion[]
  >([]);
  const [topLandlords, setTopLandlords] = useState<LandlordSuggestion[]>([]);
  // "Smart search" (natural-language) state — replaces the result list when done.
  const [nlStatus, setNlStatus] = useState<NlStatus>("idle");
  const [nlBuildings, setNlBuildings] = useState<BuildingSuggestion[]>([]);
  const [nlSummary, setNlSummary] = useState("");

  const cityMeta = CITY_META[city];
  const prefix = cityMeta?.urlPrefix ?? "nyc";
  const cityName = cityMeta?.name ?? "NYC";

  const allNeighborhoods = useMemo(
    () => getAllNeighborhoodsByCity(city),
    [city],
  );

  const featuredNeighborhoods = useMemo<NeighborhoodSuggestion[]>(() => {
    return allNeighborhoods.slice(0, 6).map((n) => ({
      kind: "neighborhood",
      zipCode: n.zipCode,
      name: n.name,
      region: n.region,
      slug: neighborhoodPageSlugByCity(n.zipCode, city),
    }));
  }, [allNeighborhoods, city]);

  const neighborhoods = useMemo<NeighborhoodSuggestion[]>(() => {
    const trimmed = q.trim().toLowerCase();
    if (trimmed.length < 2) return [];
    return allNeighborhoods
      .filter(
        (n) =>
          n.name.toLowerCase().includes(trimmed) ||
          n.zipCode.toLowerCase().includes(trimmed),
      )
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(trimmed) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(trimmed) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 4)
      .map<NeighborhoodSuggestion>((n) => ({
        kind: "neighborhood",
        zipCode: n.zipCode,
        name: n.name,
        region: n.region,
        slug: neighborhoodPageSlugByCity(n.zipCode, city),
      }));
  }, [q, allNeighborhoods, city]);

  // Mount: focus input + lock body scroll
  useEffect(() => {
    setMounted(true);
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Esc to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Empty-state fetch: popular buildings + largest landlords (city-scoped)
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const [bRes, lRes] = await Promise.all([
          fetch(`/api/rankings?city=${city}&sort=violations&page=1`, {
            signal: controller.signal,
          }),
          fetch(`/api/landlords?city=${city}&sort=buildings&page=1`, {
            signal: controller.signal,
          }),
        ]);
        if (bRes.ok) {
          const j = await bRes.json();
          const rows: BuildingSuggestion[] = (j.buildings ?? [])
            .slice(0, 4)
            .map(
              (b: {
                id: string;
                full_address: string;
                borough: string;
                slug?: string;
                review_count?: number | null;
                violation_count?: number | null;
              }) => ({
                kind: "building",
                id: b.id,
                full_address: b.full_address,
                borough: b.borough,
                slug: b.slug ?? "",
                review_count: b.review_count,
                violation_count: b.violation_count,
              }),
            );
          setPopularBuildings(rows);
        }
        if (lRes.ok) {
          const j = await lRes.json();
          const rows: LandlordSuggestion[] = (j.landlords ?? [])
            .slice(0, 4)
            .map(
              (l: {
                name: string;
                slug?: string;
                buildingCount?: number | null;
                building_count?: number | null;
                totalViolations?: number | null;
                total_violations?: number | null;
              }) => ({
                kind: "landlord",
                name: l.name,
                slug: l.slug ?? "",
                building_count: l.buildingCount ?? l.building_count ?? null,
                total_violations:
                  l.totalViolations ?? l.total_violations ?? null,
              }),
            );
          setTopLandlords(rows);
        }
      } catch {
        // swallow; empty state just shows nothing for that section
      }
    })();
    return () => controller.abort();
  }, [city]);

  // Debounced live autocomplete (≥2 chars)
  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      seq.current++; // invalidate any in-flight responses
      setBuildings([]);
      setLandlords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    // Stale-response guard: only the latest request may apply state or clear
    // loading. Abort covers cleanup, but an in-flight response can still
    // resolve after a newer request has started.
    const mySeq = ++seq.current;
    const t = window.setTimeout(async () => {
      try {
        const [bRes, lRes] = await Promise.all([
          fetch(
            `/api/search?q=${encodeURIComponent(trimmed)}&city=${city}&limit=5`,
            { signal: controller.signal },
          ),
          fetch(
            `/api/landlords?search=${encodeURIComponent(trimmed)}&city=${city}&page=1`,
            { signal: controller.signal },
          ),
        ]);
        if (bRes.ok) {
          const j = await bRes.json();
          const rows: BuildingSuggestion[] = (j.buildings ?? [])
            .slice(0, 5)
            .map(
              (b: {
                id: string;
                full_address: string;
                borough: string;
                slug: string;
                review_count?: number | null;
                violation_count?: number | null;
              }) => ({
                kind: "building",
                id: b.id,
                full_address: b.full_address,
                borough: b.borough,
                slug: b.slug,
                review_count: b.review_count,
                violation_count: b.violation_count,
              }),
            );
          if (mySeq === seq.current) setBuildings(rows);
        } else if (mySeq === seq.current) {
          setBuildings([]);
        }
        if (lRes.ok) {
          const j = await lRes.json();
          const rows: LandlordSuggestion[] = (j.landlords ?? [])
            .slice(0, 4)
            .map(
              (l: {
                name: string;
                slug?: string;
                buildingCount?: number | null;
                building_count?: number | null;
                totalViolations?: number | null;
                total_violations?: number | null;
              }) => ({
                kind: "landlord",
                name: l.name,
                slug: l.slug ?? "",
                building_count: l.buildingCount ?? l.building_count ?? null,
                total_violations:
                  l.totalViolations ?? l.total_violations ?? null,
              }),
            );
          if (mySeq === seq.current) setLandlords(rows);
        } else if (mySeq === seq.current) {
          setLandlords([]);
        }
      } catch (err) {
        if (
          (err as { name?: string }).name !== "AbortError" &&
          mySeq === seq.current
        ) {
          setBuildings([]);
          setLandlords([]);
        }
      } finally {
        if (mySeq === seq.current) setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [q, city]);

  // Any edit to the query invalidates a previous smart-search answer.
  useEffect(() => {
    setNlStatus("idle");
    setNlBuildings([]);
    setNlSummary("");
  }, [q, city]);

  // Smart search: POST the raw query to /api/search/natural. Follows the same
  // seq-guard pattern as the autocomplete fetch above — bumping seq invalidates
  // any in-flight autocomplete response, and a later keystroke (which also
  // bumps seq) invalidates this response.
  async function askLucid() {
    const query = q.trim();
    if (!query) return;
    const mySeq = ++seq.current;
    setLoading(false);
    setNlStatus("loading");
    try {
      const res = await fetch("/api/search/natural", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, city }),
      });
      if (mySeq !== seq.current) return;
      if (!res.ok) {
        setNlStatus("error");
        return;
      }
      const j = await res.json();
      if (mySeq !== seq.current) return;
      const rows: BuildingSuggestion[] = (j.buildings ?? [])
        .slice(0, 8)
        .map(
          (b: {
            id: string;
            full_address: string;
            borough: string;
            slug?: string;
            review_count?: number | null;
            violation_count?: number | null;
          }) => ({
            kind: "building",
            id: b.id,
            full_address: b.full_address,
            borough: b.borough,
            slug: b.slug ?? "",
            review_count: b.review_count,
            violation_count: b.violation_count,
          }),
        );
      setNlBuildings(rows);
      setNlSummary(summarizeInterpretation(j.interpretation ?? null));
      setNlStatus("done");
    } catch {
      if (mySeq === seq.current) setNlStatus("error");
    }
  }

  const flat: Suggestion[] = useMemo(
    () =>
      nlStatus === "done"
        ? nlBuildings
        : [...buildings, ...neighborhoods, ...landlords],
    [nlStatus, nlBuildings, buildings, neighborhoods, landlords],
  );

  useEffect(() => {
    setActiveIdx(-1);
  }, [flat.length]);

  function hrefFor(s: Suggestion): string {
    if (s.kind === "building")
      return buildingUrl({ borough: s.borough, slug: s.slug }, city);
    if (s.kind === "landlord") return landlordUrl(s.name, city);
    return `/${prefix}/neighborhood/${s.slug}`;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (activeIdx >= 0 && flat[activeIdx]) {
      router.push(hrefFor(flat[activeIdx]));
      onClose();
      return;
    }
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/${prefix}/search?q=${encodeURIComponent(trimmed)}`);
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    }
  }

  const trimmed = q.trim();
  const isSearching = trimmed.length >= 2;
  const hasAnyResults =
    buildings.length + landlords.length + neighborhoods.length > 0;
  // "Smart search" affordance only for query-like sentences (≥ 4 words).
  const canAsk = trimmed.split(/\s+/).filter(Boolean).length >= 4;

  if (!mounted) return null;

  const overlay = (
    <div
      className="search-overlay-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="search-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Search LucidRents"
      >
        <form onSubmit={submit} className="search-overlay-form">
          <span className="search-overlay-form-icon" aria-hidden="true">
            <Search />
          </span>
          <input
            ref={inputRef}
            type="search"
            placeholder={`Search ${cityName} buildings, landlords, neighborhoods…`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Search query"
            aria-autocomplete="list"
            aria-controls="search-overlay-results"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={onClose}
            className="search-overlay-close"
            aria-label="Close search"
          >
            <X />
          </button>
        </form>

        {!isSearching ? (
          <div className="search-overlay-categories" aria-hidden="true">
            <span className="search-overlay-categories-label">
              Search across
            </span>
            <span className="search-overlay-cat">
              <Building2 /> Buildings
            </span>
            <span className="search-overlay-cat-sep">·</span>
            <span className="search-overlay-cat">
              <Users /> Landlords
            </span>
            <span className="search-overlay-cat-sep">·</span>
            <span className="search-overlay-cat">
              <MapPin /> Neighborhoods
            </span>
          </div>
        ) : null}

        <div
          id="search-overlay-results"
          className="search-overlay-body"
          role="listbox"
        >
          {isSearching && nlStatus === "done" ? (
            <>
              <div className="search-overlay-msg" aria-live="polite">
                <Sparkles aria-hidden="true" />{" "}
                {nlSummary || "Smart search results"}
              </div>
              {nlBuildings.length > 0 ? (
                <ResultGroup title="Smart results" icon={<Building2 />}>
                  {nlBuildings.map((b, i) => (
                    <ResultRow
                      key={`nl-${b.id}`}
                      href={hrefFor(b)}
                      active={activeIdx === i}
                      onHover={() => setActiveIdx(i)}
                      primary={b.full_address}
                      secondary={[
                        b.borough,
                        typeof b.review_count === "number" &&
                        b.review_count > 0
                          ? `${b.review_count} review${b.review_count === 1 ? "" : "s"}`
                          : null,
                        typeof b.violation_count === "number" &&
                        b.violation_count > 0
                          ? `${b.violation_count} violation${b.violation_count === 1 ? "" : "s"}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      onClick={onClose}
                    />
                  ))}
                </ResultGroup>
              ) : (
                <div className="search-overlay-msg">
                  No buildings matched that ask.
                </div>
              )}
            </>
          ) : isSearching ? (
            <>
              {loading && !hasAnyResults ? (
                <div className="search-overlay-msg">
                  <Loader2 className="search-overlay-spin" /> Searching…
                </div>
              ) : null}
              {!loading && !hasAnyResults ? (
                <div className="search-overlay-msg">
                  No matches for &ldquo;{trimmed}&rdquo;.{" "}
                  <button
                    type="button"
                    className="search-overlay-link"
                    onClick={() => {
                      router.push(
                        `/${prefix}/search?q=${encodeURIComponent(trimmed)}`,
                      );
                      onClose();
                    }}
                  >
                    See full search →
                  </button>
                </div>
              ) : null}

              {buildings.length > 0 ? (
                <ResultGroup title="Buildings" icon={<Building2 />}>
                  {buildings.map((b, i) => (
                    <ResultRow
                      key={`b-${b.id}`}
                      href={hrefFor(b)}
                      active={activeIdx === i}
                      onHover={() => setActiveIdx(i)}
                      primary={b.full_address}
                      secondary={[
                        b.borough,
                        typeof b.review_count === "number" &&
                        b.review_count > 0
                          ? `${b.review_count} review${b.review_count === 1 ? "" : "s"}`
                          : null,
                        typeof b.violation_count === "number" &&
                        b.violation_count > 0
                          ? `${b.violation_count} violation${b.violation_count === 1 ? "" : "s"}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      onClick={onClose}
                    />
                  ))}
                </ResultGroup>
              ) : null}

              {neighborhoods.length > 0 ? (
                <ResultGroup title="Neighborhoods" icon={<MapPin />}>
                  {neighborhoods.map((n, i) => {
                    const idx = buildings.length + i;
                    return (
                      <ResultRow
                        key={`n-${n.zipCode}`}
                        href={hrefFor(n)}
                        active={activeIdx === idx}
                        onHover={() => setActiveIdx(idx)}
                        primary={n.name}
                        secondary={`${n.region} · ${n.zipCode}`}
                        onClick={onClose}
                      />
                    );
                  })}
                </ResultGroup>
              ) : null}

              {landlords.length > 0 ? (
                <ResultGroup title="Landlords" icon={<Users />}>
                  {landlords.map((l, i) => {
                    const idx = buildings.length + neighborhoods.length + i;
                    return (
                      <ResultRow
                        key={`l-${l.name}`}
                        href={hrefFor(l)}
                        active={activeIdx === idx}
                        onHover={() => setActiveIdx(idx)}
                        primary={l.name}
                        secondary={[
                          typeof l.building_count === "number" &&
                          l.building_count > 0
                            ? `${l.building_count} building${l.building_count === 1 ? "" : "s"}`
                            : null,
                          typeof l.total_violations === "number" &&
                          l.total_violations > 0
                            ? `${l.total_violations.toLocaleString()} violation${l.total_violations === 1 ? "" : "s"}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        onClick={onClose}
                      />
                    );
                  })}
                </ResultGroup>
              ) : null}

              {hasAnyResults ? (
                <Link
                  className="search-overlay-see-all"
                  href={`/${prefix}/search?q=${encodeURIComponent(trimmed)}`}
                  onClick={onClose}
                >
                  See all results for &ldquo;{trimmed}&rdquo;{" "}
                  <ArrowRight />
                </Link>
              ) : null}

              {/* Smart search: one-line affordance for sentence-like queries */}
              {canAsk ? (
                nlStatus === "loading" ? (
                  <div className="search-overlay-msg" aria-live="polite">
                    <Loader2 className="search-overlay-spin" /> Asking
                    LucidRents…
                  </div>
                ) : nlStatus === "error" ? (
                  <div className="search-overlay-msg">
                    Smart search didn&rsquo;t work this time — regular matches
                    are shown above.
                  </div>
                ) : (
                  <button
                    type="button"
                    className="search-overlay-link"
                    onClick={askLucid}
                  >
                    ✦ Ask LucidRents: &ldquo;{trimmed}&rdquo;
                  </button>
                )
              ) : null}
            </>
          ) : (
            <>
              {popularBuildings.length > 0 ? (
                <ResultGroup
                  title={`Popular buildings in ${cityName}`}
                  icon={<Building2 />}
                >
                  {popularBuildings.map((b) => (
                    <ResultRow
                      key={`pb-${b.id}`}
                      href={hrefFor(b)}
                      active={false}
                      onHover={() => undefined}
                      primary={b.full_address}
                      secondary={[
                        b.borough,
                        typeof b.review_count === "number" &&
                        b.review_count > 0
                          ? `${b.review_count} review${b.review_count === 1 ? "" : "s"}`
                          : null,
                        typeof b.violation_count === "number" &&
                        b.violation_count > 0
                          ? `${b.violation_count} violation${b.violation_count === 1 ? "" : "s"}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      onClick={onClose}
                    />
                  ))}
                </ResultGroup>
              ) : null}

              {featuredNeighborhoods.length > 0 ? (
                <ResultGroup
                  title={`Neighborhoods in ${cityName}`}
                  icon={<MapPin />}
                >
                  {featuredNeighborhoods.map((n) => (
                    <ResultRow
                      key={`fn-${n.zipCode}`}
                      href={hrefFor(n)}
                      active={false}
                      onHover={() => undefined}
                      primary={n.name}
                      secondary={`${n.region} · ${n.zipCode}`}
                      onClick={onClose}
                    />
                  ))}
                </ResultGroup>
              ) : null}

              {topLandlords.length > 0 ? (
                <ResultGroup
                  title={`Largest landlords in ${cityName}`}
                  icon={<Users />}
                >
                  {topLandlords.map((l) => (
                    <ResultRow
                      key={`tl-${l.name}`}
                      href={hrefFor(l)}
                      active={false}
                      onHover={() => undefined}
                      primary={l.name}
                      secondary={[
                        typeof l.building_count === "number" &&
                        l.building_count > 0
                          ? `${l.building_count} building${l.building_count === 1 ? "" : "s"}`
                          : null,
                        typeof l.total_violations === "number" &&
                        l.total_violations > 0
                          ? `${l.total_violations.toLocaleString()} violation${l.total_violations === 1 ? "" : "s"}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      onClick={onClose}
                    />
                  ))}
                </ResultGroup>
              ) : null}
            </>
          )}
        </div>

        <div className="search-overlay-footer">
          <span className="search-overlay-foot-key">
            <CornerDownLeft /> open
          </span>
          <span className="search-overlay-foot-key">↑ ↓ navigate</span>
          <span className="search-overlay-foot-key">esc close</span>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

function ResultGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="search-overlay-group">
      <div className="search-overlay-group-title">
        {icon ? (
          <span className="search-overlay-group-icon">{icon}</span>
        ) : null}
        {title}
      </div>
      <div className="search-overlay-group-rows">{children}</div>
    </div>
  );
}

function ResultRow({
  href,
  active,
  onHover,
  primary,
  secondary,
  onClick,
}: {
  href: string;
  active: boolean;
  onHover: () => void;
  primary: string;
  secondary: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onClick={onClick}
      className={`search-overlay-row${active ? " is-active" : ""}`}
    >
      <span className="search-overlay-row-text">
        <span className="search-overlay-row-primary">{primary}</span>
        {secondary ? (
          <span className="search-overlay-row-secondary">{secondary}</span>
        ) : null}
      </span>
      <span className="search-overlay-row-arrow" aria-hidden="true">
        <ArrowRight />
      </span>
    </Link>
  );
}
