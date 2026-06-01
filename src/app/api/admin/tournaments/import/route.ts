/**
 * Admin endpoint: importar un torneo desde ESPN y crear su quiniela.
 *
 * POST /api/admin/tournaments/import
 *   body: {
 *     slug: string                  // uno de TOURNAMENTS (src/lib/tournaments.ts)
 *     startDate: "YYYY-MM-DD"
 *     endDate: "YYYY-MM-DD"
 *     quinielaName?: string         // si se omite → "Ki-Niela {nombre torneo}"
 *     lockMinutesBeforeMatch?: number
 *     randomMinGoals?: number
 *     randomMaxGoals?: number
 *   }
 *
 * Solo SUPER_ADMIN (mismo gate que crear quinielas). Idempotente: re-postear el
 * mismo torneo+rango agrega partidos nuevos y actualiza existentes; crea SIEMPRE
 * una quiniela nueva si se envía quinielaName.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { importTournament } from '@/lib/import-tournament'
import { TOURNAMENT_SLUGS, tournamentBySlug } from '@/lib/tournaments'

const bodySchema = z.object({
  slug: z.enum(TOURNAMENT_SLUGS as [string, ...string[]]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inicial inválida (YYYY-MM-DD).'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha final inválida (YYYY-MM-DD).'),
  quinielaName: z.string().trim().min(2).max(120).optional(),
  lockMinutesBeforeMatch: z.number().int().min(0).max(1440).optional(),
  randomMinGoals: z.number().int().min(0).max(20).optional(),
  randomMaxGoals: z.number().int().min(0).max(20).optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Solo el super admin puede importar torneos.' },
      { status: 403 },
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const data = parsed.data
  if (data.startDate > data.endDate) {
    return NextResponse.json(
      { error: 'La fecha inicial no puede ser posterior a la final.' },
      { status: 422 },
    )
  }
  if (
    data.randomMinGoals !== undefined &&
    data.randomMaxGoals !== undefined &&
    data.randomMinGoals > data.randomMaxGoals
  ) {
    return NextResponse.json(
      { error: 'randomMinGoals no puede ser mayor que randomMaxGoals.' },
      { status: 422 },
    )
  }

  const meta = tournamentBySlug(data.slug)!
  const quinielaName = data.quinielaName ?? `Ki-Niela ${meta.name}`

  try {
    const result = await importTournament({
      slug: data.slug,
      startDate: data.startDate,
      endDate: data.endDate,
      createdByUserId: session.user.id,
      quinielaName,
      lockMinutesBeforeMatch: data.lockMinutesBeforeMatch,
      randomMinGoals: data.randomMinGoals,
      randomMaxGoals: data.randomMaxGoals,
    })
    return NextResponse.json(result)
  } catch (e) {
    console.error('[tournaments/import] failed', e)
    return NextResponse.json(
      { error: 'Falló la importación desde ESPN.', detail: String(e) },
      { status: 502 },
    )
  }
}
