/**
 * STRIKER Translate Reply — SK → DE
 * POST { replyId, skSubject, skBody, companyName, originalSubject }
 * → translates to professional German, saves back to Firestore, returns { deSubject, deBody }
 */

const https = require('https')

const FB_API_KEY = process.env.VITE_FIREBASE_API_KEY
const FB_PROJECT = process.env.VITE_FIREBASE_PROJECT_ID
const FS_BASE    = () => `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`

function toFsVal(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string')         return { stringValue: v }
  if (v instanceof Date)             return { timestampValue: v.toISOString() }
  return { stringValue: String(v) }
}
function toFsFields(obj) {
  const f = {}
  for (const [k, v] of Object.entries(obj)) f[k] = toFsVal(v)
  return f
}
async function fsPatch(docPath, data) {
  const mask = Object.keys(data).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
  await fetch(`${FS_BASE()}/${docPath}?key=${FB_API_KEY}&${mask}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFsFields(data) }),
  })
}

async function callClaude(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-haiku-4-5', max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })
    const req = https.request({
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'x-api-key': apiKey,
        'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const p = JSON.parse(data)
          if (res.statusCode !== 200) reject(new Error(p.error?.message || `HTTP ${res.statusCode}`))
          else resolve(p.content?.[0]?.text || '')
        } catch(e) { reject(e) }
      })
    })
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Claude timeout')) })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

exports.handler = async (event) => {
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let parsed
  try { parsed = JSON.parse(event.body) } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { replyId, skSubject, skBody, companyName, originalSubject } = parsed
  if (!skBody) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'skBody is required' }) }
  }

  try {
    const prompt = `Du bist ein professioneller B2B-Übersetzer für STRIKER Wärmetechnologie (Deutschland/Österreich).
STRIKER: Wärmepumpen 45kW → 120-160kW Wärme. Preis: 8.000-10.000 EUR. Für Hotels, Wäschereien, Wellness.

Übersetze diesen slowakischen B2B-Sales-Entwurf ins Deutsche (Sie-Form, professionell, max 120 Wörter).
Bewahre Ton und Inhalt, passe nur kulturell an (DACH-Markt).
Firma: ${companyName || ''}
Kontext: ${originalSubject || ''}

Slowakischer Entwurf:
BETREFF: ${skSubject || ''}
---
${(skBody || '').slice(0, 800)}
---

Format GENAU so (nichts davor oder danach):
BETREFF_DE: <Betreff auf Deutsch>

<Email-Text auf Deutsch>`

    const text = await callClaude(prompt)

    const lines     = text.trim().split('\n')
    const sLine     = lines.find(l => /^BETREFF_DE:/i.test(l.trim()))
    const deSubject = sLine ? sLine.replace(/^BETREFF_DE:\s*/i, '').trim() : (skSubject || `Re: ${originalSubject || ''}`)
    const after     = sLine ? text.slice(text.indexOf(sLine) + sLine.length) : text
    const deBody    = after.replace(/^\s*\n+/, '').trim()

    // Save DE draft back to Firestore if replyId provided
    if (replyId && FB_API_KEY && FB_PROJECT) {
      await fsPatch(`email_replies/${replyId}`, {
        aiDraftDeSubject: deSubject,
        aiDraftDeBody:    deBody,
        aiDraftStatus:    'pending_de',
        translatedAt:     new Date(),
      })
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, deSubject, deBody }),
    }
  } catch (e) {
    console.error('[translate-reply] error:', e.message)
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ ok: false, error: e.message }) }
  }
}
