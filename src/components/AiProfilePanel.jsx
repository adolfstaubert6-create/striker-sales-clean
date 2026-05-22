import ProgressBar        from './ProgressBar.jsx'
import IntelligenceEngine from './IntelligenceEngine.jsx'

const mono = "'IBM Plex Mono',monospace"
const sans = "'IBM Plex Sans',sans-serif"

// ── Local intelligence fallback — built from available metrics ────────────────

const MOD_KW = ['renovierung','modernisierung','renovation','umbau','modernizácia','rekonštrukcia','veraltet','alt','outdated','rebuilt']

function buildLocalIntelligence(t) {
  const seg     = (t.segment || '').toLowerCase()
  const isL     = seg.includes('waesch') || seg.includes('laund') || seg.includes('textil')
  const isH     = seg.includes('hotel') || seg.includes('gastro') || seg.includes('resort')
  const hasMet  = t.heatPressure != null
  const modSig  = (t.liveSignals || []).filter(s => MOD_KW.some(k => s.toLowerCase().includes(k)))
  const wScore  = t.willingnessToSolve || 50
  const modNeed = t.modernizationNeed  || 50

  return {
    buildingAge: {
      estimate:       isL ? 'stredná až staršia budova' : isH ? 'stredná budova' : 'stredný vek',
      approximateAge: '10–30 rokov (AI odhad)',
      confidence:     'LOW',
      reasoning:      'Pravdepodobný vek na základe segmentu — bez overených dát.',
    },
    technologyState: {
      heatingType:   isL ? 'pravdepodobne plynový kotol' : isH ? 'pravdepodobne plynový kotol alebo CZT' : 'typ neznámy (AI odhad)',
      estimatedAge:  hasMet && modNeed >= 65 ? '15–25 rokov (AI odhad)' : '5–20 rokov (AI odhad)',
      status:        modNeed >= 70 ? 'pravdepodobne zastarané' : modNeed >= 50 ? 'stredný vek' : 'stav neznámy',
      hotWater:      isL ? 'veľmi vysoká závislosť' : isH ? 'vysoká závislosť' : 'stredná závislosť',
      wellness:      isH ? 'možné (závisí od prevádzky)' : 'pravdepodobne nie',
      confidence:    hasMet ? 'MEDIUM' : 'LOW',
      reasoning:     'Podľa signálnych metrík a segmentu — technická dokumentácia neoverená.',
    },
    modernizationSignals: {
      detected:       modSig.slice(0, 5),
      interpretation: modSig.length > 2
        ? 'Detekované signály naznačujú záujem o modernizáciu alebo technické problémy.'
        : modNeed >= 65
        ? 'AI metriky môžu naznačovať potrebu modernizácie vykurovacieho systému.'
        : 'Slabé signály — situácia sa overí počas obchodného kontaktu.',
      confidence: modSig.length > 2 ? 'HIGH' : hasMet ? 'MEDIUM' : 'LOW',
    },
    investmentProfile: {
      type:           wScore >= 70 ? 'aktívne hľadá riešenie' : wScore >= 50 ? 'cost-saving mode' : 'konzervatívny prístup',
      label:          wScore >= 70 ? 'Hľadá riešenie' : wScore >= 50 ? 'Šetrí náklady' : 'Konzervatívny',
      interpretation: wScore >= 70
        ? 'Podľa signálov firma môže aktívne hľadať spôsoby optimalizácie prevádzkových nákladov.'
        : 'Firma môže byť otvorená riešeniu, ak sa preukáže jasný a rýchly ROI.',
      confidence:     hasMet ? 'MEDIUM' : 'LOW',
    },
  }
}

// ── Local profile builder — no API, from available data ───────────────────────

function buildLocalProfile(t, analysisResult) {
  const seg      = t.segmentLabel || t.segment || 'firma'
  const city     = t.city || ''
  const fit      = t.strikerFitScore || 50
  const hasMet   = t.heatPressure != null
  const pains    = (analysisResult?.painPoints || t.signals || []).slice(0, 3)
  const aiCtx    = analysisResult?.reasoning || t.aiReasoning || ''

  // If quality AI reasoning exists, use it directly
  if (aiCtx && aiCtx.length > 60) {
    return aiCtx
  }

  const heatWord = hasMet
    ? (t.heatPressure >= 80 ? 'veľmi vysokou' : t.heatPressure >= 60 ? 'zvýšenou' : 'strednou')
    : 'predpokladanou'

  const p1 = `Podľa dostupných signálov ide o ${seg.toLowerCase()}${city ? ` v lokalite ${city}` : ''} s ${heatWord} závislosťou od tepelnej energie.${pains.length ? ` Identifikované signály naznačujú: ${pains.join(', ').toLowerCase()}.` : ''}`

  const p2 = hasMet && t.modernizationNeed >= 65
    ? `Technický profil naznačuje pravdepodobnú potrebu modernizácie vykurovacieho systému — čo môže byť priamou príležitosťou pre STRIKER technológiu.`
    : `Na základe segmentu možno predpokladať závislosť od konvenčného kúrenia — podrobnosti sa potvrdia pri prvom kontakte.`

  const p3 = fit >= 70
    ? `Ak sa potvrdí záujem, klient môže byť motivovaný rýchlou návratnosťou investície a stabilitou prevádzkových nákladov.`
    : `Klient pravdepodobne ocení orientačnú kalkuláciu úspory a referencie z podobných prevádzok skôr ako technické detaily.`

  const approach = fit >= 70
    ? `Odporúčaný prístup: vecný technický tón, zdôrazniť konkrétnu úsporu v EUR/rok, nezačínať agresívnym predajom.`
    : `Odporúčaný prístup: začať emailom s orientačnou kalkuláciou, budovať dôveru postupne.`

  return [p1, p2, p3, approach].join('\n\n')
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AiProfilePanel({ target: t, analysisResult, clientCard, onGenerate, loading }) {
  const isLive           = t.reviewsSource === 'serpapi'
  const hasClaudeProfile = !!(clientCard?.clientProfile)
  // Intelligence: use Claude output if available, else build locally
  const intelligence     = clientCard?.intelligence || buildLocalIntelligence(t)

  // Text to display — priority: Claude profile > local build
  const profileText = hasClaudeProfile
    ? clientCard.clientProfile
    : buildLocalProfile(t, analysisResult)

  const hasContent  = profileText && profileText.length > 30

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(255,92,0,0.05) 0%, rgba(10,12,16,0) 100%)',
      border: '1px solid rgba(255,92,0,0.18)',
      borderLeft: '3px solid #ff5c00',
      borderRadius: 4,
      padding: '0.9rem 1.05rem',
      marginBottom: '1.25rem',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.55rem', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: mono, fontSize: '0.44rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#ff5c00' }}>
          🧠 AI Profil klienta
        </span>

        {/* Source badge */}
        {isLive ? (
          <span style={{ fontFamily: mono, fontSize: '0.42rem', letterSpacing: '1.5px', textTransform: 'uppercase',
            color: '#00cc88', padding: '0.04rem 0.32rem', border: '1px solid #00cc8844',
            borderRadius: 2, background: 'rgba(0,204,136,0.08)' }}>
            🔴 LIVE DATA
          </span>
        ) : (
          <span style={{ fontFamily: mono, fontSize: '0.42rem', letterSpacing: '1.5px', textTransform: 'uppercase',
            color: '#6b7280', padding: '0.04rem 0.32rem', border: '1px solid #37415133',
            borderRadius: 2 }}>
            AI ODHAD
          </span>
        )}

        {hasClaudeProfile && (
          <span style={{ fontFamily: mono, fontSize: '0.42rem', color: '#374151' }}>· Claude AI</span>
        )}

        <div style={{ flex: 1 }} />

        {/* Generate / Upgrade button */}
        {!loading && (
          <button onClick={onGenerate}
            style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '1px', textTransform: 'uppercase',
              padding: '0.18rem 0.55rem', border: '1px solid #1e2530',
              background: 'transparent', color: '#4b5563',
              borderRadius: 2, cursor: 'pointer', transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}>
            {hasClaudeProfile ? '↺ Obnoviť' : '🧠 Zlepšiť s Claude AI'}
          </button>
        )}
      </div>

      {/* Progress bar */}
      <ProgressBar running={loading} maxSecs={15} type="ai" />

      {/* Profile text */}
      {!loading && hasContent && (
        <div>
          {profileText.split('\n\n').filter(Boolean).map((para, i) => (
            <p key={i} style={{
              fontFamily: sans, fontSize: '0.72rem', color: i === 0 ? '#c9d1d9' : '#9ca3af',
              lineHeight: 1.7, margin: 0, marginBottom: i < profileText.split('\n\n').length - 1 ? '0.55rem' : 0,
            }}>
              {para}
            </p>
          ))}
        </div>
      )}

      {!loading && !hasContent && (
        <p style={{ fontFamily: mono, fontSize: '0.6rem', color: '#374151', fontStyle: 'italic', margin: 0 }}>
          Klikni „🧠 Zlepšiť s Claude AI" pre vygenerovanie obchodného profilu klienta.
        </p>
      )}

      {/* Intelligence Engine — always shown (local fallback or Claude) */}
      {!loading && <IntelligenceEngine intelligence={intelligence} />}
    </div>
  )
}
