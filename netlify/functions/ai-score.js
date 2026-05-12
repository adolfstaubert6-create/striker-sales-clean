const Anthropic = require('@anthropic-ai/sdk')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { company } = body
  if (!company?.name) {
    return { statusCode: 400, body: JSON.stringify({ error: 'company.name required' }) }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }) }
  }

  const isSpa      = company.category === 'spa'
  const isLaundry  = company.category === 'laundry'
  const isHotel    = company.category === 'hotel' || (!isSpa && !isLaundry)

  const prompt = `Si AI asistent pre spoločnosť STRIKER Wärmetechnologie.

STRIKER predáva priemyselný tepelný systém:
- Vstup: 45 kW elektrina → Výstup: 120–160 kW tepelná energia
- Úspora: 60–70% oproti konvenčnému vykurovaniu
- Cena: od 8 000 EUR
- Ideálni zákazníci: hotely, práčovne, wellness/spa, nemocnice — prevádzky s vysokou spotrebou teplej vody alebo vykurovania

Hodnotiace kritériá pre ${isHotel ? 'hotel' : isLaundry ? 'práčovňu' : 'wellness/spa'}:
${isHotel ? `- Veľkosť hotela: väčší hotel = viac teplej vody = vyššie skóre
- Poloha: centrum mesta = pravdepodobne väčší hotel = bonus +10
- Hodnotenie 4★ a viac = profesionálna správa = bonus +10
- Wellness/spa súčasť hotela = bonus +15
- Počet hviezd alebo izba naznačená v názve = bonus` : ''}
${isLaundry ? `- Priemyselná práčovňa = maximálny potenciál (teplo na pranie)
- Veľkosť prevádzky podľa adresy (priemyselná zóna = väčšia)
- Počet zamestnancov naznačený v názve` : ''}
${isSpa ? `- Wellness/spa = veľmi vysoká spotreba teplej vody = bonus +20
- Veľkosť zariadenia
- Hotelový spa vs. standalone spa` : ''}

Firma na ohodnotenie:
- Názov: ${company.name}
- Kategória: ${company.category || 'hotel'}
- Mesto: ${company.city || '–'}, ${company.country || 'Nemecko'}
- Google hodnotenie: ${company.rating ? company.rating + ' / 5' : '–'}
- Adresa: ${company.address || '–'}
- Web: ${company.website || '–'}

Odpovedz VÝLUČNE v JSON formáte (žiadny markdown, žiadny text mimo JSON):
{
  "score": <celé číslo 0-100>,
  "reason": "<1 veta v slovenčine, max 100 znakov, prečo je skóre také>",
  "positive": ["<faktor v slovenčine>", "<faktor>"],
  "risks": ["<riziko v slovenčine>"],
  "nextStep": "<konkrétny odporúčaný ďalší krok v slovenčine, max 80 znakov>"
}`

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 350,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw    = message.content[0].text.trim()
    const parsed = JSON.parse(raw)

    if (typeof parsed.score !== 'number' || parsed.score < 0 || parsed.score > 100) {
      throw new Error('Invalid score value')
    }

    console.log(`[ai-score] ${company.name}: ${parsed.score}/100 — ${parsed.reason}`)
    return {
      statusCode: 200,
      body: JSON.stringify({
        score:    Math.round(parsed.score),
        reason:   parsed.reason   || '',
        positive: parsed.positive || [],
        risks:    parsed.risks    || [],
        nextStep: parsed.nextStep || '',
      }),
    }
  } catch (err) {
    console.error('[ai-score] Error:', err.message)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
