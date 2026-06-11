;(() => {
  window.db = (function() {
    const TOKEN_KEY = 'gymapp_github_token'
    const PIN_KEY = 'gymapp_pin'
    const GIST_ID = 'a2e0cc16311b5589246aa6215e5a7250'
    const CURRENT_USER_KEY = 'gymapp_current_user'

    let data = null
    let _username = ''
    let _pin = ''
    let _lastGistData = null
    let token = localStorage.getItem(TOKEN_KEY) || ''
    let listeners = []

    function getGistUrl() { return `https://api.github.com/gists/${GIST_ID}` }

    async function fetchGist() {
      if (!token) return null
      const res = await fetch(getGistUrl(), {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      return await res.json()
    }

    async function updateGist(content) {
      if (!token) return
      await fetch(getGistUrl(), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: { 'gymapp_data.json': { content: JSON.stringify(content) } }
        }),
      })
    }

    async function getGistData() {
      try {
        const gist = await fetchGist()
        if (!gist) return null
        const raw = gist.files['gymapp_data.json']?.content
        return raw ? JSON.parse(raw) : null
      } catch {
        return null
      }
    }

    function isLegacyFormat(gistData) {
      return gistData && !gistData.users && gistData.files && gistData.files['progress.json.enc']
    }

    async function migrateLegacy(username, pin) {
      try {
        const gist = await fetchGist()
        if (!gist) return false
        const content = gist.files['progress.json.enc']?.content
        if (!content) return false
        const decrypted = await auth.decrypt(content, pin)
        if (!decrypted) return false

        const newData = {
          users: [username.toLowerCase()],
          [username.toLowerCase()]: await auth.encrypt({
            profile: createDefaultProfile(),
            progress: decrypted.progress || {},
            weights: decrypted.weights || {},
            trainingDates: JSON.parse(localStorage.getItem('gymapp_dates') || '[]'),
            history: decrypted.history || {},
          }, pin)
        }
        await updateGist(newData)
        localStorage.removeItem('gymapp_progress')
        localStorage.removeItem('gymapp_weights')
        localStorage.removeItem('gymapp_history')
        localStorage.removeItem('gymapp_dates')
        localStorage.removeItem('gymapp_pin_hash')
        localStorage.removeItem('gymapp_pin_salt')
        return true
      } catch (e) {
        console.warn('Migration error:', e)
        return false
      }
    }

    async function getUsers() {
      const gdata = await getGistData()
      if (!gdata) return []
      return gdata.users || []
    }

    async function registerUser(username, pin, profile) {
      const gdata = (await getGistData()) || { users: [] }
      const u = username.toLowerCase()
      if (gdata.users && gdata.users.includes(u)) return { ok: false, error: 'Usuario ya existe' }

      const userBlob = {
        profile: profile || createDefaultProfile(),
        progress: {},
        weights: {},
        trainingDates: [],
        history: {},
      }

      gdata.users = gdata.users || []
      gdata.users.push(u)
      gdata[u] = await auth.encrypt(userBlob, pin)
      await updateGist(gdata)

      // Set internal state directly — skip loginUser call
      _username = u
      _pin = pin
      data = userBlob
      _lastGistData = gdata
      localStorage.setItem(CURRENT_USER_KEY, u)
      localStorage.setItem(PIN_KEY, pin)

      return { ok: true }
    }

    async function loginUser(username, pin) {
      const gist = await fetchGist()
      if (!gist) return { ok: false, error: 'Revisa tu token de GitHub' }

      if (isLegacyFormat(gist)) {
        const migrated = await migrateLegacy(username, pin)
        if (!migrated) return { ok: false, error: 'PIN incorrecto o error de migración' }
        return await loginUser(username, pin)
      }

      const raw = gist.files['gymapp_data.json']?.content
      if (!raw) return { ok: false, error: 'No hay datos en la nube' }
      let gdata
      try { gdata = JSON.parse(raw) } catch { return { ok: false, error: 'Error al leer datos' } }

      const u = username.toLowerCase()
      if (!gdata.users || !gdata.users.includes(u)) return { ok: false, error: 'Usuario no registrado' }

      const encrypted = gdata[u]
      if (!encrypted) return { ok: false, error: 'No hay datos para este usuario' }

      const decrypted = await auth.decrypt(encrypted, pin)
      if (!decrypted) return { ok: false, error: 'PIN incorrecto' }

      _username = u
      _pin = pin
      data = decrypted
      _lastGistData = gdata
      localStorage.setItem(CURRENT_USER_KEY, u)
      localStorage.setItem(PIN_KEY, pin)

      return { ok: true, data: decrypted }
    }

    function logoutUser() {
      data = null
      _username = ''
      _pin = ''
      localStorage.removeItem(CURRENT_USER_KEY)
      localStorage.removeItem(PIN_KEY)
      // clear local app data
      localStorage.removeItem('gymapp_week')
      localStorage.removeItem('gymapp_progress')
      localStorage.removeItem('gymapp_weights')
      localStorage.removeItem('gymapp_history')
      localStorage.removeItem('gymapp_dates')
    }

    function isLoggedIn() { return !!data }

    function getUsername() { return _username }

    function getProfile() { return data ? data.profile : null }

    async function setProfile(profile) {
      if (!data) return
      data.profile = profile
      await persist()
    }

    function getProgress() { return data ? data.progress : {} }
    function getWeights() { return data ? data.weights : {} }
    function getTrainingDates() { return data ? data.trainingDates : [] }
    function getHistory() { return data ? data.history : {} }

    function getHistoryWeek(weekId) {
      return data ? (data.history[weekId] || null) : null
    }

    async function setProgress(progress) {
      if (!data) return
      data.progress = progress
      await persist()
    }

    async function setWeights(weights) {
      if (!data) return
      data.weights = weights
      await persist()
    }

    async function setTrainingDates(dates) {
      if (!data) return
      data.trainingDates = dates
      await persist()
    }

    async function persist() {
      if (!_username || !_pin || !data) return
      const gdata = _lastGistData || (await getGistData()) || { users: [] }
      if (!gdata.users || !gdata.users.includes(_username)) {
        gdata.users = gdata.users || []
        if (!gdata.users.includes(_username)) gdata.users.push(_username)
      }
      gdata[_username] = await auth.encrypt(data, _pin)
      _lastGistData = gdata
      await updateGist(gdata)
      notify()
    }

    async function syncFromGist() {
      if (!_username || !_pin) return false
      const gdata = await getGistData()
      if (!gdata) return false
      const encrypted = gdata[_username]
      if (!encrypted) return false
      const decrypted = await auth.decrypt(encrypted, _pin)
      if (!decrypted) return false
      data = decrypted
      notify()
      return true
    }

    /* --- Local helpers (same as before, but operate on data) --- */

    function getWeekId() {
      const now = new Date()
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(now.setDate(diff))
      return monday.toISOString().split('T')[0]
    }

    function getISOWeekString(date) {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
      const dayNum = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
      const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
      return d.getUTCFullYear() + '-W' + String(weekNum).padStart(2, '0')
    }

    function archiveCurrentWeek() {
      if (!data) return
      const weekId = getISOWeekString(new Date())
      const p = data.progress || {}
      const w = data.weights || {}
      const hasData = Object.keys(p).length > 0 || Object.keys(w).length > 0
      if (!hasData) return
      const hist = data.history || {}
      const existing = hist[weekId]
      if (existing) {
        for (const dk of Object.keys(p)) {
          const day = parseInt(dk); if (isNaN(day)) continue
          existing.progress[day] = existing.progress[day] || {}
          for (const ek of Object.keys(p[dk])) {
            const ex = parseInt(ek); if (isNaN(ex)) continue
            if ((p[dk][ek] || 0) > (existing.progress[day][ex] || 0)) {
              existing.progress[day][ex] = p[dk][ek]
            }
          }
        }
        for (const k of Object.keys(w)) {
          if (!existing.weights[k] && w[k]) existing.weights[k] = w[k]
        }
      } else {
        hist[weekId] = {
          progress: JSON.parse(JSON.stringify(p)),
          weights: JSON.parse(JSON.stringify(w))
        }
      }
      data.history = hist
      persist()
    }

    function checkWeekReset() {
      if (!data) return false
      const currentWeek = getWeekId()
      const storedWeek = localStorage.getItem('gymapp_week')
      if (!storedWeek) {
        localStorage.setItem('gymapp_week', currentWeek)
        return false
      }
      if (storedWeek !== currentWeek) {
        const p = data.progress || {}
        const hadProgress = Object.keys(p).length > 0
        if (hadProgress) {
          const oldWeekId = getISOWeekString(new Date(storedWeek))
          const hist = data.history || {}
          const existing = hist[oldWeekId]
          if (existing) {
            for (const dk of Object.keys(p)) {
              const day = parseInt(dk); if (isNaN(day)) continue
              existing.progress[day] = existing.progress[day] || {}
              for (const ek of Object.keys(p[dk])) {
                const ex = parseInt(ek); if (isNaN(ex)) continue
                if ((p[dk][ek] || 0) > (existing.progress[day][ex] || 0)) {
                  existing.progress[day][ex] = p[dk][ek]
                }
              }
            }
            for (const k of Object.keys(data.weights || {})) {
              if (!existing.weights[k] && data.weights[k]) existing.weights[k] = data.weights[k]
            }
          } else {
            hist[oldWeekId] = {
              progress: JSON.parse(JSON.stringify(p)),
              weights: JSON.parse(JSON.stringify(data.weights || {}))
            }
          }
          data.history = hist
          data.progress = {}
          data.weights = {}
          persist()
        }
        localStorage.setItem('gymapp_week', currentWeek)
        return hadProgress
      }
      return false
    }

    function getYearStats(year) {
      if (!data || !data.history) return { year, weeks: 0, totalSets: 0, totalDays: 0, setsPerWeek: 0 }
      const prefix = year + '-W'
      const weeks = Object.keys(data.history).filter(k => k.startsWith(prefix)).sort()
      let totalSets = 0, totalDays = 0

      weeks.forEach(wk => {
        const h = data.history[wk]
        if (!h || !h.progress) return
        for (const dk of Object.keys(h.progress)) {
          const day = h.progress[dk]
          let daySets = 0
          for (const ek of Object.keys(day)) daySets += day[ek] || 0
          if (daySets > 0) totalDays++
          totalSets += daySets
        }
      })

      return { year, weeks: weeks.length, totalSets, totalDays, setsPerWeek: weeks.length ? Math.round(totalSets / weeks.length) : 0 }
    }

    function onUpdate(cb) { listeners.push(cb) }
    function notify() { listeners.forEach(cb => cb(data ? data.progress : {}, data ? data.weights : {})) }

    function getToken() { return token }
    function setToken(t) { token = t; localStorage.setItem(TOKEN_KEY, t) }
    function hasToken() { return !!token }

    return {
      getUsers, registerUser, loginUser, logoutUser, isLoggedIn, getUsername, getProfile, setProfile,
      getProgress, getWeights, setProgress, setWeights,
      getTrainingDates, setTrainingDates,
      getHistory, getHistoryWeek, getYearStats,
      checkWeekReset, archiveCurrentWeek,
      onUpdate, syncFromGist,
      getToken, setToken, hasToken,
      get connected() { return hasToken() },
      get gistId() { return GIST_ID },
    }
  })()
})()
