import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getMemberContext } from '@/lib/quiniela-auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ quinielaId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { quinielaId } = await params
  const member = await getMemberContext(quinielaId, session.user.id)
  if (!member) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const quiniela = await prisma.quiniela.findUnique({
    where: { id: quinielaId },
    include: {
      event: true,
      _count: { select: { members: { where: { status: 'ACTIVE', role: 'PARTICIPANT' } } } },
    },
  })

  if (!quiniela) return NextResponse.json({ error: 'Quiniela no encontrada' }, { status: 404 })
  return NextResponse.json({ quiniela, member, globalRole: session.user.globalRole })
}
