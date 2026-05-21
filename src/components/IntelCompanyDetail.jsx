import { useState } from 'react'
import {
  INTEL_STATUSES, STATUS_MAP, REC_META, INTENT_META,
  SOURCE_TYPES, CONTACT_ROLES, scoreColor,
} from '../constants/intelMeta.js'
import {
  updateTarget, deleteTarget, addSource, removeSource, addContact, removeContact,
  updateIntelligence,
} from '../services/intelTargetService.js'

const mono = "'IBM Plex Mono', monospace"
const sans = "'IBM Plex Sans', sans-serif"

// ── Malé zdieľané komponenty ──────────────────────────────────────────────────

function ScoreBar({ score, label, reason }) {
  const color = scoreColor(score)
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.18rem' }}>
        <span style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6b7280' }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: '0.88rem', fontWeight: 700, color }}>{score ?? '–'}%</span>
      </div>
      <div style={{ height: 5, background: '#1e2530', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${score ?? 0}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      {reason && <div style={{ fontFamily: mono, fontSize: '0.52rem', color: '#4b5563', marginTop: '0.2rem', lineHeight: 1.4 }}>{reason}</div>}
    </div>
  )
}

function SectionCard({ title, icon, children }) {
  return (
    <div style={{ background: '#111418', border: '1px solid #1e2530', borderRadius: 4, padding: '1.25rem 1.4rem', marginBottom: '1rem' }}>
      <div style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#ff5c00', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {icon && <span>{icon}</span>}{title}
      </div>
      {children}
    </div>
  )
}

function FieldLabel({ children }) {
  return <div style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#374151', marginBottom: '0.35rem' }}>{children}</div>
}

function Chip({ children, color = '#6b7280', bg = 'transparent', border }) {
  return (
    <span style={{
      fontFamily: mono, fontSize: '0.55rem', letterSpacing: '0.5px',
      padding: '0.15rem 0.5rem', borderRadius: 2, display: 'inline-block',
      color, background: bg, border: `1px solid ${border || color + '44'}`,
    }}>{children}</span>
  )
}

// ── Hlavný komponent ──────────────────────────────────────────────────────────

export default function IntelCompanyDetail({ target: t, onClose, onDelete }) {
  const [editSignals, setEditSignals]     = useState(false)
  const [signalsDraft, setSignalsDraft]   = useState('')
  const [addSrcOpen, setAddSrcOpen]       = useState(false)
  const [newSrc, setNewSrc]               = useState({ type: 'web', url: '', title: '', description: '' })
  const [addCtOpen, setAddCtOpen]         = useState(false)
  const [newCt, setNewCt]                 = useState({ role: '', name: '', email: '', linkedin: '', phone: '' })
  const [prefillRole, setPrefillRole]     = useState('')
  const [saving, setSaving]               = useState({})
  const [confirmDel, setConfirmDel]       = useState(false)
  const [gathering, setGathering]         = useState(false)
  const [gatherResult, setGatherResult]   = useState(null)
  const [gatherError, setGatherError]     = useState(null)

  const id = t.id

  async function withSaving(key, fn) {
    setSaving(p => ({ ...p, [key]: true }))
    try { await fn() } catch (e) { console.error('[detail]', key, e.message) }
    finally { setSaving(p => ({ ...p, [key]: false })) }
  }

  async function handleStatus(status) {
    await withSaving('status', () => updateTarget(id, { status }))
  }

  async function handleSaveSignals() {
    const signals = signalsDraft.split('\n').map(s => s.trim()).filter(Boolean)
    await withSaving('signals', () => updateTarget(id, { signals, whyFound: t.whyFound }))
    setEditSignals(false)
  }

  async function handleAddSource() {
    if (!newSrc.url.trim() && !newSrc.title.trim()) return
    await withSaving('src', () => addSource(id, newSrc))
    setNewSrc({ type: 'web', url: '', title: '', description: '' })
    setAddSrcOpen(false)
  }

  async function handleRemoveSource(idx) {
    await withSaving(`src-${idx}`, () => removeSource(id, t.sources || [], idx))
  }

  async function handleAddContact() {
    if (!newCt.role.trim() && !newCt.name.trim()) return
    await withSaving('ct', () => addContact(id, newCt))
    setNewCt({ role: '', name: '', email: '', linkedin: '', phone: '' })
    setAddCtOpen(false)
    setPrefillRole('')
  }

  async function handleRemoveContact(idx) {
    await withSaving(`ct-${idx}`, () => removeContact(id, t.contacts || [], idx))
  }

  function openContactWithRole(role) {
    setNewCt(p => ({ ...p, role }))
    setPrefillRole(role)
    setAddCtOpen(true)
  }

  async function handleDelete() {
    await deleteTarget(id)
    onDelete?.()
    onClose()
  }

  async function handleGatherIntelligence() {
    setGathering(true)
    setGatherError(null)
    setGatherResult(null)
    try {
      const res  = await fetch('/.netlify/functions/intelligence-gather', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          companyName:        t.name,
          url:                t.web,
          segment:            t.segment,
          segmentLabel:       t.segmentLabel,
          city:               t.city,
          country:            t.country,
          urgencyScore:       t.urgencyScore,
          buyingIntentScore:  t.buyingIntentScore,
          strikerFitScore:    t.strikerFitScore,
          heatDemandScore:    t.heatDemandScore,
          energyPainScore:    t.energyPainScore,
          financialPowerScore:t.financialPowerScore,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`)

      // Uložiť výsledky do Firestore
      await updateIntelligence(id, {
        newSignals:       data.signals      || [],
        newSources:       data.sources      || [],
        updatedScores:    data.updatedScores,
        aiInterpretation: data.aiInterpretation,
        jobSignals:       data.jobSignals   || [],
        keyEvidence:      data.keyEvidence  || [],
        scrapedPages:     data.scrapedPages || [],
        existingSignals:  t.signals  || [],
        existingSources:  t.sources  || [],
      })

      setGatherResult(data)
    } catch (e) {
      setGatherError(e.message)
    } finally {
      setGathering(false)
    }
  }

  const rec    = REC_META[t.recommendation]  || REC_META.monitor
  const intent = INTENT_META[t.buyingIntent] || INTENT_META.medium
  const status = STATUS_MAP[t.status]        || INTEL_STATUSES[0]

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', overflowY: 'auto', zIndex: 200, padding: '1.5rem 1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ maxWidth: 960, margin: '0 auto', background: '#0d1117', border: '1px solid #1e2530', borderRadius: 4, position: 'relative' }}>

      {/* Modal hlavička — akcie */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.4rem', borderBottom: '1px solid #1e2530' }}>
        <button
          onClick={handleGatherIntelligence}
          disabled={gathering}
          style={{ ...css.gatherBtn, opacity: gathering ? 0.7 : 1 }}>
          {gathering ? '⏳ Zbierám signály...' : '🔍 Zbierať signály z internetu'}
        </button>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={() => setConfirmDel(true)} style={css.deleteBtn}>🗑 Odstrániť</button>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#6b7280', fontSize: '1.1rem', cursor: 'pointer', padding: '0 0.25rem', lineHeight: 1 }}>✕</button>
        </div>
      </div>

      {/* Vnútorný obsah — s paddingom */}
      <div style={{ padding: '1.4rem' }}>

      {/* Progress overlay zbierania */}
      {gathering && (
        <div style={{ background: '#0d1117', border: '1px solid #ff5c0033', borderLeft: '3px solid #ff5c00', borderRadius: 4, padding: '1.1rem 1.4rem', marginBottom: '1rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.58rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#ff5c00', marginBottom: '0.85rem' }}>
            ◈ ZBIERANIE REÁLNYCH SIGNÁLOV...
          </div>
          {[
            '🌐 Načítavam web firmy (Firecrawl)...',
            '🔎 Vyhľadávam externé správy a signály (Brave Search)...',
            '💼 Hľadám pracovné ponuky (Energy Manager, Facility Manager)...',
            '🤖 AI interpretuje nájdené dáta — reálny tlak vs. marketing...',
            '💾 Aktualizujem kartu firmy...',
          ].map((step, i) => (
            <div key={i} style={{ fontFamily: mono, fontSize: '0.58rem', color: '#374151', marginBottom: '0.25rem' }}>
              ✦ {step}
            </div>
          ))}
        </div>
      )}

      {/* Výsledok zbierania — rýchle zhrnutie */}
      {gatherResult && !gathering && (
        <div style={{ background: '#0d1117', border: '1px solid #00cc8844', borderLeft: '3px solid #00cc88', borderRadius: 4, padding: '1rem 1.4rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.55rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#00cc88' }}>
              ✓ Signály zozbierané · {gatherResult.elapsed}
            </div>
            <div style={{ display: 'flex', gap: '0.65rem' }}>
              {gatherResult.capabilities?.firecrawl
                ? <span style={{ fontFamily: mono, fontSize: '0.48rem', color: '#00cc88' }}>✓ Firecrawl ({gatherResult.webPagesCount} str.)</span>
                : <span style={{ fontFamily: mono, fontSize: '0.48rem', color: '#374151' }}>— Firecrawl (API kľúč chýba)</span>}
              {gatherResult.capabilities?.brave
                ? <span style={{ fontFamily: mono, fontSize: '0.48rem', color: '#00cc88' }}>✓ Brave ({gatherResult.searchCount} výsl.)</span>
                : <span style={{ fontFamily: mono, fontSize: '0.48rem', color: '#374151' }}>— Brave (API kľúč chýba)</span>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.57rem', color: '#9ca3af' }}>
              <span style={{ color: '#00cc88' }}>▸</span> {gatherResult.webPagesCount} stránok nájdených
            </div>
            <div style={{ fontFamily: mono, fontSize: '0.57rem', color: '#9ca3af' }}>
              <span style={{ color: '#ffaa00' }}>▸</span> {(gatherResult.signals || []).length} nových signálov
            </div>
            <div style={{ fontFamily: mono, fontSize: '0.57rem', color: '#9ca3af' }}>
              <span style={{ color: '#818cf8' }}>▸</span> {(gatherResult.jobSignals || []).length} job signálov
            </div>
            <div style={{ fontFamily: mono, fontSize: '0.57rem', color: gatherResult.aiInterpretation?.isRealPressure ? '#ff5c00' : '#6b7280' }}>
              <span>▸</span> {gatherResult.aiInterpretation?.pressureLevel ? `Tlak: ${gatherResult.aiInterpretation.pressureLevel}` : (gatherResult.aiInterpretation?.isRealPressure ? 'REÁLNY TLAK' : 'Skôr marketing')}
            </div>
          </div>
          {gatherResult.aiInterpretation?.strikerArgument && (
            <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#00cc88', lineHeight: 1.5, marginBottom: '0.4rem' }}>
              ✦ {gatherResult.aiInterpretation.strikerArgument}
            </div>
          )}
          {gatherResult.aiInterpretation?.timingAssessment && (
            <div style={{ fontFamily: mono, fontSize: '0.58rem', color: '#6b7280', lineHeight: 1.5, paddingTop: '0.4rem', borderTop: '1px solid #1e2530' }}>
              🕐 {gatherResult.aiInterpretation.timingAssessment}
            </div>
          )}
          <button style={{ ...css.ghostBtn, marginTop: '0.5rem' }} onClick={() => setGatherResult(null)}>Skryť</button>
        </div>
      )}

      {/* Chyba zbierania */}
      {gatherError && !gathering && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid #ef444466', borderRadius: 3, padding: '0.6rem 0.85rem', marginBottom: '1rem', fontFamily: mono, fontSize: '0.62rem', color: '#ef4444' }}>
          ⚠ Chyba zbierania signálov: {gatherError}
        </div>
      )}

      {/* Hlavička firmy */}
      <div style={{ background: '#0d1117', border: '1px solid #1e2530', borderLeft: `3px solid ${scoreColor(t.overallScore)}`, borderRadius: 4, padding: '1.25rem 1.4rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#ff5c00', marginBottom: '0.4rem' }}>
              ◈ KARTA FIRMY
            </div>
            <div style={{ fontFamily: sans, fontSize: '1.3rem', fontWeight: 700, color: '#e8eaed', marginBottom: '0.3rem' }}>{t.name}</div>
            <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#6b7280', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              {t.web      && <span>🌐 {t.web}</span>}
              {(t.city || t.country) && <span>📍 {[t.city, t.country].filter(Boolean).join(', ')}</span>}
              {t.segmentLabel && <span>{t.segmentLabel}</span>}
              {t.companySize  && <span>🏢 {t.companySize}</span>}
              {t.employees    && <span>👥 {t.employees} zamestnancov</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: mono, fontSize: '2.8rem', fontWeight: 700, color: scoreColor(t.overallScore), lineHeight: 1 }}>
              {t.overallScore ?? '–'}
            </div>
            <div style={{ fontFamily: mono, fontSize: '0.45rem', color: '#6b7280', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              STRIKER FIT / 100
            </div>
          </div>
        </div>

        {/* Skóre */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginTop: '1.1rem', paddingTop: '1rem', borderTop: '1px solid #1e2530' }}>
          {[
            { score: t.strikerFitScore,    label: 'Striker Fit',     reason: t.strikerFitReason },
            { score: t.energyPainScore,    label: 'Energ. problém',  reason: t.energyPainReason },
            { score: t.urgencyScore,       label: 'Urgentnosť',      reason: t.urgencyReason    },
            { score: t.financialPowerScore,label: 'Fin. sila',       reason: t.financialPowerReason },
            { score: t.buyingIntentScore,  label: 'Záujem o kúpu',  reason: t.buyingIntentReason },
          ].map(({ score, label, reason }) => (
            <ScoreBar key={label} score={score} label={label} reason={reason} />
          ))}
        </div>
      </div>

      {/* Stav firmy + odporúčanie */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>

        {/* Stav */}
        <SectionCard title="Stav firmy" icon="📊">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {INTEL_STATUSES.map(s => (
              <button
                key={s.key}
                onClick={() => handleStatus(s.key)}
                disabled={!!saving.status}
                style={{
                  fontFamily: mono, fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase',
                  padding: '0.28rem 0.65rem', borderRadius: 2, cursor: 'pointer', border: `1px solid ${s.border}`,
                  background: t.status === s.key ? s.bg : 'transparent',
                  color: t.status === s.key ? s.color : '#374151',
                  fontWeight: t.status === s.key ? 700 : 400,
                }}>
                {s.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontFamily: mono, fontSize: '0.5rem', color: '#4b5563', letterSpacing: '1px', textTransform: 'uppercase' }}>Záujem:</span>
            <span style={{ fontFamily: mono, fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: 2, color: intent.color, background: intent.bg, border: `1px solid ${intent.border}` }}>
              ● {intent.label}
            </span>
          </div>
        </SectionCard>

        {/* Odporúčanie AI */}
        <SectionCard title="Odporúčanie AI" icon="🎯">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.9rem', borderRadius: 3, background: rec.bg, border: `1px solid ${rec.border}`, marginBottom: '0.85rem' }}>
            <span>{rec.icon}</span>
            <span style={{ fontFamily: mono, fontSize: '0.6rem', letterSpacing: '2px', textTransform: 'uppercase', color: rec.color, fontWeight: 700 }}>{rec.label}</span>
          </div>
          {t.recommendationReason && (
            <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#9ca3af', lineHeight: 1.65, marginBottom: '0.65rem' }}>{t.recommendationReason}</div>
          )}
          {t.nextStep && (
            <div style={{ fontFamily: mono, fontSize: '0.65rem', color: '#00cc88', lineHeight: 1.5 }}>→ {t.nextStep}</div>
          )}
        </SectionCard>
      </div>

      {/* PREČO BOLA FIRMA NÁJDENÁ */}
      <SectionCard title="Prečo bola firma nájdená" icon="🔍">
        {t.whyFound && (
          <div style={{ fontFamily: mono, fontSize: '0.65rem', color: '#9ca3af', lineHeight: 1.7, marginBottom: '1rem', padding: '0.65rem 0.8rem', background: '#0d1117', borderRadius: 3, border: '1px solid #1e2530' }}>
            {t.whyFound}
          </div>
        )}
        {/* AI zhrnutie z posledného zbierania — Firecrawl výsledky */}
        {t.lastGatherSummary && (
          <div style={{ background: '#0a0c0f', border: '1px solid #1e2530', borderRadius: 3, padding: '0.85rem 1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
              <div style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#374151' }}>
                Výsledok Firecrawl analýzy
              </div>
              {t.lastGatherSummary.pressureLevel && (
                <span style={{
                  fontFamily: mono, fontSize: '0.48rem', letterSpacing: '1.5px', textTransform: 'uppercase',
                  padding: '0.12rem 0.45rem', borderRadius: 2, fontWeight: 700,
                  color:       t.lastGatherSummary.pressureLevel === 'kritický' ? '#ff5c00' : t.lastGatherSummary.pressureLevel === 'vysoký' ? '#ffaa00' : '#6b7280',
                  background:  t.lastGatherSummary.pressureLevel === 'kritický' ? 'rgba(255,92,0,0.12)' : t.lastGatherSummary.pressureLevel === 'vysoký' ? 'rgba(255,170,0,0.12)' : 'rgba(107,114,128,0.1)',
                  border:      `1px solid ${t.lastGatherSummary.pressureLevel === 'kritický' ? '#ff5c0044' : t.lastGatherSummary.pressureLevel === 'vysoký' ? '#ffaa0044' : '#6b728044'}`,
                }}>
                  TLAK: {t.lastGatherSummary.pressureLevel?.toUpperCase()}
                </span>
              )}
            </div>

            {/* Tematické nálezy */}
            {[
              { icon: '⚡', label: 'Energetické náklady', field: 'energyFindings' },
              { icon: '🔧', label: 'Modernizácia / Rekonštrukcia', field: 'modernizationFindings' },
              { icon: '🌱', label: 'ESG / Udržateľnosť', field: 'esgFindings' },
            ].map(({ icon, label, field }) => t.lastGatherSummary[field] && (
              <div key={field} style={{ marginBottom: '0.5rem' }}>
                <div style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.18rem' }}>
                  {icon} {label}
                </div>
                <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#9ca3af', lineHeight: 1.6 }}>
                  {t.lastGatherSummary[field]}
                </div>
              </div>
            ))}

            {/* Hodnotenie tlaku */}
            {t.lastGatherSummary.pressureExplanation && (
              <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #1e2530', fontFamily: mono, fontSize: '0.6rem', lineHeight: 1.6,
                color: t.lastGatherSummary.isRealPressure ? '#ff5c00' : '#6b7280' }}>
                {t.lastGatherSummary.isRealPressure ? '⚡ REÁLNY TLAK: ' : '💬 Marketing: '}
                {t.lastGatherSummary.pressureExplanation}
              </div>
            )}

            {/* Vhodný čas? */}
            {t.lastGatherSummary.timingAssessment && (
              <div style={{ marginTop: '0.35rem', fontFamily: mono, fontSize: '0.6rem', color: '#6b7280', lineHeight: 1.5 }}>
                🕐 {t.lastGatherSummary.timingAssessment}
              </div>
            )}

            {/* STRIKER argument */}
            {t.lastGatherSummary.strikerArgument && (
              <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #1e2530', fontFamily: mono, fontSize: '0.62rem', color: '#00cc88', lineHeight: 1.6 }}>
                ✦ {t.lastGatherSummary.strikerArgument}
              </div>
            )}
          </div>
        )}

        {/* Naskenované stránky */}
        {(t.scrapedPages || []).length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <FieldLabel>Naskenované stránky webu</FieldLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {t.scrapedPages.map((p, i) => (
                <span key={i} style={{
                  fontFamily: mono, fontSize: '0.5rem', padding: '0.15rem 0.5rem', borderRadius: 2,
                  color:      p.found ? (p.energyHits > 0 ? '#ffaa00' : '#00cc88') : '#374151',
                  background: p.found ? (p.energyHits > 0 ? 'rgba(255,170,0,0.08)' : 'rgba(0,204,136,0.08)') : 'transparent',
                  border:     `1px solid ${p.found ? (p.energyHits > 0 ? '#ffaa0033' : '#00cc8833') : '#1e2530'}`,
                  title:      p.url,
                }}>
                  {p.found ? (p.energyHits > 0 ? `⚡ ${p.categoryLabel}` : `✓ ${p.categoryLabel}`) : `— ${p.categoryLabel}`}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Kľúčové dôkazy z webu */}
        {(t.keyEvidence || []).length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <FieldLabel>Kľúčové dôkazy a citácie</FieldLabel>
            {t.keyEvidence.map((ev, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.3rem', alignItems: 'flex-start' }}>
                <span style={{ color: '#ffaa00', fontFamily: mono, fontSize: '0.65rem', flexShrink: 0 }}>„</span>
                <span style={{ fontFamily: mono, fontSize: '0.6rem', color: '#9ca3af', lineHeight: 1.5, fontStyle: 'italic' }}>{ev}</span>
              </div>
            ))}
          </div>
        )}

        {/* Job signály z internetu */}
        {(t.jobSignals || []).length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <FieldLabel>Detekované pracovné signály</FieldLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {t.jobSignals.map((j, i) => (
                <div key={i} title={j.context} style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '0.15rem 0.55rem', borderRadius: 2, color: '#818cf8', background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.3)' }}>
                  💼 {j.role}
                </div>
              ))}
            </div>
          </div>
        )}

        <FieldLabel>Problémové signály a dôvody výberu</FieldLabel>
        {!editSignals ? (
          <div>
            {(t.signals || []).length === 0
              ? <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#374151' }}>Žiadne signály — zbieraj signály z internetu</div>
              : (t.signals || []).map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.3rem', alignItems: 'flex-start' }}>
                    <span style={{ color: '#ff5c00', fontFamily: mono, fontSize: '0.65rem', flexShrink: 0 }}>▸</span>
                    <span style={{ fontFamily: mono, fontSize: '0.63rem', color: '#9ca3af', lineHeight: 1.5 }}>{s}</span>
                  </div>
                ))
            }
            <button
              style={{ ...css.ghostBtn, marginTop: '0.65rem' }}
              onClick={() => { setSignalsDraft((t.signals || []).join('\n')); setEditSignals(true) }}>
              ✏ Upraviť signály
            </button>
          </div>
        ) : (
          <div>
            <textarea
              style={{ ...css.textarea, minHeight: 120 }}
              value={signalsDraft}
              onChange={e => setSignalsDraft(e.target.value)}
              placeholder="Každý signál na nový riadok..."
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button style={css.saveBtn} onClick={handleSaveSignals} disabled={saving.signals}>
                {saving.signals ? '⏳' : '✓ Uložiť'}
              </button>
              <button style={css.cancelBtn} onClick={() => setEditSignals(false)}>Zrušiť</button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* DÔKAZY A ZDROJE */}
      <SectionCard title="Dôkazy a zdroje" icon="📎">
        {(t.sources || []).length === 0 && !addSrcOpen && (
          <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#374151', marginBottom: '0.75rem' }}>Žiadne zdroje — pridaj prvý dôkaz</div>
        )}
        {(t.sources || []).map((src, i) => {
          const typeLabel = SOURCE_TYPES.find(x => x.value === src.type)?.label || src.type
          return (
            <div key={i} style={{ background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3, padding: '0.7rem 0.85rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280', background: '#1e2530', padding: '0.1rem 0.35rem', borderRadius: 2 }}>
                      {typeLabel}
                    </span>
                    {src.title && <span style={{ fontFamily: mono, fontSize: '0.65rem', fontWeight: 600, color: '#e8eaed' }}>{src.title}</span>}
                  </div>
                  {src.url && (
                    <a href={src.url} target="_blank" rel="noreferrer" style={{ fontFamily: mono, fontSize: '0.58rem', color: '#818cf8', display: 'block', marginBottom: '0.2rem', wordBreak: 'break-all' }}>
                      {src.url}
                    </a>
                  )}
                  {src.description && <div style={{ fontFamily: mono, fontSize: '0.58rem', color: '#6b7280', lineHeight: 1.4 }}>{src.description}</div>}
                </div>
                <button
                  onClick={() => handleRemoveSource(i)}
                  disabled={!!saving[`src-${i}`]}
                  style={{ background: 'transparent', border: 'none', color: '#374151', cursor: 'pointer', fontFamily: mono, fontSize: '0.7rem', flexShrink: 0 }}>
                  ✕
                </button>
              </div>
            </div>
          )
        })}

        {addSrcOpen ? (
          <div style={{ background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3, padding: '0.85rem', marginTop: '0.5rem' }}>
            <FieldLabel>Typ zdroja</FieldLabel>
            <select style={{ ...css.input, marginBottom: '0.5rem' }} value={newSrc.type} onChange={e => setNewSrc(p => ({ ...p, type: e.target.value }))}>
              {SOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <FieldLabel>URL / Odkaz</FieldLabel>
            <input style={{ ...css.input, marginBottom: '0.5rem' }} placeholder="https://..." value={newSrc.url} onChange={e => setNewSrc(p => ({ ...p, url: e.target.value }))} />
            <FieldLabel>Názov / Popis (voliteľné)</FieldLabel>
            <input style={{ ...css.input, marginBottom: '0.5rem' }} placeholder="napr. Pracovná ponuka — Energy Manager" value={newSrc.title} onChange={e => setNewSrc(p => ({ ...p, title: e.target.value }))} />
            <textarea style={{ ...css.textarea, minHeight: 60, marginBottom: '0.5rem' }} placeholder="Textový dôkaz alebo poznámka..." value={newSrc.description} onChange={e => setNewSrc(p => ({ ...p, description: e.target.value }))} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button style={css.saveBtn} onClick={handleAddSource} disabled={saving.src}>
                {saving.src ? '⏳' : '✓ Uložiť zdroj'}
              </button>
              <button style={css.cancelBtn} onClick={() => setAddSrcOpen(false)}>Zrušiť</button>
            </div>
          </div>
        ) : (
          <button style={css.ghostBtn} onClick={() => setAddSrcOpen(true)}>+ Pridať zdroj / dôkaz</button>
        )}
      </SectionCard>

      {/* AI ANALÝZA */}
      <SectionCard title="AI Analýza" icon="🤖">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
          {[
            { key: 'whatTroubles',  label: 'Čo firmu pravdepodobne trápi' },
            { key: 'energyProblem', label: 'Aký má energetický problém' },
            { key: 'whyStrikerFit', label: 'Prečo je vhodná pre STRIKER' },
            { key: 'mainArgument',  label: 'Hlavný obchodný argument' },
          ].map(({ key, label }) => (
            <div key={key}>
              <FieldLabel>{label}</FieldLabel>
              <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#9ca3af', lineHeight: 1.7, padding: '0.55rem 0.7rem', background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3, minHeight: 60 }}>
                {t.aiAnalysis?.[key] || <span style={{ color: '#374151' }}>— AI nestihla vyplniť —</span>}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* KONTAKTNÉ OSOBY */}
      <SectionCard title="Kontaktné osoby" icon="👤">
        {(t.contacts || []).length === 0 && !addCtOpen && (
          <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#374151', marginBottom: '0.75rem' }}>Zatiaľ žiadne kontakty</div>
        )}
        {(t.contacts || []).map((ct, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3, padding: '0.65rem 0.85rem', marginBottom: '0.4rem' }}>
            <div>
              {ct.role && <div style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#818cf8', marginBottom: '0.2rem' }}>{ct.role}</div>}
              {ct.name && <div style={{ fontFamily: sans, fontSize: '0.88rem', fontWeight: 600, color: '#e8eaed', marginBottom: '0.15rem' }}>{ct.name}</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {ct.email    && <a href={`mailto:${ct.email}`}    style={{ fontFamily: mono, fontSize: '0.58rem', color: '#00cc88' }}>✉ {ct.email}</a>}
                {ct.linkedin && <a href={ct.linkedin} target="_blank" rel="noreferrer" style={{ fontFamily: mono, fontSize: '0.58rem', color: '#818cf8' }}>in {ct.linkedin}</a>}
                {ct.phone    && <span style={{ fontFamily: mono, fontSize: '0.58rem', color: '#6b7280' }}>📞 {ct.phone}</span>}
              </div>
            </div>
            <button onClick={() => handleRemoveContact(i)} disabled={!!saving[`ct-${i}`]}
              style={{ background: 'transparent', border: 'none', color: '#374151', cursor: 'pointer', fontFamily: mono, fontSize: '0.7rem', flexShrink: 0 }}>
              ✕
            </button>
          </div>
        ))}

        {/* AI navrhnuté role */}
        {(t.suggestedContacts || []).filter(sg => !(t.contacts || []).some(c => c.role === sg.role)).length > 0 && (
          <div style={{ marginBottom: '0.75rem' }}>
            <FieldLabel>AI navrhuje hľadať</FieldLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {(t.suggestedContacts || [])
                .filter(sg => !(t.contacts || []).some(c => c.role === sg.role))
                .map((sg, i) => (
                  <button key={i} onClick={() => openContactWithRole(sg.role)}
                    title={sg.relevance}
                    style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.18rem 0.55rem', border: '1px dashed #374151', background: 'transparent', color: '#6b7280', borderRadius: 2, cursor: 'pointer' }}>
                    + {sg.role}
                  </button>
              ))}
            </div>
          </div>
        )}

        {addCtOpen ? (
          <div style={{ background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3, padding: '0.85rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div>
                <FieldLabel>Pozícia / Rola *</FieldLabel>
                <select style={css.input} value={newCt.role} onChange={e => setNewCt(p => ({ ...p, role: e.target.value }))}>
                  <option value="">— Vyber rolu —</option>
                  {CONTACT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Meno a priezvisko</FieldLabel>
                <input style={css.input} placeholder="napr. Jan Novák" value={newCt.name} onChange={e => setNewCt(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <FieldLabel>Email</FieldLabel>
                <input style={css.input} placeholder="meno@firma.de" value={newCt.email} onChange={e => setNewCt(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <FieldLabel>Telefón</FieldLabel>
                <input style={css.input} placeholder="+49 170 000 0000" value={newCt.phone} onChange={e => setNewCt(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
            <FieldLabel>LinkedIn URL</FieldLabel>
            <input style={{ ...css.input, marginBottom: '0.5rem' }} placeholder="https://linkedin.com/in/..." value={newCt.linkedin} onChange={e => setNewCt(p => ({ ...p, linkedin: e.target.value }))} />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button style={css.saveBtn} onClick={handleAddContact} disabled={saving.ct}>
                {saving.ct ? '⏳' : '✓ Uložiť kontakt'}
              </button>
              <button style={css.cancelBtn} onClick={() => { setAddCtOpen(false); setPrefillRole('') }}>Zrušiť</button>
            </div>
          </div>
        ) : (
          <button style={css.ghostBtn} onClick={() => setAddCtOpen(true)}>+ Pridať kontaktnú osobu</button>
        )}
      </SectionCard>

      {/* Potvrdenie vymazania */}
      {confirmDel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}>
          <div style={{ background: '#111418', border: '1px solid #ef444466', borderRadius: 4, padding: '1.5rem', maxWidth: 380, width: '100%', margin: '1rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.65rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#ef4444', marginBottom: '0.75rem' }}>⚠ Odstrániť kartu firmy</div>
            <div style={{ fontFamily: sans, fontSize: '0.95rem', fontWeight: 700, color: '#e8eaed', marginBottom: '0.4rem' }}>{t.name}</div>
            <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#6b7280', marginBottom: '1.25rem' }}>Táto akcia je nevratná. Všetky dáta, kontakty a zdroje budú zmazané.</div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button style={{ ...css.saveBtn, background: '#ef4444' }} onClick={handleDelete}>🗑 Áno, odstrániť</button>
              <button style={css.cancelBtn} onClick={() => setConfirmDel(false)}>Zrušiť</button>
            </div>
          </div>
        </div>
      )}

      </div>
      </div>
    </div>
  )
}

const css = {
  gatherBtn: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.6rem', letterSpacing: '1.5px', textTransform: 'uppercase', background: 'rgba(255,170,0,0.1)', border: '1px solid #ffaa0066', color: '#ffaa00', padding: '0.3rem 0.9rem', borderRadius: 2, cursor: 'pointer', fontWeight: 600 },
  deleteBtn: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.58rem', letterSpacing: '1px', background: 'rgba(239,68,68,0.08)', border: '1px solid #ef444466', color: '#ef4444', padding: '0.3rem 0.75rem', borderRadius: 2, cursor: 'pointer' },
  ghostBtn:  { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.58rem', letterSpacing: '1px', textTransform: 'uppercase', background: 'transparent', border: '1px dashed #1e2530', color: '#374151', padding: '0.3rem 0.75rem', borderRadius: 2, cursor: 'pointer', marginTop: '0.25rem' },
  saveBtn:   { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.62rem', letterSpacing: '1px', textTransform: 'uppercase', background: '#00cc88', border: 'none', color: '#0a0c0f', padding: '0.38rem 0.9rem', borderRadius: 2, cursor: 'pointer', fontWeight: 700 },
  cancelBtn: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.62rem', letterSpacing: '1px', background: 'transparent', border: '1px solid #1e2530', color: '#6b7280', padding: '0.38rem 0.75rem', borderRadius: 2, cursor: 'pointer' },
  input:     { width: '100%', background: '#111418', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.75rem', padding: '0.45rem 0.6rem', borderRadius: 2, outline: 'none', boxSizing: 'border-box' },
  textarea:  { width: '100%', background: '#111418', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.68rem', padding: '0.45rem 0.6rem', borderRadius: 2, outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' },
}
