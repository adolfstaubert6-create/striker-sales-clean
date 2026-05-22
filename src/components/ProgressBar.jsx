import { useState, useEffect, useRef } from 'react'

const mono = "'IBM Plex Mono',monospace"

// ── Hook ──────────────────────────────────────────────────────────────────────
// running: boolean — true while operation is in progress
// maxSecs: expected max duration in seconds
// Returns: { pct (0-100), timeLeft (seconds), done (bool) }

export function useProgress(running, maxSecs = 15) {
  const [pct,      setPct]      = useState(0)
  const [timeLeft, setTimeLeft] = useState(null)
  const [done,     setDone]     = useState(false)
  const startRef  = useRef(null)
  const timerRef  = useRef(null)

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)

    if (running) {
      startRef.current = Date.now()
      setPct(0)
      setDone(false)
      setTimeLeft(maxSecs)

      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startRef.current) / 1000
        // Exponential curve: fast start, decelerates toward 95%
        const p = Math.min(95, 95 * (1 - Math.exp(-3.2 * elapsed / maxSecs)))
        setPct(p)
        setTimeLeft(Math.max(0, Math.round(maxSecs - elapsed)))
      }, 220)

      return () => clearInterval(timerRef.current)
    } else if (startRef.current !== null) {
      // Operation just finished
      startRef.current = null
      setPct(100)
      setTimeLeft(null)
      setDone(true)
      const t = setTimeout(() => { setPct(0); setDone(false) }, 2200)
      return () => clearTimeout(t)
    }
  }, [running, maxSecs])  // eslint-disable-line react-hooks/exhaustive-deps

  return { pct, timeLeft, done }
}

// ── Status text per operation type ────────────────────────────────────────────

const STATUS = {
  ai: [
    [0,  'Spúšťam AI analýzu...'],
    [15, 'Claude AI analyzuje firmu...'],
    [55, 'Generujem email draft a odporúčania...'],
    [82, 'Dokončujem analýzu...'],
    [96, 'Hotovo ✓'],
  ],
  signal: [
    [0,  'Spúšťam Signal Engine...'],
    [10, 'Hľadám Google recenzie...'],
    [40, 'Analyzujem signály a recenzie...'],
    [70, 'Claude AI vyhodnocuje metriky...'],
    [90, 'Dokončujem...'],
    [96, 'Hotovo ✓'],
  ],
  translate: [
    [0,  'Prekladám email...'],
    [30, 'Claude AI prekladá...'],
    [80, 'Dokončujem preklad...'],
    [96, 'Hotovo ✓'],
  ],
  default: [
    [0,  'Prebieha...'],
    [96, 'Hotovo ✓'],
  ],
}

function getStatusText(pct, type = 'default') {
  const steps = STATUS[type] || STATUS.default
  let text = steps[0][1]
  for (const [threshold, label] of steps) {
    if (pct >= threshold) text = label
  }
  return text
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProgressBar({
  running,
  maxSecs     = 15,
  type        = 'default',   // 'ai' | 'signal' | 'translate' | 'default'
  timeoutMsg  = null,        // shown when usedFallback=true after completion
  visible     = true,
}) {
  const { pct, timeLeft, done } = useProgress(running, maxSecs)

  if (!visible || (pct === 0 && !running && !done)) return null

  const isComplete = pct >= 100 || done
  const barColor   = isComplete ? '#00cc88' : (pct > 70 ? '#ff5c00' : '#ffaa00')
  const statusText = isComplete
    ? (timeoutMsg || 'Hotovo ✓')
    : getStatusText(pct, type)

  return (
    <div style={{
      marginBottom: '0.65rem',
      padding: '0.5rem 0.7rem',
      background: 'rgba(255,92,0,0.03)',
      border: `1px solid ${isComplete ? 'rgba(0,204,136,0.2)' : 'rgba(255,92,0,0.15)'}`,
      borderRadius: 3,
      transition: 'border-color 0.4s',
    }}>
      {/* Bar */}
      <div style={{
        height: 2, background: '#1a1f2a', borderRadius: 1,
        overflow: 'hidden', marginBottom: '0.4rem',
      }}>
        <div style={{
          height: '100%', borderRadius: 1,
          width: `${pct}%`,
          background: barColor,
          transition: 'width 0.22s ease, background 0.4s',
          boxShadow: `0 0 6px ${barColor}88`,
        }} />
      </div>

      {/* Text row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{
          fontFamily: mono, fontSize: '0.52rem', lineHeight: 1.4,
          color: isComplete ? '#00cc88' : '#9ca3af',
          transition: 'color 0.3s',
        }}>
          {statusText}
        </span>
        <span style={{ fontFamily: mono, fontSize: '0.52rem', color: '#4b5563', whiteSpace: 'nowrap' }}>
          {isComplete
            ? ''
            : timeLeft != null && timeLeft > 0
              ? `~${timeLeft}s`
              : `${Math.round(pct)} %`}
        </span>
      </div>
    </div>
  )
}
