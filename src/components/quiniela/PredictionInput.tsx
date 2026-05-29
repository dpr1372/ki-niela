'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'

type Props = {
  matchId: string
  initialHome?: number
  initialAway?: number
  locked: boolean
  onSave: (matchId: string, home: number, away: number) => void
}

export function PredictionInput({ matchId, initialHome, initialAway, locked, onSave }: Props) {
  const [home, setHome] = useState<string>(initialHome !== undefined ? String(initialHome) : '')
  const [away, setAway] = useState<string>(initialAway !== undefined ? String(initialAway) : '')

  function handleChange(field: 'home' | 'away', value: string) {
    const num = parseInt(value)
    if (value !== '' && (isNaN(num) || num < 0)) return

    if (field === 'home') {
      setHome(value)
      const awayNum = parseInt(away)
      if (value !== '' && !isNaN(num) && num >= 0 && !isNaN(awayNum) && awayNum >= 0) {
        onSave(matchId, num, awayNum)
      }
    } else {
      setAway(value)
      const homeNum = parseInt(home)
      if (value !== '' && !isNaN(num) && num >= 0 && !isNaN(homeNum) && homeNum >= 0) {
        onSave(matchId, homeNum, num)
      }
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        max={20}
        value={home}
        onChange={(e) => handleChange('home', e.target.value)}
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
        disabled={locked}
        className="w-14 text-center text-lg font-bold p-1"
        placeholder="-"
      />
    </div>
  )
}
