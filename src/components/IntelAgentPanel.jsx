/**
 * IntelAgentPanel — Autonomný agent pre Division B Intelligence
 * Analogický s AgentPanel.jsx v Division A
 * Spustí energy-intel + intelligence-gather pre zadanú firmu a uloží výsledok
 */
import { useState } from 'react'
import { SEGMENTS, COUNTRIES, SEGMENT_LABELS, scoreColor } from '../constants/intelMeta.js'
import { addTarget } from '../services/intelTargetService.js'

const mono = "'IBM Plex Mono', monospace"

const STEPS = [
  { key: 'score',   icon: '✦',  label: 'AI Scoring' },
  { key: 'crawl',   icon: '🌐', label: 'Web Scraping' },
  { key: 'signals', icon: '📡', label: 'Signály' },
  { key: 'save',    icon: '💾', label: 'Uloženie' },
]

export default function IntelAgentPanel({ onDone }) {
  const [form, setForm]               = useState({ url: '', segment: 'hotel', country: 'DE', city: '' })
  const [running, setRunning]         = useState(false)
  const [activeStep, setActiveStep]   = useState(null)
  const [log, setLog]                 = useState([])
  const [result, setResult]           = useState(null)
  const [error, setError]             = useState(null)
  const [cardStatus, setCardStatus]   = useState(null) // null | 'saving' | 'saved' | 'dup'

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function addLog(msg) {
    const ts = new Date().toLocaleTimeString('sk', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLog(prev => [...prev, { msg, ts }])
  }

  async function handleRun() {
    if (!form.url.trim()) { setError('Zadaj URL firmy'); return }
    setError(null)
    setResult(null)
    setLog([])
    setRunning(true)
    setCardStatus(null)
    setActiveStep('score')

    const companyName = form.url.trim().replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0]
    addLog(`Spúšťam agent — ${form.url}`)

    try {
      // Krok 1: AI scoring (energy-intel)
      addLog('Volám AI scoring (energy-intel)...')
      const scoreRes  = await fetch('/.netlify/functions/energy-intel', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ companyName, url: form.url.trim(), segment: form.segment, country: form.country, city: form.city }),
      })
      const scoreData = await scoreRes.json()
      if (!scoreData.ok) throw new Error(scoreData.error || 'energy-intel zlyhalo')
      const r = scoreData.report
      addLog(`✓ AI Score: ${r.overallScore}/100 — ${r.recommendation} · STRIKER FIT ${r.strikerFitScore}%`)

      // Krok 2: Web scraping (intelligence-gather / Firecrawl)
      setActiveStep('crawl')
      addLog('Spúšťam Firecrawl web scraping...')
      const gatherRes  = await fetch('/.netlify/functions/intelligence-gather', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          companyName: scoreData.companyName || companyName,
          url:                form.url.trim(),
          segment:            form.segment,
          segmentLabel:       SEGMENT_LABELS[form.segment] || form.segment,
          city:               form.city,
          country:            form.country,
          urgencyScore:       r.urgencyScore,
          buyingIntentScore:  r.buyingIntentScore || 50,
          strikerFitScore:    r.strikerFitScore,
          heatDemandScore:    r.heatDemandScore,
          energyPainScore:    r.energyPainScore,
          financialPowerScore:r.financialPowerScore,
        }),
      })
      const gatherData = await gatherRes.json()

      // Krok 3: Signály
      setActiveStep('signals')
      if (gatherData.ok) {
        addLog(`✓ Firecrawl: ${gatherData.webPagesCount} stránok · ${(gatherData.signals || []).length} signálov`)
        if ((gatherData.jobSignals || []).length > 0) {
          addLog(`✦ Job signály: ${gatherData.jobSignals.map(j => j.role).join(', ')}`)
        }
        if (gatherData.aiInterpretation?.isRealPressure) {
          addLog(`⚡ REÁLNY TLAK: ${gatherData.aiInterpretation.pressureLevel}`)
        }
      } else {
        addLog('⚠ Firecrawl nedostupný — pokračujem bez web dát')
      }

      // Krok 4: Kombinácia výsledkov
      setActiveStep('save')
      const updated  = gatherData.ok ? gatherData.updatedScores : {}
      const combined = {
        name:             scoreData.companyName || companyName,
        web:              form.url.trim(),
        country:          form.country,
        city:             form.city.trim(),
        segment:          form.segment,
        segmentLabel:     SEGMENT_LABELS[form.segment] || form.segment,
        companySize:      r.estimatedSize   || '',
        employees:        r.estimatedEmployees || '',
        status:           'analyzed',
        strikerFitScore:     updated?.strikerFitScore    ?? r.strikerFitScore,
        strikerFitReason:    r.strikerFitReason,
        energyPainScore:     r.energyPainScore,
        energyPainReason:    r.energyPainReason,
        urgencyScore:        updated?.urgencyScore       ?? r.urgencyScore,
        urgencyReason:       r.urgencyReason,
        financialPowerScore: r.financialPowerScore,
        financialPowerReason:r.financialPowerReason,
        buyingIntentScore:   updated?.buyingIntentScore  ?? r.buyingIntentScore ?? 50,
        buyingIntent:        updated?.buyingIntent       ?? r.buyingIntent,
        buyingIntentReason:  r.buyingIntentReason,
        overallScore:        r.overallScore,
        recommendation:      r.recommendation,
        recommendationReason:r.recommendationReason || r.reasoning || '',
        nextStep:            r.nextStep,
        whyFound:            gatherData.ok ? (gatherData.aiInterpretation?.pressureExplanation || r.whyFound || '') : (r.whyFound || ''),
        signals:             [...new Set([...(r.signals || []), ...(gatherData.signals || [])])],
        aiAnalysis: {
          whatTroubles:  r.aiAnalysis?.whatTroubles  || '',
          energyProblem: gatherData.ok ? (gatherData.aiInterpretation?.energyFindings || r.aiAnalysis?.energyProblem || '') : (r.aiAnalysis?.energyProblem || ''),
          whyStrikerFit: r.aiAnalysis?.whyStrikerFit || '',
          mainArgument:  gatherData.ok ? (gatherData.aiInterpretation?.strikerArgument || r.aiAnalysis?.mainArgument || '') : (r.aiAnalysis?.mainArgument || ''),
        },
        suggestedContacts: r.suggestedContacts || [],
        sources:     (gatherData.sources || []).map(s => ({ ...s, addedAt: new Date().toISOString() })),
        keyEvidence: gatherData.keyEvidence || [],
        jobSignals:  gatherData.jobSignals  || [],
        scrapedPages:gatherData.scrapedPages|| [],
        lastGatherSummary: gatherData.ok ? {
          isRealPressure:        gatherData.aiInterpretation?.isRealPressure,
          pressureLevel:         gatherData.aiInterpretation?.pressureLevel,
          pressureExplanation:   gatherData.aiInterpretation?.pressureExplanation,
          timingAssessment:      gatherData.aiInterpretation?.timingAssessment,
          energyFindings:        gatherData.aiInterpretation?.energyFindings,
          modernizationFindings: gatherData.aiInterpretation?.modernizationFindings,
          esgFindings:           gatherData.aiInterpretation?.esgFindings,
          strikerArgument:       gatherData.aiInterpretation?.strikerArgument,
          detectedJobRoles:      gatherData.aiInterpretation?.detectedJobRoles || [],
        } : null,
        contacts: [],
      }

      addLog(`Hotovo · STRIKER FIT ${combined.strikerFitScore}% · Signálov: ${combined.signals.length}`)
      setResult(combined)
      setActiveStep(null)
      if (onDone) onDone()

    } catch (e) {
      setActiveStep(null)
      setError(e.message)
      addLog(`❌ Chyba: ${e.message}`)
    } finally {
      setRunning(false)
    }
  }

  async function handleSave() {
    if (!result) return
    setCardStatus('saving')
    try {
      const res = await addTarget(result)
      setCardStatus(res.duplicate ? 'dup' : 'saved')
      if (res.duplicate) addLog('⚠ Duplikát — firma už existuje v B oddelení')
      else addLog(`✓ Uložené do B oddelenia`)
    } catch (e) {
      setCardStatus(null)
      setError('Chyba uloženia: ' + e.message)
    }
  }

  function handleReset() {
    setResult(null); setLog([]); setError(null); setActiveStep(null); setCardStatus(null)
  }

  return (
    <div style={{ background: '#0d1117', border: '1px solid #21262d', borderLeft: '3px solid #ffaa00', borderRadius: 4, padding: '1.25rem 1.4rem', marginBottom: '1.25rem' }}>

      {/* Hlavička */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontFamily: mono, fontSize: '0.82rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#ffaa00', marginBottom: '0.25rem' }}>
          🤖 STRIKER Intelligence Agent
        </div>
        <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#4b5563', letterSpacing: '0.5px' }}>
          AI scoring + Firecrawl web scraping + signálová detekcia
        </div>
      </div>

      {/* Formulár */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <div style={{ flex: 2, minWidth: 200 }}>
          <label style={css.label}>URL firmy *</label>
          <input style={css.input} placeholder="napr. hotel-alpenhof.de"
            value={form.url} onChange={e => set('url', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !running && handleRun()}
            disabled={running} />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label style={css.label}>Segment</label>
          <select style={css.select} value={form.segment} onChange={e => set('segment', e.target.value)} disabled={running}>
            {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 80 }}>
          <label style={css.label}>Krajina</label>
          <select style={css.select} value={form.country} onChange={e => set('country', e.target.value)} disabled={running}>
            {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label style={css.label}>Mesto</label>
          <input style={css.input} placeholder="München" value={form.city} onChange={e => set('city', e.target.value)} disabled={running} />
        </div>
      </div>

      {error && <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#ef4444', marginBottom: '0.4rem' }}>⚠ {error}</div>}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
        <button style={{ ...css.runBtn, opacity: running ? 0.6 : 1 }} onClick={handleRun} disabled={running}>
          {running ? '⏳ Agent pracuje...' : '▶ Spustiť agenta'}
        </button>
        {(result || log.length > 0) && !running && (
          <button style={css.resetBtn} onClick={handleReset}>↺ Reset</button>
        )}
      </div>

      {/* Progress steps */}
      {(running || result) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: '1rem', marginBottom: '0.5rem', flexWrap: 'nowrap', overflowX: 'auto' }}>
          {STEPS.map((s, i) => {
            const stepIdx = STEPS.findIndex(x => x.key === activeStep)
            const isDone  = result ? true : stepIdx > i
            const isActive = s.key === activeStep
            return (
              <div key={s.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 60, opacity: isDone || isActive ? 1 : 0.3, position: 'relative' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', border: '2px solid',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontFamily: mono, color: '#e8eaed', marginBottom: '0.25rem', flexShrink: 0,
                  background: isDone ? '#00cc88' : isActive ? '#ffaa00' : '#1e2530',
                  borderColor: isDone ? '#00cc88' : isActive ? '#ffaa00' : '#1e2530',
                }}>{isDone ? '✓' : s.icon}</div>
                <div style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '0.5px', textTransform: 'uppercase', textAlign: 'center', color: isActive ? '#ffaa00' : isDone ? '#00cc88' : '#4b5563' }}>{s.label}</div>
                {i < STEPS.length - 1 && (
                  <div style={{ position: 'absolute', top: 13, left: '50%', width: '100%', height: 2, zIndex: 0, background: isDone ? '#00cc8844' : '#1e2530' }} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <div style={{ background: '#080c11', border: '1px solid #1e2530', borderRadius: 3, padding: '0.6rem 0.75rem', marginTop: '0.6rem', maxHeight: 160, overflowY: 'auto', fontFamily: mono }}>
          {log.map((entry, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.18rem', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.52rem', color: '#4b5563', flexShrink: 0 }}>{entry.ts}</span>
              <span style={{ fontSize: '0.62rem', color: '#9ca3af', lineHeight: 1.4 }}>{entry.msg}</span>
            </div>
          ))}
          {running && <div style={{ fontSize: '0.72rem', color: '#ffaa00' }}>_</div>}
        </div>
      )}

      {/* Výsledok */}
      {result && !running && (
        <div style={{ marginTop: '0.75rem', background: '#0d1117', border: '1px solid #21262d', borderLeft: `3px solid ${scoreColor(result.overallScore)}`, borderRadius: 3, padding: '0.65rem 0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <div>
              <div style={{ fontFamily: mono, fontWeight: 600, fontSize: '0.88rem', color: '#e8eaed' }}>{result.name}</div>
              <div style={{ fontFamily: mono, fontSize: '0.58rem', color: '#6b7280' }}>{[result.city, result.country].filter(Boolean).join(', ')} · {result.segmentLabel}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: mono, fontSize: '1.4rem', fontWeight: 700, color: scoreColor(result.overallScore), lineHeight: 1 }}>{result.overallScore}</div>
              <div style={{ fontFamily: mono, fontSize: '0.42rem', color: '#6b7280', textTransform: 'uppercase' }}>FIT</div>
            </div>
          </div>
          <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#9ca3af', marginBottom: '0.5rem', lineHeight: 1.5 }}>
            {result.whyFound || result.aiAnalysis?.mainArgument || ''}
          </div>
          <div style={{ display: 'flex', gap: '0.45rem', paddingTop: '0.5rem', borderTop: '1px solid #1e2530' }}>
            {cardStatus === 'saved' ? (
              <div style={{ fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#00cc88' }}>✓ ULOŽENÉ</div>
            ) : cardStatus === 'dup' ? (
              <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#ffaa00' }}>⚠ Duplikát</div>
            ) : (
              <button
                style={{ fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.75rem', border: 'none', background: '#00cc88', color: '#0d1117', borderRadius: 2, fontWeight: 700, cursor: cardStatus === 'saving' ? 'not-allowed' : 'pointer', opacity: cardStatus === 'saving' ? 0.6 : 1 }}
                onClick={handleSave}
                disabled={cardStatus === 'saving'}>
                {cardStatus === 'saving' ? '⏳' : '✅ Uložiť do B oddelenia'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const css = {
  label:    { display: 'block', fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.2rem' },
  input:    { width: '100%', background: '#161b22', border: '1px solid #21262d', color: '#e8eaed', fontFamily: mono, fontSize: '0.7rem', padding: '0.38rem 0.6rem', borderRadius: 2, outline: 'none', boxSizing: 'border-box' },
  select:   { width: '100%', background: '#161b22', border: '1px solid #21262d', color: '#e8eaed', fontFamily: mono, fontSize: '0.7rem', padding: '0.38rem 0.5rem', borderRadius: 2, outline: 'none', cursor: 'pointer' },
  runBtn:   { fontFamily: mono, fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.4rem 1rem', border: 'none', background: '#ffaa00', color: '#0d1117', borderRadius: 2, fontWeight: 700, cursor: 'pointer' },
  resetBtn: { fontFamily: mono, fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.4rem 0.8rem', border: '1px solid #21262d', background: 'transparent', color: '#6b7280', borderRadius: 2, cursor: 'pointer' },
}
