;(() => {
  async function sha256(message) {
    const encoder = new TextEncoder()
    const data = encoder.encode(message)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return new Uint8Array(hash)
  }

  function toHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
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

  async function deriveKey(pin, salt) {
    const enc = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey'])
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  }

  window.auth = {
    async hashPin(pin) {
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const enc = new TextEncoder()
      const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
      const hash = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
        keyMaterial, 256
      )
      const combined = new Uint8Array(16 + 32)
      combined.set(salt)
      combined.set(new Uint8Array(hash), 16)
      return bytesToBase64(combined)
    },

    async verifyPin(pin, stored) {
      try {
        const combined = base64ToBytes(stored)
        const salt = combined.slice(0, 16)
        const storedHash = combined.slice(16)
        const enc = new TextEncoder()
        const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
        const hash = await crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
          keyMaterial, 256
        )
        const computed = new Uint8Array(hash)
        if (storedHash.length !== computed.length) return false
        for (let i = 0; i < storedHash.length; i++) {
          if (storedHash[i] !== computed[i]) return false
        }
        return true
      } catch { return false }
    },

    async encryptSecret(plaintext, pin, purpose) {
      try {
        const salt = crypto.getRandomValues(new Uint8Array(16))
        const iv = crypto.getRandomValues(new Uint8Array(12))
        const key = await deriveKey(pin + purpose, salt)
        const enc = new TextEncoder()
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext))
        const combined = new Uint8Array(1 + salt.length + iv.length + encrypted.byteLength)
        combined[0] = 1
        combined.set(salt, 1)
        combined.set(iv, 1 + salt.length)
        combined.set(new Uint8Array(encrypted), 1 + salt.length + iv.length)
        return bytesToBase64(combined)
      } catch (e) { console.error('EncryptSecret error:', e); return null }
    },

    async decryptSecret(encoded, pin, purpose) {
      try {
        const combined = base64ToBytes(encoded)
        if (combined[0] !== 1) return null
        const salt = combined.slice(1, 17)
        const iv = combined.slice(17, 29)
        const data = combined.slice(29)
        const key = await deriveKey(pin + purpose, salt)
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
        return new TextDecoder().decode(decrypted)
      } catch { return null }
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
