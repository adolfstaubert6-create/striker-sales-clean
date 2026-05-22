import { useState, useEffect } from 'react'
import { INTEL_STATUS_LIST, REC_META, INTEL_STATUSES, scoreColor } from '../constants/intelMeta.js'
import { updateTarget, deleteTarget, addContact, removeContact } from '../services/intelTargetService.js'

const mono = "'IBM Plex Mono',monospace"
const sans = "'IBM Plex Sans',sans-serif"

const TABS = [
  { key: 'overview', label: 'Prehľad'       },
  { key: 'energy',   label: 'Energia'        },
  { key: 'ai',       label: 'AI Analýza'     },
  { key: 'sources',  label: 'Dôkazy'         },
  { key: 'roi',      label: 'ROI'            },
  { key: 'crm',      label: 'CRM'            },
  { key: 'email',    label: 'Email'          },
]

const CONTACT_ROLES = ['CEO / Geschäftsführer', 'Facility Manager', 'Energy Manager', 'Technical Director', 'Operations Manager', 'Iné']

// ── Pomocné komponenty ────────────────────────────────────────────────────────

function InfoRow({ label, value, color }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.4rem', alignItems: 'flex-start' }}>
      <span style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#4b5563', flexShrink: 0, width: 120, paddingTop: '0.12rem' }}>{label}</span>
      <span style={{ fontFamily: mono, fontSize: '0.65rem', color: color || '#9ca3af', lineHeight: 1.5 }}>{value}</span>
    </div>
  )
}

function ScoreGauge({ label, score }) {
  const c = scoreColor(score ?? 0)
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: mono, fontSize: '0.46rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ height: 4, background: '#1e2530', borderRadius: 2, overflow: 'hidden', marginBottom: '0.2rem' }}>
        <div style={{ width: `${score ?? 0}%`, height: '100%', background: c, borderRadius: 2 }} />
      </div>
      <div style={{ fontFamily: mono, fontSize: '0.8rem', fontWeight: 700, color: c }}>{score ?? '–'}%</div>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#ff5c00', marginBottom: '0.85rem', paddingBottom: '0.5rem', borderBottom: '1px solid #1e2530' }}>
      {children}
    </div>
  )
}

function TextBlock({ value, placeholder }) {
  if (!value) return <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#374151', fontStyle: 'italic' }}>{placeholder || '—'}</div>
  return <div style={{ fontFamily: mono, fontSize: '0.65rem', color: '#9ca3af', lineHeight: 1.7 }}>{value}</div>
}

// ── Taby ──────────────────────────────────────────────────────────────────────

function TabOverview({ t }) {
  const rec      = REC_META[t.recommendation] || REC_META.monitor
  const priority = t.overallScore >= 80 ? 'EXTREME TARGET' : t.overallScore >= 70 ? 'HIGH TARGET' : t.overallScore >= 55 ? 'MEDIUM TARGET' : 'LOW PRIORITY'
  const priColor = t.overallScore >= 80 ? '#ff5c00' : t.overallScore >= 70 ? '#ffaa00' : t.overallScore >= 55 ? '#818cf8' : '#4b5563'

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '5fr 2fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <div>
          <SectionTitle>Základné informácie</SectionTitle>
          <InfoRow label="Web"           value={t.web}        color="#818cf8" />
          <InfoRow label="Email"         value={t.email}      color="#00cc88" />
          <InfoRow label="Telefón"       value={t.phone}      />
          <InfoRow label="Adresa"        value={t.address}    />
          <InfoRow label="Lokalita"      value={[t.city, t.country].filter(Boolean).join(', ')} />
          <InfoRow label="Segment"       value={t.segmentLabel} />
          <InfoRow label="Veľkosť"       value={t.estimatedBusinessSize || t.companySize} />
          <InfoRow label="Hodnotenie"    value={t.rating ? `${t.rating}★` : null} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: mono, fontSize: '3rem', fontWeight: 700, color: scoreColor(t.overallScore ?? 0), lineHeight: 1 }}>{t.overallScore ?? '–'}</div>
          <div style={{ fontFamily: mono, fontSize: '0.45rem', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '0.2rem' }}>STRIKER FIT</div>
          <div style={{ marginTop: '0.75rem' }}>
            <span style={{ fontFamily: mono, fontSize: '0.52rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0.22rem 0.6rem', borderRadius: 2, color: priColor, background: `${priColor}18`, border: `1px solid ${priColor}44` }}>
              🎯 {priority}
            </span>
          </div>
          <div style={{ marginTop: '0.65rem' }}>
            <span style={{ fontFamily: mono, fontSize: '0.52rem', color: rec.color }}>{rec.icon} {rec.label}</span>
          </div>
        </div>
      </div>

      <SectionTitle>AI Zhrnutie</SectionTitle>
      <div style={{ padding: '0.75rem 0.85rem', background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3, marginBottom: '1rem' }}>
        <TextBlock value={t.aiReasoning || t.whyFound} placeholder="Spustiť AI analýzu pre zhrnutie" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '0.75rem' }}>
        <ScoreGauge label="Striker FIT"    score={t.strikerFitScore}    />
        <ScoreGauge label="Energ. problém" score={t.energyPainScore}    />
        <ScoreGauge label="Urgentnosť"     score={t.urgencyScore}       />
        <ScoreGauge label="Fin. sila"      score={t.financialPowerScore} />
        <ScoreGauge label="Záujem"         score={t.buyingIntentScore}  />
      </div>
    </div>
  )
}

function ProblemCard({ p, idx }) {
  const sevColor = { critical: '#ff5c00', high: '#ffaa00', medium: '#818cf8', low: '#4b5563' }
  const sevLabel = { critical: 'KRITICKÝ', high: 'VYSOKÝ', medium: 'STREDNÝ', low: 'NÍZKY' }
  const color    = sevColor[p.severity] || '#ffaa00'

  return (
    <div style={{ background: '#0d1117', border: `1px solid ${color}33`, borderLeft: `3px solid ${color}`, borderRadius: 3, padding: '0.85rem 1rem', marginBottom: '0.65rem' }}>
      {/* Hlavička problému */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.65rem' }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '1.5px', textTransform: 'uppercase', color, marginBottom: '0.2rem' }}>
            🔥 PROBLÉM {idx + 1} · {sevLabel[p.severity] || 'STREDNÝ'}
          </div>
          <div style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: '0.9rem', fontWeight: 700, color: '#e8eaed' }}>
            {p.problem}
          </div>
        </div>
        {/* Confidence meter */}
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '0.75rem' }}>
          <div style={{ fontFamily: mono, fontSize: '1.3rem', fontWeight: 700, color, lineHeight: 1 }}>{p.confidence}%</div>
          <div style={{ fontFamily: mono, fontSize: '0.42rem', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '1px' }}>confidence</div>
          <div style={{ marginTop: '0.2rem', width: 56, height: 3, background: '#1e2530', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${p.confidence}%`, height: '100%', background: color, borderRadius: 2 }} />
          </div>
        </div>
      </div>

      {/* Detekovaný text / citácia */}
      {p.detectedText && (
        <div style={{ marginBottom: '0.5rem', padding: '0.4rem 0.6rem', background: '#111418', border: '1px solid #1e2530', borderRadius: 2 }}>
          <div style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#374151', marginBottom: '0.15rem' }}>
            📄 Detekovaný text
          </div>
          <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#818cf8', fontStyle: 'italic', lineHeight: 1.5 }}>
            „{p.detectedText}"
          </div>
        </div>
      )}

      {/* Zdroj */}
      {p.source && p.source !== 'segment_analysis' && (
        <div style={{ marginBottom: '0.5rem' }}>
          <span style={{ fontFamily: mono, fontSize: '0.45rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#374151' }}>Zdroj: </span>
          <a href={p.source.startsWith('http') ? p.source : `https://${p.source}`} target="_blank" rel="noreferrer"
            style={{ fontFamily: mono, fontSize: '0.58rem', color: '#818cf8', wordBreak: 'break-all' }}>
            {p.source}
          </a>
        </div>
      )}
      {p.source === 'segment_analysis' && (
        <div style={{ marginBottom: '0.5rem', fontFamily: mono, fontSize: '0.52rem', color: '#374151' }}>
          ℹ Zdroj: AI odhad na základe segmentu (bez webu)
        </div>
      )}

      {/* AI reasoning */}
      {p.aiReasoning && (
        <div style={{ marginBottom: '0.5rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#374151', marginBottom: '0.15rem' }}>
            🧠 AI reasoning
          </div>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#9ca3af', lineHeight: 1.6 }}>{p.aiReasoning}</div>
        </div>
      )}

      {/* STRIKER riešenie */}
      {p.strikerSolution && (
        <div style={{ padding: '0.35rem 0.6rem', background: 'rgba(0,204,136,0.06)', border: '1px solid rgba(0,204,136,0.2)', borderRadius: 2 }}>
          <span style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#00cc88' }}>✦ STRIKER rieši: </span>
          <span style={{ fontFamily: mono, fontSize: '0.6rem', color: '#00cc88' }}>{p.strikerSolution}</span>
        </div>
      )}
    </div>
  )
}

function MetricGauge({ label, value, reason }) {
  const isEmpty = value == null
  const color   = !isEmpty ? (value >= 70 ? '#ff5c00' : value >= 50 ? '#ffaa00' : '#4b5563') : '#1e2530'
  return (
    <div style={{ padding: '0.7rem 0.8rem', background: '#0d1117', border: `1px solid ${!isEmpty && value >= 70 ? color + '33' : '#1e2530'}`, borderRadius: 3 }}>
      <div style={{ fontFamily: mono, fontSize: '0.45rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#374151', marginBottom: '0.3rem' }}>{label}</div>
      {isEmpty ? (
        <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#1e2530' }}>—</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.25rem' }}>
            <div style={{ fontFamily: mono, fontSize: '1.35rem', fontWeight: 700, color, lineHeight: 1 }}>{value}%</div>
          </div>
          <div style={{ height: 3, background: '#1e2530', borderRadius: 2, overflow: 'hidden', marginBottom: '0.3rem' }}>
            <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 2 }} />
          </div>
          {reason && (
            <div style={{ fontFamily: mono, fontSize: '0.52rem', color: '#6b7280', lineHeight: 1.45 }}>{reason}</div>
          )}
        </>
      )}
    </div>
  )
}

function TabEnergy({ t }) {
  const profile    = t.problemProfile    || []
  const hasProfile = profile.length > 0
  const signalsCats = t.signalsByCategory || {}
  const hasMetrics = t.heatPressure != null

  return (
    <div>
      {/* Problem Profile */}
      <SectionTitle>⚠ Problem Profile</SectionTitle>

      {!hasProfile ? (
        <div style={{ padding: '1.25rem', background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3, textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#374151', marginBottom: '0.35rem' }}>
            Žiadny Problem Profile — spustiť Firecrawl analýzu
          </div>
          <div style={{ fontFamily: mono, fontSize: '0.55rem', color: '#1e2530' }}>
            → AI Analýza tab → 🔍 Spustiť Firecrawl analýzu
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '1.25rem' }}>
          {profile.map((p, i) => <ProblemCard key={i} p={p} idx={i} />)}
        </div>
      )}

      {/* AI metriky */}
      <SectionTitle>AI Metriky energetickej záťaže</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.65rem', marginBottom: '1.25rem' }}>
        <MetricGauge label="Heat Pressure"        value={t.heatPressure}          reason={t.heatPressureReason} />
        <MetricGauge label="Thermal Dependency"   value={t.thermalDependency}     reason={t.thermalDependencyReason} />
        <MetricGauge label="Operating Cost"       value={t.operatingCostPressure} reason={t.operatingCostPressureReason} />
        <MetricGauge label="Modernization Need"   value={t.modernizationNeed}     reason={t.modernizationNeedReason} />
        <MetricGauge label="Boiler Dependency"    value={t.boilerDependencyProb}  reason={t.boilerDependencyProbReason} />
        <MetricGauge label="Willingness To Solve" value={t.willingnessToSolve}    reason={t.willingnessToSolveReason} />
      </div>

      {/* Signály podľa kategórie */}
      {Object.keys(signalsCats).length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <SectionTitle>Detekované signály podľa kategórie</SectionTitle>
          {Object.entries(signalsCats).map(([key, data]) => (
            <div key={key} style={{ marginBottom: '0.6rem' }}>
              <div style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#818cf8', marginBottom: '0.2rem' }}>
                {data.label || key}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.22rem' }}>
                {(data.found || []).map((kw, i) => (
                  <span key={i} style={{ fontFamily: mono, fontSize: '0.52rem', padding: '0.08rem 0.38rem', border: '1px solid #818cf844', borderRadius: 2, color: '#818cf8', background: 'rgba(129,140,248,0.08)' }}>{kw}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Firecrawl findings */}
      {t.lastGatherSummary?.pressureExplanation && (
        <div>
          <SectionTitle>Firecrawl — celkový tlak</SectionTitle>
          <div style={{ padding: '0.6rem 0.8rem', background: '#0d1117', border: `1px solid ${t.lastGatherSummary.isRealPressure ? '#ff5c0044' : '#1e2530'}`, borderRadius: 3 }}>
            <div style={{ fontFamily: mono, fontSize: '0.6rem', color: t.lastGatherSummary.isRealPressure ? '#ff5c00' : '#6b7280', lineHeight: 1.5 }}>
              {t.lastGatherSummary.isRealPressure ? '⚡ REÁLNY TLAK: ' : '💬 Marketing: '}
              {t.lastGatherSummary.pressureExplanation}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TabAI({ t, onGather, gathering, gatherMsg, gatherPhase }) {
  return (
    <div>
      {/* Gather button + live status */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
          <button onClick={onGather} disabled={gathering} style={{ fontFamily: mono, fontSize: '0.62rem', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0.35rem 0.9rem', border: '1px solid #ffaa0066', background: gathering ? 'rgba(255,170,0,0.05)' : 'rgba(255,170,0,0.1)', color: '#ffaa00', borderRadius: 2, cursor: 'pointer', fontWeight: 600, opacity: gathering ? 0.7 : 1 }}>
            {gathering ? '⏳ Analyzujem...' : '🔍 Spustiť Firecrawl analýzu'}
          </button>
          {gatherMsg && (
            <span style={{ fontFamily: mono, fontSize: '0.6rem', color: gatherMsg.startsWith('✓') ? '#00cc88' : '#ef4444' }}>
              {gatherMsg}
            </span>
          )}
        </div>
        {/* Live phase indicator počas zbierania */}
        {gathering && gatherPhase && (
          <div style={{ fontFamily: mono, fontSize: '0.55rem', color: '#374151', paddingLeft: '0.2rem' }}>
            {gatherPhase}
          </div>
        )}
      </div>

      <SectionTitle>AI Reasoning</SectionTitle>
      <div style={{ padding: '0.75rem 0.85rem', background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3, marginBottom: '1rem' }}>
        <TextBlock value={t.aiReasoning} placeholder="Spustiť Firecrawl pre AI reasoning z reálneho webu" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        {[
          { label: 'Čo firmu trápi',          value: t.aiAnalysis?.whatTroubles  },
          { label: 'Prečo vhodná pre STRIKER', value: t.aiAnalysis?.whyStrikerFit },
          { label: 'Hlavný obchodný argument', value: t.aiAnalysis?.mainArgument  },
          { label: 'Obchodná príležitosť',     value: t.businessOpportunity       },
        ].map(({ label, value }) => (
          <div key={label} style={{ padding: '0.6rem 0.75rem', background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3 }}>
            <div style={{ fontFamily: mono, fontSize: '0.45rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#374151', marginBottom: '0.3rem' }}>{label}</div>
            <TextBlock value={value} placeholder="—" />
          </div>
        ))}
      </div>

      <SectionTitle>Energetická intenzita a tepelná analýza</SectionTitle>
      <InfoRow label="Tepelná potreba"    value={t.estimatedHeatDemand}      color="#ff5c00" />
      <InfoRow label="Energetická intenz."value={t.estimatedEnergyIntensity} color="#ffaa00" />
      <InfoRow label="Veľkosť firmy"      value={t.estimatedBusinessSize}    />
      <InfoRow label="Timing"             value={t.lastGatherSummary?.timingAssessment} />
      {t.lastGatherSummary?.strikerArgument && (
        <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.8rem', background: 'rgba(0,204,136,0.06)', border: '1px solid rgba(0,204,136,0.2)', borderRadius: 3 }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#00cc88', lineHeight: 1.5 }}>✦ {t.lastGatherSummary.strikerArgument}</div>
        </div>
      )}

      {(t.extractedKeywords || []).length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <SectionTitle>Extrahované kľúčové slová</SectionTitle>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
            {t.extractedKeywords.map((kw, i) => (
              <span key={i} style={{ fontFamily: mono, fontSize: '0.52rem', padding: '0.08rem 0.38rem', border: '1px solid #1e2530', borderRadius: 2, color: '#6b7280', background: '#0d1117' }}>{kw}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TabSources({ t }) {
  const sources   = t.sources   || []
  const evidence  = t.keyEvidence || []
  const crawlPages = t.scrapedPages || []

  return (
    <div>
      <SectionTitle>Kľúčové dôkazy a citácie</SectionTitle>
      {evidence.length === 0 ? (
        <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#374151', marginBottom: '1rem', fontStyle: 'italic' }}>Spustiť Firecrawl pre extrakciu dôkazov</div>
      ) : (
        <div style={{ marginBottom: '1rem' }}>
          {evidence.map((ev, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', padding: '0.5rem 0.7rem', background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3 }}>
              <span style={{ color: '#ffaa00', fontFamily: mono, fontSize: '0.7rem', flexShrink: 0 }}>„</span>
              <span style={{ fontFamily: mono, fontSize: '0.62rem', color: '#9ca3af', lineHeight: 1.5, fontStyle: 'italic' }}>{ev}</span>
            </div>
          ))}
        </div>
      )}

      <SectionTitle>Zdroje a URL</SectionTitle>
      {sources.length === 0 ? (
        <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#374151', marginBottom: '1rem', fontStyle: 'italic' }}>Žiadne zdroje — spustiť Firecrawl analýzu</div>
      ) : (
        <div style={{ marginBottom: '1rem' }}>
          {sources.map((s, i) => (
            <div key={i} style={{ padding: '0.55rem 0.75rem', background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3, marginBottom: '0.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                <span style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#374151', background: '#1e2530', padding: '0.06rem 0.3rem', borderRadius: 2 }}>{s.type || 'web'}</span>
                {s.title && <span style={{ fontFamily: mono, fontSize: '0.62rem', color: '#e8eaed', fontWeight: 600 }}>{s.title}</span>}
              </div>
              {s.url && <a href={s.url} target="_blank" rel="noreferrer" style={{ fontFamily: mono, fontSize: '0.58rem', color: '#818cf8', display: 'block', wordBreak: 'break-all' }}>{s.url}</a>}
              {s.description && <div style={{ fontFamily: mono, fontSize: '0.58rem', color: '#6b7280', marginTop: '0.15rem' }}>{s.description}</div>}
            </div>
          ))}
        </div>
      )}

      {crawlPages.length > 0 && (
        <div>
          <SectionTitle>Naskenované stránky</SectionTitle>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {crawlPages.map((p, i) => (
              <span key={i} style={{ fontFamily: mono, fontSize: '0.5rem', padding: '0.12rem 0.45rem', borderRadius: 2,
                color: p.found ? '#00cc88' : '#374151',
                background: p.found ? 'rgba(0,204,136,0.08)' : 'transparent',
                border: `1px solid ${p.found ? '#00cc8833' : '#1e2530'}`,
              }}>
                {p.found ? `✓ ${p.categoryLabel || p.category}` : `— ${p.categoryLabel || p.category}`}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TabROI({ t }) {
  return (
    <div>
      <SectionTitle>ROI Analýza</SectionTitle>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          { label: '⚡ Odhadovaná tepelná potreba', value: t.estimatedHeatDemand,      color: '#ff5c00' },
          { label: '🔋 Energetická intenzita',       value: t.estimatedEnergyIntensity, color: '#ffaa00' },
          { label: '💰 Odhad ROI',                   value: t.estimatedROI,             color: '#00cc88' },
          { label: '📈 Obchodná príležitosť',         value: t.businessOpportunity,      color: '#818cf8' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: '0.75rem 0.85rem', background: '#0d1117', border: `1px solid ${value ? color + '33' : '#1e2530'}`, borderRadius: 3 }}>
            <div style={{ fontFamily: mono, fontSize: '0.46rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#374151', marginBottom: '0.3rem' }}>{label}</div>
            {value
              ? <div style={{ fontFamily: mono, fontSize: '0.68rem', color, lineHeight: 1.5, fontWeight: 600 }}>{value}</div>
              : <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#374151', fontStyle: 'italic' }}>Spustiť AI analýzu</div>
            }
          </div>
        ))}
      </div>

      <SectionTitle>STRIKER FIT detaily</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '0.75rem' }}>
        <ScoreGauge label="Striker FIT"    score={t.strikerFitScore}    />
        <ScoreGauge label="Tepelná potreba" score={t.heatDemandScore}   />
        <ScoreGauge label="Energ. problém" score={t.energyPainScore}    />
        <ScoreGauge label="Fin. sila"      score={t.financialPowerScore} />
        <ScoreGauge label="Urgentnosť"     score={t.urgencyScore}       />
      </div>

      {t.nextStep && (
        <div style={{ marginTop: '1.25rem', padding: '0.65rem 0.85rem', background: 'rgba(0,204,136,0.06)', border: '1px solid rgba(0,204,136,0.2)', borderRadius: 3 }}>
          <div style={{ fontFamily: mono, fontSize: '0.45rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#00cc88', marginBottom: '0.2rem' }}>Odporúčaný ďalší krok</div>
          <div style={{ fontFamily: mono, fontSize: '0.65rem', color: '#00cc88' }}>→ {t.nextStep}</div>
        </div>
      )}
    </div>
  )
}

function TabCRM({ t, onStatusChange, saving }) {
  const [addCtOpen, setAddCtOpen] = useState(false)
  const [newCt, setNewCt]         = useState({ role: '', name: '', email: '', phone: '' })

  return (
    <div>
      <SectionTitle>Pipeline stav</SectionTitle>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1.25rem' }}>
        {INTEL_STATUS_LIST.map(s => (
          <button key={s.key} onClick={() => onStatusChange(s.key)} disabled={!!saving}
            style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.25rem 0.6rem', borderRadius: 2, cursor: 'pointer',
              border: `1px solid ${s.color}44`, background: t.status === s.key ? s.bg : 'transparent',
              color: t.status === s.key ? s.color : '#374151', fontWeight: t.status === s.key ? 700 : 400 }}>
            {s.label}
          </button>
        ))}
      </div>

      <SectionTitle>Kontaktné osoby</SectionTitle>
      {(t.contacts || []).length === 0 && !addCtOpen && (
        <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#374151', marginBottom: '0.75rem', fontStyle: 'italic' }}>Zatiaľ žiadne kontakty</div>
      )}
      {(t.contacts || []).map((c, i) => (
        <div key={i} style={{ padding: '0.55rem 0.75rem', background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3, marginBottom: '0.35rem' }}>
          {c.role && <div style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#818cf8', marginBottom: '0.12rem' }}>{c.role}</div>}
          {c.name && <div style={{ fontFamily: sans, fontSize: '0.85rem', fontWeight: 600, color: '#e8eaed' }}>{c.name}</div>}
          <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.1rem' }}>
            {c.email && <a href={`mailto:${c.email}`} style={{ fontFamily: mono, fontSize: '0.56rem', color: '#00cc88' }}>✉ {c.email}</a>}
            {c.phone && <span style={{ fontFamily: mono, fontSize: '0.56rem', color: '#6b7280' }}>📞 {c.phone}</span>}
          </div>
        </div>
      ))}

      {(t.suggestedContacts || []).filter(sg => !(t.contacts||[]).some(c => c.role === sg.role)).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.5rem' }}>
          {(t.suggestedContacts||[]).filter(sg => !(t.contacts||[]).some(c => c.role === sg.role)).map((sg, i) => (
            <button key={i} onClick={() => { setNewCt(p => ({...p, role: sg.role})); setAddCtOpen(true) }}
              style={{ fontFamily: mono, fontSize: '0.5rem', padding: '0.15rem 0.5rem', border: '1px dashed #374151', background: 'transparent', color: '#6b7280', borderRadius: 2, cursor: 'pointer' }}>
              + {sg.role}
            </button>
          ))}
        </div>
      )}

      {addCtOpen ? (
        <div style={{ background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3, padding: '0.75rem', marginTop: '0.35rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <div>
              <label style={css.label}>Pozícia</label>
              <select style={css.input} value={newCt.role} onChange={e => setNewCt(p => ({...p, role: e.target.value}))}>
                <option value="">—</option>
                {CONTACT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div><label style={css.label}>Meno</label><input style={css.input} placeholder="Jan Novák" value={newCt.name} onChange={e => setNewCt(p => ({...p, name: e.target.value}))} /></div>
            <div><label style={css.label}>Email</label><input style={css.input} placeholder="jan@firma.de" value={newCt.email} onChange={e => setNewCt(p => ({...p, email: e.target.value}))} /></div>
            <div><label style={css.label}>Telefón</label><input style={css.input} placeholder="+49 170 000 0000" value={newCt.phone} onChange={e => setNewCt(p => ({...p, phone: e.target.value}))} /></div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={async () => { await addContact(t.id, newCt); setNewCt({ role:'',name:'',email:'',phone:'' }); setAddCtOpen(false) }} style={css.saveBtn}>✓ Uložiť</button>
            <button onClick={() => setAddCtOpen(false)} style={css.cancelBtn}>Zrušiť</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAddCtOpen(true)} style={css.ghostBtn}>+ Pridať kontaktnú osobu</button>
      )}
    </div>
  )
}

function TabEmail({ t }) {
  return (
    <div>
      <SectionTitle>Email</SectionTitle>
      {t.email ? (
        <div style={{ marginBottom: '1rem', padding: '0.65rem 0.85rem', background: 'rgba(0,204,136,0.06)', border: '1px solid rgba(0,204,136,0.25)', borderRadius: 3 }}>
          <div style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#00cc88', marginBottom: '0.2rem' }}>✓ Email nájdený</div>
          <a href={`mailto:${t.email}`} style={{ fontFamily: mono, fontSize: '0.75rem', color: '#00cc88', fontWeight: 600 }}>{t.email}</a>
        </div>
      ) : (
        <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(255,170,0,0.05)', border: '1px solid rgba(255,170,0,0.2)', borderRadius: 3, marginBottom: '1rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#ffaa00' }}>⚠ Email nebol nájdený</div>
          <div style={{ fontFamily: mono, fontSize: '0.58rem', color: '#4b5563', marginTop: '0.2rem' }}>Skús manuálne alebo cez Firecrawl analýzu</div>
        </div>
      )}

      <div style={{ padding: '1.5rem', background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3, textAlign: 'center' }}>
        <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#374151', marginBottom: '0.5rem' }}>Email workflow</div>
        <div style={{ fontFamily: mono, fontSize: '0.55rem', color: '#1e2530' }}>→ Bude pridaný v ďalšej fáze</div>
      </div>
    </div>
  )
}

// ── Hlavný modal ──────────────────────────────────────────────────────────────

export default function IntelCompanyDetail({ target: t, initialTab = 'overview', onClose, onDelete }) {
  const [activeTab,   setActiveTab]   = useState(initialTab)
  const [saving,      setSaving]      = useState({})
  const [confirmDel,  setConfirmDel]  = useState(false)
  const [gathering,   setGathering]   = useState(false)
  const [gatherMsg,   setGatherMsg]   = useState('')
  const [gatherPhase, setGatherPhase] = useState('')

  // Sync tab keď initialTab sa zmení (napr. CRM/EMAIL button na karte)
  useEffect(() => { setActiveTab(initialTab) }, [initialTab])

  // Detect when background function finishes via Firestore update on t
  useEffect(() => {
    if (t.gatherStatus === 'done' && gathering) {
      setGathering(false)
      setGatherPhase('')
      const pages = t.webPagesCount || 0
      setGatherMsg(`✓ AI analýza hotová · ${pages} stránok · ${(t.signals||[]).length} signálov`)
    }
    if (t.gatherStatus === 'error' && gathering) {
      setGathering(false)
      setGatherPhase('')
      setGatherMsg('⚠ ' + (t.gatherError || 'Analýza zlyhala'))
    }
  }, [t.gatherStatus, t.crawlTimestamp])

  const oc = scoreColor(t.overallScore ?? 0)

  async function handleStatusChange(status) {
    setSaving(p => ({ ...p, status: true }))
    try { await updateTarget(t.id, { status }) }
    catch (e) { console.error(e) }
    finally { setSaving(p => ({ ...p, status: false })) }
  }

  async function handleDelete() {
    await deleteTarget(t.id)
    onDelete?.(); onClose()
  }

  async function handleGather() {
    console.log('[handleGather] CALLED — t.id:', t.id, 't.web:', t.web, 't.name:', t.name)
    const hasWeb = !!t.web
    if (!hasWeb) console.warn('[handleGather] No web URL — using name/segment/city fallback')

    setGathering(true)
    setGatherMsg('')
    setGatherPhase(hasWeb ? '🚀 Spúšťam AI analýzu...' : '🧠 AI analýza (bez webu)...')

    const endpoint = '/.netlify/functions/start-intel'
    const payload = {
      targetId:          t.id,
      companyName:       t.name,
      url:               t.web,
      segment:           t.segment,
      segmentLabel:      t.segmentLabel,
      city:              t.city,
      country:           t.country,
      urgencyScore:      t.urgencyScore,
      buyingIntentScore: t.buyingIntentScore || 50,
      strikerFitScore:   t.strikerFitScore,
      heatDemandScore:   t.heatDemandScore   || 50,
      energyPainScore:   t.energyPainScore,
      financialPowerScore: t.financialPowerScore,
    }

    console.log('[handleGather] BEFORE FETCH →', endpoint, payload)

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      console.log('[handleGather] AFTER FETCH — status:', res.status, 'ok:', res.ok)

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.error('[handleGather] FETCH NOT OK — body preview:', text.slice(0, 200))
        throw new Error(`start-intel HTTP ${res.status}: ${text.slice(0, 100)}`)
      }

      console.log('[handleGather] SUCCESS — background pipeline started, waiting for Firebase')
      setGatherPhase('⏳ AI analyzuje... (20–50 sek)')
    } catch (e) {
      console.error('[handleGather] FETCH ERROR:', e.message)
      setGathering(false)
      setGatherPhase('')
      setGatherMsg('⚠ ' + e.message)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 200, padding: '1rem', overflowY: 'auto' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#0d1117', border: '1px solid #1e2530', borderTop: `3px solid ${oc}`, borderRadius: 4, width: '100%', maxWidth: 900, margin: '0 auto' }}>

        {/* Modal hlavička */}
        <div style={{ padding: '1rem 1.4rem', borderBottom: '1px solid #1e2530', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: sans, fontSize: '1.15rem', fontWeight: 700, color: '#e8eaed', marginBottom: '0.2rem' }}>{t.name}</div>
            <div style={{ fontFamily: mono, fontSize: '0.58rem', color: '#6b7280' }}>
              {scoreColor(t.overallScore ?? 0) === '#00cc88' ? '🟢' : scoreColor(t.overallScore ?? 0) === '#ffaa00' ? '🟡' : '🔴'}{' '}
              {t.overallScore ?? '–'}/100 · {[t.city, t.country].filter(Boolean).join(', ')}
              {t.segmentLabel && <span> · {t.segmentLabel}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button onClick={() => setConfirmDel(true)} style={{ fontFamily: mono, fontSize: '0.58rem', letterSpacing: '1px', background: 'rgba(239,68,68,0.08)', border: '1px solid #ef444466', color: '#ef4444', padding: '0.28rem 0.65rem', borderRadius: 2, cursor: 'pointer' }}>🗑</button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#6b7280', fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1, padding: '0 0.2rem' }}>✕</button>
          </div>
        </div>

        {/* Tab navigácia */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1e2530', padding: '0 1.4rem', overflowX: 'auto' }}>
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              fontFamily: mono, fontSize: '0.58rem', letterSpacing: '1.5px', textTransform: 'uppercase',
              padding: '0.55rem 0.85rem', border: 'none', background: 'transparent', cursor: 'pointer',
              borderBottom: activeTab === tab.key ? '2px solid #ff5c00' : '2px solid transparent',
              color: activeTab === tab.key ? '#ff5c00' : '#374151',
              whiteSpace: 'nowrap', transition: 'color 0.15s',
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab obsah */}
        <div style={{ padding: '1.25rem 1.4rem' }}>
          {activeTab === 'overview' && <TabOverview t={t} />}
          {activeTab === 'energy'   && <TabEnergy   t={t} />}
          {activeTab === 'ai'       && <TabAI       t={t} onGather={handleGather} gathering={gathering} gatherMsg={gatherMsg} gatherPhase={gatherPhase} />}
          {activeTab === 'sources'  && <TabSources  t={t} />}
          {activeTab === 'roi'      && <TabROI      t={t} />}
          {activeTab === 'crm'      && <TabCRM      t={t} onStatusChange={handleStatusChange} saving={saving} />}
          {activeTab === 'email'    && <TabEmail    t={t} />}
        </div>

        {/* Confirm delete */}
        {confirmDel && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '1rem' }}>
            <div style={{ background: '#111418', border: '1px solid #ef444466', borderRadius: 4, padding: '1.5rem', maxWidth: 360, width: '100%' }}>
              <div style={{ fontFamily: mono, fontSize: '0.62rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#ef4444', marginBottom: '0.65rem' }}>⚠ Odstrániť kartu</div>
              <div style={{ fontFamily: sans, fontSize: '0.95rem', fontWeight: 700, color: '#e8eaed', marginBottom: '0.35rem' }}>{t.name}</div>
              <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#6b7280', marginBottom: '1.1rem' }}>Táto akcia je nevratná.</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={handleDelete} style={{ ...css.saveBtn, background: '#ef4444' }}>🗑 Odstrániť</button>
                <button onClick={() => setConfirmDel(false)} style={css.cancelBtn}>Zrušiť</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const css = {
  label:     { display: 'block', fontFamily: mono, fontSize: '0.48rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.2rem' },
  input:     { width: '100%', background: '#111418', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: mono, fontSize: '0.72rem', padding: '0.42rem 0.6rem', borderRadius: 2, outline: 'none', boxSizing: 'border-box' },
  saveBtn:   { fontFamily: mono, fontSize: '0.62rem', letterSpacing: '1px', textTransform: 'uppercase', background: '#00cc88', border: 'none', color: '#0a0c0f', padding: '0.38rem 0.85rem', borderRadius: 2, cursor: 'pointer', fontWeight: 700 },
  cancelBtn: { fontFamily: mono, fontSize: '0.62rem', letterSpacing: '1px', background: 'transparent', border: '1px solid #1e2530', color: '#6b7280', padding: '0.38rem 0.7rem', borderRadius: 2, cursor: 'pointer' },
  ghostBtn:  { fontFamily: mono, fontSize: '0.56rem', letterSpacing: '1px', textTransform: 'uppercase', background: 'transparent', border: '1px dashed #1e2530', color: '#374151', padding: '0.28rem 0.7rem', borderRadius: 2, cursor: 'pointer', marginTop: '0.2rem' },
}
