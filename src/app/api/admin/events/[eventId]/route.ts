import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// bannerLogoUrl acepta una URL http(s) o un data URL (imagen subida en base64).
// 800 KB de imagen → ~1.07M chars base64; con holgura permitimos 1.2M.
const logoUrlSchema = z
  .string()
  .max(1_200_000)
  .refine(
    (v) => /^https?:\/\//.test(v) || /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(v),
    { message: 'Debe ser una URL http(s) o una imagen (data URL).' },
  )

const patchSchema = z.object({
  bannerLabel: z.string().max(120).nullable().optional(),
  bannerSubtitle: z.string().max(200).nullable().optional(),
  bannerLogoUrl: logoUrlSchema.nullable().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { eventId } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const event = await prisma.event.update({
    where: { id: eventId },
    data: parsed.data,
    select: { id: true, name: true, bannerLabel: true, bannerSubtitle: true, bannerLogoUrl: true },
  })

  return NextResponse.json(event)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { eventId } = await params
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, status: true, bannerLabel: true, bannerSubtitle: true, bannerLogoUrl: true },
  })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(event)
}

/**
 * Borra un evento COMPLETO y todo lo que cuelga de él: equipos, estadios,
 * jornadas, partidos, y TODAS las quinielas del evento con sus miembros,
 * predicciones, scores y partidos estrella. Irreversible.
 *
 * Requiere body { confirmName } que coincida exactamente con el nombre del
 * evento (doble confirmación). Borra en orden hijos→padre porque el schema
 * no tiene onDelete: Cascade.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { eventId } = await params
  const body = await req.json().catch(() => null)
  const confirmName = body?.confirmName

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true },
  })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (confirmName !== event.name) {
    return NextResponse.json(
      { error: 'El nombre de confirmación no coincide con el evento.' },
      { status: 422 },
    )
  }

  // IDs de las quinielas del evento (para borrar sus tablas hijas por quinielaId).
  const quinielas = await prisma.quiniela.findMany({
    where: { eventId },
    select: { id: true },
  })
  const quinielaIds = quinielas.map((q) => q.id)

  const result = await prisma.$transaction(async (tx) => {
    // Hijas de Quiniela / Match (referencian quinielaId o matchId)
    const scores = await tx.score.deleteMany({ where: { eventId } })
    const predictions = await tx.prediction.deleteMany({ where: { eventId } })
    const stars = quinielaIds.length
      ? await tx.quinielaStarMatch.deleteMany({ where: { quinielaId: { in: quinielaIds } } })
      : { count: 0 }
    const members = quinielaIds.length
      ? await tx.quinielaMember.deleteMany({ where: { quinielaId: { in: quinielaIds } } })
      : { count: 0 }
    const quinielasDeleted = await tx.quiniela.deleteMany({ where: { eventId } })

    // Estructura del evento (Match referencia matchday/stadium/team → va primero)
    const matches = await tx.match.deleteMany({ where: { eventId } })
    const matchdays = await tx.matchday.deleteMany({ where: { eventId } })
    const teams = await tx.team.deleteMany({ where: { eventId } })
    const stadiums = await tx.stadium.deleteMany({ where: { eventId } })

    await tx.event.delete({ where: { id: eventId } })

    await tx.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: 'EVENT_DELETED',
        entityType: 'Event',
        entityId: eventId,
        oldValue: JSON.stringify({
          name: event.name,
          quinielas: quinielasDeleted.count,
          matches: matches.count,
          teams: teams.count,
          stadiums: stadiums.count,
          matchdays: matchdays.count,
          predictions: predictions.count,
          scores: scores.count,
          members: members.count,
          stars: stars.count,
        }),
      },
    })

    return {
      quinielas: quinielasDeleted.count,
      matches: matches.count,
      teams: teams.count,
      stadiums: stadiums.count,
      matchdays: matchdays.count,
      predictions: predictions.count,
      scores: scores.count,
      members: members.count,
    }
  })

  return NextResponse.json({ ok: true, deleted: result, eventName: event.name })
}
