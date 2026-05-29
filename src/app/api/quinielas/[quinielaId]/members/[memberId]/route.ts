import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getMemberContext, isAdminOf } from '@/lib/quiniela-auth'
import { sendQuinielaAccessApproved } from '@/lib/mailer-templates'
import { z } from 'zod'

const patchSchema = z.object({
  action: z.enum(['activate', 'deactivate', 'reject']).optional(),
  role: z.enum(['QUINIELA_ADMIN', 'PARTICIPANT']).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ quinielaId: string; memberId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { quinielaId, memberId } = await params
  const caller = await getMemberContext(quinielaId, session.user.id)
  if (!isAdminOf(caller)) {
    return NextResponse.json({ error: 'Solo el administrador puede realizar esta acción.' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 422 })

  const { action, role } = parsed.data

  const existing = await prisma.quinielaMember.findUnique({ where: { id: memberId, quinielaId } })
  if (!existing) return NextResponse.json({ error: 'Participante no encontrado' }, { status: 404 })

  const updateData: Record<string, unknown> = {}
  let auditAction = ''

  if (action === 'activate') {
    updateData.status = 'ACTIVE'
    updateData.approvedAt = new Date()
    updateData.approvedByUserId = session.user.id
    auditAction = 'MEMBER_ACTIVATED'
  } else if (action === 'deactivate') {
    updateData.status = 'INACTIVE'
    updateData.deactivatedAt = new Date()
    updateData.deactivatedByUserId = session.user.id
    auditAction = 'MEMBER_DEACTIVATED'
  } else if (action === 'reject') {
    updateData.status = 'REJECTED'
    auditAction = 'MEMBER_REJECTED'
  }

  if (role) {
    updateData.role = role
    auditAction = auditAction || 'MEMBER_ROLE_CHANGED'
  }

  const member = await prisma.quinielaMember.update({
    where: { id: memberId, quinielaId },
    data: updateData,
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  if (auditAction) {
    await prisma.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: auditAction,
        entityType: 'QuinielaMember',
        entityId: memberId,
        oldValue: { status: existing.status, role: existing.role },
        newValue: { status: member.status, role: member.role },
      },
    })
  }

  // Send approval email if user was just activated (transition from non-active → ACTIVE)
  if (action === 'activate' && existing.status !== 'ACTIVE') {
    const quiniela = await prisma.quiniela.findUnique({
      where: { id: quinielaId },
      select: { name: true },
    })
    if (quiniela) {
      sendQuinielaAccessApproved({
        userName: member.user.name,
        userEmail: member.user.email,
        quinielaName: quiniela.name,
        quinielaId,
      }).catch((e) => console.error('[members] approval email failed:', e))
    }
  }

  const toastMap: Record<string, string> = {
    activate: 'Usuario activado.',
    deactivate: 'Usuario desactivado.',
    reject: 'Usuario rechazado.',
  }

  return NextResponse.json({
    member,
    message: action ? toastMap[action] : 'Rol actualizado.',
  })
}
