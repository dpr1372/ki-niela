'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import AppShell from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, ShieldOff, UserCheck, UserX, Trophy, Search } from 'lucide-react'
import { BallLoader } from '@/components/ui/BallLoader'
import { Switch } from '@/components/ui/switch'

type Membership = {
  quinielaId: string
  quinielaName: string
  quinielaStatus: 'ACTIVE' | 'CLOSED' | 'ARCHIVED'
  memberStatus: 'INVITED' | 'PENDING_APPROVAL' | 'ACTIVE' | 'INACTIVE' | 'REJECTED'
  memberRole: 'QUINIELA_ADMIN' | 'PARTICIPANT'
}

type AdminUser = {
  id: string
  name: string
  email: string
  globalRole: 'SUPER_ADMIN' | 'USER'
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  memberships: Membership[]
}

const MEMBER_STATUS_LABEL: Record<Membership['memberStatus'], string> = {
  INVITED: 'Invitado',
  PENDING_APPROVAL: 'Pendiente',
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  REJECTED: 'Rechazado',
}

const MEMBER_STATUS_COLOR: Record<Membership['memberStatus'], string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800 border-amber-200',
  INVITED: 'bg-blue-100 text-blue-800 border-blue-200',
  INACTIVE: 'bg-gray-100 text-gray-600 border-gray-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
}

type AdminQuiniela = {
  id: string
  name: string
  status: 'ACTIVE' | 'CLOSED' | 'ARCHIVED'
  inviteCode: string | null
  event: { id: string; name: string }
  _count: { members: number }
}

const STATUS_LABEL: Record<AdminUser['status'], string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
}

const STATUS_COLOR: Record<AdminUser['status'], string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  INACTIVE: 'bg-gray-100 text-gray-700 border-gray-200',
}

export default function AdminUsuariosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [quinielas, setQuinielas] = useState<AdminQuiniela[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'ACTIVE'>('ALL')
  const [nameFilter, setNameFilter] = useState<string>('')
  // Filtro por quiniela: 'ALL' = todas; o un quinielaId concreto.
  const [quinielaFilter, setQuinielaFilter] = useState<string>('ALL')

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    if (session.user.globalRole !== 'SUPER_ADMIN') {
      router.push('/quinielas')
      return
    }
    void loadUsers()
    void loadQuinielas()
  }, [session, status, router])

  async function loadUsers() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('Error al cargar usuarios')
      setUsers(await res.json())
    } catch (e) {
      toast.error('No se pudo cargar la lista de usuarios.')
    } finally {
      setLoading(false)
    }
  }

  async function loadQuinielas() {
    try {
      const res = await fetch('/api/admin/quinielas')
      if (!res.ok) throw new Error('Error')
      setQuinielas(await res.json())
    } catch {
      toast.error('No se pudo cargar la lista de quinielas.')
    }
  }

  async function toggleQuinielaStatus(q: AdminQuiniela, enable: boolean) {
    const newStatus: AdminQuiniela['status'] = enable ? 'ACTIVE' : 'ARCHIVED'
    const prevQuinielas = quinielas
    setQuinielas((curr) => curr?.map((x) => (x.id === q.id ? { ...x, status: newStatus } : x)) ?? null)
    toast.success(enable ? `${q.name} habilitada.` : `${q.name} archivada.`)

    try {
      const res = await fetch(`/api/admin/quinielas/${q.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const info = await res.json().catch(() => null)
        toast.error(info?.error ?? 'Error al actualizar quiniela.')
        setQuinielas(prevQuinielas)
        return
      }
    } catch {
      toast.error('Error de red.')
      setQuinielas(prevQuinielas)
    }
  }

  async function patchUser(userId: string, body: Record<string, unknown>, successMsg: string) {
    // Optimistic update + immediate toast. The fetch is fired in parallel
    // and only matters for rollback if it fails. UX feels instant regardless
    // of Railway/SMTP latency.
    const prevUsers = users
    setUsers((curr) =>
      curr?.map((u) => {
        if (u.id !== userId) return u
        if (body.action === 'activate') return { ...u, status: 'ACTIVE' as const }
        if (body.action === 'deactivate') return { ...u, status: 'INACTIVE' as const }
        if (body.action === 'make_admin') return { ...u, globalRole: 'SUPER_ADMIN' as const }
        if (body.action === 'remove_admin') return { ...u, globalRole: 'USER' as const }
        return u
      }) ?? null,
    )
    toast.success(successMsg)

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const info = await res.json().catch(() => null)
        toast.error(info?.error ?? 'Error al actualizar usuario.')
        // Rollback to the snapshot taken before the optimistic mutation.
        setUsers(prevUsers)
        return
      }
      // Background refresh so the row picks up any server-side derived
      // fields (updatedAt, etc) without spinning a loader.
      void (async () => {
        const fresh = await fetch('/api/admin/users')
        if (fresh.ok) setUsers(await fresh.json())
      })()
    } catch {
      toast.error('Error de red.')
      setUsers(prevUsers)
    }
  }

  if (!session || session.user.globalRole !== 'SUPER_ADMIN') {
    return null
  }

  const nameQ = nameFilter.trim().toLowerCase()
  const filtered = users?.filter((u) => {
    // Filtro de estado global de la cuenta.
    if (filter === 'PENDING' && u.status !== 'INACTIVE') return false
    if (filter === 'ACTIVE' && u.status !== 'ACTIVE') return false
    // Filtro por quiniela:
    // - 'ALL'  → todos
    // - 'NONE' → solo usuarios sin ninguna membresía (no están en quiniela alguna)
    // - <id>   → solo miembros de esa quiniela
    if (quinielaFilter === 'NONE') {
      if (u.memberships.length > 0) return false
    } else if (quinielaFilter !== 'ALL' && !u.memberships.some((m) => m.quinielaId === quinielaFilter)) {
      return false
    }
    // Filtro por nombre o correo.
    if (nameQ && !u.name.toLowerCase().includes(nameQ) && !u.email.toLowerCase().includes(nameQ)) {
      return false
    }
    return true
  })

  // Para la columna y el filtro, decide qué membresías mostrar: si hay filtro
  // por quiniela, resalta esa; si no, todas.
  const membershipsToShow = (u: AdminUser) =>
    quinielaFilter === 'ALL'
      ? u.memberships
      : u.memberships.filter((m) => m.quinielaId === quinielaFilter)

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black text-pitch-dark flex items-center gap-2">
            <ShieldCheck className="text-emerald-700" size={28} />
            Administración de Usuarios
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Activa o desactiva cuentas globales y administra roles. Todo nuevo registro queda inactivo hasta que lo apruebes aquí.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'ALL', label: 'Todos' },
            { key: 'PENDING', label: 'Pendientes' },
            { key: 'ACTIVE', label: 'Activos' },
          ].map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? 'default' : 'outline'}
              onClick={() => setFilter(f.key as typeof filter)}
            >
              {f.label}
            </Button>
          ))}

          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar nombre o correo…"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white outline-none focus:border-emerald-500 w-52"
            />
          </div>

          {/* Filtro por quiniela: ver quién está unido a cada quiniela */}
          {quinielas && quinielas.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <label htmlFor="quinielaFilter" className="text-xs font-semibold text-gray-600">
                Quiniela:
              </label>
              <select
                id="quinielaFilter"
                value={quinielaFilter}
                onChange={(e) => setQuinielaFilter(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 outline-none focus:border-emerald-500"
              >
                <option value="ALL">Todas las quinielas</option>
                <option value="NONE">Sin quiniela (ninguna)</option>
                {quinielas.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name} {q.status !== 'ACTIVE' ? '(archivada)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ── Sección Quinielas ─────────────────────────────────────────────── */}
        <div className="card-pitch rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-xl font-black text-pitch-dark flex items-center gap-2">
              <Trophy className="text-amber-500" size={22} />
              Visibilidad de Quinielas
            </h2>
            <p className="text-xs text-gray-600 mt-1">
              Habilita o archiva quinielas. Las archivadas no aparecen para los usuarios y no pueden recibir nuevas solicitudes.
            </p>
          </div>
          <div className="space-y-2">
            {quinielas === null && <BallLoader label="Cargando quinielas…" />}
            {quinielas?.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No hay quinielas creadas.</p>
            )}
            {quinielas?.map((q) => {
              const enabled = q.status === 'ACTIVE'
              return (
                <div
                  key={q.id}
                  className={`flex items-center justify-between gap-3 rounded-lg border p-3 transition ${
                    enabled
                      ? 'bg-white border-emerald-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold text-sm ${enabled ? 'text-gray-900' : 'text-gray-500'} truncate`}>
                      {q.name}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {q.event.name} · {q._count.members} miembros{q.inviteCode ? ` · ${q.inviteCode}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {enabled ? 'Habilitada' : q.status === 'ARCHIVED' ? 'Archivada' : 'Cerrada'}
                    </span>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(v) => toggleQuinielaStatus(q, v)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Sección Usuarios ──────────────────────────────────────────────── */}
        <div className="card-pitch rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-blue-950 to-emerald-800 text-white text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Nombre</th>
                  <th className="text-left px-4 py-3">Correo</th>
                  <th className="text-left px-4 py-3">Rol Global</th>
                  <th className="text-left px-4 py-3">Estado</th>
                  <th className="text-left px-4 py-3">Quinielas</th>
                  <th className="text-left px-4 py-3">Registrado</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={7} className="px-4 py-6"><BallLoader label="Cargando…" /></td></tr>
                )}
                {!loading && filtered?.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">Sin usuarios.</td></tr>
                )}
                {filtered?.map((u) => (
                  <tr key={u.id} className="border-t border-gray-100 hover:bg-emerald-50/40">
                    <td className="px-4 py-3 font-semibold text-gray-800">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={u.globalRole === 'SUPER_ADMIN' ? 'default' : 'outline'}>
                        {u.globalRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Usuario'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full border ${STATUS_COLOR[u.status]}`}>
                        {STATUS_LABEL[u.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {membershipsToShow(u).length === 0 ? (
                        <span className="text-xs text-gray-400 italic">Ninguna</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {membershipsToShow(u).map((m) => (
                            <span
                              key={m.quinielaId}
                              className="inline-flex items-center gap-1.5 text-xs"
                              title={`${m.quinielaName} · ${MEMBER_STATUS_LABEL[m.memberStatus]}`}
                            >
                              <span
                                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${MEMBER_STATUS_COLOR[m.memberStatus]}`}
                              >
                                {MEMBER_STATUS_LABEL[m.memberStatus]}
                              </span>
                              <span className={`truncate max-w-[140px] ${m.quinielaStatus !== 'ACTIVE' ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                {m.quinielaName}
                              </span>
                              {m.memberRole === 'QUINIELA_ADMIN' && (
                                <span className="text-[9px] font-bold text-amber-700">★</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(u.createdAt).toLocaleDateString('es-CR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {u.status === 'INACTIVE' ? (
                          <Button
                            size="sm"
                            className="bg-emerald-700 hover:bg-emerald-800 text-white"
                            onClick={() => patchUser(u.id, { action: 'activate' }, 'Usuario activado.')}
                          >
                            <UserCheck size={14} /> Activar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => patchUser(u.id, { action: 'deactivate' }, 'Usuario desactivado.')}
                            disabled={u.id === session.user.id}
                          >
                            <UserX size={14} /> Desactivar
                          </Button>
                        )}
                        {u.globalRole === 'USER' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => patchUser(u.id, { globalRole: 'SUPER_ADMIN' }, 'Rol actualizado.')}
                          >
                            <ShieldCheck size={14} /> Hacer admin
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => patchUser(u.id, { globalRole: 'USER' }, 'Rol actualizado.')}
                            disabled={u.id === session.user.id}
                          >
                            <ShieldOff size={14} /> Quitar admin
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
