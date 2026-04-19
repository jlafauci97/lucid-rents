interface Props {
  /** Height in px (width scales proportionally). */
  size?: number;
  className?: string;
  /** Unique clip-path id; override when rendering multiple on one page. */
  clipId?: string;
}

/**
 * The Lucid Rents shield mark. Blue shield with a bar-chart building pattern
 * inside — also used in the nav, favicon, and OG imagery.
 */
export function BrandShield({ size = 26, className, clipId = "brandShieldClip" }: Props) {
  const width = size * (120 / 138);
  return (
    <svg
      viewBox="0 0 120 138"
      width={width}
      height={size}
      aria-hidden="true"
      className={className}
      style={{ flexShrink: 0 }}
    >
      <defs>
        <clipPath id={clipId}>
          <path d="M60 2L8 18V58C8 96 60 134 60 134C60 134 112 96 112 58V18L60 2Z" />
        </clipPath>
      </defs>
      <path
        d="M60 2L8 18V58C8 96 60 134 60 134C60 134 112 96 112 58V18L60 2Z"
        fill="#3B82F6"
      />
      <g clipPath={`url(#${clipId})`} fill="#fff">
        <rect x="16" y="80" width="14" height="54" />
        <rect x="32" y="66" width="14" height="68" />
        <rect x="48" y="46" width="18" height="88" />
        <rect x="68" y="56" width="14" height="78" />
        <rect x="84" y="74" width="14" height="60" />
      </g>
      <g clipPath={`url(#${clipId})`} fill="#3B82F6">
        <rect x="52" y="52" width="2" height="3" />
        <rect x="58" y="52" width="2" height="3" />
        <rect x="62" y="52" width="2" height="3" />
        <rect x="52" y="60" width="2" height="3" />
        <rect x="58" y="60" width="2" height="3" />
        <rect x="62" y="60" width="2" height="3" />
        <rect x="52" y="68" width="2" height="3" />
        <rect x="58" y="68" width="2" height="3" />
        <rect x="62" y="68" width="2" height="3" />
      </g>
    </svg>
  );
}
