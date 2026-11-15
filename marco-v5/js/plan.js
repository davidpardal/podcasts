/* Entreno de hoy: semáforo con el sueño, la VFC, el pulso en reposo y la batería corporal
 * (de la respuesta «salud» que ya llega al marco) y la sesión prevista de la semana tipo.
 * La semana tipo depende de la custodia: semana (lunes a domingo) con o sin niños.
 * No inventa: si falta un dato, sale como hueco y no cuenta para el color. */
(function () {
  'use strict';

  // Lunes = 0 … domingo = 6. Plantillas por defecto; CFG.planEntreno las puede pisar.
  const PLANTILLAS = {
    sin: [
      { k: 'fuerza', t: 'Fuerza A', d: '50–60′' },
      { k: 'cardio', t: 'Rodaje Z2', d: '35–45′' },
      { k: 'fuerza', t: 'Fuerza B', d: '50–60′' },
      { k: 'descanso', t: 'Descanso activo', d: '' },
      { k: 'cardio', t: 'Bici/rodillo Z2', d: '60′' },
      { k: 'cardio', t: 'Gravel/MTB Z2', d: '90–120′' },
      { k: 'fuerza', t: 'Fuerza C o descanso', d: '45′' }
    ],
    con: [
      { k: 'fuerza', t: 'Fuerza A', d: '45′' },
      { k: 'cardio', t: 'Rodillo Z2 en casa', d: '40′' },
      { k: 'fuerza', t: 'Fuerza B', d: '45′' },
      { k: 'descanso', t: 'Descanso', d: '' },
      { k: 'cardio', t: 'Rodaje Z2', d: '30′' },
      { k: 'fuerza', t: 'Fuerza C o rodillo temprano', d: '40′' },
      { k: 'descanso', t: 'Descanso o rodillo antes del cambio', d: '30′' }
    ]
  };
  const RANK = { verde: 0, ambar: 1, rojo: 2 };
  const NOMBRE = { verde: 'Verde', ambar: 'Ámbar', rojo: 'Rojo', nada: 'Sin datos' };

  function num(n) {
    if (n == null || n === '') return null;
    const x = Number(n);
    return isFinite(x) ? x : null;
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function key(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function sod(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function add(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function monday(d) { const x = sod(d); return add(x, -((x.getDay() + 6) % 7)); }
  function dec(x, n) { return x.toFixed(n == null ? 1 : n).replace('.', ','); }

  function plantillas(cfg) {
    const p = cfg && cfg.planEntreno;
    const ok = (l) => Array.isArray(l) && l.length === 7 && l.every((s) => s && s.t);
    return { sin: p && ok(p.sin) ? p.sin : PLANTILLAS.sin, con: p && ok(p.con) ? p.con : PLANTILLAS.con };
  }

  // Semana con niños: la que va de lunes a domingo después del cambio.
  // kidsAt(instante) → true/false (la custodia del marco) o null si no hay custodia.
  function semanaConNinos(t, kidsAt) {
    if (typeof kidsAt !== 'function') return null;
    const mid = add(monday(t), 2);
    mid.setHours(12, 0, 0, 0); // miércoles a mediodía: sin dudas por la hora del cambio
    const v = kidsAt(mid);
    return v == null ? null : !!v;
  }

  function byDate(data) {
    const map = {};
    ((data && data.days) || []).forEach((d) => { if (d && d.date) map[String(d.date).slice(0, 10)] = d; });
    return map;
  }

  // Semáforo de hoy. El sueño, la VFC y el pulso tienen que ser de hoy (la noche pasada);
  // si no han llegado, son un hueco. Las medias son de los 7 días anteriores.
  function semaforo(data, t) {
    const out = { luz: 'nada', motivos: [], huecos: [], fecha: key(t) };
    if (!data || data.ok === false || data.empty) { out.huecos.push('Sin datos de Garmin'); return out; }
    const map = byDate(data);
    const hoy = map[key(t)] || {};
    let worst = -1;
    function mark(level, txt) {
      out.motivos.push({ luz: level, txt: txt });
      worst = Math.max(worst, RANK[level]);
    }
    // Sueño
    const sec = num(hoy.sleepSeconds);
    const score = num(hoy.sleepScore);
    if (sec == null && score == null) out.huecos.push('sueño de anoche');
    else {
      const h = sec == null ? null : sec / 3600;
      const txt = 'Sueño ' + (h == null ? '–' : dec(h) + ' h') + (score != null ? ' · nota ' + Math.round(score) : '');
      let lvl = 'verde';
      if ((h != null && h < 5.5) || (score != null && score < 55)) lvl = 'rojo';
      else if ((h != null && h < 7) || (score != null && score < 70)) lvl = 'ambar';
      mark(lvl, txt);
      if (score == null) out.huecos.push('nota del sueño');
    }
    // VFC (estado de Garmin)
    const st = String(hoy.hrvStatus || '').trim().toUpperCase();
    const hrv = num(hoy.hrv);
    if (!st || st === 'NONE') out.huecos.push('estado de la VFC');
    else {
      const v = 'VFC ' + (hrv != null ? Math.round(hrv) + ' ms · ' : '');
      if (st === 'BALANCED') mark('verde', v + 'equilibrada');
      else if (st === 'UNBALANCED') mark('ambar', v + 'desequilibrada');
      else if (st === 'LOW' || st === 'POOR') mark('rojo', v + (st === 'LOW' ? 'baja' : 'pobre'));
      else out.huecos.push('estado de la VFC');
    }
    // Pulso en reposo frente a la media de 7 días
    const rhr = num(hoy.restingHr);
    const prev = [];
    for (let i = 1; i <= 7; i++) { const r = map[key(add(sod(t), -i))]; if (r && num(r.restingHr) != null) prev.push(num(r.restingHr)); }
    if (rhr == null) out.huecos.push('pulso en reposo de hoy');
    else if (prev.length < 3) out.huecos.push('media de 7 días del pulso');
    else {
      const avg = prev.reduce((a, b) => a + b, 0) / prev.length;
      const diff = rhr - avg;
      const r = Math.round(diff);
      const txt = 'Pulso ' + Math.round(rhr) + ' lpm (' + (r >= 0 ? '+' : '−') + Math.abs(r) + ' vs media 7 d)';
      mark(diff >= 5 ? 'rojo' : (diff > 2 ? 'ambar' : 'verde'), txt);
    }
    // Batería corporal
    const bb = num(hoy.bodyBatteryMax);
    if (bb == null) out.huecos.push('batería corporal');
    else if (bb < 25) mark('rojo', 'Batería máx ' + Math.round(bb));
    else mark('verde', 'Batería máx ' + Math.round(bb));
    if (worst >= 0) out.luz = Object.keys(RANK).find((k) => RANK[k] === worst);
    return out;
  }

  function ajustar(sesion, luz) {
    const base = sesion.t + (sesion.d ? ' ' + sesion.d : '');
    if (luz === 'rojo') return { titulo: 'Descanso o paseo 30–40′ + 10′ movilidad', nota: sesion.k === 'descanso' ? 'Ya tocaba descanso: nada de rodillo hoy.' : 'Prevista: ' + base + '. Hoy no.' };
    if (sesion.k === 'descanso') return { titulo: base, nota: 'Día de descanso.' };
    if (luz === 'ambar') return { titulo: base, nota: '20–30 % menos volumen · RPE ≤6 · cardio solo Z2' };
    if (luz === 'verde') return { titulo: base, nota: 'Como está previsto.' };
    return { titulo: base, nota: 'Sin datos para el semáforo: escucha al cuerpo.' };
  }

  // Todo lo que pinta la tarjeta.
  function hoy(data, t, opts) {
    opts = opts || {};
    const tpl = plantillas(opts.cfg);
    const con = semanaConNinos(t, opts.kidsAt);
    const lista = con ? tpl.con : tpl.sin;
    const idx = (t.getDay() + 6) % 7;
    const sem = semaforo(data, t);
    const hechos = {};
    ((data && data.workouts) || []).forEach((w) => { if (w && w.date) hechos[String(w.date).slice(0, 10)] = true; });
    const lun = monday(t);
    const semana = lista.map((s, i) => {
      const d = add(lun, i);
      return { fecha: key(d), dia: ['L', 'M', 'X', 'J', 'V', 'S', 'D'][i], sesion: s, hoy: i === idx, pasado: i < idx, hecho: !!hechos[key(d)] };
    });
    return { conNinos: con, prevista: lista[idx], ajustada: ajustar(lista[idx], sem.luz), semaforo: sem, semana: semana };
  }

  window.Plan = { PLANTILLAS: PLANTILLAS, NOMBRE: NOMBRE, semaforo: semaforo, ajustar: ajustar, semanaConNinos: semanaConNinos, hoy: hoy };
})();
