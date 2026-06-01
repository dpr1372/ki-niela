/**
 * Catálogo estable de torneos importables desde ESPN.
 *
 * Cada entrada mapea un slug de liga ESPN (site.api.espn.com .../soccer/{slug})
 * a un nombre legible para el dropdown del admin. Estos slugs fueron verificados
 * contra el scoreboard público de ESPN — todos devuelven temporada y eventos.
 *
 * El slug NUNCA se expone en crudo en la UI; el usuario elige por nombre.
 */
export const TOURNAMENTS = [
  { slug: 'fifa.world', name: 'Copa del Mundo FIFA', emoji: '🌍' },
  { slug: 'uefa.champions', name: 'UEFA Champions League', emoji: '🏆' },
  { slug: 'concacaf.gold', name: 'Copa Oro CONCACAF', emoji: '🥇' },
  { slug: 'conmebol.america', name: 'Copa América', emoji: '🌎' },
  { slug: 'uefa.euro', name: 'Eurocopa (UEFA Euro)', emoji: '🇪🇺' },
  { slug: 'conmebol.libertadores', name: 'Copa Libertadores', emoji: '🦅' },
  { slug: 'fifa.friendly', name: 'Amistosos Internacionales', emoji: '🤝' },
] as const

export type TournamentSlug = (typeof TOURNAMENTS)[number]['slug']

export const TOURNAMENT_SLUGS = TOURNAMENTS.map((t) => t.slug) as TournamentSlug[]

export function tournamentBySlug(slug: string) {
  return TOURNAMENTS.find((t) => t.slug === slug)
}

/**
 * Mapa `season.slug` de ESPN → fase interna (MatchPhase).
 *
 * ESPN expone la fase de cada partido en `event.season.slug` (verificado:
 * "group-stage" en Libertadores). Los KO usan slugs estándar de ESPN.
 * Default seguro: GROUPS (si ESPN no envía slug o es desconocido).
 *
 * El valor es el literal del enum MatchPhase de Prisma (string), para no
 * acoplar este módulo de tipos puros al cliente de Prisma.
 */
export const PHASE_BY_ESPN_SLUG: Record<string, string> = {
  'group-stage': 'GROUPS',
  'league-stage': 'GROUPS',
  'first-stage': 'GROUPS',
  'second-stage': 'GROUPS',
  'round-of-32': 'ROUND_OF_32',
  'round-of-16': 'ROUND_OF_16',
  'quarterfinals': 'QUARTER_FINAL',
  'quarter-finals': 'QUARTER_FINAL',
  'semifinals': 'SEMI_FINAL',
  'semi-finals': 'SEMI_FINAL',
  'third-place': 'THIRD_PLACE',
  '3rd-place': 'THIRD_PLACE',
  'final': 'FINAL',
}

export function phaseFromEspnSlug(seasonSlug?: string | null): string {
  if (!seasonSlug) return 'GROUPS'
  return PHASE_BY_ESPN_SLUG[seasonSlug.toLowerCase()] ?? 'GROUPS'
}
