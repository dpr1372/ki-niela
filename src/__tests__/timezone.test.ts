import { describe, it, expect, vi, afterEach } from 'vitest'
import { isMatchLocked, getLockTime } from '@/lib/timezone'

afterEach(() => vi.useRealTimers())

describe('isMatchLocked', () => {
  it('returns false when more than lockMinutes remain', () => {
    const kickoff = new Date(Date.now() + 20 * 60 * 1000)
    expect(isMatchLocked(kickoff, 10)).toBe(false)
  })

  it('returns true when within lockMinutes', () => {
    const kickoff = new Date(Date.now() + 5 * 60 * 1000)
    expect(isMatchLocked(kickoff, 10)).toBe(true)
  })

  it('returns true when match has already started', () => {
    const kickoff = new Date(Date.now() - 5 * 60 * 1000)
    expect(isMatchLocked(kickoff, 10)).toBe(true)
  })

  it('returns true exactly at lock time', () => {
    const now = Date.now()
    vi.setSystemTime(now)
    const kickoff = new Date(now + 10 * 60 * 1000)
    expect(isMatchLocked(kickoff, 10)).toBe(true)
  })
})

describe('getLockTime', () => {
  it('returns kickoff minus lockMinutes', () => {
    const kickoff = new Date('2026-06-11T18:00:00Z')
    const lock = getLockTime(kickoff, 10)
    expect(lock.toISOString()).toBe('2026-06-11T17:50:00.000Z')
  })
})
