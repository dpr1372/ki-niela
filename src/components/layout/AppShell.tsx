'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Home, Trophy, BarChart2, Settings, LogOut, Menu, X, CalendarDays, Swords, Radio, Users, ShieldCheck, UserCircle, ChevronDown, Link2 } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'

type Props = {
  children: React.ReactNode
  quinielaId?: string
  quinielaName?: string
}

export default function AppShell({ children, quinielaId, quinielaName }: Props) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [quinielaAdminRole, setQuinielaAdminRole] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  const { data: session } = useSession()
  const isSuperAdmin = session?.user?.globalRole === 'SUPER_ADMIN'

  useEffect(() => {
    if (!quinielaId) return
    fetch(`/api/quinielas/${quinielaId}/members`)
      .then(r => r.json())
      .then(members => {
        const current = members.find((m: { role: string; user: { id: string } }) => m.user.id === session?.user?.id)
        setQuinielaAdminRole(current?.role === 'QUINIELA_ADMIN')
      })
      .catch(() => setQuinielaAdminRole(false))
  }, [quinielaId, session?.user?.id])

  const isAdminContext = quinielaAdminRole || isSuperAdmin

  const baseNav = [
    { href: '/quinielas', label: 'Mis Quinielas', icon: Home },
    ...(isSuperAdmin && !quinielaId
      ? [
          { href: '/admin/torneos', label: 'Torneos (Admin)', icon: Trophy },
          { href: '/admin/usuarios', label: 'Usuarios (Admin)', icon: ShieldCheck },
          { href: '/admin/partidos', label: 'Partidos (Admin)', icon: Link2 },
        ]
      : []),
  ]

  const quinielaNaav = quinielaId
    ? [
        { href: `/quinielas/${quinielaId}/dashboard`, label: 'Dashboard', icon: Trophy },
        { href: `/quinielas/${quinielaId}/pronosticos`, label: 'Pronósticos', icon: BarChart2 },
        ...(isAdminContext
          ? [{ href: `/quinielas/${quinielaId}/juegos`, label: 'Juegos', icon: CalendarDays }]
          : []),
        { href: `/quinielas/${quinielaId}/en-vivo`, label: 'En Vivo', icon: Radio },
        { href: `/quinielas/${quinielaId}/posiciones`, label: 'Posiciones', icon: Trophy },
        { href: `/quinielas/${quinielaId}/estadisticas`, label: 'Estadísticas', icon: BarChart2 },
        ...(isSuperAdmin
          ? [{ href: `/quinielas/${quinielaId}/eliminatorias`, label: 'Eliminatorias', icon: Swords }]
          : []),
        ...(isAdminContext
          ? [{ href: `/quinielas/${quinielaId}/participantes`, label: 'Participantes', icon: Users }]
          : []),
        ...(isAdminContext
          ? [{ href: `/quinielas/${quinielaId}/configuracion`, label: 'Config', icon: Settings }]
          : []),
      ]
    : []

  const allNav = [...baseNav, ...quinielaNaav]

  return (
    <div className={`min-h-screen flex flex-col ${quinielaId ? 'bg-pitch-quiniela' : 'bg-pitch'}`}>
      {/* Top bar */}
      <header className="bg-pitch-header sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/quinielas" className="font-black text-xl tracking-tight flex items-center gap-2 text-blue-950">
            <Image
              src="/brand/ki-niela-icon.png"
              alt="Ki-Niela"
              width={40}
              height={40}
              priority
              className="w-10 h-10 object-contain"
            />
            <span>Ki-Niela</span>
          </Link>
          {quinielaName && (
            <span className="text-blue-900/80 text-sm hidden sm:block truncate max-w-[200px] font-semibold">
              {quinielaName}
            </span>
          )}
          <div className="flex items-center gap-3">
            {/* Avatar dropdown (desktop) */}
            {session?.user && (
              <div className="relative hidden sm:block" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 text-xs text-blue-900 hover:bg-blue-100 rounded-lg px-2 py-1 transition-colors"
                >
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-950 text-yellow-300 font-bold text-[11px]">
                    {(session.user.name ?? session.user.email ?? '?').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="font-semibold truncate max-w-[140px]">
                    {session.user.name ?? session.user.email}
                  </span>
                  {isSuperAdmin && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-400 text-blue-950 font-bold uppercase tracking-wide">
                      Admin
                    </span>
                  )}
                  <ChevronDown size={14} className={`transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                </button>
                {profileOpen && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                    <Link
                      href="/perfil"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <UserCircle size={15} />
                      Mi perfil
                    </Link>
                    <hr className="my-1 border-gray-100" />
                    <button
                      onClick={() => signOut({ callbackUrl: '/login' })}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                    >
                      <LogOut size={15} />
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            )}
            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="text-blue-950 hover:bg-blue-100 sm:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menú"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 sm:hidden" onClick={() => setMenuOpen(false)}>
          <nav
            className="absolute right-0 top-0 h-full w-64 bg-white shadow-xl flex flex-col p-6 gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-2">
              <Image
                src="/brand/ki-niela-icon.png"
                alt="Ki-Niela"
                width={32}
                height={32}
                className="w-8 h-8 object-contain"
              />
              <p className="font-bold text-lg text-blue-900">Ki-Niela</p>
            </div>
            {allNav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                  pathname.startsWith(href) ? 'bg-blue-100 text-blue-900' : 'text-gray-700 hover:bg-gray-100'
                }`}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
            <Link
              href="/perfil"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 text-sm font-medium px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 mt-auto"
            >
              <UserCircle size={18} />
              Mi perfil
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-3 text-sm font-medium px-3 py-2 rounded-lg text-red-600 hover:bg-red-50"
            >
              <LogOut size={18} />
              Cerrar sesión
            </button>
          </nav>
        </div>
      )}

      <div className="flex flex-1 max-w-6xl mx-auto w-full">
        {/* Sidebar desktop */}
        <aside className="hidden sm:flex flex-col w-56 border-r border-teal-200/40 bg-white/85 backdrop-blur-sm py-6 px-3 gap-1 shrink-0">
          {allNav.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 text-sm font-semibold px-3 py-2 rounded-lg transition-all ${
                  active
                    ? 'bg-gradient-to-r from-[#083344] to-[#0e6e7d] text-white shadow-sm'
                    : 'text-gray-700 hover:bg-teal-50 hover:text-pitch-dark'
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            )
          })}
        </aside>

        {/*
          pb extra en móvil para librar el bottom nav fijo (sm:hidden, ~64px)
          y la safe-area inferior de iOS. Sin esto, la última parte del
          contenido queda "cortada" detrás del nav. Solo cuando hay bottom nav
          (quinielaId set); en desktop (sm+) el nav no existe → padding normal.
        */}
        <main
          className={`flex-1 p-4 sm:p-6 overflow-auto ${
            quinielaId ? 'pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-6' : ''
          }`}
        >
          {children}
        </main>
      </div>

      {/* Bottom nav mobile */}
      {quinielaId && (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-teal-200/50 flex justify-around z-40 shadow-[0_-2px_12px_rgba(8,51,68,0.10)] pb-[env(safe-area-inset-bottom)]">
          {quinielaNaav.slice(0, 5).map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 py-2 px-2 text-[10px] font-bold flex-1 ${
                  active ? 'text-pitch-dark' : 'text-gray-500'
                }`}
              >
                <Icon size={20} className={active ? 'text-yellow-500' : ''} />
                {label}
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}
