import { toZonedTime, format } from 'date-fns-tz'
import { addMinutes } from 'date-fns'

const TZ = 'America/Costa_Rica'

export function toCostaRica(date: Date): Date {
  return toZonedTime(date, TZ)
}

export function formatCostaRica(date: Date, fmt = 'dd/MM/yyyy HH:mm'): string {
  return format(toZonedTime(date, TZ), fmt, { timeZone: TZ })
}

export function isMatchLocked(kickoffAtUtc: Date, lockMinutesBefore: number): boolean {
  const lockAt = addMinutes(kickoffAtUtc, -lockMinutesBefore)
  return new Date() >= lockAt
}

export function getLockTime(kickoffAtUtc: Date, lockMinutesBefore: number): Date {
  return addMinutes(kickoffAtUtc, -lockMinutesBefore)
}
