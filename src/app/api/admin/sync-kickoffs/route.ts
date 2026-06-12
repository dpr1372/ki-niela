/**
 * Admin endpoint: corregir los horarios (kickoff) de los partidos contra ESPN.
 *
 * Algunos partidos quedaron con kickoffAtUtc incorrecto (cargados por seed con
 * horas hardcodeadas mal convertidas desde la zona de cada sede). ESPN tiene el
 * instante autoritativo. Este endpoint, para cada partido vinculado (externalId)
 * y NO finalizado, consulta ESPN y reescribe kickoffAtUtc + kickoffAtCostaRica.
 *
 * Importante: el bloqueo de cada partido se calcula desde kickoffAtUtc, así que
 * corregir el horario también corrige cuándo se bloquea. NO toca predicciones,
 * marcadores, resultados, status ni orientación home/away.
 *
 * POST /api/admin/sync-kickoffs
 *   body: { apply?: boolean }   // false (default) = dry-run (no escribe)
 *
 * Solo SUPER_ADMIN (sesión). Respuesta:
 *   { applied, total, changed, changes: [{ matchId, label, fromIso, toIso, deltaMin }], provider }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { fetchKickoffs } from '@/lib/live-providers/espn'
import { toZonedTime } from 'date-fns-tz'

const TZ = 'America/Costa_Rica'

// Partidos cuyo horario YA no importa corregir (pasados o sin sentido).
const SKIP_STATUSES = ['FINALIZADO', 'CANCELADO', 'POSTERGADO'] as const

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as { apply?: boolean }
  const apply = body?.apply === true

  const matches = await prisma.match.findMany({
    where: {
      externalId: { not: null },
      status: { notIn: SKIP_STATUSES as unknown as never },
    },
    select: {
      id: true,
      externalId: true,
      kickoffAtUtc: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      placeholderHomeName: true,
      placeholderAwayName: true,
    },
  })

  if (matches.length === 0) {
    return NextResponse.json({ applied: apply, total: 0, changed: 0, changes: [], provider: 'espn' })
  }

  const externalIds = matches.map((m) => m.externalId!).filter(Boolean)

  let kickoffs: Awaited<ReturnType<typeof fetchKickoffs>> = []
  try {
    kickoffs = await fetchKickoffs(externalIds)
  } catch (e) {
    return NextResponse.json({ error: 'ESPN falló', detail: String(e) }, { status: 502 })
  }
  const kickoffByExt = new Map(kickoffs.map((k) => [k.externalId, k.kickoffIsoUtc]))

  const changes: {
    matchId: string
    label: string
    fromIso: string
    toIso: string
    deltaMin: number
  }[] = []

  for (const m of matches) {
    const iso = kickoffByExt.get(m.externalId!)
    if (!iso) continue
    const newUtc = new Date(iso)
    if (Number.isNaN(newUtc.getTime())) continue

    const deltaMin = Math.round((newUtc.getTime() - m.kickoffAtUtc.getTime()) / 60000)
    if (deltaMin === 0) continue // ya está bien

    const home = m.homeTeam?.name ?? m.placeholderHomeName ?? '?'
    const away = m.awayTeam?.name ?? m.placeholderAwayName ?? '?'
    changes.push({
      matchId: m.id,
      label: `${home} vs ${away}`,
      fromIso: m.kickoffAtUtc.toISOString(),
      toIso: newUtc.toISOString(),
      deltaMin,
    })

    if (apply) {
      await prisma.match.update({
        where: { id: m.id },
        data: {
          kickoffAtUtc: newUtc,
          kickoffAtCostaRica: toZonedTime(newUtc, TZ),
          lastSyncAt: new Date(),
        },
      })
    }
  }

  return NextResponse.json({
    applied: apply,
    total: matches.length,
    changed: changes.length,
    changes,
    provider: 'espn',
  })
}
