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

      // Try backup encrypted key if primary is corrupted
      if (!decrypted) {
        try {
          const bak = localStorage.getItem(userKey(u) + '_bak')
          if (bak) {
            decrypted = await auth.decrypt(bak, pin)
            if (decrypted) {
              localStorage.setItem(userKey(u), bak)
              localStorage.removeItem(userKey(u) + '_bak')
            }
          }
        } catch {}
      }

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

      if (!decrypted) {
        if (token) {
          try {
            const res = await fetch(getGistUrl(), { headers: { 'Authorization': `Bearer ${token}` } })
            if (res.status === 401) return { ok: false, error: 'Token de GitHub inválido o expirado — ve a Ajustes' }
          } catch {}
        }
        // Fallback: try raw backup (saved by beforeunload)
        try {
          const raw = localStorage.getItem(userKey(u) + '_raw')
          if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed && parsed.profile) {
              decrypted = parsed
              localStorage.removeItem(userKey(u) + '_raw')
            }
          }
        } catch {}
      }
      if (!decrypted) {
        return { ok: false, error: 'Usuario o PIN incorrecto' }
      }

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

      setupBeforeUnload()
      startAutoSync()
      return { ok: true, data: decrypted }
    }

    async function logoutUser() {
      stopAutoSync()
      if (_persistTimer) { clearTimeout(_persistTimer); _persistTimer = null }
      if (_gistTimer) { clearTimeout(_gistTimer); _gistTimer = null }
      // Save locally + push to Gist before clearing
      if (data && _username && _pin) {
        try {
          const encrypted = await auth.encrypt(data, _pin)
          localStorage.setItem(userKey(_username), encrypted)
          await pushToGist()
        } catch (e) { console.warn('Logout save error:', e) }
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
    function getCalories() { return data ? (data.caloriesBurned || {}) : {} }
    function getNotes() { return data ? (data.notes || {}) : {} }
    async function setNotes(n) { if (data) { data.notes = n; archiveCurrentWeek(); schedulePersist() } }

    /* --- Photos --- */
    function getPhotos() { return data ? (data.photos || {}) : {} }
    async function setPhotos(p) { if (data) { data.photos = p; schedulePersist() } }

    /* --- Body Measurements --- */
    function getMeasurements() { return data ? (data.measurements || []) : [] }
    async function setMeasurements(m) { if (data) { data.measurements = m; schedulePersist() } }

    /* --- Workout Timer --- */
    function getTimer() { return data ? (data.workoutTimer || null) : null }
    async function setTimer(t) { if (data) { data.workoutTimer = t; schedulePersist() } }

    /* --- Supersets --- */
    function getSupersets() { return data ? (data.supersets || {}) : {} }
    async function setSupersets(s) { if (data) { data.supersets = s; schedulePersist() } }

    /* --- Persist (localStorage) --- */

    async function setProgress(p) { if (data) { data.progress = p; notify(); archiveCurrentWeek(); schedulePersist() } }
    async function setWeights(w) { if (data) { data.weights = w; archiveCurrentWeek(); schedulePersist() } }
    async function setTrainingDates(d) { if (data) { data.trainingDates = d; schedulePersist() } }
    async function setProfile(p) { if (data) { data.profile = p; schedulePersist() } }
    async function setCustomWorkout(cw) { if (data) { data.customWorkout = cw; schedulePersist() } }
    async function setCustomExercises(ce) { if (data) { data.customExercises = ce; schedulePersist() } }
    async function setCalories(c) { if (data) { data.caloriesBurned = c; schedulePersist() } }

    function showSyncIndicator() {
      const el = document.getElementById('syncIndicator')
      if (el) el.classList.add('show')
    }
    function hideSyncIndicator() {
      const el = document.getElementById('syncIndicator')
      if (el) el.classList.remove('show')
    }

    async function persistNow() {
      if (!_username || !_pin || !data) return
      showSyncIndicator()
      try {
        const encrypted = await auth.encrypt(data, _pin)
        localStorage.setItem(userKey(_username), encrypted)
        setTimeout(hideSyncIndicator, 300)
      } catch (e) { console.warn('Persist error:', e); hideSyncIndicator() }
    }

    function schedulePersist() {
      if (_persistTimer) clearTimeout(_persistTimer)
      showSyncIndicator()
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

    let _autoPullTimer = null
    let _visHandler = null

    function startAutoSync() {
      stopAutoSync()
      // Pull from Gist every 30s to get changes from other devices
      _autoPullTimer = setInterval(async () => {
        if (token && _username && _pin && data) {
          const old = JSON.stringify(data)
          const ok = await syncFromGist()
          if (ok && JSON.stringify(data) !== old) notify()
        }
      }, 30000)
      // Also pull when tab becomes visible
      _visHandler = () => {
        if (!document.hidden && token && _username && _pin && data) {
          syncFromGist().then(c => { if (c) notify() }).catch(() => {})
        }
      }
      document.addEventListener('visibilitychange', _visHandler)
    }

    function stopAutoSync() {
      if (_autoPullTimer) { clearInterval(_autoPullTimer); _autoPullTimer = null }
      if (_visHandler) { document.removeEventListener('visibilitychange', _visHandler); _visHandler = null }
    }

    /* Flush pending writes on page close */
    function setupBeforeUnload() {
      window.addEventListener('beforeunload', (e) => {
        if (_persistTimer) { clearTimeout(_persistTimer); _persistTimer = null }
        if (_gistTimer) { clearTimeout(_gistTimer); _gistTimer = null }
        if (data && _username && _pin) {
          const key = userKey(_username)
          // Preserve last valid encrypted data before we write
          try {
            const cur = localStorage.getItem(key)
            if (cur && cur.length > 50) localStorage.setItem(key + '_bak', cur)
          } catch {}
          // Synchronous raw backup (always works)
          try {
            localStorage.setItem(key + '_raw', JSON.stringify(data))
          } catch (e) { console.warn('Beforeunload raw backup error:', e) }
          // Async encrypted save (best-effort, modern browsers wait for this)
          auth.encrypt(data, _pin).then(en => {
            localStorage.setItem(key, en)
          }).catch(e => console.warn('Beforeunload persist error:', e))
        }
      })
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
      hist[weekId] = {
        progress: JSON.parse(JSON.stringify(p)),
        weights: JSON.parse(JSON.stringify(w))
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
        const w = data.weights || {}
        const hadProgress = Object.keys(p).length > 0 || Object.keys(w).length > 0
        if (hadProgress) {
          const oldWeekId = getISOWeekString(new Date(storedWeek))
          const hist = data.history || {}
          const existing = hist[oldWeekId]
          if (existing) {
            if (!existing.progress) existing.progress = {}
            if (!existing.weights) existing.weights = {}
            for (const dk of Object.keys(p)) {
              const day = parseInt(dk, 10); if (isNaN(day)) continue
              existing.progress[day] = existing.progress[day] || {}
              for (const ek of Object.keys(p[dk])) {
                const ex = parseInt(ek, 10); if (isNaN(ex)) continue
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

    function restoreLastWeek() {
      if (!data) { console.warn('restoreLastWeek: no data'); return false }
      const hist = data.history || {}
      const weeks = Object.keys(hist).filter(k => /^\d{4}-W\d{2}$/.test(k)).sort()
      for (let i = weeks.length - 1; i >= 0; i--) {
        const h = hist[weeks[i]]
        if (h && h.progress && Object.keys(h.progress).length > 0) {
          data.progress = JSON.parse(JSON.stringify(h.progress))
          if (h.weights) data.weights = JSON.parse(JSON.stringify(h.weights))
          schedulePersist()
          notify()
          return true
        }
      }
      for (const k of Object.keys(hist)) {
        const h = hist[k]
        if (h && h.progress && Object.keys(h.progress).length > 0) {
          data.progress = JSON.parse(JSON.stringify(h.progress))
          if (h.weights) data.weights = JSON.parse(JSON.stringify(h.weights))
          schedulePersist()
          notify()
          return true
        }
      }
      console.warn('restoreLastWeek: no suitable history entry found')
      return false
    }

    function getYearStats(year, excludeWeek) {
      if (!data || !data.history) return { year, weeks: 0, totalSets: 0, totalDays: 0, setsPerWeek: 0 }
      const prefix = year + '-W'
      const weeks = Object.keys(data.history).filter(k => k.startsWith(prefix) && k !== excludeWeek).sort()
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

    function onUpdate(cb) { listeners = [cb] }
    function notify() { listeners.forEach(cb => cb(data ? data.progress : {}, data ? data.weights : {})) }

    function getToken() { return token }
    function setToken(t) { token = t; localStorage.setItem(TOKEN_KEY, t) }
    function hasToken() { return !!token }
    async function validateToken(t) {
      const saved = token
      token = t
      try {
        const res = await fetch(getGistUrl(), { headers: { 'Authorization': `Bearer ${t}` } })
        return res.status !== 401
      } catch { return false }
      finally { token = saved }
    }

    return {
      getUsers, registerUser, loginUser, logoutUser, isLoggedIn, getUsername, getProfile, setProfile,
      getProgress, getWeights, setProgress, setWeights,
      getTrainingDates, setTrainingDates, getCustomWorkout, setCustomWorkout,
      getCustomExercises, setCustomExercises,
      getCalories, setCalories,
      getNotes, setNotes,
      getPhotos, setPhotos,
      getMeasurements, setMeasurements,
      getTimer, setTimer,
      getSupersets, setSupersets,
      getHistory, getHistoryWeek, getYearStats,
      checkWeekReset, archiveCurrentWeek, restoreLastWeek,
      onUpdate, syncFromGist, pushToGist,
      startAutoSync, stopAutoSync,
      getToken, setToken, hasToken, validateToken,
      get connected() { return hasToken() },
      get gistId() { return GIST_ID },
    }
  })()
})()
