'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type EventOption = { id: string; name: string }

export default function CrearQuinielaButton({ events }: { events: EventOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    eventId: events[0]?.id ?? '',
    name: '',
    description: '',
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.eventId) {
      toast.error('Selecciona un evento.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/events/${form.eventId}/quinielas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(data?.error?.formErrors?.[0] ?? 'No se pudo crear la quiniela.')
        return
      }
      toast.success('Quiniela creada.')
      setOpen(false)
      setForm({ eventId: events[0]?.id ?? '', name: '', description: '' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-yellow-400 hover:bg-yellow-500 text-blue-950 font-bold"
        disabled={events.length === 0}
      >
        <Plus size={16} /> Crear quiniela
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-950 to-emerald-800 px-6 py-4 text-white">
              <h2 className="text-xl font-black">Crear nueva quiniela</h2>
              <p className="text-xs text-blue-100 mt-0.5">Tú quedarás como administrador automáticamente.</p>
            </div>
            <form onSubmit={submit} className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="event" className="text-blue-950 font-bold uppercase text-[11px] tracking-wide">Evento</Label>
                <select
                  id="event"
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  value={form.eventId}
                  onChange={(e) => setForm((f) => ({ ...f, eventId: e.target.value }))}
                  required
                >
                  {events.length === 0 && <option value="">No hay eventos disponibles</option>}
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-blue-950 font-bold uppercase text-[11px] tracking-wide">Nombre de la quiniela</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ej. Quiniela Familiar"
                  minLength={2}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-blue-950 font-bold uppercase text-[11px] tracking-wide">Descripción (opcional)</Label>
                <Input
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Ej. Quiniela entre amigos"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={loading}
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-blue-950 hover:bg-blue-900 text-white"
                  disabled={loading}
                >
                  {loading ? 'Creando…' : '⚽ Crear'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
