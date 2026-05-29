'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import AppShell from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, ShieldOff, UserCheck, UserX, Trophy } from 'lucide-react'
import { BallLoader } from '@/components/ui/BallLoader'
import { Switch } from '@/components/ui/switch'

type AdminUser = {
  id: string
  name: string
  email: string
  globalRole: 'SUPER_ADMIN' | 'USER'
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
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
    const newStatus = enable ? 'ACTIVE' : 'ARCHIVED'
    const res = await fetch(`/api/admin/quinielas/${q.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (!res.ok) {
      const info = await res.json().catch(() => null)
      toast.error(info?.error ?? 'Error al actualizar quiniela.')
      return
    }
    toast.success(enable ? `${q.name} habilitada.` : `${q.name} archivada.`)
    await loadQuinielas()
  }

  async function patchUser(userId: string, body: Record<string, unknown>, successMsg: string) {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const info = await res.json().catch(() => null)
      toast.error(info?.error ?? 'Error al actualizar usuario.')
      return
    }
    toast.success(successMsg)
    await loadUsers()
  }

  if (!session || session.user.globalRole !== 'SUPER_ADMIN') {
    return null
  }

  const filtered = users?.filter((u) => {
    if (filter === 'PENDING') return u.status === 'INACTIVE'
    if (filter === 'ACTIVE') return u.status === 'ACTIVE'
    return true
  })

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

        <div className="flex flex-wrap gap-2">
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
                  <th className="text-left px-4 py-3">Registrado</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} className="px-4 py-6"><BallLoader label="Cargando…" /></td></tr>
                )}
                {!loading && filtered?.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Sin usuarios.</td></tr>
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
