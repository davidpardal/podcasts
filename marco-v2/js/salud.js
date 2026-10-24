/* Salud (Garmin) para el marco.
 * Si no hay sincronización, pinta datos de ejemplo marcados como tales (28 días).
 * Con sincronización, app.js pide la acción «salud» y guarda la última copia
 * en localStorage (marco-v2.cache.salud). Aquí no hay claves ni tokens.
 * Un día sin medida llega sin ese campo (o null): es un corte en la gráfica, no un cero.
 * El peso va en gramos (weightGrams). */
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

  const METRICS = [
    { key: 'restingHr', title: 'Pulso en reposo', unit: 'lpm', format: 'int', better: 'down', color: '#C8243B', night: false },
    { key: 'hrv', title: 'VFC', unit: 'ms', format: 'int', better: 'up', color: '#8E5BC8', night: true },
    { key: 'steps', title: 'Pasos', unit: '', format: 'int', better: 'up', color: '#3BA55C', night: false },
    { key: 'weightGrams', title: 'Peso', unit: 'kg', format: 'weight', better: 'flat', color: '#2F80ED', night: false },
    { key: 'sleepSeconds', title: 'Descanso', unit: '', format: 'duration', better: 'up', color: '#3B4C9A', night: true },
    { key: 'trainingSeconds', title: 'Entreno', unit: '', format: 'duration', better: 'flat', color: '#C98500', night: false }
  ];

  function average(days, key) {
    let sum = 0;
    let n = 0;
    (days || []).forEach((d) => {
      const v = num(d && d[key]);
      if (v == null) return;
      sum += v;
      n += 1;
    });
    return n ? sum / n : null;
  }

  function series(data, n, end) {
    const last = U.sod(end || U.now());
    const by = {};
    daysOf(data).forEach((d) => { by[d.date] = d; });
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const key = U.dayKey(U.addDays(last, -i));
      out.push(by[key] || { date: key });
    }
    return out;
  }

  function metricStats(days, key) {
    let sum = 0;
    let count = 0;
    let current = null;
    let date = null;
    days.forEach((d) => {
      const v = num(d[key]);
      if (v == null) return;
      sum += v;
      count += 1;
      current = v;
      date = d.date;
    });
    return { current: current, date: date, avg: count ? sum / count : null, count: count };
  }

  function trends(data, n, t) {
    n = n === 28 ? 28 : 7;
    t = t || U.now();
    const days = series(data, n, t);
    const prevDays = series(data, n, U.addDays(U.sod(t), -n));
    const prevAvg = (data && data.previous && data.previous.avg) || {};
    return METRICS.map((m) => {
      const cur = metricStats(days, m.key);
      let prev = average(prevDays, m.key);
      if (prev == null && n === 28) prev = num(prevAvg[m.key]);
      return {
        key: m.key,
        title: m.title,
        unit: m.unit,
        format: m.format,
        better: m.better,
        color: m.color,
        night: m.night,
        n: n,
        days: days,
        current: cur.current,
        currentDate: cur.date,
        avg: cur.avg,
        count: cur.count,
        prev: prev,
        delta: (cur.avg != null && prev != null) ? cur.avg - prev : null
      };
    });
  }

  function fmtMetric(format, v, withUnit, unit) {
    if (v == null || !isFinite(v)) return '–';
    if (format === 'weight') {
      const kg = v / 1000;
      let s;
      try { s = kg.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
      catch (e) { s = (Math.round(kg * 10) / 10).toFixed(1).replace('.', ','); }
      return withUnit ? s + ' kg' : s;
    }
    if (format === 'duration') return hours(v);
    const s = fmtInt(v);
    return withUnit && unit ? s + ' ' + unit : s;
  }

  function axisNum(format, v) {
    if (format === 'weight') return fmtMetric('weight', v, false);
    if (format === 'duration') {
      const h = Math.round((v / 3600) * 10) / 10;
      try { return h.toLocaleString('es-ES', { maximumFractionDigits: 1 }) + 'h'; }
      catch (e) { return String(h).replace('.', ',') + 'h'; }
    }
    return fmtInt(Math.round(v));
  }

  function tone(better, signed) {
    if (!signed) return 'flat';
    if (better === 'up') return signed > 0 ? 'good' : 'bad';
    if (better === 'down') return signed < 0 ? 'good' : 'bad';
    return 'flat';
  }

  function fmtChange(m) {
    const period = m.n === 28 ? 'los 28 días anteriores' : 'los 7 días anteriores';
    if (m.avg == null || m.prev == null || m.delta == null) return { text: 'Sin periodo anterior', cls: 'flat' };
    const d = m.delta;
    if (m.format === 'weight') {
      if (Math.abs(d) < 50) return { text: 'Igual que ' + period, cls: 'flat' };
      const numKg = Math.abs(d) / 1000;
      let shown;
      try { shown = numKg.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
      catch (e) { shown = (Math.round(numKg * 10) / 10).toFixed(1).replace('.', ','); }
      return { text: (d > 0 ? '+' : '−') + shown + ' kg respecto a ' + period, cls: 'flat' };
    }
    if (m.format === 'duration') {
      const min = Math.round(d / 60);
      if (min === 0) return { text: 'Igual que ' + period, cls: 'flat' };
      const abs = Math.abs(min);
      const body = abs < 60 ? abs + ' min' : (Math.floor(abs / 60) + ' h' + (abs % 60 ? ' ' + (abs % 60) + ' min' : ''));
      return { text: (min > 0 ? '+' : '−') + body + ' respecto a ' + period, cls: tone(m.better, min) };
    }
    const rounded = Math.round(d);
    if (rounded === 0) return { text: 'Igual que ' + period, cls: 'flat' };
    const unit = m.unit ? ' ' + m.unit : '';
    return { text: (rounded > 0 ? '+' : '−') + fmtInt(Math.abs(rounded)) + unit + ' respecto a ' + period, cls: tone(m.better, rounded) };
  }

  function whenLabel(date, t, night) {
    if (!date) return '';
    const d = U.parseLocal(date);
    if (isNaN(d)) return '';
    const today = U.sod(t || U.now());
    if (U.sameDay(d, today)) return night ? 'Última noche' : 'Hoy';
    if (U.sameDay(d, U.addDays(today, -1))) return 'Ayer';
    return U.fechaCorta(d);
  }

  function xLabels(days) {
    if (!days.length) return [];
    if (days.length <= 7) {
      return days.map((d) => {
        const x = U.parseLocal(d.date);
        return isNaN(x) ? '' : U.DIAS_C[x.getDay()].slice(0, 1);
      });
    }
    const idx = [0, Math.round((days.length - 1) / 2), days.length - 1];
    return idx.map((i) => {
      const x = U.parseLocal(days[i].date);
      if (isNaN(x)) return '';
      return x.getDate() + '/' + (x.getMonth() + 1);
    });
  }

  function chartSvg(days, key, color, format, aria) {
    const W = 320;
    const H = 104;
    const L = 52;
    const R = 8;
    const T = 14;
    const B = 8;
    const safeColor = /^#[0-9A-Fa-f]{6}$/.test(color || '') ? color : '#2F80ED';
    const vals = (days || []).map((d) => num(d && d[key]));
    const present = vals.filter((v) => v != null);
    const label = U.esc(aria || '');
    if (!present.length) {
      return '<svg class="trend-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + label + '"><text x="16" y="58">Sin datos</text></svg>';
    }
    let lo = Math.min.apply(null, present);
    let hi = Math.max.apply(null, present);
    if (hi === lo) { lo -= 1; hi += 1; }
    const plotW = W - L - R;
    const plotH = H - T - B;
    const x = (i) => vals.length === 1 ? L + plotW / 2 : L + (i * plotW) / (vals.length - 1);
    const y = (v) => T + (1 - (v - lo) / (hi - lo)) * plotH;
    let lines = '';
    let seg = [];
    const flush = () => {
      if (seg.length >= 2) {
        lines += '<polyline points="' + seg.join(' ') + '" fill="none" stroke="' + safeColor + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>';
      }
      seg = [];
    };
    vals.forEach((v, i) => {
      if (v == null) { flush(); return; }
      seg.push(x(i).toFixed(1) + ',' + y(v).toFixed(1));
    });
    flush();
    const r = vals.length > 10 ? 2.2 : 3.4;
    const dots = vals.map((v, i) => v == null ? '' : '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="' + r + '" fill="' + safeColor + '"/>').join('');
    const gapCount = vals.length - present.length;
    const gapMarks = (gapCount > 0 && gapCount <= Math.ceil(vals.length / 3))
      ? vals.map((v, i) => {
        if (v != null) return '';
        const gx = x(i).toFixed(1);
        return '<line x1="' + gx + '" y1="' + (T + 2) + '" x2="' + gx + '" y2="' + (H - B - 2) + '" stroke="#C4B5A4" stroke-width="1.3" stroke-dasharray="2 3"/>';
      }).join('')
      : '';
    const mid = T + plotH / 2;
    const axis = '<text x="2" y="' + (T + 8) + '">' + U.esc(axisNum(format, hi)) + '</text><text x="2" y="' + (H - 6) + '">' + U.esc(axisNum(format, lo)) + '</text>';
    return '<svg class="trend-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + label + '">' +
      '<line x1="' + L + '" y1="' + mid.toFixed(1) + '" x2="' + (W - R) + '" y2="' + mid.toFixed(1) + '" stroke="#EADBC6" stroke-width="1"/>' +
      gapMarks + lines + dots + axis + '</svg>';
  }

  function trendCards(data, n, t) {
    t = t || U.now();
    return trends(data, n, t).map((m) => {
      const gaps = m.days.filter((d) => num(d[m.key]) == null).length;
      const change = fmtChange(m);
      const nowTxt = fmtMetric(m.format, m.current, m.format !== 'int', m.unit);
      const unit = (m.format === 'int' && m.current != null && m.unit) ? '<span>' + U.esc(m.unit) + '</span>' : '';
      const when = whenLabel(m.currentDate, t, m.night);
      const avgTxt = m.avg == null
        ? 'Sin media'
        : ('Media ' + fmtMetric(m.format, m.avg, true, m.unit) + (m.count < m.n ? ' · ' + m.count + '/' + m.n + ' días' : ''));
      const aria = m.title + ', ' + m.n + ' días. ' +
        (m.current == null ? 'Sin valor actual. ' : ('Valor ' + fmtMetric(m.format, m.current, true, m.unit) + '. ')) +
        avgTxt + '. ' + change.text + '. Días sin dato: ' + gaps + '.';
      const labels = xLabels(m.days).map((l) => '<span>' + U.esc(l) + '</span>').join('');
      return '<article class="trend-card" data-metric="' + m.key + '" data-gaps="' + gaps + '" data-points="' + m.count + '">' +
        '<div class="wo-k">' + U.esc(m.title) + '</div>' +
        '<div class="trend-now">' + U.esc(nowTxt) + unit + '</div>' +
        '<div class="trend-meta"><span>' + U.esc([when, avgTxt].filter(Boolean).join(' · ')) + '</span>' +
        '<span class="trend-delta ' + change.cls + '">' + U.esc(change.text) + '</span></div>' +
        chartSvg(m.days, m.key, m.color, m.format, aria) +
        '<div class="trend-x">' + labels + '</div></article>';
    }).join('');
  }

  function demoDay(end, ago) {
    const d = U.addDays(end, -ago);
    const idx = 55 - ago;
    const dow = d.getDay();
    const weekend = dow === 0 || dow === 6;
    const wellnessGap = ago === 3 || ago === 16 || ago === 24;
    const sleepGap = ago === 10 || ago === 21;
    const hrvGap = ago === 5 || ago === 19 || wellnessGap;
    const steps = wellnessGap ? null : Math.round((weekend ? 4800 : 9100) + ((idx * 47) % 1800) - 600);
    const restingHr = wellnessGap ? null : Math.round(57 - idx * 0.08 + (dow % 3));
    const hrv = hrvGap ? null : Math.round(38 + idx * 0.22 + (dow % 4));
    const sleepH = 6.3 + ((idx * 5) % 9) * 0.18;
    const sec = sleepGap ? null : Math.round(sleepH * 3600);
    const weightGrams = ago % 3 === 0 ? Math.round(76800 - idx * 22) : null;
    let sleepScore = null;
    let deep = null;
    let light = null;
    let rem = null;
    let awake = null;
    if (sec != null) {
      sleepScore = Math.max(45, Math.min(95, Math.round(58 + (sec / 3600 - 6) * 18)));
      deep = Math.round(sec * 0.18);
      light = Math.round(sec * 0.5);
      rem = Math.round(sec * 0.22);
      awake = Math.max(0, sec - deep - light - rem);
    }
    return {
      date: U.dayKey(d),
      steps: steps,
      restingHr: restingHr,
      bodyBatteryMin: wellnessGap ? null : 14 + (idx % 18),
      bodyBatteryMax: wellnessGap ? null : 72 + (idx % 22),
      sleepSeconds: sec,
      sleepScore: sleepScore,
      deepSeconds: deep,
      lightSeconds: light,
      remSeconds: rem,
      awakeSeconds: awake,
      hrv: hrv,
      hrvWeekly: 46,
      hrvStatus: ago === 12 ? 'UNBALANCED' : 'BALANCED',
      weightGrams: weightGrams,
      trainingSeconds: null
    };
  }

  function demo(t) {
    const end = U.sod(t || U.now());
    const older = [];
    const recent = [];
    for (let ago = 55; ago >= 0; ago--) {
      const row = demoDay(end, ago);
      if (ago >= 28) older.push(row);
      else recent.push(row);
    }
    function at(ago, hm, extra) {
      const d = U.dayKey(U.addDays(end, -ago));
      return Object.assign({ date: d, start: d + 'T' + hm }, extra);
    }
    const workouts = [
      at(1, '18:20:00', { type: 'running', name: 'Carrera de ejemplo', duration: 1920, distance: 5100, avgHr: 146, calories: 410 }),
      at(2, '07:40:00', { type: 'strength_training', name: 'Fuerza (ejemplo)', duration: 2700, distance: 0, avgHr: 112, calories: 280 }),
      at(4, '13:05:00', { type: 'cycling', name: 'Bici de ejemplo', duration: 3600, distance: 18500, avgHr: 131, calories: 540 }),
      at(6, '19:10:00', { type: 'walking', name: 'Paseo de ejemplo', duration: 2400, distance: 3200, avgHr: 98, calories: 160 }),
      at(9, '18:00:00', { type: 'yoga', name: 'Yoga de ejemplo', duration: 1800, distance: 0, avgHr: 88, calories: 120 }),
      at(15, '07:30:00', { type: 'treadmill_running', name: 'Cinta de ejemplo', duration: 2100, distance: 4800, avgHr: 142, calories: 360 }),
      at(20, '18:40:00', { type: 'running', name: 'Carrera suave (ejemplo)', duration: 1500, distance: 4000, avgHr: 138, calories: 280 }),
      at(26, '11:00:00', { type: 'cycling', name: 'Bici corta (ejemplo)', duration: 2400, distance: 14000, avgHr: 126, calories: 400 })
    ];
    workouts.forEach((w) => {
      const day = recent.filter((d) => d.date === w.date)[0];
      if (!day || num(w.duration) == null) return;
      day.trainingSeconds = (num(day.trainingSeconds) || 0) + num(w.duration);
    });
    [[32, 2400], [36, 1800], [41, 3600], [47, 1500], [52, 2100]].forEach((pair) => {
      const key = U.dayKey(U.addDays(end, -pair[0]));
      const day = older.filter((d) => d.date === key)[0];
      if (day) day.trainingSeconds = pair[1];
    });
    const avg = {};
    ['steps', 'restingHr', 'hrv', 'weightGrams', 'sleepSeconds', 'trainingSeconds'].forEach((k) => {
      const v = average(older, k);
      if (v != null) avg[k] = Math.round(v);
    });
    return {
      ok: true,
      demo: true,
      stale: false,
      stepsGoal: 8000,
      from: recent[0].date,
      to: recent[recent.length - 1].date,
      days: recent,
      previous: { from: older[0].date, to: older[older.length - 1].date, avg: avg },
      workouts: workouts
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
    workouts: workouts,
    trends: trends,
    chartSvg: chartSvg,
    trendCards: trendCards
  };
})();
