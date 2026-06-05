/**
 * translate-snippets — batch translate evidence snippets DE → SK
 *
 * POST /.netlify/functions/translate-snippets
 * Body: { snippets: string[] }   — raw German text excerpts from crawled pages
 * Returns: { ok, translated: string[], fallback? }
 *
 * Uses a single Claude Haiku call for the entire batch.
 * Falls back to original text on any error so the UI always has something to show.
 */

const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'

exports.handler = async (event) => {
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  let body
  try { body = JSON.parse(event.body || '{}') }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const { snippets = [] } = body

  if (!snippets.length) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, translated: [] }) }
  }

  // No API key — return originals so the UI degrades gracefully
  if (!CLAUDE_KEY) {
    console.warn('[translate-snippets] ANTHROPIC_API_KEY not set — returning originals')
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, fallback: true, translated: snippets }) }
  }

  // Build numbered list so Claude can match output order exactly
  const numbered = snippets.map((s, i) => `[${i + 1}] ${s}`).join('\n\n')

  const prompt = `Translate the following German text excerpts to Slovak (Slovenčina). These are short quotes from company websites about energy, heating, modernisation, and sustainability.

Translation rules:
- Translate each excerpt naturally into Slovak
- Keep technical terms (Wärmepumpe, HVAC, CO₂, etc.) recognisable where there is no common Slovak equivalent
- Preserve "…" ellipsis markers at the start/end of excerpts
- Keep the same approximate length as the original
- Return ONLY a valid JSON array of strings, one per input excerpt, in the same order
- No extra text, no markdown, no explanations

Input excerpts:
${numbered}

Return ONLY: ["translation 1","translation 2",...]`

  try {
    const fetchP   = fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
      body:    JSON.stringify({
        model:      CLAUDE_MODEL,
        max_tokens: 3000,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })
    const timeoutP = new Promise((_, rej) => setTimeout(() => rej(new Error('Claude timeout 18s')), 18000))

    const res  = await Promise.race([fetchP, timeoutP])
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || `Claude ${res.status}`)

    const raw = (data.content?.[0]?.text || '').trim()
      .replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()

    const translated = JSON.parse(raw)

    if (!Array.isArray(translated)) throw new Error('Response is not an array')

    // If Claude returned fewer items than expected, pad with originals
    const safe = snippets.map((orig, i) =>
      typeof translated[i] === 'string' && translated[i].trim() ? translated[i] : orig
    )

    console.log(`[translate-snippets] OK — ${safe.length} snippets translated`)
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, translated: safe }) }

  } catch (e) {
    console.error('[translate-snippets] failed:', e.message, '— returning originals')
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, fallback: true, translated: snippets }) }
  }
}
