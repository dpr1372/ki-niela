'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export default function RequestAccessButton({ quinielaId }: { quinielaId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/quinielas/${quinielaId}/members/request-access`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al solicitar acceso.')
        return
      }
      toast.success(data.message ?? 'Solicitud enviada.')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button size="sm" onClick={handleClick} disabled={loading} className="flex-1 bg-emerald-700 hover:bg-emerald-600">
      {loading ? 'Enviando...' : 'Solicitar acceso'}
    </Button>
  )
}
