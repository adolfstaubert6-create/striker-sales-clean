import { useState, useEffect } from 'react'
import ProgressBar from './ProgressBar.jsx'

const mono = "'IBM Plex Mono',monospace"

const FLAGS = { de: '🇩🇪', sk: '🇸🇰', en: '🇬🇧' }
const LANGS  = ['de', 'sk', 'en']
const EMPTY  = { subject: '', body: '' }

// ── Styles ────────────────────────────────────────────────────────────────────

const base = {
  root: {
    background: '#0a0c10', border: '1px solid #1e2530',
    borderRadius: 4, overflow: 'hidden', fontFamily: mono,
  },
  header: {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.5rem 0.85rem', borderBottom: '1px solid #1a1f2a',
    background: '#070a0e', flexWrap: 'wrap',
  },
  headerLabel: {
    fontSize: '0.43rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: '#374151', marginRight: '0.2rem', whiteSpace: 'nowrap',
  },
  spacer: { flex: 1 },
  body: { padding: '0.8rem 0.9rem' },
  fieldLabel: {
    fontSize: '0.42rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: '#374151', marginBottom: '0.2rem',
  },
  inputBase: {
    width: '100%', fontFamily: mono, color: '#e8eaed',
    background: '#060810', border: '1px solid #2d3748', borderRadius: 2,
    padding: '0.42rem 0.6rem', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  },
}

function flagBtnStyle(active, locked) {
  return {
    fontSize: '1.35rem',       // large enough to see clearly
    lineHeight: 1,
    padding: '0.15rem 0.22rem',
    border: `1.5px solid ${active ? '#ff5c00' : '#1e2530'}`,
    background: active ? 'rgba(255,92,0,0.14)' : 'transparent',
    borderRadius: 4,
    cursor: locked ? 'default' : 'pointer',
    boxShadow: active ? '0 0 10px rgba(255,92,0,0.4), inset 0 0 6px rgba(255,92,0,0.1)' : 'none',
    transition: 'all 0.18s ease',
    opacity: locked && !active ? 0.3 : 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
}

const BTN = {
  ghost:   { background: 'transparent', border: '1px solid #1e2530', color: '#6b7280' },
  edit:    { background: 'rgba(255,92,0,0.1)', border: '1px solid #ff5c0055', color: '#ff5c00' },
  save:    { background: '#ff5c00', border: '1px solid #ff5c00', color: '#fff' },
  cancel:  { background: 'transparent', border: '1px solid #374151', color: '#9ca3af' },
  copy:    { background: 'transparent', border: '1px solid #1e2530', color: '#6b7280' },
  copied:  { background: 'rgba(0,204,136,0.08)', border: '1px solid #00cc8866', color: '#00cc88' },
  queue:   { background: 'rgba(99,102,241,0.1)', border: '1px solid #6366f155', color: '#818cf8' },
  queued:  { background: 'rgba(0,204,136,0.08)', border: '1px solid #00cc8866', color: '#00cc88' },
}

function btn(variant, extra = {}) {
  return {
    fontFamily: mono, fontSize: '0.53rem', letterSpacing: '1px', textTransform: 'uppercase',
    padding: '0.22rem 0.6rem', borderRadius: 2, cursor: 'pointer', fontWeight: 600,
    transition: 'all 0.15s', whiteSpace: 'nowrap',
    ...BTN[variant], ...extra,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EmailDraftEditor({
  draft = {},
  onSave,
  onQueue,
  onDirtyChange,
  defaultLang = 'de',
}) {
  const [activeLang,  setActiveLang]  = useState(defaultLang)
  const [editing,     setEditing]     = useState(false)
  const [editSubject, setEditSubject] = useState('')
  const [editBody,    setEditBody]    = useState('')
  const [saving,      setSaving]      = useState(false)
  const [copied,      setCopied]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [queued,      setQueued]      = useState(false)
  const [queueing,    setQueueing]    = useState(false)
  const [isDirty,     setIsDirty]     = useState(false)
  const [translating, setTranslating] = useState(false)
  // localDraft mirrors `draft` prop + any unsaved translated content
  const [localDraft,  setLocalDraft]  = useState(draft)

  // Sync localDraft when parent draft prop changes
  useEffect(() => { setLocalDraft(draft) }, [draft])

  const cur        = localDraft[activeLang] || EMPTY
  const hasContent = !!(cur.subject || cur.body)

  // Track unsaved changes
  useEffect(() => {
    if (!editing) { setIsDirty(false); return }
    const dirty = editSubject !== (cur.subject || '') || editBody !== (cur.body || '')
    setIsDirty(dirty)
  }, [editing, editSubject, editBody, cur.subject, cur.body])

  useEffect(() => { onDirtyChange?.(isDirty) }, [isDirty])

  // ── Lang switch with auto-translate ──────────────────────────────────────────

  async function switchLang(code) {
    if (code === activeLang) return

    if (editing && isDirty) {
      if (!window.confirm('Máte neuložené zmeny. Chcete ich zahodiť?')) return
      setEditing(false)
      setIsDirty(false)
    } else if (editing) {
      setEditing(false)
    }

    setActiveLang(code)
    setQueued(false)
    setSaved(false)

    // Auto-translate only if target language has no content yet
    const target = localDraft[code] || EMPTY
    if (target.subject || target.body) return   // already has content — do not overwrite

    // Find best source to translate from
    const srcLang  = activeLang
    const srcDraft = localDraft[srcLang] || EMPTY
    if (!srcDraft.subject && !srcDraft.body) return   // nothing to translate from

    setTranslating(true)
    try {
      const res = await fetch('/.netlify/functions/translate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: srcDraft.subject, text: srcDraft.body, targetLang: code }),
      })
      const data = await res.json()
      if (data.ok) {
        // Fill localDraft for target lang (not saved to Firebase yet — user must save)
        setLocalDraft(prev => ({
          ...prev,
          [code]: { subject: data.subject, body: data.body },
        }))
      }
    } catch (e) {
      console.error('[EmailDraftEditor] translate failed:', e.message)
    } finally {
      setTranslating(false)
    }
  }

  // ── Edit ─────────────────────────────────────────────────────────────────────

  function startEdit() {
    setEditSubject(cur.subject || '')
    setEditBody(cur.body || '')
    setEditing(true)
    setSaved(false)
    setQueued(false)
  }

  function cancelEdit() {
    if (isDirty && !window.confirm('Zahodiť neuložené zmeny?')) return
    setEditing(false)
    setIsDirty(false)
  }

  async function saveEdit() {
    setSaving(true)
    try {
      const subject = editSubject.trim()
      const body    = editBody.trim()
      await onSave(activeLang, subject, body)
      // Sync localDraft after save
      setLocalDraft(prev => ({ ...prev, [activeLang]: { subject, body } }))
      setEditing(false)
      setIsDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      console.error('[EmailDraftEditor] save failed:', e)
    } finally {
      setSaving(false)
    }
  }

  // ── Queue ────────────────────────────────────────────────────────────────────

  async function handleQueue() {
    if (!onQueue) return
    setQueueing(true)
    try {
      await onQueue(activeLang, cur.subject, cur.body)
      setQueued(true)
    } catch (e) {
      console.error('[EmailDraftEditor] queue failed:', e)
    } finally {
      setQueueing(false)
    }
  }

  // ── Copy ─────────────────────────────────────────────────────────────────────

  function copyDraft() {
    const text = cur.subject ? `Subject: ${cur.subject}\n\n${cur.body}` : cur.body
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    }).catch(() => {})
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={base.root}>

      {/* ── Header ── */}
      <div style={base.header}>
        <span style={base.headerLabel}>EMAIL DRAFT</span>

        {/* Flag language switcher — only flags, no text */}
        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
          {LANGS.map(code => (
            <button
              key={code}
              onClick={() => switchLang(code)}
              style={flagBtnStyle(activeLang === code, translating || (editing && isDirty && code !== activeLang))}
              title={code.toUpperCase()}
              disabled={translating}
            >
              {FLAGS[code]}
            </button>
          ))}
        </div>

        {/* Status indicators */}
        {translating && (
          <span style={{ fontSize: '0.5rem', color: '#ffaa00', letterSpacing: '0.5px' }}>
            ⏳
          </span>
        )}
        {!translating && isDirty && (
          <span style={{ fontSize: '0.5rem', color: '#ffaa00', letterSpacing: '0.5px' }}>
            • Upravené – neuložené
          </span>
        )}
        {!translating && saved && !editing && (
          <span style={{ fontSize: '0.5rem', color: '#00cc88', letterSpacing: '0.5px' }}>
            ✅ Uložené
          </span>
        )}
        {!translating && queued && !editing && (
          <span style={{ fontSize: '0.5rem', color: '#00cc88', letterSpacing: '0.5px' }}>
            ✅ Email pripravený na schválenie
          </span>
        )}

        <div style={base.spacer} />

        {/* Action buttons */}
        {!editing ? (
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {hasContent && !translating && (
              <button onClick={copyDraft} style={btn(copied ? 'copied' : 'copy')}>
                {copied ? '✓ OK' : '📋 Kopírovať'}
              </button>
            )}
            {hasContent && onQueue && !translating && (
              <button onClick={handleQueue} disabled={queueing}
                style={btn(queued ? 'queued' : 'queue', { opacity: queueing ? 0.65 : 1 })}>
                {queued ? '✓ Queue' : '📤 Na schválenie'}
              </button>
            )}
            {!translating && (
              <button onClick={startEdit} style={btn('edit')}>✏️ Upraviť</button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button onClick={cancelEdit} disabled={saving} style={btn('cancel')}>↩️ Zrušiť</button>
            <button onClick={saveEdit} disabled={saving}
              style={btn('save', { opacity: saving ? 0.65 : 1 })}>
              {saving ? '⏳' : '💾 Uložiť'}
            </button>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={base.body}>
        {/* Translation progress bar */}
        <ProgressBar running={translating} maxSecs={12} type="translate" />

        {translating ? null : !editing ? (
          hasContent ? (
            <>
              {cur.subject && (
                <div style={{ marginBottom: '0.6rem', paddingBottom: '0.55rem', borderBottom: '1px solid #1a1f2a' }}>
                  <div style={base.fieldLabel}>PREDMET</div>
                  <div style={{ fontSize: '0.72rem', color: '#e8eaed', fontWeight: 600, lineHeight: 1.4 }}>
                    {cur.subject}
                  </div>
                </div>
              )}
              <div style={base.fieldLabel}>TEXT</div>
              <pre style={{ fontSize: '0.62rem', color: '#9ca3af', whiteSpace: 'pre-wrap', lineHeight: 1.75, margin: 0 }}>
                {cur.body}
              </pre>
            </>
          ) : (
            <div style={{ fontSize: '0.62rem', color: '#374151', fontStyle: 'italic', textAlign: 'center', padding: '1.5rem 0' }}>
              Klikni ✏️ Upraviť alebo spusti AI Analýzu pre vygenerovanie draftu.
            </div>
          )
        ) : (
          <>
            <div style={{ marginBottom: '0.55rem' }}>
              <div style={base.fieldLabel}>PREDMET</div>
              <input
                style={{ ...base.inputBase, fontSize: '0.7rem', fontWeight: 600 }}
                value={editSubject}
                onChange={e => setEditSubject(e.target.value)}
                placeholder="Predmet emailu..."
                onFocus={e => (e.target.style.borderColor = '#ff5c0066')}
                onBlur={e  => (e.target.style.borderColor = '#2d3748')}
              />
            </div>
            <div>
              <div style={base.fieldLabel}>TEXT</div>
              <textarea
                style={{ ...base.inputBase, fontSize: '0.63rem', lineHeight: 1.75, resize: 'vertical', minHeight: 200 }}
                value={editBody}
                onChange={e => setEditBody(e.target.value)}
                placeholder="Text emailu..."
                onFocus={e => (e.target.style.borderColor = '#ff5c0066')}
                onBlur={e  => (e.target.style.borderColor = '#2d3748')}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
