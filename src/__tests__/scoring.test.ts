import { describe, it, expect } from 'vitest'
import { calculateScore } from '@/lib/scoring'

describe('calculateScore — partidos normales', () => {
  it('marcador exacto → 3 puntos', () => {
    const r = calculateScore(2, 1, 2, 1, false)
    expect(r.points).toBe(3)
    expect(r.reason).toBe('Marcador exacto')
  })

  it('ganador correcto, marcador incorrecto → 1 punto', () => {
    const r = calculateScore(1, 0, 3, 0, false)
    expect(r.points).toBe(1)
    expect(r.reason).toBe('Ganador correcto')
  })

  it('empate correcto, marcador incorrecto → 1 punto', () => {
    const r = calculateScore(1, 1, 2, 2, false)
    expect(r.points).toBe(1)
    expect(r.reason).toBe('Empate correcto')
  })

  it('empate exacto → 3 puntos', () => {
    const r = calculateScore(1, 1, 1, 1, false)
    expect(r.points).toBe(3)
    expect(r.reason).toBe('Marcador exacto')
  })

  it('sin acierto → 0 puntos', () => {
    const r = calculateScore(2, 0, 1, 2, false)
    expect(r.points).toBe(0)
    expect(r.reason).toBe('Sin acierto')
  })
})

describe('calculateScore — partidos estrella', () => {
  it('marcador exacto estrella → 5 puntos', () => {
    const r = calculateScore(2, 1, 2, 1, true)
    expect(r.points).toBe(5)
    expect(r.reason).toBe('Marcador exacto')
  })

  it('ganador correcto estrella → 3 puntos', () => {
    const r = calculateScore(1, 0, 3, 0, true)
    expect(r.points).toBe(3)
    expect(r.reason).toBe('Ganador correcto')
  })

  it('empate correcto estrella → 3 puntos', () => {
    const r = calculateScore(0, 0, 1, 1, true)
    expect(r.points).toBe(3)
    expect(r.reason).toBe('Empate correcto')
  })

  it('sin acierto estrella → 0 puntos', () => {
    const r = calculateScore(2, 0, 1, 2, true)
    expect(r.points).toBe(0)
    expect(r.reason).toBe('Sin acierto')
  })
})

describe('calculateScore — eliminatoria con penales (resultado 120min cuenta, no penales)', () => {
  it('predicción 1-1, resultado 1-1 (ganó por penales) → marcador exacto normal', () => {
    // The caller must pass the 90'/120' result, not penalty winner
    const r = calculateScore(1, 1, 1, 1, false)
    expect(r.points).toBe(3)
    expect(r.reason).toBe('Marcador exacto')
  })

  it('predicción 2-1 ganador, resultado fue empate 1-1 → sin acierto', () => {
    const r = calculateScore(2, 1, 1, 1, false)
    expect(r.points).toBe(0)
    expect(r.reason).toBe('Sin acierto')
  })
})
