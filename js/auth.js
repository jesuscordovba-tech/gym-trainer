;(() => {
  const PIN_HASH_KEY = 'gymapp_pin_hash'
  const PIN_SALT_KEY = 'gymapp_pin_salt'

  async function sha256(message) {
    const encoder = new TextEncoder()
    const data = encoder.encode(message)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return new Uint8Array(hash)
  }

  function toHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  function fromHex(hex) {
    const bytes = []
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substring(i, i + 2), 16))
    }
    return new Uint8Array(bytes)
  }

  function base64ToBytes(b64) {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  }

  function bytesToBase64(bytes) {
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin)
  }

  window.auth = {
    async setPin(pin) {
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const hash = await sha256(pin + toHex(salt))
      localStorage.setItem(PIN_HASH_KEY, toHex(hash))
      localStorage.setItem(PIN_SALT_KEY, toHex(salt))
    },

    async checkPin(pin) {
      try {
        const storedHash = fromHex(localStorage.getItem(PIN_HASH_KEY))
        const storedSalt = fromHex(localStorage.getItem(PIN_SALT_KEY))
        const hash = await sha256(pin + toHex(storedSalt))
        if (hash.length !== storedHash.length) return false
        for (let i = 0; i < hash.length; i++) {
          if (hash[i] !== storedHash[i]) return false
        }
        return true
      } catch { return false }
    },

    isLocked() {
      return !!localStorage.getItem(PIN_HASH_KEY)
    },

    clearPin() {
      localStorage.removeItem(PIN_HASH_KEY)
      localStorage.removeItem(PIN_SALT_KEY)
    },

    async encrypt(data, pin) {
      try {
        const salt = crypto.getRandomValues(new Uint8Array(16))
        const iv = crypto.getRandomValues(new Uint8Array(12))
        const keyHash = await sha256(pin + toHex(salt))

        const key = await crypto.subtle.importKey(
          'raw', keyHash, { name: 'AES-GCM' }, false, ['encrypt']
        )
        const encoder = new TextEncoder()
        const encrypted = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          key,
          encoder.encode(JSON.stringify(data))
        )

        const combined = new Uint8Array(1 + salt.length + iv.length + encrypted.byteLength)
        combined[0] = 1
        combined.set(salt, 1)
        combined.set(iv, 1 + salt.length)
        combined.set(new Uint8Array(encrypted), 1 + salt.length + iv.length)
        return bytesToBase64(combined)
      } catch (e) {
        console.error('Encrypt error:', e)
        return null
      }
    },

    async decrypt(encoded, pin) {
      try {
        const combined = base64ToBytes(encoded)
        if (combined[0] !== 1) return null
        const salt = combined.slice(1, 17)
        const iv = combined.slice(17, 29)
        const data = combined.slice(29)
        const keyHash = await sha256(pin + toHex(salt))

        const key = await crypto.subtle.importKey(
          'raw', keyHash, { name: 'AES-GCM' }, false, ['decrypt']
        )
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
        const decoder = new TextDecoder()
        return JSON.parse(decoder.decode(decrypted))
      } catch (e) {
        console.error('Decrypt error:', e)
        return null
      }
    }
  }
})()
