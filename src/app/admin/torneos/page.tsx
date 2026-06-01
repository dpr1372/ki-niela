'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import AppShell from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BallLoader } from '@/components/ui/BallLoader'
import { Trophy, Download, RefreshCw, ExternalLink, Paintbrush, Upload } from 'lucide-react'
import { TOURNAMENTS } from '@/lib/tournaments'

type EventSummary = {
  id: string
  name: string
  bannerLabel: string | null
  bannerSubtitle: string | null
  bannerLogoUrl: string | null
}

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

  // Banner editor state
  const [events, setEvents] = useState<EventSummary[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [bannerLabel, setBannerLabel] = useState('')
  const [bannerSubtitle, setBannerSubtitle] = useState('')
  const [bannerLogoUrl, setBannerLogoUrl] = useState('')
  const [savingBanner, setSavingBanner] = useState(false)

  useEffect(() => {
    fetch('/api/events')
      .then((r) => r.json())
      .then((data: EventSummary[]) => {
        setEvents(data)
        if (data.length > 0) {
          const first = data[0]
          setSelectedEventId(first.id)
          setBannerLabel(first.bannerLabel ?? '')
          setBannerSubtitle(first.bannerSubtitle ?? '')
          setBannerLogoUrl(first.bannerLogoUrl ?? '')
        }
      })
      .catch(() => toast.error('No se pudo cargar la lista de eventos.'))
  }, [])

  function onSelectEvent(id: string) {
    setSelectedEventId(id)
    const ev = events.find((e) => e.id === id)
    if (ev) {
      setBannerLabel(ev.bannerLabel ?? '')
      setBannerSubtitle(ev.bannerSubtitle ?? '')
      setBannerLogoUrl(ev.bannerLogoUrl ?? '')
    }
  }

  // Convierte la imagen seleccionada a un data URL (base64) que se guarda en
  // bannerLogoUrl. Filesystem de Railway es efímero, así que la imagen vive en BD.
  function onPickLogo(file: File | undefined) {
    if (!file) return
    const MAX_BYTES = 800 * 1024 // 800 KB
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      toast.error('Formato no soportado. Usá PNG, JPG, WEBP o SVG.')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error(`La imagen pesa ${Math.round(file.size / 1024)} KB. Máximo 800 KB.`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setBannerLogoUrl(String(reader.result))
      toast.success('Imagen cargada. No olvides "Guardar banner".')
    }
    reader.onerror = () => toast.error('No se pudo leer la imagen.')
    reader.readAsDataURL(file)
  }

  async function saveBanner() {
    if (!selectedEventId) return
    setSavingBanner(true)
    try {
      const res = await fetch(`/api/admin/events/${selectedEventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bannerLabel: bannerLabel.trim() || null,
          bannerSubtitle: bannerSubtitle.trim() || null,
          bannerLogoUrl: bannerLogoUrl.trim() || null,
        }),
      })
      if (!res.ok) throw new Error()
      const updated: EventSummary = await res.json()
      setEvents((prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)))
      toast.success('Banner actualizado.')
    } catch {
      toast.error('No se pudo guardar el banner.')
    } finally {
      setSavingBanner(false)
    }
  }

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

        {/* ── Banner personalizado ─────────────────────────────────────────── */}
        {events.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Paintbrush size={18} className="text-indigo-500" />
              <h2 className="font-bold text-pitch-dark">Personalizar banner del torneo</h2>
            </div>
            <p className="text-xs text-gray-500">
              Estos campos controlan el logo, la línea amarilla superior y el subtítulo del banner en "Mis Quinielas" y el Dashboard.
              Dejar vacío usa los valores por defecto del Mundial.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="bannerEvent">Evento</Label>
              <select
                id="bannerEvent"
                value={selectedEventId}
                onChange={(e) => onSelectEvent(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
              >
                {events.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bannerLabel">Línea amarilla (etiqueta superior)</Label>
              <Input
                id="bannerLabel"
                type="text"
                placeholder="ej. FIFA World Cup 2026 · MEX · USA · CAN"
                value={bannerLabel}
                onChange={(e) => setBannerLabel(e.target.value)}
                disabled={savingBanner}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bannerSubtitle">Subtítulo</Label>
              <Input
                id="bannerSubtitle"
                type="text"
                placeholder="ej. Compite, predice y celebra cada gol del mundial."
                value={bannerSubtitle}
                onChange={(e) => setBannerSubtitle(e.target.value)}
                disabled={savingBanner}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bannerLogoUrl">Logo del banner (vacío = logo del Mundial por defecto)</Label>
              <div className="flex items-start gap-3">
                {bannerLogoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bannerLogoUrl}
                    alt="Vista previa del logo"
                    className="w-14 h-14 rounded-lg border border-gray-200 object-contain bg-gray-50 shrink-0"
                  />
                )}
                <div className="flex-1 space-y-2">
                  <Input
                    id="bannerLogoUrl"
                    type="text"
                    placeholder="Pegá una URL https://… o adjuntá una imagen"
                    value={bannerLogoUrl.startsWith('data:') ? '(imagen adjunta)' : bannerLogoUrl}
                    onChange={(e) => setBannerLogoUrl(e.target.value)}
                    disabled={savingBanner || bannerLogoUrl.startsWith('data:')}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-300 bg-white cursor-pointer hover:bg-gray-50"
                    >
                      <Upload size={14} /> Adjuntar imagen
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        disabled={savingBanner}
                        onChange={(e) => onPickLogo(e.target.files?.[0])}
                      />
                    </label>
                    {bannerLogoUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setBannerLogoUrl('')}
                        disabled={savingBanner}
                      >
                        Quitar
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Recomendado: <b>cuadrado 160×160 px</b> (mín. 88×88), PNG o SVG con fondo transparente.
                    El banner lo muestra a 64–80 px, así que un cuadrado nítido se ve mejor. Máximo 800 KB.
                  </p>
                </div>
              </div>
            </div>

            <Button onClick={saveBanner} disabled={savingBanner || !selectedEventId}>
              <Paintbrush size={14} /> {savingBanner ? 'Guardando…' : 'Guardar banner'}
            </Button>
          </div>
        )}

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
