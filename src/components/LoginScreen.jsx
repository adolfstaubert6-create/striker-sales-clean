import { useState } from 'react'

const USERS = { Staubert: 'Staubert2026', Szabo: 'Szabo2026' }

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(false)

  function doLogin() {
    if (USERS[username] && USERS[username] === password) {
      onLogin(username)
    } else {
      setError(true)
      setPassword('')
    }
  }

  function onKey(e) {
    if (e.key === 'Enter') doLogin()
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
          placeholder="Meno..."
          autoComplete="username"
          value={username}
          onChange={e => { setUsername(e.target.value); setError(false) }}
          onKeyDown={e => e.key === 'Enter' && document.getElementById('pwd-input').focus()}
        />
        <input
          id="pwd-input"
          style={inputStyle}
          type="password"
          placeholder="Heslo..."
          autoComplete="current-password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError(false) }}
          onKeyDown={onKey}
        />

        {error && (
          <div style={{ color: 'var(--err)', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.68rem', marginBottom: '0.75rem' }}>
            Nesprávne meno alebo heslo
          </div>
        )}

        <button onClick={doLogin} style={btnStyle}>
          Prihlásiť sa →
        </button>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
  color: 'var(--text)', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem',
  padding: '0.6rem 0.8rem', borderRadius: '2px', outline: 'none',
  marginBottom: '0.75rem', display: 'block'
}

const btnStyle = {
  width: '100%', background: 'var(--accent)', border: 'none', color: 'white',
  fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.8rem', letterSpacing: '2px',
  textTransform: 'uppercase', padding: '0.7rem', borderRadius: '2px', cursor: 'pointer'
}
