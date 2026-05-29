// Mapping of FIFA 3-letter codes to ISO 3166-1 alpha-2 codes used by flagcdn.com
const FIFA_TO_ISO: Record<string, string> = {
  ALB: 'al', ALG: 'dz', ARG: 'ar', AUS: 'au', AUT: 'at', BEL: 'be', BIH: 'ba',
  BRA: 'br', BUL: 'bg', CAN: 'ca', CHL: 'cl', CIV: 'ci', COD: 'cd', COL: 'co',
  CPV: 'cv', CRC: 'cr', CRO: 'hr', CUW: 'cw', CZE: 'cz', DEN: 'dk', DOM: 'do',
  ECU: 'ec', EGY: 'eg', ENG: 'gb-eng', ESP: 'es', FIN: 'fi', FRA: 'fr',
  GEO: 'ge', GER: 'de', GHA: 'gh', GIB: 'gi', GRE: 'gr', GUM: 'gu',
  HAI: 'ht', HON: 'hn', IND: 'in', IRN: 'ir', IRQ: 'iq', ISL: 'is', ISR: 'il',
  ITA: 'it', JAM: 'jm', JOR: 'jo', JPN: 'jp', KEN: 'ke', KGZ: 'kg', KOR: 'kr',
  KOS: 'xk', KSA: 'sa', LUX: 'lu', MAD: 'mg', MAR: 'ma', MEX: 'mx', MKD: 'mk',
  MLT: 'mt', MNE: 'me', MNG: 'mn', NED: 'nl', NGA: 'ng', NOR: 'no', NZL: 'nz',
  PAN: 'pa', PAR: 'py', PER: 'pe', PHI: 'ph', POL: 'pl', POR: 'pt', PRT: 'pt',
  QAT: 'qa', ROU: 'ro', RSA: 'za', SCO: 'gb-sct', SEN: 'sn', SGP: 'sg',
  SLV: 'sv', SRB: 'rs', SUI: 'ch', SVK: 'sk', SWE: 'se', TRI: 'tt', TUN: 'tn',
  TUR: 'tr', UKR: 'ua', URU: 'uy', USA: 'us', UZB: 'uz', VEN: 've',
  VGB: 'vg', WAL: 'gb-wls', ZIM: 'zw',
}

export function flagUrl(fifaCode?: string | null, size: 'sm' | 'md' = 'sm'): string | null {
  if (!fifaCode) return null
  const iso = FIFA_TO_ISO[fifaCode.toUpperCase()]
  if (!iso) return null
  const w = size === 'sm' ? 40 : 80
  return `https://flagcdn.com/w${w}/${iso}.png`
}
