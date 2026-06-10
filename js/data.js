const userProfile = {
  name: '',
  age: 21,
  heightCm: 182,
  weightLb: 180,
  gender: 'M',
  get bmr() {
    const w = this.weightLb * 0.453592
    const h = this.heightCm
    const a = this.age
    return Math.round(10 * w + 6.25 * h - 5 * a + 5)
  },
  get tdee() { return Math.round(this.bmr * 1.55) },
  get deficitCalories() { return this.tdee - 500 },
  get weightKg() { return (this.weightLb * 0.453592).toFixed(1) },
  get bmi() { return ((this.weightKg / ((this.heightCm / 100) ** 2))).toFixed(1) },
}

const gymData = {
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
      { id: 'barras-olicas', name: 'Barras Olímpicas' },
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
        { name: 'Press de Hombros Sentado', machine: 'press-hombros-sentado', sets: 4, reps: '8-10', rest: 90, rir: 1, muscle: 'Deltoides', video: videoSearchUrl('press de hombros sentado maquina') },
        { name: 'Press Inclinado Sentado', machine: 'press-inclinado-sentado', sets: 3, reps: '10-12', rest: 60, rir: 1, muscle: 'Pectoral mayor (cabeza clavicular)', video: videoSearchUrl('press inclinado sentado maquina') },
        { name: 'Elevación Lateral en Máquina', machine: 'elevacion-lateral-maquina', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Deltoides lateral', video: '1Z0g4jl8DDQ' },
        { name: 'Extensión de Tríceps en Polea Alta', machine: 'extension-triceps-polea-alta', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Tríceps', video: 'cGEPFQ99pyQ' },
        { name: 'Fondos Asistidos', machine: 'fondos-asistidos', sets: 3, reps: '10-15', rest: 60, rir: 1, muscle: 'Pecho + Tríceps', video: videoSearchUrl('fondos asistidos maquina') },
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
        { name: 'Remo Unilateral', machine: 'remo-unilateral', sets: 3, reps: '10-12', rest: 60, rir: 1, muscle: 'Dorsal + Romboides', video: videoSearchUrl('remo unilateral mancuerna') },
        { name: 'Reverse Pec Deck', machine: 'reverse-pec-deck', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Deltoides posterior', video: videoSearchUrl('reverse pec deck maquina') },
        { name: 'Curl de Bíceps en Máquina', machine: 'curl-biceps-maquina', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Bíceps', video: '_CKKZGJ48DE' },
        { name: 'Pullover en Máquina', machine: 'pullover-maquina', sets: 3, reps: '10-12', rest: 60, rir: 1, muscle: 'Dorsales + Serrato', video: videoSearchUrl('pullover maquina espalda') },
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
        { name: 'Curl Femoral Acostado', machine: 'curl-femoral-acostado', sets: 4, reps: '8-10', rest: 90, rir: 1, muscle: 'Femorales', video: videoSearchUrl('curl femoral acostado maquina') },
        { name: 'Prensa de Piernas 45°', machine: 'prensa-45', sets: 3, reps: '10-12', rest: 90, rir: 1, muscle: 'Cuádriceps + Glúteos', video: videoSearchUrl('prensa piernas 45 grados') },
        { name: 'Sentadilla Hack Invertida', machine: 'hack-invertida', sets: 3, reps: '10-12', rest: 60, rir: 1, muscle: 'Cuádriceps', video: videoSearchUrl('hack squat invertido') },
        { name: 'Extensión de Piernas', machine: 'extension-piernas', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Cuádriceps', video: videoSearchUrl('extension de piernas maquina') },
        { name: 'Elevación de Pantorrillas Sentado', machine: 'pantorrillas-sentado', sets: 3, reps: '15-20', rest: 30, rir: 0, muscle: 'Sóleo', video: videoSearchUrl('elevacion pantorrillas sentado') },
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
        { name: 'Máquina Convergente para Pecho', machine: 'maquina-convergente-pecho', sets: 4, reps: '10-12', rest: 60, rir: 1, muscle: 'Pectoral mayor', video: videoSearchUrl('maquina convergente pecho') },
        { name: 'Pec Deck', machine: 'pec-deck', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Pectoral mayor (aducción)', video: '0nSrP3Xpvx4' },
        { name: 'Press Declinado Sentado', machine: 'press-declinado-sentado', sets: 3, reps: '10-12', rest: 60, rir: 1, muscle: 'Pectoral mayor (cabeza esternal)', video: videoSearchUrl('press declinado sentado maquina') },
        { name: 'Polea para Elevaciones Laterales', machine: 'polea-elevaciones-laterales', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Deltoides lateral', video: videoSearchUrl('elevaciones laterales polea') },
        { name: 'Máquina de Fondos para Tríceps', machine: 'maquina-fondos-triceps', sets: 3, reps: '10-15', rest: 45, rir: 0, muscle: 'Tríceps', video: videoSearchUrl('maquina fondos triceps') },
        { name: 'Extensión de Tríceps por Encima de la Cabeza en Polea', machine: 'extension-triceps-cabeza-polea', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Tríceps (cabeza larga)', video: videoSearchUrl('extension triceps sobre cabeza polea') },
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
        { name: 'Dominadas Asistidas', machine: 'dominadas-asistidas', sets: 3, reps: '8-12', rest: 90, rir: 1, muscle: 'Dorsales + Bíceps', video: videoSearchUrl('dominadas asistidas maquina') },
        { name: 'Curl Scott en Máquina', machine: 'curl-scott-maquina', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Bíceps', video: videoSearchUrl('curl scott maquina') },
        { name: 'Polea Baja para Bíceps', machine: 'polea-baja-biceps', sets: 3, reps: '12-15', rest: 45, rir: 0, muscle: 'Bíceps', video: videoSearchUrl('polea baja biceps') },
        { name: 'Elevación de Piernas', machine: 'elevacion-piernas', sets: 3, reps: '15-20', rest: 30, rir: 0, muscle: 'Abdominales inferiores', video: videoSearchUrl('elevacion de piernas abdominales') },
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
        { name: 'Smith Machine para Sentadillas', machine: 'smith-sentadillas', sets: 4, reps: '10-12', rest: 90, rir: 1, muscle: 'Cuádriceps + Glúteos', video: videoSearchUrl('smith machine sentadillas') },
        { name: 'Curl Femoral Sentado', machine: 'curl-femoral-sentado', sets: 3, reps: '12-15', rest: 60, rir: 0, muscle: 'Femorales', video: videoSearchUrl('curl femoral sentado') },
        { name: 'Prensa Horizontal', machine: 'prensa-horizontal', sets: 3, reps: '12-15', rest: 60, rir: 1, muscle: 'Cuádriceps + Glúteos', video: videoSearchUrl('prensa horizontal piernas') },
        { name: 'Aductores + Abductores (superset)', machine: 'aductores', sets: 3, reps: '15-20', rest: 30, rir: 0, muscle: 'Aductores / Abductores', supersetWith: 'abductores', video: videoSearchUrl('aductores abductores maquina') },
        { name: 'Elevación de Pantorrillas de Pie', machine: 'pantorrillas-pie', sets: 4, reps: '12-15', rest: 30, rir: 0, muscle: 'Gemelos', video: videoSearchUrl('elevacion pantorrillas de pie') },
        { name: 'Crunch Abdominal en Máquina', machine: 'crunch-maquina', sets: 3, reps: '15-20', rest: 30, rir: 0, muscle: 'Abdominales', video: videoSearchUrl('crunch abdominal maquina') },
        { name: 'Elevación de Piernas', machine: 'elevacion-piernas', sets: 3, reps: '12-15', rest: 30, rir: 0, muscle: 'Abdominales inferiores', video: videoSearchUrl('elevacion de piernas abdominales') },
        { name: 'Silla Romana', machine: 'silla-romana', sets: 3, reps: '12-15', rest: 30, rir: 0, muscle: 'Espalda baja + Core', video: videoSearchUrl('silla romana ejercicios') },
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
}
