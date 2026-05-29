type Props = {
  size?: number
  className?: string
}

// Stylized "26" World Cup mark in black & gold — original artwork inspired
// by the 2026 emblem aesthetic without copying official assets.
export function WorldCup2026Logo({ size = 48, className }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="wc26-bg" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#0b1733" />
        </radialGradient>
        <linearGradient id="wc26-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      {/* Round badge */}
      <circle cx="32" cy="32" r="30" fill="url(#wc26-bg)" stroke="url(#wc26-gold)" strokeWidth="2" />
      {/* Trophy silhouette */}
      <path
        d="M22 14h20v3h4a3 3 0 0 1 3 3v3a6 6 0 0 1-6 6h-1a10 10 0 0 1-6 7v3h5v4H23v-4h5v-3a10 10 0 0 1-6-7h-1a6 6 0 0 1-6-6v-3a3 3 0 0 1 3-3h4v-3Zm-4 6v3a3 3 0 0 0 3 3v-6h-3Zm25 0v6a3 3 0 0 0 3-3v-3h-3Z"
        fill="url(#wc26-gold)"
      />
      {/* "26" mark */}
      <text
        x="32"
        y="58"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontWeight="900"
        fontSize="9"
        fill="url(#wc26-gold)"
        letterSpacing="1"
      >
        2026
      </text>
    </svg>
  )
}
