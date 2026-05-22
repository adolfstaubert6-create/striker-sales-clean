import { useState } from 'react'
import ProgressBar from './ProgressBar.jsx'

const mono = "'IBM Plex Mono',monospace"
const sans = "'IBM Plex Sans',sans-serif"

// ── Style helpers ─────────────────────────────────────────────────────────────

const card = (accent = '#1e2530', glow = false) => ({
  background: '#0a0c10',
  border: `1px solid ${accent}`,
  borderRadius: 4,
  padding: '0.85rem 1rem',
  boxShadow: glow ? `0 0 16px ${accent}22` : 'none',
})

const sectionTitle = (color = '#374151') => ({
  fontFamily: mono, fontSize: '0.44rem', letterSpacing: '2.5px',
  textTransform: 'uppercase', color, marginBottom: '0.55rem',
})

const bodyText = {
  fontFamily: sans, fontSize: '0.72rem', color: '#c9d1d9',
  lineHeight: 1.65,
}

const chipStyle = (color = '#4b5563', bg = 'transparent') => ({
  fontFamily: mono, fontSize: '0.5rem', padding: '0.1rem 0.4rem',
  border: `1px solid ${color}55`, borderRadius: 2,
  color, background: bg || `${color}14`,
  display: 'inline-block',
})

// ── Sub-sections ──────────────────────────────────────────────────────────────

function InfoCard({ title, accent, children, glow }) {
  return (
    <div style={{ ...card(accent, glow), marginBottom: '0.65rem' }}>
      <div style={sectionTitle(accent)}>{title}</div>
      {children}
    </div>
  )
}

function BulletList({ items, color = '#9ca3af' }) {
  if (!items?.length) return null
  return (
    <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1rem' }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontFamily: mono, fontSize: '0.6rem', color, marginBottom: '0.18rem', lineHeight: 1.5 }}>
          {item}
        </li>
      ))}
    </ul>
  )
}

function ChipRow({ items, color }) {
  if (!items?.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.4rem' }}>
      {items.map((item, i) => (
        <span key={i} style={chipStyle(color)}>{item}</span>
      ))}
    </div>
  )
}

function FieldRow({ label, value, valueColor }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.28rem', alignItems: 'flex-start' }}>
      <span style={{ fontFamily: mono, fontSize: '0.43rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#374151', flexShrink: 0, width: 110, paddingTop: '0.1rem' }}>
        {label}
      </span>
      <span style={{ fontFamily: mono, fontSize: '0.62rem', color: valueColor || '#9ca3af', lineHeight: 1.5 }}>
        {value}
      </span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ClientCard({ target, onGenerate, loading, data, fallback }) {
  const [expanded, setExpanded] = useState({})

  if (!data && !loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '0.6rem' }}>🕵️</div>
        <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#374151', marginBottom: '1rem', lineHeight: 1.6 }}>
          AI KARTA KLIENTA nie je vygenerovaná.
        </div>
        <button onClick={onGenerate}
          style={{ fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1.5px', textTransform: 'uppercase',
            padding: '0.45rem 1.1rem', border: '1px solid #ff5c0066',
            background: 'rgba(255,92,0,0.1)', color: '#ff5c00',
            borderRadius: 2, cursor: 'pointer', fontWeight: 600 }}>
          🕵️ Vygenerovať AI kartu klienta
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Progress */}
      <ProgressBar running={loading} maxSecs={15} type="ai" />

      {/* Regenerate button when data exists */}
      {data && !loading && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
          {fallback && (
            <span style={{ fontFamily: mono, fontSize: '0.48rem', color: '#6b7280', marginRight: '0.6rem', alignSelf: 'center' }}>
              ⚠ AI záloha (Claude nedostupný)
            </span>
          )}
          <button onClick={onGenerate}
            style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase',
              padding: '0.22rem 0.65rem', border: '1px solid #1e2530',
              background: 'transparent', color: '#6b7280', borderRadius: 2, cursor: 'pointer' }}>
            ↺ Obnoviť
          </button>
        </div>
      )}

      {loading && !data && (
        <div style={{ padding: '1.5rem 0', textAlign: 'center', fontFamily: mono, fontSize: '0.6rem', color: '#374151' }}>
          Generujem inteligentný profil klienta...
        </div>
      )}

      {data && (
        <div>
          {/* ── 1. AI PROFIL KLIENTA ── */}
          <InfoCard title="🧠 AI Profil klienta" accent="#ff5c00" glow>
            <p style={{ ...bodyText, margin: 0 }}>{data.clientProfile}</p>
          </InfoCard>

          {/* ── 2 + 3. BUSINESS TLAK + TECHNICKÝ PROFIL (2-col) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.65rem' }}>

            {/* Business Tlak */}
            <div style={{ ...card('#ffaa0033') }}>
              <div style={sectionTitle('#ffaa00')}>📈 Business tlak</div>
              {data.businessPressure?.main && (
                <p style={{ ...bodyText, fontSize: '0.67rem', marginTop: 0, marginBottom: '0.35rem' }}>
                  {data.businessPressure.main}
                </p>
              )}
              <BulletList items={data.businessPressure?.items} color="#9ca3af" />
            </div>

            {/* Technický Profil */}
            <div style={{ ...card('#1e2530') }}>
              <div style={sectionTitle('#374151')}>⚙ Technický profil</div>
              <FieldRow label="Vek budovy"     value={data.technicalProfile?.buildingAge} />
              <FieldRow label="Typ kúrenia"    value={data.technicalProfile?.heatingType} />
              <FieldRow label="Teplá voda"     value={data.technicalProfile?.hotWaterDemand} valueColor="#ffaa00" />
              <FieldRow label="Modernizácia"   value={
                data.technicalProfile?.modernizationLikelihood
                  ? { 'vysoká': '🔴 Vysoká', 'stredná': '🟡 Stredná', 'nízka': '🟢 Nízka' }[data.technicalProfile.modernizationLikelihood] || data.technicalProfile.modernizationLikelihood
                  : null
              } valueColor={
                data.technicalProfile?.modernizationLikelihood === 'vysoká' ? '#ff5c00'
                : data.technicalProfile?.modernizationLikelihood === 'stredná' ? '#ffaa00'
                : '#00cc88'
              } />
              <BulletList items={data.technicalProfile?.details} color="#6b7280" />
            </div>
          </div>

          {/* ── 4. SIGNÁLY Z INTERNETU ── */}
          <InfoCard title={`🌐 Signály z internetu${data.internetSignals?.sourceNote ? '' : ''}`} accent="#818cf833">
            {data.internetSignals?.summary ? (
              <p style={{ ...bodyText, fontSize: '0.67rem', margin: '0 0 0.35rem' }}>
                {data.internetSignals.summary}
              </p>
            ) : (
              <p style={{ fontFamily: mono, fontSize: '0.6rem', color: '#374151', fontStyle: 'italic', margin: 0 }}>
                Zatiaľ bez live dôkazov – použitý AI odhad.
              </p>
            )}
            <ChipRow items={data.internetSignals?.items} color="#818cf8" />
            {data.internetSignals?.sourceNote && (
              <div style={{ fontFamily: mono, fontSize: '0.47rem', color: '#374151', marginTop: '0.45rem' }}>
                Zdroj: {data.internetSignals.sourceNote}
              </div>
            )}
          </InfoCard>

          {/* ── 5 + 6. ROZHODOVACÍ PROFIL + OBCHODNÁ STRATÉGIA ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.65rem' }}>

            {/* Rozhodovací profil */}
            <div style={{ ...card('#6366f133') }}>
              <div style={sectionTitle('#818cf8')}>👤 Rozhodovací profil</div>
              {data.decisionProfile?.likelyDecisionMaker && (
                <div style={{ marginBottom: '0.4rem' }}>
                  <span style={{ fontFamily: mono, fontSize: '0.44rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '1px' }}>Pravdepodobne rozhoduje</span>
                  <div style={{ fontFamily: sans, fontSize: '0.72rem', color: '#e8eaed', fontWeight: 600, marginTop: '0.1rem' }}>
                    {data.decisionProfile.likelyDecisionMaker}
                  </div>
                </div>
              )}
              <ChipRow items={data.decisionProfile?.roles} color="#6366f1" />
              {data.decisionProfile?.process && (
                <div style={{ fontFamily: mono, fontSize: '0.55rem', color: '#6b7280', marginTop: '0.45rem', lineHeight: 1.5 }}>
                  {data.decisionProfile.process}
                </div>
              )}
            </div>

            {/* Obchodná stratégia */}
            <div style={{ ...card('#00cc8833'), borderLeft: '3px solid #00cc88' }}>
              <div style={sectionTitle('#00cc88')}>🎯 Obchodná stratégia</div>
              {data.salesStrategy?.tone && (
                <div style={{ marginBottom: '0.4rem' }}>
                  <span style={chipStyle('#00cc88')}>Tón: {data.salesStrategy.tone}</span>
                </div>
              )}
              {data.salesStrategy?.startWith && (
                <div style={{ marginBottom: '0.4rem' }}>
                  <span style={chipStyle('#ffaa00')}>
                    Začni: {data.salesStrategy.startWith}
                  </span>
                </div>
              )}
              {data.salesStrategy?.emphasize?.length > 0 && (
                <div style={{ marginBottom: '0.3rem' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.42rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.2rem' }}>Zdôrazniť</div>
                  <BulletList items={data.salesStrategy.emphasize} color="#00cc88" />
                </div>
              )}
              {data.salesStrategy?.avoid?.length > 0 && (
                <div>
                  <div style={{ fontFamily: mono, fontSize: '0.42rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.2rem' }}>Nespomínať hneď</div>
                  <BulletList items={data.salesStrategy.avoid} color="#ff3333" />
                </div>
              )}
              {data.salesStrategy?.nextStep && (
                <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.55rem', background: 'rgba(0,204,136,0.08)', border: '1px solid rgba(0,204,136,0.2)', borderRadius: 2 }}>
                  <span style={{ fontFamily: mono, fontSize: '0.44rem', color: '#00cc88', letterSpacing: '1px', textTransform: 'uppercase' }}>Ďalší krok: </span>
                  <span style={{ fontFamily: mono, fontSize: '0.6rem', color: '#00cc88' }}>{data.salesStrategy.nextStep}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── 7. RIZIKÁ ── */}
          <div style={{ ...card('#ef444433'), marginBottom: 0 }}>
            <div style={sectionTitle('#ef4444')}>⚠ Riziká</div>
            <BulletList items={data.risks} color="#9ca3af" />
          </div>
        </div>
      )}
    </div>
  )
}
