import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/mailer'

const NOTIFY_MINUTES_BEFORE_LOCK = 5

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // We want matches whose lock window opens within the next 5 minutes.
  // Lock time = kickoffAtUtc - lockMinutesBeforeMatch.
  // Notify when (lockTime - now) <= NOTIFY_MINUTES_BEFORE_LOCK and lockTime > now.
  // Pull all PROGRAMADO matches with kickoff within the next 60 min as candidates,
  // then per-quiniela compute lockTime using its lockMinutesBeforeMatch.
  const horizon = new Date(now.getTime() + 60 * 60 * 1000)
  const candidates = await prisma.match.findMany({
    where: {
      status: 'PROGRAMADO',
      kickoffAtUtc: { gt: now, lte: horizon },
      prelockNotifiedAt: null,
    },
    include: {
      homeTeam: { select: { name: true, fifaCode: true } },
      awayTeam: { select: { name: true, fifaCode: true } },
      stadium: { select: { name: true, city: true } },
    },
  })

  if (candidates.length === 0) return NextResponse.json({ notified: 0, mailsSent: 0 })

  // For each match, find quinielas that include its event and where lockTime is within window.
  let notifiedMatches = 0
  let mailsSent = 0
  const mailsFailed: string[] = []

  for (const match of candidates) {
    // Find quinielas using this event
    const quinielas = await prisma.quiniela.findMany({
      where: { eventId: match.eventId, status: 'ACTIVE' },
      select: { id: true, name: true, lockMinutesBeforeMatch: true },
    })

    // Determine the *minimum* lockMinutesBefore across quinielas — the soonest lock time.
    // If ANY quiniela's lock is within the next 5 min, we send the notification once for the match
    // (notification is per-match; recipients are union of active members across those quinielas).
    let shouldNotify = false
    const minutesUntilKickoff = (match.kickoffAtUtc.getTime() - now.getTime()) / 60000
    let smallestLockMin = Infinity
    for (const q of quinielas) {
      const minutesUntilLock = minutesUntilKickoff - q.lockMinutesBeforeMatch
      if (minutesUntilLock <= NOTIFY_MINUTES_BEFORE_LOCK && minutesUntilLock > 0) {
        shouldNotify = true
      }
      if (q.lockMinutesBeforeMatch < smallestLockMin) smallestLockMin = q.lockMinutesBeforeMatch
    }
    if (!shouldNotify) continue

    // Recipients: ACTIVE members of any of those quinielas, with email
    const quinielaIds = quinielas.map((q) => q.id)
    const members = await prisma.quinielaMember.findMany({
      where: { quinielaId: { in: quinielaIds }, status: 'ACTIVE', role: 'PARTICIPANT' },
      include: { user: { select: { id: true, email: true, name: true } } },
    })

    // De-duplicate by email
    const byEmail = new Map<string, { name: string | null; quinielaNames: Set<string> }>()
    const quinielaName = new Map(quinielas.map((q) => [q.id, q.name]))
    for (const m of members) {
      const slot = byEmail.get(m.user.email) ?? { name: m.user.name, quinielaNames: new Set<string>() }
      const qn = quinielaName.get(m.quinielaId)
      if (qn) slot.quinielaNames.add(qn)
      byEmail.set(m.user.email, slot)
    }

    const homeLabel = match.homeTeam?.name ?? match.placeholderHomeName ?? '?'
    const awayLabel = match.awayTeam?.name ?? match.placeholderAwayName ?? '?'
    const venue = match.stadium ? `${match.stadium.name}, ${match.stadium.city}` : ''
    const kickoffCR = new Intl.DateTimeFormat('es-CR', {
      timeZone: 'America/Costa_Rica',
      weekday: 'long', day: '2-digit', month: 'long',
      hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(match.kickoffAtUtc)

    for (const [email, info] of byEmail) {
      const greeting = info.name ? `Hola ${info.name},` : 'Hola,'
      const quinielasText = Array.from(info.quinielaNames).join(', ')
      const subject = `⏰ ${homeLabel} vs ${awayLabel} se bloquea en ${NOTIFY_MINUTES_BEFORE_LOCK} min`
      const text =
        `${greeting}\n\n` +
        `El partido ${homeLabel} vs ${awayLabel} está por iniciar.\n` +
        `Inicio: ${kickoffCR} (Costa Rica)${venue ? `\nSede: ${venue}` : ''}\n\n` +
        `El bloqueo de marcadores ocurre ${smallestLockMin} minutos antes del inicio. ` +
        `Te quedan aproximadamente ${NOTIFY_MINUTES_BEFORE_LOCK} minutos para registrar o ajustar tu pronóstico.\n\n` +
        `Quinielas: ${quinielasText}\n\n` +
        `— Ki-Niela`
      const html =
        `<p>${greeting}</p>` +
        `<p>El partido <strong>${homeLabel} vs ${awayLabel}</strong> está por iniciar.</p>` +
        `<ul>` +
        `<li><strong>Inicio:</strong> ${kickoffCR} (Costa Rica)</li>` +
        (venue ? `<li><strong>Sede:</strong> ${venue}</li>` : '') +
        `<li><strong>Bloqueo:</strong> ${smallestLockMin} min antes del inicio</li>` +
        `</ul>` +
        `<p>Te quedan aproximadamente <strong>${NOTIFY_MINUTES_BEFORE_LOCK} minutos</strong> para registrar o ajustar tu pronóstico.</p>` +
        `<p>Quinielas: ${quinielasText}</p>` +
        `<p>— Ki-Niela</p>`

      const r = await sendMail({ to: email, subject, html, text })
      if (r.ok) mailsSent++
      else mailsFailed.push(`${email}: ${r.reason}`)
    }

    // Mark match as notified so we never double-send
    await prisma.match.update({
      where: { id: match.id },
      data: { prelockNotifiedAt: new Date() },
    })
    notifiedMatches++
  }

  return NextResponse.json({
    notifiedMatches,
    mailsSent,
    mailsFailed: mailsFailed.slice(0, 20),
  })
}
