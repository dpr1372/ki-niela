import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isMatchLocked } from '@/lib/timezone'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const candidates = await prisma.match.findMany({
    where: { status: 'PROGRAMADO' },
    select: { id: true, kickoffAtUtc: true },
  })

  const tolock: string[] = []
  for (const match of candidates) {
    // Default 10 min lock; we use 10 here since we don't have per-quiniela context at job level
    if (isMatchLocked(new Date(match.kickoffAtUtc), 10)) {
      tolock.push(match.id)
    }
  }

  if (tolock.length > 0) {
    await prisma.match.updateMany({
      where: { id: { in: tolock } },
      data: { status: 'BLOQUEADO' },
    })
  }

  return NextResponse.json({ locked: tolock.length, matchIds: tolock })
}
