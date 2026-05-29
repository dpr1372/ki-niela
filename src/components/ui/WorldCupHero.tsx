import Image from 'next/image'

type Props = {
  title: string
  subtitle?: string
  eventLabel?: string
  rightSlot?: React.ReactNode
}

export function WorldCupHero({ title, subtitle, eventLabel, rightSlot }: Props) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-worldcup-banner shadow-lg ring-1 ring-yellow-400/20">
      <div className="relative z-10 px-5 sm:px-7 py-5 sm:py-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="shrink-0 drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]">
            <Image
              src="/wc2026/logo.png"
              alt="FIFA World Cup 2026"
              width={88}
              height={88}
              priority
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
            />
          </div>
          <div className="min-w-0">
            {eventLabel && (
              <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] font-bold text-yellow-300 drop-shadow">
                {eventLabel}
              </p>
            )}
            <h1 className="text-xl sm:text-3xl font-black leading-tight truncate text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-cyan-50 mt-0.5 truncate drop-shadow">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {rightSlot && <div className="shrink-0 relative z-10">{rightSlot}</div>}
      </div>
      {/* Sutil viñeta inferior para legibilidad de los textos */}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent pointer-events-none" />
    </div>
  )
}
