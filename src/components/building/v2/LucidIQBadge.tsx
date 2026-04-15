interface Props {
  grade: string;
  rating: number;
  size?: number;
}

function StarPath({ fill }: { fill: number }) {
  // fill is 0..1
  const id = `star-grad-${Math.random().toString(36).slice(2)}`;
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ display: "inline-block" }}>
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
          <stop offset={`${fill * 100}%`} stopColor="#facc15" />
          <stop offset={`${fill * 100}%`} stopColor="#d1d5db" />
        </linearGradient>
      </defs>
      <polygon
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        fill={`url(#${id})`}
        stroke="#e5c100"
        strokeWidth="0.5"
      />
    </svg>
  );
}

function Stars({ rating }: { rating: number }) {
  const normalized = Math.max(0, Math.min(5, rating));
  return (
    <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, normalized - i));
        return <StarPath key={i} fill={fill} />;
      })}
    </div>
  );
}

const GRADE_COLORS: Record<string, string> = {
  "A+": "#1d4ed8",
  A: "#2563eb",
  "A-": "#3b82f6",
  "B+": "#0369a1",
  B: "#0284c7",
  "B-": "#0ea5e9",
  "C+": "#d97706",
  C: "#f59e0b",
  "C-": "#fbbf24",
  D: "#dc2626",
  F: "#7f1d1d",
};

export function LucidIQBadge({ grade, rating, size = 160 }: Props) {
  const hexWidth = size;
  const hexHeight = size * 1.15;
  const color = GRADE_COLORS[grade] ?? "var(--v2-brand)";
  const gradId = `liq-hex-grad-${size}`;

  // Build a hexagon polygon for SVG
  // Flat-top hexagon: 6 points
  const cx = hexWidth / 2;
  const cy = hexHeight / 2;
  const r = Math.min(cx, cy) * 0.9;
  const hexPoints = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(" ");

  return (
    <div
      role="img"
      aria-label={`LucidIQ score badge: grade ${grade}, rating ${rating.toFixed(1)} out of 5`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      {/* Hex SVG with grade inside */}
      <div style={{ position: "relative", width: hexWidth, height: hexHeight }}>
        <svg
          width={hexWidth}
          height={hexHeight}
          viewBox={`0 0 ${hexWidth} ${hexHeight}`}
          aria-hidden="true"
          style={{ display: "block" }}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="1" />
              <stop offset="100%" stopColor={color} stopOpacity="0.7" />
            </linearGradient>
          </defs>
          {/* Hex shadow */}
          <polygon
            points={hexPoints}
            fill="rgba(0,0,0,0.08)"
            transform="translate(2,3)"
          />
          {/* Hex body */}
          <polygon
            points={hexPoints}
            fill={`url(#${gradId})`}
            stroke={color}
            strokeWidth="1.5"
            strokeOpacity="0.4"
          />
          {/* Grade letter */}
          <text
            x={cx}
            y={cy + size * 0.12}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="var(--v2-serif, 'Young Serif', serif)"
            fontWeight="700"
            fontSize={size * 0.38}
            fill="#ffffff"
            letterSpacing="-1"
          >
            {grade}
          </text>
        </svg>
      </div>

      {/* Stars */}
      <Stars rating={rating} />

      {/* Rating number */}
      <span
        style={{
          fontFamily: "var(--v2-mono, 'Geist Mono', monospace)",
          fontSize: Math.max(11, size * 0.09),
          color: "var(--v2-ink-soft, #334155)",
          letterSpacing: "0.04em",
        }}
      >
        {rating.toFixed(1)} / 5
      </span>
    </div>
  );
}
