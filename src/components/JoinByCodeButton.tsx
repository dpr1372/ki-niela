'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function JoinByCodeButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const value = code.trim()
    if (!value) {
      toast.error('Ingresa un código de invitación.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/quinielas/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: value }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo unir a la quiniela.')
        return
      }
      toast.success(data.message ?? 'Te uniste a la quiniela.')
      setCode('')
      setOpen(false)
      if (data.quinielaId) {
        router.push(`/quinielas/${data.quinielaId}/dashboard`)
      } else {
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="bg-emerald-700 hover:bg-emerald-600"
      >
        Unirme con código
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') {
            setOpen(false)
            setCode('')
          }
        }}
        placeholder="CÓDIGO"
        maxLength={12}
        className="w-32 font-mono tracking-widest uppercase bg-white"
      />
      <Button size="sm" onClick={submit} disabled={loading} className="bg-emerald-700 hover:bg-emerald-600">
        {loading ? 'Uniendo…' : 'Unirme'}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(false)
          setCode('')
        }}
      >
        Cancelar
      </Button>
    </div>
  )
}
