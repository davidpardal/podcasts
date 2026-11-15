/* Pantalla Salud y tarjeta Entreno de hoy. */
'use strict';

/* ---------------- SALUD ---------------- */
function saludHoyStrip(d) {
  const t = now();
  const usable = d && d.ok !== false && !d.empty;
  const sleep = usable ? Salud.lastSleep(d) : null;
  const day = usable ? Salud.today(d, t) : null;
  const charged = day ? Salud.num(day.bodyBatteryCharged) : null;
  const bbMin = day ? Salud.num(day.bodyBatteryMin) : null;
  const bbMax = day ? Salud.num(day.bodyBatteryMax) : null;
  let bbMain = '—';
  let bbSub = 'Sin batería corporal en esta copia';
  if (charged != null) {
    bbMain = Salud.fmtInt(charged);
    const bits = [];
    if (bbMin != null) bits.push('mín ' + Salud.fmtInt(bbMin));
    if (bbMax != null) bits.push('máx ' + Salud.fmtInt(bbMax));
    bbSub = bits.length ? bits.join(' · ') : 'Energía de hoy';
  } else if (bbMin != null || bbMax != null) {
    bbMain = (bbMin != null ? Salud.fmtInt(bbMin) : '–') + ' – ' + (bbMax != null ? Salud.fmtInt(bbMax) : '–');
    bbSub = 'Mínimo y máximo de hoy';
  }
  const sleepMain = sleep ? Salud.hours(sleep.sleepSeconds) : '—';
  const sleepSub = sleep
    ? ('Puntuación ' + (sleep.sleepScore != null ? sleep.sleepScore : '–') + (sleep.date ? ' · ' + U.fechaCorta(U.parseLocal(sleep.date)) : ''))
    : 'Sin sueño en esta copia';
  // Lo ya hecho hoy según Garmin. Lo previsto va en la tarjeta «Entreno de hoy», justo debajo.
  const wos = usable ? Salud.workouts(d).filter((w) => w.date === dayKey(t)) : [];
  const woMain = wos.length ? (wos[0].name || Salud.tipo(wos[0].type)) : 'Aún nada';
  const woSub = wos.length ? [Salud.hours(wos[0].duration), Salud.fmtDist(wos[0].distance)].filter(Boolean).join(' · ') || 'Registrado en Garmin' : 'Sin entreno registrado hoy';
  return '<section class="card salud-hoy"><div class="card-h">Hoy</div><div class="salud-hoy-row">' +
    '<div class="hoy-bit"><div class="wo-k">SUEÑO</div><div class="metric-n">' + esc(sleepMain) + '</div><div class="muted sm">' + esc(sleepSub) + '</div></div>' +
    '<div class="hoy-bit"><div class="wo-k">BATERÍA / ENERGÍA</div><div class="metric-n">' + esc(bbMain) + '</div><div class="muted sm">' + esc(bbSub) + '</div></div>' +
    '<div class="hoy-bit" data-hecho="' + (wos.length ? '1' : '0') + '"><div class="wo-k">ENTRENO HECHO</div><div class="metric-n">' + esc(woMain) + '</div><div class="muted sm">' + esc(woSub) + '</div></div>' +
    '</div></section>';
}
function planHoy() {
  return Plan.hoy(saludNow(), now(), { cfg: CFG, kidsAt: custodyOn() ? (x) => Custody.withParent(x) : null });
}
function entrenoHoyCard(d) {
  const p = planHoy();
  const sem = p.semaforo;
  const luz = sem.luz;
  const semTxt = p.conNinos == null ? 'Semana sin custodia en Ajustes' : (p.conNinos ? 'Semana con ' + kidsNames() : 'Semana sin niños');
  const motivos = sem.motivos.map((m) => '<span class="plan-why ' + m.luz + '">' + esc(m.txt) + '</span>').join('');
  const huecos = sem.huecos.length ? '<div class="muted sm plan-gaps">Sin datos: ' + esc(sem.huecos.join(' · ')) + '</div>' : '';
  const strip = p.semana.map((x) => '<div class="plan-day' + (x.hoy ? ' is-today' : '') + (x.pasado ? ' past' : '') + ' k-' + esc(x.sesion.k) + '" data-fecha="' + x.fecha + '">' +
    '<b>' + x.dia + (x.hecho ? ' ✓' : '') + '</b><span>' + esc(x.sesion.t) + '</span>' + (x.sesion.d ? '<i>' + esc(x.sesion.d) + '</i>' : '') + '</div>').join('');
  const tag = d && d.demo ? '<span class="tag ej">EJEMPLO</span>' : '';
  return '<section class="card plan-hoy" data-luz="' + luz + '"><div class="card-h">💪 Entreno de hoy ' + tag + '<span class="plan-sem muted sm">' + esc(semTxt) + '</span></div>' +
    '<div class="plan-row"><div class="plan-light ' + luz + '" role="img" aria-label="Semáforo ' + esc(Plan.NOMBRE[luz]) + '"><span></span><b>' + esc(Plan.NOMBRE[luz]) + '</b></div>' +
    '<div class="plan-main"><div class="plan-t">' + esc(p.ajustada.titulo) + '</div><div class="plan-n">' + esc(p.ajustada.nota) + '</div>' +
    '<div class="plan-whys">' + motivos + '</div>' + huecos + '</div></div>' +
    '<div class="plan-week" aria-label="Semana de entreno">' + strip + '</div></section>';
}
function renderSalud() {
  const d = saludNow();
  if (!d || d.empty || d.ok === false) {
    screenEl.innerHTML = '<div class="salud">' + saludHoyStrip(d) + entrenoHoyCard(d) + '<section class="card salud-empty"><div class="card-h">💓 Salud</div><div class="sum-big">Sin datos de Garmin</div><div class="muted sm">Con la sincronización activa, el marco pide el resumen al script. Si Garmin no responde y no hay una copia en este dispositivo, no se inventan cifras. La semana tipo de entreno sale igual, sin semáforo.</div></section></div>';
    return;
  }
  const t = now();
  const sleep = Salud.lastSleep(d);
  const day = Salud.today(d, t);
  const hrv = Salud.lastHrv(d);
  const goalN = Salud.goal(d);
  const steps = day ? Salud.num(day.steps) : null;
  const pct = steps == null || !goalN ? 0 : Math.max(0, Math.min(100, Math.round(steps / goalN * 100)));
  const note = d.demo
    ? '<div class="salud-note ej" role="status">Datos de ejemplo · cifras inventadas para ver la pantalla, no son de tu Garmin</div>'
    : (d.stale ? '<div class="salud-note stale" role="status">Datos de Garmin sin actualizar · última copia de este dispositivo</div>' : '');
  const parts = [['deep', 'Profundo', sleep && sleep.deepSeconds], ['rem', 'REM', sleep && sleep.remSeconds], ['light', 'Ligero', sleep && sleep.lightSeconds], ['awake', 'Despierto', sleep && sleep.awakeSeconds]];
  const stages = sleep
    ? '<div class="st-bar" role="img" aria-label="' + esc(parts.map((p) => p[1] + ' ' + Salud.hours(p[2])).join(', ')) + '">' +
        parts.map((p) => '<span class="st-' + p[0] + '" style="flex:' + Math.max(0, Salud.num(p[2]) || 0) + '"></span>').join('') + '</div>' +
      '<div class="st-legend">' + parts.map((p) => '<span><i class="st-' + p[0] + '"></i>' + p[1] + ' ' + esc(Salud.hours(p[2])) + '</span>').join('') + '</div>'
    : '<div class="muted">Sin sueño registrado.</div>';
  const list = Salud.workouts(d);
  const wos = list.map((w) => {
    const when = w.date ? U.fechaCorta(U.parseLocal(w.date)) : '';
    const bits = [when, Salud.hours(w.duration), Salud.fmtDist(w.distance), w.avgHr != null ? Salud.fmtInt(w.avgHr) + ' lpm' : '', w.calories != null ? Salud.fmtInt(w.calories) + ' kcal' : ''].filter(Boolean);
    return '<article class="wo"><div class="wo-h"><b>' + esc(w.name || Salud.tipo(w.type)) + '</b><span class="wo-k">' + esc(Salud.tipo(w.type)) + '</span></div><div class="wo-m">' + esc(bits.join(' · ')) + '</div></article>';
  }).join('');
  const bb = day && Salud.num(day.bodyBatteryMin) != null ? (day.bodyBatteryMin + ' – ' + (day.bodyBatteryMax != null ? day.bodyBatteryMax : '–')) : '–';
  const rhr = day && Salud.num(day.restingHr) != null ? Salud.fmtInt(day.restingHr) + ' lpm' : '–';
  const hrvTxt = hrv && Salud.num(hrv.hrv) != null ? Salud.fmtInt(hrv.hrv) : '–';
  const hrvSub = hrv ? ('Semana ' + (Salud.num(hrv.hrvWeekly) != null ? Salud.fmtInt(hrv.hrvWeekly) : '–') + ' · ' + Salud.hrvLabel(hrv.hrvStatus)) : 'Sin VFC';
  const goalNote = d.stepsGoal ? '' : ' · objetivo de referencia';
  screenEl.innerHTML = '<div class="salud">' + note + saludHoyStrip(d) + entrenoHoyCard(d) +
    '<div class="salud-grid">' +
      '<section class="card salud-sleep"><div class="card-h">🌙 Sueño de anoche</div>' +
        '<div class="sleep-big">' + esc(sleep ? Salud.hours(sleep.sleepSeconds) : '–') + '</div>' +
        '<div class="sleep-score">Puntuación ' + esc(sleep && sleep.sleepScore != null ? String(sleep.sleepScore) : '–') + '</div>' +
        stages +
        (sleep && sleep.date ? '<div class="muted sm">' + esc(U.fechaCorta(U.parseLocal(sleep.date))) + '</div>' : '') +
      '</section>' +
      '<section class="card"><div class="card-h">🔋 Batería corporal</div><div class="metric-n">' + esc(bb) + '</div><div class="muted sm">Mínimo y máximo de hoy</div></section>' +
      '<section class="card"><div class="card-h">💓 VFC de anoche</div><div class="metric-n">' + esc(hrvTxt) + '</div><div class="muted sm">' + esc(hrvSub) + '</div></section>' +
      '<section class="card"><div class="card-h">👟 Pasos de hoy</div><div class="metric-n">' + esc(steps == null ? '–' : Salud.fmtInt(steps)) + '</div><div class="muted sm">de ' + esc(Salud.fmtInt(goalN)) + esc(goalNote) + '</div><div class="goal-track" role="img" aria-label="' + esc((steps == null ? 'sin pasos' : Salud.fmtInt(steps)) + ' de ' + Salud.fmtInt(goalN)) + '"><div style="width:' + pct + '%"></div></div></section>' +
      '<section class="card"><div class="card-h">❤️ Pulso en reposo</div><div class="metric-n">' + esc(rhr) + '</div><div class="muted sm">Hoy</div></section>' +
    '</div>' +
    '<section class="card salud-trends"><div class="card-h">Tendencias' +
      (d.demo ? '<span class="tag ej">EJEMPLO</span>' : '') +
      '<div class="trend-toggle" role="group" aria-label="Periodo de las tendencias">' +
        '<button type="button" data-act="saludRange" data-range="7" class="' + (S.saludDias === 28 ? '' : 'on') + '" aria-pressed="' + (S.saludDias === 28 ? 'false' : 'true') + '">7 días</button>' +
        '<button type="button" data-act="saludRange" data-range="28" class="' + (S.saludDias === 28 ? 'on' : '') + '" aria-pressed="' + (S.saludDias === 28 ? 'true' : 'false') + '">28 días</button>' +
      '</div></div>' +
      '<p class="trend-hint">Un corte en la línea es un día sin dato, no un cero.</p>' +
      (!d.demo && Salud.daysOf(d).length < (S.saludDias === 28 ? 28 : 7)
        ? '<p class="trend-hint">Esta copia trae ' + Salud.daysOf(d).length + ' días. Para ver el periodo entero, publica la versión nueva del script y pulsa Actualizar.</p>'
        : '') +
      '<div class="trend-grid">' + Salud.trendCards(d, S.saludDias === 28 ? 28 : 7, t) + '</div></section>' +
    '<section class="card"><div class="card-h">Entrenos <span class="count">' + list.length + '</span></div>' +
      (wos || '<div class="muted">Sin entrenos en estos días.</div>') +
    '</section></div>';
}
