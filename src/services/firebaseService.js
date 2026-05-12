import { db } from '../firebase.js'
import {
  collection, addDoc, getDocs, query, where, writeBatch,
  serverTimestamp, orderBy, onSnapshot, doc, updateDoc
} from 'firebase/firestore'
import { normalizeCompanyData } from '../utils/normalizeCompanyData.js'

export async function saveCompany(raw, category, city, country = 'DE') {
  const data = normalizeCompanyData(raw, category, city, country)

  // Duplicate detection: googlePlaceId → website → name+address
  const ref = collection(db, 'companies')
  if (data.googlePlaceId) {
    const snap = await getDocs(query(ref, where('googlePlaceId', '==', data.googlePlaceId)))
    if (!snap.empty) return { id: snap.docs[0].id, duplicate: true }
  }
  if (data.website) {
    const snap = await getDocs(query(ref, where('website', '==', data.website)))
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
  const ref     = collection(db, 'companies')
  const ts      = serverTimestamp()
  const results = {}

  // 1. Duplicate checks in parallel
  const checked = await Promise.all(
    companies.map(async raw => {
      const data = normalizeCompanyData(raw, category, city, country)
      const key  = raw.place_id || raw.googlePlaceId || data.name  // must match place_id used in SearchPanel

      if (data.googlePlaceId) {
        const snap = await getDocs(query(ref, where('googlePlaceId', '==', data.googlePlaceId)))
        if (!snap.empty) { results[key] = 'dup'; return null }
      }
      if (data.name && data.address) {
        const snap = await getDocs(query(ref, where('name', '==', data.name), where('address', '==', data.address)))
        if (!snap.empty) { results[key] = 'dup'; return null }
      }
      return { key, data }
    })
  )

  // 2. Batch write all non-duplicates
  const toWrite = checked.filter(Boolean)
  if (toWrite.length) {
    const batch = writeBatch(db)
    toWrite.forEach(({ key, data }) => {
      const newRef = doc(ref)
      batch.set(newRef, { ...data, createdAt: ts, updatedAt: ts })
      results[key] = 'saved'
    })
    await batch.commit()
  }

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
