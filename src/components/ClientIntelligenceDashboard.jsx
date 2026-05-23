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
      <span style={{ fontFamily: mono, fontSize: '0.43rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: C.ghost }}>{label}</span>
      {source && <Badge type={source} />}
      {action && <span style={{ flex: 1 }} />}
      {action}
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KPI({ label, value, unit = '', source, color, note, max = 100 }) {
  const has = value != null && value !== ''
  const num = typeof value === 'number'
  const col = color || (num ? (value >= 70 ? C.orange : value >= 45 ? C.amber : C.dim) : C.dim)
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 6, padding: '1.1rem 1.2rem', flex: 1, minWidth: 130, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontFamily: mono, fontSize: '0.41rem', letterSpacing: '2px', textTransform: 'uppercase', color: C.ghost, lineHeight: 1.4 }}>{label}</div>
        {source && <Badge type={source} small />}
      </div>
      {has ? (
        <>
          <div style={{ fontFamily: mono, fontSize: '1.7rem', fontWeight: 700, color: col, lineHeight: 1 }}>
            {num ? value : value}{unit}
          </div>
          {num && (
            <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: '100%', background: col, borderRadius: 2, transition: 'width 0.5s ease', boxShadow: `0 0 6px ${col}66` }} />
            </div>
          )}
          {note && <div style={{ fontFamily: mono, fontSize: '0.46rem', color: C.dim, lineHeight: 1.4, marginTop: '0.1rem' }}>{note}</div>}
        </>
      ) : (
        <div style={{ fontFamily: mono, fontSize: '0.56rem', color: C.ghost, fontStyle: 'italic' }}>Dáta zatiaľ neoverené</div>
      )}
    </div>
  )
}

// ── Metric row ─────────────────────────────────────────────────────────────────
function MRow({ label, value, reason, source }) {
  if (value == null) return null
  const col = value >= 70 ? C.orange : value >= 45 ? C.amber : C.dim
  return (
    <div style={{ marginBottom: '0.85rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
        <span style={{ fontFamily: mono, fontSize: '0.52rem', color: C.sub }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {source && <Badge type={source} small />}
          <span style={{ fontFamily: mono, fontSize: '0.7rem', fontWeight: 700, color: col }}>{value}</span>
        </div>
      </div>
      <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: col, borderRadius: 2, boxShadow: `0 0 6px ${col}55` }} />
      </div>
      {reason && <div style={{ fontFamily: mono, fontSize: '0.47rem', color: C.ghost, marginTop: '0.22rem', lineHeight: 1.45 }}>{reason}</div>}
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
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ fontFamily: mono, fontSize: small ? '0.5rem' : '0.54rem', letterSpacing: '1px', textTransform: 'uppercase', padding: small ? '0.28rem 0.7rem' : '0.38rem 0.9rem', border: `1px solid ${color}44`, background: `${color}0d`, color, borderRadius: 3, cursor: 'pointer', opacity: disabled ? 0.55 : 1, transition: 'all 0.12s', whiteSpace: 'nowrap' }}>
      {children}
    </button>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────
function Empty({ text = 'Dáta zatiaľ neoverené', action }) {
  return (
    <div style={{ padding: '2.5rem 1.5rem', background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, textAlign: 'center' }}>
      <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.ghost, fontStyle: 'italic', marginBottom: action ? '1rem' : 0 }}>{text}</div>
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
function HotelPhoto({ photoUrl, loading, t, onClose }) {
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
        <button onClick={onClose} style={{ position: 'absolute', top: '0.55rem', right: '0.55rem', background: 'rgba(0,0,0,0.6)', border: `1px solid ${C.border}`, color: C.dim, borderRadius: 3, padding: '0.16rem 0.45rem', fontFamily: mono, fontSize: '0.48rem', cursor: 'pointer', letterSpacing: '1px' }}>✕</button>
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
        <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderLeft: `3px solid ${C.orange}`, borderRadius: 5, padding: '1.25rem 1.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
            <span style={{ fontFamily: mono, fontSize: '0.43rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: C.orange }}>Hlavný problém klienta</span>
            <Badge type={live ? 'live' : problem ? 'ai' : 'unknown'} />
          </div>
          {problem
            ? <p style={{ fontFamily: sans, fontSize: '0.8rem', color: C.text, lineHeight: 1.7, margin: 0 }}>{problem.split('\n\n')[0].slice(0, 220)}</p>
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
          <div style={{ background: `${C.green}07`, border: `1px solid ${C.green}22`, borderRadius: 5, padding: '1.1rem 1.3rem' }}>
            <span style={{ fontFamily: mono, fontSize: '0.43rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: C.green, display: 'block', marginBottom: '0.5rem' }}>Odporúčaný ďalší krok</span>
            <div style={{ fontFamily: sans, fontSize: '0.82rem', color: C.text, marginBottom: '0.65rem', lineHeight: 1.5 }}>{nextStep}</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Btn onClick={() => setNav('email')} color={C.green} small>✉ Otvoriť emaily</Btn>
              {mainCt?.email && <a href={`mailto:${mainCt.email}`} style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.7rem', border: `1px solid ${C.border2}`, background: 'transparent', color: C.dim, borderRadius: 3, textDecoration: 'none' }}>{mainCt.name || mainCt.email}</a>}
            </div>
          </div>
        )}

        {/* Pain points */}
        {analysis?.painPoints?.length > 0 && (
          <div>
            <SH label="Kľúčové problémy" source="ai" />
            {analysis.painPoints.slice(0, 3).map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.6rem', padding: '0.65rem 0.85rem', background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: '0.35rem' }}>
                <span style={{ color: C.red, flexShrink: 0, fontSize: '0.7rem' }}>▸</span>
                <span style={{ fontFamily: sans, fontSize: '0.73rem', color: C.sub, lineHeight: 1.55 }}>{p}</span>
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
                <span key={i} style={{ fontFamily: mono, fontSize: '0.5rem', padding: '0.1rem 0.42rem', border: `1px solid ${C.amber}44`, borderRadius: 3, color: C.amber, background: `${C.amber}0d` }}>{s}</span>
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
          <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderLeft: `3px solid ${C.orange}`, borderRadius: 5, padding: '1.3rem 1.5rem' }}>
            <Badge type={analysis?.reasoning ? 'ai' : 'ai'} />
            <div style={{ marginTop: '0.75rem' }}>
              {(t.clientCard?.clientProfile || analysis?.reasoning || '').split('\n\n').slice(0, 4).map((p, i) => (
                <p key={i} style={{ fontFamily: sans, fontSize: '0.75rem', color: i === 0 ? C.text : C.sub, lineHeight: 1.75, margin: 0, marginBottom: i < 3 ? '0.85rem' : 0 }}>{p}</p>
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
              { label: 'Teplotný tlak',       v: t.heatPressure,          r: t.heatPressureReason },
              { label: 'Závislosť od tepla',  v: t.thermalDependency,     r: t.thermalDependencyReason },
              { label: 'Prevádzkové náklady', v: t.operatingCostPressure, r: t.operatingCostPressureReason },
              { label: 'Potreba modernizácie', v: t.modernizationNeed,    r: t.modernizationNeedReason },
              { label: 'Závislosť od kotlov', v: t.boilerDependencyProb,  r: t.boilerDependencyProbReason },
              { label: 'Ochota riešiť',       v: t.willingnessToSolve,    r: t.willingnessToSolveReason },
            ].map(({ label, v, r }) => (
              <div key={label} style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 4, padding: '0.85rem 1rem' }}>
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
      <div style={{ width: 255, flexShrink: 0, background: '#040609', borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingTop: 38 }}>

        {/* Back button — position:fixed, rendered outside scroll flow */}
        <BackBtn onClose={onClose} />

        {/* Photo / Placeholder */}
        <HotelPhoto t={t} photoUrl={photoUrl} loading={photoLoad} onClose={onClose} />


        {/* Company info */}
        <div style={{ padding: '0.85rem 1rem', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: sans, fontSize: '0.97rem', fontWeight: 700, color: C.text, lineHeight: 1.25, marginBottom: '0.22rem' }}>{t.name}</div>
          <div style={{ fontFamily: mono, fontSize: '0.52rem', color: C.dim, marginBottom: '0.18rem' }}>{[t.city, t.country].filter(Boolean).join(' · ')}</div>
          <div style={{ fontFamily: mono, fontSize: '0.5rem', color: C.ghost, marginBottom: '0.55rem' }}>{t.segmentLabel || t.segment || '—'}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontFamily: mono, fontSize: '1.6rem', fontWeight: 700, color: fitCol, lineHeight: 1 }}>{fit || '—'}</span>
            <div>
              <div style={{ fontFamily: mono, fontSize: '0.38rem', letterSpacing: '2px', textTransform: 'uppercase', color: C.ghost }}>ZHODA KLIENTA</div>
              {live && <div style={{ fontFamily: mono, fontSize: '0.38rem', color: C.green, marginTop: '0.05rem' }}>🔴 ŽIVÉ DÁTA</div>}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.35rem 0' }}>
          {NAV.map(item => {
            const active = item.key === nav
            return (
              <button key={item.key} onClick={() => setNav(item.key)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.52rem 1rem', background: active ? `${C.orange}0d` : 'transparent', border: 'none', borderLeft: `2px solid ${active ? C.orange : 'transparent'}`, color: active ? C.text : C.ghost, fontFamily: mono, fontSize: '0.56rem', letterSpacing: '0.3px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }}>
                <span style={{ fontSize: '0.68rem', width: 16, flexShrink: 0, textAlign: 'center', opacity: 0.65 }}>{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* ── CENTER ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem 2rem', borderRight: `1px solid ${C.border}` }}>
        <Center />
      </div>

      {/* ── RIGHT — always visible ── */}
      <div style={{ width: 265, flexShrink: 0, overflowY: 'auto', padding: '1.25rem 1rem', background: C.panel, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Pipeline status */}
        <div>
          <div style={{ fontFamily: mono, fontSize: '0.42rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: C.ghost, marginBottom: '0.6rem' }}>Stav obchodu</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {INTEL_STATUS_LIST.slice(0, 5).map(s => (
              <button key={s.key} onClick={() => updateTarget(t.id, { status: s.key })}
                style={{ display: 'block', width: '100%', fontFamily: mono, fontSize: '0.5rem', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '0.28rem 0.6rem', border: `1px solid ${t.status === s.key ? s.color + '55' : C.border}`, background: t.status === s.key ? s.bg : 'transparent', color: t.status === s.key ? s.color : C.ghost, borderRadius: 3, cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contacts */}
        <div>
          <div style={{ fontFamily: mono, fontSize: '0.42rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: C.ghost, marginBottom: '0.6rem' }}>Kontakty</div>
          {t.email && (
            <div style={{ padding: '0.5rem 0.65rem', background: C.card, border: `1px solid ${C.border}`, borderRadius: 3, marginBottom: '0.4rem' }}>
              <a href={`mailto:${t.email}`} style={{ fontFamily: mono, fontSize: '0.58rem', color: C.green }}>✉ {t.email}</a>
            </div>
          )}
          {(t.contacts || []).slice(0, 3).map((c, i) => <ContactCard key={i} c={c} />)}
          {!t.contacts?.length && !t.email && <div style={{ fontFamily: mono, fontSize: '0.55rem', color: C.ghost, fontStyle: 'italic' }}>Dáta zatiaľ neoverené</div>}
          <button onClick={() => { setNav('contacts'); doContacts() }} disabled={cLoad}
            style={{ width: '100%', fontFamily: mono, fontSize: '0.5rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.3rem', border: `1px solid ${C.border}`, background: 'transparent', color: C.dim, borderRadius: 3, cursor: 'pointer', marginTop: '0.4rem', opacity: cLoad ? 0.6 : 1 }}>
            {cLoad ? '⏳' : '🔍 Nájsť kontakty'}
          </button>
        </div>

        {/* Quick actions */}
        <div>
          <div style={{ fontFamily: mono, fontSize: '0.42rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: C.ghost, marginBottom: '0.6rem' }}>Rýchle akcie</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {[
              { l: '✉ Emaily',          c: C.green,  a: () => setNav('email')                               },
              { l: '⚡ Signal Engine',  c: C.orange, a: () => { doSignals(); setNav('signals') }             },
              { l: '🧠 AI Analýza',    c: C.amber,  a: () => { doAnalysis(); setNav('profile') }            },
              { l: '🔍 Kontakty',      c: C.purple, a: () => { setNav('contacts'); doContacts() }           },
            ].map(({ l, c, a }) => (
              <button key={l} onClick={a}
                style={{ fontFamily: mono, fontSize: '0.51rem', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '0.35rem 0.7rem', border: `1px solid ${c}33`, background: `${c}07`, color: c, borderRadius: 3, cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Data freshness */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, padding: '0.7rem 0.85rem', marginTop: 'auto' }}>
          <div style={{ fontFamily: mono, fontSize: '0.4rem', letterSpacing: '2px', textTransform: 'uppercase', color: C.ghost, marginBottom: '0.35rem' }}>Aktuálnosť dát</div>
          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', marginBottom: '0.18rem' }}>
            <Badge type={live ? 'live' : 'ai'} small />
            <span style={{ fontFamily: mono, fontSize: '0.52rem', color: live ? C.green : C.dim }}>{live ? 'Živé Google dáta' : 'AI simulácia'}</span>
          </div>
          {t.reviewsCachedAt && <div style={{ fontFamily: mono, fontSize: '0.47rem', color: C.ghost }}>{new Date(t.reviewsCachedAt).toLocaleDateString('sk-SK')}</div>}
        </div>
      </div>
    </div>
  )
}
