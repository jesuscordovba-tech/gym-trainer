;(() => {
  window.db = (function() {
    const TOKEN_KEY = 'gymapp_github_token'
    const PIN_KEY = 'gymapp_pin'
    const USERS_KEY = 'gymapp_users'
    const CURRENT_USER_KEY = 'gymapp_current_user'
    const DATA_PREFIX = 'gymapp_data_'
    const GIST_ID = 'a2e0cc16311b5589246aa6215e5a7250'

    let data = null
    let _username = ''
    let _pin = ''
    let _persistTimer = null
    let _gistTimer = null
    let _pushingGist = false
    let token = localStorage.getItem(TOKEN_KEY) || ''
    let listeners = []

    function userKey(u) { return DATA_PREFIX + u.toLowerCase() }
    function getGistUrl() { return `https://api.github.com/gists/${GIST_ID}` }

    /* --- Users --- */

    async function getUsers() {
      const raw = localStorage.getItem(USERS_KEY)
      return raw ? JSON.parse(raw) : []
    }

    async function saveUsers(users) {
      localStorage.setItem(USERS_KEY, JSON.stringify(users))
    }

    /* --- Auth --- */

    async function registerUser(username, pin, profile) {
      const u = username.toLowerCase()
      const users = await getUsers()
      if (users.includes(u)) return { ok: false, error: 'Usuario ya existe' }

      const userBlob = {
        profile: profile || createDefaultProfile(),
        progress: {},
        weights: {},
        trainingDates: [],
        history: {},
        customWorkout: {},
      }

      const encrypted = await auth.encrypt(userBlob, pin)
      localStorage.setItem(userKey(u), encrypted)
      users.push(u)
      saveUsers(users)

      _username = u
      _pin = pin
      data = userBlob
      localStorage.setItem(CURRENT_USER_KEY, u)
      localStorage.setItem(PIN_KEY, pin)

      return { ok: true }
    }

    async function loginUser(username, pin) {
      const u = username.toLowerCase()
      let encrypted = localStorage.getItem(userKey(u))
      let decrypted = encrypted ? await auth.decrypt(encrypted, pin) : null

      // Fallback: try Gist if no local data (migration from old system)
      if (!decrypted && token) {
        try {
          const gist = await fetchGist()
          if (gist) {
            const raw = gist.files['gymapp_data.json']?.content
            if (raw) {
              const gdata = JSON.parse(raw)
              if (gdata.users && gdata.users.includes(u) && gdata[u]) {
                encrypted = gdata[u]
                decrypted = await auth.decrypt(encrypted, pin)
                if (decrypted) {
                  localStorage.setItem(userKey(u), encrypted)
                  // Ensure user appears in local users list
                  const users = await getUsers()
                  if (!users.includes(u)) { users.push(u); saveUsers(users) }
                }
              }
            }
          }
        } catch {}
      }

      // Legacy single-user migration (old localStorage keys)
      if (!decrypted) {
        const oldProgress = localStorage.getItem('gymapp_progress')
        if (oldProgress && pin === localStorage.getItem('gymapp_pin_hash')) {
          const userBlob = {
            profile: createDefaultProfile(),
            progress: JSON.parse(oldProgress || '{}'),
            weights: JSON.parse(localStorage.getItem('gymapp_weights') || '{}'),
            trainingDates: JSON.parse(localStorage.getItem('gymapp_dates') || '[]'),
            history: JSON.parse(localStorage.getItem('gymapp_history') || '{}'),
            customWorkout: {},
          }
          encrypted = await auth.encrypt(userBlob, pin)
          localStorage.setItem(userKey(u), encrypted)
          decrypted = userBlob
          const users = await getUsers()
          if (!users.includes(u)) { users.push(u); saveUsers(users) }
        }
      }

      if (!decrypted) return { ok: false, error: 'Usuario o PIN incorrecto' }

      _username = u
      _pin = pin
      data = decrypted
      localStorage.setItem(CURRENT_USER_KEY, u)
      localStorage.setItem(PIN_KEY, pin)

      // Pull latest from Gist — ensures cross-device data is synced
      if (token) {
        try {
          const gist = await fetchGist()
          if (gist) {
            const raw = gist.files['gymapp_data.json']?.content
            if (raw) {
              const gdata = JSON.parse(raw)
              if (gdata[u]) {
                const fresh = await auth.decrypt(gdata[u], pin)
                if (fresh) {
                  data = fresh
                  localStorage.setItem(userKey(u), gdata[u])
                  // Merge local users from Gist
                  if (gdata.users) { localStorage.setItem(USERS_KEY, JSON.stringify(gdata.users)) }
                }
              }
            }
          }
        } catch {}
      }

      return { ok: true, data: decrypted }
    }

    async function logoutUser() {
      if (_persistTimer) { clearTimeout(_persistTimer); _persistTimer = null }
      if (_gistTimer) { clearTimeout(_gistTimer); _gistTimer = null }
      // Save locally + push to Gist before clearing
      if (data && _username && _pin) {
        try {
          const encrypted = await auth.encrypt(data, _pin)
          localStorage.setItem(userKey(_username), encrypted)
          await pushToGist()
        } catch {}
      }
      data = null
      _username = ''
      _pin = ''
      localStorage.removeItem(CURRENT_USER_KEY)
      localStorage.removeItem(PIN_KEY)
      localStorage.removeItem('gymapp_pin')
    }

    function isLoggedIn() { return !!data }
    function getUsername() { return _username }
    function getProfile() { return data ? data.profile : null }
    function getProgress() { return data ? data.progress : {} }
    function getWeights() { return data ? data.weights : {} }
    function getTrainingDates() { return data ? data.trainingDates : [] }
    function getHistory() { return data ? data.history : {} }
    function getHistoryWeek(weekId) { return data ? (data.history[weekId] || null) : null }
    function getCustomWorkout() { return data ? (data.customWorkout || {}) : {} }
    function getCustomExercises() { return data ? (data.customExercises || {}) : {} }

    /* --- Persist (localStorage) --- */

    async function setProgress(p) { if (data) { data.progress = p; notify(); schedulePersist() } }
    async function setWeights(w) { if (data) { data.weights = w; schedulePersist() } }
    async function setTrainingDates(d) { if (data) { data.trainingDates = d; schedulePersist() } }
    async function setProfile(p) { if (data) { data.profile = p; schedulePersist() } }
    async function setCustomWorkout(cw) { if (data) { data.customWorkout = cw; schedulePersist() } }
    async function setCustomExercises(ce) { if (data) { data.customExercises = ce; schedulePersist() } }

    async function persistNow() {
      if (!_username || !_pin || !data) return
      try {
        const encrypted = await auth.encrypt(data, _pin)
        localStorage.setItem(userKey(_username), encrypted)
      } catch (e) { console.warn('Persist error:', e) }
    }

    function schedulePersist() {
      if (_persistTimer) clearTimeout(_persistTimer)
      _persistTimer = setTimeout(async () => {
        _persistTimer = null
        await persistNow()
        if (token) scheduleGistSync()
      }, 400)
    }

    /* --- Gist auto-sync (debounced, secondary) --- */

    function scheduleGistSync() {
      if (_gistTimer) clearTimeout(_gistTimer)
      _gistTimer = setTimeout(() => {
        _gistTimer = null
        if (token && _username && _pin && data) pushToGist().catch(() => {})
      }, 5000)
    }

    /* --- Gist sync (manual backup/restore) --- */

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

    async function syncFromGist() {
      if (!_username || !_pin) return false
      try {
        const gist = await fetchGist()
        if (!gist) return false
        const gdata = JSON.parse(gist.files['gymapp_data.json']?.content || 'null')
        if (!gdata || !gdata[_username]) return false
        const decrypted = await auth.decrypt(gdata[_username], _pin)
        if (!decrypted) return false
        data = decrypted
        const encrypted = await auth.encrypt(data, _pin)
        localStorage.setItem(userKey(_username), encrypted)
        notify()
        return true
      } catch { return false }
    }

    async function pushToGist() {
      if (!_username || !_pin || !data || !token) return false
      if (_pushingGist) return true  // already in-flight
      _pushingGist = true
      try {
        const encrypted = await auth.encrypt(data, _pin)
        const gist = await fetchGist()
        if (!gist) return false  // don't overwrite Gist if we can't read it
        let gdata = { users: [] }
        try { gdata = JSON.parse(gist.files['gymapp_data.json']?.content || '{}') } catch {}
        if (!gdata.users) gdata.users = []
        if (!gdata.users.includes(_username)) gdata.users.push(_username)
        gdata[_username] = encrypted
        await updateGist(gdata)
        return true
      } catch { return false }
      finally { _pushingGist = false }
    }

    /* --- Local helpers --- */

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
      if (hist[weekId]) {
        let changed = false
        for (const dk of Object.keys(p)) {
          const day = parseInt(dk); if (isNaN(day)) continue
          if (!hist[weekId].progress[day]) { hist[weekId].progress[day] = {}; changed = true }
          for (const ek of Object.keys(p[dk])) {
            const ex = parseInt(ek); if (isNaN(ex)) continue
            if ((p[dk][ek] || 0) > (hist[weekId].progress[day][ex] || 0)) {
              hist[weekId].progress[day][ex] = p[dk][ek]; changed = true
            }
          }
        }
        for (const k of Object.keys(w)) {
          if (!hist[weekId].weights[k] && w[k]) { hist[weekId].weights[k] = w[k]; changed = true }
        }
        if (!changed) return
      } else {
        hist[weekId] = {
          progress: JSON.parse(JSON.stringify(p)),
          weights: JSON.parse(JSON.stringify(w))
        }
      }
      data.history = hist
      schedulePersist()
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
                if ((p[dk][ek] || 0) > (existing.progress[day][ex] || 0)) existing.progress[day][ex] = p[dk][ek]
              }
            }
            for (const k of Object.keys(data.weights || {})) {
              if (!existing.weights[k] && data.weights[k]) existing.weights[k] = data.weights[k]
            }
          } else {
            hist[oldWeekId] = { progress: JSON.parse(JSON.stringify(p)), weights: JSON.parse(JSON.stringify(data.weights || {})) }
          }
          data.history = hist
          data.progress = {}
          data.weights = {}
          schedulePersist()
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
          const day = h.progress[dk]; let daySets = 0
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
      getTrainingDates, setTrainingDates, getCustomWorkout, setCustomWorkout,
      getCustomExercises, setCustomExercises,
      getHistory, getHistoryWeek, getYearStats,
      checkWeekReset, archiveCurrentWeek,
      onUpdate, syncFromGist, pushToGist,
      getToken, setToken, hasToken,
      get connected() { return hasToken() },
      get gistId() { return GIST_ID },
    }
  })()
})()
