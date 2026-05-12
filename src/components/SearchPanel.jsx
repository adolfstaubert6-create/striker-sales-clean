import { useState } from 'react'
import { COMPANY_TYPES } from '../constants/companyTypes.js'
import { validateSearchInput } from '../utils/validateSearchInput.js'
import { searchPlaces } from '../services/placesService.js'
import { saveCompany } from '../services/firebaseService.js'

const s = {
  panel: { background: '#111418', border: '1px solid #1e2530', borderRadius: '4px', padding: '1.5rem', maxWidth: 640 },
  title: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.62rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '1.25rem' },
  row: { display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' },
  field: { flex: 1, minWidth: 140 },
  label: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.28rem', display: 'block' },
  input: { width: '100%', background: '#0a0c0f', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.8rem', padding: '0.5rem 0.7rem', borderRadius: '2px', outline: 'none' },
  inputErr: { borderColor: '#ff3333' },
  select: { width: '100%', background: '#0a0c0f', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.8rem', padding: '0.5rem 0.7rem', borderRadius: '2px', outline: 'none' },
  btn: { marginTop: '0.5rem', width: '100%', background: '#ffaa00', border: 'none', color: '#0a0c0f', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.72rem', letterSpacing: '2px', textTransform: 'uppercase', padding: '0.65rem', borderRadius: '2px', fontWeight: 600 },
  errBox: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.62rem', color: '#ff3333', marginTop: '0.6rem', background: 'rgba(255,51,51,0.08)', padding: '0.4rem 0.6rem', borderRadius: '2px' },
  fieldErr: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.58rem', color: '#ff3333', marginTop: '0.2rem' },
  resSection: { marginTop: '1.5rem' },
  resTitle: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.58rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.7rem', borderBottom: '1px solid #1e2530', paddingBottom: '0.3rem' },
  resItem: { background: '#161b22', border: '1px solid #1e2530', borderRadius: '2px', padding: '0.7rem 0.9rem', marginBottom: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' },
  resName: { fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.1rem' },
  resMeta: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.6rem', color: '#6b7280' },
  savebtn: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.65rem', border: '1px solid #00cc88', background: 'transparent', color: '#00cc88', borderRadius: '2px', whiteSpace: 'nowrap' },
  savedbtn: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.65rem', border: '1px solid #1e2530', background: 'transparent', color: '#6b7280', borderRadius: '2px', whiteSpace: 'nowrap', cursor: 'default' },
  dupbtn: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.65rem', border: '1px solid #ffaa00', background: 'transparent', color: '#ffaa00', borderRadius: '2px', whiteSpace: 'nowrap', cursor: 'default' },
}

export default function SearchPanel({ searching, setSearching }) {
  const [form, setForm] = useState({ city: '', category: 'hotel', radius: '10', limit: '10' })
  const [errors, setErrors] = useState({})
  const [results, setResults] = useState([])
  const [saved, setSaved] = useState({})
  const [globalError, setGlobalError] = useState('')

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSearch() {
    const { valid, errors: errs } = validateSearchInput(form)
    setErrors(errs)
    if (!valid) return
    setGlobalError('')
    setSearching(true)
    setResults([])
    setSaved({})
    try {
      const res = await searchPlaces(form)
      setResults(res)
      if (res.length === 0) setGlobalError('Žiadne výsledky. Skús iné mesto alebo kategóriu.')
    } catch (e) {
      setGlobalError(e.message)
    } finally {
      setSearching(false)
    }
  }

  async function handleSave(company) {
    const key = company.place_id
    if (saved[key]) return
    setSaved(p => ({ ...p, [key]: 'saving' }))
    try {
      const result = await saveCompany(company, form.category, form.city)
      setSaved(p => ({ ...p, [key]: result.duplicate ? 'dup' : 'saved' }))
    } catch (e) {
      setSaved(p => ({ ...p, [key]: null }))
      setGlobalError('Uloženie zlyhalo: ' + e.message)
    }
  }

  function saveLabel(key) {
    const s = saved[key]
    if (s === 'saving') return '...'
    if (s === 'saved')  return '✓ Uložené'
    if (s === 'dup')    return '⚠ Duplikát'
    return '+ Uložiť'
  }
  function saveBtnStyle(key) {
    const st = saved[key]
    if (st === 'saved') return s.savedbtn
    if (st === 'dup')   return s.dupbtn
    return s.savebtn
  }

  return (
    <div>
      <div style={s.panel}>
        <div style={s.title}>Vyhľadať firmy · Google Places</div>
        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Mesto</label>
            <input style={{ ...s.input, ...(errors.city ? s.inputErr : {}) }} placeholder="napr. Mannheim" value={form.city} onChange={e => set('city', e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            {errors.city && <div style={s.fieldErr}>{errors.city}</div>}
          </div>
          <div style={s.field}>
            <label style={s.label}>Typ firmy</label>
            <select style={s.select} value={form.category} onChange={e => set('category', e.target.value)}>
              {COMPANY_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div style={s.row}>
          <div style={{ flex: '0 0 120px' }}>
            <label style={s.label}>Polomer (km)</label>
            <input style={{ ...s.input, ...(errors.radius ? s.inputErr : {}) }} type="number" min="1" max="50" value={form.radius} onChange={e => set('radius', e.target.value)} />
            {errors.radius && <div style={s.fieldErr}>{errors.radius}</div>}
          </div>
          <div style={{ flex: '0 0 120px' }}>
            <label style={s.label}>Limit výsledkov</label>
            <input style={{ ...s.input, ...(errors.limit ? s.inputErr : {}) }} type="number" min="1" max="20" value={form.limit} onChange={e => set('limit', e.target.value)} />
            {errors.limit && <div style={s.fieldErr}>{errors.limit}</div>}
          </div>
        </div>
        <button style={s.btn} onClick={handleSearch} disabled={searching}>
          {searching ? '⏳ Vyhľadáva...' : '🔍 Spustiť vyhľadávanie'}
        </button>
        {globalError && <div style={s.errBox}>⚠ {globalError}</div>}
      </div>

      {results.length > 0 && (
        <div style={s.resSection}>
          <div style={s.resTitle}>{results.length} firiem · klikni + Uložiť pre pridanie do dashboardu</div>
          {results.map(c => (
            <div key={c.place_id} style={s.resItem}>
              <div>
                <div style={s.resName}>{c.name}</div>
                <div style={s.resMeta}>{c.address || '–'}{c.rating ? ` · ⭐ ${c.rating}` : ''}{c.phone ? ` · ${c.phone}` : ''}</div>
              </div>
              <button style={saveBtnStyle(c.place_id)} onClick={() => handleSave(c)} disabled={!!saved[c.place_id]}>
                {saveLabel(c.place_id)}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
