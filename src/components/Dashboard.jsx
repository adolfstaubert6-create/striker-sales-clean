import { useState, useEffect } from 'react'
import { subscribeCompanies, updateCompanyScore, saveDraft } from '../services/firebaseService.js'
import { scoreCompany } from '../services/aiScoringService.js'
import { generateEmailDraft } from '../services/emailService.js'
import { COMPANY_STATUSES, STATUS_LIST } from '../constants/companyStatuses.js'
import { calculatePriorityLabel } from '../utils/calculatePriorityLabel.js'
import CompanyCard from './CompanyCard.jsx'

const FILTERS = [{ key: 'all', label: 'Všetky' }, ...STATUS_LIST.map(s => ({ key: s.key, label: s.label }))]

const s = {
  stats: { display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' },
  stat: { background: '#111418', border: '1px solid #1e2530', borderRadius: '2px', padding: '0.65rem 1rem', flex: 1, minWidth: 100 },
  statVal: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '1.4rem', fontWeight: 600, color: '#ff5c00', lineHeight: 1, marginBottom: '0.2rem' },
  statLbl: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.55rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#6b7280' },
  toolbar: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' },
  fbtn: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.63rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.65rem', border: '1px solid #1e2530', background: 'transparent', color: '#6b7280', borderRadius: '2px' },
  fbtnActive: { borderColor: '#ff5c00', color: '#ff5c00' },
  search: { flex: 1, minWidth: 160, background: '#111418', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.72rem', padding: '0.28rem 0.6rem', borderRadius: '2px', outline: 'none' },
  empty: { textAlign: 'center', padding: '3rem', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.75rem', color: '#6b7280' },
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' },
  mbox: { background: '#111418', border: '1px solid #1e2530', borderRadius: '4px', padding: '1.5rem', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' },
  mtitle: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.62rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '1rem' },
  mlabel: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.25rem', display: 'block' },
  minput: { width: '100%', background: '#0a0c0f', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.75rem', padding: '0.45rem 0.7rem', borderRadius: '2px', outline: 'none', marginBottom: '0.65rem' },
  mtarea: { width: '100%', background: '#0a0c0f', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.65rem', padding: '0.5rem 0.7rem', borderRadius: '2px', outline: 'none', resize: 'vertical', minHeight: 220, lineHeight: 1.7, marginBottom: '0.75rem' },
  mbtns: { display: 'flex', gap: '0.5rem' },
  mbtnOk: { flex: 1, background: '#00cc88', border: 'none', color: '#0a0c0f', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.45rem', borderRadius: '2px', fontWeight: 600 },
  mbtnCancel: { background: 'transparent', border: '1px solid #1e2530', color: '#6b7280', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.45rem 0.9rem', borderRadius: '2px' },
}

export default function Dashboard() {
  const [companies, setCompanies] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [scoring, setScoring] = useState({})
  const [draftModal, setDraftModal] = useState(null)
  const [draftSubject, setDraftSubject] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => subscribeCompanies(setCompanies), [])

  const filtered = companies.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return c.name?.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q)
    }
    return true
  })

  const stats = {
    total: companies.length,
    contacted: companies.filter(c => c.status === 'contacted').length,
    offer: companies.filter(c => c.status === 'offer').length,
    closed: companies.filter(c => c.status === 'closed').length,
  }

  async function handleScore(company) {
    setScoring(p => ({ ...p, [company.id]: true }))
    try {
      const result = await scoreCompany(company)
      await updateCompanyScore(company.id, result.score, result.reason, result.factors)
    } catch (e) {
      alert('AI Score chyba: ' + e.message)
    } finally {
      setScoring(p => ({ ...p, [company.id]: false }))
    }
  }

  function openDraft(company) {
    const { subject, body } = generateEmailDraft(company)
    setDraftSubject(subject)
    setDraftBody(body)
    setDraftModal(company)
  }

  async function handleSaveDraft() {
    setSaving(true)
    try {
      await saveDraft(draftModal.id, draftModal.name, draftSubject, draftBody)
      setDraftModal(null)
    } catch (e) {
      alert('Chyba: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={s.stats}>
        {[
          { val: stats.total,     lbl: 'Celkom',        color: '#ff5c00' },
          { val: stats.contacted, lbl: 'Kontaktovaní',  color: '#ffaa00' },
          { val: stats.offer,     lbl: 'Ponuka',        color: '#cc00ff' },
          { val: stats.closed,    lbl: 'Uzavreté',      color: '#00cc88' },
        ].map(({ val, lbl, color }) => (
          <div key={lbl} style={s.stat}>
            <div style={{ ...s.statVal, color }}>{val}</div>
            <div style={s.statLbl}>{lbl}</div>
          </div>
        ))}
      </div>

      <div style={s.toolbar}>
        {FILTERS.map(f => (
          <button key={f.key} style={{ ...s.fbtn, ...(filter === f.key ? s.fbtnActive : {}) }} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
        <input style={s.search} placeholder="Hľadať..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div style={s.empty}>{companies.length === 0 ? '→ Pridaj firmy cez "Hľadať firmy"' : 'Žiadne výsledky'}</div>
      ) : (
        filtered.map(c => (
          <CompanyCard
            key={c.id}
            company={c}
            scoring={!!scoring[c.id]}
            onDraft={openDraft}
            onScore={handleScore}
            priorityLabel={calculatePriorityLabel(c.aiScore)}
          />
        ))
      )}

      {draftModal && (
        <div style={s.modal} onClick={e => e.target === e.currentTarget && setDraftModal(null)}>
          <div style={s.mbox}>
            <div style={s.mtitle}>Email draft — {draftModal.name}</div>
            <label style={s.mlabel}>Predmet</label>
            <input style={s.minput} value={draftSubject} onChange={e => setDraftSubject(e.target.value)} />
            <label style={s.mlabel}>Text emailu</label>
            <textarea style={s.mtarea} value={draftBody} onChange={e => setDraftBody(e.target.value)} />
            <div style={s.mbtns}>
              <button style={s.mbtnOk} onClick={handleSaveDraft} disabled={saving}>
                {saving ? '⏳ Ukladá...' : '✓ Uložiť draft'}
              </button>
              <button style={s.mbtnCancel} onClick={() => setDraftModal(null)}>Zrušiť</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
