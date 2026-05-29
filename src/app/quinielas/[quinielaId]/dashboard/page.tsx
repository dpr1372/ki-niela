import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Star, Trophy, BarChart2, Calendar, Users } from 'lucide-react'
import { WorldCupHero } from '@/components/ui/WorldCupHero'
import { formatCostaRica } from '@/lib/timezone'
import { flagUrl } from '@/lib/flags'
import { MyAutoPredictionsToggle } from '@/components/MyAutoPredictionsToggle'

function FlagPill({ fifaCode, name }: { fifaCode?: string | null; name: string }) {
  const url = flagUrl(fifaCode)
  return (
    <span className="inline-flex items-center gap-1.5">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="w-5 h-3.5 object-cover rounded-sm border border-gray-200 shadow-sm" />
      ) : (
        <span className="w-5 h-3.5 rounded-sm bg-gray-200 inline-block" />
      )}
      <span>{name}</span>
    </span>
  )
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ quinielaId: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { quinielaId } = await params

  const member = await prisma.quinielaMember.findUnique({
    where: { quinielaId_userId: { quinielaId, userId: session.user.id } },
  })

  if (!member) redirect('/quinielas')
  if (member.status !== 'ACTIVE') {
    return (
      <AppShell quinielaId={quinielaId}>
        <div className="text-center py-20">
          <p className="text-amber-700 bg-amber-50 rounded-lg px-6 py-4 inline-block">
            Tu usuario está pendiente de activación por el administrador.
          </p>
          <div className="mt-4">
            <Link href="/quinielas" className={cn(buttonVariants({ variant: 'outline' }))}>Volver a mis quinielas</Link>
          </div>
        </div>
      </AppShell>
    )
  }

  const [quiniela, upcomingMatches, starMatches, totalScore, position] = await Promise.all([
    prisma.quiniela.findUnique({
      where: { id: quinielaId },
      include: { event: true },
    }),
    prisma.match.findMany({
      where: {
        eventId: (
          await prisma.quiniela.findUnique({ where: { id: quinielaId }, select: { eventId: true } })
        )!.eventId,
        status: { in: ['PROGRAMADO', 'BLOQUEADO'] },
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        matchday: true,
      },
      orderBy: { kickoffAtUtc: 'asc' },
      take: 5,
    }),
    prisma.quinielaStarMatch.findMany({
      where: { quinielaId, isStar: true },
      include: {
        match: {
          include: { homeTeam: true, awayTeam: true },
        },
      },
      take: 5,
    }),
    prisma.score.aggregate({
      where: { quinielaId, userId: session.user.id },
      _sum: { points: true },
    }),
    // Mirror the /leaderboard endpoint: rank only ACTIVE members, exclude
    // SUPER_ADMIN globals (they are not competitors), and include every active
    // member (even those with zero scored matches) so the user's position
    // reflects what they'll see on the Posiciones page.
    (async () => {
      const activeMembers = await prisma.quinielaMember.findMany({
        where: {
          quinielaId,
          status: 'ACTIVE',
          user: { globalRole: { not: 'SUPER_ADMIN' } },
        },
        select: { userId: true },
      })
      const activeUserIds = activeMembers.map((m) => m.userId)
      if (!activeUserIds.includes(session.user.id)) return null
      const rows = await prisma.score.groupBy({
        by: ['userId'],
        where: { quinielaId, userId: { in: activeUserIds } },
        _sum: { points: true },
        orderBy: { _sum: { points: 'desc' } },
      })
      // Members with zero scored matches don't appear in the groupBy result —
      // append them so the user always shows up if they're ACTIVE.
      const seen = new Set(rows.map((r) => r.userId))
      const tailUsers = activeUserIds.filter((id) => !seen.has(id))
      const ranked = [
        ...rows.map((r) => ({ userId: r.userId, points: r._sum.points ?? 0 })),
        ...tailUsers.map((id) => ({ userId: id, points: 0 })),
      ]
      const idx = ranked.findIndex((r) => r.userId === session.user.id)
      return idx === -1 ? null : idx + 1
    })(),
  ])

  if (!quiniela) redirect('/quinielas')

  return (
    <AppShell quinielaId={quinielaId} quinielaName={quiniela.name}>
      <div className="space-y-6">
        <WorldCupHero
          eventLabel={quiniela.event.name}
          title={quiniela.name}
        />

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="card-pitch rounded-xl p-4 text-center relative overflow-hidden">
            <Trophy size={64} className="absolute -right-3 -bottom-3 text-yellow-400/15" />
            <p className="text-4xl font-black text-blue-900 tabular-nums">{totalScore._sum.points ?? 0}</p>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mt-1">Puntos totales</p>
          </div>
          <div className="card-pitch rounded-xl p-4 text-center relative overflow-hidden">
            <BarChart2 size={64} className="absolute -right-3 -bottom-3 text-emerald-400/15" />
            <p className="text-4xl font-black text-emerald-700 tabular-nums">{position ?? '-'}</p>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mt-1">Posición</p>
          </div>
          <div className="card-pitch rounded-xl p-4 text-center col-span-2 sm:col-span-1 relative overflow-hidden">
            <Users size={64} className="absolute -right-3 -bottom-3 text-blue-400/15" />
            <p className="text-2xl font-black text-blue-900">
              {member.role === 'QUINIELA_ADMIN' ? '★ Admin' : 'Jugador'}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mt-1">Rol</p>
          </div>
        </div>

        {/* Quick access */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: `/quinielas/${quinielaId}/pronosticos`, label: 'Pronósticos', icon: BarChart2, color: 'from-blue-700 to-blue-900' },
            { href: `/quinielas/${quinielaId}/en-vivo`, label: 'En Vivo', icon: Star, color: 'from-red-600 to-red-800' },
            { href: `/quinielas/${quinielaId}/posiciones`, label: 'Posiciones', icon: Trophy, color: 'from-yellow-500 to-amber-600' },
            { href: `/quinielas/${quinielaId}/juegos`, label: 'Juegos', icon: Calendar, color: 'from-emerald-600 to-emerald-800' },
          ].map(({ href, label, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className={`bg-gradient-to-br ${color} text-white rounded-xl h-20 flex flex-col items-center justify-center gap-1 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all`}
            >
              <Icon size={22} />
              <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
            </Link>
          ))}
        </div>

        {/* Mis predicciones automáticas */}
        <MyAutoPredictionsToggle
          quinielaId={quinielaId}
          initialEnabled={member.autoPredictionsEnabled}
          randomPredictionsEnabled={quiniela.randomPredictionsEnabled}
          randomMinGoals={quiniela.randomMinGoals}
          randomMaxGoals={quiniela.randomMaxGoals}
        />

        {/* Upcoming matches */}
        {upcomingMatches.length > 0 && (
          <div>
            <h2 className="section-header text-base font-bold text-gray-800 mb-3 uppercase tracking-wide">Próximos partidos</h2>
            <div className="space-y-2">
              {upcomingMatches.map((m) => {
                const isStar = starMatches.some((s) => s.matchId === m.id)
                return (
                  <div key={m.id} className="card-pitch card-pitch-hover rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold flex items-center gap-1.5 flex-wrap">
                        {isStar && <Star size={14} className="text-yellow-500 fill-yellow-400" />}
                        <FlagPill fifaCode={m.homeTeam?.fifaCode} name={m.homeTeam?.name ?? m.placeholderHomeName ?? '?'} />
                        <span className="text-gray-400 font-normal">vs</span>
                        <FlagPill fifaCode={m.awayTeam?.fifaCode} name={m.awayTeam?.name ?? m.placeholderAwayName ?? '?'} />
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {formatCostaRica(m.kickoffAtUtc, 'dd/MM/yyyy HH:mm')} CR
                        {m.matchday ? ` · ${m.matchday.name}` : ''}
                      </p>
                    </div>
                    <Badge variant={m.status === 'BLOQUEADO' ? 'destructive' : 'outline'}>
                      {m.status}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
