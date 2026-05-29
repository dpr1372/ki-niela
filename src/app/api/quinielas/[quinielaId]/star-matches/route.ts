import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getMemberContext, isAdminOf } from '@/lib/quiniela-auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ quinielaId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { quinielaId } = await params
  const member = await getMemberContext(quinielaId, session.user.id)
  if (!member) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const stars = await prisma.quinielaStarMatch.findMany({
    where: { quinielaId },
    select: { matchId: true, isStar: true },
  })

  return NextResponse.json(stars)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ quinielaId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { quinielaId } = await params
  const member = await getMemberContext(quinielaId, session.user.id)
  if (!member || !isAdminOf(member)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const { matchId, isStar } = await req.json()
  if (!matchId || typeof isStar !== 'boolean') {
    return NextResponse.json({ error: 'matchId e isStar requeridos' }, { status: 400 })
  }

  // Final match cannot be unmarked as star
  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { phase: true } })
  if (match?.phase === 'FINAL' && !isStar) {
    return NextResponse.json({ error: 'La final siempre es partido estrella' }, { status: 422 })
  }

  const star = await prisma.quinielaStarMatch.upsert({
    where: { quinielaId_matchId: { quinielaId, matchId } },
    create: { quinielaId, matchId, isStar },
    update: { isStar },
  })

  return NextResponse.json(star)
}
