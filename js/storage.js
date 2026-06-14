;(() => {
  const DB_NAME = 'gymtrainer'
  const STORE_NAME = 'data'

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onerror = () => reject(req.error)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME)
        }
      }
      req.onsuccess = () => resolve(req.result)
    })
  }

  window.store = {
    async get(key) {
      const db = await openDB()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const req = tx.objectStore(STORE_NAME).get(key)
        req.onsuccess = () => { db.close(); resolve(req.result) }
        req.onerror = () => { db.close(); reject(req.error) }
      })
    },
    async set(key, value) {
      const db = await openDB()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const req = tx.objectStore(STORE_NAME).put(value, key)
        req.onsuccess = () => { db.close(); resolve() }
        req.onerror = () => { db.close(); reject(req.error) }
      })
    },
    async del(key) {
      const db = await openDB()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const req = tx.objectStore(STORE_NAME).delete(key)
        req.onsuccess = () => { db.close(); resolve() }
        req.onerror = () => { db.close(); reject(req.error) }
      })
    },
    async keys() {
      const db = await openDB()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const req = tx.objectStore(STORE_NAME).getAllKeys()
        req.onsuccess = () => { db.close(); resolve(Array.from(req.result)) }
        req.onerror = () => { db.close(); reject(req.error) }
      })
    }
  }
})()
