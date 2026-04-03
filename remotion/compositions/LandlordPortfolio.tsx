import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface Building {
  address: string;
  violations: number;
}

interface LandlordPortfolioProps {
  landlordName: string;
  buildings: Building[];
  totalViolations: number;
}

function BuildingRow({
  building,
  index,
  frame,
  fps,
  maxViolations,
}: {
  building: Building;
  index: number;
  frame: number;
  fps: number;
  maxViolations: number;
}) {
  const appearFrame = 80 + index * 35;
  const progress = spring({
    frame: frame - appearFrame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  const translateX = interpolate(progress, [0, 1], [-80, 0]);
  const opacity = interpolate(progress, [0, 0.2, 1], [0, 1, 1]);

  const barProgress = spring({
    frame: frame - (appearFrame + 10),
    fps,
    config: { damping: 18, stiffness: 80 },
  });

  const barWidth =
    maxViolations > 0
      ? interpolate(barProgress, [0, 1], [0, (building.violations / maxViolations) * 100])
      : 0;

  const severity =
    building.violations >= 10
      ? "#EF4444"
      : building.violations >= 5
      ? "#F97316"
      : "#EAB308";

  return (
    <div
      style={{
        opacity,
        transform: `translateX(${translateX}px)`,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderRadius: 16,
        padding: "24px 28px",
        borderLeft: `4px solid ${severity}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            color: "#F1F5F9",
            fontSize: 28,
            fontWeight: 600,
            fontFamily: "system-ui, sans-serif",
            flex: 1,
            paddingRight: 20,
          }}
        >
          {building.address}
        </div>
        <div
          style={{
            color: severity,
            fontSize: 32,
            fontWeight: 800,
            fontFamily: "system-ui, sans-serif",
            flexShrink: 0,
          }}
        >
          {building.violations}
        </div>
      </div>
      {/* Violation bar */}
      <div
        style={{
          height: 8,
          backgroundColor: "rgba(255,255,255,0.08)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${barWidth}%`,
            backgroundColor: severity,
            borderRadius: 4,
            transition: "none",
          }}
        />
      </div>
      <div
        style={{
          color: "#64748B",
          fontSize: 20,
          marginTop: 8,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        violations
      </div>
    </div>
  );
}

export function LandlordPortfolio({
  landlordName,
  buildings,
  totalViolations,
}: LandlordPortfolioProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const displayBuildings: Building[] =
    buildings.length > 0
      ? buildings
      : [
          { address: "123 Atlantic Ave, Brooklyn", violations: 14 },
          { address: "456 Bedford Ave, Brooklyn", violations: 9 },
          { address: "789 Flatbush Ave, Brooklyn", violations: 22 },
          { address: "321 Nostrand Ave, Brooklyn", violations: 6 },
          { address: "654 Eastern Pkwy, Brooklyn", violations: 18 },
        ];

  const displayTotal =
    totalViolations > 0
      ? totalViolations
      : displayBuildings.reduce((sum, b) => sum + b.violations, 0);

  const maxViolations = Math.max(...displayBuildings.map((b) => b.violations));

  const headerProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 20 },
  });

  const totalProgress = spring({
    frame: frame - (80 + displayBuildings.length * 35 + 20),
    fps,
    config: { damping: 14, stiffness: 80 },
  });

  const totalDisplay = Math.round(
    interpolate(totalProgress, [0, 1], [0, displayTotal])
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0F1D2E",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "80px 60px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          opacity: headerProgress,
          transform: `translateY(${interpolate(headerProgress, [0, 1], [30, 0])}px)`,
          marginBottom: 50,
        }}
      >
        <div
          style={{
            color: "#3B82F6",
            fontSize: 26,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 3,
            marginBottom: 12,
          }}
        >
          Landlord Portfolio
        </div>
        <div
          style={{
            color: "#F1F5F9",
            fontSize: 46,
            fontWeight: 800,
            lineHeight: 1.2,
          }}
        >
          {landlordName}
        </div>
        <div
          style={{
            color: "#94A3B8",
            fontSize: 26,
            marginTop: 8,
          }}
        >
          {displayBuildings.length} buildings
        </div>
      </div>

      {/* Buildings list */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {displayBuildings.map((b, i) => (
          <BuildingRow
            key={i}
            building={b}
            index={i}
            frame={frame}
            fps={fps}
            maxViolations={maxViolations}
          />
        ))}
      </div>

      {/* Total counter */}
      <div
        style={{
          opacity: totalProgress,
          marginTop: 50,
          display: "flex",
          alignItems: "center",
          gap: 24,
          backgroundColor: "rgba(239,68,68,0.12)",
          border: "1px solid rgba(239,68,68,0.35)",
          borderRadius: 20,
          padding: "28px 40px",
        }}
      >
        <div
          style={{
            color: "#EF4444",
            fontSize: 72,
            fontWeight: 900,
            lineHeight: 1,
          }}
        >
          {totalDisplay}
        </div>
        <div
          style={{
            color: "#94A3B8",
            fontSize: 28,
            lineHeight: 1.4,
          }}
        >
          total violations
          <br />
          across portfolio
        </div>
      </div>

      {/* Watermark */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          right: 60,
          color: "rgba(255,255,255,0.25)",
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: 1,
        }}
      >
        LucidRents.com
      </div>
    </AbsoluteFill>
  );
}
