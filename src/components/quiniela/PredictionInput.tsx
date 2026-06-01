'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'

type Props = {
  matchId: string
  initialHome?: number
  initialAway?: number
  locked: boolean
  onSave: (matchId: string, home: number, away: number) => void
  onBlur?: (matchId: string) => void
}

// Teclas de control permitidas (navegación, borrado, copiar/pegar).
const ALLOWED_KEYS = new Set([
  'Backspace', 'Delete', 'Tab', 'Enter', 'Escape',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
])

// Bloquea en desktop la digitación de teclas no numéricas (letras, "e", "+",
// "-", ".", ","). En móvil inputMode="numeric" ya muestra teclado numérico.
function blockNonNumericKeys(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.ctrlKey || e.metaKey || e.altKey) return // copiar/pegar/atajos
  if (ALLOWED_KEYS.has(e.key)) return
  if (!/^[0-9]$/.test(e.key)) e.preventDefault()
}

export function PredictionInput({ matchId, initialHome, initialAway, locked, onSave, onBlur }: Props) {
  const [home, setHome] = useState<string>(initialHome !== undefined ? String(initialHome) : '')
  const [away, setAway] = useState<string>(initialAway !== undefined ? String(initialAway) : '')

  function handleChange(field: 'home' | 'away', rawValue: string) {
    // Solo dígitos: descarta letras, signos, puntos, "e", espacios, etc.
    let value = rawValue.replace(/\D/g, '')
    // Quita ceros a la izquierda para que "01" se vuelva "1", "00" → "0".
    // Conserva un único "0" si el campo es exactamente cero.
    value = value.replace(/^0+(?=\d)/, '')
    // Máximo 2 dígitos (un marcador no pasa de 99).
    value = value.slice(0, 2)

    const num = parseInt(value, 10)
    if (value !== '' && (isNaN(num) || num < 0)) return

    const nextHome = field === 'home' ? value : home
    const nextAway = field === 'away' ? value : away

    if (field === 'home') setHome(value)
    else setAway(value)

    // Save as soon as both inputs hold a parseable non-negative integer.
    // Empty string is NOT auto-coerced to 0 here — user might still be typing.
    const h = parseInt(nextHome, 10)
    const a = parseInt(nextAway, 10)
    if (
      nextHome !== '' &&
      nextAway !== '' &&
      Number.isInteger(h) && h >= 0 &&
      Number.isInteger(a) && a >= 0
    ) {
      onSave(matchId, h, a)
    }
  }

  // On blur: if one field is filled and the other is empty, treat the empty
  // one as 0 and save. Covers the case "user types '2' and tabs/clicks away
  // before filling the other side".
  function handleBlur() {
    const h = home === '' ? null : parseInt(home, 10)
    const a = away === '' ? null : parseInt(away, 10)

    if (h !== null && a === null) {
      setAway('0')
      if (Number.isInteger(h) && h >= 0) onSave(matchId, h, 0)
    } else if (a !== null && h === null) {
      setHome('0')
      if (Number.isInteger(a) && a >= 0) onSave(matchId, 0, a)
    }

    onBlur?.(matchId)
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        value={home}
        onKeyDown={blockNonNumericKeys}
        onChange={(e) => handleChange('home', e.target.value)}
        onBlur={handleBlur}
        disabled={locked}
        className="w-14 text-center text-lg font-bold p-1"
        placeholder="-"
      />
      <span className="text-gray-400 font-bold">-</span>
      <Input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        value={away}
        onKeyDown={blockNonNumericKeys}
        onChange={(e) => handleChange('away', e.target.value)}
        onBlur={handleBlur}
        disabled={locked}
        className="w-14 text-center text-lg font-bold p-1"
        placeholder="-"
      />
    </div>
  )
}
