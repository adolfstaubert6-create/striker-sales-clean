// Vizuálny klon AgentPanel.jsx — rovnaké CSS, AI Target Hunter logika
import { useState } from 'react'
import { SEGMENTS, COUNTRIES, SEGMENT_LABELS, scoreColor, REC_META } from '../constants/intelMeta.js'
import { addTarget } from '../services/intelTargetService.js'

const mono = "'IBM Plex Mono',monospace"

const STEPS = [
  { key: 'score',   icon: '✦',  label: 'AI Scoring'  },
  { key: 'crawl',   icon: '🌐', label: 'Web Scan'    },
  { key: 'analyze', icon: '🧠', label: 'Analýza'     },
  { key: 'save',    icon: '💾', label: 'Uloženie'    },
]

export default function IntelAgentPanel({ onDone, onAdded }) {
  const [form, setForm]             = useState({ companyName: '', url: '', segment: 'hotel', country: 'DE', city: '' })
  const [running, setRunning]       = useState(false)
  const [activeStep, setActiveStep] = useState(null)
  const [log, setLog]               = useState([])
  const [result, setResult]         = useState(null)
  const [error, setError]           = useState(null)
  const [cardStatus, setCardStatus] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function addLog(msg) {
    const ts = new Date().toLocaleTimeString('sk', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLog(p => [...p, { msg, ts }])
  }

  async function handleRun() {
    if (!form.companyName.trim()) { setError('Zadaj názov firmy'); return }
    setError(null); setResult(null); setLog([]); setCardStatus(null)
    setRunning(true); setActiveStep('score')
    addLog(`Spúšťam AI analýzu — ${form.companyName}`)

    try {
      setActiveStep('score')
      addLog('Volám AI scoring engine...')
      const scoreRes = await fetch('/.netlify/functions/energy-intel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const scoreData = await scoreRes.json()
      if (!scoreData.ok) throw new Error(scoreData.error)
      const r = scoreData.report
      addLog(`✓ FIT: ${r.overallScore}/100 · ${r.recommendation}`)

      setActiveStep('crawl')
      addLog('Spúšťam Firecrawl web scan...')
      const gatherRes = await fetch('/.netlify/functions/intelligence-gather', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, companyName: form.companyName, segmentLabel: SEGMENT_LABELS[form.segment], urgencyScore: r.urgencyScore, buyingIntentScore: r.buyingIntentScore || 50, strikerFitScore: r.strikerFitScore, heatDemandScore: r.heatDemandScore, energyPainScore: r.energyPainScore, financialPowerScore: r.financialPowerScore }),
      })
      const gatherData = await gatherRes.json()

      setActiveStep('analyze')
      if (gatherData.ok) {
        addLog(`✓ Web: ${gatherData.webPagesCount} stránok · ${(gatherData.signals || []).length} signálov`)
        if ((gatherData.jobSignals || []).length > 0)
          addLog(`✦ Job signály: ${gatherData.jobSignals.map(j => j.role).join(', ')}`)
      } else {
        addLog('⚠ Firecrawl nedostupný')
      }

      setActiveStep('save')
      const updated = gatherData.ok ? (gatherData.updatedScores || {}) : {}
      const combined = {
        name: form.companyName.trim(), web: form.url.trim(),
        country: form.country, city: form.city.trim(),
        segment: form.segment, segmentLabel: SEGMENT_LABELS[form.segment],
        status: 'analyzed',
        strikerFitScore:     updated.strikerFitScore    ?? r.strikerFitScore,
        strikerFitReason:    r.strikerFitReason,
        energyPainScore:     r.energyPainScore,
        energyPainReason:    r.energyPainReason,
        urgencyScore:        updated.urgencyScore       ?? r.urgencyScore,
        urgencyReason:       r.urgencyReason,
        financialPowerScore: r.financialPowerScore,
        financialPowerReason:r.financialPowerReason,
        buyingIntentScore:   updated.buyingIntentScore  ?? (r.buyingIntentScore || 50),
        buyingIntent:        updated.buyingIntent       ?? r.buyingIntent,
        buyingIntentReason:  r.buyingIntentReason,
        overallScore:        r.overallScore,
        recommendation:      r.recommendation,
        recommendationReason:r.recommendationReason || r.reasoning || '',
        nextStep:            r.nextStep,
        whyFound:            r.whyFound || '',
        signals:             [...new Set([...(r.signals||[]), ...(gatherData.signals||[])])],
        aiAnalysis: { whatTroubles: r.aiAnalysis?.whatTroubles||'', energyProblem: gatherData.ok ? (gatherData.aiInterpretation?.energyFindings||r.aiAnalysis?.energyProblem||'') : (r.aiAnalysis?.energyProblem||''), whyStrikerFit: r.aiAnalysis?.whyStrikerFit||'', mainArgument: gatherData.ok ? (gatherData.aiInterpretation?.strikerArgument||r.aiAnalysis?.mainArgument||'') : (r.aiAnalysis?.mainArgument||'') },
        suggestedContacts:   r.suggestedContacts || [],
        sources: (gatherData.sources||[]).map(s => ({...s, addedAt: new Date().toISOString()})),
        contacts: [],
      }
      addLog(`Hotovo · FIT ${combined.strikerFitScore}% · ${combined.signals.length} signálov`)
      setResult(combined)
      setActiveStep(null)
    } catch (e) {
      setActiveStep(null); setError(e.message); addLog(`❌ ${e.message}`)
    } finally { setRunning(false) }
  }

  async function handleSave() {
    if (!result) return
    setCardStatus('saving')
    try {
      const res = await addTarget(result)
      setCardStatus(res.duplicate ? 'dup' : 'saved')
      if (!res.duplicate && onAdded) onAdded({ id: res.id, ...result })
      if (!res.duplicate && onDone) onDone()
    } catch (e) { setCardStatus(null); setError('Chyba: ' + e.message) }
  }

  function handleReset() { setResult(null); setLog([]); setError(null); setActiveStep(null); setCardStatus(null) }

  // Identický vizuálny štýl ako AgentPanel
  return (
    <div style={css.panel}>
      <div style={css.header}>
        <div style={css.title}>🤖 STRIKER Intelligence Agent</div>
        <div style={css.subtitle}>AI vyhľadá, ohodnotí a naskenuje firmu automaticky</div>
      </div>

      <div style={css.form}>
        <div style={{ ...css.formRow, flexWrap: 'wrap' }}>
          <div style={{ ...css.field, flex: 2, minWidth: 180 }}>
            <label style={css.label}>Názov firmy</label>
            <input style={css.input} placeholder="napr. Hotel Alpenhof GmbH" value={form.companyName}
              onChange={e => set('companyName', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !running && handleRun()} disabled={running} />
          </div>
          <div style={{ ...css.field, flex: 2, minWidth: 160 }}>
            <label style={css.label}>Web / URL</label>
            <input style={css.input} placeholder="hotel-alpenhof.de" value={form.url}
              onChange={e => set('url', e.target.value)} disabled={running} />
          </div>
          <div style={{ ...css.field, flex: 1, minWidth: 130 }}>
            <label style={css.label}>Segment</label>
            <select style={css.select} value={form.segment} onChange={e => set('segment', e.target.value)} disabled={running}>
              {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div style={{ ...css.field, minWidth: 80 }}>
            <label style={css.label}>Krajina</label>
            <select style={css.select} value={form.country} onChange={e => set('country', e.target.value)} disabled={running}>
              {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
        {error && <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#ef4444', marginTop: '0.3rem' }}>⚠ {error}</div>}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
          <button style={{ ...css.runBtn, opacity: running ? 0.6 : 1 }} onClick={handleRun} disabled={running}>
            {running ? '⏳ Agent pracuje...' : '▶ Spustiť agenta'}
          </button>
          {(result || log.length > 0) && !running && (
            <button style={css.resetBtn} onClick={handleReset}>↺ Resetovať</button>
          )}
        </div>
      </div>

      {/* Progress steps — identický vzor ako AgentPanel */}
      {(running || result) && (
        <div style={css.stepsRow}>
          {STEPS.map((s, i) => {
            const stepIdx = STEPS.findIndex(x => x.key === activeStep)
            const isDone  = result ? true : stepIdx > i
            const isActive = s.key === activeStep
            return (
              <div key={s.key} style={{ ...css.step, opacity: isDone || isActive ? 1 : 0.3 }}>
                <div style={{ ...css.stepDot, background: isDone ? '#00cc88' : isActive ? '#ff5c00' : '#1e2530', borderColor: isDone ? '#00cc88' : isActive ? '#ff5c00' : '#1e2530' }}>
                  {isDone ? '✓' : s.icon}
                </div>
                <div style={{ ...css.stepLabel, color: isActive ? '#ff5c00' : isDone ? '#00cc88' : '#4b5563' }}>{s.label}</div>
                {i < STEPS.length - 1 && <div style={{ ...css.stepLine, background: isDone ? '#00cc8844' : '#1e2530' }} />}
              </div>
            )
          })}
        </div>
      )}

      {/* Live log — identický vzor */}
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

      {/* Result card */}
      {result && !running && (() => {
        const rec = REC_META[result.recommendation] || REC_META.monitor
        const oc  = scoreColor(result.overallScore)
        return (
          <div style={{ ...css.resultCard, borderLeftColor: oc }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={css.resultName}>{result.name}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <span style={{ ...css.chip, color: oc, borderColor: oc + '44' }}>FIT {result.overallScore}</span>
                <span style={{ ...css.chip, color: rec.color, borderColor: rec.color + '44' }}>{rec.icon} {rec.label}</span>
              </div>
            </div>
            {result.whyFound && <div style={css.resultEmail}>{result.whyFound}</div>}
            {result.nextStep  && <div style={css.resultNext}>→ {result.nextStep}</div>}
            <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.6rem', paddingTop: '0.55rem', borderTop: '1px solid #1e2530' }}>
              {cardStatus === 'saved' ? (
                <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#00cc88' }}>✓ ULOŽENÉ · karta sa otvorila</div>
              ) : cardStatus === 'dup' ? (
                <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#ffaa00' }}>⚠ Duplikát — firma už existuje</div>
              ) : (
                <button style={{ ...css.approveBtn, opacity: cardStatus === 'saving' ? 0.6 : 1 }}
                  onClick={handleSave} disabled={cardStatus === 'saving'}>
                  {cardStatus === 'saving' ? '⏳' : '✅ Uložiť do B oddelenia'}
                </button>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// Identické CSS ako AgentPanel
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
  resultCard: { background: '#0d1117', border: '1px solid #21262d', borderLeft: '3px solid #00cc88', borderRadius: 3, padding: '0.65rem 0.8rem', marginTop: '0.75rem' },
  resultName: { fontFamily: "'IBM Plex Sans',sans-serif", fontSize: '0.85rem', fontWeight: 600, color: '#e8eaed' },
  resultEmail:{ fontFamily: mono, fontSize: '0.62rem', color: '#9ca3af', marginTop: '0.3rem', fontStyle: 'italic' },
  resultNext: { fontFamily: mono, fontSize: '0.6rem', color: '#ffaa00', marginTop: '0.2rem' },
  chip:       { fontFamily: mono, fontSize: '0.52rem', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '0.08rem 0.35rem', border: '1px solid', borderRadius: 2 },
  approveBtn: { fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.75rem', border: 'none', background: '#00cc88', color: '#0d1117', borderRadius: 2, fontWeight: 700, cursor: 'pointer' },
}
