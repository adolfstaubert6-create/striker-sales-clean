import { useState, useEffect, useRef } from 'react'
import { db } from '../firebase.js'
import {
  doc, collection, onSnapshot, updateDoc, addDoc, getDocs, deleteDoc,
  query, where, serverTimestamp,
} from 'firebase/firestore'
import { COMPANY_STATUSES, STATUS_LIST } from '../constants/companyStatuses.js'
import { calculatePriorityLabel } from '../utils/calculatePriorityLabel.js'
import { generateEmailDraft } from '../services/emailService.js'

const CURRENT_USER = 'Staubert'

const STATUS_LABELS = {
  new: 'Nový', contacted: 'Kontaktovaný', offer: 'Ponuka',
  closed: 'Uzavreté', rejected: 'Zamietnutý',
}

const TYPE_LABEL = {
  hotel: '🏨 Hotel', laundry: '🧺 Práčovňa', spa: '💆 Wellness',
  hospital: '🏥 Nemocnica', restaurant: '🍽️ Reštaurácia',
}

const EVENT_ICONS = {
  company_saved:           '🏢',
  ai_score_created:        '✦',
  status_changed:          '🔄',
  note_added:              '📝',
  note_updated:            '✏️',
  note_deleted:            '🗑️',
  task_created:            '✅',
  email_draft_created_sk:  '✉',
  email_draft_edited_sk:   '✏️',
  email_translated_de:     '🇩🇪',
  email_draft_edited_de:   '✏️',
  email_draft_approved:    '✅',
  email_sent:              '📤',
  email_deleted:           '🗑️',
  email_copied:            '📋',
  email_found:             '🔍',
  reply_received:          '📥',
  // legacy
  draft_created:    '✉',
  draft_approved:   '✅',
  email_generated:  '✉',
  email_translated: '🇩🇪',
}

const SCORE_COLOR = s =>
  s == null ? '#4b5563' : s >= 80 ? '#00cc88' : s >= 50 ? '#ffaa00' : '#ff3333'

function fmtTs(ts) {
  // handles Firestore Timestamp, plain Date, or null/undefined
  if (!ts) return ''
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    if (isNaN(d.getTime())) return ''
    const dd = d.getDate().toString().padStart(2, '0')
    const mm = (d.getMonth() + 1).toString().padStart(2, '0')
    const yy = d.getFullYear()
    const hh = d.getHours().toString().padStart(2, '0')
    const mi = d.getMinutes().toString().padStart(2, '0')
    return `${dd}.${mm}.${yy} ${hh}:${mi}`
  } catch { return '' }
}

// handles both old (timestamp) and new (createdAt) field names
function evTs(ev) {
  return ev.createdAt || ev.timestamp || null
}

const TYPE_FALLBACK_MSG = {
  status_changed:   (ev) => ev.oldStatus && ev.newStatus
    ? `Status zmenený: ${STATUS_LABELS[ev.oldStatus] || ev.oldStatus} → ${STATUS_LABELS[ev.newStatus] || ev.newStatus}`
    : 'Status zmenený',
  note_added:       () => 'Poznámka pridaná',
  note_updated:     () => 'Poznámka upravená',
  note_deleted:     () => 'Poznámka zmazaná',
  task_created:     (ev) => ev.content ? `Úloha: ${ev.content}` : 'Úloha pridaná',
  draft_created:    () => 'Email draft vytvorený',
  draft_approved:   () => 'Email draft schválený',
  email_generated:  () => 'Email draft vygenerovaný',
  email_sent:       () => 'Email odoslaný',
  company_saved:    () => 'Firma uložená',
  ai_score_created: () => 'AI skóre vypočítané',
  reply_received:   () => 'Odpoveď prijatá',
}

function evMessage(ev) {
  if (ev.message) return ev.message
  const fn = TYPE_FALLBACK_MSG[ev.type]
  return fn ? fn(ev) : ev.type
}

function extractDomain(w) {
  if (!w) return null
  return w.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
}

function applyInlineMd(text) {
  const parts = []
  let last = 0
  const re = /\*\*([^*]+)\*\*/g
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    parts.push(<strong key={m.index} style={{ color: '#e8eaed', fontWeight: 700 }}>{m[1]}</strong>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length ? parts : text
}

function renderMarkdown(text) {
  if (!text) return null
  return text.split('\n').map((line, i) => {
    if (/^#{1,3}\s/.test(line))
      return <div key={i} style={{ fontWeight: 700, color: '#e8eaed', fontSize: '0.83rem', marginTop: '0.45rem', marginBottom: '0.1rem' }}>{applyInlineMd(line.replace(/^#{1,3}\s+/, ''))}</div>
    if (/^\d+\.\s/.test(line))
      return <div key={i} style={{ paddingLeft: '1.1rem', position: 'relative', marginBottom: '0.1rem', color: '#c9d1d9' }}>
        <span style={{ position: 'absolute', left: 0, color: '#ff5c0099' }}>{line.match(/^\d+/)[0]}.</span>
        {applyInlineMd(line.replace(/^\d+\.\s+/, ''))}
      </div>
    if (/^[-•*]\s/.test(line.trim()))
      return <div key={i} style={{ paddingLeft: '1rem', position: 'relative', marginBottom: '0.1rem', color: '#c9d1d9' }}>
        <span style={{ position: 'absolute', left: '0.1rem', color: '#ff5c00' }}>·</span>
        {applyInlineMd(line.trim().replace(/^[-•*]\s+/, ''))}
      </div>
    if (line.trim() === '') return <div key={i} style={{ height: '0.35rem' }} />
    return <div key={i} style={{ marginBottom: '0.05rem', color: '#c9d1d9' }}>{applyInlineMd(line)}</div>
  })
}

function stripAiNoise(text) {
  return text
    .split('\n')
    .filter(line => {
      const t = line.trim()
      if (/\[AKTION|\*\*\[|Hinweis:|Note:|Bestätigst/i.test(t)) return false
      if (/\[NÁVRH|NÁVRH AKCIE|\[NAVRH/i.test(t)) return false
      if (/Môžem pripraviť|Mozem pripravit|túto akciu musíš|tuto akciu musis/i.test(t)) return false
      if (/^Poznámka:|^Poznamka:|^Komentár:|^Komentar:/i.test(t)) return false
      if (/^\*\s+\S/.test(t)) return false
      if (/^---$/.test(t)) return false
      return true
    })
    .join('\n')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/ČO CHÝBA:.*$/gm, '')
    .replace(/NAJLEPŠÍ ĎALŠÍ KROK:.*$/gm, '')
    .replace(/ODPORÚČANÁ AKCIA:.*$/gm, '')
    .replace(/STRIKER —.*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function cleanDraftText(text) {
  return (text || '')
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Strip analysis sections that may follow the email
    .replace(/\n+(ČO ROBIŤ TERAZ|NAJLEPŠÍ ĎALŠÍ KROK|ODPORÚČANÁ AKCIA|ĎALŠÍ KROK|VERDIKT|VERDIKT:|Záver:|Analýza:|Odporúčam|Odporúčanie:)[\s\S]*/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ── AI response parser ───────────────────────────────────────────────────────
function parseAiResponse(text) {
  const match = text.match(/<SUGGEST_STATUS:([a-z]+)>/)
  if (!match) return { text, suggestion: null }
  return {
    text: text.replace(/<SUGGEST_STATUS:[a-z]+>/g, '').trim(),
    suggestion: { type: 'status', value: match[1] },
  }
}

// ── Email Workflow Card ───────────────────────────────────────────────────────
function EmailWorkflowCard({ email, companyEmail, onSaveSk, onSaveDe, onTranslate, onSend, onDelete, onCopy, onBackToSk, sending }) {
  const isSk = email.status === 'active_draft' || email.status === 'draft'
  const isDe = email.status === 'translated'

  const [subjSk, setSubjSk]           = useState(email.subjectSk || '')
  const [bodySk, setBodySk]           = useState(email.bodySk    || '')
  const [subjDe, setSubjDe]           = useState(email.subjectDe || '')
  const [bodyDe, setBodyDe]           = useState(email.bodyDe    || '')
  const [translating, setTranslating] = useState(false)
  const [editing, setEditing]         = useState(false)
  const [copied, setCopied]           = useState(false)
  const [zoomed, setZoomed]           = useState(false)
  const [savingSk, setSavingSk]       = useState(false)
  const [savingDe, setSavingDe]       = useState(false)
  const [flash, setFlash]             = useState(null)

  function showFlash(msg) { setFlash(msg); setTimeout(() => setFlash(null), 2000) }

  useEffect(() => {
    setSubjDe(email.subjectDe || '')
    setBodyDe(email.bodyDe    || '')
  }, [email.subjectDe, email.bodyDe])

  async function doTranslate() {
    setTranslating(true)
    try { await onTranslate(email, subjSk, bodySk); showFlash('✓ Preložené') }
    finally { setTranslating(false) }
  }

  function doDelete() {
    if (window.confirm('Naozaj chceš zmazať celý draft?')) onDelete(email.id)
  }

  function doCopy() {
    const text = isDe ? `${subjDe}\n\n${bodyDe}` : `${subjSk}\n\n${bodySk}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      onCopy(email)
    }).catch(() => {})
  }

  const inp    = { width: '100%', background: '#0d1117', border: '1px solid #30363d', color: '#e8eaed', fontFamily: mono, fontSize: '0.68rem', padding: '0.35rem 0.55rem', borderRadius: 2, outline: 'none', marginBottom: '0.35rem', boxSizing: 'border-box' }
  const area   = { ...inp, resize: 'vertical', minHeight: zoomed ? 320 : 100, lineHeight: 1.65, fontSize: '0.63rem', marginBottom: '0.4rem' }
  const roSubj = { fontFamily: mono, fontSize: '0.7rem', fontWeight: 600, color: '#e8eaed', marginBottom: '0.5rem', paddingBottom: '0.4rem', borderBottom: '1px solid #1e2530' }
  const roBody = { fontFamily: mono, fontSize: '0.62rem', color: '#9ca3af', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: '0.5rem', minHeight: zoomed ? 280 : undefined, maxHeight: zoomed ? undefined : 180, overflowY: zoomed ? 'visible' : 'auto' }

  if (isSk) return (
    <div style={{ border: '1px solid #ffaa0044', borderLeft: '3px solid #ffaa00', borderRadius: 3, padding: '0.85rem 1rem', marginBottom: '0.7rem', background: '#0d1117' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
        <span style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#ffaa00' }}>🇸🇰 SK Draft</span>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <button style={css.cardBtn} onClick={() => setZoomed(v => !v)}>
            {zoomed ? '⊖ Zoom' : '⊕ Zoom'}
          </button>
          <button style={css.cardBtn} onClick={() => setEditing(v => !v)}>
            {editing ? '✕ Zavrieť' : '✏ Upraviť'}
          </button>
          <button style={{ ...css.cardBtn, color: copied ? '#00cc88' : '#9ca3af', borderColor: copied ? '#00cc8855' : '#21262d' }} onClick={doCopy}>
            {copied ? '✓ Skopírované' : '📋 Kopírovať'}
          </button>
          <button style={css.cardBtnDanger} onClick={doDelete}>🗑 Zmazať</button>
        </div>
      </div>

      {/* Body — read-only or edit */}
      {editing ? (
        <>
          <input style={inp} value={subjSk} onChange={e => setSubjSk(e.target.value)} placeholder="Predmet SK..." autoFocus />
          <textarea style={area} value={bodySk} onChange={e => setBodySk(e.target.value)} />
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
            <button style={{ ...css.btnSave, opacity: savingSk ? 0.6 : 1 }} disabled={savingSk}
              onClick={async () => { setSavingSk(true); await onSaveSk(email.id, subjSk, bodySk); setSavingSk(false); setEditing(false); showFlash('✓ Uložené') }}>
              {savingSk ? '⏳ Ukladám...' : '💾 Uložiť'}
            </button>
            <button style={css.btnCancel} onClick={() => setEditing(false)}>Zrušiť</button>
          </div>
        </>
      ) : (
        <>
          <div style={roSubj}>{subjSk || <span style={{ color: '#4b5563' }}>–</span>}</div>
          <div style={roBody}>{bodySk || <span style={{ color: '#4b5563' }}>–</span>}</div>
        </>
      )}

      {/* Translate */}
      <button style={{ ...css.btnTranslate, opacity: translating ? 0.5 : 1, width: '100%', justifyContent: 'center' }} onClick={doTranslate} disabled={translating}>
        {translating ? '⏳ Prekladám do nemčiny...' : '🇩🇪 Preložiť do nemčiny'}
      </button>
      {flash && <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#00cc88', marginTop: '0.4rem', textAlign: 'center' }}>{flash}</div>}
    </div>
  )

  if (isDe) return (
    <div style={{ border: '1px solid #3b82f644', borderLeft: '3px solid #3b82f6', borderRadius: 3, padding: '0.85rem 1rem', marginBottom: '0.7rem', background: '#0d1117' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#3b82f6' }}>🇩🇪 DE Preložené</span>
          <button style={{ ...css.cardBtn, color: '#6b7280' }} onClick={() => onBackToSk(email.id)}>← Späť na SK</button>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <button style={css.cardBtn} onClick={() => setZoomed(v => !v)}>
            {zoomed ? '⊖ Zoom' : '⊕ Zoom'}
          </button>
          <button style={css.cardBtn} onClick={() => setEditing(v => !v)}>
            {editing ? '✕ Zavrieť' : '✏ Upraviť'}
          </button>
          <button style={{ ...css.cardBtn, color: copied ? '#00cc88' : '#9ca3af', borderColor: copied ? '#00cc8855' : '#21262d' }} onClick={doCopy}>
            {copied ? '✓ Skopírované' : '📋 Kopírovať'}
          </button>
          <button style={css.cardBtnDanger} onClick={doDelete}>🗑 Zmazať</button>
        </div>
      </div>

      {/* Body — read-only or edit */}
      {editing ? (
        <>
          <input style={inp} value={subjDe} onChange={e => setSubjDe(e.target.value)} placeholder="Betreff..." autoFocus />
          <textarea style={area} value={bodyDe} onChange={e => setBodyDe(e.target.value)} />
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
            <button style={{ ...css.btnSave, opacity: savingDe ? 0.6 : 1 }} disabled={savingDe}
              onClick={async () => { setSavingDe(true); await onSaveDe(email.id, subjDe, bodyDe); setSavingDe(false); setEditing(false); showFlash('✓ Uložené') }}>
              {savingDe ? '⏳ Ukladám...' : '💾 Uložiť'}
            </button>
            <button style={css.btnCancel} onClick={() => setEditing(false)}>Zrušiť</button>
          </div>
        </>
      ) : (
        <>
          <div style={roSubj}>{subjDe || <span style={{ color: '#4b5563' }}>–</span>}</div>
          <div style={roBody}>{bodyDe || <span style={{ color: '#4b5563' }}>–</span>}</div>
        </>
      )}

      {/* Send */}
      {companyEmail
        ? <button style={{ ...css.btnSend, opacity: sending ? 0.6 : 1, width: '100%', justifyContent: 'center' }} onClick={() => onSend(email, subjDe, bodyDe)} disabled={sending}>
            {sending ? '⏳ Odosielam...' : `📤 Odoslať na ${companyEmail}`}
          </button>
        : <span style={{ fontFamily: mono, fontSize: '0.6rem', color: '#ffaa00' }}>⚠ Pridaj email firmy v Kontaktných údajoch</span>
      }
      {flash && <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#00cc88', marginTop: '0.4rem', textAlign: 'center' }}>{flash}</div>}
    </div>
  )

  return null
}

// ── Confidence badge parser ──────────────────────────────────────────────────
function extractConfidence(text) {
  const m = text?.match(/(vysoká|stredná|nízka)\s+istota/i)
  if (!m) return null
  const lv = m[1].toLowerCase()
  return lv === 'vysoká' ? { label: 'Vysoká istota', color: '#00cc88' }
       : lv === 'stredná' ? { label: 'Stredná istota', color: '#ffaa00' }
       : { label: 'Nízka istota', color: '#ef4444' }
}

// ── AiBadge ──────────────────────────────────────────────────────────────────
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

// ── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null
  const col = type === 'err' ? '#ef4444' : '#00cc88'
  return (
    <div style={{ position: 'fixed', bottom: '1.25rem', left: '50%', transform: 'translateX(-50%)', zIndex: 701, background: '#0d1117', border: `1px solid ${col}44`, borderBottom: `2px solid ${col}`, padding: '0.45rem 1.25rem', borderRadius: 4, fontFamily: mono, fontSize: '0.65rem', color: col, textAlign: 'center', whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
      {msg}
    </div>
  )
}

// ── NoteCard ─────────────────────────────────────────────────────────────────
function NoteCard({ note, onEdit, onDelete }) {
  const [editing, setEditing]   = useState(false)
  const [editText, setEditText] = useState(note.text || '')
  const [saving, setSaving]     = useState(false)
  const [copied, setCopied]     = useState(false)

  async function saveEdit() {
    if (!editText.trim() || editText === note.text) { setEditing(false); return }
    setSaving(true)
    await onEdit(note.id, editText.trim())
    setSaving(false)
    setEditing(false)
  }

  function doCopy() {
    navigator.clipboard.writeText(note.text || '').then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  function doDelete() {
    if (window.confirm('Zmazať túto poznámku?')) onDelete(note.id)
  }

  return (
    <div style={css.noteCard}>
      <div style={css.noteMeta}>
        <span style={css.noteAuthor}>{note.createdBy || CURRENT_USER}</span>
        <span style={css.noteDot}>·</span>
        <span style={css.noteTime}>{fmtTs(note.createdAt)}</span>
        {note.edited && <span style={css.editedBadge}>upravené</span>}
      </div>

      {editing ? (
        <>
          <textarea style={css.noteEditArea} value={editText} onChange={e => setEditText(e.target.value)} autoFocus />
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem' }}>
            <button style={css.noteEditSave} onClick={saveEdit} disabled={saving}>{saving ? '⏳' : '✓ Uložiť'}</button>
            <button style={css.noteEditCancel} onClick={() => setEditing(false)}>Zrušiť</button>
          </div>
        </>
      ) : (
        <div style={css.noteText}>{note.text}</div>
      )}

      <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
        <button style={css.chatActionBtn} onClick={doCopy}>
          {copied ? '✓ Skopírované' : '📋 Kopírovať'}
        </button>
        {editing ? null : (
          <button style={css.chatActionBtn} onClick={() => { setEditing(true); setEditText(note.text || '') }}>✏️ Upraviť</button>
        )}
        <button
          style={css.chatActionBtn}
          onMouseOver={e => e.currentTarget.style.color = '#ef4444'}
          onMouseOut={e => e.currentTarget.style.color = '#4b5563'}
          onClick={doDelete}>🗑 Zmazať</button>
      </div>
    </div>
  )
}

// ── Audit Row ────────────────────────────────────────────────────────────────
function AuditRow({ ev, onDelete }) {
  const [copied, setCopied] = useState(false)

  const text = evMessage(ev)

  function doCopy() {
    navigator.clipboard.writeText(`${fmtTs(evTs(ev))} — ${text}`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  function doDelete() {
    if (window.confirm('Zmazať tento záznam?')) onDelete(ev.id)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.5rem 0', borderBottom: '1px solid #161b22' }}>
      <span style={{ fontSize: '0.72rem', flexShrink: 0, width: 18, marginTop: '0.05rem' }}>{EVENT_ICONS[ev.type] || '·'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#4b5563', marginBottom: '0.15rem' }}>{fmtTs(evTs(ev)) || '–'}</div>
        <div style={{ fontFamily: mono, fontSize: '0.65rem', color: '#9ca3af', lineHeight: 1.5 }}>{text}</div>
        <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem' }}>
          <button style={css.chatActionBtn} onClick={doCopy}>
            {copied ? '✓ Skopírované' : '📋 Kopírovať'}
          </button>
          <button
            style={css.chatActionBtn}
            onMouseOver={e => e.currentTarget.style.color = '#ef4444'}
            onMouseOut={e => e.currentTarget.style.color = '#4b5563'}
            onClick={doDelete}>🗑 Zmazať</button>
        </div>
      </div>
    </div>
  )
}

// ── AI Chat Message ──────────────────────────────────────────────────────────
function ChatMessage({ msg, displayText, role, useMarkdown, onDelete, onEdit, onToDraft, isLatest }) {
  const [copied, setCopied]   = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(displayText)
  const [glowing, setGlowing] = useState(isLatest && role === 'assistant')

  const isAi = role === 'assistant'

  // Fade glow after 3 s on mount (only fires once per component instance)
  useEffect(() => {
    if (!glowing) return
    const t = setTimeout(() => setGlowing(false), 3000)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function doCopy() {
    navigator.clipboard.writeText(displayText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  function doDelete() {
    if (window.confirm('Zmazať túto správu?')) onDelete(msg.id)
  }

  function doSave() {
    if (editText.trim()) onEdit(msg.id, editText.trim())
    setEditing(false)
  }

  function doDraft() {
    if (window.confirm('Preniesť túto správu do SK draftu?'))
      onToDraft(cleanDraftText(displayText))
  }

  const bubbleStyle = isAi
    ? {
        background: '#0d1117', border: '1px solid #21262d', borderLeft: '3px solid #ff5c00',
        borderRadius: '3px 3px 3px 0', padding: '0.7rem 0.9rem',
        boxShadow: glowing ? '0 0 16px rgba(255,92,0,0.45), 0 0 4px rgba(255,92,0,0.2)' : 'none',
        transition: 'box-shadow 1.5s ease-out',
      }
    : { background: '#161b22', border: '1px solid #21262d', borderRadius: '3px 3px 0 3px', padding: '0.55rem 0.75rem' }

  const textColor  = isAi ? '#c9d1d9' : '#e8eaed'
  const textFamily = isAi ? "'IBM Plex Sans',sans-serif" : mono
  const textSize   = isAi ? '0.8rem' : '0.68rem'
  const maxW       = isAi ? '92%' : '80%'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isAi ? 'flex-start' : 'flex-end' }}>
      {/* Bubble */}
      <div style={{ ...bubbleStyle, maxWidth: maxW, width: 'fit-content' }}>
        {editing ? (
          <textarea
            style={{ width: '100%', minWidth: 240, background: 'transparent', border: 'none', color: textColor, fontFamily: textFamily, fontSize: textSize, lineHeight: 1.75, resize: 'vertical', outline: 'none', minHeight: 60, display: 'block' }}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            autoFocus
          />
        ) : useMarkdown ? (
          <div style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: '0.8rem', lineHeight: 1.75 }}>{renderMarkdown(displayText)}</div>
        ) : (
          <span style={{ fontFamily: textFamily, fontSize: textSize, color: textColor, lineHeight: 1.75, whiteSpace: 'pre-wrap', display: 'block' }}>{displayText}</span>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem', flexWrap: 'wrap', maxWidth: maxW, alignItems: 'center' }}>
        {/* Prominent → Draft on latest AI message */}
        {isAi && isLatest && onToDraft && (
          <button
            style={{ fontFamily: mono, fontSize: '0.63rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.8rem', border: 'none', background: '#ff5c00', color: '#fff', borderRadius: 2, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            onClick={doDraft}>
            📋 → Draft
          </button>
        )}
        <button style={css.chatActionBtn} onClick={doCopy}>
          {copied ? '✓ Skopírované' : '📋 Kopírovať'}
        </button>
        {editing ? (
          <>
            <button style={{ ...css.chatActionBtn, color: '#00cc88', borderColor: '#00cc8833' }} onClick={doSave}>✓ Uložiť</button>
            <button style={css.chatActionBtn} onClick={() => { setEditing(false); setEditText(displayText) }}>Zrušiť</button>
          </>
        ) : (
          <button style={css.chatActionBtn} onClick={() => setEditing(true)}>✏️ Upraviť</button>
        )}
        <button
          style={css.chatActionBtn}
          onMouseOver={e => e.currentTarget.style.color = '#ef4444'}
          onMouseOut={e => e.currentTarget.style.color = '#4b5563'}
          onClick={doDelete}>🗑 Zmazať</button>
        {/* Small → Draft on older AI messages */}
        {isAi && !isLatest && onToDraft && (
          <button
            style={{ ...css.chatActionBtn, color: '#ff5c00', borderColor: '#ff5c0044', background: 'rgba(255,92,0,0.07)' }}
            onClick={doDraft}>
            → Draft
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main modal ───────────────────────────────────────────────────────────────
export default function CompanyDetailModal({ company: initialCompany, onClose }) {
  const [live, setLive]           = useState(initialCompany)
  const [interactions, setInteract] = useState([])
  const [notes, setNotes]         = useState([])
  const [tasks, setTasks]         = useState([])
  const [newNote, setNewNote]     = useState('')
  const [notesOpen, setNotesOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [chatOpen,   setChatOpen]   = useState(false)
  const [chatZoomed, setChatZoomed] = useState(false)
  const [taskText, setTaskText]   = useState('')
  const [draftSubj, setDraftSubj] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [draftOpen, setDraftOpen] = useState(false)
  const [fb, setFb]               = useState({})
  const [toast, setToast]         = useState(null)
  const [emails, setEmails]           = useState([])
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSearch, setEmailSearch] = useState({ state: null, email: null })
  const [aiChats, setAiChats]             = useState([])
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [chatsLoaded, setChatsLoaded]     = useState(false)
  const [aiInput, setAiInput]             = useState('')
  const [aiLoading, setAiLoading]         = useState(false)
  const chatEndRef             = useRef(null)
  const greetingInitialized    = useRef(false)
  const suggestionsInitialized = useRef(false)

  // ── Subscriptions ──────────────────────────────────────────────────────────
  useEffect(() => {
    const id = initialCompany.id

    const unsubDoc = onSnapshot(doc(db, 'companies', id), snap => {
      if (snap.exists()) setLive({ id: snap.id, ...snap.data() })
    })

    const unsubInter = onSnapshot(
      query(collection(db, 'interactions'), where('companyId', '==', id)),
      snap => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        rows.sort((a, b) => {
          const ta = a.createdAt?.toDate?.() || new Date(0)
          const tb = b.createdAt?.toDate?.() || new Date(0)
          return tb - ta
        })
        setInteract(rows)
      }
    )

    const unsubNotes = onSnapshot(
      query(collection(db, 'companies', id, 'notes'), where('deleted', '==', false)),
      snap => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        rows.sort((a, b) => {
          const ta = a.createdAt?.toDate?.() || new Date(0)
          const tb = b.createdAt?.toDate?.() || new Date(0)
          return tb - ta
        })
        setNotes(rows)
      }
    )

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

    const unsubEmails = onSnapshot(
      query(collection(db, 'emails'), where('companyId', '==', id)),
      snap => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        rows.sort((a, b) => {
          const ta = a.createdAt?.toDate?.() || new Date(0)
          const tb = b.createdAt?.toDate?.() || new Date(0)
          return tb - ta
        })
        setEmails(rows)
      }
    )

    // ai_chats — last 20, oldest first for chat display
    const unsubChats = onSnapshot(
      query(collection(db, 'ai_chats'), where('companyId', '==', id)),
      snap => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        rows.sort((a, b) => {
          const ta = a.createdAt?.toDate?.() || new Date(0)
          const tb = b.createdAt?.toDate?.() || new Date(0)
          return ta - tb
        })
        setAiChats(rows.slice(-20))
        setChatsLoaded(true)
      }
    )

    // ai_suggestions — pending only
    const unsubAiSugg = onSnapshot(
      query(collection(db, 'ai_suggestions'), where('companyId', '==', id), where('status', '==', 'pending')),
      snap => setAiSuggestions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )

    return () => { unsubDoc(); unsubInter(); unsubNotes(); unsubTasks(); unsubEmails(); unsubChats(); unsubAiSugg() }
  }, [initialCompany.id])

  // ── Helpers ────────────────────────────────────────────────────────────────
  const setFbKey = (key, state) => setFb(p => ({ ...p, [key]: state }))

  function showToast(msg, type = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  async function withFb(key, fn, successMsg = 'Uložené ✓') {
    setFbKey(key, 'saving')
    try {
      await fn()
      setFbKey(key, 'saved')
      setTimeout(() => setFbKey(key, null), 2000)
      showToast(successMsg)
    } catch (e) {
      setFbKey(key, 'error')
      setTimeout(() => setFbKey(key, null), 3000)
      showToast('Chyba: ' + e.message, 'err')
      console.error('[Modal]', key, e)
    }
  }

  async function logEvent(type, message, extra = {}) {
    await addDoc(collection(db, 'interactions'), {
      companyId:  live.id,
      type,
      message,
      createdBy:  CURRENT_USER,
      createdAt:  serverTimestamp(),
      ...extra,
    })
  }

  // ── AI Suggestions Engine ──────────────────────────────────────────────────
  async function generateAiSuggestions() {
    const existing = aiSuggestions.map(s => s.type)
    const candidates = []

    if (!live.email)
      candidates.push({ type: 'find_email', title: 'Nájsť email firmy', reason: 'Bez emailu nie je možný priamy kontakt', priority: 'high' })

    if ((live.aiScore ?? 0) >= 70 && emails.length === 0)
      candidates.push({ type: 'generate_email', title: live.email ? 'Vygenerovať prvý email' : 'Pripraviť prvý email', reason: live.email ? 'Silný kandidát bez emailu draftu' : 'Firma má vysoký potenciál', priority: 'high' })

    const createdDate = live.createdAt?.toDate?.() || new Date(live.createdAt || Date.now())
    const daysSince = (Date.now() - createdDate.getTime()) / 86400000
    if (live.status === 'new' && daysSince > 7)
      candidates.push({ type: 'follow_up', title: 'Firma čaká 7+ dní bez kontaktu', reason: 'Odporúčam follow-up alebo rozhodnutie', priority: 'medium' })

    if ((live.aiScore ?? 100) < 40)
      candidates.push({ type: 'low_priority', title: 'Zvážiť odloženie kontaktu', reason: 'Nízky BPS score', priority: 'low' })

    if (!live.website)
      candidates.push({ type: 'manual_check', title: 'Manuálne preveriť firmu', reason: 'Chýba web - ťažko odhadnúť potenciál', priority: 'medium' })

    for (const s of candidates) {
      if (!existing.includes(s.type)) {
        await addDoc(collection(db, 'ai_suggestions'), {
          companyId: live.id, ...s, status: 'pending',
          createdAt: serverTimestamp(), createdBy: 'AI',
        }).catch(console.error)
      }
    }
  }

  async function handleApproveSuggestion(suggestion) {
    await updateDoc(doc(db, 'ai_suggestions', suggestion.id), { status: 'approved', updatedAt: serverTimestamp() })
    await logEvent('suggestion_approved', `${CURRENT_USER} schválil návrh: ${suggestion.title}`)
    if (suggestion.type === 'generate_email') await handleCreateDraft()
    showToast('Návrh schválený ✓')
  }

  async function handleRejectSuggestion(id) {
    await updateDoc(doc(db, 'ai_suggestions', id), { status: 'rejected', updatedAt: serverTimestamp() })
    showToast('Návrh zamietnutý')
  }

  async function handleSuggestionToTask(suggestion) {
    const text = suggestion.title
    await addDoc(collection(db, 'tasks'), { companyId: live.id, text, done: false, createdAt: serverTimestamp(), createdBy: CURRENT_USER })
    await logEvent('task_created', `${CURRENT_USER} pridal úlohu: ${text}`)
    await updateDoc(doc(db, 'ai_suggestions', suggestion.id), { status: 'done', updatedAt: serverTimestamp() })
    showToast('Úloha vytvorená ✓')
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function handleStatusChange(newStatus) {
    const oldStatus = live.status
    if (oldStatus === newStatus) { showToast(`Status je už: ${STATUS_LABELS[newStatus] || newStatus}`); return }
    await withFb('status', async () => {
      await updateDoc(doc(db, 'companies', live.id), {
        status: newStatus, statusChangedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
      await logEvent('status_changed',
        `${CURRENT_USER} zmenil status: ${STATUS_LABELS[oldStatus] || oldStatus} → ${STATUS_LABELS[newStatus] || newStatus}`,
        { oldStatus, newStatus }
      )
    }, `✓ Status: ${STATUS_LABELS[newStatus] || newStatus}`)
  }

  async function handleAddNote() {
    const text = newNote.trim()
    if (!text) return
    await withFb('addNote', async () => {
      await addDoc(collection(db, 'companies', live.id, 'notes'), {
        text, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        createdBy: CURRENT_USER, edited: false, deleted: false,
      })
      await logEvent('note_added', `${CURRENT_USER} pridal poznámku`)
      setNewNote('')
    })
  }

  async function handleEditNote(noteId, newText) {
    await updateDoc(doc(db, 'companies', live.id, 'notes', noteId), {
      text: newText, updatedAt: serverTimestamp(), edited: true,
    })
    await logEvent('note_updated', `${CURRENT_USER} upravil poznámku`)
  }

  async function handleDeleteNote(noteId) {
    await updateDoc(doc(db, 'companies', live.id, 'notes', noteId), {
      deleted: true, updatedAt: serverTimestamp(),
    })
    await logEvent('note_deleted', `${CURRENT_USER} zmazal poznámku`)
    showToast('Poznámka zmazaná')
  }

  async function handleCreateTask() {
    const text = taskText.trim()
    if (!text) return
    await withFb('task', async () => {
      await addDoc(collection(db, 'tasks'), {
        companyId: live.id, text, done: false, createdAt: serverTimestamp(),
        createdBy: CURRENT_USER,
      })
      await logEvent('task_created', `${CURRENT_USER} pridal úlohu: ${text}`, { content: text })
      setTaskText('')
    })
  }

  async function handleToggleTask(taskId, currentDone) {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        done: !currentDone, doneAt: !currentDone ? serverTimestamp() : null,
      })
    } catch (e) { showToast('Chyba: ' + e.message, 'err') }
  }

  function openDraft() {
    const { subject, body } = generateEmailDraft(live)
    setDraftSubj(subject); setDraftBody(body); setDraftOpen(true)
    logEvent('email_generated', `${CURRENT_USER} vygeneroval email draft`)
  }

  // ── Email workflow handlers ────────────────────────────────────────────────
  async function handleCreateDraft() {
    const existing = emails.find(e => ['active_draft', 'translated', 'draft'].includes(e.status))
    if (existing && !window.confirm('Existujúci draft bude prepísaný. Pokračovať?')) return

    await withFb('createDraft', async () => {
      const kbSnap = await getDocs(collection(db, 'knowledge_base'))
      const knowledgeBase = kbSnap.docs.map(d => d.data())

      const typeMap  = { hotel: 'hotel', laundry: 'priemyselná práčovňa', spa: 'wellness / SPA centrum', hospital: 'nemocnica / klinika', restaurant: 'reštaurácia' }
      const typeName = typeMap[live.category] || live.category

      const auditLines = interactions.slice(0, 5)
        .map(ev => `  - ${evMessage(ev)}${evTs(ev) ? ' (' + fmtTs(evTs(ev)) + ')' : ''}`)
        .join('\n') || '  - žiadna história'
      const noteLines = notes.slice(0, 5).map(n => `  - ${n.text}`).join('\n') || '  - žiadne poznámky'

      const prompt = `Napíš prvý kontaktný email po SLOVENSKY pre nasledujúcu firmu.

FIRMA:
- Názov: ${live.name}
- Typ: ${typeName}
- Mesto: ${live.city || '–'}${live.address ? ', ' + live.address : ''}
- Web: ${live.website || 'neznámy'}
- Rating: ${live.rating ? live.rating + ' / 5' : 'neznámy'}
- BPS skóre: ${live.aiScore ?? '–'} / 100 (istota: ${live.aiConfidence || '–'})
- BPS hodnotenie: ${live.aiReason || '–'}
- BPS faktory: ${(live.aiReasoning || []).join(' | ') || '–'}
- Pozitívne signály: ${(live.aiPositive || []).join(', ') || '–'}
- Riziká: ${(live.aiRisks || []).join(', ') || '–'}
- CRM status: ${live.status || 'new'}

POZNÁMKY K FIRME:
${noteLines}

HISTÓRIA KONTAKTU:
${auditLines}

STRIKER KONTEXT:
- Kavitačná kúriaca technológia: 45 kW el. vstupu → 120-160 kW tepla (COP 2.7-3.5)
- Úspora 50-70 % na nákladoch za kúrenie a teplú vodu
- Cena 8 000-10 000 EUR, montáž 1-2 dni, BAFA dotácia možná v Nemecku
- Ideálny pre: hotely, práčovne, SPA, penzie s vysokou spotrebou teplej vody
- Odosielateľ: Adolf Staubert, STRIKER Energy

PRAVIDLÁ EMAILU:
- Nepredávaj agresívne, nebuď príliš technický
- 3-4 krátke odseky, prirodzený B2B tón
- Personalizuj podľa typu firmy (${typeName})
- CTA = krátky videohovor alebo osobné stretnutie
- Žiadny meta-text ani komentáre — iba čistý email
- NEVER include sections like ČO CHÝBA, NAJLEPŠÍ ĎALŠÍ KROK, ODPORÚČANÁ AKCIA, or any meta-commentary
- Write ONLY the email subject (PREDMET:) and body. Nothing else.`

      const res = await fetch('/.netlify/functions/ai-advisor', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages:       [{ role: 'user', content: prompt }],
          companyContext: buildCompanyContext(),
          knowledgeBase,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI chyba')

      const text  = stripAiNoise(data.text || '')
      const lines = text.split('\n')
      const sLine = lines.find(l => /^predmet:/i.test(l.trim()))
      const subjectSk = sLine ? sLine.replace(/^predmet:\s*/i, '').trim() : `STRIKER — ${live.name}`
      const after     = sLine ? text.slice(text.indexOf(sLine) + sLine.length) : text
      const bodySk    = after.replace(/^\s*\n+/, '').trim()

      const fields = {
        subjectSk, bodySk,
        subjectDe: '', bodyDe: '',
        status:      'active_draft',
        generatedBy: CURRENT_USER,
        aiModel:     'claude-haiku-4-5',
        updatedAt:   serverTimestamp(),
        edited:      false,
      }

      if (existing) {
        await updateDoc(doc(db, 'emails', existing.id), fields)
        await logEvent('email_draft_overwritten', `${CURRENT_USER} prepísal draft pre ${live.name}`)
      } else {
        await addDoc(collection(db, 'emails'), {
          companyId: live.id, type: 'first_contact',
          createdAt: serverTimestamp(), ...fields,
        })
        await logEvent('email_draft_created', `${CURRENT_USER} vytvoril AI draft pre ${live.name}`)
      }
    }, '✓ Draft vytvorený')
  }

  async function handleSaveSkDraft(emailId, subjectSk, bodySk) {
    try {
      await updateDoc(doc(db, 'emails', emailId), { subjectSk, bodySk, updatedAt: serverTimestamp(), edited: true })
      await logEvent('email_draft_edited_sk', `${CURRENT_USER} upravil SK draft`)
      showToast('SK draft uložený ✓')
    } catch (e) { showToast('Chyba: ' + e.message, 'err') }
  }

  async function handleSaveDeDraft(emailId, subjectDe, bodyDe) {
    try {
      await updateDoc(doc(db, 'emails', emailId), { subjectDe, bodyDe, updatedAt: serverTimestamp(), edited: true })
      await logEvent('email_draft_edited_de', `${CURRENT_USER} upravil DE draft`)
      showToast('DE draft uložený ✓')
    } catch (e) { showToast('Chyba: ' + e.message, 'err') }
  }

  async function handleTranslateDraft(email, subjSk, bodySk) {
    const skSubj = subjSk || email.subjectSk || ''
    const skBody = bodySk || email.bodySk    || ''
    const prompt = `Prelož tento email do profesionálnej nemčiny, B2B štýl, Sie-forma, zachovaj štruktúru:\n\nPredmet: ${skSubj}\n\n${skBody}`
    try {
      const res = await fetch('/.netlify/functions/ai-advisor', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages:       [{ role: 'user', content: prompt }],
          companyContext: buildCompanyContext(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chyba prekladu')

      const text  = stripAiNoise(data.text || '')
      const lines = text.split('\n')
      const sLine = lines.find(l => /^betreff:/i.test(l.trim()))
      const subjectDe = sLine ? sLine.replace(/^betreff:\s*/i, '').trim() : skSubj
      const after     = sLine ? text.slice(text.indexOf(sLine) + sLine.length) : text
      const bodyDe    = after.replace(/^\s*\n+/, '').trim()

      await updateDoc(doc(db, 'emails', email.id), {
        subjectDe, bodyDe,
        status:       'translated',
        updatedAt:    serverTimestamp(),
        translatedAt: serverTimestamp(),
      })
      await logEvent('email_translated_de', `${CURRENT_USER} preložil draft do nemčiny`)
      showToast('✓ Preložené do nemčiny')
    } catch (e) { showToast('Chyba prekladu: ' + e.message, 'err'); throw e }
  }

  async function handleApproveEmail(emailId) {
    try {
      await updateDoc(doc(db, 'emails', emailId), {
        status: 'approved', approvedBy: CURRENT_USER,
        approvedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
      await logEvent('email_draft_approved', `${CURRENT_USER} schválil email draft`)
      showToast('Email schválený ✓')
    } catch (e) { showToast('Chyba: ' + e.message, 'err') }
  }

  async function handleDeleteEmail(emailId) {
    try {
      await updateDoc(doc(db, 'emails', emailId), {
        status: 'deleted', deletedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
      await logEvent('email_deleted', `${CURRENT_USER} zmazal email draft`)
      showToast('Draft zmazaný')
    } catch (e) { showToast('Chyba: ' + e.message, 'err') }
  }

  async function handleBackToSk(emailId) {
    try {
      await updateDoc(doc(db, 'emails', emailId), {
        status: 'active_draft', updatedAt: serverTimestamp(),
      })
      await logEvent('email_draft_back_to_sk', `${CURRENT_USER} vrátil draft na SK verziu`)
    } catch (e) { showToast('Chyba: ' + e.message, 'err') }
  }

  function handleCopyEmail(email) {
    const text = (email.subjectDe && email.bodyDe)
      ? `${email.subjectDe}\n\n${email.bodyDe}`
      : `${email.subjectSk}\n\n${email.bodySk}`
    navigator.clipboard.writeText(text)
      .then(() => { showToast('📋 Skopírované'); logEvent('email_copied', `${CURRENT_USER} skopíroval email draft`) })
      .catch(() => showToast('Kopírovanie zlyhalo', 'err'))
  }

  async function handleFindEmail() {
    if (!live.website) return
    setEmailSearch({ state: 'searching', email: null })
    try {
      const res = await fetch('/.netlify/functions/find-email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ website: live.website }),
      })
      const data = await res.json()
      setEmailSearch(data.email
        ? { state: 'found',    email: data.email }
        : { state: 'notfound', email: null })
    } catch {
      setEmailSearch({ state: 'notfound', email: null })
    }
  }

  async function handleSaveFoundEmail() {
    const email = emailSearch.email
    if (!email) return
    await withFb('saveEmail', async () => {
      await updateDoc(doc(db, 'companies', live.id), { email, updatedAt: serverTimestamp() })
      await logEvent('email_found', `${CURRENT_USER} našiel email cez web scraper: ${email}`)
      setEmailSearch({ state: null, email: null })
    })
  }

  async function handleSendEmail(email, subjectDe, bodyDe) {
    if (!live.email) { showToast('Firma nemá email', 'err'); return }
    setSendingEmail(true)
    try {
      const res = await fetch('/.netlify/functions/send-email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          to:          live.email,
          subjectDe:   subjectDe || email.subjectDe,
          bodyDe:      bodyDe    || email.bodyDe,
          companyId:   live.id,
          companyName: live.name,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Odoslanie zlyhalo')
      await updateDoc(doc(db, 'emails', email.id), {
        status: 'sent', sentBy: CURRENT_USER,
        sentAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
      await logEvent('email_sent', `${CURRENT_USER} odoslal email na ${live.email}`)
      showToast('Email odoslaný ✓')
    } catch (e) {
      showToast('Chyba odoslania: ' + e.message, 'err')
    } finally {
      setSendingEmail(false)
    }
  }

  // ── AI Advisor ─────────────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiChats, aiLoading])

  function buildCompanyContext() {
    const missingData = []
    if (!live.email)         missingData.push('email')
    if (!live.phone)         missingData.push('telefón')
    if (!live.website)       missingData.push('web')
    if (!live.contactPerson) missingData.push('kontaktná osoba')
    if (live.aiScore == null) missingData.push('BPS skóre')

    return {
      name:           live.name,
      category:       live.category,
      city:           live.city,
      address:        live.address,
      website:        live.website,
      phone:          live.phone,
      email:          live.email,
      rating:         live.rating,
      placeId:        live.googlePlaceId,
      aiScore:        live.aiScore,
      aiReason:       live.aiReason,
      aiPositive:     live.aiPositive   || [],
      aiRisks:        live.aiRisks      || [],
      aiNextStep:     live.aiNextStep   || '',
      aiReasoning:    live.aiReasoning  || [],
      aiConfidence:   live.aiConfidence || null,
      status:         live.status,
      notes:          notes.slice(0, 3).map(n => n.text),
      tasks:          tasks.filter(t => !t.done).map(t => t.text),
      recentTimeline: interactions.slice(0, 10).map(e => evMessage(e)).filter(Boolean),
      emailDrafts:    emails.map(e => ({ subject: e.subject, status: e.status })),
      aiSuggestions:  aiSuggestions.map(s => ({ title: s.title, type: s.type, priority: s.priority })),
      missingData,
    }
  }

  async function handleDeleteInteraction(id) {
    try {
      await deleteDoc(doc(db, 'interactions', id))
    } catch (e) { showToast('Chyba: ' + e.message, 'err') }
  }

  async function handleToDraft(rawText) {
    // 1. Try [EMAIL_START]...[EMAIL_END] markers
    let extracted
    const markerMatch = rawText.match(/\[EMAIL_START\]([\s\S]*?)\[EMAIL_END\]/i)
    if (markerMatch) {
      extracted = markerMatch[1].trim()
    } else {
      // 2. Fallback: find first "Predmet:" line and take everything from there
      const predMatch = rawText.match(/^predmet:\s*.+$/im)
      extracted = predMatch
        ? rawText.slice(rawText.indexOf(predMatch[0])).trim()
        : rawText
    }

    // Parse "Predmet:" line for subject
    const lines     = extracted.split('\n')
    const subjLine  = lines.find(l => /^predmet:/i.test(l.trim()))
    const subjectSk = subjLine
      ? subjLine.replace(/^predmet:\s*/i, '').trim()
      : `STRIKER — ${live.name}`
    const bodyRaw   = subjLine
      ? extracted.slice(extracted.indexOf(subjLine) + subjLine.length)
      : extracted
    const bodySk    = cleanDraftText(bodyRaw)

    const existing = emails.find(e => ['active_draft', 'translated', 'draft'].includes(e.status))
    const fields = {
      subjectSk,
      bodySk,
      subjectDe:   '',
      bodyDe:      '',
      status:      'active_draft',
      generatedBy: CURRENT_USER,
      aiModel:     'claude-haiku-4-5',
      updatedAt:   serverTimestamp(),
      edited:      false,
    }
    try {
      if (existing) {
        await updateDoc(doc(db, 'emails', existing.id), fields)
      } else {
        await addDoc(collection(db, 'emails'), {
          companyId: live.id, type: 'first_contact',
          createdAt: serverTimestamp(), ...fields,
        })
      }
      await logEvent('email_draft_created', `${CURRENT_USER} preniesol AI správu do SK draftu`)
      showToast('✓ Prenesené do draftu')
    } catch (e) { showToast('Chyba: ' + e.message, 'err') }
  }

  async function handleDeleteAiChat(id) {
    try { await deleteDoc(doc(db, 'ai_chats', id)) }
    catch (e) { showToast('Chyba: ' + e.message, 'err') }
  }

  async function handleEditAiChat(id, newText) {
    try {
      await updateDoc(doc(db, 'ai_chats', id), { message: newText, edited: true, updatedAt: serverTimestamp() })
    } catch (e) { showToast('Chyba: ' + e.message, 'err') }
  }

  async function sendAiMessage(text) {
    const msg = (text || aiInput).trim()
    if (!msg || aiLoading) return
    setAiInput('')
    setAiLoading(true)

    // Build API messages from persisted history + new message
    const apiMessages = [
      ...aiChats.map(c => ({ role: c.role, content: c.message })),
      { role: 'user', content: msg },
    ]

    // Persist user message to Firestore
    await addDoc(collection(db, 'ai_chats'), {
      companyId: live.id, role: 'user', message: msg,
      createdAt: serverTimestamp(), createdBy: CURRENT_USER,
    }).catch(console.error)

    try {
      const res = await fetch('/.netlify/functions/ai-advisor', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: apiMessages, companyContext: buildCompanyContext() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

      // Persist AI response (with suggestion tag intact for parsing on render)
      await addDoc(collection(db, 'ai_chats'), {
        companyId: live.id, role: 'assistant', message: data.text,
        createdAt: serverTimestamp(), createdBy: 'AI',
      }).catch(console.error)

    } catch (e) {
      await addDoc(collection(db, 'ai_chats'), {
        companyId: live.id, role: 'assistant', message: `⚠ Chyba: ${e.message}`,
        createdAt: serverTimestamp(), createdBy: 'AI',
      }).catch(console.error)
    } finally {
      setAiLoading(false)
    }
  }

  // ── Auto-greeting (fires once when chats load empty) ─────────────────────
  useEffect(() => {
    if (!chatsLoaded) return
    if (aiChats.length === 0 && !greetingInitialized.current) {
      greetingInitialized.current = true
      sendAiMessage('Analyzuj túto firmu a daj mi okamžitý verdikt.')
    }
    if (!suggestionsInitialized.current) {
      suggestionsInitialized.current = true
      generateAiSuggestions()
    }
  }, [chatsLoaded])

  const DRAWER_QUICK = [
    { label: '🏢 Zhodnoť firmu', text: 'Analyzuj túto firmu a daj mi okamžitý verdikt.' },
    { label: '🎯 Ďalší krok',    text: 'Aký je najlepší ďalší krok pre túto firmu?' },
    { label: '✉ Prvý email',     text: 'Navrhni konkrétny prvý email pre túto firmu.' },
    { label: '📧 Follow-up',     text: 'Napíš follow-up email pre túto firmu.' },
    { label: '📋 Zhrň históriu', text: 'Zhrň históriu kontaktu s touto firmou.' },
  ]

  const QUICK_PROMPTS = [
    // Row 1
    { label: '🏢 Zhodnoť firmu',    text: 'Analyzuj túto firmu a daj mi okamžitý verdikt.' },
    { label: '🎯 Ďalší krok',       text: 'Aký je najlepší ďalší krok pre túto firmu?' },
    { label: '✉ Prvý email',        text: 'Navrhni konkrétny prvý email pre túto firmu.' },
    { label: '📧 Follow-up',        text: 'Napíš follow-up email pre túto firmu.' },
    { label: '💬 Odpovedz',         text: 'Ako odpovedať na email od tejto firmy?' },
    // Row 2
    { label: '⚠️ Riziká',           text: 'Aké sú hlavné riziká pri kontaktovaní tejto firmy?' },
    { label: '💰 ROI argumenty',    text: 'Aké ROI argumenty použiť pre túto firmu?' },
    { label: '✅ Vytvor úlohy',      text: 'Vytvor zoznam konkrétnych úloh pre túto firmu.' },
    { label: '📋 Zhrň históriu',    text: 'Zhrň históriu kontaktu s touto firmou.' },
    { label: '🔍 Čo chýba',         text: 'Čo chýba pre posun vpred s touto firmou?' },
    { label: '📊 Stratégia',        text: 'Navrhni obchodnú stratégiu pre túto firmu.' },
    { label: '📞 Tel. skript',      text: 'Navrhni skript pre telefonát s touto firmou.' },
    { label: '🔧 Tech. vysvetlenie',text: 'Ako technicky vysvetliť STRIKER tejto firme?' },
    { label: '🤔 Má zmysel?',       text: 'Má vôbec zmysel kontaktovať túto firmu? Buď úprimný.' },
  ]

  // ── Derived ────────────────────────────────────────────────────────────────
  const st         = COMPANY_STATUSES[live.status] || COMPANY_STATUSES.new
  const pri        = calculatePriorityLabel(live.aiScore)
  const sc         = live.aiScore
  const scCol      = SCORE_COLOR(sc)
  const positive   = live.aiPositive || live.aiFactors?.positive || []
  const risks      = live.aiRisks    || live.aiFactors?.risks    || []
  const nextStep   = live.aiNextStep || live.aiFactors?.nextStep || ''
  const reason     = live.aiReason   || ''
  const reasoning  = live.aiReasoning  || []
  const confidence = live.aiConfidence || null
  const domain     = extractDomain(live.website)

  const CONF_COLORS  = { vysoká: '#00cc88', stredná: '#ffaa00', nízka: '#ef4444' }
  const activeDraft  = emails.find(e => ['active_draft', 'translated', 'draft'].includes(e.status)) || null
  const lastSentEmail = [...emails].filter(e => e.status === 'sent').sort((a, b) =>
    (b.sentAt?.toDate?.()?.getTime() || 0) - (a.sentAt?.toDate?.()?.getTime() || 0)
  )[0] || null

  return (
    <div style={css.overlay} onKeyDown={e => e.key === 'Escape' && onClose()} tabIndex={-1}>
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
            <div style={{ textAlign: 'center' }}>
              <div style={{ ...css.scoreCircle, borderColor: scCol, color: scCol }}>
                <div style={css.scoreNum}>{sc != null ? sc : '–'}</div>
                <div style={css.scoreBot}>BPS</div>
              </div>
              {confidence && (
                <div style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '1px', textTransform: 'uppercase', color: CONF_COLORS[confidence], marginTop: '0.25rem' }}>
                  {confidence}
                </div>
              )}
            </div>
            <div style={{ ...css.statusBadge, background: st.bg, color: st.color, borderColor: st.color + '55' }}>
              {st.label}
            </div>
            <button style={css.closeBtn} onClick={onClose} title="Esc">✕</button>
          </div>
        </div>

        {/* ══ THREE COLUMNS ══ */}
        <div style={css.cols}>

          {/* LEFT */}
          <div style={css.col}>
            <ColTitle>Kontaktné údaje</ColTitle>
            <InfoRow label="Email">
              {live.email
                ? <span style={{ color: '#00cc88', fontFamily: mono, fontSize: '0.72rem' }}>{live.email}</span>
                : emailSearch.state === 'searching'
                ? <span style={{ color: '#9ca3af', fontFamily: mono, fontSize: '0.68rem' }}>🔍 Hľadám email...</span>
                : emailSearch.state === 'found'
                ? <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <span style={{ color: '#00cc88', fontFamily: mono, fontSize: '0.68rem' }}>✓ Email nájdený: {emailSearch.email}</span>
                    <button
                      style={{ fontFamily: mono, fontSize: '0.58rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.18rem 0.55rem', border: 'none', background: '#00cc88', color: '#0d1117', borderRadius: 2, fontWeight: 700, cursor: 'pointer', opacity: fb.saveEmail === 'saving' ? 0.6 : 1 }}
                      onClick={handleSaveFoundEmail}
                      disabled={fb.saveEmail === 'saving'}>
                      {fb.saveEmail === 'saving' ? '⏳' : 'Uložiť'}
                    </button>
                  </div>
                : emailSearch.state === 'notfound'
                ? <span style={{ color: '#6b7280', fontFamily: mono, fontSize: '0.68rem' }}>Email sa nenašiel na webe</span>
                : <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ color: '#ffaa00', fontFamily: mono, fontSize: '0.68rem' }}>⚠ Email chýba</span>
                    {live.website && (
                      <button
                        style={{ fontFamily: mono, fontSize: '0.58rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.15rem 0.5rem', border: '1px solid #ffaa0055', background: 'rgba(255,170,0,0.08)', color: '#ffaa00', borderRadius: 2, cursor: 'pointer' }}
                        onClick={handleFindEmail}>
                        🔍 Hľadať email
                      </button>
                    )}
                  </div>}
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

          {/* CENTER */}
          <div style={css.col}>
            <ColTitle>AI Analýza</ColTitle>
            <AiBadge pri={pri} score={sc} />
            {reason && <div style={css.aiReason}>✦ {reason}</div>}
            {reasoning.slice(0, 3).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.75rem' }}>
                {reasoning.slice(0, 3).map((r, i) => (
                  <span key={i} style={{ fontFamily: mono, fontSize: '0.52rem', color: r.startsWith('-') ? '#ef4444' : '#00cc88', background: r.startsWith('-') ? 'rgba(239,68,68,0.08)' : 'rgba(0,204,136,0.08)', border: `1px solid ${r.startsWith('-') ? '#ef444433' : '#00cc8833'}`, padding: '0.1rem 0.4rem', borderRadius: 2 }}>
                    {r}
                  </span>
                ))}
              </div>
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

          {/* RIGHT */}
          <div style={css.col}>
            <ColTitle>CRM Stav</ColTitle>
            <div style={css.statusChangeRow}>
              {STATUS_LIST.map(s => (
                <button key={s.key}
                  style={{ ...css.stBtn, background: live.status === s.key ? s.bg : 'transparent', color: live.status === s.key ? s.color : '#4b5563', borderColor: live.status === s.key ? s.color + '88' : '#1e2530' }}
                  onClick={() => handleStatusChange(s.key)}>
                  {live.status === s.key && fb.status === 'saving' ? '⏳' : s.label}
                </button>
              ))}
            </div>
            {fb.status === 'saved' && <div style={css.fbOk}>✓ Status uložený</div>}
            {fb.status === 'error' && <div style={css.fbErr}>✗ Chyba</div>}

            <InfoRow label="Priorita">
              {pri ? <span style={{ color: pri.color, fontFamily: mono, fontSize: '0.68rem' }}>{pri.label}</span> : <Muted>–</Muted>}
            </InfoRow>
            <InfoRow label="Posl. kontakt"><Muted>{live.lastContact || '–'}</Muted></InfoRow>
            <InfoRow label="Ďalší krok">  <Muted>{live.nextAction  || '–'}</Muted></InfoRow>
            <InfoRow label="Zodpovedný">  <Muted>{live.assignee    || '–'}</Muted></InfoRow>

            <div style={{ marginTop: '1.25rem' }}>
              <div style={css.factorTitle}>Úlohy ({tasks.length})</div>
              {tasks.map(t => (
                <div key={t.id} style={css.taskItem}>
                  <input type="checkbox" checked={!!t.done}
                    onChange={() => handleToggleTask(t.id, t.done)}
                    style={{ accentColor: '#00cc88', marginRight: '0.4rem', cursor: 'pointer', flexShrink: 0 }} />
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

        {/* ══ EMAIL WORKFLOW ══ */}
        <div style={css.section}>
          <ColTitle>Email Workflow</ColTitle>

          {/* Last sent info line */}
          {lastSentEmail && (
            <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#00cc88', marginBottom: '0.6rem' }}>
              ✓ Posledný email odoslaný: {fmtTs(lastSentEmail.sentAt)}
            </div>
          )}

          {/* Active draft card (max 1) */}
          {activeDraft && (
            <EmailWorkflowCard key={activeDraft.id} email={activeDraft}
              companyEmail={live.email}
              onSaveSk={handleSaveSkDraft}
              onSaveDe={handleSaveDeDraft}
              onTranslate={handleTranslateDraft}
              onSend={handleSendEmail}
              onDelete={handleDeleteEmail}
              onCopy={handleCopyEmail}
              onBackToSk={handleBackToSk}
              sending={sendingEmail} />
          )}

          {/* Create / overwrite button */}
          <button style={css.btnPrimary} onClick={() => handleCreateDraft()} disabled={fb.createDraft === 'saving'}>
            {fb.createDraft === 'saving' ? '⏳ AI generuje draft...' : '✦ Vytvoriť nový draft'}
          </button>
        </div>

        <div style={css.divider} />

        {/* ══ NOTES — trigger button ══ */}
        <div style={css.section}>
          <button
            style={{ fontFamily: mono, fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.35rem 0.85rem', border: '1px solid #21262d', background: 'transparent', color: notes.length > 0 ? '#e8eaed' : '#6b7280', borderRadius: 2, cursor: 'pointer' }}
            onClick={() => setNotesOpen(true)}>
            📋 Poznámky {notes.length > 0 ? `(${notes.length})` : ''}
          </button>
        </div>

        {/* ══ NOTES DRAWER ══ */}
        {notesOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 599, background: 'rgba(0,0,0,0.55)' }} onClick={() => setNotesOpen(false)} />
            <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', justifyContent: 'flex-end', pointerEvents: 'none' }}>
            <div style={{ width: '100%', maxWidth: 460, height: '100%', background: '#0d1117', borderLeft: '1px solid #21262d', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.7)', pointerEvents: 'auto' }}>

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid #1e2530', flexShrink: 0 }}>
                <span style={{ fontFamily: mono, fontSize: '0.6rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#6b7280' }}>
                  📋 Poznámky · {notes.length}
                </span>
                <button style={{ background: 'transparent', border: '1px solid #21262d', color: '#6b7280', width: 28, height: 28, borderRadius: 3, fontSize: '0.85rem', cursor: 'pointer' }} onClick={() => setNotesOpen(false)}>✕</button>
              </div>

              {/* Notes list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.85rem 1.25rem' }}>
                {notes.length === 0 && (
                  <div style={{ fontFamily: mono, fontSize: '0.65rem', color: '#4b5563', textAlign: 'center', padding: '2rem 0' }}>Žiadne poznámky</div>
                )}
                {notes.map(n => (
                  <NoteCard key={n.id} note={n} onEdit={handleEditNote} onDelete={handleDeleteNote} />
                ))}
              </div>

              {/* Add note */}
              <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid #1e2530', flexShrink: 0 }}>
                <textarea
                  style={css.newNoteArea}
                  placeholder="Nová poznámka..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handleAddNote()}
                />
                <button
                  style={{ ...css.btnPrimary, opacity: fb.addNote === 'saving' ? 0.6 : 1, width: '100%' }}
                  onClick={handleAddNote}
                  disabled={fb.addNote === 'saving'}>
                  {fb.addNote === 'saving' ? '⏳ Ukladám...' : fb.addNote === 'saved' ? '✓ Pridané' : '+ Pridať poznámku'}
                </button>
              </div>
            </div>
            </div>
          </>
        )}

        <div style={css.divider} />

        {/* ══ TIMELINE — trigger button ══ */}
        <div style={css.section}>
          <button
            style={{ fontFamily: mono, fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.35rem 0.85rem', border: '1px solid #21262d', background: 'transparent', color: interactions.length > 0 ? '#e8eaed' : '#6b7280', borderRadius: 2, cursor: 'pointer' }}
            onClick={() => setAuditOpen(true)}>
            🕐 Audit trail {interactions.length > 0 ? `(${interactions.length})` : ''}
          </button>
        </div>

        {/* ══ AUDIT TRAIL DRAWER ══ */}
        {auditOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 599, background: 'rgba(0,0,0,0.55)' }} onClick={() => setAuditOpen(false)} />
            <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', justifyContent: 'flex-end', pointerEvents: 'none' }}>
              <div style={{ width: '100%', maxWidth: 520, height: '100%', background: '#0d1117', borderLeft: '1px solid #21262d', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.7)', pointerEvents: 'auto' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid #1e2530', flexShrink: 0 }}>
                  <span style={{ fontFamily: mono, fontSize: '0.6rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#6b7280' }}>
                    🕐 Audit trail · {interactions.length} udalostí
                  </span>
                  <button style={{ background: 'transparent', border: '1px solid #21262d', color: '#6b7280', width: 28, height: 28, borderRadius: 3, fontSize: '0.85rem', cursor: 'pointer' }} onClick={() => setAuditOpen(false)}>✕</button>
                </div>

                {/* Events list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1.25rem' }}>
                  {interactions.length === 0 && (
                    <div style={{ fontFamily: mono, fontSize: '0.65rem', color: '#4b5563', textAlign: 'center', padding: '2rem 0' }}>Žiadne udalosti</div>
                  )}
                  {interactions.map(ev => (
                    <AuditRow key={ev.id} ev={ev} onDelete={handleDeleteInteraction} />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        <div style={css.divider} />

        {/* ══ STRIKER AI ADVISOR — trigger button ══ */}
        <div style={{ padding: '0.25rem 0 0.5rem' }}>
          <button
            style={{ fontFamily: mono, fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.35rem 0.85rem', border: '1px solid #ff5c0055', background: 'rgba(255,92,0,0.08)', color: '#ff5c00', borderRadius: 2, cursor: 'pointer', fontWeight: 700 }}
            onClick={() => setChatOpen(true)}>
            ✦ Striker AI Advisor {aiChats.length > 0 ? `(${aiChats.length})` : ''}
          </button>
        </div>

        {/* ══ STRIKER AI ADVISOR DRAWER ══ */}
        {chatOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 599, background: 'rgba(0,0,0,0.72)' }} onClick={() => setChatOpen(false)} />
            <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', justifyContent: 'flex-end', pointerEvents: 'none' }}>
              <div style={{ width: '100%', maxWidth: chatZoomed ? '90vw' : 600, height: '100%', background: '#080c11', borderLeft: '3px solid #ff5c0044', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(255,92,0,0.12)', pointerEvents: 'auto', transition: 'max-width 0.2s ease' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.4rem', borderBottom: '1px solid #ff5c0022', flexShrink: 0 }}>
                  <div>
                    <div style={{ fontFamily: mono, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: '#ff5c00' }}>✦ STRIKER AI ADVISOR</div>
                    <div style={{ fontFamily: mono, fontSize: '0.58rem', color: '#4b5563', marginTop: '0.15rem' }}>{live.name}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <button style={{ background: 'transparent', border: '1px solid #ff5c0033', color: '#ff5c0088', fontFamily: mono, fontSize: '0.58rem', padding: '0.2rem 0.5rem', borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => setChatZoomed(v => !v)}>
                      {chatZoomed ? '⊖ Zoom' : '⊕ Zoom'}
                    </button>
                    <button style={{ background: 'transparent', border: '1px solid #ff5c0033', color: '#ff5c0099', width: 30, height: 30, borderRadius: 3, fontSize: '0.9rem', cursor: 'pointer' }} onClick={() => setChatOpen(false)}>✕</button>
                  </div>
                </div>

                {/* Missing data warning */}
                {(() => {
                  const missing = []
                  if (!live.email)   missing.push('email')
                  if (!live.phone)   missing.push('telefón')
                  if (!live.website) missing.push('web')
                  if (live.aiScore == null) missing.push('BPS skóre')
                  if (!missing.length) return null
                  return (
                    <div style={{ ...css.missingBar, borderRadius: 0, margin: 0, borderLeft: 'none', borderRight: 'none', flexShrink: 0 }}>
                      ⚠ Chýba: <span style={{ color: '#e8eaed' }}>{missing.join(', ')}</span>
                    </div>
                  )
                })()}

                {/* AI suggestions */}
                {aiSuggestions.length > 0 && (
                  <div style={{ padding: '0.6rem 1.4rem', borderBottom: '1px solid #ff5c0011', flexShrink: 0 }}>
                    <div style={css.aiSuggestTitle}>✦ AI NAVRHUJE</div>
                    {aiSuggestions.map(s => {
                      const priColor = s.priority === 'high' ? '#ff5c00' : s.priority === 'medium' ? '#ffaa00' : '#6b7280'
                      return (
                        <div key={s.id} style={{ ...css.aiSuggestCard, borderLeftColor: priColor, marginBottom: '0.3rem' }}>
                          <div style={css.aiSuggestRow}>
                            <div style={{ minWidth: 0 }}>
                              <span style={{ fontFamily: mono, fontSize: '0.68rem', color: '#e8eaed', fontWeight: 700 }}>{s.title}</span>
                              <span style={{ ...css.priChip, color: priColor, borderColor: priColor + '55', marginLeft: '0.4rem' }}>
                                {s.priority === 'high' ? 'Vysoká' : s.priority === 'medium' ? 'Stredná' : 'Nízka'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                              <button style={css.suggApprove} onClick={() => handleApproveSuggestion(s)}>✓</button>
                              <button style={css.suggTask}    onClick={() => handleSuggestionToTask(s)}>→</button>
                              <button style={css.suggReject}  onClick={() => handleRejectSuggestion(s.id)}>✕</button>
                            </div>
                          </div>
                          <div style={{ fontFamily: mono, fontSize: '0.58rem', color: '#6b7280', marginTop: '0.15rem' }}>{s.reason}</div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Chat history */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {aiChats.length === 0 && !aiLoading && (
                    <div style={css.chatEmpty}>Vyber rýchlu otázku alebo napíš vlastnú — AI poradí konkrétne pre túto firmu.</div>
                  )}
                  {aiChats.map((m, i, arr) => {
                    const parsed = m.role === 'assistant' ? parseAiResponse(m.message) : null
                    const displayText = parsed ? parsed.text : m.message
                    const suggestion  = parsed?.suggestion || null
                    const lastAiIdx   = arr.reduce((acc, x, idx) => x.role === 'assistant' ? idx : acc, -1)
                    return (
                      <div key={m.id || i}>
                        <ChatMessage
                          msg={m}
                          displayText={m.role === 'user' ? m.message : displayText}
                          role={m.role}
                          useMarkdown={m.role === 'assistant'}
                          isLatest={m.role === 'assistant' && i === lastAiIdx}
                          onDelete={handleDeleteAiChat}
                          onEdit={handleEditAiChat}
                          onToDraft={handleToDraft}
                        />
                        {m.role === 'assistant' && (() => {
                          const conf = extractConfidence(displayText)
                          if (!conf) return null
                          return <div style={{ marginLeft: '0.75rem', marginTop: '0.2rem', fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', color: conf.color, background: conf.color + '18', border: `1px solid ${conf.color}44`, padding: '0.07rem 0.38rem', borderRadius: 2, display: 'inline-block' }}>{conf.label}</div>
                        })()}
                        {m.role === 'assistant' && suggestion?.type === 'status' && (() => {
                          const sObj = COMPANY_STATUSES[suggestion.value]
                          if (!sObj) return null
                          return (
                            <div style={{ marginLeft: '1rem', marginTop: '0.35rem', background: '#0d1117', border: `1px solid ${sObj.color}44`, borderLeft: `3px solid ${sObj.color}`, borderRadius: 3, padding: '0.55rem 0.8rem', maxWidth: '88%' }}>
                              <div style={{ fontFamily: mono, fontSize: '0.6rem', color: sObj.color, marginBottom: '0.35rem' }}>✦ AI navrhuje → <strong>{sObj.label}</strong></div>
                              <button style={{ fontFamily: mono, fontSize: '0.58rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.22rem 0.6rem', border: 'none', background: sObj.color, color: '#0d1117', borderRadius: 2, fontWeight: 700, cursor: 'pointer' }} onClick={() => handleStatusChange(suggestion.value)}>✓ Schváliť</button>
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}
                  {aiLoading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <div style={{ background: '#0d1117', border: '1px solid #21262d', borderLeft: '3px solid #ff5c00', borderRadius: '3px 3px 3px 0', padding: '0.7rem 0.9rem' }}>
                        <span style={css.loadingMsg}>✦ Analyzujem...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Footer: quick buttons + input */}
                <div style={{ padding: '0.75rem 1.4rem', borderTop: '1px solid #ff5c0022', flexShrink: 0, background: '#080c11' }}>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.55rem' }}>
                    {DRAWER_QUICK.map(q => (
                      <button key={q.label} style={css.quickBtn} onClick={() => sendAiMessage(q.text)} disabled={aiLoading}>{q.label}</button>
                    ))}
                  </div>
                  <div style={css.aiInputRow}>
                    <input
                      style={css.aiInput}
                      placeholder="Opýtaj sa na túto firmu..."
                      value={aiInput}
                      onChange={e => setAiInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendAiMessage()}
                      disabled={aiLoading}
                    />
                    <button style={{ ...css.aiSendBtn, opacity: aiLoading ? 0.5 : 1 }} onClick={() => sendAiMessage()} disabled={aiLoading}>
                      {aiLoading ? '⏳' : 'Odoslať'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <Toast msg={toast?.msg} type={toast?.type} />
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function ColTitle({ children }) {
  return <div style={{ fontFamily: mono, fontSize: '0.55rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.85rem', paddingBottom: '0.4rem', borderBottom: '1px solid #1e2530' }}>{children}</div>
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
  overlay:       { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 500, overflowY: 'auto', padding: '2rem 1rem', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' },
  modal:         { background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, width: '100%', maxWidth: 1100, padding: '2rem 2.25rem', position: 'relative' },
  header:        { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', gap: '1.5rem' },
  headerLeft:    { flex: 1, minWidth: 0 },
  headerRight:   { display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 },
  companyName:   { fontFamily: "'IBM Plex Sans',sans-serif", fontSize: '1.5rem', fontWeight: 700, color: '#f0f6fc', marginBottom: '0.3rem', lineHeight: 1.2 },
  headerMeta:    { fontFamily: mono, fontSize: '0.65rem', color: '#6b7280', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' },
  dot:           { color: '#2d3748' },
  headerNextStep:{ fontFamily: mono, fontSize: '0.7rem', color: '#00cc88', marginTop: '0.55rem' },
  scoreCircle:   { width: 72, height: 72, borderRadius: '50%', border: '3px solid', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  scoreNum:      { fontFamily: mono, fontSize: '1.35rem', fontWeight: 700, lineHeight: 1 },
  scoreBot:      { fontFamily: mono, fontSize: '0.42rem', letterSpacing: '2px', color: '#4b5563', marginTop: 2 },
  statusBadge:   { fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.25rem 0.6rem', borderRadius: 3, border: '1px solid', whiteSpace: 'nowrap' },
  closeBtn:      { background: 'transparent', border: '1px solid #21262d', color: '#6b7280', width: 32, height: 32, borderRadius: 3, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cols:          { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2.5rem', marginBottom: '1.5rem' },
  col:           { minWidth: 0, padding: '0 0.25rem' },
  aiReason:      { fontFamily: mono, fontSize: '0.65rem', color: '#9ca3af', fontStyle: 'italic', marginBottom: '0.85rem', lineHeight: 1.65, background: 'rgba(255,255,255,0.03)', padding: '0.55rem 0.65rem', borderRadius: 3 },
  factorTitle:   { fontFamily: mono, fontSize: '0.52rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.35rem' },
  factorPos:     { fontFamily: mono, fontSize: '0.65rem', color: '#00cc88', lineHeight: 1.85 },
  factorRisk:    { fontFamily: mono, fontSize: '0.65rem', color: '#ffaa00', lineHeight: 1.85 },
  statusChangeRow:{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' },
  stBtn:         { fontFamily: mono, fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.2rem 0.5rem', border: '1px solid', borderRadius: 2, cursor: 'pointer', transition: 'all 0.1s' },
  fbOk:          { fontFamily: mono, fontSize: '0.6rem', color: '#00cc88', marginBottom: '0.5rem' },
  fbErr:         { fontFamily: mono, fontSize: '0.6rem', color: '#ef4444', marginBottom: '0.5rem' },
  taskItem:      { display: 'flex', alignItems: 'center', padding: '0.2rem 0', borderBottom: '1px solid #161b22' },
  taskRow:       { display: 'flex', gap: '0.4rem', marginTop: '0.5rem' },
  taskInput:     { flex: 1, background: '#161b22', border: '1px solid #21262d', color: '#e8eaed', fontFamily: mono, fontSize: '0.68rem', padding: '0.35rem 0.5rem', borderRadius: 2, outline: 'none' },
  taskBtn:       { background: '#ff5c00', border: 'none', color: '#fff', fontWeight: 700, width: 32, borderRadius: 2, cursor: 'pointer', fontSize: '1.1rem' },
  divider:       { height: 1, background: '#161b22', margin: '1.5rem 0' },
  section:       { marginBottom: '0.25rem' },
  link:          { fontFamily: mono, fontSize: '0.68rem', color: '#ff5c00', textDecoration: 'none' },
  webLink:       { fontFamily: mono, fontSize: '0.68rem', color: '#ff5c00', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', display: 'block' },
  emailStatus:   { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' },
  emailFoundBadge:  { fontFamily: mono, fontSize: '0.62rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#00cc88', background: 'rgba(0,204,136,0.1)', border: '1px solid rgba(0,204,136,0.3)', padding: '0.2rem 0.6rem', borderRadius: 2 },
  emailMissingBadge:{ fontFamily: mono, fontSize: '0.62rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#ffaa00', background: 'rgba(255,170,0,0.1)', border: '1px solid rgba(255,170,0,0.3)', padding: '0.2rem 0.6rem', borderRadius: 2 },
  emailBtns:     { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' },
  btnPrimary:    { fontFamily: mono, fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.35rem 0.85rem', border: 'none', background: '#ff5c00', color: '#fff', borderRadius: 2, fontWeight: 700, cursor: 'pointer' },
  btnSecondary:  { fontFamily: mono, fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.35rem 0.75rem', border: '1px solid #21262d', background: 'transparent', color: '#9ca3af', borderRadius: 2, cursor: 'pointer' },
  draftBox:      { background: '#161b22', border: '1px solid #21262d', borderRadius: 3, padding: '1rem', marginTop: '0.5rem' },
  draftLabel:    { display: 'block', fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.25rem' },
  draftInput:    { width: '100%', background: '#0d1117', border: '1px solid #21262d', color: '#e8eaed', fontFamily: mono, fontSize: '0.72rem', padding: '0.4rem 0.6rem', borderRadius: 2, outline: 'none', marginBottom: '0.6rem' },
  draftArea:     { width: '100%', background: '#0d1117', border: '1px solid #21262d', color: '#e8eaed', fontFamily: mono, fontSize: '0.65rem', padding: '0.5rem 0.6rem', borderRadius: 2, outline: 'none', resize: 'vertical', minHeight: 160, lineHeight: 1.7 },
  // Notes
  noteCard:      { background: '#161b22', border: '1px solid #21262d', borderRadius: 3, padding: '0.75rem 0.85rem', marginBottom: '0.5rem' },
  noteMeta:      { display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', flexWrap: 'wrap' },
  noteAuthor:    { fontFamily: mono, fontSize: '0.65rem', fontWeight: 700, color: '#ffaa00' },
  noteDot:       { color: '#2d3748', fontSize: '0.7rem' },
  noteTime:      { fontFamily: mono, fontSize: '0.6rem', color: '#4b5563' },
  editedBadge:   { fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280', background: '#21262d', border: '1px solid #30363d', padding: '0.08rem 0.35rem', borderRadius: 2 },
  noteText:      { fontFamily: "'IBM Plex Sans',sans-serif", fontSize: '0.78rem', color: '#c9d1d9', lineHeight: 1.6 },
  noteIconBtn:   { background: 'transparent', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: '0.8rem', padding: '0 0.2rem', lineHeight: 1 },
  noteEditArea:  { width: '100%', background: '#0d1117', border: '1px solid #30363d', color: '#e8eaed', fontFamily: "'IBM Plex Sans',sans-serif", fontSize: '0.78rem', padding: '0.45rem 0.55rem', borderRadius: 2, outline: 'none', resize: 'vertical', minHeight: 70, lineHeight: 1.6 },
  noteEditSave:  { fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.22rem 0.6rem', border: 'none', background: '#00cc88', color: '#0d1117', borderRadius: 2, fontWeight: 700, cursor: 'pointer' },
  noteEditCancel:{ fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.22rem 0.55rem', border: '1px solid #21262d', background: 'transparent', color: '#6b7280', borderRadius: 2, cursor: 'pointer' },
  newNoteArea:   { width: '100%', background: '#161b22', border: '1px solid #21262d', color: '#e8eaed', fontFamily: "'IBM Plex Sans',sans-serif", fontSize: '0.78rem', padding: '0.55rem 0.65rem', borderRadius: 3, outline: 'none', resize: 'vertical', minHeight: 72, lineHeight: 1.65, marginBottom: '0.5rem', display: 'block' },
  // Timeline
  timeline:      { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  tlRow:         { display: 'flex', gap: '0.65rem', alignItems: 'baseline' },
  tlIcon:        { fontSize: '0.72rem', flexShrink: 0, width: 18 },
  tlTime:        { fontFamily: mono, fontSize: '0.6rem', color: '#4b5563', flexShrink: 0, width: 120 },
  tlMsg:         { fontFamily: mono, fontSize: '0.65rem', color: '#9ca3af' },
  // AI Advisor
  aiSection:    { background: '#080c11', border: '1px solid #ff5c0033', borderLeft: '3px solid #ff5c00', borderRadius: 4, padding: '1.25rem 1.4rem', marginTop: '0.25rem' },
  aiTitle:      { fontFamily: mono, fontSize: '0.8rem', fontWeight: 700, color: '#ff5c00', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '0.9rem' },
  quickBtns:    { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.9rem' },
  quickBtn:     { fontFamily: mono, fontSize: '0.6rem', letterSpacing: '0.5px', padding: '0.3rem 0.7rem', border: '1px solid #ff5c0044', background: 'rgba(255,92,0,0.07)', color: '#ff5c00', borderRadius: 2, cursor: 'pointer' },
  chatBox:      { maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.55rem', marginBottom: '0.75rem', paddingRight: '0.25rem' },
  chatEmpty:    { fontFamily: mono, fontSize: '0.65rem', color: '#4b5563', fontStyle: 'italic', padding: '1rem 0', textAlign: 'center' },
  msgUserWrap:  { display: 'flex', justifyContent: 'flex-end' },
  msgAiWrap:    { display: 'flex', justifyContent: 'flex-start' },
  msgUser:      { background: '#161b22', border: '1px solid #21262d', borderRadius: '3px 3px 0 3px', padding: '0.55rem 0.75rem', maxWidth: '80%' },
  msgAi:        { background: '#0d1117', border: '1px solid #21262d', borderLeft: '3px solid #ff5c00', borderRadius: '3px 3px 3px 0', padding: '0.7rem 0.9rem', maxWidth: '92%' },
  msgUserText:  { fontFamily: mono, fontSize: '0.68rem', color: '#e8eaed' },
  msgAiText:    { fontFamily: "'IBM Plex Sans',sans-serif", fontSize: '0.8rem', color: '#c9d1d9', lineHeight: 1.75, whiteSpace: 'pre-wrap', display: 'block' },
  loadingMsg:   { fontFamily: mono, fontSize: '0.7rem', color: '#ff5c00', animation: 'priPulse 1s ease-in-out infinite' },
  aiInputRow:   { display: 'flex', gap: '0.5rem' },
  aiInput:      { flex: 1, background: '#161b22', border: '1px solid #21262d', color: '#e8eaed', fontFamily: mono, fontSize: '0.72rem', padding: '0.48rem 0.65rem', borderRadius: 2, outline: 'none' },
  aiSendBtn:    { background: '#ff5c00', border: 'none', color: '#fff', fontFamily: mono, fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.48rem 0.9rem', borderRadius: 2, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  // Missing data bar
  missingBar:       { fontFamily: mono, fontSize: '0.62rem', color: '#ffaa00', background: 'rgba(255,170,0,0.07)', border: '1px solid rgba(255,170,0,0.2)', padding: '0.35rem 0.7rem', borderRadius: 2, marginBottom: '0.75rem' },
  // AI NAVRHUJE section
  aiSuggestSection: { marginBottom: '0.85rem' },
  aiSuggestTitle:   { fontFamily: mono, fontSize: '0.58rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#ff5c00', marginBottom: '0.5rem' },
  aiSuggestCard:    { background: '#0d1117', border: '1px solid #21262d', borderLeft: '3px solid #ff5c00', borderRadius: 3, padding: '0.6rem 0.8rem', marginBottom: '0.4rem' },
  aiSuggestRow:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
  priChip:          { fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.08rem 0.35rem', border: '1px solid', borderRadius: 2 },
  suggApprove:      { fontFamily: mono, fontSize: '0.58rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.2rem 0.55rem', border: 'none', background: '#00cc88', color: '#0d1117', borderRadius: 2, fontWeight: 700, cursor: 'pointer' },
  suggTask:         { fontFamily: mono, fontSize: '0.58rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.2rem 0.5rem', border: '1px solid #ffaa0055', background: 'transparent', color: '#ffaa00', borderRadius: 2, cursor: 'pointer' },
  suggReject:       { fontFamily: mono, fontSize: '0.58rem', padding: '0.2rem 0.45rem', border: '1px solid #21262d', background: 'transparent', color: '#4b5563', borderRadius: 2, cursor: 'pointer' },
  // Email card buttons
  btnSave:       { fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.22rem 0.6rem', border: 'none', background: '#21262d', color: '#e8eaed', borderRadius: 2, fontWeight: 700, cursor: 'pointer' },
  btnCancel:     { fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.22rem 0.55rem', border: '1px solid #21262d', background: 'transparent', color: '#6b7280', borderRadius: 2, cursor: 'pointer' },
  btnTranslate:  { fontFamily: mono, fontSize: '0.62rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.3rem 0.85rem', border: '1px solid #3b82f655', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: 2, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' },
  btnApprove:    { fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.22rem 0.6rem', border: 'none', background: '#00cc88', color: '#0d1117', borderRadius: 2, fontWeight: 700, cursor: 'pointer' },
  btnSend:       { fontFamily: mono, fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.35rem 0.85rem', border: 'none', background: '#00cc88', color: '#0d1117', borderRadius: 2, fontWeight: 700, cursor: 'pointer', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' },
  btnIcon:       { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem', padding: '0 0.15rem', lineHeight: 1, color: '#6b7280' },
  cardBtn:       { fontFamily: mono, fontSize: '0.57rem', letterSpacing: '0.5px', padding: '0.18rem 0.5rem', border: '1px solid #21262d', background: 'transparent', color: '#9ca3af', borderRadius: 2, cursor: 'pointer', whiteSpace: 'nowrap' },
  cardBtnDanger: { fontFamily: mono, fontSize: '0.57rem', letterSpacing: '0.5px', padding: '0.18rem 0.5rem', border: '1px solid #ef444444', background: 'rgba(239,68,68,0.08)', color: '#ef4444', borderRadius: 2, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 },
  chatActionBtn: { fontFamily: mono, fontSize: '0.58rem', letterSpacing: '0.3px', padding: '0.15rem 0.45rem', border: '1px solid #1e2530', background: 'transparent', color: '#4b5563', borderRadius: 2, cursor: 'pointer', lineHeight: 1.5, whiteSpace: 'nowrap' },
}
