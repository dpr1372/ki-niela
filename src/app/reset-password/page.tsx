'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // Sin token en la URL → enlace inválido.
  if (!token) {
    return (
      <p className="text-sm text-center text-muted-foreground">
        Enlace inválido. Solicitá uno nuevo desde{' '}
        <Link href="/forgot-password" className="text-blue-600 hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </p>
    )
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-4 py-3">
          ✅ Tu contraseña fue actualizada. Ya podés iniciar sesión.
        </p>
        <Link
          href="/login"
          className="inline-block bg-blue-950 hover:bg-blue-900 text-white font-bold uppercase tracking-wide px-6 py-2 rounded-md transition-all"
        >
          Iniciar sesión
        </Link>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    if (password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      toast.error('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo actualizar la contraseña.')
        return
      }
      setDone(true)
      toast.success(data.message ?? 'Contraseña actualizada.')
      // Redirección suave al login tras un momento.
      setTimeout(() => router.push('/login'), 2500)
    } catch {
      toast.error('Error de red. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Nueva contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirmar contraseña</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={8}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Guardando…' : 'Actualizar contraseña'}
      </Button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white tracking-tight">Ki-Niela</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nueva contraseña</CardTitle>
            <CardDescription>Elegí una contraseña nueva para tu cuenta</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<p className="text-sm text-center text-muted-foreground">Cargando…</p>}>
              <ResetPasswordForm />
            </Suspense>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              <Link href="/login" className="text-blue-600 hover:underline">
                Volver al inicio de sesión
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
