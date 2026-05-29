/**
 * Admin endpoint: force a match into a specific status for end-to-end testing.
 *
 * This bypasses the normal /api/jobs/lock-matches scheduling — instead of
 * waiting until 10 min before kickoff, the admin can flip a match into
 * BLOQUEADO right now and trigger the live-scores sync to verify the whole
 * pipeline (cron → ESPN → DB → SSE → /quinielas/.../en-vivo) works.
 *
 * PATCH /api/admin/matches/[matchId]/force-status
 *   { status: 'PROGRAMADO' | 'BLOQUEADO' | 'EN_JUEGO' | 'FINALIZADO' }
 *
 * Use case: it is Friday, the real match is Saturday at 14:00. You want
 * to confirm the cron works *today*. Pick any vinculated match, set it
 * to BLOQUEADO, hit "Test sync". The cron should report it as a candidate
 * even if its kickoff is in the future.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const patchSchema = z.object({
  status: z.enum(['PROGRAMADO', 'BLOQUEADO', 'EN_JUEGO', 'FINALIZADO']),
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
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 422 })
  }

  const match = await prisma.match.update({
    where: { id: matchId },
    data: { status: parsed.data.status },
    select: { id: true, status: true, externalId: true },
  })

  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id,
      action: 'MATCH_STATUS_FORCED',
      entityType: 'Match',
      entityId: matchId,
      newValue: { status: parsed.data.status } as never,
    },
  })

  return NextResponse.json(match)
}
