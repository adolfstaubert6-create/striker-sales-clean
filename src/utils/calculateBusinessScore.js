const HOTEL_CHAINS = [
  'hilton', 'marriott', 'ihg', 'radisson', 'hyatt', 'sheraton',
  'westin', 'dorint', 'steigenberger', 'intercontinental',
  'holiday inn', 'mercure', 'novotel', 'ibis', 'pullman',
  'sofitel', 'mövenpick', 'renaissance', 'courtyard', 'crowne plaza',
]

const WELLNESS_KEYWORDS = ['wellness', 'spa', 'resort', 'congress', 'kongresshotel']

const CITY_CENTER_KEYWORDS = ['hauptbahnhof', 'stadtmitte', 'zentrum', 'platz', 'markt']

export function calculateBusinessScore(company) {
  let score = 0
  const positive = []
  const risks    = []
  const name     = (company.name    || '').toLowerCase()
  const address  = (company.address || '').toLowerCase()
  const rating   = typeof company.rating === 'number' ? company.rating : null

  // ── Rating (max 25 pts) ─────────────────────────────────────
  if (rating !== null) {
    if      (rating >= 4.5) { score += 25; positive.push(`Výborné hodnotenie ${rating}★`) }
    else if (rating >= 4.0) { score += 20; positive.push(`Dobré hodnotenie ${rating}★`) }
    else if (rating >= 3.5) { score += 10; positive.push(`Priemerné hodnotenie ${rating}★`) }
    else                    { score +=  5; risks.push(`Nízke hodnotenie ${rating}★`) }

    // Rating 4.0+ bonus +10
    if (rating >= 4.0) { score += 10; }
  } else {
    risks.push('Bez Google hodnotenia')
  }

  // ── Hotel chain bonus +20 ───────────────────────────────────
  if (HOTEL_CHAINS.some(c => name.includes(c))) {
    score += 20
    positive.push('Hotelová reťaz')
  }

  // ── Website +10 ─────────────────────────────────────────────
  if (company.website) {
    score += 10
    positive.push('Má webstránku')
  } else {
    risks.push('Bez webstránky')
  }

  // ── Phone +5 ────────────────────────────────────────────────
  if (company.phone) {
    score += 5
    positive.push('Má telefónny kontakt')
  }

  // ── Wellness / spa in name +15 ──────────────────────────────
  if (WELLNESS_KEYWORDS.some(kw => name.includes(kw))) {
    score += 15
    positive.push('Wellness / Spa indikátor')
  }

  // ── City centre in address +15 ──────────────────────────────
  if (CITY_CENTER_KEYWORDS.some(kw => address.includes(kw))) {
    score += 15
    positive.push('Centrum mesta')
  }

  score = Math.min(100, score)

  // ── Reason ──────────────────────────────────────────────────
  let reason
  if (score >= 80)      reason = `Vysoký potenciál — ${positive.slice(0, 2).join(', ')}`
  else if (score >= 50) reason = `Stredný potenciál — ${positive.length ? positive.slice(0, 2).join(', ') : 'obmedzené údaje'}`
  else                  reason = `Nízky potenciál — ${risks.slice(0, 1).join(', ') || 'málo dostupných údajov'}`

  const nextStep =
    score >= 80 ? 'Kontaktovať ihneď — vysoký potenciál' :
    score >= 50 ? 'Zaradiť do plánu kontaktovania'       :
                  'Nižšia priorita — kontaktovať neskôr'

  return { score, reason, positive, risks, nextStep }
}
