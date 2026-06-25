;(() => {
  /* CSS variable reader for canvas charts */
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  }

  let currentDay = 0
  let _calMonthOffset = 0
  let _guidedMode = false
  let _guidedNextEx = null
  let timerInterval = null
  let audioCtx = null
  let _focusTrapEl = null

  function trapFocus(container) {
    const focusable = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    if (!focusable.length) return
    const first = focusable[0], last = focusable[focusable.length - 1]
    const handler = e => {
      if (e.key !== 'Tab') return
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    container.addEventListener('keydown', handler)
    _focusTrapEl = { container, handler }
    first.focus()
  }

  function releaseFocusTrap() {
    if (_focusTrapEl) {
      _focusTrapEl.container.removeEventListener('keydown', _focusTrapEl.handler)
      _focusTrapEl = null
    }
  }
  const LS_PREFIX = 'gymapp_ai_'
  let aiProvider = localStorage.getItem(LS_PREFIX + 'provider') || 'gemini'
  let aiKey = ''
  let aiUrl = localStorage.getItem(LS_PREFIX + 'url') || 'https://api.groq.com/openai/v1'
  let aiModel = localStorage.getItem(LS_PREFIX + 'model') || 'llama-3.3-70b-versatile'

  const DAY_LABELS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

  function getPlanDays() {
    const plan = db.getActivePlan()
    return plan?.days || workoutPlan.days
  }

  function getISOWeek(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const dayNum = date.getUTCDay() || 7
    date.setUTCDate(date.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7)
  }

  function formatDate(d) {
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  /* === LOGIN / REGISTER SCREEN === */
  async function initLoginScreen() {
    const screen = document.getElementById('lockScreen')
    const box = screen.querySelector('.lock-box')
    let currentPin = ''
    let mode = 'login'
    let currentUsername = localStorage.getItem('gymapp_current_user') || ''

    function renderLock() {
      const users = db.listUsers ? db.listUsers() : []
      const userOptions = users.map(u =>
        `<option value="${esc(u)}" ${u === currentUsername ? 'selected' : ''}>${esc(u)}</option>`
      ).join('')

      box.innerHTML = `
<div class="lock-inner">
  <div class="lock-logo">
    <span class="material-symbols-outlined lock-icon">fitness_center</span>
    <h1 class="lock-title">GYM <span class="lock-title-accent">TRAINER</span></h1>
    <p class="lock-subtitle">${mode === 'register' ? 'CREA TU CUENTA' : 'INGRESA TU PIN DE ENTRENAMIENTO'}</p>
  </div>
  ${users.length > 1 || mode === 'register' ? `
  <select id="lockUsername" class="lock-user-select">
    ${mode === 'register' ? '<option value="">— Nuevo usuario —</option>' : ''}
    ${userOptions}
  </select>` : ''}
  <div class="pin-dots" id="pinDots">
    <div class="pin-dot${currentPin.length > 0 ? ' active' : ''}"></div>
    <div class="pin-dot${currentPin.length > 1 ? ' active' : ''}"></div>
    <div class="pin-dot${currentPin.length > 2 ? ' active' : ''}"></div>
    <div class="pin-dot${currentPin.length > 3 ? ' active' : ''}"></div>
  </div>
  <div class="lock-error" id="lockError" role="alert"></div>
  ${mode === 'register' ? `
  <div class="lock-register-fields">
    <input type="text" id="regUsername" class="lock-input" placeholder="Nombre de usuario" value="${esc(currentUsername)}" style="letter-spacing:0;font-size:1rem;-webkit-text-security:none;display:${mode === 'register' ? 'block' : 'none'};">
    <input type="password" id="regPin2" class="lock-input" placeholder="Confirmar PIN" maxlength="6" inputmode="numeric" pattern="[0-9]*" style="display:${mode === 'register' ? 'block' : 'none'};">
  </div>` : ''}
  <div class="numpad-grid">
    <button class="numpad-btn" data-n="1">1</button>
    <button class="numpad-btn" data-n="2">2</button>
    <button class="numpad-btn" data-n="3">3</button>
    <button class="numpad-btn" data-n="4">4</button>
    <button class="numpad-btn" data-n="5">5</button>
    <button class="numpad-btn" data-n="6">6</button>
    <button class="numpad-btn" data-n="7">7</button>
    <button class="numpad-btn" data-n="8">8</button>
    <button class="numpad-btn" data-n="9">9</button>
    <div></div>
    <button class="numpad-btn" data-n="0">0</button>
    <button class="numpad-btn numpad-back" id="numpadBack">
      <span class="material-symbols-outlined" style="font-size:1.5rem;">backspace</span>
    </button>
  </div>
  <button class="lock-btn" id="lockBtn">${mode === 'register' ? 'REGISTRARSE' : 'ENTRAR'}</button>
  <div class="lock-hint" id="loginHint"></div>
</div>`

      const hint = document.getElementById('loginHint')
      const btn = document.getElementById('lockBtn')
      if (mode === 'register') {
        hint.innerHTML = '¿Ya tienes cuenta? <button id="switchLoginBtn" class="lock-link">Inicia sesión</button>'
        document.getElementById('switchLoginBtn')?.addEventListener('click', () => { mode = 'login'; currentPin = ''; renderLock(); attachLockEvents() })
      } else {
        hint.innerHTML = '¿Primera vez? <button id="switchRegisterBtn" class="lock-link">Regístrate</button>'
        document.getElementById('switchRegisterBtn')?.addEventListener('click', () => { mode = 'register'; currentPin = ''; renderLock(); attachLockEvents() })
      }

      const userSelect = document.getElementById('lockUsername')
      if (userSelect) {
        userSelect.addEventListener('change', () => { currentUsername = userSelect.value })
      }
    }

    function attachLockEvents() {
      const pinDots = document.querySelectorAll('.pin-dot')
      const error = document.getElementById('lockError')

      document.querySelectorAll('.numpad-btn[data-n]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (currentPin.length < 4) {
            currentPin += btn.dataset.n
            updateDots()
          }
        })
      })

      document.getElementById('numpadBack')?.addEventListener('click', () => {
        if (currentPin.length > 0) {
          currentPin = currentPin.slice(0, -1)
          updateDots()
        }
      })

      function updateDots() {
        pinDots.forEach((dot, i) => {
          dot.classList.toggle('active', i < currentPin.length)
        })
      }

      function setError(msg) {
        error.textContent = msg
        if (msg) {
          const card = box.querySelector('.lock-inner')
          card?.classList.remove('shake')
          void card?.offsetWidth
          card?.classList.add('shake')
          pinDots.forEach(d => d.style.borderColor = 'rgba(255, 180, 171, 0.5)')
          setTimeout(() => pinDots.forEach(d => d.style.borderColor = ''), 500)
        }
      }

      document.getElementById('lockBtn').onclick = async () => {
        try {
          const pin = currentPin
          const username = mode === 'register'
            ? (document.getElementById('regUsername')?.value || '').trim().toLowerCase()
            : (document.getElementById('lockUsername')?.value || currentUsername || '')

          if (!username) { setError('Selecciona o ingresa un usuario'); return }
          if (!pin || pin.length < 4) { setError('PIN debe tener 4 dígitos'); return }

          const btn = document.getElementById('lockBtn')
          btn.disabled = true

          if (mode === 'register') {
            const pin2 = document.getElementById('regPin2')?.value || ''
            if (pin !== pin2) { setError('Los PIN no coinciden'); btn.disabled = false; return }
            btn.textContent = 'REGISTRANDO...'
            const r = await db.registerUser(username, pin, createDefaultProfile())
            if (r.ok) {
              currentUsername = username
              localStorage.setItem('gymapp_current_user', username)
              sessionStorage.setItem('gymapp_pin', pin)
              screen.classList.add('hidden')
              document.removeEventListener('keydown', lockKeyHandler)
              showToast('Usuario registrado correctamente')
              initApp()
              return
            }
            setError(r.error || 'Error')
            btn.disabled = false
            btn.textContent = 'REGISTRARSE'
          } else {
            btn.textContent = 'ENTRANDO...'
            const r = await db.loginUser(username, pin)
            if (r.ok) {
              currentUsername = username
              localStorage.setItem('gymapp_current_user', username)
              sessionStorage.setItem('gymapp_pin', pin)
              screen.classList.add('hidden')
              document.removeEventListener('keydown', lockKeyHandler)
              showToast('Bienvenido, ' + esc(username))
              initApp()
              return
            }
            if (r.error === 'Usuario no registrado') {
              setError('Usuario no existe. Regístrate.')
            } else {
              setError(r.error)
            }
            btn.disabled = false
            btn.textContent = 'ENTRAR'
          }
        } catch (e) {
          setError('Error: ' + (e.message || e))
          document.getElementById('lockBtn').disabled = false
        }
      }
    }

    window.addEventListener('error', function (ev) {
      const e = document.getElementById('lockError')
      if (e) e.textContent = 'Error: ' + (ev.message || 'desconocido')
    })
    window.addEventListener('unhandledrejection', function (ev) {
      const e = document.getElementById('lockError')
      if (e) e.textContent = 'Error: ' + (ev.reason?.message || ev.reason || 'desconocido')
    })

    let lockKeyHandler
    renderLock()
    attachLockEvents()

    document.addEventListener('keydown', lockKeyHandler = (e) => {
      const s = document.getElementById('lockScreen')
      if (s?.classList.contains('hidden')) return
      if (e.key >= '0' && e.key <= '9' && currentPin.length < 4) {
        currentPin += e.key
        const dots = document.querySelectorAll('.pin-dot')
        dots.forEach((dot, i) => dot.classList.toggle('active', i < currentPin.length))
      } else if (e.key === 'Backspace') {
        currentPin = currentPin.slice(0, -1)
        const dots = document.querySelectorAll('.pin-dot')
        dots.forEach((dot, i) => dot.classList.toggle('active', i < currentPin.length))
      } else if (e.key === 'Enter') {
        document.getElementById('lockBtn')?.click()
      }
    })

    // Auto-login
    const savedUser = localStorage.getItem('gymapp_current_user')
    const savedPin = sessionStorage.getItem('gymapp_pin')
    if (savedUser && savedPin) {
      const r = await db.loginUser(savedUser, savedPin)
      if (r.ok) {
        screen.classList.add('hidden')
        showToast('Bienvenido, ' + esc(savedUser))
        initApp()
        return
      }
    }
  }

  function showToast(msg) {
    const existing = document.querySelector('.week-toast')
    if (existing) existing.remove()
    const t = document.createElement('div')
    t.className = 'week-toast'
    t.textContent = msg
    t.setAttribute('role', 'status')
    t.setAttribute('aria-live', 'polite')
    document.body.appendChild(t)
    setTimeout(() => t.classList.add('show'), 10)
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300) }, 4000)
  }

  function getTrainingCount() {
    return db.getTrainingDates().length
  }

  function recordTrainingDay() {
    const today = new Date().toISOString().split('T')[0]
    const dates = db.getTrainingDates()
    if (!dates.includes(today)) {
      dates.push(today)
      db.setTrainingDates(dates)
    }
  }

  function initApp() {
    const wasReset = db.checkWeekReset()
    if (wasReset) { showToast('Nueva semana — progreso reiniciado') }

    const profile = db.getProfile()
    if (profile?.dynamicPlansEnabled) {
      const plan = db.getActivePlan()
      const today = new Date()
      const day = today.getDay()
      const diff = today.getDate() - day + (day === 0 ? -6 : 1)
      const currentWeek = new Date(today.getFullYear(), today.getMonth(), diff).toISOString().split('T')[0]
      if (!plan || plan.weekStart !== currentWeek) db.generateNewPlan()
    }
    db.archiveCurrentWeek()

    // Load encrypted AI keys
    db.loadAiKeys().then(keys => {
      if (keys.key) aiKey = keys.key
      if (keys.provider) aiProvider = keys.provider
      if (keys.url) aiUrl = keys.url
      if (keys.model) aiModel = keys.model
    })

    if (localStorage.getItem('gymapp_notif_enabled') === 'true' && Notification.permission !== 'granted') {
      Notification.requestPermission()
    }

    let totalSets = 0
    const progress = db.getProgress()
    for (const k in progress) { const d = progress[k]; if (d) for (const ek in d) totalSets += d[ek] || 0 }
    if (totalSets > 0) recordTrainingDay()

    // Auto-navigate to today's workout (Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=keep)
    const dayOfWeek = new Date().getDay()
    const dayOffset = parseInt(localStorage.getItem('gymapp_day_offset') || '0', 10)
    if (dayOfWeek !== 0) {
      let target = (dayOfWeek - 1 + dayOffset) % 6
      if (target < 0) target += 6
      const customDays = db.getCustomDays()
      const totalFixedDays = getPlanDays().length
      if (target < totalFixedDays) currentDay = target
    }

    renderNav()
    renderDaySelector()
    renderWorkout(currentDay)
    renderMachines()
    renderProgress()
    renderPhotos()
    renderMeasures()
    renderDiet()
    renderSettings()
    setupTimer()
    setupVideo()
    setupVariantOverlay()
    setupCoachChat()
    setupExHistoryOverlay()
    updatePlateauAlerts()

    db.onUpdate(() => {
      renderDaySelector()
      renderWorkout(currentDay)
      renderProgress()
    })

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') hideTimer()
    })

    /* Schedule daily workout reminder */
    let _notifInterval
    function checkNotif() {
      if (localStorage.getItem('gymapp_notif_enabled') !== 'true') return
      if (Notification.permission !== 'granted') { Notification.requestPermission(); return }
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      const lastSent = localStorage.getItem('gymapp_notif_last')
      if (lastSent === today) return
      const targetTime = localStorage.getItem('gymapp_notif_time') || '18:00'
      const [h, m] = targetTime.split(':').map(Number)
      const target = new Date(); target.setHours(h, m, 0, 0)
      if (now >= target) {
        localStorage.setItem('gymapp_notif_last', today)
        new Notification('Kinetic Glass', { body: 'Hora de entrenar! Tu rutina te espera.', icon: '/icon.svg' })
      }
    }
    if (_notifInterval) clearInterval(_notifInterval)
    _notifInterval = setInterval(checkNotif, 30000)
    checkNotif()

    updateCoachFab()

    /* Re-draw charts on resize */
    let _resizeTimer
    window.addEventListener('resize', () => {
      clearTimeout(_resizeTimer)
      _resizeTimer = setTimeout(() => {
        if (!document.getElementById('progressTab').classList.contains('hidden')) {
          renderProgress()
        }
      }, 300)
    })
  }

  function updateNavPill() {
    const nav = document.getElementById('mainNav')
    const pill = nav?.querySelector('.nav-pill')
    const active = nav?.querySelector('button.active')
    if (pill && active) {
      pill.style.left = active.offsetLeft + 'px'
      pill.style.width = active.offsetWidth + 'px'
    }
  }

  function renderNav() {
    const switchTab = btn => {
      document.querySelectorAll('[data-tab]').forEach(b => {
        b.classList.remove('active')
        b.setAttribute('aria-selected', 'false')
      })
      btn.classList.add('active')
      btn.setAttribute('aria-selected', 'true')

      // Tab transition: animate entrance
      document.querySelectorAll('.tab-content').forEach(t => {
        t.classList.add('hidden')
        t.classList.remove('tab-enter')
      })
      const target = document.getElementById(btn.dataset.tab)
      requestAnimationFrame(() => {
        target.classList.remove('hidden')
        requestAnimationFrame(() => {
          target.classList.add('tab-enter')
        })
      })

      // Slide nav indicator
      updateNavPill()
    }
    document.getElementById('mainNav').addEventListener('click', e => {
      const btn = e.target.closest('[data-tab]')
      if (btn) switchTab(btn)
    })

    // Keyboard shortcuts: Ctrl/Cmd + 1-7 for tabs
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '7') {
        e.preventDefault()
        const tabs = ['workoutTab', 'progressTab', 'dietTab', 'machinesTab', 'photosTab', 'measuresTab', 'settingsTab']
        const idx = parseInt(e.key) - 1
        const btn = document.querySelector(`[data-tab="${tabs[idx]}"]`)
        if (btn) switchTab(btn)
      }
    })

    // Initial pill position + tab-enter for initial visible tab
    requestAnimationFrame(() => {
      updateNavPill()
      document.querySelectorAll('.tab-content:not(.hidden)').forEach(t => {
        t.classList.remove('tab-enter')
        void t.offsetWidth
        t.classList.add('tab-enter')
      })
    })

    // Add logout button to header
    const header = document.querySelector('.header-inner')
    if (!document.getElementById('logoutBtn')) {
      const lb = document.createElement('button')
      lb.id = 'logoutBtn'
      lb.textContent = 'Salir'
      lb.style.cssText = 'background:none;border:none;font-size:0.8rem;cursor:pointer;opacity:0.6;margin-left:auto;padding:0.25rem 0.5rem;transition:opacity 0.2s;color:var(--text-dim);'
      lb.title = 'Cerrar sesión'
      lb.addEventListener('click', async () => {
        if (confirm('¿Cerrar sesión?')) {
          await db.logoutUser()
          location.reload()
        }
      })
      header.appendChild(lb)
    }
  }

  function renderDaySelector() {
    const grid = document.getElementById('dayGrid')
    grid.innerHTML = ''
    const progress = db.getProgress()
    const customDays = db.getCustomDays()
    getPlanDays().forEach((d, i) => {
      const p = progress[i] || {}
      const completedSets = Object.values(p).reduce((a, b) => a + (b || 0), 0)
      const totalSets = d.exercises.reduce((a, ex) => a + ex.sets, 0)
      const card = document.createElement('button')
      card.className = `day-card${i === currentDay ? ' active' : ''}`
      card.innerHTML = `
        <div class="day-label">${DAY_LABELS[i] || 'DÍA ' + (i + 1)}</div>
        <div class="day-name">${esc(d.name.split(' — ')[0])}</div>
        <div class="day-focus">${esc(d.focus)}</div>
        ${completedSets > 0 ? '<div class="day-progress-bar"></div>' : ''}
      `
      card.addEventListener('click', () => {
        currentDay = i
        renderDaySelector()
        renderWorkout(i)
      })
      grid.appendChild(card)
    })
    customDays.forEach((cd, ci) => {
      const idx = 100 + ci
      const p = progress[idx] || {}
      const completedSets = Object.values(p).reduce((a, b) => a + (b || 0), 0)
      const totalSets = cd.exercises.reduce((a, ex) => a + ex.sets, 0)
      const card = document.createElement('button')
      card.className = `day-card${idx === currentDay ? ' active' : ''}`
      card.innerHTML = `
        <div class="day-label">CUSTOM</div>
        <div class="day-name">${esc(cd.name)}</div>
        <div class="day-focus">${completedSets}/${totalSets} series</div>
        ${completedSets > 0 ? '<div class="day-progress-bar"></div>' : ''}
      `
      card.addEventListener('click', () => {
        currentDay = idx
        renderDaySelector()
        renderWorkout(idx)
      })
      grid.appendChild(card)
    })
  }

  function getDefaultKg(machineId) {
    const profile = db.getProfile()
    return profile ? workoutPlan.getDefaultKg(machineId, profile) : null
  }

  function recommendWeight(ex, currentKg, allDone) {
    if (!allDone || !currentKg) return null
    const w = parseFloat(currentKg)
    if (!w || w <= 0) return null
    const inc = ex.rir <= 1 ? 2.5 : 1.25
    return Math.round((w + inc) * 10) / 10
  }

  function renderExercise(dayIndex, exKey, activeEx, setsCompleted, weight, defaultKg, nextW, dataKey, isSwapped, isCustom) {
    const machine = gymData.getMachineById(activeEx.machine)
    const notes = db.getNotes()
    const exNotes = notes[dataKey] || []
    const mods = db.getExerciseMods()
    const mod = mods[dataKey] || {}
    const exSets = mod.sets || activeEx.sets
    const exReps = mod.reps || activeEx.reps
    const exRest = mod.rest || activeEx.rest
    const exRir = mod.rir !== undefined ? mod.rir : activeEx.rir
    const allDone = setsCompleted >= exSets
    let h = '<div class="exercise-item' + (isCustom ? ' custom-exercise' : '') + (allDone ? ' completed-exercise' : '') + '" data-day="' + dayIndex + '" data-ex="' + exKey + '">'
    h += '<div class="exercise-top">'
    h += '<div class="exercise-info">'
    h += '<div class="ex-badge-row">'
    h += '<span class="machine-badge">' + esc(machine ? machine.name : activeEx.machine) + '</span>'
    h += '<span class="muscle-badge">' + esc(activeEx.muscle) + '</span>'
    if (isSwapped) h += '<span class="swapped-badge">↻</span>'
    if (isCustom) h += '<span class="swapped-badge" style="background:var(--green);color:#022c22;">✚</span>'
    h += '</div>'
    h += '<div class="exercise-name">' + esc(activeEx.name) + '</div>'
    h += '<div class="exercise-meta">' + exSets + ' series x ' + esc(exReps) + ' repeticiones</div>'
    h += '</div>'
    h += '<div class="exercise-controls">'
    if (activeEx.video) {
      h += '<button class="ex-video-btn" data-video="' + esc(activeEx.video) + '" data-name="' + esc(activeEx.name) + '" title="Ver demostración"><span class="material-symbols-outlined">smart_display</span></button>'
    }
    h += '<button class="ex-history-btn" data-key="' + activeEx.machine + '" data-name="' + esc(activeEx.name) + '" title="Ver historial"><span class="material-symbols-outlined">history</span></button>'
    h += '<button class="ex-edit-meta-btn reset-btn" data-key="' + dataKey + '" data-sets="' + exSets + '" data-reps="' + esc(exReps) + '" data-rest="' + exRest + '" data-rir="' + exRir + '" title="Editar series/reps"><span class="material-symbols-outlined">edit</span></button>'
    h += '</div>'
    h += '</div>'
    h += '<div class="weight-input-row">'
    h += '<div class="set-tracker">'
    const capped = Math.min(setsCompleted, exSets)
    for (let s = 0; s < exSets; s++) {
      const note = exNotes[s]
      h += '<button class="set-dot ' +
        (s < capped ? 'completed' : s === capped ? 'current' : '') +
        '" data-day="' + dayIndex + '" data-ex="' + exKey + '" data-set="' + s + '" title="' + (note ? esc(note.rir !== undefined ? 'RIR ' + note.rir : '') : (s + 1)) + '">' +
        (s + 1) + '</button>'
    }
    h += '</div>'
    h += '<div style="display:flex;align-items:center;gap:0.5rem;position:relative;">'
    h += '<input type="number" class="weight-input" value="' + weight + '" data-key="' + activeEx.machine + '" data-muscle="' + esc(activeEx.muscle) + '" data-exname="' + esc(activeEx.name) + '" placeholder="kg">'
    h += '<span class="weight-label">Peso (kg)</span>'
    if (!weight && defaultKg) h += '<span class="weight-suggest">Inicia: ' + defaultKg + ' kg</span>'
    else if (nextW) h += '<span class="weight-rec">⬆ ' + nextW + ' kg</span>'
    h += '</div>'
    h += '<button class="rest-timer-btn" data-rest="' + exRest + '" title="Descanso ' + exRest + 's"><span class="material-symbols-outlined">timer</span></button>'
    if (!isCustom) {
      h += '<button class="swap-btn" data-day="' + dayIndex + '" data-ex="' + exKey + '" title="Cambiar ejercicio"><span class="material-symbols-outlined">swap_horiz</span></button>'
    }
    if (isCustom) {
      h += '<button class="edit-ex-btn" data-day="' + dayIndex + '" data-idx="' + exKey.replace(dayIndex + '-custom-', '') + '" title="Editar ejercicio"><span class="material-symbols-outlined">edit</span></button>'
      h += '<button class="remove-ex-btn" data-day="' + dayIndex + '" data-idx="' + exKey.replace(dayIndex + '-custom-', '') + '" title="Eliminar"><span class="material-symbols-outlined">close</span></button>'
    }
    h += '</div></div>'
    return h
  }

  function isCustomDay(idx) { return idx >= 100 }

  function renderWorkout(dayIndex) {
    const isCustom = isCustomDay(dayIndex)
    const d = isCustom ? db.getCustomDays()[dayIndex - 100] : getPlanDays()[dayIndex]
    if (!d) return
    const container = document.getElementById('workoutContent')
    const progress = db.getProgress()
    const weights = db.getWeights()
    const dayProgress = progress[dayIndex] || {}
    const customWorkout = db.getCustomWorkout()
    const profile = db.getProfile()

    let html = ''
    if (!isCustom) {
      const botMsgs = profile ? workoutPlan.validateWorkout(profile) : []
      html += [
        '<div class="bot-card">',
        '<div class="bot-card-title">Coach — Análisis de tu rutina</div>',
        botMsgs.map(m => '<div class="bot-msg">' + m + '</div>').join(''),
        '</div>',
      ].join('')
    }
    const planBadge = db.getActivePlan() ? '<span class="plan-badge" style="display:inline-block;font-size:var(--text-xs);color:var(--primary);background:var(--primary-glow);padding:0.15rem 0.5rem;border-radius:var(--radius-xs);margin-left:0.5rem;font-weight:600;vertical-align:middle">Plan personalizado</span>' : ''
    html += [
      '<div class="workout-header">',
      '<div class="workout-header-row">',
      '<h2>' + esc(d.name) + planBadge + '</h2>',
      '<div style="display:flex;gap:0.35rem;align-items:center;">',
      '<button class="reset-btn" id="guidedToggleBtn" style="font-size:0.75rem;padding:0.2rem 0.5rem;' + (_guidedMode ? 'background:var(--primary);color:#fff;border-color:var(--primary);' : '') + '">' + (_guidedMode ? 'Guiado ON' : 'Modo Guiado') + '</button>',
      '<button class="workout-timer-btn" id="workoutTimerBtn" title="Temporizador de entrenamiento">⏱ ' + getTimerDisplay(_timerSeconds) + '</button>',
      '</div>',
      '</div>',
      isCustom ? '' : '<div class="focus">' + esc(d.focus) + '</div>',
      isCustom ? '' : '<div class="focus-note">' + esc(workoutPlan.getFocusNote(profile)) + '</div>',
      '</div>',
      isCustom ? '' : '<div class="warmup-box"><strong>Calentamiento:</strong> ' + esc(d.warmup) + '</div>',
    ].join('') + (function() {
      const today = new Date().toISOString().split('T')[0]
      const notes = db.getWorkoutNotes()
      return '<div class="notes-box" style="margin-bottom:1rem;"><strong style="display:block;margin-bottom:0.25rem;font-size:0.82rem;color:var(--text-dim);">Notas del entrenamiento</strong><textarea id="workoutNotesInput" rows="2" style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-xs);padding:0.5rem;font-size:0.85rem;resize:vertical;font-family:inherit;" placeholder="¿Cómo te sientes hoy? Lesiones, energía, observaciones...">' + esc(notes[today] || '') + '</textarea></div>'
    })() + [
    ].join('')

    d.exercises.forEach((ex, exIdx) => {
      const swapKey = dayIndex + '-' + exIdx
      const swapped = customWorkout[swapKey]
      const activeEx = swapped || ex
      const setsCompleted = dayProgress[exIdx] || 0
      const exMod = (db.getExerciseMods() || {})[swapKey] || {}
      const targetSets = exMod.sets || activeEx.sets
      const targetRir = exMod.rir !== undefined ? exMod.rir : activeEx.rir
      const allDone = setsCompleted >= targetSets
      const machine = gymData.getMachineById(activeEx.machine)
      const weight = weights[activeEx.machine] || ''
      const defaultKg = getDefaultKg(activeEx.machine)
      const nextW = recommendWeight({ ...activeEx, sets: targetSets, rir: targetRir }, weight, allDone)

      html += renderExercise(dayIndex, exIdx, activeEx, setsCompleted, weight, defaultKg, nextW, swapKey, swapped)
    })

    // Custom exercises for this day
    const customExs = db.getCustomExercises()[dayIndex] || []
    customExs.forEach((ex, ci) => {
      const ck = dayIndex + '-custom-' + ci
      const setsCompleted = dayProgress[ck] || 0
      const allDone = setsCompleted >= ex.sets
      const weight = weights[ex.machine] || ''
      const defaultKg = getDefaultKg(ex.machine)
      const nextW = recommendWeight(ex, weight, allDone)

      html += renderExercise(dayIndex, ck, ex, setsCompleted, weight, defaultKg, nextW, ck, false, true)
    })

    html += '<button class="reset-btn add-ex-btn" id="addCustomEx" style="margin-bottom:1rem;width:100%;">Agregar ejercicio personalizado</button>'

    if (!isCustom) {
      html += [
        '<div class="cardio-card">',
        '<h3>Cardio — ' + esc(d.cardio.type) + '</h3>',
        '<div class="cardio-detail">',
        '<div class="cardio-item"><strong>Máquina</strong>' + esc(gymData.getMachineById(d.cardio.machine)?.name || d.cardio.machine) + '</div>',
        '<div class="cardio-item"><strong>Duración</strong>' + esc(d.cardio.duration) + '</div>',
        '<div class="cardio-item"><strong>Protocolo</strong>' + esc(d.cardio.protocol) + '</div>',
        '</div></div>',
        '<div class="cooldown-box"><strong>Enfriamiento:</strong> ' + esc(d.cooldown) + '</div>',
      ].join('')
    }
    html += (function() {
      const today = new Date().toISOString().split('T')[0]
      const cal = db.getCalories()
      return '<div class="calorie-section"><h3>Calorías del Entrenamiento</h3><div class="calorie-row"><input type="number" id="calInput" class="weight-input" value="' + (cal[today] || '') + '" placeholder="kcal" min="0" style="width:100px;"><span class="cal-unit">kcal</span><button class="reset-btn" id="saveCalBtn">Guardar</button></div><div id="calHistory" style="font-size:0.8rem;color:var(--text-dim);margin-top:0.5rem;"></div></div>'
    })() + [
      '<div class="reset-day-wrap">',
      '<button class="reset-btn" id="resetDay">Reiniciar progreso del día</button>',
      '</div>',
    ].join('')

    container.innerHTML = html

    container.querySelectorAll('.set-dot').forEach(btn => {
      btn.addEventListener('click', handleSetClick)
    })
    container.querySelectorAll('.weight-input').forEach(inp => {
      inp.addEventListener('change', handleWeightChange)
    })
    container.querySelectorAll('.rest-timer-btn').forEach(btn => {
      btn.addEventListener('click', startTimer)
    })

    container.querySelectorAll('.swap-btn').forEach(btn => {
      btn.addEventListener('click', showVariants)
    })
    container.querySelectorAll('.ex-video-btn').forEach(btn => {
      btn.addEventListener('click', openVideo)
    })
    const resetBtn = document.getElementById('resetDay')
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('¿Reiniciar todas las series de este día?')) {
          const p = db.getProgress()
          delete p[dayIndex]
          db.setProgress(p)
          renderDaySelector()
          renderWorkout(dayIndex)
        }
      })
    }
    document.getElementById('addCustomEx')?.addEventListener('click', () => showAddCustomForm(dayIndex))
    container.querySelectorAll('.edit-ex-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const d = parseInt(btn.dataset.day, 10)
        const idx = parseInt(btn.dataset.idx, 10)
        showAddCustomForm(d, idx)
      })
    })
    container.querySelectorAll('.remove-ex-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const d = parseInt(btn.dataset.day, 10)
        const idx = parseInt(btn.dataset.idx, 10)
        if (confirm('¿Eliminar este ejercicio personalizado?')) {
          const ce = db.getCustomExercises()
          if (ce[d]) { ce[d].splice(idx, 1); if (!ce[d].length) delete ce[d] }
          db.setCustomExercises(ce)
          renderWorkout(d)
        }
      })
    })
    container.querySelectorAll('.ex-edit-meta-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key
        const curSets = btn.dataset.sets
        const curReps = btn.dataset.reps
        const curRest = btn.dataset.rest
        const curRir = btn.dataset.rir
        const val = prompt('Editar ejercicio\n\nSets, Reps, Descanso(s), RIR\nFormato: sets reps descanso rir\nEj: 4 10-12 90 2', curSets + ' ' + curReps + ' ' + curRest + ' ' + curRir)
        if (!val) return
        const parts = val.trim().split(/\s+/)
        if (parts.length < 4) { showToast('Formato: sets reps descanso rir'); return }
        const sets = parseInt(parts[0], 10)
        const reps = parts[1]
        const rest = parseInt(parts[2], 10)
        const rir = parseInt(parts[3], 10)
        if (!sets || sets < 1) { showToast('Sets inválido'); return }
        const mods = db.getExerciseMods()
        mods[key] = { sets, reps, rest, rir }
        db.setExerciseMods(mods)
        renderWorkout(dayIndex)
      })
    })
    /* Calorie save handler */
    document.getElementById('saveCalBtn')?.addEventListener('click', () => {
      const today = new Date().toISOString().split('T')[0]
      const val = parseInt(document.getElementById('calInput').value, 10)
      if (!val || val < 0) { showToast('Ingresa un número válido'); return }
      const cal = db.getCalories()
      cal[today] = val
      db.setCalories(cal)
      showToast(val + ' kcal guardadas')
      renderWorkout(dayIndex)
    })
    /* Show calorie history for this week */
    const calHistory = document.getElementById('calHistory')
    if (calHistory) {
      const cal = db.getCalories()
      const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
      const today = new Date()
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - today.getDay() + 1)
      let lines = [], total = 0
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart)
        d.setDate(weekStart.getDate() + i)
        const key = d.toISOString().split('T')[0]
        const c = cal[key]
        if (c) { total += c; lines.push('<span>' + days[d.getDay()] + ': ' + c + ' kcal</span>') }
      }
      calHistory.innerHTML = lines.length ? 'Esta semana: ' + total + ' kcal · ' + lines.join(' · ') : ''
    }

    /* Workout notes auto-save */
    const notesInput = document.getElementById('workoutNotesInput')
    if (notesInput) {
      let _notesTimer = null
      notesInput.addEventListener('input', () => {
        if (_notesTimer) clearTimeout(_notesTimer)
        _notesTimer = setTimeout(() => {
          const today = new Date().toISOString().split('T')[0]
          const notes = db.getWorkoutNotes()
          notes[today] = notesInput.value
          db.setWorkoutNotes(notes)
        }, 600)
      })
    }

    /* Guided mode toggle */
    document.getElementById('guidedToggleBtn')?.addEventListener('click', () => {
      _guidedMode = !_guidedMode
      showToast(_guidedMode ? 'Modo guiado activado' : 'Modo guiado desactivado')
      renderWorkout(dayIndex)
    })

    /* Timer button */
    document.getElementById('workoutTimerBtn')?.addEventListener('click', toggleWorkoutTimer)
    document.getElementById('workoutTimerBtn')?.addEventListener('contextmenu', e => {
      e.preventDefault()
      if (confirm('¿Reiniciar el temporizador a 0?')) resetWorkoutTimer()
    })
    /* Restore timer display */
    const timerData = db.getTimer()
    if (timerData && timerData.elapsed > 0 && !_timerRunning) {
      _timerSeconds = timerData.elapsed
      const btn = document.getElementById('workoutTimerBtn')
      if (btn) btn.textContent = '⏱ ' + getTimerDisplay(_timerSeconds)
    }

    /* Exercise name → history */
    container.querySelectorAll('.ex-history-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const key = this.dataset.key
        const name = this.dataset.name
        showExHistory(key, name)
      })
    })
  }

  function showVariants(e) {
    const day = parseInt(e.currentTarget.dataset.day, 10)
    const ex = parseInt(e.currentTarget.dataset.ex, 10)
    const alts = workoutPlan.getAlternatives(day, ex)
    const overlay = document.getElementById('variantOverlay')
    const list = document.getElementById('variantList')
    if (!overlay || !list || !alts.length) return

    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', 'Variantes de ejercicio')
    list.innerHTML = alts.map((a, idx) => {
      const m = gymData.getMachineById(a.machine)
      return '<div class="variant-item">' +
        '<div class="variant-name">' + esc(a.name) + (a.fromPool ? ' <span class="swapped-badge" style="font-size:0.6rem;">NUEVO</span>' : '') + '</div>' +
        '<div class="variant-meta">' + esc(m ? m.name : a.machine) + ' · ' + esc(a.muscle) + ' · ' + a.sets + '×' + esc(a.reps) + '</div>' +
        '<div class="variant-actions">' +
        '<button class="variant-select-btn" data-idx="' + idx + '">Seleccionar</button>' +
        (a.video ? '<span class="variant-video-btn" data-video="' + a.video + '">▶ Video</span>' : '') +
        '</div>' +
        (a.video ? '<div class="variant-video-container" id="vv-' + idx + '"></div>' : '') +
        '</div>'
    }).join('')
    trapFocus(overlay)

    list.querySelectorAll('.variant-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10)
        const src = alts[idx]
        if (!src) return
        const cw = db.getCustomWorkout()
        cw[day + '-' + ex] = { name: src.name, machine: src.machine, sets: src.sets, reps: src.reps, rest: src.rest, rir: src.rir, muscle: src.muscle, video: src.video }
        db.setCustomWorkout(cw)
        overlay.classList.remove('show')
        showToast('Ejercicio cambiado: ' + esc(src.name))
        renderWorkout(day)
      })
    })

    list.querySelectorAll('.variant-video-btn').forEach(el => {
      el.addEventListener('click', function (e) {
        e.stopPropagation()
        const id = this.dataset.video
        const container = this.closest('.variant-item').querySelector('.variant-video-container')
        if (!container || !id) return
        if (container.querySelector('iframe')) return
        container.innerHTML = '<div class="exercise-video" style="margin-top:0.5rem;"><iframe src="https://www.youtube.com/embed/' + id + '?mute=1&autoplay=1&controls=1&rel=0&loop=1" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"></iframe></div>'
      })
    })

    overlay.classList.add('show')
    overlay.onclick = e => { if (e.target === overlay) overlay.classList.remove('show') }
  }

  function handleSetClick(e) {
    const btn = e.currentTarget
    const day = parseInt(btn.dataset.day, 10)
    const rawEx = btn.dataset.ex
    const setIdx = parseInt(btn.dataset.set, 10)
    const isCustom = btn.closest('.exercise-item')?.classList.contains('custom-exercise')
    const progress = db.getProgress()

    if (!progress[day]) progress[day] = {}
    const setsCompleted = progress[day][rawEx] || 0

    if (setIdx < setsCompleted) {
      progress[day][rawEx] = setIdx
      db.setProgress(progress)
      return
    } else if (setIdx === setsCompleted) {
      progress[day][rawEx] = (progress[day][rawEx] || 0) + 1
    } else {
      return
    }

    const activeEx = isCustom
      ? (db.getCustomExercises()[day] || [])[parseInt(rawEx.split('-custom-')[1], 10)]
      : isCustomDay(day)
        ? (db.getCustomDays()[day - 100]?.exercises[rawEx])
        : (getPlanDays()[day]?.exercises[rawEx])
    if (!activeEx) return
    const exMods = db.getExerciseMods()
    const mod = exMods[day + '-' + rawEx] || {}
    const maxSets = mod.sets || activeEx.sets
    if (progress[day][rawEx] > maxSets) progress[day][rawEx] = maxSets

    if (progress[day][rawEx] > setsCompleted) recordTrainingDay()
    const wasMilestone = progress[day][rawEx] >= maxSets && setsCompleted < maxSets
    db.setProgress(progress)
    if (wasMilestone) showToast('Ejercicio completado — ' + maxSets + '/' + maxSets + ' series')

    const restBtn = e.currentTarget.closest('.exercise-item')?.querySelector('.rest-timer-btn')
    const justCompleted = progress[day][rawEx] >= maxSets
    if (restBtn && (progress[day][rawEx] || 0) > 0 && (progress[day][rawEx] || 0) < maxSets) {
      startTimer.call(restBtn)
    } else if (justCompleted && _guidedMode) {
      const exItems = document.querySelectorAll('#workoutContent .exercise-item')
      let foundNext = false
      for (const item of exItems) {
        if (foundNext) {
          item.scrollIntoView({ behavior: 'smooth', block: 'center' })
          item.style.transition = 'box-shadow 0.3s'
          item.style.boxShadow = '0 0 0 2px var(--primary)'
          setTimeout(() => { item.style.boxShadow = '' }, 2000)
          break
        }
        if (item === e.currentTarget.closest('.exercise-item')) foundNext = true
      }
    }
  }

  function handleWeightChange(e) {
    const inp = e.currentTarget
    const key = inp.dataset.key
    const weights = db.getWeights()
    const profile = db.getProfile()
    if (inp.value) {
      weights[key] = inp.value
    } else {
      delete weights[key]
    }
    db.setWeights(weights)
    showToast('Peso guardado: ' + inp.value + ' kg')
    /* Show inline weight indicator */
    const indicator = inp.parentNode.querySelector('.wt-indicator')
    if (indicator && profile && inp.value) {
      const kg = parseFloat(inp.value)
      const bw = parseFloat(profile.weightKg)
      const muscle = (inp.dataset.muscle || '').toLowerCase()
      const range = getWeightRange(muscle, bw)
      if (range && kg > 0) {
        const ratio = kg / bw
        if (ratio > range.maxRatio * 1.15) indicator.textContent = 'Muy pesado'
        else if (ratio > range.maxRatio) indicator.textContent = 'Pesado'
        else if (ratio < range.minRatio * 0.85) indicator.textContent = 'Liviano'
        else indicator.textContent = '✓'
      }
    }
  }

  /* Expected weight range by muscle group (ratio to body weight) */
  function getWeightRange(muscle, bw) {
    const ranges = [
      { kw: ['pectoral','pecho','press banca','bench'], min: 0.5, max: 1.3 },
      { kw: ['espalda','back','remo','pulldown','jalón','dorsal'], min: 0.5, max: 1.2 },
      { kw: ['hombro','shoulder','press militar','overhead','deltoides','deltoid'], min: 0.25, max: 0.7 },
      { kw: ['cuádriceps','quad','pierna','leg','sentadilla','squat','prensa'], min: 0.8, max: 2.2 },
      { kw: ['isquiotibial','hamstring','femoral','curl pierna'], min: 0.3, max: 0.8 },
      { kw: ['glúteo','glute'], min: 0.6, max: 1.5 },
      { kw: ['bíceps','biceps'], min: 0.1, max: 0.3 },
      { kw: ['tríceps','triceps'], min: 0.12, max: 0.35 },
      { kw: ['abdominal','core','abs'], min: 0.1, max: 0.3 },
      { kw: ['trapecio','trap','encogimiento'], min: 0.3, max: 0.8 },
      { kw: ['gemelo','calf','pantorrilla','sóleo','soleo','soleus'], min: 0.5, max: 1.2 },
      { kw: ['general','peso libre'], min: 0.3, max: 0.8 },
    ]
    for (const r of ranges) {
      if (r.kw.some(k => muscle.includes(k))) return { minRatio: r.min, maxRatio: r.max }
    }
    return null
  }

  /* === RIR / Notes per set === */

  function setupTimer() {
    const overlay = document.getElementById('timerOverlay')
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', 'Temporizador de descanso')
    overlay.addEventListener('click', e => {
      if (e.target === e.currentTarget) hideTimer()
    })
    document.getElementById('timerSkip').addEventListener('click', hideTimer)
    document.getElementById('timerStop').addEventListener('click', hideTimer)
  }

  function startTimer() {
    showTimer(parseInt(this.dataset.rest, 10) || 60)
  }

  function showTimer(seconds, onDone) {
    clearInterval(timerInterval)
    const overlay = document.getElementById('timerOverlay')
    const display = document.getElementById('timerDisplay')
    const label = document.getElementById('timerLabel')
    let remaining = seconds

    overlay.classList.add('show')
    label.textContent = 'Descanso'
    updateDisplay(remaining)

    timerInterval = setInterval(() => {
      remaining--
      updateDisplay(remaining)

      // Warning intensity: pulse at ≤5s, intense at ≤2s
      if (remaining <= 5 && remaining > 0) {
        display.classList.add('warning')
        if (remaining <= 2) {
          display.classList.add('warning-intense')
        } else {
          display.classList.remove('warning-intense')
        }
      } else {
        display.classList.remove('warning', 'warning-intense')
      }

      if (remaining <= 0) {
        clearInterval(timerInterval)
        display.classList.remove('warning', 'warning-intense')
        label.textContent = '¡Siguiente serie!'
        display.style.color = 'var(--green)'
        try {
          if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
          if (audioCtx.state === 'suspended') audioCtx.resume()
          const osc = audioCtx.createOscillator()
          const gain = audioCtx.createGain()
          osc.connect(gain)
          gain.connect(audioCtx.destination)
          osc.frequency.value = 880
          gain.gain.value = 0.3
          osc.start()
          osc.stop(audioCtx.currentTime + 0.3)
        } catch (_) {}
        if (onDone) setTimeout(onDone, 500)
      }
    }, 1000)
  }

  function updateDisplay(seconds) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    document.getElementById('timerDisplay').textContent = m + ':' + (s < 10 ? '0' : '') + s
  }

  function hideTimer() {
    clearInterval(timerInterval)
    document.getElementById('timerOverlay').classList.remove('show')
    document.getElementById('timerDisplay').style.color = ''
    document.getElementById('timerDisplay').classList.remove('warning', 'warning-intense')
  }

  /* === Add / Edit Custom Exercise === */
  let _addExDay = -1
  let _editExIdx = -1

  function showAddCustomForm(day, editIdx) {
    _addExDay = day
    _editExIdx = editIdx !== undefined ? editIdx : -1
    const overlay = document.getElementById('addExOverlay')
    const sel = document.getElementById('addExMachine')
    const cats = gymData.categories || Object.keys(gymData.machines)
    sel.innerHTML = '<option value="">— Ninguna —</option>'
    cats.forEach(cat => {
      const machines = gymData.machines[cat]
      if (!machines) return
      machines.forEach(m => {
        sel.innerHTML += '<option value="' + esc(m.id) + '">' + esc(m.name) + '</option>'
      })
    })
    const saveBtn = document.getElementById('addExSave')
    if (_editExIdx >= 0) {
      const ex = (db.getCustomExercises()[day] || [])[_editExIdx]
      if (ex) {
        document.getElementById('addExName').value = ex.name
        document.getElementById('addExMachine').value = ex.machine
        document.getElementById('addExSets').value = ex.sets
        document.getElementById('addExReps').value = ex.reps
        document.getElementById('addExRest').value = ex.rest
        document.getElementById('addExRir').value = ex.rir
        document.getElementById('addExMuscle').value = ex.muscle
        document.getElementById('addExVideo').value = ex.video
        saveBtn.textContent = 'Guardar cambios'
      }
    } else {
      document.getElementById('addExName').value = ''
      document.getElementById('addExSets').value = '3'
      document.getElementById('addExReps').value = '10-12'
      document.getElementById('addExRest').value = '60'
      document.getElementById('addExRir').value = '1'
      document.getElementById('addExMuscle').value = ''
      document.getElementById('addExVideo').value = ''
      saveBtn.textContent = 'Agregar ejercicio'
    }
    overlay.classList.add('show')
  }

  document.getElementById('addExClose')?.addEventListener('click', () => {
    document.getElementById('addExOverlay').classList.remove('show')
  })
  document.getElementById('addExOverlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) document.getElementById('addExOverlay').classList.remove('show')
  })
  document.getElementById('addExSave')?.addEventListener('click', async () => {
    const name = document.getElementById('addExName').value.trim()
    if (!name) { showToast('Escribe un nombre para el ejercicio'); return }
    const ex = {
      name,
      machine: document.getElementById('addExMachine').value,
      sets: parseInt(document.getElementById('addExSets').value, 10) || 3,
      reps: document.getElementById('addExReps').value || '10-12',
      rest: parseInt(document.getElementById('addExRest').value, 10) || 60,
      rir: parseInt(document.getElementById('addExRir').value, 10) || 0,
      muscle: document.getElementById('addExMuscle').value.trim() || 'General',
      video: document.getElementById('addExVideo').value.trim() || '',
    }
    const ce = db.getCustomExercises()
    if (!ce[_addExDay]) ce[_addExDay] = []
    if (_editExIdx >= 0) {
      ce[_addExDay][_editExIdx] = ex
      await db.setCustomExercises(ce)
      document.getElementById('addExOverlay').classList.remove('show')
      showToast('Ejercicio actualizado: ' + esc(ex.name))
    } else {
      ce[_addExDay].push(ex)
      await db.setCustomExercises(ce)
      document.getElementById('addExOverlay').classList.remove('show')
      showToast('Ejercicio agregado: ' + esc(ex.name))
    }
    renderWorkout(_addExDay)
  })

  /* === Video Modal === */
  function setupVideo() {
    document.getElementById('videoOverlay').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeVideo()
    })
    document.getElementById('videoClose').addEventListener('click', closeVideo)
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeVideo()
    })
  }

  function openVideo() {
    const url = this.dataset.video
    if (!url) return
    const iframe = document.getElementById('videoIframe')
    if (!iframe) return
    const name = this.dataset.name || 'Demostración'
    const embedUrl = url.match(/^https?:\/\//) ? url : 'https://www.youtube.com/embed/' + url + '?autoplay=1&mute=1&controls=1&rel=0&modestbranding=1'
    document.getElementById('videoModalTitle').textContent = name
    iframe.src = embedUrl
    const overlay = document.getElementById('videoOverlay')
    overlay.classList.add('show')
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', 'Video: ' + name)
    trapFocus(overlay)
  }

  function closeVideo() {
    document.getElementById('videoOverlay').classList.remove('show')
    document.getElementById('videoIframe').src = ''
    releaseFocusTrap()
  }

  /* === Variant Overlay === */
  function setupVariantOverlay() {
    const overlay = document.getElementById('variantOverlay')
    document.getElementById('variantClose')?.addEventListener('click', () => {
      overlay.classList.remove('show')
      releaseFocusTrap()
    })
    overlay?.addEventListener('click', e => {
      if (e.target === overlay) { overlay.classList.remove('show'); releaseFocusTrap() }
    })
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { overlay?.classList.remove('show'); releaseFocusTrap() }
    })
  }

  /* Coach Chat Setup (called once from initApp) */
  function setupCoachChat() {
    const coachMessages = document.getElementById('coachMessages')
    const coachInput = document.getElementById('coachInput')
    const coachSend = document.getElementById('coachSend')

    document.getElementById('coachFab')?.addEventListener('click', () => {
      const overlay = document.getElementById('coachOverlay')
      overlay.classList.add('show')
      overlay.setAttribute('role', 'dialog')
      overlay.setAttribute('aria-modal', 'true')
      overlay.setAttribute('aria-label', 'Coach IA')
      if (!coachMessages.children.length) addCoachMsg('Coach', '¡Hola! Soy tu coach con IA. Pregúntame sobre tu rutina, pesos, técnica, o cualquier duda de entrenamiento.')
      setTimeout(() => coachInput.focus(), 100)
      trapFocus(overlay)
    })
    document.getElementById('coachClose')?.addEventListener('click', () => {
      document.getElementById('coachOverlay').classList.remove('show')
      releaseFocusTrap()
    })
    document.getElementById('coachOverlay')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) { document.getElementById('coachOverlay').classList.remove('show'); releaseFocusTrap() }
    })

    coachSend?.addEventListener('click', () => sendCoachMsg())
    coachInput?.addEventListener('keydown', e => { if (e.key === 'Enter') sendCoachMsg() })

    async function sendCoachMsg() {
      const text = coachInput.value.trim()
      if (!text) return
      coachInput.value = ''
      addCoachMsg('Tú', text)
      coachSend.disabled = true; coachSend.innerHTML = '<span class="spinner" style="display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite;vertical-align:middle;"></span>'

      try {
        const profile = db.getProfile()
        const progress = db.getProgress()
        const weights = db.getWeights()
        const username = db.getUsername()
        const customEx = db.getCustomExercises()
        const fullPlan = getPlanDays().map((d, i) =>
          `${d.name}:\n${d.exercises.map(e => `  - ${e.name} (${e.machine}) · ${e.sets}x${e.reps} · RIR ${e.rir} · ${e.muscle}`).join('\n')}`
        ).join('\n\n')

        /* Build weight log string */
        const weightLines = []
        const usedDays = getPlanDays()
        for (const key of Object.keys(weights || {})) {
          let found = false
          for (let di = 0; di < usedDays.length && !found; di++) {
            const day = usedDays[di]
            for (let ei = 0; ei < day.exercises.length && !found; ei++) {
              const ex = day.exercises[ei]
              if (ex.machine === key) {
                weightLines.push(`  - Día ${di + 1} (${day.name}): ${ex.name} → ${weights[key]} kg`)
                found = true
              }
            }
          }
          if (!found) {
            for (const dayIdx of Object.keys(customEx)) {
              for (const ex of customEx[dayIdx]) {
                if (ex.machine === key) {
                  weightLines.push(`  - Día ${parseInt(dayIdx) + 1}: ${ex.name} ✚ → ${weights[key]} kg`)
                  found = true; break
                }
              }
              if (found) break
            }
          }
          if (!found) {
            const m = gymData.getMachineById(key)
            weightLines.push(`  - ${m ? m.name : key}: ${weights[key]} kg`)
          }
        }
        const weightStr = weightLines.length ? weightLines.join('\n') : '  (sin pesos registrados aún)'

        /* Build progress summary */
        let totalSetsDone = 0, totalSets = 0
        getPlanDays().forEach((d, i) => {
          const p = progress[i] || {}
          d.exercises.forEach((ex, exIdx) => { totalSetsDone += p[exIdx] || 0; totalSets += ex.sets })
        })

        const systemPrompt = `Eres un entrenador personal experto en fuerza e hipertrofia. Tu nombre es Coach IA.
Contexto del usuario:
- Nombre: ${username || 'Desconocido'}
- Edad: ${profile?.age || '?'} años
- Altura: ${profile?.heightCm || '?'} cm
- Peso corporal: ${profile?.weightKg || '?'} kg
- Género: ${profile?.gender === 'F' ? 'Femenino' : 'Masculino'}
- BMR: ${profile?.bmr || '?'} kcal/día
- TDEE: ${profile?.tdee || '?'} kcal/día
- Déficit calórico: ${profile?.deficitCalories || '?'} kcal/día
- Progreso semanal: ${totalSetsDone}/${totalSets} series completadas

Plan de entrenamiento (${getPlanDays().length} días):
${fullPlan}

Pesos registrados por el usuario (carga que usa en cada ejercicio):
${weightStr}

Responde en ESPAÑOL, sé directo y práctico. Puedes aconsejar sobre técnica, progresión de pesos (subir/bajar según RIR y rendimiento), nutrición básica y recuperación. Si ves que un peso es demasiado alto o bajo para el nivel del usuario, indícalo. Si no sabes algo, dilo honestamente.`

        let body, headers, url
        if (aiProvider === 'gemini') {
          url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + aiKey
          headers = { 'Content-Type': 'application/json' }
          body = JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text }] }]
          })
        } else {
          url = aiUrl.replace(/\/+$/, '') + '/chat/completions'
          headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + aiKey }
          body = JSON.stringify({
            model: aiModel || 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: text }
            ]
          })
        }
        const res = await fetch(url, { method: 'POST', headers, body })
        if (!res.ok) {
          let detail = ''
          try { const err = await res.json(); detail = err?.error?.message || '' } catch (_) {}
          throw new Error('HTTP ' + res.status + (detail ? ' — ' + detail : ''))
        }
        const data = await res.json()
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || data?.choices?.[0]?.message?.content
        if (reply) { addCoachMsg('Coach', reply) }
        else { console.error('Coach respuesta cruda:', JSON.stringify(data)); addCoachMsg('Coach', 'No pude generar respuesta — revisa la consola (F12) para más detalles.') }
      } catch (e) {
        console.warn('Coach error:', e)
        addCoachMsg('Coach', 'Error: ' + (e.message.includes('429') ? 'Demasiadas solicitudes — espera un minuto y vuelve a intentar.\n\nVe a https://aistudio.google.com/apikey, checa tu cuota o genera una key nueva.' : e.message.includes('403') ? 'API key inválida — ve a Ajustes y actualiza tu key' : e.message))
      }
      coachSend.disabled = false; coachSend.textContent = 'Enviar'
    }

    function addCoachMsg(who, text) {
      const d = document.createElement('div')
      d.style.cssText = 'margin-bottom:0.75rem;padding:0.5rem 0.75rem;border-radius:var(--radius-sm);background:' + (who === 'Tú' ? 'var(--primary)' : 'var(--bg)') + ';color:' + (who === 'Tú' ? '#fff' : 'var(--text)') + ';max-width:90%;' + (who === 'Tú' ? 'margin-left:auto;' : '')
      d.innerHTML = '<strong>' + who + '</strong><br>' + esc(text)
      coachMessages.appendChild(d)
      coachMessages.scrollTop = coachMessages.scrollHeight
    }
  }

  function updateCoachFab() {
    const fab = document.getElementById('coachFab')
    if (fab) fab.style.display = aiKey ? '' : 'none'
  }

  function esc(s) {
    if (!s) return ''
    const d = document.createElement('div')
    d.textContent = s
    return d.innerHTML
  }

  function renderMachines() {
    const container = document.getElementById('machinesContent')
    const categories = [
      { key: 'cardio', label: 'Cardio' },
      { key: 'pecho', label: 'Pecho' },
      { key: 'espalda', label: 'Espalda' },
      { key: 'hombros', label: 'Hombros' },
      { key: 'biceps', label: 'Bíceps' },
      { key: 'triceps', label: 'Tríceps' },
      { key: 'piernas', label: 'Piernas' },
      { key: 'abdominales', label: 'Abdominales' },
      { key: 'pesoLibre', label: 'Peso Libre' },
      { key: 'funcional', label: 'Funcional' },
    ]

    let html = ''
    categories.forEach(cat => {
      const machines = gymData.machines[cat.key]
      if (!machines || !machines.length) return
      html += '<div class="category-section">'
      html += '<div class="category-title">' + esc(cat.label) + '</div>'
      html += '<div class="machine-grid">'
      machines.forEach(m => {
        html += '<div class="machine-item">' + esc(m.name) + '</div>'
      })
      html += '</div></div>'
    })
    /* wger exercise search */
    html += '<div class="ex-search-section">'
    html += '<h3>🔎 Buscar ejercicios (wger.de)</h3>'
    html += '<p class="settings-description">Busca ejercicios por músculo o nombre. Base de datos abierta de wger.de</p>'
    html += '<div class="ex-search-row">'
    html += '<select id="exSearchMuscle" class="ex-search-input" style="max-width:200px;">'
    html += '<option value="">Todos los músculos</option>'
    html += '<option value="1">Bíceps</option><option value="2">Antebrazo</option>'
    html += '<option value="3">Abdominales</option><option value="4">Pantorrillas</option>'
    html += '<option value="5">Pectoral</option><option value="6">Espalda baja</option>'
    html += '<option value="7">Espalda media</option><option value="8">Deltoides</option>'
    html += '<option value="9">Cuádriceps</option><option value="10">Femorales</option>'
    html += '<option value="11">Glúteos</option><option value="12">Trapecio</option>'
    html += '<option value="13">Tríceps</option>'
    html += '</select>'
    html += '<input type="text" id="exSearchInput" class="ex-search-input" placeholder="O busca por nombre..." autocomplete="off">'
    html += '<button class="reset-btn" id="exSearchBtn">Buscar</button>'
    html += '</div>'
    html += '<div id="exResults"></div>'
    html += '</div>'

    container.innerHTML = html

    setupExerciseSearch()
  }

  /* === wger Exercise Search === */
  function setupExerciseSearch() {
    const input = document.getElementById('exSearchInput')
    const muscle = document.getElementById('exSearchMuscle')
    const btn = document.getElementById('exSearchBtn')
    const results = document.getElementById('exResults')
    if (!input || !btn) return
    function doSearch() {
      const q = input.value.trim()
      const m = muscle.value
      searchWgerExercises(q, m)
    }
    btn.addEventListener('click', doSearch)
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch() })
  }

  async function searchWgerExercises(query, muscleId) {
    const results = document.getElementById('exResults')
    results.innerHTML = '<div><span class="food-search-spinner"></span> Buscando...</div>'
    try {
      let url = 'https://wger.de/api/v2/exercise/?language=2&limit=20'
      if (muscleId) url += '&muscles=' + muscleId
      if (query) url += '&name=' + encodeURIComponent(query)
      const res = await fetch(url)
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      const exercises = data.results || []
      if (!exercises.length) { results.innerHTML = '<div style="color:var(--text-dim);font-size:0.82rem;">Sin resultados</div>'; return }
      results.innerHTML = exercises.map(ex => {
        const muscleNames = (ex.muscles || []).join(', ')
        const equipment = (ex.equipment || []).join(', ')
        const desc = (ex.description || '').replace(/<[^>]*>/g, '').substring(0, 200)
        return '<div class="ex-result">' +
          '<div class="ex-result-name">' + esc(ex.name) + '</div>' +
          '<div class="ex-result-meta">' +
          '<span>💪 ' + esc(muscleNames || 'General') + '</span>' +
          (equipment ? '<span>🏋️ ' + esc(equipment) + '</span>' : '') +
          '</div>' +
          (desc ? '<div class="ex-result-desc">' + esc(desc) + '...</div>' : '') +
          '</div>'
      }).join('')
    } catch (e) {
      results.innerHTML = '<div style="color:var(--primary);font-size:0.82rem;">Error: ' + esc(e.message) + '</div>'
    }
  }

  function renderProgress() {
    const container = document.getElementById('progressContent')
    let progress = db.getProgress()
    const now = new Date()
    const weekNum = getISOWeek(now)
    const weekId = now.getFullYear() + '-W' + String(weekNum).padStart(2, '0')
    const hasLiveData = Object.keys(progress).length > 0
    let fallbackSource = null
    if (!hasLiveData) {
      const snapshot = db.getHistoryWeek(weekId)
      if (snapshot && snapshot.progress && Object.keys(snapshot.progress).length > 0) {
        progress = snapshot.progress
        fallbackSource = 'same-week'
      } else {
        const historyData = db.getHistory()
        const weeks = Object.keys(historyData).filter(k => k.startsWith(now.getFullYear() + '-W')).sort()
        for (let i = weeks.length - 1; i >= 0; i--) {
          const h = historyData[weeks[i]]
          if (h && h.progress && Object.keys(h.progress).length > 0) {
            progress = h.progress
            fallbackSource = weeks[i]
            break
          }
        }
      }
    }
    let totalSetsDone = 0
    let totalSets = 0
    let totalWorkouts = 0
    let daysCompleted = 0

    getPlanDays().forEach((d, i) => {
      const p = progress[i] || {}
      const daySets = d.exercises.reduce((a, ex) => a + ex.sets, 0)
      let dayDone = 0
      d.exercises.forEach((ex, exIdx) => {
        dayDone += p[exIdx] || 0
      })
      totalSets += daySets
      totalSetsDone += dayDone
      if (dayDone > 0) totalWorkouts++
      if (dayDone >= daySets) daysCompleted++
    })
    db.getCustomDays().forEach((cd, ci) => {
      const idx = 100 + ci
      const p = progress[idx] || {}
      const daySets = cd.exercises.reduce((a, ex) => a + ex.sets, 0)
      let dayDone = 0
      cd.exercises.forEach((ex, exIdx) => {
        dayDone += p[exIdx] || 0
      })
      totalSets += daySets
      totalSetsDone += dayDone
      if (dayDone > 0) totalWorkouts++
      if (dayDone >= daySets) daysCompleted++
    })

    const pct = totalSets > 0 ? Math.round((totalSetsDone / totalSets) * 100) : 0

    const trainingDays = getTrainingCount()

    let html = [
      '<h2>Tu Progreso</h2>',
      '<div class="week-info-bar">',
      '<span>' + esc(formatDate(now)) + '</span>',
      '<span>Semana ' + weekNum + ' de ' + now.getFullYear() + '</span>',
      '<span>' + trainingDays + ' día' + (trainingDays !== 1 ? 's' : '') + ' entrenando</span>',
      '</div>',
      '<div class="restore-banner" style="background:rgba(5,150,105,0.04);border-color:rgba(5,150,105,0.08);font-size:0.82rem;">Progreso: ' + Object.keys(progress).length + ' días · ' + weekId + (fallbackSource ? ' ← ' + fallbackSource : '') + ' · Historial: ' + Object.keys(db.getHistory()).length + ' semanas' + (Object.keys(db.getHistory()).length > 0 ? ' · <button id="restoreFromBanner" style="background:var(--primary);border:none;color:#fff;padding:0.15rem 0.5rem;border-radius:var(--radius-xs);cursor:pointer;font-weight:700;font-size:0.78rem;">Restaurar</button>' : '') + '</div>',
      '<div class="progress-stats">',
      '<div class="stat-card"><div class="stat-value">' + pct + '%</div><div class="stat-label">Progreso global</div></div>',
      '<div class="stat-card"><div class="stat-value">' + totalSetsDone + '</div><div class="stat-label">Series completadas</div></div>',
      '<div class="stat-card"><div class="stat-value">' + totalWorkouts + '/' + getPlanDays().length + '</div><div class="stat-label">Entrenos iniciados</div></div>',
      '<div class="stat-card"><div class="stat-value">' + daysCompleted + '</div><div class="stat-label">Días completados</div></div>',
      '</div>',
      (typeof navigator.share === 'function' ? '<div style="text-align:center;margin-bottom:1rem;"><button class="reset-btn" id="shareProgressBtn" style="background:var(--surface);border-color:var(--border);color:var(--text);">Compartir Progreso</button></div>' : ''),
      '<h3>Calendario de Entrenos</h3>',
      '<div id="calendarWrap" style="margin-bottom:1.5rem;"></div>',
      '<h3>Detalle por día</h3>',
    ].join('')

    getPlanDays().forEach((d, i) => {
      const p = progress[i] || {}
      const daySets = d.exercises.reduce((a, ex) => a + ex.sets, 0)
      let dayDone = 0
      d.exercises.forEach((ex, exIdx) => {
        dayDone += p[exIdx] || 0
      })
      const doneClass = dayDone >= daySets ? 'progress-day-done' : ''
      html += '<div class="progress-day-row ' + doneClass + '">'
      html += '<span>' + DAY_LABELS[i] + ' — ' + esc(d.name.split(' — ')[0]) + '</span>'
      html += '<span class="progress-day-count">'
      html += dayDone + '/' + daySets + ' series</span></div>'
    })
    db.getCustomDays().forEach((cd, ci) => {
      const idx = 100 + ci
      const p = progress[idx] || {}
      const daySets = cd.exercises.reduce((a, ex) => a + ex.sets, 0)
      let dayDone = 0
      cd.exercises.forEach((ex, exIdx) => {
        dayDone += p[exIdx] || 0
      })
      const doneClass = dayDone >= daySets ? 'progress-day-done' : ''
      html += '<div class="progress-day-row ' + doneClass + '">'
      html += '<span>✚ ' + esc(cd.name) + '</span>'
      html += '<span class="progress-day-count">'
      html += dayDone + '/' + daySets + ' series</span></div>'
    })

    /* === Exercise Stats === */
    html += '<h3 style="margin-top:2rem;">Progreso por Ejercicio</h3>'
    html += '<div class="ex-stats-wrap" style="margin-bottom:1.5rem;">'
    const allWeights = db.getWeights()
    const exMap = {}
    for (const key of Object.keys(allWeights)) {
      const machineData = gymData.getMachineById(key)
      if (!machineData) continue
      const displayName = machineData.name
      if (!exMap[displayName]) exMap[displayName] = []
      exMap[displayName].push({ key, weight: parseFloat(allWeights[key]) || 0, date: '' })
    }
    const exEntries = Object.entries(exMap).sort((a, b) => a[0].localeCompare(b[0]))
    if (exEntries.length) {
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.5rem;">'
      for (const [name, entries] of exEntries) {
        const vals = entries.map(e => e.weight).filter(v => v > 0)
        if (!vals.length) continue
        const current = vals[vals.length - 1]
        const maxW = Math.max(...vals)
        const trend = vals.length >= 3 ? vals[vals.length - 1] - vals[vals.length - 3] : (vals.length >= 2 ? vals[vals.length - 1] - vals[0] : 0)
        const trendStr = trend > 0 ? '<span style="color:var(--green);">+' + trend.toFixed(1) + '</span>' : trend < 0 ? '<span style="color:var(--primary);">' + trend.toFixed(1) + '</span>' : '<span style="color:var(--text-dim);">0</span>'
        html += '<div style="background:var(--surface2);border-radius:var(--radius-xs);padding:0.5rem;font-size:0.8rem;">'
        html += '<div style="font-weight:600;margin-bottom:0.25rem;">' + esc(name) + '</div>'
        html += '<div style="color:var(--text-dim);">Actual: <strong>' + current + ' kg</strong></div>'
        html += '<div style="color:var(--text-dim);">Max: <strong>' + maxW + ' kg</strong></div>'
        html += '<div style="color:var(--text-dim);">Tendencia: ' + trendStr + '</div>'
        html += '</div>'
      }
      html += '</div>'
    } else {
      html += '<p style="color:var(--text-dim);font-size:0.85rem;">Registra pesos para ver estadísticas por ejercicio.</p>'
    }
    html += '</div>'

    /* === Charts === */
    html += [
      '<h3 style="margin-top:2rem;">Volumen Semanal</h3>',
      '<div class="chart-container"><canvas id="volumeChart" width="800" height="300"></canvas></div>',
      '<h3 style="margin-top:1.5rem;">Progresión de Pesos</h3>',
      '<p class="settings-description">Últimos pesos registrados por ejercicio</p>',
      '<div class="chart-container"><canvas id="weightChart" width="800" height="300"></canvas></div>',
    ].join('')

    html += [
      '<div class="reset-day-wrap" style="display:flex;gap:0.5rem;flex-wrap:wrap;justify-content:center;">',
      '<button class="reset-btn" id="resetAll">Reiniciar todo el progreso</button>',
      Object.keys(db.getHistory()).length > 0 ? '<button class="reset-btn" id="restoreFromHistory" style="background:var(--primary);color:#fff;">Restaurar última semana</button>' : '',
      '</div>',
    ].join('')

    /* === Year history (exclude current week) === */
    const year = now.getFullYear()
    const currentWeekNum = getISOWeek(now)
    const currentWeekStr = year + '-W' + String(currentWeekNum).padStart(2, '0')
    const yearStats = db.getYearStats(year, currentWeekStr)
    const historyData = db.getHistory()
    const yearWeeks = Object.keys(historyData).filter(k => k.startsWith(year + '-W') && k !== currentWeekStr).sort()

    if (yearWeeks.length > 0) {
      html += '<h3 style="margin-top:2rem;">Historial ' + year + '</h3>'
      html += '<div class="progress-stats">'
      html += '<div class="stat-card"><div class="stat-value">' + yearStats.totalSets + '</div><div class="stat-label">Series totales</div></div>'
      html += '<div class="stat-card"><div class="stat-value">' + yearStats.totalDays + '</div><div class="stat-label">Días entrenados</div></div>'
      html += '<div class="stat-card"><div class="stat-value">' + yearStats.weeks + '</div><div class="stat-label">Semanas registradas</div></div>'
      html += '<div class="stat-card"><div class="stat-value">' + yearStats.setsPerWeek + '</div><div class="stat-label">Series/semana (promedio)</div></div>'
      html += '</div>'

      html += '<div class="history-week-list">'
      yearWeeks.slice().reverse().forEach(wk => {
        const h = historyData[wk]
        if (!h || !h.progress) return
        let wkSets = 0, wkDays = 0
        for (const dk of Object.keys(h.progress)) {
          const day = h.progress[dk]
          let ds = 0
          for (const ek of Object.keys(day)) ds += day[ek] || 0
          if (ds > 0) wkDays++
          wkSets += ds
        }
        html += '<div class="history-week-row">'
        html += '<span class="history-week-label">' + esc(wk) + '</span>'
        html += '<span class="history-week-count">' + wkSets + ' series · ' + wkDays + ' días</span>'
        html += '</div>'
      })
      html += '</div>'
    }

    container.innerHTML = html

    /* Calendar + Charts */
    renderCalendar()
    drawVolumeChart(progress)
    drawWeightChart()

    document.getElementById('resetAll')?.addEventListener('click', () => {
      if (confirm('¿Reiniciar TODO el progreso? Esta acción no se puede deshacer.')) {
        db.setProgress({})
        db.setWeights({})
        renderDaySelector()
        renderWorkout(currentDay)
        renderProgress()
      }
    })
    document.getElementById('shareProgressBtn')?.addEventListener('click', () => {
      const text = 'Mi progreso esta semana: ' + pct + '% global, ' + totalSetsDone + ' series completadas, ' + daysCompleted + ' días completados.'
      if (navigator.share) {
        navigator.share({ title: 'GYM TRAINER - Mi Progreso', text, url: location.href }).catch(() => {})
      }
    })
    document.getElementById('restoreFromBanner')?.addEventListener('click', () => { restoreFromHistory() })
    document.getElementById('restoreFromHistory')?.addEventListener('click', () => { restoreFromHistory() })

    function restoreFromHistory() {
      const hist = db.getHistory()
      for (const k of Object.keys(hist)) {
        const e = hist[k]
        if (e && e.progress && Object.keys(e.progress).length > 0) {
          db.setProgress(JSON.parse(JSON.stringify(e.progress)))
          if (e.weights) db.setWeights(JSON.parse(JSON.stringify(e.weights)))
          showToast('Progreso restaurado')
          renderDaySelector()
          renderWorkout(currentDay)
          renderProgress()
          return
        }
      }
      showToast('No hay datos de progreso en el historial')
    }
    updatePlateauAlerts()
  }

  /* === Charts === */
  function drawVolumeChart(progress) {
    const canvas = document.getElementById('volumeChart')
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    const w = rect.width, h = rect.height
    const pad = { top: 20, bottom: 30, left: 40, right: 20 }
    const chartW = w - pad.left - pad.right
    const chartH = h - pad.top - pad.bottom

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = cssVar('--text-dim')
    ctx.font = '11px system-ui'
    ctx.textAlign = 'center'

    const daySets = getPlanDays().map((d, i) => {
      const p = progress[i] || {}
      let done = 0
      d.exercises.forEach((ex, exIdx) => { done += p[exIdx] || 0 })
      return done
    })
    const maxVal = Math.max(...daySets, 1)
    const barW = Math.min(40, chartW / daySets.length - 6)

    daySets.forEach((val, i) => {
      const x = pad.left + (chartW / daySets.length) * i + (chartW / daySets.length - barW) / 2
      const barH = (val / maxVal) * chartH
      const y = pad.top + chartH - barH
      ctx.fillStyle = val >= getPlanDays()[i].exercises.reduce((a, ex) => a + ex.sets, 0) ? cssVar('--green') : cssVar('--primary')
      ctx.beginPath()
      ctx.moveTo(x + 4, y)
      ctx.lineTo(x + barW - 4, y)
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + 4)
      ctx.lineTo(x + barW, y + barH)
      ctx.lineTo(x, y + barH)
      ctx.lineTo(x, y + 4)
      ctx.quadraticCurveTo(x, y, x + 4, y)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = cssVar('--text-dim')
      ctx.textAlign = 'center'
      ctx.fillText(DAY_LABELS[i] || 'D' + (i + 1), x + barW / 2, h - 8)
      ctx.fillStyle = cssVar('--text')
      ctx.font = 'bold 11px system-ui'
      ctx.fillText(val, x + barW / 2, y - 6)
    })
  }

  function drawWeightChart() {
    const canvas = document.getElementById('weightChart')
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    const w = rect.width, h = rect.height
    const pad = { top: 20, bottom: 30, left: 40, right: 20 }
    const chartW = w - pad.left - pad.right
    const chartH = h - pad.top - pad.bottom

    ctx.clearRect(0, 0, w, h)
    const weights = db.getWeights()
    const entries = Object.entries(weights).filter(([, v]) => v && parseFloat(v) > 0)
    if (!entries.length) {
      ctx.fillStyle = cssVar('--text-dim')
      ctx.font = '13px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText('Registra pesos en tus entrenamientos para ver la gráfica', w / 2, h / 2)
      return
    }
    const recent = entries.slice(-10)
    const values = recent.map(([, v]) => parseFloat(v))
    const labels = recent.map(([k]) => { const md = gymData.getMachineById(k); return md ? md.name.substring(0, 15) : k.substring(0, 15) })
    const min = Math.min(...values) * 0.9
    const max = Math.max(...values) * 1.1
    const range = max - min || 1

    ctx.strokeStyle = cssVar('--primary')
    ctx.lineWidth = 2
    ctx.beginPath()
    recent.forEach(([, v], i) => {
      const x = pad.left + (chartW / (recent.length - 1 || 1)) * i
      const y = pad.top + chartH - ((parseFloat(v) - min) / range) * chartH
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    })
    ctx.stroke()

    recent.forEach(([, v], i) => {
      const x = pad.left + (chartW / (recent.length - 1 || 1)) * i
      const y = pad.top + chartH - ((parseFloat(v) - min) / range) * chartH
      ctx.fillStyle = cssVar('--primary')
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = cssVar('--text-dim')
      ctx.font = '10px system-ui'
      ctx.textAlign = 'center'
      if (i % 2 === 0 || recent.length <= 6) ctx.fillText(labels[i], x, h - 8)
    })
  }

  /* === Progress Photos === */
  function renderPhotos() {
    const container = document.getElementById('photosContent')
    const photos = db.getPhotos()
    const weekNum = getISOWeek(new Date())
    const curKey = new Date().getFullYear() + '-W' + String(weekNum).padStart(2, '0')
    const keys = Object.keys(photos).sort()

    let html = [
      '<h2>Fotos de Progreso</h2>',
      '<p class="settings-description">Tómate una foto cada semana para ver tu evolución</p>',
    ].join('')

    /* Current week photo upload */
    const existing = photos[curKey]
    html += '<div class="photo-current-week">'
    html += '<h3>Semana actual — ' + esc(curKey) + '</h3>'
    if (existing) {
      html += '<div class="photo-grid">'
      ;['front','back','side'].forEach(angle => {
        if (existing[angle]) {
          html += '<div class="photo-card"><div class="photo-label">' + ({ front: 'Frente', back: 'Espalda', side: 'Lado' }[angle]) + '</div><img src="' + existing[angle] + '" class="photo-img" loading="lazy"></div>'
        }
      })
      html += '</div>'
    }
    html += '<div class="photo-upload-row">'
    ;['front','back','side'].forEach(angle => {
      const label = { front: 'Frente', back: 'Espalda', side: 'Lado' }[angle]
      html += '<label class="photo-upload-btn" data-angle="' + angle + '">' + label + '<input type="file" accept="image/*" capture="environment" class="photo-input" data-angle="' + angle + '" style="display:none;"></label>'
    })
    html += '</div>'
    if (existing) {
      html += '<button class="reset-btn" id="clearPhotosCur">Quitar fotos de esta semana</button>'
    }
    html += '</div>'

    /* History gallery */
    if (keys.length > 0) {
      html += '<h3 style="margin-top:2rem;">Historial</h3>'
      html += '<div class="photo-gallery">'
      keys.slice().reverse().forEach(wk => {
        const p = photos[wk]
        if (!p) return
        html += '<div class="photo-week-block"><div class="photo-week-label">' + esc(wk) + '</div><div class="photo-grid">'
        ;['front','back','side'].forEach(angle => {
          if (p[angle]) {
            html += '<div class="photo-card"><div class="photo-label">' + ({ front: 'Frente', back: 'Espalda', side: 'Lado' }[angle]) + '</div><img src="' + p[angle] + '" class="photo-img" loading="lazy"></div>'
          }
        })
        html += '</div></div>'
      })
      html += '</div>'
    } else {
      html += '<p style="color:var(--text-dim);margin-top:2rem;text-align:center;">Aún no hay fotos. ¡Sube tu primera foto esta semana!</p>'
    }

    container.innerHTML = html

    /* Event handlers */
    container.querySelectorAll('.photo-input').forEach(inp => {
      inp.addEventListener('change', function () {
        const file = this.files[0]
        if (!file) return
        const angle = this.dataset.angle
        const reader = new FileReader()
        reader.onload = function (e) {
          const img = new Image()
          img.onload = function () {
            const maxW = 600, maxH = 800
            let w = img.width, h = img.height
            if (w > maxW) { h *= maxW / w; w = maxW }
            if (h > maxH) { w *= maxH / h; h = maxH }
            const c = document.createElement('canvas')
            c.width = w; c.height = h
            const ctx = c.getContext('2d')
            ctx.drawImage(img, 0, 0, w, h)
            const dataUrl = c.toDataURL('image/jpeg', 0.7)
            const photos = db.getPhotos()
            if (!photos[curKey]) photos[curKey] = {}
            photos[curKey][angle] = dataUrl
            db.setPhotos(photos)
            renderPhotos()
            showToast('Foto guardada')
          }
          img.src = e.target.result
        }
        reader.readAsDataURL(file)
      })
    })
    const clearBtn = document.getElementById('clearPhotosCur')
    if (clearBtn) clearBtn.addEventListener('click', () => {
      const photos = db.getPhotos()
      delete photos[curKey]
      db.setPhotos(photos)
      renderPhotos()
    })
    /* Click to view full size */
    container.querySelectorAll('.photo-img').forEach(img => {
      img.addEventListener('click', function () {
        const ov = document.createElement('div')
        ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;cursor:pointer;'
        const i = new Image()
        i.src = this.src
        i.style.cssText = 'max-width:95vw;max-height:95vh;object-fit:contain;'
        ov.appendChild(i)
        ov.addEventListener('click', () => ov.remove())
        document.body.appendChild(ov)
      })
    })
  }

  /* === Body Measurements === */
  function renderMeasures() {
    const container = document.getElementById('measuresContent')
    const measures = db.getMeasurements()
    const labels = ['neck','shoulders','chest','bicep','waist','hip','thigh','calf']
    const labelNames = { neck: 'Cuello', shoulders: 'Hombros', chest: 'Pecho', bicep: 'Brazo', waist: 'Cintura', hip: 'Cadera', thigh: 'Pierna', calf: 'Pantorrilla' }

    let html = [
      '<h2>Mediciones Corporales</h2>',
      '<p class="settings-description">Registra tus medidas cada semana para ver tu progreso</p>',
      '<div class="measures-form"><div class="measures-grid">',
    ].join('')

    labels.forEach(key => {
      html += '<label>' + labelNames[key] + ' (cm)<input type="number" id="m-' + key + '" class="weight-input" step="0.1" min="0" placeholder="0" style="width:100%;margin-top:0.2rem;"></label>'
    })
    html += '</div><button class="reset-btn" id="saveMeasures" style="margin-top:1rem;">Guardar medidas</button></div>'

    if (measures.length > 0) {
      html += '<h3 style="margin-top:2rem;">Evolución</h3>'
      html += '<div class="chart-container"><canvas id="measuresChart" width="800" height="300"></canvas></div>'
      html += '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;justify-content:center;margin-top:0.5rem;font-size:0.75rem;">'
      ;['#5ac8fa','#bf5af2','#059669','#2ecc71','#f39c12','#3498db','#ff6b35','#1abc9c'].forEach((c, i) => {
        html += '<span style="display:inline-flex;align-items:center;gap:0.25rem;"><span style="width:10px;height:10px;border-radius:2px;background:' + c + ';"></span>' + ['Cuello','Hombros','Pecho','Brazo','Cintura','Cadera','Pierna','Pantorrilla'][i] + '</span>'
      })
      html += '</div>'
      html += '<div class="measures-table-wrap"><table class="measures-table"><thead><tr><th>Fecha</th>'
      labels.forEach(k => { html += '<th>' + labelNames[k] + '</th>' })
      html += '</tr></thead><tbody>'
      measures.slice().reverse().forEach(m => {
        html += '<tr><td>' + esc(m.date || '') + '</td>'
        labels.forEach(k => { html += '<td>' + (m[k] ? m[k] + '' : '-') + '</td>' })
        html += '</tr>'
      })
      html += '</tbody></table></div>'
    } else {
      html += '<p style="color:var(--text-dim);margin-top:2rem;text-align:center;">Aún no hay mediciones. ¡Registra tus primeras medidas!</p>'
    }

    container.innerHTML = html

    document.getElementById('saveMeasures')?.addEventListener('click', () => {
      const entry = { date: new Date().toISOString().split('T')[0] }
      let hasAny = false
      labels.forEach(k => {
        const v = parseFloat(document.getElementById('m-' + k)?.value)
        if (!isNaN(v) && v > 0) { entry[k] = v; hasAny = true }
      })
      if (!hasAny) { showToast('Ingresa al menos una medida'); return }
      const measures = db.getMeasurements()
      measures.push(entry)
      db.setMeasurements(measures)
      renderMeasures()
      drawMeasuresChart()
      showToast('Medidas guardadas')
    })
    if (measures.length > 0) drawMeasuresChart()
  }

  function drawMeasuresChart() {
    const canvas = document.getElementById('measuresChart')
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    const w = rect.width, h = rect.height, pad = { top: 20, bottom: 30, left: 40, right: 20 }
    const chartW = w - pad.left - pad.right, chartH = h - pad.top - pad.bottom
    const measures = db.getMeasurements()
    if (measures.length < 2) return

    const keys = ['neck','shoulders','chest','bicep','waist','hip','thigh','calf']
    const colors = ['#5ac8fa','#bf5af2','#059669','#2ecc71','#f39c12','#3498db','#ff6b35','#1abc9c']
    const labelNames = { neck:'Cuello', shoulders:'Hombros', chest:'Pecho', bicep:'Brazo', waist:'Cintura', hip:'Cadera', thigh:'Pierna', calf:'Pantorrilla' }
    const recent = measures.slice(-30)
    const allValues = recent.flatMap(m => keys.map(k => m[k] || 0))
    const maxV = Math.max(...allValues, 1) * 1.1
    const minV = Math.min(...allValues.filter(v => v > 0), 0)
    const range = maxV - minV || 1

    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = cssVar('--border')
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (chartH / 4) * i
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke()
    }

    keys.forEach((key, ki) => {
      const values = recent.map(m => m[key] || 0)
      if (values.every(v => v === 0)) return
      ctx.strokeStyle = colors[ki]
      ctx.lineWidth = 2
      ctx.beginPath()
      values.forEach((v, i) => {
        const x = pad.left + (chartW / Math.max(values.length - 1, 1)) * i
        const y = pad.top + chartH - ((v - minV) / range) * chartH
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.stroke()
      const lastV = values[values.length - 1]
      if (lastV > 0) {
        ctx.fillStyle = colors[ki]
        const lx = pad.left + chartW
        const ly = pad.top + chartH - ((lastV - minV) / range) * chartH
        ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2); ctx.fill()
      }
    })

    ctx.fillStyle = cssVar('--text-dim')
    ctx.font = '9px system-ui'
    ctx.textAlign = 'center'
    recent.forEach((m, i) => {
      if (recent.length > 10 && i % Math.ceil(recent.length / 6) !== 0) return
      const x = pad.left + (chartW / Math.max(recent.length - 1, 1)) * i
      ctx.fillText(m.date ? m.date.slice(5) : '', x, h - 8)
    })
  }

  /* === Exercise History Overlay === */
  function setupExHistoryOverlay() {
    const overlay = document.getElementById('exHistoryOverlay')
    if (!overlay) return
    document.getElementById('exHistoryClose')?.addEventListener('click', () => overlay.classList.remove('show'))
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('show') })
  }

  function showExHistory(exKey, exName) {
    const overlay = document.getElementById('exHistoryOverlay')
    const container = document.getElementById('exHistoryContent')
    const history = db.getHistory()
    const weights = db.getWeights()
    const weeks = Object.keys(history).sort()
    const fullHistory = db.getHistory()

    let html = '<div class="exh-header"><h3>' + esc(exName) + '</h3></div>'

    /* Weight progression */
    const weightEntries = []
    weeks.forEach(wk => {
      const h = fullHistory[wk]
      if (h && h.weights && h.weights[exKey]) {
        weightEntries.push({ week: wk, weight: h.weights[exKey] })
      }
    })
    const currentW = weights[exKey]
    if (currentW) weightEntries.push({ week: 'Actual', weight: currentW })

    if (weightEntries.length > 0) {
      html += '<h4>Pesos</h4><div class="exh-list">'
      weightEntries.slice(-15).forEach(e => {
        html += '<div class="exh-row"><span class="exh-week">' + esc(e.week) + '</span><span class="exh-val">' + esc(e.weight) + ' kg</span></div>'
      })
      html += '</div>'

      /* Mini chart */
      if (weightEntries.length >= 2) {
        html += '<div class="chart-container" style="height:150px;"><canvas id="exhChart" width="400" height="150"></canvas></div>'
      }
    } else {
      html += '<p style="color:var(--text-dim);">Sin datos de peso registrados</p>'
    }

    container.innerHTML = html
    overlay.classList.add('show')

    if (weightEntries.length >= 2) drawExHistoryChart(weightEntries)
  }

  function drawExHistoryChart(entries) {
    const canvas = document.getElementById('exhChart')
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    const w = rect.width, h = rect.height, pad = { top: 15, bottom: 20, left: 35, right: 15 }
    const cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom
    const vals = entries.map(e => parseFloat(e.weight) || 0)
    const maxV = Math.max(...vals) * 1.1 || 1, minV = Math.min(...vals) * 0.9 || 0

    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = cssVar('--border')
    for (let i = 0; i <= 3; i++) {
      const y = pad.top + (ch / 3) * i
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke()
    }

    ctx.strokeStyle = cssVar('--green')
    ctx.lineWidth = 2
    ctx.beginPath()
    entries.forEach((e, i) => {
      const x = pad.left + (cw / Math.max(entries.length - 1, 1)) * i
      const y = pad.top + ch - ((vals[i] - minV) / (maxV - minV)) * ch
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()

    ctx.fillStyle = cssVar('--text-dim')
    ctx.font = '9px system-ui'
    ctx.textAlign = 'center'
    entries.forEach((e, i) => {
      if (entries.length > 8 && i % 2 !== 0) return
      const x = pad.left + (cw / Math.max(entries.length - 1, 1)) * i
      ctx.fillText(e.week.length > 7 ? e.week.slice(-5) : e.week, x, h - 5)
    })
    ctx.fillStyle = cssVar('--text')
    ctx.font = 'bold 9px system-ui'
    entries.forEach((e, i) => {
      const x = pad.left + (cw / Math.max(entries.length - 1, 1)) * i
      const y = pad.top + ch - ((vals[i] - minV) / (maxV - minV)) * ch
      ctx.fillText(vals[i] + '', x, y - 4)
    })
  }

  /* === Workout Timer === */
  let _timerInterval = null
  let _timerSeconds = 0
  let _timerRunning = false

  function getTimerDisplay(secs) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
  }

  function toggleWorkoutTimer() {
    const btn = document.getElementById('workoutTimerBtn')
    if (!btn) return
    if (_timerRunning) {
      clearInterval(_timerInterval)
      _timerRunning = false
      const data = db.getTimer() || {}
      data.elapsed = _timerSeconds
      db.setTimer(data)
      btn.textContent = '▶ ' + getTimerDisplay(_timerSeconds)
      btn.classList.remove('timer-active')
      showToast('Timer pausado')
    } else {
      const data = db.getTimer() || {}
      if (!_timerInterval) {
        _timerSeconds = data.elapsed || 0
      }
      _timerRunning = true
      _timerInterval = setInterval(() => {
        _timerSeconds++
        const btn = document.getElementById('workoutTimerBtn')
        if (btn) btn.textContent = '⏱ ' + getTimerDisplay(_timerSeconds)
      }, 1000)
      btn.textContent = '⏱ ' + getTimerDisplay(_timerSeconds)
      btn.classList.add('timer-active')
      showToast('Timer iniciado')
    }
  }

  function resetWorkoutTimer() {
    clearInterval(_timerInterval)
    _timerInterval = null
    _timerRunning = false
    _timerSeconds = 0
    db.setTimer({ elapsed: 0 })
    const btn = document.getElementById('workoutTimerBtn')
    if (btn) { btn.textContent = '⏱ 00:00'; btn.classList.remove('timer-active') }
  }

  /* === Plateau Detection === */
  function updatePlateauAlerts() {
    const container = document.getElementById('progressContent')
    if (!container) return
    // Check per-exercise weight stagnation across all history
    const weights = db.getWeights()
    const allHistory = db.getHistory()
    const allWeeks = Object.keys(allHistory).sort()
    if (allWeeks.length < 3) return

    const stalling = []
    const exWeightHistory = {}
    allWeeks.forEach(wk => {
      const h = allHistory[wk]
      if (!h || !h.weights) return
      for (const key of Object.keys(h.weights)) {
        if (!exWeightHistory[key]) exWeightHistory[key] = []
        exWeightHistory[key].push({ week: wk, weight: h.weights[key] })
      }
    })

    for (const key of Object.keys(exWeightHistory)) {
      const entries = exWeightHistory[key]
      if (entries.length < 3) continue
      const last3 = entries.slice(-3)
      const latestWeights = last3.map(e => parseFloat(e.weight))
      if (latestWeights.some(w => isNaN(w))) continue
      if (latestWeights[0] > 0 && latestWeights.every(w => w === latestWeights[0])) {
        const machineData = gymData.getMachineById(key)
        if (!machineData) continue
        let dayLabel = ''
        for (let di = 0; di < getPlanDays().length; di++) {
          const d = getPlanDays()[di]
          if (d.exercises.some(e => e.machine === key)) {
            dayLabel = DAY_LABELS[di] || 'Día ' + (di + 1); break
          }
        }
        stalling.push({ exName: machineData.name, day: dayLabel, weight: latestWeights[0] })
      }
    }

    if (stalling.length > 0) {
      let html = '<div class="plateau-section"><h3>Estancamiento Detectado</h3><p class="settings-description">Estos ejercicios llevan 3+ semanas con el mismo peso:</p>'
      stalling.forEach(s => {
        html += '<div class="plateau-item"><span class="plateau-ex">' + esc(s.exName) + '</span><span class="plateau-day">' + esc(s.day) + '</span><span class="plateau-wt">' + esc(s.weight) + ' kg</span></div>'
      })
      html += '</div>'
      /* Insert after the stats or at the top of progress */
      const existing = container.querySelector('.plateau-section')
      if (existing) existing.outerHTML = html
      else {
        const h2 = container.querySelector('h2')
        if (h2) h2.insertAdjacentHTML('afterend', html)
      }
    }
  }

  /* Diet */
  function renderDiet() {
    const container = document.getElementById('dietContent')
    const profile = db.getProfile()
    if (!profile) { container.innerHTML = '<p>Completa tu perfil en Ajustes para ver el plan de alimentación.</p>'; return }
    const plan = dietPlan.getMealPlan(profile)
    const m = plan.macros

    let html = [
      '<h2>Plan de Alimentación</h2>',
      '<div class="diet-macro-bar">',
      '<div class="diet-macro"><span class="diet-macro-label">Calorías</span><span class="diet-macro-val">' + m.calories + ' kcal</span></div>',
      '<div class="diet-macro"><span class="diet-macro-label">Proteína</span><span class="diet-macro-val">' + m.protein + ' g</span></div>',
      '<div class="diet-macro"><span class="diet-macro-val carbs">' + m.carbs + ' g</span><span class="diet-macro-label">Carbohidratos</span></div>',
      '<div class="diet-macro"><span class="diet-macro-val fat">' + m.fat + ' g</span><span class="diet-macro-label">Grasas</span></div>',
      '</div>',
      '<p class="diet-subtext">Distribución basada en evidencia científica. Proteína ~2g/kg, Grasa ~0.9g/kg, resto carbohidratos.</p>',
      '<p class="diet-rotation">Los ejemplos rotan automáticamente cada día — ' + esc(formatDate(new Date())) + '</p>',
    ].join('')

    plan.structure.forEach((meal, i) => {
      const cal = plan.calPerMeal[i]
      const protein = Math.round(m.protein * meal.pct)
      const carbs = Math.round(m.carbs * meal.pct)
      const fat = Math.round(m.fat * meal.pct)

      html += '<div class="diet-meal-card">'
      html += '<div class="diet-meal-header">' + esc(meal.name) + '<span class="diet-meal-cal">' + cal + ' kcal</span></div>'
      html += '<div class="diet-meal-macros">P: ' + protein + 'g · C: ' + carbs + 'g · G: ' + fat + 'g</div>'
      html += '<div class="diet-meal-examples-title">Ejemplos (elige 1 por comida):</div>'
      html += '<div class="diet-examples">'

      const examples = getMealExamples(i, protein, carbs, fat)
      examples.forEach(ex => {
        html += '<div class="diet-example">'
        html += '<div class="diet-example-name">' + esc(ex.name) + '</div>'
        html += '<div class="diet-example-items">'
        ex.items.forEach(item => {
          html += '<span class="diet-food-item">' + esc(item) + '</span>'
        })
        html += '</div>'
        html += '<div class="diet-example-macros">' + ex.macros + '</div>'
        html += '</div>'
      })

      html += '</div></div>'
    })

    /* Food search via Open Food Facts */
    html += '<div class="food-search-section">'
    html += '<h3>🔍 Buscar alimentos (Open Food Facts)</h3>'
    html += '<p class="settings-description">Busca alimentos por nombre para ver sus macros y llevar tu diario.</p>'
    html += '<div class="food-search-row">'
    html += '<input type="text" id="foodSearchInput" class="food-search-input" placeholder="Ej: pechuga pollo, arroz, whey..." autocomplete="off">'
    html += '</div>'
    html += '<div id="foodResults"></div>'
    html += '<h4 style="margin-top:1rem;font-size:0.9rem;">📋 Diario de hoy</h4>'
    html += '<div id="foodDiary"></div>'
    html += '</div>'

    html += '<div class="diet-refs">'
    html += '<h3>Referencias Científicas</h3>'
    dietPlan.nutritionists.forEach(n => {
      html += '<div class="diet-ref"><strong>' + esc(n.name) + '</strong> — ' + esc(n.title) + '<br><span class="diet-ref-cite">' + esc(n.cite) + '</span></div>'
    })
    html += '</div>'

    container.innerHTML = html

    setupFoodSearch()
  }

  /* === Open Food Facts API === */
  let _foodSearchTimer = null

  function setupFoodSearch() {
    const input = document.getElementById('foodSearchInput')
    const results = document.getElementById('foodResults')
    const diary = document.getElementById('foodDiary')
    if (!input) return
    input.addEventListener('input', () => {
      clearTimeout(_foodSearchTimer)
      const q = input.value.trim()
      if (q.length < 2) { results.innerHTML = ''; return }
      _foodSearchTimer = setTimeout(() => searchFood(q), 400)
    })
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { clearTimeout(_foodSearchTimer); searchFood(input.value.trim()) }
    })
    renderFoodDiary()
  }

  async function searchFood(query) {
    const results = document.getElementById('foodResults')
    results.innerHTML = '<div><span class="food-search-spinner"></span> Buscando...</div>'
    try {
      const url = 'https://world.openfoodfacts.org/cgi/search.pl?action=process&search_terms=' + encodeURIComponent(query) + '&json=1&page_size=10'
      const res = await fetch(url)
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      const products = data.products || []
      if (!products.length) { results.innerHTML = '<div style="color:var(--text-dim);font-size:0.82rem;">Sin resultados</div>'; return }
      results.innerHTML = products.map(p => {
        const n = p.product_name || p.product_name_es || 'Sin nombre'
        const kcal = p.nutriments?.['energy-kcal_100g'] || 0
        const protein = p.nutriments?.proteins_100g || 0
        const carbs = p.nutriments?.carbohydrates_100g || 0
        const fat = p.nutriments?.fat_100g || 0
        return '<div class="food-result">' +
          '<div class="food-result-info">' +
          '<div class="food-result-name">' + esc(n) + '</div>' +
          '<div class="food-result-nutri">' +
          '<span>🔥 ' + Math.round(kcal) + ' kcal</span>' +
          '<span>🥩 P' + protein.toFixed(1) + 'g</span>' +
          '<span>🍚 C' + carbs.toFixed(1) + 'g</span>' +
          '<span>🧈 G' + fat.toFixed(1) + 'g</span>' +
          '<span style="font-size:0.65rem;opacity:0.6;">(por 100g)</span>' +
          '</div></div>' +
          '<button class="food-add-btn" data-name="' + esc(n) + '" data-kcal="' + Math.round(kcal) + '" data-protein="' + protein.toFixed(1) + '" data-carbs="' + carbs.toFixed(1) + '" data-fat="' + fat.toFixed(1) + '">+ Añadir</button>' +
          '</div>'
      }).join('')
      results.querySelectorAll('.food-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          addFoodToDiary({
            name: btn.dataset.name,
            kcal: parseInt(btn.dataset.kcal),
            protein: parseFloat(btn.dataset.protein),
            carbs: parseFloat(btn.dataset.carbs),
            fat: parseFloat(btn.dataset.fat),
          })
        })
      })
    } catch (e) {
      results.innerHTML = '<div style="color:var(--primary);font-size:0.82rem;">Error: ' + esc(e.message) + '</div>'
    }
  }

  function addFoodToDiary(food) {
    const today = new Date().toISOString().split('T')[0]
    const diary = db.getFoodDiary()
    if (!diary[today]) diary[today] = []
    diary[today].push(food)
    db.setFoodDiary(diary)
    showToast('🍽️ Añadido: ' + esc(food.name))
    renderFoodDiary()
  }

  function removeFoodFromDiary(idx) {
    const today = new Date().toISOString().split('T')[0]
    const diary = db.getFoodDiary()
    if (!diary[today]) return
    diary[today].splice(idx, 1)
    if (!diary[today].length) delete diary[today]
    db.setFoodDiary(diary)
    renderFoodDiary()
  }

  function renderFoodDiary() {
    const container = document.getElementById('foodDiary')
    if (!container) return
    const today = new Date().toISOString().split('T')[0]
    const diary = db.getFoodDiary()
    const entries = diary[today] || []
    if (!entries.length) { container.innerHTML = '<div style="color:var(--text-dim);font-size:0.8rem;margin-top:0.5rem;">No has registrado alimentos hoy</div>'; return }
    let totalKcal = 0, totalP = 0, totalC = 0, totalF = 0
    let h = entries.map((e, i) => {
      totalKcal += e.kcal || 0; totalP += e.protein || 0; totalC += e.carbs || 0; totalF += e.fat || 0
      return '<div class="food-diary-entry"><span>' + esc(e.name) + ' — 🔥' + (e.kcal || 0) + ' kcal</span><button class="food-diary-remove" data-idx="' + i + '" aria-label="Quitar alimento">✕</button></div>'
    }).join('')
    h += '<div class="food-diary-total">🔥 Total: ' + totalKcal + ' kcal · P ' + totalP.toFixed(1) + 'g · C ' + totalC.toFixed(1) + 'g · G ' + totalF.toFixed(1) + 'g</div>'
    container.innerHTML = h
    container.querySelectorAll('.food-diary-remove').forEach(btn => {
      btn.addEventListener('click', () => removeFoodFromDiary(parseInt(btn.dataset.idx)))
    })
  }

  function seededShuffle(arr, seed) {
    const r = [...arr]; let s = seed
    for (let i = r.length - 1; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [r[i], r[j]] = [r[j], r[i]] }
    return r
  }

  function getMealExamples(mealIdx, protein, carbs, fat) {
    const all = [
      [
        { name: 'Omelette de claras + avena', items: ['6 claras + 1 huevo', '70g avena', '100g arándanos'], macros: 'P~38g C~52g G~12g' },
        { name: 'Whey + yogurt griego', items: ['1 scoop whey', '200g yogurt griego 0%', '60g avena', '1 cda mantequilla de maní'], macros: 'P~42g C~48g G~14g' },
        { name: 'Tostadas integrales + huevos', items: ['2 rebanadas pan integral', '3 huevos revueltos', '1/2 aguacate'], macros: 'P~35g C~50g G~15g' },
        { name: 'Panqueques de avena + whey', items: ['60g avena molida', '1 scoop whey', '2 huevos', '1 banana'], macros: 'P~40g C~55g G~13g' },
        { name: 'Batido verde + tostadas', items: ['1 scoop whey', '200ml leche descremada', '30g espinaca', '1 rebanada pan integral', '1 cda mantequilla de maní'], macros: 'P~38g C~42g G~15g' },
        { name: 'Huevos revueltos + papa', items: ['4 huevos', '150g papa cocida', '50g aguacate'], macros: 'P~36g C~30g G~22g' },
        { name: 'Avena + claras + fruta', items: ['80g avena', '5 claras', '100g fresas'], macros: 'P~35g C~58g G~7g' },
        { name: 'Tortilla de claras + queso', items: ['6 claras + 2 huevos', '30g queso bajo en grasa', '70g avena'], macros: 'P~42g C~45g G~14g' },
        { name: 'Waffles proteicos + miel', items: ['60g avena', '1 scoop whey', '2 huevos', '1 cda miel'], macros: 'P~38g C~50g G~10g' },
      ],
      [
        { name: 'Pollo + arroz + verduras', items: ['180g pechuga pollo', '200g arroz blanco cocido', '200g brócoli', '1 cda aceite oliva'], macros: 'P~50g C~58g G~18g' },
        { name: 'Carne molida + papa + espinaca', items: ['180g carne 93/7', '250g papa cocida', '150g espinaca salteada', '1 cda aceite oliva'], macros: 'P~48g C~55g G~20g' },
        { name: 'Salmón + quinoa + vegetales', items: ['170g salmón', '200g quinoa cocida', '150g espárragos', '1 cda aceite oliva'], macros: 'P~45g C~50g G~22g' },
        { name: 'Pollo al curry + arroz', items: ['180g pechuga pollo', '200g arroz integral', '150g vegetales mixtos', '1 cda aceite coco'], macros: 'P~48g C~55g G~16g' },
        { name: 'Atún + pasta integral', items: ['200g atún en agua', '200g pasta integral', '150g tomate cherry', '1 cda aceite oliva'], macros: 'P~52g C~52g G~15g' },
        { name: 'Lomo de cerdo + batata', items: ['170g lomo de cerdo', '250g batata', '150g espárragos', '1 cda aceite oliva'], macros: 'P~44g C~55g G~18g' },
        { name: 'Pollo teriyaki + arroz', items: ['180g pechuga pollo', '180g arroz jazmín', '150g brócoli', '1 cda salsa soja'], macros: 'P~50g C~60g G~12g' },
        { name: 'Hamburguesa de pavo + papa', items: ['180g carne de pavo molida', '200g papa cocida', 'Ensalada verde', '1 cda aceite oliva'], macros: 'P~46g C~50g G~16g' },
        { name: 'Pechuga empanizada al horno + arroz', items: ['170g pechuga empanizada', '180g arroz', '150g ensalada'], macros: 'P~48g C~55g G~15g' },
      ],
      [
        { name: 'Yogurt + whey + frutos secos', items: ['200g yogurt griego', '1 scoop whey', '30g almendras', '1 manzana'], macros: 'P~38g C~28g G~16g' },
        { name: 'Batido proteico', items: ['1 scoop whey', '1 cda mantequilla de maní', '1 banana', '200ml leche descremada'], macros: 'P~35g C~40g G~14g' },
        { name: 'Requesón + fruta', items: ['200g requesón 0%', '100g piña/papaya', '20g nueces'], macros: 'P~32g C~30g G~12g' },
        { name: 'Whey + avena + manzana', items: ['1 scoop whey', '50g avena', '1 manzana', '15g almendras'], macros: 'P~35g C~45g G~10g' },
        { name: 'Yogurt + granola + frutos rojos', items: ['200g yogurt griego', '40g granola sin azúcar', '80g frutos rojos'], macros: 'P~26g C~35g G~12g' },
        { name: 'Batido de caseína + peanut', items: ['1 scoop caseína', '1 cda mantequilla de maní', '200ml leche', '1/2 banana'], macros: 'P~38g C~25g G~15g' },
        { name: 'Queso cottage + melocotón', items: ['200g cottage 0%', '1 melocotón', '20g nueces pecanas'], macros: 'P~30g C~20g G~14g' },
        { name: 'Batido verde proteico', items: ['1 scoop whey', '200ml leche almendras', '30g espinaca', '1 cda semillas chía', '1/2 mango'], macros: 'P~32g C~30g G~12g' },
        { name: 'Yogurt + fruta + granola', items: ['200g yogurt griego', '100g fruta mixta', '30g granola'], macros: 'P~24g C~38g G~10g' },
      ],
      [
        { name: 'Pollo + batata + verduras', items: ['170g pechuga pollo', '250g batata cocida', '150g brócoli', '1 cda aceite oliva'], macros: 'P~46g C~52g G~17g' },
        { name: 'Pescado + arroz + ensalada', items: ['180g tilapia/merluza', '180g arroz integral', 'Ensalada verde', '1 cda aceite oliva'], macros: 'P~44g C~48g G~16g' },
        { name: 'Tofu + pasta integral + vegetales', items: ['200g tofu firme', '200g pasta integral', '150g verduras salteadas', '1 cda aceite oliva'], macros: 'P~38g C~55g G~18g' },
        { name: 'Pavo + quinoa + verduras', items: ['180g pechuga pavo', '200g quinoa', '150g calabacín', '1 cda aceite oliva'], macros: 'P~50g C~48g G~16g' },
        { name: 'Carne + arroz + frijoles', items: ['150g carne molida 93/7', '150g arroz', '100g frijoles negros', '1 cda aceite oliva'], macros: 'P~44g C~58g G~17g' },
        { name: 'Pollo al limón + papas', items: ['170g pechuga pollo', '200g papa asada', '150g espinaca', 'jugo de limón'], macros: 'P~46g C~45g G~14g' },
        { name: 'Merluza + puré de papa', items: ['200g merluza', '250g papa', '1 cda aceite oliva', 'Eneldo'], macros: 'P~45g C~50g G~15g' },
        { name: 'Wrap integral de pollo', items: ['170g pollo', '1 tortilla integral grande', '50g aguacate', 'Lechuga + tomate'], macros: 'P~44g C~40g G~18g' },
        { name: 'Pollo + pasta + pesto', items: ['170g pollo', '200g pasta integral', '1 cda pesto', '150g tomate cherry'], macros: 'P~48g C~52g G~17g' },
      ],
    ]
    const pool = all[mealIdx] || []
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
    return seededShuffle(pool, dayOfYear * 100 + mealIdx).slice(0, 3)
  }

  /* Settings */
  function renderSettings() {
    const container = document.getElementById('settingsContent')
    const token = db.getToken()
    const hasToken = !!token
    const profile = db.getProfile()
    const username = db.getUsername()

    if (!profile) { container.innerHTML = '<p>Cargando perfil...</p>'; return }

    const idealW = (profile.heightCm - 100).toFixed(0)

    container.innerHTML = [
      '<h2>Ajustes</h2>',
      '<div class="card">',
      '<div class="card-title">Tu Perfil — <span style="color:var(--primary)">' + esc(username) + '</span></div>',
      '<div class="settings-edit-grid">',
      '<label>Edad <input type="number" id="editAge" value="' + profile.age + '" min="10" max="120"></label>',
      '<label>Altura (cm) <input type="number" id="editHeight" value="' + profile.heightCm + '" min="100" max="250"></label>',
      '<label>Peso (lb) <input type="number" id="editWeight" value="' + profile.weightLb + '" min="50" max="500"></label>',
      '<label>Género <select id="editGender"><option value="M"' + (profile.gender === 'M' ? ' selected' : '') + '>Masculino</option><option value="F"' + (profile.gender === 'F' ? ' selected' : '') + '>Femenino</option></select></label>',
      '</div>',
      '<button class="reset-btn" id="saveProfileBtn" style="margin-top:0.75rem;">Guardar Perfil</button>',
      '<label style="display:flex;align-items:center;gap:0.5rem;margin-top:0.75rem;font-size:0.85rem;color:var(--text-dim);">Inicio de semana (desplazar días) <select id="dayOffsetSelect" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-xs);padding:0.25rem 0.5rem;">' +
        [0,1,2,3,4,5,6].map(o => '<option value="' + o + '"' + (parseInt(localStorage.getItem('gymapp_day_offset') || '0', 10) === o ? ' selected' : '') + '>Lunes + ' + o + '</option>').join('') +
      '</select></label>',
      '<hr class="settings-divider">',
      '<div class="settings-profile-grid">',
      '<div><span class="settings-field-label">Edad</span><strong class="settings-field-value" id="dispAge">' + profile.age + ' años</strong></div>',
      '<div><span class="settings-field-label">Altura</span><strong class="settings-field-value" id="dispHeight">' + (profile.heightCm / 100).toFixed(2) + ' m</strong></div>',
      '<div><span class="settings-field-label">Peso</span><strong class="settings-field-value" id="dispWeight">' + profile.weightLb + ' lb (' + profile.weightKg + ' kg)</strong></div>',
      '<div><span class="settings-field-label">BMI</span><strong class="settings-field-value" id="dispBmi">' + profile.bmi + '</strong></div>',
      '</div>',
      '<hr class="settings-divider">',
      '<div class="settings-profile-grid">',
      '<div><span class="settings-field-label">Metabolismo basal</span><strong class="settings-field-value" id="dispBmr">' + profile.bmr + ' kcal/día</strong></div>',
      '<div><span class="settings-field-label">Gasto diario (TDEE)</span><strong class="settings-field-value" id="dispTdee">' + profile.tdee + ' kcal/día</strong></div>',
      '<div><span class="settings-field-label settings-deficit">Déficit sugerido</span><strong class="settings-field-value settings-deficit-val" id="dispDeficit">' + profile.deficitCalories + ' kcal/día</strong></div>',
      '<div><span class="settings-field-label">Peso ideal aprox</span><strong class="settings-field-value">' + idealW + ' kg (' + Math.round(idealW * 2.205) + ' lb)</strong></div>',
      '</div>',
      '<p class="settings-diet-tip">',
      'Come ~' + profile.deficitCalories + ' kcal/día con alta proteína (1.6-2.2g/kg) para perder grasa sin perder músculo.</p>',
      '</div>',

      /* Training Plan & Preferences */
      (function() {
        let h = ''
        if (profile.dynamicPlansEnabled) {
          const activePlan = db.getActivePlan()
          h += '<div class="card">'
          h += '<h3 style="margin-bottom:0.5rem">Plan de Entrenamiento</h3>'
          if (activePlan) {
            h += '<p style="color:var(--primary);font-weight:600;margin-bottom:0.25rem">✓ Plan personalizado activo</p>'
            h += '<p style="color:var(--text-dim);font-size:var(--text-sm)">' + esc(activePlan.name) + '</p>'
            h += '<p style="color:var(--text-dim);font-size:var(--text-sm)">Semana: ' + esc(activePlan.generatedForWeek) + ' — ' + activePlan.meta.totalVolume + ' series</p>'
            h += '<button class="reset-btn" onclick="regeneratePlan()" style="margin-top:0.75rem;background:var(--primary);color:#fff;border-color:var(--primary);">Regenerar plan ahora</button>'
          }
          h += '</div>'
        }
        h += '<div class="card">'
        h += '<div class="card-title">Preferencias de Entrenamiento</div>'
        h += '<label style="display:block;margin-bottom:0.25rem;color:var(--text-dim);font-size:var(--text-sm)">Objetivo</label>'
        h += '<select id="goalSelect" class="settings-input" onchange="saveTrainingPrefs()" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:0.5rem;border-radius:var(--radius-sm);font-size:0.9rem;width:100%;margin-bottom:0.5rem">'
        h += '<option value="muscleGain"' + (profile.goal === 'muscleGain' ? ' selected' : '') + '>Hipertrofia (ganar músculo)</option>'
        h += '<option value="strength"' + (profile.goal === 'strength' ? ' selected' : '') + '>Fuerza</option>'
        h += '<option value="fatLoss"' + (profile.goal === 'fatLoss' ? ' selected' : '') + '>Pérdida de grasa</option>'
        h += '<option value="maintenance"' + (profile.goal === 'maintenance' ? ' selected' : '') + '>Mantenimiento</option>'
        h += '</select>'
        h += '<label style="display:block;margin-bottom:0.25rem;color:var(--text-dim);font-size:var(--text-sm)">Experiencia</label>'
        h += '<select id="experienceSelect" class="settings-input" onchange="saveTrainingPrefs()" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:0.5rem;border-radius:var(--radius-sm);font-size:0.9rem;width:100%;margin-bottom:0.5rem">'
        h += '<option value="beginner"' + (profile.experienceLevel === 'beginner' ? ' selected' : '') + '>Principiante</option>'
        h += '<option value="intermediate"' + (profile.experienceLevel === 'intermediate' ? ' selected' : '') + '>Intermedio</option>'
        h += '<option value="advanced"' + (profile.experienceLevel === 'advanced' ? ' selected' : '') + '>Avanzado</option>'
        h += '</select>'
        h += '<label style="display:block;margin-bottom:0.25rem;color:var(--text-dim);font-size:var(--text-sm)">Días por semana</label>'
        h += '<select id="daysSelect" class="settings-input" onchange="saveTrainingPrefs()" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:0.5rem;border-radius:var(--radius-sm);font-size:0.9rem;width:100%;margin-bottom:0.5rem">'
        for (let d = 3; d <= 6; d++) {
          h += '<option value="' + d + '"' + (profile.preferredDays === d ? ' selected' : '') + '>' + d + ' días</option>'
        }
        h += '</select>'
        if (!profile.dynamicPlansEnabled) {
          h += '<label style="display:block;margin-bottom:0.25rem;color:var(--text-dim);font-size:var(--text-sm)">Tipo de split</label>'
          h += '<select id="splitSelect" class="settings-input" onchange="saveTrainingPrefs()" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:0.5rem;border-radius:var(--radius-sm);font-size:0.9rem;width:100%;margin-bottom:0.5rem">'
          h += '<option value="ppl"' + (profile.splitPreference === 'ppl' ? ' selected' : '') + '>Push/Pull/Legs</option>'
          h += '<option value="upperLower"' + (profile.splitPreference === 'upperLower' ? ' selected' : '') + '>Upper/Lower</option>'
          h += '<option value="fullBody"' + (profile.splitPreference === 'fullBody' ? ' selected' : '') + '>Cuerpo completo</option>'
          h += '<option value="pushPull"' + (profile.splitPreference === 'pushPull' ? ' selected' : '') + '>Push/Pull</option>'
          h += '</select>'
          h += '<button class="reset-btn" onclick="activateDynamicPlans()" style="margin-top:1rem;width:100%;background:var(--primary);color:#fff;border-color:var(--primary);">Activar Planes Semanales Personalizados</button>'
          h += '<p style="color:var(--text-dim);font-size:var(--text-xs);margin-top:0.5rem">Al activar, se generará un plan único para ti basado en tu perfil y se actualizará cada semana según tu progreso.</p>'
        }
        h += '</div>'
        return h
      })(),

      /* Custom Days */
      '<div class="card">',
      '<div class="card-title">Rutinas Personalizadas</div>',
      '<p class="settings-description">Crea tus propios días de entrenamiento con los ejercicios que quieras.</p>',
      '<div id="customDaysList" style="margin-bottom:0.75rem;">' + (function() {
        const cdays = db.getCustomDays()
        if (!cdays.length) return '<p style="color:var(--text-dim);font-size:0.85rem;text-align:center;">No has creado rutinas personalizadas aún.</p>'
        return cdays.map((cd, i) => '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem;background:var(--surface2);border-radius:var(--radius-xs);margin-bottom:0.25rem;"><span style="font-size:0.9rem;">' + esc(cd.name) + ' <span style="color:var(--text-dim);font-size:0.75rem;">(' + cd.exercises.length + ' ejercicios)</span></span><div><button class="reset-btn edit-custom-day" data-idx="' + i + '" style="padding:0.15rem 0.4rem;font-size:0.75rem;">✎</button> <button class="reset-btn del-custom-day" data-idx="' + i + '" style="padding:0.15rem 0.4rem;font-size:0.75rem;color:var(--primary);">✕</button></div></div>').join('')
      })() + '</div>',
      '<button class="reset-btn" id="addCustomDayBtn" style="width:100%;">Crear nueva rutina</button>',
      '<div id="customDayForm" style="margin-top:0.75rem;display:none;"></div>',
      '</div>',

      /* Sync section */
      '<div class="card">',
      '<div class="card-title">Respaldo en la Nube <span style="font-size:0.65rem;color:var(--text-dim);font-weight:400;">(opcional)</span></div>',
      '<p class="settings-description">',
      'Los datos se guardan localmente en tu navegador. Opcionalmente puedes sincronizarlos con un Gist privado de GitHub',
      ' para acceder desde otros dispositivos con el mismo token.</p>',
      '<div class="settings-token-section">',
      '<label class="settings-token-label">Token de GitHub (scope: gist):</label>',
      '<div class="settings-token-row">',
      '<input type="password" id="tokenInput" class="settings-token-input" value="' + esc(token) + '" placeholder="ghp_...">',
      '<button id="saveTokenBtn" class="reset-btn settings-save-btn">',
      hasToken ? 'Actualizar' : 'Conectar', '</button>',
      '</div></div>',
      '<div class="settings-token-row" style="margin-top:0.75rem;gap:0.5rem;">',
      '<button id="pushGistBtn" class="reset-btn"' + (!hasToken ? ' disabled style="opacity:0.4"' : '') + '>Subir a Gist</button>',
      '<button id="pullGistBtn" class="reset-btn"' + (!hasToken ? ' disabled style="opacity:0.4"' : '') + '>Bajar de Gist</button>',
      '</div>',
      '<div id="syncStatus" class="settings-sync-status"></div>',
      '<p class="settings-gist-id">',
      'Gist ID: <code>' + db.gistId + '</code></p>',
      '</div>',

      /* AI Coach */
      '<div class="card">',
      '<div class="card-title">Coach IA</div>',
      '<div class="settings-edit-grid">',
      '<label>Proveedor <select id="aiProviderSelect" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:0.5rem;border-radius:var(--radius-sm);font-size:0.9rem;">',
      '<option value="gemini"' + (aiProvider === 'gemini' ? ' selected' : '') + '>Gemini (aistudio.google.com)</option>',
      '<option value="openai"' + (aiProvider === 'openai' ? ' selected' : '') + '>OpenAI-compatible (Groq, OpenRouter, etc.)</option>',
      '</select></label>',
      '<label>API Key <input type="password" id="aiKeyInput" class="settings-token-input" value="' + esc(aiKey) + '" placeholder="' + (aiProvider === 'gemini' ? 'AIzaSy...' : 'gsk_...') + '"></label>',
      '<label id="aiUrlLabel"' + (aiProvider !== 'openai' ? ' style="display:none"' : '') + '>URL Base <input type="text" id="aiUrlInput" class="settings-token-input" value="' + esc(aiUrl) + '" placeholder="https://api.groq.com/openai/v1"></label>',
      '<label id="aiModelLabel"' + (aiProvider !== 'openai' ? ' style="display:none"' : '') + '>Modelo <input type="text" id="aiModelInput" class="settings-token-input" value="' + esc(aiModel) + '" placeholder="llama-3.3-70b-versatile"></label>',
      '</div>',
      '<button id="saveAiBtn" class="reset-btn" style="margin-top:0.75rem;">' + (aiKey ? 'Actualizar' : 'Conectar') + ' Coach IA</button>',
      '<div id="aiStatus" class="settings-sync-status"></div>',
      '<p style="font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem;">',
      '<strong>Groq</strong> (gratis): <a href="https://console.groq.com/keys" target="_blank" rel="noopener" style="color:var(--primary)">console.groq.com/keys</a> — 30 req/min, no necesita tarjeta.',
      ' · <strong>Gemini</strong> (gratis): <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style="color:var(--primary)">aistudio.google.com/apikey</a>',
      '</p>',
      '</div>',

      /* Notifications */
      '<div class="card">',
      '<div class="card-title">Recordatorios</div>',
      '<p class="settings-description">Recibe notificaciones para no saltarte entrenamientos.</p>',
      '<div class="settings-token-section">',
      '<label class="settings-token-label" style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">',
      '<input type="checkbox" id="notifToggle"' + (localStorage.getItem('gymapp_notif_enabled') === 'true' ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:var(--primary);">',
      'Notificaciones activadas',
      '</label>',
      '</div>',
      '<div class="settings-token-section" id="notifTimeSection"' + (localStorage.getItem('gymapp_notif_enabled') !== 'true' ? ' style="display:none"' : '') + '>',
      '<label class="settings-token-label">Hora del recordatorio:</label>',
      '<input type="time" id="notifTime" value="' + (localStorage.getItem('gymapp_notif_time') || '18:00') + '" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:0.5rem;border-radius:var(--radius-sm);font-size:0.9rem;width:100%;margin-top:0.25rem;">',
      '</div>',
      '<button class="reset-btn" id="testNotifBtn" style="margin-top:0.5rem;">Probar notificación</button>',
      '</div>',


      '</div>',

      /* Export */
      '<div class="card">',
      '<div class="card-title">Exportar Datos</div>',
      '<p class="settings-description">Descarga tus datos como JSON (completo) o CSV (progresión de pesos).</p>',
      '<div class="settings-sync-actions">',
      '<button class="reset-btn" id="exportJsonBtn">Exportar JSON</button>',
      '<button class="reset-btn" id="exportCsvBtn">Exportar CSV (pesos)</button>',
      '</div>',
      '</div>',

      /* Security info */
      '<div class="card">',
      '<div class="card-title">Seguridad</div>',
      '<ul class="settings-security-list">',
      '<li>Datos encriptados con AES-256-GCM antes de subir</li>',
      '<li>Comunicación HTTPS con GitHub API</li>',
      '<li>Content Security Policy activa</li>',
      '<li>Token guardado solo en tu navegador</li>',
      '</ul>',
      '</div>',

      /* Danger zone */
      '<div class="card" style="border-color:var(--primary);">',
      '<div class="card-title" style="color:var(--primary);">Zona Peligrosa</div>',
      '<p class="settings-description">Esto borrará TODO tu progreso, pesos, historial, fotos, medidas, notas y ejercicios personalizados. No se puede deshacer.</p>',
      '<button class="reset-btn" id="resetAllData" style="background:var(--primary);color:#fff;border-color:var(--primary);width:100%;">Borrar todos los datos de entrenamiento</button>',
      '</div>',
    ].join('')

    /* Event listeners */
    document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
      const p = createDefaultProfile()
      p.age = parseInt(document.getElementById('editAge').value, 10) || 21
      p.heightCm = parseInt(document.getElementById('editHeight').value, 10) || 175
      p.weightLb = parseInt(document.getElementById('editWeight').value, 10) || 165
      p.gender = document.getElementById('editGender').value
      await db.setProfile(p)
      showToast('Perfil actualizado')
      renderSettings()
      renderDiet()
    })

    document.getElementById('dayOffsetSelect')?.addEventListener('change', function() {
      localStorage.setItem('gymapp_day_offset', this.value)
      showToast('Preferencia guardada. Recarga la app para aplicar.')
    })

    /* Custom Days */
    document.getElementById('addCustomDayBtn')?.addEventListener('click', () => showCustomDayForm(-1))
    document.querySelectorAll('.edit-custom-day').forEach(btn => {
      btn.addEventListener('click', () => showCustomDayForm(parseInt(btn.dataset.idx, 10)))
    })
    document.querySelectorAll('.del-custom-day').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10)
        if (confirm('Borrar la rutina "' + esc(db.getCustomDays()[idx]?.name) + '"?')) {
          const days = db.getCustomDays()
          days.splice(idx, 1)
          db.setCustomDays(days)
          renderSettings()
          renderDaySelector()
          if (isCustomDay(currentDay)) {
            const ci = currentDay - 100
            if (ci >= days.length) currentDay = 0
          }
          renderWorkout(currentDay)
        }
      })
    })

    const tokenInput = document.getElementById('tokenInput')
    const saveBtn = document.getElementById('saveTokenBtn')
    const syncStatus = document.getElementById('syncStatus')

    saveBtn?.addEventListener('click', async () => {
      const newToken = tokenInput.value.trim()
      if (!newToken) return

      saveBtn.disabled = true
      saveBtn.textContent = 'Validando...'
      const valid = await db.validateToken(newToken)
      if (!valid) {
        syncStatus.textContent = 'Token inválido o expirado'
        syncStatus.style.color = 'var(--primary)'
        saveBtn.disabled = false
        saveBtn.textContent = hasToken ? 'Actualizar' : 'Conectar'
        return
      }
      db.setToken(newToken)
      showToast('Token de GitHub guardado')
      renderSettings()
    })

    document.getElementById('pushGistBtn')?.addEventListener('click', async () => {
      const st = document.getElementById('syncStatus')
      st.textContent = 'Subiendo...'; st.style.color = 'var(--text-dim)'
      const ok = await db.pushToGist()
      st.textContent = ok ? 'Datos subidos correctamente' : 'Error al subir'
      st.style.color = ok ? 'var(--green)' : 'var(--primary)'
      if (ok) showToast('Datos respaldados en Gist')
    })

    document.getElementById('pullGistBtn')?.addEventListener('click', async () => {
      const st = document.getElementById('syncStatus')
      st.textContent = 'Descargando...'; st.style.color = 'var(--text-dim)'
      const ok = await db.syncFromGist()
      if (ok) {
        st.textContent = 'Datos restaurados desde la nube'
        st.style.color = 'var(--green)'
        showToast('Datos restaurados desde la nube')
        renderSettings()
        renderWorkout(currentDay)
        renderProgress()
        renderDiet()
      } else {
        st.textContent = 'No hay datos en la nube o PIN incorrecto'
        st.style.color = 'var(--primary)'
      }
    })

    /* --- AI Coach Provider Settings --- */
    document.getElementById('saveAiBtn')?.addEventListener('click', async () => {
      const st = document.getElementById('aiStatus')
      aiProvider = document.getElementById('aiProviderSelect').value
      const key = document.getElementById('aiKeyInput').value.trim()
      if (!key) { st.textContent = 'Ingresa una API key'; return }
      aiKey = key
      aiUrl = document.getElementById('aiUrlInput')?.value.trim() || 'https://api.groq.com/openai/v1'
      aiModel = document.getElementById('aiModelInput')?.value.trim() || 'llama-3.3-70b-versatile'
      await db.saveAiKey('key', aiKey)
      await db.saveAiKey('provider', aiProvider)
      await db.saveAiKey('url', aiUrl)
      await db.saveAiKey('model', aiModel)
      st.textContent = 'Coach IA configurado'
      st.style.color = 'var(--green)'
      updateCoachFab()
      showToast('Coach IA activado')
    })
    document.getElementById('aiProviderSelect')?.addEventListener('change', function () {
      const isOpenAI = this.value === 'openai'
      document.getElementById('aiUrlLabel').style.display = isOpenAI ? '' : 'none'
      document.getElementById('aiModelLabel').style.display = isOpenAI ? '' : 'none'
    })

    /* Export handlers */
    document.getElementById('exportJsonBtn')?.addEventListener('click', () => {
      const data = {
        username: db.getUsername(),
        profile: db.getProfile(),
        progress: db.getProgress(),
        weights: db.getWeights(),
        history: db.getHistory(),
        customExercises: db.getCustomExercises(),
        trainingDates: db.getTrainingDates(),
        notes: db.getNotes(),
        exportedAt: new Date().toISOString(),
      }
      downloadFile(JSON.stringify(data, null, 2), 'gym-trainer-backup.json', 'application/json')
      showToast('Datos exportados como JSON')
    })
    document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
      const weights = db.getWeights()
      const profile = db.getProfile()
      const rows = [['Ejercicio', 'Día', 'Peso (kg)', 'Músculo', 'Fecha de exportación']]
      for (const key of Object.keys(weights)) {
        const machineData = gymData.getMachineById(key)
        if (!machineData) continue
        rows.push([machineData.name, '', weights[key], '', new Date().toISOString().split('T')[0]])
      }
      const sanitizeCSV = v => /^[=+\-@]/.test(String(v)) ? "'" + String(v) : String(v)
      const csv = rows.map(r => r.map(c => '"' + sanitizeCSV(c).replace(/"/g, '""') + '"').join(',')).join('\n')
      downloadFile(csv, 'gym-trainer-weights.csv', 'text/csv')
      showToast('Pesos exportados como CSV')
    })

    document.getElementById('resetAllData')?.addEventListener('click', async () => {
      if (confirm('¿Estás seguro? Esto borrará TODO tu progreso, pesos, historial, fotos, medidas, notas y ejercicios personalizados. No se puede deshacer.')) {
        if (confirm('Confirmación final: ¿Borrar todos los datos de entrenamiento?')) {
          await db.resetAllTrainingData()
          renderDaySelector()
          renderWorkout(currentDay)
          renderProgress()
          renderPhotos()
          renderMeasures()
          renderSettings()
          showToast('Todos los datos de entrenamiento borrados')
        }
      }
    })

    /* Notifications toggle */
    const notifToggle = document.getElementById('notifToggle')
    const notifTimeSection = document.getElementById('notifTimeSection')
    notifToggle?.addEventListener('change', () => {
      localStorage.setItem('gymapp_notif_enabled', notifToggle.checked)
      notifTimeSection.style.display = notifToggle.checked ? '' : 'none'
      if (notifToggle.checked) Notification.requestPermission()
    })
    document.getElementById('testNotifBtn')?.addEventListener('click', () => {
      if (Notification.permission === 'granted') {
        new Notification('Kinetic Glass', { body: 'Recordatorio configurado correctamente', icon: '/icon.svg' })
      } else {
        Notification.requestPermission().then(p => {
          if (p === 'granted') new Notification('Kinetic Glass', { body: 'Notificaciones activadas', icon: '/icon.svg' })
        })
      }
    })
    document.getElementById('notifTime')?.addEventListener('change', function () {
      localStorage.setItem('gymapp_notif_time', this.value)
    })
  }

  window.saveTrainingPrefs = function() {
    const profile = db.getProfile()
    profile.goal = document.getElementById('goalSelect').value
    profile.experienceLevel = document.getElementById('experienceSelect').value
    profile.preferredDays = parseInt(document.getElementById('daysSelect').value, 10)
    if (document.getElementById('splitSelect')) {
      profile.splitPreference = document.getElementById('splitSelect').value
    }
    db.setProfile(profile)
  }

  window.activateDynamicPlans = function() {
    const profile = db.getProfile()
    profile.dynamicPlansEnabled = true
    db.setProfile(profile)
    db.generateNewPlan()
    renderSettings()
  }

  window.regeneratePlan = function() {
    db.generateNewPlan()
    renderSettings()
  }

  function showCustomDayForm(editIdx) {
    const formDiv = document.getElementById('customDayForm')
    if (!formDiv) return
    const existing = editIdx >= 0 ? db.getCustomDays()[editIdx] : null
    const dayName = existing ? existing.name : ''
    const exercises = existing ? existing.exercises : [{ name: '', machine: '', sets: 3, reps: '8-12', rest: 90, rir: 2, muscle: '', video: '' }]

    let html = '<div style="background:var(--surface2);padding:0.75rem;border-radius:var(--radius-xs);">'
    html += '<label style="display:block;margin-bottom:0.5rem;font-size:0.85rem;">Nombre de la rutina<input type="text" id="cdName" class="settings-token-input" value="' + esc(dayName) + '" placeholder="Ej: Full Body" style="margin-top:0.25rem;"></label>'
    html += '<div style="font-size:0.85rem;color:var(--text-dim);margin-bottom:0.5rem;">Ejercicios:</div>'
    html += '<div id="cdExList">'
    exercises.forEach((ex, ei) => {
      html += '<div class="cd-ex-row" data-idx="' + ei + '" style="background:var(--surface3);padding:0.5rem;border-radius:var(--radius-xs);margin-bottom:0.35rem;">'
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.3rem;font-size:0.8rem;">'
      html += '<label>Nombre<input type="text" class="cd-ex-name" value="' + esc(ex.name) + '" placeholder="Press banca" style="width:100%;"></label>'
      html += '<label>Máquina ID<input type="text" class="cd-ex-machine" value="' + esc(ex.machine) + '" placeholder="pressBanca" style="width:100%;"></label>'
      html += '<label>Series<input type="number" class="cd-ex-sets" value="' + ex.sets + '" min="1" max="20" style="width:100%;"></label>'
      html += '<label>Reps<input type="text" class="cd-ex-reps" value="' + esc(ex.reps) + '" placeholder="8-12" style="width:100%;"></label>'
      html += '<label>Descanso (s)<input type="number" class="cd-ex-rest" value="' + ex.rest + '" min="0" step="5" style="width:100%;"></label>'
      html += '<label>RIR<input type="number" class="cd-ex-rir" value="' + ex.rir + '" min="0" max="5" style="width:100%;"></label>'
      html += '<label>Músculo<input type="text" class="cd-ex-muscle" value="' + esc(ex.muscle) + '" placeholder="Pecho" style="width:100%;"></label>'
      html += '<label>Video (ID)<input type="text" class="cd-ex-video" value="' + esc(ex.video || '') + '" placeholder="YouTube ID" style="width:100%;"></label>'
      html += '</div>'
      if (exercises.length > 1) {
        html += '<button class="reset-btn cd-remove-ex" data-idx="' + ei + '" style="margin-top:0.3rem;font-size:0.7rem;padding:0.1rem 0.4rem;color:var(--primary);">Quitar ejercicio</button>'
      }
      html += '</div>'
    })
    html += '</div>'
    html += '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;flex-wrap:wrap;">'
    html += '<button class="reset-btn" id="cdAddEx" style="font-size:0.8rem;">Agregar ejercicio</button>'
    html += '<button class="reset-btn" id="cdSave" style="background:var(--primary);color:#fff;border-color:var(--primary);font-size:0.8rem;">Guardar rutina</button>'
    html += '<button class="reset-btn" id="cdCancel" style="font-size:0.8rem;">Cancelar</button>'
    html += '</div></div>'
    formDiv.innerHTML = html
    formDiv.style.display = 'block'

    document.getElementById('cdAddEx')?.addEventListener('click', () => {
      const rows = formDiv.querySelectorAll('.cd-ex-row')
      const div = document.createElement('div')
      div.className = 'cd-ex-row'
      div.style.cssText = 'background:var(--surface3);padding:0.5rem;border-radius:var(--radius-xs);margin-bottom:0.35rem;'
      div.innerHTML = [
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.3rem;font-size:0.8rem;">',
        '<label>Nombre<input type="text" class="cd-ex-name" value="" placeholder="Press banca" style="width:100%;"></label>',
        '<label>Máquina ID<input type="text" class="cd-ex-machine" value="" placeholder="pressBanca" style="width:100%;"></label>',
        '<label>Series<input type="number" class="cd-ex-sets" value="3" min="1" max="20" style="width:100%;"></label>',
        '<label>Reps<input type="text" class="cd-ex-reps" value="8-12" placeholder="8-12" style="width:100%;"></label>',
        '<label>Descanso (s)<input type="number" class="cd-ex-rest" value="90" min="0" step="5" style="width:100%;"></label>',
        '<label>RIR<input type="number" class="cd-ex-rir" value="2" min="0" max="5" style="width:100%;"></label>',
        '<label>Músculo<input type="text" class="cd-ex-muscle" value="" placeholder="Pecho" style="width:100%;"></label>',
        '<label>Video (ID)<input type="text" class="cd-ex-video" value="" placeholder="YouTube ID" style="width:100%;"></label>',
        '</div>',
        '<button class="reset-btn cd-remove-ex" style="margin-top:0.3rem;font-size:0.7rem;padding:0.1rem 0.4rem;color:var(--primary);">Quitar ejercicio</button>',
      ].join('')
      document.getElementById('cdExList').appendChild(div)
      div.querySelector('.cd-remove-ex')?.addEventListener('click', () => {
        div.remove()
      })
    })

    formDiv.querySelectorAll('.cd-remove-ex').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.cd-ex-row').remove()
      })
    })

    document.getElementById('cdSave')?.addEventListener('click', () => {
      const name = document.getElementById('cdName').value.trim()
      if (!name) { showToast('El nombre de la rutina es obligatorio'); return }
      const rows = formDiv.querySelectorAll('.cd-ex-row')
      const exs = []
      rows.forEach(row => {
        const name = row.querySelector('.cd-ex-name')?.value.trim()
        const machine = row.querySelector('.cd-ex-machine')?.value.trim()
        const sets = parseInt(row.querySelector('.cd-ex-sets')?.value, 10) || 3
        const reps = row.querySelector('.cd-ex-reps')?.value.trim() || '8-12'
        const rest = parseInt(row.querySelector('.cd-ex-rest')?.value, 10) || 90
        const rir = parseInt(row.querySelector('.cd-ex-rir')?.value, 10)
        const muscle = row.querySelector('.cd-ex-muscle')?.value.trim()
        const video = row.querySelector('.cd-ex-video')?.value.trim()
        if (name && machine) exs.push({ name, machine, sets, reps, rest, rir, muscle, video })
      })
      if (!exs.length) { showToast('Agrega al menos un ejercicio con nombre y máquina'); return }
      const days = db.getCustomDays()
      if (editIdx >= 0) {
        days[editIdx] = { name, exercises: exs }
      } else {
        days.push({ name, exercises: exs })
      }
      db.setCustomDays(days)
      renderSettings()
      renderDaySelector()
      showToast('Rutina guardada')
    })

    document.getElementById('cdCancel')?.addEventListener('click', () => {
      formDiv.style.display = 'none'
      formDiv.innerHTML = ''
    })
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function renderCalendar() {
    const wrap = document.getElementById('calendarWrap')
    if (!wrap) return
    const trainingDates = db.getTrainingDates()
    const trainedSet = new Set(trainingDates)
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + _calMonthOffset
    const mDate = new Date(year, month, 1)
    const mYear = mDate.getFullYear()
    const mMonth = mDate.getMonth()
    const daysInMonth = new Date(mYear, mMonth + 1, 0).getDate()
    const firstDay = mDate.getDay()
    const todayStr = now.toISOString().split('T')[0]
    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

    let html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">'
    html += '<button class="reset-btn" id="calPrev" aria-label="Mes anterior" style="font-size:1.1rem;padding:0.25rem 0.6rem;">◀</button>'
    html += '<strong style="font-size:0.95rem;">' + monthNames[mMonth] + ' ' + mYear + '</strong>'
    html += '<button class="reset-btn" id="calNext" aria-label="Mes siguiente" style="font-size:1.1rem;padding:0.25rem 0.6rem;">▶</button>'
    html += '</div>'

    html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;font-size:0.75rem;">'
    ;['Do','Lu','Ma','Mi','Ju','Vi','Sa'].forEach(d => {
      html += '<div style="color:var(--text-muted);padding:0.25rem 0;font-weight:600;">' + d + '</div>'
    })
    for (let i = 0; i < firstDay; i++) {
      html += '<div></div>'
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = mYear + '-' + String(mMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0')
      const isToday = dateStr === todayStr
      const hasTraining = trainedSet.has(dateStr)
      html += '<div style="position:relative;padding:0.35rem 0;border-radius:var(--radius-xs);' +
        (isToday ? 'background:var(--primary);color:#fff;font-weight:700;' : '') + '">'
      html += '<span>' + d + '</span>'
      if (hasTraining) {
        html += '<div style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:5px;height:5px;border-radius:50%;background:' +
          (isToday ? '#fff' : 'var(--green)') + ';"></div>'
      }
      html += '</div>'
    }
    html += '</div>'
    wrap.innerHTML = html

    document.getElementById('calPrev')?.addEventListener('click', () => { _calMonthOffset--; renderCalendar() })
    document.getElementById('calNext')?.addEventListener('click', () => { _calMonthOffset++; renderCalendar() })
  }

  /* Start with login screen */
  initLoginScreen()
})()
