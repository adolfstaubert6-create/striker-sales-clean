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

// ── Pomocné komponenty ────────────────────────────────────────────────────────

function ScoreBar({ score, label, reason }) {
  const c = scoreColor(score ?? 0)
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.2rem' }}>
        <span style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6b7280' }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: '0.88rem', fontWeight: 700, color: c }}>{score ?? '–'}%</span>
      </div>
      <div style={{ height: 5, background: '#1e2530', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${score ?? 0}%`, height: '100%', background: c, borderRadius: 3 }} />
      </div>
      {reason && <div style={{ fontFamily: mono, fontSize: '0.52rem', color: '#4b5563', marginTop: '0.2rem', lineHeight: 1.4 }}>{reason}</div>}
    </div>
  )
}

function Section({ title, icon, children }) {
  return (
    <div style={{ background: '#111418', border: '1px solid #1e2530', borderRadius: 4, padding: '1.1rem 1.25rem', marginBottom: '0.85rem' }}>
      <div style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#ff5c00', marginBottom: '0.85rem' }}>
        {icon && <span style={{ marginRight: '0.4rem' }}>{icon}</span>}{title}
      </div>
      {children}
    </div>
  )
}

function FieldLabel({ children }) {
  return <div style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#374151', marginBottom: '0.35rem' }}>{children}</div>
}

// ── Hlavný modal ──────────────────────────────────────────────────────────────

export default function IntelCompanyDetail({ target: t, onClose, onDelete }) {
  const [editSignals,  setEditSignals]  = useState(false)
  const [signalsDraft, setSignalsDraft] = useState('')
  const [addSrcOpen,   setAddSrcOpen]   = useState(false)
  const [newSrc,       setNewSrc]       = useState({ type: 'web', url: '', title: '', description: '' })
  const [addCtOpen,    setAddCtOpen]    = useState(false)
  const [newCt,        setNewCt]        = useState({ role: '', name: '', email: '', linkedin: '', phone: '' })
  const [saving,       setSaving]       = useState({})
  const [confirmDel,   setConfirmDel]   = useState(false)
  const [gathering,    setGathering]    = useState(false)
  const [gatherResult, setGatherResult] = useState(null)
  const [gatherError,  setGatherError]  = useState(null)

  const id = t.id

  async function withSaving(key, fn) {
    setSaving(p => ({ ...p, [key]: true }))
    try { await fn() } catch (e) { console.error('[intel-detail]', key, e.message) }
    finally { setSaving(p => ({ ...p, [key]: false })) }
  }

  async function handleStatus(status) {
    await withSaving('status', () => updateTarget(id, { status }))
  }

  async function handleSaveSignals() {
    const signals = signalsDraft.split('\n').map(s => s.trim()).filter(Boolean)
    await withSaving('signals', () => updateTarget(id, { signals }))
    setEditSignals(false)
  }

  async function handleAddSource() {
    if (!newSrc.url.trim() && !newSrc.title.trim()) return
    await withSaving('src', () => addSource(id, newSrc))
    setNewSrc({ type: 'web', url: '', title: '', description: '' })
    setAddSrcOpen(false)
  }

  async function handleRemoveSource(idx) {
    await withSaving(`src${idx}`, () => removeSource(id, t.sources || [], idx))
  }

  async function handleAddContact() {
    if (!newCt.role.trim() && !newCt.name.trim()) return
    await withSaving('ct', () => addContact(id, newCt))
    setNewCt({ role: '', name: '', email: '', linkedin: '', phone: '' })
    setAddCtOpen(false)
  }

  async function handleRemoveContact(idx) {
    await withSaving(`ct${idx}`, () => removeContact(id, t.contacts || [], idx))
  }

  async function handleDelete() {
    await deleteTarget(id)
    onDelete?.()
    onClose()
  }

  async function handleGather() {
    setGathering(true)
    setGatherError(null)
    setGatherResult(null)
    try {
      const res = await fetch('/.netlify/functions/intelligence-gather', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: t.name, url: t.web, segment: t.segment, segmentLabel: t.segmentLabel,
          city: t.city, country: t.country,
          urgencyScore: t.urgencyScore, buyingIntentScore: t.buyingIntentScore,
          strikerFitScore: t.strikerFitScore, heatDemandScore: t.heatDemandScore,
          energyPainScore: t.energyPainScore, financialPowerScore: t.financialPowerScore,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`)
      await updateIntelligence(id, {
        newSignals: data.signals || [], newSources: data.sources || [],
        updatedScores: data.updatedScores, aiInterpretation: data.aiInterpretation,
        jobSignals: data.jobSignals || [], keyEvidence: data.keyEvidence || [],
        scrapedPages: data.scrapedPages || [],
        existingSignals: t.signals || [], existingSources: t.sources || [],
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

  // ── Rovnaký overlay vzor ako CompanyDetailModal v Division A ─────────────────
  return (
    <div style={OVERLAY} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={MODAL}>

        {/* Hlavička modalu — akcie */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <button
            onClick={handleGather}
            disabled={gathering}
            style={{ ...css.gatherBtn, opacity: gathering ? 0.65 : 1 }}>
            {gathering ? '⏳ Zbierám signály...' : '🔍 Zbierať signály z internetu'}
          </button>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button onClick={() => setConfirmDel(true)} style={css.deleteBtn}>🗑 Odstrániť</button>
            <button onClick={onClose} style={css.closeBtn}>✕</button>
          </div>
        </div>

        {/* Zbieranie — progress */}
        {gathering && (
          <div style={{ background: '#0d1117', border: '1px solid #ff5c0033', borderLeft: '3px solid #ff5c00', borderRadius: 3, padding: '0.85rem 1rem', marginBottom: '1rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.55rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#ff5c00', marginBottom: '0.65rem' }}>◈ ZBIERANIE SIGNÁLOV...</div>
            {['🌐 Načítavam web firmy...', '🤖 AI interpretuje nájdené dáta...', '💾 Aktualizujem kartu...'].map((s, i) => (
              <div key={i} style={{ fontFamily: mono, fontSize: '0.56rem', color: '#374151', marginBottom: '0.2rem' }}>✦ {s}</div>
            ))}
          </div>
        )}

        {/* Zbieranie — výsledok */}
        {gatherResult && !gathering && (
          <div style={{ background: '#0d1117', border: '1px solid #00cc8833', borderLeft: '3px solid #00cc88', borderRadius: 3, padding: '0.75rem 1rem', marginBottom: '1rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.55rem', color: '#00cc88', marginBottom: '0.4rem' }}>
              ✓ Signály zozbierané · {gatherResult.elapsed} · {gatherResult.webPagesCount} stránok
              {!gatherResult.capabilities?.firecrawl && <span style={{ color: '#374151' }}> (Firecrawl API kľúč chýba)</span>}
            </div>
            {gatherResult.aiInterpretation?.strikerArgument && (
              <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#00cc88', lineHeight: 1.5, marginBottom: '0.3rem' }}>✦ {gatherResult.aiInterpretation.strikerArgument}</div>
            )}
            {gatherResult.aiInterpretation?.timingAssessment && (
              <div style={{ fontFamily: mono, fontSize: '0.58rem', color: '#6b7280', lineHeight: 1.5 }}>🕐 {gatherResult.aiInterpretation.timingAssessment}</div>
            )}
            <button style={{ ...css.ghostBtn, marginTop: '0.5rem' }} onClick={() => setGatherResult(null)}>Skryť</button>
          </div>
        )}

        {gatherError && !gathering && (
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '0.4rem 0.65rem', borderRadius: 2, marginBottom: '1rem' }}>⚠ {gatherError}</div>
        )}

        {/* Karta firmy — hlavná info + skóre */}
        <div style={{ background: '#0d1117', border: '1px solid #1e2530', borderLeft: `3px solid ${scoreColor(t.overallScore)}`, borderRadius: 4, padding: '1.1rem 1.25rem', marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#ff5c00', marginBottom: '0.35rem' }}>◈ KARTA FIRMY</div>
              <div style={{ fontFamily: sans, fontSize: '1.2rem', fontWeight: 700, color: '#e8eaed', marginBottom: '0.25rem' }}>{t.name}</div>
              <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#6b7280', display: 'flex', flexWrap: 'wrap', gap: '0.85rem' }}>
                {t.web         && <a href={t.web.startsWith('http') ? t.web : `https://${t.web}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#818cf8', textDecoration: 'none' }}>🌐 {t.web}</a>}
                {(t.city || t.country) && <span>📍 {[t.city, t.country].filter(Boolean).join(', ')}</span>}
                {t.segmentLabel && <span>{t.segmentLabel}</span>}
                {t.companySize  && <span>🏢 {t.companySize}</span>}
                {t.employees    && <span>👥 {t.employees} zamestnancov</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: mono, fontSize: '2.5rem', fontWeight: 700, color: scoreColor(t.overallScore), lineHeight: 1 }}>{t.overallScore ?? '–'}</div>
              <div style={{ fontFamily: mono, fontSize: '0.45rem', color: '#6b7280', letterSpacing: '1.5px', textTransform: 'uppercase' }}>STRIKER FIT / 100</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.65rem', paddingTop: '0.85rem', borderTop: '1px solid #1e2530' }}>
            <ScoreBar score={t.strikerFitScore}     label="Striker Fit"    reason={t.strikerFitReason} />
            <ScoreBar score={t.energyPainScore}     label="Energ. problém" reason={t.energyPainReason} />
            <ScoreBar score={t.urgencyScore}        label="Urgentnosť"     reason={t.urgencyReason} />
            <ScoreBar score={t.financialPowerScore} label="Fin. sila"      reason={t.financialPowerReason} />
            <ScoreBar score={t.buyingIntentScore}   label="Záujem o kúpu" reason={t.buyingIntentReason} />
          </div>
        </div>

        {/* Stav + Odporúčanie (side by side) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
          <Section title="Stav firmy" icon="📊">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.65rem' }}>
              {INTEL_STATUSES.map(s => (
                <button key={s.key} onClick={() => handleStatus(s.key)} disabled={!!saving.status} style={{
                  fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase',
                  padding: '0.25rem 0.6rem', borderRadius: 2, cursor: 'pointer',
                  border: `1px solid ${s.border}`,
                  background: t.status === s.key ? s.bg : 'transparent',
                  color: t.status === s.key ? s.color : '#374151',
                  fontWeight: t.status === s.key ? 700 : 400,
                }}>{s.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontFamily: mono, fontSize: '0.48rem', color: '#4b5563', letterSpacing: '1px', textTransform: 'uppercase' }}>Záujem:</span>
              <span style={{ fontFamily: mono, fontSize: '0.58rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 2, color: intent.color, background: intent.bg, border: `1px solid ${intent.border}` }}>
                ● {intent.label}
              </span>
            </div>
          </Section>

          <Section title="Odporúčanie AI" icon="🎯">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.8rem', borderRadius: 3, background: rec.bg, border: `1px solid ${rec.border}`, marginBottom: '0.75rem' }}>
              <span>{rec.icon}</span>
              <span style={{ fontFamily: mono, fontSize: '0.58rem', letterSpacing: '2px', textTransform: 'uppercase', color: rec.color, fontWeight: 700 }}>{rec.label}</span>
            </div>
            {t.recommendationReason && <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#9ca3af', lineHeight: 1.65, marginBottom: '0.5rem' }}>{t.recommendationReason}</div>}
            {t.nextStep && <div style={{ fontFamily: mono, fontSize: '0.65rem', color: '#00cc88', lineHeight: 1.5 }}>→ {t.nextStep}</div>}
          </Section>
        </div>

        {/* PREČO BOLA FIRMA NÁJDENÁ */}
        <Section title="Prečo bola firma nájdená" icon="🔍">
          {t.whyFound && (
            <div style={{ fontFamily: mono, fontSize: '0.63rem', color: '#9ca3af', lineHeight: 1.7, marginBottom: '0.85rem', padding: '0.6rem 0.75rem', background: '#0d1117', borderRadius: 3, border: '1px solid #1e2530' }}>
              {t.whyFound}
            </div>
          )}

          {/* Firecrawl výsledky */}
          {t.lastGatherSummary && (
            <div style={{ background: '#0a0c0f', border: '1px solid #1e2530', borderRadius: 3, padding: '0.75rem 0.85rem', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#374151' }}>Výsledok Firecrawl analýzy</span>
                {t.lastGatherSummary.pressureLevel && (
                  <span style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0.1rem 0.4rem', borderRadius: 2, fontWeight: 700,
                    color: t.lastGatherSummary.pressureLevel === 'kritický' ? '#ff5c00' : t.lastGatherSummary.pressureLevel === 'vysoký' ? '#ffaa00' : '#6b7280',
                    background: t.lastGatherSummary.pressureLevel === 'kritický' ? 'rgba(255,92,0,0.1)' : 'rgba(255,170,0,0.1)',
                    border: `1px solid ${t.lastGatherSummary.pressureLevel === 'kritický' ? '#ff5c0044' : '#ffaa0044'}`,
                  }}>TLAK: {t.lastGatherSummary.pressureLevel?.toUpperCase()}</span>
                )}
              </div>
              {[
                { icon: '⚡', label: 'Energetické náklady',       field: 'energyFindings' },
                { icon: '🔧', label: 'Modernizácia',              field: 'modernizationFindings' },
                { icon: '🌱', label: 'ESG / Udržateľnosť',        field: 'esgFindings' },
              ].map(({ icon, label, field }) => t.lastGatherSummary[field] ? (
                <div key={field} style={{ marginBottom: '0.4rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.45rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.12rem' }}>{icon} {label}</div>
                  <div style={{ fontFamily: mono, fontSize: '0.58rem', color: '#9ca3af', lineHeight: 1.6 }}>{t.lastGatherSummary[field]}</div>
                </div>
              ) : null)}
              {t.lastGatherSummary.pressureExplanation && (
                <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid #1e2530', fontFamily: mono, fontSize: '0.58rem', lineHeight: 1.6,
                  color: t.lastGatherSummary.isRealPressure ? '#ff5c00' : '#6b7280' }}>
                  {t.lastGatherSummary.isRealPressure ? '⚡ REÁLNY TLAK: ' : '💬 Marketing: '}{t.lastGatherSummary.pressureExplanation}
                </div>
              )}
              {t.lastGatherSummary.strikerArgument && (
                <div style={{ marginTop: '0.4rem', fontFamily: mono, fontSize: '0.6rem', color: '#00cc88', lineHeight: 1.5 }}>✦ {t.lastGatherSummary.strikerArgument}</div>
              )}
            </div>
          )}

          {/* Naskenované stránky */}
          {(t.scrapedPages || []).length > 0 && (
            <div style={{ marginBottom: '0.85rem' }}>
              <FieldLabel>Naskenované stránky webu</FieldLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {t.scrapedPages.map((p, i) => (
                  <span key={i} style={{ fontFamily: mono, fontSize: '0.48rem', padding: '0.12rem 0.45rem', borderRadius: 2,
                    color:      p.found ? (p.energyHits > 0 ? '#ffaa00' : '#00cc88') : '#374151',
                    background: p.found ? (p.energyHits > 0 ? 'rgba(255,170,0,0.08)' : 'rgba(0,204,136,0.08)') : 'transparent',
                    border:     `1px solid ${p.found ? (p.energyHits > 0 ? '#ffaa0033' : '#00cc8833') : '#1e2530'}`,
                  }}>{p.found ? (p.energyHits > 0 ? `⚡ ${p.categoryLabel}` : `✓ ${p.categoryLabel}`) : `— ${p.categoryLabel}`}</span>
                ))}
              </div>
            </div>
          )}

          {/* Kľúčové dôkazy */}
          {(t.keyEvidence || []).length > 0 && (
            <div style={{ marginBottom: '0.85rem' }}>
              <FieldLabel>Kľúčové dôkazy a citácie</FieldLabel>
              {t.keyEvidence.map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.3rem', alignItems: 'flex-start' }}>
                  <span style={{ color: '#ffaa00', fontFamily: mono, fontSize: '0.62rem', flexShrink: 0 }}>„</span>
                  <span style={{ fontFamily: mono, fontSize: '0.6rem', color: '#9ca3af', lineHeight: 1.5, fontStyle: 'italic' }}>{ev}</span>
                </div>
              ))}
            </div>
          )}

          {/* Job signály */}
          {(t.jobSignals || []).length > 0 && (
            <div style={{ marginBottom: '0.85rem' }}>
              <FieldLabel>Detekované pracovné signály</FieldLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {t.jobSignals.map((j, i) => (
                  <span key={i} title={j.context} style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '0.5px', padding: '0.15rem 0.5rem', borderRadius: 2, color: '#818cf8', background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.25)' }}>
                    💼 {j.role}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Signály (editovateľné) */}
          <FieldLabel>Problémové signály</FieldLabel>
          {!editSignals ? (
            <div>
              {(t.signals || []).length === 0
                ? <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#374151', marginBottom: '0.5rem' }}>Žiadne signály — zbieraj signály z internetu</div>
                : (t.signals || []).map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.25rem', alignItems: 'flex-start' }}>
                      <span style={{ color: '#ff5c00', fontFamily: mono, fontSize: '0.65rem', flexShrink: 0 }}>▸</span>
                      <span style={{ fontFamily: mono, fontSize: '0.63rem', color: '#9ca3af', lineHeight: 1.5 }}>{s}</span>
                    </div>
                  ))
              }
              <button style={{ ...css.ghostBtn, marginTop: '0.5rem' }} onClick={() => { setSignalsDraft((t.signals || []).join('\n')); setEditSignals(true) }}>✏ Upraviť</button>
            </div>
          ) : (
            <div>
              <textarea style={css.textarea} value={signalsDraft} onChange={e => setSignalsDraft(e.target.value)} placeholder="Každý signál na nový riadok..." autoFocus />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                <button style={css.saveBtn} onClick={handleSaveSignals} disabled={saving.signals}>{saving.signals ? '⏳' : '✓ Uložiť'}</button>
                <button style={css.cancelBtn} onClick={() => setEditSignals(false)}>Zrušiť</button>
              </div>
            </div>
          )}
        </Section>

        {/* DÔKAZY A ZDROJE */}
        <Section title="Dôkazy a zdroje" icon="📎">
          {(t.sources || []).length === 0 && !addSrcOpen && (
            <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#374151', marginBottom: '0.65rem' }}>Žiadne zdroje</div>
          )}
          {(t.sources || []).map((src, i) => (
            <div key={i} style={{ background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3, padding: '0.6rem 0.8rem', marginBottom: '0.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280', background: '#1e2530', padding: '0.08rem 0.3rem', borderRadius: 2 }}>
                      {SOURCE_TYPES.find(x => x.value === src.type)?.label || src.type}
                    </span>
                    {src.title && <span style={{ fontFamily: mono, fontSize: '0.63rem', fontWeight: 600, color: '#e8eaed' }}>{src.title}</span>}
                  </div>
                  {src.url && <a href={src.url} target="_blank" rel="noreferrer" style={{ fontFamily: mono, fontSize: '0.56rem', color: '#818cf8', display: 'block', wordBreak: 'break-all', marginBottom: '0.15rem' }}>{src.url}</a>}
                  {src.description && <div style={{ fontFamily: mono, fontSize: '0.56rem', color: '#6b7280', lineHeight: 1.4 }}>{src.description}</div>}
                </div>
                <button onClick={() => handleRemoveSource(i)} disabled={!!saving[`src${i}`]} style={css.iconBtn}>✕</button>
              </div>
            </div>
          ))}
          {addSrcOpen ? (
            <div style={{ background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3, padding: '0.75rem', marginTop: '0.4rem' }}>
              <select style={{ ...css.input, marginBottom: '0.4rem' }} value={newSrc.type} onChange={e => setNewSrc(p => ({ ...p, type: e.target.value }))}>
                {SOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input style={{ ...css.input, marginBottom: '0.4rem' }} placeholder="https://..." value={newSrc.url} onChange={e => setNewSrc(p => ({ ...p, url: e.target.value }))} />
              <input style={{ ...css.input, marginBottom: '0.4rem' }} placeholder="Názov / popis" value={newSrc.title} onChange={e => setNewSrc(p => ({ ...p, title: e.target.value }))} />
              <textarea style={{ ...css.textarea, minHeight: 55, marginBottom: '0.4rem' }} placeholder="Textový dôkaz..." value={newSrc.description} onChange={e => setNewSrc(p => ({ ...p, description: e.target.value }))} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button style={css.saveBtn} onClick={handleAddSource} disabled={saving.src}>{saving.src ? '⏳' : '✓ Uložiť'}</button>
                <button style={css.cancelBtn} onClick={() => setAddSrcOpen(false)}>Zrušiť</button>
              </div>
            </div>
          ) : (
            <button style={css.ghostBtn} onClick={() => setAddSrcOpen(true)}>+ Pridať zdroj</button>
          )}
        </Section>

        {/* AI ANALÝZA */}
        <Section title="AI Analýza" icon="🤖">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {[
              { key: 'whatTroubles',  label: 'Čo firmu pravdepodobne trápi' },
              { key: 'energyProblem', label: 'Aký má energetický problém' },
              { key: 'whyStrikerFit', label: 'Prečo je vhodná pre STRIKER' },
              { key: 'mainArgument',  label: 'Hlavný obchodný argument' },
            ].map(({ key, label }) => (
              <div key={key}>
                <FieldLabel>{label}</FieldLabel>
                <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#9ca3af', lineHeight: 1.7, padding: '0.5rem 0.65rem', background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3, minHeight: 55 }}>
                  {t.aiAnalysis?.[key] || <span style={{ color: '#374151' }}>—</span>}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* KONTAKTNÉ OSOBY */}
        <Section title="Kontaktné osoby" icon="👤">
          {(t.contacts || []).length === 0 && !addCtOpen && (
            <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#374151', marginBottom: '0.65rem' }}>Zatiaľ žiadne kontakty</div>
          )}
          {(t.contacts || []).map((ct, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3, padding: '0.6rem 0.8rem', marginBottom: '0.35rem' }}>
              <div>
                {ct.role && <div style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#818cf8', marginBottom: '0.18rem' }}>{ct.role}</div>}
                {ct.name && <div style={{ fontFamily: sans, fontSize: '0.85rem', fontWeight: 600, color: '#e8eaed', marginBottom: '0.12rem' }}>{ct.name}</div>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
                  {ct.email    && <a href={`mailto:${ct.email}`} style={{ fontFamily: mono, fontSize: '0.56rem', color: '#00cc88' }}>✉ {ct.email}</a>}
                  {ct.linkedin && <a href={ct.linkedin} target="_blank" rel="noreferrer" style={{ fontFamily: mono, fontSize: '0.56rem', color: '#818cf8' }}>in {ct.linkedin}</a>}
                  {ct.phone    && <span style={{ fontFamily: mono, fontSize: '0.56rem', color: '#6b7280' }}>📞 {ct.phone}</span>}
                </div>
              </div>
              <button onClick={() => handleRemoveContact(i)} disabled={!!saving[`ct${i}`]} style={css.iconBtn}>✕</button>
            </div>
          ))}
          {/* AI navrhnuté role */}
          {(t.suggestedContacts || []).filter(sg => !(t.contacts || []).some(c => c.role === sg.role)).length > 0 && (
            <div style={{ marginBottom: '0.65rem' }}>
              <FieldLabel>AI navrhuje hľadať</FieldLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {(t.suggestedContacts || []).filter(sg => !(t.contacts || []).some(c => c.role === sg.role)).map((sg, i) => (
                  <button key={i} title={sg.relevance} onClick={() => { setNewCt(p => ({ ...p, role: sg.role })); setAddCtOpen(true) }}
                    style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.15rem 0.5rem', border: '1px dashed #374151', background: 'transparent', color: '#6b7280', borderRadius: 2, cursor: 'pointer' }}>
                    + {sg.role}
                  </button>
                ))}
              </div>
            </div>
          )}
          {addCtOpen ? (
            <div style={{ background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3, padding: '0.75rem', marginTop: '0.4rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <div>
                  <FieldLabel>Pozícia *</FieldLabel>
                  <select style={css.input} value={newCt.role} onChange={e => setNewCt(p => ({ ...p, role: e.target.value }))}>
                    <option value="">— Vyber —</option>
                    {CONTACT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>Meno</FieldLabel>
                  <input style={css.input} placeholder="Jan Novák" value={newCt.name} onChange={e => setNewCt(p => ({ ...p, name: e.target.value }))} />
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
              <input style={{ ...css.input, marginBottom: '0.4rem' }} placeholder="https://linkedin.com/in/..." value={newCt.linkedin} onChange={e => setNewCt(p => ({ ...p, linkedin: e.target.value }))} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button style={css.saveBtn} onClick={handleAddContact} disabled={saving.ct}>{saving.ct ? '⏳' : '✓ Uložiť'}</button>
                <button style={css.cancelBtn} onClick={() => setAddCtOpen(false)}>Zrušiť</button>
              </div>
            </div>
          ) : (
            <button style={css.ghostBtn} onClick={() => setAddCtOpen(true)}>+ Pridať kontaktnú osobu</button>
          )}
        </Section>

        {/* POTVRDENIE VYMAZANIA */}
        {confirmDel && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '1rem' }}>
            <div style={{ background: '#111418', border: '1px solid #ef444466', borderRadius: 4, padding: '1.5rem', maxWidth: 380, width: '100%' }}>
              <div style={{ fontFamily: mono, fontSize: '0.62rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#ef4444', marginBottom: '0.65rem' }}>⚠ Odstrániť kartu firmy</div>
              <div style={{ fontFamily: sans, fontSize: '0.95rem', fontWeight: 700, color: '#e8eaed', marginBottom: '0.35rem' }}>{t.name}</div>
              <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#6b7280', marginBottom: '1.1rem' }}>Táto akcia je nevratná.</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button style={{ ...css.saveBtn, background: '#ef4444' }} onClick={handleDelete}>🗑 Áno, odstrániť</button>
                <button style={css.cancelBtn} onClick={() => setConfirmDel(false)}>Zrušiť</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// Overlay a modal — rovnaký vzor ako CompanyDetailModal v Division A
const OVERLAY = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.75)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  zIndex: 200, padding: '1rem', overflowY: 'auto',
}
const MODAL = {
  background: '#0d1117', border: '1px solid #1e2530',
  borderRadius: 4, padding: '1.5rem',
  width: '100%', maxWidth: 960,
  margin: '0 auto',
}

const css = {
  gatherBtn:  { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.6rem', letterSpacing: '1.5px', textTransform: 'uppercase', background: 'rgba(255,170,0,0.1)', border: '1px solid #ffaa0066', color: '#ffaa00', padding: '0.3rem 0.85rem', borderRadius: 2, cursor: 'pointer', fontWeight: 600 },
  deleteBtn:  { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.58rem', letterSpacing: '1px', background: 'rgba(239,68,68,0.08)', border: '1px solid #ef444466', color: '#ef4444', padding: '0.3rem 0.7rem', borderRadius: 2, cursor: 'pointer' },
  closeBtn:   { background: 'transparent', border: 'none', color: '#6b7280', fontSize: '1.1rem', cursor: 'pointer', padding: '0 0.2rem', lineHeight: 1 },
  ghostBtn:   { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.56rem', letterSpacing: '1px', textTransform: 'uppercase', background: 'transparent', border: '1px dashed #1e2530', color: '#374151', padding: '0.28rem 0.7rem', borderRadius: 2, cursor: 'pointer', marginTop: '0.2rem' },
  saveBtn:    { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.62rem', letterSpacing: '1px', textTransform: 'uppercase', background: '#00cc88', border: 'none', color: '#0a0c0f', padding: '0.38rem 0.85rem', borderRadius: 2, cursor: 'pointer', fontWeight: 700 },
  cancelBtn:  { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.62rem', letterSpacing: '1px', background: 'transparent', border: '1px solid #1e2530', color: '#6b7280', padding: '0.38rem 0.7rem', borderRadius: 2, cursor: 'pointer' },
  iconBtn:    { background: 'transparent', border: 'none', color: '#374151', cursor: 'pointer', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.7rem', flexShrink: 0, padding: '0 0.2rem' },
  input:      { width: '100%', background: '#111418', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.72rem', padding: '0.42rem 0.6rem', borderRadius: 2, outline: 'none', boxSizing: 'border-box' },
  textarea:   { width: '100%', background: '#111418', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.65rem', padding: '0.42rem 0.6rem', borderRadius: 2, outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box', minHeight: 90 },
}
