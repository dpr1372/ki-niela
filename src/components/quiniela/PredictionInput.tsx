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

export function PredictionInput({ matchId, initialHome, initialAway, locked, onSave, onBlur }: Props) {
  const [home, setHome] = useState<string>(initialHome !== undefined ? String(initialHome) : '')
  const [away, setAway] = useState<string>(initialAway !== undefined ? String(initialAway) : '')

  function handleChange(field: 'home' | 'away', value: string) {
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
        type="number"
        min={0}
        max={20}
        value={home}
        onChange={(e) => handleChange('home', e.target.value)}
        onBlur={handleBlur}
        disabled={locked}
        className="w-14 text-center text-lg font-bold p-1"
        placeholder="-"
      />
      <span className="text-gray-400 font-bold">-</span>
      <Input
        type="number"
        min={0}
        max={20}
        value={away}
        onChange={(e) => handleChange('away', e.target.value)}
        onBlur={handleBlur}
        disabled={locked}
        className="w-14 text-center text-lg font-bold p-1"
        placeholder="-"
      />
    </div>
  )
}
