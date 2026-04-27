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

interface Props {
  city: City;
  onClose: () => void;
}

export function SearchOverlay({ city, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
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
      setBuildings([]);
      setLandlords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
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
          setBuildings(rows);
        } else {
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
          setLandlords(rows);
        } else {
          setLandlords([]);
        }
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") {
          setBuildings([]);
          setLandlords([]);
        }
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [q, city]);

  const flat: Suggestion[] = useMemo(
    () => [...buildings, ...neighborhoods, ...landlords],
    [buildings, neighborhoods, landlords],
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
          {isSearching ? (
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
