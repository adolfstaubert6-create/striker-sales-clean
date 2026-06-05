/**
 * signalAnalysis.js — Frontend preliminary signal scoring
 *
 * PHILOSOPHY: We look for companies with a REAL ENERGY PROBLEM who are
 * publicly signaling they're solving it. Marketing language is noise.
 *
 * Same 4-tier system as crawl-signals.js (backend).
 * Used for card-level preview scoring in IntelTargetCard and IntelAgentPanel.
 */

// ── Signal groups — 4 tiers ───────────────────────────────────────────────────

const SIGNAL_GROUPS = [

  // VERY STRONG (+35) — Active investment / heating project
  {
    id:       'active_energy_investment',
    label:    'Aktívna energetická investícia',
    tier:     'VERY_STRONG',
    weight:   35,
    keywords: [
      'heizungsanlage ersetzen', 'heizungsanlage ersetzt', 'heizungsanlage austausch',
      'neue heizungsanlage', 'neuer heizkessel', 'heizkessel ersetzt',
      'heiztechnik modernisiert', 'heizungssystem erneuert',
      'wärmepumpe einbau', 'wärmepumpe installiert', 'wärmepumpe projekt',
      'neue wärmeanlage', 'wärmeerzeugung modernisiert',
      'energieprojekt', 'energetische sanierung', 'energetische modernisierung',
      'investition in energie', 'investition in heizung',
      'heizprojekt', 'wärmeprojekt',
    ],
  },

  // STRONG (+25) — Concrete modernization or cost-pressure evidence
  {
    id:       'modernization_news',
    label:    'Modernizácia / rekonštrukcia',
    tier:     'STRONG',
    weight:   25,
    keywords: [
      'modernisierung', 'modernisiert', 'sanierung', 'saniert',
      'renovierung', 'renoviert', 'umbau', 'umgebaut',
      'erweiterung', 'neubau', 'infrastrukturprojekt',
      'bauarbeiten', 'generalüberholung',
    ],
  },
  {
    id:       'cost_pressure',
    label:    'Tlak nákladov / efektivita',
    tier:     'STRONG',
    weight:   25,
    keywords: [
      'energiekosten', 'heizkosten', 'wärmekosten', 'betriebskosten',
      'kostenreduktion', 'kostensenkung', 'kosten reduzieren',
      'effizienzsteigerung', 'energieverbrauch reduzieren',
      'energieoptimierung', 'energieeffizienz steigern',
      'wirtschaftlichkeit verbessern',
    ],
  },

  // MEDIUM (+15) — Structured ESG / declared CO₂ targets
  {
    id:       'esg_climate',
    label:    'ESG / Klimastratégia',
    tier:     'MEDIUM',
    weight:   15,
    keywords: [
      'esg', 'nachhaltigkeitsbericht', 'sustainability report',
      'klimastrategie', 'klimaziele', 'co2 reduktion', 'co₂ reduktion',
      'co2-neutral', 'klimaneutral', 'dekarbonisierung',
      'klimaschutzprogramm', 'energiewende', 'klimaneutralität bis',
    ],
  },

  // WEAK (+5) — Generic marketing sustainability claims (noise)
  {
    id:       'sustainability_generic',
    label:    'Udržateľnosť (marketing)',
    tier:     'WEAK',
    weight:   5,
    keywords: [
      'nachhaltigkeit', 'nachhaltig', 'umweltfreundlich',
      'ökologisch', 'ressourcenschonung', 'verantwortung',
    ],
  },
]

export { SIGNAL_GROUPS }

// ── Core analysis function ────────────────────────────────────────────────────

/**
 * analyzeCompanySignals
 * @param {object} company   — company/target object (name, segment, city, etc.)
 * @param {string} extraText — optional additional text (scraped page content)
 * @returns {{ detectedSignals, signalCount, preliminaryNeedScore, reason }}
 */
export function analyzeCompanySignals(company, extraText = '') {
  const parts = [
    company.name          || '',
    company.segment       || '',
    company.segmentLabel  || '',
    company.city          || '',
    // liveSignals from reviews/crawl are already stored on the target
    ...(company.liveSignals || []),
    ...(company.signals    || []),
    extraText,
  ]
  const text = parts.join(' ').toLowerCase()

  if (!text.trim()) {
    return { detectedSignals: [], signalCount: 0, preliminaryNeedScore: 0, reason: 'Žiadny text na analýzu.' }
  }

  const detected = []

  for (const group of SIGNAL_GROUPS) {
    const matched = group.keywords.filter(kw => text.includes(kw.toLowerCase()))
    if (matched.length > 0) {
      detected.push({
        id:       group.id,
        label:    group.label,
        tier:     group.tier,
        weight:   group.weight,
        matches:  matched,
        hitCount: matched.length,
      })
    }
  }

  // Score: sum of weights per detected group, capped at 100
  const rawScore           = detected.reduce((s, g) => s + g.weight, 0)
  const preliminaryNeedScore = Math.min(100, rawScore)

  // Reason — distinguish real signal from marketing
  const realSignals = detected.filter(s => s.tier !== 'WEAK')
  const topReal     = [...realSignals].sort((a, b) => b.weight - a.weight).slice(0, 2)
  const hasWeak     = detected.some(s => s.tier === 'WEAK')

  let reason
  if (topReal.length > 0) {
    reason = `Reálny signál: ${topReal.map(s => s.label).join(', ')}${realSignals.length > 2 ? ` +${realSignals.length - 2}` : ''}.`
  } else if (hasWeak) {
    reason = 'Iba marketingový obsah — žiadny reálny energetický signál.'
  } else {
    reason = 'Žiadne signály nenájdené v dostupných dátach.'
  }

  return {
    detectedSignals:    detected,
    signalCount:        detected.length,
    preliminaryNeedScore,
    reason,
  }
}

// Batch helper
export function analyzeCompanySignalsBatch(companies) {
  return companies.map(company => ({
    ...company,
    _signals: analyzeCompanySignals(company),
  }))
}
