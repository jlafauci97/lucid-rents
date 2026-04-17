export default function Loading() {
  return (
    <div className="v2" style={{ minHeight: "100vh", background: "var(--v2-paper)" }}>
      <style>{`
        @keyframes v2-pulse {
          0%   { opacity: 0.6; }
          50%  { opacity: 0.3; }
          100% { opacity: 0.6; }
        }
        .v2-skeleton {
          animation: v2-pulse 1.4s ease-in-out infinite;
        }
        .v2-loading-grid {
          max-width: 1440px;
          margin: 0 auto;
          padding: 32px 24px;
          display: grid;
          grid-template-columns: 220px 1fr 320px;
          gap: 24px;
          align-items: start;
        }
        @media (max-width: 1199px) {
          .v2-loading-grid {
            grid-template-columns: 220px 1fr;
          }
          .v2-loading-rail {
            display: none;
          }
        }
        @media (max-width: 899px) {
          .v2-loading-grid {
            grid-template-columns: 1fr;
          }
          .v2-loading-wayfinder {
            display: none;
          }
        }
      `}</style>

      {/* Nav skeleton */}
      <div
        style={{
          height: 60,
          background: "var(--v2-navy)",
          width: "100%",
        }}
      />

      {/* Hero skeleton */}
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "32px 24px 24px",
        }}
      >
        {/* Breadcrumb */}
        <div
          className="v2-skeleton"
          style={{
            height: 14,
            width: 280,
            background: "var(--v2-border)",
            borderRadius: 6,
            marginBottom: 20,
          }}
        />
        {/* H1 */}
        <div
          className="v2-skeleton"
          style={{
            height: 52,
            width: "55%",
            background: "var(--v2-border)",
            borderRadius: 8,
            marginBottom: 10,
          }}
        />
        {/* Sub-line */}
        <div
          className="v2-skeleton"
          style={{
            height: 14,
            width: "35%",
            background: "var(--v2-border)",
            borderRadius: 6,
            marginBottom: 28,
          }}
        />
      </div>

      {/* 3-col grid skeleton */}
      <div className="v2-loading-grid">
        {/* Wayfinder rail (left) */}
        <aside
          className="v2-loading-wayfinder"
          style={{ display: "grid", gap: 12 }}
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="v2-skeleton"
              style={{
                height: i === 0 ? 160 : 80,
                background: "var(--v2-border)",
                borderRadius: 12,
              }}
            />
          ))}
        </aside>

        {/* Main column */}
        <main style={{ display: "grid", gap: 32, minWidth: 0 }}>
          {/* Record strip */}
          <div
            className="v2-skeleton"
            style={{
              height: 88,
              background: "var(--v2-border)",
              borderRadius: 14,
            }}
          />
          {/* Section cards */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="v2-skeleton"
              style={{
                height: i === 0 ? 260 : 200,
                background: "var(--v2-border)",
                borderRadius: 14,
                opacity: 0.5 + i * 0.05,
              }}
            />
          ))}
        </main>

        {/* Right rail */}
        <aside
          className="v2-loading-rail"
          style={{ display: "grid", gap: 16 }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="v2-skeleton"
              style={{
                height: i === 0 ? 200 : 160,
                background: "rgba(219, 234, 254, 0.4)",
                borderRadius: 14,
              }}
            />
          ))}
        </aside>
      </div>
    </div>
  );
}
