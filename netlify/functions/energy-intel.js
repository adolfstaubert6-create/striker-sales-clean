const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY
const CLAUDE_MODEL = 'claude-sonnet-4-6'

const SEGMENT_LABELS = {
  hotel:      'Hotel / Ubytovanie',
  wellness:   'Wellness / Spa / Kúpele',
  laundry:    'Priemyselná práčovňa',
  hospital:   'Nemocnica / Klinika',
  restaurant: 'Reštaurácia / Gastro',
  food:       'Potravinárstvo / Výroba',
  brewery:    'Pivovar',
  dryer:      'Sušiareň / Agrárna prevádzka',
  industrial: 'Priemysel / Iné',
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Nepovolená metóda' }) }
  }
  if (!CLAUDE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY nie je nakonfigurovaný' }) }
  }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Neplatné JSON telo' }) }
  }

  const { companyName, url = '', segment = 'hotel', city = '', country = 'DE', companySize = '', employees = '', extraContext = '' } = body
  if (!companyName?.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Názov firmy je povinný' }) }
  }

  const segLabel = SEGMENT_LABELS[segment] || segment

  const prompt = `Si STRIKER INTELLIGENCE AI — systém na hodnotenie B2B klientov pre kavitačnú vykurovaciu technológiu STRIKER.

STRIKER technológia: 45kW elektrický vstup → 120–160kW tepelný výkon (COP 2.7–3.5).
Cena: 8 000–10 000 EUR. Návratnosť: 6–36 mesiacov.
Ideálne pre: vysoká spotreba TÚV, hotely, wellness, práčovne, pivovary, nemocnice, potravinárstvo.

ANALYZUJ TÚTO FIRMU:
Firma: ${companyName.trim()}
Segment: ${segLabel}
Lokalita: ${[city, country].filter(Boolean).join(', ')}
Web: ${url || 'neuvedený'}
Veľkosť: ${companySize || 'neznáma'}
Zamestnanci: ${employees || 'neznámy počet'}
Kontext: ${extraContext || 'žiadny'}

Použi všetky dostupné informácie vrátane tréningových dát (ak firmu poznáš) a urob vzdelané hodnotenie.
Ak firma nie je v tvojich dátach, odhadni konzervatívne na základe segmentu + lokality.

HODNOTENIE (0–100 každé kritérium):

1. STRIKER FIT — Celková vhodnosť pre STRIKER technológiu
   = kombinácia tepelnej potreby, finančnej sily, technickej vhodnosti, ROI potenciálu
   Výpočet: heatDemand×0.40 + financialPower×0.30 + energyPain×0.20 + urgency×0.10

2. ENERGETICKÝ PROBLÉM (energyPainScore) — Bolesť s nákladmi na energie
   Signály: drahý plyn, ESG záväzky, CO2 ciele, energetický audit, stará kotolňa, rastúce ceny

3. URGENTNOSŤ (urgencyScore) — Naliehavosť riešenia
   Signály: prebiehajúca rekonštrukcia, stará kotolňa (10+ rokov), investorský tlak, ESG deadline

4. FINANČNÁ SILA (financialPowerScore) — Schopnosť kúpiť za 8–10K EUR
   Faktory: veľkosť, segment, luxusný vs. budget, odhadovaný obrat

5. ZÁUJEM O KÚPU (buyingIntentScore) — Zámer nakupovať
   weak (0–40): žiadne verejné signály
   medium (41–70): zmienka o úspore, audit, obnova
   strong (71–100): tender, energy manager hiring, modernizácia, dotácia

TEPELNÁ POTREBA (heatDemandScore) — referencia:
  Wellness/Spa: 88–95, Práčovňa: 83–90, Pivovar: 80–88, Hotel: 72–85, Nemocnica: 68–78, Potravinárstvo: 65–75

ODPORÚČANIE:
  "immediate"     ak strikerFit ≥ 70 ALEBO buyingIntent = strong → Kontaktovať okamžite
  "monitor"       ak strikerFit 45–69                              → Sledovať
  "unsuitable"    ak strikerFit < 45                               → Nevhodné
  "prepare_offer" ak firma je vhodná ale potrebuje individuálnu ponuku

Vráť VÝLUČNE valid JSON bez markdown, všetky textové hodnoty po SLOVENSKY:
{
  "strikerFitScore": <int 0-100>,
  "strikerFitReason": "<max 12 slov po slovensky>",
  "energyPainScore": <int 0-100>,
  "energyPainReason": "<max 12 slov po slovensky>",
  "urgencyScore": <int 0-100>,
  "urgencyReason": "<max 12 slov po slovensky>",
  "financialPowerScore": <int 0-100>,
  "financialPowerReason": "<max 12 slov po slovensky>",
  "buyingIntentScore": <int 0-100>,
  "buyingIntent": "weak|medium|strong",
  "buyingIntentReason": "<max 12 slov po slovensky>",
  "overallScore": <int 0-100>,
  "estimatedSize": "Malá firma|Stredná firma|Veľká firma|Korporácia",
  "estimatedEmployees": "<rozsah napr. 50–200>",
  "recommendation": "immediate|monitor|unsuitable|prepare_offer",
  "recommendationReason": "<2 vety po slovensky, prečo toto odporúčanie>",
  "whyFound": "<2–3 vety po slovensky, prečo je firma zaujímavá ako target>",
  "signals": ["<signál 1>", "<signál 2>", "<signál 3>", "<signál 4>"],
  "aiAnalysis": {
    "whatTroubles": "<2–3 vety: čo firmu pravdepodobne trápi>",
    "energyProblem": "<2–3 vety: aký energetický problém pravdepodobne má>",
    "whyStrikerFit": "<2–3 vety: prečo je STRIKER vhodný práve pre túto firmu>",
    "mainArgument": "<2–3 vety: hlavný obchodný argument pre STRIKER>"
  },
  "suggestedContacts": [
    { "role": "<titul po slovensky alebo nemecky>", "relevance": "<prečo je tento kontakt dôležitý>" },
    { "role": "<titul>", "relevance": "<dôvod>" }
  ],
  "nextStep": "<1 veta: konkrétny ďalší krok po slovensky>"
}`

  try {
    const res  = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
      body:    JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1400, messages: [{ role: 'user', content: prompt }] }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || `Claude API ${res.status}`)

    const raw = (data.content?.[0]?.text || '').trim()
      .replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()

    let report
    try { report = JSON.parse(raw) }
    catch { throw new Error('AI vrátil neplatný formát odpovede') }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, companyName: companyName.trim(), segment: segLabel, city, country, report }),
    }
  } catch (err) {
    console.error('[energy-intel]', err.message)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message }),
    }
  }
}
