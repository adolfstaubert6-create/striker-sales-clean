const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

const BLOCKED = [
  /noreply/i,
  /no-reply/i,
  /example/i,
  /@sentry\./i,
  /@google\./i,
  /\.(png|jpg|jpeg|gif|svg|webp|bmp|ico)$/i,
]

function isValid(email) {
  return !BLOCKED.some(p => p.test(email))
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { website } = body
  if (!website) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing website' }) }
  }

  const base = website.startsWith('http')
    ? website.replace(/\/$/, '')
    : `https://${website.replace(/\/$/, '')}`

  const urls = [
    `${base}/impressum`,
    `${base}/kontakt`,
    `${base}/contact`,
    `${base}/about`,
    base,
  ]

  const deadline = Date.now() + 10000

  for (const url of urls) {
    if (Date.now() >= deadline) break

    const remaining = deadline - Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), Math.min(remaining, 5000))

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EmailFinder/1.0)' },
      })
      clearTimeout(timer)

      if (!res.ok) continue

      const html = await res.text()
      const found = [...(html.match(EMAIL_RE) || [])].filter(isValid)

      if (found.length > 0) {
        console.log(`[find-email] Found ${found[0]} at ${url}`)
        return { statusCode: 200, body: JSON.stringify({ email: found[0] }) }
      }
    } catch {
      clearTimeout(timer)
    }
  }

  console.log(`[find-email] No email found for ${website}`)
  return { statusCode: 200, body: JSON.stringify({ email: null }) }
}
