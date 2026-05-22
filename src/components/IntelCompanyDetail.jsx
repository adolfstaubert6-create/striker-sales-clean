import { useState, useEffect } from 'react'
import { INTEL_STATUS_LIST, REC_META, INTEL_STATUSES, scoreColor } from '../constants/intelMeta.js'
import { updateTarget, deleteTarget, addContact, removeContact } from '../services/intelTargetService.js'
import { sk } from '../locales/sk.js'
import { de } from '../locales/de.js'
import { en } from '../locales/en.js'
import EmailDraftEditor from './EmailDraftEditor.jsx'
import NextBestAction   from './NextBestAction.jsx'
import ProgressBar      from './ProgressBar.jsx'
import ClientCard       from './ClientCard.jsx'
import AiProfilePanel   from './AiProfilePanel.jsx'

const LOCALES = { sk, de, en }

function defaultDraftLang(target) {
  const c = (target?.country || '').toLowerCase()
  if (c === 'sk') return 'sk'
  if (['de', 'at', 'ch'].includes(c)) return 'de'
  return 'de'
}

function initDraft(target) {
  const d = target?.emailDraft || {}
  return {
    sk: d.sk || { subject: '', body: '' },
    de: d.de || { subject: '', body: '' },
    en: d.en || { subject: '', body: '' },
  }
}

const mono = "'IBM Plex Mono',monospace"
const sans = "'IBM Plex Sans',sans-serif"

const TABS = [
  { key: 'overview', label: 'Prehľad'       },
  { key: 'klient',   label: '🕵️ Klient'     },
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

function TabOverview({ t, analysisResult, clientCard, clientCardLoading, onGenerateClientCard }) {
  const rec      = REC_META[t.recommendation] || REC_META.monitor
  const priority = t.overallScore >= 80 ? 'EXTREME TARGET' : t.overallScore >= 70 ? 'HIGH TARGET' : t.overallScore >= 55 ? 'MEDIUM TARGET' : 'LOW PRIORITY'
  const priColor = t.overallScore >= 80 ? '#ff5c00' : t.overallScore >= 70 ? '#ffaa00' : t.overallScore >= 55 ? '#818cf8' : '#4b5563'

  return (
    <div>
      {/* AI Profile Panel — always visible at the top */}
      <AiProfilePanel
        target={t}
        analysisResult={analysisResult}
        clientCard={clientCard}
        onGenerate={onGenerateClientCard}
        loading={clientCardLoading}
      />

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
            🧠 AI zdôvodnenie
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

function metricLevel(v) {
  if (v >= 86) return { label: 'KRITICKÝ', color: '#ef4444' }
  if (v >= 66) return { label: 'VYSOKÝ',   color: '#ff5c00' }
  if (v >= 41) return { label: 'STREDNÝ',  color: '#ffaa00' }
  return              { label: 'NÍZKY',    color: '#6b7280' }
}

function MetricGauge({ label, value, reason }) {
  const isEmpty = value == null
  const color   = !isEmpty ? (value >= 66 ? '#ff5c00' : value >= 41 ? '#ffaa00' : '#6b7280') : '#1e2530'
  const level   = !isEmpty ? metricLevel(value) : null
  return (
    <div style={{ padding: '0.7rem 0.8rem', background: '#0d1117', border: `1px solid ${!isEmpty && value >= 66 ? color + '33' : '#1e2530'}`, borderRadius: 3 }}>
      <div style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#374151', marginBottom: '0.3rem' }}>{label}</div>
      {isEmpty ? (
        <div style={{ fontFamily: mono, fontSize: '0.52rem', color: '#374151', fontStyle: 'italic', lineHeight: 1.4 }}>Čaká na AI signal analýzu</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.22rem', flexWrap: 'wrap' }}>
            <div style={{ fontFamily: mono, fontSize: '1.25rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
            {level && (
              <span style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '1.5px', textTransform: 'uppercase',
                color: level.color, fontWeight: 700, padding: '0.06rem 0.3rem',
                border: `1px solid ${level.color}44`, borderRadius: 2, background: `${level.color}12` }}>
                {level.label}
              </span>
            )}
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

function TabEnergy({ t, onSignal, signalLoading, signalMsg, signalTimeoutMsg }) {
  const profile     = t.problemProfile    || []
  const hasProfile  = profile.length > 0
  const signalsCats = t.signalsByCategory || {}
  const isLive      = t.reviewsSource === 'serpapi'

  return (
    <div>
      {/* Signal Engine trigger */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.1rem', flexWrap: 'wrap' }}>
        <button
          onClick={onSignal}
          disabled={signalLoading}
          style={{
            fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1.5px', textTransform: 'uppercase',
            padding: '0.35rem 0.9rem', border: '1px solid #ff5c0066',
            background: signalLoading ? 'rgba(255,92,0,0.05)' : 'rgba(255,92,0,0.1)',
            color: '#ff5c00', borderRadius: 2, cursor: 'pointer', fontWeight: 600,
            opacity: signalLoading ? 0.7 : 1, transition: 'all 0.15s',
          }}
        >
          {signalLoading ? '⏳ Analyzujem signály...' : '🔍 Signal Engine'}
        </button>
        {signalMsg && !signalLoading && (
          <span style={{ fontFamily: mono, fontSize: '0.6rem',
            color: (signalMsg.startsWith('✓') || signalMsg.startsWith('✅')) ? '#00cc88' : '#ef4444' }}>
            {signalMsg}
          </span>
        )}
      </div>

      {/* Signal Engine Progress Bar */}
      <ProgressBar running={signalLoading} maxSecs={12} type="signal" timeoutMsg={signalTimeoutMsg} />

      {/* LIVE DATA card */}
      {isLive && (
        <div style={{ marginBottom: '1.1rem', padding: '0.65rem 0.85rem',
          background: 'rgba(0,204,136,0.04)', border: '1px solid rgba(0,204,136,0.2)',
          borderLeft: '3px solid #00cc88', borderRadius: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '2px', textTransform: 'uppercase',
              color: '#00cc88', fontWeight: 700, padding: '0.05rem 0.35rem',
              border: '1px solid #00cc8844', borderRadius: 2, background: 'rgba(0,204,136,0.1)' }}>
              🔴 LIVE DATA
            </span>
            <span style={{ fontFamily: mono, fontSize: '0.43rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#374151' }}>
              Google recenzie
            </span>
            {t.reviewRating && (
              <span style={{ fontFamily: mono, fontSize: '0.55rem', color: '#ffaa00' }}>
                ★ {t.reviewRating} ({t.reviewCount || 0} recenzií)
              </span>
            )}
          </div>
          {t.reviewSummary && (
            <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#9ca3af', lineHeight: 1.55, marginBottom: '0.35rem' }}>
              {t.reviewSummary}
            </div>
          )}
          {(t.liveSignals || []).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
              {(t.liveSignals || []).slice(0, 10).map((s, i) => (
                <span key={i} style={{ fontFamily: mono, fontSize: '0.47rem', padding: '0.04rem 0.3rem',
                  border: '1px solid rgba(0,204,136,0.3)', borderRadius: 2,
                  color: '#00cc88', background: 'rgba(0,204,136,0.07)' }}>{s}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Profil problému */}
      <SectionTitle>⚠ Profil problému</SectionTitle>

      {!hasProfile ? (
        <div style={{ padding: '1.25rem', background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3, textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#374151', fontStyle: 'italic' }}>
            Čaká na AI signal analýzu
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '1.25rem' }}>
          {profile.map((p, i) => <ProblemCard key={i} p={p} idx={i} />)}
        </div>
      )}

      {/* AI metriky */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ fontFamily: mono, fontSize: '0.46rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#374151' }}>
          AI Metriky energetickej záťaže
        </span>
        {isLive ? (
          <span style={{ fontFamily: mono, fontSize: '0.42rem', letterSpacing: '1.5px', textTransform: 'uppercase',
            color: '#00cc88', padding: '0.04rem 0.3rem', border: '1px solid #00cc8833',
            borderRadius: 2, background: 'rgba(0,204,136,0.08)' }}>LIVE</span>
        ) : t.reviewsSource === 'simulated' ? (
          <span style={{ fontFamily: mono, fontSize: '0.42rem', letterSpacing: '1.5px', textTransform: 'uppercase',
            color: '#6b7280', padding: '0.04rem 0.3rem', border: '1px solid #374151',
            borderRadius: 2 }}>SIM</span>
        ) : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.65rem', marginBottom: '1.25rem' }}>
        <MetricGauge label="Teplotný tlak"          value={t.heatPressure}          reason={t.heatPressureReason} />
        <MetricGauge label="Závislosť od tepla"     value={t.thermalDependency}     reason={t.thermalDependencyReason} />
        <MetricGauge label="Prevádzkové náklady"    value={t.operatingCostPressure} reason={t.operatingCostPressureReason} />
        <MetricGauge label="Potreba modernizácie"   value={t.modernizationNeed}     reason={t.modernizationNeedReason} />
        <MetricGauge label="Závislosť od kotlov"    value={t.boilerDependencyProb}  reason={t.boilerDependencyProbReason} />
        <MetricGauge label="Ochota riešiť problém"  value={t.willingnessToSolve}    reason={t.willingnessToSolveReason} />
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

const LANG_CODES = ['sk', 'de']
const LANG_FLAGS = { sk: '🇸🇰', de: '🇩🇪', en: '🇬🇧' }

function TabAI({ t, onGather, gathering, gatherMsg, analysisResult, lang, setLang, L, emailDraft, onSaveDraft, onQueueDraft, onDraftDirty, defaultDraftLang, aiTimeoutMsg }) {
  const r = analysisResult
  const flagStyle = (active) => ({
    fontSize: '1.35rem', lineHeight: 1, padding: '0.15rem 0.22rem',
    border: `1.5px solid ${active ? '#ffaa00' : '#1e2530'}`,
    background: active ? 'rgba(255,170,0,0.14)' : 'transparent',
    borderRadius: 4, cursor: 'pointer',
    boxShadow: active ? '0 0 10px rgba(255,170,0,0.4)' : 'none',
    transition: 'all 0.18s ease',
  })

  return (
    <div>
      {/* Language switcher + AI button row */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.1rem', flexWrap: 'wrap' }}>
        {/* AI analysis lang — flags only */}
        <div style={{ display: 'flex', gap: '0.2rem', marginRight: '0.5rem' }}>
          {LANG_CODES.map(code => (
            <button key={code} onClick={() => setLang(code)} style={flagStyle(lang === code)} title={code.toUpperCase()}>
              {LANG_FLAGS[code]}
            </button>
          ))}
        </div>

        {/* AI button */}
        <button onClick={onGather} disabled={gathering}
          style={{ fontFamily: mono, fontSize: '0.62rem', letterSpacing: '1.5px', textTransform: 'uppercase',
            padding: '0.35rem 0.9rem', border: '1px solid #ffaa0066',
            background: gathering ? 'rgba(255,170,0,0.05)' : 'rgba(255,170,0,0.1)',
            color: '#ffaa00', borderRadius: 2, cursor: 'pointer', fontWeight: 600, opacity: gathering ? 0.7 : 1 }}>
          {gathering ? L.analyzing : L.aiBtn}
        </button>

        {gatherMsg && !gathering && (
          <span style={{ fontFamily: mono, fontSize: '0.6rem', color: gatherMsg.startsWith('✓') ? '#00cc88' : '#ef4444' }}>
            {gatherMsg}
          </span>
        )}
      </div>

      {/* AI Progress Bar */}
      <ProgressBar running={gathering} maxSecs={15} type="ai" timeoutMsg={aiTimeoutMsg} />

      {/* Results */}
      {r && (
        <div>
          {/* Score */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem',
            padding: '0.65rem 0.85rem', background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3 }}>
            <div style={{ fontFamily: mono, fontSize: '1.4rem', fontWeight: 700,
              color: r.score >= 75 ? '#00cc88' : r.score >= 55 ? '#ffaa00' : '#ef4444' }}>
              {r.score}
            </div>
            <div style={{ fontFamily: mono, fontSize: '0.52rem', color: '#6b7280' }}>/100 · {L.scoreSuffix}</div>
            {r.usedFallback && (
              <span style={{ fontFamily: mono, fontSize: '0.5rem', color: '#6b7280',
                padding: '0.06rem 0.3rem', border: '1px solid #1e2530', borderRadius: 2 }}>
                {L.fallbackBadge}
              </span>
            )}
          </div>

          {/* Pain points */}
          <SectionTitle>{L.sections.painPoints}</SectionTitle>
          <ul style={{ margin: '0 0 1rem', paddingLeft: '1.1rem' }}>
            {(r.painPoints || []).map((p, i) => (
              <li key={i} style={{ fontFamily: mono, fontSize: '0.62rem', color: '#9ca3af', marginBottom: '0.2rem', lineHeight: 1.5 }}>{p}</li>
            ))}
          </ul>

          {/* Reasoning + Argument + Opportunity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '1rem' }}>
            {[
              { label: L.sections.reasoning,  value: r.reasoning    },
              { label: L.sections.argument,   value: r.mainArgument },
              { label: L.sections.opportunity, value: r.opportunity  },
            ].map(({ label, value }) => value ? (
              <div key={label} style={{ padding: '0.55rem 0.7rem', background: '#0d1117', border: '1px solid #1e2530', borderRadius: 3 }}>
                <div style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#374151', marginBottom: '0.25rem' }}>{label}</div>
                <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#9ca3af', lineHeight: 1.5 }}>{value}</div>
              </div>
            ) : null)}
          </div>

          {/* Email draft editor replaces static preview */}

          {/* Next Best Action */}
          <NextBestAction nba={r.nextBestAction} score={r.score} />
        </div>
      )}

      {!r && !gathering && (
        <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#374151', fontStyle: 'italic', marginBottom: '1.25rem' }}>
          {L.placeholder}
        </div>
      )}

      {/* Email Draft Editor — always visible */}
      <div style={{ marginTop: r ? '1.25rem' : 0 }}>
        <EmailDraftEditor
          draft={emailDraft}
          onSave={onSaveDraft}
          onQueue={onQueueDraft}
          onDirtyChange={onDraftDirty}
          defaultLang={defaultDraftLang}
        />
      </div>
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
  const [gathering,      setGathering]      = useState(false)
  const [gatherMsg,      setGatherMsg]      = useState('')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [lang,           setLang]           = useState('sk')
  const [emailDraft,     setEmailDraft]     = useState(() => initDraft(t))
  const [draftDirty,    setDraftDirty]    = useState(false)
  const [signalLoading,   setSignalLoading]   = useState(false)
  const [signalMsg,       setSignalMsg]       = useState('')
  const [aiTimeoutMsg,    setAiTimeoutMsg]    = useState(null)
  const [signalTimeoutMsg,setSignalTimeoutMsg]= useState(null)
  const [clientCardData,  setClientCardData]  = useState(t.clientCard || null)
  const [clientCardLoading,setClientCardLoading]= useState(false)
  const [clientCardFallback,setClientCardFallback]= useState(false)

  const L = LOCALES[lang] || sk

  // Sync tab keď initialTab sa zmení
  useEffect(() => { setActiveTab(initialTab) }, [initialTab])

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

  async function handleSignalEngine() {
    // Cache check — skip API if data is fresh (< 24h)
    const CACHE_TTL = 24 * 60 * 60 * 1000
    const cachedAt  = t.reviewsCachedAt ? new Date(t.reviewsCachedAt).getTime() : 0
    if (Date.now() - cachedAt < CACHE_TTL && t.heatPressure != null) {
      const src = t.reviewsSource === 'serpapi' ? 'Google Reviews' : 'AI simulácia'
      setSignalMsg(`✓ Z cache (${src}) · obnova za ${Math.round((CACHE_TTL - (Date.now() - cachedAt)) / 3600000)}h`)
      return
    }

    setSignalLoading(true)
    setSignalMsg('')
    setSignalTimeoutMsg(null)
    try {
      const payload = {
        companyName:     t.name,
        segment:         t.segment,
        segmentLabel:    t.segmentLabel,
        city:            t.city,
        country:         t.country || 'DE',
        strikerFitScore: t.strikerFitScore || 50,
        painPoints:      analysisResult?.painPoints || t.signals || [],
        aiReasoning:     analysisResult?.reasoning  || t.aiReasoning || '',
      }

      // Try live SerpAPI reviews first
      const res  = await fetch('/.netlify/functions/serpapi-reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({ ok: false }))
      if (!data.ok) throw new Error('Signal engine error')

      await updateTarget(t.id, {
        heatPressure:               data.heatPressure,
        heatPressureReason:         data.heatPressureReason,
        thermalDependency:          data.thermalDependency,
        thermalDependencyReason:    data.thermalDependencyReason,
        operatingCostPressure:      data.operatingCostPressure,
        operatingCostPressureReason:data.operatingCostPressureReason,
        modernizationNeed:          data.modernizationNeed,
        modernizationNeedReason:    data.modernizationNeedReason,
        boilerDependencyProb:       data.boilerDependencyProb,
        boilerDependencyProbReason: data.boilerDependencyProbReason,
        willingnessToSolve:         data.willingnessToSolve,
        willingnessToSolveReason:   data.willingnessToSolveReason,
        reviewsSource:              data.reviewsSource   || 'simulated',
        reviewsCachedAt:            data.reviewsCachedAt || new Date().toISOString(),
        reviewRating:               data.reviewRating    || null,
        reviewCount:                data.reviewCount     || null,
        reviewSummary:              data.reviewSummary   || null,
        liveSignals:                data.liveSignals     || [],
      })

      const isLive = data.reviewsSource === 'serpapi'
      setSignalMsg(
        isLive
          ? `✅ LIVE · ${data.reviewCount || 0} Google recenzií · ${(data.liveSignals||[]).length} signálov`
          : '✓ AI simulácia (Google recenzie nedostupné)'
      )
      if (data.usedFallback) setSignalTimeoutMsg('Analýza trvala príliš dlho – použil sa záložný odhad.')
    } catch (e) {
      setSignalMsg('⚠ ' + e.message)
    } finally {
      setSignalLoading(false)
    }
  }

  async function handleClientCard() {
    setClientCardLoading(true)
    setClientCardFallback(false)
    try {
      const res = await fetch('/.netlify/functions/client-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:                 t.name,
          segment:              t.segment,
          segmentLabel:         t.segmentLabel,
          city:                 t.city,
          country:              t.country || 'DE',
          fitScore:             t.strikerFitScore || 50,
          painPoints:           analysisResult?.painPoints || t.signals || [],
          aiReasoning:          analysisResult?.reasoning  || t.aiReasoning || '',
          reviewSummary:        t.reviewSummary  || null,
          liveSignals:          t.liveSignals    || [],
          reviewsSource:        t.reviewsSource  || 'simulated',
          heatPressure:         t.heatPressure,
          thermalDependency:    t.thermalDependency,
          operatingCostPressure:t.operatingCostPressure,
          modernizationNeed:    t.modernizationNeed,
          boilerDependencyProb: t.boilerDependencyProb,
          willingnessToSolve:   t.willingnessToSolve,
        }),
      })
      const data = await res.json().catch(() => ({ ok: false }))
      if (!data.ok) throw new Error('Client card error')
      const { ok, usedFallback, ...card } = data
      setClientCardData(card)
      setClientCardFallback(!!usedFallback)
      // Cache to Firebase
      await updateTarget(t.id, { clientCard: card, clientCardAt: new Date().toISOString() })
    } catch (e) {
      console.error('[client-card]', e.message)
    } finally {
      setClientCardLoading(false)
    }
  }

  async function handleSaveDraft(draftLang, subject, body) {
    const updated = { ...emailDraft, [draftLang]: { subject, body } }
    setEmailDraft(updated)
    await updateTarget(t.id, { emailDraft: updated })
  }

  async function handleQueueEmail(draftLang, subject, body) {
    const updated = { ...emailDraft, [draftLang]: { subject, body } }
    setEmailDraft(updated)
    await updateTarget(t.id, {
      emailDraft: updated,
      emailQueueStatus: 'pending_approval',
      emailQueueLang: draftLang,
      emailQueueAt: new Date().toISOString(),
    })
  }

  function handleClose() {
    if (draftDirty) {
      if (!window.confirm('Máte neuložené zmeny v email drafte. Chcete ich zahodiť?')) return
    }
    onClose()
  }

  async function handleGather() {
    setGathering(true)
    setGatherMsg('')
    setAiTimeoutMsg(null)
    setAnalysisResult(null)
    try {
      const res = await fetch('/.netlify/functions/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName:  t.name,
          city:         t.city,
          segment:      t.segment,
          segmentLabel: t.segmentLabel,
          fitScore:     t.strikerFitScore || 50,
          language:     lang,
        }),
      })
      const data = await res.json().catch(() => ({ ok: false, error: 'Invalid JSON' }))
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setAnalysisResult(data)
      setGatherMsg(data.usedFallback ? L.doneFallback : L.done)
      if (data.usedFallback) setAiTimeoutMsg('Analýza trvala príliš dlho – použil sa záložný odhad.')
      if (data.subject || data.draft) {
        setEmailDraft(prev => ({
          ...prev,
          [lang]: { subject: data.subject || '', body: data.draft || '' },
        }))
      }
    } catch (e) {
      setGatherMsg(L.error + ': ' + e.message)
    } finally {
      setGathering(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 200, padding: '1rem', overflowY: 'auto' }}
      onClick={e => e.target === e.currentTarget && handleClose()}>
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
            <button onClick={handleClose} style={{ background: 'transparent', border: 'none', color: '#6b7280', fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1, padding: '0 0.2rem' }}>✕</button>
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
          {activeTab === 'overview' && <TabOverview t={t} analysisResult={analysisResult} clientCard={clientCardData} clientCardLoading={clientCardLoading} onGenerateClientCard={handleClientCard} />}
          {activeTab === 'klient'   && (
            <ClientCard
              target={t}
              onGenerate={handleClientCard}
              loading={clientCardLoading}
              data={clientCardData}
              fallback={clientCardFallback}
            />
          )}
          {activeTab === 'energy'   && <TabEnergy   t={t} onSignal={handleSignalEngine} signalLoading={signalLoading} signalMsg={signalMsg} signalTimeoutMsg={signalTimeoutMsg} />}
          {activeTab === 'ai'       && <TabAI       t={t} onGather={handleGather} gathering={gathering} gatherMsg={gatherMsg} analysisResult={analysisResult} lang={lang} setLang={setLang} L={L} emailDraft={emailDraft} onSaveDraft={handleSaveDraft} onQueueDraft={handleQueueEmail} onDraftDirty={setDraftDirty} defaultDraftLang={defaultDraftLang(t)} aiTimeoutMsg={aiTimeoutMsg} />}
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
