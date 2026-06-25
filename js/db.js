;(() => {
  window.db = (function() {
    const TOKEN_KEY = 'gymapp_github_token'
    const TOKEN_ENC_KEY = 'gymapp_github_token_enc'
    const PIN_KEY = 'gymapp_pin'
    const AI_PREFIX = 'gymapp_ai_'
    const PIN_HASH_KEY = 'gymapp_pin_hash'
    const USERS_KEY = 'gymapp_users'
    const CURRENT_USER_KEY = 'gymapp_current_user'
    const DATA_PREFIX = 'gymapp_data_'
    const GIST_ID = 'a2e0cc16311b5589246aa6215e5a7250'

    let data = null
    let _username = ''
    let _pin = ''
    let _token = ''
    let _persistTimer = null
    let _gistTimer = null
    let _pushingGist = false
    let _syncingGist = false
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
        activePlan: null,
        planHistory: {},
      }

      const encrypted = await auth.encrypt(userBlob, pin)
      await store.set(userKey(u), encrypted)
      users.push(u)
      saveUsers(users)

      _username = u
      _pin = pin
      data = userBlob
      localStorage.setItem(CURRENT_USER_KEY, u)
      sessionStorage.setItem(PIN_KEY, pin)
      const pinHash = await auth.hashPin(pin)
      localStorage.setItem(PIN_HASH_KEY, pinHash)

      const encToken = localStorage.getItem(TOKEN_ENC_KEY)
      if (encToken) {
        const decToken = await auth.decryptSecret(encToken, pin, 'github_token')
        if (decToken) { _token = decToken }
      }

      return { ok: true }
    }

    async function loginUser(username, pin) {
      const u = username.toLowerCase()
      let encrypted = await store.get(userKey(u))
      if (!encrypted) {
        encrypted = localStorage.getItem(userKey(u))
        if (encrypted) await store.set(userKey(u), encrypted)
      }
      let decrypted = encrypted ? await auth.decrypt(encrypted, pin) : null

      // Try backup encrypted key if primary is corrupted
      if (!decrypted) {
        try {
          let bak = await store.get(userKey(u) + '_bak')
          if (!bak) {
            bak = localStorage.getItem(userKey(u) + '_bak')
            if (bak) await store.set(userKey(u) + '_bak', bak)
          }
          if (bak) {
            decrypted = await auth.decrypt(bak, pin)
            if (decrypted) {
              await store.set(userKey(u), bak)
              await store.del(userKey(u) + '_bak')
            }
          }
        } catch {}
      }

      // Fallback: try Gist if no local data (migration from old system)
      if (!decrypted && _token) {
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
                  await store.set(userKey(u), encrypted)
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
          await store.set(userKey(u), encrypted)
          decrypted = userBlob
          const users = await getUsers()
          if (!users.includes(u)) { users.push(u); saveUsers(users) }
        }
      }

      if (!decrypted) {
        if (_token) {
          try {
            const res = await fetch(getGistUrl(), { headers: { 'Authorization': `Bearer ${_token}` } })
            if (res.status === 401) return { ok: false, error: 'Token de GitHub inválido o expirado — ve a Ajustes' }
          } catch {}
        }
        // Fallback: try raw backup (saved by beforeunload)
        try {
          let raw = await store.get(userKey(u) + '_raw')
          if (!raw) {
            raw = localStorage.getItem(userKey(u) + '_raw')
            if (raw) await store.set(userKey(u) + '_raw', raw)
          }
          if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed && parsed.profile) {
              decrypted = parsed
              await store.del(userKey(u) + '_raw')
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
      sessionStorage.setItem(PIN_KEY, pin)
      const pinHash = await auth.hashPin(pin)
      localStorage.setItem(PIN_HASH_KEY, pinHash)

      const encToken = localStorage.getItem(TOKEN_ENC_KEY)
      if (encToken) {
        const decToken = await auth.decryptSecret(encToken, pin, 'github_token')
        if (decToken) { _token = decToken }
      }

      // Pull latest from Gist — merge with local so nothing is lost
      if (_token) {
        try {
          const gist = await fetchGist()
          if (gist) {
            const raw = gist.files['gymapp_data.json']?.content
            if (raw) {
              const gdata = JSON.parse(raw)
              if (gdata[u]) {
                const fresh = await auth.decrypt(gdata[u], pin)
                if (fresh) {
                  const local = data || {}
                  data = fresh
                  // Local wins for editable fields
                  if (local.progress) data.progress = local.progress
                  if (local.weights) data.weights = local.weights
                  if (local.trainingDates) data.trainingDates = local.trainingDates
                  if (local.history) data.history = local.history
                  if (local.notes) data.notes = local.notes
                  if (local.measures) data.measures = local.measures
                  if (local.photos) data.photos = local.photos
                  if (local.exerciseMods) data.exerciseMods = local.exerciseMods
                  if (local.customDays) data.customDays = local.customDays
                  if (local.customExercises) data.customExercises = local.customExercises
                  if (local.workoutNotes) data.workoutNotes = local.workoutNotes
                  if (local.timer) data.timer = local.timer
                  if (local.activePlan) data.activePlan = local.activePlan
                  if (local.planHistory) data.planHistory = local.planHistory
                  const encrypted = await auth.encrypt(data, _pin)
                  await store.set(userKey(u), encrypted)
                  if (gdata.users) { localStorage.setItem(USERS_KEY, JSON.stringify(gdata.users)) }
                }
              }
            }
          }
        } catch {}
      }

      migrateWeights()
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
          await store.set(userKey(_username), encrypted)
          await pushToGist()
        } catch (e) { console.warn('Logout save error:', e) }
      }
      data = null
      _username = ''
      _pin = ''
      _token = ''
      localStorage.removeItem(CURRENT_USER_KEY)
      sessionStorage.removeItem(PIN_KEY)
      localStorage.removeItem(PIN_HASH_KEY)
    }

    function isLoggedIn() { return !!data }
    function getUsername() { return _username }
    function getProfile() { return data ? data.profile : null }
    async function setNotes(n) { if (data) { data.notes = n; archiveCurrentWeek(); schedulePersist() } }
    async function setFoodDiary(fd) { if (data) { data.foodDiary = fd; schedulePersist() } }
    async function setPhotos(p) { if (data) { data.photos = p; schedulePersist() } }
    async function setMeasurements(m) { if (data) { data.measurements = m; schedulePersist() } }
    async function setTimer(t) { if (data) { data.workoutTimer = t; schedulePersist() } }
    async function setProgress(p) { if (data) { data.progress = p; notify(); archiveCurrentWeek(); schedulePersist() } }
    async function setWeights(w) { if (data) { data.weights = w; archiveCurrentWeek(); schedulePersist() } }
    async function setTrainingDates(d) { if (data) { data.trainingDates = d; schedulePersist() } }
    async function setProfile(p) { if (data) { data.profile = p; schedulePersist() } }
    async function setCustomWorkout(cw) { if (data) { data.customWorkout = cw; schedulePersist() } }
    async function setCustomExercises(ce) { if (data) { data.customExercises = ce; schedulePersist() } }
    async function setCustomDays(d) { if (data) { data.customDays = d; schedulePersist() } }
    async function setExerciseMods(m) { if (data) { data.exerciseMods = m; schedulePersist() } }
    async function setCalories(c) { if (data) { data.caloriesBurned = c; schedulePersist() } }
    async function setWorkoutNotes(n) { if (data) { data.workoutNotes = n; schedulePersist() } }

    async function resetAllTrainingData() {
      if (!data) return
      data.progress = {}
      data.weights = {}
      data.history = {}
      data.photos = {}
      data.measurements = []
      data.notes = {}
      data.customExercises = {}
      data.customWorkout = {}
      data.customDays = []
      data.exerciseMods = {}
      data.caloriesBurned = {}
      data.workoutNotes = {}
      data.trainingDates = []
      notify()
      await persistNow()
      if (_token) await pushToGist()
    }

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
        await store.set(userKey(_username), encrypted)
        setTimeout(hideSyncIndicator, 300)
      } catch (e) { console.warn('Persist error:', e); hideSyncIndicator() }
    }

    function schedulePersist() {
      if (_persistTimer) clearTimeout(_persistTimer)
      showSyncIndicator()
      _persistTimer = setTimeout(async () => {
        _persistTimer = null
        await persistNow()
        if (_token) scheduleGistSync()
      }, 400)
    }

    /* --- Gist auto-sync (debounced, secondary) --- */

    function scheduleGistSync() {
      if (_gistTimer) clearTimeout(_gistTimer)
      _gistTimer = setTimeout(() => {
        _gistTimer = null
        if (_token && _username && _pin && data) pushToGist().catch(() => {})
      }, 5000)
    }

    let _autoPullTimer = null
    let _visHandler = null
    let _autoSyncBusy = false

    function startAutoSync() {
      stopAutoSync()
      // Pull from Gist every 30s to get changes from other devices
      async function doAutoPull() {
        if (!_token || !_username || !_pin || !data || _autoSyncBusy) {
          _autoPullTimer = setTimeout(doAutoPull, 30000)
          return
        }
        _autoSyncBusy = true
        try {
          const old = JSON.stringify(data)
          const ok = await syncFromGist()
          if (ok && JSON.stringify(data) !== old) notify()
        } finally { _autoSyncBusy = false }
        _autoPullTimer = setTimeout(doAutoPull, 30000)
      }
      _autoPullTimer = setTimeout(doAutoPull, 30000)
      // Also pull when tab becomes visible
      _visHandler = () => {
        if (!document.hidden && _token && _username && _pin && data && !_autoSyncBusy) {
          syncFromGist().then(c => { if (c) notify() }).catch(() => {})
        }
      }
      document.addEventListener('visibilitychange', _visHandler)
    }

    function stopAutoSync() {
      if (_autoPullTimer) { clearTimeout(_autoPullTimer); _autoPullTimer = null }
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
          auth.encrypt(data, _pin).then(async en => {
            await store.set(key, en)
            try { localStorage.setItem(key, en) } catch {}
          }).catch(e => console.warn('Beforeunload persist error:', e))
        }
      })
    }

    /* --- Gist sync (manual backup/restore) --- */

    async function fetchGist() {
      if (!_token) return null
      const res = await fetch(getGistUrl(), {
        headers: { 'Authorization': `Bearer ${_token}` }
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      return await res.json()
    }

    async function updateGist(content) {
      if (!_token) return
      await fetch(getGistUrl(), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${_token}`,
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
        // Merge: local wins for editable fields so active progress is never lost
        const local = data || {}
        data = decrypted
        data.progress = local.progress || data.progress
        data.weights = local.weights || data.weights
        data.trainingDates = local.trainingDates || data.trainingDates
        data.history = local.history || data.history
        data.notes = local.notes || data.notes
        data.measures = local.measures || data.measures
        data.photos = local.photos || data.photos
        data.exerciseMods = local.exerciseMods || data.exerciseMods
        data.customDays = local.customDays || data.customDays
        data.customExercises = local.customExercises || data.customExercises
        data.workoutNotes = local.workoutNotes || data.workoutNotes
        data.timer = local.timer || data.timer
        data.activePlan = local.activePlan || data.activePlan
        data.planHistory = local.planHistory || data.planHistory
        const encrypted = await auth.encrypt(data, _pin)
        await store.set(userKey(_username), encrypted)
        return true
      } catch { return false }
    }

    async function pushToGist() {
      if (!_username || !_pin || !data || !_token) return false
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
      const monday = new Date(now.getFullYear(), now.getMonth(), diff)
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

    /* --- Immutable getters --- */

    function getProgress() { return data ? JSON.parse(JSON.stringify(data.progress)) : {} }
    function getWeights() { return data ? JSON.parse(JSON.stringify(data.weights)) : {} }

    function migrateKey(key, customEx, customWk) {
      if (!/^\d/.test(key)) return null
      var parts = key.split('-')
      var dayIdx = parseInt(parts[0], 10)
      if (isNaN(dayIdx)) return null
      if (parts[1] === 'custom') {
        var ci = parseInt(parts.slice(2).join('-'), 10)
        if (!isNaN(ci)) {
          var cex = (customEx[dayIdx] || [])[ci]
          if (cex && cex.machine) return cex.machine
        }
        return null
      }
      var exIdx = parseInt(parts.slice(1).join('-'), 10)
      if (!isNaN(exIdx)) {
        var swp = customWk[key]
        if (swp && swp.machine) return swp.machine
        if (window.workoutPlan && window.workoutPlan.days && window.workoutPlan.days[dayIdx] && window.workoutPlan.days[dayIdx].exercises[exIdx]) {
          return window.workoutPlan.days[dayIdx].exercises[exIdx].machine
        }
      }
      return null
    }

    function migrateWeights() {
      if (!data) return
      var customEx = data.customExercises || {}
      var customWk = data.customWorkout || {}
      var changed = false

      if (data.weights) {
        var w = data.weights
        var keys = Object.keys(w)
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i]
          var newKey = migrateKey(key, customEx, customWk)
          if (newKey && newKey !== key) {
            w[newKey] = w[key]
            delete w[key]
            changed = true
          }
        }
      }

      if (data.history) {
        var hkeys = Object.keys(data.history)
        for (var hi = 0; hi < hkeys.length; hi++) {
          var hw = data.history[hkeys[hi]].weights
          if (!hw) continue
          var hk = Object.keys(hw)
          for (var hj = 0; hj < hk.length; hj++) {
            var oldKey = hk[hj]
            var newKey = migrateKey(oldKey, customEx, customWk)
            if (newKey && newKey !== oldKey) {
              hw[newKey] = hw[oldKey]
              delete hw[oldKey]
              changed = true
            }
          }
        }
      }

      if (changed) {
        schedulePersist()
      }
    }
    function getTrainingDates() { return data ? JSON.parse(JSON.stringify(data.trainingDates)) : [] }
    function getHistory() { return data ? JSON.parse(JSON.stringify(data.history)) : {} }
    function getHistoryWeek(weekId) { return data ? (data.history[weekId] ? JSON.parse(JSON.stringify(data.history[weekId])) : null) : null }
    function getNotes() { return data ? JSON.parse(JSON.stringify(data.notes || {})) : {} }
    function getFoodDiary() { return data ? JSON.parse(JSON.stringify(data.foodDiary || {})) : {} }
    function getPhotos() { return data ? JSON.parse(JSON.stringify(data.photos || {})) : {} }
    function getMeasurements() { return data ? JSON.parse(JSON.stringify(data.measurements || [])) : [] }
    function getCustomDays() { return data ? JSON.parse(JSON.stringify(data.customDays || [])) : [] }
    function getCustomWorkout() { return data ? JSON.parse(JSON.stringify(data.customWorkout || {})) : {} }
    function getCustomExercises() { return data ? JSON.parse(JSON.stringify(data.customExercises || {})) : {} }
    function getCalories() { return data ? JSON.parse(JSON.stringify(data.caloriesBurned || {})) : {} }
    function getWorkoutNotes() { return data ? JSON.parse(JSON.stringify(data.workoutNotes || {})) : {} }
    function getExerciseMods() { return data ? JSON.parse(JSON.stringify(data.exerciseMods || {})) : {} }
    function getTimer() { return data ? (data.workoutTimer ? JSON.parse(JSON.stringify(data.workoutTimer)) : null) : null }

    function onUpdate(cb) { listeners.push(cb) }
    function notify() { listeners.forEach(cb => cb(data ? data.progress : {}, data ? data.weights : {})) }

    /* --- Encrypted secrets (AI keys, etc.) --- */
    const AI_ENC_KEYS = ['key', 'provider', 'url', 'model']

    async function loadAiKeys() {
      if (!_pin) return {}
      const result = {}
      for (const k of AI_ENC_KEYS) {
        const enc = localStorage.getItem(AI_PREFIX + k + '_enc')
        if (enc) {
          const dec = await auth.decryptSecret(enc, _pin, 'ai_' + k)
          if (dec) { result[k] = dec; continue }
        }
        const legacy = localStorage.getItem(AI_PREFIX + k)
        if (legacy) {
          result[k] = legacy
          const enc = await auth.encryptSecret(legacy, _pin, 'ai_' + k)
          if (enc) { localStorage.setItem(AI_PREFIX + k + '_enc', enc); localStorage.removeItem(AI_PREFIX + k) }
        }
      }
      return result
    }

    async function saveAiKey(k, value) {
      if (_pin) {
        const enc = await auth.encryptSecret(value, _pin, 'ai_' + k)
        if (enc) { localStorage.setItem(AI_PREFIX + k + '_enc', enc); return }
      }
      localStorage.setItem(AI_PREFIX + k, value)
    }

    function getToken() { return _token }
    async function setToken(t) {
      _token = t
      if (_pin) {
        const enc = await auth.encryptSecret(t, _pin, 'github_token')
        if (enc) { localStorage.setItem(TOKEN_ENC_KEY, enc); return }
      }
      localStorage.setItem(TOKEN_KEY, t)
    }
    function hasToken() { return !!_token }
    async function validateToken(t) {
      const saved = _token
      _token = t
      try {
        const res = await fetch(getGistUrl(), { headers: { 'Authorization': `Bearer ${t}` } })
        return res.status !== 401
      } catch { return false }
      finally { _token = saved }
    }

    function getActivePlan() {
      return data ? data.activePlan || null : null
    }

    function setActivePlan(plan) {
      if (!data) return
      data.activePlan = plan
      schedulePersist()
    }

    function getPlanHistory() {
      return data ? (data.planHistory || {}) : {}
    }

    function setPlanHistory(ph) {
      if (!data) return
      data.planHistory = ph
      schedulePersist()
    }

    function generateNewPlan() {
      if (!data || !data.profile || !data.profile.dynamicPlansEnabled) return null
      var prevPlan = data.activePlan
      if (prevPlan) {
        var ph = data.planHistory || {}
        ph[prevPlan.generatedForWeek] = prevPlan
        data.planHistory = ph
        var keys = Object.keys(ph).sort()
        while (keys.length > 52) {
          delete ph[keys.shift()]
        }
      }
      var newPlan = window.planner.generateWeeklyPlan(data.profile, data.progress || {}, data.weights || {}, data.history || {})
      if (newPlan) {
        data.activePlan = newPlan
        this.setPlanHistory(data.planHistory)
      }
      return newPlan
    }

    return {
      getUsers, registerUser, loginUser, logoutUser, isLoggedIn, getUsername, getProfile, setProfile,
      getProgress, getWeights, setProgress, setWeights, resetAllTrainingData,
      getTrainingDates, setTrainingDates, getCustomWorkout, setCustomWorkout,
      getCustomExercises, setCustomExercises,
      getCustomDays, setCustomDays,
      getExerciseMods, setExerciseMods,
      getCalories, setCalories,
      getNotes, setNotes,
      getFoodDiary, setFoodDiary,
      getWorkoutNotes, setWorkoutNotes,
      getPhotos, setPhotos,
      getMeasurements, setMeasurements,
      getTimer, setTimer,
      getHistory, getHistoryWeek, getYearStats,
      checkWeekReset, archiveCurrentWeek, restoreLastWeek,
      onUpdate, syncFromGist, pushToGist,
      startAutoSync, stopAutoSync,
      getToken, setToken, hasToken, validateToken,
      loadAiKeys, saveAiKey,
      getActivePlan, setActivePlan, getPlanHistory, setPlanHistory, generateNewPlan,
      get connected() { return hasToken() },
      get gistId() { return GIST_ID },
    }
  })()
})()
