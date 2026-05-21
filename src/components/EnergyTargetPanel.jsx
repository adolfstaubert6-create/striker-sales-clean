import { useState, useEffect } from 'react'
import {
  SEGMENTS, SEGMENT_LABELS, SEGMENT_ICON, COUNTRIES,
  INTEL_STATUSES, STATUS_MAP, REC_META, scoreColor,
} from '../constants/intelMeta.js'
import { subscribeTargets, addTarget } from '../services/intelTargetService.js'
import IntelCompanyDetail from './IntelCompanyDetail.jsx'

const mono = "'IBM Plex Mono', monospace"
const sans = "'IBM Plex Sans', sans-serif"

// ── Pomocné komponenty ────────────────────────────────────────────────────────

function ScoreBar({ score, label }) {
  const color = scoreColor(score)
  return (
    <div style={{ marginBottom: '0.3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.1rem' }}>
        <span style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280' }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: '0.65rem', fontWeight: 700, color }}>{score ?? '–'}%</span>
      </div>
      <div style={{ height: 3, background: '#1e2530', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${score ?? 0}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
    </div>
  )
}

function TargetCard({ target: t, onClick }) {
  const rec    = REC_META[t.recommendation] || REC_META.monitor
  const status = STATUS_MAP[t.status]       || INTEL_STATUSES[0]
  const oc     = scoreColor(t.overallScore)
  const icon   = SEGMENT_ICON[t.segment] || '🏢'

  return (
    <div
      onClick={onClick}
      style={{
        background: '#111418', border: '1px solid #1e2530', borderLeft: `3px solid ${oc}`,
        borderRadius: 4, padding: '1rem 1.1rem', cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = oc}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#1e2530'}
    >
      {/* Hlavička karty */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.65rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.2rem' }}>
            {icon} {t.segmentLabel || SEGMENT_LABELS[t.segment] || t.segment}
          </div>
          <div style={{ fontFamily: sans, fontSize: '0.95rem', fontWeight: 700, color: '#e8eaed', marginBottom: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.name}
          </div>
          <div style={{ fontFamily: mono, fontSize: '0.55rem', color: '#6b7280' }}>
            {[t.city, t.country].filter(Boolean).join(', ')}
            {t.companySize && ` · ${t.companySize}`}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: mono, fontSize: '1.5rem', fontWeight: 700, color: oc, lineHeight: 1 }}>{t.overallScore ?? '–'}</div>
          <div style={{ fontFamily: mono, fontSize: '0.4rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>fit</div>
        </div>
      </div>

      {/* Skóre bary */}
      <ScoreBar score={t.strikerFitScore}    label="Striker Fit"  />
      <ScoreBar score={t.energyPainScore}    label="Energ. problém" />
      <ScoreBar score={t.buyingIntentScore}  label="Záujem o kúpu" />

      {/* Odporúčanie + stav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.7rem', paddingTop: '0.6rem', borderTop: '1px solid #1e2530' }}>
        <span style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '0.5px', color: rec.color }}>
          {rec.icon} {rec.label}
        </span>
        <span style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.1rem 0.38rem', borderRadius: 2, color: status.color, background: status.bg, border: `1px solid ${status.border}` }}>
          {status.label}
        </span>
      </div>

      {/* Prvý signál */}
      {(t.signals || [])[0] && (
        <div style={{ fontFamily: mono, fontSize: '0.55rem', color: '#4b5563', marginTop: '0.5rem', display: 'flex', gap: '0.35rem', alignItems: 'flex-start' }}>
          <span style={{ color: '#ff5c00', flexShrink: 0 }}>▸</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.signals[0]}</span>
        </div>
      )}
    </div>
  )
}

// ── Modal pridania firmy ──────────────────────────────────────────────────────

function AddCompanyModal({ onClose, onAdded }) {
  const [form, setForm]         = useState({ companyName: '', url: '', segment: 'hotel', country: 'DE', city: '', companySize: '', employees: '', extraContext: '' })
  const [phase, setPhase]       = useState('form')   // 'form' | 'analyzing' | 'preview'
  const [aiResult, setAiResult] = useState(null)
  const [error, setError]       = useState(null)
  const [saving, setSaving]     = useState(false)
  const [showCtx, setShowCtx]   = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleAnalyze() {
    if (!form.companyName.trim()) { setError('Zadaj názov firmy'); return }
    setError(null)
    setPhase('analyzing')
    try {
      const res  = await fetch('/.netlify/functions/energy-intel', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setAiResult(data)
      setPhase('preview')
    } catch (e) {
      setError(e.message)
      setPhase('form')
    }
  }

  async function handleSave() {
    if (!aiResult) return
    setSaving(true)
    try {
      const r   = aiResult.report
      const doc = {
        name:             form.companyName.trim(),
        web:              form.url.trim(),
        country:          form.country,
        city:             form.city.trim(),
        segment:          form.segment,
        segmentLabel:     SEGMENT_LABELS[form.segment] || form.segment,
        companySize:      r.estimatedSize   || form.companySize || '',
        employees:        r.estimatedEmployees || form.employees || '',
        status:           'analyzed',
        strikerFitScore:     r.strikerFitScore,
        strikerFitReason:    r.strikerFitReason,
        energyPainScore:     r.energyPainScore,
        energyPainReason:    r.energyPainReason,
        urgencyScore:        r.urgencyScore,
        urgencyReason:       r.urgencyReason,
        financialPowerScore: r.financialPowerScore,
        financialPowerReason:r.financialPowerReason,
        buyingIntentScore:   r.buyingIntentScore  || (r.buyingIntent === 'strong' ? 80 : r.buyingIntent === 'medium' ? 55 : 25),
        buyingIntent:        r.buyingIntent,
        buyingIntentReason:  r.buyingIntentReason,
        overallScore:        r.overallScore,
        recommendation:      r.recommendation,
        recommendationReason:r.recommendationReason || r.reasoning || '',
        nextStep:            r.nextStep,
        whyFound:            r.whyFound || '',
        signals:             r.signals  || [],
        aiAnalysis: {
          whatTroubles:  r.aiAnalysis?.whatTroubles  || '',
          energyProblem: r.aiAnalysis?.energyProblem || '',
          whyStrikerFit: r.aiAnalysis?.whyStrikerFit || '',
          mainArgument:  r.aiAnalysis?.mainArgument  || '',
        },
        suggestedContacts: r.suggestedContacts || [],
        sources:  [],
        contacts: [],
      }
      const ref = await addTarget(doc)
      onAdded({ id: ref.id, ...doc })
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const rec = aiResult ? (REC_META[aiResult.report?.recommendation] || REC_META.monitor) : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#111418', border: '1px solid #1e2530', borderRadius: 4, width: '100%', maxWidth: 620, maxHeight: '92vh', overflowY: 'auto' }}>

        {/* Hlavička modalu */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.1rem 1.4rem', borderBottom: '1px solid #1e2530' }}>
          <div style={{ fontFamily: mono, fontSize: '0.55rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#ff5c00' }}>
            + Nová karta firmy
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#6b7280', fontSize: '1rem', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: '1.4rem' }}>

          {phase === 'form' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.65rem' }}>
                <div>
                  <label style={mCss.label}>Názov firmy *</label>
                  <input style={mCss.input} placeholder="napr. Hotel Alpenhof GmbH" autoFocus
                    value={form.companyName} onChange={e => { set('companyName', e.target.value); setError(null) }}
                    onKeyDown={e => e.key === 'Enter' && handleAnalyze()} />
                </div>
                <div>
                  <label style={mCss.label}>Web / URL</label>
                  <input style={mCss.input} placeholder="hotel-alpenhof.de" value={form.url} onChange={e => set('url', e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.65rem', marginBottom: '0.65rem' }}>
                <div>
                  <label style={mCss.label}>Segment</label>
                  <select style={mCss.select} value={form.segment} onChange={e => set('segment', e.target.value)}>
                    {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={mCss.label}>Krajina</label>
                  <select style={mCss.select} value={form.country} onChange={e => set('country', e.target.value)}>
                    {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={mCss.label}>Mesto</label>
                  <input style={mCss.input} placeholder="München" value={form.city} onChange={e => set('city', e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.65rem' }}>
                <div>
                  <label style={mCss.label}>Veľkosť firmy (voliteľné)</label>
                  <select style={mCss.select} value={form.companySize} onChange={e => set('companySize', e.target.value)}>
                    <option value="">— Neznáma —</option>
                    <option value="Malá firma">Malá firma (do 50 zam.)</option>
                    <option value="Stredná firma">Stredná firma (50–250 zam.)</option>
                    <option value="Veľká firma">Veľká firma (250–1 000 zam.)</option>
                    <option value="Korporácia">Korporácia (1 000+ zam.)</option>
                  </select>
                </div>
                <div>
                  <label style={mCss.label}>Odhad počtu zamestnancov</label>
                  <input style={mCss.input} placeholder="napr. 50–200" value={form.employees} onChange={e => set('employees', e.target.value)} />
                </div>
              </div>
              <button style={{ background: 'transparent', border: 'none', color: '#374151', fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', cursor: 'pointer', padding: 0, marginBottom: '0.65rem' }}
                onClick={() => setShowCtx(v => !v)}>
                {showCtx ? '▲' : '▼'} Dodatočný kontext pre AI (voliteľné)
              </button>
              {showCtx && (
                <textarea style={{ ...mCss.input, display: 'block', minHeight: 80, resize: 'vertical', lineHeight: 1.6, marginBottom: '0.65rem' }}
                  placeholder="Vlož popis firmy, LinkedIn post, novinový článok, výročnú správu..."
                  value={form.extraContext} onChange={e => set('extraContext', e.target.value)} />
              )}
              {error && <div style={mCss.errBox}>⚠ {error}</div>}
              <button style={mCss.analyzeBtn} onClick={handleAnalyze}>▶ Analyzovať s AI</button>
            </>
          )}

          {phase === 'analyzing' && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#ff5c00', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
                ◈ STRIKER AI ANALYZUJE...
              </div>
              {[
                'Vyhodnocujem tepelnú potrebu...',
                'Skórujem energetický problém...',
                'Hľadám signály záujmu o kúpu...',
                'Posudzujem finančnú silu...',
                'Identifikujem kontaktné osoby...',
                'Kalkulujem STRIKER FIT...',
              ].map((l, i) => (
                <div key={i} style={{ fontFamily: mono, fontSize: '0.58rem', color: '#374151', marginBottom: '0.3rem' }}>✦ {l}</div>
              ))}
            </div>
          )}

          {phase === 'preview' && aiResult && (() => {
            const r = aiResult.report
            const recMeta = REC_META[r.recommendation] || REC_META.monitor
            return (
              <>
                <div style={{ background: '#0d1117', border: `1px solid ${recMeta.border}`, borderRadius: 3, padding: '1rem 1.1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontFamily: sans, fontSize: '1rem', fontWeight: 700, color: '#e8eaed' }}>{form.companyName}</div>
                      <div style={{ fontFamily: mono, fontSize: '0.58rem', color: '#6b7280' }}>{[form.city, form.country].filter(Boolean).join(', ')} · {SEGMENT_LABELS[form.segment]}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: mono, fontSize: '2rem', fontWeight: 700, color: scoreColor(r.overallScore), lineHeight: 1 }}>{r.overallScore}</div>
                      <div style={{ fontFamily: mono, fontSize: '0.42rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>fit / 100</div>
                    </div>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.75rem', borderRadius: 2, background: recMeta.bg, border: `1px solid ${recMeta.border}`, marginBottom: '0.75rem' }}>
                    <span>{recMeta.icon}</span>
                    <span style={{ fontFamily: mono, fontSize: '0.58rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: recMeta.color, fontWeight: 700 }}>{recMeta.label}</span>
                  </div>
                  {r.whyFound && (
                    <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#9ca3af', lineHeight: 1.65 }}>{r.whyFound}</div>
                  )}
                </div>
                {error && <div style={mCss.errBox}>⚠ {error}</div>}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button style={mCss.analyzeBtn} onClick={handleSave} disabled={saving}>
                    {saving ? '⏳ Ukladám...' : '✓ Uložiť kartu firmy'}
                  </button>
                  <button style={{ ...mCss.cancelBtn }} onClick={() => setPhase('form')}>← Späť</button>
                </div>
              </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// ── Hlavný panel ──────────────────────────────────────────────────────────────

export default function EnergyTargetPanel({ view = 'dashboard', setView }) {
  const [targets, setTargets]   = useState([])
  const [selected, setSelected] = useState(null)
  const [addOpen, setAddOpen]   = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchQ, setSearchQ]   = useState('')

  useEffect(() => subscribeTargets(setTargets), [])

  // Sync s App-level view: Header "+ Pridať target" → otvoriť modal
  useEffect(() => {
    if (view === 'add') setAddOpen(true)
  }, [view])

  // Udržiavaj selected v sync s live dátami
  useEffect(() => {
    if (!selected) return
    const fresh = targets.find(t => t.id === selected.id)
    if (fresh) setSelected(fresh)
  }, [targets])

  function openAdd() {
    setAddOpen(true)
    setView?.('add')
  }

  function closeAdd() {
    setAddOpen(false)
    setView?.('dashboard')
  }

  const filtered = targets.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    if (searchQ) {
      const q = searchQ.toLowerCase()
      return t.name?.toLowerCase().includes(q) || t.city?.toLowerCase().includes(q)
    }
    return true
  })

  const counts = {
    total:     targets.length,
    immediate: targets.filter(t => t.recommendation === 'immediate').length,
    monitor:   targets.filter(t => t.recommendation === 'monitor').length,
    unsuitable:targets.filter(t => t.recommendation === 'unsuitable').length,
  }

  return (
    <div style={{ padding: '1.25rem', maxWidth: 1100, margin: '0 auto', width: '100%' }}>

      {/* Štatistiky — rovnaký panel ako AiSummaryPanel v Division A */}
      {targets.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem', marginBottom: '1rem', background: '#111418', border: '1px solid #1e2530', borderLeft: '3px solid #ffaa00', borderRadius: 2, padding: '0.85rem 1rem' }}>
          {[
            { label: 'Celkom targetov', value: counts.total,     color: '#ffaa00' },
            { label: 'Kontaktovať',     value: counts.immediate, color: '#00cc88' },
            { label: 'Sledovať',        value: counts.monitor,   color: '#ffaa00' },
            { label: 'Nevhodné',        value: counts.unsuitable,color: '#ef4444' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: mono, fontSize: '1.5rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280', marginTop: '0.25rem' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar — rovnaká štruktúra ako Dashboard toolbar */}
      <div className="dashboard-toolbar" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' }}>
        <button style={css.addBtn} onClick={openAdd}>+ Pridať target</button>
        <button
          style={{ ...css.filterBtn, ...(filterStatus === 'all' ? css.filterBtnOn : {}) }}
          onClick={() => setFilterStatus('all')}>
          Všetky ({targets.length})
        </button>
        {INTEL_STATUSES.map(s => {
          const count = targets.filter(t => t.status === s.key).length
          if (count === 0) return null
          return (
            <button key={s.key}
              style={{ ...css.filterBtn, ...(filterStatus === s.key ? { borderColor: s.color, color: s.color } : {}) }}
              onClick={() => setFilterStatus(s.key)}>
              {s.label} ({count})
            </button>
          )
        })}
        <input
          style={css.search}
          placeholder="Hľadať firmu alebo mesto..."
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
        />
      </div>

      {filtered.length > 0 && (
        <div style={{ fontFamily: mono, fontSize: '0.58rem', color: '#6b7280', letterSpacing: '1px', marginBottom: '0.6rem' }}>
          {filtered.length} targetov
        </div>
      )}

      {/* Prázdny stav */}
      {targets.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3.5rem', fontFamily: mono, fontSize: '0.75rem', color: '#6b7280', lineHeight: 2 }}>
          → Pridaj firmy cez "+ Pridať target" v hlavičke
        </div>
      )}

      {/* Grid kariet */}
      {filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '0.75rem' }}>
          {filtered.map(t => (
            <TargetCard key={t.id} target={t} onClick={() => setSelected(t)} />
          ))}
        </div>
      )}

      {filtered.length === 0 && targets.length > 0 && (
        <div style={{ fontFamily: mono, fontSize: '0.65rem', color: '#374151', textAlign: 'center', padding: '2rem' }}>
          Žiadne výsledky pre daný filter.
        </div>
      )}

      {/* Detail modal — rovnaký vzor ako CompanyDetailModal v Division A */}
      {selected && (
        <IntelCompanyDetail
          target={selected}
          onClose={() => setSelected(null)}
          onDelete={() => setSelected(null)}
        />
      )}

      {/* Add modal */}
      {addOpen && (
        <AddCompanyModal
          onClose={closeAdd}
          onAdded={newTarget => { closeAdd(); setSelected(newTarget) }}
        />
      )}
    </div>
  )
}

const css = {
  filterBtn:   { fontFamily: mono, fontSize: '0.58rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.25rem 0.65rem', border: '1px solid #1e2530', background: 'transparent', color: '#6b7280', borderRadius: 2, cursor: 'pointer' },
  filterBtnOn: { borderColor: '#ff5c00', color: '#ff5c00' },
  search:      { flex: 1, minWidth: 160, background: '#111418', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: mono, fontSize: '0.72rem', padding: '0.28rem 0.6rem', borderRadius: 2, outline: 'none' },
  addBtn:      { fontFamily: mono, fontSize: '0.62rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.3rem 0.85rem', border: '1px solid #ff5c00', background: 'rgba(255,92,0,0.1)', color: '#ff5c00', borderRadius: 2, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' },
}

const mCss = {
  label:      { display: 'block', fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.28rem' },
  input:      { width: '100%', background: '#0a0c0f', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: mono, fontSize: '0.8rem', padding: '0.5rem 0.65rem', borderRadius: 2, outline: 'none', boxSizing: 'border-box' },
  select:     { width: '100%', background: '#0a0c0f', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: mono, fontSize: '0.8rem', padding: '0.5rem 0.65rem', borderRadius: 2, outline: 'none', cursor: 'pointer' },
  analyzeBtn: { width: '100%', background: '#ff5c00', border: 'none', color: '#fff', fontFamily: mono, fontSize: '0.72rem', letterSpacing: '3px', textTransform: 'uppercase', padding: '0.78rem', borderRadius: 2, fontWeight: 700, cursor: 'pointer' },
  cancelBtn:  { background: 'transparent', border: '1px solid #1e2530', color: '#6b7280', fontFamily: mono, fontSize: '0.65rem', padding: '0.5rem 1rem', borderRadius: 2, cursor: 'pointer' },
  errBox:     { fontFamily: mono, fontSize: '0.62rem', color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '0.4rem 0.65rem', borderRadius: 2, marginBottom: '0.75rem' },
}
