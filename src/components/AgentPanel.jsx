import { useState } from 'react'
import { db } from '../firebase.js'
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'

const CURRENT_USER = 'Staubert'
const mono = "'IBM Plex Mono',monospace"

const SEGMENTS = [
  { value: 'hotel',      label: '🏨 Hotel' },
  { value: 'restaurant', label: '🍽️ Reštaurácia' },
  { value: 'spa',        label: '💆 Spa / Wellness' },
  { value: 'laundry',    label: '🧺 Práčovňa' },
  { value: 'hospital',   label: '🏥 Nemocnica' },
]

const STEPS = [
  { key: 'search',     icon: '🔍', label: 'Vyhľadávanie' },
  { key: 'enrich',     icon: '📊', label: 'Obohacovanie' },
  { key: 'strategize', icon: '🧠', label: 'Stratégia' },
  { key: 'draft',      icon: '✉️',  label: 'Email draft' },
  { key: 'save',       icon: '💾', label: 'Uloženie' },
]

export default function AgentPanel({ division = 'A', onDone }) {
  const [form, setForm]       = useState({ segment: 'hotel', locality: '', count: 5 })
  const [running, setRunning] = useState(false)
  const [activeStep, setActiveStep] = useState(null)   // current step key
  const [log, setLog]         = useState([])
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState(null)
  const [cardStatuses, setCardStatuses] = useState({}) // { [docId]: 'pending'|'saving'|'approved'|'rejected' }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function setCardStatus(docId, status) {
    setCardStatuses(prev => ({ ...prev, [docId]: status }))
  }

  async function handleApprove(docId) {
    setCardStatus(docId, 'saving')
    try {
      await updateDoc(doc(db, 'companies', docId), {
        agentStatus: 'approved', updatedAt: serverTimestamp(),
      })
      await addDoc(collection(db, 'interactions'), {
        companyId: docId, type: 'agent_approved',
        message: `${CURRENT_USER} schválil agent email draft`,
        createdBy: CURRENT_USER, createdAt: serverTimestamp(),
      })
      setCardStatus(docId, 'approved')
    } catch (e) {
      setCardStatus(docId, 'pending')
      console.error('[AgentPanel] approve failed:', e.message)
    }
  }

  async function handleReject(docId) {
    setCardStatus(docId, 'saving')
    try {
      await updateDoc(doc(db, 'companies', docId), {
        agentStatus: 'rejected', updatedAt: serverTimestamp(),
      })
      await addDoc(collection(db, 'interactions'), {
        companyId: docId, type: 'agent_rejected',
        message: `${CURRENT_USER} zamietol agent email draft`,
        createdBy: CURRENT_USER, createdAt: serverTimestamp(),
      })
      setCardStatus(docId, 'rejected')
    } catch (e) {
      setCardStatus(docId, 'pending')
      console.error('[AgentPanel] reject failed:', e.message)
    }
  }

  function addLog(msg) {
    setLog(prev => [...prev, { msg, ts: new Date().toLocaleTimeString('sk', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])
  }

  async function handleRun() {
    if (!form.locality.trim()) { setError('Zadaj lokalitu'); return }
    setError(null)
    setResult(null)
    setLog([])
    setRunning(true)
    setActiveStep('search')
    addLog(`Spúšťam agenta — ${form.segment} · ${form.locality} · ${form.count} firiem`)

    try {
      // Progress simulation (real progress comes from server logs)
      const stepTimer = setTimeout(() => setActiveStep('enrich'),     3000)
      const stepTimer2 = setTimeout(() => setActiveStep('strategize'), 12000)
      const stepTimer3 = setTimeout(() => setActiveStep('draft'),      22000)
      const stepTimer4 = setTimeout(() => setActiveStep('save'),       35000)

      const res = await fetch('/.netlify/functions/agent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ segment: form.segment, locality: form.locality.trim(), count: form.count, division }),
      })

      clearTimeout(stepTimer); clearTimeout(stepTimer2)
      clearTimeout(stepTimer3); clearTimeout(stepTimer4)

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

      setActiveStep(null)
      setResult(data)
      // Init card statuses — all pending for cards that have a docId
      const initStatuses = {}
      data.report?.forEach(r => { if (r.docId) initStatuses[r.docId] = 'pending' })
      setCardStatuses(initStatuses)
      data.report?.forEach(r => {
        const icon = r.status === 'done' ? '✅' : '❌'
        const priorityLabel = r.priority === 'high' ? 'VYSOKÝ' : r.priority === 'medium' ? 'STREDNÝ' : r.priority === 'low' ? 'NÍZKY' : (r.priority || '–')
        addLog(`${icon} ${r.name} — BPS ${r.bps ?? '–'} · ${r.email || 'EMAIL NENÁJDENÝ'} · ${priorityLabel}`)
      })
      addLog(`Hotovo: ${data.done}/${data.total} · ${data.elapsed}`)
      if (onDone) onDone()

    } catch (e) {
      setActiveStep(null)
      setError(e.message)
      addLog(`❌ Chyba: ${e.message}`)
    } finally {
      setRunning(false)
    }
  }

  function handleReset() {
    setResult(null); setLog([]); setError(null); setActiveStep(null); setCardStatuses({})
  }

  return (
    <div style={css.panel}>
      {/* Header */}
      <div style={css.header}>
        <div style={css.title}>🤖 STRIKER Autonomous Agent</div>
        <div style={css.subtitle}>AI vyhľadá, ohodnotí a pripraví emaily automaticky</div>
      </div>

      {/* Form */}
      <div style={css.form}>
        <div style={css.formRow}>
          <div style={css.field}>
            <label style={css.label}>Segment</label>
            <select style={css.select} value={form.segment} onChange={e => set('segment', e.target.value)} disabled={running}>
              {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div style={{ ...css.field, flex: 2 }}>
            <label style={css.label}>Lokalita</label>
            <input
              style={css.input}
              placeholder="napr. München, Bayern"
              value={form.locality}
              onChange={e => set('locality', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !running && handleRun()}
              disabled={running}
            />
          </div>
          <div style={css.field}>
            <label style={css.label}>Počet firiem</label>
            <select style={css.select} value={form.count} onChange={e => set('count', Number(e.target.value))} disabled={running}>
              {[1,2,3,5,8,10].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        {error && <div style={css.errBox}>⚠ {error}</div>}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
          <button style={{ ...css.runBtn, opacity: running ? 0.6 : 1 }} onClick={handleRun} disabled={running}>
            {running ? '⏳ Agent pracuje...' : '▶ Spustiť agenta'}
          </button>
          {(result || log.length > 0) && !running && (
            <button style={css.resetBtn} onClick={handleReset}>↺ Resetovať</button>
          )}
        </div>
      </div>

      {/* Step progress bar */}
      {(running || result) && (
        <div style={css.stepsRow}>
          {STEPS.map((s, i) => {
            const stepIdx    = STEPS.findIndex(x => x.key === activeStep)
            const isDone     = result ? true : stepIdx > i
            const isActive   = s.key === activeStep
            return (
              <div key={s.key} style={{ ...css.step, opacity: isDone || isActive ? 1 : 0.3 }}>
                <div style={{
                  ...css.stepDot,
                  background: isDone ? '#00cc88' : isActive ? '#ff5c00' : '#1e2530',
                  borderColor: isDone ? '#00cc88' : isActive ? '#ff5c00' : '#1e2530',
                  animation: isActive ? 'priPulse 1s ease-in-out infinite' : 'none',
                }}>
                  {isDone ? '✓' : s.icon}
                </div>
                <div style={{ ...css.stepLabel, color: isActive ? '#ff5c00' : isDone ? '#00cc88' : '#4b5563' }}>
                  {s.label}
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ ...css.stepLine, background: isDone ? '#00cc8844' : '#1e2530' }} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Live log */}
      {log.length > 0 && (
        <div style={css.logBox}>
          {log.map((entry, i) => (
            <div key={i} style={css.logLine}>
              <span style={css.logTs}>{entry.ts}</span>
              <span style={css.logMsg}>{entry.msg}</span>
            </div>
          ))}
          {running && <div style={css.logCursor}>_</div>}
        </div>
      )}

      {/* Result cards */}
      {result && result.report?.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={css.resultTitle}>
            ✅ {result.done}/{result.total} spracovaných · {result.elapsed}
          </div>
          {result.report.map((r, i) => (
            <div key={i} style={{ ...css.resultCard, borderLeftColor: r.status === 'done' ? '#00cc88' : '#ef4444' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div>
                  <span style={css.resultName}>{r.name}</span>
                  {r.duplicate && <span style={css.dupTag}>DUPLIKÁT</span>}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                  {r.bps !== undefined && (
                    <span style={{ ...css.chip, color: r.bps >= 70 ? '#00cc88' : r.bps >= 50 ? '#ffaa00' : '#ef4444', borderColor: r.bps >= 70 ? '#00cc8844' : r.bps >= 50 ? '#ffaa0044' : '#ef444444' }}>
                      BPS {r.bps}
                    </span>
                  )}
                  {r.priority && (
                    <span style={{ ...css.chip, color: r.priority === 'high' ? '#ff5c00' : r.priority === 'medium' ? '#ffaa00' : '#6b7280', borderColor: r.priority === 'high' ? '#ff5c0044' : '#ffaa0044' }}>
                      {r.priority === 'high' ? 'VYSOKÝ' : r.priority === 'medium' ? 'STREDNÝ' : 'NÍZKY'}
                    </span>
                  )}
                </div>
              </div>
              {r.email
                ? <div style={css.resultEmail}>📧 {r.email}</div>
                : <div style={{ ...css.resultEmail, color: '#4b5563' }}>📧 EMAIL NENÁJDENÝ</div>
              }
              {r.draftDe && <div style={css.resultDraft}>✉ {r.draftDe}</div>}
              {r.nextStep && <div style={css.resultNext}>→ ĎALŠÍ KROK: {r.nextStep}</div>}
              {r.error && <div style={css.resultError}>⚠ CHYBA: {r.error}</div>}

              {/* Approve / Reject — only for cards with a Firestore doc */}
              {r.docId && r.status === 'done' && (() => {
                const cs = cardStatuses[r.docId] || 'pending'
                if (cs === 'approved') return (
                  <div style={css.statusBadgeOk}>✅ SCHVÁLENÉ</div>
                )
                if (cs === 'rejected') return (
                  <div style={css.statusBadgeErr}>❌ ZAMIETNUTÉ</div>
                )
                return (
                  <div style={css.actionRow}>
                    <button
                      style={{ ...css.approveBtn, opacity: cs === 'saving' ? 0.6 : 1 }}
                      disabled={cs === 'saving'}
                      onClick={() => handleApprove(r.docId)}>
                      {cs === 'saving' ? '⏳' : '✅ SCHVÁLIŤ'}
                    </button>
                    <button
                      style={{ ...css.rejectBtn, opacity: cs === 'saving' ? 0.6 : 1 }}
                      disabled={cs === 'saving'}
                      onClick={() => handleReject(r.docId)}>
                      {cs === 'saving' ? '⏳' : '❌ ZAMIETNUŤ'}
                    </button>
                  </div>
                )
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const css = {
  panel: {
    background: '#0d1117', border: '1px solid #21262d', borderLeft: '3px solid #ff5c00',
    borderRadius: 4, padding: '1.25rem 1.4rem', marginBottom: '1.25rem',
  },
  header: { marginBottom: '1rem' },
  title: {
    fontFamily: mono, fontSize: '0.82rem', fontWeight: 700, letterSpacing: '2px',
    textTransform: 'uppercase', color: '#ff5c00', marginBottom: '0.25rem',
  },
  subtitle: { fontFamily: mono, fontSize: '0.6rem', color: '#4b5563', letterSpacing: '0.5px' },

  form: { marginBottom: '0.5rem' },
  formRow: { display: 'flex', gap: '0.6rem', flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, minWidth: 140 },
  label: { fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#4b5563' },
  select: {
    background: '#161b22', border: '1px solid #21262d', color: '#e8eaed',
    fontFamily: mono, fontSize: '0.7rem', padding: '0.38rem 0.5rem', borderRadius: 2, outline: 'none', cursor: 'pointer',
  },
  input: {
    background: '#161b22', border: '1px solid #21262d', color: '#e8eaed',
    fontFamily: mono, fontSize: '0.7rem', padding: '0.38rem 0.6rem', borderRadius: 2, outline: 'none',
  },
  runBtn: {
    fontFamily: mono, fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase',
    padding: '0.4rem 1rem', border: 'none', background: '#ff5c00', color: '#fff',
    borderRadius: 2, fontWeight: 700, cursor: 'pointer',
  },
  resetBtn: {
    fontFamily: mono, fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase',
    padding: '0.4rem 0.8rem', border: '1px solid #21262d', background: 'transparent',
    color: '#6b7280', borderRadius: 2, cursor: 'pointer',
  },
  errBox: { fontFamily: mono, fontSize: '0.6rem', color: '#ef4444', marginTop: '0.4rem' },

  stepsRow: { display: 'flex', alignItems: 'center', gap: 0, marginTop: '1rem', marginBottom: '0.5rem', flexWrap: 'nowrap', overflowX: 'auto' },
  step: { display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', flex: 1, minWidth: 60 },
  stepDot: {
    width: 28, height: 28, borderRadius: '50%', border: '2px solid', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontFamily: mono,
    color: '#e8eaed', marginBottom: '0.25rem', flexShrink: 0,
  },
  stepLabel: { fontFamily: mono, fontSize: '0.48rem', letterSpacing: '0.5px', textTransform: 'uppercase', textAlign: 'center' },
  stepLine: { position: 'absolute', top: 13, left: '50%', width: '100%', height: 2, zIndex: 0 },

  logBox: {
    background: '#080c11', border: '1px solid #1e2530', borderRadius: 3,
    padding: '0.6rem 0.75rem', marginTop: '0.6rem', maxHeight: 180, overflowY: 'auto',
    fontFamily: mono,
  },
  logLine: { display: 'flex', gap: '0.6rem', marginBottom: '0.18rem', alignItems: 'baseline' },
  logTs:   { fontSize: '0.52rem', color: '#4b5563', flexShrink: 0 },
  logMsg:  { fontSize: '0.62rem', color: '#9ca3af', lineHeight: 1.4 },
  logCursor: { fontFamily: mono, fontSize: '0.72rem', color: '#ff5c00', animation: 'priPulse 1s ease-in-out infinite' },

  resultTitle: { fontFamily: mono, fontSize: '0.58rem', letterSpacing: '1px', color: '#00cc88', textTransform: 'uppercase', marginBottom: '0.5rem' },
  resultCard: {
    background: '#0d1117', border: '1px solid #21262d', borderLeft: '3px solid #00cc88',
    borderRadius: 3, padding: '0.65rem 0.8rem', marginBottom: '0.4rem',
  },
  resultName:  { fontFamily: "'IBM Plex Sans',sans-serif", fontSize: '0.85rem', fontWeight: 600, color: '#e8eaed' },
  dupTag:      { fontFamily: mono, fontSize: '0.5rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280', background: '#1e2530', padding: '0.06rem 0.3rem', borderRadius: 2, marginLeft: '0.4rem' },
  chip:        { fontFamily: mono, fontSize: '0.52rem', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '0.08rem 0.35rem', border: '1px solid', borderRadius: 2 },
  resultEmail: { fontFamily: mono, fontSize: '0.62rem', color: '#00cc88', marginTop: '0.3rem' },
  resultDraft: { fontFamily: mono, fontSize: '0.62rem', color: '#9ca3af', marginTop: '0.2rem', fontStyle: 'italic' },
  resultNext:  { fontFamily: mono, fontSize: '0.6rem', color: '#ffaa00', marginTop: '0.2rem' },
  resultError: { fontFamily: mono, fontSize: '0.6rem', color: '#ef4444', marginTop: '0.2rem' },

  actionRow:      { display: 'flex', gap: '0.45rem', marginTop: '0.6rem', paddingTop: '0.55rem', borderTop: '1px solid #1e2530' },
  approveBtn:     { fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.75rem', border: 'none', background: '#00cc88', color: '#0d1117', borderRadius: 2, fontWeight: 700, cursor: 'pointer' },
  rejectBtn:      { fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.75rem', border: '1px solid #ef444466', background: 'rgba(239,68,68,0.08)', color: '#ef4444', borderRadius: 2, fontWeight: 700, cursor: 'pointer' },
  statusBadgeOk:  { fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#00cc88', marginTop: '0.55rem', paddingTop: '0.5rem', borderTop: '1px solid #1e2530' },
  statusBadgeErr: { fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#ef4444', marginTop: '0.55rem', paddingTop: '0.5rem', borderTop: '1px solid #1e2530' },
}
