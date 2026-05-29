// Mapping of FIFA 3-letter codes to ISO 3166-1 alpha-2 codes used by flagcdn.com
const FIFA_TO_ISO: Record<string, string> = {
  ALG: 'dz', ARG: 'ar', AUS: 'au', AUT: 'at', BEL: 'be', BIH: 'ba', BRA: 'br',
  CAN: 'ca', CHL: 'cl', CIV: 'ci', COD: 'cd', COL: 'co', CPV: 'cv', CRC: 'cr',
  CRO: 'hr', CUW: 'cw', CZE: 'cz', DEN: 'dk', ECU: 'ec', EGY: 'eg',
  ENG: 'gb-eng', ESP: 'es', FRA: 'fr', GER: 'de', GHA: 'gh', GRE: 'gr',
  HAI: 'ht', HON: 'hn', IRN: 'ir', IRQ: 'iq', ITA: 'it', JAM: 'jm', JOR: 'jo',
  JPN: 'jp', KOR: 'kr', KSA: 'sa', MAR: 'ma', MEX: 'mx', NED: 'nl', NGA: 'ng',
  NOR: 'no', NZL: 'nz', PAN: 'pa', PAR: 'py', PER: 'pe', POL: 'pl', POR: 'pt',
  PRT: 'pt', QAT: 'qa', ROU: 'ro', RSA: 'za', SCO: 'gb-sct', SEN: 'sn',
  SLV: 'sv', SRB: 'rs', SUI: 'ch', SWE: 'se', TUN: 'tn', TUR: 'tr', UKR: 'ua',
  URU: 'uy', USA: 'us', UZB: 'uz', VEN: 've', WAL: 'gb-wls',
}

export function flagUrl(fifaCode?: string | null, size: 'sm' | 'md' = 'sm'): string | null {
  if (!fifaCode) return null
  const iso = FIFA_TO_ISO[fifaCode.toUpperCase()]
  if (!iso) return null
  const w = size === 'sm' ? 40 : 80
  return `https://flagcdn.com/w${w}/${iso}.png`
}
