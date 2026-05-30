import { describe, it, expect } from 'vitest'

// Pure logic tests for bot double-gate conditions.
//
// Solo compiten los PARTICIPANT: el bot NO genera para QUINIELA_ADMIN aunque
// tengan el check activo. Y NO depende del estado transitorio BLOQUEADO: la
// compuerta de tiempo es la VENTANA DE BLOQUEO (now ≥ kickoff −
// lockMinutesBeforeMatch) y que el partido aún no haya finalizado.
function shouldGenerateBot({
  quinielaRandomEnabled,
  memberAutoEnabled,
  memberStatus,
  memberRole = 'PARTICIPANT',
  hasPrediction,
  withinLockWindow = true,
  matchFinalized = false,
}: {
  quinielaRandomEnabled: boolean
  memberAutoEnabled: boolean
  memberStatus: string
  memberRole?: string
  hasPrediction: boolean
  withinLockWindow?: boolean
  matchFinalized?: boolean
}): boolean {
  if (!quinielaRandomEnabled) return false
  if (!memberAutoEnabled) return false
  if (memberStatus !== 'ACTIVE') return false
  if (memberRole !== 'PARTICIPANT') return false
  if (hasPrediction) return false
  if (!withinLockWindow) return false
  if (matchFinalized) return false
  return true
}

describe('bot double-gate', () => {
  it('generates when all conditions met', () => {
    expect(shouldGenerateBot({ quinielaRandomEnabled: true, memberAutoEnabled: true, memberStatus: 'ACTIVE', hasPrediction: false })).toBe(true)
  })

  it('skips when quiniela has randomPredictions disabled', () => {
    expect(shouldGenerateBot({ quinielaRandomEnabled: false, memberAutoEnabled: true, memberStatus: 'ACTIVE', hasPrediction: false })).toBe(false)
  })

  it('skips when member has autoPredictions disabled', () => {
    expect(shouldGenerateBot({ quinielaRandomEnabled: true, memberAutoEnabled: false, memberStatus: 'ACTIVE', hasPrediction: false })).toBe(false)
  })

  it('skips when member is PENDING_APPROVAL', () => {
    expect(shouldGenerateBot({ quinielaRandomEnabled: true, memberAutoEnabled: true, memberStatus: 'PENDING_APPROVAL', hasPrediction: false })).toBe(false)
  })

  it('skips when member is INACTIVE', () => {
    expect(shouldGenerateBot({ quinielaRandomEnabled: true, memberAutoEnabled: true, memberStatus: 'INACTIVE', hasPrediction: false })).toBe(false)
  })

  it('skips when member is REJECTED', () => {
    expect(shouldGenerateBot({ quinielaRandomEnabled: true, memberAutoEnabled: true, memberStatus: 'REJECTED', hasPrediction: false })).toBe(false)
  })

  it('skips when prediction already exists', () => {
    expect(shouldGenerateBot({ quinielaRandomEnabled: true, memberAutoEnabled: true, memberStatus: 'ACTIVE', hasPrediction: true })).toBe(false)
  })

  it('skips before the lock window opens (player can still predict manually)', () => {
    expect(shouldGenerateBot({ quinielaRandomEnabled: true, memberAutoEnabled: true, memberStatus: 'ACTIVE', hasPrediction: false, withinLockWindow: false })).toBe(false)
  })

  it('generates inside the lock window even if the match already kicked off', () => {
    // El partido ya pasó a EN_JUEGO pero no finalizó: el bot todavía rellena a
    // quien no tiene predicción (no depende de status BLOQUEADO).
    expect(shouldGenerateBot({ quinielaRandomEnabled: true, memberAutoEnabled: true, memberStatus: 'ACTIVE', hasPrediction: false, withinLockWindow: true, matchFinalized: false })).toBe(true)
  })

  it('skips once the match is finalized (score never changes after the game)', () => {
    expect(shouldGenerateBot({ quinielaRandomEnabled: true, memberAutoEnabled: true, memberStatus: 'ACTIVE', hasPrediction: false, withinLockWindow: true, matchFinalized: true })).toBe(false)
  })

  it('skips for QUINIELA_ADMIN (admins do not compete)', () => {
    expect(shouldGenerateBot({ quinielaRandomEnabled: true, memberAutoEnabled: true, memberStatus: 'ACTIVE', memberRole: 'QUINIELA_ADMIN', hasPrediction: false })).toBe(false)
  })
})
