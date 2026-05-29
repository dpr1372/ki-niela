/**
 * Admin endpoint to bulk-clear invalid external mappings.
 *
 * POST /api/admin/matches/clear-external
 *   body: { provider?: string }   // optional: only clear links from this provider
 *
 * Use case: when the live-scores provider is changed (e.g. Sofascore → ESPN),
 * IDs from the old provider are unusable. This wipes them so the admin can
 * re-link via the new provider's search.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const provider: string | undefined = body?.provider

  const where = provider
    ? { externalProvider: provider }
    : { externalId: { not: null } }

  const result = await prisma.match.updateMany({
    where,
    data: {
      externalId: null,
      externalProvider: null,
      manualOverride: false,
      liveSource: 'NONE',
    },
  })

  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id,
      action: 'BULK_CLEAR_EXTERNAL_LINKS',
      entityType: 'Match',
      entityId: 'bulk',
      newValue: { cleared: result.count, provider: provider ?? 'all' } as never,
    },
  })

  return NextResponse.json({ cleared: result.count })
}
