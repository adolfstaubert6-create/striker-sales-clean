import { useState } from 'react'
import { updateTarget, addContact, removeContact } from '../services/intelTargetService.js'
import { INTEL_STATUS_LIST } from '../constants/intelMeta.js'
import ProgressBar from './ProgressBar.jsx'
import EmailDraftEditor from './EmailDraftEditor.jsx'

const mono = "'IBM Plex Mono',monospace"
const sans = "'IBM Plex Sans',sans-serif"

// ── Tokens ────────────────────────────────────────────────────────────────────
const T = {
  bg:      '#07090c',
  panel:   '#0d1117',
  card:    '#111418',
  border:  '#1a1f2a',
  orange:  '#ff5c00',
  amber:   '#ffaa00',
  green:   '#00cc88',
  red:     '#ef4444',
  purple:  '#818cf8',
  text:    '#e8eaed',
  sub:     '#9ca3af',
  dim:     '#6b7280',
  ghost:   '#374151',
}

// ── Data source badge ─────────────────────────────────────────────────────────
const DS = {
  live:      { label: 'ŽIVÉ DÁTA',       color: T.green  },
  ai:        { label: 'AI ODHAD',        color: T.amber  },
  verified:  { label: 'OVERENÝ ÚDAJ',   color: T.purple },
  unknown:   { label: 'NEOVERENÉ',       color: T.ghost  },
}

function Badge({ type = 'unknown' }) {
  const d = DS[type] || DS.unknown
  return (
    <span style={{ fontFamily: mono, fontSize: '0.38rem', letterSpacing: '1.5px', textTransform: 'uppercase',
      color: d.color, padding: '0.03rem 0.28rem', border: `1px solid ${d.color}44`,
      borderRadius: 2, background: `${d.color}10`, flexShrink: 0 }}>
      {d.label}
    </span>
  )
}

// ── Left nav ──────────────────────────────────────────────────────────────────
const NAV = [
  { key: 'overview',  icon: '◈', label: 'Prehľad'          },
  { key: 'problem',   icon: '⚡', label: 'Problém klienta'  },
  { key: 'signals',   icon: '◉', label: 'Signály'           },
  { key: 'contacts',  icon: '◎', label: 'Kontakty'          },
  { key: 'email',     icon: '✉', label: 'Email'             },
  { key: 'analysis',  icon: '◆', label: 'AI Analýza'        },
]

// ── KPI card ──────────────────────────────────────────────────────────────────
function KPI({ label, value, unit = '', source, color, note }) {
  const hasVal = value != null && value !== ''
  const col = color || (typeof value === 'number' ? (value >= 70 ? T.orange : value >= 45 ? T.amber : T.dim) : T.dim)
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: '1rem', flex: 1, minWidth: 130 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <div style={{ fontFamily: mono, fontSize: '0.42rem', letterSpacing: '2px', textTransform: 'uppercase', color: T.ghost }}>{label}</div>
        {source && <Badge type={source} />}
      </div>
      {hasVal ? (
        <>
          <div style={{ fontFamily: mono, fontSize: '1.6rem', fontWeight: 700, color: col, lineHeight: 1, marginBottom: '0.3rem' }}>
            {typeof value === 'number' ? value : value}{unit}
          </div>
          {typeof value === 'number' && (
            <div style={{ height: 3, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, value)}%`, height: '100%', background: col, borderRadius: 2, transition: 'width 0.5s ease' }} />
            </div>
          )}
          {note && <div style={{ fontFamily: mono, fontSize: '0.47rem', color: T.dim, marginTop: '0.3rem', lineHeight: 1.4 }}>{note}</div>}
        </>
      ) : (
        <div style={{ fontFamily: mono, fontSize: '0.6rem', color: T.ghost, fontStyle: 'italic', marginTop: '0.25rem' }}>Dáta zatiaľ neoverené</div>
      )}
    </div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────
function SH({ children }) {
  return <div style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: T.ghost, marginBottom: '1rem' }}>{children}</div>
}

// ── Contact row ───────────────────────────────────────────────────────────────
function CRow({ c, onRemove, action }) {
  const initials = (c.name || c.email || '?').charAt(0).toUpperCase()
  const avatarColors = [T.orange, T.purple, T.green, T.amber]
  const ac = avatarColors[(initials.charCodeAt(0) || 0) % avatarColors.length]
  const conf = { HIGH: T.green, MEDIUM: T.amber, LOW: T.dim }[c.confidence] || T.dim

  return (
    <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'flex-start', padding: '0.75rem', background: T.card, border: `1px solid ${T.border}`, borderRadius: 4, marginBottom: '0.4rem' }}>
      {/* Avatar */}
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${ac}18`, border: `1.5px solid ${ac}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontFamily: sans, fontSize: '0.85rem', fontWeight: 700, color: ac }}>{initials}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {c.name
          ? <div style={{ fontFamily: sans, fontSize: '0.8rem', fontWeight: 600, color: T.text, marginBottom: '0.05rem' }}>{c.name}</div>
          : <div style={{ fontFamily: mono, fontSize: '0.54rem', color: T.ghost, fontStyle: 'italic' }}>Meno neznáme</div>
        }
        {c.role && <div style={{ fontFamily: mono, fontSize: '0.45rem', letterSpacing: '1px', textTransform: 'uppercase', color: T.purple, marginBottom: '0.12rem' }}>{c.role}</div>}
        {c.email
          ? <a href={`mailto:${c.email}`} style={{ fontFamily: mono, fontSize: '0.54rem', color: T.green, display: 'block' }}>✉ {c.email}</a>
          : <div style={{ fontFamily: mono, fontSize: '0.52rem', color: T.ghost, fontStyle: 'italic' }}>Email nenájdený</div>
        }
        {c.phone && <div style={{ fontFamily: mono, fontSize: '0.52rem', color: T.dim, marginTop: '0.05rem' }}>📞 {c.phone}</div>}
        <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
          {c.confidence && <span style={{ fontFamily: mono, fontSize: '0.38rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: conf, padding: '0.02rem 0.25rem', border: `1px solid ${conf}44`, borderRadius: 2 }}>{c.confidence}</span>}
          {c.emailType && c.emailType !== 'PERSONAL' && <span style={{ fontFamily: mono, fontSize: '0.38rem', letterSpacing: '1px', textTransform: 'uppercase', color: T.amber, padding: '0.02rem 0.25rem', border: `1px solid ${T.amber}33`, borderRadius: 2 }}>{c.emailType}</span>}
        </div>
      </div>
      {(onRemove || action) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flexShrink: 0 }}>
          {action && <button onClick={action} style={{ fontFamily: mono, fontSize: '0.45rem', padding: '0.1rem 0.4rem', border: `1px solid ${T.green}44`, background: `${T.green}10`, color: T.green, borderRadius: 2, cursor: 'pointer' }}>+ Uložiť</button>}
          {onRemove && <button onClick={onRemove} style={{ background: 'transparent', border: 'none', color: T.ghost, fontSize: '0.7rem', cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>}
        </div>
      )}
    </div>
  )
}

// ── Metric row (compact, labeled) ─────────────────────────────────────────────
function MRow({ label, value, reason, source }) {
  if (value == null) return null
  const col = value >= 70 ? T.orange : value >= 45 ? T.amber : T.dim
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.22rem' }}>
        <span style={{ fontFamily: mono, fontSize: '0.52rem', color: T.sub }}>{label}</span>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          {source && <Badge type={source} />}
          <span style={{ fontFamily: mono, fontSize: '0.65rem', fontWeight: 700, color: col }}>{value}</span>
        </div>
      </div>
      <div style={{ height: 4, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: col, borderRadius: 2, transition: 'width 0.4s ease' }} />
      </div>
      {reason && <div style={{ fontFamily: mono, fontSize: '0.48rem', color: T.ghost, marginTop: '0.2rem', lineHeight: 1.4 }}>{reason}</div>}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ClientIntelligenceDashboard({ target: initialT, onClose }) {
  const [t, ]              = useState(initialT)
  const [nav,              setNav]             = useState('overview')
  const [analysisResult,   setAnalysisResult]  = useState(null)
  const [gatherLoading,    setGatherLoading]   = useState(false)
  const [signalLoading,    setSignalLoading]   = useState(false)
  const [signalMsg,        setSignalMsg]       = useState('')
  const [findLoading,      setFindLoading]     = useState(false)
  const [findMsg,          setFindMsg]         = useState('')
  const [foundContacts,    setFoundContacts]   = useState(null)
  const [emailDraft,       setEmailDraft]      = useState(
    t.emailDraft || { sk: { subject: '', body: '' }, de: { subject: '', body: '' }, en: { subject: '', body: '' } }
  )

  const fit     = t.strikerFitScore || t.overallScore || 0
  const fitCol  = fit >= 80 ? T.orange : fit >= 60 ? T.amber : T.dim
  const isLive  = t.reviewsSource === 'serpapi'
  const hasEnergy = t.heatPressure != null

  // ── API handlers (concise) ───────────────────────────────────────────────────

  async function runAnalysis() {
    setGatherLoading(true)
    try {
      const r = await fetch('/.netlify/functions/ai-analysis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyName: t.name, city: t.city, segment: t.segment, segmentLabel: t.segmentLabel, fitScore: t.strikerFitScore || 50, language: 'sk' }) })
      const d = await r.json()
      if (d.ok) {
        setAnalysisResult(d)
        if (d.subject || d.draft) setEmailDraft(p => ({ ...p, sk: { subject: d.subject || '', body: d.draft || '' } }))
      }
    } catch {}
    finally { setGatherLoading(false) }
  }

  async function runSignals() {
    setSignalLoading(true); setSignalMsg('')
    try {
      const r = await fetch('/.netlify/functions/serpapi-reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyName: t.name, url: t.web, segment: t.segment, segmentLabel: t.segmentLabel, city: t.city, country: t.country || 'DE', strikerFitScore: t.strikerFitScore || 50, painPoints: analysisResult?.painPoints || [], aiReasoning: analysisResult?.reasoning || '' }) })
      const d = await r.json()
      if (d.ok) {
        await updateTarget(t.id, { heatPressure: d.heatPressure, heatPressureReason: d.heatPressureReason, thermalDependency: d.thermalDependency, thermalDependencyReason: d.thermalDependencyReason, operatingCostPressure: d.operatingCostPressure, operatingCostPressureReason: d.operatingCostPressureReason, modernizationNeed: d.modernizationNeed, modernizationNeedReason: d.modernizationNeedReason, boilerDependencyProb: d.boilerDependencyProb, boilerDependencyProbReason: d.boilerDependencyProbReason, willingnessToSolve: d.willingnessToSolve, willingnessToSolveReason: d.willingnessToSolveReason, reviewsSource: d.reviewsSource, reviewsCachedAt: d.reviewsCachedAt, reviewRating: d.reviewRating, reviewCount: d.reviewCount, reviewSummary: d.reviewSummary, liveSignals: d.liveSignals || [] })
        setSignalMsg(d.reviewsSource === 'serpapi' ? `✅ ${d.reviewCount || 0} Google recenzií · ${(d.liveSignals || []).length} signálov` : '✅ AI signálová analýza')
      }
    } catch (e) { setSignalMsg('⚠ ' + e.message) }
    finally { setSignalLoading(false) }
  }

  async function runFindContacts() {
    setFindLoading(true); setFindMsg('')
    try {
      const r = await fetch('/.netlify/functions/find-contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyName: t.name, website: t.web, city: t.city, country: t.country || 'DE' }) })
      const d = await r.json()
      if (d.ok) {
        setFoundContacts(d.contacts || [])
        if (d.generalEmail && !t.email) await updateTarget(t.id, { email: d.generalEmail })
        setFindMsg(d.contacts?.length ? `✅ ${d.contacts.length} overených kontaktov` : 'Nenašla sa overená kontaktná osoba.')
      }
    } catch (e) { setFindMsg('⚠ ' + e.message) }
    finally { setFindLoading(false) }
  }

  async function saveDraft(lang, subject, body) {
    const updated = { ...emailDraft, [lang]: { subject, body } }
    setEmailDraft(updated)
    await updateTarget(t.id, { emailDraft: updated })
  }

  // ── Center sections ───────────────────────────────────────────────────────────

  function Center() {

    if (nav === 'overview') {
      const problem = t.clientCard?.clientProfile || analysisResult?.reasoning
      const nextStep = t.clientCard?.salesStrategy?.nextStep || analysisResult?.opportunity
      const mainContact = (t.contacts || [])[0]

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <SH>Prehľad klienta</SH>

          {/* Problem statement */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.orange}`, borderRadius: 4, padding: '1.1rem 1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.55rem' }}>
              <div style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '2px', textTransform: 'uppercase', color: T.orange }}>Problém klienta</div>
              <Badge type={isLive ? 'live' : problem ? 'ai' : 'unknown'} />
            </div>
            {problem
              ? <p style={{ fontFamily: sans, fontSize: '0.78rem', color: T.text, lineHeight: 1.65, margin: 0 }}>{problem.split('\n\n')[0].slice(0, 200)}</p>
              : <p style={{ fontFamily: sans, fontSize: '0.72rem', color: T.ghost, fontStyle: 'italic', margin: 0 }}>Spusti AI Analýzu alebo Signal Engine pre zistenie problému klienta.</p>
            }
          </div>

          {/* 4 KPIs */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <KPI label="STRIKER Fit"       value={fit || null}            source={fit ? 'verified' : 'unknown'} color={fitCol} />
            <KPI label="Teplotný tlak"     value={t.heatPressure ?? null} source={hasEnergy ? (isLive ? 'live' : 'ai') : 'unknown'} />
            <KPI label="Signály"           value={isLive ? (t.liveSignals || []).length : null} unit=" signálov" source={isLive ? 'live' : 'unknown'} color={T.green} note={isLive ? `★ ${t.reviewRating || '—'} Google` : null} />
            <KPI label="Ochota riešiť"     value={t.willingnessToSolve ?? null} source={hasEnergy ? 'ai' : 'unknown'} />
          </div>

          {/* Next step */}
          {nextStep && (
            <div style={{ background: `${T.green}08`, border: `1px solid ${T.green}22`, borderRadius: 4, padding: '1rem 1.25rem' }}>
              <div style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '2px', textTransform: 'uppercase', color: T.green, marginBottom: '0.45rem' }}>Odporúčaný ďalší krok</div>
              <div style={{ fontFamily: sans, fontSize: '0.8rem', color: T.text, marginBottom: '0.5rem' }}>{nextStep}</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={() => setNav('email')} style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.3rem 0.75rem', border: `1px solid ${T.green}55`, background: `${T.green}12`, color: T.green, borderRadius: 3, cursor: 'pointer' }}>✉ Otvoriť Email</button>
                {mainContact?.email && <a href={`mailto:${mainContact.email}`} style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.3rem 0.75rem', border: `1px solid ${T.border}`, background: 'transparent', color: T.dim, borderRadius: 3, textDecoration: 'none' }}>Kontakt: {mainContact.name || mainContact.email}</a>}
              </div>
            </div>
          )}

          {/* Pain points (concise) */}
          {analysisResult?.painPoints?.length > 0 && (
            <div>
              <SH>Kľúčové problémy</SH>
              {analysisResult.painPoints.slice(0, 3).map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', padding: '0.55rem 0.75rem', background: T.card, border: `1px solid ${T.border}`, borderRadius: 3, marginBottom: '0.35rem', alignItems: 'flex-start' }}>
                  <span style={{ color: T.red, flexShrink: 0, marginTop: '0.05rem' }}>▸</span>
                  <span style={{ fontFamily: sans, fontSize: '0.72rem', color: T.sub, lineHeight: 1.5 }}>{p}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (nav === 'problem') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <SH>Energetický problém</SH>
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button onClick={runSignals} disabled={signalLoading}
            style={{ fontFamily: mono, fontSize: '0.54rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.38rem 0.9rem', border: `1px solid ${T.orange}44`, background: signalLoading ? 'transparent' : `${T.orange}0d`, color: T.orange, borderRadius: 3, cursor: 'pointer', opacity: signalLoading ? 0.6 : 1 }}>
            {signalLoading ? '⏳ Analyzujem...' : '⚡ Spustiť Signal Engine'}
          </button>
          {signalMsg && <span style={{ fontFamily: mono, fontSize: '0.55rem', color: signalMsg.startsWith('✅') ? T.green : T.amber, alignSelf: 'center' }}>{signalMsg}</span>}
        </div>
        <ProgressBar running={signalLoading} maxSecs={12} type="signal" />
        {hasEnergy ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
            {[
              { label: 'Teplotný tlak',       val: t.heatPressure,          reason: t.heatPressureReason },
              { label: 'Závislosť od tepla',  val: t.thermalDependency,     reason: t.thermalDependencyReason },
              { label: 'Prevádzkové náklady', val: t.operatingCostPressure, reason: t.operatingCostPressureReason },
              { label: 'Potreba modernizácie', val: t.modernizationNeed,    reason: t.modernizationNeedReason },
              { label: 'Závislosť od kotlov', val: t.boilerDependencyProb,  reason: t.boilerDependencyProbReason },
              { label: 'Ochota riešiť',       val: t.willingnessToSolve,    reason: t.willingnessToSolveReason },
            ].map(({ label, val, reason }) => (
              <div key={label} style={{ padding: '0.75rem 0.9rem', background: T.card, border: `1px solid ${T.border}`, borderRadius: 3, marginBottom: '0.25rem' }}>
                <MRow label={label} value={val} reason={reason} source={isLive ? 'live' : 'ai'} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontFamily: mono, fontSize: '0.6rem', color: T.ghost, fontStyle: 'italic', padding: '1.5rem', textAlign: 'center', background: T.card, border: `1px solid ${T.border}`, borderRadius: 4 }}>
            Dáta zatiaľ neoverené — spusti Signal Engine.
          </div>
        )}
      </div>
    )

    if (nav === 'signals') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <SH>Signály</SH>
        {isLive && t.reviewSummary ? (
          <div style={{ background: T.card, border: `1px solid ${T.green}33`, borderLeft: `3px solid ${T.green}`, borderRadius: 4, padding: '1rem 1.2rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.55rem' }}>
              <Badge type="live" />
              {t.reviewRating && <span style={{ fontFamily: mono, fontSize: '0.6rem', color: T.amber }}>★ {t.reviewRating} ({t.reviewCount || 0} recenzií)</span>}
            </div>
            <p style={{ fontFamily: sans, fontSize: '0.72rem', color: T.sub, lineHeight: 1.65, margin: 0 }}>{t.reviewSummary}</p>
          </div>
        ) : (
          <div style={{ padding: '1.5rem', background: T.card, border: `1px solid ${T.border}`, borderRadius: 4, textAlign: 'center' }}>
            <div style={{ fontFamily: mono, fontSize: '0.6rem', color: T.ghost, fontStyle: 'italic', marginBottom: '0.75rem' }}>Dáta zatiaľ neoverené</div>
            <button onClick={() => { runSignals(); }} style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.3rem 0.8rem', border: `1px solid ${T.orange}44`, background: `${T.orange}0d`, color: T.orange, borderRadius: 3, cursor: 'pointer' }}>⚡ Signal Engine</button>
          </div>
        )}
        {(t.liveSignals || []).length > 0 && (
          <div>
            <SH>Detekované kľúčové slová</SH>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {(t.liveSignals || []).map((s, i) => (
                <span key={i} style={{ fontFamily: mono, fontSize: '0.5rem', padding: '0.1rem 0.4rem', border: `1px solid ${T.amber}44`, borderRadius: 3, color: T.amber, background: `${T.amber}0d` }}>{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    )

    if (nav === 'contacts') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <SH>Kontakty</SH>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={runFindContacts} disabled={findLoading}
            style={{ fontFamily: mono, fontSize: '0.54rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.38rem 0.9rem', border: `1px solid ${T.orange}44`, background: `${T.orange}0d`, color: T.orange, borderRadius: 3, cursor: 'pointer', opacity: findLoading ? 0.6 : 1 }}>
            {findLoading ? '⏳ Hľadám...' : '🔍 Nájsť kontakty'}
          </button>
          {findMsg && <span style={{ fontFamily: mono, fontSize: '0.55rem', color: findMsg.startsWith('✅') ? T.green : T.amber }}>{findMsg}</span>}
        </div>
        <ProgressBar running={findLoading} maxSecs={15} type="ai" />
        {t.email && (
          <div style={{ padding: '0.6rem 0.8rem', background: T.card, border: `1px solid ${T.border}`, borderRadius: 3, display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <Badge type="unknown" />
            <a href={`mailto:${t.email}`} style={{ fontFamily: mono, fontSize: '0.6rem', color: T.green }}>✉ {t.email}</a>
            <span style={{ fontFamily: mono, fontSize: '0.48rem', color: T.ghost }}>všeobecný email firmy</span>
          </div>
        )}
        {(t.contacts || []).map((c, i) => <CRow key={i} c={c} onRemove={() => removeContact(t.id, i)} />)}
        {foundContacts?.map((c, i) => (
          <CRow key={i} c={c} action={() => { addContact(t.id, { ...c, source: c.source || 'web', confidence: c.confidence || 'MEDIUM' }); setFoundContacts(p => p.filter(fc => fc !== c)) }} />
        ))}
        {!t.contacts?.length && !foundContacts && !t.email && (
          <div style={{ fontFamily: mono, fontSize: '0.6rem', color: T.ghost, fontStyle: 'italic', padding: '1.5rem', background: T.card, border: `1px solid ${T.border}`, borderRadius: 4, textAlign: 'center' }}>
            Dáta zatiaľ neoverené — klikni Nájsť kontakty.
          </div>
        )}
      </div>
    )

    if (nav === 'email') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <SH>Email</SH>
        <EmailDraftEditor draft={emailDraft} onSave={saveDraft} defaultLang="de" />
      </div>
    )

    if (nav === 'analysis') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <SH>AI Analýza</SH>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button onClick={runAnalysis} disabled={gatherLoading}
            style={{ fontFamily: mono, fontSize: '0.54rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.38rem 0.9rem', border: `1px solid ${T.amber}44`, background: `${T.amber}0d`, color: T.amber, borderRadius: 3, cursor: 'pointer', opacity: gatherLoading ? 0.6 : 1 }}>
            {gatherLoading ? '⏳ Analyzujem...' : '🧠 Spustiť AI Analýzu'}
          </button>
        </div>
        <ProgressBar running={gatherLoading} maxSecs={15} type="ai" />
        {analysisResult ? (
          <>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 4, padding: '1rem 1.25rem', textAlign: 'center' }}>
                <div style={{ fontFamily: mono, fontSize: '0.4rem', letterSpacing: '2px', textTransform: 'uppercase', color: T.ghost, marginBottom: '0.3rem' }}>Score</div>
                <div style={{ fontFamily: mono, fontSize: '2rem', fontWeight: 700, color: T.orange, lineHeight: 1 }}>{analysisResult.score}</div>
                <div style={{ fontFamily: mono, fontSize: '0.4rem', color: T.ghost }}>/10</div>
              </div>
              {analysisResult.mainArgument && (
                <div style={{ flex: 1, background: `${T.green}08`, border: `1px solid ${T.green}22`, borderRadius: 4, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontFamily: sans, fontSize: '0.72rem', color: T.text, lineHeight: 1.5 }}>✦ {analysisResult.mainArgument}</span>
                </div>
              )}
            </div>
            {analysisResult.reasoning && (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 4, padding: '1rem 1.25rem' }}>
                <div style={{ fontFamily: mono, fontSize: '0.4rem', letterSpacing: '2px', textTransform: 'uppercase', color: T.ghost, marginBottom: '0.4rem' }}>AI Reasoning <Badge type="ai" /></div>
                <p style={{ fontFamily: sans, fontSize: '0.72rem', color: T.sub, lineHeight: 1.65, margin: 0 }}>{analysisResult.reasoning}</p>
              </div>
            )}
            {analysisResult.painPoints?.length > 0 && (
              <div>
                <SH>Pain Points</SH>
                {analysisResult.painPoints.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', padding: '0.6rem 0.8rem', background: T.card, border: `1px solid ${T.border}`, borderRadius: 3, marginBottom: '0.3rem' }}>
                    <span style={{ color: T.red, flexShrink: 0 }}>▸</span>
                    <span style={{ fontFamily: sans, fontSize: '0.7rem', color: T.sub, lineHeight: 1.5 }}>{p}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontFamily: mono, fontSize: '0.6rem', color: T.ghost, fontStyle: 'italic', padding: '1.5rem', background: T.card, border: `1px solid ${T.border}`, borderRadius: 4, textAlign: 'center' }}>
            Dáta zatiaľ neoverené — spusti AI Analýzu.
          </div>
        )}
      </div>
    )

    return null
  }

  // ── Layout ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, background: T.bg, zIndex: 300, display: 'flex', overflow: 'hidden', fontFamily: sans }}>

      {/* ── LEFT ── */}
      <div style={{ width: 260, flexShrink: 0, background: '#050709', borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

        {/* Company image */}
        <div style={{ height: 190, flexShrink: 0, position: 'relative', background: `linear-gradient(160deg, #0d1117 0%, ${T.orange}08 100%)`, overflow: 'hidden' }}>
          {t.photoUrl
            ? <img src={t.photoUrl} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: sans, fontSize: '5rem', fontWeight: 700, color: `${T.orange}30`, lineHeight: 1 }}>
                  {(t.name || 'X').charAt(0)}
                </span>
              </div>
            )
          }
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, #050709 100%)' }} />
          <button onClick={onClose} style={{ position: 'absolute', top: '0.6rem', right: '0.6rem', background: 'rgba(0,0,0,0.55)', border: `1px solid ${T.border}`, color: T.dim, borderRadius: 3, padding: '0.18rem 0.5rem', fontFamily: mono, fontSize: '0.5rem', cursor: 'pointer', letterSpacing: '1px' }}>✕ ZAVRIEŤ</button>
        </div>

        {/* Company info */}
        <div style={{ padding: '0.9rem 1rem 0.8rem', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontFamily: sans, fontSize: '1rem', fontWeight: 700, color: T.text, lineHeight: 1.25, marginBottom: '0.25rem' }}>{t.name}</div>
          <div style={{ fontFamily: mono, fontSize: '0.52rem', color: T.dim, marginBottom: '0.2rem' }}>
            {[t.city, t.country].filter(Boolean).join(' · ')}
          </div>
          <div style={{ fontFamily: mono, fontSize: '0.5rem', color: T.ghost, marginBottom: '0.55rem' }}>
            {t.segmentLabel || t.segment || '—'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span style={{ fontFamily: mono, fontSize: '1.5rem', fontWeight: 700, color: fitCol, lineHeight: 1 }}>{fit || '—'}</span>
            <div>
              <div style={{ fontFamily: mono, fontSize: '0.38rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: T.ghost }}>STRIKER FIT</div>
              {isLive && <div style={{ fontFamily: mono, fontSize: '0.38rem', letterSpacing: '1px', color: T.green, marginTop: '0.05rem' }}>🔴 ŽIVÉ DÁTA</div>}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '0.5rem 0' }}>
          {NAV.map(item => {
            const active = item.key === nav
            return (
              <button key={item.key} onClick={() => setNav(item.key)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.6rem 1rem', background: active ? `${T.orange}0d` : 'transparent', border: 'none', borderLeft: `2px solid ${active ? T.orange : 'transparent'}`, color: active ? T.text : T.dim, fontFamily: mono, fontSize: '0.58rem', letterSpacing: '0.5px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' }}>
                <span style={{ fontSize: '0.8rem', width: 18, flexShrink: 0, textAlign: 'center', opacity: 0.7 }}>{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* ── CENTER ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 2.25rem', borderRight: `1px solid ${T.border}` }}>
        <Center />
      </div>

      {/* ── RIGHT — always visible ── */}
      <div style={{ width: 270, flexShrink: 0, overflowY: 'auto', padding: '1.25rem 1rem' }}>

        {/* Pipeline */}
        <SH>Stav obchodu</SH>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginBottom: '1.5rem' }}>
          {INTEL_STATUS_LIST.slice(0, 5).map(s => (
            <button key={s.key} onClick={() => updateTarget(t.id, { status: s.key })}
              style={{ display: 'block', width: '100%', fontFamily: mono, fontSize: '0.5rem', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '0.28rem 0.6rem', border: `1px solid ${s.color}33`, background: t.status === s.key ? s.bg : 'transparent', color: t.status === s.key ? s.color : T.ghost, borderRadius: 2, cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Contacts */}
        <SH>Kontakty</SH>
        {t.email && !t.contacts?.length && (
          <div style={{ padding: '0.5rem 0.65rem', background: T.card, border: `1px solid ${T.border}`, borderRadius: 3, marginBottom: '0.4rem' }}>
            <a href={`mailto:${t.email}`} style={{ fontFamily: mono, fontSize: '0.56rem', color: T.green }}>✉ {t.email}</a>
          </div>
        )}
        {(t.contacts || []).slice(0, 3).map((c, i) => <CRow key={i} c={c} />)}
        {!t.contacts?.length && !t.email && (
          <div style={{ fontFamily: mono, fontSize: '0.55rem', color: T.ghost, fontStyle: 'italic', marginBottom: '0.75rem' }}>Dáta zatiaľ neoverené</div>
        )}
        <button onClick={() => { setNav('contacts'); runFindContacts() }} disabled={findLoading}
          style={{ width: '100%', fontFamily: mono, fontSize: '0.5rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.3rem 0.6rem', border: `1px solid ${T.border}`, background: 'transparent', color: T.dim, borderRadius: 3, cursor: 'pointer', marginTop: '0.35rem', marginBottom: '1.5rem', opacity: findLoading ? 0.6 : 1 }}>
          {findLoading ? '⏳' : '🔍 Nájsť kontakty'}
        </button>

        {/* Quick actions */}
        <SH>Rýchle akcie</SH>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {[
            { label: '✉ Email',          action: () => setNav('email'),    col: T.green  },
            { label: '⚡ Signal Engine',  action: () => { runSignals(); setNav('signals') }, col: T.orange },
            { label: '🧠 AI Analýza',    action: () => { runAnalysis(); setNav('analysis') }, col: T.amber  },
          ].map(({ label, action, col }) => (
            <button key={label} onClick={action}
              style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '0.35rem 0.7rem', border: `1px solid ${col}33`, background: `${col}08`, color: col, borderRadius: 3, cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Data freshness */}
        <div style={{ marginTop: '1.5rem', padding: '0.6rem 0.75rem', background: T.card, border: `1px solid ${T.border}`, borderRadius: 3 }}>
          <div style={{ fontFamily: mono, fontSize: '0.4rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: T.ghost, marginBottom: '0.3rem' }}>Aktuálnosť dát</div>
          <div style={{ fontFamily: mono, fontSize: '0.54rem', color: isLive ? T.green : T.dim, marginBottom: '0.1rem' }}>{isLive ? '🔴 Živé Google dáta' : 'AI simulácia'}</div>
          {t.reviewsCachedAt && <div style={{ fontFamily: mono, fontSize: '0.48rem', color: T.ghost }}>{new Date(t.reviewsCachedAt).toLocaleDateString('sk-SK')}</div>}
        </div>
      </div>
    </div>
  )
}
