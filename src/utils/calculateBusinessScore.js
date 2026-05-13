const HOTEL_CHAINS = [
  'marriott', 'hilton', 'radisson', ' nh ', 'leonardo', 'steigenberger',
  'dorint', 'mövenpick', 'mercure', 'ibis', 'holiday inn', 'sheraton',
  'hyatt', 'accor', 'novotel', 'pullman', 'sofitel', 'renaissance',
  'courtyard', 'crowne plaza', 'westin', 'intercontinental',
]

const WELLNESS_KEYWORDS = ['wellness', 'spa', 'resort', 'thermal', 'therme', 'kúpele', 'bad ']

const CITY_CENTER_KEYWORDS = ['stadtmitte', 'city center', 'zentrum', 'innenstadt', 'hauptbahnhof']

const BASE = { hotel: 30, laundry: 45, spa: 40, wellness: 40, hospital: 30, restaurant: 30 }

const CONF_COLORS = { vysoká: '#00cc88', stredná: '#ffaa00', nízka: '#ef4444' }
export { CONF_COLORS }

export function calculateBusinessScore(company) {
  const category = (company.category || 'hotel').toLowerCase()
  let score      = BASE[category] ?? 30
  const reasoning = [`Základ ${category}: ${score}b`]
  const positive  = []
  const risks     = []

  const name    = (company.name    || '').toLowerCase()
  const address = (company.address || '').toLowerCase()
  const rating  = typeof company.rating === 'number' ? company.rating : null

  // Wellness / spa in name
  if (WELLNESS_KEYWORDS.some(kw => name.includes(kw))) {
    score += 20; positive.push('Wellness / Spa indikátor'); reasoning.push('+20 Wellness/Spa v názve')
  }

  // Rating
  if (rating !== null) {
    if (rating >= 4.5) {
      score += 15; positive.push(`Výborné hodnotenie ${rating}★`); reasoning.push(`+15 Rating ${rating}★`)
    } else if (rating >= 4.0) {
      score += 10; positive.push(`Dobré hodnotenie ${rating}★`); reasoning.push(`+10 Rating ${rating}★`)
    } else if (rating >= 3.5) {
      score += 5; positive.push(`Priemerné hodnotenie ${rating}★`); reasoning.push(`+5 Rating ${rating}★`)
    } else {
      score -= 10; risks.push(`Nízke hodnotenie ${rating}★`); reasoning.push(`-10 Nízky rating ${rating}★`)
    }
  } else {
    risks.push('Bez Google hodnotenia')
  }

  // Chain hotel
  if (HOTEL_CHAINS.some(c => name.includes(c))) {
    score += 10; positive.push('Hotelová reťaz'); reasoning.push('+10 Hotelová reťaz')
  }

  // City centre
  if (CITY_CENTER_KEYWORDS.some(kw => address.includes(kw))) {
    score += 10; positive.push('Centrum mesta'); reasoning.push('+10 Centrum mesta')
  }

  // Website
  if (company.website) {
    score += 10; positive.push('Má webstránku'); reasoning.push('+10 Webstránka')
  } else {
    score -= 10; risks.push('Bez webstránky'); reasoning.push('-10 Bez webu')
  }

  // Email
  if (company.email) {
    score += 15; positive.push('Má email'); reasoning.push('+15 Email k dispozícii')
  }

  // Phone
  if (company.phone) {
    score += 5; positive.push('Má telefón'); reasoning.push('+5 Telefón')
  }

  score = Math.min(100, Math.max(0, score))

  const confidence = score >= 70 ? 'vysoká' : score >= 50 ? 'stredná' : 'nízka'

  const reason =
    score >= 70 ? `Vysoký potenciál — ${positive.slice(0, 2).join(', ')}` :
    score >= 50 ? `Stredný potenciál — ${positive.length ? positive.slice(0, 2).join(', ') : 'obmedzené údaje'}` :
                  `Nízky potenciál — ${risks.slice(0, 1).join(', ') || 'málo dostupných údajov'}`

  const nextStep =
    score >= 70 ? 'Kontaktovať ihneď — vysoký potenciál' :
    score >= 50 ? 'Zaradiť do plánu kontaktovania'       :
                  'Nižšia priorita — kontaktovať neskôr'

  return { score, reason, positive, risks, nextStep, reasoning, confidence }
}
