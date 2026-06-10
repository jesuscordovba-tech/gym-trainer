;(() => {
  let progress = db.getProgress()
  let weights = db.getWeights()
  let currentDay = 0
  let timerInterval = null
  let cloudReady = false

  const DAY_LABELS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

  function refreshData() {
    progress = db.getProgress()
    weights = db.getWeights()
  }

  function save() {
    db.setProgress(progress)
    db.setWeights(weights)
  }

  function init() {
    renderNav()
    renderDaySelector()
    renderWorkout(currentDay)
    renderMachines()
    renderProgress()
    setupTimer()

    /* Cloud sync indicator */
    renderCloudStatus()

    /* Try Firebase */
    if (typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== 'TU_API_KEY') {
      db.initFirebase(FIREBASE_CONFIG).then(ok => {
        cloudReady = ok
        renderCloudStatus()
      })
    }

    /* Listen for remote changes */
    db.onUpdate((p, w) => {
      refreshData()
      renderDaySelector()
      renderWorkout(currentDay)
      renderProgress()
    })

    /* Keyboard shortcut */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') hideTimer()
    })
  }

  function renderCloudStatus() {
    const header = document.querySelector('.header-inner')
    let badge = document.getElementById('cloudBadge')
    if (!badge) {
      badge = document.createElement('div')
      badge.id = 'cloudBadge'
      badge.style.cssText = 'font-size:0.7rem;padding:0.2rem 0.5rem;border-radius:4px;font-weight:600;'
      header.appendChild(badge)
    }

    if (cloudReady) {
      badge.textContent = '☁️ Sincronizado'
      badge.style.background = 'rgba(46,204,113,0.15)'
      badge.style.color = '#2ecc71'
    } else if (typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== 'TU_API_KEY') {
      badge.textContent = '🔄 Conectando...'
      badge.style.background = 'rgba(243,156,18,0.15)'
      badge.style.color = '#f39c12'
    } else {
      badge.textContent = '💾 Local'
      badge.style.background = 'rgba(136,136,136,0.15)'
      badge.style.color = '#888'
    }
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
        <div class="day-label">${DAY_LABELS[i] || `DÍA ${i + 1}`}</div>
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

  function renderWorkout(dayIndex) {
    const d = workoutPlan.days[dayIndex]
    if (!d) return
    const container = document.getElementById('workoutContent')
    const dayProgress = progress[dayIndex] || {}

    let html = `
      <div class="workout-header">
        <h2>${d.name}</h2>
        <div class="focus">${d.focus}</div>
      </div>
      <div class="warmup-box"><strong>🔥 Calentamiento:</strong> ${d.warmup}</div>
    `

    d.exercises.forEach((ex, exIdx) => {
      const setsCompleted = dayProgress[exIdx] || 0
      const machine = gymData.getMachineById(ex.machine)
      const weight = weights[`${dayIndex}-${exIdx}`] || ''

      html += `
        <div class="exercise-item" data-day="${dayIndex}" data-ex="${exIdx}">
          <div class="exercise-top">
            <div class="exercise-info">
              <div class="exercise-name">
                ${ex.name}
                ${ex.supersetWith ? '<span class="superset-badge">SUPERSET</span>' : ''}
              </div>
              <div class="exercise-meta">
                <span>🔁 ${ex.sets}×${ex.reps}</span>
                <span>⏱ ${ex.rest}s</span>
                <span>📌 RIR ${ex.rir}</span>
              </div>
              <div>
                <span class="machine-badge">${machine ? machine.name : ex.machine}</span>
                <span class="muscle-badge">${ex.muscle}</span>
              </div>
              <div class="weight-input-row">
                <label style="font-size:0.8rem;color:var(--text-dim);">Carga (kg):</label>
                <input type="number" class="weight-input" value="${weight}"
                       data-day="${dayIndex}" data-ex="${exIdx}" placeholder="kg">
              </div>
            </div>
            <div class="exercise-controls">
              <div class="set-tracker">
                ${Array.from({ length: ex.sets }, (_, s) => `
                  <button class="set-dot ${s < setsCompleted ? 'completed' : s === setsCompleted ? 'current' : ''}"
                          data-day="${dayIndex}" data-ex="${exIdx}" data-set="${s}">
                    ${s + 1}
                  </button>
                `).join('')}
              </div>
              <button class="rest-timer-btn" data-rest="${ex.rest}">⏱ ${ex.rest}s</button>
            </div>
          </div>
        </div>
      `
    })

    html += `
      <div class="cardio-card">
        <h3>🏃 Cardio — ${d.cardio.type}</h3>
        <div class="cardio-detail">
          <div class="cardio-item"><strong>Máquina</strong>${gymData.getMachineById(d.cardio.machine)?.name || d.cardio.machine}</div>
          <div class="cardio-item"><strong>Duración</strong>${d.cardio.duration}</div>
          <div class="cardio-item"><strong>Protocolo</strong>${d.cardio.protocol}</div>
        </div>
      </div>
    `

    html += `<div class="cooldown-box"><strong>🧘 Enfriamiento:</strong> ${d.cooldown}</div>`

    html += `
      <div style="margin-top:1.5rem;text-align:center;">
        <button class="reset-btn" id="resetDay">Reiniciar progreso del día</button>
      </div>
    `

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

    save()
    renderDaySelector()
    renderWorkout(day)

    const restBtn = document.querySelector(`.exercise-item[data-day="${day}"][data-ex="${ex}"] .rest-timer-btn`)
    if (restBtn && (progress[day][ex] || 0) > 0 && (progress[day][ex] || 0) < maxSets) {
      startTimer.call(restBtn)
    }
  }

  function handleWeightChange(e) {
    const inp = e.currentTarget
    const key = `${inp.dataset.day}-${inp.dataset.ex}`
    if (inp.value) {
      weights[key] = inp.value
    } else {
      delete weights[key]
    }
    save()
  }

  /* Timer */
  function setupTimer() {
    document.getElementById('timerOverlay').addEventListener('click', e => {
      if (e.target === e.currentTarget) hideTimer()
    })
    document.getElementById('timerSkip').addEventListener('click', hideTimer)
    document.getElementById('timerStop').addEventListener('click', hideTimer)
  }

  function startTimer() {
    const seconds = parseInt(this.dataset.rest) || 60
    showTimer(seconds)
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
          const actx = new (window.AudioContext || window.webkitAudioContext)()
          const osc = actx.createOscillator()
          const gain = actx.createGain()
          osc.connect(gain)
          gain.connect(actx.destination)
          osc.frequency.value = 880
          gain.gain.value = 0.3
          osc.start()
          osc.stop(actx.currentTime + 0.3)
        } catch (_) {}
      }
    }, 1000)
  }

  function updateDisplay(seconds) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    document.getElementById('timerDisplay').textContent = `${m}:${s.toString().padStart(2, '0')}`
  }

  function hideTimer() {
    clearInterval(timerInterval)
    document.getElementById('timerOverlay').classList.remove('show')
    document.getElementById('timerDisplay').style.color = ''
  }

  /* Machines tab */
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
      html += `
        <div class="category-section">
          <div class="category-title">${cat.icon} ${cat.label}</div>
          <div class="machine-grid">
            ${machines.map(m => `
              <div class="machine-item">${m.name}</div>
            `).join('')}
          </div>
        </div>
      `
    })
    container.innerHTML = html
  }

  /* Progress tab */
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

    let html = `
      <h2 style="margin-bottom:1.5rem;">📊 Tu Progreso</h2>
      <div class="progress-stats">
        <div class="stat-card">
          <div class="stat-value">${pct}%</div>
          <div class="stat-label">Progreso global</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalSetsDone}</div>
          <div class="stat-label">Series completadas</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalWorkouts}/${workoutPlan.days.length}</div>
          <div class="stat-label">Entrenos iniciados</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${daysCompleted}</div>
          <div class="stat-label">Días completados</div>
        </div>
      </div>
    `

    html += '<h3 style="margin-bottom:0.75rem;">Detalle por día</h3>'
    workoutPlan.days.forEach((d, i) => {
      const p = progress[i] || {}
      const daySets = d.exercises.reduce((a, ex) => a + ex.sets, 0)
      let dayDone = 0
      d.exercises.forEach((ex, exIdx) => {
        dayDone += p[exIdx] || 0
      })
      html += `
        <div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border);font-size:0.9rem;">
          <span>${DAY_LABELS[i]} — ${d.name.split(' — ')[0]}</span>
          <span style="color:${dayDone >= daySets ? 'var(--green)' : 'var(--text-dim)'}">
            ${dayDone}/${daySets} series
          </span>
        </div>
      `
    })

    html += `
      <div style="margin-top:1.5rem;text-align:center;">
        <button class="reset-btn" id="resetAll" style="background:rgba(233,69,96,0.2);border-color:var(--primary);">
          Reiniciar todo el progreso
        </button>
      </div>
    `

    container.innerHTML = html

    const resetAll = document.getElementById('resetAll')
    if (resetAll) {
      resetAll.addEventListener('click', () => {
        if (confirm('¿Reiniciar TODO el progreso? Esta acción no se puede deshacer.')) {
          db.resetAll()
          refreshData()
          renderDaySelector()
          renderWorkout(currentDay)
          renderProgress()
        }
      })
    }
  }

  init()
})()
