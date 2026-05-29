'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) {
      toast.error('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al registrar.')
        return
      }
      toast.success('Cuenta creada. Un administrador debe activarte antes de poder ingresar.', { duration: 6000 })
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-pitch flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -left-20 -top-20 w-72 h-72 rounded-full bg-yellow-400/20 blur-3xl pointer-events-none" />
      <div className="absolute -right-24 -bottom-24 w-80 h-80 rounded-full bg-emerald-400/25 blur-3xl pointer-events-none" />
      <div className="absolute left-1/2 top-1/3 -translate-x-1/2 w-96 h-96 rounded-full bg-blue-400/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        <div className="card-pitch rounded-2xl px-6 py-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/ki-niela-icon.png"
            alt="Ki-Niela"
            className="w-24 h-24 object-contain mx-auto mb-2 drop-shadow-[0_4px_10px_rgba(8,51,68,0.20)]"
          />
          <h1 className="text-4xl font-black text-blue-950 tracking-tight">Ki-Niela</h1>
          <p className="mt-1 text-emerald-700 text-sm font-semibold uppercase tracking-widest">
            Únete al juego
          </p>
        </div>

        <div className="card-pitch rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-950 to-emerald-800 px-6 py-4 text-white">
            <h2 className="text-xl font-black">Crear cuenta</h2>
            <p className="text-xs text-blue-100 mt-0.5">Completa el formulario para registrarte</p>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-blue-950 font-bold uppercase text-[11px] tracking-wide">Nombre completo</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  minLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-blue-950 font-bold uppercase text-[11px] tracking-wide">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-blue-950 font-bold uppercase text-[11px] tracking-wide">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-blue-950 font-bold uppercase text-[11px] tracking-wide">Confirmar contraseña</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={form.confirm}
                  onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-950 hover:bg-blue-900 text-white font-bold uppercase tracking-wide shadow-md hover:shadow-lg transition-all"
                disabled={loading}
              >
                {loading ? 'Registrando...' : '⚽ Crear cuenta'}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-gray-600 border-t border-emerald-100 pt-4">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-blue-900 hover:text-blue-700 hover:underline font-bold">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
