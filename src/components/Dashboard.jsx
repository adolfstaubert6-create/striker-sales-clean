import { useState, useEffect } from 'react'
import { db } from '../firebase.js'
import { collection, onSnapshot, orderBy, query, doc, updateDoc } from 'firebase/firestore'
import CompanyCard from './CompanyCard.jsx'

const FILTERS = [
  { key: 'all', label: 'Všetky' },
  { key: 'new', label: 'Noví' },
  { key: 'contacted', label: 'Kontaktovaní' },
  { key: 'offer', label: 'Ponuka' },
  { key: 'closed', label: 'Uzavreté' },
]

const s = {
  toolbar: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    marginBottom: '1rem',
    alignItems: 'center',
  },
  fbtn: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.65rem',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    padding: '0.28rem 0.65rem',
    border: '1px solid #1e2530',
    background: 'transparent',
    color: '#6b7280',
    borderRadius: '2px',
  },
  fbtnActive: {
    borderColor: '#ff5c00',
    color: '#ff5c00',
  },
  search: {
    flex: 1,
    minWidth: 160,
    background: '#111418',
    border: '1px solid #1e2530',
    color: '#e8eaed',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.72rem',
    padding: '0.28rem 0.6rem',
    borderRadius: '2px',
    outline: 'none',
  },
  stats: {
    display: 'flex',
    gap: '0.75rem',
    marginBottom: '1.25rem',
    flexWrap: 'wrap',
  },
  stat: {
    background: '#111418',
    border: '1px solid #1e2530',
    borderRadius: '2px',
    padding: '0.65rem 1rem',
    flex: 1,
    minWidth: 110,
  },
  statVal: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '1.4rem',
    fontWeight: 600,
    color: '#ff5c00',
    lineHeight: 1,
    marginBottom: '0.2rem',
  },
  statLbl: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.55rem',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: '#6b7280',
  },
  empty: {
    textAlign: 'center',
    padding: '3rem',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.75rem',
    color: '#6b7280',
  },
  modal: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, padding: '1rem',
  },
  modalBox: {
    background: '#111418',
    border: '1px solid #1e2530',
    borderRadius: '4px',
    padding: '1.5rem',
    width: '100%',
    maxWidth: 560,
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalTitle: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.62rem',
    letterSpacing: '3px',
    textTransform: 'uppercase',
    color: '#6b7280',
    marginBottom: '1rem',
  },
  textarea: {
    width: '100%',
    background: '#0a0c0f',
    border: '1px solid #1e2530',
    color: '#e8eaed',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.7rem',
    padding: '0.6rem 0.75rem',
    borderRadius: '2px',
    outline: 'none',
    resize: 'vertical',
    minHeight: 220,
    lineHeight: 1.7,
    marginBottom: '0.75rem',
  },
  inputSm: {
    width: '100%',
    background: '#0a0c0f',
    border: '1px solid #1e2530',
    color: '#e8eaed',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.75rem',
    padding: '0.45rem 0.7rem',
    borderRadius: '2px',
    outline: 'none',
    marginBottom: '0.6rem',
  },
  mbtns: { display: 'flex', gap: '0.5rem', marginTop: '0.25rem' },
  mbtnPrimary: {
    flex: 1,
    background: '#00cc88',
    border: 'none',
    color: '#0a0c0f',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.65rem',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    padding: '0.45rem',
    borderRadius: '2px',
    fontWeight: 600,
  },
  mbtnSec: {
    background: 'transparent',
    border: '1px solid #1e2530',
    color: '#6b7280',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.65rem',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    padding: '0.45rem 0.9rem',
    borderRadius: '2px',
  },
  label: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.55rem',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: '#6b7280',
    marginBottom: '0.25rem',
    display: 'block',
  },
}

const EMAIL_TEMPLATE = (company) => ({
  subject: `Reduzierung Ihrer Heizkosten – STRIKER Wärmetechnologie`,
  body: `Sehr geehrte Damen und Herren,

mein Name ist Adolf Staubert, ich bin Entwickler einer patentierten industriellen Heiztechnologie namens STRIKER.

Unser System erzeugt bei einem elektrischen Verbrauch von nur 45 kW eine Wärmeleistung von 120–160 kW – das entspricht einer Einsparung von bis zu 70% gegenüber herkömmlichen Heizsystemen.

Für ${company.name} bietet STRIKER ein erhebliches Einsparpotenzial.

Preis: ab 8.000 EUR, Lieferzeit 6–8 Wochen.

Darf ich mich kurz telefonisch bei Ihnen melden?

Mit freundlichen Grüßen
Adolf Staubert
STRIKER Wärmetechnologie
Tel: +49 171 4758126
E-Mail: info@striker-energy.de`,
})

export default function Dashboard() {
  const [companies, setCompanies] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [draftModal, setDraftModal] = useState(null)
  const [draftSubject, setDraftSubject] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [scoring, setScoring] = useState({})

  useEffect(() => {
    const q = query(collection(db, 'companies'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

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

  function openDraft(company) {
    const tpl = EMAIL_TEMPLATE(company)
    setDraftSubject(tpl.subject)
    setDraftBody(tpl.body)
    setDraftModal(company)
  }

  async function saveDraft() {
    if (!draftModal) return
    setSaving(true)
    try {
      const { addDoc, serverTimestamp } = await import('firebase/firestore')
      await addDoc(collection(db, 'emails'), {
        companyId: draftModal.id,
        companyName: draftModal.name,
        subject: draftSubject,
        body: draftBody,
        status: 'draft',
        createdAt: serverTimestamp(),
        sentAt: null,
      })
      setDraftModal(null)
    } catch (e) {
      alert('Chyba: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function requestAIScore(company) {
    setScoring(prev => ({ ...prev, [company.id]: true }))
    try {
      const res = await fetch('/.netlify/functions/ai-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await updateDoc(doc(db, 'companies', company.id), {
        aiScore: data.score,
        aiReason: data.reason,
        updatedAt: new Date(),
      })
    } catch (e) {
      alert('AI Score chyba: ' + e.message)
    } finally {
      setScoring(prev => ({ ...prev, [company.id]: false }))
    }
  }

  return (
    <div>
      <div style={s.stats}>
        <div style={s.stat}>
          <div style={s.statVal}>{stats.total}</div>
          <div style={s.statLbl}>Celkom</div>
        </div>
        <div style={s.stat}>
          <div style={{ ...s.statVal, color: '#ffaa00' }}>{stats.contacted}</div>
          <div style={s.statLbl}>Kontaktovaní</div>
        </div>
        <div style={s.stat}>
          <div style={{ ...s.statVal, color: '#cc00ff' }}>{stats.offer}</div>
          <div style={s.statLbl}>Ponuka</div>
        </div>
        <div style={s.stat}>
          <div style={{ ...s.statVal, color: '#00cc88' }}>{stats.closed}</div>
          <div style={s.statLbl}>Uzavreté</div>
        </div>
      </div>

      <div style={s.toolbar}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            style={{ ...s.fbtn, ...(filter === f.key ? s.fbtnActive : {}) }}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <input
          style={s.search}
          placeholder="Hľadať..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div style={s.empty}>
          {companies.length === 0
            ? '→ Pridaj firmy cez "Hľadať firmy"'
            : 'Žiadne výsledky'}
        </div>
      ) : (
        filtered.map(c => (
          <CompanyCard
            key={c.id}
            company={{ ...c, aiScore: scoring[c.id] ? 'loading' : c.aiScore }}
            onDraft={openDraft}
            onScore={requestAIScore}
          />
        ))
      )}

      {draftModal && (
        <div style={s.modal} onClick={e => e.target === e.currentTarget && setDraftModal(null)}>
          <div style={s.modalBox}>
            <div style={s.modalTitle}>Email draft — {draftModal.name}</div>
            <label style={s.label}>Predmet</label>
            <input
              style={s.inputSm}
              value={draftSubject}
              onChange={e => setDraftSubject(e.target.value)}
            />
            <label style={s.label}>Text</label>
            <textarea
              style={s.textarea}
              value={draftBody}
              onChange={e => setDraftBody(e.target.value)}
            />
            <div style={s.mbtns}>
              <button style={s.mbtnPrimary} onClick={saveDraft} disabled={saving}>
                {saving ? '⏳ Ukladá...' : '✓ Uložiť draft'}
              </button>
              <button style={s.mbtnSec} onClick={() => setDraftModal(null)}>Zrušiť</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
