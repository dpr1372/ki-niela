import Image from 'next/image'

type Props = {
  label?: string
  size?: number
  className?: string
}

export function BallLoader({ label = 'Cargando…', size = 56, className = '' }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-6 ${className}`}>
      <div className="relative" style={{ width: size, height: size + 16 }}>
        <div
          className="absolute left-1/2 -translate-x-1/2 ball-bounce"
          style={{ width: size, height: size }}
        >
          <Image
            src="/balon.svg"
            alt=""
            width={size}
            height={size}
            priority
            className="ball-spin select-none"
            draggable={false}
          />
        </div>
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-0 ball-shadow rounded-full bg-black/25 blur-[1px]"
          style={{ width: size * 0.7, height: size * 0.12 }}
        />
      </div>
      {label && <p className="text-sm text-gray-600 font-medium">{label}</p>}
    </div>
  )
}
