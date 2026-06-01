import { Bot } from 'lucide-react'

/**
 * Identifica una predicción generada por el bot (autoPredictionsEnabled).
 * Color morado consistente en pronósticos, en-vivo y matriz.
 *
 * - variant="chip" (default): pastilla con ícono + "Bot" para junto al marcador.
 * - variant="icon": solo el ícono morado, para espacios estrechos (matriz móvil).
 */
export function BotBadge({
  variant = 'chip',
  size = 12,
}: {
  variant?: 'chip' | 'icon'
  size?: number
}) {
  if (variant === 'icon') {
    return <Bot size={size} className="text-purple-500 shrink-0" aria-label="Generado por bot" />
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-purple-700 shrink-0"
      title="Predicción generada automáticamente por el bot"
    >
      <Bot size={size} className="text-purple-500" />
      Bot
    </span>
  )
}
