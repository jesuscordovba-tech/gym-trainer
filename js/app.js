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

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') btn.click()
    })

    input.focus()
  }

  function initApp() {
    cloudReady = db.connected
    renderNav()
    renderDaySelector()
    renderWorkout(currentDay)
    renderMachines()
    renderProgress()
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
      el.style.cssText = 'font-size:0.7rem;padding:0.2rem 0.5rem;border-radius:4px;font-weight:600;'
      document.querySelector('.header-inner').appendChild(el)
    }
    if (cloudReady) {
      el.textContent = '☁️ Seguro'
      el.style.background = 'rgba(46,204,113,0.15)'
      el.style.color = '#2ecc71'
    } else {
      el.textContent = '🔒 Local'
      el.style.background = 'rgba(136,136,136,0.15)'
      el.style.color = '#888'
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

  function renderWorkout(dayIndex) {
    const d = workoutPlan.days[dayIndex]
    if (!d) return
    const container = document.getElementById('workoutContent')
    const dayProgress = progress[dayIndex] || {}

    const hasVideos = d.exercises.some(ex => ex.video)
    let html = [
      '<div class="workout-header">',
      '<h2>' + esc(d.name) + '</h2>',
      '<div class="focus">' + esc(d.focus) + '</div>',
      '</div>',
      '<div class="warmup-box"><strong>🔥 Calentamiento:</strong> ' + esc(d.warmup) + '</div>',
      hasVideos ? '<button class="play-all-btn" data-day="' + dayIndex + '">▶ Reproducir todo en ciclo</button>' : '',
    ].join('')

    d.exercises.forEach((ex, exIdx) => {
      const setsCompleted = dayProgress[exIdx] || 0
      const machine = gymData.getMachineById(ex.machine)
      const weight = weights[dayIndex + '-' + exIdx] || ''

      html += '<div class="exercise-item" data-day="' + dayIndex + '" data-ex="' + exIdx + '">'
      html += '<div class="exercise-top">'
      html += '<div class="exercise-info">'
      html += '<div class="exercise-name">' + esc(ex.name)
      if (ex.supersetWith) html += '<span class="superset-badge">SUPERSET</span>'
      if (ex.video) html += '<button class="video-btn" data-video="' + esc(ex.video) + '" title="Ver video demostrativo">▶</button>'
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
      html += '<label style="font-size:0.8rem;color:var(--text-dim);">Carga (kg):</label>'
      html += '<input type="number" class="weight-input" value="' + weight + '" data-day="' + dayIndex + '" data-ex="' + exIdx + '" placeholder="kg">'
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
      html += '</div></div></div>'
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
      '<div style="margin-top:1.5rem;text-align:center;">',
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
    container.querySelectorAll('.video-btn').forEach(btn => {
      btn.addEventListener('click', openVideo)
    })
    container.querySelectorAll('.play-all-btn').forEach(btn => {
      btn.addEventListener('click', playAllVideos)
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

    const restBtn = document.querySelector('.exercise-item[data-day="' + day + '"][data-ex="' + ex + '"] .rest-timer-btn')
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

  function playAllVideos(e) {
    const dayIndex = parseInt(e.currentTarget.dataset.day)
    const day = workoutPlan.days[dayIndex]
    if (!day) return
    const ids = day.exercises.map(ex => ex.video).filter(Boolean)
    if (!ids.length) return
    const iframe = document.getElementById('videoIframe')
    if (!iframe) return
    const playlistUrl = 'https://www.youtube.com/embed/' + ids[0] + '?playlist=' + ids.slice(1).join(',') + '&loop=1&autoplay=1'
    document.getElementById('videoModalTitle').textContent = '📺 Ciclo: ' + day.name.split(' — ')[0]
    iframe.src = playlistUrl
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

    let html = [
      '<h2 style="margin-bottom:1.5rem;">📊 Tu Progreso</h2>',
      '<div class="progress-stats">',
      '<div class="stat-card"><div class="stat-value">' + pct + '%</div><div class="stat-label">Progreso global</div></div>',
      '<div class="stat-card"><div class="stat-value">' + totalSetsDone + '</div><div class="stat-label">Series completadas</div></div>',
      '<div class="stat-card"><div class="stat-value">' + totalWorkouts + '/' + workoutPlan.days.length + '</div><div class="stat-label">Entrenos iniciados</div></div>',
      '<div class="stat-card"><div class="stat-value">' + daysCompleted + '</div><div class="stat-label">Días completados</div></div>',
      '</div>',
      '<h3 style="margin-bottom:0.75rem;">Detalle por día</h3>',
    ].join('')

    workoutPlan.days.forEach((d, i) => {
      const p = progress[i] || {}
      const daySets = d.exercises.reduce((a, ex) => a + ex.sets, 0)
      let dayDone = 0
      d.exercises.forEach((ex, exIdx) => {
        dayDone += p[exIdx] || 0
      })
      html += '<div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border);font-size:0.9rem;">'
      html += '<span>' + DAY_LABELS[i] + ' — ' + esc(d.name.split(' — ')[0]) + '</span>'
      html += '<span style="color:' + (dayDone >= daySets ? 'var(--green)' : 'var(--text-dim)') + '">'
      html += dayDone + '/' + daySets + ' series</span></div>'
    })

    html += [
      '<div style="margin-top:1.5rem;text-align:center;">',
      '<button class="reset-btn" id="resetAll" style="background:rgba(233,69,96,0.2);border-color:var(--primary);">Reiniciar todo el progreso</button>',
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

  /* Settings */
  function renderSettings() {
    const container = document.getElementById('settingsContent')
    const token = db.getToken()
    const hasToken = !!token

    const u = userProfile
    const idealW = (182 - 100).toFixed(0)

    container.innerHTML = [
      '<h2 style="margin-bottom:1.5rem;">⚙️ Ajustes</h2>',

      /* Profile card */
      '<div class="card">',
      '<div class="card-title" style="margin-bottom:0.75rem;">👤 Tu Perfil</div>',
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:0.75rem;">',
      '<div><span style="display:block;font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Edad</span><strong>21 años</strong></div>',
      '<div><span style="display:block;font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Altura</span><strong>1.82 m</strong></div>',
      '<div><span style="display:block;font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Peso</span><strong>180 lb (' + u.weightKg + ' kg)</strong></div>',
      '<div><span style="display:block;font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">BMI</span><strong>' + u.bmi + '</strong></div>',
      '</div>',
      '<hr style="border-color:var(--border);margin:1rem 0;">',
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.75rem;">',
      '<div><span style="display:block;font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Metabolismo basal</span><strong>' + u.bmr + ' kcal/día</strong></div>',
      '<div><span style="display:block;font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Gasto diario (TDEE)</span><strong>' + u.tdee + ' kcal/día</strong></div>',
      '<div><span style="display:block;font-size:0.7rem;color:var(--primary);text-transform:uppercase;letter-spacing:0.5px;">🔥 Déficit sugerido</span><strong style="color:var(--primary);">' + u.deficitCalories + ' kcal/día</strong></div>',
      '<div><span style="display:block;font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Peso ideal aprox</span><strong>' + idealW + ' kg (' + Math.round(idealW * 2.205) + ' lb)</strong></div>',
      '</div>',
      '<p style="font-size:0.8rem;color:var(--text-dim);margin-top:0.75rem;">',
      '🍗 Come ~' + u.deficitCalories + ' kcal/día con alta proteína (1.6-2.2g/kg) para perder grasa sin perder músculo.</p>',
      '</div>',

      /* PIN section */
      '<div class="card" style="margin-top:1rem;">',
      '<div class="card-title" style="margin-bottom:0.75rem;">🔐 PIN de acceso</div>',
      '<p style="font-size:0.85rem;color:var(--text-dim);margin-bottom:0.75rem;">',
      'La app está protegida con PIN. Los datos se encriptan con AES-256 antes de subirse a GitHub.</p>',
      '<button class="reset-btn" id="changePinBtn" style="border-color:var(--orange);color:var(--orange);">Cambiar PIN</button>',
      '</div>',

      /* Sync section */
      '<div class="card" style="margin-top:1rem;">',
      '<div class="card-title" style="margin-bottom:0.75rem;">☁️ Sincronización en la nube</div>',
      '<p style="font-size:0.85rem;color:var(--text-dim);margin-bottom:1rem;">',
      'Los datos se encriptan localmente con tu PIN antes de enviarse a un Gist privado de GitHub.',
      ' Nadie puede leerlos sin tu PIN.</p>',
      '<div style="margin-bottom:1rem;">',
      '<label style="display:block;font-size:0.85rem;margin-bottom:0.4rem;color:var(--text-dim);">Token de GitHub (scope: gist):</label>',
      '<div style="display:flex;gap:0.5rem;">',
      '<input type="password" id="tokenInput" value="' + esc(token) + '" placeholder="ghp_..."',
      ' style="flex:1;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:0.5rem 0.75rem;border-radius:var(--radius-sm);font-size:0.9rem;">',
      '<button id="saveTokenBtn" class="rest-timer-btn"',
      ' style="background:rgba(46,204,113,0.15);border-color:var(--green);color:var(--green);min-width:90px;">',
      hasToken ? 'Actualizar' : 'Conectar', '</button>',
      '</div></div>',
      '<div id="syncStatus" style="font-size:0.85rem;min-height:1.2rem;"></div>',
      '<div style="margin-top:0.75rem;display:flex;gap:0.75rem;flex-wrap:wrap;">',
      '<button id="syncPullBtn" class="reset-btn" style="border-color:var(--green);color:var(--green);"',
      hasToken ? '' : 'disabled', '>📥 Descargar de GitHub</button>',
      '<button id="syncPushBtn" class="reset-btn" style="border-color:var(--orange);color:var(--orange);"',
      hasToken ? '' : 'disabled', '>📤 Subir a GitHub</button>',
      '</div>',
      '<p style="margin-top:0.75rem;font-size:0.75rem;color:var(--text-dim);">',
      'Gist ID: <code>' + db.gistId + '</code></p>',
      '</div>',

      /* Security info */
      '<div class="card" style="margin-top:1rem;">',
      '<div class="card-title" style="margin-bottom:0.75rem;">🛡️ Seguridad</div>',
      '<ul style="font-size:0.85rem;color:var(--text-dim);padding-left:1.2rem;line-height:1.8;">',
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
