import { useState } from 'react'
import { db } from '../firebase.js'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

const CATEGORIES = [
  { value: 'hotel', label: 'Hotely' },
  { value: 'laundry', label: 'Práčovne' },
  { value: 'restaurant', label: 'Reštaurácie' },
  { value: 'hospital', label: 'Nemocnice' },
  { value: 'spa', label: 'Wellness / Spa' },
]

const s = {
  panel: {
    background: '#111418',
    border: '1px solid #1e2530',
    borderRadius: '4px',
    padding: '1.5rem',
    maxWidth: 620,
  },
  title: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.65rem',
    letterSpacing: '3px',
    textTransform: 'uppercase',
    color: '#6b7280',
    marginBottom: '1.25rem',
  },
  row: { display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' },
  label: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.58rem',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: '#6b7280',
    marginBottom: '0.3rem',
    display: 'block',
  },
  field: { flex: 1, minWidth: 160 },
  input: {
    width: '100%',
    background: '#0a0c0f',
    border: '1px solid #1e2530',
    color: '#e8eaed',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.8rem',
    padding: '0.5rem 0.7rem',
    borderRadius: '2px',
    outline: 'none',
  },
  select: {
    width: '100%',
    background: '#0a0c0f',
    border: '1px solid #1e2530',
    color: '#e8eaed',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.8rem',
    padding: '0.5rem 0.7rem',
    borderRadius: '2px',
    outline: 'none',
  },
  btn: {
    marginTop: '0.5rem',
    width: '100%',
    background: '#ffaa00',
    border: 'none',
    color: '#0a0c0f',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.72rem',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    padding: '0.65rem',
    borderRadius: '2px',
    fontWeight: 600,
    transition: 'background 0.15s',
  },
  info: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.62rem',
    color: '#6b7280',
    marginTop: '1rem',
    lineHeight: 1.6,
  },
  err: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.65rem',
    color: '#ff3333',
    marginTop: '0.75rem',
    padding: '0.4rem 0.6rem',
    background: 'rgba(255,51,51,0.08)',
    borderRadius: '2px',
  },
  results: { marginTop: '1.5rem' },
  resTitle: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.58rem',
    letterSpacing: '3px',
    textTransform: 'uppercase',
    color: '#6b7280',
    marginBottom: '0.75rem',
    borderBottom: '1px solid #1e2530',
    paddingBottom: '0.3rem',
  },
  resItem: {
    background: '#161b22',
    border: '1px solid #1e2530',
    borderRadius: '2px',
    padding: '0.75rem 0.9rem',
    marginBottom: '0.4rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
  },
  resName: { fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.1rem' },
  resMeta: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#6b7280' },
  savebtn: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.6rem',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    padding: '0.28rem 0.65rem',
    border: '1px solid #00cc88',
    background: 'transparent',
    color: '#00cc88',
    borderRadius: '2px',
    whiteSpace: 'nowrap',
  },
  savedbtn: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.6rem',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    padding: '0.28rem 0.65rem',
    border: '1px solid #1e2530',
    background: 'transparent',
    color: '#6b7280',
    borderRadius: '2px',
    whiteSpace: 'nowrap',
    cursor: 'default',
  },
}

export default function SearchPanel({ onResults, searching, setSearching }) {
  const [city, setCity] = useState('')
  const [category, setCategory] = useState('hotel')
  const [radius, setRadius] = useState('10')
  const [results, setResults] = useState([])
  const [saved, setSaved] = useState({})
  const [error, setError] = useState('')

  async function handleSearch() {
    if (!city.trim()) { setError('Zadaj mesto.'); return }
    setError('')
    setSearching(true)
    setResults([])

    try {
      const res = await fetch('/.netlify/functions/search-places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: city.trim(), category, radius: parseInt(radius) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chyba pri vyhľadávaní')
      setResults(data.results || [])
      onResults(data.results || [])
      if ((data.results || []).length === 0) setError('Žiadne výsledky. Skús iné mesto alebo kategóriu.')
    } catch (e) {
      setError(e.message)
    } finally {
      setSearching(false)
    }
  }

  async function handleSave(company) {
    if (saved[company.place_id]) return
    setSaved(prev => ({ ...prev, [company.place_id]: 'saving' }))
    try {
      await addDoc(collection(db, 'companies'), {
        name: company.name,
        category,
        country: 'DE',
        city: company.city || city,
        address: company.address || '',
        website: company.website || '',
        email: '',
        phone: company.phone || '',
        googlePlaceId: company.place_id,
        rating: company.rating || null,
        aiScore: null,
        aiReason: '',
        status: 'new',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setSaved(prev => ({ ...prev, [company.place_id]: 'saved' }))
    } catch (e) {
      setSaved(prev => ({ ...prev, [company.place_id]: null }))
      setError('Uloženie zlyhalo: ' + e.message)
    }
  }

  return (
    <div>
      <div style={s.panel}>
        <div style={s.title}>Vyhľadať firmy</div>
        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Mesto</label>
            <input
              style={s.input}
              placeholder="napr. Mannheim"
              value={city}
              onChange={e => setCity(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Kategória</label>
            <select style={s.select} value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div style={{ flex: '0 0 100px' }}>
            <label style={s.label}>Polomer (km)</label>
            <input
              style={s.input}
              type="number"
              min="1"
              max="50"
              value={radius}
              onChange={e => setRadius(e.target.value)}
            />
          </div>
        </div>
        <button style={s.btn} onClick={handleSearch} disabled={searching}>
          {searching ? '⏳ Vyhľadáva...' : '🔍 Spustiť vyhľadávanie'}
        </button>
        {error && <div style={s.err}>⚠ {error}</div>}
        <div style={s.info}>
          Vyhľadávanie prebieha cez Google Places API.<br />
          Výsledky môžeš uložiť do databázy a nechať AI ohodnotiť.
        </div>
      </div>

      {results.length > 0 && (
        <div style={s.results}>
          <div style={s.resTitle}>Výsledky — {results.length} firiem</div>
          {results.map(c => (
            <div key={c.place_id} style={s.resItem}>
              <div>
                <div style={s.resName}>{c.name}</div>
                <div style={s.resMeta}>
                  {c.address || '–'}
                  {c.rating ? ` · ⭐ ${c.rating}` : ''}
                  {c.phone ? ` · ${c.phone}` : ''}
                </div>
              </div>
              <button
                style={saved[c.place_id] === 'saved' ? s.savedbtn : s.savebtn}
                onClick={() => handleSave(c)}
                disabled={!!saved[c.place_id]}
              >
                {saved[c.place_id] === 'saving' ? '...' : saved[c.place_id] === 'saved' ? '✓ Uložené' : '+ Uložiť'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
