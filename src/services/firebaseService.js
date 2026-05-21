import { db } from '../firebase.js'
import {
  collection, addDoc, getDocs, deleteDoc, query, where, limit,
  serverTimestamp, orderBy, onSnapshot, doc, updateDoc
} from 'firebase/firestore'
import { normalizeCompanyData } from '../utils/normalizeCompanyData.js'

export async function saveCompany(raw, category, city, country = 'DE', division = 'A') {
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

  const docRef = await addDoc(ref, { ...data, division, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  return { id: docRef.id, duplicate: false }
}

export async function saveCompanies(companies, category, city, country = 'DE', division = 'A') {
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
        const docRef = await addDoc(ref, { ...data, division, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
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

export function subscribeCompanies(callback, division = 'A') {
  const q = query(collection(db, 'companies'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => {
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(division === 'B' ? all.filter(d => d.division === 'B') : all.filter(d => d.division !== 'B'))
  })
}

export async function updateCompanyScore(id, score, reason, factors) {
  await updateDoc(doc(db, 'companies', id), {
    aiScore:      score,
    aiReason:     reason,
    aiPositive:   factors?.positive   || [],
    aiRisks:      factors?.risks      || [],
    aiNextStep:   factors?.nextStep   || '',
    aiReasoning:  factors?.reasoning  || [],
    aiConfidence: factors?.confidence || 'nízka',
    aiKeyFactors: factors?.keyFactors || [],
    aiInsight:    factors?.aiInsight  || '',
    updatedAt:    serverTimestamp(),
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
  const snap = await getDocs(ref)

  // Check for v2 (Slovak) entries — skip if already seeded
  if (snap.docs.some(d => d.data().title === 'Co je STRIKER')) return

  // Remove old German entries if present
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))

  const entries = [
    { title: 'Co je STRIKER',       category: 'product',    content: 'Hydrodynamická kavitačná kúriaca technológia. 45kW elektrického vstupu → 120-160kW tepelného výkonu. COP 2.7-3.5. Cena 8000-10000 EUR. Dodacia lehota 6-8 týždňov. Patent chránená technológia.' },
    { title: 'Cieľové segmenty',    category: 'targets',    content: 'Hotely s wellness (vysoká spotreba TÚV). Priemyselné práčovne (kontinuálna potreba tepla). Wellness centrá a kúpele. Nemocnice. Veľké objekty s dennou spotrebou >500L teplej vody.' },
    { title: 'ROI argumenty',       category: 'roi',        content: 'Úspora 50-70% nákladov na kúrenie oproti elektrickému ohrievaču. Návratnosť investície 6-18 mesiacov. BAFA dotácia možná v Nemecku. Príklad: hotel 50 izieb ušetrí ~800-1200 EUR/mesiac.' },
    { title: 'Obchodné argumenty',  category: 'sales',      content: 'Patentovaná technológia. Reálne inštalácie v prevádzke. Žiadna údržba nad rámec bežnej prevádzky. Montáž 1-2 dni. Kompatibilné s existujúcim systémom kúrenia.' },
    { title: 'Email pravidlá',      category: 'email_rules',content: 'Profesionálny nemecký B2B štýl. Krátky a konkrétny. Žiadne agresívne predajné frázy. Žiadne nereálne sľuby. Jasný ďalší krok. Maximálne 150 slov. Vždy "Sie" nie "du".' },
    { title: 'Čo nesľubovať',       category: 'warnings',   content: 'Nikdy nesľubovať konkrétne percentá úspory bez analýzy. Nikdy negarantovať BAFA dotáciu. Nikdy nesľubovať okamžitú dodávku. Nepoužívať COP čísla v komunikácii s klientom.' },
    { title: 'Typické námietky',    category: 'objections', content: 'Príliš drahé → ROI 6-18 mesiacov, BAFA dotácia. Nemáme čas → montáž 1-2 dni, bez prerušenia prevádzky. Máme novú kotolňu → komplementárny systém, znižuje záťaž. Neznáma technológia → patent, reálne inštalácie.' },
  ]

  for (const entry of entries) {
    await addDoc(ref, { ...entry, createdAt: serverTimestamp() })
  }
  console.log('[knowledgeBase] seeded v2 — 7 entries')
}
