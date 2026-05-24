// Vizuálny klon AgentPanel.jsx — rovnaké CSS, Division B AI Multi-Company Hunter
import { useState } from 'react'
import { SEGMENTS, COUNTRIES, scoreColor, REC_META } from '../constants/intelMeta.js'

const mono = "'IBM Plex Mono',monospace"

// 6 krokov — analogické Agent.js krokom v Division A
const STEPS = [
  { key: 'search',  icon: '🔍', label: 'Hľadanie'   },
  { key: 'enrich',  icon: '📊', label: 'Obohacovanie'},
  { key: 'score',   icon: '✦',  label: 'Scoring'    },
  { key: 'analyze', icon: '🧠', label: 'Analýza'    },
  { key: 'save',    icon: '💾', label: 'Uloženie'   },
]

const COUNTS = [1, 2, 3, 5, 8, 10, 15]

export default function IntelAgentPanel({ onDone, onAdded }) {
  const [form, setForm]             = useState({ segment: 'hotel', locality: '', country: 'DE', count: 5 })
  const [running, setRunning]       = useState(false)
  const [activeStep, setActiveStep] = useState(null)
  const [log, setLog]               = useState([])
  const [report, setReport]         = useState(null)
  const [error, setError]           = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function addLog(msg) {
    const ts = new Date().toLocaleTimeString('sk', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLog(p => [...p, { msg, ts }])
  }

  async function handleRun() {
    if (!form.locality.trim()) { setError('Zadaj mesto alebo región'); return }
    setError(null); setReport(null); setLog([])
    setRunning(true)

    addLog(`Spúšťam AI hľadanie — ${form.locality}, ${form.count} firiem`)

    // Simulácia krokov počas čakania na výsledok (ako v agent.js)
    const timers = [
      setTimeout(() => { setActiveStep('search');  addLog('AI hľadá firmy (Google Places)...') },     200),
      setTimeout(() => { setActiveStep('enrich');  addLog('AI zbiera weby a kontakty...') },          4000),
      setTimeout(() => { setActiveStep('score');   addLog('AI vyhodnocuje STRIKER FIT skóre...') },  10000),
      setTimeout(() => { setActiveStep('analyze'); addLog('AI analyzuje potenciál targetov...') },   16000),
      setTimeout(() => { setActiveStep('save');    addLog('AI ukladá targety do B oddelenia...') }, 21000),
    ]

    try {
      const res  = await fetch('/.netlify/functions/intel-hunt', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      timers.forEach(clearTimeout)
      setActiveStep(null)

      if (!data.ok) throw new Error(data.error)

      addLog(`✓ Hotovo: ${data.done} uložených · ${data.dups || 0} duplikátov · ${data.elapsed}`)
      if (data.done > 0 && onDone) onDone()
      setReport(data)

    } catch (e) {
      timers.forEach(clearTimeout)
      setActiveStep(null)
      setError(e.message)
      addLog(`❌ Chyba: ${e.message}`)
    } finally {
      setRunning(false)
    }
  }

  function handleReset() { setReport(null); setLog([]); setError(null); setActiveStep(null) }

  // Identický vizuálny štýl ako AgentPanel v Division A
  return (
    <div style={css.panel}>
      <div style={css.header}>
        <div style={css.title}>🤖 STRIKER Intelligence Agent</div>
        <div style={css.subtitle}>AI automaticky nájde firmy, ohodnotí STRIKER FIT a uloží targety do B oddelenia</div>
      </div>

      {/* Formulár — segment + región + krajina + počet (rovnaký vzor ako AgentPanel) */}
      <div style={css.form}>
        <div style={{ ...css.formRow, flexWrap: 'wrap' }}>
          <div style={{ ...css.field, flex: 2, minWidth: 140 }}>
            <label style={css.label}>Segment</label>
            <select style={css.select} value={form.segment} onChange={e => set('segment', e.target.value)} disabled={running}>
              {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div style={{ ...css.field, flex: 2, minWidth: 160 }}>
            <label style={css.label}>Mesto / Región *</label>
            <input style={css.input} placeholder="napr. München, Bayern, Hamburg"
              value={form.locality}
              onChange={e => { set('locality', e.target.value); setError(null) }}
              onKeyDown={e => e.key === 'Enter' && !running && handleRun()}
              disabled={running} />
          </div>
          <div style={{ ...css.field, minWidth: 80 }}>
            <label style={css.label}>Krajina</label>
            <select style={css.select} value={form.country} onChange={e => set('country', e.target.value)} disabled={running}>
              {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div style={{ ...css.field, minWidth: 80 }}>
            <label style={css.label}>Počet firiem</label>
            <select style={css.select} value={form.count} onChange={e => set('count', Number(e.target.value))} disabled={running}>
              {COUNTS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#ef4444', marginTop: '0.35rem' }}>⚠ {error}</div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
          <button style={{ ...css.runBtn, opacity: running ? 0.6 : 1 }} onClick={handleRun} disabled={running}>
            {running ? '⏳ Agent pracuje...' : '▶ Vyhľadať firmy s potrebou riešenia'}
          </button>
          {(report || log.length > 0) && !running && (
            <button style={css.resetBtn} onClick={handleReset}>↺ Resetovať</button>
          )}
        </div>
      </div>

      {/* Progress steps — identický vzor ako AgentPanel */}
      {(running || report) && (
        <div style={css.stepsRow}>
          {STEPS.map((s, i) => {
            const stepIdx = STEPS.findIndex(x => x.key === activeStep)
            const isDone  = report ? true : stepIdx > i
            const isActive = s.key === activeStep
            return (
              <div key={s.key} style={{ ...css.step, opacity: isDone || isActive ? 1 : 0.3 }}>
                <div style={{ ...css.stepDot, background: isDone ? '#00cc88' : isActive ? '#ff5c00' : '#1e2530', borderColor: isDone ? '#00cc88' : isActive ? '#ff5c00' : '#1e2530' }}>
                  {isDone ? '✓' : s.icon}
                </div>
                <div style={{ ...css.stepLabel, color: isActive ? '#ff5c00' : isDone ? '#00cc88' : '#4b5563' }}>{s.label}</div>
                {i < STEPS.length - 1 && (
                  <div style={{ ...css.stepLine, background: isDone ? '#00cc8844' : '#1e2530' }} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Live log — identický vzor ako AgentPanel */}
      {log.length > 0 && (
        <div style={css.logBox}>
          {log.map((e, i) => (
            <div key={i} style={css.logLine}>
              <span style={css.logTs}>{e.ts}</span>
              <span style={css.logMsg}>{e.msg}</span>
            </div>
          ))}
          {running && <div style={css.logCursor}>_</div>}
        </div>
      )}

      {/* Výsledky — zoznam nájdených firiem s ich skóre */}
      {report && !running && report.report?.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.58rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#00cc88', marginBottom: '0.5rem' }}>
            ✅ {report.done}/{report.total} · {report.elapsed} · kliknite na karte pre detail
          </div>
          {report.report.map((r, i) => {
            if (r.status === 'error') return (
              <div key={i} style={{ ...css.resultCard, borderLeftColor: '#ef4444' }}>
                <span style={{ fontFamily: mono, fontSize: '0.78rem', color: '#e8eaed' }}>{r.name}</span>
                <span style={{ fontFamily: mono, fontSize: '0.58rem', color: '#ef4444', marginLeft: '0.5rem' }}>⚠ {r.error}</span>
              </div>
            )
            const oc  = scoreColor(r.overallScore || 0)
            const rec = REC_META[r.recommendation] || REC_META.monitor
            return (
              <div key={i} style={{ ...css.resultCard, borderLeftColor: oc }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={css.resultName}>{r.name}</span>
                    {r.duplicate && <span style={css.dupTag}>DUPLIKÁT</span>}
                    <div style={{ fontFamily: mono, fontSize: '0.56rem', color: '#6b7280', marginTop: '0.15rem' }}>
                      {r.city}
                      {r.email && <span style={{ color: '#00cc88', marginLeft: '0.5rem' }}>✉ {r.email}</span>}
                      {r.web   && <span style={{ color: '#818cf8', marginLeft: '0.5rem' }}>🌐 {r.web}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    <span style={{ ...css.chip, color: oc, borderColor: oc + '44' }}>FIT {r.overallScore}</span>
                    <span style={{ ...css.chip, color: rec.color, borderColor: rec.color + '44' }}>{rec.icon} {rec.label}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Identické CSS ako AgentPanel.jsx
const css = {
  panel:      { background: '#0d1117', border: '1px solid #21262d', borderLeft: '3px solid #ff5c00', borderRadius: 4, padding: '1.25rem 1.4rem', marginBottom: '1.25rem' },
  header:     { marginBottom: '1rem' },
  title:      { fontFamily: mono, fontSize: '0.82rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#ff5c00', marginBottom: '0.25rem' },
  subtitle:   { fontFamily: mono, fontSize: '0.6rem', color: '#4b5563', letterSpacing: '0.5px' },
  form:       { marginBottom: '0.5rem' },
  formRow:    { display: 'flex', gap: '0.6rem' },
  field:      { display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, minWidth: 140 },
  label:      { fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#4b5563' },
  select:     { background: '#161b22', border: '1px solid #21262d', color: '#e8eaed', fontFamily: mono, fontSize: '0.7rem', padding: '0.38rem 0.5rem', borderRadius: 2, outline: 'none', cursor: 'pointer' },
  input:      { background: '#161b22', border: '1px solid #21262d', color: '#e8eaed', fontFamily: mono, fontSize: '0.7rem', padding: '0.38rem 0.6rem', borderRadius: 2, outline: 'none' },
  runBtn:     { fontFamily: mono, fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.4rem 1rem', border: 'none', background: '#ff5c00', color: '#fff', borderRadius: 2, fontWeight: 700, cursor: 'pointer' },
  resetBtn:   { fontFamily: mono, fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.4rem 0.8rem', border: '1px solid #21262d', background: 'transparent', color: '#6b7280', borderRadius: 2, cursor: 'pointer' },
  stepsRow:   { display: 'flex', alignItems: 'center', gap: 0, marginTop: '1rem', marginBottom: '0.5rem', flexWrap: 'nowrap', overflowX: 'auto' },
  step:       { display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', flex: 1, minWidth: 60 },
  stepDot:    { width: 28, height: 28, borderRadius: '50%', border: '2px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontFamily: mono, color: '#e8eaed', marginBottom: '0.25rem', flexShrink: 0 },
  stepLabel:  { fontFamily: mono, fontSize: '0.48rem', letterSpacing: '0.5px', textTransform: 'uppercase', textAlign: 'center' },
  stepLine:   { position: 'absolute', top: 13, left: '50%', width: '100%', height: 2, zIndex: 0 },
  logBox:     { background: '#080c11', border: '1px solid #1e2530', borderRadius: 3, padding: '0.6rem 0.75rem', marginTop: '0.6rem', maxHeight: 180, overflowY: 'auto', fontFamily: mono },
  logLine:    { display: 'flex', gap: '0.6rem', marginBottom: '0.18rem', alignItems: 'baseline' },
  logTs:      { fontSize: '0.52rem', color: '#4b5563', flexShrink: 0 },
  logMsg:     { fontSize: '0.62rem', color: '#9ca3af', lineHeight: 1.4 },
  logCursor:  { fontFamily: mono, fontSize: '0.72rem', color: '#ff5c00' },
  resultCard: { background: '#0d1117', border: '1px solid #21262d', borderLeft: '3px solid', borderRadius: 3, padding: '0.6rem 0.8rem', marginBottom: '0.35rem' },
  resultName: { fontFamily: "'IBM Plex Sans',sans-serif", fontSize: '0.85rem', fontWeight: 600, color: '#e8eaed' },
  dupTag:     { fontFamily: mono, fontSize: '0.5rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280', background: '#1e2530', padding: '0.06rem 0.3rem', borderRadius: 2, marginLeft: '0.4rem' },
  chip:       { fontFamily: mono, fontSize: '0.52rem', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '0.08rem 0.35rem', border: '1px solid', borderRadius: 2 },
}
