import { useState, useEffect, useRef } from 'react'
import { updateTarget, addContact, removeContact } from '../services/intelTargetService.js'
import { INTEL_STATUS_LIST, scoreColor } from '../constants/intelMeta.js'
import ProgressBar from './ProgressBar.jsx'
import EmailDraftEditor from './EmailDraftEditor.jsx'

const mono = "'IBM Plex Mono',monospace"
const sans = "'IBM Plex Sans',sans-serif"

// ── Design tokens ──────────────────────────────────────────────────────────────
const D = {
  bg:       '#080a0d',
  surface:  '#0d1117',
  surface2: '#111418',
  border:   '#1a1f2a',
  border2:  '#1e2530',
  orange:   '#ff5c00',
  amber:    '#ffaa00',
  green:    '#00cc88',
  red:      '#ef4444',
  purple:   '#818cf8',
  text:     '#e8eaed',
  muted:    '#6b7280',
  dimmed:   '#374151',
}

// ── Sidebar nav items ──────────────────────────────────────────────────────────
const NAV = [
  { key: 'client',    icon: '🎯', label: 'Klient',     active: true  },
  { key: 'clients',   icon: '🏢', label: 'Klienti',    active: false },
  { key: 'pipeline',  icon: '📊', label: 'Pipeline',   active: false },
  { key: 'hunter',    icon: '🔍', label: 'AI Hunter',  active: false },
  { key: 'signals',   icon: '📡', label: 'Signály',    active: false },
  { key: 'emails',    icon: '✉',  label: 'Emaily',     active: false },
  { key: 'tasks',     icon: '✓',  label: 'Úlohy',      active: false },
  { key: 'stats',     icon: '📈', label: 'Štatistiky', active: false },
  { key: 'settings',  icon: '⚙',  label: 'Nastavenia', active: false },
]

const CENTER_TABS = [
  { key: 'overview',  label: 'Prehľad'     },
  { key: 'ai',        label: 'AI Analýza'  },
  { key: 'signals',   label: 'Signály'     },
  { key: 'reviews',   label: 'Recenzie'    },
  { key: 'contacts',  label: 'Kontakty'    },
  { key: 'email',     label: 'Email Draft' },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function Chip({ label, color = D.muted, bg, small }) {
  return (
    <span style={{
      fontFamily: mono,
      fontSize: small ? '0.45rem' : '0.5rem',
      letterSpacing: '1px',
      textTransform: 'uppercase',
      padding: small ? '0.05rem 0.3rem' : '0.08rem 0.4rem',
      border: `1px solid ${color}55`,
      borderRadius: 3,
      color,
      background: bg || `${color}12`,
      display: 'inline-block',
    }}>
      {label}
    </span>
  )
}

function KpiCard({ label, value, max = 100, color = D.orange, type = 'AI_ODHAD', unit = '' }) {
  const pct = Math.min(100, Math.max(0, typeof value === 'number' ? (value / max) * 100 : 0))
  const typeColors = { FACT: D.green, LIVE_SIGNAL: D.amber, AI_ODHAD: D.purple, UNKNOWN: D.muted }
  const tc = typeColors[type] || D.muted
  return (
    <div style={{ background: D.surface, border: `1px solid ${D.border2}`, borderRadius: 6, padding: '0.8rem 1rem', flex: 1, minWidth: 120 }}>
      <div style={{ fontFamily: mono, fontSize: '0.42rem', letterSpacing: '2px', textTransform: 'uppercase', color: D.dimmed, marginBottom: '0.45rem' }}>{label}</div>
      {typeof value === 'number' ? (
        <>
          <div style={{ fontFamily: mono, fontSize: '1.4rem', fontWeight: 700, color, lineHeight: 1, marginBottom: '0.3rem' }}>
            {value}{unit}
          </div>
          <div style={{ height: 2, background: D.border, borderRadius: 1, overflow: 'hidden', marginBottom: '0.3rem' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 1, transition: 'width 0.6s ease' }} />
          </div>
        </>
      ) : (
        <div style={{ fontFamily: mono, fontSize: '0.7rem', color: D.muted, fontStyle: 'italic', marginBottom: '0.3rem' }}>—</div>
      )}
      <span style={{ fontFamily: mono, fontSize: '0.4rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: tc, padding: '0.03rem 0.25rem', border: `1px solid ${tc}44`, borderRadius: 2 }}>{type}</span>
    </div>
  )
}

function buildAiProfile(t, analysisResult) {
  if (t.clientCard?.clientProfile) return t.clientCard.clientProfile
  if (analysisResult?.reasoning && analysisResult.reasoning.length > 50) return analysisResult.reasoning
  const seg = t.segmentLabel || t.segment || 'firma'
  const hasMet = t.heatPressure != null
  const fit = t.strikerFitScore || 50
  return [
    `Podľa dostupných signálov ide o ${seg.toLowerCase()} so závislosťou od tepelnej energie. ${hasMet && t.heatPressure >= 70 ? 'Signálne metriky naznačujú vysoký teplotný tlak.' : ''}`,
    t.modernizationNeed >= 65
      ? `Technický profil môže naznačovať potrebu modernizácie vykurovacieho systému — čo je priama príležitosť pre STRIKER.`
      : `Na základe segmentu možno predpokladať závislosť od konvenčného kúrenia.`,
    fit >= 70
      ? `Ak sa potvrdí záujem, klient môže byť motivovaný rýchlou návratnosťou a stabilitou prevádzkových nákladov.`
      : `Odporúčané postupné budovanie dôvery — začať emailom s orientačnou kalkuláciou.`,
  ].join('\n\n')
}

function buildWhyList(t, analysisResult) {
  const items = []
  if (t.heatPressure >= 70)          items.push({ ok: true,  text: 'Vysoký teplotný tlak prevádzky' })
  if (t.thermalDependency >= 70)     items.push({ ok: true,  text: 'Závislosť od tepla je kritická' })
  if (t.modernizationNeed >= 65)     items.push({ ok: true,  text: 'Naznačená potreba modernizácie' })
  if (t.operatingCostPressure >= 65) items.push({ ok: true,  text: 'Vysoké prevádzkové náklady' })
  if (t.boilerDependencyProb >= 70)  items.push({ ok: true,  text: 'Pravdepodobná závislosť od kotla' })
  if (t.willingnessToSolve >= 65)    items.push({ ok: true,  text: 'Ochota aktívne riešiť problém' })
  if ((t.liveSignals || []).length > 2) items.push({ ok: true, text: `${(t.liveSignals||[]).length} live signálov z Google` })
  if (t.reviewsSource === 'serpapi') items.push({ ok: true,  text: 'Live Google recenzie dostupné' })
  const pains = analysisResult?.painPoints || []
  pains.slice(0, 2).forEach(p => items.push({ ok: true, text: p.slice(0, 50) }))
  if (!items.length) items.push({ ok: false, text: 'Zatiaľ málo signálov — spusti Signal Engine' })
  return items.slice(0, 7)
}

function buildTags(t) {
  const tags = []
  const seg = (t.segmentLabel || t.segment || '').toLowerCase()
  if (seg.includes('hotel'))   tags.push({ label: 'Hotel',   color: D.purple })
  if (seg.includes('gastro'))  tags.push({ label: 'Gastro',  color: D.purple })
  if (seg.includes('waesch') || seg.includes('laund')) tags.push({ label: 'Práčovňa', color: D.amber })
  if (seg.includes('wellness') || (t.liveSignals||[]).some(s => s.includes('wellness'))) tags.push({ label: 'Wellness', color: D.green })
  const sigs = Object.keys(t.signalsByCategory || {})
  if (sigs.includes('thermal')) tags.push({ label: 'Teplo',   color: D.orange })
  if (sigs.includes('esg'))     tags.push({ label: 'ESG',     color: D.green  })
  if (sigs.includes('luxury'))  tags.push({ label: 'Premium', color: '#c4b5fd' })
  if (t.strikerFitScore >= 80)  tags.push({ label: 'High FIT', color: D.orange })
  return tags.slice(0, 6)
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ClientIntelligenceDashboard({ target: initialT, onClose, onDelete }) {
  const [t, setT] = useState(initialT)
  const [activeNav,    setActiveNav]    = useState('client')
  const [activeTab,    setActiveTab]    = useState('overview')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [gatherLoading,  setGatherLoading]  = useState(false)
  const [signalLoading,  setSignalLoading]  = useState(false)
  const [signalMsg,      setSignalMsg]      = useState('')
  const [findLoading,    setFindLoading]    = useState(false)
  const [findMsg,        setFindMsg]        = useState('')
  const [foundContacts,  setFoundContacts]  = useState(null)
  const [emailDraft,     setEmailDraft]     = useState(t.emailDraft || { sk:{subject:'',body:''}, de:{subject:'',body:''}, en:{subject:'',body:''} })

  const aiProfile = buildAiProfile(t, analysisResult)
  const whyList   = buildWhyList(t, analysisResult)
  const tags      = buildTags(t)
  const fit       = t.strikerFitScore || t.overallScore || 0
  const fitColor  = fit >= 80 ? D.orange : fit >= 60 ? D.amber : D.muted
  const isLive    = t.reviewsSource === 'serpapi'

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleAiAnalyze() {
    setGatherLoading(true)
    try {
      const res  = await fetch('/.netlify/functions/ai-analysis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: t.name, city: t.city, segment: t.segment, segmentLabel: t.segmentLabel, fitScore: t.strikerFitScore || 50, language: 'sk' }),
      })
      const data = await res.json()
      if (data.ok) {
        setAnalysisResult(data)
        if (data.subject || data.draft) {
          setEmailDraft(prev => ({ ...prev, sk: { subject: data.subject || '', body: data.draft || '' } }))
        }
      }
    } catch (e) { console.error('[dashboard] ai-analysis:', e) }
    finally { setGatherLoading(false) }
  }

  async function handleSignalEngine() {
    setSignalLoading(true); setSignalMsg('')
    try {
      const res  = await fetch('/.netlify/functions/serpapi-reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: t.name, url: t.web, segment: t.segment, segmentLabel: t.segmentLabel, city: t.city, country: t.country || 'DE', strikerFitScore: t.strikerFitScore || 50, painPoints: analysisResult?.painPoints || [], aiReasoning: analysisResult?.reasoning || '' }),
      })
      const data = await res.json()
      if (data.ok) {
        await updateTarget(t.id, { heatPressure: data.heatPressure, heatPressureReason: data.heatPressureReason, thermalDependency: data.thermalDependency, thermalDependencyReason: data.thermalDependencyReason, operatingCostPressure: data.operatingCostPressure, operatingCostPressureReason: data.operatingCostPressureReason, modernizationNeed: data.modernizationNeed, modernizationNeedReason: data.modernizationNeedReason, boilerDependencyProb: data.boilerDependencyProb, boilerDependencyProbReason: data.boilerDependencyProbReason, willingnessToSolve: data.willingnessToSolve, willingnessToSolveReason: data.willingnessToSolveReason, reviewsSource: data.reviewsSource, reviewsCachedAt: data.reviewsCachedAt, reviewRating: data.reviewRating, reviewCount: data.reviewCount, reviewSummary: data.reviewSummary, liveSignals: data.liveSignals || [] })
        setSignalMsg(data.reviewsSource === 'serpapi' ? `✅ LIVE · ${data.reviewCount||0} recenzií` : '✓ AI signály')
      }
    } catch (e) { setSignalMsg('⚠ ' + e.message) }
    finally { setSignalLoading(false) }
  }

  async function handleFindContacts() {
    setFindLoading(true); setFindMsg('')
    try {
      const res  = await fetch('/.netlify/functions/find-contacts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: t.name, website: t.web, city: t.city, country: t.country || 'DE' }),
      })
      const data = await res.json()
      if (data.ok) {
        setFoundContacts(data.contacts || [])
        if (data.generalEmail && !t.email) await updateTarget(t.id, { email: data.generalEmail })
        setFindMsg(data.contacts?.length ? `✅ ${data.contacts.length} kontakt(y)` : 'ℹ Nenajdené')
      }
    } catch (e) { setFindMsg('⚠ ' + e.message) }
    finally { setFindLoading(false) }
  }

  async function handleSaveDraft(lang, subject, body) {
    const updated = { ...emailDraft, [lang]: { subject, body } }
    setEmailDraft(updated)
    await updateTarget(t.id, { emailDraft: updated })
  }

  // ── Layout ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, background: D.bg, zIndex: 300, display: 'flex', overflow: 'hidden' }}>

      {/* ── SIDEBAR ── */}
      <div style={{ width: 220, flexShrink: 0, background: '#050709', borderRight: `1px solid ${D.border}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Logo */}
        <div style={{ padding: '1.2rem 1.1rem', borderBottom: `1px solid ${D.border}` }}>
          <div style={{ fontFamily: mono, fontSize: '1.1rem', fontWeight: 700, letterSpacing: 3, color: D.orange }}>STRIKER</div>
          <div style={{ fontFamily: mono, fontSize: '0.42rem', letterSpacing: '2px', textTransform: 'uppercase', color: D.dimmed, marginTop: '0.15rem' }}>SALES INTELLIGENCE</div>
        </div>

        {/* Nav */}
        <div style={{ padding: '0.5rem 0', flex: 1 }}>
          {NAV.map(item => {
            const isActive = item.key === activeNav
            return (
              <button key={item.key} onClick={() => { if (item.key === 'client') setActiveNav('client'); else onClose?.() }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.55rem 1.1rem', background: isActive ? 'rgba(255,92,0,0.1)' : 'transparent', border: 'none', borderLeft: `2px solid ${isActive ? D.orange : 'transparent'}`, color: isActive ? D.orange : D.muted, fontFamily: mono, fontSize: '0.6rem', letterSpacing: '0.5px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                <span style={{ fontSize: '0.85rem' }}>{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </div>

        {/* Close */}
        <div style={{ padding: '0.75rem 1.1rem', borderTop: `1px solid ${D.border}` }}>
          <button onClick={onClose} style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', background: 'transparent', border: `1px solid ${D.border2}`, color: D.muted, padding: '0.25rem 0.65rem', borderRadius: 2, cursor: 'pointer', width: '100%' }}>
            ← Späť na zoznam
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* ── HERO SECTION ── */}
          <div style={{ background: `linear-gradient(135deg, #0d1117 0%, #111418 50%, rgba(255,92,0,0.04) 100%)`, borderBottom: `1px solid ${D.border}`, padding: '1.5rem 1.75rem' }}>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>

              {/* Company image placeholder */}
              <div style={{ width: 90, height: 90, flexShrink: 0, background: `linear-gradient(135deg, ${D.surface2} 0%, rgba(255,92,0,0.12) 100%)`, border: `1px solid ${D.orange}33`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: sans, fontSize: '2rem', fontWeight: 700, color: D.orange, opacity: 0.7 }}>
                  {(t.name || 'X').charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Company info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                  <h1 style={{ fontFamily: sans, fontSize: '1.45rem', fontWeight: 700, color: D.text, margin: 0, lineHeight: 1.2 }}>{t.name}</h1>
                  {isLive && <Chip label="🔴 LIVE DATA" color={D.green} />}
                  {!isLive && <Chip label="AI ODHAD" color={D.muted} small />}
                </div>

                <div style={{ fontFamily: mono, fontSize: '0.6rem', color: D.muted, marginBottom: '0.5rem' }}>
                  {[t.segmentLabel || t.segment, t.city, t.country].filter(Boolean).join(' · ')}
                  {t.reviewRating && ` · ★ ${t.reviewRating} (${t.reviewCount || 0})`}
                </div>

                {/* Tags */}
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  {tags.map((tag, i) => <Chip key={i} label={tag.label} color={tag.color} small />)}
                </div>

                {/* AI Profile */}
                <div style={{ background: 'rgba(255,92,0,0.04)', border: `1px solid rgba(255,92,0,0.15)`, borderLeft: `2px solid ${D.orange}`, borderRadius: 3, padding: '0.65rem 0.85rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.42rem', letterSpacing: '2px', textTransform: 'uppercase', color: D.orange, marginBottom: '0.35rem' }}>🧠 AI Profil klienta</div>
                  {aiProfile.split('\n\n').slice(0, 2).map((para, i) => (
                    <p key={i} style={{ fontFamily: sans, fontSize: '0.7rem', color: i === 0 ? '#c9d1d9' : D.muted, lineHeight: 1.65, margin: 0, marginBottom: i < 1 ? '0.4rem' : 0 }}>{para}</p>
                  ))}
                </div>
              </div>

              {/* Match Score */}
              <div style={{ flexShrink: 0, textAlign: 'center', padding: '0.75rem', background: D.surface, border: `1px solid ${fitColor}33`, borderRadius: 8, minWidth: 120 }}>
                <div style={{ fontFamily: mono, fontSize: '0.42rem', letterSpacing: '2px', textTransform: 'uppercase', color: D.dimmed, marginBottom: '0.3rem' }}>MATCH SCORE</div>
                <div style={{ fontFamily: mono, fontSize: '3rem', fontWeight: 700, color: fitColor, lineHeight: 1 }}>{fit}</div>
                <div style={{ fontFamily: mono, fontSize: '0.4rem', color: D.dimmed, marginBottom: '0.5rem' }}>/100</div>
                {(() => {
                  const p = fit >= 80 ? 'CRITICAL' : fit >= 65 ? 'HIGH' : fit >= 45 ? 'MEDIUM' : 'LOW'
                  const pc = fit >= 80 ? D.red : fit >= 65 ? D.orange : fit >= 45 ? D.amber : D.muted
                  return <Chip label={p} color={pc} small />
                })()}
                {t.willingnessToSolve != null && (
                  <div style={{ fontFamily: mono, fontSize: '0.45rem', color: D.dimmed, marginTop: '0.4rem' }}>
                    Ochota: {t.willingnessToSolve}%
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── KPI CARDS ── */}
          <div style={{ padding: '1rem 1.75rem', borderBottom: `1px solid ${D.border}` }}>
            <div style={{ display: 'flex', gap: '0.65rem', overflowX: 'auto' }}>
              <KpiCard label="STRIKER Fit"         value={t.strikerFitScore}        color={D.orange} type={t.strikerFitScore ? 'FACT' : 'UNKNOWN'} />
              <KpiCard label="Teplotný tlak"       value={t.heatPressure}           color={D.red}    type={t.heatPressure ? (isLive ? 'LIVE_SIGNAL' : 'AI_ODHAD') : 'UNKNOWN'} />
              <KpiCard label="Potreba moderniz."   value={t.modernizationNeed}      color={D.amber}  type={t.modernizationNeed ? 'AI_ODHAD' : 'UNKNOWN'} />
              <KpiCard label="Prev. náklady"       value={t.operatingCostPressure}  color={D.amber}  type={t.operatingCostPressure ? 'AI_ODHAD' : 'UNKNOWN'} />
              <KpiCard label="Review signál"       value={t.reviewRating ? Math.round(t.reviewRating * 20) : null} color={D.green} type={t.reviewRating ? 'LIVE_SIGNAL' : 'UNKNOWN'} unit="" />
            </div>
          </div>

          {/* ── THREE COLUMN LAYOUT ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 260px', gap: 0, minHeight: 'calc(100vh - 400px)' }}>

            {/* ── LEFT PANEL ── */}
            <div style={{ borderRight: `1px solid ${D.border}`, padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {/* Why this client */}
              <div>
                <div style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: D.dimmed, marginBottom: '0.55rem' }}>PREČO TENTO KLIENT?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {whyList.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                      <span style={{ color: item.ok ? D.green : D.amber, flexShrink: 0, fontSize: '0.7rem', marginTop: '0.05rem' }}>{item.ok ? '✔' : '·'}</span>
                      <span style={{ fontFamily: mono, fontSize: '0.55rem', color: item.ok ? '#c9d1d9' : D.muted, lineHeight: 1.5 }}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick actions */}
              <div>
                <div style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: D.dimmed, marginBottom: '0.55rem' }}>RÝCHLE AKCIE</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {[
                    { label: '✉ Vytvoriť email',        action: () => setActiveTab('email')    },
                    { label: '🔍 Signal Engine',         action: handleSignalEngine, loading: signalLoading },
                    { label: '👤 Nájsť kontakty',        action: handleFindContacts, loading: findLoading   },
                    { label: '🧠 AI Analýza',            action: handleAiAnalyze,    loading: gatherLoading  },
                  ].map(({ label, action, loading }) => (
                    <button key={label} onClick={action} disabled={!!loading}
                      style={{ fontFamily: mono, fontSize: '0.55rem', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '0.35rem 0.65rem', border: `1px solid ${D.border2}`, background: 'transparent', color: loading ? D.muted : D.text, borderRadius: 3, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', opacity: loading ? 0.6 : 1 }}>
                      {loading ? '⏳ ...' : label}
                    </button>
                  ))}
                  {signalMsg && <div style={{ fontFamily: mono, fontSize: '0.5rem', color: signalMsg.startsWith('✅') ? D.green : D.amber }}>{signalMsg}</div>}
                  {findMsg   && <div style={{ fontFamily: mono, fontSize: '0.5rem', color: findMsg.startsWith('✅') ? D.green : D.amber }}>{findMsg}</div>}
                </div>
              </div>

              {/* Status */}
              <div>
                <div style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: D.dimmed, marginBottom: '0.5rem' }}>PIPELINE STAV</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  {INTEL_STATUS_LIST.slice(0, 5).map(s => (
                    <button key={s.key} onClick={() => updateTarget(t.id, { status: s.key })}
                      style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '0.25rem 0.55rem', border: `1px solid ${s.color}44`, background: t.status === s.key ? s.bg : 'transparent', color: t.status === s.key ? s.color : D.dimmed, borderRadius: 2, cursor: 'pointer', textAlign: 'left' }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── CENTER PANEL ── */}
            <div style={{ display: 'flex', flexDirection: 'column', borderRight: `1px solid ${D.border}` }}>
              {/* Tab nav */}
              <div style={{ display: 'flex', borderBottom: `1px solid ${D.border}`, padding: '0 1.1rem', background: D.surface, flexShrink: 0, overflowX: 'auto' }}>
                {CENTER_TABS.map(tab => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '0.65rem 0.85rem', border: 'none', borderBottom: `2px solid ${activeTab === tab.key ? D.orange : 'transparent'}`, background: 'transparent', color: activeTab === tab.key ? D.orange : D.muted, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', marginBottom: '-1px' }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.1rem' }}>

                {/* PREHĽAD */}
                {activeTab === 'overview' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <ProgressBar running={gatherLoading} maxSecs={15} type="ai" />

                    {/* AI profile full */}
                    <div style={{ background: D.surface, border: `1px solid ${D.border2}`, borderRadius: 4, padding: '1rem' }}>
                      <div style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '2px', textTransform: 'uppercase', color: D.orange, marginBottom: '0.5rem' }}>🧠 AI Profil klienta</div>
                      {aiProfile.split('\n\n').map((p, i) => (
                        <p key={i} style={{ fontFamily: sans, fontSize: '0.72rem', color: i===0?'#c9d1d9':D.muted, lineHeight: 1.7, margin: 0, marginBottom: '0.5rem' }}>{p}</p>
                      ))}
                    </div>

                    {/* Metrics grid */}
                    {t.heatPressure != null && (
                      <div>
                        <div style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '2px', textTransform: 'uppercase', color: D.dimmed, marginBottom: '0.5rem' }}>ENERGETICKÉ METRIKY</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                          {[
                            { label: 'Teplotný tlak',        value: t.heatPressure,          reason: t.heatPressureReason },
                            { label: 'Závislosť od tepla',   value: t.thermalDependency,      reason: t.thermalDependencyReason },
                            { label: 'Prev. náklady',        value: t.operatingCostPressure,  reason: t.operatingCostPressureReason },
                            { label: 'Modernizácia',         value: t.modernizationNeed,      reason: t.modernizationNeedReason },
                            { label: 'Závislosť od kotlov',  value: t.boilerDependencyProb,   reason: t.boilerDependencyProbReason },
                            { label: 'Ochota riešiť',        value: t.willingnessToSolve,     reason: t.willingnessToSolveReason },
                          ].map(({ label, value, reason }) => (
                            <div key={label} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 3, padding: '0.6rem 0.7rem' }}>
                              <div style={{ fontFamily: mono, fontSize: '0.42rem', letterSpacing: '1px', textTransform: 'uppercase', color: D.dimmed, marginBottom: '0.25rem' }}>{label}</div>
                              {value != null ? (
                                <>
                                  <div style={{ fontFamily: mono, fontSize: '1.1rem', fontWeight: 700, color: value>=70?D.orange:value>=45?D.amber:D.muted }}>{value}</div>
                                  <div style={{ height: 2, background: D.border, borderRadius: 1, overflow: 'hidden', margin: '0.2rem 0' }}>
                                    <div style={{ width: `${value}%`, height: '100%', background: value>=70?D.orange:value>=45?D.amber:D.muted }} />
                                  </div>
                                  {reason && <div style={{ fontFamily: mono, fontSize: '0.48rem', color: D.muted, lineHeight: 1.4 }}>{reason}</div>}
                                </>
                              ) : (
                                <div style={{ fontFamily: mono, fontSize: '0.52rem', color: D.dimmed, fontStyle: 'italic' }}>Čaká na analýzu</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pain points */}
                    {analysisResult?.painPoints?.length > 0 && (
                      <div style={{ background: D.surface, border: `1px solid ${D.border2}`, borderRadius: 4, padding: '0.85rem 1rem' }}>
                        <div style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '2px', textTransform: 'uppercase', color: D.dimmed, marginBottom: '0.45rem' }}>PAIN POINTS</div>
                        {analysisResult.painPoints.map((p, i) => (
                          <div key={i} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.22rem' }}>
                            <span style={{ color: D.red, flexShrink: 0 }}>⚠</span>
                            <span style={{ fontFamily: mono, fontSize: '0.6rem', color: '#c9d1d9', lineHeight: 1.5 }}>{p}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* AI ANALÝZA */}
                {activeTab === 'ai' && (
                  <div>
                    <ProgressBar running={gatherLoading} maxSecs={15} type="ai" />
                    <button onClick={handleAiAnalyze} disabled={gatherLoading}
                      style={{ fontFamily: mono, fontSize: '0.58rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.4rem 0.9rem', border: `1px solid ${D.amber}55`, background: 'rgba(255,170,0,0.08)', color: D.amber, borderRadius: 3, cursor: 'pointer', marginBottom: '1rem', opacity: gatherLoading ? 0.6 : 1 }}>
                      {gatherLoading ? '⏳ Analyzujem...' : '🧠 Spustiť AI Analýzu'}
                    </button>
                    {analysisResult ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ background: D.surface, border: `1px solid ${D.border2}`, borderRadius: 4, padding: '0.85rem 1rem' }}>
                          <div style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '2px', textTransform: 'uppercase', color: D.dimmed, marginBottom: '0.35rem' }}>SCORE</div>
                          <div style={{ fontFamily: mono, fontSize: '2rem', fontWeight: 700, color: D.orange }}>{analysisResult.score}<span style={{ fontSize: '0.8rem', color: D.muted }}>/10</span></div>
                        </div>
                        {analysisResult.reasoning && (
                          <div style={{ background: D.surface, border: `1px solid ${D.border2}`, borderRadius: 4, padding: '0.85rem 1rem' }}>
                            <div style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '2px', textTransform: 'uppercase', color: D.dimmed, marginBottom: '0.35rem' }}>REASONING</div>
                            <p style={{ fontFamily: sans, fontSize: '0.72rem', color: D.muted, lineHeight: 1.65, margin: 0 }}>{analysisResult.reasoning}</p>
                          </div>
                        )}
                        {analysisResult.mainArgument && (
                          <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(0,204,136,0.05)', border: `1px solid rgba(0,204,136,0.2)`, borderRadius: 3 }}>
                            <span style={{ fontFamily: mono, fontSize: '0.5rem', color: D.green }}>✦ {analysisResult.mainArgument}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontFamily: mono, fontSize: '0.62rem', color: D.dimmed, fontStyle: 'italic' }}>Klikni „🧠 Spustiť AI Analýzu" pre generovanie analýzy.</div>
                    )}
                  </div>
                )}

                {/* SIGNÁLY */}
                {activeTab === 'signals' && (
                  <div>
                    <ProgressBar running={signalLoading} maxSecs={12} type="signal" />
                    <button onClick={handleSignalEngine} disabled={signalLoading}
                      style={{ fontFamily: mono, fontSize: '0.58rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.4rem 0.9rem', border: `1px solid ${D.orange}55`, background: 'rgba(255,92,0,0.08)', color: D.orange, borderRadius: 3, cursor: 'pointer', marginBottom: '1rem', opacity: signalLoading ? 0.6 : 1 }}>
                      {signalLoading ? '⏳ Hľadám...' : '🔍 Signal Engine'}
                    </button>
                    {isLive && t.reviewSummary && (
                      <div style={{ background: D.surface, border: `1px solid rgba(0,204,136,0.25)`, borderLeft: `3px solid ${D.green}`, borderRadius: 3, padding: '0.75rem 0.9rem', marginBottom: '0.75rem' }}>
                        <Chip label="🔴 LIVE DATA" color={D.green} small />
                        <p style={{ fontFamily: sans, fontSize: '0.7rem', color: D.muted, lineHeight: 1.6, margin: '0.35rem 0 0' }}>{t.reviewSummary}</p>
                      </div>
                    )}
                    {(t.liveSignals || []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '1rem' }}>
                        {(t.liveSignals||[]).map((s,i) => <Chip key={i} label={s} color={D.amber} small />)}
                      </div>
                    )}
                    {!isLive && !(t.liveSignals||[]).length && (
                      <div style={{ fontFamily: mono, fontSize: '0.6rem', color: D.dimmed, fontStyle: 'italic' }}>Zatiaľ žiadne live signály. Klikni Signal Engine.</div>
                    )}
                  </div>
                )}

                {/* RECENZIE */}
                {activeTab === 'reviews' && (
                  <div>
                    {isLive ? (
                      <>
                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <Chip label="🔴 LIVE DATA" color={D.green} />
                          {t.reviewRating && <span style={{ fontFamily: mono, fontSize: '0.7rem', color: D.amber }}>★ {t.reviewRating} ({t.reviewCount||0})</span>}
                        </div>
                        {t.reviewSummary && <div style={{ background: D.surface, border: `1px solid ${D.border2}`, borderRadius: 3, padding: '0.75rem', marginBottom: '0.75rem' }}>
                          <p style={{ fontFamily: sans, fontSize: '0.72rem', color: '#c9d1d9', lineHeight: 1.65, margin: 0 }}>{t.reviewSummary}</p>
                        </div>}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                          {(t.liveSignals||[]).map((s,i) => <Chip key={i} label={s} color={D.amber} small />)}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontFamily: mono, fontSize: '0.6rem', color: D.dimmed, fontStyle: 'italic' }}>
                        Spusti Signal Engine pre načítanie Google recenzií.
                        <br /><br />
                        <button onClick={handleSignalEngine} disabled={signalLoading}
                          style={{ fontFamily: mono, fontSize: '0.55rem', padding: '0.3rem 0.7rem', border: `1px solid ${D.orange}44`, background: 'transparent', color: D.orange, borderRadius: 2, cursor: 'pointer' }}>
                          🔍 Signal Engine
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* KONTAKTY */}
                {activeTab === 'contacts' && (
                  <div>
                    <ProgressBar running={findLoading} maxSecs={15} type="ai" />
                    <button onClick={handleFindContacts} disabled={findLoading}
                      style={{ fontFamily: mono, fontSize: '0.58rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.4rem 0.9rem', border: `1px solid ${D.orange}55`, background: 'rgba(255,92,0,0.08)', color: D.orange, borderRadius: 3, cursor: 'pointer', marginBottom: '1rem', opacity: findLoading ? 0.6 : 1 }}>
                      {findLoading ? '⏳ Hľadám...' : '👤 Nájsť kontakty'}
                    </button>
                    {(t.contacts||[]).map((c,i) => (
                      <div key={i} style={{ background: D.surface, border: `1px solid ${D.border2}`, borderLeft: `3px solid ${D.green}`, borderRadius: 3, padding: '0.65rem 0.8rem', marginBottom: '0.4rem' }}>
                        {c.role && <div style={{ fontFamily: mono, fontSize: '0.46rem', letterSpacing: '1px', textTransform: 'uppercase', color: D.purple, marginBottom: '0.1rem' }}>{c.role}</div>}
                        <div style={{ fontFamily: sans, fontSize: '0.85rem', fontWeight: 600, color: D.text }}>{c.name || 'Meno neznáme'}</div>
                        {c.email && <a href={`mailto:${c.email}`} style={{ fontFamily: mono, fontSize: '0.56rem', color: D.green }}>✉ {c.email}</a>}
                        {c.phone && <div style={{ fontFamily: mono, fontSize: '0.56rem', color: D.muted }}>📞 {c.phone}</div>}
                        {c.confidence && <Chip label={c.confidence} color={c.confidence==='HIGH'?D.green:c.confidence==='MEDIUM'?D.amber:D.muted} small />}
                      </div>
                    ))}
                    {foundContacts && foundContacts.map((c,i) => (
                      <div key={i} style={{ background: D.surface, border: `1px solid rgba(0,204,136,0.25)`, borderRadius: 3, padding: '0.65rem 0.8rem', marginBottom: '0.4rem', position: 'relative' }}>
                        {c.role && <div style={{ fontFamily: mono, fontSize: '0.46rem', letterSpacing: '1px', textTransform: 'uppercase', color: D.purple, marginBottom: '0.1rem' }}>{c.role}</div>}
                        <div style={{ fontFamily: sans, fontSize: '0.85rem', fontWeight: 600, color: D.text }}>{c.name||'Meno neznáme'}</div>
                        {c.email ? <a href={`mailto:${c.email}`} style={{ fontFamily: mono, fontSize: '0.56rem', color: D.green }}>✉ {c.email}</a> : <div style={{ fontFamily: mono, fontSize: '0.52rem', color: D.dimmed, fontStyle: 'italic' }}>Email nenájdený.</div>}
                        <button onClick={() => { addContact(t.id, {...c, source: c.source||'web', confidence: c.confidence||'MEDIUM'}); setFoundContacts(prev=>prev.filter(fc=>fc!==c)) }}
                          style={{ position: 'absolute', top: '0.55rem', right: '0.55rem', fontFamily: mono, fontSize: '0.48rem', padding: '0.1rem 0.4rem', border: `1px solid ${D.green}44`, background: 'rgba(0,204,136,0.08)', color: D.green, borderRadius: 2, cursor: 'pointer' }}>
                          + Uložiť
                        </button>
                      </div>
                    ))}
                    {!t.contacts?.length && !foundContacts && (
                      <div style={{ fontFamily: mono, fontSize: '0.6rem', color: D.dimmed, fontStyle: 'italic' }}>Nenašla sa overená kontaktná osoba. Klikni „Nájsť kontakty".</div>
                    )}
                  </div>
                )}

                {/* EMAIL DRAFT */}
                {activeTab === 'email' && (
                  <EmailDraftEditor draft={emailDraft} onSave={handleSaveDraft} defaultLang="de" />
                )}

              </div>
            </div>

            {/* ── RIGHT PANEL ── */}
            <div style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>

              {/* Key contacts */}
              <div>
                <div style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: D.dimmed, marginBottom: '0.5rem' }}>KĽÚČOVÉ KONTAKTY</div>
                {t.email && <div style={{ marginBottom: '0.4rem' }}>
                  <a href={`mailto:${t.email}`} style={{ fontFamily: mono, fontSize: '0.58rem', color: D.green }}>✉ {t.email}</a>
                </div>}
                {(t.contacts||[]).slice(0,2).map((c,i) => (
                  <div key={i} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 3, padding: '0.45rem 0.6rem', marginBottom: '0.3rem' }}>
                    <div style={{ fontFamily: sans, fontSize: '0.72rem', fontWeight: 600, color: D.text }}>{c.name||'Kontakt'}</div>
                    {c.role && <div style={{ fontFamily: mono, fontSize: '0.45rem', color: D.purple }}>{c.role}</div>}
                    {c.email && <a href={`mailto:${c.email}`} style={{ fontFamily: mono, fontSize: '0.5rem', color: D.green }}>✉ {c.email}</a>}
                  </div>
                ))}
                {!t.contacts?.length && !t.email && (
                  <div style={{ fontFamily: mono, fontSize: '0.52rem', color: D.dimmed, fontStyle: 'italic' }}>Žiadne kontakty</div>
                )}
              </div>

              {/* Next best action */}
              {t.clientCard?.salesStrategy && (
                <div style={{ background: D.surface, border: `1px solid rgba(0,204,136,0.2)`, borderLeft: `3px solid ${D.green}`, borderRadius: 3, padding: '0.65rem 0.75rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '2px', textTransform: 'uppercase', color: D.green, marginBottom: '0.35rem' }}>ĎALŠÍ KROK</div>
                  <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#c9d1d9', lineHeight: 1.5 }}>{t.clientCard.salesStrategy.nextStep}</div>
                  <div style={{ marginTop: '0.35rem' }}>
                    <Chip label={`Začni: ${t.clientCard.salesStrategy.startWith||'email'}`} color={D.amber} small />
                  </div>
                </div>
              )}

              {/* Investment signals */}
              <div>
                <div style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: D.dimmed, marginBottom: '0.5rem' }}>INVESTIČNÉ SIGNÁLY</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {(t.liveSignals||[]).slice(0,5).map((s,i) => (
                    <div key={i} style={{ fontFamily: mono, fontSize: '0.52rem', color: D.muted, padding: '0.2rem 0.4rem', background: 'rgba(255,170,0,0.05)', border: `1px solid rgba(255,170,0,0.15)`, borderRadius: 2 }}>
                      📡 {s}
                    </div>
                  ))}
                  {!(t.liveSignals||[]).length && <div style={{ fontFamily: mono, fontSize: '0.52rem', color: D.dimmed, fontStyle: 'italic' }}>Spusti Signal Engine</div>}
                </div>
              </div>

              {/* AI Priority */}
              <div style={{ background: D.surface, border: `1px solid ${D.border2}`, borderRadius: 3, padding: '0.65rem 0.75rem' }}>
                <div style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '2px', textTransform: 'uppercase', color: D.dimmed, marginBottom: '0.35rem' }}>AI PRIORITA</div>
                {(() => {
                  const p = fit >= 80 ? { label: 'CRITICAL', color: D.red } : fit >= 65 ? { label: 'HIGH', color: D.orange } : fit >= 45 ? { label: 'MEDIUM', color: D.amber } : { label: 'LOW', color: D.muted }
                  return (
                    <>
                      <Chip label={p.label} color={p.color} />
                      <div style={{ fontFamily: mono, fontSize: '0.55rem', color: D.muted, marginTop: '0.35rem' }}>STRIKER FIT: {fit}/100</div>
                    </>
                  )
                })()}
              </div>
            </div>
          </div>

          {/* ── BOTTOM PANEL ── */}
          <div style={{ borderTop: `1px solid ${D.border}`, padding: '0.75rem 1.75rem', display: 'flex', gap: '1rem', alignItems: 'center', background: D.surface, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: mono, fontSize: '0.48rem', color: D.dimmed }}>
              Posledná analýza: {t.reviewsCachedAt ? new Date(t.reviewsCachedAt).toLocaleDateString('sk-SK') : '—'}
            </div>
            <div style={{ fontFamily: mono, fontSize: '0.48rem', color: D.dimmed }}>
              Zdroj: {isLive ? '🔴 Google Reviews + AI' : 'AI simulácia'}
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={handleSignalEngine} disabled={signalLoading}
              style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.22rem 0.65rem', border: `1px solid ${D.border2}`, background: 'transparent', color: D.muted, borderRadius: 2, cursor: 'pointer', opacity: signalLoading ? 0.6 : 1 }}>
              ↺ Refresh analýzy
            </button>
            <button onClick={onClose}
              style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.22rem 0.65rem', border: `1px solid ${D.border2}`, background: 'transparent', color: D.muted, borderRadius: 2, cursor: 'pointer' }}>
              Zavrieť
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
