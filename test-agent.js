/**
 * Quick local test for netlify/functions/agent.js
 * Run: node test-agent.js
 */
import { readFileSync } from 'fs'
import { createRequire } from 'module'

// ── Load .env manually (no dotenv needed) ────────────────────────────────────
try {
  const envText = readFileSync('.env', 'utf8')
  for (const line of envText.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
  console.log('✓ .env loaded\n')
} catch {
  console.warn('⚠ No .env file found\n')
}

// ── Check required env vars ──────────────────────────────────────────────────
const REQUIRED = [
  'GOOGLE_PLACES_API_KEY',
  'ANTHROPIC_API_KEY',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
]
const missing = REQUIRED.filter(k => !process.env[k] || process.env[k].includes('YOUR_'))
if (missing.length) {
  console.error('❌ Missing or placeholder env vars:\n')
  missing.forEach(k => console.error(`   ${k}`))
  console.error('\nAdd real values to .env and retry.\n')
  process.exit(1)
}
console.log('✓ All env vars present')
console.log(`  GOOGLE_PLACES_API_KEY = ${process.env.GOOGLE_PLACES_API_KEY.slice(0,12)}...`)
console.log(`  ANTHROPIC_API_KEY     = ${process.env.ANTHROPIC_API_KEY.slice(0,16)}...`)
console.log(`  FIREBASE_PROJECT      = ${process.env.VITE_FIREBASE_PROJECT_ID}\n`)

// ── Load agent handler (CommonJS module via createRequire) ───────────────────
const require = createRequire(import.meta.url)
const { handler } = require('./netlify/functions/agent.js')

// ── Mock event ───────────────────────────────────────────────────────────────
const event = {
  httpMethod: 'POST',
  body: JSON.stringify({
    segment:  'hotel',
    locality: 'Garmisch-Partenkirchen',
    count:    2,
  }),
}

// ── Run ───────────────────────────────────────────────────────────────────────
console.log('🚀 Starting agent pipeline (count=2, segment=hotel, locality=Garmisch-Partenkirchen)...\n')
console.time('elapsed')

handler(event, {})
  .then(result => {
    console.timeEnd('elapsed')
    console.log('\n── HTTP Status:', result.statusCode)
    console.log('── Response ──────────────────────────────────────────────')
    try {
      const body = JSON.parse(result.body)
      console.log(JSON.stringify(body, null, 2))

      if (body.report) {
        console.log('\n── Summary ───────────────────────────────────────────────')
        body.report.forEach(r => {
          const icon = r.status === 'done' ? '✅' : r.status === 'error' ? '❌' : '⏳'
          console.log(`${icon} ${r.name}`)
          if (r.bps       !== undefined) console.log(`   BPS: ${r.bps} | email: ${r.email || 'none'} | priority: ${r.priority}`)
          if (r.draftDe)                 console.log(`   DE subject: ${r.draftDe}`)
          if (r.error)                   console.log(`   ERROR: ${r.error}`)
        })
      }
    } catch {
      console.log(result.body)
    }
  })
  .catch(err => {
    console.timeEnd('elapsed')
    console.error('\n❌ Uncaught error:', err.message)
    console.error(err.stack)
  })
