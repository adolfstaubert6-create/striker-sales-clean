import { useState, useEffect } from 'react'
import { updateTarget, addContact, removeContact } from '../services/intelTargetService.js'
import { INTEL_STATUS_LIST } from '../constants/intelMeta.js'
import ProgressBar from './ProgressBar.jsx'
import EmailDraftEditor from './EmailDraftEditor.jsx'

const mono = "'IBM Plex Mono',monospace"
const sans = "'IBM Plex Sans',sans-serif"

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg: '#06080b', panel: '#0d1117', card: '#111418',
  border: '#1a1f2a', border2: '#21262d',
  orange: '#ff5c00', amber: '#ffaa00', green: '#00cc88',
  red: '#ef4444', purple: '#818cf8',
  text: '#e8eaed', sub: '#9ca3af', dim: '#6b7280', ghost: '#374151',
}

// ── Data badge ─────────────────────────────────────────────────────────────────
function Badge({ type = 'unknown', small }) {
  const M = {
    live:     { label: 'ŽIVÉ DÁTA',       color: C.green  },
    ai:       { label: 'AI ODHAD',        color: C.amber  },
    verified: { label: 'OVERENÝ ÚDAJ',   color: C.purple },
    unknown:  { label: 'NEOVERENÉ',       color: C.ghost  },
    personal: { label: 'OSOBNÝ',          color: C.green  },
    general:  { label: 'VŠEOBECNÝ',       color: C.amber  },
  }
  const m = M[type] || M.unknown
  return (
    <span style={{ fontFamily: mono, fontSize: small ? '0.36rem' : '0.39rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: m.color, padding: '0.03rem 0.3rem', border: `1px solid ${m.color}44`, borderRadius: 2, background: `${m.color}10`, whiteSpace: 'nowrap', flexShrink: 0 }}>
      {m.label}
    </span>
  )
}

// ── Section heading ────────────────────────────────────────────────────────────
function SH({ label, source, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.1rem' }}>
      <span style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#8a96a6', fontWeight: 600 }}>{label}</span>
      {source && <Badge type={source} />}
      {action && <span style={{ flex: 1 }} />}
      {action}
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KPI({ label, value, unit = '', source, color, note, max = 100 }) {
  const [hov, setHov] = useState(false)
  const has = value != null && value !== ''
  const num = typeof value === 'number'
  const col = color || (num ? (value >= 70 ? C.orange : value >= 45 ? C.amber : C.dim) : C.dim)
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? '#181e28' : '#13171e', border: `1px solid ${hov ? '#2d3444' : '#252b36'}`, borderRadius: 6, padding: '1.1rem 1.2rem', flex: 1, minWidth: 130, display: 'flex', flexDirection: 'column', gap: '0.35rem', transition: 'all 0.15s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontFamily: mono, fontSize: '0.42rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#7b8899', lineHeight: 1.4 }}>{label}</div>
        {source && <Badge type={source} small />}
      </div>
      {has ? (
        <>
          <div style={{ fontFamily: mono, fontSize: '1.75rem', fontWeight: 700, color: col, lineHeight: 1, textShadow: `0 0 20px ${col}44` }}>
            {value}{unit}
          </div>
          {num && (
            <div style={{ height: 4, background: '#1a2030', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: '100%', background: col, borderRadius: 2, transition: 'width 0.5s ease', boxShadow: `0 0 8px ${col}88` }} />
            </div>
          )}
          {note && <div style={{ fontFamily: mono, fontSize: '0.47rem', color: '#8a96a6', lineHeight: 1.4, marginTop: '0.1rem' }}>{note}</div>}
        </>
      ) : (
        <div style={{ fontFamily: mono, fontSize: '0.54rem', color: '#8a96a6', fontStyle: 'italic' }}>Dáta zatiaľ neoverené</div>
      )}
    </div>
  )
}

// ── Metric row ─────────────────────────────────────────────────────────────────
function MRow({ label, value, reason, source }) {
  if (value == null) return null
  const col = value >= 70 ? C.orange : value >= 45 ? C.amber : '#6b7a8d'
  return (
    <div style={{ marginBottom: '0.9rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.28rem' }}>
        <span style={{ fontFamily: mono, fontSize: '0.54rem', color: '#a0aab8' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {source && <Badge type={source} small />}
          <span style={{ fontFamily: mono, fontSize: '0.75rem', fontWeight: 700, color: col, textShadow: `0 0 10px ${col}55` }}>{value}</span>
        </div>
      </div>
      <div style={{ height: 5, background: '#1a2030', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: col, borderRadius: 2, boxShadow: `0 0 8px ${col}66` }} />
      </div>
      {reason && <div style={{ fontFamily: mono, fontSize: '0.48rem', color: '#5a6878', marginTop: '0.25rem', lineHeight: 1.5 }}>{reason}</div>}
    </div>
  )
}

// ── Contact card ───────────────────────────────────────────────────────────────
function ContactCard({ c, onRemove, onSave }) {
  const init  = (c.name || c.email || '?').charAt(0).toUpperCase()
  const cols  = [C.orange, C.purple, C.green, C.amber, '#60a5fa']
  const ac    = cols[(init.charCodeAt(0) || 0) % cols.length]
  const confC = { HIGH: C.green, MEDIUM: C.amber, LOW: C.dim }[c.confidence] || C.dim

  return (
    <div style={{ display: 'flex', gap: '0.7rem', padding: '0.8rem', background: C.card, border: `1px solid ${C.border2}`, borderRadius: 5, marginBottom: '0.45rem', alignItems: 'flex-start' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${ac}18`, border: `1.5px solid ${ac}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontFamily: sans, fontSize: '0.9rem', fontWeight: 700, color: ac }}>{init}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {c.name
          ? <div style={{ fontFamily: sans, fontSize: '0.82rem', fontWeight: 600, color: C.text, marginBottom: '0.06rem' }}>{c.name}</div>
          : <div style={{ fontFamily: mono, fontSize: '0.55rem', color: C.ghost, fontStyle: 'italic' }}>Meno neznáme</div>
        }
        {c.role && <div style={{ fontFamily: mono, fontSize: '0.45rem', letterSpacing: '1px', textTransform: 'uppercase', color: C.purple, marginBottom: '0.15rem' }}>{c.role}</div>}
        {c.email
          ? <a href={`mailto:${c.email}`} style={{ fontFamily: mono, fontSize: '0.55rem', color: C.green, display: 'block', marginBottom: '0.05rem' }}>✉ {c.email}</a>
          : <div style={{ fontFamily: mono, fontSize: '0.52rem', color: C.ghost, fontStyle: 'italic', marginBottom: '0.05rem' }}>Email nenájdený</div>
        }
        {c.phone && <div style={{ fontFamily: mono, fontSize: '0.52rem', color: C.dim }}>📞 {c.phone}</div>}
        <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
          {c.confidence && <Badge type={c.confidence.toLowerCase()} small />}
          {c.emailType === 'GENERAL' && <Badge type="general" small />}
          {c.emailType === 'PERSONAL' && <Badge type="personal" small />}
          {c.source && c.source !== 'manuálne zadanie' && (
            <a href={c.source.startsWith('http') ? c.source : '#'} target="_blank" rel="noreferrer"
              style={{ fontFamily: mono, fontSize: '0.42rem', color: C.ghost }}>🔗 zdroj</a>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flexShrink: 0 }}>
        {onSave && <button onClick={onSave} style={{ fontFamily: mono, fontSize: '0.46rem', padding: '0.1rem 0.42rem', border: `1px solid ${C.green}44`, background: `${C.green}10`, color: C.green, borderRadius: 2, cursor: 'pointer' }}>+ Uložiť</button>}
        {onRemove && <button onClick={onRemove} style={{ background: 'transparent', border: 'none', color: C.ghost, fontSize: '0.7rem', cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>}
      </div>
    </div>
  )
}

// ── Action button ──────────────────────────────────────────────────────────────
function Btn({ children, onClick, color = C.orange, disabled, small }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ fontFamily: mono, fontSize: small ? '0.51rem' : '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', padding: small ? '0.3rem 0.8rem' : '0.42rem 1rem', border: `1px solid ${color}${hov ? '99' : '66'}`, background: hov ? `${color}20` : `${color}12`, color, borderRadius: 3, cursor: 'pointer', opacity: disabled ? 0.5 : 1, transition: 'all 0.12s', whiteSpace: 'nowrap', fontWeight: 600, boxShadow: hov ? `0 0 12px ${color}22` : 'none' }}>
      {children}
    </button>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────
function Empty({ text = 'Dáta zatiaľ neoverené', action }) {
  return (
    <div style={{ padding: '2.5rem 1.5rem', background: '#0e1117', border: '1px solid #1e2a38', borderRadius: 6, textAlign: 'center' }}>
      <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#5a6878', fontStyle: 'italic', marginBottom: action ? '1.1rem' : 0, lineHeight: 1.6 }}>{text}</div>
      {action}
    </div>
  )
}

// ── Left nav ───────────────────────────────────────────────────────────────────
const NAV = [
  { key: 'overview',   label: 'Prehľad klienta',        icon: '○' },
  { key: 'profile',    label: 'Profil klienta',          icon: '◈' },
  { key: 'energy',     label: 'Energetický problém',     icon: '⚡' },
  { key: 'signals',    label: 'Živé signály',            icon: '◉' },
  { key: 'reviews',    label: 'Recenzie',                icon: '★' },
  { key: 'technology', label: 'Technológie',             icon: '⚙' },
  { key: 'finance',    label: 'Financie a návratnosť',   icon: '◇' },
  { key: 'decision',   label: 'Rozhodovatelia',          icon: '◎' },
  { key: 'contacts',   label: 'Kontakty',                icon: '◐' },
  { key: 'email',      label: 'Emaily',                  icon: '✉' },
  { key: 'followup',   label: 'Ďalší kontakt',           icon: '→' },
  { key: 'pipeline',   label: 'Stav obchodu',            icon: '▸' },
  { key: 'activity',   label: 'Aktivity',                icon: '◌' },
  { key: 'sources',    label: 'Zdroje a dôkazy',         icon: '◫' },
  { key: 'documents',  label: 'Dokumenty',               icon: '◻' },
]


// ── Premium branded card — shown when no real photo available ─────────────────
function BrandedCard({ t }) {
  const initial = (t.name || 'H').charAt(0).toUpperCase()
  return (
    <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, #050709 0%, ${C.orange}14 40%, ${C.orange}07 70%, #050709 100%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.85rem' }}>
      <div style={{ width: 76, height: 76, borderRadius: '50%', background: `radial-gradient(circle, ${C.orange}1a 0%, ${C.orange}06 100%)`, border: `1.5px solid ${C.orange}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontFamily: sans, fontSize: '2.1rem', fontWeight: 800, color: `${C.orange}88`, lineHeight: 1 }}>{initial}</span>
      </div>
      <div style={{ textAlign: 'center', padding: '0 1.2rem' }}>
        <div style={{ fontFamily: sans, fontSize: '0.92rem', fontWeight: 700, color: C.text, lineHeight: 1.25, marginBottom: '0.28rem' }}>{t.name}</div>
        <div style={{ fontFamily: mono, fontSize: '0.43rem', color: C.dim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
          {[t.city, t.country].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div style={{ fontFamily: mono, fontSize: '0.36rem', letterSpacing: '3px', textTransform: 'uppercase', color: `${C.orange}35` }}>STRIKER INTELLIGENCE</div>
    </div>
  )
}

// ── Hotel photo panel ─────────────────────────────────────────────────────────
function HotelPhoto({ photoUrl, loading, t }) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImg = photoUrl && !imgFailed

  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{ height: 220, position: 'relative', overflow: 'hidden', background: '#050709' }}>
        {loading && !showImg && (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, #050709 0%, ${C.orange}0a 100%)` }}>
            <div style={{ fontFamily: mono, fontSize: '0.45rem', letterSpacing: '3px', textTransform: 'uppercase', color: `${C.orange}55` }}>Načítavam foto...</div>
          </div>
        )}
        {showImg && (
          <img src={photoUrl} alt={t.name} onError={() => setImgFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {!showImg && !loading && <BrandedCard t={t} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 35%, #040609 100%)' }} />
      </div>
    </div>
  )
}

// ── Back navigation button — position:fixed, always visible top-left ──────────
function BackBtn({ onClose }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClose}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'fixed', top: 0, left: 0, zIndex: 400,
        width: 255,
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.65rem 1rem',
        background: hov ? '#0d1117' : '#06080b',
        borderBottom: `2px solid ${hov ? C.orange : C.border}`,
        color: hov ? C.orange : '#9ca3af',
        fontFamily: mono, fontSize: '0.54rem', letterSpacing: '1.5px',
        textTransform: 'uppercase', cursor: 'pointer',
        transition: 'all 0.15s',
        boxShadow: hov ? `0 2px 12px ${C.orange}22` : 'none',
      }}
    >
      ← Späť do Dashboardu
    </button>
  )
}

// ── Demo contacts ─────────────────────────────────────────────────────────────
const DEMO_CONTACTS = [
  { _id: 'd1', role: 'General Manager',       decisionPower: 'HIGH',   priority: 'PRIMARY',   status: 'NEEDS ENRICHMENT', aiScore: 85, source: 'demo' },
  { _id: 'd2', role: 'Facility Manager',      decisionPower: 'HIGH',   priority: 'PRIMARY',   status: 'NEEDS ENRICHMENT', aiScore: 78, source: 'demo' },
  { _id: 'd3', role: 'Technical Manager',     decisionPower: 'MEDIUM', priority: 'SECONDARY', status: 'NEEDS ENRICHMENT', aiScore: 62, source: 'demo' },
  { _id: 'd4', role: 'Procurement / Einkauf', decisionPower: 'MEDIUM', priority: 'SUPPORT',   status: 'NEEDS ENRICHMENT', aiScore: 55, source: 'demo' },
]

// ── Status config ─────────────────────────────────────────────────────────────
const CONTACT_STATUS = {
  'NEW':              { color: '#60a5fa', bg: '#60a5fa10' },
  'NEEDS ENRICHMENT': { color: C.amber,  bg: `${C.amber}10` },
  'READY TO CONTACT': { color: C.green,  bg: `${C.green}10` },
  'CONTACTED':        { color: C.orange, bg: `${C.orange}10` },
  'WAITING REPLY':    { color: C.purple, bg: `${C.purple}10` },
}

// ── Right panel contact card ───────────────────────────────────────────────────
function RightContactCard({ c, onSelect }) {
  const [hov, setHov]   = useState(false)
  const init            = (c.name || c.role || '?').charAt(0).toUpperCase()
  const AC              = [C.orange, C.purple, C.green, C.amber, '#60a5fa', '#f472b6']
  const ac              = AC[(init.charCodeAt(0) || 0) % AC.length]
  const isDemo          = c.source === 'demo'
  const status          = c.status || (c.email ? 'READY TO CONTACT' : 'NEEDS ENRICHMENT')
  const st              = CONTACT_STATUS[status] || CONTACT_STATUS['NEEDS ENRICHMENT']
  const priority        = c.priority || (c.decisionPower === 'HIGH' ? 'PRIMARY' : c.decisionPower === 'MEDIUM' ? 'SECONDARY' : 'SUPPORT')
  const priCol          = priority === 'PRIMARY' ? C.orange : priority === 'SECONDARY' ? C.amber : C.dim

  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={() => onSelect && onSelect(c)}
      style={{ background: hov ? '#181d26' : '#13171e', border: `1px solid ${hov ? '#2d3444' : '#1e2530'}`, borderLeft: `3px solid ${priCol}`, borderRadius: 6, padding: '0.9rem 0.9rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', transition: 'all 0.15s', cursor: 'pointer' }}
    >

      {/* Priority label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: mono, fontSize: '0.38rem', letterSpacing: '2px', textTransform: 'uppercase', color: priCol }}>
          {priority === 'PRIMARY' ? '▲ Primary Decision Maker' : priority === 'SECONDARY' ? '◆ Secondary Influencer' : '◇ Support Contact'}
        </span>
        {isDemo && <span style={{ fontFamily: mono, fontSize: '0.35rem', color: '#374151', padding: '0.03rem 0.22rem', border: '1px solid #1e2530', borderRadius: 2 }}>DEMO</span>}
      </div>

      {/* Avatar + name + role */}
      <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'flex-start' }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: `${ac}22`, border: `2px solid ${ac}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 12px ${ac}22` }}>
          <span style={{ fontFamily: sans, fontSize: '1.1rem', fontWeight: 700, color: ac }}>{init}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: sans, fontSize: '0.84rem', fontWeight: 700, color: c.name ? '#f4f6f9' : '#6b7280', lineHeight: 1.2, marginBottom: '0.12rem' }}>
            {c.name || <span style={{ fontWeight: 400, fontStyle: 'italic', fontSize: '0.72rem', color: '#4b5563' }}>Meno nenájdené</span>}
          </div>
          <div style={{ fontFamily: mono, fontSize: '0.47rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#818cf8' }}>{c.role || '—'}</div>
          {c.aiScore && (
            <div style={{ fontFamily: mono, fontSize: '0.4rem', color: C.orange, marginTop: '0.1rem' }}>AI relevancia: {c.aiScore}/100</div>
          )}
        </div>
      </div>

      {/* Status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontFamily: mono, fontSize: '0.39rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: st.color, padding: '0.12rem 0.4rem', border: `1px solid ${st.color}55`, borderRadius: 3, background: st.bg }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.color, display: 'inline-block', flexShrink: 0 }} />
          {status}
        </span>
      </div>

      {/* Contact info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.12rem' }}>
        {c.email
          ? <a href={`mailto:${c.email}`} style={{ fontFamily: mono, fontSize: '0.53rem', color: '#4ade80', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✉ {c.email}</a>
          : <span style={{ fontFamily: mono, fontSize: '0.5rem', color: '#374151', fontStyle: 'italic' }}>Email nenájdený — spusti obohacovanie</span>
        }
        {c.phone && <span style={{ fontFamily: mono, fontSize: '0.53rem', color: '#9ca3af' }}>📞 {c.phone}</span>}
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: '0.28rem', flexWrap: 'wrap', borderTop: '1px solid #1a1f2a', paddingTop: '0.55rem' }}>
        {c.email
          ? <a href={`mailto:${c.email}`} style={qaBtn('#4ade80', false)}>✉ Email</a>
          : <span style={qaBtn('#374151', true)}>✉ Email</span>
        }
        {c.phone
          ? <a href={`tel:${c.phone}`} style={qaBtn(C.amber, false)}>📞 Call</a>
          : <span style={qaBtn('#374151', true)}>📞 Call</span>
        }
        {c.linkedin
          ? <a href={c.linkedin} target="_blank" rel="noreferrer" style={qaBtn('#818cf8', false)}>🔗 LinkedIn</a>
          : <span style={qaBtn('#374151', true)}>🔗 LinkedIn</span>
        }
        <span style={qaBtn('#4b5563', false)}>📝 Notes</span>
      </div>
    </div>
  )
}

function qaBtn(col, disabled) {
  return {
    fontFamily: mono, fontSize: '0.44rem', letterSpacing: '0.5px', textTransform: 'uppercase',
    padding: '0.24rem 0.5rem', border: `1px solid ${col}${disabled ? '33' : '55'}`,
    background: disabled ? 'transparent' : `${col}12`,
    color: disabled ? col : col,
    opacity: disabled ? 0.45 : 1,
    borderRadius: 3, textDecoration: 'none', cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap',
  }
}

// ── AI Intelligence Analysis Overlay ─────────────────────────────────────────
const AI_SOURCES = [
  { key: 'web',       label: 'Web firmy',               icon: '🌐' },
  { key: 'impressum', label: 'Impressum / Legal',        icon: '📋' },
  { key: 'linkedin',  label: 'LinkedIn profil',          icon: '🔗' },
  { key: 'email',     label: 'Email lookup',             icon: '✉'  },
  { key: 'phone',     label: 'Telefón',                  icon: '📞' },
  { key: 'social',    label: 'Sociálne siete',           icon: '◈'  },
  { key: 'tech',      label: 'Technické oddelenie',      icon: '⚙'  },
  { key: 'decision',  label: 'Decision maker analýza',   icon: '◎'  },
]
const AI_NEXT = [
  { icon: '✉', label: 'Obohatiť email',                      col: '#4ade80' },
  { icon: '🔗', label: 'Nájsť LinkedIn',                     col: '#818cf8' },
  { icon: '⚡', label: 'Pripraviť technický outreach',       col: '#ffaa00' },
  { icon: '◎', label: 'Identifikovať ďalších decision makerov', col: '#ff5c00' },
]

function AIAnalysisOverlay({ contact: c, onClose }) {
  const [scanIdx,  setScanIdx]  = useState(0)
  const [done,     setDone]     = useState([])
  const [finished, setFinished] = useState(false)
  const [pulse,    setPulse]    = useState(true)

  // Pulse tick for scanning glow
  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 550)
    return () => clearInterval(id)
  }, [])

  // Sequential scanning chain
  useEffect(() => {
    if (finished || scanIdx >= AI_SOURCES.length) {
      if (scanIdx >= AI_SOURCES.length) setFinished(true)
      return
    }
    const delay = 480 + Math.random() * 620
    const id = setTimeout(() => {
      setDone(prev => [...prev, scanIdx])
      setScanIdx(prev => prev + 1)
    }, delay)
    return () => clearTimeout(id)
  }, [scanIdx, finished])

  // ESC closes overlay (not the modal below)
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const priority = c.priority || (c.decisionPower === 'HIGH' ? 'PRIMARY' : c.decisionPower === 'MEDIUM' ? 'SECONDARY' : 'SUPPORT')
  const priCol   = priority === 'PRIMARY' ? C.orange : priority === 'SECONDARY' ? C.amber : C.dim

  function srcState(i) {
    if (done.includes(i))               return 'done'
    if (i === scanIdx && !finished)     return 'scanning'
    return 'pending'
  }

  const aiText = c.decisionPower === 'HIGH'
    ? `Kontakt na pozícii „${c.role || 'rozhodovateľa'}" má vysokú pravdepodobnosť ovplyvňovať energetické a technické rozhodnutia. Odporúčame priamy outreach s dôrazom na ROI a úsporu prevádzkových nákladov.`
    : `Kontakt na pozícii „${c.role || 'influencera'}" pravdepodobne ovplyvňuje výberové konanie. Odporúčame zahrnúť do komunikačnej stratégie ako sekundárny kontakt s technickými argumentmi.`

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 700, padding: '1.25rem' }}>
      <div style={{ background: '#06090d', border: `1px solid ${C.orange}44`, borderRadius: 10, width: '100%', maxWidth: 560, maxHeight: '91vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: `0 0 80px ${C.orange}14, 0 0 0 1px ${C.orange}18, 0 28px 60px rgba(0,0,0,0.75)` }}>

        {/* Header */}
        <div style={{ padding: '1.15rem 1.5rem', borderBottom: `1px solid ${C.orange}28`, background: `linear-gradient(135deg, #08090e 0%, ${C.orange}0e 60%, #08090e 100%)`, position: 'sticky', top: 0, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: '0.38rem', letterSpacing: '3.5px', textTransform: 'uppercase', color: pulse ? C.orange : `${C.orange}88`, marginBottom: '0.18rem', transition: 'color 0.5s' }}>⬡ STRIKER AI ENGINE</div>
            <div style={{ fontFamily: sans, fontSize: '0.96rem', fontWeight: 700, color: '#f4f6f9', letterSpacing: '-0.01em' }}>AI Inteligentná analýza</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {!finished
              ? <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: pulse ? C.amber : `${C.amber}44`, display: 'inline-block', transition: 'background 0.4s', boxShadow: pulse ? `0 0 8px ${C.amber}` : 'none' }} />
                  <span style={{ fontFamily: mono, fontSize: '0.38rem', letterSpacing: '2px', textTransform: 'uppercase', color: C.amber }}>SCANUJE...</span>
                </div>
              : <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, display: 'inline-block', boxShadow: `0 0 8px ${C.green}` }} />
                  <span style={{ fontFamily: mono, fontSize: '0.38rem', letterSpacing: '2px', textTransform: 'uppercase', color: C.green }}>DOKONČENÉ</span>
                </div>
            }
            <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${C.orange}33`, color: '#6b7280', borderRadius: 3, padding: '0.22rem 0.6rem', fontFamily: mono, fontSize: '0.47rem', letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.15s' }}>
              ✕ Zavrieť
            </button>
          </div>
        </div>

        <div style={{ padding: '1.3rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* 01 — Analýza kontaktu */}
          <div>
            <div style={{ fontFamily: mono, fontSize: '0.39rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: `${C.orange}88`, marginBottom: '0.65rem', paddingBottom: '0.32rem', borderBottom: `1px solid ${C.orange}1a` }}>01 — Analýza kontaktu</div>
            <div style={{ background: '#0d1117', border: `1px solid ${C.border2}`, borderLeft: `3px solid ${priCol}`, borderRadius: 5, padding: '0.9rem 1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              {[
                ['Meno',           c.name         || '—'],
                ['Pozícia',        c.role         || '—'],
                ['Decision Power', c.decisionPower || '—'],
                ['AI Relevancia',  c.aiScore ? `${c.aiScore} / 100` : '—'],
                ['Confidence',     c.confidence   || '—'],
                ['Priorita',       priority],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontFamily: mono, fontSize: '0.36rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#374151', marginBottom: '0.14rem' }}>{label}</div>
                  <div style={{ fontFamily: mono, fontSize: '0.56rem', fontWeight: 600, color: '#ccd4e0' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 02 — Hľadanie údajov */}
          <div>
            <div style={{ fontFamily: mono, fontSize: '0.39rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: `${C.orange}88`, marginBottom: '0.65rem', paddingBottom: '0.32rem', borderBottom: `1px solid ${C.orange}1a` }}>02 — Hľadanie údajov</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.38rem' }}>
              {AI_SOURCES.map((src, i) => {
                const st  = srcState(i)
                const col = st === 'done' ? C.green : st === 'scanning' ? C.amber : '#2a3040'
                const bg  = st === 'done' ? `${C.green}09` : st === 'scanning' ? `${C.amber}0e` : '#0a0d12'
                return (
                  <div key={src.key} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.5rem 0.75rem', background: bg, border: `1px solid ${col}${st === 'pending' ? '' : '55'}`, borderRadius: 4, transition: 'all 0.35s', boxShadow: st === 'scanning' ? `0 0 14px ${C.amber}0d` : 'none' }}>
                    <span style={{ fontSize: '0.78rem', flexShrink: 0, opacity: st === 'pending' ? 0.22 : 1, transition: 'opacity 0.3s' }}>{src.icon}</span>
                    <span style={{ flex: 1, fontFamily: mono, fontSize: '0.52rem', color: st === 'pending' ? '#2a3040' : st === 'scanning' ? C.amber : '#9aa8bc', transition: 'color 0.35s' }}>{src.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {/* Progress bar */}
                      <div style={{ width: 56, height: 3, background: '#101520', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: st === 'done' ? '100%' : st === 'scanning' ? (pulse ? '80%' : '35%') : '0%', height: '100%', background: st === 'done' ? C.green : C.amber, borderRadius: 2, transition: st === 'scanning' ? 'width 0.5s ease' : 'width 0.2s', boxShadow: st !== 'pending' ? `0 0 6px ${col}77` : 'none' }} />
                      </div>
                      <span style={{ fontFamily: mono, fontSize: '0.36rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: col, minWidth: 68, textAlign: 'right', transition: 'color 0.35s' }}>
                        {st === 'done' ? '✓ Hotovo' : st === 'scanning' ? '⟳ Skenujem' : '○ Čaká'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 03 — AI odporúčanie */}
          <div>
            <div style={{ fontFamily: mono, fontSize: '0.39rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: `${C.orange}88`, marginBottom: '0.65rem', paddingBottom: '0.32rem', borderBottom: `1px solid ${C.orange}1a` }}>03 — AI odporúčanie</div>
            {finished ? (
              <div style={{ background: `${C.orange}0b`, border: `1px solid ${C.orange}33`, borderLeft: `3px solid ${C.orange}`, borderRadius: 5, padding: '1rem 1.2rem', boxShadow: `0 0 24px ${C.orange}0c` }}>
                <div style={{ fontFamily: mono, fontSize: '0.38rem', letterSpacing: '2px', textTransform: 'uppercase', color: C.orange, marginBottom: '0.42rem' }}>⬡ STRIKER AI VÝSTUP</div>
                <p style={{ fontFamily: sans, fontSize: '0.78rem', color: '#dde6f2', lineHeight: 1.78, margin: 0 }}>{aiText}</p>
              </div>
            ) : (
              <div style={{ background: '#0a0d12', border: '1px solid #1a2030', borderRadius: 5, padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontFamily: mono, fontSize: '0.7rem', color: pulse ? C.amber : `${C.amber}44`, transition: 'color 0.4s' }}>⟳</span>
                <span style={{ fontFamily: mono, fontSize: '0.5rem', color: '#374151', fontStyle: 'italic' }}>Analýza prebieha — čakám na dokončenie skenovania...</span>
              </div>
            )}
          </div>

          {/* 04 — Potenciálne ďalšie kroky */}
          <div>
            <div style={{ fontFamily: mono, fontSize: '0.39rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: `${C.orange}88`, marginBottom: '0.65rem', paddingBottom: '0.32rem', borderBottom: `1px solid ${C.orange}1a` }}>04 — Potenciálne ďalšie kroky</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
              {AI_NEXT.map(({ icon, label, col }) => (
                <button key={label} disabled={!finished}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.8rem', background: finished ? `${col}0b` : '#0a0d12', border: `1px solid ${finished ? col + '44' : '#1a2030'}`, borderRadius: 5, cursor: finished ? 'pointer' : 'default', textAlign: 'left', transition: 'all 0.3s', opacity: finished ? 1 : 0.35, boxShadow: finished ? `0 0 12px ${col}0c` : 'none' }}>
                  <span style={{ fontSize: '0.75rem', flexShrink: 0 }}>{icon}</span>
                  <span style={{ fontFamily: mono, fontSize: '0.46rem', color: finished ? col : '#374151', lineHeight: 1.35, transition: 'color 0.3s' }}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: `1px solid ${C.orange}1a`, paddingTop: '0.85rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.36rem 1rem', border: '1px solid #1e2530', background: 'transparent', color: '#6b7280', borderRadius: 3, cursor: 'pointer' }}>
              ✕ Zavrieť analýzu
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Contact detail modal helpers ─────────────────────────────────────────────
function CField({ label, value, element }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
      <span style={{ fontFamily: mono, fontSize: '0.44rem', color: '#8a96a6', textTransform: 'uppercase', letterSpacing: '1px', width: 72, flexShrink: 0, paddingTop: '0.06rem' }}>{label}</span>
      {value
        ? element || <span style={{ fontFamily: mono, fontSize: '0.58rem', color: '#c0c8d4' }}>{value}</span>
        : <span style={{ fontFamily: mono, fontSize: '0.52rem', color: '#374151', fontStyle: 'italic' }}>Dáta zatiaľ nenájdené</span>
      }
    </div>
  )
}
function CCard({ label, value }) {
  return (
    <div style={{ background: '#0b0e13', border: '1px solid #1a2030', borderRadius: 4, padding: '0.6rem 0.75rem' }}>
      <div style={{ fontFamily: mono, fontSize: '0.37rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#374151', marginBottom: '0.22rem' }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: '0.6rem', fontWeight: 600, color: value ? '#c8d0dc' : '#374151', fontStyle: value ? 'normal' : 'italic' }}>
        {value || 'Nenájdené'}
      </div>
    </div>
  )
}
function mdBtn(col) {
  return { fontFamily: mono, fontSize: '0.47rem', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '0.3rem 0.7rem', border: `1px solid ${col}55`, background: `${col}12`, color: col, borderRadius: 3, textDecoration: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }
}
function SectionLabel({ children }) {
  return (
    <div style={{ fontFamily: mono, fontSize: '0.41rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#8a96a6', marginBottom: '0.7rem', paddingBottom: '0.35rem', borderBottom: '1px solid #1a2030' }}>{children}</div>
  )
}

// ── Contact Detail Modal ───────────────────────────────────────────────────────
function ContactDetailModal({ contact: c, target: tgt, onClose }) {
  const [showAI, setShowAI] = useState(false)

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape' && !showAI) onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [showAI])

  const init    = (c.name || c.role || '?').charAt(0).toUpperCase()
  const AC      = [C.orange, C.purple, C.green, C.amber, '#60a5fa', '#f472b6']
  const ac      = AC[(init.charCodeAt(0) || 0) % AC.length]
  const status  = c.status || (c.email ? 'READY TO CONTACT' : 'NEEDS ENRICHMENT')
  const st      = CONTACT_STATUS[status] || CONTACT_STATUS['NEEDS ENRICHMENT']
  const priority = c.priority || (c.decisionPower === 'HIGH' ? 'PRIMARY' : c.decisionPower === 'MEDIUM' ? 'SECONDARY' : 'SUPPORT')
  const priCol  = priority === 'PRIMARY' ? C.orange : priority === 'SECONDARY' ? C.amber : C.dim
  const isDemo       = c.source === 'demo'
  const confPct      = { HIGH: 82, MEDIUM: 55, LOW: 28 }[c.confidence] || 0
  const confCol      = confPct >= 70 ? C.green : confPct >= 45 ? C.amber : C.dim
  const influence    = c.decisionPower === 'HIGH' ? 'Priamy vplyv' : c.decisionPower === 'MEDIUM' ? 'Nepriamy vplyv' : 'Minimálny vplyv'
  const missing      = [!c.name && 'Chýba meno', !c.email && 'Chýba email', !c.phone && 'Chýba telefón', !c.linkedin && 'Chýba LinkedIn'].filter(Boolean)
  const missingCount = [c.name, c.email, c.phone, c.mobile, c.linkedin, c.department].filter(v => !v).length
  const fbs          = { fontFamily: mono, fontSize: '0.37rem', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '0.1rem 0.48rem', border: '1px solid #2a3850', background: 'rgba(255,255,255,0.025)', color: '#9aaabb', borderRadius: 2, cursor: 'pointer', whiteSpace: 'nowrap' }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: '1.25rem' }}
    >
      <div style={{ background: '#0d1117', border: '1px solid #252b36', borderRadius: 8, width: '100%', maxWidth: 540, maxHeight: '88vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: `0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px ${ac}18` }}>

        {/* ── Modal header ── */}
        <div style={{ background: `linear-gradient(135deg, #0d1117 0%, ${ac}0d 100%)`, padding: '1.4rem 1.5rem 1.2rem', borderBottom: '1px solid #1e2530', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: `${ac}1e`, border: `2px solid ${ac}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 20px ${ac}28` }}>
                <span style={{ fontFamily: sans, fontSize: '1.55rem', fontWeight: 700, color: ac }}>{init}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: sans, fontSize: '1.05rem', fontWeight: 700, color: c.name ? '#f4f6f9' : '#4b5563', lineHeight: 1.25, marginBottom: '0.22rem' }}>
                  {c.name || <span style={{ fontSize: '0.88rem', fontStyle: 'italic' }}>Meno zatiaľ nenájdené</span>}
                </div>
                <div style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#818cf8', marginBottom: '0.38rem' }}>{c.role || '—'}</div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: mono, fontSize: '0.37rem', letterSpacing: '1px', textTransform: 'uppercase', color: priCol, padding: '0.06rem 0.3rem', border: `1px solid ${priCol}44`, borderRadius: 2, background: `${priCol}10` }}>
                    {priority === 'PRIMARY' ? '▲ Primary' : priority === 'SECONDARY' ? '◆ Secondary' : '◇ Support'}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.22rem', fontFamily: mono, fontSize: '0.37rem', letterSpacing: '1px', textTransform: 'uppercase', color: st.color, padding: '0.06rem 0.3rem', border: `1px solid ${st.color}55`, borderRadius: 2, background: st.bg }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: st.color, display: 'inline-block', flexShrink: 0 }} />
                    {status}
                  </span>
                  {isDemo && <span style={{ fontFamily: mono, fontSize: '0.35rem', color: '#374151', padding: '0.06rem 0.3rem', border: '1px solid #1e2530', borderRadius: 2 }}>DEMO</span>}
                </div>
              </div>
            </div>
            <button onClick={onClose}
              style={{ background: 'transparent', border: '1px solid #252b36', color: '#6b7280', borderRadius: 3, padding: '0.25rem 0.6rem', fontFamily: mono, fontSize: '0.5rem', letterSpacing: '1px', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}>
              ✕ Zavrieť
            </button>
          </div>
        </div>

        {/* ── Modal body ── */}
        <div style={{ padding: '1.3rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>

          {/* Missing data badges */}
          {missing.length > 0 && (
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {missing.map(m => (
                <span key={m} style={{ fontFamily: mono, fontSize: '0.38rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#f87171', padding: '0.12rem 0.48rem', border: '1px solid #ef444455', borderRadius: 2, background: '#ef44441e' }}>⚠ {m}</span>
              ))}
            </div>
          )}

          {/* A — Osobné údaje */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem', paddingBottom: '0.32rem', borderBottom: '1px solid #252f3e' }}>
              <span style={{ fontFamily: mono, fontSize: '0.44rem', color: C.orange, fontWeight: 700 }}>A</span>
              <span style={{ fontFamily: mono, fontSize: '0.41rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#8a96a6', fontWeight: 600 }}>Osobné údaje</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {[
                { label: 'Meno',      val: c.name,       col: '#e8eaed', fill: !c.name      && 'Doplniť meno' },
                { label: 'Pozícia',   val: c.role,       col: '#818cf8', fill: false },
                { label: 'Oddelenie', val: c.department, col: null,      fill: false },
                { label: 'Firma',     val: tgt?.name,    col: '#e8eaed', fill: false },
                { label: 'Lokalita',  val: tgt ? [tgt.city, tgt.country].filter(Boolean).join(', ') : null, col: null, fill: false },
              ].map(({ label, val, col, fill }) => (
                <div key={label} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span style={{ fontFamily: mono, fontSize: '0.39rem', color: '#9aaabb', textTransform: 'uppercase', letterSpacing: '1px', width: 76, flexShrink: 0 }}>{label}</span>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {val ? <span style={{ fontFamily: mono, fontSize: '0.56rem', color: col || '#b8c4d4' }}>{val}</span>
                         : <span style={{ fontFamily: mono, fontSize: '0.49rem', color: '#52626f', fontStyle: 'italic' }}>Dáta zatiaľ nenájdené</span>}
                    {fill && <span style={fbs}>+ {fill}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* B — Kontaktné údaje */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem', paddingBottom: '0.32rem', borderBottom: '1px solid #252f3e' }}>
              <span style={{ fontFamily: mono, fontSize: '0.44rem', color: C.orange, fontWeight: 700 }}>B</span>
              <span style={{ fontFamily: mono, fontSize: '0.41rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#8a96a6', fontWeight: 600 }}>Kontaktné údaje</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {/* Email */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span style={{ fontFamily: mono, fontSize: '0.39rem', color: '#9aaabb', textTransform: 'uppercase', letterSpacing: '1px', width: 76, flexShrink: 0 }}>Email</span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {c.email ? <a href={`mailto:${c.email}`} style={{ fontFamily: mono, fontSize: '0.56rem', color: '#4ade80', textDecoration: 'none' }}>✉ {c.email}</a>
                           : <><span style={{ fontFamily: mono, fontSize: '0.49rem', color: '#52626f', fontStyle: 'italic' }}>Dáta zatiaľ nenájdené</span><span style={fbs}>+ Doplniť email</span></>}
                </div>
              </div>
              {/* Telefón */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span style={{ fontFamily: mono, fontSize: '0.39rem', color: '#9aaabb', textTransform: 'uppercase', letterSpacing: '1px', width: 76, flexShrink: 0 }}>Telefón</span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {c.phone ? <a href={`tel:${c.phone}`} style={{ fontFamily: mono, fontSize: '0.56rem', color: C.amber, textDecoration: 'none' }}>📞 {c.phone}</a>
                           : <><span style={{ fontFamily: mono, fontSize: '0.49rem', color: '#52626f', fontStyle: 'italic' }}>Dáta zatiaľ nenájdené</span><span style={fbs}>+ Doplniť telefón</span></>}
                </div>
              </div>
              {/* Mobil */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span style={{ fontFamily: mono, fontSize: '0.39rem', color: '#9aaabb', textTransform: 'uppercase', letterSpacing: '1px', width: 76, flexShrink: 0 }}>Mobil</span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {c.mobile ? <a href={`tel:${c.mobile}`} style={{ fontFamily: mono, fontSize: '0.56rem', color: C.amber, textDecoration: 'none' }}>📱 {c.mobile}</a>
                            : <><span style={{ fontFamily: mono, fontSize: '0.49rem', color: '#52626f', fontStyle: 'italic' }}>Dáta zatiaľ nenájdené</span><span style={fbs}>+ Doplniť mobil</span></>}
                </div>
              </div>
              {/* LinkedIn */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span style={{ fontFamily: mono, fontSize: '0.39rem', color: '#9aaabb', textTransform: 'uppercase', letterSpacing: '1px', width: 76, flexShrink: 0 }}>LinkedIn</span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {c.linkedin ? <a href={c.linkedin} target="_blank" rel="noreferrer" style={{ fontFamily: mono, fontSize: '0.56rem', color: '#818cf8', textDecoration: 'none' }}>🔗 Otvoriť profil</a>
                              : <><span style={{ fontFamily: mono, fontSize: '0.49rem', color: '#52626f', fontStyle: 'italic' }}>Dáta zatiaľ nenájdené</span><span style={fbs}>+ Doplniť LinkedIn</span></>}
                </div>
              </div>
              {/* Zdroj */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span style={{ fontFamily: mono, fontSize: '0.39rem', color: '#9aaabb', textTransform: 'uppercase', letterSpacing: '1px', width: 76, flexShrink: 0 }}>Zdroj</span>
                <span style={{ fontFamily: mono, fontSize: '0.56rem', color: '#9aaabb' }}>{c.source === 'demo' ? 'Demo dáta' : c.source || '—'}</span>
              </div>
            </div>
          </div>

          {/* C — Obchodná rola */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem', paddingBottom: '0.32rem', borderBottom: '1px solid #252f3e' }}>
              <span style={{ fontFamily: mono, fontSize: '0.44rem', color: C.orange, fontWeight: 700 }}>C</span>
              <span style={{ fontFamily: mono, fontSize: '0.41rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#8a96a6', fontWeight: 600 }}>Obchodná rola</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.48rem' }}>
              {[
                ['Decision Power', c.decisionPower || '—'],
                ['Priorita',       priority],
                ['Vplyv',          influence],
                ['Status',         status],
              ].map(([label, value]) => (
                <div key={label} style={{ background: '#0b0e13', border: '1px solid #1a2030', borderRadius: 4, padding: '0.58rem 0.75rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.36rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6b7a8d', marginBottom: '0.16rem' }}>{label}</div>
                  <div style={{ fontFamily: mono, fontSize: '0.57rem', fontWeight: 600, color: '#d8e0ec' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* D — Dátová kvalita */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem', paddingBottom: '0.32rem', borderBottom: '1px solid #252f3e' }}>
              <span style={{ fontFamily: mono, fontSize: '0.44rem', color: C.orange, fontWeight: 700 }}>D</span>
              <span style={{ fontFamily: mono, fontSize: '0.41rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#8a96a6', fontWeight: 600 }}>Dátová kvalita</span>
            </div>
            <div style={{ background: '#0b0e13', border: '1px solid #1a2030', borderRadius: 5, padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: mono, fontSize: '0.39rem', color: '#9aaabb', textTransform: 'uppercase', letterSpacing: '1px' }}>Zdroj dát</span>
                <span style={{ fontFamily: mono, fontSize: '0.52rem', color: '#9aaabb' }}>{c.source === 'demo' ? 'Demo dáta' : c.source || '—'}</span>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.28rem' }}>
                  <span style={{ fontFamily: mono, fontSize: '0.39rem', color: '#9aaabb', textTransform: 'uppercase', letterSpacing: '1px' }}>Spoľahlivosť</span>
                  <span style={{ fontFamily: mono, fontSize: '0.52rem', color: confCol, fontWeight: 600 }}>{c.confidence || '—'}{confPct ? ` · ${confPct}%` : ''}</span>
                </div>
                <div style={{ height: 4, background: '#101520', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${confPct}%`, height: '100%', background: confCol, borderRadius: 2, boxShadow: confPct ? `0 0 8px ${confCol}66` : 'none', transition: 'width 0.5s ease' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: mono, fontSize: '0.39rem', color: '#9aaabb', textTransform: 'uppercase', letterSpacing: '1px' }}>Posledné overenie</span>
                <span style={{ fontFamily: mono, fontSize: '0.52rem', color: c.lastVerified ? '#7a8898' : '#2a3344', fontStyle: c.lastVerified ? 'normal' : 'italic' }}>{c.lastVerified || 'Neoverené'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: mono, fontSize: '0.39rem', color: '#9aaabb', textTransform: 'uppercase', letterSpacing: '1px' }}>Chýbajúce dáta</span>
                <span style={{ fontFamily: mono, fontSize: '0.52rem', color: missingCount > 3 ? '#ef4444' : missingCount > 1 ? C.amber : C.green, fontWeight: 600 }}>{missingCount} polí chýba</span>
              </div>
            </div>
          </div>

          {/* Interná poznámka */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem', paddingBottom: '0.32rem', borderBottom: '1px solid #252f3e' }}>
              <span style={{ fontFamily: mono, fontSize: '0.41rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#8a96a6', fontWeight: 600 }}>Interná poznámka ku kontaktu</span>
            </div>
            {c.notes
              ? <p style={{ fontFamily: sans, fontSize: '0.75rem', color: '#c8d2de', lineHeight: 1.75, margin: 0, background: '#0b0e13', border: '1px solid #1a2030', borderRadius: 4, padding: '0.85rem 1rem' }}>{c.notes}</p>
              : <div style={{ background: '#0b0e13', border: '1px dashed #1e2a38', borderRadius: 4, padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: mono, fontSize: '0.49rem', color: '#52626f', fontStyle: 'italic' }}>Dáta zatiaľ nenájdené</span>
                  <span style={fbs}>+ Pridať poznámku</span>
                </div>
            }
          </div>

          {/* AI Intelligence button */}
          <button onClick={() => setShowAI(true)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.65rem', padding: '0.75rem 1rem', background: `linear-gradient(135deg, ${C.orange}18 0%, ${C.amber}0e 100%)`, border: `1px solid ${C.orange}66`, borderRadius: 6, cursor: 'pointer', transition: 'all 0.18s', boxShadow: `0 0 20px ${C.orange}18, inset 0 0 20px ${C.orange}06` }}>
            <span style={{ fontSize: '1rem' }}>⬡</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '2px', textTransform: 'uppercase', color: C.orange, fontWeight: 700, lineHeight: 1.2 }}>AI Inteligentná analýza</div>
              <div style={{ fontFamily: mono, fontSize: '0.38rem', color: `${C.amber}99`, marginTop: '0.08rem', letterSpacing: '0.5px' }}>Spustiť STRIKER AI enrichment engine</div>
            </div>
            <span style={{ marginLeft: 'auto', fontFamily: mono, fontSize: '0.38rem', color: C.orange, letterSpacing: '1.5px' }}>▶</span>
          </button>

          {/* Quick actions */}
          <div style={{ borderTop: '1px solid #1e2530', paddingTop: '1rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {c.email    ? <a href={`mailto:${c.email}`} style={mdBtn('#4ade80')}>✉ Poslať email</a>                     : <span style={{ ...mdBtn('#374151'), opacity: 0.4, cursor: 'default' }}>✉ Email</span>}
            {c.phone    ? <a href={`tel:${c.phone}`}   style={mdBtn(C.amber)}>📞 Zavolať</a>                            : <span style={{ ...mdBtn('#374151'), opacity: 0.4, cursor: 'default' }}>📞 Call</span>}
            {c.linkedin ? <a href={c.linkedin} target="_blank" rel="noreferrer" style={mdBtn('#818cf8')}>🔗 LinkedIn</a> : <span style={{ ...mdBtn('#374151'), opacity: 0.4, cursor: 'default' }}>🔗 LinkedIn</span>}
            <span style={mdBtn('#5a6878')}>📝 Poznámka</span>
            <span style={mdBtn('#374151')}>✏ Upraviť kontakt</span>
          </div>
        </div>
      </div>

      {showAI && <AIAnalysisOverlay contact={c} onClose={() => setShowAI(false)} />}
    </div>
  )
}

// ── Panel zoom button ──────────────────────────────────────────────────────────
function ZoomBtn({ panel, zoomed, setZoomed }) {
  const on = zoomed === panel
  return (
    <button
      onClick={() => setZoomed(on ? null : panel)}
      title={on ? 'ESC — zatvoriť' : 'Rozbaliť panel'}
      style={{
        background: on ? `${C.orange}1a` : 'rgba(7,9,13,0.85)',
        border: `1px solid ${on ? C.orange + '66' : '#1e2530'}`,
        color: on ? C.orange : '#4b5563',
        borderRadius: 3, cursor: 'pointer', lineHeight: 1,
        padding: '0.22rem 0.45rem', fontFamily: mono, fontSize: '0.75rem',
        transition: 'all 0.15s', flexShrink: 0,
        boxShadow: on ? `0 0 10px ${C.orange}22` : 'none',
      }}
    >{on ? '⊠' : '⛶'}</button>
  )
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
export default function ClientIntelligenceDashboard({ target: initialT, onClose }) {
  const [t]              = useState(initialT)
  const [nav, setNav]    = useState('overview')
  const [analysis,  setAnalysis]  = useState(null)
  const [gLoad,     setGLoad]     = useState(false)
  const [sLoad,     setSLoad]     = useState(false)
  const [sMsg,      setSMsg]      = useState('')
  const [cLoad,     setCLoad]     = useState(false)
  const [cMsg,      setCMsg]      = useState('')
  const [found,     setFound]     = useState(null)
  const [draft,     setDraft]     = useState(
    t.emailDraft || { sk: { subject: '', body: '' }, de: { subject: '', body: '' }, en: { subject: '', body: '' } }
  )
  const [photoUrl,  setPhotoUrl]  = useState(t.photoUrl || null)
  const [photoLoad, setPhotoLoad] = useState(!t.photoUrl)
  const [zoomed,    setZoomed]    = useState(null) // null | 'left' | 'center' | 'right'
  const [selectedContact, setSelectedContact] = useState(null)

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape' && zoomed) setZoomed(null) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [zoomed])

  const TZ = 'all 0.28s cubic-bezier(0.4,0,0.2,1)'
  const lStyle = zoomed === 'left'   ? { flex: '1 1 0', minWidth: 0,  transition: TZ }
               : zoomed              ? { width: 0, minWidth: 0, overflow: 'hidden', opacity: 0, flexShrink: 0, transition: TZ }
               :                      { width: 255, flexShrink: 0, transition: TZ }
  const cStyle = zoomed === 'center' ? { flex: '1 1 0', minWidth: 0,  transition: TZ }
               : zoomed              ? { width: 0, minWidth: 0, overflow: 'hidden', opacity: 0, flexShrink: 0, flex: 'none', transition: TZ }
               :                      { flex: 1, minWidth: 0, transition: TZ }
  const rStyle = zoomed === 'right'  ? { flex: '1 1 0', minWidth: 0,  transition: TZ }
               : zoomed              ? { width: 0, minWidth: 0, overflow: 'hidden', opacity: 0, flexShrink: 0, transition: TZ }
               :                      { width: 265, flexShrink: 0, transition: TZ }

  useEffect(() => {
    if (t.photoUrl) return
    let cancelled = false
    async function fetchPhoto() {
      try {
        const r = await fetch('/.netlify/functions/hotel-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: t.name, city: t.city, country: t.country || 'DE' }),
        })
        const d = await r.json()
        if (cancelled) return
        if (d.ok && d.photoUrl) {
          setPhotoUrl(d.photoUrl)
          updateTarget(t.id, { photoUrl: d.photoUrl, placeId: d.placeId }).catch(() => {})
        }
      } catch {}
      finally { if (!cancelled) setPhotoLoad(false) }
    }
    fetchPhoto()
    return () => { cancelled = true }
  }, [])

  const fit    = t.strikerFitScore || t.overallScore || 0
  const fitCol = fit >= 80 ? C.orange : fit >= 60 ? C.amber : C.dim
  const live   = t.reviewsSource === 'serpapi'
  const hasE   = t.heatPressure != null

  // ── Handlers ──────────────────────────────────────────────────────────────────

  async function doAnalysis() {
    setGLoad(true)
    try {
      const r = await fetch('/.netlify/functions/ai-analysis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyName: t.name, city: t.city, segment: t.segment, segmentLabel: t.segmentLabel, fitScore: t.strikerFitScore || 50, language: 'sk' }) })
      const d = await r.json()
      if (d.ok) { setAnalysis(d); if (d.subject || d.draft) setDraft(p => ({ ...p, sk: { subject: d.subject || '', body: d.draft || '' } })) }
    } catch {} finally { setGLoad(false) }
  }

  async function doSignals() {
    setSLoad(true); setSMsg('')
    try {
      const r = await fetch('/.netlify/functions/serpapi-reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyName: t.name, url: t.web, segment: t.segment, segmentLabel: t.segmentLabel, city: t.city, country: t.country || 'DE', strikerFitScore: t.strikerFitScore || 50, painPoints: analysis?.painPoints || [], aiReasoning: analysis?.reasoning || '' }) })
      const d = await r.json()
      if (d.ok) { await updateTarget(t.id, { heatPressure: d.heatPressure, heatPressureReason: d.heatPressureReason, thermalDependency: d.thermalDependency, thermalDependencyReason: d.thermalDependencyReason, operatingCostPressure: d.operatingCostPressure, operatingCostPressureReason: d.operatingCostPressureReason, modernizationNeed: d.modernizationNeed, modernizationNeedReason: d.modernizationNeedReason, boilerDependencyProb: d.boilerDependencyProb, boilerDependencyProbReason: d.boilerDependencyProbReason, willingnessToSolve: d.willingnessToSolve, willingnessToSolveReason: d.willingnessToSolveReason, reviewsSource: d.reviewsSource, reviewsCachedAt: d.reviewsCachedAt, reviewRating: d.reviewRating, reviewCount: d.reviewCount, reviewSummary: d.reviewSummary, liveSignals: d.liveSignals || [] }); setSMsg(d.reviewsSource === 'serpapi' ? `✅ ${d.reviewCount || 0} Google recenzií · ${(d.liveSignals || []).length} signálov` : '✅ AI signálová analýza') }
    } catch (e) { setSMsg('⚠ ' + e.message) } finally { setSLoad(false) }
  }

  async function doContacts() {
    setCLoad(true); setCMsg('')
    try {
      const r = await fetch('/.netlify/functions/find-contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyName: t.name, website: t.web, city: t.city, country: t.country || 'DE' }) })
      const d = await r.json()
      if (d.ok) { setFound(d.contacts || []); if (d.generalEmail && !t.email) await updateTarget(t.id, { email: d.generalEmail }); setCMsg(d.contacts?.length ? `✅ ${d.contacts.length} overených kontaktov` : 'Nenašla sa overená kontaktná osoba.') }
    } catch (e) { setCMsg('⚠ ' + e.message) } finally { setCLoad(false) }
  }

  async function saveDraft(lang, subject, body) {
    const u = { ...draft, [lang]: { subject, body } }
    setDraft(u); await updateTarget(t.id, { emailDraft: u })
  }

  // ── Center sections ───────────────────────────────────────────────────────────

  function Center() {
    const problem  = t.clientCard?.clientProfile || analysis?.reasoning
    const nextStep = t.clientCard?.salesStrategy?.nextStep || analysis?.opportunity
    const mainCt   = (t.contacts || [])[0]

    // PREHĽAD KLIENTA
    if (nav === 'overview') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

        {/* Problem */}
        <div style={{ background: '#13171e', border: '1px solid #252b36', borderLeft: `3px solid ${C.orange}`, borderRadius: 5, padding: '1.3rem 1.45rem', boxShadow: `0 0 24px ${C.orange}08` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem' }}>
            <span style={{ fontFamily: mono, fontSize: '0.45rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: C.orange, fontWeight: 700 }}>Hlavný problém klienta</span>
            <Badge type={live ? 'live' : problem ? 'ai' : 'unknown'} />
          </div>
          {problem
            ? <p style={{ fontFamily: sans, fontSize: '0.82rem', color: '#e8eef6', lineHeight: 1.75, margin: 0 }}>{problem.split('\n\n')[0].slice(0, 220)}</p>
            : <Empty text="Spusti AI Analýzu pre zistenie problému klienta." action={<Btn onClick={() => { doAnalysis(); setNav('profile') }} small>🧠 Spustiť AI Analýzu</Btn>} />
          }
        </div>

        {/* 5 KPI cards */}
        <div>
          <SH label="Kľúčové metriky" />
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <KPI label="Zhoda klienta"          value={fit || null}                   source={fit ? 'verified' : 'unknown'}            color={fitCol} max={100} />
            <KPI label="Teplotný tlak"          value={t.heatPressure ?? null}        source={hasE ? (live ? 'live' : 'ai') : 'unknown'}                       />
            <KPI label="Potreba modernizácie"   value={t.modernizationNeed ?? null}   source={hasE ? 'ai' : 'unknown'}                                          />
            <KPI label="Signály z recenzií"     value={live ? (t.liveSignals || []).length : null}  unit=" sig."  source={live ? 'live' : 'unknown'} color={C.green} max={20} note={live && t.reviewRating ? `★ ${t.reviewRating} (${t.reviewCount || 0})` : null} />
            <KPI label="Potenciál úspory"       value={t.estimatedROI ? null : null}  source="unknown"            note="Spusti AI Analýzu" />
          </div>
        </div>

        {/* Next step */}
        {nextStep && (
          <div style={{ background: `${C.green}0e`, border: `1px solid ${C.green}33`, borderLeft: `3px solid ${C.green}`, borderRadius: 5, padding: '1.1rem 1.3rem', boxShadow: `0 0 20px ${C.green}08` }}>
            <span style={{ fontFamily: mono, fontSize: '0.45rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#4ade80', display: 'block', marginBottom: '0.55rem', fontWeight: 700 }}>Odporúčaný ďalší krok</span>
            <div style={{ fontFamily: sans, fontSize: '0.84rem', color: '#e8eef6', marginBottom: '0.7rem', lineHeight: 1.6 }}>{nextStep}</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Btn onClick={() => setNav('email')} color={C.green} small>✉ Otvoriť emaily</Btn>
              {mainCt?.email && <a href={`mailto:${mainCt.email}`} style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.3rem 0.75rem', border: '1px solid #252b36', background: 'transparent', color: '#8a96a6', borderRadius: 3, textDecoration: 'none' }}>{mainCt.name || mainCt.email}</a>}
            </div>
          </div>
        )}

        {/* Pain points */}
        {analysis?.painPoints?.length > 0 && (
          <div>
            <SH label="Kľúčové problémy" source="ai" />
            {analysis.painPoints.slice(0, 3).map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.65rem', padding: '0.7rem 0.9rem', background: '#13171e', border: '1px solid #1e2a38', borderLeft: `2px solid ${C.red}66`, borderRadius: 4, marginBottom: '0.4rem' }}>
                <span style={{ color: C.red, flexShrink: 0, fontSize: '0.72rem', marginTop: '0.05rem' }}>▸</span>
                <span style={{ fontFamily: sans, fontSize: '0.76rem', color: '#b0bac8', lineHeight: 1.6 }}>{p}</span>
              </div>
            ))}
          </div>
        )}

        {/* Live signals preview */}
        {(t.liveSignals || []).length > 0 && (
          <div>
            <SH label="Posledné živé signály" source="live" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {(t.liveSignals || []).slice(0, 8).map((s, i) => (
                <span key={i} style={{ fontFamily: mono, fontSize: '0.51rem', padding: '0.12rem 0.45rem', border: `1px solid ${C.amber}55`, borderRadius: 3, color: '#fbbf24', background: `${C.amber}18` }}>{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    )

    // PROFIL KLIENTA
    if (nav === 'profile') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <Btn onClick={doAnalysis} disabled={gLoad}>{gLoad ? '⏳ Analyzujem...' : '🧠 Generovať AI profil'}</Btn>
          <ProgressBar running={gLoad} maxSecs={15} type="ai" />
        </div>
        {problem ? (
          <div style={{ background: '#13171e', border: '1px solid #252b36', borderLeft: `3px solid ${C.orange}`, borderRadius: 5, padding: '1.3rem 1.5rem' }}>
            <Badge type={analysis?.reasoning ? 'ai' : 'ai'} />
            <div style={{ marginTop: '0.8rem' }}>
              {(t.clientCard?.clientProfile || analysis?.reasoning || '').split('\n\n').slice(0, 4).map((p, i) => (
                <p key={i} style={{ fontFamily: sans, fontSize: '0.77rem', color: i === 0 ? '#e8eef6' : '#a0aab8', lineHeight: 1.8, margin: 0, marginBottom: i < 3 ? '0.9rem' : 0 }}>{p}</p>
              ))}
            </div>
          </div>
        ) : <Empty text="Dáta zatiaľ neoverené — spusti AI profil." />}

        {t.clientCard?.salesStrategy && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
            {t.clientCard.salesStrategy.emphasize?.length > 0 && (
              <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 4, padding: '0.9rem 1rem' }}>
                <SH label="Zdôrazniť" />
                {t.clientCard.salesStrategy.emphasize.map((e, i) => <div key={i} style={{ fontFamily: mono, fontSize: '0.56rem', color: C.green, marginBottom: '0.22rem' }}>✓ {e}</div>)}
              </div>
            )}
            {t.clientCard.risks?.length > 0 && (
              <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 4, padding: '0.9rem 1rem' }}>
                <SH label="Riziká" />
                {t.clientCard.risks.map((r, i) => <div key={i} style={{ fontFamily: mono, fontSize: '0.56rem', color: C.dim, marginBottom: '0.22rem' }}>⚠ {r}</div>)}
              </div>
            )}
          </div>
        )}
      </div>
    )

    // ENERGETICKÝ PROBLÉM
    if (nav === 'energy') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn onClick={doSignals} disabled={sLoad} color={C.orange}>{sLoad ? '⏳ Analyzujem...' : '⚡ Signal Engine'}</Btn>
          {sMsg && <span style={{ fontFamily: mono, fontSize: '0.55rem', color: sMsg.startsWith('✅') ? C.green : C.amber }}>{sMsg}</span>}
        </div>
        <ProgressBar running={sLoad} maxSecs={12} type="signal" />
        {hasE ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {[
              { label: 'Teplotný tlak',        v: t.heatPressure,          r: t.heatPressureReason },
              { label: 'Závislosť od tepla',   v: t.thermalDependency,     r: t.thermalDependencyReason },
              { label: 'Prevádzkové náklady',  v: t.operatingCostPressure, r: t.operatingCostPressureReason },
              { label: 'Potreba modernizácie', v: t.modernizationNeed,     r: t.modernizationNeedReason },
              { label: 'Závislosť od kotlov',  v: t.boilerDependencyProb,  r: t.boilerDependencyProbReason },
              { label: 'Ochota riešiť',        v: t.willingnessToSolve,    r: t.willingnessToSolveReason },
            ].map(({ label, v, r }) => (
              <div key={label} style={{ background: '#13171e', border: '1px solid #252b36', borderRadius: 4, padding: '0.9rem 1rem' }}>
                <MRow label={label} value={v} reason={r} source={live ? 'live' : 'ai'} />
              </div>
            ))}
          </div>
        ) : <Empty text="Dáta zatiaľ neoverené — spusti Signal Engine." action={<Btn onClick={doSignals} color={C.orange} small>⚡ Signal Engine</Btn>} />}
      </div>
    )

    // ŽIVÉ SIGNÁLY
    if (nav === 'signals') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn onClick={doSignals} disabled={sLoad} color={C.orange}>{sLoad ? '⏳' : '⚡ Načítať signály'}</Btn>
          {sMsg && <span style={{ fontFamily: mono, fontSize: '0.55rem', color: sMsg.startsWith('✅') ? C.green : C.amber }}>{sMsg}</span>}
        </div>
        <ProgressBar running={sLoad} maxSecs={12} type="signal" />
        {live && t.reviewSummary
          ? (
            <div style={{ background: C.card, border: `1px solid ${C.green}33`, borderLeft: `3px solid ${C.green}`, borderRadius: 5, padding: '1.1rem 1.3rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.6rem' }}>
                <Badge type="live" />
                {t.reviewRating && <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.amber }}>★ {t.reviewRating} ({t.reviewCount || 0})</span>}
              </div>
              <p style={{ fontFamily: sans, fontSize: '0.75rem', color: C.sub, lineHeight: 1.7, margin: 0 }}>{t.reviewSummary}</p>
            </div>
          )
          : <Empty text="Dáta zatiaľ neoverené" action={<Btn onClick={doSignals} color={C.orange} small>⚡ Načítať signály</Btn>} />
        }
        {(t.liveSignals || []).length > 0 && (
          <div>
            <SH label="Detekované kľúčové slová" source="live" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {(t.liveSignals || []).map((s, i) => (
                <span key={i} style={{ fontFamily: mono, fontSize: '0.52rem', padding: '0.1rem 0.42rem', border: `1px solid ${C.amber}44`, borderRadius: 3, color: C.amber, background: `${C.amber}0d` }}>{s}</span>
              ))}
            </div>
          </div>
        )}
        {Object.keys(t.signalsByCategory || {}).length > 0 && (
          <div>
            <SH label="Kategórie signálov" source="live" />
            {Object.entries(t.signalsByCategory).map(([k, v]) => (
              <div key={k} style={{ marginBottom: '0.55rem' }}>
                <div style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: C.purple, marginBottom: '0.18rem' }}>{v.label || k} ({v.count || 0})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                  {(v.found || []).slice(0, 7).map((kw, i) => <span key={i} style={{ fontFamily: mono, fontSize: '0.48rem', padding: '0.04rem 0.3rem', border: `1px solid ${C.purple}33`, borderRadius: 2, color: C.purple, background: `${C.purple}0d` }}>{kw}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )

    // RECENZIE
    if (nav === 'reviews') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <SH label="Recenzie" source={live ? 'live' : 'unknown'} />
        {live ? (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge type="live" />
              {t.reviewRating && <span style={{ fontFamily: mono, fontSize: '0.75rem', color: C.amber, fontWeight: 700 }}>★ {t.reviewRating}</span>}
              {t.reviewCount && <span style={{ fontFamily: mono, fontSize: '0.55rem', color: C.dim }}>({t.reviewCount} recenzií)</span>}
            </div>
            {t.reviewSummary && <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 5, padding: '1.1rem 1.3rem' }}><p style={{ fontFamily: sans, fontSize: '0.75rem', color: C.sub, lineHeight: 1.75, margin: 0 }}>{t.reviewSummary}</p></div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {(t.liveSignals || []).map((s, i) => <span key={i} style={{ fontFamily: mono, fontSize: '0.5rem', padding: '0.08rem 0.38rem', border: `1px solid ${C.amber}44`, borderRadius: 3, color: C.amber, background: `${C.amber}0d` }}>{s}</span>)}
            </div>
          </>
        ) : <Empty text="Dáta zatiaľ neoverené" action={<Btn onClick={() => { doSignals(); }} color={C.orange} small>⚡ Načítať recenzie</Btn>} />}
      </div>
    )

    // TECHNOLÓGIE
    if (nav === 'technology') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <SH label="Technický profil" source={t.clientCard?.intelligence ? 'ai' : 'unknown'} />
        {t.clientCard?.intelligence ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
            {t.clientCard.intelligence.buildingAge && (
              <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 4, padding: '0.9rem 1rem' }}>
                <SH label="Vek budovy" />
                <div style={{ fontFamily: sans, fontSize: '0.78rem', color: C.text, fontWeight: 600 }}>{t.clientCard.intelligence.buildingAge.estimate}</div>
                <div style={{ fontFamily: mono, fontSize: '0.54rem', color: C.dim, marginTop: '0.2rem' }}>{t.clientCard.intelligence.buildingAge.approximateAge}</div>
                <div style={{ marginTop: '0.4rem' }}><Badge type={t.clientCard.intelligence.buildingAge.confidence?.toLowerCase() || 'unknown'} small /></div>
              </div>
            )}
            {t.clientCard.intelligence.technologyState && (
              <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 4, padding: '0.9rem 1rem' }}>
                <SH label="Stav technológie" />
                <div style={{ fontFamily: mono, fontSize: '0.56rem', color: C.amber, marginBottom: '0.25rem' }}>{t.clientCard.intelligence.technologyState.heatingType}</div>
                <div style={{ fontFamily: mono, fontSize: '0.54rem', color: C.dim }}>{t.clientCard.intelligence.technologyState.estimatedAge}</div>
                <div style={{ fontFamily: mono, fontSize: '0.54rem', color: C.red, marginTop: '0.15rem' }}>{t.clientCard.intelligence.technologyState.status}</div>
              </div>
            )}
          </div>
        ) : <Empty text="Dáta zatiaľ neoverené — generuj AI kartu klienta." />}
      </div>
    )

    // FINANCIE A NÁVRATNOSŤ
    if (nav === 'finance') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <SH label="Financie a návratnosť" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem' }}>
          <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 5, padding: '1rem 1.1rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.4rem', letterSpacing: '2px', textTransform: 'uppercase', color: C.ghost, marginBottom: '0.5rem' }}>Cena STRIKER</div>
            <div style={{ fontFamily: mono, fontSize: '1.3rem', fontWeight: 700, color: C.orange }}>8–10 k€</div>
            <Badge type="verified" small />
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 5, padding: '1rem 1.1rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.4rem', letterSpacing: '2px', textTransform: 'uppercase', color: C.ghost, marginBottom: '0.5rem' }}>Návratnosť</div>
            <div style={{ fontFamily: mono, fontSize: '1.3rem', fontWeight: 700, color: C.green }}>6–36 mes.</div>
            <Badge type="verified" small />
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 5, padding: '1rem 1.1rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.4rem', letterSpacing: '2px', textTransform: 'uppercase', color: C.ghost, marginBottom: '0.5rem' }}>Úspora tepla</div>
            <div style={{ fontFamily: mono, fontSize: '1.3rem', fontWeight: 700, color: C.amber }}>až 70 %</div>
            <Badge type="verified" small />
          </div>
        </div>
        {(analysis?.opportunity || t.estimatedROI) && (
          <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 5, padding: '1rem 1.2rem' }}>
            <SH label="AI odhad príležitosti" source="ai" />
            <p style={{ fontFamily: sans, fontSize: '0.75rem', color: C.sub, lineHeight: 1.7, margin: 0 }}>{analysis?.opportunity || t.estimatedROI}</p>
          </div>
        )}
      </div>
    )

    // ROZHODOVATELIA
    if (nav === 'decision') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <SH label="Rozhodovatelia" source={t.clientCard?.decisionProfile ? 'ai' : 'unknown'} />
        {t.clientCard?.decisionProfile ? (
          <>
            <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderLeft: `3px solid ${C.purple}`, borderRadius: 5, padding: '1rem 1.2rem' }}>
              <div style={{ fontFamily: mono, fontSize: '0.4rem', letterSpacing: '2px', textTransform: 'uppercase', color: C.purple, marginBottom: '0.35rem' }}>Pravdepodobne rozhoduje</div>
              <div style={{ fontFamily: sans, fontSize: '0.88rem', fontWeight: 600, color: C.text, marginBottom: '0.4rem' }}>{t.clientCard.decisionProfile.likelyDecisionMaker}</div>
              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                {(t.clientCard.decisionProfile.roles || []).map((r, i) => <span key={i} style={{ fontFamily: mono, fontSize: '0.48rem', padding: '0.06rem 0.38rem', border: `1px solid ${C.purple}44`, borderRadius: 2, color: C.purple, background: `${C.purple}0d` }}>{r}</span>)}
              </div>
              {t.clientCard.decisionProfile.process && <div style={{ fontFamily: mono, fontSize: '0.54rem', color: C.dim, marginTop: '0.5rem' }}>{t.clientCard.decisionProfile.process}</div>}
            </div>
          </>
        ) : <Empty text="Dáta zatiaľ neoverené — generuj AI kartu klienta." />}
        {(t.contacts || []).length > 0 && (
          <div>
            <SH label="Overené kontaktné osoby" source="verified" />
            {(t.contacts || []).map((c, i) => <ContactCard key={i} c={c} />)}
          </div>
        )}
      </div>
    )

    // KONTAKTY
    if (nav === 'contacts') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn onClick={doContacts} disabled={cLoad}>🔍 Nájsť kontakty</Btn>
          {cMsg && <span style={{ fontFamily: mono, fontSize: '0.55rem', color: cMsg.startsWith('✅') ? C.green : C.amber }}>{cMsg}</span>}
        </div>
        <ProgressBar running={cLoad} maxSecs={15} type="ai" />
        {t.email && (
          <div style={{ padding: '0.65rem 0.85rem', background: C.card, border: `1px solid ${C.border2}`, borderRadius: 4, display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <Badge type="general" />
            <a href={`mailto:${t.email}`} style={{ fontFamily: mono, fontSize: '0.62rem', color: C.green }}>✉ {t.email}</a>
            <span style={{ fontFamily: mono, fontSize: '0.48rem', color: C.ghost }}>všeobecný email</span>
          </div>
        )}
        {(t.contacts || []).map((c, i) => <ContactCard key={i} c={c} onRemove={() => removeContact(t.id, i)} />)}
        {found?.map((c, i) => <ContactCard key={i} c={c} onSave={() => { addContact(t.id, { ...c, source: c.source || 'web', confidence: c.confidence || 'MEDIUM' }); setFound(p => p.filter(fc => fc !== c)) }} />)}
        {!t.contacts?.length && !found && !t.email && <Empty text="Dáta zatiaľ neoverené — klikni Nájsť kontakty." />}
      </div>
    )

    // EMAILY
    if (nav === 'email') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <SH label="Emaily" />
        <EmailDraftEditor draft={draft} onSave={saveDraft} defaultLang="de" />
      </div>
    )

    // FOLLOW-UP
    if (nav === 'followup') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <SH label="Ďalší kontakt" />
        {t.clientCard?.salesStrategy ? (
          <>
            <div style={{ background: C.card, border: `1px solid ${C.green}33`, borderLeft: `3px solid ${C.green}`, borderRadius: 5, padding: '1.1rem 1.3rem' }}>
              <div style={{ fontFamily: mono, fontSize: '0.4rem', letterSpacing: '2px', textTransform: 'uppercase', color: C.green, marginBottom: '0.4rem' }}>Odporúčaný ďalší krok</div>
              <div style={{ fontFamily: sans, fontSize: '0.82rem', color: C.text, marginBottom: '0.5rem' }}>{t.clientCard.salesStrategy.nextStep}</div>
              <div style={{ fontFamily: mono, fontSize: '0.55rem', color: C.dim }}>Začni: {t.clientCard.salesStrategy.startWith || 'email'} · Tón: {t.clientCard.salesStrategy.tone || '—'}</div>
            </div>
            {t.clientCard.salesStrategy.emphasize?.length > 0 && (
              <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 4, padding: '0.9rem 1rem' }}>
                <SH label="Zdôrazniť v komunikácii" />
                {t.clientCard.salesStrategy.emphasize.map((e, i) => <div key={i} style={{ fontFamily: mono, fontSize: '0.58rem', color: C.green, marginBottom: '0.25rem' }}>✓ {e}</div>)}
              </div>
            )}
          </>
        ) : <Empty text="Dáta zatiaľ neoverené." />}
      </div>
    )

    // STAV OBCHODU
    if (nav === 'pipeline') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <SH label="Stav obchodu" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {INTEL_STATUS_LIST.map(s => (
            <button key={s.key} onClick={() => updateTarget(t.id, { status: s.key })}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: t.status === s.key ? s.bg : C.card, border: `1px solid ${t.status === s.key ? s.color + '55' : C.border2}`, borderLeft: `3px solid ${t.status === s.key ? s.color : 'transparent'}`, borderRadius: 4, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: mono, fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', color: t.status === s.key ? s.color : C.dim }}>{s.label}</div>
              </div>
              {t.status === s.key && <span style={{ fontFamily: mono, fontSize: '0.5rem', color: s.color }}>● Aktuálny</span>}
            </button>
          ))}
        </div>
      </div>
    )

    // Others: generic
    const names = { activity: 'Aktivity', sources: 'Zdroje a dôkazy', documents: 'Dokumenty' }
    return (
      <div>
        <SH label={names[nav] || nav} />
        <Empty text="Dáta zatiaľ neoverené — táto sekcia bude rozvinutá v ďalšej verzii." />
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 300, display: 'flex', overflow: 'hidden' }}>

      {/* ── LEFT ── */}
      <div style={{ ...lStyle, background: '#07090d', borderRight: `1px solid ${C.border2}`, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingTop: 38 }}>
        <BackBtn onClose={onClose} />

        {/* Zoom bar */}
        <div style={{ position: 'sticky', top: 0, zIndex: 15, display: 'flex', justifyContent: 'flex-end', padding: '0.28rem 0.5rem', background: '#07090d', borderBottom: `1px solid ${C.border}` }}>
          <ZoomBtn panel="left" zoomed={zoomed} setZoomed={setZoomed} />
        </div>

        <HotelPhoto t={t} photoUrl={photoUrl} loading={photoLoad} />

        {/* Company info */}
        <div style={{ padding: '1rem 1rem 1.1rem', borderBottom: `1px solid ${C.border2}` }}>
          <div style={{ fontFamily: sans, fontSize: '1.05rem', fontWeight: 700, color: '#f1f3f5', lineHeight: 1.25, marginBottom: '0.28rem' }}>{t.name}</div>
          <div style={{ fontFamily: mono, fontSize: '0.56rem', color: '#9ca3af', marginBottom: '0.2rem', letterSpacing: '0.3px' }}>{[t.city, t.country].filter(Boolean).join(' · ')}</div>
          <div style={{ fontFamily: mono, fontSize: '0.52rem', color: C.amber, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '0.75rem' }}>{t.segmentLabel || t.segment || '—'}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.55rem', background: `${fitCol}0d`, border: `1px solid ${fitCol}25`, borderRadius: 4, padding: '0.5rem 0.7rem' }}>
            <span style={{ fontFamily: mono, fontSize: '1.8rem', fontWeight: 700, color: fitCol, lineHeight: 1 }}>{fit || '—'}</span>
            <div>
              <div style={{ fontFamily: mono, fontSize: '0.4rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#6b7280' }}>ZHODA KLIENTA</div>
              {live && <div style={{ fontFamily: mono, fontSize: '0.4rem', color: C.green, marginTop: '0.05rem' }}>🔴 ŽIVÉ DÁTA</div>}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.4rem 0' }}>
          {NAV.map(item => {
            const active = item.key === nav
            return (
              <button key={item.key} onClick={() => setNav(item.key)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.58rem 1rem', background: active ? `${C.orange}18` : 'transparent', border: 'none', borderLeft: `2px solid ${active ? C.orange : 'transparent'}`, color: active ? '#f1f3f5' : '#8a929e', fontFamily: mono, fontSize: '0.57rem', letterSpacing: '0.2px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s', boxShadow: active ? `inset 0 0 20px ${C.orange}08` : 'none' }}>
                <span style={{ fontSize: '0.7rem', width: 16, flexShrink: 0, textAlign: 'center', opacity: active ? 1 : 0.5, color: active ? C.orange : 'inherit' }}>{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* ── CENTER ── */}
      <div style={{ ...cStyle, overflowY: 'auto', borderRight: `1px solid ${C.border}` }}>
        {/* Zoom bar */}
        <div style={{ position: 'sticky', top: 0, zIndex: 15, display: 'flex', justifyContent: 'flex-end', padding: '0.4rem 0.75rem', background: C.bg, borderBottom: `1px solid ${C.border}` }}>
          <ZoomBtn panel="center" zoomed={zoomed} setZoomed={setZoomed} />
        </div>
        <div style={{ padding: '1.5rem 2rem' }}>
          <Center />
        </div>
      </div>

      {selectedContact && (
        <ContactDetailModal contact={selectedContact} target={t} onClose={() => setSelectedContact(null)} />
      )}

      {/* ── RIGHT ── */}
      <div style={{ ...rStyle, overflowY: 'auto', background: C.panel }}>
        {/* Zoom bar */}
        <div style={{ position: 'sticky', top: 0, zIndex: 15, display: 'flex', justifyContent: 'flex-end', padding: '0.4rem 0.5rem', background: C.panel, borderBottom: `1px solid ${C.border}` }}>
          <ZoomBtn panel="right" zoomed={zoomed} setZoomed={setZoomed} />
        </div>
        <div style={{ padding: '1rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>

          {/* Header */}
          <div style={{ paddingBottom: '0.65rem', borderBottom: `1px solid #1e2530` }}>
            <div style={{ fontFamily: sans, fontSize: '0.86rem', fontWeight: 700, color: '#f4f6f9', marginBottom: '0.18rem' }}>Kontakty klienta</div>
            <div style={{ fontFamily: mono, fontSize: '0.44rem', color: '#6b7280', lineHeight: 1.5 }}>Ľudia, ktorí môžu ovplyvniť rozhodnutie</div>
          </div>

          {/* Summary strip */}
          {(() => {
            const contacts   = (t.contacts || []).length > 0 ? t.contacts : DEMO_CONTACTS
            const deciders   = contacts.filter(c => c.decisionPower === 'HIGH').length
            const hasEmail   = contacts.filter(c => c.email).length
            const nextAction = hasEmail > 0 ? 'Pripraviť email' : 'Obohatiť kontakty'
            return (
              <div style={{ background: '#0e1117', border: '1px solid #1e2530', borderRadius: 5, padding: '0.7rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid #1e2530', paddingRight: '0.5rem' }}>
                    <div style={{ fontFamily: mono, fontSize: '1.15rem', fontWeight: 700, color: '#f4f6f9', lineHeight: 1 }}>{contacts.length}</div>
                    <div style={{ fontFamily: mono, fontSize: '0.38rem', color: '#6b7280', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '0.18rem' }}>Kontakty</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontFamily: mono, fontSize: '1.15rem', fontWeight: 700, color: C.orange, lineHeight: 1 }}>{deciders}</div>
                    <div style={{ fontFamily: mono, fontSize: '0.38rem', color: '#6b7280', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '0.18rem' }}>Rozhod.</div>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid #1e2530', paddingTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ fontFamily: mono, fontSize: '0.38rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#374151' }}>Ďalší krok:</span>
                  <span style={{ fontFamily: mono, fontSize: '0.42rem', color: C.green }}>{nextAction}</span>
                </div>
              </div>
            )
          })()}

          {/* Find contacts CTA */}
          <button onClick={() => { setNav('contacts'); doContacts() }} disabled={cLoad}
            style={{ width: '100%', fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.45rem 0.7rem', border: `1px solid ${C.orange}66`, background: `${C.orange}12`, color: C.orange, borderRadius: 4, cursor: cLoad ? 'default' : 'pointer', opacity: cLoad ? 0.65 : 1, transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', fontWeight: 600 }}>
            {cLoad ? '⏳ Hľadám...' : '🔍 Nájsť kontakty'}
          </button>
          {cMsg && <div style={{ fontFamily: mono, fontSize: '0.48rem', color: cMsg.startsWith('✅') ? C.green : C.amber, textAlign: 'center' }}>{cMsg}</div>}

          {/* General email */}
          {t.email && (
            <div style={{ padding: '0.5rem 0.65rem', background: '#0e1117', border: `1px solid #1e2530`, borderRadius: 4, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontFamily: mono, fontSize: '0.37rem', letterSpacing: '1px', textTransform: 'uppercase', color: C.amber, padding: '0.05rem 0.28rem', border: `1px solid ${C.amber}44`, borderRadius: 2, background: `${C.amber}10`, flexShrink: 0 }}>VŠEOB.</span>
              <a href={`mailto:${t.email}`} style={{ fontFamily: mono, fontSize: '0.54rem', color: '#4ade80', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✉ {t.email}</a>
            </div>
          )}

          {/* Contact cards */}
          {(t.contacts || []).length > 0
            ? (t.contacts).map((c, i) => <RightContactCard key={i} c={c} onSelect={setSelectedContact} />)
            : (
              <>
                <div style={{ fontFamily: mono, fontSize: '0.4rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#374151' }}>
                  Typické rozhodovacie pozície
                </div>
                {DEMO_CONTACTS.map(c => <RightContactCard key={c._id} c={c} onSelect={setSelectedContact} />)}
                <div style={{ fontFamily: mono, fontSize: '0.43rem', color: '#4b5563', fontStyle: 'italic', textAlign: 'center', lineHeight: 1.7, padding: '0.25rem 0.5rem' }}>
                  Spusti „Nájsť kontakty" pre reálne mená a emaily
                </div>
              </>
            )
          }
        </div>
      </div>
    </div>
  )
}
