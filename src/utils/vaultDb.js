/**
 * Offline IndexedDB Local Scans Vault
 * Safely persists scanned document images & organized folders locally on device.
 * 100% offline & client-side. No data ever leaves the device.
 */

const DB_NAME = 'KamalScanVault'
const DB_VERSION = 2
const STORE_NAME = 'scanned_pages'
const DOCS_STORE = 'vault_documents'

export const VAULT_CATEGORIES = [
  { id: 'all', label: 'All Files', color: 'sky' },
  { id: 'study', label: 'Study Notes', color: 'indigo' },
  { id: 'idcard', label: 'ID & Cards', color: 'purple' },
  { id: 'receipts', label: 'Receipts & Bills', color: 'emerald' },
  { id: 'certificates', label: 'Certificates', color: 'amber' },
  { id: 'personal', label: 'Personal Docs', color: 'rose' },
]

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(DOCS_STORE)) {
        const store = db.createObjectStore(DOCS_STORE, { keyPath: 'id' })
        store.createIndex('category', 'category', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ─── Temporary Active Session Queue ──────────────────────────────────────────
export async function saveVaultQueue(queue) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    await new Promise((resolve, reject) => {
      const req = store.clear()
      req.onsuccess = resolve
      req.onerror = reject
    })

    for (const item of queue) {
      store.put({
        id: item.id,
        name: item.name,
        kind: item.kind,
        previewUrl: item.previewUrl,
        originalSize: item.originalSize,
        tier: item.tier,
        customQuality: item.customQuality,
        downloadFormat: item.downloadFormat,
        enhanceMode: item.enhanceMode,
        targetSize: item.targetSize,
        targetUnit: item.targetUnit,
        savedPercent: item.savedPercent,
        ocrText: item.ocrText,
        paddingPx: item.paddingPx,
        timestamp: Date.now(),
      })
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve
      tx.onerror = reject
    })
  } catch (err) {
    console.warn('Failed to save scans to IndexedDB:', err)
  }
}

export async function loadVaultQueue() {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)

    return new Promise((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = reject
    })
  } catch (err) {
    console.warn('Failed to load scans from IndexedDB:', err)
    return []
  }
}

export async function clearVault() {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    return new Promise((resolve, reject) => {
      const req = store.clear()
      req.onsuccess = resolve
      req.onerror = reject
    })
  } catch (err) {
    console.warn('Failed to clear IndexedDB:', err)
  }
}

// ─── Permanent Categorized Document Vault ────────────────────────────────────
export async function saveDocumentToVault({ title, category = 'study', pages = [], tags = [] }) {
  try {
    const db = await openDB()
    const tx = db.transaction(DOCS_STORE, 'readwrite')
    const store = tx.objectStore(DOCS_STORE)

    const docId = 'vault_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
    const thumbnail = pages.length > 0 ? (pages[0].previewUrl || pages[0].dataUrl) : null

    const docRecord = {
      id: docId,
      title: title || `Scan_${new Date().toLocaleDateString().replace(/\//g, '-')}`,
      category,
      tags,
      pageCount: pages.length,
      thumbnail,
      pages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    store.put(docRecord)

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(docRecord)
      tx.onerror = reject
    })
  } catch (err) {
    console.error('Failed to save document to vault:', err)
    throw err
  }
}

export async function getAllVaultDocuments() {
  try {
    const db = await openDB()
    const tx = db.transaction(DOCS_STORE, 'readonly')
    const store = tx.objectStore(DOCS_STORE)

    return new Promise((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => {
        const docs = req.result || []
        // Sort newest first
        docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        resolve(docs)
      }
      req.onerror = reject
    })
  } catch (err) {
    console.warn('Failed to get vault documents:', err)
    return []
  }
}

export async function deleteVaultDocument(id) {
  try {
    const db = await openDB()
    const tx = db.transaction(DOCS_STORE, 'readwrite')
    const store = tx.objectStore(DOCS_STORE)

    return new Promise((resolve, reject) => {
      const req = store.delete(id)
      req.onsuccess = resolve
      req.onerror = reject
    })
  } catch (err) {
    console.warn('Failed to delete vault document:', err)
  }
}
