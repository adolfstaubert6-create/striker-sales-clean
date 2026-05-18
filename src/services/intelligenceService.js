import { db } from '../firebase.js'
import {
  collection, onSnapshot, addDoc, getDocs, updateDoc,
  doc, serverTimestamp, query, orderBy, where,
} from 'firebase/firestore'

const COL = 'intent_leads'

// ── Mock seed data ────────────────────────────────────────────────────────────
const MOCK_LEADS = [
  {
    companyName:     'Hotel Alpenhof Zugspitze',
    source:          'manual_research',
    industry:        'hotel',
    country:         'DE',
    city:            'Garmisch-Partenkirchen',
    intentScore:     91,
    painSignals:     ['Kotolňa 15+ rokov', 'Google recenzia: "izby studené"', 'Účty za energie +40% YoY'],
    aiSummary:       '4-hviezdičkový hotel, 92 izieb. Recenzie naznačujú problémy s kúrením v zimnej sezóne. Kotolňa z roku 2009, predpokladaná výmena do 2 rokov.',
    status:          'new',
    addedToWorkflow: false,
  },
  {
    companyName:     'Therme Erding Wellness GmbH',
    source:          'manual_research',
    industry:        'wellness',
    country:         'DE',
    city:            'Erding',
    intentScore:     84,
    painSignals:     ['Masívna spotreba teplej vody', 'Rozšírenie areálu 2025', 'Záujem o green certifikát'],
    aiSummary:       'Najväčší termálny park v Európe. Rozširujú kapacitu o 30%. Aktívne hľadajú úsporné riešenia kúrenia pre nové pavilóny.',
    status:          'new',
    addedToWorkflow: false,
  },
  {
    companyName:     'Wäscherei Müller & Söhne',
    source:          'manual_research',
    industry:        'laundry',
    country:         'DE',
    city:            'München',
    intentScore:     78,
    painSignals:     ['Priemyselné parné kotly = drahé', 'ISO 14001 audit 2026', 'Nová výrobná hala'],
    aiSummary:       'Priemyselná práčovňa s 3 prevádzkami v Bavorsku. ISO audit 2026 vyžaduje zníženie emisií. Nová hala = ideálna príležitosť.',
    status:          'contacted',
    addedToWorkflow: true,
  },
  {
    companyName:     'Rehazentrum Bad Reichenhall',
    source:          'manual_research',
    industry:        'hospital',
    country:         'DE',
    city:            'Bad Reichenhall',
    intentScore:     72,
    painSignals:     ['Nemocničná práčovňa 24/7', 'Plán modernizácie 2025-2026', 'Štátne dotácie na úspory'],
    aiSummary:       'Rehabilitačná klinika so 180 lôžkami. Interná práčovňa beží nonstop. V pláne modernizácia infraštruktúry, dostupné dotácie na efektívne vykurovanie.',
    status:          'new',
    addedToWorkflow: false,
  },
  {
    companyName:     'Sporthotel Wagrain',
    source:          'manual_research',
    industry:        'hotel',
    country:         'AT',
    city:            'Wagrain',
    intentScore:     88,
    painSignals:     ['Sezónne záťažové špičky', 'Recenzie: "bazén studený"', 'Plánovaná rekonštrukcia 2025'],
    aiSummary:       '3-hviezdičkový hotel s bazénom, 60 izieb. Rekonštrukcia naplánovaná na jar 2025. Google recenzie opakovane spomínajú problémy s teplotou vody.',
    status:          'new',
    addedToWorkflow: false,
  },
  {
    companyName:     'Kinderhotel Allgäu',
    source:          'manual_research',
    industry:        'hotel',
    country:         'DE',
    city:            'Oberstdorf',
    intentScore:     65,
    painSignals:     ['Celoročná prevádzka', 'Rozšírenie SPA sekcie'],
    aiSummary:       'Rodinný hotel zameraný na deti, 110 izieb. Rozširujú SPA sekciu — potreba dodatočného ohrevu vody je značná.',
    status:          'low_priority',
    addedToWorkflow: false,
  },
]

// ── Seed mock data on first load ──────────────────────────────────────────────
export async function seedIntentLeads() {
  try {
    const snap = await getDocs(collection(db, COL))
    if (!snap.empty) return
    for (const lead of MOCK_LEADS) {
      await addDoc(collection(db, COL), { ...lead, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    }
    console.log('[intelligence] seeded', MOCK_LEADS.length, 'mock leads')
  } catch (e) {
    console.warn('[intelligence] seed error:', e.message)
  }
}

// ── Subscribe to all intent_leads ─────────────────────────────────────────────
export function subscribeIntentLeads(cb) {
  const q = query(collection(db, COL), orderBy('intentScore', 'desc'))
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }, err => console.warn('[intelligence] subscribe error:', err.message))
}

// ── Update lead status ────────────────────────────────────────────────────────
export async function updateLeadStatus(id, status) {
  await updateDoc(doc(db, COL, id), { status, updatedAt: serverTimestamp() })
}

// ── Mark lead as added to workflow ────────────────────────────────────────────
export async function markLeadAddedToWorkflow(id) {
  await updateDoc(doc(db, COL, id), {
    addedToWorkflow: true,
    addedToWorkflowAt: serverTimestamp(),
    status: 'contacted',
    updatedAt: serverTimestamp(),
  })
}

// ── Add a new manual lead ─────────────────────────────────────────────────────
export async function addIntentLead(data) {
  return addDoc(collection(db, COL), {
    ...data,
    source:          data.source || 'manual',
    status:          'new',
    addedToWorkflow: false,
    intentScore:     data.intentScore || 50,
    createdAt:       serverTimestamp(),
    updatedAt:       serverTimestamp(),
  })
}
