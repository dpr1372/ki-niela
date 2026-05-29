import { Badge } from '@/components/ui/badge'

type MatchStatus = 'PROGRAMADO' | 'BLOQUEADO' | 'EN_JUEGO' | 'MEDIO_TIEMPO' | 'TIEMPO_EXTRA' | 'PENALES' | 'FINALIZADO' | 'POSTERGADO' | 'CANCELADO'

const STATUS_CONFIG: Record<MatchStatus, { label: string; variant: 'default' | 'destructive' | 'outline' | 'secondary' }> = {
  PROGRAMADO: { label: 'Programado', variant: 'outline' },
  BLOQUEADO: { label: 'Bloqueado', variant: 'destructive' },
  EN_JUEGO: { label: 'En juego', variant: 'default' },
  MEDIO_TIEMPO: { label: 'Medio tiempo', variant: 'default' },
  TIEMPO_EXTRA: { label: 'Tiempo extra', variant: 'default' },
  PENALES: { label: 'Penales', variant: 'default' },
  FINALIZADO: { label: 'Finalizado', variant: 'secondary' },
  POSTERGADO: { label: 'Postergado', variant: 'outline' },
  CANCELADO: { label: 'Cancelado', variant: 'destructive' },
}

export function MatchStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as MatchStatus] ?? { label: status, variant: 'outline' as const }
  return (
    <Badge variant={config.variant} className="text-[10px]">
      {config.label}
    </Badge>
  )
}
