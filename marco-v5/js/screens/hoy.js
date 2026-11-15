/* Pantalla Hoy y sus piezas (salida, cole, outfit, avisos, mochila, resúmenes). */
'use strict';

function travelRules() {
  if (typeof settings.travelText === 'string') return Casa.parseTravel(settings.travelText, CFG.travel || []);
  return CFG.travel || [];
}
function aisleRules() {
  if (typeof settings.aisleText === 'string') return Casa.parseAisles(settings.aisleText, CFG.aisles || []);
  return CFG.aisles || [];
}
function leavePlan(t) {
  const when = t || now();
  return Casa.nextLeave(allEvents().filter((e) => !isDone(e)), when, travelRules());
}
function schoolCfg() { return CFG.school || {}; }
function schoolOpt() {
  const sc = schoolCfg();
  const from = settings.schoolFrom || sc.from || '09:00';
  const to = settings.schoolTo || sc.to || '14:00';
  return {
    weekends: true,
    festivo: U.festivoEtiqueta,
    dates: Casa.parseDateLines(settings.schoolDates || ''),
    events: S.schoolEvents || [],
    useDemo: demoOn() && settings.schoolDates == null && !String(settings.schoolIcs || '').trim(),
    demoDates: sc.demoDates || [],
    from: from,
    to: to
  };
}
function kidExtras() {
  if (typeof settings.schoolKids === 'string') return Casa.parseKidLines(settings.schoolKids);
  return (schoolCfg().kids || []).map((k) => ({ name: k.name, extras: k.extras || '', from: k.from || '', to: k.to || '' }));
}
function coleHtml(t) {
  const man = addDays(sod(t), 1);
  const opt = schoolOpt();
  const st = Casa.schoolOff(man, opt);
  let text = 'Mañana hay cole · ' + opt.from + '–' + opt.to;
  if (st.off) {
    text = 'Mañana no hay cole';
    if (st.why === 'festivo' && st.name) text += ' · ' + st.name;
    else if (st.why === 'ejemplo') text += ' · ejemplo';
    else if (st.why === 'ics' && st.name) text += ' · ' + String(st.name).replace(/\s*\(demo\)/gi, '');
  }
  const extra = kidExtras().filter((k) => k.extras).map((k) => k.name + ': ' + k.extras).join(' · ');
  return '<div class="cole-line" data-cole data-off="' + (st.off ? '1' : '0') + '">' + esc(text) + '</div>' +
    (extra ? '<div class="cole-extra">' + esc(extra) + '</div>' : '');
}
function freshHtml() {
  const bits = [];
  const w = S.weather;
  if (w && w.fetched) {
    const age = Date.now() - w.fetched;
    bits.push('<span class="fresh-bit' + (age > 45 * 60000 ? ' is-stale' : '') + '" data-fresh="clima">Clima de las ' + hm(new Date(w.fetched)) + '</span>');
  } else bits.push('<span class="fresh-bit is-stale" data-fresh="clima">Clima sin datos</span>');
  if (demoOn()) bits.push('<span class="fresh-bit" data-fresh="cal">Calendario de ejemplo</span>');
  else if (!S.calUpdated || S.calDown) bits.push('<span class="fresh-bit is-stale" data-fresh="cal">Calendario sin sincronizar</span>');
  else {
    const age = Date.now() - S.calUpdated;
    bits.push('<span class="fresh-bit' + (age > 20 * 60000 ? ' is-stale' : '') + '" data-fresh="cal">Calendario de las ' + hm(new Date(S.calUpdated)) + '</span>');
  }
  return '<div class="fresh">' + bits.join('') + '</div>';
}
function currentOutfit() {
  if (!syncReady()) return Outfit.demo(now());
  const o = S.outfit && Outfit.normalize(S.outfit);
  return o && !o.demo ? o : null;
}
function outfitDateLabel(o) {
  if (!o || !o.forDate) return '';
  const d = U.parseLocal(o.forDate);
  if (isNaN(d.getTime())) return o.forDate;
  return U.DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + U.MESES[d.getMonth()];
}
const outfitImgMemo = Object.create(null);
const OUTFIT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
function outfitImgHtml(o, cls) {
  if (!o || !o.imageUrl) return '<div class="' + cls + ' outfit-ph" aria-hidden="true">👕</div>';
  const url = o.imageUrl;
  if (Outfit.esFotoScript(url)) {
    return '<img class="' + cls + ' outfit-img" alt="Lookbook del outfit" referrerpolicy="no-referrer" src="' + OUTFIT_PIXEL + '" data-outfit-src="' + esc(url) + '">';
  }
  return '<img class="' + cls + ' outfit-img" alt="Lookbook del outfit" referrerpolicy="no-referrer" src="' + esc(url) + '">';
}
function outfitPh(img) {
  const ph = document.createElement('div');
  ph.className = String(img.className || '').replace('outfit-img', '').trim() + ' outfit-ph';
  ph.setAttribute('aria-hidden', 'true');
  ph.textContent = '👕';
  if (img.parentNode) img.replaceWith(ph);
}
function recordarFoto_(url, data) {
  outfitImgMemo[url] = data;
  const keys = Object.keys(outfitImgMemo);
  if (keys.length > 2) keys.slice(0, keys.length - 2).forEach((k) => { delete outfitImgMemo[k]; });
}
function pintarFotosOutfit() {
  document.querySelectorAll('img.outfit-img[data-outfit-src]').forEach((img) => {
    const url = img.getAttribute('data-outfit-src');
    if (!Outfit.esFotoScript(url)) return;
    if (outfitImgMemo[url]) {
      img.src = outfitImgMemo[url];
      img.removeAttribute('data-outfit-src');
      return;
    }
    if (img.getAttribute('data-outfit-loading')) return;
    img.setAttribute('data-outfit-loading', '1');
    fetch(url, { redirect: 'follow', credentials: 'omit', referrerPolicy: 'no-referrer' })
      .then((r) => r.text())
      .then((t) => {
        const data = Outfit.dataUrlFoto(t);
        if (!data) throw new Error('foto');
        recordarFoto_(url, data);
        if (!img.isConnected) return;
        img.src = data;
        img.removeAttribute('data-outfit-src');
      })
      .catch(() => { if (img.isConnected) outfitPh(img); });
  });
}
function outfitTag(o) {
  if (!o) return '';
  if (o.demo) return ' <span class="tag ej">EJEMPLO</span>';
  if (o.stale) return ' <span class="tag">ANTIGUO</span>';
  return '';
}
function outfitHoyHtml() {
  const o = currentOutfit();
  if (!o) {
    return '<button type="button" class="card outfit-hoy" data-act="outfit" data-outfit="empty">' +
      '<div class="outfit-hoy-k">Outfit de mañana</div>' +
      '<div class="outfit-hoy-empty">Aún no hay propuesta. Outfit la deja sobre las 21:00.</div></button>';
  }
  const when = outfitDateLabel(o);
  const pieces = (o.pieces || []).map((p) => p.id + ' ' + p.name).join(' · ');
  return '<button type="button" class="card outfit-hoy" data-act="outfit" data-outfit="' + (o.demo ? 'demo' : 'live') + '">' +
    outfitImgHtml(o, 'outfit-hoy-img') +
    '<span class="outfit-hoy-main"><span class="outfit-hoy-k">Outfit de mañana' + outfitTag(o) + '</span>' +
    (when ? '<span class="outfit-hoy-when">Para el ' + esc(when.toLowerCase()) + '</span>' : '') +
    '<span class="outfit-hoy-pieces">' + esc(pieces) + '</span>' +
    (o.why ? '<span class="outfit-hoy-why">' + esc(o.why) + '</span>' : '') +
    '</span></button>';
}

function avisosHtml() {
  const data = Mochila.normAvisos(S.avisos || {});
  if (!data.alerts.length) return '';
  return '<div class="aemet-row">' + data.alerts.map((a, i) => {
    const nombre = a.level === 'rojo' ? 'Aviso rojo' : 'Aviso naranja';
    return '<button type="button" class="aemet-chip ' + a.level + '" data-aviso="' + i + '">' + esc(nombre + (a.event ? ' · ' + a.event : '')) +
      (data.sample ? ' <span class="tag ej">EJEMPLO</span>' : '') + '</button>';
  }).join('') + '</div>';
}
// «Hoy toca»: lo que hay que preparar hoy, en una franja bajo el cielo.
function packTxt(p) {
  if (p.paused) return 'en pausa';
  if (p.off) return 'día libre';
  if (!p.items.length) return 'nada extra';
  return p.items.map((i) => (i.emoji ? i.emoji + ' ' : '') + i.item).join(', ');
}
function tocaHtml(t) {
  const hoy = packDay(sod(t));
  const man = packDay(addDays(sod(t), 1));
  const pausa = hoy.paused && man.paused;
  const ph = planHoy();
  const luz = ph.semaforo.luz;
  const meals = mealsFor(t);
  const tile = (go, key, attrs, k, v, sub) => '<button type="button" class="card toca-b" data-go="' + go + '" data-toca="' + key + '"' + attrs + '>' +
    '<span class="toca-k">' + k + '</span><span class="toca-v">' + esc(v) + '</span><span class="toca-s">' + esc(sub) + '</span></button>';
  return '<section class="toca" aria-label="Hoy toca">' +
    tile('ninos', 'mochila', '', '🎒 MOCHILA', pausa ? 'En pausa esta semana' : 'Hoy: ' + packTxt(hoy), pausa ? 'Vuelve con los niños' : 'Mañana: ' + packTxt(man)) +
    tile('salud', 'entreno', ' data-luz="' + luz + '"', '<span class="toca-dot ' + luz + '" title="Semáforo ' + esc(Plan.NOMBRE[luz]) + '"></span>💪 ENTRENO', ph.ajustada.titulo, ph.ajustada.nota) +
    tile('menu', 'menu', '', '🍲 HOY SE COME', meals.off ? 'Sin menú hoy' : 'Comida: ' + (meals.comida || '—'), meals.off ? 'El menú va de lunes a viernes' : 'Cena: ' + (meals.cena || '—')) +
    '</section>';
}
function casaSumHtml(t) {
  const p = Luz.period(t);
  const nw = Luz.nextWindow(t, 'valle');
  const prox = plazos().map((x) => ({ p: x, st: plazoEstado(x.due, t) })).filter((x) => x.st.days != null && x.st.days >= 0 && x.st.days <= 14)[0];
  const sub = prox ? '⏳ ' + prox.p.title + ' · ' + prox.st.label
    : (p === 'valle' ? 'Buen momento para lavadora y lavavajillas' : nw ? 'Valle ' + whenTxt(nw.start, t) : '');
  return '<button class="card sum" data-go="casa"' + (prox ? ' data-plazo="' + prox.st.tone + '"' : '') + '><div class="sum-h c-amber">🏠 CASA</div>' +
    '<div class="sum-big"><span class="per-dot" style="--c:' + Luz.COLOR[p] + '"></span>Ahora ' + Luz.NOMBRE[p].toLowerCase() + '</div><div class="sum-sub">' + esc(sub) + '</div></button>';
}
function mochilaDayHtml(label, day) {
  const p = packDay(day);
  const tags = (p.tags || []).map((tag) => '<span class="day-tag" title="' + esc(tag.name || '') + '">' + esc(tag.label) + '</span>').join('');
  let body;
  if (p.paused) body = '<div class="muted">En pausa</div>';
  else if (p.items.length) body = '<div class="stickers">' + p.items.map((it) =>
    '<button type="button" class="sticker' + (it.off ? ' off' : '') + '" data-pack="' + esc(it.item) + '" data-pack-why="' + esc(it.why || '') + '"><span class="sticker-ic" aria-hidden="true">' + esc(it.emoji || '🎒') + '</span>' + esc(it.item) + '</button>'
  ).join('') + '</div>';
  else if (p.school) body = '<div class="muted">Nada extra en la mochila</div>';
  else body = '<div class="muted">Nada apuntado</div>';
  return '<div class="mochila-day"><div class="mochila-when">' + esc(label) + tags + '</div>' + body + '</div>';
}
function mochilaBlock(t) {
  const hoy = sod(t);
  const man = addDays(hoy, 1);
  const paused = packDay(hoy).paused && packDay(man).paused;
  const note = paused
    ? 'Esta semana no están en casa: la mochila espera, igual que las tareas.'
    : 'Sale de las citas de hoy y de mañana. Las reglas están en Ajustes.';
  return '<section class="card mochila-card"><div class="card-h">🎒 Mochila</div><div class="mochila-days">' +
    mochilaDayHtml('Hoy', hoy) + mochilaDayHtml('Mañana', man) +
    '</div><div class="muted sm">' + note + '</div></section>';
}

/* ---------------- HOY ---------------- */
function renderHoy() {
  const t = now();
  const today = sod(t);
  const sky = skyFor(t);
  const w = S.weather;
  let wx = '<div class="wx-empty">Cargando el tiempo…</div>';
  if (w && w.days) {
    const i0 = Math.max(0, w.days.findIndex((d) => d.date === dayKey(today)));
    const d0 = w.days[i0];
    const hourNow = new Date(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours());
    const hours = (w.hourly || []).filter((h) => { const d = U.parseLocal(h.time); return sameDay(d, t) && d >= hourNow; }).slice(0, 6);
    const rest = w.days.slice(i0 + 1, i0 + 1 + (hours.length ? 3 : 5));
    const hoursHtml = hours.length ? '<div class="wx-hours">' + hours.map((h) => {
      const hd = U.parseLocal(h.time);
      const rain = h.pop != null && h.pop >= 40;
      return '<div class="wx-h"><div class="wx-hh">' + hd.getHours() + 'h</div><div>' + Weather.icon(h.code) + '</div><div class="wx-ht">' + Math.round(h.temp) + '°</div><div class="wx-drain' + (rain ? ' hi' : '') + '">' + (h.pop == null ? '' : h.pop + '%') + '</div></div>';
    }).join('') + '</div>' : '';
    wx = '<div class="wx-now"><div class="wx-ic">' + (w.current.isDay === 0 && w.current.code <= 2 ? '🌙' : Weather.icon(w.current.code)) + '</div><div class="wx-temp">' + Math.round(w.current.temp) + '°</div>' +
      '<div class="wx-mm">' + Math.round(d0.min) + '° / ' + Math.round(d0.max) + '°</div><div class="wx-rain' + (d0.rain >= 40 ? ' hi' : '') + '">💧 ' + (d0.rain ?? '–') + ' %</div></div>' +
      hoursHtml +
      '<div class="wx-days">' + rest.map((d) => {
        const dd = U.parseLocal(d.date);
        return '<div class="wx-day"><div class="wx-dn">' + U.DIAS_C[dd.getDay()] + '</div><div class="wx-di">' + Weather.icon(d.code) + '</div><div class="wx-dtemps"><span class="wx-dmax">' + Math.round(d.max) + '°</span><span class="wx-dmin">' + Math.round(d.min) + '°</span><span class="wx-drain' + (d.rain >= 40 ? ' hi' : '') + '">💧 ' + (d.rain ?? '–') + '%</span></div></div>';
      }).join('') + '</div>';
  }
  wx += avisosHtml();

  // Ahora: siguiente cita, comida de hoy y mañana de un vistazo. Los calendarios de fondo no entran.
  const list = allEvents().filter((e) => !e.allDay && !e.background && !isDone(e) && e.end > t).sort((a, b) => a.start - b.start);
  const cur = list.find((e) => e.start <= t);
  const nxt = list.find((e) => e.start > t);
  const main = cur || nxt;
  const tip = (w && Weather.advice) ? Weather.advice(w.hourly, allEvents(), t) : '';
  let body = '<div class="next-label">AHORA</div><div class="next-title">Sin citas a la vista</div>';
  if (main) {
    const isNow = main === cur;
    const dayTxt = sameDay(main.start, t) ? 'Hoy' : sameDay(main.start, addDays(t, 1)) ? 'Mañana' : U.fechaCorta(main.start);
    const pill = isNow ? 'termina en ' + U.countdown(main.end - t) : 'en ' + U.countdown(main.start - t);
    const after = isNow ? nxt : list.find((e) => e.start > main.start);
    body = '<div class="next-head"><div class="next-label">' + (isNow ? 'AHORA' : 'LO PRÓXIMO') + '</div><div class="next-pill" data-countdown>' + esc(pill) + '</div></div>' +
      '<div class="next-title" role="button" data-ev="' + esc(main.id) + '">' + esc(main.title) + '</div>' +
      '<div class="next-sub">' + esc(dayTxt + ' · ' + hm(main.start) + '–' + hm(main.end) + (main.location ? ' · ' + main.location : '')) + '</div>' +
      (after && sameDay(after.start, t) ? '<button class="next-after" data-ev="' + esc(after.id) + '">Después: ' + esc(hm(after.start) + ' ' + after.title) + '</button>' : '');
  }
  const phrase = Casa.leavePhrase(leavePlan(t), t);
  const leaveHtml = '<div class="leave-line' + (phrase.late ? ' is-late' : '') + '" data-leave><span class="leave-k">Siguiente</span> <b>' + esc(phrase.main) + '</b>' +
    (phrase.sub ? '<span class="leave-sub"> · ' + esc(phrase.sub) + '</span>' : '') + '</div>';
  const nextHtml = '<div class="next-in' + (main && main === cur ? ' is-now' : '') + '"' + (main ? ' style="--c:' + esc(main.color) + '"' : '') + '>' +
    leaveHtml + body + '<div class="next-tom">' + esc(tomorrowGlance(t)) + '</div>' + (tip ? '<div class="wx-tip">' + esc(tip) + '</div>' : '') + '</div>';

  // Semana
  const evs = allEvents();
  let week = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i);
    const st = dayStatus(d);
    const sh = shiftOn(d);
    const fest = U.festivoEtiqueta(d);
    const items = eventsOn(d, evs);
    const mainEv = items.filter((e) => !e.background);
    const bgEv = items.filter((e) => e.background).slice(0, 1);
    const kids = st === 'padre' ? '<div class="kids-chip">🏠 ' + esc(kidsNames()) + '</div>' : '';
    week += '<div class="day c-' + st + (i === 0 ? ' is-today' : '') + '">' +
      '<div class="day-h"><span class="day-n">' + (i === 0 ? 'Hoy' : U.DIAS_C[d.getDay()]) + '</span><span class="day-d">' + d.getDate() + '</span></div>' +
      (sh ? '<div class="shift">💼 ' + esc(sh.from + '–' + sh.to) + '</div>' : '<div class="shift off">Libre</div>') +
      (fest ? '<div class="day-tag" title="' + esc(fest.name) + '">' + esc(fest.label) + '</div>' : '') + kids +
      '<div class="day-evs">' + mainEv.concat(bgEv).map((e) => evItem(e, d)).join('') + (mainEv.length ? '' : '<div class="no-ev">—</div>') + '</div></div>';
  }

  // Resúmenes
  const ninos = choresSummary();
  const compra = (store.get('compra', { items: [] }).items || []).filter((x) => !x.done && !x.deleted);

  screenEl.innerHTML = demoPill() + '<div class="hoy">' +
    '<section class="sky ' + sky.cls + (sky.dark ? ' dark' : '') + '">' +
      '<div class="sky-left"><div class="big-clock" data-clock="big">' + hm(t) + '</div><div class="sky-date"><b>' + U.DIAS[t.getDay()] + '</b> ' + t.getDate() + ' de ' + U.MESES[t.getMonth()] + '</div>' + custodyBadge(t) + coleHtml(t) + freshHtml() + '</div>' +
      '<div class="sky-wx">' + wx + '</div></section>' +
    '<section class="next card">' + nextHtml + '</section>' +
    tocaHtml(t) +
    outfitHoyHtml() +
    '<section class="week">' + week + '</section>' +
    '<section class="sums">' +
      '<button class="card sum" data-go="ninos"><div class="sum-h c-orange">⭐ NIÑOS</div><div class="sum-big">' + (ninos.paused ? 'En pausa esta semana' : (ninos.pending + ' por hacer')) + '</div>' + (ninos.overdue && !ninos.paused ? '<div class="sum-sub sum-late">' + ninos.overdue + ' fuera de hora</div>' : '') + '<div class="sum-chips">' + ninos.chips + '</div></button>' +
      '<button class="card sum" data-go="compra"><div class="sum-h c-green">🛒 COMPRA</div><div class="sum-big">' + compra.length + (compra.length === 1 ? ' cosa' : ' cosas') + '</div><div class="sum-sub">' + esc(compra.slice(0, 5).map((x) => x.name).join(' · ') || 'Lista vacía') + '</div></button>' +
      casaSumHtml(t) +
      saludMini() +
    '</section></div>';
}

function saludNow() {
  const d = S.salud;
  if (!d || (d.demo && syncReady())) return { ok: false, empty: true };
  return d;
}
function saludMini() {
  const d = saludNow();
  if (!d || d.empty || d.ok === false) {
    return '<button type="button" class="card sum salud-mini" data-go="salud"><div class="sum-h c-salud">💓 SALUD</div><div class="sum-big">Sin datos de Garmin</div><div class="sum-sub">Aparece al responder el script</div></button>';
  }
  const sleep = Salud.lastSleep(d);
  const day = Salud.today(d, now());
  const hrv = Salud.lastHrv(d);
  const steps = day ? Salud.num(day.steps) : null;
  const tag = d.demo ? '<span class="tag ej">EJEMPLO</span>' : (d.stale ? '<span class="tag">ANTIGUO</span>' : '');
  const sleepTxt = sleep ? (Salud.hours(sleep.sleepSeconds) + (sleep.sleepScore != null ? ' · ' + sleep.sleepScore : '')) : 'Sin sueño';
  const bits = [];
  if (steps != null) bits.push(Salud.fmtInt(steps) + ' / ' + Salud.fmtInt(Salud.goal(d)) + ' pasos');
  if (hrv && Salud.num(hrv.hrv) != null) bits.push('VFC ' + Salud.fmtInt(hrv.hrv));
  if (day && Salud.num(day.bodyBatteryMin) != null) bits.push('batería ' + day.bodyBatteryMin + '–' + (day.bodyBatteryMax != null ? day.bodyBatteryMax : '–'));
  return '<button type="button" class="card sum salud-mini" data-go="salud"><div class="sum-h c-salud">💓 SALUD ' + tag + '</div><div class="sum-big">' + esc(sleepTxt) + '</div><div class="sum-sub">' + esc(bits.join(' · ') || 'Salud') + '</div></button>';
}

/* ---------------- Outfit: detalle al tocar la tarjeta ---------------- */
function showOutfit() {
  const o = currentOutfit();
  if (!o) {
    openModal('<div class="outfit-modal" data-outfit="empty"><div class="modal-t">Outfit de mañana</div>' +
      '<div class="modal-d">Aún no hay propuesta. El bot la deja cada noche, sobre las 21:00. Cuando llegue, pulsa Actualizar.</div></div>');
    return;
  }
  const when = outfitDateLabel(o);
  const pieces = (o.pieces || []).map((p) =>
    '<li class="outfit-piece"><span class="outfit-id">' + esc(p.id) + '</span><span class="outfit-name">' + esc(p.name) + '</span>' +
    (p.slot ? '<span class="outfit-slot">' + esc(p.slot) + '</span>' : '<span></span>') + '</li>'
  ).join('');
  openModal('<div class="outfit-modal" data-outfit="' + (o.demo ? 'demo' : 'live') + '">' +
    '<div class="outfit-look">' + outfitImgHtml(o, 'outfit-hero') + '</div>' +
    '<div class="outfit-side"><div class="modal-h">Outfit de mañana' + outfitTag(o) + '</div>' +
    (when ? '<div class="outfit-for">Para el ' + esc(when.toLowerCase()) + '</div>' : '') +
    (o.why ? '<p class="outfit-why">' + esc(o.why) + '</p>' : '') +
    (o.updatedAt ? '<div class="muted sm">Propuesto ' + esc(o.updatedAt) + '</div>' : '') +
    '<ul class="outfit-list">' + pieces + '</ul></div></div>', false, 'wide');
  pintarFotosOutfit();
}
