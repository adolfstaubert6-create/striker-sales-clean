import { useState } from 'react'
import { COMPANY_TYPES, COUNTRIES } from '../constants/companyTypes.js'
import { validateSearchInput } from '../utils/validateSearchInput.js'
import { searchPlaces } from '../services/placesService.js'
import { scoreAll } from '../services/aiScoringService.js'
import { saveCompany, saveCompanies } from '../services/firebaseService.js'

const AI_CRITERIA = [
  { value: 'no_filter',   label: 'Všetky výsledky' },
  { value: 'high_rating', label: 'Len hodnotenie 4★+' },
]

const CATEGORY_PLURAL = {
  hotel: 'hotelov', laundry: 'práčovní', spa: 'wellness centier',
  hospital: 'nemocníc', restaurant: 'reštaurácií',
}

function scoreColor(s) {
  if (s === null || s === undefined) return '#6b7280'
  if (s >= 80) return '#00cc88'
  if (s >= 50) return '#ffaa00'
  return '#ff3333'
}
function scoreLabel(s) {
  if (s === null || s === undefined) return null
  if (s >= 80) return 'Vysoký'
  if (s >= 50) return 'Stredný'
  return 'Nízky'
}

export default function SearchPanel({ searching, setSearching }) {
  const [form, setForm] = useState({
    country: 'DE', city: '', category: 'hotel',
    radius: '15', limit: '10', aiCriteria: 'no_filter',
  })
  const [errors, setErrors]           = useState({})
  const [results, setResults]         = useState([])
  const [saved, setSaved]             = useState({})
  const [globalError, setGlobalError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSearch() {
    const { valid, errors: errs } = validateSearchInput(form)
    setErrors(errs)
    if (!valid) return

    setGlobalError('')
    setResults([])
    setSaved({})
    setSearching(true)

    try {
      const places = await searchPlaces(form)

      if (!places.length) {
        setGlobalError('Žiadne výsledky. Skús iné mesto alebo kategóriu.')
        return
      }

      const withCategory = places.map(p => ({ ...p, category: form.category, city: form.city }))
      setResults(scoreAll(withCategory))
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
    const unsaved = results.filter(c => !saved[c.place_id])
    console.log('[handleSaveAll] unsaved count:', unsaved.length)
    if (!unsaved.length) return

    setSaved(p => {
      const next = { ...p }
      unsaved.forEach(c => { next[c.place_id] = 'saving' })
      return next
    })

    try {
      const batchResults = await saveCompanies(unsaved, form.category, form.city, form.country)
      console.log('[handleSaveAll] batchResults:', batchResults)
      setSaved(p => {
        const next = { ...p }
        unsaved.forEach(c => {
          next[c.place_id] = batchResults[c.place_id] || 'saved'
        })
        return next
      })
    } catch (e) {
      console.error('[handleSaveAll] ERROR:', e)
      setSaved(p => {
        const next = { ...p }
        unsaved.forEach(c => { next[c.place_id] = null })
        return next
      })
      setGlobalError('Uloženie zlyhalo: ' + e.message)
    }
  }

  return (
    <div style={{ maxWidth: 700 }}>

      {/* Search form */}
      <div style={css.panel}>
        <div style={css.panelTitle}>🔍 Vyhľadať firmy · Google Places + AI</div>

        <div style={css.grid2}>
          <Field label="Krajina">
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
                  style={{ marginRight: 6, accentColor: '#ffaa00' }} />
                {c.label}
              </label>
            ))}
          </div>
        </Field>

        <button style={{ ...css.searchBtn, opacity: searching ? 0.7 : 1 }}
          onClick={handleSearch} disabled={searching}>
          {searching ? `🔍 Vyhľadáva ${CATEGORY_PLURAL[form.category] || 'firiem'} v ${form.city}...` : '🔍 Spustiť vyhľadávanie'}
        </button>

        {globalError && <div style={css.errBox}>⚠ {globalError}</div>}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          <div style={css.resHeader}>
            <span style={css.resTitle}>
              {results.length} výsledkov · zoradené podľa Business Potential Score
            </span>
            <button style={css.saveAllBtn} onClick={handleSaveAll}>
              + Uložiť všetky do dashboardu
            </button>
          </div>

          {results.map(c => (
            <ResultCard key={c.place_id} company={c}
              saveState={saved[c.place_id]}
              onSave={() => handleSave(c)} />
          ))}
        </div>
      )}
    </div>
  )
}

function ResultCard({ company: c, saveState, onSave }) {
  const sc   = c.score
  const col  = scoreColor(sc)
  const lbl  = scoreLabel(sc)

  const statusStyle = saveState === 'saved' ? css.badgeSaved
    : saveState === 'dup'   ? css.badgeDup
    : css.badgeNew

  const statusText = saveState === 'saved' ? 'Uložený'
    : saveState === 'dup'   ? 'Duplikát'
    : saveState === 'saving'? '...'
    : 'Nový'

  return (
    <div style={{ ...css.card, borderLeftColor: col }}>

      {/* Header */}
      <div style={css.cardTop}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={css.cardName}>{c.name}</div>
          <div style={css.cardMeta}>
            {c.address || '–'}
            {c.rating ? <span style={{ color: '#ffaa00', marginLeft: 8 }}>⭐ {c.rating}</span> : null}
            {c.phone  ? <span style={{ marginLeft: 8 }}>{c.phone}</span> : null}
          </div>
        </div>

        {/* Business Potential Score */}
        <div style={css.scoreSide}>
          {sc !== null && sc !== undefined ? (
            <>
              <div style={{ ...css.scoreBig, color: col }}>{sc}</div>
              <div style={{ ...css.scoreSmall, color: col }}>{lbl}</div>
              <div style={{ ...css.scoreSmall, color: '#6b7280', fontSize: '0.45rem', marginTop: 1 }}>BPS</div>
            </>
          ) : (
            <div style={css.scoreNa}>–</div>
          )}
        </div>
      </div>

      {/* AI reason */}
      {c.reason && (
        <div style={css.reason}>✦ {c.reason}</div>
      )}

      {/* Factors */}
      {(c.positive?.length > 0 || c.risks?.length > 0) && (
        <div style={css.factors}>
          {c.positive?.map((f, i) => (
            <span key={i} style={css.factorPos}>✓ {f}</span>
          ))}
          {c.risks?.map((r, i) => (
            <span key={i} style={css.factorRisk}>⚠ {r}</span>
          ))}
        </div>
      )}

      {/* Next step */}
      {c.nextStep && (
        <div style={css.nextStep}>→ {c.nextStep}</div>
      )}

      {/* Footer */}
      <div style={css.cardFooter}>
        <span style={statusStyle}>{statusText}</span>
        <button
          style={saveState === 'saved' ? css.btnSaved : saveState === 'dup' ? css.btnDup : css.btnSave}
          onClick={onSave}
          disabled={!!saveState}
        >
          {saveState === 'saving' ? '⏳ Ukladá...'
            : saveState === 'saved' ? '✓ Uložené v dashboarde'
            : saveState === 'dup'   ? '⚠ Už existuje'
            : '+ Uložiť do dashboardu'}
        </button>
      </div>
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
  panel:       { background: '#111418', border: '1px solid #1e2530', borderRadius: 4, padding: '1.4rem' },
  panelTitle:  { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.62rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '1.25rem' },
  grid2:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  grid3:       { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' },
  label:       { display: 'block', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.28rem' },
  input:       { width: '100%', background: '#0a0c0f', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.8rem', padding: '0.48rem 0.65rem', borderRadius: 2, outline: 'none' },
  inputErr:    { borderColor: '#ff3333' },
  select:      { width: '100%', background: '#0a0c0f', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.8rem', padding: '0.48rem 0.65rem', borderRadius: 2, outline: 'none' },
  radioRow:    { display: 'flex', gap: '1.5rem', flexWrap: 'wrap' },
  radio:       { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.7rem', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  searchBtn:   { marginTop: '0.5rem', width: '100%', background: '#ffaa00', border: 'none', color: '#0a0c0f', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.72rem', letterSpacing: '2px', textTransform: 'uppercase', padding: '0.68rem', borderRadius: 2, fontWeight: 700 },
  progressWrap:{ marginTop: '0.6rem', height: 3, background: '#1e2530', borderRadius: 2, overflow: 'hidden' },
  progressBar: { height: '100%', background: '#ffaa00', borderRadius: 2, transition: 'width 0.3s' },
  errBox:      { marginTop: '0.65rem', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.62rem', color: '#ff3333', background: 'rgba(255,51,51,0.08)', padding: '0.4rem 0.6rem', borderRadius: 2 },
  fieldErr:    { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.58rem', color: '#ff3333', marginTop: '0.2rem' },
  resHeader:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' },
  resTitle:    { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.6rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#6b7280' },
  saveAllBtn:  { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.65rem', border: '1px solid #ffaa00', background: 'transparent', color: '#ffaa00', borderRadius: 2 },
  card:        { background: '#111418', border: '1px solid #1e2530', borderLeft: '3px solid #1e2530', borderRadius: 2, padding: '0.9rem 1rem', marginBottom: '0.5rem' },
  cardTop:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.45rem' },
  cardName:    { fontWeight: 600, fontSize: '0.92rem', marginBottom: '0.15rem' },
  cardMeta:    { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.6rem', color: '#6b7280' },
  scoreSide:   { textAlign: 'right', flexShrink: 0, minWidth: 52 },
  scoreBig:    { fontFamily: "'IBM Plex Mono',monospace", fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 },
  scoreSmall:  { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', marginTop: 2 },
  scoreNa:     { fontFamily: "'IBM Plex Mono',monospace", fontSize: '1.2rem', color: '#6b7280' },
  reason:      { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.65rem', color: '#9ca3af', fontStyle: 'italic', marginBottom: '0.4rem', lineHeight: 1.5 },
  factors:     { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.4rem' },
  factorPos:   { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.58rem', color: '#00cc88', background: 'rgba(0,204,136,0.08)', border: '1px solid rgba(0,204,136,0.2)', padding: '0.1rem 0.38rem', borderRadius: 2 },
  factorRisk:  { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.58rem', color: '#ffaa00', background: 'rgba(255,170,0,0.08)', border: '1px solid rgba(255,170,0,0.2)', padding: '0.1rem 0.38rem', borderRadius: 2 },
  nextStep:    { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.62rem', color: '#00cc88', marginBottom: '0.5rem' },
  cardFooter:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', paddingTop: '0.5rem', borderTop: '1px solid #1e2530' },
  badgeNew:    { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.1rem 0.4rem', borderRadius: 2, background: 'rgba(0,102,255,0.1)', color: '#0066ff', border: '1px solid rgba(0,102,255,0.3)' },
  badgeSaved:  { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.1rem 0.4rem', borderRadius: 2, background: 'rgba(0,204,136,0.1)', color: '#00cc88', border: '1px solid rgba(0,204,136,0.3)' },
  badgeDup:    { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.1rem 0.4rem', borderRadius: 2, background: 'rgba(255,170,0,0.1)', color: '#ffaa00', border: '1px solid rgba(255,170,0,0.3)' },
  btnSave:     { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.62rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.3rem 0.75rem', border: '1px solid #00cc88', background: 'transparent', color: '#00cc88', borderRadius: 2 },
  btnSaved:    { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.62rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.3rem 0.75rem', border: '1px solid #1e2530', background: 'transparent', color: '#6b7280', borderRadius: 2, cursor: 'default' },
  btnDup:      { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.62rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.3rem 0.75rem', border: '1px solid #ffaa00', background: 'transparent', color: '#ffaa00', borderRadius: 2, cursor: 'default' },
}
