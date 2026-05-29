import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getMemberContext } from '@/lib/quiniela-auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ quinielaId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { quinielaId } = await params
  const member = await getMemberContext(quinielaId, session.user.id)
  if (!member) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const scope = searchParams.get('scope') ?? 'general'
  const matchdayId = searchParams.get('matchdayId')
  const phase = searchParams.get('phase')
  const date = searchParams.get('date') // YYYY-MM-DD in America/Costa_Rica

  const whereScore: Record<string, unknown> = { quinielaId }
  if (scope === 'matchday' && matchdayId) {
    const matchIds = await prisma.match.findMany({
      where: { matchdayId },
      select: { id: true },
    })
    whereScore.matchId = { in: matchIds.map((m) => m.id) }
  } else if (scope === 'phase' && phase) {
    const matchIds = await prisma.match.findMany({
      where: { phase: phase as never, eventId: (await prisma.quiniela.findUnique({ where: { id: quinielaId }, select: { eventId: true } }))!.eventId },
      select: { id: true },
    })
    whereScore.matchId = { in: matchIds.map((m) => m.id) }
  } else if (scope === 'day' && date) {
    // Costa Rica is UTC-6 (no DST). Day [00:00, 24:00) CR = [06:00 UTC, 30:00 UTC).
    const [y, mo, d] = date.split('-').map(Number)
    const startUtc = new Date(Date.UTC(y, (mo ?? 1) - 1, d ?? 1, 6, 0, 0))
    const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000)
    const matchIds = await prisma.match.findMany({
      where: { kickoffAtUtc: { gte: startUtc, lt: endUtc } },
      select: { id: true },
    })
    whereScore.matchId = { in: matchIds.map((m) => m.id) }
  }

  // Include every ACTIVE member regardless of role — admins who play also
  // accumulate points and must appear in the table. The dashboard's "Posición"
  // card uses the same criterion so both views stay consistent.
  const activeMembers = await prisma.quinielaMember.findMany({
    where: { quinielaId, status: 'ACTIVE' },
    select: { userId: true },
  })
  const activeUserIds = activeMembers.map((m) => m.userId)
  whereScore.userId = { in: activeUserIds }

  const rows = await prisma.score.groupBy({
    by: ['userId'],
    where: whereScore,
    _sum: { points: true },
    orderBy: { _sum: { points: 'desc' } },
  })

  // groupBy only returns users that have at least one Score row. Append every
  // remaining ACTIVE member with 0 pts so the table reflects who is playing,
  // not just who has been scored. Only applied for the unscoped "general"
  // view — for matchday/phase/day scopes a member with no relevant scores
  // shouldn't pad the list.
  const seen = new Set(rows.map((r) => r.userId))
  const tail = scope === 'general'
    ? activeUserIds.filter((id) => !seen.has(id)).map((id) => ({ userId: id, _sum: { points: 0 } }))
    : []
  const ranked = [...rows.map((r) => ({ userId: r.userId, _sum: { points: r._sum.points ?? 0 } })), ...tail]

  const userIds = ranked.map((r) => r.userId)
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  })
  const userMap = new Map(users.map((u) => [u.id, u]))

  const leaderboard = ranked.map((r, idx) => ({
    position: idx + 1,
    userId: r.userId,
    name: userMap.get(r.userId)?.name ?? 'Desconocido',
    points: r._sum.points ?? 0,
    isMe: r.userId === session.user.id,
  }))

  return NextResponse.json(leaderboard)
}
