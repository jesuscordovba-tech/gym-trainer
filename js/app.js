;(() => {
  let currentDay = 0
  let timerInterval = null
  let audioCtx = null

  const DAY_LABELS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

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
    const hasToken = db.hasToken()

    if (!hasToken) {
      box.innerHTML = `
        <h1>💪 <span>GYM</span>TRAINER</h1>
        <p style="color:var(--text-dim);font-size:0.85rem;margin-bottom:1.25rem;">
          Para usar la app necesitas un token de GitHub con scope <strong>gist</strong>.
        </p>
        <input type="password" id="tokenSetupInput" class="lock-input" placeholder="ghp_..." autocomplete="off" style="letter-spacing:0;font-size:0.9rem;-webkit-text-security:none;">
        <div class="lock-error" id="lockError"></div>
        <button class="lock-btn" id="tokenSetupBtn">Guardar Token</button>
      `

      document.getElementById('tokenSetupBtn').onclick = () => {
        const t = document.getElementById('tokenSetupInput').value.trim()
        if (!t) { document.getElementById('lockError').textContent = 'Ingresa un token'; return }
        db.setToken(t)
        initLoginScreen()
      }
      document.getElementById('tokenSetupInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('tokenSetupBtn').click()
      })
      document.getElementById('tokenSetupInput').focus()
      return
    }

    let users = []
    try { users = await db.getUsers() } catch {}

    const savedUser = localStorage.getItem('gymapp_current_user')
    const savedPin = localStorage.getItem('gymapp_pin')

    box.innerHTML = `
      <h1>💪 <span>GYM</span>TRAINER</h1>
      <div id="loginMode" style="font-size:0.85rem;color:var(--text-dim);margin-bottom:1rem;"></div>
      <div id="loginUsers" style="margin-bottom:1rem;${users.length === 0 ? 'display:none' : ''}">
        <label style="font-size:0.75rem;color:var(--text-dim);display:block;text-align:left;margin-bottom:0.3rem;">Usuario existente:</label>
        <div style="display:flex;flex-wrap:wrap;gap:0.4rem;justify-content:center;">
          ${users.map(u => `<button class="login-user-btn" data-user="${esc(u)}" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:0.4rem 0.8rem;border-radius:var(--radius-sm);cursor:pointer;font-size:0.85rem;">${esc(u)}</button>`).join('')}
        </div>
        <div style="margin:0.5rem 0;text-align:center;color:var(--text-dim);font-size:0.75rem;">— o nuevo usuario —</div>
      </div>
      <input type="text" id="loginUsername" class="lock-input" placeholder="Usuario" autocomplete="username" style="letter-spacing:0;font-size:1rem;-webkit-text-security:none;">
      <input type="password" id="loginPin" class="lock-input" placeholder="PIN" maxlength="6" inputmode="numeric" pattern="[0-9]*" autocomplete="new-password">
      <input type="password" id="loginPin2" class="lock-input" placeholder="Confirmar PIN" maxlength="6" inputmode="numeric" pattern="[0-9]*" autocomplete="new-password" style="display:none;">
      <div class="lock-error" id="lockError"></div>
      <button class="lock-btn" id="lockBtn">Entrar</button>
      <div class="lock-hint" style="margin-top:0.5rem;"><button id="changeTokenLink">Cambiar token de GitHub</button></div>
    `

    const usernameInput = document.getElementById('loginUsername')
    const pinInput = document.getElementById('loginPin')
    const pin2Input = document.getElementById('loginPin2')
    const btn = document.getElementById('lockBtn')
    const error = document.getElementById('lockError')
    const modeLabel = document.getElementById('loginMode')

    let mode = 'login'

    function setMode(m) {
      mode = m
      if (mode === 'register') {
        modeLabel.textContent = '🆕 Crear nuevo usuario'
        pin2Input.style.display = ''
        btn.textContent = 'Registrarse'
      } else {
        modeLabel.textContent = '🔐 Inicia sesión'
        pin2Input.style.display = 'none'
        btn.textContent = 'Entrar'
      }
    }
    setMode(users.length === 0 ? 'register' : 'login')

    box.querySelectorAll('.login-user-btn').forEach(b => {
      b.addEventListener('click', () => {
        usernameInput.value = b.dataset.user
        pinInput.focus()
      })
    })

    if (savedUser && savedPin) {
      usernameInput.value = savedUser
      pinInput.value = savedPin
      btn.click()
      return
    }

    btn.onclick = async () => {
      const username = usernameInput.value.trim().toLowerCase()
      const pin = pinInput.value.trim()
      const pin2 = pin2Input.value.trim()

      if (!username || !pin) { error.textContent = 'Completa todos los campos'; return }

      if (mode === 'register') {
        if (pin.length < 4) { error.textContent = 'PIN mínimo 4 dígitos'; return }
        if (pin !== pin2) { error.textContent = 'Los PIN no coinciden'; return }
        btn.disabled = true
        btn.textContent = 'Registrando...'
        const result = await db.registerUser(username, pin, createDefaultProfile())
        if (result.ok) {
          const login = await db.loginUser(username, pin)
          if (login.ok) {
            screen.classList.add('hidden')
            initApp()
          } else {
            error.textContent = login.error
            btn.disabled = false
            btn.textContent = 'Registrarse'
          }
        } else {
          error.textContent = result.error || 'Error al registrar'
          btn.disabled = false
          btn.textContent = 'Registrarse'
        }
      } else {
        btn.disabled = true
        btn.textContent = 'Entrando...'
        const result = await db.loginUser(username, pin)
        if (result.ok) {
          screen.classList.add('hidden')
          initApp()
        } else {
          error.textContent = result.error
          btn.disabled = false
          btn.textContent = 'Entrar'
        }
      }
    }

    document.getElementById('changeTokenLink')?.addEventListener('click', () => {
      db.setToken('')
      initLoginScreen()
    })

    pinInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        if (mode === 'register') pin2Input.focus()
        else btn.click()
      }
    })
    pin2Input.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click() })
    usernameInput.addEventListener('keydown', e => { if (e.key === 'Enter') pinInput.focus() })
    usernameInput.focus()
  }

  function showToast(msg) {
    const existing = document.querySelector('.week-toast')
    if (existing) existing.remove()
    const t = document.createElement('div')
    t.className = 'week-toast'
    t.textContent = msg
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
    if (wasReset) { showToast('🔄 Nueva semana — progreso reiniciado') }
    db.archiveCurrentWeek()

    let totalSets = 0
    const progress = db.getProgress()
    for (const k in progress) { const d = progress[k]; if (d) for (const ek in d) totalSets += d[ek] || 0 }
    if (totalSets > 0) recordTrainingDay()

    renderNav()
    renderDaySelector()
    renderWorkout(currentDay)
    renderMachines()
    renderProgress()
    renderDiet()
    renderSettings()
    setupTimer()
    setupVideo()

    db.onUpdate(() => {
      renderDaySelector()
      renderWorkout(currentDay)
      renderProgress()
    })

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') hideTimer()
    })
  }

  function renderNav() {
    const nav = document.getElementById('mainNav')
    nav.addEventListener('click', e => {
      const btn = e.target.closest('[data-tab]')
      if (!btn) return
      document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'))
      document.getElementById(btn.dataset.tab).classList.remove('hidden')
    })

    // Add logout button to header
    const header = document.querySelector('.header-inner')
    if (!document.getElementById('logoutBtn')) {
      const lb = document.createElement('button')
      lb.id = 'logoutBtn'
      lb.textContent = '🚪'
      lb.style.cssText = 'background:none;border:none;font-size:1.2rem;cursor:pointer;opacity:0.6;margin-left:auto;'
      lb.title = 'Cerrar sesión'
      lb.addEventListener('click', () => {
        if (confirm('¿Cerrar sesión?')) {
          db.logoutUser()
          localStorage.removeItem('gymapp_pin')
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
    workoutPlan.days.forEach((d, i) => {
      const p = progress[i] || {}
      const completedSets = Object.values(p).reduce((a, b) => a + (b || 0), 0)
      const totalSets = d.exercises.reduce((a, ex) => a + ex.sets, 0)
      const card = document.createElement('div')
      card.className = `day-card ${i === currentDay ? 'active' : ''}`
      card.innerHTML = `
        <div class="day-label">${DAY_LABELS[i] || 'DÍA ' + (i + 1)}</div>
        <div class="day-name">${d.name.split(' — ')[0]}</div>
        <div class="day-focus">${completedSets}/${totalSets} series</div>
      `
      card.addEventListener('click', () => {
        currentDay = i
        renderDaySelector()
        renderWorkout(i)
      })
      grid.appendChild(card)
    })
  }

  const DEFAULT_KG = {
    'press-pecho-sentado': 30, 'press-hombros-sentado': 20, 'press-inclinado-sentado': 25, 'press-declinado-sentado': 25,
    'maquina-convergente-pecho': 30, 'pec-deck': 25,
    'jalon-amplio': 40, 'jalon-neutro': 40, 'remo-articulado': 35, 'remo-sentado-polea': 35, 'remo-unilateral': 25,
    'dominadas-asistidas': 50, 'reverse-pec-deck': 20, 'pullover-maquina': 25,
    'hack-squat': 40, 'hack-invertida': 40, 'prensa-45': 80, 'prensa-horizontal': 60,
    'curl-femoral-acostado': 30, 'curl-femoral-sentado': 25, 'extension-piernas': 35,
    'pantorrillas-pie': 50, 'pantorrillas-sentado': 30,
    'curl-biceps-maquina': 20, 'curl-scott-maquina': 20, 'polea-baja-biceps': 15,
    'extension-triceps-polea-alta': 15, 'extension-triceps-cabeza-polea': 12, 'fondos-asistidos': 50, 'maquina-fondos-triceps': 20,
    'elevacion-lateral-maquina': 12, 'polea-elevaciones-laterales': 10,
    'crunch-maquina': 20, 'elevacion-piernas': 15, 'silla-romana': 15,
    'aductores': 30, 'smith-sentadillas': 30,
  }

  function recommendWeight(ex, currentKg, allDone) {
    if (!allDone || !currentKg) return null
    const w = parseFloat(currentKg)
    if (!w || w <= 0) return null
    const inc = ex.rir <= 1 ? 2.5 : 1.25
    return Math.round((w + inc) * 10) / 10
  }

  function renderWorkout(dayIndex) {
    const d = workoutPlan.days[dayIndex]
    if (!d) return
    const container = document.getElementById('workoutContent')
    const progress = db.getProgress()
    const weights = db.getWeights()
    const dayProgress = progress[dayIndex] || {}

    let html = [
      '<div class="workout-header">',
      '<h2>' + esc(d.name) + '</h2>',
      '<div class="focus">' + esc(d.focus) + '</div>',
      '</div>',
      '<div class="warmup-box"><strong>🔥 Calentamiento:</strong> ' + esc(d.warmup) + '</div>',
    ].join('')

    d.exercises.forEach((ex, exIdx) => {
      const setsCompleted = dayProgress[exIdx] || 0
      const allDone = setsCompleted >= ex.sets
      const machine = gymData.getMachineById(ex.machine)
      const weight = weights[dayIndex + '-' + exIdx] || ''
      const defaultKg = DEFAULT_KG[ex.machine] || null
      const nextW = recommendWeight(ex, weight, allDone)

      html += '<div class="exercise-item" data-day="' + dayIndex + '" data-ex="' + exIdx + '">'
      html += '<div class="exercise-top">'
      html += '<div class="exercise-info">'
      html += '<div class="exercise-name">' + esc(ex.name)
      if (ex.supersetWith) html += '<span class="superset-badge">SUPERSET</span>'
      html += '</div>'
      html += '<div class="exercise-meta">'
      html += '<span>🔁 ' + ex.sets + '×' + esc(ex.reps) + '</span>'
      html += '<span>⏱ ' + ex.rest + 's</span>'
      html += '<span>📌 RIR ' + ex.rir + '</span>'
      html += '</div>'
      html += '<div>'
      html += '<span class="machine-badge">' + esc(machine ? machine.name : ex.machine) + '</span>'
      html += '<span class="muscle-badge">' + esc(ex.muscle) + '</span>'
      html += '</div>'
      html += '<div class="weight-input-row">'
      html += '<label class="weight-label">Carga (kg):</label>'
      html += '<input type="number" class="weight-input" value="' + weight + '" data-day="' + dayIndex + '" data-ex="' + exIdx + '" placeholder="kg">'
      if (!weight && defaultKg) html += '<span class="weight-suggest">Inicia: ' + defaultKg + ' kg</span>'
      else if (nextW) html += '<span class="weight-rec">⬆ ' + nextW + ' kg</span>'
      html += '</div></div>'
      html += '<div class="exercise-controls">'
      html += '<div class="set-tracker">'
      for (let s = 0; s < ex.sets; s++) {
        html += '<button class="set-dot ' +
          (s < setsCompleted ? 'completed' : s === setsCompleted ? 'current' : '') +
          '" data-day="' + dayIndex + '" data-ex="' + exIdx + '" data-set="' + s + '">' +
          (s + 1) + '</button>'
      }
      html += '</div>'
      html += '<button class="rest-timer-btn" data-rest="' + ex.rest + '">⏱ ' + ex.rest + 's</button>'
      html += '</div></div>'
      if (ex.video) {
        html += '<div class="exercise-video-placeholder" data-video="' + esc(ex.video) + '"><span>▶</span></div>'
      }
      html += '</div>'
    })

    html += [
      '<div class="cardio-card">',
      '<h3>🏃 Cardio — ' + esc(d.cardio.type) + '</h3>',
      '<div class="cardio-detail">',
      '<div class="cardio-item"><strong>Máquina</strong>' + esc(gymData.getMachineById(d.cardio.machine)?.name || d.cardio.machine) + '</div>',
      '<div class="cardio-item"><strong>Duración</strong>' + esc(d.cardio.duration) + '</div>',
      '<div class="cardio-item"><strong>Protocolo</strong>' + esc(d.cardio.protocol) + '</div>',
      '</div></div>',
      '<div class="cooldown-box"><strong>🧘 Enfriamiento:</strong> ' + esc(d.cooldown) + '</div>',
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
    container.querySelectorAll('.exercise-video-placeholder').forEach(el => {
      el.addEventListener('click', function () {
        const id = this.dataset.video
        if (!id) return
        this.innerHTML = '<div class="exercise-video"><iframe src="https://www.youtube.com/embed/' + id + '?mute=1&autoplay=1&controls=1&rel=0&loop=1" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"></iframe></div>'
      })
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
  }

  function handleSetClick(e) {
    const btn = e.currentTarget
    const day = parseInt(btn.dataset.day)
    const ex = parseInt(btn.dataset.ex)
    const setIdx = parseInt(btn.dataset.set)
    const progress = db.getProgress()

    if (!progress[day]) progress[day] = {}
    const setsCompleted = progress[day][ex] || 0

    if (setIdx < setsCompleted) {
      progress[day][ex] = setIdx
    } else if (setIdx === setsCompleted) {
      progress[day][ex] = (progress[day][ex] || 0) + 1
    } else {
      return
    }

    const maxSets = workoutPlan.days[day].exercises[ex].sets
    if (progress[day][ex] > maxSets) progress[day][ex] = maxSets

    if (progress[day][ex] > setsCompleted) recordTrainingDay()
    db.setProgress(progress)
    renderDaySelector()
    renderWorkout(day)
    renderProgress()

    const restBtn = e.currentTarget.closest('.exercise-item').querySelector('.rest-timer-btn')
    if (restBtn && (progress[day][ex] || 0) > 0 && (progress[day][ex] || 0) < maxSets) {
      startTimer.call(restBtn)
    }
  }

  function handleWeightChange(e) {
    const inp = e.currentTarget
    const key = inp.dataset.day + '-' + inp.dataset.ex
    const weights = db.getWeights()
    if (inp.value) {
      weights[key] = inp.value
    } else {
      delete weights[key]
    }
    db.setWeights(weights)
  }

  function setupTimer() {
    document.getElementById('timerOverlay').addEventListener('click', e => {
      if (e.target === e.currentTarget) hideTimer()
    })
    document.getElementById('timerSkip').addEventListener('click', hideTimer)
    document.getElementById('timerStop').addEventListener('click', hideTimer)
  }

  function startTimer() {
    showTimer(parseInt(this.dataset.rest) || 60)
  }

  function showTimer(seconds) {
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
      if (remaining <= 0) {
        clearInterval(timerInterval)
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
  }

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

  function openVideo(e) {
    const url = e.currentTarget.dataset.video
    const iframe = document.getElementById('videoIframe')
    if (!url || !iframe) { console.warn('Video error: no url or iframe', { url, iframe }); return }
    const embedUrl = url.match(/^https?:\/\//) ? url : 'https://www.youtube.com/embed/' + url + '?autoplay=1'
    document.getElementById('videoModalTitle').textContent = '📺 Demostración'
    iframe.src = embedUrl
    document.getElementById('videoOverlay').classList.add('show')
  }

  function closeVideo() {
    document.getElementById('videoOverlay').classList.remove('show')
    document.getElementById('videoIframe').src = ''
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
      { key: 'cardio', label: 'Cardio', icon: '🏃' },
      { key: 'pecho', label: 'Pecho', icon: '💪' },
      { key: 'espalda', label: 'Espalda', icon: '🔙' },
      { key: 'hombros', label: 'Hombros', icon: '🏋️' },
      { key: 'biceps', label: 'Bíceps', icon: '💪' },
      { key: 'triceps', label: 'Tríceps', icon: '💪' },
      { key: 'piernas', label: 'Piernas', icon: '🦵' },
      { key: 'abdominales', label: 'Abdominales', icon: '🧠' },
      { key: 'pesoLibre', label: 'Peso Libre', icon: '🏋️' },
      { key: 'funcional', label: 'Funcional', icon: '⚡' },
    ]

    let html = ''
    categories.forEach(cat => {
      const machines = gymData.machines[cat.key]
      if (!machines || !machines.length) return
      html += '<div class="category-section">'
      html += '<div class="category-title">' + cat.icon + ' ' + esc(cat.label) + '</div>'
      html += '<div class="machine-grid">'
      machines.forEach(m => {
        html += '<div class="machine-item">' + esc(m.name) + '</div>'
      })
      html += '</div></div>'
    })
    container.innerHTML = html
  }

  function renderProgress() {
    const container = document.getElementById('progressContent')
    const progress = db.getProgress()
    let totalSetsDone = 0
    let totalSets = 0
    let totalWorkouts = 0
    let daysCompleted = 0

    workoutPlan.days.forEach((d, i) => {
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

    const pct = totalSets > 0 ? Math.round((totalSetsDone / totalSets) * 100) : 0

    const now = new Date()
    const weekNum = getISOWeek(now)
    const trainingDays = getTrainingCount()

    let html = [
      '<h2>📊 Tu Progreso</h2>',
      '<div class="week-info-bar">',
      '<span>📅 ' + esc(formatDate(now)) + '</span>',
      '<span>📆 Semana ' + weekNum + ' de ' + now.getFullYear() + '</span>',
      '<span>🏋️ ' + trainingDays + ' día' + (trainingDays !== 1 ? 's' : '') + ' entrenando</span>',
      '</div>',
      '<div class="progress-stats">',
      '<div class="stat-card"><div class="stat-value">' + pct + '%</div><div class="stat-label">Progreso global</div></div>',
      '<div class="stat-card"><div class="stat-value">' + totalSetsDone + '</div><div class="stat-label">Series completadas</div></div>',
      '<div class="stat-card"><div class="stat-value">' + totalWorkouts + '/' + workoutPlan.days.length + '</div><div class="stat-label">Entrenos iniciados</div></div>',
      '<div class="stat-card"><div class="stat-value">' + daysCompleted + '</div><div class="stat-label">Días completados</div></div>',
      '</div>',
      '<h3>Detalle por día</h3>',
    ].join('')

    workoutPlan.days.forEach((d, i) => {
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

    html += [
      '<div class="reset-day-wrap">',
      '<button class="reset-btn" id="resetAll">Reiniciar todo el progreso</button>',
      '</div>',
    ].join('')

    /* === Year history === */
    const year = now.getFullYear()
    const yearStats = db.getYearStats(year)
    const historyData = db.getHistory()
    const yearWeeks = Object.keys(historyData).filter(k => k.startsWith(year + '-W')).sort()

    if (yearWeeks.length > 0) {
      html += '<h3 style="margin-top:2rem;">📆 Historial ' + year + '</h3>'
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

    document.getElementById('resetAll')?.addEventListener('click', () => {
      if (confirm('¿Reiniciar TODO el progreso? Esta acción no se puede deshacer.')) {
        db.setProgress({})
        db.setWeights({})
        renderDaySelector()
        renderWorkout(currentDay)
        renderProgress()
      }
    })
  }

  /* Diet */
  function renderDiet() {
    const container = document.getElementById('dietContent')
    const profile = db.getProfile()
    if (!profile) { container.innerHTML = '<p>Completa tu perfil en Ajustes para ver el plan de alimentación.</p>'; return }
    const plan = dietPlan.getMealPlan(profile)
    const m = plan.macros

    let html = [
      '<h2>🥗 Plan de Alimentación</h2>',
      '<div class="diet-macro-bar">',
      '<div class="diet-macro"><span class="diet-macro-label">Calorías</span><span class="diet-macro-val">' + m.calories + ' kcal</span></div>',
      '<div class="diet-macro"><span class="diet-macro-label">Proteína</span><span class="diet-macro-val">' + m.protein + ' g</span></div>',
      '<div class="diet-macro"><span class="diet-macro-val carbs">' + m.carbs + ' g</span><span class="diet-macro-label">Carbohidratos</span></div>',
      '<div class="diet-macro"><span class="diet-macro-val fat">' + m.fat + ' g</span><span class="diet-macro-label">Grasas</span></div>',
      '</div>',
      '<p class="diet-subtext">Distribución basada en evidencia científica. Proteína ~2g/kg, Grasa ~0.9g/kg, resto carbohidratos.</p>',
      '<p class="diet-rotation">🔄 Los ejemplos rotan automáticamente cada día — ' + esc(formatDate(new Date())) + '</p>',
    ].join('')

    plan.structure.forEach((meal, i) => {
      const cal = plan.calPerMeal[i]
      const protein = Math.round(m.protein * meal.pct)
      const carbs = Math.round(m.carbs * meal.pct)
      const fat = Math.round(m.fat * meal.pct)

      html += '<div class="diet-meal-card">'
      html += '<div class="diet-meal-header">' + meal.icon + ' ' + esc(meal.name) + '<span class="diet-meal-cal">' + cal + ' kcal</span></div>'
      html += '<div class="diet-meal-macros">P: ' + protein + 'g · C: ' + carbs + 'g · G: ' + fat + 'g</div>'
      html += '<div class="diet-meal-examples-title">🔹 Ejemplos (elige 1 por comida):</div>'
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

    html += '<div class="diet-refs">'
    html += '<h3>📚 Referencias científicas</h3>'
    dietPlan.nutritionists.forEach(n => {
      html += '<div class="diet-ref"><strong>' + esc(n.name) + '</strong> — ' + esc(n.title) + '<br><span class="diet-ref-cite">' + esc(n.cite) + '</span></div>'
    })
    html += '</div>'

    container.innerHTML = html
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
      '<h2>⚙️ Ajustes</h2>',
      '<div class="card">',
      '<div class="card-title">👤 Tu Perfil — <span style="color:var(--primary)">' + esc(username) + '</span></div>',
      '<div class="settings-edit-grid">',
      '<label>Edad <input type="number" id="editAge" value="' + profile.age + '" min="10" max="120"></label>',
      '<label>Altura (cm) <input type="number" id="editHeight" value="' + profile.heightCm + '" min="100" max="250"></label>',
      '<label>Peso (lb) <input type="number" id="editWeight" value="' + profile.weightLb + '" min="50" max="500"></label>',
      '<label>Género <select id="editGender"><option value="M"' + (profile.gender === 'M' ? ' selected' : '') + '>Masculino</option><option value="F"' + (profile.gender === 'F' ? ' selected' : '') + '>Femenino</option></select></label>',
      '</div>',
      '<button class="reset-btn" id="saveProfileBtn" style="margin-top:0.75rem;">Guardar Perfil</button>',
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
      '<div><span class="settings-field-label settings-deficit">🔥 Déficit sugerido</span><strong class="settings-field-value settings-deficit-val" id="dispDeficit">' + profile.deficitCalories + ' kcal/día</strong></div>',
      '<div><span class="settings-field-label">Peso ideal aprox</span><strong class="settings-field-value">' + idealW + ' kg (' + Math.round(idealW * 2.205) + ' lb)</strong></div>',
      '</div>',
      '<p class="settings-diet-tip">',
      '🍗 Come ~' + profile.deficitCalories + ' kcal/día con alta proteína (1.6-2.2g/kg) para perder grasa sin perder músculo.</p>',
      '</div>',

      /* Sync section */
      '<div class="card">',
      '<div class="card-title">☁️ Sincronización en la nube</div>',
      '<p class="settings-description">',
      'Los datos se encriptan localmente con tu PIN antes de enviarse a un Gist privado de GitHub.',
      ' Nadie puede leerlos sin tu PIN.</p>',
      '<div class="settings-token-section">',
      '<label class="settings-token-label">Token de GitHub (scope: gist):</label>',
      '<div class="settings-token-row">',
      '<input type="password" id="tokenInput" class="settings-token-input" value="' + esc(token) + '" placeholder="ghp_...">',
      '<button id="saveTokenBtn" class="reset-btn settings-save-btn">',
      hasToken ? 'Actualizar' : 'Conectar', '</button>',
      '</div></div>',
      '<div id="syncStatus" class="settings-sync-status"></div>',
      '<p class="settings-gist-id">',
      'Gist ID: <code>' + db.gistId + '</code></p>',
      '</div>',

      /* Security info */
      '<div class="card">',
      '<div class="card-title">🛡️ Seguridad</div>',
      '<ul class="settings-security-list">',
      '<li>🔐 Datos encriptados con AES-256-GCM antes de subir</li>',
      '<li>📡 Comunicación HTTPS con GitHub API</li>',
      '<li>🛡️ Content Security Policy activa</li>',
      '<li>💾 Token guardado solo en tu navegador</li>',
      '</ul>',
      '</div>',
    ].join('')

    /* Event listeners */
    document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
      const p = createDefaultProfile()
      p.age = parseInt(document.getElementById('editAge').value) || 21
      p.heightCm = parseInt(document.getElementById('editHeight').value) || 175
      p.weightLb = parseInt(document.getElementById('editWeight').value) || 165
      p.gender = document.getElementById('editGender').value
      await db.setProfile(p)
      renderSettings()
      renderDiet()
    })

    const tokenInput = document.getElementById('tokenInput')
    const saveBtn = document.getElementById('saveTokenBtn')
    const syncStatus = document.getElementById('syncStatus')

    saveBtn?.addEventListener('click', async () => {
      const newToken = tokenInput.value.trim()
      if (!newToken) return

      db.setToken(newToken)
      syncStatus.textContent = '🔄 Token guardado. Los datos se subirán automáticamente.'
      syncStatus.style.color = 'var(--green)'
    })
  }

  /* Start with login screen */
  initLoginScreen()
})()
