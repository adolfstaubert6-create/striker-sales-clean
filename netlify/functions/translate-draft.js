const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY
const CLAUDE_MODEL = 'claude-sonnet-4-6'

const LANG_NAMES = { sk: 'Slovak', de: 'German', en: 'English' }

exports.handler = async (event) => {
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  let body
  try { body = JSON.parse(event.body || '{}') }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const { subject = '', text = '', targetLang = 'de' } = body
  const langName = LANG_NAMES[targetLang] || 'German'

  if (!subject && !text) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'subject or text required' }) }
  if (!CLAUDE_KEY) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY missing' }) }

  const prompt = `Translate this B2B sales email to ${langName}. Keep professional tone, preserve names (Adolf Staubert, STRIKER), keep phone/email unchanged. Return ONLY valid JSON, no markdown.
{"subject":"translated subject","body":"translated email body"}

SUBJECT: ${subject}
BODY: ${text}`

  try {
    const fetchP = fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
    })
    const timeoutP = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 10s')), 10000))
    const res  = await Promise.race([fetchP, timeoutP])
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || `Claude ${res.status}`)

    const raw    = (data.content?.[0]?.text || '').trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(raw)
    if (!parsed.subject || !parsed.body) throw new Error('missing fields')

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, subject: parsed.subject, body: parsed.body }) }
  } catch (e) {
    console.error('[translate-draft] failed:', e.message)
    // Graceful fallback: return originals unchanged
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, fallback: true, subject, body: text }) }
  }
}
