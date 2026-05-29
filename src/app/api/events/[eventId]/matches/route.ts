import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { toZonedTime } from 'date-fns-tz'

const createSchema = z.object({
  phase: z.enum(['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL']),
  matchdayId: z.string().min(1),
  stadiumId: z.string().min(1),
  homeTeamId: z.string().optional(),
  awayTeamId: z.string().optional(),
  placeholderHomeName: z.string().optional(),
  placeholderAwayName: z.string().optional(),
  kickoffAtUtc: z.string().datetime(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { eventId } = await params
  const { searchParams } = new URL(req.url)
  const phase = searchParams.get('phase')
  const matchdayId = searchParams.get('matchdayId')

  const matches = await prisma.match.findMany({
    where: {
      eventId,
      ...(phase ? { phase: phase as never } : {}),
      ...(matchdayId ? { matchdayId } : {}),
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      stadium: true,
      matchday: true,
    },
    orderBy: { kickoffAtUtc: 'asc' },
  })

  return NextResponse.json(matches)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Solo el super admin puede crear partidos.' }, { status: 403 })
  }

  const { eventId } = await params
  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const d = parsed.data
  if (!d.homeTeamId && !d.placeholderHomeName) {
    return NextResponse.json({ error: 'Debe indicar equipo local o placeholder.' }, { status: 422 })
  }
  if (!d.awayTeamId && !d.placeholderAwayName) {
    return NextResponse.json({ error: 'Debe indicar equipo visita o placeholder.' }, { status: 422 })
  }

  const utc = new Date(d.kickoffAtUtc)
  // Mirror the same UTC instant; UI applies America/Costa_Rica via Intl. Avoids double-shift.
  const cr = utc

  const match = await prisma.match.create({
    data: {
      eventId,
      phase: d.phase,
      matchdayId: d.matchdayId,
      stadiumId: d.stadiumId,
      homeTeamId: d.homeTeamId ?? null,
      awayTeamId: d.awayTeamId ?? null,
      placeholderHomeName: d.placeholderHomeName ?? null,
      placeholderAwayName: d.placeholderAwayName ?? null,
      kickoffAtUtc: utc,
      kickoffAtCostaRica: cr,
      status: 'PROGRAMADO',
    },
  })

  return NextResponse.json({ match, message: 'Partido creado.' })
}
