import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      globalRole: true,
      status: true,
      createdAt: true,
      // Membresías para ver a qué quiniela está unido cada usuario y su estado.
      quinielaMembers: {
        select: {
          role: true,
          status: true,
          quiniela: { select: { id: true, name: true, status: true } },
        },
      },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })

  // Aplanar a un shape cómodo para el frontend.
  const result = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    globalRole: u.globalRole,
    status: u.status,
    createdAt: u.createdAt,
    memberships: u.quinielaMembers.map((m) => ({
      quinielaId: m.quiniela.id,
      quinielaName: m.quiniela.name,
      quinielaStatus: m.quiniela.status,
      memberStatus: m.status,
      memberRole: m.role,
    })),
  }))

  return NextResponse.json(result)
}
