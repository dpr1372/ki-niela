'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import AppShell from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BallLoader } from '@/components/ui/BallLoader'
import { Trophy, Download, RefreshCw, ExternalLink } from 'lucide-react'
import { TOURNAMENTS } from '@/lib/tournaments'

type ImportResult = {
  eventId: string
  quinielaId: string | null
  inviteCode: string | null
  counts: {
    fixtures: number
    teams: number
    stadiums: number
    matchdays: number
    matchesCreated: number
    matchesUpdated: number
    skippedNoTeams: number
  }
}

// Default sensato: una ventana de ~4 meses centrada en hoy, sin usar Date.now()
// en el render del servidor (se calcula en cliente al montar el input).
function todayIso(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

export default function AdminTorneosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [slug, setSlug] = useState<string>(TOURNAMENTS[0].slug)
  const [startDate, setStartDate] = useState(() => todayIso(-30))
  const [endDate, setEndDate] = useState(() => todayIso(120))
  const [quinielaName, setQuinielaName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lastResult, setLastResult] = useState<ImportResult | null>(null)

  if (status === 'loading') {
    return (
      <AppShell>
        <BallLoader label="Cargando…" />
      </AppShell>
    )
  }
  if (!session || session.user.globalRole !== 'SUPER_ADMIN') {
    router.push('/quinielas')
    return null
  }

  const selected = TOURNAMENTS.find((t) => t.slug === slug)!

  async function submit(isResync: boolean) {
    if (startDate > endDate) {
      toast.error('La fecha inicial no puede ser posterior a la final.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/tournaments/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          startDate,
          endDate,
          // En re-sync no creamos quiniela nueva: el evento/partidos se
          // actualizan, pero dejar quinielaName vacío evita duplicar quinielas.
          quinielaName: isResync ? undefined : quinielaName.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg =
          typeof data?.error === 'string'
            ? data.error
            : 'No se pudo importar el torneo.'
        toast.error(msg)
        return
      }
      setLastResult(data as ImportResult)
      const c = (data as ImportResult).counts
      if (isResync) {
        toast.success(
          `Re-sincronizado: ${c.matchesCreated} nuevos, ${c.matchesUpdated} actualizados.`,
        )
      } else {
        toast.success(
          `Quiniela creada: ${c.matchesCreated} partidos, ${c.teams} equipos.` +
            (data.inviteCode ? ` Código: ${data.inviteCode}` : ''),
        )
      }
    } catch {
      toast.error('Error de red al importar el torneo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-2">
          <Trophy className="text-yellow-500" size={26} />
          <h1 className="text-2xl font-black text-pitch-dark">Importar torneo</h1>
        </div>
        <p className="text-sm text-gray-600">
          Elegí una competición y un rango de fechas. Se crea el evento completo
          (equipos, estadios, partidos) ligado a ESPN para sincronización en vivo,
          con el mismo diseño que el Mundial, y una quiniela lista para invitar.
        </p>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="slug">Competición</Label>
            <select
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={submitting}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {TOURNAMENTS.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.emoji} {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start">Desde</Label>
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">Hasta</Label>
              <Input
                id="end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qname">Nombre de la quiniela (opcional)</Label>
            <Input
              id="qname"
              type="text"
              placeholder={`Ki-Niela ${selected.name}`}
              value={quinielaName}
              onChange={(e) => setQuinielaName(e.target.value)}
              disabled={submitting}
            />
            <p className="text-[11px] text-gray-400">
              Si lo dejás vacío se usa “Ki-Niela {selected.name}”.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button onClick={() => submit(false)} disabled={submitting}>
              <Download /> Crear quiniela desde ESPN
            </Button>
            <Button
              variant="outline"
              onClick={() => submit(true)}
              disabled={submitting}
              title="Re-importa el mismo torneo/rango: agrega partidos nuevos y actualiza los existentes, sin crear otra quiniela."
            >
              <RefreshCw /> Re-sincronizar partidos
            </Button>
            {submitting && <span className="text-sm text-gray-500">Importando…</span>}
          </div>
        </div>

        {lastResult && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
            <h2 className="font-bold text-emerald-900 flex items-center gap-2">
              <Trophy size={18} /> Importación completa
            </h2>
            <ul className="text-sm text-emerald-900/90 grid grid-cols-2 gap-x-4 gap-y-1">
              <li>Partidos en rango: <b>{lastResult.counts.fixtures}</b></li>
              <li>Equipos: <b>{lastResult.counts.teams}</b></li>
              <li>Partidos creados: <b>{lastResult.counts.matchesCreated}</b></li>
              <li>Partidos actualizados: <b>{lastResult.counts.matchesUpdated}</b></li>
              <li>Estadios: <b>{lastResult.counts.stadiums}</b></li>
              <li>Jornadas: <b>{lastResult.counts.matchdays}</b></li>
            </ul>
            {lastResult.counts.skippedNoTeams > 0 && (
              <p className="text-[11px] text-emerald-700">
                {lastResult.counts.skippedNoTeams} partido(s) sin fecha fueron omitidos.
              </p>
            )}
            {lastResult.inviteCode && (
              <p className="text-sm text-emerald-900">
                Código de invitación: <b className="font-mono">{lastResult.inviteCode}</b>
              </p>
            )}
            {lastResult.quinielaId && (
              <Link
                href={`/quinielas/${lastResult.quinielaId}/pronosticos`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline"
              >
                <ExternalLink size={14} /> Abrir la quiniela
              </Link>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
