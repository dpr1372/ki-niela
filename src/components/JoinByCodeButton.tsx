'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Ticket, ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
      toast.success(data.message ?? '¡Te uniste a la quiniela!')
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
      <button
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-900/20 transition-all hover:shadow-lg hover:shadow-emerald-900/30 hover:-translate-y-0.5 active:translate-y-0"
      >
        <Ticket size={18} className="transition-transform group-hover:-rotate-12" />
        Unirme a una quiniela
      </button>
    )
  }

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white border border-emerald-100 shadow-lg shadow-emerald-900/10 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-emerald-800">
          <Ticket size={18} />
          <span className="text-sm font-bold">Ingresa tu código de invitación</span>
        </div>
        <button
          onClick={() => { setOpen(false); setCode('') }}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>
      </div>
      <p className="text-[11px] text-gray-500 mb-3">
        Pídeselo al administrador de tu quiniela.
      </p>
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') { setOpen(false); setCode('') }
          }}
          placeholder="EJ. AMISTOSOS2026"
          maxLength={16}
          className="flex-1 min-w-0 rounded-xl border-2 border-emerald-200 bg-emerald-50/40 px-4 py-2.5 text-center font-mono text-lg font-bold tracking-widest uppercase text-emerald-900 placeholder:text-emerald-300 placeholder:tracking-normal placeholder:text-xs outline-none transition-colors focus:border-emerald-500 focus:bg-white"
        />
        <Button
          onClick={submit}
          disabled={loading}
          className="shrink-0 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 h-11 px-4"
        >
          {loading ? 'Uniendo…' : <ArrowRight size={20} />}
        </Button>
      </div>
    </div>
  )
}
