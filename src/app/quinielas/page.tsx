import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import CrearQuinielaButton from '@/components/CrearQuinielaButton'
import JoinByCodeButton from '@/components/JoinByCodeButton'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Trophy, Users } from 'lucide-react'
import { WorldCupHero } from '@/components/ui/WorldCupHero'

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  PENDING_APPROVAL: 'Pendiente',
  INACTIVE: 'Inactivo',
  INVITED: 'Invitado',
  REJECTED: 'Rechazado',
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
  INACTIVE: 'bg-gray-100 text-gray-600',
  INVITED: 'bg-blue-100 text-blue-800',
  REJECTED: 'bg-red-100 text-red-700',
}

export default async function MisQuinielasPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const isSuperAdmin = session.user.globalRole === 'SUPER_ADMIN'

  const memberships = await prisma.quinielaMember.findMany({
    where: {
      userId: session.user.id,
      // Hide archived quinielas from regular users; super admins still see everything
      ...(isSuperAdmin ? {} : { quiniela: { status: { not: 'ARCHIVED' } } }),
    },
    include: {
      quiniela: {
        include: {
          event: { select: { id: true, name: true, sport: true } },
          _count: { select: { members: { where: { status: 'ACTIVE', role: 'PARTICIPANT' } } } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  })

  const events = await prisma.event.findMany({
    where: { status: { not: 'ARCHIVED' } },
    select: { id: true, name: true },
    orderBy: { startDate: 'asc' },
  })

  // Group memberships by event
  const byEvent = new Map<string, typeof memberships>()
  for (const m of memberships) {
    const key = m.quiniela.eventId
    if (!byEvent.has(key)) byEvent.set(key, [])
    byEvent.get(key)!.push(m)
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <WorldCupHero
          eventLabel="FIFA World Cup 2026 · MEX · USA · CAN"
          title="Mis Quinielas"
          subtitle="Compite, predice y celebra cada gol del mundial."
          rightSlot={
            isSuperAdmin ? (
              <CrearQuinielaButton events={events} />
            ) : (
              <JoinByCodeButton />
            )
          }
        />

        {memberships.length === 0 ? (
          <div className="card-pitch rounded-2xl text-center py-20 text-gray-500">
            <Trophy size={56} className="mx-auto mb-4 text-yellow-400/40" />
            <p className="text-lg font-bold text-gray-700">Aún no participas en ninguna quiniela.</p>
            {isSuperAdmin ? (
              <p className="text-sm mt-1">
                Crea una quiniela con el botón de arriba para comenzar.
              </p>
            ) : (
              <>
                <p className="text-sm mt-1 mb-5">
                  Ingresa un código de invitación para unirte, o pídele al administrador que te agregue.
                </p>
                <div className="flex justify-center">
                  <JoinByCodeButton />
                </div>
              </>
            )}
          </div>
        ) : (
          <>
          {Array.from(byEvent.entries()).map(([, eventMemberships]) => {
            const event = eventMemberships[0].quiniela.event
            return (
              <div key={event.id}>
                <h2 className="section-header text-base font-bold text-gray-800 uppercase tracking-wide mb-3">{event.name}</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {eventMemberships.map((m) => (
                    <div key={m.id} className="card-pitch card-pitch-hover rounded-xl overflow-hidden flex flex-col">
                      <div className="bg-gradient-to-r from-blue-950 to-emerald-800 px-4 py-3 text-white">
                        <p className="text-base font-black truncate">{m.quiniela.name}</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${STATUS_COLORS[m.status] ?? ''}`}
                          >
                            {STATUS_LABELS[m.status] ?? m.status}
                          </span>
                          {m.quiniela.status === 'ARCHIVED' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-400 text-white font-bold uppercase tracking-wide">
                              Archivada
                            </span>
                          )}
                          {m.quiniela.status === 'CLOSED' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-600 text-white font-bold uppercase tracking-wide">
                              Cerrada
                            </span>
                          )}
                          {m.role === 'QUINIELA_ADMIN' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-400 text-blue-950 font-bold uppercase tracking-wide">
                              ★ Admin
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="p-4 space-y-3 flex-1 flex flex-col">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Users size={14} className="text-emerald-700" />
                          <span className="font-semibold">{m.quiniela._count.members}</span>
                          <span className="text-gray-500">jugadores activos</span>
                        </div>

                        {m.status !== 'ACTIVE' && (
                          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                            Tu usuario está pendiente de activación.
                          </p>
                        )}

                        <div className="flex gap-2 mt-auto">
                          {m.status === 'ACTIVE' && (
                            <Link href={`/quinielas/${m.quinielaId}/dashboard`} className={cn(buttonVariants({ size: 'sm' }), 'flex-1 justify-center bg-blue-900 hover:bg-blue-800')}>Entrar</Link>
                          )}
                          {m.role === 'QUINIELA_ADMIN' && m.status === 'ACTIVE' && (
                            <Link href={`/quinielas/${m.quinielaId}/configuracion`} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>Config</Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          </>
        )}
      </div>
    </AppShell>
  )
}
