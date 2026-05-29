'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import AppShell from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Mail, Lock } from 'lucide-react'

const profileSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(80),
  email: z.string().email('Correo inválido'),
})
type ProfileForm = z.infer<typeof profileSchema>

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Ingresa tu contraseña actual'),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string().min(1, 'Confirma tu nueva contraseña'),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Las contraseñas no coinciden.',
  path: ['confirmPassword'],
})
type PasswordForm = z.infer<typeof passwordSchema>

export default function PerfilPage() {
  const { data: session, update: updateSession } = useSession()
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      name: session?.user?.name ?? '',
      email: session?.user?.email ?? '',
    },
  })

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  async function onSaveProfile(values: ProfileForm) {
    setSavingProfile(true)
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: values.name, email: values.email }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Error al guardar.'); return }
      await updateSession({ name: values.name, email: values.email })
      toast.success(data.message ?? 'Perfil actualizado.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function onSavePassword(values: PasswordForm) {
    setSavingPassword(true)
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Error al guardar.'); return }
      toast.success('Contraseña actualizada.')
      passwordForm.reset()
    } finally {
      setSavingPassword(false)
    }
  }

  const initials = (session?.user?.name ?? session?.user?.email ?? '?').slice(0, 1).toUpperCase()

  return (
    <AppShell>
      <div className="space-y-8 max-w-lg">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-950 text-yellow-300 font-black text-2xl flex items-center justify-center shadow-md">
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-black text-pitch-dark">Mi Perfil</h1>
            <p className="text-sm text-gray-500">{session?.user?.email}</p>
          </div>
        </div>

        {/* Datos personales */}
        <div className="card-pitch rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <User size={16} />
            Datos personales
          </h2>
          <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" {...profileForm.register('name')} className="mt-1" />
              {profileForm.formState.errors.name && (
                <p className="text-xs text-red-500 mt-1">{profileForm.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="email">
                <Mail size={13} className="inline mr-1" />
                Correo electrónico
              </Label>
              <Input id="email" type="email" {...profileForm.register('email')} className="mt-1" />
              {profileForm.formState.errors.email && (
                <p className="text-xs text-red-500 mt-1">{profileForm.formState.errors.email.message}</p>
              )}
            </div>
            <Button type="submit" disabled={savingProfile} className="w-full">
              {savingProfile ? 'Guardando...' : 'Guardar datos'}
            </Button>
          </form>
        </div>

        {/* Cambiar contraseña */}
        <div className="card-pitch rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <Lock size={16} />
            Cambiar contraseña
          </h2>
          <form onSubmit={passwordForm.handleSubmit(onSavePassword)} className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Contraseña actual</Label>
              <Input id="currentPassword" type="password" {...passwordForm.register('currentPassword')} className="mt-1" />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.currentPassword.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="newPassword">Nueva contraseña</Label>
              <Input id="newPassword" type="password" {...passwordForm.register('newPassword')} className="mt-1" />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.newPassword.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
              <Input id="confirmPassword" type="password" {...passwordForm.register('confirmPassword')} className="mt-1" />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" disabled={savingPassword} className="w-full">
              {savingPassword ? 'Guardando...' : 'Cambiar contraseña'}
            </Button>
          </form>
        </div>
      </div>
    </AppShell>
  )
}
