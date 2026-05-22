import { useState } from 'react'

const mono = "'IBM Plex Mono',monospace"

const FLAGS = { de: '🇩🇪', sk: '🇸🇰', en: '🇬🇧' }
const LANGS  = ['de', 'sk', 'en']

const EMPTY = { subject: '', body: '' }

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  root: {
    background: '#0a0c10',
    border: '1px solid #1e2530',
    borderRadius: 4,
    overflow: 'hidden',
    fontFamily: mono,
  },
  header: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.5rem 0.85rem',
    borderBottom: '1px solid #1a1f2a',
    background: '#070a0e',
    flexWrap: 'wrap',
  },
  headerLabel: {
    fontSize: '0.44rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: '#374151', marginRight: '0.3rem', whiteSpace: 'nowrap',
  },
  flagBtn: (active, disabled) => ({
    fontSize: '1rem', lineHeight: 1,
    padding: '0.2rem 0.28rem',
    border: `1px solid ${active ? '#ff5c00' : '#1e2530'}`,
    background: active ? 'rgba(255,92,0,0.12)' : 'transparent',
    borderRadius: 3,
    cursor: disabled ? 'default' : 'pointer',
    boxShadow: active ? '0 0 10px rgba(255,92,0,0.35)' : 'none',
    transition: 'all 0.18s ease',
    opacity: disabled && !active ? 0.35 : 1,
  }),
  spacer: { flex: 1 },
  actionBtn: (variant) => {
    const V = {
      ghost:   { background: 'transparent', border: '1px solid #1e2530', color: '#6b7280' },
      edit:    { background: 'rgba(255,92,0,0.1)', border: '1px solid #ff5c0055', color: '#ff5c00' },
      save:    { background: '#ff5c00', border: '1px solid #ff5c00', color: '#fff' },
      cancel:  { background: 'transparent', border: '1px solid #374151', color: '#9ca3af' },
      copy:    { background: 'transparent', border: '1px solid #1e2530', color: '#6b7280' },
      copied:  { background: 'rgba(0,204,136,0.08)', border: '1px solid #00cc8866', color: '#00cc88' },
    }
    return {
      fontFamily: mono, fontSize: '0.54rem', letterSpacing: '1px', textTransform: 'uppercase',
      padding: '0.22rem 0.65rem', borderRadius: 2, cursor: 'pointer', fontWeight: 600,
      transition: 'all 0.15s', whiteSpace: 'nowrap',
      ...V[variant],
    }
  },
  body: { padding: '0.8rem 0.9rem' },
  fieldLabel: {
    fontSize: '0.43rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: '#374151', marginBottom: '0.2rem',
  },
  subjectText: {
    fontSize: '0.72rem', color: '#e8eaed', fontWeight: 600, lineHeight: 1.4,
    marginBottom: '0.6rem', paddingBottom: '0.55rem', borderBottom: '1px solid #1a1f2a',
  },
  bodyText: {
    fontSize: '0.62rem', color: '#9ca3af', whiteSpace: 'pre-wrap',
    lineHeight: 1.75, margin: 0,
  },
  inputBase: {
    width: '100%', fontFamily: mono, color: '#e8eaed',
    background: '#060810', border: '1px solid #2d3748', borderRadius: 2,
    padding: '0.42rem 0.6rem', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  },
  empty: {
    fontSize: '0.62rem', color: '#374151', fontStyle: 'italic',
    textAlign: 'center', padding: '1.5rem 0',
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EmailDraftEditor({ draft = {}, onSave, defaultLang = 'de' }) {
  const [activeLang, setActiveLang] = useState(defaultLang)
  const [editing,     setEditing]   = useState(false)
  const [editSubject, setEditSubject] = useState('')
  const [editBody,    setEditBody]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [copied,  setCopied]  = useState(false)

  const cur        = draft[activeLang] || EMPTY
  const hasContent = !!(cur.subject || cur.body)

  function switchLang(code) {
    if (editing) return          // lock during edit
    setActiveLang(code)
  }

  function startEdit() {
    setEditSubject(cur.subject || '')
    setEditBody(cur.body || '')
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
  }

  async function saveEdit() {
    setSaving(true)
    try {
      await onSave(activeLang, editSubject.trim(), editBody.trim())
      setEditing(false)
    } catch (e) {
      console.error('[EmailDraftEditor] save failed:', e)
    } finally {
      setSaving(false)
    }
  }

  function copyDraft() {
    const text = cur.subject
      ? `Subject: ${cur.subject}\n\n${cur.body}`
      : cur.body
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    }).catch(() => {})
  }

  return (
    <div style={s.root}>
      {/* ── Header ── */}
      <div style={s.header}>
        <span style={s.headerLabel}>EMAIL DRAFT</span>

        {/* Flag language switcher */}
        <div style={{ display: 'flex', gap: '0.2rem' }}>
          {LANGS.map(code => (
            <button
              key={code}
              onClick={() => switchLang(code)}
              style={s.flagBtn(activeLang === code, editing)}
              title={code.toUpperCase()}
            >
              {FLAGS[code]}
            </button>
          ))}
        </div>

        <div style={s.spacer} />

        {/* Action buttons */}
        {!editing ? (
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            {hasContent && (
              <button onClick={copyDraft} style={s.actionBtn(copied ? 'copied' : 'copy')}>
                {copied ? '✓ Skopírované' : '📋 Kopírovať'}
              </button>
            )}
            <button onClick={startEdit} style={s.actionBtn('edit')}>
              ✏️ Upraviť
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button onClick={cancelEdit} disabled={saving} style={s.actionBtn('cancel')}>
              ↩️ Zrušiť
            </button>
            <button onClick={saveEdit} disabled={saving} style={{ ...s.actionBtn('save'), opacity: saving ? 0.65 : 1 }}>
              {saving ? '⏳' : '💾 Uložiť'}
            </button>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={s.body}>
        {!editing ? (
          hasContent ? (
            <>
              {cur.subject && (
                <div style={s.subjectText}>
                  <div style={s.fieldLabel}>PREDMET</div>
                  <div>{cur.subject}</div>
                </div>
              )}
              <div style={s.fieldLabel}>TEXT</div>
              <pre style={s.bodyText}>{cur.body}</pre>
            </>
          ) : (
            <div style={s.empty}>
              Klikni ✏️ Upraviť alebo spusti AI Analýzu pre vygenerovanie draftu.
            </div>
          )
        ) : (
          <>
            {/* Subject input */}
            <div style={{ marginBottom: '0.55rem' }}>
              <div style={s.fieldLabel}>PREDMET</div>
              <input
                style={{ ...s.inputBase, fontSize: '0.7rem', fontWeight: 600 }}
                value={editSubject}
                onChange={e => setEditSubject(e.target.value)}
                placeholder="Predmet emailu..."
                onFocus={e => (e.target.style.borderColor = '#ff5c0066')}
                onBlur={e  => (e.target.style.borderColor = '#2d3748')}
              />
            </div>

            {/* Body textarea */}
            <div>
              <div style={s.fieldLabel}>TEXT</div>
              <textarea
                style={{
                  ...s.inputBase,
                  fontSize: '0.63rem',
                  lineHeight: 1.75,
                  resize: 'vertical',
                  minHeight: 200,
                }}
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
