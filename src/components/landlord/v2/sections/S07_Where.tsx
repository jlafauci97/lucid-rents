import type { LandlordV2Data } from "@/app/[city]/landlord/[name]/_data";
import type { City } from "@/lib/cities";
import { CITY_META } from "@/lib/cities";

interface Props {
  where: LandlordV2Data["where"];
  city: City;
  buildingCount: number;
}

export function S07_Where({ where, city, buildingCount }: Props) {
  const meta = CITY_META[city];
  const regions = where.regions;
  if (regions.length === 0) {
    return null;
  }

  // Normalize pin positions into a 0-1 coordinate space based on the range
  // of centroids we observed. Cheap and avoids pulling in a map library.
  const withCoords = regions.filter((r) => typeof r.lat === "number" && typeof r.lng === "number") as Array<
    LandlordV2Data["where"]["regions"][number] & { lat: number; lng: number }
  >;
  const hasPins = withCoords.length > 0;
  const minLat = Math.min(...withCoords.map((r) => r.lat));
  const maxLat = Math.max(...withCoords.map((r) => r.lat));
  const minLng = Math.min(...withCoords.map((r) => r.lng));
  const maxLng = Math.max(...withCoords.map((r) => r.lng));
  const latSpan = Math.max(0.001, maxLat - minLat);
  const lngSpan = Math.max(0.001, maxLng - minLng);

  return (
    <section className="section" id="where">
      <div className="section-head">
        <div>
          <div className="num">07 / 09</div>
          <h2>Where they operate.</h2>
        </div>
        <div className="meta">
          {buildingCount.toLocaleString()} building{buildingCount === 1 ? "" : "s"}
          <br />
          across {regions.length.toLocaleString()} {meta.regionLabel.toLowerCase()}
          {regions.length === 1 ? "" : "s"}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 18,
          marginTop: "var(--s-5)",
        }}
      >
        <div
          style={{
            aspectRatio: "1.6",
            background: "linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%)",
            borderRadius: 14,
            position: "relative",
            overflow: "hidden",
            border: "1px solid var(--border)",
          }}
        >
          {hasPins
            ? withCoords.map((r) => {
                const xPct = ((r.lng - minLng) / lngSpan) * 80 + 10;
                // y flips because lat goes south→north but pixel y is top→bottom
                const yPct = ((maxLat - r.lat) / latSpan) * 80 + 10;
                return (
                  <div
                    key={r.name}
                    style={{
                      position: "absolute",
                      left: `${xPct}%`,
                      top: `${yPct}%`,
                      transform: "translate(-50%, -50%)",
                      background: "var(--navy)",
                      color: "white",
                      fontFamily: "var(--mono)",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 8px",
                      borderRadius: 999,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.count}
                  </div>
                );
              })
            : (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    color: "var(--ink-mute)",
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                  }}
                >
                  No coordinates available for this portfolio
                </div>
              )}
        </div>

        <div
          style={{
            background: "var(--paper)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {regions.map((r) => (
            <div
              key={r.name}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: 12,
                padding: "12px 18px",
                alignItems: "center",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div>
                <b style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.005em" }}>
                  {r.name}
                </b>
                <div
                  style={{
                    width: 80,
                    height: 6,
                    background: "var(--border)",
                    borderRadius: 3,
                    overflow: "hidden",
                    marginTop: 6,
                  }}
                >
                  <div style={{ height: "100%", width: `${Math.round(r.share * 100)}%`, background: "var(--sky-deep)" }} />
                </div>
              </div>
              <span
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 20,
                  color: "var(--ink)",
                  letterSpacing: "-0.01em",
                }}
              >
                {r.count.toLocaleString()}
              </span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--ink-mute)",
                }}
              >
                {Math.round(r.share * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
