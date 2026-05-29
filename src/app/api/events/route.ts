import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  sport: z.string().default('football'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  timezone: z.string().default('America/Costa_Rica'),
})

export async function GET() {
  const events = await prisma.event.findMany({
    orderBy: { startDate: 'asc' },
  })
  return NextResponse.json(events)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const event = await prisma.event.create({ data: parsed.data })
  return NextResponse.json(event, { status: 201 })
}
