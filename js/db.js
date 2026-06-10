;(() => {
  window.db = (function() {
    const DAYS_KEY = 'gymapp_progress'
    const WEIGHTS_KEY = 'gymapp_weights'

    let progress = JSON.parse(localStorage.getItem(DAYS_KEY) || '{}')
    let weights = JSON.parse(localStorage.getItem(WEIGHTS_KEY) || '{}')
    let firebaseApp = null
    let firestore = null
    let userId = null
    let unsubscribe = null
    let syncing = false
    let listeners = []

    function saveLocal() {
      localStorage.setItem(DAYS_KEY, JSON.stringify(progress))
      localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights))
    }

    function getProgress() { return progress }
    function getWeights() { return weights }

    function setProgress(newProgress) {
      progress = newProgress
      saveLocal()
      syncToCloud()
    }

    function setWeights(newWeights) {
      weights = newWeights
      saveLocal()
      syncToCloud()
    }

    function resetAll() {
      progress = {}
      weights = {}
      saveLocal()
      syncToCloud()
    }

    function onUpdate(cb) {
      listeners.push(cb)
    }

    function notify() {
      listeners.forEach(cb => cb(progress, weights))
    }

    /* --- Firebase --- */

    async function initFirebase(config) {
      if (!config || !config.apiKey) return

      try {
        firebaseApp = firebase.initializeApp(config, 'gymapp')
        firestore = firebase.firestore(firebaseApp)
        firestore.settings({ merge: true })

        const auth = firebase.auth(firebaseApp)
        const cred = await auth.signInAnonymously()
        userId = cred.user.uid

        /* Listen for remote changes */
        unsubscribe = firestore.collection('users').doc(userId)
          .onSnapshot(snap => {
            if (syncing) return
            if (!snap.exists) return
            const data = snap.data()
            if (!data) return

            const remoteProgress = data.progress || {}
            const remoteWeights = data.weights || {}

            /* Merge: remote wins if newer, but we keep local as base */
            let changed = false
            for (const dayKey of Object.keys(remoteProgress)) {
              const day = parseInt(dayKey)
              if (isNaN(day)) continue
              const remoteDay = remoteProgress[dayKey]
              const localDay = progress[day] || {}
              let dayChanged = false
              for (const exKey of Object.keys(remoteDay)) {
                const ex = parseInt(exKey)
                if (isNaN(ex)) continue
                const remoteVal = remoteDay[exKey]
                const localVal = localDay[ex] || 0
                if (remoteVal > localVal) {
                  localDay[ex] = remoteVal
                  dayChanged = true
                }
              }
              if (dayChanged) {
                progress[day] = localDay
                changed = true
              }
            }

            for (const key of Object.keys(remoteWeights)) {
              if (!weights[key] && remoteWeights[key]) {
                weights[key] = remoteWeights[key]
                changed = true
              }
            }

            if (changed) {
              saveLocal()
              notify()
            }
          }, err => {
            console.warn('Firestore sync error:', err)
          })

        /* Push local data to cloud */
        await syncToCloud()

        console.log('Firebase connected:', userId)
        return true
      } catch (err) {
        console.warn('Firebase init failed:', err)
        return false
      }
    }

    let syncTimeout = null
    function syncToCloud() {
      if (!firestore || !userId) return
      clearTimeout(syncTimeout)
      syncTimeout = setTimeout(async () => {
        syncing = true
        try {
          await firestore.collection('users').doc(userId).set({
            progress: progress,
            weights: weights,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
          }, { merge: true })
        } catch (err) {
          console.warn('Firestore write error:', err)
        }
        syncing = false
      }, 500)
    }

    return {
      getProgress,
      getWeights,
      setProgress,
      setWeights,
      resetAll,
      onUpdate,
      initFirebase,
      get userId() { return userId },
      get connected() { return !!userId },
    }
  })()
})()
