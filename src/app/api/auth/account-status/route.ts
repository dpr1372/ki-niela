import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const schema = z.object({ email: z.string().email() })

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ status: 'UNKNOWN' })

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { status: true },
  })
  return NextResponse.json({ status: user?.status ?? 'UNKNOWN' })
}
