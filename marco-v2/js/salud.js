/* Salud (Garmin) para el marco.
 * Si no hay sincronización, pinta datos de ejemplo marcados como tales.
 * Con sincronización, app.js pide la acción «salud» y guarda la última copia
 * en localStorage (marco-v2.cache.salud). Aquí no hay claves ni tokens. */
(function () {
  'use strict';

  const HRV = {
    BALANCED: 'Equilibrada',
    UNBALANCED: 'Desequilibrada',
    LOW: 'Baja',
    POOR: 'Pobre',
    NONE: 'Sin estado',
    GOOD: 'Buena',
    MODERATE: 'Moderada'
  };
  const TIPOS = {
    running: 'Carrera',
    treadmill_running: 'Cinta',
    trail_running: 'Trail',
    cycling: 'Ciclismo',
    indoor_cycling: 'Ciclismo indoor',
    virtual_ride: 'Ciclismo virtual',
    swimming: 'Natación',
    lap_swimming: 'Natación',
    open_water_swimming: 'Aguas abiertas',
    walking: 'Caminar',
    hiking: 'Senderismo',
    strength_training: 'Fuerza',
    yoga: 'Yoga',
    elliptical: 'Elíptica',
    rowing: 'Remo',
    indoor_rowing: 'Remo',
    fitness_equipment: 'Gimnasio',
    multi_sport: 'Multideporte',
    breathwork: 'Respiración'
  };

  function num(n) {
    if (n == null || n === '') return null;
    const x = Number(n);
    return isFinite(x) ? x : null;
  }
  function hours(sec) {
    const s = num(sec);
    if (s == null) return '–';
    const total = Math.max(0, Math.round(s / 60));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h <= 0) return m + ' min';
    return h + ' h' + (m ? ' ' + m + ' min' : '');
  }
  function fmtInt(n) {
    const x = num(n);
    if (x == null) return '–';
    try { return Math.round(x).toLocaleString('es-ES'); } catch (e) { return String(Math.round(x)); }
  }
  function fmtDist(m) {
    const x = num(m);
    if (x == null || x <= 0) return '';
    if (x < 1000) return Math.round(x) + ' m';
    try {
      return (x / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ' km';
    } catch (e) {
      return (Math.round(x / 100) / 10) + ' km';
    }
  }
  function hrvLabel(s) {
    const k = String(s || '').trim().toUpperCase();
    if (!k) return '–';
    return HRV[k] || (k.charAt(0) + k.slice(1).toLowerCase());
  }
  function tipo(k) {
    const key = String(k || '').trim();
    if (!key) return 'Actividad';
    if (TIPOS[key]) return TIPOS[key];
    return key.replace(/_/g, ' ');
  }
  function daysOf(data) {
    return ((data && data.days) || []).slice().filter((d) => d && d.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }
  function lastWith(data, pred) {
    const days = daysOf(data);
    for (let i = days.length - 1; i >= 0; i--) if (pred(days[i])) return days[i];
    return null;
  }
  function lastSleep(data) { return lastWith(data, (d) => num(d.sleepSeconds) != null); }
  function lastHrv(data) { return lastWith(data, (d) => num(d.hrv) != null); }
  function today(data, t) {
    const key = U.dayKey(U.sod(t || U.now()));
    const days = daysOf(data);
    for (let i = 0; i < days.length; i++) if (days[i].date === key) return days[i];
    return days.length ? days[days.length - 1] : null;
  }
  function goal(data) {
    const g = num(data && data.stepsGoal);
    if (g && g > 0) return Math.round(g);
    const cfg = window.CFG && num(window.CFG.stepsGoal);
    return cfg && cfg > 0 ? Math.round(cfg) : 10000;
  }
  function workouts(data) {
    return ((data && data.workouts) || []).slice().filter((w) => w && (w.name || w.type)).sort((a, b) => String(b.start || b.date).localeCompare(String(a.start || a.date))).slice(0, 7);
  }

  function demo(t) {
    t = t || U.now();
    const steps = [6200, 8400, 4500, 10200, 7800, 9100, 3560];
    const sleepH = [7.4, 6.8, 8.1, 7.1, 6.5, 7.6, 5.9];
    const scores = [74, 69, 86, 77, 64, 81, 58];
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = U.addDays(U.sod(t), -i);
      const idx = 6 - i;
      const sec = Math.round(sleepH[idx] * 3600);
      days.push({
        date: U.dayKey(d),
        steps: steps[idx],
        restingHr: 52 + (idx % 3),
        bodyBatteryMin: 12 + idx,
        bodyBatteryMax: 80 + (idx % 5),
        sleepSeconds: sec,
        sleepScore: scores[idx],
        deepSeconds: Math.round(sec * 0.18),
        lightSeconds: Math.round(sec * 0.48),
        remSeconds: Math.round(sec * 0.22),
        awakeSeconds: Math.round(sec * 0.12),
        hrv: 42 + idx,
        hrvWeekly: 46,
        hrvStatus: idx === 4 ? 'UNBALANCED' : 'BALANCED'
      });
    }
    function at(daysAgo, hm) {
      const d = U.dayKey(U.addDays(U.sod(t), -daysAgo));
      return { date: d, start: d + 'T' + hm };
    }
    const a = at(1, '18:20:00');
    const b = at(2, '07:40:00');
    const c = at(4, '13:05:00');
    const d = at(6, '19:10:00');
    return {
      ok: true,
      demo: true,
      stale: false,
      stepsGoal: 8000,
      days: days,
      workouts: [
        Object.assign(a, { type: 'running', name: 'Carrera de ejemplo', duration: 1920, distance: 5100, avgHr: 146, calories: 410 }),
        Object.assign(b, { type: 'strength_training', name: 'Fuerza (ejemplo)', duration: 2700, distance: 0, avgHr: 112, calories: 280 }),
        Object.assign(c, { type: 'cycling', name: 'Bici de ejemplo', duration: 3600, distance: 18500, avgHr: 131, calories: 540 }),
        Object.assign(d, { type: 'walking', name: 'Paseo de ejemplo', duration: 2400, distance: 3200, avgHr: 98, calories: 160 })
      ]
    };
  }

  window.Salud = {
    EVERY: 30 * 60000,
    demo: demo,
    num: num,
    hours: hours,
    fmtInt: fmtInt,
    fmtDist: fmtDist,
    hrvLabel: hrvLabel,
    tipo: tipo,
    daysOf: daysOf,
    lastSleep: lastSleep,
    lastHrv: lastHrv,
    today: today,
    goal: goal,
    workouts: workouts
  };
})();
