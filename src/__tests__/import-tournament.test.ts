import { describe, it, expect, vi, afterEach } from 'vitest'
import { phaseFromEspnSlug, tournamentBySlug, TOURNAMENT_SLUGS } from '@/lib/tournaments'
import { fetchFixturesForImport } from '@/lib/live-providers/espn'

describe('phaseFromEspnSlug', () => {
  it('maps known ESPN season slugs to MatchPhase literals', () => {
    expect(phaseFromEspnSlug('group-stage')).toBe('GROUPS')
    expect(phaseFromEspnSlug('league-stage')).toBe('GROUPS')
    expect(phaseFromEspnSlug('round-of-32')).toBe('ROUND_OF_32')
    expect(phaseFromEspnSlug('round-of-16')).toBe('ROUND_OF_16')
    expect(phaseFromEspnSlug('quarterfinals')).toBe('QUARTER_FINAL')
    expect(phaseFromEspnSlug('semifinals')).toBe('SEMI_FINAL')
    expect(phaseFromEspnSlug('third-place')).toBe('THIRD_PLACE')
    expect(phaseFromEspnSlug('final')).toBe('FINAL')
  })

  it('is case-insensitive', () => {
    expect(phaseFromEspnSlug('Round-Of-16')).toBe('ROUND_OF_16')
  })

  it('defaults to GROUPS for unknown or missing slug', () => {
    expect(phaseFromEspnSlug(undefined)).toBe('GROUPS')
    expect(phaseFromEspnSlug(null)).toBe('GROUPS')
    expect(phaseFromEspnSlug('something-weird')).toBe('GROUPS')
  })
})

describe('tournament catalog', () => {
  it('every slug resolves to metadata', () => {
    for (const slug of TOURNAMENT_SLUGS) {
      expect(tournamentBySlug(slug)?.name).toBeTruthy()
    }
  })
})

describe('fetchFixturesForImport', () => {
  afterEach(() => vi.restoreAllMocks())

  const sampleEvent = {
    id: '12345',
    date: '2026-04-15T23:00Z',
    season: { year: 2026, slug: 'group-stage' },
    competitions: [
      {
        id: '12345',
        venue: { fullName: 'Estadio Monumental', address: { city: 'Lima', country: 'Peru' } },
        competitors: [
          {
            id: 'h1',
            homeAway: 'home',
            team: { displayName: 'Brasil', abbreviation: 'BRA', logo: 'https://espn/bra.png' },
          },
          {
            id: 'a1',
            homeAway: 'away',
            team: { displayName: 'Argentina', abbreviation: 'ARG', logo: 'https://espn/arg.png' },
          },
        ],
      },
    ],
  }

  it('builds rich import fixtures and encodes externalId as "slug|id"', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ events: [sampleEvent] }), { status: 200 }),
    )

    const out = await fetchFixturesForImport('conmebol.libertadores', '2026-04-15', '2026-04-15')
    expect(out).toHaveLength(1)
    const f = out[0]
    expect(f.externalId).toBe('conmebol.libertadores|12345')
    expect(f.leagueSlug).toBe('conmebol.libertadores')
    expect(f.seasonSlug).toBe('group-stage')
    expect(f.home?.name).toBe('Brasil')
    expect(f.home?.abbreviation).toBe('BRA')
    expect(f.home?.logoUrl).toBe('https://espn/bra.png')
    expect(f.away?.name).toBe('Argentina')
    expect(f.venueName).toBe('Estadio Monumental')
    expect(f.venueCity).toBe('Lima')
    expect(f.venueCountry).toBe('Peru')
    expect(f.kickoffIsoUtc).toBe('2026-04-15T23:00Z')
  })

  it('uses a single-day "dates" param when start === end', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ events: [] }), { status: 200 }))

    await fetchFixturesForImport('uefa.champions', '2026-05-01', '2026-05-01')
    const calledUrl = String(spy.mock.calls[0][0])
    expect(calledUrl).toContain('dates=20260501')
    expect(calledUrl).not.toContain('20260501-')
  })

  it('uses a range "dates" param when start !== end', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ events: [] }), { status: 200 }))

    await fetchFixturesForImport('uefa.champions', '2026-05-01', '2026-08-01')
    const calledUrl = String(spy.mock.calls[0][0])
    expect(calledUrl).toContain('dates=20260501-20260801')
  })

  it('handles fixtures with a missing competitor gracefully', async () => {
    const oneSided = {
      ...sampleEvent,
      competitions: [{ ...sampleEvent.competitions[0], competitors: [sampleEvent.competitions[0].competitors[0]] }],
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ events: [oneSided] }), { status: 200 }),
    )
    const out = await fetchFixturesForImport('fifa.world', '2026-06-01', '2026-06-01')
    expect(out[0].home?.name).toBe('Brasil')
    expect(out[0].away).toBeNull()
  })
})
