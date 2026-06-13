function createDefaultProfile() {
  return {
    name: '', age: 21, heightCm: 175, weightLb: 165, gender: 'M',
    get bmr() {
      const w = this.weightLb * 0.453592, h = this.heightCm, a = this.age
      return Math.round(10 * w + 6.25 * h - 5 * a + 5)
    },
    get tdee() { return Math.round(this.bmr * 1.55) },
    get deficitCalories() { return this.tdee - 500 },
    get weightKg() { return (this.weightLb * 0.453592).toFixed(1) },
    get bmi() { return ((this.weightKg / ((this.heightCm / 100) ** 2))).toFixed(1) },
  }
}

const gymData = {
  categories: ['cardio', 'pecho', 'espalda', 'hombros', 'biceps', 'triceps', 'piernas', 'abdominales', 'pesoLibre', 'funcional'],
  machines: {
    cardio: [
      { id: 'caminadora', name: 'Caminadora' },
      { id: 'eliptica', name: 'Elíptica' },
      { id: 'bicicleta-vertical', name: 'Bicicleta Estática Vertical' },
      { id: 'bicicleta-reclinada', name: 'Bicicleta Reclinada' },
      { id: 'escaladora', name: 'Escaladora (Stair Climber)' },
      { id: 'remo-cardio', name: 'Máquina de Remo' },
      { id: 'spinning', name: 'Bicicleta de Spinning' },
    ],
    pecho: [
      { id: 'press-pecho-sentado', name: 'Press de Pecho Sentado' },
      { id: 'press-inclinado-sentado', name: 'Press Inclinado Sentado' },
      { id: 'press-declinado-sentado', name: 'Press Declinado Sentado' },
      { id: 'pec-deck', name: 'Pec Deck' },
      { id: 'maquina-convergente-pecho', name: 'Máquina Convergente para Pecho' },
      { id: 'smith-machine', name: 'Smith Machine' },
    ],
    espalda: [
      { id: 'jalon-amplio', name: 'Jalón al Pecho Agarre Amplio' },
      { id: 'jalon-neutro', name: 'Jalón al Pecho Agarre Neutro' },
      { id: 'remo-sentado-polea', name: 'Remo Sentado en Polea' },
      { id: 'remo-articulado', name: 'Remo Articulado (Low Row)' },
      { id: 'remo-unilateral', name: 'Remo Unilateral' },
      { id: 'pullover-maquina', name: 'Pullover en Máquina' },
      { id: 'polea-alta', name: 'Polea Alta' },
      { id: 'polea-baja', name: 'Polea Baja' },
      { id: 'dominadas-asistidas', name: 'Dominadas Asistidas' },
      { id: 'fondos-asistidos', name: 'Fondos Asistidos' },
    ],
    hombros: [
      { id: 'press-hombros-sentado', name: 'Press de Hombros Sentado' },
      { id: 'elevacion-lateral-maquina', name: 'Elevación Lateral en Máquina' },
      { id: 'reverse-pec-deck', name: 'Reverse Pec Deck' },
      { id: 'polea-elevaciones-laterales', name: 'Polea para Elevaciones Laterales' },
    ],
    biceps: [
      { id: 'curl-biceps-maquina', name: 'Curl de Bíceps en Máquina' },
      { id: 'curl-scott-maquina', name: 'Curl Scott en Máquina' },
      { id: 'polea-baja-biceps', name: 'Polea Baja para Bíceps' },
    ],
    triceps: [
      { id: 'extension-triceps-polea-alta', name: 'Extensión de Tríceps en Polea Alta' },
      { id: 'maquina-fondos-triceps', name: 'Máquina de Fondos para Tríceps' },
      { id: 'extension-triceps-cabeza-polea', name: 'Extensión de Tríceps por Encima de la Cabeza en Polea' },
    ],
    piernas: [
      { id: 'prensa-45', name: 'Prensa de Piernas 45°' },
      { id: 'prensa-horizontal', name: 'Prensa Horizontal' },
      { id: 'hack-squat', name: 'Hack Squat' },
      { id: 'extension-piernas', name: 'Extensión de Piernas' },
      { id: 'hack-invertida', name: 'Sentadilla Hack Invertida' },
      { id: 'smith-sentadillas', name: 'Smith Machine para Sentadillas' },
      { id: 'curl-femoral-sentado', name: 'Curl Femoral Sentado' },
      { id: 'curl-femoral-acostado', name: 'Curl Femoral Acostado' },
      { id: 'curl-femoral-pie', name: 'Curl Femoral de Pie' },
      { id: 'hip-thrust', name: 'Hip Thrust Machine' },
      { id: 'patada-gluteo', name: 'Patada de Glúteo en Máquina' },
      { id: 'pull-through', name: 'Pull Through en Polea' },
      { id: 'aductores', name: 'Máquina de Aductores' },
      { id: 'abductores', name: 'Máquina de Abductores' },
      { id: 'pantorrillas-sentado', name: 'Elevación de Pantorrillas Sentado' },
      { id: 'pantorrillas-pie', name: 'Elevación de Pantorrillas de Pie' },
      { id: 'pantorrillas-prensa', name: 'Pantorrillas en Prensa' },
    ],
    abdominales: [
      { id: 'crunch-maquina', name: 'Crunch Abdominal en Máquina' },
      { id: 'banco-declinado-abdominales', name: 'Banco Declinado para Abdominales' },
      { id: 'silla-romana', name: 'Silla Romana' },
      { id: 'elevacion-piernas', name: 'Elevación de Piernas' },
      { id: 'polea-crunch', name: 'Polea para Crunch Abdominal' },
    ],
    pesoLibre: [
      { id: 'mancuernas', name: 'Mancuernas (2-50 kg)' },
      { id: 'barras-olimpicas', name: 'Barras Olímpicas' },
      { id: 'barra-ez', name: 'Barra EZ' },
      { id: 'rack-sentadillas', name: 'Rack para Sentadillas' },
      { id: 'power-rack', name: 'Jaula de Potencia (Power Rack)' },
    ],
    funcional: [
      { id: 'kettlebells', name: 'Kettlebells' },
      { id: 'battle-ropes', name: 'Battle Ropes' },
      { id: 'trx', name: 'TRX' },
      { id: 'balones-medicinales', name: 'Balones Medicinales' },
    ],
  },

  getMachineById(id) {
    for (const cat of Object.values(this.machines)) {
      const found = cat.find(m => m.id === id)
      if (found) return found
    }
    return null
  }
}

const dietPlan = {
  nutritionists: [
    { name: 'Dr. Mike Israetel', title: 'Cofundador de Renaissance Periodization', cite: 'RP Strength — Nutrition Made Simple' },
    { name: 'Dr. Layne Norton', title: 'PhD en Nutrición — Biolayne', cite: 'Layne Norton — The Complete Guide to Macros' },
    { name: 'Dr. Brad Schoenfeld', title: 'PhD — Investigador en hipertrofia', cite: 'Schoenfeld — Science and Development of Muscle Hypertrophy' },
    { name: 'Alan Aragon', title: 'Investigador y educador en nutrición', cite: 'Aragon — The Lean Bulk Protocol' },
    { name: 'Dr. Eric Helms', title: 'PhD — Muscle and Strength Pyramids', cite: 'Helms — The Muscle and Strength Pyramid' },
  ],

  mealStructure: [
    { name: 'Desayuno', pct: 0.25, icon: '' },
    { name: 'Almuerzo', pct: 0.35, icon: '' },
    { name: 'Merienda', pct: 0.15, icon: '' },
    { name: 'Cena', pct: 0.25, icon: '' },
  ],

  foods: {
    proteinas: [
      { name: 'Pechuga de pollo', proteina: 31, grasa: 3.6, kcal: 165 },
      { name: 'Carne molida 93/7', proteina: 27, grasa: 7, kcal: 173 },
      { name: 'Lomo de cerdo', proteina: 26, grasa: 6, kcal: 165 },
      { name: 'Salmón', proteina: 25, grasa: 13, kcal: 208 },
      { name: 'Atún en agua', proteina: 26, grasa: 1, kcal: 116 },
      { name: 'Claras de huevo', proteina: 11, grasa: 0, kcal: 52 },
      { name: 'Huevo entero', proteina: 13, grasa: 11, kcal: 155 },
      { name: 'Whey protein', proteina: 24, grasa: 1.5, kcal: 115 },
      { name: 'Yogurt griego 0%', proteina: 10, grasa: 0.3, kcal: 59 },
      { name: 'Tofu firme', proteina: 8, grasa: 4, kcal: 73 },
    ],
    carbohidratos: [
      { name: 'Arroz blanco cocido', proteina: 2.7, carb: 28, kcal: 130 },
      { name: 'Arroz integral cocido', proteina: 2.6, carb: 23, kcal: 111 },
      { name: 'Papa cocida', proteina: 2, carb: 20, kcal: 87 },
      { name: 'Batata cocida', proteina: 2, carb: 23, kcal: 90 },
      { name: 'Avena', proteina: 13, carb: 56, kcal: 350 },
      { name: 'Pasta integral cocida', proteina: 5, carb: 25, kcal: 135 },
      { name: 'Pan integral', proteina: 9, carb: 43, kcal: 250 },
      { name: 'Quinoa cocida', proteina: 4.4, carb: 21, kcal: 120 },
      { name: 'Tortilla de maíz', proteina: 3, carb: 44, kcal: 218 },
    ],
    vegetales: [
      { name: 'Brócoli', fibra: 2.6, kcal: 34 },
      { name: 'Espinaca', fibra: 2.2, kcal: 23 },
      { name: 'Zanahoria', fibra: 2.8, kcal: 41 },
      { name: 'Tomate', fibra: 1.2, kcal: 18 },
      { name: 'Pepino', fibra: 0.5, kcal: 15 },
      { name: 'Pimiento', fibra: 1.7, kcal: 26 },
    ],
    grasas: [
      { name: 'Aceite de oliva', grasa: 14, kcal: 124 },
      { name: 'Aguacate', grasa: 15, fibra: 7, kcal: 160 },
      { name: 'Almendras', proteina: 6, grasa: 14, fibra: 3.5, kcal: 165 },
      { name: 'Mantequilla de maní', proteina: 8, grasa: 16, carb: 6, kcal: 190 },
      { name: 'Semillas de chía', proteina: 4, grasa: 9, fibra: 11, kcal: 138 },
    ],
  },

  getMacros(profile) {
    const w = profile.weightKg
    const cal = profile.deficitCalories
    const protein = Math.round(w * 2)
    const fat = Math.round(w * 0.9)
    const carbs = Math.round((cal - protein * 4 - fat * 9) / 4)
    return { protein, fat, carbs, calories: cal }
  },

  getMealPlan(profile) {
    const macros = this.getMacros(profile)
    const calPerMeal = this.mealStructure.map(m => Math.round(macros.calories * m.pct))
    return { macros, calPerMeal, structure: this.mealStructure }
  }
}

const videoSearchUrl = (name) =>
  `https://www.youtube.com/embed?listType=search&list=COMO+HACER+${encodeURIComponent(name)}+maquina+gimnasio`

const workoutPlan = {
  days: [
    {
      day: 1,
      name: 'PUSH A — Pecho + Hombros + Tríceps',
      focus: 'Fuerza e hipertrofia',
      warmup: '5 min elíptica + movilidad de hombros',
      exercises: [
        { name: 'Press de Pecho Sentado', machine: 'press-pecho-sentado', sets: 4, reps: '8-10', rest: 90, rir: 1, muscle: 'Pectoral mayor', video: 'XCFtfAkEWkE' },
        { name: 'Press de Hombros Sentado', machine: 'press-hombros-sentado', sets: 4, reps: '8-10', rest: 90, rir: 1, muscle: 'Deltoides', video: 'IyRu1XMhbIM' },
        { name: 'Press Inclinado Sentado', machine: 'press-inclinado-sentado', sets: 3, reps: '10-12', rest: 60, rir: 1, muscle: 'Pectoral mayor (cabeza clavicular)', video: 'BZlbn-KMvkM' },
        { name: 'Elevación Lateral en Máquina', machine: 'elevacion-lateral-maquina', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Deltoides lateral', video: '1Z0g4jl8DDQ' },
        { name: 'Extensión de Tríceps en Polea Alta', machine: 'extension-triceps-polea-alta', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Tríceps', video: 'cGEPFQ99pyQ' },
        { name: 'Fondos Asistidos', machine: 'fondos-asistidos', sets: 3, reps: '10-15', rest: 60, rir: 1, muscle: 'Pecho + Tríceps', video: 'QAHb-0i-kss' },
      ],
      cardio: {
        type: 'HIIT',
        machine: 'bicicleta-spinning',
        duration: '15 min',
        protocol: '30s sprint / 30s descanso',
      },
      cooldown: '5 min estiramientos de pecho y hombros',
    },
    {
      day: 2,
      name: 'PULL A — Espalda + Bíceps + Traps',
      focus: 'Fuerza e hipertrofia',
      warmup: '5 min remo + movilidad torácica',
      exercises: [
        { name: 'Jalón al Pecho Agarre Amplio', machine: 'jalon-amplio', sets: 4, reps: '8-10', rest: 90, rir: 1, muscle: 'Dorsales', video: 'Ln0CZzrlTEw' },
        { name: 'Remo Articulado (Low Row)', machine: 'remo-articulado', sets: 4, reps: '8-10', rest: 90, rir: 1, muscle: 'Espalda media', video: 'nlPlY9FrDH8' },
        { name: 'Remo Unilateral', machine: 'remo-unilateral', sets: 3, reps: '10-12', rest: 60, rir: 1, muscle: 'Dorsal + Romboides', video: 'IKoEsubNp9E' },
        { name: 'Reverse Pec Deck', machine: 'reverse-pec-deck', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Deltoides posterior', video: 'afSDDOz6IO8' },
        { name: 'Curl de Bíceps en Máquina', machine: 'curl-biceps-maquina', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Bíceps', video: '_CKKZGJ48DE' },
        { name: 'Pullover en Máquina', machine: 'pullover-maquina', sets: 3, reps: '10-12', rest: 60, rir: 1, muscle: 'Dorsales + Serrato', video: '4Fsae7c6EOI' },
      ],
      cardio: {
        type: 'HIIT',
        machine: 'escaladora',
        duration: '15 min',
        protocol: '30s rápido / 30s normal',
      },
      cooldown: '5 min estiramientos de espalda y bíceps',
    },
    {
      day: 3,
      name: 'LEGS A — Quads + Femorales + Core',
      focus: 'Hipertrofia de piernas y abdominales',
      warmup: '5 min bicicleta + movilidad de cadera',
      exercises: [
        { name: 'Hack Squat', machine: 'hack-squat', sets: 4, reps: '8-10', rest: 120, rir: 1, muscle: 'Cuádriceps + Glúteos', video: '0tn5K9NlCfo' },
        { name: 'Curl Femoral Acostado', machine: 'curl-femoral-acostado', sets: 4, reps: '8-10', rest: 90, rir: 1, muscle: 'Femorales', video: 'skZZniqr5D0' },
        { name: 'Prensa de Piernas 45°', machine: 'prensa-45', sets: 3, reps: '10-12', rest: 90, rir: 1, muscle: 'Cuádriceps + Glúteos', video: '5RIA01KarJ4' },
        { name: 'Sentadilla Hack Invertida', machine: 'hack-invertida', sets: 3, reps: '10-12', rest: 60, rir: 1, muscle: 'Cuádriceps', video: 'irlBORqQUzk' },
        { name: 'Extensión de Piernas', machine: 'extension-piernas', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Cuádriceps', video: 'GMFFZnDz6wE' },
        { name: 'Elevación de Pantorrillas Sentado', machine: 'pantorrillas-sentado', sets: 3, reps: '15-20', rest: 30, rir: 0, muscle: 'Sóleo', video: '2EW5BzDXbDc' },
      ],
      cardio: {
        type: 'HIIT',
        machine: 'remo-cardio',
        duration: '12 min',
        protocol: '250m sprint / 90s remo suave',
      },
      cooldown: '5 min estiramientos de piernas',
    },
    {
      day: 4,
      name: 'PUSH B — Pecho + Hombros + Tríceps',
      focus: 'Hipertrofia y resistencia muscular',
      warmup: '5 min caminadora + círculos de hombros',
      exercises: [
        { name: 'Máquina Convergente para Pecho', machine: 'maquina-convergente-pecho', sets: 4, reps: '10-12', rest: 60, rir: 1, muscle: 'Pectoral mayor', video: 'N7DjfGB8-xY' },
        { name: 'Pec Deck', machine: 'pec-deck', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Pectoral mayor (aducción)', video: '0nSrP3Xpvx4' },
        { name: 'Press Declinado Sentado', machine: 'press-declinado-sentado', sets: 3, reps: '10-12', rest: 60, rir: 1, muscle: 'Pectoral mayor (cabeza esternal)', video: 'eLWG97MAowY' },
        { name: 'Polea para Elevaciones Laterales', machine: 'polea-elevaciones-laterales', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Deltoides lateral', video: 'BnYbFJBGZjs' },
        { name: 'Máquina de Fondos para Tríceps', machine: 'maquina-fondos-triceps', sets: 3, reps: '10-15', rest: 45, rir: 0, muscle: 'Tríceps', video: '8V25cDaBtJk' },
        { name: 'Extensión de Tríceps por Encima de la Cabeza en Polea', machine: 'extension-triceps-cabeza-polea', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Tríceps (cabeza larga)', video: 'P5810jy9IIk' },
      ],
      cardio: {
        type: 'HIIT',
        machine: 'caminadora',
        duration: '20 min',
        protocol: '1 min trote / 30s sprint',
      },
      cooldown: '5 min estiramientos de pecho y hombros',
    },
    {
      day: 5,
      name: 'PULL B — Espalda + Bíceps + Core',
      focus: 'Hipertrofia y resistencia muscular',
      warmup: '5 min remo + rotación torácica',
      exercises: [
        { name: 'Jalón al Pecho Agarre Neutro', machine: 'jalon-neutro', sets: 4, reps: '10-12', rest: 60, rir: 1, muscle: 'Dorsales', video: 'QFZiYjKWaa8' },
        { name: 'Remo Sentado en Polea', machine: 'remo-sentado-polea', sets: 4, reps: '10-12', rest: 60, rir: 1, muscle: 'Espalda media', video: 'JtTusrYzAos' },
        { name: 'Dominadas Asistidas', machine: 'dominadas-asistidas', sets: 3, reps: '8-12', rest: 90, rir: 1, muscle: 'Dorsales + Bíceps', video: 'mzRi9ka6WPQ' },
        { name: 'Curl Scott en Máquina', machine: 'curl-scott-maquina', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Bíceps', video: 'YSbqNBZUWI8' },
        { name: 'Polea Baja para Bíceps', machine: 'polea-baja-biceps', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Bíceps', video: 'wb2pRjlOaqE' },
        { name: 'Elevación de Piernas', machine: 'elevacion-piernas', sets: 3, reps: '15-20', rest: 30, rir: 0, muscle: 'Abdominales inferiores', video: '-0dplV01cIQ' },
      ],
      cardio: {
        type: 'LISS',
        machine: 'eliptica',
        duration: '30 min',
        protocol: 'Ritmo constante, quema de grasas',
      },
      cooldown: '5 min estiramientos de espalda y bíceps',
    },
    {
      day: 6,
      name: 'LEGS B + CORE + ABS',
      focus: 'Hipertrofia de piernas y abdomen definido',
      warmup: '5 min escaladora + rotación de torso',
      exercises: [
        { name: 'Smith Machine para Sentadillas', machine: 'smith-sentadillas', sets: 4, reps: '10-12', rest: 90, rir: 1, muscle: 'Cuádriceps + Glúteos', video: '4r9o_rqFZX4' },
        { name: 'Curl Femoral Sentado', machine: 'curl-femoral-sentado', sets: 3, reps: '12-15', rest: 60, rir: 0, muscle: 'Femorales', video: 'JpSOljujzOY' },
        { name: 'Prensa Horizontal', machine: 'prensa-horizontal', sets: 3, reps: '12-15', rest: 60, rir: 1, muscle: 'Cuádriceps + Glúteos', video: '7II31GoNjSo' },
        { name: 'Aductores', machine: 'aductores', sets: 3, reps: '15-20', rest: 30, rir: 0, muscle: 'Aductores', video: 'dycKfaquQWo' },
        { name: 'Abductores', machine: 'abductores', sets: 3, reps: '15-20', rest: 30, rir: 0, muscle: 'Abductores', video: 'jjd7q5vgtn0' },
        { name: 'Elevación de Pantorrillas de Pie', machine: 'pantorrillas-pie', sets: 4, reps: '12-15', rest: 30, rir: 0, muscle: 'Gemelos', video: 'R9eS_1An8L0' },
        { name: 'Crunch Abdominal en Máquina', machine: 'crunch-maquina', sets: 3, reps: '15-20', rest: 30, rir: 0, muscle: 'Abdominales', video: 'wTlHC-JIprc' },
        { name: 'Elevación de Piernas', machine: 'elevacion-piernas', sets: 3, reps: '12-15', rest: 30, rir: 0, muscle: 'Abdominales inferiores', video: '-0dplV01cIQ' },
        { name: 'Silla Romana', machine: 'silla-romana', sets: 3, reps: '12-15', rest: 30, rir: 0, muscle: 'Espalda baja + Core', video: 'ywvDFF4ll58' },
      ],
      cardio: {
        type: 'HIIT',
        machine: 'battle-ropes',
        duration: '10 min',
        protocol: '30s máximo / 30s descanso',
      },
      cooldown: '5 min estiramientos de piernas y espalda baja',
    },
  ],

  pool: [
    /* Pectoral */
    { name: 'Aperturas en Polea Alta (Cruce de Poleas)', machine: 'polea-alta', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Pectoral mayor', video: 'Iwe6AmxVf7o' },
    { name: 'Press de Pecho con Mancuernas', machine: 'mancuernas', sets: 3, reps: '10-12', rest: 60, rir: 1, muscle: 'Pectoral mayor', video: 'ES_3VKNKRAA' },
    /* Deltoides */
    { name: 'Face Pull en Polea', machine: 'polea-alta', sets: 3, reps: '15-20', rest: 30, rir: 0, muscle: 'Deltoides posterior', video: 'tIuXc_X8T4I' },
    { name: 'Press Arnold con Mancuernas', machine: 'mancuernas', sets: 3, reps: '10-12', rest: 60, rir: 1, muscle: 'Deltoides', video: 'V8GcUp4COLg' },
    /* Tríceps */
    { name: 'Press Francés con Barra EZ', machine: 'barra-ez', sets: 3, reps: '10-12', rest: 45, rir: 0, muscle: 'Tríceps', video: '2azK5QfuWFk' },
    { name: 'Patada de Tríceps con Mancuernas', machine: 'mancuernas', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Tríceps', video: '6SS6K3lAwZ8' },
    /* Bíceps */
    { name: 'Curl con Barra EZ', machine: 'barra-ez', sets: 3, reps: '10-12', rest: 45, rir: 0, muscle: 'Bíceps', video: 'zG2xJ0Q5QtI' },
    { name: 'Curl Martillo con Mancuernas', machine: 'mancuernas', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Bíceps', video: 'zC3nLlEvin4' },
    /* Espalda */
    { name: 'Remo con Mancuernas a Una Mano', machine: 'mancuernas', sets: 3, reps: '10-12', rest: 60, rir: 1, muscle: 'Dorsales', video: 'roCP6wCXPqo' },
    { name: 'Peso Muerto en Polea Baja', machine: 'polea-baja', sets: 3, reps: '10-12', rest: 60, rir: 1, muscle: 'Espalda baja + Glúteos', video: 'KZOF1CXz09w' },
    { name: 'Pull-Up Lastre (si sabes hacer dominadas)', machine: 'power-rack', sets: 3, reps: '8-10', rest: 90, rir: 1, muscle: 'Dorsales + Bíceps', video: 'wsP_5P4MbGQ' },
    /* Piernas — Glúteos */
    { name: 'Hip Thrust en Máquina', machine: 'hip-thrust', sets: 4, reps: '10-12', rest: 90, rir: 1, muscle: 'Glúteos', video: '8xJ0Vxjv0sw' },
    { name: 'Patada de Glúteo en Polea', machine: 'patada-gluteo', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Glúteos', video: 'vHY4JUtKiFc' },
    { name: 'Sentadilla Búlgara con Mancuernas', machine: 'mancuernas', sets: 3, reps: '10-12', rest: 60, rir: 1, muscle: 'Cuádriceps + Glúteos', video: 'K5S8xKIcgSM' },
    /* Piernas — Femorales */
    { name: 'Curl Femoral de Pie', machine: 'curl-femoral-pie', sets: 3, reps: '10-12', rest: 60, rir: 1, muscle: 'Femorales', video: 'b2t0LN9NiJQ' },
    { name: 'Pull Through en Polea', machine: 'pull-through', sets: 3, reps: '12-15', rest: 60, rir: 0, muscle: 'Femorales + Glúteos', video: '4oZ_0_bQcOg' },
    /* Piernas — Quads */
    { name: 'Sentadilla en Rack', machine: 'rack-sentadillas', sets: 4, reps: '8-10', rest: 120, rir: 1, muscle: 'Cuádriceps + Glúteos', video: 'ultWZbUMPL8' },
    { name: 'Zancadas con Mancuernas', machine: 'mancuernas', sets: 3, reps: '10-12', rest: 60, rir: 1, muscle: 'Cuádriceps + Glúteos', video: 'D7KaRcUTQeE' },
    /* Pantorrillas */
    { name: 'Pantorrillas en Prensa 45°', machine: 'pantorrillas-prensa', sets: 4, reps: '15-20', rest: 30, rir: 0, muscle: 'Gemelos + Sóleo', video: 'q4W4_VJbKW0' },
    /* Abdominales */
    { name: 'Crunch en Polea (Cable Crunch)', machine: 'polea-crunch', sets: 3, reps: '15-20', rest: 30, rir: 0, muscle: 'Abdominales', video: '21u4gR7O3Sk' },
    { name: 'Giro Ruso con Balón Medicinal', machine: 'balones-medicinales', sets: 3, reps: '12-15', rest: 30, rir: 0, muscle: 'Abdominales oblicuos', video: 'WOlddRbzsBs' },
    { name: 'Plancha con TRX', machine: 'trx', sets: 3, reps: '30-45s', rest: 30, rir: 0, muscle: 'Core', video: 'eFLvktkGCVE' },
  ],

  getDefaultKg(machineId, profile) {
    const BASE = {
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
      'polea-alta': 20, 'mancuernas': 25, 'barra-ez': 20,
      'hip-thrust': 40, 'patada-gluteo': 20, 'pull-through': 20,
      'curl-femoral-pie': 25, 'rack-sentadillas': 30, 'pantorrillas-prensa': 50,
      'polea-crunch': 15, 'power-rack': 30, 'trx': 10, 'balones-medicinales': 8,
    }
    let kg = BASE[machineId] || 20
    const isUpper = ['press-', 'pec-', 'jalon', 'remo', 'dominadas', 'reverse', 'pullover',
                     'curl-', 'polea-baja', 'polea-alta', 'extension-triceps', 'fondos', 'maquina-fondos',
                     'elevacion-lateral', 'polea-elevaciones', 'crunch', 'elevacion-piernas',
                     'silla-romana', 'aductores', 'mancuernas', 'barra-ez', 'kettlebell',
                     'trx', 'balones', 'banco-declinado'].some(p => machineId.startsWith(p))
    if (profile.gender === 'F') {
      kg = isUpper ? Math.round(kg * 0.45) : Math.round(kg * 0.7)
    }
    const ratio = profile.weightLb / 165
    kg = Math.round(kg * Math.max(0.65, Math.min(1.35, ratio)))
    kg = Math.round(kg / 2.5) * 2.5
    if (kg < 2.5) kg = 2.5
    return kg
  },

  getFocusNote(profile) {
    const base = `Rutina personalizada para ${profile.name || 'ti'} `
    if (profile.gender === 'F') {
      return base + '· ENFOQUE: glúteos + piernas con volumen moderado, upper body con mayor frecuencia y rango de reps más alto para maximizar tono muscular.'
    }
    return base + '· ENFOQUE: fuerza + hipertrofia equilibrada, priorizando pectoral, dorsales y cuádriceps con cargas progresivas.'
  },

  getAlternatives(dayIdx, exIdx) {
    const current = this.days[dayIdx]?.exercises[exIdx]
    if (!current) return []
    const mainMuscle = current.muscle.split(' + ')[0].split(' (')[0].trim()
    const alts = []
    this.days.forEach((day, di) => {
      day.exercises.forEach((ex, ei) => {
        if (di === dayIdx && ei === exIdx) return
        const em = ex.muscle.split(' + ')[0].split(' (')[0].trim()
        if (em === mainMuscle || ex.muscle.includes(mainMuscle) || current.muscle.includes(em)) {
          alts.push({ ...ex, day: di, ex: ei })
        }
      })
    })
    // Add pool exercises matching the same muscle
    this.pool.forEach(ex => {
      const pm = ex.muscle.split(' + ')[0].split(' (')[0].trim()
      if (pm === mainMuscle || ex.muscle.includes(mainMuscle) || current.muscle.includes(pm)) {
        alts.push({ ...ex, fromPool: true })
      }
    })
    const seen = new Set()
    return alts.filter(a => { const k = a.machine + a.name; if (seen.has(k)) return false; seen.add(k); return true })
  },

  validateWorkout(profile) {
    const msgs = []
    const counts = {}
    this.days.forEach(day => {
      day.exercises.forEach(ex => {
        const key = ex.muscle.split(' + ')[0].split(' (')[0].trim()
        counts[key] = (counts[key] || 0) + 1
      })
    })
    const totalEx = Object.values(counts).reduce((a, b) => a + b, 0)
    msgs.push(totalEx + ' ejercicios en la semana')

    if (profile.gender === 'F') {
      let glute = (counts['Glúteos'] || 0)
      this.days.forEach(day => {
        day.exercises.forEach(ex => {
          if (ex.muscle.toLowerCase().includes('glúteo') || ex.muscle.toLowerCase().includes('glute')) glute++
        })
      })
      msgs.push(glute >= 6 ? 'Buen volumen de piernas/glúteos' : 'Considera añadir más ejercicios de cadena posterior')
      msgs.push('Trabaja upper body con más frecuencia (3+ días/sem) para tono')
    } else {
      const chest = (counts['Pectoral mayor'] || 0) + (counts['Pectoral mayor (cabeza clavicular)'] || 0) + (counts['Pectoral mayor (cabeza esternal)'] || 0) + (counts['Pectoral mayor (aducción)'] || 0)
      const back = (counts['Dorsales'] || 0) + (counts['Espalda media'] || 0) + (counts['Dorsal + Romboides'] || 0) + (counts['Dorsales + Serrato'] || 0) + (counts['Dorsales + Bíceps'] || 0)
      msgs.push(chest >= 4 ? 'Volumen de pecho adecuado' : 'Asegura 4+ ejercicios de pecho/semana')
      msgs.push(back >= 4 ? 'Volumen de espalda adecuado' : 'Asegura 4+ ejercicios de espalda/semana')
    }
    return msgs
  },
}
