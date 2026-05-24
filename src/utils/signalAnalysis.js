/**
 * Live Signal Engine — Phase 1A
 * Keyword-based signal detection on company text.
 * No crawling, no AI calls — pure text matching foundation.
 */

// ── Signal keyword groups ──────────────────────────────────────────────────────

const SIGNAL_GROUPS = [
  {
    id:       'energy_efficiency',
    label:    'Energy Efficiency',
    weight:   10,
    keywords: [
      'energie', 'energieeffizienz', 'energy efficiency', 'energiesparen',
      'energieverbrauch', 'stromverbrauch', 'wärmepumpe', 'heat pump',
      'energiekosten', 'energy costs', 'energieverantwortlich',
      'niedrigenergie', 'low energy', 'energieoptimierung',
    ],
  },
  {
    id:       'modernization',
    label:    'Modernisierung',
    weight:   9,
    keywords: [
      'modernisierung', 'modernization', 'modernisiert', 'sanierung',
      'renovierung', 'renovation', 'umbau', 'refurbishment',
      'nachrüstung', 'retrofit', 'upgrade', 'erneuerung',
      'instandhaltung', 'maintenance', 'haustechnik',
    ],
  },
  {
    id:       'sustainability',
    label:    'Nachhaltigkeit',
    weight:   9,
    keywords: [
      'nachhaltigkeit', 'sustainability', 'nachhaltig', 'sustainable',
      'umwelt', 'environment', 'ökologie', 'ecology',
      'ressourcenschonung', 'resource', 'klimaschutz', 'climate protection',
      'verantwortung', 'responsibility',
    ],
  },
  {
    id:       'esg',
    label:    'ESG',
    weight:   8,
    keywords: [
      'esg', 'environmental social governance', 'csr',
      'corporate social responsibility', 'nachhaltigkeitsbericht',
      'sustainability report', 'non-financial', 'nicht-finanziell',
      'klimastrategie', 'klimaziele', 'klimaneutral',
    ],
  },
  {
    id:       'co2_reduction',
    label:    'CO₂-Reduzierung',
    weight:   10,
    keywords: [
      'co2', 'co₂', 'carbon', 'treibhausgas', 'greenhouse gas',
      'kohlenstoff', 'emissionen', 'emissions', 'dekarbonisierung',
      'decarbonization', 'klimaneutral', 'carbon neutral',
      'net zero', 'netto null', 'scope 1', 'scope 2', 'scope 3',
      'co2-fußabdruck', 'carbon footprint',
    ],
  },
  {
    id:       'hvac',
    label:    'HVAC / Klima',
    weight:   10,
    keywords: [
      'hvac', 'klimaanlage', 'air conditioning', 'lüftung', 'ventilation',
      'kältetechnik', 'refrigeration', 'heizung', 'heating',
      'klimatisierung', 'gebäudeklimatik', 'raumlufttechnik',
      'kühlung', 'cooling', 'heizkessel', 'boiler',
    ],
  },
  {
    id:       'heating_modernization',
    label:    'Heizungsmodernisierung',
    weight:   10,
    keywords: [
      'heizungsmodernisierung', 'heating modernization',
      'fernwärme', 'district heating', 'wärmenetz',
      'heizungsanlage', 'heating system', 'heiztechnik',
      'wärmeversorgung', 'heat supply', 'heizkesselersatz',
      'brennwert', 'condensing boiler', 'pellets', 'biomasse',
    ],
  },
  {
    id:       'renovation',
    label:    'Gebäuderenovierung',
    weight:   8,
    keywords: [
      'gebäuderenovierung', 'building renovation', 'fassade', 'facade',
      'dämmung', 'insulation', 'wärmedämmung', 'thermal insulation',
      'fenster', 'windows', 'dach', 'roof',
      'gebäudehülle', 'building envelope', 'altbau', 'old building',
    ],
  },
  {
    id:       'green_building',
    label:    'Green Building',
    weight:   8,
    keywords: [
      'green building', 'grünes gebäude', 'leed', 'breeam', 'dgnb',
      'energieausweis', 'energy certificate', 'effizienzhaus',
      'passivhaus', 'passive house', 'nullenergiehaus',
      'zero energy building', 'plusenergiehaus',
    ],
  },
  {
    id:       'decarbonization',
    label:    'Dekarbonisierung',
    weight:   10,
    keywords: [
      'dekarbonisierung', 'decarbonization', 'decarbonisation',
      'klimaneutralität', 'climate neutrality', 'klimaziele',
      'paris agreement', 'pariser abkommen', '1.5 grad', '1.5 degree',
      'energiewende', 'energy transition', 'erneuerbare energien',
      'renewable energy', 'solarenergie', 'solar', 'photovoltaik',
      'windenergie', 'geothermie', 'geothermal',
    ],
  },
]

// ── Core analysis function ─────────────────────────────────────────────────────

/**
 * analyzeCompanySignals
 * @param {object} company — company/target object from Firestore
 * @param {string} [extraText] — optional additional scraped page text
 * @returns {{ detectedSignals, signalCount, preliminaryNeedScore, reason }}
 */
export function analyzeCompanySignals(company, extraText = '') {
  // Build searchable text from available company fields
  const parts = [
    company.name        || '',
    company.description || '',
    company.segment     || '',
    company.segmentLabel || '',
    company.city        || '',
    company.painPoints?.join(' ') || '',
    company.liveSignals?.join(' ') || '',
    extraText,
  ]
  const text = parts.join(' ').toLowerCase()

  if (!text.trim()) {
    return {
      detectedSignals:    [],
      signalCount:        0,
      preliminaryNeedScore: 0,
      reason:             'Žiadny text na analýzu.',
    }
  }

  const detectedSignals = []
  let totalScore = 0

  for (const group of SIGNAL_GROUPS) {
    const matched = group.keywords.filter(kw => text.includes(kw.toLowerCase()))
    if (matched.length > 0) {
      detectedSignals.push({
        id:       group.id,
        label:    group.label,
        weight:   group.weight,
        matches:  matched,
        hitCount: matched.length,
      })
      totalScore += group.weight * Math.min(matched.length, 3)
    }
  }

  // Normalize to 0–100
  const maxPossible = SIGNAL_GROUPS.reduce((s, g) => s + g.weight * 3, 0)
  const preliminaryNeedScore = Math.min(100, Math.round((totalScore / maxPossible) * 100))

  const topSignals = detectedSignals
    .sort((a, b) => b.weight * b.hitCount - a.weight * a.hitCount)
    .slice(0, 3)
    .map(s => s.label)

  const reason = detectedSignals.length > 0
    ? `Detekované oblasti: ${topSignals.join(', ')}${detectedSignals.length > 3 ? ` a ${detectedSignals.length - 3} ďalšie` : ''}.`
    : 'Žiadne signálne kľúčové slová nenájdené v dostupnom texte.'

  return {
    detectedSignals,
    signalCount:        detectedSignals.length,
    preliminaryNeedScore,
    reason,
  }
}

// ── Convenience: batch analyze ────────────────────────────────────────────────

export function analyzeCompanySignalsBatch(companies) {
  return companies.map(company => ({
    ...company,
    _signals: analyzeCompanySignals(company),
  }))
}

export { SIGNAL_GROUPS }
