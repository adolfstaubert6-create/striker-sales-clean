// ── Hotels / chains ──────────────────────────────────────────────────────────
const HOTEL_CHAINS = [
  'marriott', 'hilton', 'radisson', 'leonardo', 'steigenberger', 'dorint',
  'mövenpick', 'mercure', 'ibis', 'holiday inn', 'sheraton', 'hyatt',
  'accor', 'novotel', 'pullman', 'sofitel', 'renaissance', 'courtyard',
  'crowne plaza', 'westin', 'intercontinental', 'kempinski', 'rogner',
]

// ── Core business factors (checked on company name) ───────────────────────
const CORE_FACTORS = [
  {
    test: n => /wellness|spa\b|therme|thermal|kúpele|schwimmbad|hallenbad|aqua\b/i.test(n),
    pts: 20, label: 'Wellness / SPA', insight: 'vysoká spotreba teplej vody',
  },
  {
    test: n => /\bpool\b|freibad|hallenbad|badesee|schwimmen/i.test(n),
    pts: 15, label: 'Bazén', insight: 'nepretržitý ohrev bazéna',
  },
  {
    test: n => /sauna|dampfbad|saunabad/i.test(n),
    pts: 10, label: 'Sauna', insight: 'sauna — intenzívna tepelná záťaž',
  },
  {
    test: n => /grand|palace|imperial|luxury|luxus|premium|5-sterne|5 sterne|5star/i.test(n),
    pts: 12, label: 'Luxusný hotel', insight: 'vysoké nároky na komfort a TÚV',
  },
  {
    test: n => /resort|feriendorf|ferienanlage|club hotel|club med/i.test(n),
    pts: 10, label: 'Resort', insight: 'celoročná prevádzka, komplexná infraštruktúra',
  },
  {
    test: n => /restaurant|gasthof|gasthaus|brauhaus|stüberl|wirtschaft|bräu\b/i.test(n),
    pts: 8,  label: 'Reštaurácia', insight: 'varenie a ohrev pre gastro prevádzku',
  },
  {
    test: n => /24.?7|nonstop|non-stop|ganzjährig|all.?year/i.test(n),
    pts: 10, label: '24/7 prevádzka', insight: 'nepretržitá potreba tepla',
  },
  {
    test: n => HOTEL_CHAINS.some(c => n.includes(c)),
    pts: 10, label: 'Hotelová reťaz', insight: 'štandardizovaná infraštruktúra — ľahké rozhodovanie',
  },
]

// ── Location modifiers (checked on address + city combined) ──────────────
const LOCATION_FACTORS = [
  {
    test: l => /arlberg|zermatt|davos|kitzbüh|oberstdorf|garmisch|lech\b|sölden|ötztal|zillertal|zugspitz|st\.\s*anton|mayrhofen|schladming|bad gastein/i.test(l),
    pts: 20, label: 'Lyžiarska oblasť', insight: 'dlhá zimná sezóna predlžuje vykurovaciu potrebu',
  },
  {
    test: l => /alp|alpen|allgäu|berchtesgaden|schwarzwald|bayerischer wald|tirol|tyrol|vorarlberg|graubünden|wallis|kärnten|steiermark/i.test(l),
    pts: 15, label: 'Horská oblasť', insight: 'chladné podnebie predlžuje sezónu vykurovania',
  },
  {
    test: l => /bad\s+[a-záäöü]/i.test(l),
    pts: 12, label: 'Kúpeľné mesto', insight: 'kúpeľné mestá = vysoká celoročná spotreba TÚV',
  },
  {
    test: l => /salzburg|innsbruck|berchtesgaden|bodensee|chiemsee|tegernsee|starnberg|ammersee|bavarian|chiemgau/i.test(l),
    pts: 12, label: 'Turistická destinácia', insight: 'celoročná obsadenosť',
  },
  {
    test: l => /münchen|munich|wien|vienna|zürich|bern|genf|geneva|frankfurt|hamburg/i.test(l),
    pts: 10, label: 'Veľké mesto', insight: 'mestský hotel s vysokou obsadenosťou',
  },
]

// ── Sales friction factors ────────────────────────────────────────────────
const FRICTION_FACTORS = [
  {
    test: (n, _a, company) => !company.website,
    pts: -7, label: 'Bez webstránky',
  },
  {
    test: (n, _a, company) => !company.address || company.address.trim().length < 5,
    pts: -5, label: 'Neznáma adresa',
  },
  {
    test: (n) => /\bklein\b|\bkleines\b|zimmer\b|zimmervermiet|pension\b/i.test(n),
    pts: -5, label: 'Malá prevádzka',
  },
]

// ── Scoring bases by category ─────────────────────────────────────────────
const BASE = { hotel: 30, laundry: 45, spa: 40, wellness: 40, hospital: 30, restaurant: 30 }

// ── Insight sentence generator ────────────────────────────────────────────
function buildInsight(category, appliedCore, appliedLocation, score) {
  const positive = [...appliedCore, ...appliedLocation].filter(f => f.pts > 0)
  const topInsights = positive.slice(0, 2).map(f => f.insight).filter(Boolean)

  const base = category === 'laundry' ? 'Práčovňa'
             : category === 'spa'     ? 'Wellness zariadenie'
             : 'Hotel'

  if (topInsights.length === 0) {
    return score >= 70
      ? `${base} s vysokým potenciálom úspory nákladov na kúrenie.`
      : `${base} — potenciál závisí od veľkosti prevádzky a spotreby TÚV.`
  }

  const joined = topInsights.join('; ')
  const suffix = score >= 75 ? ' Silný kandidát pre STRIKER.' : ''
  return `${base} — ${joined}.${suffix}`
}

// ── Rating points ─────────────────────────────────────────────────────────
const CONF_COLORS = { vysoká: '#00cc88', stredná: '#ffaa00', nízka: '#ef4444' }
export { CONF_COLORS }

// ── Main scoring function ─────────────────────────────────────────────────
export function calculateBusinessScore(company) {
  const category = (company.category || 'hotel').toLowerCase()
  let score      = BASE[category] ?? 30

  const name     = (company.name    || '').toLowerCase()
  const location = ((company.address || '') + ' ' + (company.city || '')).toLowerCase()
  const rating   = typeof company.rating === 'number' ? company.rating : null

  const positive = []
  const risks    = []
  const reasoning = [`Základ ${category}: ${score}b`]

  // ── Core business factors ────────────────────────────────────────────────
  const appliedCore = CORE_FACTORS.filter(f => f.test(name))
  for (const f of appliedCore) {
    score += f.pts
    positive.push(f.label)
    reasoning.push(`+${f.pts} ${f.label}`)
  }

  // ── Location modifiers ───────────────────────────────────────────────────
  const appliedLocation = LOCATION_FACTORS.filter(f => f.test(location))
  for (const f of appliedLocation) {
    score += f.pts
    positive.push(f.label)
    reasoning.push(`+${f.pts} ${f.label}`)
  }

  // ── Rating ───────────────────────────────────────────────────────────────
  if (rating !== null) {
    if      (rating >= 4.5) { score += 15; positive.push(`Hodnotenie ${rating}★`);  reasoning.push(`+15 Rating ${rating}★`) }
    else if (rating >= 4.0) { score += 10; positive.push(`Hodnotenie ${rating}★`);  reasoning.push(`+10 Rating ${rating}★`) }
    else if (rating >= 3.5) { score +=  5; positive.push(`Hodnotenie ${rating}★`);  reasoning.push(` +5 Rating ${rating}★`) }
    else                    { score -= 10; risks.push(`Nízke hodnotenie ${rating}★`); reasoning.push(`-10 Rating ${rating}★`) }
  } else {
    risks.push('Bez Google hodnotenia')
  }

  // ── Contact data bonuses ─────────────────────────────────────────────────
  if (company.email)   { score += 15; positive.push('Email k dispozícii');  reasoning.push('+15 Email') }
  if (company.phone)   { score +=  5; positive.push('Telefón');              reasoning.push(' +5 Telefón') }

  // ── Sales friction ───────────────────────────────────────────────────────
  const appliedFriction = FRICTION_FACTORS.filter(f => f.test(name, location, company))
  for (const f of appliedFriction) {
    score += f.pts
    risks.push(f.label)
    reasoning.push(`${f.pts} ${f.label}`)
  }

  score = Math.min(100, Math.max(0, score))

  // ── Key factors for card display (top 2 positive + top 2 negative) ──────
  const topPositive = [...appliedCore, ...appliedLocation]
    .filter(f => f.pts > 0)
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 2)
    .map(f => f.label)

  const topNegative = appliedFriction
    .slice(0, 2)
    .map(f => `-${f.label}`)

  if (rating !== null && rating < 3.5 && topNegative.length < 2)
    topNegative.push(`-Nízke hodnotenie ${rating}★`)

  const keyFactors = [...topPositive, ...topNegative].slice(0, 4)

  // ── Confidence & derived fields ──────────────────────────────────────────
  const confidence = score >= 70 ? 'vysoká' : score >= 50 ? 'stredná' : 'nízka'

  const reason =
    score >= 70 ? `Vysoký potenciál — ${topPositive.slice(0, 2).join(', ') || positive.slice(0, 2).join(', ')}` :
    score >= 50 ? `Stredný potenciál — ${positive.length ? positive.slice(0, 2).join(', ') : 'obmedzené údaje'}` :
                  `Nízky potenciál — ${risks.slice(0, 2).join(', ') || 'málo dostupných údajov'}`

  const nextStep =
    score >= 70 ? 'Kontaktovať ihneď — vysoký potenciál' :
    score >= 50 ? 'Zaradiť do plánu kontaktovania'       :
                  'Nižšia priorita — kontaktovať neskôr'

  const aiInsight = buildInsight(category, appliedCore, appliedLocation, score)

  return { score, reason, positive, risks, nextStep, reasoning, confidence, keyFactors, aiInsight }
}
