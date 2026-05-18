import { useState, useEffect } from 'react'
import { subscribeIntentLeads, markLeadAddedToWorkflow, updateLeadStatus, seedIntentLeads } from '../services/intelligenceService.js'

const mono = "'IBM Plex Mono', monospace"
const sans = "'IBM Plex Sans', sans-serif"

// ── Score color ───────────────────────────────────────────────────────────────
function scoreColor(n) {
  if (n >= 80) return '#ff5c00'
  if (n >= 65) return '#ffaa00'
  return '#6b7280'
}

// ── Intent badge ──────────────────────────────────────────────────────────────
const STATUS_META = {
  new:          { label: 'NOVÝ',        color: '#ff5c00', bg: 'rgba(255,92,0,0.1)'   },
  contacted:    { label: 'KONTAKTOVANÝ',color: '#00cc88', bg: 'rgba(0,204,136,0.08)' },
  low_priority: { label: 'NÍZKA',       color: '#4b5563', bg: 'transparent'           },
  dismissed:    { label: 'ZAMIETNUTÝ',  color: '#374151', bg: 'transparent'           },
}

const INDUSTRY_ICON = {
  hotel: '🏨', laundry: '🧺', wellness: '💆', hospital: '🏥', restaurant: '🍽️',
}

// ── AI Recommendation engine (client-side, no API) ───────────────────────────
function buildRecommendations(leads) {
  const high    = leads.filter(l => l.intentScore >= 80 && !l.addedToWorkflow && l.status === 'new')
  const medium  = leads.filter(l => l.intentScore >= 65 && l.intentScore < 80 && !l.addedToWorkflow)
  const pending = leads.filter(l => l.status === 'contacted' && !l.addedToWorkflow)

  const recs = []
  if (high.length > 0) recs.push({
    type: 'urgent',
    icon: '🔥',
    title: `${high.length} lead${high.length > 1 ? 's' : ''} s vysokým intent score`,
    body: `${high.map(l => l.companyName).slice(0, 2).join(', ')}${high.length > 2 ? ` + ${high.length - 2} ďalšie` : ''} — odporúčame kontaktovať tento týždeň.`,
  })
  if (medium.length > 0) recs.push({
    type: 'watch',
    icon: '👁',
    title: `${medium.length} lead${medium.length > 1 ? 's' : ''} na sledovanie`,
    body: 'Stredný intent score. Monitoring a príprava outreach materiálov.',
  })
  const atLeads = leads.filter(l => l.country === 'AT' && l.status === 'new')
  if (atLeads.length > 0) recs.push({
    type: 'market',
    icon: '🇦🇹',
    title: 'Rakúsky trh: príležitosť',
    body: `${atLeads.length} leady v AT. Rakúsko má vyššie subvencie na úspory energie ako DE.`,
  })
  recs.push({
    type: 'insight',
    icon: '💡',
    title: 'Hotelový segment: najvyšší intent',
    body: 'Hotels tvoria 60% leadov s intentScore > 75. Odporúčame zameranie outreach na hotelový segment.',
  })
  return recs
}

// ── Stats row ─────────────────────────────────────────────────────────────────
function StatsRow({ leads }) {
  const total    = leads.length
  const high     = leads.filter(l => l.intentScore >= 80).length
  const inflow   = leads.filter(l => l.status === 'new').length
  const workflow = leads.filter(l => l.addedToWorkflow).length
  const avgScore = total ? Math.round(leads.reduce((s, l) => s + (l.intentScore || 0), 0) / total) : 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
      {[
        { label: 'Celkom leadov',    value: total,    sub: 'intent_leads',     color: '#e8eaed' },
        { label: 'Vysoký intent',    value: high,     sub: 'score ≥ 80',       color: '#ff5c00' },
        { label: 'Nové / aktívne',   value: inflow,   sub: 'čakajú na akciu',  color: '#ffaa00' },
        { label: 'V CRM workflow',   value: workflow, sub: 'presunuto do SALES',color: '#00cc88' },
      ].map(s => (
        <div key={s.label} style={{ background: '#111418', border: '1px solid #1e2530', borderRadius: 2, padding: '0.85rem 1rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.4rem' }}>{s.label}</div>
          <div style={{ fontFamily: mono, fontSize: '1.6rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
          <div style={{ fontFamily: mono, fontSize: '0.5rem', color: '#374151', marginTop: '0.2rem' }}>{s.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ── Intent Lead Card ──────────────────────────────────────────────────────────
function IntentLeadCard({ lead, onAddToWorkflow, onStatusChange }) {
  const [expanded, setExpanded] = useState(false)
  const [acting,   setActing]   = useState(false)
  const sc   = lead.intentScore || 0
  const scCol = scoreColor(sc)
  const st   = STATUS_META[lead.status] || STATUS_META.new

  async function handleAdd() {
    setActing(true)
    try { await onAddToWorkflow(lead.id) } finally { setActing(false) }
  }

  return (
    <div style={{ background: '#111418', border: `1px solid ${lead.addedToWorkflow ? '#00cc8830' : '#1e2530'}`, borderLeft: `3px solid ${scCol}`, borderRadius: 2, marginBottom: '0.5rem', overflow: 'hidden' }}>
      {/* Collapsed header */}
      <div style={{ padding: '0.7rem 0.9rem', cursor: 'pointer', userSelect: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}
        onClick={() => setExpanded(o => !o)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: mono, fontSize: '0.78rem', fontWeight: 700, color: '#e8eaed' }}>
              {INDUSTRY_ICON[lead.industry] || '🏢'} {lead.companyName}
            </span>
            <span style={{ fontFamily: mono, fontSize: '0.5rem', color: '#6b7280' }}>{lead.city}, {lead.country}</span>
          </div>
          {!expanded && lead.painSignals?.length > 0 && (
            <div style={{ fontFamily: mono, fontSize: '0.55rem', color: '#4b5563', marginTop: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ⚡ {lead.painSignals.slice(0, 2).join(' · ')}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
          {/* Intent score */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: mono, fontSize: '1.15rem', fontWeight: 700, color: scCol, lineHeight: 1 }}>{sc}</div>
            <div style={{ fontFamily: mono, fontSize: '0.4rem', color: '#4b5563', letterSpacing: '1px' }}>INTENT</div>
          </div>
          {/* Status badge */}
          <span style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '1px', padding: '0.1rem 0.4rem', borderRadius: 2, border: `1px solid ${st.color}55`, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
            {st.label}
          </span>
          <span style={{ fontFamily: mono, fontSize: '0.55rem', color: '#374151' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid #1a1f2a', padding: '0.75rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {/* AI Summary */}
          {lead.aiSummary && (
            <div style={{ background: '#0a0e14', border: '1px solid #1a2535', borderRadius: 2, padding: '0.55rem 0.7rem' }}>
              <div style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '1px', color: '#374151', textTransform: 'uppercase', marginBottom: '0.25rem' }}>AI Analýza</div>
              <div style={{ fontFamily: sans, fontSize: '0.72rem', color: '#c9d1d9', lineHeight: 1.6 }}>{lead.aiSummary}</div>
            </div>
          )}

          {/* Pain signals */}
          {lead.painSignals?.length > 0 && (
            <div>
              <div style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '1px', color: '#374151', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Pain Signals</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {lead.painSignals.map((s, i) => (
                  <span key={i} style={{ fontFamily: mono, fontSize: '0.55rem', color: '#ffaa00', background: 'rgba(255,170,0,0.07)', border: '1px solid rgba(255,170,0,0.2)', padding: '0.12rem 0.45rem', borderRadius: 2 }}>
                    ⚡ {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Meta row */}
          <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap' }}>
            {[
              ['Segment',  (INDUSTRY_ICON[lead.industry] || '') + ' ' + (lead.industry || '–')],
              ['Krajina',  lead.country || '–'],
              ['Zdroj',    lead.source || 'manual'],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontFamily: mono, fontSize: '0.45rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '1px' }}>{k}</div>
                <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#9ca3af', marginTop: '0.1rem' }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', paddingTop: '0.15rem', borderTop: '1px solid #1a1f2a' }}>
            {!lead.addedToWorkflow && lead.status !== 'dismissed' && (
              <button
                style={{ fontFamily: mono, fontSize: '0.58rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.8rem', border: 'none', background: '#ff5c00', color: '#fff', borderRadius: 2, fontWeight: 700, cursor: acting ? 'not-allowed' : 'pointer', opacity: acting ? 0.6 : 1 }}
                onClick={handleAdd} disabled={acting}>
                {acting ? '⏳' : '→ Pridať do SALES OPS'}
              </button>
            )}
            {lead.addedToWorkflow && (
              <span style={{ fontFamily: mono, fontSize: '0.55rem', color: '#00cc88', padding: '0.28rem 0' }}>✓ V SALES OPS workflow</span>
            )}
            {lead.status !== 'dismissed' && (
              <button
                style={{ fontFamily: mono, fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.25rem 0.6rem', border: '1px solid #1e2530', background: 'transparent', color: '#4b5563', borderRadius: 2, cursor: 'pointer' }}
                onClick={() => onStatusChange(lead.id, 'dismissed')}>
                Zamietnuť
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Recommendations panel ─────────────────────────────────────────────────────
function RecommendationsPanel({ leads }) {
  const recs = buildRecommendations(leads)
  const typeStyle = {
    urgent:  { border: '#ff5c0055', bg: 'rgba(255,92,0,0.06)',   icon_col: '#ff5c00' },
    watch:   { border: '#ffaa0055', bg: 'rgba(255,170,0,0.05)',  icon_col: '#ffaa00' },
    market:  { border: '#60a5fa55', bg: 'rgba(96,165,250,0.05)', icon_col: '#60a5fa' },
    insight: { border: '#1e2530',   bg: '#0d1117',               icon_col: '#9ca3af' },
  }
  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '1px solid #1e2530' }}>
        AI Odporúčania
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {recs.map((r, i) => {
          const ts = typeStyle[r.type] || typeStyle.insight
          return (
            <div key={i} style={{ background: ts.bg, border: `1px solid ${ts.border}`, borderRadius: 2, padding: '0.6rem 0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.85rem', flexShrink: 0, lineHeight: 1.3 }}>{r.icon}</span>
                <div>
                  <div style={{ fontFamily: mono, fontSize: '0.58rem', fontWeight: 700, color: ts.icon_col, marginBottom: '0.2rem' }}>{r.title}</div>
                  <div style={{ fontFamily: sans, fontSize: '0.67rem', color: '#9ca3af', lineHeight: 1.55 }}>{r.body}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Signals panel ─────────────────────────────────────────────────────────────
function SignalsPanel({ leads }) {
  const signals = leads.flatMap(l =>
    (l.painSignals || []).map(s => ({ signal: s, company: l.companyName, score: l.intentScore }))
  ).sort((a, b) => b.score - a.score).slice(0, 8)

  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '1px solid #1e2530' }}>
        Detekované signály
      </div>
      {signals.length === 0 && (
        <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#374151' }}>Žiadne signály</div>
      )}
      {signals.map((s, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid #0f1318', gap: '0.5rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: mono, fontSize: '0.58rem', color: '#ffaa00', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>⚡ {s.signal}</div>
            <div style={{ fontFamily: mono, fontSize: '0.5rem', color: '#4b5563' }}>{s.company}</div>
          </div>
          <div style={{ fontFamily: mono, fontSize: '0.65rem', fontWeight: 700, color: scoreColor(s.score), flexShrink: 0 }}>{s.score}</div>
        </div>
      ))}
    </div>
  )
}

// ── Filter bar ────────────────────────────────────────────────────────────────
const FILTERS = [
  { key: 'all',      label: 'Všetky' },
  { key: 'high',     label: '🔥 Vysoký intent' },
  { key: 'new',      label: 'Nové' },
  { key: 'hotel',    label: '🏨 Hotel' },
  { key: 'laundry',  label: '🧺 Práčovňa' },
  { key: 'wellness', label: '💆 Wellness' },
]

function applyFilter(leads, f) {
  if (f === 'all')     return leads
  if (f === 'high')    return leads.filter(l => l.intentScore >= 80)
  if (f === 'new')     return leads.filter(l => l.status === 'new')
  return leads.filter(l => l.industry === f)
}

// ── Main Intelligence Dashboard ───────────────────────────────────────────────
export default function IntelligenceDashboard() {
  const [leads,       setLeads]     = useState([])
  const [filter,      setFilter]    = useState('all')
  const [seeded,      setSeeded]    = useState(false)

  useEffect(() => {
    seedIntentLeads().then(() => setSeeded(true))
    return subscribeIntentLeads(setLeads)
  }, [])

  const visible = applyFilter(leads, filter)

  async function handleAddToWorkflow(id) {
    await markLeadAddedToWorkflow(id)
  }
  async function handleStatusChange(id, status) {
    await updateLeadStatus(id, status)
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.25rem' }}>

      {/* Module header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ fontFamily: mono, fontSize: '0.55rem', letterSpacing: '4px', textTransform: 'uppercase', color: '#ff5c00' }}>
            ◈ B — STRIKER INTELLIGENCE
          </div>
          <div style={{ fontFamily: mono, fontSize: '0.5rem', color: '#374151' }}>
            AI-driven lead intelligence · intent scoring · pain signal detection
          </div>
        </div>
        <div style={{ height: 1, background: 'linear-gradient(90deg, #ff5c0033 0%, transparent 60%)', marginTop: '0.5rem' }} />
      </div>

      {/* Stats */}
      <StatsRow leads={leads} />

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {FILTERS.map(f => (
          <button key={f.key}
            style={{ fontFamily: mono, fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.22rem 0.65rem', border: `1px solid ${filter === f.key ? '#ff5c0088' : '#1e2530'}`, background: filter === f.key ? 'rgba(255,92,0,0.1)' : 'transparent', color: filter === f.key ? '#ff5c00' : '#4b5563', borderRadius: 2, cursor: 'pointer' }}
            onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
        <span style={{ fontFamily: mono, fontSize: '0.5rem', color: '#374151', alignSelf: 'center', marginLeft: '0.25rem' }}>
          {visible.length} / {leads.length}
        </span>
      </div>

      {/* Two-column layout: leads list + sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.25rem', alignItems: 'start' }}>

        {/* Left: Lead list */}
        <div>
          <div style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '1px solid #1e2530' }}>
            Top Intent Leads
          </div>
          {visible.length === 0 && (
            <div style={{ fontFamily: mono, fontSize: '0.65rem', color: '#374151', padding: '1rem 0' }}>
              {leads.length === 0 ? '⏳ Načítavam leads...' : 'Žiadne výsledky pre tento filter'}
            </div>
          )}
          {visible.map(lead => (
            <IntentLeadCard
              key={lead.id}
              lead={lead}
              onAddToWorkflow={handleAddToWorkflow}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>

        {/* Right sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ background: '#111418', border: '1px solid #1e2530', borderRadius: 2, padding: '0.85rem 0.95rem' }}>
            <RecommendationsPanel leads={leads} />
          </div>
          <div style={{ background: '#111418', border: '1px solid #1e2530', borderRadius: 2, padding: '0.85rem 0.95rem' }}>
            <SignalsPanel leads={leads} />
          </div>

          {/* Phase info */}
          <div style={{ background: '#0a0e14', border: '1px solid #1a2535', borderRadius: 2, padding: '0.75rem 0.9rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '2px', color: '#374151', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Fáza 1 — Demo Mode</div>
            <div style={{ fontFamily: sans, fontSize: '0.62rem', color: '#4b5563', lineHeight: 1.6 }}>
              Aktuálne dáta sú mock/demo. Budúce fázy:<br />
              · Google Places + Reviews API<br />
              · AI intent scoring<br />
              · Automatická detekcia signálov<br />
              · Energy consumption patterns
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
