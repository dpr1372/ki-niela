import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { toZonedTime } from 'date-fns-tz'

const updateSchema = z.object({
  matchdayId: z.string().min(1).optional(),
  stadiumId: z.string().min(1).optional(),
  homeTeamId: z.string().nullable().optional(),
  awayTeamId: z.string().nullable().optional(),
  placeholderHomeName: z.string().nullable().optional(),
  placeholderAwayName: z.string().nullable().optional(),
  kickoffAtUtc: z.string().optional(),
  status: z.enum(['PROGRAMADO', 'BLOQUEADO', 'EN_JUEGO', 'MEDIO_TIEMPO', 'TIEMPO_EXTRA', 'PENALES', 'FINALIZADO', 'POSTERGADO', 'CANCELADO']).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Solo el super admin puede modificar partidos.' }, { status: 403 })
  }

  const { matchId } = await params
  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const data: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) data[k] = v
  }
  if (typeof data.kickoffAtUtc === 'string') {
    const utc = new Date(data.kickoffAtUtc)
    data.kickoffAtUtc = utc
    // Mirror the same UTC instant; UI applies America/Costa_Rica via Intl. Avoids double-shift.
    data.kickoffAtCostaRica = utc
  }

  const match = await prisma.match.update({ where: { id: matchId }, data })
  return NextResponse.json({ match, message: 'Partido actualizado.' })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Solo el super admin puede eliminar partidos.' }, { status: 403 })
  }

  const { matchId } = await params
  const preds = await prisma.prediction.count({ where: { matchId } })
  if (preds > 0) {
    return NextResponse.json({ error: 'No se puede eliminar: el partido ya tiene predicciones.' }, { status: 409 })
  }
  await prisma.match.delete({ where: { id: matchId } })
  return NextResponse.json({ message: 'Partido eliminado.' })
}
