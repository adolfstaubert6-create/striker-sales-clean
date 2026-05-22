import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase.js'

export default function LoginScreen() {
  const [email,   setEmail]   = useState('')
  const [password,setPassword]= useState('')
  const [error,   setError]   = useState(false)
  const [loading, setLoading] = useState(false)

  async function doLogin() {
    if (!email.trim() || !password) { setError(true); return }
    setLoading(true)
    setError(false)
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
      // onAuthStateChanged v App.jsx automaticky detekuje prihlásenie
    } catch {
      setError(true)
      setPassword('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '2rem'
    }}>
      <div style={{ fontFamily: "'Bebas Neue', 'IBM Plex Mono', monospace", fontSize: '2.2rem', letterSpacing: '4px', color: 'var(--accent)', marginBottom: '0.25rem' }}>
        STRIKER <span style={{ color: 'var(--accent2)' }}>SALES</span>
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '2px', marginBottom: '2rem' }}>
        AI SALES 2026
      </div>

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '4px', padding: '1.5rem', width: '100%', maxWidth: '320px'
      }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.68rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '1rem' }}>
          Prihlásenie
        </div>

        <input
          style={inputStyle}
          type="email"
          placeholder="Email..."
          autoComplete="email"
          value={email}
          onChange={e => { setEmail(e.target.value); setError(false) }}
          onKeyDown={e => e.key === 'Enter' && document.getElementById('pwd-input').focus()}
          disabled={loading}
        />
        <input
          id="pwd-input"
          style={inputStyle}
          type="password"
          placeholder="Heslo..."
          autoComplete="current-password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError(false) }}
          onKeyDown={e => e.key === 'Enter' && doLogin()}
          disabled={loading}
        />

        {error && (
          <div style={{ color: 'var(--err)', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.68rem', marginBottom: '0.75rem' }}>
            Nesprávny email alebo heslo
          </div>
        )}

        <button onClick={doLogin} style={{ ...btnStyle, opacity: loading ? 0.7 : 1 }} disabled={loading}>
          {loading ? 'Prihlasovanie...' : 'Prihlásiť sa →'}
        </button>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
  color: 'var(--text)', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem',
  padding: '0.6rem 0.8rem', borderRadius: '2px', outline: 'none',
  marginBottom: '0.75rem', display: 'block',
}

const btnStyle = {
  width: '100%', background: 'var(--accent)', border: 'none', color: 'white',
  fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.8rem', letterSpacing: '2px',
  textTransform: 'uppercase', padding: '0.7rem', borderRadius: '2px', cursor: 'pointer',
}
