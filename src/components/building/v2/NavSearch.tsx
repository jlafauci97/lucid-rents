"use client";

/**
 * Nav search input with live autocomplete across three entities:
 *   • Buildings     (via /api/search)
 *   • Landlords     (via /api/landlords?search=…)
 *   • Neighborhoods (client-side filter of getAllNeighborhoodsByCity)
 *
 * - Debounced 180 ms
 * - Dropdown groups results under section headings
 * - ↑/↓ keyboard navigates across groups; Enter routes to highlighted row
 * - Enter with nothing highlighted → full /{city}/search?q=…
 * - Closes on outside-click / Escape / route change
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CITY_META, type City } from "@/lib/cities";
import { buildingUrl, landlordUrl } from "@/lib/seo";
import { getAllNeighborhoodsByCity, neighborhoodPageSlugByCity } from "@/lib/neighborhoods";
import { useCityFromPath } from "@/lib/city-context";

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
type Suggestion = BuildingSuggestion | LandlordSuggestion | NeighborhoodSuggestion;

interface Props {
  city: City;
}

export function NavSearch({ city: propCity }: Props) {
  // Root layout doesn't re-render on client navigation — use the live path.
  const pathCity = useCityFromPath();
  const city: City = pathCity ?? propCity;
  const router = useRouter();
  const rootRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [buildings, setBuildings] = useState<BuildingSuggestion[]>([]);
  const [landlords, setLandlords] = useState<LandlordSuggestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const prefix = CITY_META[city]?.urlPrefix ?? "nyc";

  // All neighborhoods for this city (static, pure-function list).
  const allNeighborhoods = useMemo(() => getAllNeighborhoodsByCity(city), [city]);

  // Client-side filter neighborhoods as the user types.
  const neighborhoods = useMemo<NeighborhoodSuggestion[]>(() => {
    const trimmed = q.trim().toLowerCase();
    if (trimmed.length < 2) return [];
    const matches = allNeighborhoods
      .filter((n) =>
        n.name.toLowerCase().includes(trimmed) || n.zipCode.toLowerCase().includes(trimmed)
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
    return matches;
  }, [q, allNeighborhoods, city]);

  // Debounced network fetches for buildings + landlords.
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
    const t = setTimeout(async () => {
      try {
        const [bRes, lRes] = await Promise.all([
          fetch(`/api/search?q=${encodeURIComponent(trimmed)}&city=${city}&limit=5`, { signal: controller.signal }),
          fetch(`/api/landlords?search=${encodeURIComponent(trimmed)}&city=${city}&page=1`, { signal: controller.signal }),
        ]);
        // Buildings
        if (bRes.ok) {
          const bJson = await bRes.json();
          const rows: BuildingSuggestion[] = (bJson.buildings ?? []).slice(0, 5).map((b: {
            id: string; full_address: string; borough: string; slug: string; review_count?: number | null; violation_count?: number | null;
          }) => ({
            kind: "building", id: b.id, full_address: b.full_address, borough: b.borough, slug: b.slug,
            review_count: b.review_count, violation_count: b.violation_count,
          }));
          setBuildings(rows);
        } else {
          setBuildings([]);
        }
        // Landlords
        if (lRes.ok) {
          const lJson = await lRes.json();
          const rows: LandlordSuggestion[] = (lJson.landlords ?? lJson.results ?? []).slice(0, 4).map((l: {
            name: string; slug?: string; building_count?: number | null; total_violations?: number | null;
          }) => ({
            kind: "landlord",
            name: l.name,
            slug: l.slug ?? "",
            building_count: l.building_count,
            total_violations: l.total_violations,
          }));
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
      clearTimeout(t);
    };
  }, [q, city]);

  // Flatten all suggestions in the order they appear for keyboard nav.
  const flat: Suggestion[] = useMemo(
    () => [...buildings, ...neighborhoods, ...landlords],
    [buildings, neighborhoods, landlords]
  );

  useEffect(() => { setActiveIdx(-1); }, [flat.length]);

  // Outside click / Escape close
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function hrefFor(s: Suggestion): string {
    if (s.kind === "building") return buildingUrl({ borough: s.borough, slug: s.slug }, city);
    if (s.kind === "landlord") return landlordUrl(s.name, city);
    return `/${prefix}/neighborhood/${s.slug}`;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (activeIdx >= 0 && flat[activeIdx]) {
      router.push(hrefFor(flat[activeIdx]));
      setOpen(false);
      return;
    }
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/${prefix}/search?q=${encodeURIComponent(trimmed)}`);
    setOpen(false);
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
  const showDropdown = open && trimmed.length >= 2;
  const hasAny = buildings.length + landlords.length + neighborhoods.length > 0;

  return (
    <form ref={rootRef} className="nav-search" role="search" onSubmit={submit} style={{ position: "relative" }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input
        ref={inputRef}
        type="search"
        placeholder="Search buildings, landlords, or neighborhoods…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        aria-label="Search"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls="nav-search-results"
      />

      {showDropdown ? (
        <div
          id="nav-search-results"
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "#0F1D2E",
            border: "1px solid rgba(96,165,250,0.25)",
            borderRadius: 10,
            boxShadow: "0 20px 40px -12px rgba(0,0,0,0.5)",
            padding: 4,
            zIndex: 60,
            maxHeight: 460,
            overflowY: "auto",
          }}
        >
          {loading && !hasAny ? (
            <GroupMessage>Searching…</GroupMessage>
          ) : null}
          {!loading && !hasAny ? (
            <GroupMessage>No matches. Press Enter to search instead.</GroupMessage>
          ) : null}

          {buildings.length > 0 ? (
            <Group title="Buildings">
              {buildings.map((b, i) => (
                <Row
                  key={`b-${b.id}`}
                  href={hrefFor(b)}
                  active={activeIdx === indexInFlat(i, 0)}
                  onHover={() => setActiveIdx(indexInFlat(i, 0))}
                  primary={b.full_address}
                  secondary={[
                    b.borough,
                    typeof b.review_count === "number" && b.review_count > 0 ? `${b.review_count} review${b.review_count === 1 ? "" : "s"}` : null,
                    typeof b.violation_count === "number" && b.violation_count > 0 ? `${b.violation_count} violation${b.violation_count === 1 ? "" : "s"}` : null,
                  ].filter(Boolean).join(" · ")}
                  onClick={() => setOpen(false)}
                />
              ))}
            </Group>
          ) : null}

          {neighborhoods.length > 0 ? (
            <Group title="Neighborhoods">
              {neighborhoods.map((n, i) => (
                <Row
                  key={`n-${n.zipCode}`}
                  href={hrefFor(n)}
                  active={activeIdx === indexInFlat(i, buildings.length)}
                  onHover={() => setActiveIdx(indexInFlat(i, buildings.length))}
                  primary={n.name}
                  secondary={`${n.region} · ${n.zipCode}`}
                  onClick={() => setOpen(false)}
                />
              ))}
            </Group>
          ) : null}

          {landlords.length > 0 ? (
            <Group title="Landlords">
              {landlords.map((l, i) => (
                <Row
                  key={`l-${l.name}`}
                  href={hrefFor(l)}
                  active={activeIdx === indexInFlat(i, buildings.length + neighborhoods.length)}
                  onHover={() => setActiveIdx(indexInFlat(i, buildings.length + neighborhoods.length))}
                  primary={l.name}
                  secondary={[
                    typeof l.building_count === "number" && l.building_count > 0 ? `${l.building_count} building${l.building_count === 1 ? "" : "s"}` : null,
                    typeof l.total_violations === "number" && l.total_violations > 0 ? `${l.total_violations.toLocaleString()} violation${l.total_violations === 1 ? "" : "s"}` : null,
                  ].filter(Boolean).join(" · ")}
                  onClick={() => setOpen(false)}
                />
              ))}
            </Group>
          ) : null}

          {hasAny ? (
            <Link
              href={`/${prefix}/search?q=${encodeURIComponent(trimmed)}`}
              onClick={() => setOpen(false)}
              style={{
                display: "block",
                margin: "4px 2px 2px",
                padding: "8px 10px",
                borderRadius: 6,
                background: "rgba(255,255,255,0.04)",
                color: "#60a5fa",
                fontSize: 12,
                fontWeight: 700,
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              See all results for &quot;{trimmed}&quot; →
            </Link>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function indexInFlat(i: number, offset: number): number { return offset + i; }

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "2px 0" }}>
      <div style={{
        padding: "6px 10px 4px",
        color: "rgba(255,255,255,0.45)",
        fontFamily: "var(--mono, ui-monospace, monospace)",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
      }}>{title}</div>
      {children}
    </div>
  );
}

function GroupMessage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "10px 12px", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
      {children}
    </div>
  );
}

function Row({
  href, active, onHover, primary, secondary, onClick,
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
      style={{
        display: "block",
        padding: "8px 10px",
        borderRadius: 6,
        background: active ? "rgba(96,165,250,0.16)" : "transparent",
        color: "#fff",
        textDecoration: "none",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{primary}</div>
      {secondary ? (
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "var(--mono, ui-monospace, monospace)", marginTop: 2 }}>
          {secondary}
        </div>
      ) : null}
    </Link>
  );
}
