import { useState, useEffect } from 'react'

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

function flagBtn(active, locked) {
  return {
    fontSize: '1rem', lineHeight: 1, padding: '0.2rem 0.28rem',
    border: `1px solid ${active ? '#ff5c00' : '#1e2530'}`,
    background: active ? 'rgba(255,92,0,0.12)' : 'transparent',
    borderRadius: 3, cursor: locked ? 'default' : 'pointer',
    boxShadow: active ? '0 0 10px rgba(255,92,0,0.35)' : 'none',
    transition: 'all 0.18s ease',
    opacity: locked && !active ? 0.35 : 1,
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
  onQueue,         // optional: queue for approval
  onDirtyChange,   // optional: notify parent of unsaved state
  defaultLang = 'de',
}) {
  const [activeLang,   setActiveLang]   = useState(defaultLang)
  const [editing,      setEditing]      = useState(false)
  const [editSubject,  setEditSubject]  = useState('')
  const [editBody,     setEditBody]     = useState('')
  const [saving,       setSaving]       = useState(false)
  const [copied,       setCopied]       = useState(false)
  const [saved,        setSaved]        = useState(false)   // ✅ After-save flash
  const [queued,       setQueued]       = useState(false)   // ✅ Queue confirmation
  const [queueing,     setQueueing]     = useState(false)
  const [isDirty,      setIsDirty]      = useState(false)   // • Unsaved indicator

  const cur        = draft[activeLang] || EMPTY
  const hasContent = !!(cur.subject || cur.body)

  // Track unsaved changes while editing
  useEffect(() => {
    if (!editing) { setIsDirty(false); return }
    const dirty = editSubject !== (cur.subject || '') || editBody !== (cur.body || '')
    setIsDirty(dirty)
  }, [editing, editSubject, editBody, cur.subject, cur.body])

  // Notify parent of dirty state
  useEffect(() => { onDirtyChange?.(isDirty) }, [isDirty])

  // ── Actions ──

  function switchLang(code) {
    if (code === activeLang) return
    if (editing && isDirty) {
      if (!window.confirm('Máte neuložené zmeny. Chcete ich zahodiť?')) return
    }
    setEditing(false)
    setIsDirty(false)
    setActiveLang(code)
    setQueued(false)
  }

  function startEdit() {
    setEditSubject(cur.subject || '')
    setEditBody(cur.body || '')
    setEditing(true)
    setSaved(false)
    setQueued(false)
  }

  function cancelEdit() {
    if (isDirty) {
      if (!window.confirm('Zahodiť neuložené zmeny?')) return
    }
    setEditing(false)
    setIsDirty(false)
  }

  async function saveEdit() {
    setSaving(true)
    try {
      await onSave(activeLang, editSubject.trim(), editBody.trim())
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

  function copyDraft() {
    const text = cur.subject ? `Subject: ${cur.subject}\n\n${cur.body}` : cur.body
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    }).catch(() => {})
  }

  // ── Render ──

  return (
    <div style={base.root}>

      {/* ── Header ── */}
      <div style={base.header}>
        <span style={base.headerLabel}>EMAIL DRAFT</span>

        {/* Flag switcher */}
        <div style={{ display: 'flex', gap: '0.18rem' }}>
          {LANGS.map(code => (
            <button key={code} onClick={() => switchLang(code)}
              style={flagBtn(activeLang === code, editing && isDirty && code !== activeLang)}
              title={code.toUpperCase()}>
              {FLAGS[code]}
            </button>
          ))}
        </div>

        {/* Unsaved indicator */}
        {isDirty && (
          <span style={{ fontSize: '0.5rem', color: '#ffaa00', letterSpacing: '0.5px' }}>
            • Upravené – neuložené
          </span>
        )}

        {/* Saved flash */}
        {saved && !editing && (
          <span style={{ fontSize: '0.5rem', color: '#00cc88', letterSpacing: '0.5px' }}>
            ✅ Uložené
          </span>
        )}

        {/* Queued badge */}
        {queued && !editing && (
          <span style={{ fontSize: '0.5rem', color: '#00cc88', letterSpacing: '0.5px' }}>
            ✅ Email pripravený na schválenie
          </span>
        )}

        <div style={base.spacer} />

        {/* Action buttons */}
        {!editing ? (
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {hasContent && (
              <button onClick={copyDraft} style={btn(copied ? 'copied' : 'copy')}>
                {copied ? '✓ OK' : '📋 Kopírovať'}
              </button>
            )}
            {hasContent && onQueue && (
              <button onClick={handleQueue} disabled={queueing}
                style={btn(queued ? 'queued' : 'queue', { opacity: queueing ? 0.65 : 1 })}>
                {queued ? '✓ Queue' : '📤 Na schválenie'}
              </button>
            )}
            <button onClick={startEdit} style={btn('edit')}>✏️ Upraviť</button>
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
        {!editing ? (
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
