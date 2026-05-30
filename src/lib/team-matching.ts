/**
 * Fuzzy team-name matching shared between the admin UI and server jobs.
 * Accepts FIFA codes, English, Spanish (with/without accents) and common
 * shorthand. Two names match when their canonical equivalence class overlaps.
 *
 * Extracted from src/app/admin/partidos/page.tsx so the live-score sync job
 * can detect when ESPN reports a fixture with home/away in the opposite
 * orientation to ours and swap the goals accordingly.
 */

// Fuzzy team name matching: accepts FIFA codes, English, Spanish (with/without
// accents), and common shorthand. Two names match when their *equivalence
// class* (a canonical English spelling) overlaps.
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining accents
    // Drop word-level connectors before stripping non-alphanumerics, so
    // "Bosnia y Herzegovina" / "Bosnia-Herzegovina" / "Bosnia and Herzegovina"
    // all collapse to "bosniaherzegovina".
    .replace(/\s+(?:y|e|and|&)\s+/g, ' ')
    .replace(/[^a-z0-9]/g, '')
}

// Equivalence groups — every entry on the same line is treated as the same team.
// Add Spanish, English, FIFA-3, FIFA-2, common nicknames here.
const TEAM_ALIASES: string[][] = [
  // Americas
  ['usa', 'unitedstates', 'unitedstatesofamerica', 'estadosunidos', 'eeuu'],
  ['can', 'canada'],
  ['mex', 'mexico', 'méxico'],
  ['crc', 'costarica'],
  ['hon', 'honduras'],
  ['gua', 'guatemala'],
  ['slv', 'elsalvador', 'salvador'],
  ['nca', 'nicaragua'],
  ['pan', 'panama', 'panamá'],
  ['hai', 'haiti', 'haití'],
  ['jam', 'jamaica'],
  ['tri', 'trinidadandtobago', 'trinidadtobago', 'trinidadytobago'],
  ['cub', 'cuba'],
  ['dom', 'dominicanrepublic', 'republicadominicana'],
  ['pur', 'puertorico'],
  ['cuw', 'curacao', 'curaçao', 'curazao'],
  ['arg', 'argentina'],
  ['bra', 'brazil', 'brasil'],
  ['uru', 'uruguay'],
  ['par', 'paraguay'],
  ['chi', 'chile'],
  ['per', 'peru', 'perú'],
  ['ecu', 'ecuador'],
  ['bol', 'bolivia'],
  ['ven', 'venezuela'],
  ['col', 'colombia'],

  // Europe
  ['eng', 'england', 'inglaterra'],
  ['sco', 'scotland', 'escocia'],
  ['wal', 'wales', 'gales'],
  ['nir', 'northernireland', 'irlandadelnorte'],
  ['irl', 'ireland', 'irlanda', 'republicofireland'],
  ['fra', 'france', 'francia'],
  ['esp', 'spain', 'españa', 'espana'],
  ['ita', 'italy', 'italia'],
  ['por', 'portugal'],
  ['ger', 'germany', 'alemania'],
  ['ned', 'netherlands', 'holland', 'holanda', 'paisesbajos'],
  ['bel', 'belgium', 'belgica', 'bélgica'],
  ['lux', 'luxembourg', 'luxemburgo'],
  ['sui', 'switzerland', 'suiza'],
  ['aut', 'austria'],
  ['den', 'denmark', 'dinamarca'],
  ['swe', 'sweden', 'suecia'],
  ['nor', 'norway', 'noruega'],
  ['fin', 'finland', 'finlandia'],
  ['isl', 'iceland', 'islandia'],
  ['pol', 'poland', 'polonia'],
  ['cze', 'czechrepublic', 'czechia', 'republicacheca'],
  ['svk', 'slovakia', 'eslovaquia'],
  ['hun', 'hungary', 'hungria', 'hungría'],
  ['rou', 'romania', 'rumania', 'rumanía'],
  ['bul', 'bulgaria'],
  ['srb', 'serbia'],
  ['cro', 'croatia', 'croacia'],
  ['slo', 'slovenia', 'eslovenia'],
  ['bih', 'bosniaandherzegovina', 'bosnia', 'bosniaherzegovina'],
  ['mkd', 'northmacedonia', 'macedonia', 'macedoniadelnorte'],
  ['mne', 'montenegro'],
  ['kos', 'kosovo'],
  ['alb', 'albania'],
  ['gre', 'greece', 'grecia'],
  ['tur', 'turkey', 'turquia', 'turquía'],
  ['rus', 'russia', 'rusia'],
  ['ukr', 'ukraine', 'ucrania'],
  ['blr', 'belarus', 'bielorrusia'],
  ['mda', 'moldova', 'moldavia'],
  ['est', 'estonia'],
  ['lat', 'latvia', 'letonia'],
  ['ltu', 'lithuania', 'lituania'],
  ['geo', 'georgia'],
  ['arm', 'armenia'],
  ['aze', 'azerbaijan', 'azerbaiyán', 'azerbaiyan'],
  ['mlt', 'malta'],
  ['cyp', 'cyprus', 'chipre'],
  ['gib', 'gibraltar'],
  ['far', 'faroeislands', 'islasferoe'],
  ['lie', 'liechtenstein'],
  ['and', 'andorra'],
  ['smr', 'sanmarino'],

  // Asia / Oceania
  ['jpn', 'japan', 'japón', 'japon'],
  ['kor', 'southkorea', 'korearepublic', 'coreadelsur', 'corea'],
  ['prk', 'northkorea', 'coreadelnorte'],
  ['chn', 'china', 'chinapr'],
  ['hkg', 'hongkong'],
  ['twn', 'taiwan', 'chinesetaipei'],
  ['ind', 'india'],
  ['idn', 'indonesia'],
  ['mas', 'malaysia', 'malasia'],
  ['sgp', 'singapore', 'singapur'],
  ['tha', 'thailand', 'tailandia'],
  ['vie', 'vietnam'],
  ['phi', 'philippines', 'filipinas'],
  ['mng', 'mongolia'],
  ['kgz', 'kyrgyzstan', 'kirguistan', 'kirguistán'],
  ['kaz', 'kazakhstan', 'kazajistan', 'kazajistán'],
  ['uzb', 'uzbekistan', 'uzbekistán'],
  ['tjk', 'tajikistan', 'tayikistán'],
  ['tkm', 'turkmenistan', 'turkmenistán'],
  ['afg', 'afghanistan', 'afganistan', 'afganistán'],
  ['pak', 'pakistan', 'pakistán'],
  ['ban', 'bangladesh'],
  ['sri', 'srilanka'],
  ['npl', 'nepal'],
  ['mdv', 'maldives', 'maldivas'],
  ['irn', 'iran', 'irán'],
  ['irq', 'iraq', 'irak'],
  ['syr', 'syria', 'siria'],
  ['lbn', 'lebanon', 'libano', 'líbano'],
  ['jor', 'jordan', 'jordania'],
  ['isr', 'israel'],
  ['pse', 'palestine', 'palestina'],
  ['ksa', 'saudiarabia', 'arabiasaudita', 'arabiasaudi'],
  ['qat', 'qatar', 'catar'],
  ['bhr', 'bahrain', 'bahréin', 'bahrein'],
  ['kuw', 'kuwait'],
  ['omn', 'oman', 'omán'],
  ['yem', 'yemen'],
  ['uae', 'unitedarabemirates', 'emiratosarabesunidos', 'emiratos'],
  ['aus', 'australia'],
  ['nzl', 'newzealand', 'nuevazelanda', 'nuevazelandia'],
  ['fij', 'fiji'],
  ['png', 'papuanewguinea', 'papuanuevaguinea'],
  ['sol', 'solomonislands'],
  ['vut', 'vanuatu'],

  // Africa
  ['mar', 'morocco', 'marruecos'],
  ['alg', 'algeria', 'argelia'],
  ['tun', 'tunisia', 'tunez', 'túnez'],
  ['egy', 'egypt', 'egipto'],
  ['lib', 'libya', 'libia'],
  ['sen', 'senegal'],
  ['mli', 'mali'],
  ['gha', 'ghana'],
  ['nga', 'nigeria'],
  ['cmr', 'cameroon', 'camerun', 'camerún'],
  ['civ', 'ivorycoast', 'cotedivoire', 'côtedivoire', 'costademarfil'],
  ['gnb', 'guineabissau'],
  ['gui', 'guinea'],
  ['eqg', 'equatorialguinea', 'guineaecuatorial'],
  ['gab', 'gabon', 'gabón'],
  ['cgo', 'congo', 'congorepublic'],
  ['cod', 'drcongo', 'democraticrepublicofthecongo', 'rdcongo'],
  ['ang', 'angola'],
  ['nam', 'namibia'],
  ['rsa', 'southafrica', 'sudafrica', 'sudáfrica'],
  ['bot', 'botswana', 'botsuana'],
  ['zim', 'zimbabwe'],
  ['zam', 'zambia'],
  ['mwi', 'malawi'],
  ['moz', 'mozambique'],
  ['mri', 'mauritius', 'mauricio'],
  ['mad', 'madagascar'],
  ['com', 'comoros', 'comoras'],
  ['ken', 'kenya'],
  ['uga', 'uganda'],
  ['tan', 'tanzania'],
  ['rwa', 'rwanda', 'ruanda'],
  ['bdi', 'burundi'],
  ['eth', 'ethiopia', 'etiopia', 'etiopía'],
  ['eri', 'eritrea'],
  ['sud', 'sudan', 'sudán'],
  ['ssd', 'southsudan', 'sudandelsur', 'sudándelsur'],
  ['som', 'somalia'],
  ['djb', 'djibouti', 'yibuti'],
  ['cha', 'chad'],
  ['bfa', 'burkinafaso'],
  ['nig', 'niger', 'níger'],
  ['cpv', 'capeverde', 'caboverde'],
  ['gam', 'gambia'],
  ['lbr', 'liberia'],
  ['sle', 'sierraleone', 'sierraleona'],
  ['tog', 'togo'],
  ['ben', 'benin', 'benín'],
  ['cta', 'centralafricanrepublic', 'republicacentroafricana'],
  ['stp', 'saotomeprincipe'],
]

// Build a quick lookup: any normalized name → its canonical alias group index.
const ALIAS_GROUP_INDEX = (() => {
  const m = new Map<string, number>()
  TEAM_ALIASES.forEach((group, i) => {
    for (const variant of group) {
      m.set(normalize(variant), i)
    }
  })
  return m
})()

export function teamsMatch(a: string, b: string): boolean {
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return false
  if (na === nb) return true
  // substring containment (for 'mexico' vs 'mexicofootballteam')
  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) return true

  // Alias group equivalence (Brazil/Brasil, Sudáfrica/SouthAfrica, etc.)
  const ga = ALIAS_GROUP_INDEX.get(na)
  const gb = ALIAS_GROUP_INDEX.get(nb)
  if (ga !== undefined && gb !== undefined && ga === gb) return true

  // Try once more after stripping common suffixes ("national team", "national")
  const stripped = (s: string) =>
    s.replace(/nationalfootballteam$/, '').replace(/nationalteam$/, '').replace(/national$/, '').replace(/team$/, '')
  const sa = stripped(na)
  const sb = stripped(nb)
  if (sa && sb) {
    if (sa === sb) return true
    const sga = ALIAS_GROUP_INDEX.get(sa)
    const sgb = ALIAS_GROUP_INDEX.get(sb)
    if (sga !== undefined && sgb !== undefined && sga === sgb) return true
  }
  return false
}
