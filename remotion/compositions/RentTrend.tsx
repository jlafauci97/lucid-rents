import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface DataPoint {
  month: string;
  rent: number;
}

interface RentTrendProps {
  neighborhood: string;
  city: string;
  dataPoints: DataPoint[];
}

const CHART_WIDTH = 960;
const CHART_HEIGHT = 700;
const PADDING = { top: 40, right: 60, bottom: 80, left: 100 };

function formatRent(value: number): string {
  return `$${value.toLocaleString()}`;
}

export function RentTrend({ neighborhood, city, dataPoints }: RentTrendProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const displayData: DataPoint[] =
    dataPoints.length > 0
      ? dataPoints
      : [
          { month: "Jan '23", rent: 2800 },
          { month: "Apr '23", rent: 2950 },
          { month: "Jul '23", rent: 3100 },
          { month: "Oct '23", rent: 3050 },
          { month: "Jan '24", rent: 3200 },
          { month: "Apr '24", rent: 3400 },
          { month: "Jul '24", rent: 3550 },
          { month: "Oct '24", rent: 3600 },
        ];

  const rents = displayData.map((d) => d.rent);
  const minRent = Math.min(...rents) * 0.95;
  const maxRent = Math.max(...rents) * 1.05;

  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const points = displayData.map((d, i) => ({
    x: PADDING.left + (i / (displayData.length - 1)) * innerWidth,
    y:
      PADDING.top +
      innerHeight -
      ((d.rent - minRent) / (maxRent - minRent)) * innerHeight,
    rent: d.rent,
    month: d.month,
  }));

  // Line draw animation: starts at frame 60, completes at frame 240
  const lineProgress = interpolate(frame, [60, 240], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Build SVG path
  const pathData = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  // Approximate total path length for stroke-dashoffset animation
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    totalLength += Math.sqrt(dx * dx + dy * dy);
  }
  const dashOffset = totalLength * (1 - lineProgress);

  const firstRent = displayData[0]?.rent ?? 0;
  const lastRent = displayData[displayData.length - 1]?.rent ?? 0;
  const pctChange = firstRent > 0 ? ((lastRent - firstRent) / firstRent) * 100 : 0;
  const isPositive = pctChange >= 0;

  const headerProgress = spring({ frame: frame - 10, fps, config: { damping: 20 } });
  const badgeProgress = spring({ frame: frame - 250, fps, config: { damping: 14 } });

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
          marginBottom: 60,
        }}
      >
        <div
          style={{
            color: "#3B82F6",
            fontSize: 28,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 3,
            marginBottom: 12,
          }}
        >
          Rent Trend · {city}
        </div>
        <div
          style={{
            color: "#F1F5F9",
            fontSize: 56,
            fontWeight: 800,
            lineHeight: 1.1,
          }}
        >
          {neighborhood}
        </div>
      </div>

      {/* Chart */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <svg width={CHART_WIDTH} height={CHART_HEIGHT} style={{ overflow: "visible" }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = PADDING.top + innerHeight - t * innerHeight;
            const rent = minRent + t * (maxRent - minRent);
            return (
              <g key={t}>
                <line
                  x1={PADDING.left}
                  y1={y}
                  x2={PADDING.left + innerWidth}
                  y2={y}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={1}
                />
                <text
                  x={PADDING.left - 12}
                  y={y + 6}
                  textAnchor="end"
                  fill="#64748B"
                  fontSize={22}
                  fontFamily="system-ui, sans-serif"
                >
                  {formatRent(Math.round(rent))}
                </text>
              </g>
            );
          })}

          {/* Month labels */}
          {points.map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={PADDING.top + innerHeight + 40}
              textAnchor="middle"
              fill="#64748B"
              fontSize={20}
              fontFamily="system-ui, sans-serif"
            >
              {p.month}
            </text>
          ))}

          {/* Area fill */}
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
            </linearGradient>
            <clipPath id="lineClip">
              <rect
                x={0}
                y={0}
                width={PADDING.left + innerWidth * lineProgress}
                height={CHART_HEIGHT}
              />
            </clipPath>
          </defs>

          <path
            d={`${pathData} L ${points[points.length - 1].x} ${PADDING.top + innerHeight} L ${points[0].x} ${PADDING.top + innerHeight} Z`}
            fill="url(#areaGrad)"
            clipPath="url(#lineClip)"
          />

          {/* Animated line */}
          <path
            d={pathData}
            fill="none"
            stroke="#3B82F6"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={totalLength}
            strokeDashoffset={dashOffset}
          />

          {/* Data point dots */}
          {points.map((p, i) => {
            const dotProgress = interpolate(
              frame,
              [60 + (i / (points.length - 1)) * 180, 60 + (i / (points.length - 1)) * 180 + 20],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            return (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={8 * dotProgress}
                fill="#3B82F6"
                stroke="#0F1D2E"
                strokeWidth={3}
              />
            );
          })}

          {/* Start / end price labels */}
          {frame > 80 && (
            <text
              x={points[0].x}
              y={points[0].y - 20}
              textAnchor="middle"
              fill="#94A3B8"
              fontSize={26}
              fontFamily="system-ui, sans-serif"
            >
              {formatRent(firstRent)}
            </text>
          )}
          {frame > 240 && (
            <text
              x={points[points.length - 1].x}
              y={points[points.length - 1].y - 20}
              textAnchor="middle"
              fill="#F1F5F9"
              fontSize={30}
              fontWeight="bold"
              fontFamily="system-ui, sans-serif"
            >
              {formatRent(lastRent)}
            </text>
          )}
        </svg>

        {/* Percent change badge */}
        <div
          style={{
            opacity: badgeProgress,
            transform: `scale(${interpolate(badgeProgress, [0, 1], [0.6, 1])})`,
            marginTop: 40,
            display: "inline-flex",
            alignItems: "center",
            gap: 16,
            backgroundColor: isPositive ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
            border: `1px solid ${isPositive ? "rgba(239,68,68,0.4)" : "rgba(34,197,94,0.4)"}`,
            borderRadius: 16,
            padding: "20px 40px",
          }}
        >
          <span
            style={{
              color: isPositive ? "#EF4444" : "#22C55E",
              fontSize: 56,
              fontWeight: 800,
            }}
          >
            {isPositive ? "+" : ""}
            {pctChange.toFixed(1)}%
          </span>
          <span style={{ color: "#94A3B8", fontSize: 28 }}>
            rent increase
            <br />
            over 2 years
          </span>
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
