import { useState, useEffect } from 'react'

const mono = "'IBM Plex Mono',monospace"
const sans = "'IBM Plex Sans',sans-serif"

// ── Priority config ───────────────────────────────────────────────────────────

const PRIORITY = {
  LOW:      { color: '#6b7280', bg: 'rgba(107,114,128,0.1)',  border: '#6b728033', glow: 'none', label: 'LOW'      },
  MEDIUM:   { color: '#ffaa00', bg: 'rgba(255,170,0,0.08)',   border: '#ffaa0033', glow: 'none', label: 'MEDIUM'   },
  HIGH:     { color: '#ff5c00', bg: 'rgba(255,92,0,0.1)',     border: '#ff5c0044', glow: '0 0 18px rgba(255,92,0,0.2)', label: 'HIGH' },
  CRITICAL: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    border: '#ef444444', glow: '0 0 22px rgba(239,68,68,0.25)', label: 'CRITICAL' },
}

function getPriority(score) {
  if (score >= 86) return 'CRITICAL'
  if (score >= 66) return 'HIGH'
  if (score >= 41) return 'MEDIUM'
  return 'LOW'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PriorityBadge({ level }) {
  const p = PRIORITY[level] || PRIORITY.MEDIUM
  const isCritical = level === 'CRITICAL'
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    if (!isCritical) return
    const t = setInterval(() => setPulse(v => !v), 900)
    return () => clearInterval(t)
  }, [isCritical])

  return (
    <span style={{
      fontFamily: mono, fontSize: '0.52rem', letterSpacing: '2px', textTransform: 'uppercase',
      fontWeight: 700, padding: '0.18rem 0.6rem', borderRadius: 3,
      border: `1px solid ${p.border}`,
      background: p.bg, color: p.color,
      opacity: isCritical && pulse ? 0.6 : 1,
      transition: 'opacity 0.4s',
    }}>
      {p.label}
    </span>
  )
}

function NBAField({ label, value, accent }) {
  if (!value) return null
  return (
    <div style={{ padding: '0.55rem 0.7rem', background: '#060810', border: '1px solid #1a1f2a', borderRadius: 3 }}>
      <div style={{ fontFamily: mono, fontSize: '0.41rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#374151', marginBottom: '0.22rem' }}>
        {label}
      </div>
      <div style={{ fontFamily: sans, fontSize: '0.72rem', color: accent || '#c9d1d9', lineHeight: 1.45, fontWeight: accent ? 600 : 400 }}>
        {value}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NextBestAction({ nba, score = 0 }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  if (!nba) return null

  const level    = nba.priority || getPriority(score)
  const p        = PRIORITY[level] || PRIORITY.MEDIUM

  return (
    <div style={{
      marginTop: '1.1rem',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(8px)',
      transition: 'opacity 0.35s ease, transform 0.35s ease',
    }}>
      {/* Card */}
      <div style={{
        background: '#0a0c10',
        border: `1px solid ${p.border}`,
        borderTop: `2.5px solid ${p.color}`,
        borderRadius: 4,
        overflow: 'hidden',
        boxShadow: p.glow,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.55rem 0.85rem',
          background: '#070a0e',
          borderBottom: '1px solid #1a1f2a',
          gap: '0.5rem', flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.95rem', lineHeight: 1 }}>🧠</span>
            <span style={{ fontFamily: mono, fontSize: '0.46rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#6b7280' }}>
              ĎALŠÍ NAJLEPŠÍ KROK
            </span>
          </div>
          <PriorityBadge level={level} />
        </div>

        {/* Body */}
        <div style={{ padding: '0.75rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>

          {/* Primary action — full width, highlighted */}
          {nba.nextStep && (
            <div style={{
              padding: '0.65rem 0.8rem',
              background: `${p.bg}`,
              border: `1px solid ${p.border}`,
              borderLeft: `3px solid ${p.color}`,
              borderRadius: 3,
            }}>
              <div style={{ fontFamily: mono, fontSize: '0.41rem', letterSpacing: '2px', textTransform: 'uppercase', color: p.color, opacity: 0.7, marginBottom: '0.22rem' }}>
                ODPORÚČANÝ KROK
              </div>
              <div style={{ fontFamily: sans, fontSize: '0.78rem', color: '#e8eaed', fontWeight: 700, lineHeight: 1.4 }}>
                {nba.nextStep}
              </div>
            </div>
          )}

          {/* 2-col grid: tone + timing */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            <NBAField label="TÓN KOMUNIKÁCIE" value={nba.tone} />
            <NBAField label="TIMING KONTAKTU"  value={nba.timing} accent="#ffaa00" />
          </div>

          {/* 2-col grid: opportunity + risk */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            <NBAField label="PRÍLEŽITOSŤ" value={nba.opportunity} accent="#00cc88" />
            <NBAField label="RIZIKO"      value={nba.risk}        accent="#ff3333" />
          </div>
        </div>
      </div>
    </div>
  )
}
