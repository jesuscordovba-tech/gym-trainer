;(() => {
  let progress = db.getProgress()
  let weights = db.getWeights()
  let currentDay = 0
  let timerInterval = null
  let cloudReady = false
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

  function refreshData() {
    progress = db.getProgress()
    weights = db.getWeights()
  }

  function save() {
    db.setProgress(progress)
    db.setWeights(weights)
  }

  /* === LOCK SCREEN (mismo PIN en todos los dispositivos) === */
  async function initLockScreen() {
    const screen = document.getElementById('lockScreen')
    const input = document.getElementById('lockInput')
    const btn = document.getElementById('lockBtn')
    const error = document.getElementById('lockError')
    const subtitle = document.getElementById('lockSubtitle')
    const hint = document.getElementById('lockHint')

    const firstTime = !auth.isLocked()
    let attempts = 0

    if (firstTime) {
      subtitle.textContent = 'Crea tu PIN (4-6 dígitos) — úsalo en todos tus dispositivos'
      hint.textContent = 'Este PIN también encripta tus datos en la nube.'
      btn.textContent = 'Listo'
    } else {
      subtitle.textContent = 'Ingresa tu PIN'
      hint.innerHTML = '¿Olvidaste tu PIN? <button id="resetPinBtn">Restablecer</button>'
      btn.textContent = 'Entrar'
    }

    btn.onclick = async () => {
      try {
        const pin = input.value.trim()
        if (firstTime) {
          if (pin.length < 4) {
            error.textContent = 'Mínimo 4 dígitos'
            return
          }
          btn.disabled = true
          btn.textContent = 'Guardando...'
          await auth.setPin(pin)
          db.setPin(pin)
          screen.classList.add('hidden')
          initApp()
        } else {
          if (!pin) return
          btn.disabled = true
          btn.textContent = 'Verificando...'
          const ok = await auth.checkPin(pin)
          if (ok) {
            attempts = 0
            db.setPin(pin)
            screen.classList.add('hidden')
            initApp()
          } else {
            attempts++
            error.textContent = 'PIN incorrecto (intento ' + attempts + '/5)'
            input.value = ''
            input.focus()
            if (attempts >= 5) {
              error.textContent = 'Demasiados intentos. Recarga la página.'
              setTimeout(() => { btn.disabled = false; attempts = 0; error.textContent = '' }, 30000)
              return
            }
          }
          btn.disabled = false
          btn.textContent = 'Entrar'
        }
      } catch (e) {
        error.textContent = 'Error: ' + e.message
        btn.disabled = false
        btn.textContent = firstTime ? 'Listo' : 'Entrar'
      }
    }

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') btn.click()
    })

    input.focus()

    document.getElementById('resetPinBtn')?.addEventListener('click', () => {
      if (confirm('¿Restablecer PIN? Se borrará todo el progreso de ESTE dispositivo.')) {
        auth.clearPin()
        db.resetAll()
        localStorage.clear()
        location.reload()
      }
    })
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
    try { return JSON.parse(localStorage.getItem('gymapp_dates') || '[]').length } catch { return 0 }
  }

  function recordTrainingDay() {
    const today = new Date().toISOString().split('T')[0]
    try {
      const arr = JSON.parse(localStorage.getItem('gymapp_dates') || '[]')
      if (!arr.includes(today)) { arr.push(today); localStorage.setItem('gymapp_dates', JSON.stringify(arr)) }
    } catch {}
  }

  function initApp() {
    const wasReset = db.checkWeekReset()
    if (wasReset) { refreshData(); showToast('🔄 Nueva semana — progreso reiniciado') }
    let totalSets = 0
    for (const k in progress) { const d = progress[k]; if (d) for (const ek in d) totalSets += d[ek] || 0 }
    if (totalSets > 0) recordTrainingDay()

    cloudReady = db.connected
    renderNav()
    renderDaySelector()
    renderWorkout(currentDay)
    renderMachines()
    renderProgress()
    renderDiet()
    renderSettings()
    setupTimer()
    setupVideo()
    renderCloudStatus()

    if (cloudReady) {
      db.pullFromGist().then(() => {
        refreshData()
        renderDaySelector()
        renderWorkout(currentDay)
        renderProgress()
      })
    }

    db.onUpdate((p, w) => {
      refreshData()
      renderDaySelector()
      renderWorkout(currentDay)
      renderProgress()
    })

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') hideTimer()
    })
  }

  function renderCloudStatus() {
    let el = document.getElementById('cloudBadge')
    if (!el) {
      el = document.createElement('div')
      el.id = 'cloudBadge'
      el.className = 'cloud-badge'
      document.querySelector('.header-inner').appendChild(el)
    }
    el.textContent = cloudReady ? '☁️ Seguro' : '🔒 Local'
    el.className = 'cloud-badge' + (cloudReady ? ' cloud-ready' : ' cloud-local')
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
  }

  function renderDaySelector() {
    const grid = document.getElementById('dayGrid')
    grid.innerHTML = ''
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
          delete progress[dayIndex]
          save()
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
    save()
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
    if (inp.value) {
      weights[key] = inp.value
    } else {
      delete weights[key]
    }
    save()
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

    container.innerHTML = html

    document.getElementById('resetAll')?.addEventListener('click', () => {
      if (confirm('¿Reiniciar TODO el progreso? Esta acción no se puede deshacer.')) {
        db.resetAll()
        refreshData()
        renderDaySelector()
        renderWorkout(currentDay)
        renderProgress()
      }
    })
  }

  /* Diet */
  function renderDiet() {
    const container = document.getElementById('dietContent')
    const plan = dietPlan.getMealPlan()
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

  function getMealExamples(mealIdx, protein, carbs, fat) {
    const examples = [
      [
        { name: 'Omelette de claras + avena', items: ['6 claras + 1 huevo', '70g avena', '100g arándanos'], macros: 'P~38g C~52g G~12g' },
        { name: 'Whey + yogurt griego', items: ['1 scoop whey', '200g yogurt griego 0%', '60g avena', '1 cda mantequilla de maní'], macros: 'P~42g C~48g G~14g' },
        { name: 'Tostadas integrales + huevos', items: ['2 rebanadas pan integral', '3 huevos revueltos', '1/2 aguacate'], macros: 'P~35g C~50g G~15g' },
      ],
      [
        { name: 'Pollo + arroz + verduras', items: ['180g pechuga pollo', '200g arroz blanco cocido', '200g brócoli', '1 cda aceite oliva'], macros: 'P~50g C~58g G~18g' },
        { name: 'Carne molida + papa + espinaca', items: ['180g carne 93/7', '250g papa cocida', '150g espinaca salteada', '1 cda aceite oliva'], macros: 'P~48g C~55g G~20g' },
        { name: 'Salmón + quinoa + vegetales', items: ['170g salmón', '200g quinoa cocida', '150g espárragos', '1 cda aceite oliva'], macros: 'P~45g C~50g G~22g' },
      ],
      [
        { name: 'Yogurt + whey + frutos secos', items: ['200g yogurt griego', '1 scoop whey', '30g almendras', '1 manzana'], macros: 'P~38g C~28g G~16g' },
        { name: 'Batido proteico', items: ['1 scoop whey', '1 cda mantequilla de maní', '1 banana', '200ml leche descremada'], macros: 'P~35g C~40g G~14g' },
        { name: 'Requesón + fruta', items: ['200g requesón 0%', '100g piña/papaya', '20g nueces'], macros: 'P~32g C~30g G~12g' },
      ],
      [
        { name: 'Pollo + batata + verduras', items: ['170g pechuga pollo', '250g batata cocida', '150g brócoli', '1 cda aceite oliva'], macros: 'P~46g C~52g G~17g' },
        { name: 'Pescado + arroz + ensalada', items: ['180g tilapia/merluza', '180g arroz integral', 'Ensalada verde', '1 cda aceite oliva'], macros: 'P~44g C~48g G~16g' },
        { name: 'Tofu + pasta integral + vegetales', items: ['200g tofu firme', '200g pasta integral', '150g verduras salteadas', '1 cda aceite oliva'], macros: 'P~38g C~55g G~18g' },
      ],
    ]
    return examples[mealIdx] || []
  }

  /* Settings */
  function renderSettings() {
    const container = document.getElementById('settingsContent')
    const token = db.getToken()
    const hasToken = !!token

    const u = userProfile
    const idealW = (182 - 100).toFixed(0)

    container.innerHTML = [
      '<h2>⚙️ Ajustes</h2>',

      /* Profile card */
      '<div class="card">',
      '<div class="card-title">👤 Tu Perfil</div>',
      '<div class="settings-profile-grid">',
      '<div><span class="settings-field-label">Edad</span><strong class="settings-field-value">21 años</strong></div>',
      '<div><span class="settings-field-label">Altura</span><strong class="settings-field-value">1.82 m</strong></div>',
      '<div><span class="settings-field-label">Peso</span><strong class="settings-field-value">180 lb (' + u.weightKg + ' kg)</strong></div>',
      '<div><span class="settings-field-label">BMI</span><strong class="settings-field-value">' + u.bmi + '</strong></div>',
      '</div>',
      '<hr class="settings-divider">',
      '<div class="settings-profile-grid">',
      '<div><span class="settings-field-label">Metabolismo basal</span><strong class="settings-field-value">' + u.bmr + ' kcal/día</strong></div>',
      '<div><span class="settings-field-label">Gasto diario (TDEE)</span><strong class="settings-field-value">' + u.tdee + ' kcal/día</strong></div>',
      '<div><span class="settings-field-label settings-deficit">🔥 Déficit sugerido</span><strong class="settings-field-value settings-deficit-val">' + u.deficitCalories + ' kcal/día</strong></div>',
      '<div><span class="settings-field-label">Peso ideal aprox</span><strong class="settings-field-value">' + idealW + ' kg (' + Math.round(idealW * 2.205) + ' lb)</strong></div>',
      '</div>',
      '<p class="settings-diet-tip">',
      '🍗 Come ~' + u.deficitCalories + ' kcal/día con alta proteína (1.6-2.2g/kg) para perder grasa sin perder músculo.</p>',
      '</div>',

      /* PIN section */
      '<div class="card">',
      '<div class="card-title">🔐 PIN de acceso</div>',
      '<p class="settings-description">',
      'La app está protegida con PIN. Los datos se encriptan con AES-256 antes de subirse a GitHub.</p>',
      '<button class="reset-btn" id="changePinBtn">Cambiar PIN</button>',
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
      '<div class="settings-sync-actions">',
      '<button id="syncPullBtn" class="reset-btn settings-pull-btn"',
      hasToken ? '' : 'disabled', '>📥 Descargar de GitHub</button>',
      '<button id="syncPushBtn" class="reset-btn settings-push-btn"',
      hasToken ? '' : 'disabled', '>📤 Subir a GitHub</button>',
      '</div>',
      '<p class="settings-gist-id">',
      'Gist ID: <code>' + db.gistId + '</code></p>',
      '</div>',

      /* Security info */
      '<div class="card">',
      '<div class="card-title">🛡️ Seguridad</div>',
      '<ul class="settings-security-list">',
      '<li>🔒 Acceso protegido con PIN</li>',
      '<li>🔐 Datos encriptados con AES-256-GCM antes de subir</li>',
      '<li>📡 Comunicación HTTPS con GitHub API</li>',
      '<li>🚫 Bloqueo tras 5 intentos fallidos</li>',
      '<li>🛡️ Content Security Policy activa</li>',
      '<li>💾 Token guardado solo en tu navegador</li>',
      '</ul>',
      '</div>',
    ].join('')

    /* Event listeners */
    document.getElementById('changePinBtn')?.addEventListener('click', () => {
      if (confirm('¿Cambiar PIN? Se borrará el PIN actual.')) {
        auth.clearPin()
        localStorage.clear()
        location.reload()
      }
    })

    const tokenInput = document.getElementById('tokenInput')
    const saveBtn = document.getElementById('saveTokenBtn')
    const pullBtn = document.getElementById('syncPullBtn')
    const pushBtn = document.getElementById('syncPushBtn')
    const syncStatus = document.getElementById('syncStatus')

    saveBtn?.addEventListener('click', async () => {
      const newToken = tokenInput.value.trim()
      if (!newToken) return

      db.setToken(newToken)
      syncStatus.textContent = '🔄 Verificando token...'
      syncStatus.style.color = 'var(--orange)'

      const ok = await db.pullFromGist()
      if (ok) {
        cloudReady = true
        renderCloudStatus()
        refreshData()
        renderDaySelector()
        renderWorkout(currentDay)
        renderProgress()
        renderSettings()
        syncStatus.textContent = '✅ Conectado. Datos sincronizados y encriptados.'
        syncStatus.style.color = 'var(--green)'
      } else {
        syncStatus.innerHTML = '❌ Token guardado, pero los datos en el Gist están encriptados con otro PIN. Haz clic en <strong>📤 Subir a GitHub</strong> para sobrescribirlos con tu PIN actual.'
        syncStatus.style.color = 'var(--orange)'
      }
    })

    pullBtn?.addEventListener('click', async () => {
      syncStatus.textContent = '🔄 Descargando datos encriptados...'
      syncStatus.style.color = 'var(--orange)'
      const ok = await db.pullFromGist()
      if (ok) {
        refreshData()
        renderDaySelector()
        renderWorkout(currentDay)
        renderProgress()
        syncStatus.textContent = '✅ Datos descargados y desencriptados'
        syncStatus.style.color = 'var(--green)'
      } else {
        syncStatus.textContent = '❌ Error. ¿El PIN es el mismo que cuando se subió?'
        syncStatus.style.color = 'var(--primary)'
      }
    })

    pushBtn?.addEventListener('click', async () => {
      syncStatus.textContent = '🔄 Encriptando y subiendo...'
      syncStatus.style.color = 'var(--orange)'
      await db.syncToGist()
      syncStatus.textContent = '✅ Datos encriptados y subidos a GitHub'
      syncStatus.style.color = 'var(--green)'
    })
  }

  /* Start with lock screen */
  initLockScreen()
})()
