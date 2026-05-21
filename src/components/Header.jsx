import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { useState, useEffect } from 'react'

const mono = "'IBM Plex Mono', monospace"

export default function Header({ view, setView }) {
  const [userEmail, setUserEmail] = useState(null)

  useEffect(() => {
    try {
      const auth = getAuth()
      return onAuthStateChanged(auth, u => setUserEmail(u ? (u.email || u.uid) : null))
    } catch { setUserEmail(null) }
  }, [])

  return (
    <header style={{ background: '#0a0c0f', borderBottom: '1px solid #1e2530', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 1.25rem' }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.55rem', letterSpacing: '3px', color: '#ff5c00', lineHeight: 1 }}>
            STRIKER <span style={{ color: '#ffaa00' }}>AI</span>
          </div>
          <div style={{ fontFamily: mono, fontSize: '0.52rem', color: '#6b7280', letterSpacing: '2px', marginTop: '0.1rem' }}>
            Sales Intelligence Platform
          </div>
        </div>
        <nav style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            style={{ fontFamily: mono, fontSize: '0.63rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.7rem', border: '1px solid #1e2530', background: 'transparent', borderRadius: '2px', cursor: 'pointer', transition: 'all 0.15s', ...(view === 'dashboard' ? { borderColor: '#ff5c00', color: '#ff5c00' } : { color: '#6b7280' }) }}
            onClick={() => setView('dashboard')}>
            Dashboard
          </button>
          <button
            style={{ fontFamily: mono, fontSize: '0.63rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.7rem', border: '1px solid #1e2530', background: 'transparent', borderRadius: '2px', cursor: 'pointer', transition: 'all 0.15s', ...(view === 'search' ? { borderColor: '#ffaa00', color: '#ffaa00' } : { color: '#6b7280' }) }}
            onClick={() => setView('search')}>
            + Hľadať firmy
          </button>
          {userEmail && (
            <span style={{ fontFamily: mono, fontSize: '0.48rem', color: '#374151', marginLeft: '0.5rem' }}>
              {userEmail}
            </span>
          )}
        </nav>
      </div>
    </header>
  )
}
