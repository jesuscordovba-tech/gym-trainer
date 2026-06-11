;(() => {
  window.db = (function() {
    const DAYS_KEY = 'gymapp_progress'
    const WEIGHTS_KEY = 'gymapp_weights'
    const TOKEN_KEY = 'gymapp_github_token'
    const WEEK_KEY = 'gymapp_week'
    const HISTORY_KEY = 'gymapp_history'
    const GIST_ID = 'a2e0cc16311b5589246aa6215e5a7250'

    let progress = JSON.parse(localStorage.getItem(DAYS_KEY) || '{}')
    let weights = JSON.parse(localStorage.getItem(WEIGHTS_KEY) || '{}')
    let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}')
    let listeners = []
    let _pin = ''

    function setPin(pin) { _pin = pin }

    function saveLocal() {
      localStorage.setItem(DAYS_KEY, JSON.stringify(progress))
      localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights))
    }

    function getProgress() { return progress }
    function getWeights() { return weights }

    function setProgress(newProgress) {
      progress = newProgress
      saveLocal()
      syncToGist()
    }

    function setWeights(newWeights) {
      weights = newWeights
      saveLocal()
      syncToGist()
    }

    function resetAll() {
      progress = {}
      weights = {}
      history = {}
      localStorage.setItem(HISTORY_KEY, '{}')
      saveLocal()
      syncToGist()
    }

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

    function archiveWeek(weekId) {
      const hasData = Object.keys(progress).length > 0 || Object.keys(weights).length > 0
      if (!hasData) return
      const existing = history[weekId]
      if (existing) {
        for (const dk of Object.keys(progress)) {
          const day = parseInt(dk); if (isNaN(day)) continue
          existing.progress[day] = existing.progress[day] || {}
          for (const ek of Object.keys(progress[dk])) {
            const ex = parseInt(ek); if (isNaN(ex)) continue
            if ((progress[dk][ek] || 0) > (existing.progress[day][ex] || 0)) {
              existing.progress[day][ex] = progress[dk][ek]
            }
          }
        }
        for (const k of Object.keys(weights)) {
          if (!existing.weights[k] && weights[k]) existing.weights[k] = weights[k]
        }
      } else {
        history[weekId] = { progress: JSON.parse(JSON.stringify(progress)), weights: JSON.parse(JSON.stringify(weights)) }
      }
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    }

    function checkWeekReset() {
      const currentWeek = getWeekId()
      const storedWeek = localStorage.getItem(WEEK_KEY)
      if (!storedWeek) {
        localStorage.setItem(WEEK_KEY, currentWeek)
        return false
      }
      if (storedWeek !== currentWeek) {
        const hadProgress = Object.keys(progress).length > 0
        if (hadProgress) {
          const oldWeekId = getISOWeekString(new Date(storedWeek))
          archiveWeek(oldWeekId)
        }
        progress = {}
        localStorage.setItem(WEEK_KEY, currentWeek)
        saveLocal()
        return hadProgress
      }
      return false
    }

    function archiveCurrentWeek() {
      const now = new Date()
      const weekId = getISOWeekString(now)
      archiveWeek(weekId)
    }

    function getHistory() { return history }
    function getHistoryWeek(weekId) { return history[weekId] || null }

    function getYearStats(year) {
      const prefix = year + '-W'
      const weeks = Object.keys(history).filter(k => k.startsWith(prefix)).sort()
      let totalSets = 0, totalDays = 0, daySetCount = {}

      weeks.forEach(wk => {
        const h = history[wk]
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
    function notify() { listeners.forEach(cb => cb(progress, weights)) }

    function getToken() { return localStorage.getItem(TOKEN_KEY) || '' }
    function setToken(t) { localStorage.setItem(TOKEN_KEY, t) }
    function hasToken() { return !!getToken() }

    /* --- GitHub Gist Sync (encrypted) --- */

    async function syncToGist() {
      const token = getToken()
      if (!token || !_pin) return

      clearTimeout(syncToGist._timer)
      syncToGist._timer = setTimeout(async () => {
        try {
          const encrypted = await auth.encrypt({ progress, weights, history }, _pin)
          await fetch(`https://api.github.com/gists/${GIST_ID}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              files: { 'progress.json.enc': { content: encrypted } }
            }),
          })
        } catch (err) { console.warn('Gist sync error:', err) }
      }, 500)
    }

    async function pullFromGist() {
      const token = getToken()
      if (!token || !_pin) return false

      try {
        const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const data = await res.json()
        const content = data.files['progress.json.enc']?.content
        if (!content) return false

        const decrypted = await auth.decrypt(content, _pin)
        if (!decrypted) return false

        const remoteP = decrypted.progress || {}
        const remoteW = decrypted.weights || {}
        const remoteH = decrypted.history || {}
        let changed = false

        for (const dk of Object.keys(remoteP)) {
          const day = parseInt(dk)
          if (isNaN(day)) continue
          const rd = remoteP[dk]
          const ld = progress[day] || {}
          let dc = false
          for (const ek of Object.keys(rd)) {
            const ex = parseInt(ek)
            if (isNaN(ex)) continue
            if ((rd[ek] || 0) > (ld[ex] || 0)) {
              ld[ex] = rd[ek]; dc = true
            }
          }
          if (dc) { progress[day] = ld; changed = true }
        }

        for (const k of Object.keys(remoteW)) {
          if (!weights[k] && remoteW[k]) {
            weights[k] = remoteW[k]; changed = true
          }
        }

        for (const wk of Object.keys(remoteH)) {
          if (!history[wk]) { history[wk] = remoteH[wk]; changed = true }
        }

        if (changed) { saveLocal(); notify() }
        return true
      } catch (err) {
        console.warn('Gist pull error:', err)
        return false
      }
    }

    return {
      getProgress, getWeights, setProgress, setWeights,
      resetAll, onUpdate, setPin, checkWeekReset,
      archiveCurrentWeek, getHistory, getHistoryWeek, getYearStats,
      getToken, setToken, hasToken,
      pullFromGist, syncToGist,
      get connected() { return hasToken() },
      get gistId() { return GIST_ID },
    }
  })()
})()
