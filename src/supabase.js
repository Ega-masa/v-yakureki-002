// voice-yakureki v5.7.0 supabase.js
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://lrtcrczgwxilukltetxa.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxydGNyY3pnd3hpbHVrbHRldHhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNjY5NDMsImV4cCI6MjA4OTc0Mjk0M30.zVRuzvAKQrNVbrHkQzdnhMqie7Dy4Py8Fcr5eEZAbQo'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
export { SUPABASE_URL, SUPABASE_ANON_KEY }

// === Auth ===
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}
export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session))
}

// === User ===
export async function getUserInfo(email) {
  const { data } = await supabase
    .from('users').select('*, user_stores(store_id, role, stores(id, name, name_kana))').eq('email', email).single()
  return data
}

// === API Keys (DB関数経由で安全に取得) ===
export async function getApiKey(service, storeId) {
  try {
    const { data, error } = await supabase.rpc('get_api_key', {
      p_service: service,
      p_store_id: storeId || null,
    })
    if (error) {
      console.warn('getApiKey rpc error, falling back:', error.message)
      if (storeId) {
        const { data: d } = await supabase.from('api_keys').select('api_key').eq('service', service).eq('store_id', storeId).eq('is_active', true).single()
        if (d?.api_key) return d.api_key
      }
      const { data: d2 } = await supabase.from('api_keys').select('api_key').eq('service', service).is('store_id', null).eq('is_active', true).single()
      return d2?.api_key || ''
    }
    return data || ''
  } catch (e) {
    console.error('getApiKey error:', e)
    return ''
  }
}

// === Records ===
export async function saveRecord(transcript, durationSec, patientName, storeId, userId) {
  const row = { transcript, duration_sec: durationSec, patient_name: patientName || '' }
  if (storeId) row.store_id = storeId
  if (userId) row.created_by = userId
  const { data, error } = await supabase.from('records').insert(row).select().single()
  if (error) throw error
  return data
}
export async function getRecords(limit = 30, storeId) {
  let q = supabase.from('records').select('*').order('created_at', { ascending: false }).limit(limit)
  if (storeId) q = q.eq('store_id', storeId)
  const { data, error } = await q
  if (error) throw error
  return data || []
}
export async function updateRecord(id, updates) {
  const { data, error } = await supabase.from('records').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}
export async function deleteRecord(id) {
  const { error } = await supabase.from('records').delete().eq('id', id)
  if (error) throw error
}

// === Usage Log ===
export async function logUsage(action, storeId, userId, durationSec) {
  try {
    await supabase.from('usage_logs').insert({ action, store_id: storeId || null, user_id: userId || null, duration_sec: durationSec || null })
  } catch (e) {}
}

// === Drug Master ===
let drugCache = null
let drugCacheTime = 0
const DRUG_CACHE_TTL = 30 * 60 * 1000

export async function loadDrugMaster() {
  if (drugCache && Date.now() - drugCacheTime < DRUG_CACHE_TTL) return drugCache
  const { data } = await supabase.from('drug_master').select('ingredient_name, reading_kana, reading_kata, aliases').eq('is_active', true)
  drugCache = data || []
  drugCacheTime = Date.now()
  return drugCache
}

export function correctDrugNames(text, drugs) {
  if (!text || !drugs?.length) return { text, corrections: [] }
  const corrections = []
  let result = text
  const toKata = (s) => s.replace(/[\u3041-\u3096]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60))
  const toHira = (s) => s.replace(/[\u30A1-\u30F6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
  for (const drug of drugs) {
    const name = drug.ingredient_name
    if (result.includes(name)) continue
    const candidates = [drug.reading_kana, drug.reading_kata, toKata(drug.reading_kana), toHira(drug.reading_kata || ''), ...(drug.aliases || [])].filter(Boolean)
    for (const alias of candidates) {
      if (!alias || alias === name) continue
      if (result.includes(alias)) { result = result.split(alias).join(name); corrections.push({ from: alias, to: name }); break }
    }
  }
  return { text: result, corrections }
}

export function invalidateDrugCache() { drugCache = null; drugCacheTime = 0 }

