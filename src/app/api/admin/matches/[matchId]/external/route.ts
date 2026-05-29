/**
 * Admin endpoints to manage external provider mapping for a match.
 *
 * PATCH: assign or clear externalId, toggle manualOverride.
 *   { externalId?: string | null, manualOverride?: boolean }
 *
 * Only SUPER_ADMIN may call this.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const patchSchema = z.object({
  externalId: z.union([z.string().min(1), z.null()]).optional(),
  externalProvider: z.string().optional(),
  manualOverride: z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { matchId } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detail: parsed.error.flatten() }, { status: 422 })
  }

  const data: Record<string, unknown> = {}
  if (parsed.data.externalId !== undefined) {
    data.externalId = parsed.data.externalId
    data.externalProvider = parsed.data.externalId ? (parsed.data.externalProvider ?? 'api-football') : null
  }
  if (parsed.data.manualOverride !== undefined) {
    data.manualOverride = parsed.data.manualOverride
    if (parsed.data.manualOverride) {
      // Switching to manual: mark current source so UI shows the badge
      data.liveSource = 'ADMIN_MANUAL'
    }
  }

  try {
    const match = await prisma.match.update({
      where: { id: matchId },
      data,
      select: {
        id: true,
        externalId: true,
        externalProvider: true,
        manualOverride: true,
        liveSource: true,
      },
    })

    await prisma.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: 'MATCH_EXTERNAL_LINK_UPDATED',
        entityType: 'Match',
        entityId: matchId,
        newValue: data as never,
      },
    })

    return NextResponse.json(match)
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'Ese externalId ya está asignado a otro partido.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: 'Error al actualizar.', detail: String(e) }, { status: 500 })
  }
}
