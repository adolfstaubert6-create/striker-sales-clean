import { useState } from 'react'

const mono = "'IBM Plex Mono', monospace"

const SEGMENTS = [
  { value: 'hotel',      label: '🏨 Hotel / Ubytovanie' },
  { value: 'wellness',   label: '💆 Wellness / Spa / Kúpele' },
  { value: 'laundry',    label: '🧺 Priemyselná práčovňa' },
  { value: 'hospital',   label: '🏥 Nemocnica / Klinika' },
  { value: 'restaurant', label: '🍽️ Reštaurácia / Gastro' },
  { value: 'food',       label: '🏭 Potravinárstvo / Výroba' },
  { value: 'brewery',    label: '🍺 Pivovar' },
  { value: 'dryer',      label: '🌾 Sušiareň / Agrárna prevádzka' },
  { value: 'industrial', label: '⚙️ Priemysel / Iné' },
]

const COUNTRIES = [
  { value: 'DE', label: '🇩🇪 DE' },
  { value: 'AT', label: '🇦🇹 AT' },
  { value: 'CH', label: '🇨🇭 CH' },
  { value: 'SK', label: '🇸🇰 SK' },
  { value: 'CZ', label: '🇨🇿 CZ' },
]

const INTENT_META = {
  weak:   { label: 'WEAK',   color: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: '#6b728055' },
  medium: { label: 'MEDIUM', color: '#ffaa00', bg: 'rgba(255,170,0,0.12)',   border: '#ffaa0055' },
  strong: { label: 'STRONG', color: '#00cc88', bg: 'rgba(0,204,136,0.12)',   border: '#00cc8855' },
}

const REC_META = {
  immediate:  { label: 'KONTAKTOVAŤ OKAMŽITE', color: '#00cc88', bg: 'rgba(0,204,136,0.1)',  border: '#00cc8866', icon: '✅' },
  monitor:    { label: 'SLEDOVAŤ',             color: '#ffaa00', bg: 'rgba(255,170,0,0.1)',   border: '#ffaa0066', icon: '◉'  },
  unsuitable: { label: 'NEVHODNÉ',             color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: '#ef444466', icon: '✗'  },
}

function scoreColor(s) {
  return s >= 70 ? '#00cc88' : s >= 50 ? '#ffaa00' : '#ef4444'
}

function ScoreBar({ score, label, reason }) {
  const color = scoreColor(score)
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.18rem' }}>
        <span style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6b7280' }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: '0.88rem', fontWeight: 700, color }}>{score}%</span>
      </div>
      <div style={{ height: 5, background: '#1e2530', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      {reason && (
        <div style={{ fontFamily: mono, fontSize: '0.52rem', color: '#4b5563', marginTop: '0.18rem', lineHeight: 1.4 }}>
          {reason}
        </div>
      )}
    </div>
  )
}

function ReportCard({ result }) {
  const { companyName, segment, city, country, report } = result
  const rec    = REC_META[report.recommendation]  || REC_META.monitor
  const intent = INTENT_META[report.buyingIntent] || INTENT_META.medium
  const oc     = scoreColor(report.overallScore)

  return (
    <div style={{ background: '#0d1117', border: '1px solid #1e2530', borderLeft: `3px solid ${oc}`, borderRadius: 4, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: '#111418', borderBottom: '1px solid #1e2530', padding: '1rem 1.4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#ff5c00', marginBottom: '0.35rem' }}>
              ◈ STRIKER INTELLIGENCE REPORT
            </div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '1.2rem', fontWeight: 700, color: '#e8eaed', letterSpacing: '0.3px' }}>
              {companyName}
            </div>
            <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#6b7280', marginTop: '0.2rem' }}>
              {segment}{city || country ? ` · ${[city, country].filter(Boolean).join(', ')}` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: mono, fontSize: '2.5rem', fontWeight: 700, color: oc, lineHeight: 1 }}>
              {report.overallScore}
            </div>
            <div style={{ fontFamily: mono, fontSize: '0.45rem', color: '#6b7280', letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: '0.1rem' }}>
              OVERALL FIT / 100
            </div>
          </div>
        </div>

        {/* Recommendation badge */}
        <div style={{ marginTop: '0.85rem' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
            background: rec.bg, border: `1px solid ${rec.border}`,
            borderRadius: 3, padding: '0.35rem 0.85rem',
          }}>
            <span style={{ fontSize: '0.75rem' }}>{rec.icon}</span>
            <span style={{ fontFamily: mono, fontSize: '0.6rem', letterSpacing: '2px', textTransform: 'uppercase', color: rec.color, fontWeight: 700 }}>
              {rec.label}
            </span>
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '1.4rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>

        {/* Left: score bars */}
        <div>
          <div style={css.sectionLabel}>Scoring</div>
          <ScoreBar score={report.strikerFitScore}     label="STRIKER FIT"     reason={report.strikerFitReason} />
          <ScoreBar score={report.heatDemandScore}     label="HEAT DEMAND"     reason={report.heatDemandReason} />
          <ScoreBar score={report.energyPainScore}     label="ENERGY PAIN"     reason={report.energyPainReason} />
          <ScoreBar score={report.financialPowerScore} label="FINANCIAL POWER" reason={report.financialPowerReason} />
          <ScoreBar score={report.urgencyScore}        label="URGENCY"         reason={report.urgencyReason} />

          <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid #1e2530' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={css.sectionLabel}>Buying Intent</span>
              <span style={{
                fontFamily: mono, fontSize: '0.6rem', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 700,
                padding: '0.2rem 0.65rem', borderRadius: 2,
                color: intent.color, background: intent.bg, border: `1px solid ${intent.border}`,
              }}>
                ● {intent.label}
              </span>
            </div>
            {report.buyingIntentReason && (
              <div style={{ fontFamily: mono, fontSize: '0.52rem', color: '#4b5563', marginTop: '0.25rem', lineHeight: 1.4 }}>
                {report.buyingIntentReason}
              </div>
            )}
          </div>
        </div>

        {/* Right: decision makers, signals, reasoning, next step */}
        <div>
          {report.decisionMakers?.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={css.sectionLabel}>Decision Makers</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {report.decisionMakers.map((dm, i) => (
                  <span key={i} style={{
                    fontFamily: mono, fontSize: '0.58rem',
                    color: '#818cf8', background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.25)',
                    padding: '0.15rem 0.5rem', borderRadius: 2,
                  }}>
                    {dm}
                  </span>
                ))}
              </div>
            </div>
          )}

          {report.signals?.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={css.sectionLabel}>Nájdené signály</div>
              {report.signals.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.3rem', alignItems: 'flex-start' }}>
                  <span style={{ color: '#ff5c00', flexShrink: 0, fontFamily: mono, fontSize: '0.65rem', lineHeight: 1.5 }}>▸</span>
                  <span style={{ fontFamily: mono, fontSize: '0.62rem', color: '#9ca3af', lineHeight: 1.5 }}>{s}</span>
                </div>
              ))}
            </div>
          )}

          {report.reasoning && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={css.sectionLabel}>Zdôvodnenie</div>
              <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#9ca3af', lineHeight: 1.65 }}>
                {report.reasoning}
              </div>
            </div>
          )}

          {report.nextStep && (
            <div style={{ borderTop: '1px solid #1e2530', paddingTop: '0.85rem' }}>
              <div style={css.sectionLabel}>Ďalší krok</div>
              <div style={{ fontFamily: mono, fontSize: '0.68rem', color: '#00cc88', lineHeight: 1.5 }}>
                → {report.nextStep}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function EnergyTargetPanel() {
  const [form, setForm]           = useState({ companyName: '', url: '', segment: 'hotel', country: 'DE', city: '', extraContext: '' })
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState(null)
  const [history, setHistory]     = useState([])
  const [showContext, setShowContext] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleAnalyze() {
    if (!form.companyName.trim()) { setError('Zadaj názov firmy'); return }
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const res  = await fetch('/.netlify/functions/energy-intel', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const entry = { ...data, id: Date.now() }
      setResult(entry)
      setHistory(prev => [entry, ...prev.filter(h => h.companyName !== data.companyName)].slice(0, 8))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.25rem' }}>

      {/* Page header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ fontFamily: mono, fontSize: '0.55rem', letterSpacing: '4px', textTransform: 'uppercase', color: '#ff5c00' }}>
            ◈ ENERGY TARGET ACQUISITION AI
          </div>
          <div style={{ fontFamily: mono, fontSize: '0.5rem', color: '#374151' }}>
            AI-driven scoring · heat demand · buying intent · striker fit
          </div>
        </div>
        <div style={{ height: 1, background: 'linear-gradient(90deg, #ff5c0033 0%, transparent 60%)', marginTop: '0.5rem' }} />
      </div>

      {/* History chips */}
      {history.length > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {history.map(h => {
            const rec   = REC_META[h.report?.recommendation] || REC_META.monitor
            const isActive = result?.id === h.id
            return (
              <button key={h.id} onClick={() => setResult(h)} style={{
                fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase',
                padding: '0.22rem 0.65rem',
                border: `1px solid ${rec.border}`,
                background: isActive ? rec.bg : 'transparent',
                color: isActive ? rec.color : '#6b7280',
                borderRadius: 2, cursor: 'pointer',
              }}>
                {h.companyName} · {h.report?.overallScore}%
              </button>
            )
          })}
        </div>
      )}

      {/* Input form */}
      <div style={{ background: '#111418', border: '1px solid #1e2530', borderRadius: 4, padding: '1.4rem', marginBottom: result || loading ? '1.5rem' : 0 }}>
        <div style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '1.1rem' }}>
          Zadaj firmu pre analýzu
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={css.label}>Firma *</label>
            <input
              style={css.input}
              placeholder="napr. Hotel Alpenhof GmbH"
              value={form.companyName}
              onChange={e => { set('companyName', e.target.value); setError(null) }}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              autoFocus
            />
          </div>
          <div>
            <label style={css.label}>Web / URL (voliteľné)</label>
            <input
              style={css.input}
              placeholder="napr. hotel-alpenhof.de"
              value={form.url}
              onChange={e => set('url', e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={css.label}>Segment</label>
            <select style={css.select} value={form.segment} onChange={e => set('segment', e.target.value)}>
              {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={css.label}>Krajina</label>
            <select style={css.select} value={form.country} onChange={e => set('country', e.target.value)}>
              {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label style={css.label}>Mesto</label>
            <input
              style={css.input}
              placeholder="napr. München"
              value={form.city}
              onChange={e => set('city', e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginBottom: '0.85rem' }}>
          <button style={css.toggleBtn} onClick={() => setShowContext(v => !v)}>
            {showContext ? '▲ Skryť' : '▼ Dodatočný kontext'} — vlož info o firme, LinkedIn, novinky...
          </button>
          {showContext && (
            <textarea
              style={{ ...css.input, display: 'block', marginTop: '0.5rem', minHeight: 90, resize: 'vertical', lineHeight: 1.6 }}
              placeholder="Napr. popis firmy, výročná správa, LinkedIn post, news článok, interná pozícia..."
              value={form.extraContext}
              onChange={e => set('extraContext', e.target.value)}
            />
          )}
        </div>

        {error && (
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '0.4rem 0.65rem', borderRadius: 2, marginBottom: '0.75rem' }}>
            ⚠ {error}
          </div>
        )}

        <button
          style={{ ...css.analyzeBtn, opacity: loading ? 0.7 : 1 }}
          onClick={handleAnalyze}
          disabled={loading}
        >
          {loading ? '⏳ Analyzujem...' : '▶ STRIKER INTELLIGENCE REPORT'}
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ background: '#111418', border: '1px solid #1e2530', borderRadius: 4, padding: '2rem 1.4rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#ff5c00', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
            ◈ STRIKER AI ANALYZUJE...
          </div>
          {[
            'Vyhodnocujem tepelnú potrebu (Heat Demand)...',
            'Skórujem energetickú bolesť (Energy Pain)...',
            'Hľadám Buying Intent signály...',
            'Posudzujem finančnú silu...',
            'Identifikujem Decision Makers...',
            'Kalkulujem STRIKER FIT skóre...',
          ].map((line, i) => (
            <div key={i} style={{ fontFamily: mono, fontSize: '0.58rem', color: '#374151', marginBottom: '0.3rem' }}>
              ✦ {line}
            </div>
          ))}
        </div>
      )}

      {/* Result */}
      {result && !loading && <ReportCard result={result} />}
    </div>
  )
}

const css = {
  label:      { display: 'block', fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.28rem' },
  input:      { width: '100%', background: '#0a0c0f', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: mono, fontSize: '0.8rem', padding: '0.5rem 0.65rem', borderRadius: 2, outline: 'none', boxSizing: 'border-box' },
  select:     { width: '100%', background: '#0a0c0f', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: mono, fontSize: '0.8rem', padding: '0.5rem 0.65rem', borderRadius: 2, outline: 'none', cursor: 'pointer' },
  analyzeBtn: { width: '100%', background: '#ff5c00', border: 'none', color: '#fff', fontFamily: mono, fontSize: '0.72rem', letterSpacing: '3px', textTransform: 'uppercase', padding: '0.78rem', borderRadius: 2, fontWeight: 700, cursor: 'pointer' },
  toggleBtn:  { background: 'transparent', border: 'none', color: '#374151', fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', cursor: 'pointer', padding: 0, textDecoration: 'none' },
  sectionLabel: { fontFamily: mono, fontSize: '0.48rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#374151', marginBottom: '0.65rem', display: 'block' },
}
