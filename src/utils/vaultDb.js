/**
 * Offline IndexedDB Local Scans Vault
 * Safely persists large scanned document images & metadata locally on the device.
 * No data ever leaves the device.
 */

const DB_NAME = 'KamalScanVault'
const DB_VERSION = 1
const STORE_NAME = 'scanned_pages'

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveVaultQueue(queue) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    // Clear previous and replace with current session queue
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
