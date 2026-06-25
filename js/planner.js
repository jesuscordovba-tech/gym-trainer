;(() => {
  window.planner = (function() {
    var POOL = [];
    (function buildPool() {
      workoutPlan.days.forEach(function(day) {
        day.exercises.forEach(function(ex) {
          POOL.push({ name: ex.name, machine: ex.machine, sets: ex.sets, reps: ex.reps, rest: ex.rest, rir: ex.rir, muscle: ex.muscle, video: ex.video || '' });
        });
      });
      workoutPlan.pool.forEach(function(ex) {
        POOL.push({ name: ex.name, machine: ex.machine, sets: ex.sets, reps: ex.reps, rest: ex.rest, rir: ex.rir, muscle: ex.muscle, video: ex.video || '' });
      });
    })();

    var MUSCLE_KW = {
      chest: ['pectoral', 'pecho'],
      shoulders: ['deltoides', 'hombro'],
      triceps: ['tríceps', 'triceps'],
      back: ['dorsales', 'espalda', 'romboides', 'serrato', 'trapecio'],
      biceps: ['bíceps', 'biceps'],
      quads: ['cuádriceps', 'quadriceps', 'cuadriceps'],
      hamstrings: ['femorales', 'isquiotibiales', 'femoral'],
      glutes: ['glúteo', 'gluteo', 'glute', 'glúteos', 'gluteos'],
      calves: ['pantorrillas', 'gemelos', 'sóleo', 'soleo'],
      abs: ['abdominal', 'core', 'oblicuos', 'espalda baja']
    };

    function getMachineKey(exerciseName) {
      var found = POOL.find(function(ex) { return ex.name === exerciseName; });
      return found ? found.machine : null;
    }

    function getExercisesForMuscle(muscle) {
      var keywords = MUSCLE_KW[muscle] || [muscle];
      return POOL.filter(function(ex) {
        var m = ex.muscle.toLowerCase();
        return keywords.some(function(k) { return m.indexOf(k) >= 0; });
      });
    }

    function getSetsByGoal(goal, experience) {
      if (goal === 'strength') return experience === 'beginner' ? 4 : 5;
      if (goal === 'muscleGain') return experience === 'beginner' ? 3 : 4;
      if (goal === 'fatLoss') return 3;
      return 3;
    }

    function getRepsByGoal(goal) {
      if (goal === 'strength') return '6-8';
      if (goal === 'muscleGain') return '8-12';
      if (goal === 'fatLoss') return '12-15';
      return '10-12';
    }

    function getRestByGoal(goal) {
      if (goal === 'strength') return 120;
      if (goal === 'muscleGain') return 90;
      if (goal === 'fatLoss') return 45;
      return 60;
    }

    function getRirByGoal(goal) {
      if (goal === 'strength') return 1;
      if (goal === 'muscleGain') return 1;
      if (goal === 'fatLoss') return 0;
      return 1;
    }

    function getExerciseCount(experience) {
      if (experience === 'beginner') return 2;
      if (experience === 'intermediate') return 3;
      return 4;
    }

    function getWarmupByGoal(goal, focus) {
      if (focus && focus.indexOf('empuje') >= 0) return '5 min elíptica + movilidad de hombros';
      if (focus && focus.indexOf('tracción') >= 0) return '5 min remo + movilidad torácica';
      if (focus && focus.indexOf('pierna') >= 0) return '5 min bicicleta + movilidad de cadera';
      return '5 min elíptica + movilidad articular';
    }

    function getCardioByGoal(goal) {
      if (goal === 'fatLoss') return { type: 'HIIT', machine: 'caminadora', duration: '20 min', protocol: '1 min trote / 30s sprint' };
      if (goal === 'maintenance') return { type: 'LISS', machine: 'eliptica', duration: '20 min', protocol: 'Ritmo constante' };
      return { type: 'HIIT', machine: 'bicicleta-spinning', duration: '15 min', protocol: '30s sprint / 30s descanso' };
    }

    function getCooldownByGoal(goal) {
      return '5 min estiramientos';
    }

    function getMuscleGroupsForSplit(splitType) {
      var map = {
        ppl: ['chest', 'shoulders', 'triceps', 'back', 'biceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs'],
        upperLower: ['chest', 'shoulders', 'triceps', 'back', 'biceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs'],
        fullBody: ['chest', 'shoulders', 'triceps', 'back', 'biceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs'],
        pushPull: ['chest', 'shoulders', 'triceps', 'back', 'biceps', 'abs']
      };
      return map[splitType] || map.ppl;
    }

    function selectSplit(goal, experience, preferredDays) {
      var pd = (typeof preferredDays === 'number' && preferredDays > 0) ? preferredDays : 3;
      preferredDays = pd;
      if (goal === 'muscleGain' && experience === 'beginner' && preferredDays === 4) {
        return {
          type: 'upperLower',
          daysCount: 4,
          dayTemplates: [
            { name: 'Upper A', focus: 'Empuje y tracción superiores', muscleGroups: ['chest', 'shoulders', 'triceps', 'back', 'biceps'] },
            { name: 'Lower A', focus: 'Piernas completas', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'] },
            { name: 'Upper B', focus: 'Variación de empuje y tracción', muscleGroups: ['chest', 'shoulders', 'triceps', 'back', 'biceps'] },
            { name: 'Lower B', focus: 'Variación de piernas', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'] }
          ]
        };
      }
      if (goal === 'muscleGain' && experience === 'intermediate' && (preferredDays === 5 || preferredDays === 6)) {
        var days = [];
        days.push({ name: 'Push A', focus: 'Pecho y hombros', muscleGroups: ['chest', 'shoulders', 'triceps'] });
        days.push({ name: 'Pull A', focus: 'Espalda y bíceps', muscleGroups: ['back', 'biceps'] });
        days.push({ name: 'Legs A', focus: 'Piernas completas', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves'] });
        days.push({ name: 'Push B', focus: 'Variación de empuje', muscleGroups: ['chest', 'shoulders', 'triceps'] });
        days.push({ name: 'Pull B', focus: 'Variación de espalda', muscleGroups: ['back', 'biceps'] });
        if (preferredDays === 6) days.push({ name: 'Legs B', focus: 'Énfasis en glúteos y femorales', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'] });
        return { type: 'ppl', daysCount: preferredDays, dayTemplates: days };
      }
      if (goal === 'strength') {
        if (preferredDays <= 3) {
          return {
            type: 'fullBody',
            daysCount: 3,
            dayTemplates: [
              { name: 'Full Body A', focus: 'Fuerza general', muscleGroups: ['chest', 'shoulders', 'back', 'quads', 'abs'] },
              { name: 'Full Body B', focus: 'Fuerza de piernas y tracción', muscleGroups: ['back', 'biceps', 'hamstrings', 'glutes', 'abs'] },
              { name: 'Full Body C', focus: 'Fuerza de empuje y cuádriceps', muscleGroups: ['chest', 'shoulders', 'triceps', 'quads', 'calves'] }
            ]
          };
        }
        return {
          type: 'upperLower',
          daysCount: 4,
          dayTemplates: [
            { name: 'Upper Strength', focus: 'Fuerza superior', muscleGroups: ['chest', 'shoulders', 'triceps', 'back', 'biceps'] },
            { name: 'Lower Strength', focus: 'Fuerza de piernas', muscleGroups: ['quads', 'hamstrings', 'glutes', 'abs'] },
            { name: 'Upper Power', focus: 'Potencia y accesorios', muscleGroups: ['chest', 'shoulders', 'triceps', 'back', 'biceps'] },
            { name: 'Lower Power', focus: 'Potencia de piernas', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'] }
          ]
        };
      }
      if (goal === 'fatLoss') {
        var fatDays = [];
        fatDays.push({ name: 'Push', focus: 'Empuje con quema calórica', muscleGroups: ['chest', 'shoulders', 'triceps'] });
        fatDays.push({ name: 'Pull', focus: 'Tracción con quema calórica', muscleGroups: ['back', 'biceps'] });
        fatDays.push({ name: 'Legs', focus: 'Piernas con HIIT', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves'] });
        if (preferredDays >= 4) fatDays.push({ name: 'Upper + Core', focus: 'Parte superior y abdomen', muscleGroups: ['chest', 'shoulders', 'back', 'abs'] });
        if (preferredDays >= 5) fatDays.push({ name: 'Full Body', focus: 'Cuerpo completo metabólico', muscleGroups: ['chest', 'back', 'quads', 'hamstrings', 'abs'] });
        return { type: 'ppl', daysCount: Math.min(preferredDays, 5), dayTemplates: fatDays };
      }
      if (goal === 'maintenance') {
        if (preferredDays <= 3) {
          return {
            type: 'fullBody',
            daysCount: 3,
            dayTemplates: [
              { name: 'Full Body A', focus: 'Mantenimiento general', muscleGroups: ['chest', 'shoulders', 'back', 'quads', 'abs'] },
              { name: 'Full Body B', focus: 'Mantenimiento posterior', muscleGroups: ['back', 'biceps', 'hamstrings', 'glutes', 'calves'] },
              { name: 'Full Body C', focus: 'Mantenimiento anterior', muscleGroups: ['chest', 'shoulders', 'triceps', 'quads', 'abs'] }
            ]
          };
        }
        return {
          type: 'upperLower',
          daysCount: 4,
          dayTemplates: [
            { name: 'Upper', focus: 'Parte superior', muscleGroups: ['chest', 'shoulders', 'triceps', 'back', 'biceps'] },
            { name: 'Lower', focus: 'Parte inferior', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'] },
            { name: 'Upper Push+', focus: 'Empuje y hombros', muscleGroups: ['chest', 'shoulders', 'triceps', 'abs'] },
            { name: 'Lower Pull+', focus: 'Cadena posterior', muscleGroups: ['back', 'biceps', 'hamstrings', 'glutes'] }
          ]
        };
      }
      if (preferredDays <= 3) {
        return {
          type: 'fullBody',
          daysCount: 3,
          dayTemplates: [
            { name: 'Full Body A', focus: 'Cuerpo completo', muscleGroups: ['chest', 'back', 'quads', 'abs'] },
            { name: 'Full Body B', focus: 'Cuerpo completo variación', muscleGroups: ['shoulders', 'biceps', 'hamstrings', 'glutes'] },
            { name: 'Full Body C', focus: 'Cuerpo completo final', muscleGroups: ['triceps', 'back', 'quads', 'calves', 'abs'] }
          ]
        };
      }
      if (preferredDays === 4) {
        return {
          type: 'upperLower',
          daysCount: 4,
          dayTemplates: [
            { name: 'Upper A', focus: 'Parte superior', muscleGroups: ['chest', 'shoulders', 'triceps', 'back', 'biceps'] },
            { name: 'Lower A', focus: 'Parte inferior', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'] },
            { name: 'Upper B', focus: 'Parte superior variación', muscleGroups: ['chest', 'shoulders', 'triceps', 'back', 'biceps'] },
            { name: 'Lower B', focus: 'Parte inferior variación', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'] }
          ]
        };
      }
      return {
        type: 'ppl',
        daysCount: Math.min(preferredDays, 6),
        dayTemplates: [
          { name: 'Push', focus: 'Empuje', muscleGroups: ['chest', 'shoulders', 'triceps'] },
          { name: 'Pull', focus: 'Tracción', muscleGroups: ['back', 'biceps'] },
          { name: 'Legs', focus: 'Piernas', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves'] },
          { name: 'Push + Core', focus: 'Empuje y abdomen', muscleGroups: ['chest', 'shoulders', 'triceps', 'abs'] },
          { name: 'Pull + Core', focus: 'Tracción y abdomen', muscleGroups: ['back', 'biceps', 'abs'] },
          { name: 'Legs + Full Core', focus: 'Piernas y core', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'] }
        ].slice(0, Math.min(preferredDays, 6))
      };
    }

    function getExerciseHistory(exerciseName, history) {
      var machineKey = getMachineKey(exerciseName);
      if (!machineKey || !history) return [];
      var weeks = Object.keys(history).sort();
      var result = [];
      for (var wi = 0; wi < weeks.length; wi++) {
        var wk = history[weeks[wi]];
        if (!wk || !wk.weights) continue;
        if (wk.weights[machineKey]) {
          result.push({ week: weeks[wi], weight: parseFloat(wk.weights[machineKey]), setsCompleted: 0, totalSets: 0 });
        }
      }
      return result;
    }

    function wasUsedRecently(exerciseName, history, weeks) {
      var machineKey = getMachineKey(exerciseName);
      if (!machineKey || !history) return false;
      var weekKeys = Object.keys(history).sort();
      var recent = weekKeys.slice(-weeks);
      for (var wi = 0; wi < recent.length; wi++) {
        var wk = history[recent[wi]];
        if (!wk || !wk.weights) continue;
        if (wk.weights[machineKey]) return true;
      }
      return false;
    }

    function getLastWeight(exerciseName, history) {
      var machineKey = getMachineKey(exerciseName);
      if (!machineKey || !history) return null;
      var weeks = Object.keys(history).sort();
      for (var wi = weeks.length - 1; wi >= 0; wi--) {
        var wk = history[weeks[wi]];
        if (!wk || !wk.weights) continue;
        if (wk.weights[machineKey] && parseFloat(wk.weights[machineKey]) > 0) {
          return parseFloat(wk.weights[machineKey]);
        }
      }
      return null;
    }

    function calculateProgression(exerciseName, history, goal) {
      var exHistory = getExerciseHistory(exerciseName, history);
      if (!exHistory || exHistory.length === 0) {
        return { increment: 0, label: 'Inicia' };
      }
      var last = exHistory[exHistory.length - 1];
      var completionRate = last.totalSets > 0 ? last.setsCompleted / last.totalSets : 0;
      if (completionRate >= 0.85) {
        var inc = goal === 'strength' ? 2.5 : 1.25;
        return { increment: inc, label: '+' + inc + 'kg' };
      }
      if (completionRate < 0.6) {
        return { increment: -2.5, label: '-2.5kg' };
      }
      return { increment: 0, label: 'Mantener' };
    }

    function selectExercisesForDay(dayTemplate, gymData, history, experience, goal) {
      var exercises = [];
      var usedMachines = new Set();
      var usedNames = new Set();

      for (var mi = 0; mi < dayTemplate.muscleGroups.length; mi++) {
        var muscle = dayTemplate.muscleGroups[mi];
        var available = getExercisesForMuscle(muscle).filter(function(ex) {
          return !usedMachines.has(ex.machine);
        });

        if (experience === 'beginner') {
          available.sort(function(a, b) {
            var aUsed = wasUsedRecently(a.name, history, 2);
            var bUsed = wasUsedRecently(b.name, history, 2);
            if (aUsed && !bUsed) return -1;
            if (!aUsed && bUsed) return 1;
            return 0;
          });
        } else {
          var shuffled = [];
          var alreadyUsed = [];
          var fresh = [];
          for (var si = 0; si < available.length; si++) {
            if (wasUsedRecently(available[si].name, history, 2)) {
              alreadyUsed.push(available[si]);
            } else {
              fresh.push(available[si]);
            }
          }
          for (var si2 = 0; si2 < fresh.length; si2++) {
            var swapIdx = Math.floor(Math.random() * (fresh.length - si2)) + si2;
            var tmp = fresh[si2];
            fresh[si2] = fresh[swapIdx];
            fresh[swapIdx] = tmp;
          }
          shuffled = alreadyUsed.concat(fresh);
          available = shuffled;
        }

        var count = getExerciseCount(experience);
        var picked = available.slice(0, count);

        for (var pi = 0; pi < picked.length; pi++) {
          var machine = picked[pi];
          if (usedNames.has(machine.name)) continue;
          usedMachines.add(machine.machine);
          usedNames.add(machine.name);
          var lastWeight = getLastWeight(machine.name, history);
          var progression = calculateProgression(machine.name, history, goal);
          var profile = typeof db !== 'undefined' && db.getProfile ? db.getProfile() : { gender: 'M', weightLb: 165 };
          var defaultKg = lastWeight !== null ? lastWeight + progression.increment : (workoutPlan.getDefaultKg ? workoutPlan.getDefaultKg(machine.machine, profile) : 20);
          if (defaultKg < 2.5) defaultKg = 2.5;

          exercises.push({
            name: machine.name,
            machine: machine.machine,
            sets: getSetsByGoal(goal, experience),
            reps: getRepsByGoal(goal),
            rest: getRestByGoal(goal),
            rir: getRirByGoal(goal),
            muscle: machine.muscle,
            video: machine.video || '',
            targetWeight: Math.round(defaultKg / 2.5) * 2.5,
            progression: progression.label
          });
        }
      }

      return exercises;
    }

    function generateWeeklyPlan(profile, progress, weights, history) {
      if (!profile || !profile.dynamicPlansEnabled) return null;
      if (!profile.goal || !profile.experienceLevel || !profile.preferredDays) return null;

      var now = new Date();
      var day = now.getDay();
      var diff = now.getDate() - day + (day === 0 ? -6 : 1);
      var monday = new Date(now.getFullYear(), now.getMonth(), diff);
      var weekStart = monday.toISOString().split('T')[0];

      function getISOWeekString(date) {
        var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        var dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        var weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return d.getUTCFullYear() + '-W' + String(weekNum).padStart(2, '0');
      }

      var generatedForWeek = getISOWeekString(now);
      var splitDef = selectSplit(profile.goal, profile.experienceLevel, profile.preferredDays);
      var goal = profile.goal;
      var experience = profile.experienceLevel;

      var splitName = splitDef.type === 'ppl' ? 'Push/Pull/Legs' :
                      splitDef.type === 'upperLower' ? 'Upper/Lower' :
                      splitDef.type === 'fullBody' ? 'Full Body' : splitDef.type;

      var goalName = goal === 'muscleGain' ? 'Hipertrofia' :
                     goal === 'strength' ? 'Fuerza' :
                     goal === 'fatLoss' ? 'Pérdida de Grasa' : 'Mantenimiento';

      var expName = experience === 'beginner' ? 'Principiante' :
                    experience === 'intermediate' ? 'Intermedio' : 'Avanzado';

      var planName = splitName + ' - ' + goalName + ' - ' + expName;
      var totalVolume = 0;
      var days = [];

      for (var di = 0; di < splitDef.dayTemplates.length; di++) {
        var dt = splitDef.dayTemplates[di];
        var exercises = selectExercisesForDay(dt, window.gymData, history, experience, goal);
        for (var ei = 0; ei < exercises.length; ei++) {
          totalVolume += exercises[ei].sets;
        }
        days.push({
          day: di + 1,
          name: dt.name + ' — ' + dt.focus.charAt(0).toUpperCase() + dt.focus.slice(1),
          focus: dt.focus,
          warmup: getWarmupByGoal(goal, dt.focus),
          exercises: exercises,
          cardio: getCardioByGoal(goal),
          cooldown: getCooldownByGoal(goal)
        });
      }

      return {
        generatedForWeek: generatedForWeek,
        weekStart: weekStart,
        profileSnapshot: {
          age: profile.age,
          weightKg: profile.weightKg,
          goal: profile.goal,
          experience: profile.experienceLevel,
          preferredDays: profile.preferredDays
        },
        name: planName,
        days: days,
        meta: {
          algorithm: 'v1',
          generatedAt: new Date().toISOString(),
          totalVolume: totalVolume
        }
      };
    }

    return {
      generateWeeklyPlan: generateWeeklyPlan,
      selectSplit: selectSplit,
      selectExercisesForDay: selectExercisesForDay,
      calculateProgression: calculateProgression,
      getMuscleGroupsForSplit: getMuscleGroupsForSplit,
      getMachinesForMuscle: getExercisesForMuscle,
      getExerciseHistory: getExerciseHistory,
      wasUsedRecently: wasUsedRecently,
      getLastWeight: getLastWeight,
      getSetsByGoal: getSetsByGoal,
      getRepsByGoal: getRepsByGoal,
      getRestByGoal: getRestByGoal,
      getRirByGoal: getRirByGoal,
      getExerciseCount: getExerciseCount
    };
  })();
})();
