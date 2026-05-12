import { db } from '../firebase.js'
import {
  collection, addDoc, getDocs, query, where,
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
