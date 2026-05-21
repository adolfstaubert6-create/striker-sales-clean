/**
 * AddTargetPanel — App-level panel pre pridávanie intelligence targetov
 * Analogický so SearchPanel v Division A
 * Zobrazuje sa keď view='search' v Division B Intelligence module
 */
import { useState } from 'react'
import { SEGMENTS, SEGMENT_LABELS, COUNTRIES, REC_META, scoreColor } from '../constants/intelMeta.js'
import { addTarget } from '../services/intelTargetService.js'

const mono = "'IBM Plex Mono', monospace"
const sans = "'IBM Plex Sans', sans-serif"

export default function AddTargetPanel({ setView }) {
  const [form, setForm]     = useState({ companyName: '', url: '', segment: 'hotel', country: 'DE', city: '', companySize: '', employees: '', extraContext: '' })
  const [phase, setPhase]   = useState('form')   // 'form' | 'analyzing' | 'results'
  const [results, setResults] = useState([])
  const [saved, setSaved]   = useState({})        // { [idx]: 'saving'|'saved'|'dup' }
  const [error, setError]   = useState('')
  const [showCtx, setShowCtx] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleAnalyze() {
    if (!form.companyName.trim()) { setError('Zadaj názov firmy'); return }
    setError('')
    setPhase('analyzing')
    setResults([])
    setSaved({})
    try {
      const res  = await fetch('/.netlify/functions/energy-intel', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setResults([data])
      setPhase('results')
    } catch (e) {
      setError(e.message)
      setPhase('form')
    }
  }

  async function handleSave(idx) {
    const item = results[idx]
    if (!item) return
    setSaved(p => ({ ...p, [idx]: 'saving' }))
    const r = item.report
    try {
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
        buyingIntentScore:   r.buyingIntentScore || (r.buyingIntent === 'strong' ? 80 : r.buyingIntent === 'medium' ? 55 : 25),
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
        sources: [], contacts: [],
      }
      const res2 = await addTarget(doc)
      setSaved(p => ({ ...p, [idx]: res2.duplicate ? 'dup' : 'saved' }))
    } catch (e) {
      setSaved(p => ({ ...p, [idx]: null }))
      setError('Uloženie zlyhalo: ' + e.message)
    }
  }

  const allSaved = results.length > 0 && results.every((_, i) => saved[i] === 'saved' || saved[i] === 'dup')

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.25rem' }}>

      {/* Formulár */}
      <div style={{ background: '#111418', border: '1px solid #1e2530', borderRadius: 4, padding: '1.4rem', marginBottom: results.length > 0 ? '1.5rem' : 0 }}>
        <div style={{ fontFamily: mono, fontSize: '0.55rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '1.1rem' }}>
          🔍 AI Analýza firmy · STRIKER Intelligence
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={css.label}>Názov firmy *</label>
            <input
              style={css.input}
              placeholder="napr. Hotel Alpenhof GmbH"
              value={form.companyName}
              onChange={e => { set('companyName', e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              autoFocus
            />
          </div>
          <div>
            <label style={css.label}>Web / URL</label>
            <input style={css.input} placeholder="hotel-alpenhof.de" value={form.url} onChange={e => set('url', e.target.value)} />
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
            <input style={css.input} placeholder="München" value={form.city} onChange={e => set('city', e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={css.label}>Veľkosť firmy</label>
            <select style={css.select} value={form.companySize} onChange={e => set('companySize', e.target.value)}>
              <option value="">— Neznáma —</option>
              <option value="Malá firma">Malá firma (do 50 zam.)</option>
              <option value="Stredná firma">Stredná firma (50–250 zam.)</option>
              <option value="Veľká firma">Veľká firma (250–1 000 zam.)</option>
              <option value="Korporácia">Korporácia (1 000+ zam.)</option>
            </select>
          </div>
          <div>
            <label style={css.label}>Počet zamestnancov</label>
            <input style={css.input} placeholder="napr. 50–200" value={form.employees} onChange={e => set('employees', e.target.value)} />
          </div>
        </div>

        <button
          style={{ background: 'transparent', border: 'none', color: '#374151', fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', cursor: 'pointer', padding: 0, marginBottom: '0.75rem' }}
          onClick={() => setShowCtx(v => !v)}>
          {showCtx ? '▲' : '▼'} Dodatočný kontext pre AI (voliteľné)
        </button>
        {showCtx && (
          <textarea
            style={{ ...css.input, display: 'block', minHeight: 80, resize: 'vertical', lineHeight: 1.6, marginBottom: '0.75rem' }}
            placeholder="LinkedIn profil, výročná správa, novinový článok..."
            value={form.extraContext}
            onChange={e => set('extraContext', e.target.value)}
          />
        )}

        {error && <div style={css.errBox}>⚠ {error}</div>}

        <button
          style={{ ...css.analyzeBtn, opacity: phase === 'analyzing' ? 0.7 : 1 }}
          onClick={handleAnalyze}
          disabled={phase === 'analyzing'}>
          {phase === 'analyzing' ? '⏳ Analyzujem...' : '🔍 Spustiť AI analýzu'}
        </button>
      </div>

      {/* Loading state */}
      {phase === 'analyzing' && (
        <div style={{ background: '#111418', border: '1px solid #1e2530', borderRadius: 4, padding: '1.5rem', marginBottom: '1rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#ff5c00', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '1rem' }}>
            ◈ STRIKER AI ANALYZUJE...
          </div>
          {['Vyhodnocujem tepelnú potrebu...', 'Skórujem energetický problém...', 'Hľadám signály záujmu...', 'Posudzujem finančnú silu...', 'Kalkulujem STRIKER FIT...'].map((l, i) => (
            <div key={i} style={{ fontFamily: mono, fontSize: '0.58rem', color: '#374151', marginBottom: '0.3rem' }}>✦ {l}</div>
          ))}
        </div>
      )}

      {/* Výsledky */}
      {phase === 'results' && results.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontFamily: mono, fontSize: '0.6rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#6b7280' }}>
              {results.length} výsledkov · zoradené podľa STRIKER FIT
            </span>
            {results.length > 1 && (
              <button style={css.saveAllBtn} onClick={() => results.forEach((_, i) => !saved[i] && handleSave(i))}>
                + Uložiť všetky do B oddelenia
              </button>
            )}
          </div>

          {results.map((item, idx) => {
            const r = item.report
            const rec = REC_META[r.recommendation] || REC_META.monitor
            const saveState = saved[idx]
            return (
              <div key={idx} style={{ background: '#111418', border: '1px solid #1e2530', borderLeft: `3px solid ${scoreColor(r.overallScore)}`, borderRadius: 2, padding: '0.9rem 1rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.6rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: sans, fontWeight: 600, fontSize: '0.92rem', color: '#e8eaed', marginBottom: '0.15rem' }}>{form.companyName}</div>
                    <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#6b7280' }}>
                      {[form.city, form.country].filter(Boolean).join(', ')} · {SEGMENT_LABELS[form.segment]}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: mono, fontSize: '1.5rem', fontWeight: 700, color: scoreColor(r.overallScore), lineHeight: 1 }}>{r.overallScore}</div>
                    <div style={{ fontFamily: mono, fontSize: '0.45rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>FIT / 100</div>
                  </div>
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.65rem', borderRadius: 2, background: rec.bg, border: `1px solid ${rec.border}`, marginBottom: '0.65rem' }}>
                  <span>{rec.icon}</span>
                  <span style={{ fontFamily: mono, fontSize: '0.55rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: rec.color, fontWeight: 700 }}>{rec.label}</span>
                </div>

                {r.whyFound && (
                  <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#9ca3af', lineHeight: 1.65, marginBottom: '0.5rem', fontStyle: 'italic' }}>{r.whyFound}</div>
                )}

                {(r.signals || []).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.6rem' }}>
                    {r.signals.slice(0, 3).map((s, i) => (
                      <span key={i} style={{ fontFamily: mono, fontSize: '0.55rem', color: '#9ca3af', background: 'rgba(156,163,175,0.08)', border: '1px solid rgba(156,163,175,0.2)', padding: '0.1rem 0.38rem', borderRadius: 2 }}>▸ {s}</span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid #1e2530' }}>
                  <span style={{
                    fontFamily: mono, fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase',
                    padding: '0.1rem 0.4rem', borderRadius: 2,
                    ...(saveState === 'saved' ? { color: '#00cc88', background: 'rgba(0,204,136,0.1)', border: '1px solid rgba(0,204,136,0.3)' }
                      : saveState === 'dup'   ? { color: '#ffaa00', background: 'rgba(255,170,0,0.1)', border: '1px solid rgba(255,170,0,0.3)' }
                      : { color: '#818cf8', background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.3)' })
                  }}>
                    {saveState === 'saved' ? 'Uložený' : saveState === 'dup' ? 'Duplikát' : 'Nový'}
                  </span>
                  <button
                    style={{
                      fontFamily: mono, fontSize: '0.62rem', letterSpacing: '1px', textTransform: 'uppercase',
                      padding: '0.3rem 0.75rem', borderRadius: 2, cursor: saveState ? 'default' : 'pointer',
                      ...(saveState === 'saved' ? { border: '1px solid #1e2530', background: 'transparent', color: '#6b7280' }
                        : saveState === 'dup'   ? { border: '1px solid #ffaa0044', background: 'transparent', color: '#ffaa00' }
                        : saveState === 'saving'? { border: '1px solid #1e2530', background: 'transparent', color: '#6b7280' }
                        : { border: '1px solid #00cc88', background: 'transparent', color: '#00cc88' })
                    }}
                    onClick={() => !saveState && handleSave(idx)}
                    disabled={!!saveState}>
                    {saveState === 'saving' ? '⏳ Ukladám...'
                      : saveState === 'saved' ? '✓ Uložený v B oddelení'
                      : saveState === 'dup'   ? '⚠ Už existuje'
                      : '+ Uložiť do B oddelenia'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const css = {
  label:      { display: 'block', fontFamily: mono, fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.28rem' },
  input:      { width: '100%', background: '#0a0c0f', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: mono, fontSize: '0.8rem', padding: '0.48rem 0.65rem', borderRadius: 2, outline: 'none', boxSizing: 'border-box' },
  select:     { width: '100%', background: '#0a0c0f', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: mono, fontSize: '0.8rem', padding: '0.48rem 0.65rem', borderRadius: 2, outline: 'none', cursor: 'pointer' },
  analyzeBtn: { marginTop: '0.5rem', width: '100%', background: '#ffaa00', border: 'none', color: '#0a0c0f', fontFamily: mono, fontSize: '0.72rem', letterSpacing: '2px', textTransform: 'uppercase', padding: '0.68rem', borderRadius: 2, fontWeight: 700, cursor: 'pointer' },
  saveAllBtn: { fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.65rem', border: '1px solid #ffaa00', background: 'transparent', color: '#ffaa00', borderRadius: 2, cursor: 'pointer' },
  errBox:     { fontFamily: mono, fontSize: '0.62rem', color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '0.4rem 0.6rem', borderRadius: 2, marginBottom: '0.75rem' },
}
