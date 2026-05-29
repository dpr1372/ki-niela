/**
 * Live scores provider selector.
 *
 * Priority:
 *   1. ESPN (default, free, no API key, server-friendly)
 *   2. Sofascore — if LIVE_PROVIDER=sofascore (note: their CDN frequently
 *      blocks server-side requests with 403; works mostly from browsers)
 *   3. API-Football — if LIVE_PROVIDER=api-football AND API_FOOTBALL_KEY set
 *
 * Always falls back to admin-manual scoring when the provider fails.
 */

import * as espn from './espn'
import * as sofascore from './sofascore'
import * as apiFootball from './api-football'

export type LiveFixture = espn.LiveFixture
type StatusInput =
  | string
  | { type?: { state?: string; detail?: string; description?: string } }
  | { type?: string; code?: number; description?: string }

const PROVIDER = (process.env.LIVE_PROVIDER ?? 'espn').toLowerCase()
const useApiFootball = PROVIDER === 'api-football' && !!process.env.API_FOOTBALL_KEY
const useSofascore = PROVIDER === 'sofascore'

export const providerName = useApiFootball ? 'api-football' : useSofascore ? 'sofascore' : 'espn'

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
  if (useSofascore) {
    const list = await sofascore.fetchFixtures(externalIds)
    return list.map((f) => ({
      externalId: f.externalId,
      status: f.status,
      homeGoals: f.homeGoals,
      awayGoals: f.awayGoals,
      penaltyHomeGoals: f.penaltyHomeGoals,
      penaltyAwayGoals: f.penaltyAwayGoals,
      isLive: f.isLive,
      isFinished: f.isFinished,
      homeName: f.homeName,
      awayName: f.awayName,
      startTimestamp: f.startTimestamp,
      tournamentName: f.tournamentName,
    }))
  }
  return espn.fetchFixtures(externalIds)
}

export function mapStatus(input: StatusInput) {
  if (useApiFootball && typeof input === 'string') return apiFootball.mapStatus(input)
  if (useSofascore) return sofascore.mapStatus(input as never)
  return espn.mapStatus(input as never)
}

export async function fetchByDate(date: string, tournament?: string): Promise<LiveFixture[]> {
  if (useSofascore) {
    return sofascore.fetchByDate(date, tournament)
  }
  // ESPN (default)
  return espn.fetchByDate(date, tournament)
}
