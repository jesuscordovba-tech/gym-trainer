;(() => {
  const DB_NAME = 'gymtrainer'
  const STORE_NAME = 'data'
  let _db = null
  let _dbOpen = null

  async function getDB() {
    if (_db) return _db
    if (_dbOpen) return _dbOpen
    _dbOpen = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onerror = () => reject(req.error)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME)
        }
      }
      req.onsuccess = () => {
        _db = req.result
        _db.onversionchange = () => { _db.close(); _db = null }
        _dbOpen = null
        resolve(_db)
      }
    })
    return _dbOpen
  }

  async function tx(mode, cb) {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE_NAME, mode)
      t.oncomplete = () => resolve()
      t.onerror = () => reject(t.error)
      cb(t.objectStore(STORE_NAME), resolve)
    })
  }

  window.store = {
    async get(key) {
      const db = await getDB()
      return new Promise((resolve, reject) => {
        const t = db.transaction(STORE_NAME, 'readonly')
        const req = t.objectStore(STORE_NAME).get(key)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
    },
    async set(key, value) {
      const db = await getDB()
      return new Promise((resolve, reject) => {
        const t = db.transaction(STORE_NAME, 'readwrite')
        const req = t.objectStore(STORE_NAME).put(value, key)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
    },
    async del(key) {
      const db = await getDB()
      return new Promise((resolve, reject) => {
        const t = db.transaction(STORE_NAME, 'readwrite')
        const req = t.objectStore(STORE_NAME).delete(key)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
    },
    async keys() {
      const db = await getDB()
      return new Promise((resolve, reject) => {
        const t = db.transaction(STORE_NAME, 'readonly')
        const req = t.objectStore(STORE_NAME).getAllKeys()
        req.onsuccess = () => resolve(Array.from(req.result))
        req.onerror = () => reject(req.error)
      })
    }
  }
})()
