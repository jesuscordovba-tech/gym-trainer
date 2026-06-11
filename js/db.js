;(() => {
  window.db = (function() {
    const DAYS_KEY = 'gymapp_progress'
    const WEIGHTS_KEY = 'gymapp_weights'
    const TOKEN_KEY = 'gymapp_github_token'
    const WEEK_KEY = 'gymapp_week'
    const DATES_KEY = 'gymapp_dates'
    const GIST_ID = 'a2e0cc16311b5589246aa6215e5a7250'

    let progress = JSON.parse(localStorage.getItem(DAYS_KEY) || '{}')
    let weights = JSON.parse(localStorage.getItem(WEIGHTS_KEY) || '{}')
    let trainingDates = JSON.parse(localStorage.getItem(DATES_KEY) || '[]')
    let listeners = []
    let _pin = ''

    function setPin(pin) { _pin = pin }

    function saveLocal() {
      localStorage.setItem(DAYS_KEY, JSON.stringify(progress))
      localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights))
      localStorage.setItem(DATES_KEY, JSON.stringify(trainingDates))
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

    function checkWeekReset() {
      const currentWeek = getWeekId()
      const storedWeek = localStorage.getItem(WEEK_KEY)
      const hadProgress = Object.keys(progress).length > 0
      if (!storedWeek || storedWeek !== currentWeek) {
        progress = {}
        localStorage.setItem(WEEK_KEY, currentWeek)
        saveLocal()
        return hadProgress
      }
      return false
    }

    function recordTrainingDate() {
      const today = new Date().toISOString().split('T')[0]
      if (!trainingDates.includes(today)) {
        trainingDates.push(today)
        saveLocal()
        syncToGist()
      }
    }

    function getTrainingDates() { return trainingDates }
    function getTrainingDayCount() { return trainingDates.length }

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
          const encrypted = await auth.encrypt({ progress, weights, trainingDates }, _pin)
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
        const remoteD = decrypted.trainingDates || []
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

        for (const d of remoteD) {
          if (!trainingDates.includes(d)) { trainingDates.push(d); changed = true }
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
      recordTrainingDate, getTrainingDates, getTrainingDayCount,
      getToken, setToken, hasToken,
      pullFromGist, syncToGist,
      get connected() { return hasToken() },
      get gistId() { return GIST_ID },
    }
  })()
})()
