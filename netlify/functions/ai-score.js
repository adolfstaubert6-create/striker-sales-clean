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
  if (!company) {
    return { statusCode: 400, body: JSON.stringify({ error: 'company required' }) }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }) }
  }

  try {
    const client = new Anthropic({ apiKey })

    const prompt = `Ohodnoť potenciál tejto firmy ako zákazníka pre STRIKER Wärmetechnologie.

STRIKER predáva priemyselný tepelný systém: 45 kW elektrická spotreba → 120-160 kW tepelný výkon (70% úspora vs. konvenčné systémy). Cena: od 8 000 EUR. Ideálni zákazníci: hotely, práčovne, nemocnice, wellness centrá — kdekoľvek s vysokou spotrebou teplej vody alebo vykurovania.

Firma:
- Názov: ${company.name}
- Kategória: ${company.category}
- Mesto: ${company.city}, Nemecko
- Hodnotenie: ${company.rating ? company.rating + '/5' : 'neznáme'}
${company.address ? `- Adresa: ${company.address}` : ''}

Odpovedz VÝLUČNE v JSON formáte (bez markdown, bez kódu):
{"score": <číslo 0-100>, "reason": "<max 120 znakov, prečo>"}

Score 80-100 = vysoký potenciál, 50-79 = stredný, 0-49 = nízky.`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].text.trim()
    const parsed = JSON.parse(raw)

    if (typeof parsed.score !== 'number' || !parsed.reason) {
      throw new Error('Invalid AI response format')
    }

    console.log(`[ai-score] ${company.name}: ${parsed.score}/100`)
    return {
      statusCode: 200,
      body: JSON.stringify({ score: parsed.score, reason: parsed.reason })
    }

  } catch (err) {
    console.error('[ai-score] Error:', err.message)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
