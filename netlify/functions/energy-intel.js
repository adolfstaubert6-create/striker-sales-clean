const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY
const CLAUDE_MODEL = 'claude-sonnet-4-6'

const SEGMENT_LABELS = {
  hotel: 'Hotel / Ubytovanie', wellness: 'Wellness / Spa', laundry: 'Priemyselná práčovňa',
  hospital: 'Nemocnica / Klinika', restaurant: 'Reštaurácia / Gastro', food: 'Potravinárstvo',
  brewery: 'Pivovar', industrial: 'Priemysel / Iné',
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  if (!CLAUDE_KEY)               return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY chýba' }) }

  let body
  try { body = JSON.parse(event.body) } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const { companyName, url = '', segment = 'hotel', city = '', country = 'DE', extraContext = '' } = body
  if (!companyName?.trim()) return { statusCode: 400, body: JSON.stringify({ error: 'companyName povinný' }) }

  const segLabel = SEGMENT_LABELS[segment] || segment

  const prompt = `Si STRIKER INTELLIGENCE AI — scoring systém pre B2B klientov kavitačnej vykurovacej technológie.

STRIKER: 45kW elektrický vstup → 120–160kW tepelný výkon (COP 2.7–3.5). Cena 8 000–10 000 EUR.
Ideálne pre: hotely, wellness, práčovne, pivovary, nemocnice, potravinárstvo.

ANALYZUJ:
Firma: ${companyName.trim()}
Segment: ${segLabel}
Lokalita: ${[city, country].filter(Boolean).join(', ')}
Web: ${url || 'neuvedený'}
Kontext: ${extraContext || 'žiadny'}

SCORING — TRI PILIERE (0–100 každý):

STRIKER FIT — štrukturálna pravdepodobnosť na základe typu, veľkosti, veku a prevádzky:
  Hotel s wellness/bazénom/saunou: +30 | Veľký hotel 50+ izieb: +20
  Stará budova 15+ rokov: +25 | Prevádzka 24/7: +15
  Práčovňa / potravinárstvo: +30 | Nemocnica / zariadenie opatrovania: +25
  Plynový/olejový/peletový kotol (pravdepodobný): +20

HEAT COST PROBABILITY — prevádzkový dopyt po teple:
  Bazén / sauna / wellness: +35 | Priemyselná práčovňa (para): +35
  Veľký hotel: +25 | Nemocnica: +30 | Potravinárstvo / pivovar: +30

ENERGY ACTIVITY — verejné signály (sekundárne, nie primárne):
  Aktívna modernizácia / rekonštrukcia vykurovania: +35
  Energetický projekt: +30 | CO2 / dekarbonizácia záväzok: +20
  Všeobecný sustainability marketing: +5 IBA
  Hľadanie Energy/Facility Managera: NIE primárny signál — max +5

overallScore = 0.45 × strikerFitScore + 0.35 × heatCostProbability + 0.20 × energyActivity
recommendation: "immediate" ak overall≥70, "monitor" ak 45–69, "unsuitable" ak <45

Vráť VÝLUČNE valid JSON (bez markdown), text po SLOVENSKY:
{
  "strikerFitScore": <int>,         "strikerFitReason": "<max 10 slov>",
  "heatCostProbability": <int>,     "heatCostProbabilityReason": "<max 10 slov>",
  "energyActivity": <int>,          "energyActivityReason": "<max 10 slov>",
  "heatDemandScore": <int>,
  "energyPainScore": <int>,         "energyPainReason": "<max 10 slov>",
  "urgencyScore": <int>,            "urgencyReason": "<max 10 slov>",
  "financialPowerScore": <int>,     "financialPowerReason": "<max 10 slov>",
  "buyingIntentScore": <int>,       "buyingIntent": "weak|medium|strong",
  "buyingIntentReason": "<max 10 slov>",
  "overallScore": <int>,
  "estimatedSize": "Malá firma|Stredná firma|Veľká firma|Korporácia",
  "estimatedEmployees": "<rozsah>",
  "recommendation": "immediate|monitor|unsuitable",
  "recommendationReason": "<2 vety>",
  "whyFound": "<2–3 vety prečo je firma zaujímavý target>",
  "signals": ["<signál 1>","<signál 2>","<signál 3>"],
  "aiAnalysis": {
    "whatTroubles": "<2 vety>",
    "energyProblem": "<2 vety>",
    "whyStrikerFit": "<2 vety>",
    "mainArgument": "<2 vety>"
  },
  "suggestedContacts": [{"role":"<titul>","relevance":"<prečo>"}],
  "nextStep": "<1 veta>"
}`

  try {
    const res  = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || `Claude ${res.status}`)

    const raw = (data.content?.[0]?.text || '').trim().replace(/^```json\s*/i,'').replace(/```\s*$/i,'').trim()
    let report
    try { report = JSON.parse(raw) } catch { throw new Error('AI vrátil neplatný JSON') }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, companyName: companyName.trim(), segment: segLabel, city, country, report }),
    }
  } catch (err) {
    console.error('[energy-intel]', err.message)
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: err.message }) }
  }
}
