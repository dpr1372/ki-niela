import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const quinielas = await prisma.quiniela.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      event: { select: { id: true, name: true } },
      _count: {
        select: {
          members: { where: { status: 'ACTIVE' } },
        },
      },
    },
  })

  return NextResponse.json(quinielas)
}
