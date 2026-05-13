import { useState, useEffect } from 'react'
import { db } from '../firebase.js'
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { subscribeCompanies, updateCompanyScore, saveDraft } from '../services/firebaseService.js'
import { scoreCompany } from '../services/aiScoringService.js'
import { generateEmailDraft } from '../services/emailService.js'
import { STATUS_LIST } from '../constants/companyStatuses.js'
import CompanyCard from './CompanyCard.jsx'
import AiSummaryPanel from './AiSummaryPanel.jsx'
import CompanyDetailModal from './CompanyDetailModal.jsx'

const FILTERS = [{ key: 'all', label: 'Všetky' }, ...STATUS_LIST.map(s => ({ key: s.key, label: s.label }))]

export default function Dashboard() {
  const [companies, setCompanies]   = useState([])
  const [filter, setFilter]         = useState('all')
  const [search, setSearch]         = useState('')
  const [scoring, setScoring]       = useState({})
  const [draft, setDraft]           = useState(null)
  const [saving, setSaving]         = useState(false)
  const [selected, setSelected]     = useState(null)

  useEffect(() => subscribeCompanies(setCompanies), [])

  // Keep selected in sync with live data
  useEffect(() => {
    if (!selected) return
    const fresh = companies.find(c => c.id === selected.id)
    if (fresh) setSelected(fresh)
  }, [companies])

  const filtered = companies.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return c.name?.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q)
    }
    return true
  })

  async function handleScore(company) {
    setScoring(p => ({ ...p, [company.id]: true }))
    try {
      const res = await scoreCompany(company)
      await updateCompanyScore(company.id, res.score, res.reason, res.factors)
    } catch (e) {
      alert('Chyba skórovania: ' + e.message)
    } finally {
      setScoring(p => ({ ...p, [company.id]: false }))
    }
  }

  function openDraft(company) {
    const { subject, body } = generateEmailDraft(company)
    setDraft({ company, subject, body })
  }

  async function handleSaveDraft() {
    setSaving(true)
    try {
      await saveDraft(draft.company.id, draft.company.name, draft.subject, draft.body)
      setDraft(null)
    } catch (e) {
      alert('Chyba: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(companyId, newStatus) {
    try {
      await updateDoc(doc(db, 'companies', companyId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      })
    } catch (e) {
      alert('Chyba zmeny statusu: ' + e.message)
    }
  }

  async function handleSaveNote(companyId, notes) {
    try {
      await updateDoc(doc(db, 'companies', companyId), {
        notes,
        updatedAt: serverTimestamp(),
      })
    } catch (e) {
      alert('Chyba ukladania poznámok: ' + e.message)
    }
  }

  async function handleCreateTask(companyId, title) {
    try {
      const { addDoc, collection } = await import('firebase/firestore')
      await addDoc(collection(db, 'tasks'), {
        companyId,
        title,
        status: 'open',
        createdAt: serverTimestamp(),
      })
    } catch (e) {
      alert('Chyba vytvorenia úlohy: ' + e.message)
    }
  }

  const [seeded, setSeeded] = useState(false)

  async function handleSeedTestCompany() {
    setSeeded('saving')
    try {
      await addDoc(collection(db, 'companies'), {
        name: 'TEST - Adolf Staubert',
        email: 'adolfstaubert6@gmail.com',
        phone: '+49 171 4758126',
        website: 'striker-energy.de',
        city: 'Biblis',
        address: 'Heinrich-Hertz-Straße 4, 68647 Biblis',
        category: 'hotel',
        status: 'new',
        rating: 5,
        aiScore: 90,
        aiReason: 'Testovací kontakt pre overenie email workflow',
        createdAt: serverTimestamp(),
      })
      setSeeded('done')
    } catch (e) {
      alert('Seed error: ' + e.message)
      setSeeded(false)
    }
  }

  function handleGenerateEmail(company) {
    const { subject, body } = generateEmailDraft(company)
    setDraft({ company, subject, body })
  }

  return (
    <div>
      <AiSummaryPanel companies={companies} />

      <div style={css.toolbar}>
        {FILTERS.map(f => (
          <button key={f.key}
            style={{ ...css.fbtn, ...(filter === f.key ? css.fbtnOn : {}) }}
            onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
        <input style={css.search} placeholder="Hľadať firmu alebo mesto..."
          value={search} onChange={e => setSearch(e.target.value)} />
        {seeded !== 'done' && (
          <button
            style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.55rem', letterSpacing: '1px', padding: '0.25rem 0.5rem', border: '1px solid #1e2530', background: 'transparent', color: '#2d3748', borderRadius: 2, cursor: 'pointer', opacity: 0.4 }}
            onClick={handleSeedTestCompany}
            disabled={seeded === 'saving'}
            title="Seed test company">
            {seeded === 'saving' ? '⏳' : '⊕ test'}
          </button>
        )}
      </div>

      {filtered.length > 0 && (
        <div style={css.count}>{filtered.length} firiem</div>
      )}

      {filtered.length === 0 ? (
        <div style={css.empty}>
          {companies.length === 0
            ? '→ Pridaj firmy cez "+ Hľadať firmy" v hlavičke'
            : 'Žiadne výsledky pre daný filter'}
        </div>
      ) : (
        filtered.map(c => (
          <div key={c.id} onClick={() => setSelected(c)} style={{ cursor: 'pointer' }}>
            <CompanyCard
              company={c}
              scoring={!!scoring[c.id]}
              onDraft={e => { e?.stopPropagation?.(); openDraft(c) }}
              onScore={e => { e?.stopPropagation?.(); handleScore(c) }}
            />
          </div>
        ))
      )}

      {/* Detail modal — handles all Firebase ops internally */}
      {selected && (
        <CompanyDetailModal
          company={selected}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Draft modal */}
      {draft && (
        <div style={css.overlay} onClick={e => e.target === e.currentTarget && setDraft(null)}>
          <div style={css.modal}>
            <div style={css.mhead}>
              <span style={css.mtitle}>✉ Email draft</span>
              <span style={css.mcompany}>{draft.company.name}</span>
            </div>
            <label style={css.mlabel}>Predmet</label>
            <input style={css.minput}
              value={draft.subject}
              onChange={e => setDraft(d => ({ ...d, subject: e.target.value }))} />
            <label style={css.mlabel}>Text emailu</label>
            <textarea style={css.mtarea}
              value={draft.body}
              onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} />
            <div style={css.mbtns}>
              <button style={css.mbtnOk} onClick={handleSaveDraft} disabled={saving}>
                {saving ? '⏳ Ukladá...' : '✓ Uložiť draft'}
              </button>
              <button style={css.mbtnCancel} onClick={() => setDraft(null)}>Zrušiť</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const css = {
  toolbar:    { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' },
  fbtn:       { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.63rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.65rem', border: '1px solid #1e2530', background: 'transparent', color: '#6b7280', borderRadius: 2 },
  fbtnOn:     { borderColor: '#ff5c00', color: '#ff5c00' },
  search:     { flex: 1, minWidth: 180, background: '#111418', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.72rem', padding: '0.28rem 0.6rem', borderRadius: 2, outline: 'none' },
  count:      { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.58rem', color: '#6b7280', letterSpacing: '1px', marginBottom: '0.6rem' },
  empty:      { textAlign: 'center', padding: '3.5rem', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.75rem', color: '#6b7280', lineHeight: 2 },
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' },
  modal:      { background: '#111418', border: '1px solid #1e2530', borderRadius: 4, padding: '1.5rem', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' },
  mhead:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  mtitle:     { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.62rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#6b7280' },
  mcompany:   { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.7rem', color: '#ffaa00' },
  mlabel:     { display: 'block', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.25rem' },
  minput:     { width: '100%', background: '#0a0c0f', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.75rem', padding: '0.45rem 0.7rem', borderRadius: 2, outline: 'none', marginBottom: '0.65rem' },
  mtarea:     { width: '100%', background: '#0a0c0f', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.65rem', padding: '0.5rem 0.7rem', borderRadius: 2, outline: 'none', resize: 'vertical', minHeight: 220, lineHeight: 1.7, marginBottom: '0.75rem' },
  mbtns:      { display: 'flex', gap: '0.5rem' },
  mbtnOk:     { flex: 1, background: '#00cc88', border: 'none', color: '#0a0c0f', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.45rem', borderRadius: 2, fontWeight: 700 },
  mbtnCancel: { background: 'transparent', border: '1px solid #1e2530', color: '#6b7280', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.45rem 0.9rem', borderRadius: 2 },
}
