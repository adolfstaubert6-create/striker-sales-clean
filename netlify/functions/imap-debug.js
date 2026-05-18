// Temporary diagnostic — fetch latest 2 INBOX emails and show headers
// DELETE after use
const { ImapFlow } = require('imapflow')

function parseHeader(headers, name) {
  if (!headers) return null
  const raw = Buffer.isBuffer(headers) ? headers.toString() : String(headers)
  const re  = new RegExp('^' + name + ':\\s*(.+)', 'im')
  const m   = raw.match(re)
  return m ? m[1].trim() : null
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST only' }
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

  const client = new ImapFlow({
    host: process.env.IONOS_IMAP_HOST || 'imap.ionos.de',
    port: parseInt(process.env.IONOS_IMAP_PORT || '993', 10),
    secure: true,
    auth: { user: process.env.IONOS_EMAIL, pass: process.env.IONOS_PASSWORD },
    logger: false, tls: { rejectUnauthorized: false },
    connectionTimeout: 12000,
  })

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')
    const results = []
    try {
      // Get last 2 messages by sequence range
      const status = await client.status('INBOX', { messages: true })
      const total  = status.messages || 0
      if (total === 0) return { statusCode: 200, headers: CORS, body: JSON.stringify({ total: 0, emails: [] }) }

      const range = total > 1 ? `${total - 1}:${total}` : `${total}`
      for await (const msg of client.fetch(range, { uid: true, envelope: true, headers: true })) {
        results.push({
          uid:        msg.uid,
          from:       msg.envelope?.from?.[0]?.address,
          to:         (msg.envelope?.to || []).map(a => a.address),
          subject:    msg.envelope?.subject,
          date:       msg.envelope?.date,
          messageId:  msg.envelope?.messageId,
          inReplyTo:  parseHeader(msg.headers, 'in-reply-to'),
          references: parseHeader(msg.headers, 'references'),
        })
      }
    } finally { lock.release() }
    await client.logout()
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ total: results.length, emails: results }, null, 2) }
  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message }) }
  }
}
