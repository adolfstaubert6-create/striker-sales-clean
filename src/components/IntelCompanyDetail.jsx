// Vizuálny klon CompanyDetailModal.jsx — rovnaké CSS, intelligence obsah
import { useState } from 'react'
import { INTEL_STATUS_LIST, REC_META, INTEL_STATUSES, scoreColor } from '../constants/intelMeta.js'
import { updateTarget, deleteTarget, addContact, removeContact } from '../services/intelTargetService.js'

const mono = "'IBM Plex Mono',monospace"
const sans = "'IBM Plex Sans',sans-serif"

const CONTACT_ROLES = ['CEO / Geschäftsführer', 'Facility Manager', 'Energy Manager', 'Technical Director', 'Operations Manager', 'Iné']

export default function IntelCompanyDetail({ target: t, onClose, onDelete }) {
  const [saving,      setSaving]      = useState({})
  const [confirmDel,  setConfirmDel]  = useState(false)
  const [addCtOpen,   setAddCtOpen]   = useState(false)
  const [newCt,       setNewCt]       = useState({ role: '', name: '', email: '', phone: '', linkedin: '' })
  const [gathering,   setGathering]   = useState(false)
  const [gatherMsg,   setGatherMsg]   = useState('')

  const id     = t.id
  const rec    = REC_META[t.recommendation] || REC_META.monitor
  const status = INTEL_STATUSES[t.status]  || INTEL_STATUSES.new
  const oc     = scoreColor(t.overallScore ?? 0)

  async function withSaving(key, fn) {
    setSaving(p => ({ ...p, [key]: true }))
    try { await fn() } catch (e) { console.error('[detail]', e.message) }
    finally { setSaving(p => ({ ...p, [key]: false })) }
  }

  async function handleStatus(s) {
    await withSaving('status', () => updateTarget(id, { status: s }))
  }

  async function handleAddContact() {
    if (!newCt.role && !newCt.name) return
    await withSaving('ct', () => addContact(id, newCt))
    setNewCt({ role: '', name: '', email: '', phone: '', linkedin: '' })
    setAddCtOpen(false)
  }

  async function handleRemoveContact(idx) {
    await withSaving(`ct${idx}`, () => removeContact(id, t.contacts || [], idx))
  }

  async function handleDelete() {
    await deleteTarget(id)
    onDelete?.(); onClose()
  }

  async function handleGather() {
    if (!t.web) { setGatherMsg('⚠ Zadaj web URL pre Firecrawl analýzu'); return }
    setGathering(true); setGatherMsg('')
    try {
      const res = await fetch('/.netlify/functions/intelligence-gather', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: t.name, url: t.web, segment: t.segment, segmentLabel: t.segmentLabel, city: t.city, country: t.country, urgencyScore: t.urgencyScore, buyingIntentScore: t.buyingIntentScore || 50, strikerFitScore: t.strikerFitScore, heatDemandScore: t.heatDemandScore || 50, energyPainScore: t.energyPainScore, financialPowerScore: t.financialPowerScore }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      // Merge signals and update scores
      const mergedSignals = [...new Set([...(t.signals||[]), ...(data.signals||[])])]
      const update = { signals: mergedSignals, ...(data.updatedScores||{}), lastGatherSummary: data.aiInterpretation }
      await updateTarget(id, update)
      setGatherMsg(`✓ ${data.webPagesCount} stránok · ${(data.signals||[]).length} nových signálov`)
    } catch (e) { setGatherMsg('⚠ ' + e.message) }
    finally { setGathering(false) }
  }

  // Identická overlay štruktúra ako CompanyDetailModal
  return (
    <div style={css.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={css.modal}>

        {/* Hlavička — rovnaká pozícia ako CompanyDetailModal */}
        <div style={css.mhead}>
          <div>
            <div style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#ff5c00', marginBottom: '0.3rem' }}>◈ INTELLIGENCE KARTA</div>
            <div style={{ fontFamily: sans, fontSize: '1.2rem', fontWeight: 700, color: '#e8eaed' }}>{t.name}</div>
            <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#6b7280', marginTop: '0.15rem' }}>
              {[t.city, t.country].filter(Boolean).join(', ')}
              {t.segmentLabel && <span> · {t.segmentLabel}</span>}
              {t.companySize  && <span> · {t.companySize}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: mono, fontSize: '2.2rem', fontWeight: 700, color: oc, lineHeight: 1 }}>{t.overallScore ?? '–'}</div>
              <div style={{ fontFamily: mono, fontSize: '0.45rem', color: '#6b7280', textTransform: 'uppercase' }}>FIT / 100</div>
            </div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#6b7280', fontSize: '1.2rem', cursor: 'pointer', padding: '0.2rem', lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {/* AI akcie */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <button onClick={handleGather} disabled={gathering} style={{ ...css.actionBtn, background: gathering ? 'rgba(255,170,0,0.05)' : 'rgba(255,170,0,0.1)', borderColor: '#ffaa0066', color: '#ffaa00', opacity: gathering ? 0.7 : 1 }}>
            {gathering ? '⏳ Zbierám...' : '🔍 Zbierať signály (Firecrawl)'}
          </button>
          <button onClick={() => setConfirmDel(true)} style={{ ...css.actionBtn, background: 'rgba(239,68,68,0.08)', borderColor: '#ef444466', color: '#ef4444' }}>
            🗑 Odstrániť
          </button>
        </div>
        {gatherMsg && <div style={{ fontFamily: mono, fontSize: '0.62rem', color: gatherMsg.startsWith('✓') ? '#00cc88' : '#ef4444', marginBottom: '0.75rem' }}>{gatherMsg}</div>}

        {/* Scores */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '0.5rem', marginBottom: '1.25rem', padding: '0.85rem 1rem', background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3 }}>
          {[
            { label: 'Striker FIT',    score: t.strikerFitScore    },
            { label: 'Energ. problém', score: t.energyPainScore    },
            { label: 'Urgentnosť',     score: t.urgencyScore       },
            { label: 'Fin. sila',      score: t.financialPowerScore },
            { label: 'Záujem',         score: t.buyingIntentScore  },
          ].map(({ label, score }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.2rem' }}>{label}</div>
              <div style={{ height: 4, background: '#1e2530', borderRadius: 2, overflow: 'hidden', marginBottom: '0.2rem' }}>
                <div style={{ width: `${score ?? 0}%`, height: '100%', background: scoreColor(score ?? 0), borderRadius: 2 }} />
              </div>
              <div style={{ fontFamily: mono, fontSize: '0.75rem', fontWeight: 700, color: scoreColor(score ?? 0) }}>{score ?? '–'}%</div>
            </div>
          ))}
        </div>

        {/* Stav + Odporúčanie */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={css.section}>
            <div style={css.sectionTitle}>📊 Stav firmy</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {INTEL_STATUS_LIST.map(s => (
                <button key={s.key} onClick={() => handleStatus(s.key)} disabled={!!saving.status}
                  style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.22rem 0.55rem', borderRadius: 2, cursor: 'pointer', border: `1px solid ${s.color}44`, background: t.status === s.key ? s.bg : 'transparent', color: t.status === s.key ? s.color : '#374151', fontWeight: t.status === s.key ? 700 : 400 }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div style={css.section}>
            <div style={css.sectionTitle}>🎯 Odporúčanie AI</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.75rem', borderRadius: 3, background: 'rgba(0,204,136,0.1)', border: '1px solid #00cc8844', marginBottom: '0.5rem' }}>
              <span>{rec.icon}</span>
              <span style={{ fontFamily: mono, fontSize: '0.58rem', letterSpacing: '2px', textTransform: 'uppercase', color: rec.color, fontWeight: 700 }}>{rec.label}</span>
            </div>
            {t.nextStep && <div style={{ fontFamily: mono, fontSize: '0.63rem', color: '#00cc88', lineHeight: 1.5 }}>→ {t.nextStep}</div>}
          </div>
        </div>

        {/* Prečo nájdená + signály */}
        <div style={css.section}>
          <div style={css.sectionTitle}>🔍 Prečo bola firma nájdená</div>
          {t.whyFound && <div style={{ fontFamily: mono, fontSize: '0.63rem', color: '#9ca3af', lineHeight: 1.7, marginBottom: '0.75rem', fontStyle: 'italic' }}>✦ {t.whyFound}</div>}
          {(t.signals || []).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {t.signals.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                  <span style={{ color: '#ff5c00', fontFamily: mono, fontSize: '0.62rem', flexShrink: 0 }}>▸</span>
                  <span style={{ fontFamily: mono, fontSize: '0.62rem', color: '#9ca3af', lineHeight: 1.5 }}>{s}</span>
                </div>
              ))}
            </div>
          )}
          {t.lastGatherSummary?.strikerArgument && (
            <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#00cc88', marginTop: '0.65rem', lineHeight: 1.5 }}>💡 {t.lastGatherSummary.strikerArgument}</div>
          )}
        </div>

        {/* AI Analýza */}
        {t.aiAnalysis && Object.values(t.aiAnalysis).some(Boolean) && (
          <div style={css.section}>
            <div style={css.sectionTitle}>🤖 AI Analýza</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              {[
                { label: 'Čo firmu trápi',          value: t.aiAnalysis.whatTroubles  },
                { label: 'Energetický problém',      value: t.aiAnalysis.energyProblem },
                { label: 'Prečo vhodná pre STRIKER', value: t.aiAnalysis.whyStrikerFit },
                { label: 'Hlavný argument',          value: t.aiAnalysis.mainArgument  },
              ].map(({ label, value }) => value ? (
                <div key={label}>
                  <div style={{ fontFamily: mono, fontSize: '0.45rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#374151', marginBottom: '0.2rem' }}>{label}</div>
                  <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#9ca3af', lineHeight: 1.6, padding: '0.45rem 0.6rem', background: '#0d1117', border: '1px solid #1e2530', borderRadius: 2 }}>{value}</div>
                </div>
              ) : null)}
            </div>
          </div>
        )}

        {/* AI INTELLIGENCE — real web analysis data */}
        {(t.websiteSummary || t.estimatedHeatDemand || t.aiReasoning || (t.extractedKeywords||[]).length > 0) && (
          <div style={css.section}>
            <div style={css.sectionTitle}>💡 AI Intelligence</div>

            {t.websiteSummary && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={css.intelLabel}>Web summary</div>
                <div style={css.intelText}>{t.websiteSummary}</div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.75rem' }}>
              {t.estimatedHeatDemand && (
                <div>
                  <div style={css.intelLabel}>⚡ Odhadovaná tepelná potreba</div>
                  <div style={{ ...css.intelText, color: '#ff5c00' }}>{t.estimatedHeatDemand}</div>
                </div>
              )}
              {t.estimatedEnergyIntensity && (
                <div>
                  <div style={css.intelLabel}>🔋 Energetická intenzita</div>
                  <div style={{ ...css.intelText, color: '#ffaa00' }}>{t.estimatedEnergyIntensity}</div>
                </div>
              )}
              {t.estimatedROI && (
                <div>
                  <div style={css.intelLabel}>💰 Odhad ROI</div>
                  <div style={{ ...css.intelText, color: '#00cc88' }}>{t.estimatedROI}</div>
                </div>
              )}
              {t.estimatedBusinessSize && (
                <div>
                  <div style={css.intelLabel}>🏢 Veľkosť firmy</div>
                  <div style={css.intelText}>{t.estimatedBusinessSize}</div>
                </div>
              )}
            </div>

            {t.aiReasoning && (
              <div style={{ marginBottom: '0.65rem' }}>
                <div style={css.intelLabel}>🧠 AI reasoning</div>
                <div style={css.intelText}>{t.aiReasoning}</div>
              </div>
            )}

            {t.businessOpportunity && (
              <div style={{ marginBottom: '0.65rem' }}>
                <div style={css.intelLabel}>📈 Obchodná príležitosť</div>
                <div style={{ ...css.intelText, color: '#818cf8' }}>{t.businessOpportunity}</div>
              </div>
            )}

            {(t.extractedKeywords || []).length > 0 && (
              <div style={{ marginBottom: '0.65rem' }}>
                <div style={css.intelLabel}>🔑 Extrahované kľúčové slová</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.3rem' }}>
                  {t.extractedKeywords.map((kw, i) => (
                    <span key={i} style={{ fontFamily: mono, fontSize: '0.52rem', padding: '0.08rem 0.38rem', border: '1px solid #1e2530', borderRadius: 2, color: '#6b7280', background: '#0d1117' }}>{kw}</span>
                  ))}
                </div>
              </div>
            )}

            {t.crawlStatus && (
              <div style={{ fontFamily: mono, fontSize: '0.48rem', color: '#374151', marginTop: '0.5rem' }}>
                Crawl: {t.crawlStatus} · {t.crawlTimestamp ? new Date(t.crawlTimestamp).toLocaleString('sk-SK') : '–'}
              </div>
            )}
          </div>
        )}

        {/* Kontaktné osoby */}
        <div style={css.section}>
          <div style={css.sectionTitle}>👤 Kontaktné osoby</div>
          {(t.contacts || []).length === 0 && !addCtOpen && (
            <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#374151', marginBottom: '0.5rem' }}>Zatiaľ žiadne kontakty</div>
          )}
          {(t.contacts || []).map((c, i) => (
            <div key={i} style={{ background: '#0d1117', border: '1px solid #1e2530', borderRadius: 2, padding: '0.55rem 0.75rem', marginBottom: '0.35rem', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                {c.role && <div style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#818cf8', marginBottom: '0.15rem' }}>{c.role}</div>}
                {c.name && <div style={{ fontFamily: sans, fontSize: '0.85rem', fontWeight: 600, color: '#e8eaed' }}>{c.name}</div>}
                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.1rem' }}>
                  {c.email && <a href={`mailto:${c.email}`} style={{ fontFamily: mono, fontSize: '0.56rem', color: '#00cc88' }}>✉ {c.email}</a>}
                  {c.phone && <span style={{ fontFamily: mono, fontSize: '0.56rem', color: '#6b7280' }}>📞 {c.phone}</span>}
                </div>
              </div>
              <button onClick={() => handleRemoveContact(i)} style={{ background: 'transparent', border: 'none', color: '#374151', cursor: 'pointer', fontFamily: mono }}>✕</button>
            </div>
          ))}
          {(t.suggestedContacts || []).filter(sg => !(t.contacts||[]).some(c => c.role === sg.role)).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.5rem' }}>
              {(t.suggestedContacts||[]).filter(sg => !(t.contacts||[]).some(c => c.role === sg.role)).map((sg, i) => (
                <button key={i} onClick={() => { setNewCt(p => ({...p, role: sg.role})); setAddCtOpen(true) }}
                  style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.15rem 0.5rem', border: '1px dashed #374151', background: 'transparent', color: '#6b7280', borderRadius: 2, cursor: 'pointer' }}>
                  + {sg.role}
                </button>
              ))}
            </div>
          )}
          {addCtOpen ? (
            <div style={{ background: '#0d1117', border: '1px solid #1e2530', borderRadius: 2, padding: '0.75rem', marginTop: '0.35rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <div>
                  <label style={css.label}>Pozícia</label>
                  <select style={css.input} value={newCt.role} onChange={e => setNewCt(p => ({...p, role: e.target.value}))}>
                    <option value="">—</option>
                    {CONTACT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={css.label}>Meno</label>
                  <input style={css.input} placeholder="Jan Novák" value={newCt.name} onChange={e => setNewCt(p => ({...p, name: e.target.value}))} />
                </div>
                <div>
                  <label style={css.label}>Email</label>
                  <input style={css.input} placeholder="jan@firma.de" value={newCt.email} onChange={e => setNewCt(p => ({...p, email: e.target.value}))} />
                </div>
                <div>
                  <label style={css.label}>Telefón</label>
                  <input style={css.input} placeholder="+49 170 000 0000" value={newCt.phone} onChange={e => setNewCt(p => ({...p, phone: e.target.value}))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={handleAddContact} disabled={saving.ct} style={css.saveBtn}>{saving.ct ? '⏳' : '✓ Uložiť'}</button>
                <button onClick={() => setAddCtOpen(false)} style={css.cancelBtn}>Zrušiť</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddCtOpen(true)} style={css.ghostBtn}>+ Pridať kontaktnú osobu</button>
          )}
        </div>

        {/* Potvrdenie vymazania */}
        {confirmDel && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '1rem' }}>
            <div style={{ background: '#111418', border: '1px solid #ef444466', borderRadius: 4, padding: '1.5rem', maxWidth: 380, width: '100%' }}>
              <div style={{ fontFamily: mono, fontSize: '0.62rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#ef4444', marginBottom: '0.65rem' }}>⚠ Odstrániť kartu</div>
              <div style={{ fontFamily: sans, fontSize: '0.95rem', fontWeight: 700, color: '#e8eaed', marginBottom: '0.35rem' }}>{t.name}</div>
              <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#6b7280', marginBottom: '1.1rem' }}>Táto akcia je nevratná.</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button style={{ ...css.saveBtn, background: '#ef4444' }} onClick={handleDelete}>🗑 Odstrániť</button>
                <button style={css.cancelBtn} onClick={() => setConfirmDel(false)}>Zrušiť</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Identické CSS ako CompanyDetailModal
const css = {
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 200, padding: '1rem', overflowY: 'auto' },
  modal:        { background: '#111418', border: '1px solid #1e2530', borderRadius: 4, padding: '1.5rem', width: '100%', maxWidth: 960, margin: '0 auto' },
  mhead:        { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' },
  section:      { background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3, padding: '0.85rem 1rem', marginBottom: '0.85rem' },
  sectionTitle: { fontFamily: mono, fontSize: '0.52rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#ff5c00', marginBottom: '0.75rem' },
  actionBtn:    { fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0.3rem 0.85rem', border: '1px solid', borderRadius: 2, cursor: 'pointer', fontWeight: 600 },
  label:        { display: 'block', fontFamily: mono, fontSize: '0.48rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.2rem' },
  input:        { width: '100%', background: '#111418', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: mono, fontSize: '0.72rem', padding: '0.42rem 0.6rem', borderRadius: 2, outline: 'none', boxSizing: 'border-box' },
  saveBtn:      { fontFamily: mono, fontSize: '0.62rem', letterSpacing: '1px', textTransform: 'uppercase', background: '#00cc88', border: 'none', color: '#0a0c0f', padding: '0.38rem 0.85rem', borderRadius: 2, cursor: 'pointer', fontWeight: 700 },
  cancelBtn:    { fontFamily: mono, fontSize: '0.62rem', letterSpacing: '1px', background: 'transparent', border: '1px solid #1e2530', color: '#6b7280', padding: '0.38rem 0.7rem', borderRadius: 2, cursor: 'pointer' },
  ghostBtn:     { fontFamily: mono, fontSize: '0.56rem', letterSpacing: '1px', textTransform: 'uppercase', background: 'transparent', border: '1px dashed #1e2530', color: '#374151', padding: '0.28rem 0.7rem', borderRadius: 2, cursor: 'pointer', marginTop: '0.2rem' },
  intelLabel:   { fontFamily: mono, fontSize: '0.45rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#374151', marginBottom: '0.2rem' },
  intelText:    { fontFamily: mono, fontSize: '0.62rem', color: '#9ca3af', lineHeight: 1.65, padding: '0.45rem 0.6rem', background: '#0d1117', border: '1px solid #1e2530', borderRadius: 2 },
}
