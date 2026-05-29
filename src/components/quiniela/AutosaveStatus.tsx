import { Check, Loader2, AlertCircle, Lock } from 'lucide-react'

type Status = 'idle' | 'saving' | 'saved' | 'error' | 'locked'

export function AutosaveStatus({ status }: { status: Status }) {
  if (status === 'idle') return null

  const config = {
    saving: { icon: <Loader2 size={12} className="animate-spin" />, text: 'Guardando...', cls: 'text-gray-400' },
    saved: { icon: <Check size={12} />, text: 'Guardado', cls: 'text-green-600' },
    error: { icon: <AlertCircle size={12} />, text: 'Error al guardar', cls: 'text-red-600' },
    locked: { icon: <Lock size={12} />, text: 'Partido bloqueado', cls: 'text-amber-600' },
  }[status]

  return (
    <span className={`flex items-center gap-1 text-[10px] font-medium ${config.cls}`}>
      {config.icon}
      {config.text}
    </span>
  )
}
