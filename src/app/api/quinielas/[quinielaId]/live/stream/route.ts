/**
 * Server-Sent Events (SSE) endpoint for real-time live match updates.
 *
 * Client connects via EventSource and receives push notifications when:
 * - Live scores are updated by admin
 * - A match status changes (BLOQUEADO → EN_JUEGO → FINALIZADO)
 * - New predictions are revealed (after lock)
 *
 * The stream polls the database every 3 seconds and only pushes when
 * something has actually changed (delta-based push to save bandwidth).
 */

import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getMemberContext } from '@/lib/quiniela-auth'
import { isMatchLocked } from '@/lib/timezone'
import { calculateScore } from '@/lib/scoring'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const POLL_INTERVAL_MS = 3000 // Check DB every 3s
const MAX_DURATION_MS = 25 * 60 * 1000 // 25 min then client reconnects

async function getLiveSnapshot(quinielaId: string, userId: string) {
  const quiniela = await prisma.quiniela.findUnique({
    where: { id: quinielaId },
    select: { id: true, eventId: true, lockMinutesBeforeMatch: true },
  })
  if (!quiniela) return null

  const matches = await prisma.match.findMany({
    where: {
      eventId: quiniela.eventId,
      status: { in: ['BLOQUEADO', 'EN_JUEGO', 'MEDIO_TIEMPO', 'TIEMPO_EXTRA', 'PENALES', 'FINALIZADO'] },
    },
    include: {
      homeTeam: { select: { id: true, name: true, fifaCode: true, flagUrl: true } },
      awayTeam: { select: { id: true, name: true, fifaCode: true, flagUrl: true } },
      stadium: { select: { name: true, city: true } },
      matchday: { select: { name: true, phase: true } },
    },
    orderBy: { kickoffAtUtc: 'desc' },
    take: 30,
  })

  if (matches.length === 0) return { matches: [] }

  const matchIds = matches.map((m) => m.id)
  const [predictions, members, stars] = await Promise.all([
    prisma.prediction.findMany({
      where: { quinielaId, matchId: { in: matchIds } },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.quinielaMember.findMany({
      where: { quinielaId, status: 'ACTIVE', role: 'PARTICIPANT' },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.quinielaStarMatch.findMany({
      where: { quinielaId, matchId: { in: matchIds }, isStar: true },
      select: { matchId: true },
    }),
  ])

  const starSet = new Set(stars.map((s) => s.matchId))
  const predsByMatch = new Map<string, typeof predictions>()
  for (const p of predictions) {
    const arr = predsByMatch.get(p.matchId) ?? []
    arr.push(p)
    predsByMatch.set(p.matchId, arr)
  }

  return {
    matches: matches.map((m) => {
      const locked =
        isMatchLocked(m.kickoffAtUtc, quiniela.lockMinutesBeforeMatch) ||
        m.status !== 'PROGRAMADO'
      const matchPreds = predsByMatch.get(m.id) ?? []
      const isStar = starSet.has(m.id) || m.phase === 'FINAL'

      const refHome = m.status === 'FINALIZADO' ? m.officialHomeGoals : m.liveHomeGoals
      const refAway = m.status === 'FINALIZADO' ? m.officialAwayGoals : m.liveAwayGoals
      const hasRef = refHome !== null && refAway !== null

      const profiles = members.map((mem) => {
        const pred = matchPreds.find((p) => p.userId === mem.userId)
        const isSelf = mem.userId === userId
        const showPrediction = isSelf || locked

        let live: { points: number; reason: string } | null = null
        if (pred && hasRef) {
          live = calculateScore(
            pred.predictedHomeGoals,
            pred.predictedAwayGoals,
            refHome!,
            refAway!,
            isStar,
          )
        }

        return {
          userId: mem.userId,
          userName: mem.user.name,
          isSelf,
          hasPrediction: !!pred,
          predictedHome: showPrediction && pred ? pred.predictedHomeGoals : null,
          predictedAway: showPrediction && pred ? pred.predictedAwayGoals : null,
          generatedByBot: pred?.generatedByBot ?? false,
          livePoints: live?.points ?? null,
          liveReason: live?.reason ?? null,
          isProvisional: m.status !== 'FINALIZADO',
        }
      })

      return {
        id: m.id,
        status: m.status,
        phase: m.phase,
        isStar,
        kickoffAtUtc: m.kickoffAtUtc,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        placeholderHomeName: m.placeholderHomeName,
        placeholderAwayName: m.placeholderAwayName,
        stadium: m.stadium,
        matchday: m.matchday,
        liveHomeGoals: m.liveHomeGoals,
        liveAwayGoals: m.liveAwayGoals,
        officialHomeGoals: m.officialHomeGoals,
        officialAwayGoals: m.officialAwayGoals,
        liveUpdatedAt: m.liveUpdatedAt,
        profiles: profiles.sort((a, b) => (b.livePoints ?? -1) - (a.livePoints ?? -1)),
      }
    }),
  }
}

// Hash the snapshot to detect changes without serializing twice
function hashSnapshot(snap: Awaited<ReturnType<typeof getLiveSnapshot>>): string {
  if (!snap) return 'null'
  return snap.matches
    .map(
      (m) =>
        `${m.id}:${m.status}:${m.liveHomeGoals}:${m.liveAwayGoals}:${m.officialHomeGoals}:${m.officialAwayGoals}:${m.liveUpdatedAt?.toString() ?? ''}`,
    )
    .join('|')
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ quinielaId: string }> },
) {
  const session = await auth()
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { quinielaId } = await params
  const member = await getMemberContext(quinielaId, session.user.id)
  if (!member) {
    return new Response('Forbidden', { status: 403 })
  }

  const userId = session.user.id
  const startTime = Date.now()
  let lastHash = ''
  let timer: ReturnType<typeof setInterval> | null = null
  let aborted = false

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      const send = (data: unknown, event = 'message') => {
        if (aborted) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          aborted = true
        }
      }

      // Initial snapshot
      try {
        const snap = await getLiveSnapshot(quinielaId, userId)
        lastHash = hashSnapshot(snap)
        send(snap, 'snapshot')
      } catch (e) {
        send({ error: 'Initial snapshot failed' }, 'error')
      }

      // Heartbeat to keep connection alive (some proxies drop idle connections)
      const heartbeat = setInterval(() => {
        if (aborted) return
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`))
        } catch {
          aborted = true
        }
      }, 15000)

      // Poll DB and push only on change
      timer = setInterval(async () => {
        if (aborted) return
        if (Date.now() - startTime > MAX_DURATION_MS) {
          send({ reason: 'max_duration' }, 'reconnect')
          aborted = true
          clearInterval(timer!)
          clearInterval(heartbeat)
          try { controller.close() } catch {}
          return
        }
        try {
          const snap = await getLiveSnapshot(quinielaId, userId)
          const h = hashSnapshot(snap)
          if (h !== lastHash) {
            lastHash = h
            send(snap, 'update')
          }
        } catch {
          // swallow transient errors
        }
      }, POLL_INTERVAL_MS)

      // Cleanup on client disconnect
      req.signal.addEventListener('abort', () => {
        aborted = true
        if (timer) clearInterval(timer)
        clearInterval(heartbeat)
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  })
}
