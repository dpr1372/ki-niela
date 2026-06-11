'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import AppShell from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { BallLoader } from '@/components/ui/BallLoader'
import { Search } from 'lucide-react'

type Member = {
  id: string
  status: string
  role: string
  autoPredictionsEnabled: boolean
  isVirtual?: boolean
  user: { id: string; name: string; email: string }
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo en quiniela',
  PENDING_APPROVAL: 'Pendiente en quiniela',
  INACTIVE: 'Inactivo en quiniela',
  INVITED: 'Invitado a quiniela',
  REJECTED: 'Rechazado en quiniela',
  NOT_MEMBER: 'No miembro de quiniela',
}

const STATUS_HELP: Record<string, string> = {
  PENDING_APPROVAL: 'Solicitó unirse — actívalo para que pueda participar.',
  INVITED: 'Invitado — actívalo para que aparezca en la tabla.',
  INACTIVE: 'Estuvo activo y fue desactivado.',
  REJECTED: 'Su solicitud fue rechazada.',
  NOT_MEMBER: 'Cuenta global activa pero aún no participa en esta quiniela.',
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800',
  INACTIVE: 'bg-gray-100 text-gray-700',
  INVITED: 'bg-blue-100 text-blue-800',
  REJECTED: 'bg-red-100 text-red-700',
  NOT_MEMBER: 'bg-slate-100 text-slate-600 border border-dashed border-slate-300',
}

export default function ParticipantesPage() {
  const params = useParams<{ quinielaId: string }>()
  const quinielaId = params.quinielaId
  const [members, setMembers] = useState<Member[]>([])
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  async function loadMembers() {
    const res = await fetch(`/api/quinielas/${quinielaId}/members?includeAllUsers=true`)
    if (res.ok) {
      const data = await res.json()
      setMembers(data)
      const meRes = await fetch('/api/auth/session')
      const session = await meRes.json().catch(() => null)
      const myUserId = session?.user?.id
      const me = data.find((m: Member) => m.user.id === myUserId)
      // El SUPER_ADMIN administra cualquier quiniela, sea o no miembro y aunque
      // su membresía sea PARTICIPANT → siempre lo tratamos como admin local.
      if (session?.user?.globalRole === 'SUPER_ADMIN') setCurrentUserRole('QUINIELA_ADMIN')
      else if (me) setCurrentUserRole(me.role)
    }
    setLoading(false)
  }

  useEffect(() => { loadMembers() }, [quinielaId])

  async function patchMember(memberId: string, body: object, successMsg: string) {
    const res = await fetch(`/api/quinielas/${quinielaId}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Error al actualizar.')
      return
    }
    toast.success(successMsg)
    await loadMembers()
  }

  async function addUserToQuiniela(userId: string, status: 'ACTIVE' | 'INVITED', successMsg: string) {
    const res = await fetch(`/api/quinielas/${quinielaId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, status }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Error al agregar usuario.')
      return
    }
    toast.success(successMsg)
    await loadMembers()
  }

  const isAdmin = currentUserRole === 'QUINIELA_ADMIN'

  const q = search.trim().toLowerCase()
  const filteredMembers = q
    ? members.filter(
        (m) =>
          m.user.name.toLowerCase().includes(q) || m.user.email.toLowerCase().includes(q),
      )
    : members

  if (loading) return <AppShell quinielaId={quinielaId}><BallLoader label="Cargando…" /></AppShell>

  if (!isAdmin) {
    return (
      <AppShell quinielaId={quinielaId}>
        <p className="text-sm text-red-600">No tienes permiso para acceder a esta sección.</p>
      </AppShell>
    )
  }

  return (
    <AppShell quinielaId={quinielaId}>
      <div className="space-y-4">
        <h1 className="text-3xl font-black text-pitch-dark">👥 Participantes</h1>
        <p className="text-sm text-gray-600">
          Lista de todos los usuarios globales activos. El estado mostrado aquí es <b>el estado dentro de esta quiniela</b>,
          no el estado global de la cuenta. Un usuario puede estar activo globalmente pero pendiente o no miembro en una quiniela específica.
        </p>

        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar nombre o correo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>

        {q && (
          <p className="text-xs text-gray-500">
            {filteredMembers.length} de {members.length} participantes
          </p>
        )}

        <div className="space-y-3">
          {filteredMembers.length === 0 && (
            <p className="text-sm text-gray-500">No hay participantes que coincidan con la búsqueda.</p>
          )}
          {filteredMembers.map((m) => (
            <Card key={m.id}>
              <CardContent className="pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{m.user.name}</p>
                    <p className="text-xs text-gray-500">{m.user.email}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE_CLASS[m.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABELS[m.status] ?? m.status}
                      </span>
                      {m.status !== 'NOT_MEMBER' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                          {m.role === 'QUINIELA_ADMIN' ? 'Admin' : 'Participante'}
                        </span>
                      )}
                      {m.autoPredictionsEnabled && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          Auto-pred.
                        </span>
                      )}
                    </div>
                    {STATUS_HELP[m.status] && (
                      <p className="text-xs text-gray-500 mt-1">{STATUS_HELP[m.status]}</p>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {m.status === 'NOT_MEMBER' && (
                      <Button
                        size="sm"
                        className="bg-emerald-700 hover:bg-emerald-800 text-white"
                        onClick={() => addUserToQuiniela(m.user.id, 'ACTIVE', 'Usuario activado en la quiniela.')}
                      >
                        Activar en quiniela
                      </Button>
                    )}
                    {m.status === 'PENDING_APPROVAL' && (
                      <Button
                        size="sm"
                        onClick={() => patchMember(m.id, { action: 'activate' }, 'Usuario activado.')}
                      >
                        Activar
                      </Button>
                    )}
                    {m.status === 'INVITED' && (
                      <Button
                        size="sm"
                        onClick={() => patchMember(m.id, { action: 'activate' }, 'Usuario activado.')}
                      >
                        Activar
                      </Button>
                    )}
                    {m.status === 'ACTIVE' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => patchMember(m.id, { action: 'deactivate' }, 'Usuario desactivado.')}
                      >
                        Desactivar
                      </Button>
                    )}
                    {m.status === 'INACTIVE' && (
                      <Button
                        size="sm"
                        onClick={() => patchMember(m.id, { action: 'activate' }, 'Usuario activado.')}
                      >
                        Reactivar
                      </Button>
                    )}
                    {m.status === 'PENDING_APPROVAL' && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => patchMember(m.id, { action: 'reject' }, 'Usuario rechazado.')}
                      >
                        Rechazar
                      </Button>
                    )}
                    {m.status !== 'NOT_MEMBER' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          patchMember(
                            m.id,
                            { role: m.role === 'QUINIELA_ADMIN' ? 'PARTICIPANT' : 'QUINIELA_ADMIN' },
                            'Rol actualizado.',
                          )
                        }
                      >
                        {m.role === 'QUINIELA_ADMIN' ? 'Quitar admin' : 'Hacer admin'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
