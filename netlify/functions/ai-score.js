const Anthropic = require('@anthropic-ai/sdk')
const { SCORING_MODEL } = require('./scoringCriteria.cjs')

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

  try {
    const client = new Anthropic({ apiKey })

    const prompt = `${SCORING_MODEL}

Ohodnoť túto firmu:
- Názov: ${company.name}
- Kategória: ${company.category || '–'}
- Mesto: ${company.city || '–'}, Nemecko
- Hodnotenie Google: ${company.rating ? company.rating + '/5' : '–'}
- Adresa: ${company.address || '–'}

Odpovedz VÝLUČNE v JSON (bez markdown):
{
  "score": <číslo 0-100>,
  "reason": "<max 120 znakov>",
  "factors": {
    "positive": ["<faktor1>", "<faktor2>"],
    "risks": ["<riziko1>"],
    "nextStep": "<odporúčaný ďalší krok>"
  }
}`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].text.trim()
    const parsed = JSON.parse(raw)

    if (typeof parsed.score !== 'number' || parsed.score < 0 || parsed.score > 100) {
      throw new Error('Score must be 0-100')
    }
    if (!parsed.reason) throw new Error('Missing reason')

    console.log(`[ai-score] ${company.name}: ${parsed.score}/100`)
    return {
      statusCode: 200,
      body: JSON.stringify({
        score: Math.round(parsed.score),
        reason: parsed.reason,
        factors: parsed.factors || null,
      })
    }

  } catch (err) {
    console.error('[ai-score] Error:', err.message)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
