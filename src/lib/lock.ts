import { isMatchLocked } from './timezone'

export async function checkMatchLocked(
  kickoffAtUtc: Date,
  lockMinutesBefore: number,
): Promise<boolean> {
  return isMatchLocked(kickoffAtUtc, lockMinutesBefore)
}
