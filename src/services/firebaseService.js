import { db } from '../firebase.js'
import {
  collection, addDoc, getDocs, query, where, limit,
  serverTimestamp, orderBy, onSnapshot, doc, updateDoc
} from 'firebase/firestore'
import { normalizeCompanyData } from '../utils/normalizeCompanyData.js'

export async function saveCompany(raw, category, city, country = 'DE') {
  const data = normalizeCompanyData(raw, category, city, country)
  const ref  = collection(db, 'companies')

  if (data.googlePlaceId) {
    const snap = await getDocs(query(ref, where('googlePlaceId', '==', data.googlePlaceId)))
    if (!snap.empty) return { id: snap.docs[0].id, duplicate: true }
  }
  if (data.name && data.address) {
    const snap = await getDocs(query(ref, where('name', '==', data.name), where('address', '==', data.address)))
    if (!snap.empty) return { id: snap.docs[0].id, duplicate: true }
  }

  const docRef = await addDoc(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  return { id: docRef.id, duplicate: false }
}

export async function saveCompanies(companies, category, city, country = 'DE') {
  console.log('[saveCompanies] start — count:', companies.length, '| db:', !!db, '| projectId:', db?.app?.options?.projectId)

  const ref     = collection(db, 'companies')
  const results = {}

  // 1. Parallel duplicate checks
  const checked = await Promise.all(
    companies.map(async (raw) => {
      const data = normalizeCompanyData(raw, category, city, country)
      const key  = raw.place_id

      console.log('[saveCompanies] checking:', data.name, '| key:', key, '| googlePlaceId:', data.googlePlaceId)

      if (data.googlePlaceId) {
        const snap = await getDocs(query(ref, where('googlePlaceId', '==', data.googlePlaceId)))
        if (!snap.empty) {
          console.log('[saveCompanies] duplicate (placeId):', data.name)
          results[key] = 'dup'
          return null
        }
      }
      if (data.name && data.address) {
        const snap = await getDocs(query(ref, where('name', '==', data.name), where('address', '==', data.address)))
        if (!snap.empty) {
          console.log('[saveCompanies] duplicate (name+addr):', data.name)
          results[key] = 'dup'
          return null
        }
      }
      return { key, data }
    })
  )

  // 2. Save non-duplicates individually (avoids writeBatch doc-ref issues)
  const toWrite = checked.filter(Boolean)
  console.log('[saveCompanies] to write:', toWrite.length, '| duplicates:', Object.values(results).filter(v => v === 'dup').length)

  await Promise.all(
    toWrite.map(async ({ key, data }) => {
      try {
        const docRef = await addDoc(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
        console.log('[saveCompanies] saved:', data.name, '| docId:', docRef.id)
        results[key] = 'saved'
      } catch (err) {
        console.error('[saveCompanies] addDoc failed for', data.name, ':', err.code, err.message)
        results[key] = 'error'
      }
    })
  )

  console.log('[saveCompanies] done — results:', results)
  return results
}

export function subscribeCompanies(callback) {
  const q = query(collection(db, 'companies'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
}

export async function updateCompanyScore(id, score, reason, factors) {
  await updateDoc(doc(db, 'companies', id), {
    aiScore: score,
    aiReason: reason,
    aiFactors: factors || null,
    updatedAt: serverTimestamp(),
  })
}

export async function saveDraft(companyId, companyName, subject, body) {
  await addDoc(collection(db, 'emails'), {
    companyId,
    companyName,
    subject,
    body,
    status: 'draft',
    createdAt: serverTimestamp(),
    sentAt: null,
  })
}

export async function seedKnowledgeBase() {
  const ref  = collection(db, 'knowledge_base')
  const snap = await getDocs(query(ref, limit(1)))
  if (!snap.empty) return // already seeded

  const entries = [
    {
      title:    'Was ist STRIKER',
      category: 'technology',
      content:  'Hydrodynamische Kavitations-Heiztechnologie. Elektrischer Input: 45 kW → Thermischer Output: 120-160 kW. COP 2.6-3.5. Einsparung bis 70% gegenüber konventionellen Systemen. Preis: 8.000-10.000 EUR. Lieferzeit 6-8 Wochen.',
      language: 'de', active: true,
    },
    {
      title:    'Zielgruppen',
      category: 'targets',
      content:  'Hotels (4+ Sterne, hoher Warmwasserbedarf), industrielle Wäschereien, Wellness/Spa-Zentren, Krankenhäuser und Kliniken, Restaurants mit Großküchen. Priorität: Betriebe mit >50.000 EUR jährlichen Heizkosten.',
      language: 'de', active: true,
    },
    {
      title:    'ROI Argumente',
      category: 'sales',
      content:  'Einsparung bis 70% gegenüber konventionellen Heizsystemen. Amortisation in 2-4 Jahren. BAFA-Förderung bis 30% möglich. Preis 8.000-10.000 EUR inkl. Installation. Wartungsarm, langlebig, keine Emissionen.',
      language: 'de', active: true,
    },
    {
      title:    'Email Regeln',
      category: 'communication',
      content:  'Professionell und knapp (max 150 Wörter). Kein aggressiver Verkauf. Konkreter nächster Schritt immer am Ende. B2B-Stil: Sehr geehrte Damen und Herren. Fokus auf Kosteneinsparung, nicht Technologie. Einen einzigen klaren Call-to-Action.',
      language: 'de', active: true,
    },
    {
      title:    'Einwände und Antworten',
      category: 'objections',
      content:  '"Zu teuer": ROI in 2-4 Jahren, BAFA-Förderung möglich. "Kein Interesse": Einsparpotenzial kurz nennen, Rückruf anbieten. "Haben bereits ein System": Ergänzung oder Modernisierung möglich. "Brauchen Zeit": Informationsmaterial zusenden, Termin in 2 Wochen vorschlagen.',
      language: 'de', active: true,
    },
  ]

  for (const entry of entries) {
    await addDoc(ref, { ...entry, createdAt: serverTimestamp() })
  }
  console.log('[knowledgeBase] seeded 5 entries')
}
