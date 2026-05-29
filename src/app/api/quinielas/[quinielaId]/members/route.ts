import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getMemberContext, isAdminOf } from '@/lib/quiniela-auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ quinielaId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { quinielaId } = await params
  const caller = await getMemberContext(quinielaId, session.user.id)
  const isSuperAdmin = session.user.globalRole === 'SUPER_ADMIN'
  if (!caller && !isSuperAdmin) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get('status')
  const includeAllUsers = searchParams.get('includeAllUsers') === 'true'

  const members = await prisma.quinielaMember.findMany({
    where: {
      quinielaId,
      ...(statusFilter ? { status: statusFilter as never } : {}),
    },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { joinedAt: 'asc' },
  })

  if (!includeAllUsers || !(isAdminOf(caller) || isSuperAdmin)) {
    return NextResponse.json(members)
  }

  const memberUserIds = new Set(members.map((m) => m.userId))
  const otherUsers = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      id: { notIn: Array.from(memberUserIds) },
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })

  const virtualNonMembers = otherUsers.map((u) => ({
    id: `virtual-${u.id}`,
    quinielaId,
    userId: u.id,
    role: 'PARTICIPANT' as const,
    status: 'NOT_MEMBER' as const,
    autoPredictionsEnabled: false,
    joinedAt: null,
    approvedAt: null,
    approvedByUserId: null,
    deactivatedAt: null,
    deactivatedByUserId: null,
    user: u,
    isVirtual: true,
  }))

  return NextResponse.json([...members, ...virtualNonMembers])
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quinielaId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { quinielaId } = await params
  const body = await req.json().catch(() => ({}))
  const targetUserId: string | undefined = body?.userId
  const desiredStatus: string | undefined = body?.status

  // Admin path: agregar/activar a otro usuario global
  if (targetUserId && targetUserId !== session.user.id) {
    const caller = await getMemberContext(quinielaId, session.user.id)
    const isSuperAdmin = session.user.globalRole === 'SUPER_ADMIN'
    if (!isAdminOf(caller) && !isSuperAdmin) {
      return NextResponse.json({ error: 'Solo el administrador puede agregar usuarios.' }, { status: 403 })
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } })
    if (!targetUser) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    if (targetUser.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'El usuario global está inactivo.' }, { status: 400 })
    }

    const existing = await prisma.quinielaMember.findUnique({
      where: { quinielaId_userId: { quinielaId, userId: targetUserId } },
    })
    if (existing) {
      return NextResponse.json({ error: 'El usuario ya pertenece a la quiniela.' }, { status: 409 })
    }

    const status = desiredStatus === 'ACTIVE' ? 'ACTIVE' : 'INVITED'
    const member = await prisma.quinielaMember.create({
      data: {
        quinielaId,
        userId: targetUserId,
        role: 'PARTICIPANT',
        status,
        ...(status === 'ACTIVE'
          ? { approvedAt: new Date(), approvedByUserId: session.user.id }
          : {}),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    })

    await prisma.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: status === 'ACTIVE' ? 'MEMBER_ACTIVATED' : 'MEMBER_INVITED',
        entityType: 'QuinielaMember',
        entityId: member.id,
        oldValue: Prisma.JsonNull,
        newValue: { status, role: 'PARTICIPANT', userId: targetUserId },
      },
    })

    return NextResponse.json(member, { status: 201 })
  }

  // Self-request path
  const existing = await prisma.quinielaMember.findUnique({
    where: { quinielaId_userId: { quinielaId, userId: session.user.id } },
  })
  if (existing) {
    return NextResponse.json({ error: 'Ya eres miembro de esta quiniela.' }, { status: 409 })
  }

  const member = await prisma.quinielaMember.create({
    data: {
      quinielaId,
      userId: session.user.id,
      role: 'PARTICIPANT',
      status: 'PENDING_APPROVAL',
    },
  })

  return NextResponse.json(member, { status: 201 })
}
