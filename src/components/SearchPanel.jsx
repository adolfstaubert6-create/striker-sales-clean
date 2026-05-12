import { useState } from 'react'
import { COMPANY_TYPES, COUNTRIES } from '../constants/companyTypes.js'
import { validateSearchInput } from '../utils/validateSearchInput.js'
import { searchPlaces } from '../services/placesService.js'
import { saveCompany } from '../services/firebaseService.js'

const AI_CRITERIA = [
  { value: 'high_rating',  label: 'Len hodnotenie 4★+' },
  { value: 'large_only',   label: 'Len väčšie prevádzky' },
  { value: 'no_filter',    label: 'Všetky výsledky' },
]

export default function SearchPanel({ searching, setSearching }) {
  const [form, setForm] = useState({
    country: 'DE', city: '', category: 'hotel',
    radius: '15', limit: '10', aiCriteria: 'no_filter',
  })
  const [errors, setErrors]       = useState({})
  const [results, setResults]     = useState([])
  const [saved, setSaved]         = useState({})
  const [globalError, setGlobalError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSearch() {
    const { valid, errors: errs } = validateSearchInput(form)
    setErrors(errs)
    if (!valid) return
    setGlobalError('')
    setSearching(true)
    setResults([])
    setSaved({})
    try {
      const res = await searchPlaces({ ...form })
      setResults(res)
      if (!res.length) setGlobalError('Žiadne výsledky. Skús iné mesto alebo kategóriu.')
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
      const result = await saveCompany(company, form.category, form.city, form.country)
      setSaved(p => ({ ...p, [key]: result.duplicate ? 'dup' : 'saved' }))
    } catch (e) {
      setSaved(p => ({ ...p, [key]: null }))
      setGlobalError('Uloženie zlyhalo: ' + e.message)
    }
  }

  async function handleSaveAll() {
    for (const c of results) {
      if (!saved[c.place_id]) await handleSave(c)
    }
  }

  const saveState = k => saved[k]

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Panel */}
      <div style={css.panel}>
        <div style={css.panelTitle}>🔍 Vyhľadať firmy · Google Places</div>

        <div style={css.grid2}>
          <Field label="Krajina" error={errors.country}>
            <select style={css.select} value={form.country} onChange={e => set('country', e.target.value)}>
              {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Mesto" error={errors.city}>
            <input style={{ ...css.input, ...(errors.city ? css.inputErr : {}) }}
              placeholder="napr. Mannheim" value={form.city}
              onChange={e => set('city', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          </Field>
        </div>

        <div style={css.grid3}>
          <Field label="Kategória">
            <select style={css.select} value={form.category} onChange={e => set('category', e.target.value)}>
              {COMPANY_TYPES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
            </select>
          </Field>
          <Field label="Polomer (km)" error={errors.radius}>
            <input style={{ ...css.input, ...(errors.radius ? css.inputErr : {}) }}
              type="number" min="1" max="50" value={form.radius}
              onChange={e => set('radius', e.target.value)} />
          </Field>
          <Field label="Počet výsledkov" error={errors.limit}>
            <input style={{ ...css.input, ...(errors.limit ? css.inputErr : {}) }}
              type="number" min="1" max="20" value={form.limit}
              onChange={e => set('limit', e.target.value)} />
          </Field>
        </div>

        <Field label="AI kritériá">
          <div style={css.radioRow}>
            {AI_CRITERIA.map(c => (
              <label key={c.value} style={css.radio}>
                <input type="radio" name="aiCriteria" value={c.value}
                  checked={form.aiCriteria === c.value}
                  onChange={() => set('aiCriteria', c.value)}
                  style={{ marginRight: 6 }} />
                {c.label}
              </label>
            ))}
          </div>
        </Field>

        <button style={css.searchBtn} onClick={handleSearch} disabled={searching}>
          {searching ? '⏳ Vyhľadáva...' : '🔍 Spustiť vyhľadávanie'}
        </button>

        {globalError && <div style={css.errBox}>⚠ {globalError}</div>}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          <div style={css.resHeader}>
            <span style={css.resTitle}>{results.length} firiem nájdených</span>
            <button style={css.saveAllBtn} onClick={handleSaveAll}>
              + Uložiť všetky
            </button>
          </div>

          {results.map(c => {
            const st = saveState(c.place_id)
            return (
              <div key={c.place_id} style={css.resRow}>
                <div style={{ flex: 1 }}>
                  <div style={css.resName}>{c.name}</div>
                  <div style={css.resMeta}>
                    {c.address || '–'}
                    {c.rating  ? <span style={css.rating}> ⭐ {c.rating}</span> : null}
                    {c.phone   ? <span> · {c.phone}</span> : null}
                  </div>
                </div>
                <button
                  style={st === 'saved' ? css.btnSaved : st === 'dup' ? css.btnDup : css.btnSave}
                  onClick={() => handleSave(c)}
                  disabled={!!st}
                >
                  {st === 'saving' ? '...' : st === 'saved' ? '✓ Uložené' : st === 'dup' ? '⚠ Duplikát' : '+ Uložiť'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Field({ label, error, children }) {
  return (
    <div style={{ marginBottom: '0.65rem' }}>
      <label style={css.label}>{label}</label>
      {children}
      {error && <div style={css.fieldErr}>{error}</div>}
    </div>
  )
}

const css = {
  panel: { background: '#111418', border: '1px solid #1e2530', borderRadius: 4, padding: '1.4rem' },
  panelTitle: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.62rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '1.25rem' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' },
  label: { display: 'block', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.28rem' },
  input: { width: '100%', background: '#0a0c0f', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.8rem', padding: '0.48rem 0.65rem', borderRadius: 2, outline: 'none' },
  inputErr: { borderColor: '#ff3333' },
  select: { width: '100%', background: '#0a0c0f', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.8rem', padding: '0.48rem 0.65rem', borderRadius: 2, outline: 'none' },
  radioRow: { display: 'flex', gap: '1.25rem', flexWrap: 'wrap' },
  radio: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.7rem', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  searchBtn: { marginTop: '0.5rem', width: '100%', background: '#ffaa00', border: 'none', color: '#0a0c0f', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.72rem', letterSpacing: '2px', textTransform: 'uppercase', padding: '0.68rem', borderRadius: 2, fontWeight: 700 },
  errBox: { marginTop: '0.65rem', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.62rem', color: '#ff3333', background: 'rgba(255,51,51,0.08)', padding: '0.4rem 0.6rem', borderRadius: 2 },
  fieldErr: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.58rem', color: '#ff3333', marginTop: '0.2rem' },
  resHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', borderBottom: '1px solid #1e2530', paddingBottom: '0.5rem' },
  resTitle: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.6rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#6b7280' },
  saveAllBtn: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.25rem 0.6rem', border: '1px solid #ffaa00', background: 'transparent', color: '#ffaa00', borderRadius: 2 },
  resRow: { background: '#111418', border: '1px solid #1e2530', borderRadius: 2, padding: '0.65rem 0.9rem', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '1rem' },
  resName: { fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.1rem' },
  resMeta: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.6rem', color: '#6b7280' },
  rating: { color: '#ffaa00' },
  btnSave: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.65rem', border: '1px solid #00cc88', background: 'transparent', color: '#00cc88', borderRadius: 2, whiteSpace: 'nowrap' },
  btnSaved: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.65rem', border: '1px solid #1e2530', background: 'transparent', color: '#6b7280', borderRadius: 2, whiteSpace: 'nowrap', cursor: 'default' },
  btnDup: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.65rem', border: '1px solid #ffaa00', background: 'transparent', color: '#ffaa00', borderRadius: 2, whiteSpace: 'nowrap', cursor: 'default' },
}
