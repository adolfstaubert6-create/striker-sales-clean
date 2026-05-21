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
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }
  if (!CLAUDE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) }
  }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const { companyName, url = '', segment = 'hotel', city = '', country = 'DE', extraContext = '' } = body
  if (!companyName?.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'companyName is required' }) }
  }

  const segLabel = SEGMENT_LABELS[segment] || segment

  const prompt = `Si STRIKER INTELLIGENCE AI — systém na hodnotenie B2B klientov pre kavitačnú vykurovaciu technológiu.

STRIKER technológia: 45kW el. vstup → 120–160kW tepelný výkon (COP 2.7–3.5).
Cena: 8 000–10 000 EUR. Návratnosť: 6–36 mesiacov.
Ideálne pre: vysoká spotreba TÚV a tepla, hotely, wellness, práčovne, pivovary, nemocnice, potravinárstvo.

ANALYZUJ FIRMU:
Firma: ${companyName.trim()}
Segment: ${segLabel}
Lokalita: ${[city, country].filter(Boolean).join(', ')}
Web: ${url || 'neuvedený'}
Dodatočné info: ${extraContext || 'žiadne'}

Použi všetky dostupné info (vrátane tréningových dát ak firmu poznáš) a urob vzdelané hodnotenie podľa 7 kritérií.
Ak firma nie je v tvojich dátach, odhadni na základe segmentu + lokality + veľkosti.

SCORING KRITÉRIÁ (0–100):

1. HEAT_DEMAND_SCORE — Potreba tepla / TÚV
   Referencia: Wellness/Spa 88–95, Práčovňa 83–90, Pivovar 80–88, Hotel 72–85, Nemocnica 68–78, Potravinárstvo 65–75

2. ENERGY_PAIN_SCORE — Bolesť s nákladmi na energie
   Signály: drahý plyn, ESG záväzky, CO2 ciele, energetický audit, starý kotol, rastúce ceny energií, ISO certifikáty

3. BUYING_INTENT — Zámer nakupovať (weak / medium / strong)
   Signály strong: tender na vykurovanie, energy/facility manager hiring, prebieha modernizácia, grant/dotácia
   Signály medium: obnova budovy, energetický audit, zmienka o úspore
   Signály weak: žiadne verejné signály, nová firma, neznáma situácia

4. FINANCIAL_POWER_SCORE — Schopnosť platiť 8–10K EUR
   Faktory: počet izieb/pobočiek, zamestnancov, luxusný vs. budget segment, odhadovaný obrat

5. STRIKER_FIT_SCORE — Celková vhodnosť pre STRIKER
   = tepelná potreba + finančná sila + technická vhodnosť + ROI potenciál
   Výpočet: heatDemand×0.40 + financialPower×0.30 + energyPain×0.20 + urgency×0.10

6. URGENCY_SCORE — Naliehavosť
   Signály: prebiehajúca rekonštrukcia, stará kotolňa (10+ rokov), investorský tlak, ESG deadline, nahrádzanie plynu

7. DECISION_MAKERS — Typickí rozhoduvatelia pre ${segLabel}
   Uveď 2–4 relevantné tituly (CEO, Geschäftsführer, Facility Manager, Energy Manager, Technical Director, Operations Manager)

PRAVIDLÁ:
- overallScore = strikerFit×0.35 + heatDemand×0.25 + energyPain×0.15 + financialPower×0.15 + urgency×0.10
- recommendation: "immediate" ak overall≥70 ALEBO buyingIntent=strong; "monitor" ak 45–69; "unsuitable" ak <45
- Priemerne vhodná firma = overall 55–70
- signals: 3–5 konkrétnych faktov alebo odhadov naznačujúcich potenciál alebo riziko

Vráť VÝLUČNE valid JSON (žiadny markdown, žiadny text navyše):
{
  "heatDemandScore": <int 0-100>,
  "heatDemandReason": "<max 12 slov>",
  "energyPainScore": <int 0-100>,
  "energyPainReason": "<max 12 slov>",
  "buyingIntent": "weak|medium|strong",
  "buyingIntentReason": "<max 12 slov>",
  "financialPowerScore": <int 0-100>,
  "financialPowerReason": "<max 12 slov>",
  "strikerFitScore": <int 0-100>,
  "strikerFitReason": "<max 12 slov>",
  "urgencyScore": <int 0-100>,
  "urgencyReason": "<max 12 slov>",
  "overallScore": <int 0-100>,
  "decisionMakers": ["<titul>", "<titul>", "<titul>"],
  "signals": ["<signál>", "<signál>", "<signál>", "<signál>"],
  "recommendation": "immediate|monitor|unsuitable",
  "reasoning": "<2–3 vety zdôvodnenie odporúčania>",
  "nextStep": "<1 veta konkrétny ďalší krok>"
}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
      body:    JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 900, messages: [{ role: 'user', content: prompt }] }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || `Claude API ${res.status}`)

    const raw = (data.content?.[0]?.text || '').trim()
      .replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()

    let report
    try { report = JSON.parse(raw) }
    catch { throw new Error('AI vrátil neplatný JSON') }

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
