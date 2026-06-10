;(() => {
  const PIN_HASH_KEY = 'gymapp_pin_hash'
  const PIN_SALT_KEY = 'gymapp_pin_salt'

  window.auth = {
    async hashPin(pin) {
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const encoder = new TextEncoder()
      const keyMaterial = await crypto.subtle.importKey(
        'raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']
      )
      const hash = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial, 256
      )
      return { salt, hash: new Uint8Array(hash) }
    },

    async verifyPin(pin, storedSalt, storedHash) {
      const encoder = new TextEncoder()
      const keyMaterial = await crypto.subtle.importKey(
        'raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']
      )
      const hash = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: storedSalt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial, 256
      )
      const hashArr = new Uint8Array(hash)
      if (hashArr.length !== storedHash.length) return false
      for (let i = 0; i < hashArr.length; i++) {
        if (hashArr[i] !== storedHash[i]) return false
      }
      return true
    },

    isLocked() {
      return !!localStorage.getItem(PIN_HASH_KEY)
    },

    async setPin(pin) {
      const { salt, hash } = await this.hashPin(pin)
      localStorage.setItem(PIN_HASH_KEY, JSON.stringify(Array.from(hash)))
      localStorage.setItem(PIN_SALT_KEY, JSON.stringify(Array.from(salt)))
    },

    async checkPin(pin) {
      const storedHash = new Uint8Array(JSON.parse(localStorage.getItem(PIN_HASH_KEY)))
      const storedSalt = new Uint8Array(JSON.parse(localStorage.getItem(PIN_SALT_KEY)))
      return this.verifyPin(pin, storedSalt, storedHash)
    },

    clearPin() {
      localStorage.removeItem(PIN_HASH_KEY)
      localStorage.removeItem(PIN_SALT_KEY)
    },

    /* --- Encryption for Gist data --- */

    async _deriveKey(pin, salt) {
      const encoder = new TextEncoder()
      const keyMaterial = await crypto.subtle.importKey(
        'raw', encoder.encode(pin), 'PBKDF2', false, ['deriveKey']
      )
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false, ['encrypt', 'decrypt']
      )
    },

    async encrypt(data, pin) {
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const key = await this._deriveKey(pin, salt)
      const encoder = new TextEncoder()
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(JSON.stringify(data))
      )
      const combined = new Uint8Array(1 + salt.length + iv.length + encrypted.byteLength)
      combined[0] = 1 // version
      combined.set(salt, 1)
      combined.set(iv, 1 + salt.length)
      combined.set(new Uint8Array(encrypted), 1 + salt.length + iv.length)
      return btoa(String.fromCharCode(...combined))
    },

    async decrypt(encoded, pin) {
      try {
        const combined = new Uint8Array(atob(encoded).split('').map(c => c.charCodeAt(0)))
        const version = combined[0]
        if (version !== 1) throw new Error('Unknown version')
        const salt = combined.slice(1, 17)
        const iv = combined.slice(17, 29)
        const data = combined.slice(29)
        const key = await this._deriveKey(pin, salt)
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv }, key, data
        )
        const decoder = new TextDecoder()
        return JSON.parse(decoder.decode(decrypted))
      } catch {
        return null
      }
    }
  }
})()
