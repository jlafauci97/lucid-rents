import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface NeighborhoodStats {
  name: string;
  stats: Record<string, number>;
}

interface NeighborhoodCompareProps {
  neighborhood1: NeighborhoodStats;
  neighborhood2: NeighborhoodStats;
}

const METRIC_LABELS: Record<string, string> = {
  violations: "Violations",
  avgRent: "Avg Rent ($)",
  complaints: "Complaints",
  openViolations: "Open Violations",
  buildings: "Buildings",
};

const METRIC_COLORS = ["#3B82F6", "#8B5CF6", "#EC4899", "#F97316", "#10B981"];

function CompareBar({
  label,
  value1,
  value2,
  name1,
  name2,
  colorIndex,
  frame,
  fps,
  rowIndex,
}: {
  label: string;
  value1: number;
  value2: number;
  name1: string;
  name2: string;
  colorIndex: number;
  frame: number;
  fps: number;
  rowIndex: number;
}) {
  const appearFrame = 80 + rowIndex * 50;
  const maxVal = Math.max(value1, value2, 1);

  const barProgress = spring({
    frame: frame - appearFrame,
    fps,
    config: { damping: 16, stiffness: 90 },
  });

  const rowOpacity = interpolate(
    spring({ frame: frame - (appearFrame - 10), fps, config: { damping: 20 } }),
    [0, 1],
    [0, 1]
  );

  const bar1Width = interpolate(barProgress, [0, 1], [0, (value1 / maxVal) * 100]);
  const bar2Width = interpolate(barProgress, [0, 1], [0, (value2 / maxVal) * 100]);
  const accentColor = METRIC_COLORS[colorIndex % METRIC_COLORS.length];

  return (
    <div
      style={{
        opacity: rowOpacity,
        marginBottom: 36,
      }}
    >
      <div
        style={{
          color: accentColor,
          fontSize: 22,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 2,
          marginBottom: 16,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {label}
      </div>

      {/* Bar 1 */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <span
            style={{
              color: "#F1F5F9",
              fontSize: 24,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            {name1}
          </span>
          <span
            style={{
              color: "#F1F5F9",
              fontSize: 24,
              fontWeight: 700,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            {value1.toLocaleString()}
          </span>
        </div>
        <div
          style={{
            height: 18,
            backgroundColor: "rgba(255,255,255,0.08)",
            borderRadius: 9,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${bar1Width}%`,
              backgroundColor: accentColor,
              borderRadius: 9,
            }}
          />
        </div>
      </div>

      {/* Bar 2 */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <span
            style={{
              color: "#94A3B8",
              fontSize: 24,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            {name2}
          </span>
          <span
            style={{
              color: "#94A3B8",
              fontSize: 24,
              fontWeight: 700,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            {value2.toLocaleString()}
          </span>
        </div>
        <div
          style={{
            height: 18,
            backgroundColor: "rgba(255,255,255,0.08)",
            borderRadius: 9,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${bar2Width}%`,
              backgroundColor: `${accentColor}60`,
              borderRadius: 9,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function NeighborhoodCompare({
  neighborhood1,
  neighborhood2,
}: NeighborhoodCompareProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const defaultStats1: Record<string, number> = { violations: 312, avgRent: 3200, complaints: 87, openViolations: 145 };
  const defaultStats2: Record<string, number> = { violations: 198, avgRent: 3800, complaints: 54, openViolations: 91 };

  const stats1: Record<string, number> = Object.keys(neighborhood1.stats).length > 0 ? neighborhood1.stats : defaultStats1;
  const stats2: Record<string, number> = Object.keys(neighborhood2.stats).length > 0 ? neighborhood2.stats : defaultStats2;

  const allKeys = Array.from(new Set([...Object.keys(stats1), ...Object.keys(stats2)])).slice(0, 5);

  const headerProgress = spring({ frame: frame - 10, fps, config: { damping: 20 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0F1D2E",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "80px 60px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          opacity: headerProgress,
          transform: `translateY(${interpolate(headerProgress, [0, 1], [30, 0])}px)`,
          marginBottom: 56,
        }}
      >
        <div
          style={{
            color: "#3B82F6",
            fontSize: 26,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 3,
            marginBottom: 16,
          }}
        >
          Neighborhood Compare
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <span
            style={{
              color: "#F1F5F9",
              fontSize: 44,
              fontWeight: 800,
            }}
          >
            {neighborhood1.name}
          </span>
          <span style={{ color: "#475569", fontSize: 36 }}>vs</span>
          <span
            style={{
              color: "#94A3B8",
              fontSize: 44,
              fontWeight: 800,
            }}
          >
            {neighborhood2.name}
          </span>
        </div>
      </div>

      {/* Comparison bars */}
      <div style={{ flex: 1 }}>
        {allKeys.map((key, i) => (
          <CompareBar
            key={key}
            label={METRIC_LABELS[key] ?? key}
            value1={stats1[key] ?? 0}
            value2={stats2[key] ?? 0}
            name1={neighborhood1.name}
            name2={neighborhood2.name}
            colorIndex={i}
            frame={frame}
            fps={fps}
            rowIndex={i}
          />
        ))}
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
