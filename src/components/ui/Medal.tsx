type MedalKind = 'gold' | 'silver' | 'bronze'

const PALETTES: Record<MedalKind, { ribbonA: string; ribbonB: string; rimA: string; rimB: string; faceA: string; faceB: string; faceC: string; star: string; shine: string }> = {
  gold: {
    ribbonA: '#1e3a8a',
    ribbonB: '#1e40af',
    rimA: '#facc15',
    rimB: '#b45309',
    faceA: '#fde047',
    faceB: '#f59e0b',
    faceC: '#92400e',
    star: '#7c2d12',
    shine: 'rgba(255,255,255,0.55)',
  },
  silver: {
    ribbonA: '#1f2937',
    ribbonB: '#374151',
    rimA: '#e5e7eb',
    rimB: '#6b7280',
    faceA: '#f3f4f6',
    faceB: '#9ca3af',
    faceC: '#4b5563',
    star: '#1f2937',
    shine: 'rgba(255,255,255,0.7)',
  },
  bronze: {
    ribbonA: '#7c2d12',
    ribbonB: '#9a3412',
    rimA: '#fdba74',
    rimB: '#7c2d12',
    faceA: '#fdba74',
    faceB: '#c2410c',
    faceC: '#7c2d12',
    star: '#431407',
    shine: 'rgba(255,255,255,0.45)',
  },
}

export function Medal({ kind, size = 40 }: { kind: MedalKind; size?: number }) {
  const p = PALETTES[kind]
  const id = `medal-${kind}`
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-ribbon`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.ribbonA} />
          <stop offset="100%" stopColor={p.ribbonB} />
        </linearGradient>
        <radialGradient id={`${id}-face`} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0%" stopColor={p.faceA} />
          <stop offset="55%" stopColor={p.faceB} />
          <stop offset="100%" stopColor={p.faceC} />
        </radialGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={p.rimA} />
          <stop offset="100%" stopColor={p.rimB} />
        </linearGradient>
      </defs>

      {/* Ribbon */}
      <path d="M20 4 L18 32 L32 26 L46 32 L44 4 Z" fill={`url(#${id}-ribbon)`} />
      <path d="M20 4 L24 4 L22 30 L20 30 Z" fill="rgba(255,255,255,0.18)" />

      {/* Medal disc */}
      <circle cx="32" cy="42" r="18" fill={`url(#${id}-rim)`} />
      <circle cx="32" cy="42" r="14" fill={`url(#${id}-face)`} />

      {/* Star */}
      <path
        d="M32 33 L34.2 39 L40.5 39.3 L35.6 43.1 L37.4 49.2 L32 45.8 L26.6 49.2 L28.4 43.1 L23.5 39.3 L29.8 39 Z"
        fill={p.star}
        opacity="0.85"
      />

      {/* Shine */}
      <ellipse cx="26" cy="36" rx="5" ry="2.5" fill={p.shine} opacity="0.7" />
    </svg>
  )
}
