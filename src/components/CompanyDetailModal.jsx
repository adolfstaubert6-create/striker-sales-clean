import { useState } from 'react'
import { COMPANY_STATUSES, STATUS_LIST } from '../constants/companyStatuses.js'
import { calculatePriorityLabel } from '../utils/calculatePriorityLabel.js'

const TYPE_LABEL = {
  hotel: '🏨 Hotel', laundry: '🧺 Práčovňa', spa: '💆 Wellness',
  hospital: '🏥 Nemocnica', restaurant: '🍽️ Reštaurácia',
}

const SCORE_COLOR = s =>
  s == null ? '#4b5563' : s >= 80 ? '#00cc88' : s >= 50 ? '#ffaa00' : '#ff3333'

const TIMELINE_EVENTS = c => [
  { key: 'saved',   label: 'Firma uložená',       done: true,              time: c.createdAt },
  { key: 'scored',  label: 'AI skóre',             done: c.aiScore != null, time: null },
  { key: 'draft',   label: 'Draft vytvorený',      done: c.draftCreated,    time: c.draftCreatedAt },
  { key: 'sent',    label: 'Email odoslaný',        done: c.emailSent,       time: c.emailSentAt },
  { key: 'reply',   label: 'Odpoveď prijatá',       done: c.replyReceived,   time: c.replyReceivedAt },
]

function fmtTs(ts) {
  if (!ts) return null
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('sk-SK') + ' ' + d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0')
}

function extractDomain(website) {
  if (!website) return null
  return website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
}

// ── Priority AI Badge (standalone card with glow) ──────────────────────────
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
    <div style={{
      background: bg,
      border: `1px solid ${glow}44`,
      boxShadow: `0 0 14px ${glow}1a`,
      borderRadius: 4,
      padding: '0.85rem 1rem',
      marginBottom: '1rem',
      animation: anim,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
        <span style={{ color: glow, fontSize: '1rem', lineHeight: 1 }}>{icon}</span>
        <span style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#4b5563' }}>{conf}</span>
      </div>
      <div style={{ fontFamily: mono, fontSize: '0.95rem', fontWeight: 700, color: glow, letterSpacing: '0.5px' }}>
        {pri.label} potenciál
      </div>
      {score != null && (
        <div style={{ fontFamily: mono, fontSize: '0.55rem', color: '#4b5563', marginTop: '0.2rem' }}>
          BPS {score} / 100
        </div>
      )}
    </div>
  )
}

export default function CompanyDetailModal({
  company, onClose, onStatusChange, onGenerateEmail, onSaveNote, onCreateTask,
}) {
  const [note, setNote]       = useState(company.notes || '')
  const [taskText, setTask]   = useState('')
  const [draftBody, setDBody] = useState(company.draftBody || '')
  const [draftSubj, setDSubj] = useState(company.draftSubject || '')
  const [draftOpen, setDOpen] = useState(false)

  const st     = COMPANY_STATUSES[company.status] || COMPANY_STATUSES.new
  const pri    = calculatePriorityLabel(company.aiScore)
  const sc     = company.aiScore
  const scCol  = SCORE_COLOR(sc)

  const positive = company.aiPositive || company.aiFactors?.positive || []
  const risks    = company.aiRisks    || company.aiFactors?.risks    || []
  const nextStep = company.aiNextStep || company.aiFactors?.nextStep || ''
  const reason   = company.aiReason   || ''
  const timeline = TIMELINE_EVENTS(company)
  const domain   = extractDomain(company.website)

  function handleKeyDown(e) { if (e.key === 'Escape') onClose() }

  return (
    <div style={css.overlay} onKeyDown={handleKeyDown} tabIndex={-1}>
      {/* Pulse keyframes */}
      <style>{`@keyframes priPulse{0%,100%{box-shadow:0 0 14px var(--glow,#ffaa00)1a}50%{box-shadow:0 0 26px var(--glow,#ffaa00)33}}`}</style>

      <div style={css.modal}>

        {/* ══ HEADER ══ */}
        <div style={css.header}>
          <div style={css.headerLeft}>
            <div style={css.companyName}>{company.name}</div>
            <div style={css.headerMeta}>
              {TYPE_LABEL[company.category] || company.category}
              {company.city    && <><span style={css.dot}>·</span><span>{company.city}</span></>}
              {company.country && <><span style={css.dot}>·</span><span>{company.country}</span></>}
            </div>
            {/* Next step prominently under name */}
            {nextStep && (
              <div style={css.headerNextStep}>→ {nextStep}</div>
            )}
          </div>

          <div style={css.headerRight}>
            <div style={{ ...css.scoreCircle, borderColor: scCol, color: scCol }}>
              <div style={css.scoreNum}>{sc != null ? sc : '–'}</div>
              <div style={css.scoreBot}>BPS</div>
            </div>
            <div style={{ ...css.statusBadge, background: st.bg, color: st.color, borderColor: st.color + '55' }}>
              {st.label}
            </div>
            <button style={css.closeBtn} onClick={onClose} title="Zavrieť (Esc)">✕</button>
          </div>
        </div>

        {/* ══ THREE COLUMNS ══ */}
        <div style={css.cols}>

          {/* LEFT — contact info */}
          <div style={css.col}>
            <ColTitle>Kontaktné údaje</ColTitle>

            <InfoRow label="Email">
              {company.email
                ? <span style={{ color: '#00cc88', fontFamily: mono, fontSize: '0.72rem' }}>{company.email}</span>
                : <span style={{ color: '#ffaa00', fontFamily: mono, fontSize: '0.68rem' }}>⚠ Chýba</span>}
            </InfoRow>

            <InfoRow label="Telefón">
              {company.phone
                ? <a href={`tel:${company.phone}`} style={css.link}>{company.phone}</a>
                : <Muted>–</Muted>}
            </InfoRow>

            <InfoRow label="Web">
              {domain
                ? <a href={`https://${company.website}`} target="_blank" rel="noreferrer"
                    style={css.webLink} title={company.website}>
                    {domain}
                  </a>
                : <Muted>–</Muted>}
            </InfoRow>

            <InfoRow label="Adresa">    <Muted>{company.address       || '–'}</Muted></InfoRow>
            <InfoRow label="Kontakt">   <Muted>{company.contactPerson || '–'}</Muted></InfoRow>
            <InfoRow label="Rating">    <Muted>{company.rating ? `⭐ ${company.rating} / 5` : '–'}</Muted></InfoRow>
            <InfoRow label="Place ID">  <Muted style={{ fontSize: '0.56rem' }}>{company.googlePlaceId || '–'}</Muted></InfoRow>
          </div>

          {/* CENTER — AI analysis */}
          <div style={css.col}>
            <ColTitle>AI Analýza</ColTitle>

            {/* Standalone AI badge card */}
            <AiBadge pri={pri} score={sc} />

            {reason && (
              <div style={css.aiReason}>✦ {reason}</div>
            )}

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

          {/* RIGHT — CRM state */}
          <div style={css.col}>
            <ColTitle>CRM Stav</ColTitle>
            <div style={css.statusChangeRow}>
              {STATUS_LIST.map(s => (
                <button key={s.key}
                  style={{
                    ...css.stBtn,
                    background:  company.status === s.key ? s.bg        : 'transparent',
                    color:       company.status === s.key ? s.color     : '#4b5563',
                    borderColor: company.status === s.key ? s.color+'88': '#1e2530',
                  }}
                  onClick={() => onStatusChange && onStatusChange(company.id, s.key)}>
                  {s.label}
                </button>
              ))}
            </div>

            <InfoRow label="Priorita">
              {pri ? <span style={{ color: pri.color, fontFamily: mono, fontSize: '0.68rem' }}>{pri.label}</span> : <Muted>–</Muted>}
            </InfoRow>
            <InfoRow label="Posl. kontakt"><Muted>{company.lastContact || '–'}</Muted></InfoRow>
            <InfoRow label="Ďalší krok">  <Muted>{company.nextAction  || '–'}</Muted></InfoRow>
            <InfoRow label="Zodpovedný">  <Muted>{company.assignee    || '–'}</Muted></InfoRow>

            <div style={{ marginTop: '1.25rem' }}>
              <div style={css.factorTitle}>Pridať úlohu</div>
              <div style={css.taskRow}>
                <input style={css.taskInput} placeholder="Popis úlohy..."
                  value={taskText} onChange={e => setTask(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && taskText.trim()) {
                      onCreateTask && onCreateTask(company.id, taskText.trim())
                      setTask('')
                    }
                  }} />
                <button style={css.taskBtn}
                  onClick={() => { if (taskText.trim()) { onCreateTask && onCreateTask(company.id, taskText.trim()); setTask('') } }}>
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={css.divider} />

        {/* ══ EMAIL SECTION ══ */}
        <div style={css.section}>
          <ColTitle>Email</ColTitle>
          <div style={css.emailStatus}>
            <span style={company.email ? css.emailFoundBadge : css.emailMissingBadge}>
              {company.email ? `✓ Email nájdený — ${company.email}` : '⚠ Email chýba'}
            </span>
            {company.draftStatus && (
              <span style={css.draftStatusBadge}>Draft: {company.draftStatus}</span>
            )}
          </div>
          <div style={css.emailBtns}>
            <button style={css.btnPrimary}
              onClick={() => { onGenerateEmail && onGenerateEmail(company); setDOpen(true) }}>
              ✦ Generovať draft
            </button>
            <button style={css.btnSecondary} onClick={() => setDOpen(o => !o)}>
              ✎ Editovať
            </button>
            <button style={{ ...css.btnSecondary, color: '#ffaa00', borderColor: '#ffaa00'+'55' }}
              onClick={() => onStatusChange && onStatusChange(company.id, 'contacted')}>
              ✓ Schváliť
            </button>
          </div>
          {draftOpen && (
            <div style={css.draftBox}>
              <label style={css.draftLabel}>Predmet</label>
              <input style={css.draftInput} value={draftSubj}
                onChange={e => setDSubj(e.target.value)} placeholder="Predmet emailu..." />
              <label style={css.draftLabel}>Text</label>
              <textarea style={css.draftArea} value={draftBody}
                onChange={e => setDBody(e.target.value)} placeholder="Text emailu..." />
            </div>
          )}
        </div>

        <div style={css.divider} />

        {/* ══ TIMELINE ══ */}
        <div style={css.section}>
          <ColTitle>Časová os</ColTitle>
          <div style={css.timeline}>
            {timeline.map((ev, i) => (
              <div key={ev.key} style={css.tlItem}>
                <div style={{ ...css.tlDot, background: ev.done ? '#00cc88' : '#1e2530', borderColor: ev.done ? '#00cc88' : '#2d3748' }} />
                {i < timeline.length - 1 && (
                  <div style={{ ...css.tlLine, background: ev.done ? '#00cc8844' : '#1e2530' }} />
                )}
                <div style={css.tlLabel}>
                  <span style={{ fontFamily: mono, fontSize: '0.6rem', color: ev.done ? '#e8eaed' : '#4b5563' }}>{ev.label}</span>
                  {ev.time && <span style={css.tlTime}>{fmtTs(ev.time)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={css.divider} />

        {/* ══ NOTES ══ */}
        <div style={css.section}>
          <ColTitle>Interné poznámky</ColTitle>
          <textarea style={css.notesArea}
            placeholder="Poznámky k firme..."
            value={note} onChange={e => setNote(e.target.value)} />
          <div style={css.notesBtns}>
            <button style={css.btnPrimary}
              onClick={() => onSaveNote && onSaveNote(company.id, note)}>
              Uložiť poznámky
            </button>
            {reason && (
              <div style={css.aiSuggest}>
                <span style={css.aiSuggestLabel}>AI odporúčanie: </span>{reason}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
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
      <span style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#4b5563', width: 80, flexShrink: 0 }}>
        {label}
      </span>
      {children}
    </div>
  )
}

function Muted({ children, style }) {
  return <span style={{ fontFamily: mono, fontSize: '0.68rem', color: '#6b7280', ...style }}>{children}</span>
}

const mono = "'IBM Plex Mono',monospace"

const css = {
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 500, overflowY: 'auto', padding: '2rem 1rem', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' },
  modal:       { background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, width: '100%', maxWidth: 1100, padding: '2rem 2.25rem', position: 'relative' },

  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', gap: '1.5rem' },
  headerLeft:  { flex: 1, minWidth: 0 },
  headerRight: { display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 },
  companyName: { fontFamily: "'IBM Plex Sans',sans-serif", fontSize: '1.5rem', fontWeight: 700, color: '#f0f6fc', marginBottom: '0.3rem', lineHeight: 1.2 },
  headerMeta:  { fontFamily: mono, fontSize: '0.65rem', color: '#6b7280', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' },
  dot:         { color: '#2d3748' },
  headerNextStep: { fontFamily: mono, fontSize: '0.7rem', color: '#00cc88', marginTop: '0.55rem' },

  scoreCircle: { width: 72, height: 72, borderRadius: '50%', border: '3px solid', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  scoreNum:    { fontFamily: mono, fontSize: '1.35rem', fontWeight: 700, lineHeight: 1 },
  scoreBot:    { fontFamily: mono, fontSize: '0.42rem', letterSpacing: '2px', color: '#4b5563', marginTop: 2 },
  statusBadge: { fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.25rem 0.6rem', borderRadius: 3, border: '1px solid', whiteSpace: 'nowrap' },
  closeBtn:    { background: 'transparent', border: '1px solid #21262d', color: '#6b7280', width: 32, height: 32, borderRadius: 3, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  // Three columns — gap 2.5rem, padding inside
  cols:        { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2.5rem', marginBottom: '1.5rem' },
  col:         { minWidth: 0, padding: '0 0.25rem' },

  aiReason:    { fontFamily: mono, fontSize: '0.65rem', color: '#9ca3af', fontStyle: 'italic', marginBottom: '0.85rem', lineHeight: 1.65, background: 'rgba(255,255,255,0.03)', padding: '0.55rem 0.65rem', borderRadius: 3 },
  factorTitle: { fontFamily: mono, fontSize: '0.52rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.35rem' },
  factorPos:   { fontFamily: mono, fontSize: '0.65rem', color: '#00cc88', lineHeight: 1.85 },
  factorRisk:  { fontFamily: mono, fontSize: '0.65rem', color: '#ffaa00', lineHeight: 1.85 },

  statusChangeRow: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1rem' },
  stBtn:       { fontFamily: mono, fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.2rem 0.5rem', border: '1px solid', borderRadius: 2, cursor: 'pointer', transition: 'all 0.1s' },

  taskRow:     { display: 'flex', gap: '0.4rem', marginTop: '0.4rem' },
  taskInput:   { flex: 1, background: '#161b22', border: '1px solid #21262d', color: '#e8eaed', fontFamily: mono, fontSize: '0.68rem', padding: '0.35rem 0.5rem', borderRadius: 2, outline: 'none' },
  taskBtn:     { background: '#ff5c00', border: 'none', color: '#fff', fontWeight: 700, width: 32, borderRadius: 2, cursor: 'pointer', fontSize: '1.1rem' },

  divider:     { height: 1, background: '#161b22', margin: '1.5rem 0' },
  section:     { marginBottom: '0.25rem' },

  // Web link — single line, truncate to domain
  link:        { fontFamily: mono, fontSize: '0.68rem', color: '#ff5c00', textDecoration: 'none' },
  webLink:     { fontFamily: mono, fontSize: '0.68rem', color: '#ff5c00', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', display: 'block' },

  emailStatus:     { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' },
  emailFoundBadge: { fontFamily: mono, fontSize: '0.62rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#00cc88', background: 'rgba(0,204,136,0.1)', border: '1px solid rgba(0,204,136,0.3)', padding: '0.2rem 0.6rem', borderRadius: 2 },
  emailMissingBadge:{ fontFamily: mono, fontSize: '0.62rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#ffaa00', background: 'rgba(255,170,0,0.1)', border: '1px solid rgba(255,170,0,0.3)', padding: '0.2rem 0.6rem', borderRadius: 2 },
  draftStatusBadge: { fontFamily: mono, fontSize: '0.6rem', color: '#6b7280', background: 'rgba(255,255,255,0.05)', border: '1px solid #21262d', padding: '0.15rem 0.5rem', borderRadius: 2 },

  emailBtns:   { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' },
  btnPrimary:  { fontFamily: mono, fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.35rem 0.85rem', border: 'none', background: '#ff5c00', color: '#fff', borderRadius: 2, fontWeight: 700, cursor: 'pointer' },
  btnSecondary:{ fontFamily: mono, fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.35rem 0.75rem', border: '1px solid #21262d', background: 'transparent', color: '#9ca3af', borderRadius: 2, cursor: 'pointer' },

  draftBox:    { background: '#161b22', border: '1px solid #21262d', borderRadius: 3, padding: '1rem', marginTop: '0.5rem' },
  draftLabel:  { display: 'block', fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.25rem' },
  draftInput:  { width: '100%', background: '#0d1117', border: '1px solid #21262d', color: '#e8eaed', fontFamily: mono, fontSize: '0.72rem', padding: '0.4rem 0.6rem', borderRadius: 2, outline: 'none', marginBottom: '0.6rem' },
  draftArea:   { width: '100%', background: '#0d1117', border: '1px solid #21262d', color: '#e8eaed', fontFamily: mono, fontSize: '0.65rem', padding: '0.5rem 0.6rem', borderRadius: 2, outline: 'none', resize: 'vertical', minHeight: 160, lineHeight: 1.7 },

  timeline:    { display: 'flex', gap: 0, alignItems: 'flex-start' },
  tlItem:      { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' },
  tlDot:       { width: 12, height: 12, borderRadius: '50%', border: '2px solid', zIndex: 1, flexShrink: 0 },
  tlLine:      { position: 'absolute', top: 5, left: '50%', width: '100%', height: 2, zIndex: 0 },
  tlLabel:     { marginTop: '0.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.15rem' },
  tlTime:      { fontFamily: mono, fontSize: '0.52rem', color: '#4b5563' },

  notesArea:   { width: '100%', background: '#161b22', border: '1px solid #21262d', color: '#e8eaed', fontFamily: "'IBM Plex Sans',sans-serif", fontSize: '0.8rem', padding: '0.65rem 0.75rem', borderRadius: 3, outline: 'none', resize: 'vertical', minHeight: 90, lineHeight: 1.7, marginBottom: '0.65rem' },
  notesBtns:   { display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' },
  aiSuggest:   { fontFamily: mono, fontSize: '0.62rem', color: '#4b5563', flex: 1 },
  aiSuggestLabel: { color: '#ffaa00' },
}
