/**
 * Live scores provider selector.
 *
 * Strategy:
 *   - Default = Sofascore (free, no API key, wide coverage)
 *   - If LIVE_PROVIDER=api-football is set AND API_FOOTBALL_KEY is configured,
 *     use API-Football instead.
 *   - Always falls back to admin-manual scoring when the provider fails.
 */

import * as sofascore from './sofascore'
import * as apiFootball from './api-football'

export type LiveFixture = sofascore.LiveFixture
type StatusInput = Parameters<typeof sofascore.mapStatus>[0]

const PROVIDER = (process.env.LIVE_PROVIDER ?? 'sofascore').toLowerCase()
const useApiFootball = PROVIDER === 'api-football' && !!process.env.API_FOOTBALL_KEY

export const providerName = useApiFootball ? 'api-football' : 'sofascore'

export async function fetchFixtures(externalIds: string[]): Promise<LiveFixture[]> {
  if (useApiFootball) {
    const list = await apiFootball.fetchFixtures(externalIds)
    return list.map((f) => ({
      externalId: f.externalId,
      status: f.status,
      homeGoals: f.homeGoals,
      awayGoals: f.awayGoals,
      penaltyHomeGoals: f.penaltyHomeGoals,
      penaltyAwayGoals: f.penaltyAwayGoals,
      isLive: f.isLive,
      isFinished: f.isFinished,
    }))
  }
  return sofascore.fetchFixtures(externalIds)
}

export function mapStatus(input: StatusInput | string) {
  if (useApiFootball && typeof input === 'string') {
    return apiFootball.mapStatus(input)
  }
  return sofascore.mapStatus(input)
}

export { fetchByDate } from './sofascore'
