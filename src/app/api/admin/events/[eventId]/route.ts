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
    select: { id: true, name: true, bannerLabel: true, bannerSubtitle: true, bannerLogoUrl: true },
  })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(event)
}
