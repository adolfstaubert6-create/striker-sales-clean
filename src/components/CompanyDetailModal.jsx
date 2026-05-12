import { useState, useEffect, useCallback } from 'react'
import {
  db,
} from '../firebase.js'
import {
  doc, collection, onSnapshot, updateDoc, addDoc,
  query, where, serverTimestamp, orderBy,
} from 'firebase/firestore'
import { COMPANY_STATUSES, STATUS_LIST } from '../constants/companyStatuses.js'
import { calculatePriorityLabel } from '../utils/calculatePriorityLabel.js'
import { generateEmailDraft } from '../services/emailService.js'

const TYPE_LABEL = {
  hotel: '🏨 Hotel', laundry: '🧺 Práčovňa', spa: '💆 Wellness',
  hospital: '🏥 Nemocnica', restaurant: '🍽️ Reštaurácia',
}

const EVENT_ICONS = {
  company_saved:    '🏢',
  ai_score_created: '✦',
  status_changed:   '🔄',
  note_added:       '📝',
  task_created:     '✅',
  draft_created:    '✉',
  email_sent:       '📤',
  reply_received:   '📥',
}

const SCORE_COLOR = s =>
  s == null ? '#4b5563' : s >= 80 ? '#00cc88' : s >= 50 ? '#ffaa00' : '#ff3333'

function fmtTs(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('sk-SK') + ' ' +
    d.getHours().toString().padStart(2, '0') + ':' +
    d.getMinutes().toString().padStart(2, '0')
}

function extractDomain(w) {
  if (!w) return null
  return w.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
}

// ── AI priority badge ────────────────────────────────────────────────────────
function AiBadge({ pri, score }) {
  if (!pri) return null
  const isHigh = pri.label === 'Vysoký'
  const isMed  = pri.label === 'Stredný'
  const glow   = isHigh ? '#ffaa00' : isMed ? '#3b82f6' : '#ef4444'
  const bg     = isHigh ? 'rgba(255,170,0,0.06)' : isMed ? 'rgba(59,130,246,0.06)' : 'rgba(239,68,68,0.04)'
  const icon   = isHigh ? '✦' : isMed ? '◈' : '◇'
  const conf   = isHigh ? 'Vysoká istota' : isMed ? 'Stredná istota' : 'Nízka istota'
  const anim   = isHigh ? 'priPulse 3s ease-in-out infinite' : isMed ? 'priPulse 5s ease-in-out infinite' : 'none'
  return (
    <div style={{ background: bg, border: `1px solid ${glow}44`, boxShadow: `0 0 14px ${glow}1a`, borderRadius: 4, padding: '0.85rem 1rem', marginBottom: '1rem', animation: anim }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
        <span style={{ color: glow, fontSize: '1rem' }}>{icon}</span>
        <span style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#4b5563' }}>{conf}</span>
      </div>
      <div style={{ fontFamily: mono, fontSize: '0.95rem', fontWeight: 700, color: glow }}>{pri.label} potenciál</div>
      {score != null && <div style={{ fontFamily: mono, fontSize: '0.55rem', color: '#4b5563', marginTop: '0.2rem' }}>BPS {score} / 100</div>}
    </div>
  )
}

// ── Toast feedback ───────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null
  const col = type === 'err' ? '#ef4444' : '#00cc88'
  return (
    <div style={{ position: 'sticky', bottom: 0, left: 0, right: 0, background: '#0d1117', borderTop: `1px solid ${col}44`, padding: '0.5rem 1rem', fontFamily: mono, fontSize: '0.65rem', color: col, textAlign: 'center', zIndex: 10 }}>
      {msg}
    </div>
  )
}

// ── Feedback button label ────────────────────────────────────────────────────
function fbLabel(state, idle) {
  if (state === 'saving') return '⏳ Ukladám...'
  if (state === 'saved')  return '✓ Uložené'
  if (state === 'error')  return '✗ Chyba'
  return idle
}

// ── Main modal ───────────────────────────────────────────────────────────────
export default function CompanyDetailModal({ company: initialCompany, onClose }) {
  const [live, setLive]               = useState(initialCompany)
  const [interactions, setInteract]   = useState([])
  const [tasks, setTasks]             = useState([])
  const [note, setNote]               = useState(initialCompany.notes || '')
  const [taskText, setTaskText]       = useState('')
  const [draftSubj, setDraftSubj]     = useState('')
  const [draftBody, setDraftBody]     = useState('')
  const [draftOpen, setDraftOpen]     = useState(false)
  const [fb, setFb]                   = useState({}) // { [key]: 'saving'|'saved'|'error' }
  const [toast, setToast]             = useState(null)

  // ── Subscriptions ──────────────────────────────────────────────────────────
  useEffect(() => {
    const id = initialCompany.id

    // 1. Live company doc
    const unsubDoc = onSnapshot(doc(db, 'companies', id), snap => {
      if (snap.exists()) setLive({ id: snap.id, ...snap.data() })
    })

    // 2. Interactions (sorted client-side to avoid composite index)
    const unsubInter = onSnapshot(
      query(collection(db, 'interactions'), where('companyId', '==', id)),
      snap => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        rows.sort((a, b) => {
          const ta = a.timestamp?.toDate?.() || new Date(0)
          const tb = b.timestamp?.toDate?.() || new Date(0)
          return tb - ta
        })
        setInteract(rows)
      }
    )

    // 3. Tasks
    const unsubTasks = onSnapshot(
      query(collection(db, 'tasks'), where('companyId', '==', id)),
      snap => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        rows.sort((a, b) => {
          const ta = a.createdAt?.toDate?.() || new Date(0)
          const tb = b.createdAt?.toDate?.() || new Date(0)
          return ta - tb
        })
        setTasks(rows)
      }
    )

    return () => { unsubDoc(); unsubInter(); unsubTasks() }
  }, [initialCompany.id])

  // Sync note textarea when live data changes
  useEffect(() => { setNote(live.notes || '') }, [live.notes])

  // ── Feedback helpers ───────────────────────────────────────────────────────
  const setFbKey = (key, state) => setFb(p => ({ ...p, [key]: state }))

  function showToast(msg, type = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  async function withFb(key, fn) {
    setFbKey(key, 'saving')
    try {
      await fn()
      setFbKey(key, 'saved')
      setTimeout(() => setFbKey(key, null), 2000)
      showToast('Uložené ✓')
    } catch (e) {
      setFbKey(key, 'error')
      setTimeout(() => setFbKey(key, null), 3000)
      showToast('Chyba: ' + e.message, 'err')
      console.error('[CompanyDetailModal]', key, e)
    }
  }

  async function logInteraction(type, extra = {}) {
    await addDoc(collection(db, 'interactions'), {
      companyId: live.id,
      type,
      timestamp: serverTimestamp(),
      ...extra,
    })
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function handleStatusChange(newStatus) {
    const oldStatus = live.status
    await withFb('status', async () => {
      await updateDoc(doc(db, 'companies', live.id), {
        status: newStatus,
        statusChangedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      await logInteraction('status_changed', { oldStatus, newStatus })
    })
  }

  async function handleSaveNote() {
    await withFb('note', async () => {
      await updateDoc(doc(db, 'companies', live.id), {
        notes: note,
        updatedAt: serverTimestamp(),
      })
      await logInteraction('note_added', { content: note.slice(0, 120) })
    })
  }

  async function handleCreateTask() {
    const text = taskText.trim()
    if (!text) return
    await withFb('task', async () => {
      await addDoc(collection(db, 'tasks'), {
        companyId: live.id,
        text,
        done: false,
        createdAt: serverTimestamp(),
      })
      await logInteraction('task_created', { content: text })
      setTaskText('')
    })
  }

  async function handleToggleTask(taskId, currentDone) {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        done: !currentDone,
        doneAt: !currentDone ? serverTimestamp() : null,
      })
    } catch (e) {
      showToast('Chyba úlohy: ' + e.message, 'err')
    }
  }

  function openDraft() {
    const { subject, body } = generateEmailDraft(live)
    setDraftSubj(subject)
    setDraftBody(body)
    setDraftOpen(true)
  }

  function handleKeyDown(e) { if (e.key === 'Escape') onClose() }

  // ── Derived ────────────────────────────────────────────────────────────────
  const st       = COMPANY_STATUSES[live.status] || COMPANY_STATUSES.new
  const pri      = calculatePriorityLabel(live.aiScore)
  const sc       = live.aiScore
  const scCol    = SCORE_COLOR(sc)
  const positive = live.aiPositive || live.aiFactors?.positive || []
  const risks    = live.aiRisks    || live.aiFactors?.risks    || []
  const nextStep = live.aiNextStep || live.aiFactors?.nextStep || ''
  const reason   = live.aiReason   || ''
  const domain   = extractDomain(live.website)

  return (
    <div style={css.overlay} onKeyDown={handleKeyDown} tabIndex={-1}>
      <style>{`@keyframes priPulse{0%,100%{opacity:1}50%{opacity:.85}}`}</style>

      <div style={css.modal}>

        {/* ══ HEADER ══ */}
        <div style={css.header}>
          <div style={css.headerLeft}>
            <div style={css.companyName}>{live.name}</div>
            <div style={css.headerMeta}>
              {TYPE_LABEL[live.category] || live.category}
              {live.city    && <><span style={css.dot}>·</span><span>{live.city}</span></>}
              {live.country && <><span style={css.dot}>·</span><span>{live.country}</span></>}
            </div>
            {nextStep && <div style={css.headerNextStep}>→ {nextStep}</div>}
          </div>
          <div style={css.headerRight}>
            <div style={{ ...css.scoreCircle, borderColor: scCol, color: scCol }}>
              <div style={css.scoreNum}>{sc != null ? sc : '–'}</div>
              <div style={css.scoreBot}>BPS</div>
            </div>
            <div style={{ ...css.statusBadge, background: st.bg, color: st.color, borderColor: st.color + '55' }}>
              {st.label}
            </div>
            <button style={css.closeBtn} onClick={onClose} title="Esc">✕</button>
          </div>
        </div>

        {/* ══ THREE COLUMNS ══ */}
        <div style={css.cols}>

          {/* LEFT — contact */}
          <div style={css.col}>
            <ColTitle>Kontaktné údaje</ColTitle>
            <InfoRow label="Email">
              {live.email
                ? <span style={{ color: '#00cc88', fontFamily: mono, fontSize: '0.72rem' }}>{live.email}</span>
                : <span style={{ color: '#ffaa00', fontFamily: mono, fontSize: '0.68rem' }}>⚠ Chýba</span>}
            </InfoRow>
            <InfoRow label="Telefón">
              {live.phone ? <a href={`tel:${live.phone}`} style={css.link}>{live.phone}</a> : <Muted>–</Muted>}
            </InfoRow>
            <InfoRow label="Web">
              {domain
                ? <a href={`https://${live.website}`} target="_blank" rel="noreferrer" style={css.webLink} title={live.website}>{domain}</a>
                : <Muted>–</Muted>}
            </InfoRow>
            <InfoRow label="Adresa">   <Muted>{live.address       || '–'}</Muted></InfoRow>
            <InfoRow label="Kontakt">  <Muted>{live.contactPerson || '–'}</Muted></InfoRow>
            <InfoRow label="Rating">   <Muted>{live.rating ? `⭐ ${live.rating} / 5` : '–'}</Muted></InfoRow>
            <InfoRow label="Place ID"> <Muted style={{ fontSize: '0.56rem' }}>{live.googlePlaceId || '–'}</Muted></InfoRow>
          </div>

          {/* CENTER — AI */}
          <div style={css.col}>
            <ColTitle>AI Analýza</ColTitle>
            <AiBadge pri={pri} score={sc} />
            {reason && <div style={css.aiReason}>✦ {reason}</div>}
            {positive.length > 0 && (
              <>
                <div style={css.factorTitle}>Pozitívne signály</div>
                {positive.map((f, i) => <div key={i} style={css.factorPos}>✓ {f}</div>)}
              </>
            )}
            {risks.length > 0 && (
              <>
                <div style={{ ...css.factorTitle, marginTop: '0.75rem' }}>Riziká</div>
                {risks.map((r, i) => <div key={i} style={css.factorRisk}>⚠ {r}</div>)}
              </>
            )}
          </div>

          {/* RIGHT — CRM */}
          <div style={css.col}>
            <ColTitle>CRM Stav</ColTitle>
            <div style={css.statusChangeRow}>
              {STATUS_LIST.map(s => (
                <button key={s.key}
                  style={{
                    ...css.stBtn,
                    background:  live.status === s.key ? s.bg        : 'transparent',
                    color:       live.status === s.key ? s.color     : '#4b5563',
                    borderColor: live.status === s.key ? s.color+'88': '#1e2530',
                  }}
                  onClick={() => handleStatusChange(s.key)}>
                  {live.status === s.key && fb.status === 'saving' ? '⏳' : s.label}
                </button>
              ))}
            </div>
            {fb.status === 'saved' && <div style={css.fbOk}>✓ Status uložený</div>}
            {fb.status === 'error' && <div style={css.fbErr}>✗ Chyba uloženia</div>}

            <InfoRow label="Priorita">
              {pri ? <span style={{ color: pri.color, fontFamily: mono, fontSize: '0.68rem' }}>{pri.label}</span> : <Muted>–</Muted>}
            </InfoRow>
            <InfoRow label="Posl. kontakt"><Muted>{live.lastContact || '–'}</Muted></InfoRow>
            <InfoRow label="Ďalší krok">  <Muted>{live.nextAction  || '–'}</Muted></InfoRow>
            <InfoRow label="Zodpovedný">  <Muted>{live.assignee    || '–'}</Muted></InfoRow>

            {/* Tasks */}
            <div style={{ marginTop: '1.25rem' }}>
              <div style={css.factorTitle}>Úlohy ({tasks.length})</div>
              {tasks.map(t => (
                <div key={t.id} style={css.taskItem}>
                  <input type="checkbox" checked={!!t.done}
                    onChange={() => handleToggleTask(t.id, t.done)}
                    style={{ accentColor: '#00cc88', marginRight: '0.4rem', cursor: 'pointer' }} />
                  <span style={{ fontFamily: mono, fontSize: '0.65rem', color: t.done ? '#4b5563' : '#e8eaed', textDecoration: t.done ? 'line-through' : 'none' }}>
                    {t.text}
                  </span>
                </div>
              ))}
              <div style={css.taskRow}>
                <input style={css.taskInput} placeholder="Nová úloha..."
                  value={taskText} onChange={e => setTaskText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateTask()} />
                <button style={{ ...css.taskBtn, opacity: fb.task === 'saving' ? 0.5 : 1 }}
                  onClick={handleCreateTask} disabled={fb.task === 'saving'}>
                  {fb.task === 'saving' ? '⏳' : '+'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={css.divider} />

        {/* ══ EMAIL ══ */}
        <div style={css.section}>
          <ColTitle>Email</ColTitle>
          <div style={css.emailStatus}>
            <span style={live.email ? css.emailFoundBadge : css.emailMissingBadge}>
              {live.email ? `✓ Email nájdený — ${live.email}` : '⚠ Email chýba'}
            </span>
            {live.draftStatus && (
              <span style={css.draftStatusBadge}>Draft: {live.draftStatus}</span>
            )}
          </div>
          <div style={css.emailBtns}>
            <button style={css.btnPrimary} onClick={openDraft}>✦ Generovať draft</button>
            <button style={css.btnSecondary} onClick={() => setDraftOpen(o => !o)}>✎ Editovať</button>
            <button style={{ ...css.btnSecondary, color: '#ffaa00', borderColor: '#ffaa0055' }}
              onClick={() => handleStatusChange('contacted')}>
              ✓ Schváliť
            </button>
          </div>
          {draftOpen && (
            <div style={css.draftBox}>
              <label style={css.draftLabel}>Predmet</label>
              <input style={css.draftInput} value={draftSubj} onChange={e => setDraftSubj(e.target.value)} />
              <label style={css.draftLabel}>Text</label>
              <textarea style={css.draftArea} value={draftBody} onChange={e => setDraftBody(e.target.value)} />
            </div>
          )}
        </div>

        <div style={css.divider} />

        {/* ══ TIMELINE (live interactions) ══ */}
        <div style={css.section}>
          <ColTitle>Časová os · {interactions.length} udalostí</ColTitle>
          {interactions.length === 0 ? (
            <div style={{ fontFamily: mono, fontSize: '0.65rem', color: '#4b5563' }}>Žiadne udalosti</div>
          ) : (
            <div style={css.timeline}>
              {interactions.slice(0, 15).map(ev => (
                <div key={ev.id} style={css.tlRow}>
                  <span style={css.tlIcon}>{EVENT_ICONS[ev.type] || '·'}</span>
                  <div style={css.tlContent}>
                    <span style={css.tlLabel}>{formatEventLabel(ev)}</span>
                    <span style={css.tlTime}>{fmtTs(ev.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={css.divider} />

        {/* ══ NOTES ══ */}
        <div style={css.section}>
          <ColTitle>Interné poznámky</ColTitle>
          <textarea style={css.notesArea}
            placeholder="Poznámky k firme..."
            value={note} onChange={e => setNote(e.target.value)} />
          <div style={css.notesBtns}>
            <button style={{ ...css.btnPrimary, opacity: fb.note === 'saving' ? 0.6 : 1 }}
              onClick={handleSaveNote} disabled={fb.note === 'saving'}>
              {fbLabel(fb.note, 'Uložiť poznámky')}
            </button>
            {reason && (
              <div style={css.aiSuggest}>
                <span style={css.aiSuggestLabel}>AI: </span>{reason}
              </div>
            )}
          </div>
        </div>

        <Toast msg={toast?.msg} type={toast?.type} />
      </div>
    </div>
  )
}

function formatEventLabel(ev) {
  switch (ev.type) {
    case 'status_changed':   return `Status: ${ev.oldStatus || '?'} → ${ev.newStatus || '?'}`
    case 'note_added':       return 'Poznámka pridaná'
    case 'task_created':     return `Úloha: ${ev.content || ''}`
    case 'ai_score_created': return 'AI skóre vypočítané'
    case 'company_saved':    return 'Firma uložená'
    case 'draft_created':    return 'Email draft vytvorený'
    case 'email_sent':       return 'Email odoslaný'
    case 'reply_received':   return 'Odpoveď prijatá'
    default:                 return ev.type
  }
}

function ColTitle({ children }) {
  return (
    <div style={{ fontFamily: mono, fontSize: '0.55rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.85rem', paddingBottom: '0.4rem', borderBottom: '1px solid #1e2530' }}>
      {children}
    </div>
  )
}

function InfoRow({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.6rem', alignItems: 'baseline' }}>
      <span style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#4b5563', width: 80, flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  )
}

function Muted({ children, style }) {
  return <span style={{ fontFamily: mono, fontSize: '0.68rem', color: '#6b7280', ...style }}>{children}</span>
}

const mono = "'IBM Plex Mono',monospace"

const css = {
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 500, overflowY: 'auto', padding: '2rem 1rem', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' },
  modal:        { background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, width: '100%', maxWidth: 1100, padding: '2rem 2.25rem', position: 'relative' },

  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', gap: '1.5rem' },
  headerLeft:   { flex: 1, minWidth: 0 },
  headerRight:  { display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 },
  companyName:  { fontFamily: "'IBM Plex Sans',sans-serif", fontSize: '1.5rem', fontWeight: 700, color: '#f0f6fc', marginBottom: '0.3rem', lineHeight: 1.2 },
  headerMeta:   { fontFamily: mono, fontSize: '0.65rem', color: '#6b7280', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' },
  dot:          { color: '#2d3748' },
  headerNextStep:{ fontFamily: mono, fontSize: '0.7rem', color: '#00cc88', marginTop: '0.55rem' },
  scoreCircle:  { width: 72, height: 72, borderRadius: '50%', border: '3px solid', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  scoreNum:     { fontFamily: mono, fontSize: '1.35rem', fontWeight: 700, lineHeight: 1 },
  scoreBot:     { fontFamily: mono, fontSize: '0.42rem', letterSpacing: '2px', color: '#4b5563', marginTop: 2 },
  statusBadge:  { fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.25rem 0.6rem', borderRadius: 3, border: '1px solid', whiteSpace: 'nowrap' },
  closeBtn:     { background: 'transparent', border: '1px solid #21262d', color: '#6b7280', width: 32, height: 32, borderRadius: 3, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  cols:         { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2.5rem', marginBottom: '1.5rem' },
  col:          { minWidth: 0, padding: '0 0.25rem' },

  aiReason:     { fontFamily: mono, fontSize: '0.65rem', color: '#9ca3af', fontStyle: 'italic', marginBottom: '0.85rem', lineHeight: 1.65, background: 'rgba(255,255,255,0.03)', padding: '0.55rem 0.65rem', borderRadius: 3 },
  factorTitle:  { fontFamily: mono, fontSize: '0.52rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.35rem' },
  factorPos:    { fontFamily: mono, fontSize: '0.65rem', color: '#00cc88', lineHeight: 1.85 },
  factorRisk:   { fontFamily: mono, fontSize: '0.65rem', color: '#ffaa00', lineHeight: 1.85 },

  statusChangeRow: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' },
  stBtn:        { fontFamily: mono, fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.2rem 0.5rem', border: '1px solid', borderRadius: 2, cursor: 'pointer', transition: 'all 0.1s' },
  fbOk:         { fontFamily: mono, fontSize: '0.6rem', color: '#00cc88', marginBottom: '0.5rem' },
  fbErr:        { fontFamily: mono, fontSize: '0.6rem', color: '#ef4444', marginBottom: '0.5rem' },

  taskItem:     { display: 'flex', alignItems: 'center', padding: '0.2rem 0', borderBottom: '1px solid #161b22' },
  taskRow:      { display: 'flex', gap: '0.4rem', marginTop: '0.5rem' },
  taskInput:    { flex: 1, background: '#161b22', border: '1px solid #21262d', color: '#e8eaed', fontFamily: mono, fontSize: '0.68rem', padding: '0.35rem 0.5rem', borderRadius: 2, outline: 'none' },
  taskBtn:      { background: '#ff5c00', border: 'none', color: '#fff', fontWeight: 700, width: 32, borderRadius: 2, cursor: 'pointer', fontSize: '1.1rem' },

  divider:      { height: 1, background: '#161b22', margin: '1.5rem 0' },
  section:      { marginBottom: '0.25rem' },
  link:         { fontFamily: mono, fontSize: '0.68rem', color: '#ff5c00', textDecoration: 'none' },
  webLink:      { fontFamily: mono, fontSize: '0.68rem', color: '#ff5c00', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', display: 'block' },

  emailStatus:      { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' },
  emailFoundBadge:  { fontFamily: mono, fontSize: '0.62rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#00cc88', background: 'rgba(0,204,136,0.1)', border: '1px solid rgba(0,204,136,0.3)', padding: '0.2rem 0.6rem', borderRadius: 2 },
  emailMissingBadge:{ fontFamily: mono, fontSize: '0.62rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#ffaa00', background: 'rgba(255,170,0,0.1)', border: '1px solid rgba(255,170,0,0.3)', padding: '0.2rem 0.6rem', borderRadius: 2 },
  draftStatusBadge: { fontFamily: mono, fontSize: '0.6rem', color: '#6b7280', background: 'rgba(255,255,255,0.05)', border: '1px solid #21262d', padding: '0.15rem 0.5rem', borderRadius: 2 },
  emailBtns:    { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' },
  btnPrimary:   { fontFamily: mono, fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.35rem 0.85rem', border: 'none', background: '#ff5c00', color: '#fff', borderRadius: 2, fontWeight: 700, cursor: 'pointer' },
  btnSecondary: { fontFamily: mono, fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.35rem 0.75rem', border: '1px solid #21262d', background: 'transparent', color: '#9ca3af', borderRadius: 2, cursor: 'pointer' },
  draftBox:     { background: '#161b22', border: '1px solid #21262d', borderRadius: 3, padding: '1rem', marginTop: '0.5rem' },
  draftLabel:   { display: 'block', fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.25rem' },
  draftInput:   { width: '100%', background: '#0d1117', border: '1px solid #21262d', color: '#e8eaed', fontFamily: mono, fontSize: '0.72rem', padding: '0.4rem 0.6rem', borderRadius: 2, outline: 'none', marginBottom: '0.6rem' },
  draftArea:    { width: '100%', background: '#0d1117', border: '1px solid #21262d', color: '#e8eaed', fontFamily: mono, fontSize: '0.65rem', padding: '0.5rem 0.6rem', borderRadius: 2, outline: 'none', resize: 'vertical', minHeight: 160, lineHeight: 1.7 },

  timeline:     { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  tlRow:        { display: 'flex', gap: '0.75rem', alignItems: 'baseline' },
  tlIcon:       { fontSize: '0.75rem', flexShrink: 0, width: 20, textAlign: 'center' },
  tlContent:    { display: 'flex', gap: '0.75rem', alignItems: 'baseline', flex: 1, flexWrap: 'wrap' },
  tlLabel:      { fontFamily: mono, fontSize: '0.65rem', color: '#e8eaed' },
  tlTime:       { fontFamily: mono, fontSize: '0.55rem', color: '#4b5563' },

  notesArea:    { width: '100%', background: '#161b22', border: '1px solid #21262d', color: '#e8eaed', fontFamily: "'IBM Plex Sans',sans-serif", fontSize: '0.8rem', padding: '0.65rem 0.75rem', borderRadius: 3, outline: 'none', resize: 'vertical', minHeight: 90, lineHeight: 1.7, marginBottom: '0.65rem' },
  notesBtns:    { display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' },
  aiSuggest:    { fontFamily: mono, fontSize: '0.62rem', color: '#4b5563', flex: 1 },
  aiSuggestLabel: { color: '#ffaa00' },
}
