import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const memberships = await prisma.quinielaMember.findMany({
    where: { userId: session.user.id },
    include: {
      quiniela: {
        include: {
          event: { select: { id: true, name: true, sport: true, status: true } },
          _count: { select: { members: { where: { status: 'ACTIVE', role: 'PARTICIPANT' } } } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  })

  // Get score totals per member
  const quinielaIds = memberships.map((m) => m.quinielaId)
  const scoreTotals = await prisma.score.groupBy({
    by: ['quinielaId', 'userId'],
    where: { userId: session.user.id, quinielaId: { in: quinielaIds } },
    _sum: { points: true },
  })
  const scoreMap = new Map(scoreTotals.map((s) => [`${s.quinielaId}-${s.userId}`, s._sum.points ?? 0]))

  const result = memberships.map((m) => ({
    ...m,
    totalPoints: scoreMap.get(`${m.quinielaId}-${m.userId}`) ?? 0,
  }))

  return NextResponse.json(result)
}
