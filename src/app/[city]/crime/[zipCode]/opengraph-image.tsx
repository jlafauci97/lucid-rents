import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Crime Report - Lucid Rents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ zipCode: string }>;
}) {
  const { zipCode } = await params;

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/crime_by_zip`,
    {
      method: "POST",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }
  );

  let zipData = null;
  if (res.ok) {
    const allData = await res.json();
    zipData = allData?.find(
      (r: { zip_code: string }) => r.zip_code === zipCode
    );
  }

  const total = zipData?.total || 0;
  const violent = zipData?.violent || 0;
  const property = zipData?.property || 0;
  const qol = zipData?.quality_of_life || 0;

  return new ImageResponse(
    (
      <div
        style={{
          background: "#0F1D2E",
          width: "100%",
          height: "100%",
          display: "flex",
          padding: "60px",
        }}
      >
        {/* Left: Zip Code */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 60,
          }}
        >
          <div
            style={{
              fontSize: 20,
              color: "#94a3b8",
              marginBottom: 8,
              display: "flex",
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            Crime Report
          </div>
          <div
            style={{
              fontSize: 80,
              fontWeight: 700,
              color: "#ffffff",
              display: "flex",
            }}
          >
            {zipCode}
          </div>
          <div
            style={{
              fontSize: 20,
              color: "#64748b",
              marginTop: 8,
              display: "flex",
            }}
          >
            Last 12 Months
          </div>
        </div>

        {/* Right: Stats */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            gap: "24px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 48, fontWeight: 700, color: "#ffffff", display: "flex" }}>
              {total.toLocaleString()}
            </div>
            <div style={{ fontSize: 18, color: "#94a3b8", display: "flex" }}>Total Incidents</div>
          </div>
          <div style={{ display: "flex", gap: "40px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#EF4444", display: "flex" }}>
                {violent.toLocaleString()}
              </div>
              <div style={{ fontSize: 16, color: "#94a3b8", display: "flex" }}>Violent</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#F59E0B", display: "flex" }}>
                {property.toLocaleString()}
              </div>
              <div style={{ fontSize: 16, color: "#94a3b8", display: "flex" }}>Property</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#3B82F6", display: "flex" }}>
                {qol.toLocaleString()}
              </div>
              <div style={{ fontSize: 16, color: "#94a3b8", display: "flex" }}>Quality of Life</div>
            </div>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 40,
            right: 60,
            fontSize: 20,
            color: "#64748b",
            display: "flex",
          }}
        >
          lucidrents.com
        </div>
      </div>
    ),
    { ...size }
  );
}
