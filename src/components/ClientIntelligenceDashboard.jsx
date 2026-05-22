import { useState, useEffect } from 'react'
import { updateTarget, addContact, removeContact } from '../services/intelTargetService.js'
import { INTEL_STATUS_LIST, scoreColor } from '../constants/intelMeta.js'
import ProgressBar from './ProgressBar.jsx'
import EmailDraftEditor from './EmailDraftEditor.jsx'

const mono = "'IBM Plex Mono',monospace"
const sans = "'IBM Plex Sans',sans-serif"

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:      '#080a0d',
  panel:   '#0d1117',
  card:    '#111418',
  border:  '#1a1f2a',
  border2: '#21262d',
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

// ── Left-nav items ─────────────────────────────────────────────────────────────
const NAV = [
  { key: 'overview',    icon: '🗂',  label: 'Prehľad klienta'     },
  { key: 'ai-profile',  icon: '🧠',  label: 'AI profil klienta'   },
  { key: 'energy',      icon: '⚡',  label: 'Energetický problém' },
  { key: 'signals',     icon: '📡',  label: 'Signály'             },
  { key: 'reviews',     icon: '⭐',  label: 'Recenzie'            },
  { key: 'technology',  icon: '⚙',  label: 'Technológie'         },
  { key: 'contacts',    icon: '👤',  label: 'Kontakty'            },
  { key: 'finance',     icon: '💰',  label: 'Financie / ROI'      },
  { key: 'email',       icon: '✉',  label: 'Email'               },
  { key: 'followup',    icon: '🔔',  label: 'Follow-up'           },
  { key: 'activity',    icon: '📋',  label: 'Aktivity'            },
  { key: 'documents',   icon: '📄',  label: 'Dokumenty'           },
]

// ── Small helpers ──────────────────────────────────────────────────────────────

function SLabel({ children }) {
  return <div style={{ fontFamily: mono, fontSize: '0.42rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: C.ghost, marginBottom: '0.55rem' }}>{children}</div>
}

function InfoPill({ label, value, color }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 3, padding: '0.55rem 0.7rem', marginBottom: '0.4rem' }}>
      <div style={{ fontFamily: mono, fontSize: '0.41rem', letterSpacing: '2px', textTransform: 'uppercase', color: C.ghost, marginBottom: '0.18rem' }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: '0.68rem', color: color || C.sub, lineHeight: 1.45 }}>{value}</div>
    </div>
  )
}

function MetricBar({ label, value, color }) {
  if (value == null) return null
  const col = color || (value >= 70 ? C.orange : value >= 45 ? C.amber : C.dim)
  return (
    <div style={{ marginBottom: '0.55rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.18rem' }}>
        <span style={{ fontFamily: mono, fontSize: '0.5rem', color: C.sub }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: '0.55rem', fontWeight: 700, color: col }}>{value}</span>
      </div>
      <div style={{ height: 3, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: col, borderRadius: 2, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

function Placeholder({ onClose }) {
  return (
    <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.dim, fontStyle: 'italic', padding: '2rem', textAlign: 'center' }}>
      Táto sekcia bude dostupná v ďalšej verzii.
      <br /><br />
      <button onClick={onClose} style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.22rem 0.65rem', border: `1px solid ${C.border2}`, background: 'transparent', color: C.dim, borderRadius: 2, cursor: 'pointer' }}>
        ← Späť
      </button>
    </div>
  )
}

// ── Avatar circle ──────────────────────────────────────────────────────────────

function Avatar({ name, size = 32 }) {
  const colors = [C.orange, C.purple, C.green, C.amber, '#60a5fa', '#f472b6']
  const idx    = (name || 'X').charCodeAt(0) % colors.length
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `${colors[idx]}22`, border: `1.5px solid ${colors[idx]}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontFamily: sans, fontSize: size * 0.4 + 'px', fontWeight: 700, color: colors[idx] }}>
        {(name || '?').charAt(0).toUpperCase()}
      </span>
    </div>
  )
}

// ── Contact card ───────────────────────────────────────────────────────────────

function ContactRow({ c, onRemove }) {
  const confColor = { HIGH: C.green, MEDIUM: C.amber, LOW: C.dim }[c.confidence] || C.dim
  return (
    <div style={{ display: 'flex', gap: '0.6rem', padding: '0.65rem', background: C.card, border: `1px solid ${C.border2}`, borderRadius: 4, marginBottom: '0.4rem', alignItems: 'flex-start' }}>
      <Avatar name={c.name || c.email} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {c.name
          ? <div style={{ fontFamily: sans, fontSize: '0.78rem', fontWeight: 600, color: C.text, marginBottom: '0.08rem' }}>{c.name}</div>
          : <div style={{ fontFamily: mono, fontSize: '0.55rem', color: C.ghost, fontStyle: 'italic' }}>Meno neznáme</div>
        }
        {c.role && <div style={{ fontFamily: mono, fontSize: '0.46rem', letterSpacing: '1px', textTransform: 'uppercase', color: C.purple, marginBottom: '0.12rem' }}>{c.role}</div>}
        {c.email
          ? <a href={`mailto:${c.email}`} style={{ fontFamily: mono, fontSize: '0.54rem', color: C.green, display: 'block', marginBottom: '0.06rem' }}>✉ {c.email}</a>
          : <div style={{ fontFamily: mono, fontSize: '0.52rem', color: C.ghost, fontStyle: 'italic' }}>Email nenájdený.</div>
        }
        {c.phone && <div style={{ fontFamily: mono, fontSize: '0.52rem', color: C.dim }}>📞 {c.phone}</div>}
        <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {c.confidence && (
            <span style={{ fontFamily: mono, fontSize: '0.4rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: confColor, padding: '0.03rem 0.28rem', border: `1px solid ${confColor}44`, borderRadius: 2 }}>{c.confidence}</span>
          )}
          {c.emailType && c.emailType !== 'PERSONAL' && (
            <span style={{ fontFamily: mono, fontSize: '0.4rem', letterSpacing: '1px', textTransform: 'uppercase', color: C.amber, padding: '0.03rem 0.28rem', border: `1px solid ${C.amber}33`, borderRadius: 2 }}>{c.emailType}</span>
          )}
          {c.source && c.source !== 'manuálne zadanie' && (
            <a href={c.source.startsWith('http') ? c.source : '#'} target="_blank" rel="noreferrer"
              style={{ fontFamily: mono, fontSize: '0.44rem', color: C.ghost }}>🔗</a>
          )}
        </div>
      </div>
      {onRemove && (
        <button onClick={onRemove} style={{ background: 'transparent', border: 'none', color: C.ghost, fontSize: '0.7rem', cursor: 'pointer', flexShrink: 0, padding: '0.1rem', lineHeight: 1 }}>✕</button>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ClientIntelligenceDashboard({ target: initialT, onClose, onDelete }) {
  const [t,              setT]              = useState(initialT)
  const [activeKey,      setActiveKey]      = useState('overview')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [gatherLoading,  setGatherLoading]  = useState(false)
  const [signalLoading,  setSignalLoading]  = useState(false)
  const [signalMsg,      setSignalMsg]      = useState('')
  const [findLoading,    setFindLoading]    = useState(false)
  const [findMsg,        setFindMsg]        = useState('')
  const [foundContacts,  setFoundContacts]  = useState(null)
  const [emailDraft,     setEmailDraft]     = useState(t.emailDraft || { sk:{subject:'',body:''}, de:{subject:'',body:''}, en:{subject:'',body:''} })

  const fit      = t.strikerFitScore || t.overallScore || 0
  const fitColor = fit >= 80 ? C.orange : fit >= 60 ? C.amber : C.dim
  const isLive   = t.reviewsSource === 'serpapi'

  // ── Handlers ──────────────────────────────────────────────────────────────────

  async function runAiAnalysis() {
    setGatherLoading(true)
    try {
      const res  = await fetch('/.netlify/functions/ai-analysis', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ companyName:t.name, city:t.city, segment:t.segment, segmentLabel:t.segmentLabel, fitScore:t.strikerFitScore||50, language:'sk' }) })
      const data = await res.json()
      if (data.ok) {
        setAnalysisResult(data)
        if (data.subject||data.draft) setEmailDraft(prev => ({...prev, sk:{subject:data.subject||'', body:data.draft||''}}))
      }
    } catch(e){} finally { setGatherLoading(false) }
  }

  async function runSignalEngine() {
    setSignalLoading(true); setSignalMsg('')
    try {
      const res  = await fetch('/.netlify/functions/serpapi-reviews', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ companyName:t.name, url:t.web, segment:t.segment, segmentLabel:t.segmentLabel, city:t.city, country:t.country||'DE', strikerFitScore:t.strikerFitScore||50, painPoints:analysisResult?.painPoints||[], aiReasoning:analysisResult?.reasoning||'' }) })
      const data = await res.json()
      if (data.ok) {
        await updateTarget(t.id, { heatPressure:data.heatPressure, heatPressureReason:data.heatPressureReason, thermalDependency:data.thermalDependency, thermalDependencyReason:data.thermalDependencyReason, operatingCostPressure:data.operatingCostPressure, operatingCostPressureReason:data.operatingCostPressureReason, modernizationNeed:data.modernizationNeed, modernizationNeedReason:data.modernizationNeedReason, boilerDependencyProb:data.boilerDependencyProb, boilerDependencyProbReason:data.boilerDependencyProbReason, willingnessToSolve:data.willingnessToSolve, willingnessToSolveReason:data.willingnessToSolveReason, reviewsSource:data.reviewsSource, reviewsCachedAt:data.reviewsCachedAt, reviewRating:data.reviewRating, reviewCount:data.reviewCount, reviewSummary:data.reviewSummary, liveSignals:data.liveSignals||[] })
        setSignalMsg(data.reviewsSource==='serpapi' ? `✅ LIVE · ${data.reviewCount||0} recenzií` : '✓ Signály')
      }
    } catch(e){ setSignalMsg('⚠ '+e.message) } finally { setSignalLoading(false) }
  }

  async function runFindContacts() {
    setFindLoading(true); setFindMsg('')
    try {
      const res  = await fetch('/.netlify/functions/find-contacts', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ companyName:t.name, website:t.web, city:t.city, country:t.country||'DE' }) })
      const data = await res.json()
      if (data.ok) {
        setFoundContacts(data.contacts||[])
        if (data.generalEmail && !t.email) await updateTarget(t.id, {email:data.generalEmail})
        setFindMsg(data.contacts?.length ? `✅ ${data.contacts.length} kontakt(y)` : 'ℹ Nenajdené')
      }
    } catch(e){ setFindMsg('⚠ '+e.message) } finally { setFindLoading(false) }
  }

  async function saveDraft(lang, subject, body) {
    const updated = {...emailDraft, [lang]:{subject,body}}
    setEmailDraft(updated)
    await updateTarget(t.id, {emailDraft:updated})
  }

  // ── Center content ────────────────────────────────────────────────────────────

  function renderCenter() {

    if (activeKey === 'overview') return (
      <div style={{display:'flex',flexDirection:'column',gap:'0.85rem'}}>
        <SLabel>Prehľad klienta</SLabel>

        {/* Summary cards */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem'}}>
          <InfoPill label="Segment"       value={t.segmentLabel||t.segment} />
          <InfoPill label="Lokalita"      value={[t.city,t.country].filter(Boolean).join(', ')} />
          <InfoPill label="Web"           value={t.web} color={C.purple} />
          <InfoPill label="STRIKER FIT"   value={fit ? `${fit}/100` : '—'} color={fitColor} />
        </div>

        {/* Tags */}
        {Object.keys(t.signalsByCategory||{}).length > 0 && (
          <div style={{display:'flex',gap:'0.25rem',flexWrap:'wrap'}}>
            {Object.entries(t.signalsByCategory||{}).map(([k,v])=>(
              <span key={k} style={{fontFamily:mono,fontSize:'0.46rem',padding:'0.05rem 0.32rem',border:`1px solid ${C.purple}44`,borderRadius:2,color:C.purple,background:`${C.purple}0d`}}>{v.label||k}</span>
            ))}
          </div>
        )}

        {/* Short AI profile */}
        {(t.clientCard?.clientProfile || analysisResult?.reasoning) && (
          <div style={{background:C.card,border:`1px solid ${C.border2}`,borderLeft:`2px solid ${C.orange}`,borderRadius:3,padding:'0.75rem 0.9rem'}}>
            <SLabel>🧠 AI Profil</SLabel>
            <p style={{fontFamily:sans,fontSize:'0.7rem',color:C.sub,lineHeight:1.65,margin:0}}>
              {(t.clientCard?.clientProfile||analysisResult?.reasoning||'').split('\n\n')[0]}
            </p>
          </div>
        )}

        {/* Quick energy snapshot */}
        {t.heatPressure != null && (
          <div style={{background:C.card,border:`1px solid ${C.border2}`,borderRadius:3,padding:'0.75rem 0.9rem'}}>
            <SLabel>Energetický snapshot</SLabel>
            <MetricBar label="Teplotný tlak"      value={t.heatPressure} />
            <MetricBar label="Závislosť od tepla" value={t.thermalDependency} />
            <MetricBar label="Potreba moderniz."  value={t.modernizationNeed} />
          </div>
        )}
      </div>
    )

    if (activeKey === 'ai-profile') return (
      <div style={{display:'flex',flexDirection:'column',gap:'0.85rem'}}>
        <SLabel>AI Profil klienta</SLabel>
        <ProgressBar running={gatherLoading} maxSecs={15} type="ai" />
        <button onClick={runAiAnalysis} disabled={gatherLoading}
          style={{fontFamily:mono,fontSize:'0.55rem',letterSpacing:'1px',textTransform:'uppercase',padding:'0.35rem 0.85rem',border:`1px solid ${C.amber}44`,background:'rgba(255,170,0,0.07)',color:C.amber,borderRadius:3,cursor:'pointer',alignSelf:'flex-start',opacity:gatherLoading?0.6:1}}>
          {gatherLoading ? '⏳ Analyzujem...' : '🧠 Generovať AI profil'}
        </button>
        {(t.clientCard?.clientProfile || analysisResult?.reasoning) ? (
          <div style={{background:C.card,border:`1px solid ${C.border2}`,borderLeft:`2px solid ${C.orange}`,borderRadius:3,padding:'0.85rem 1rem'}}>
            {(t.clientCard?.clientProfile||analysisResult?.reasoning||'').split('\n\n').map((p,i)=>(
              <p key={i} style={{fontFamily:sans,fontSize:'0.72rem',color:i===0?C.text:C.sub,lineHeight:1.7,margin:0,marginBottom:i<3?'0.5rem':0}}>{p}</p>
            ))}
          </div>
        ) : (
          <div style={{fontFamily:mono,fontSize:'0.6rem',color:C.ghost,fontStyle:'italic'}}>Klikni „Generovať AI profil" pre vygenerovanie obchodného profilu.</div>
        )}
        {analysisResult && (
          <>
            {analysisResult.painPoints?.length > 0 && (
              <div style={{background:C.card,border:`1px solid ${C.border2}`,borderRadius:3,padding:'0.75rem 0.9rem'}}>
                <SLabel>Pain Points</SLabel>
                {analysisResult.painPoints.map((p,i)=>(
                  <div key={i} style={{display:'flex',gap:'0.35rem',marginBottom:'0.22rem'}}>
                    <span style={{color:C.red,flexShrink:0}}>⚠</span>
                    <span style={{fontFamily:mono,fontSize:'0.58rem',color:C.sub,lineHeight:1.5}}>{p}</span>
                  </div>
                ))}
              </div>
            )}
            {analysisResult.mainArgument && (
              <div style={{padding:'0.55rem 0.75rem',background:'rgba(0,204,136,0.05)',border:`1px solid rgba(0,204,136,0.2)`,borderRadius:3}}>
                <span style={{fontFamily:mono,fontSize:'0.55rem',color:C.green}}>✦ {analysisResult.mainArgument}</span>
              </div>
            )}
          </>
        )}
      </div>
    )

    if (activeKey === 'energy') return (
      <div style={{display:'flex',flexDirection:'column',gap:'0.85rem'}}>
        <SLabel>Energetický problém</SLabel>
        <ProgressBar running={signalLoading} maxSecs={12} type="signal" />
        <button onClick={runSignalEngine} disabled={signalLoading}
          style={{fontFamily:mono,fontSize:'0.55rem',letterSpacing:'1px',textTransform:'uppercase',padding:'0.35rem 0.85rem',border:`1px solid ${C.orange}44`,background:'rgba(255,92,0,0.07)',color:C.orange,borderRadius:3,cursor:'pointer',alignSelf:'flex-start',opacity:signalLoading?0.6:1}}>
          {signalLoading ? '⏳ Analyzujem...' : '⚡ Spustiť Signal Engine'}
        </button>
        {signalMsg && <div style={{fontFamily:mono,fontSize:'0.55rem',color:signalMsg.startsWith('✅')?C.green:C.amber}}>{signalMsg}</div>}
        {t.heatPressure != null ? (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem'}}>
            {[
              {label:'Teplotný tlak',       value:t.heatPressure,          reason:t.heatPressureReason},
              {label:'Závislosť od tepla',  value:t.thermalDependency,     reason:t.thermalDependencyReason},
              {label:'Prevádzkové náklady', value:t.operatingCostPressure, reason:t.operatingCostPressureReason},
              {label:'Potreba moderniz.',   value:t.modernizationNeed,     reason:t.modernizationNeedReason},
              {label:'Závislosť od kotlov', value:t.boilerDependencyProb,  reason:t.boilerDependencyProbReason},
              {label:'Ochota riešiť',       value:t.willingnessToSolve,    reason:t.willingnessToSolveReason},
            ].map(({label,value,reason})=>(
              <div key={label} style={{background:C.card,border:`1px solid ${C.border2}`,borderRadius:3,padding:'0.65rem 0.75rem'}}>
                <div style={{fontFamily:mono,fontSize:'0.42rem',letterSpacing:'1.5px',textTransform:'uppercase',color:C.ghost,marginBottom:'0.22rem'}}>{label}</div>
                {value!=null?(
                  <>
                    <div style={{fontFamily:mono,fontSize:'1.25rem',fontWeight:700,color:value>=70?C.orange:value>=45?C.amber:C.dim,marginBottom:'0.18rem'}}>{value}</div>
                    <div style={{height:3,background:C.border,borderRadius:2,overflow:'hidden',marginBottom:'0.22rem'}}>
                      <div style={{width:`${value}%`,height:'100%',background:value>=70?C.orange:value>=45?C.amber:C.dim,borderRadius:2}}/>
                    </div>
                    {reason && <div style={{fontFamily:mono,fontSize:'0.48rem',color:C.dim,lineHeight:1.4}}>{reason}</div>}
                  </>
                ):(
                  <div style={{fontFamily:mono,fontSize:'0.52rem',color:C.ghost,fontStyle:'italic'}}>Čaká na analýzu</div>
                )}
              </div>
            ))}
          </div>
        ):(
          <div style={{fontFamily:mono,fontSize:'0.6rem',color:C.ghost,fontStyle:'italic'}}>Spusti Signal Engine pre energetické metriky.</div>
        )}
      </div>
    )

    if (activeKey === 'signals') return (
      <div style={{display:'flex',flexDirection:'column',gap:'0.85rem'}}>
        <SLabel>Signály</SLabel>
        {isLive && t.reviewSummary && (
          <div style={{background:C.card,border:`1px solid rgba(0,204,136,0.25)`,borderLeft:`3px solid ${C.green}`,borderRadius:3,padding:'0.75rem 0.9rem'}}>
            <div style={{fontFamily:mono,fontSize:'0.42rem',letterSpacing:'1.5px',textTransform:'uppercase',color:C.green,marginBottom:'0.3rem'}}>🔴 LIVE · Google · ★{t.reviewRating} ({t.reviewCount||0})</div>
            <p style={{fontFamily:sans,fontSize:'0.7rem',color:C.sub,lineHeight:1.65,margin:0}}>{t.reviewSummary}</p>
          </div>
        )}
        {(t.liveSignals||[]).length > 0 ? (
          <div>
            <SLabel>Detekované kľúčové slová</SLabel>
            <div style={{display:'flex',flexWrap:'wrap',gap:'0.25rem'}}>
              {(t.liveSignals||[]).map((s,i)=>(
                <span key={i} style={{fontFamily:mono,fontSize:'0.5rem',padding:'0.06rem 0.35rem',border:`1px solid ${C.amber}44`,borderRadius:2,color:C.amber,background:`${C.amber}0d`}}>{s}</span>
              ))}
            </div>
          </div>
        ):(
          <div style={{fontFamily:mono,fontSize:'0.6rem',color:C.ghost,fontStyle:'italic'}}>Spusti Signal Engine pre live signály.</div>
        )}
        {Object.keys(t.signalsByCategory||{}).length > 0 && (
          <div>
            <SLabel>Kategórie signálov</SLabel>
            {Object.entries(t.signalsByCategory).map(([k,v])=>(
              <div key={k} style={{marginBottom:'0.45rem'}}>
                <div style={{fontFamily:mono,fontSize:'0.44rem',letterSpacing:'1px',textTransform:'uppercase',color:C.purple,marginBottom:'0.15rem'}}>{v.label||k} ({v.count||0})</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:'0.18rem'}}>
                  {(v.found||[]).slice(0,6).map((kw,i)=>(
                    <span key={i} style={{fontFamily:mono,fontSize:'0.46rem',padding:'0.03rem 0.28rem',border:`1px solid ${C.purple}33`,borderRadius:2,color:C.purple,background:`${C.purple}0d`}}>{kw}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )

    if (activeKey === 'reviews') return (
      <div style={{display:'flex',flexDirection:'column',gap:'0.85rem'}}>
        <SLabel>Recenzie</SLabel>
        {isLive ? (
          <>
            <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
              <span style={{fontFamily:mono,fontSize:'0.42rem',letterSpacing:'1.5px',textTransform:'uppercase',color:C.green,padding:'0.05rem 0.3rem',border:`1px solid ${C.green}44`,borderRadius:2,background:`${C.green}12`}}>🔴 LIVE DATA</span>
              {t.reviewRating && <span style={{fontFamily:mono,fontSize:'0.7rem',color:C.amber}}>★ {t.reviewRating} <span style={{fontSize:'0.5rem',color:C.dim}}>({t.reviewCount||0} recenzií)</span></span>}
            </div>
            {t.reviewSummary && <div style={{background:C.card,border:`1px solid ${C.border2}`,borderRadius:3,padding:'0.8rem 0.95rem'}}><p style={{fontFamily:sans,fontSize:'0.72rem',color:C.sub,lineHeight:1.7,margin:0}}>{t.reviewSummary}</p></div>}
            <div style={{display:'flex',flexWrap:'wrap',gap:'0.22rem'}}>
              {(t.liveSignals||[]).map((s,i)=><span key={i} style={{fontFamily:mono,fontSize:'0.48rem',padding:'0.04rem 0.3rem',border:`1px solid ${C.amber}44`,borderRadius:2,color:C.amber,background:`${C.amber}0d`}}>{s}</span>)}
            </div>
          </>
        ):(
          <div>
            <div style={{fontFamily:mono,fontSize:'0.6rem',color:C.ghost,fontStyle:'italic',marginBottom:'0.75rem'}}>Google recenzie zatiaľ nenačítané. Spusti Signal Engine.</div>
            <button onClick={()=>{runSignalEngine();setActiveKey('energy')}}
              style={{fontFamily:mono,fontSize:'0.55rem',letterSpacing:'1px',textTransform:'uppercase',padding:'0.35rem 0.85rem',border:`1px solid ${C.orange}44`,background:'rgba(255,92,0,0.07)',color:C.orange,borderRadius:3,cursor:'pointer'}}>
              ⚡ Signal Engine
            </button>
          </div>
        )}
      </div>
    )

    if (activeKey === 'contacts') return (
      <div style={{display:'flex',flexDirection:'column',gap:'0.85rem'}}>
        <SLabel>Kontakty</SLabel>
        <ProgressBar running={findLoading} maxSecs={15} type="ai" />
        <button onClick={runFindContacts} disabled={findLoading}
          style={{fontFamily:mono,fontSize:'0.55rem',letterSpacing:'1px',textTransform:'uppercase',padding:'0.35rem 0.85rem',border:`1px solid ${C.orange}44`,background:'rgba(255,92,0,0.07)',color:C.orange,borderRadius:3,cursor:'pointer',alignSelf:'flex-start',opacity:findLoading?0.6:1}}>
          {findLoading?'⏳ Hľadám...':'👤 Nájsť kontakty'}
        </button>
        {findMsg && <div style={{fontFamily:mono,fontSize:'0.55rem',color:findMsg.startsWith('✅')?C.green:C.amber}}>{findMsg}</div>}
        {(t.contacts||[]).map((c,i)=><ContactRow key={i} c={c} onRemove={()=>removeContact(t.id,i)}/>)}
        {foundContacts?.map((c,i)=>(
          <div key={i} style={{position:'relative'}}>
            <ContactRow c={c}/>
            <button onClick={()=>{addContact(t.id,{...c,source:c.source||'web',confidence:c.confidence||'MEDIUM'});setFoundContacts(prev=>prev.filter(fc=>fc!==c))}}
              style={{position:'absolute',top:'0.55rem',right:'0.55rem',fontFamily:mono,fontSize:'0.48rem',padding:'0.1rem 0.4rem',border:`1px solid ${C.green}44`,background:`${C.green}12`,color:C.green,borderRadius:2,cursor:'pointer'}}>
              + Uložiť
            </button>
          </div>
        ))}
        {!t.contacts?.length && !foundContacts && (
          <div style={{fontFamily:mono,fontSize:'0.6rem',color:C.ghost,fontStyle:'italic'}}>Nenašla sa overená kontaktná osoba. Klikni „Nájsť kontakty".</div>
        )}
        {t.email && <div style={{padding:'0.5rem 0.7rem',background:C.card,border:`1px solid ${C.border2}`,borderRadius:3,fontFamily:mono,fontSize:'0.58rem'}}><a href={`mailto:${t.email}`} style={{color:C.green}}>✉ {t.email}</a><span style={{color:C.ghost,marginLeft:'0.4rem'}}>všeobecný email</span></div>}
      </div>
    )

    if (activeKey === 'email') return (
      <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
        <SLabel>Email</SLabel>
        <EmailDraftEditor draft={emailDraft} onSave={saveDraft} defaultLang="de" />
      </div>
    )

    if (activeKey === 'followup') return (
      <div style={{display:'flex',flexDirection:'column',gap:'0.85rem'}}>
        <SLabel>Follow-up / Ďalší krok</SLabel>
        {t.clientCard?.salesStrategy ? (
          <>
            <div style={{background:C.card,border:`1px solid rgba(0,204,136,0.2)`,borderLeft:`3px solid ${C.green}`,borderRadius:3,padding:'0.75rem 0.9rem'}}>
              <div style={{fontFamily:mono,fontSize:'0.42rem',letterSpacing:'2px',textTransform:'uppercase',color:C.green,marginBottom:'0.35rem'}}>ĎALŠÍ KROK</div>
              <div style={{fontFamily:sans,fontSize:'0.72rem',color:C.text,fontWeight:600,marginBottom:'0.3rem'}}>{t.clientCard.salesStrategy.nextStep}</div>
              <div style={{fontFamily:mono,fontSize:'0.55rem',color:C.sub}}>Začni: {t.clientCard.salesStrategy.startWith||'email'} · Tón: {t.clientCard.salesStrategy.tone}</div>
            </div>
            {t.clientCard.salesStrategy.emphasize?.length > 0 && (
              <div style={{background:C.card,border:`1px solid ${C.border2}`,borderRadius:3,padding:'0.65rem 0.8rem'}}>
                <SLabel>Zdôrazniť</SLabel>
                {t.clientCard.salesStrategy.emphasize.map((e,i)=><div key={i} style={{fontFamily:mono,fontSize:'0.56rem',color:C.green,marginBottom:'0.18rem'}}>✓ {e}</div>)}
              </div>
            )}
            {t.clientCard.risks?.length > 0 && (
              <div style={{background:C.card,border:`1px solid ${C.border2}`,borderRadius:3,padding:'0.65rem 0.8rem'}}>
                <SLabel>Riziká</SLabel>
                {t.clientCard.risks.map((r,i)=><div key={i} style={{fontFamily:mono,fontSize:'0.56rem',color:C.sub,marginBottom:'0.18rem'}}>⚠ {r}</div>)}
              </div>
            )}
          </>
        ):(
          <div style={{fontFamily:mono,fontSize:'0.6rem',color:C.ghost,fontStyle:'italic'}}>Generuj AI kartu klienta pre odporúčaný follow-up.</div>
        )}
      </div>
    )

    if (activeKey === 'finance') return (
      <div style={{display:'flex',flexDirection:'column',gap:'0.85rem'}}>
        <SLabel>Financie / ROI</SLabel>
        {analysisResult?.opportunity && <div style={{background:C.card,border:`1px solid ${C.border2}`,borderRadius:3,padding:'0.75rem 0.9rem'}}><SLabel>Príležitosť</SLabel><p style={{fontFamily:sans,fontSize:'0.72rem',color:C.sub,lineHeight:1.65,margin:0}}>{analysisResult.opportunity}</p></div>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem'}}>
          <div style={{background:C.card,border:`1px solid ${C.border2}`,borderRadius:3,padding:'0.7rem'}}><SLabel>Cena STRIKER</SLabel><div style={{fontFamily:mono,fontSize:'1.1rem',fontWeight:700,color:C.orange}}>8 000–10 000 €</div></div>
          <div style={{background:C.card,border:`1px solid ${C.border2}`,borderRadius:3,padding:'0.7rem'}}><SLabel>ROI</SLabel><div style={{fontFamily:mono,fontSize:'1.1rem',fontWeight:700,color:C.green}}>6–36 mesiacov</div></div>
          {t.estimatedROI && <div style={{background:C.card,border:`1px solid ${C.border2}`,borderRadius:3,padding:'0.7rem'}}><SLabel>AI odhad ROI</SLabel><div style={{fontFamily:mono,fontSize:'0.68rem',color:C.amber}}>{t.estimatedROI}</div></div>}
          {t.estimatedHeatDemand && <div style={{background:C.card,border:`1px solid ${C.border2}`,borderRadius:3,padding:'0.7rem'}}><SLabel>Spotreba tepla</SLabel><div style={{fontFamily:mono,fontSize:'0.68rem',color:C.sub}}>{t.estimatedHeatDemand}</div></div>}
        </div>
      </div>
    )

    return <Placeholder onClose={()=>setActiveKey('overview')}/>
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{position:'fixed',inset:0,background:C.bg,zIndex:300,display:'flex',overflow:'hidden'}}>

      {/* ── LEFT PANEL ── */}
      <div style={{width:270,flexShrink:0,background:'#050709',borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',overflowY:'auto'}}>

        {/* Company image / placeholder */}
        <div style={{height:170,flexShrink:0,position:'relative',overflow:'hidden',background:`linear-gradient(135deg, #0d1117 0%, rgba(255,92,0,0.08) 100%)`}}>
          {t.photoUrl
            ? <img src={t.photoUrl} alt={t.name} style={{width:'100%',height:'100%',objectFit:'cover',opacity:0.85}}/>
            : (
              <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'0.4rem'}}>
                <div style={{fontFamily:sans,fontSize:'3.5rem',fontWeight:700,color:`${C.orange}55`,lineHeight:1}}>{(t.name||'X').charAt(0)}</div>
                <div style={{fontFamily:mono,fontSize:'0.42rem',letterSpacing:'2px',textTransform:'uppercase',color:C.ghost}}>STRIKER</div>
              </div>
            )
          }
          {/* Overlay gradient */}
          <div style={{position:'absolute',bottom:0,left:0,right:0,height:50,background:'linear-gradient(to top, #050709, transparent)'}}/>
          {/* Close button */}
          <button onClick={onClose} style={{position:'absolute',top:'0.5rem',right:'0.5rem',background:'rgba(0,0,0,0.5)',border:`1px solid ${C.border}`,color:C.dim,borderRadius:3,padding:'0.15rem 0.45rem',fontFamily:mono,fontSize:'0.5rem',cursor:'pointer'}}>✕</button>
        </div>

        {/* Company info */}
        <div style={{padding:'0.85rem 1rem',borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontFamily:sans,fontSize:'0.95rem',fontWeight:700,color:C.text,lineHeight:1.25,marginBottom:'0.2rem'}}>{t.name}</div>
          <div style={{fontFamily:mono,fontSize:'0.52rem',color:C.dim,marginBottom:'0.35rem'}}>{[t.city,t.country].filter(Boolean).join(' · ')}</div>
          <div style={{fontFamily:mono,fontSize:'0.5rem',color:C.sub,marginBottom:'0.4rem'}}>{t.segmentLabel||t.segment||'—'}</div>
          <div style={{display:'flex',alignItems:'center',gap:'0.5rem',flexWrap:'wrap'}}>
            <div style={{fontFamily:mono,fontSize:'1.25rem',fontWeight:700,color:fitColor,lineHeight:1}}>{fit}</div>
            <div>
              <div style={{fontFamily:mono,fontSize:'0.38rem',letterSpacing:'1.5px',textTransform:'uppercase',color:C.ghost}}>STRIKER FIT</div>
              {isLive && <span style={{fontFamily:mono,fontSize:'0.38rem',letterSpacing:'1px',textTransform:'uppercase',color:C.green,padding:'0.02rem 0.25rem',border:`1px solid ${C.green}44`,borderRadius:2,background:`${C.green}12`}}>LIVE</span>}
            </div>
          </div>
        </div>

        {/* Navigation menu */}
        <div style={{flex:1,padding:'0.4rem 0'}}>
          {NAV.map(item => {
            const active = item.key === activeKey
            return (
              <button key={item.key} onClick={()=>setActiveKey(item.key)}
                style={{width:'100%',display:'flex',alignItems:'center',gap:'0.6rem',padding:'0.5rem 1rem',background:active?'rgba(255,92,0,0.1)':'transparent',border:'none',borderLeft:`2px solid ${active?C.orange:'transparent'}`,color:active?C.orange:C.dim,fontFamily:mono,fontSize:'0.58rem',letterSpacing:'0.5px',cursor:'pointer',textAlign:'left',transition:'all 0.12s'}}>
                <span style={{fontSize:'0.78rem',width:18,flexShrink:0,textAlign:'center'}}>{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── CENTER ── */}
      <div style={{flex:1,overflowY:'auto',padding:'1.5rem 1.75rem',borderRight:`1px solid ${C.border}`}}>
        {renderCenter()}
      </div>

      {/* ── RIGHT PANEL — Contacts ── */}
      <div style={{width:280,flexShrink:0,overflowY:'auto',padding:'1.2rem 1rem'}}>
        <SLabel>Kontakty</SLabel>

        {/* General email */}
        {t.email && (
          <div style={{marginBottom:'0.65rem',padding:'0.45rem 0.6rem',background:C.card,border:`1px solid ${C.border2}`,borderRadius:3}}>
            <div style={{fontFamily:mono,fontSize:'0.4rem',letterSpacing:'1.5px',textTransform:'uppercase',color:C.ghost,marginBottom:'0.1rem'}}>Všeobecný email</div>
            <a href={`mailto:${t.email}`} style={{fontFamily:mono,fontSize:'0.6rem',color:C.green}}>✉ {t.email}</a>
          </div>
        )}

        {/* Saved contacts */}
        {(t.contacts||[]).map((c,i)=><ContactRow key={i} c={c} onRemove={()=>removeContact(t.id,i)}/>)}

        {/* Found contacts (unsaved) */}
        {foundContacts?.length > 0 && (
          <>
            <div style={{fontFamily:mono,fontSize:'0.4rem',letterSpacing:'2px',textTransform:'uppercase',color:C.green,margin:'0.5rem 0 0.35rem'}}>Nájdené — na uloženie</div>
            {foundContacts.map((c,i)=>(
              <div key={i} style={{position:'relative',marginBottom:'0.4rem'}}>
                <ContactRow c={c}/>
                <button onClick={()=>{addContact(t.id,{...c,source:c.source||'web',confidence:c.confidence||'MEDIUM'});setFoundContacts(prev=>prev.filter(fc=>fc!==c))}}
                  style={{position:'absolute',bottom:'0.5rem',right:'0.55rem',fontFamily:mono,fontSize:'0.45rem',padding:'0.08rem 0.38rem',border:`1px solid ${C.green}44`,background:`${C.green}12`,color:C.green,borderRadius:2,cursor:'pointer'}}>
                  + Uložiť
                </button>
              </div>
            ))}
          </>
        )}

        {!t.contacts?.length && !foundContacts && !t.email && (
          <div style={{fontFamily:mono,fontSize:'0.55rem',color:C.ghost,fontStyle:'italic',marginBottom:'0.75rem'}}>Nenašla sa overená kontaktná osoba.</div>
        )}

        {/* Find contacts button */}
        <button onClick={()=>{runFindContacts();setActiveKey('contacts')}} disabled={findLoading}
          style={{width:'100%',fontFamily:mono,fontSize:'0.52rem',letterSpacing:'1px',textTransform:'uppercase',padding:'0.32rem 0.6rem',border:`1px solid ${C.border2}`,background:'transparent',color:findLoading?C.ghost:C.dim,borderRadius:3,cursor:'pointer',marginTop:'0.35rem',opacity:findLoading?0.6:1}}>
          {findLoading?'⏳ Hľadám...':'🔍 Nájsť kontakty'}
        </button>
        {findMsg && <div style={{fontFamily:mono,fontSize:'0.5rem',color:findMsg.startsWith('✅')?C.green:C.amber,marginTop:'0.3rem'}}>{findMsg}</div>}

        {/* Status */}
        <div style={{marginTop:'1.25rem'}}>
          <SLabel>Pipeline stav</SLabel>
          {INTEL_STATUS_LIST.slice(0,5).map(s=>(
            <button key={s.key} onClick={()=>updateTarget(t.id,{status:s.key})}
              style={{display:'block',width:'100%',fontFamily:mono,fontSize:'0.5rem',letterSpacing:'0.5px',textTransform:'uppercase',padding:'0.25rem 0.55rem',border:`1px solid ${s.color}44`,background:t.status===s.key?s.bg:'transparent',color:t.status===s.key?s.color:C.ghost,borderRadius:2,cursor:'pointer',textAlign:'left',marginBottom:'0.2rem'}}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Data source */}
        <div style={{marginTop:'1.25rem',padding:'0.5rem 0.6rem',background:C.card,border:`1px solid ${C.border}`,borderRadius:3}}>
          <div style={{fontFamily:mono,fontSize:'0.4rem',letterSpacing:'1.5px',textTransform:'uppercase',color:C.ghost,marginBottom:'0.2rem'}}>Zdroj dát</div>
          <div style={{fontFamily:mono,fontSize:'0.52rem',color:C.dim}}>{isLive?'🔴 Google Reviews + AI':'AI simulácia'}</div>
          {t.reviewsCachedAt && <div style={{fontFamily:mono,fontSize:'0.48rem',color:C.ghost,marginTop:'0.1rem'}}>{new Date(t.reviewsCachedAt).toLocaleDateString('sk-SK')}</div>}
        </div>
      </div>
    </div>
  )
}
