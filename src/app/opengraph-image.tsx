import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Lucid Rents - Know Your NYC Apartment Before You Sign";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0F1D2E",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px",
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: "#ffffff",
            marginBottom: 16,
            display: "flex",
          }}
        >
          Check Your Address
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#94a3b8",
            marginBottom: 48,
            display: "flex",
          }}
        >
          See the truth about any NYC building before you sign
        </div>
        <div
          style={{
            display: "flex",
            gap: "40px",
          }}
        >
          {["Violations", "Complaints", "Reviews", "Crime Data"].map((item) => (
            <div
              key={item}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#3B82F6",
                fontSize: 22,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: "#3B82F6",
                  display: "flex",
                }}
              />
              {item}
            </div>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 40,
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
