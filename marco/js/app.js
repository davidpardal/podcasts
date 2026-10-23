/* Marco familiar · app principal (sin framework, sin compilación). */
(function () {
  'use strict';
  const { esc, now, hm, sod, addDays, sameDay, mondayOf, dayKey, store, pad } = U;

  /* ---------------- Configuración ---------------- */
  function deepMerge(a, b) {
    if (Array.isArray(b)) return b.slice();
    if (b && typeof b === 'object') {
      const o = Object.assign({}, a);
      Object.keys(b).forEach((k) => { o[k] = (a && typeof a[k] === 'object' && !Array.isArray(a[k])) ? deepMerge(a[k], b[k]) : b[k]; });
      return o;
    }
    return b === undefined ? a : b;
  }
  const CFG = window.CFG = deepMerge(window.MARCO_DEFAULTS, store.get('advanced', {}));
  { const adv = store.get('advanced', {}); if (adv.work && adv.work.shifts) CFG.work.shifts = adv.work.shifts; }
  const settings = Object.assign({ calendars: [], proxy: '', demo: null, prices: {}, nightClock: CFG.nightClock.enabled }, store.get('settings', {}));
  const saveSettings = () => store.set('settings', settings);
  const realCalendars = () => settings.calendars.filter((c) => c.url && c.url.trim());
  const demoOn = () => (settings.demo === null || settings.demo === undefined) ? realCalendars().length === 0 : !!settings.demo;
  const kidsNames = () => CFG.kids.map((k) => k.name).join(' y ');
  const custodyOn = () => !!(CFG.custody && CFG.custody.enabled !== false && CFG.custody.anchor);
  const dayStatus = (d) => custodyOn() ? Custody.dayStatus(d) : 'none';
  const tariffName = () => CFG.tariff.name || 'tu tarifa';
  const handoverDay = () => U.DIAS[U.parseLocal(CFG.custody.anchor).getDay()].toLowerCase();
  const prices = () => Object.assign({}, CFG.tariff.prices, settings.prices || {});

  /* ---------------- Estado ---------------- */
  const S = {
    screen: 'hoy',
    events: [],
    calStatus: store.get('cache.calStatus', {}),
    calUpdated: null,
    weather: store.get('cache.weather', null),
    pvpc: store.get('cache.pvpc', null),
    sleeping: false,
    wakeUntil: 0
  };
  // Citas en caché (por si arranca sin red)
  (store.get('cache.events', []) || []).forEach((e) => S.events.push(Object.assign({}, e, { start: new Date(e.start), end: new Date(e.end) })));

  const $ = (sel) => document.querySelector(sel);
  const screenEl = $('#screen');

  function toast(msg, ms) {
    const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), ms || 3500);
  }

  /* ---------------- Datos ---------------- */
  function range() {
    const m = mondayOf(now());
    return [addDays(m, -7), addDays(m, 7 * 14)];
  }

  async function loadCalendars() {
    const [rs, re] = range();
    const out = [];
    if (demoOn()) {
      Cal.demoCalendars(sod(now())).forEach((c) => out.push.apply(out, Cal.parseICS(c.text, c, rs, re)));
      S.events = out; S.calUpdated = Date.now();
      return;
    }
    const status = {};
    let anyOk = false;
    await Promise.all(realCalendars().map(async (c, i) => {
      const key = c.id || String(i);
      try {
        const text = await Cal.fetchICS(c.url.trim(), (settings.proxy || '').trim());
        const evs = Cal.parseICS(text, c, rs, re);
        out.push.apply(out, evs); anyOk = true;
        status[key] = { ok: true, n: evs.length, at: Date.now() };
      } catch (e) {
        status[key] = { ok: false, error: String(e.message || e), cors: !!e.cors, at: Date.now() };
        // conserva las citas en caché de ese calendario
        S.events.filter((x) => x.calName === c.name).forEach((x) => out.push(x));
      }
    }));
    S.calStatus = status; store.set('cache.calStatus', status);
    S.events = out; S.calUpdated = Date.now();
    if (anyOk) store.set('cache.events', out.map((e) => Object.assign({}, e, { start: e.start.toISOString(), end: e.end.toISOString() })));
    const bad = Object.values(status).filter((s) => !s.ok);
    if (bad.length) toast('⚠️ ' + bad.length + ' calendario(s) sin actualizar: ' + bad[0].error, 6000);
  }

  async function loadWeather() {
    try { S.weather = await Weather.load(CFG.lat, CFG.lon); store.set('cache.weather', S.weather); }
    catch (e) { console.warn(e); }
  }
  async function loadPVPC() {
    try { S.pvpc = await Luz.loadPVPC(sod(now())); store.set('cache.pvpc', S.pvpc); }
    catch (e) { console.warn(e); }
  }
  async function refreshAll(manual) {
    if (manual) toast('Actualizando…', 1500);
    await Promise.all([loadCalendars().catch((e) => console.warn(e)), loadWeather(), loadPVPC()]);
    render();
    if (manual) toast('Actualizado a las ' + hm(now()));
  }

  /* ---------------- Citas, turnos y custodia ---------------- */
  function custodyEvents() {
    if (!custodyOn()) return [];
    const [rs, re] = range();
    const out = [];
    for (let d = new Date(rs); d < re; d = addDays(d, 1)) {
      const st = dayStatus(d);
      if (st === 'cambio-a-padre' || st === 'cambio-a-otro') {
        const [h, m] = Custody.handoverTime().split(':').map(Number);
        const s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
        const toP = st === 'cambio-a-padre';
        out.push({
          id: 'custodia@' + s.getTime(), virtual: true, calName: 'Custodia', color: '#8E5BC8', allDay: false,
          start: s, end: new Date(s.getTime() + 30 * 60000),
          title: toP ? '⇄ Recoger a ' + kidsNames() : '⇄ ' + kidsNames() + ' se van con ' + CFG.otherParent,
          location: '', description: toP ? 'Empieza tu semana con ' + kidsNames() + ' (hasta el siguiente ' + handoverDay() + ' a las ' + Custody.handoverTime() + ').' : 'Empieza la semana de ' + kidsNames() + ' con ' + CFG.otherParent + '.'
        });
      }
    }
    return out;
  }
  function allEvents() { return S.events.concat(custodyEvents()); }
  function eventsOn(day, list) {
    const a = sod(day), b = addDays(a, 1);
    return (list || allEvents()).filter((e) => e.start < b && e.end > a)
      .sort((x, y) => (y.allDay - x.allDay) || (x.start - y.start) || x.title.localeCompare(y.title));
  }
  function shiftOn(day) {
    if (CFG.work.enabled === false || U.esFestivoNacional(day)) return null;
    const s = CFG.work.shifts[String(day.getDay())];
    return s ? { label: CFG.work.label, from: s[0], to: s[1] } : null;
  }
  function findEvent(id) { return allEvents().find((e) => e.id === id); }
  function evTime(e, day) {
    if (e.allDay) return 'Todo el día';
    const startsToday = !day || sameDay(e.start, day);
    return (startsToday ? hm(e.start) : '…') ;
  }

  /* ---------------- Cielo ---------------- */
  function skyFor(t) {
    const w = S.weather && S.weather.days && S.weather.days.find((d) => d.date === dayKey(t));
    const rise = w ? new Date(w.sunrise) : new Date(t.getFullYear(), t.getMonth(), t.getDate(), 8, 0);
    const set = w ? new Date(w.sunset) : new Date(t.getFullYear(), t.getMonth(), t.getDate(), 19, 0);
    const M = 60000;
    if (t < new Date(rise - 45 * M) || t > new Date(+set + 60 * M)) return { cls: 'sky-night', dark: true };
    if (t < new Date(+rise + 60 * M)) return { cls: 'sky-dawn', dark: false };
    if (t < new Date(set - 60 * M)) return { cls: 'sky-day', dark: false };
    return { cls: 'sky-dusk', dark: true };
  }

  /* ---------------- Render común ---------------- */
  function evItem(e, day, compact) {
    return '<button class="ev' + (e.virtual ? ' ev-virtual' : '') + (e.end < now() ? ' ev-past' : '') + (compact ? ' compact' : '') + '" data-ev="' + esc(e.id) + '" style="--c:' + esc(e.color) + '">' +
      '<span class="ev-t">' + esc(evTime(e, day)) + '</span><span class="ev-n">' + esc(e.title) + '</span></button>';
  }
  function demoPill() { return demoOn() ? '<div class="demo-pill" title="Datos inventados. Configura tus calendarios en Ajustes">MODO DEMO · citas inventadas</div>' : ''; }

  function custodyBadge(t) {
    if (!custodyOn()) return '';
    const w = Custody.withParent(t);
    const nh = Custody.nextHandover(t);
    const when = nh ? (sameDay(nh.at, t) ? 'hoy' : U.DIAS_C[nh.at.getDay()].toLowerCase() + ' ' + nh.at.getDate() + '/' + pad(nh.at.getMonth() + 1)) + ' ' + hm(nh.at) : '';
    const txt = w ? 'Con ' + CFG.parent + ' hasta ' + when : 'Con ' + CFG.otherParent + ' · vuelven ' + when;
    return '<div class="custody-badge ' + (w ? 'is-parent' : 'is-other') + '" data-custody="' + (w ? 'padre' : 'otro') + '">' +
      '<span class="cb-ic">' + (w ? '🏠' : '🚗') + '</span><span><b>' + esc(kidsNames()) + '</b> · ' + esc(txt) + '</span></div>';
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
      const rest = w.days.slice(i0 + 1, i0 + 6);
      wx = '<div class="wx-now"><div class="wx-ic">' + (w.current.isDay === 0 && w.current.code <= 2 ? '🌙' : Weather.icon(w.current.code)) + '</div><div class="wx-temp">' + Math.round(w.current.temp) + '°</div>' +
        '<div class="wx-mm">' + Math.round(d0.min) + '° / ' + Math.round(d0.max) + '°</div><div class="wx-rain' + (d0.rain >= 40 ? ' hi' : '') + '">💧 ' + (d0.rain ?? '–') + ' %</div></div>' +
        '<div class="wx-days">' + rest.map((d) => {
          const dd = U.parseLocal(d.date);
          return '<div class="wx-day"><div class="wx-dn">' + U.DIAS_C[dd.getDay()] + '</div><div class="wx-di">' + Weather.icon(d.code) + '</div><div class="wx-dmax">' + Math.round(d.max) + '°</div><div class="wx-dmin">' + Math.round(d.min) + '°</div><div class="wx-drain' + (d.rain >= 40 ? ' hi' : '') + '">💧 ' + (d.rain ?? '–') + ' %</div></div>';
        }).join('') + '</div>';
    }

    // Lo próximo / Ahora
    const list = allEvents().filter((e) => !e.allDay && e.end > t).sort((a, b) => a.start - b.start);
    const cur = list.find((e) => e.start <= t);
    const nxt = list.find((e) => e.start > t);
    const main = cur || nxt;
    let nextHtml = '<div class="next-label">LO PRÓXIMO</div><div class="next-title">Nada a la vista</div><div class="next-sub">Sin citas en el calendario</div>';
    if (main) {
      const isNow = main === cur;
      const dayTxt = sameDay(main.start, t) ? 'Hoy' : sameDay(main.start, addDays(t, 1)) ? 'Mañana' : U.fechaCorta(main.start);
      const pill = isNow ? 'termina en ' + U.countdown(main.end - t) : 'en ' + U.countdown(main.start - t);
      const after = isNow ? nxt : list.find((e) => e.start > main.start);
      nextHtml = '<div class="next-head"><div class="next-label">' + (isNow ? 'AHORA' : 'LO PRÓXIMO') + '</div><div class="next-pill" data-countdown>' + esc(pill) + '</div></div>' +
        '<div class="next-title" role="button" data-ev="' + esc(main.id) + '">' + esc(main.title) + '</div>' +
        '<div class="next-sub">' + esc(dayTxt + ' · ' + hm(main.start) + '–' + hm(main.end) + (main.location ? ' · ' + main.location : '')) + '</div>' +
        (after ? '<button class="next-after" data-ev="' + esc(after.id) + '">Después: ' + esc((sameDay(after.start, t) ? '' : U.DIAS_C[after.start.getDay()] + ' ') + hm(after.start) + ' ' + after.title) + '</button>' : '');
      nextHtml = '<div class="next-in ' + (isNow ? 'is-now' : '') + '" style="--c:' + esc(main.color) + '">' + nextHtml + '</div>';
    } else nextHtml = '<div class="next-in">' + nextHtml + '</div>';

    // Semana
    const evs = allEvents();
    let week = '';
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, i);
      const st = dayStatus(d);
      const sh = shiftOn(d);
      const items = eventsOn(d, evs);
      const kids = st === 'padre' ? '<div class="kids-chip">🏠 Con ' + esc(kidsNames()) + '</div>' : '';
      week += '<div class="day c-' + st + (i === 0 ? ' is-today' : '') + '">' +
        '<div class="day-h"><span class="day-n">' + (i === 0 ? 'Hoy' : U.DIAS_C[d.getDay()]) + '</span><span class="day-d">' + d.getDate() + '</span></div>' +
        (sh ? '<div class="shift">💼 ' + esc(sh.from + '–' + sh.to) + '</div>' : '<div class="shift off">Libre</div>') + kids +
        '<div class="day-evs">' + items.map((e) => evItem(e, d)).join('') + (items.length ? '' : '<div class="no-ev">—</div>') + '</div></div>';
    }

    // Resúmenes
    const ninos = choresSummary();
    const compra = store.get('compra', { items: [] }).items.filter((x) => !x.done);
    const p = Luz.period(t);
    const nw = Luz.nextWindow(t, 'valle');

    screenEl.innerHTML = demoPill() + '<div class="hoy">' +
      '<section class="sky ' + sky.cls + (sky.dark ? ' dark' : '') + '">' +
        '<div class="sky-left"><div class="big-clock" data-clock="big">' + hm(t) + '</div><div class="sky-date"><b>' + U.DIAS[t.getDay()] + '</b> ' + t.getDate() + ' de ' + U.MESES[t.getMonth()] + '</div>' + custodyBadge(t) + '</div>' +
        '<div class="sky-wx">' + wx + '</div></section>' +
      '<section class="next card">' + nextHtml + '</section>' +
      '<section class="week">' + week + '</section>' +
      '<section class="sums">' +
        '<button class="card sum" data-go="ninos"><div class="sum-h c-orange">⭐ NIÑOS</div><div class="sum-big">' + ninos.pending + (ninos.pending === 1 ? ' tarea por hacer' : ' tareas por hacer') + '</div><div class="sum-chips">' + ninos.chips + '</div></button>' +
        '<button class="card sum" data-go="compra"><div class="sum-h c-green">🛒 COMPRA</div><div class="sum-big">' + compra.length + (compra.length === 1 ? ' cosa' : ' cosas') + '</div><div class="sum-sub">' + esc(compra.slice(0, 5).map((x) => x.name).join(' · ') || 'Lista vacía') + '</div></button>' +
        '<button class="card sum" data-go="luz"><div class="sum-h c-amber">⚡ LUZ · 2.0TD</div><div class="sum-big"><span class="per-dot" style="--c:' + Luz.COLOR[p] + '"></span>Ahora ' + Luz.NOMBRE[p].toLowerCase() + '</div><div class="sum-sub">' + (p === 'valle' ? 'Buen momento para lavadora y lavavajillas' : nw ? 'Valle ' + whenTxt(nw.start, t) : '') + '</div></button>' +
      '</section></div>';
  }

  /* ---------------- CALENDARIO ---------------- */
  function renderCalendario() {
    const t = now();
    const today = sod(t);
    const start = mondayOf(t);
    const evs = allEvents();
    const wxBy = {};
    (S.weather && S.weather.days || []).forEach((d) => { wxBy[d.date] = d; });
    let html = '<div class="cal-head">' + ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => '<div>' + d + '</div>').join('') + '</div><div class="cal-body">';
    for (let wk = 0; wk < 13; wk++) {
      const ws = addDays(start, wk * 7);
      const we = addDays(ws, 6);
      const label = U.MESES[ws.getMonth()] + (ws.getMonth() !== we.getMonth() ? ' – ' + U.MESES[we.getMonth()] : '') + ' ' + we.getFullYear();
      html += '<div class="cal-week"><div class="cal-wl">' + esc(label) + '</div><div class="cal-row">';
      for (let i = 0; i < 7; i++) {
        const d = addDays(ws, i);
        const st = dayStatus(d);
        const items = eventsOn(d, evs);
        const sh = shiftOn(d);
        const wx = wxBy[dayKey(d)];
        const first = d.getDate() === 1;
        const max = 4;
        html += '<div class="cell c-' + st + (sameDay(d, today) ? ' is-today' : '') + (d < today ? ' is-past' : '') + (first ? ' is-first' : '') + '" data-day="' + dayKey(d) + '">' +
          '<div class="cell-h"><span class="cell-n">' + (sameDay(d, today) ? 'Hoy' : U.DIAS_C[d.getDay()]) + (first ? ' · ' + U.MESES_C[d.getMonth()] : '') + '</span><span class="cell-d">' + d.getDate() + '</span></div>' +
          (wx ? '<div class="cell-wx">' + Weather.icon(wx.code) + ' ' + Math.round(wx.max) + '°/' + Math.round(wx.min) + '° <span class="' + (wx.rain >= 40 ? 'hi' : '') + '">💧' + (wx.rain ?? '–') + '%</span></div>' : '') +
          (sh ? '<div class="shift sm">💼 ' + esc(sh.from + '–' + sh.to) + '</div>' : '') +
          '<div class="cell-evs">' + items.slice(0, max).map((e) => evItem(e, d, true)).join('') +
          (items.length > max ? '<button class="more" data-dayall="' + dayKey(d) + '">+' + (items.length - max) + ' más</button>' : '') + '</div></div>';
      }
      html += '</div></div>';
    }
    html += '</div>' + (custodyOn() ? '<div class="cal-legend"><span class="lgd lgd-p"></span>Semana con ' + esc(kidsNames()) + ' (cambio los ' + handoverDay() + (handoverDay().endsWith('s') ? '' : 's') + ' a las ' + Custody.handoverTime() + ')<span class="lgd lgd-o"></span>Con ' + esc(CFG.otherParent) + '</div>' : '');
    screenEl.innerHTML = demoPill() + '<div class="cal">' + html + '</div>';
  }

  /* ---------------- LUZ ---------------- */
  function whenTxt(d, t) {
    const tomorrow = sameDay(d, addDays(t, 1));
    if (tomorrow && d.getHours() === 0 && d.getMinutes() === 0) return 'esta noche desde las 00:00';
    return (sameDay(d, t) ? 'hoy' : tomorrow ? 'mañana' : U.DIAS[d.getDay()].toLowerCase()) + ' desde las ' + hm(d);
  }
  function timelineDay(d, t) {
    const segs = Luz.tramosDelDia(d).map(([a, b, p]) => '<div class="tl-seg" style="flex:' + (b - a) + ';--c:' + Luz.COLOR[p] + '"><span>' + (b - a >= 2 ? Luz.NOMBRE[p] : '') + '</span></div>').join('');
    const mark = sameDay(d, t) ? '<div class="tl-now" style="left:' + ((t.getHours() * 60 + t.getMinutes()) / 14.4) + '%"></div>' : '';
    const ticks = [0, 4, 8, 12, 16, 20, 24].map((h) => '<span style="left:' + (h / 24 * 100) + '%">' + h + '</span>').join('');
    return '<div class="tl"><div class="tl-bar">' + segs + mark + '</div><div class="tl-ticks">' + ticks + '</div></div>';
  }
  function fmtWin(wn, t) {
    if (!wn) return '—';
    const tonight = sameDay(wn.start, addDays(t, 1)) && hm(wn.start) === '00:00';
    const startTxt = wn.start <= t ? 'ya' : tonight ? 'esta noche 00:00' : (sameDay(wn.start, t) ? 'hoy' : sameDay(wn.start, addDays(t, 1)) ? 'mañana' : U.DIAS[wn.start.getDay()].toLowerCase()) + (tonight ? '' : ' ' + hm(wn.start));
    return startTxt + ' → ' + (sameDay(wn.end, wn.start) || hm(wn.end) === '00:00' ? '' : U.DIAS_C[wn.end.getDay()] + ' ') + hm(wn.end);
  }
  // Estimación: impuesto eléctrico 5,11269632 % y luego IVA 21 % (no incluye término de potencia ni alquiler de contador)
  const TAX = 1.0511269632 * 1.21;
  function renderLuz() {
    const t = now();
    const today = sod(t);
    const p = Luz.period(t);
    // siguiente cambio de periodo
    let nx = new Date(t); nx.setMinutes(0, 0, 0);
    do { nx = new Date(nx.getTime() + 3600000); } while (Luz.period(nx) === p && nx - t < 72 * 3600000);
    const pr = prices();
    const hasPrices = ['punta', 'llano', 'valle'].some((k) => pr[k] != null && pr[k] !== '');
    const valle = Luz.nextWindow(t, 'valle');
    const appl = [['🧺', 'Lavadora', 2], ['🍽️', 'Lavavajillas', 3]].map(([ic, n, h]) => {
      let w = valle; let hint = '';
      if (w) {
        const hours = (w.end - w.start) / 3600000;
        hint = hours >= h ? 'cabe entera en valle (' + h + ' h aprox.)' : 'el valle dura ' + Math.floor(hours) + ' h';
        if (w.start > t) hint = 'Prográmala para las ' + hm(w.start) + ' · ' + hint;
        else hint = 'Ahora es valle · ' + hint;
      }
      return '<div class="best"><div class="best-ic">' + ic + '</div><div><div class="best-n">' + n + '</div><div class="best-w">' + esc(fmtWin(w, t)) + '</div><div class="best-h">' + esc(hint) + '</div></div></div>';
    }).join('');

    // PVPC de referencia
    let pv = '<div class="muted">Sin datos de REE todavía.</div>';
    const pd = S.pvpc && S.pvpc.byDay;
    if (pd && pd[dayKey(today)]) {
      const chart = (vals, label, isToday) => {
        const max = Math.max.apply(null, vals.map((v) => v.eur)), min = Math.min.apply(null, vals.map((v) => v.eur));
        const bars = vals.map((v) => {
          const r = max === min ? 0.5 : (v.eur - min) / (max - min);
          const col = r < 0.33 ? '#3BA55C' : r < 0.66 ? '#F5A623' : '#D9483B';
          const isNow = isToday && v.hour === t.getHours();
          return '<div class="bar' + (isNow ? ' now' : '') + '" title="' + v.hour + ':00 · ' + v.eur.toFixed(3) + ' €/kWh" style="height:' + (12 + r * 88) + '%;--c:' + col + '"></div>';
        }).join('');
        const nowV = isToday ? vals.find((v) => v.hour === t.getHours()) : null;
        const cheap2 = Luz.cheapest(vals, 2, isToday ? t.getTime() - 3600000 : 0);
        return '<div class="pv-day"><div class="pv-h"><b>' + label + '</b>' + (nowV ? '<span class="pv-k">Ahora <b>' + nowV.eur.toFixed(3) + '</b> <span class="est">(≈' + (nowV.eur * TAX).toFixed(3) + ' con impuestos, estimado)</span></span>' : '') +
          '<span class="pv-k">Mín <b>' + min.toFixed(3) + '</b></span><span class="pv-k">Máx <b>' + max.toFixed(3) + '</b></span>' +
          (cheap2 ? '<span class="pv-k">' + (isToday ? 'Próximas 2 h más baratas' : '2 h más baratas') + ' <b>' + hm(new Date(cheap2.start)) + '–' + hm(new Date(cheap2.end)) + '</b></span>' : '') + '</div>' +
          '<div class="bars">' + bars + '</div><div class="bars-x">' + vals.map((v) => '<span>' + (v.hour % 3 === 0 ? v.hour : '') + '</span>').join('') + '</div></div>';
      };
      pv = chart(pd[dayKey(today)], 'Hoy', true) + (pd[dayKey(addDays(today, 1))] ? chart(pd[dayKey(addDays(today, 1))], 'Mañana', false) : '<div class="muted sm">El precio de mañana lo publica REE hacia las 20:30.</div>');
    }

    screenEl.innerHTML = '<div class="luz">' +
      '<section class="card luz-now" style="--c:' + Luz.COLOR[p] + '"><div class="card-h">⚡ Periodo ahora · peajes 2.0TD</div>' +
        '<div class="per-big"><span class="per-dot big" style="--c:' + Luz.COLOR[p] + '"></span>' + Luz.NOMBRE[p] + '</div>' +
        '<div class="per-sub">Hasta ' + (sameDay(nx, t) ? 'las ' : U.DIAS[nx.getDay()].toLowerCase() + ' a las ') + hm(nx) + ', luego ' + Luz.NOMBRE[Luz.period(nx)].toLowerCase() + (Luz.esFinde(t) ? ' · fin de semana o festivo: todo el día valle' : '') + '</div>' +
        '<div class="tl-lbl">Hoy</div>' + timelineDay(today, t) + '<div class="tl-lbl">Mañana</div>' + timelineDay(addDays(today, 1), t) +
        '<div class="per-cards">' + ['punta', 'llano', 'valle'].map((k) => '<div class="per-card' + (k === p ? ' on' : '') + '" style="--c:' + Luz.COLOR[k] + '"><div class="pc-n">' + Luz.NOMBRE[k] + '</div><div class="pc-v">' + (pr[k] != null && pr[k] !== '' ? esc(String(pr[k]).replace('.', ',')) + ' €/kWh' : '—') + '</div></div>').join('') + '</div>' +
        '<div class="muted sm">' + (hasPrices ? 'Precios de ' + esc(tariffName()) + ' introducidos por ti en Ajustes.' : 'Tarifa (' + esc(tariffName()) + '): aquí no hay precios inventados. Si quieres verlos, cópialos de tu factura en Ajustes.') + '</div></section>' +
      '<section class="card luz-best"><div class="card-h">🕒 Mejores horas</div>' + appl +
        '<div class="muted sm">En todas las tarifas 2.0TD los peajes y cargos son más baratos en valle (00:00–08:00 entre semana, y sábados, domingos y festivos nacionales todo el día). Si tu tarifa tiene un único precio de energía, el ahorro es solo esa parte.</div></section>' +
      '<section class="card luz-pvpc"><div class="card-h">📊 PVPC · referencia del mercado regulado <span class="tag">NO es tu tarifa</span></div>' + pv +
        '<div class="muted sm">Fuente: REE (apidatos.ree.es), término de energía PVPC 2.0TD en €/kWh, sin IVA ni impuesto eléctrico (el «con impuestos» es una estimación: ×1,0511 impuesto eléctrico y ×1,21 IVA). Solo sirve para ver qué horas son caras o baratas en el mercado.</div></section>' +
      '</div>';
  }

  /* ---------------- NIÑOS ---------------- */
  const K = () => Object.assign({ stars: {}, done: {}, pending: [], log: [] }, store.get('ninos', {}));
  const saveK = (k) => store.set('ninos', k);
  const chores = () => CFG.chores;
  const rewards = () => CFG.rewards;

  function choresSummary() {
    const k = K(); const today = dayKey(now());
    const done = k.done[today] || {};
    let pending = 0;
    chores().forEach((c) => CFG.kids.forEach((kid) => { if (!(done[c.id] || []).includes(kid.id)) pending++; }));
    const chips = CFG.kids.map((kid) => '<span class="kid-chip" style="--c:' + kid.color + '">' + esc(kid.name) + ' ⭐ ' + (k.stars[kid.id] || 0) + '</span>').join('');
    return { pending, chips };
  }

  function renderNinos() {
    const t = now();
    const k = K(); const today = dayKey(t);
    const done = k.done[today] || {};
    const w = custodyOn() ? Custody.withParent(t) : null;
    const chips = CFG.kids.map((kid) => '<span class="kid-chip lg" style="--c:' + kid.color + '"><span class="av">' + esc(kid.name[0]) + '</span>' + esc(kid.name) + ' ⭐ ' + (k.stars[kid.id] || 0) + '</span>').join('');
    const rows = chores().map((c) => '<div class="chore"><div class="ch-ic">' + esc(c.emoji) + '</div><div class="ch-n">' + esc(c.name) + '<div class="ch-s">+' + c.stars + ' ⭐</div></div><div class="ch-kids">' +
      CFG.kids.map((kid) => { const on = (done[c.id] || []).includes(kid.id); return '<button class="kid-btn' + (on ? ' on' : '') + '" style="--c:' + kid.color + '" data-chore="' + esc(c.id) + '" data-kid="' + esc(kid.id) + '">' + (on ? '✓ ' : '') + esc(kid.name) + '</button>'; }).join('') + '</div></div>').join('');
    const rws = rewards().map((r) => '<div class="reward"><div class="rw-h"><span class="rw-ic">' + esc(r.emoji) + '</span><span class="rw-n">' + esc(r.name) + '</span><span class="rw-c">' + r.cost + ' ⭐</span></div><div class="rw-kids">' +
      CFG.kids.map((kid) => {
        const s = k.stars[kid.id] || 0; const pct = Math.min(100, s / r.cost * 100);
        const asked = k.pending.some((p) => p.kid === kid.id && p.reward === r.id);
        return '<div class="rw-kid" style="--c:' + kid.color + '"><span class="av sm">' + esc(kid.name[0]) + '</span><div class="prog"><div style="width:' + pct + '%"></div></div>' +
          (asked ? '<span class="rw-st">Pedido</span>' : s >= r.cost ? '<button class="btn sm" data-ask="' + esc(r.id) + '" data-kid="' + esc(kid.id) + '">Canjear</button>' : '<span class="rw-st">faltan ' + (r.cost - s) + '</span>') + '</div>';
      }).join('') + '</div></div>').join('');
    const pend = k.pending.map((p) => {
      const kid = CFG.kids.find((x) => x.id === p.kid) || { name: p.kid }; const r = rewards().find((x) => x.id === p.reward) || { name: p.reward, cost: 0, emoji: '🎁' };
      return '<div class="pend"><span>' + esc(r.emoji + ' ' + kid.name + ': ' + r.name) + ' (' + r.cost + ' ⭐)</span><span><button class="btn sm ok" data-approve="' + esc(p.id) + '">Aprobar 🔒</button> <button class="btn sm ghost" data-reject="' + esc(p.id) + '">No</button></span></div>';
    }).join('');
    const log = (k.log || []).slice(-6).reverse().map((l) => '<div class="log">' + esc(l) + '</div>').join('');
    screenEl.innerHTML = '<div class="ninos">' +
      '<section class="card"><div class="card-h">⭐ Tareas de hoy <span class="muted sm">' + (w === null ? '' : w ? 'Semana con ' + esc(CFG.parent) : 'Esta semana están con ' + esc(CFG.otherParent)) + '</span></div><div class="kid-chips">' + chips + '</div>' + rows +
        '<div class="muted sm">Cada uno toca su nombre al terminar. Volver a tocar lo deshace. Las tareas se reinician cada día.</div></section>' +
      '<section class="col"><div class="card"><div class="card-h">🎁 Recompensas</div>' + rws + '</div>' +
        '<div class="card"><div class="card-h">🔒 Pendiente de aprobar <span class="count">' + k.pending.length + '</span></div>' + (pend || '<div class="muted">Nada pendiente.</div>') +
        (log ? '<div class="card-h sub">Últimos movimientos</div>' + log : '') + '</div></section></div>';
  }

  function toggleChore(choreId, kidId) {
    const k = K(); const today = dayKey(now());
    const c = chores().find((x) => x.id === choreId); const kid = CFG.kids.find((x) => x.id === kidId);
    if (!c || !kid) return;
    k.done[today] = k.done[today] || {};
    const arr = k.done[today][choreId] = k.done[today][choreId] || [];
    const i = arr.indexOf(kidId);
    if (i >= 0) { arr.splice(i, 1); k.stars[kidId] = Math.max(0, (k.stars[kidId] || 0) - c.stars); k.log.push(hm(now()) + ' · ' + kid.name + ' deshace «' + c.name + '» (−' + c.stars + ' ⭐)'); }
    else { arr.push(kidId); k.stars[kidId] = (k.stars[kidId] || 0) + c.stars; k.log.push(hm(now()) + ' · ' + kid.name + ' hizo «' + c.name + '» (+' + c.stars + ' ⭐)'); }
    // limpia días antiguos (guarda 14)
    Object.keys(k.done).sort().slice(0, -14).forEach((d) => delete k.done[d]);
    k.log = k.log.slice(-50);
    saveK(k); render();
  }

  /* ---------------- PIN de padres ---------------- */
  function pinPad(title) {
    return new Promise((resolve) => {
      const lock = store.get('pinLock', { fails: 0, until: 0 });
      if (lock.until > Date.now()) { toast('Demasiados intentos. Espera ' + Math.ceil((lock.until - Date.now()) / 60000) + ' min.'); return resolve(false); }
      let val = '';
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];
      openModal('<div class="pin"><div class="modal-h">' + esc(title) + '</div><div class="pin-dots" id="pinDots"></div><div class="pin-grid">' + keys.map((x) => '<button class="pin-k" data-k="' + x + '">' + x + '</button>').join('') + '</div><button class="btn ghost" data-k="x">Cancelar</button></div>', true);
      const dots = () => { $('#pinDots').textContent = val.replace(/./g, '●') || ' '; };
      dots();
      $('#modal').onclick = (ev) => {
        const b = ev.target.closest('[data-k]'); if (!b) return;
        const kk = b.dataset.k;
        if (kk === 'x') { closeModal(); return resolve(false); }
        if (kk === '⌫') { val = val.slice(0, -1); return dots(); }
        if (kk === '✓') {
          closeModal();
          if (val === store.get('pin', null)) { store.set('pinLock', { fails: 0, until: 0 }); return resolve(true); }
          const l = store.get('pinLock', { fails: 0, until: 0 }); l.fails++;
          if (l.fails >= 5) { l.until = Date.now() + 5 * 60000; l.fails = 0; }
          store.set('pinLock', l); toast('PIN incorrecto'); return resolve(false);
        }
        if (val.length < 8) { val += kk; dots(); }
      };
    });
  }
  async function requirePin(title) {
    if (!store.get('pin', null)) { toast('Primero crea el PIN de padres en Ajustes'); return false; }
    return pinPad(title);
  }

  /* ---------------- COMPRA ---------------- */
  const C = () => Object.assign({ items: [], counts: {} }, store.get('compra', {}));
  const saveC = (c) => store.set('compra', c);
  function addItem(name) {
    name = (name || '').trim().replace(/\s+/g, ' ');
    if (!name) return;
    name = name[0].toUpperCase() + name.slice(1);
    const c = C();
    const ex = c.items.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (ex) ex.done = false; else c.items.push({ id: U.uid(), name, done: false, at: Date.now() });
    c.counts[name] = (c.counts[name] || 0) + 1;
    saveC(c); render();
  }
  function habituales(c) {
    const onList = new Set(c.items.filter((x) => !x.done).map((x) => x.name.toLowerCase()));
    const fromCounts = Object.entries(c.counts).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    const all = fromCounts.concat(CFG.habitualesBase);
    const seen = new Set(); const out = [];
    all.forEach((n) => { const l = n.toLowerCase(); if (!onList.has(l) && !seen.has(l)) { seen.add(l); out.push(n); } });
    return out.slice(0, 9);
  }
  function renderCompra() {
    const c = C();
    const items = c.items;
    const pending = items.filter((x) => !x.done);
    screenEl.innerHTML = '<div class="compra">' +
      '<section class="card"><div class="card-h">🛒 Lista de la compra <span class="count">' + pending.length + '</span></div>' +
        '<form class="add" id="addForm" autocomplete="off"><input id="addInput" placeholder="Añadir… (p. ej. leche)" maxlength="60" enterkeyhint="done"><button class="btn" type="submit">Añadir</button></form>' +
        '<div class="items">' + (items.length ? items.map((x) => '<button class="item' + (x.done ? ' done' : '') + '" data-item="' + esc(x.id) + '"><span class="box">' + (x.done ? '✓' : '') + '</span>' + esc(x.name) + '</button>').join('') : '<div class="muted">La lista está vacía.</div>') + '</div>' +
        '<div class="row-btns"><button class="btn ghost" data-act="clearDone">Quitar comprados</button><button class="btn ghost" data-act="share">Compartir lista</button></div></section>' +
      '<section class="card"><div class="card-h sub">HABITUALES · TOCA PARA AÑADIR</div><div class="habs">' +
        habituales(c).map((n) => '<button class="hab" data-hab="' + esc(n) + '"><b>' + esc(n) + '</b><span>+ Añadir</span></button>').join('') + '</div>' +
        '<div class="muted sm">La lista se guarda en este dispositivo. Para pasarla al móvil usa «Compartir lista».</div></section></div>';
    const f = $('#addForm');
    f.onsubmit = (ev) => { ev.preventDefault(); const v = $('#addInput').value; addItem(v); setTimeout(() => { const i = $('#addInput'); if (i) i.focus(); }, 0); };
  }

  /* ---------------- Familia e importar/exportar ---------------- */
  const WD = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo']];
  function familyCard() {
    const c = CFG.custody || {}, w = CFG.work || {};
    const kidsTxt = CFG.kids.map((k) => k.name + ' | ' + (k.color || '')).join('\n');
    const shifts = WD.map(([n, name]) => { const sh = (w.shifts || {})[String(n)] || ['', ''];
      return '<div class="wd"><span>' + name + '</span><input type="time" id="wf' + n + '" value="' + esc(sh[0]) + '"><input type="time" id="wt' + n + '" value="' + esc(sh[1]) + '"></div>'; }).join('');
    return '<section class="card fam"><div class="card-h">👨‍👧‍👦 Familia, custodia y jornada</div>' +
      '<div class="muted sm">Se guarda solo en este dispositivo. Al guardar se recarga la página.</div>' +
      '<div class="grid2"><label class="lbl">Tu nombre<input id="f_parent" value="' + esc(CFG.parent) + '"></label><label class="lbl">Otro progenitor<input id="f_other" value="' + esc(CFG.otherParent) + '"></label></div>' +
      '<label class="lbl">Niños (uno por línea: <code>nombre | color</code>)</label><textarea id="f_kids" rows="3">' + esc(kidsTxt) + '</textarea>' +
      '<label class="switch"><input type="checkbox" id="f_cus" ' + (custodyOn() ? 'checked' : '') + '> Custodia por semanas alternas</label>' +
      '<div class="grid3"><label class="lbl">Inicio de una semana contigo (día y hora del cambio)<input id="f_anchor" type="datetime-local" value="' + esc((c.anchor || '').slice(0, 16)) + '"></label>' +
      '<label class="lbl">Ciclo (días)<input id="f_cycle" type="number" min="2" max="60" value="' + esc(c.cycleDays || 14) + '"></label>' +
      '<label class="lbl">Días contigo<input id="f_days" type="number" min="1" max="59" value="' + esc(c.daysWithParent || 7) + '"></label></div>' +
      '<div class="muted sm">El día de la semana y la hora del cambio salen de esa fecha (p. ej. un viernes a las 17:00).</div>' +
      '<label class="switch"><input type="checkbox" id="f_work" ' + (w.enabled !== false ? 'checked' : '') + '> Jornada de trabajo</label>' +
      '<label class="lbl">Nombre<input id="f_wlabel" value="' + esc(w.label || '') + '"></label><div class="wds">' + shifts + '</div>' +
      '<div class="muted sm">Deja vacío un día para marcarlo libre.</div>' +
      '<div class="grid3"><label class="lbl">Ciudad (tiempo)<input id="f_city" value="' + esc(CFG.city) + '"></label><label class="lbl">Latitud<input id="f_lat" inputmode="decimal" value="' + esc(CFG.lat) + '"></label><label class="lbl">Longitud<input id="f_lon" inputmode="decimal" value="' + esc(CFG.lon) + '"></label></div>' +
      '<label class="lbl">Nombre de tu tarifa de luz (opcional)<input id="f_tariff" value="' + esc(CFG.tariff.name || '') + '"></label>' +
      '<div class="row-btns"><button class="btn" data-act="saveFamily">Guardar familia</button></div></section>' +
      '<section class="card"><div class="card-h">📦 Importar / exportar ajustes</div>' +
      '<div class="muted sm">Pega aquí un JSON de ajustes (por ejemplo el que te has preparado en privado) y pulsa «Importar». Sustituye familia, custodia, jornada, tareas y demás.</div>' +
      '<textarea id="impTxt" rows="5" spellcheck="false" placeholder=\'{"tipo":"marco-familiar-ajustes", ...}\'></textarea>' +
      '<div class="row-btns"><button class="btn" data-act="importJson">Importar</button><label class="btn ghost filebtn">Desde archivo<input type="file" id="impFile" accept=".json,application/json" hidden></label></div>' +
      '<label class="switch"><input type="checkbox" id="expCals"> Incluir direcciones de calendarios al exportar (son secretas)</label>' +
      '<div class="row-btns"><button class="btn ghost" data-act="exportJson">Exportar</button></div></section>';
  }
  function slug(t, i) { return (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'peque-' + i; }
  function saveFamily() {
    const adv = store.get('advanced', {});
    const kids = $('#f_kids').value.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p[0])
      .map((p, i) => ({ id: slug(p[0], i), name: p[0], color: /^#[0-9a-f]{6}$/i.test(p[1] || '') ? p[1] : ['#2F80ED', '#3BA55C', '#E8604C', '#8E5BC8'][i % 4] }));
    if (!kids.length) { toast('Pon al menos un niño'); return; }
    const shifts = {};
    WD.forEach(([n]) => { const f = $('#wf' + n).value, t = $('#wt' + n).value; if (f && t) shifts[String(n)] = [f, t]; });
    const anchor = $('#f_anchor').value;
    if ($('#f_cus').checked && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(anchor)) { toast('Pon la fecha y hora de inicio de una semana contigo'); return; }
    const lat = parseFloat(String($('#f_lat').value).replace(',', '.')), lon = parseFloat(String($('#f_lon').value).replace(',', '.'));
    Object.assign(adv, {
      parent: $('#f_parent').value.trim() || 'Papá', otherParent: $('#f_other').value.trim() || 'Mamá', kids,
      custody: { enabled: $('#f_cus').checked, anchor: anchor || (CFG.custody || {}).anchor || '', cycleDays: Math.max(2, parseInt($('#f_cycle').value, 10) || 14), daysWithParent: Math.max(1, parseInt($('#f_days').value, 10) || 7) },
      work: { enabled: $('#f_work').checked, label: $('#f_wlabel').value.trim(), shifts },
      city: $('#f_city').value.trim() || CFG.city,
      tariff: Object.assign({}, adv.tariff || {}, { name: $('#f_tariff').value.trim() })
    });
    if (!isNaN(lat) && !isNaN(lon)) { adv.lat = lat; adv.lon = lon; }
    store.set('advanced', adv); store.del('cache.weather');
    location.reload();
  }
  function exportJson() {
    const st = JSON.parse(JSON.stringify(settings));
    if (!$('#expCals').checked) { st.calendars = []; st.proxy = ''; }
    const data = { tipo: 'marco-familiar-ajustes', version: 1, advanced: store.get('advanced', {}), settings: st };
    const txt = JSON.stringify(data, null, 2);
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
      a.download = 'ajustes-marco.json'; document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { /* algunos navegadores de quiosco no descargan */ }
    openModal('<div class="modal-t">Ajustes exportados</div><div class="muted sm">También puedes copiarlos de aquí.</div><textarea class="share-ta" rows="10" readonly>' + esc(txt) + '</textarea>');
  }
  function importJson(txt) {
    let d;
    try { d = JSON.parse(txt); } catch (e) { toast('JSON no válido: ' + e.message); return false; }
    if (!d || typeof d !== 'object') { toast('JSON no válido'); return false; }
    const adv = d.advanced || (d.tipo ? {} : d);   // también acepta solo el bloque «advanced»
    store.set('advanced', adv);
    if (d.settings && typeof d.settings === 'object') {
      const cur = store.get('settings', {});
      const next = Object.assign({}, cur, d.settings);
      if (!d.settings.calendars || !d.settings.calendars.length) next.calendars = cur.calendars || [];
      if (!d.settings.proxy) next.proxy = cur.proxy || '';
      store.set('settings', next);
    }
    store.del('cache.weather');
    toast('Ajustes importados'); setTimeout(() => location.reload(), 400);
    return true;
  }
  document.addEventListener('change', (ev) => {
    if (ev.target && ev.target.id === 'impFile' && ev.target.files[0]) {
      const r = new FileReader(); r.onload = () => importJson(String(r.result)); r.readAsText(ev.target.files[0]);
    }
  });

  /* ---------------- AJUSTES ---------------- */
  function renderAjustes() {
    const calRows = (settings.calendars.length ? settings.calendars : []).map((c, i) => {
      const st = S.calStatus[c.id || String(i)];
      const stTxt = !c.url ? '' : st ? (st.ok ? '✅ ' + st.n + ' citas · ' + hm(new Date(st.at)) : '❌ ' + st.error) : 'Sin probar';
      return '<div class="cal-set" data-i="' + i + '"><input class="cs-name" value="' + esc(c.name) + '" placeholder="Nombre"><input class="cs-color" type="color" value="' + esc(c.color || '#E8604C') + '">' +
        '<input class="cs-url" type="password" value="' + esc(c.url) + '" placeholder="https://calendar.google.com/calendar/ical/…/private-…/basic.ics" autocomplete="off" spellcheck="false">' +
        '<button class="btn sm ghost" data-act="showUrl" data-i="' + i + '">👁</button><button class="btn sm ghost" data-act="delCal" data-i="' + i + '">Quitar</button><div class="cs-st">' + esc(stTxt) + '</div></div>';
    }).join('');
    const pr = prices();
    const ch = chores().map((c) => [c.emoji, c.name, c.stars].join(' | ')).join('\n');
    const rw = rewards().map((r) => [r.emoji, r.name, r.cost].join(' | ')).join('\n');
    screenEl.innerHTML = '<div class="ajustes">' +
      '<section class="card"><div class="card-h">🗓️ Calendarios (iCal secreto de Google)</div>' +
        '<div class="muted sm">En Google Calendar (web): Configuración → tu calendario → «Dirección secreta en formato iCal». Se guarda SOLO en este dispositivo (localStorage), nunca en el código.</div>' +
        '<div id="calList">' + (calRows || '<div class="muted">No hay calendarios.</div>') + '</div>' +
        '<div class="row-btns"><button class="btn ghost" data-act="addCal">+ Añadir calendario</button></div>' +
        '<label class="lbl">Proxy CORS (opcional, prefijo que termina en <code>?url=</code>)</label><input id="proxy" value="' + esc(settings.proxy) + '" placeholder="https://marco-ics.tu-cuenta.workers.dev/?key=…&url=" spellcheck="false">' +
        '<div class="muted sm">Google no deja leer el iCal directamente desde el navegador (falta la cabecera CORS). Usa el Worker de <code>proxy/</code> o <code>serve.py</code>.</div>' +
        '<label class="switch"><input type="checkbox" id="demo" ' + (demoOn() ? 'checked' : '') + '> Modo demostración (citas inventadas)</label>' +
        '<div class="row-btns"><button class="btn" data-act="saveCals">Guardar y probar</button></div></section>' +
      familyCard() +
      '<section class="card"><div class="card-h">⚡ Precios de ' + esc(tariffName()) + '</div><div class="muted sm">Opcional. Cópialos de tu factura o contrato (€/kWh). Si los dejas vacíos no se enseña ningún precio.</div>' +
        '<div class="prices">' + ['punta', 'llano', 'valle'].map((k) => '<label>' + Luz.NOMBRE[k] + '<input id="p_' + k + '" inputmode="decimal" value="' + esc(pr[k] == null ? '' : pr[k]) + '" placeholder="0,000"></label>').join('') + '</div>' +
        '<div class="row-btns"><button class="btn" data-act="savePrices">Guardar precios</button></div></section>' +
      '<section class="card"><div class="card-h">⭐ Tareas y recompensas</div><div class="muted sm">Una por línea: <code>emoji | nombre | estrellas</code></div>' +
        '<label class="lbl">Tareas</label><textarea id="choresTxt" rows="5">' + esc(ch) + '</textarea><label class="lbl">Recompensas</label><textarea id="rewardsTxt" rows="4">' + esc(rw) + '</textarea>' +
        '<div class="row-btns"><button class="btn" data-act="saveChores">Guardar</button><button class="btn ghost" data-act="resetStars">Poner estrellas a 0 🔒</button></div></section>' +
      '<section class="card"><div class="card-h">🔒 PIN de padres</div><div class="muted sm">Para aprobar canjes y entrar en Ajustes. Se guarda en este dispositivo; es un candado para niños, no seguridad fuerte.</div>' +
        '<div class="row-btns"><input id="pin1" type="password" inputmode="numeric" maxlength="8" placeholder="Nuevo PIN (4–8 cifras)"><button class="btn" data-act="savePin">' + (store.get('pin', null) ? 'Cambiar PIN' : 'Crear PIN') + '</button></div></section>' +
      '<section class="card"><div class="card-h">🌙 Pantalla</div><label class="switch"><input type="checkbox" id="night" ' + (settings.nightClock ? 'checked' : '') + '> Reloj nocturno de ' + esc(CFG.nightClock.from) + ' a ' + esc(CFG.nightClock.to) + '</label>' +
        '<div class="row-btns"><button class="btn ghost" data-act="fullscreen">Pantalla completa</button><button class="btn" data-act="saveScreen">Guardar</button></div></section>' +
      '<section class="card"><div class="card-h">🧩 Avanzado (JSON)</div><div class="muted sm">Sobrescribe la configuración a mano (para casos raros). Lo normal es usar «Familia» o «Importar».</div>' +
        '<textarea id="adv" rows="5" spellcheck="false">' + esc(JSON.stringify(store.get('advanced', {}), null, 2)) + '</textarea>' +
        '<div class="row-btns"><button class="btn" data-act="saveAdv">Guardar y recargar</button><button class="btn danger" data-act="wipe">Borrar todos los datos de este dispositivo</button></div>' +
        '<div class="muted sm">Marco familiar · todo funciona en el navegador; no hay servidor propio.</div></section>' +
      '</div>';
  }
  function readCalForm() {
    document.querySelectorAll('.cal-set').forEach((row) => {
      const i = +row.dataset.i; const c = settings.calendars[i]; if (!c) return;
      c.name = row.querySelector('.cs-name').value.trim() || 'Calendario ' + (i + 1);
      c.color = row.querySelector('.cs-color').value;
      c.url = row.querySelector('.cs-url').value.trim();
    });
  }
  function parseLines(txt, numKey) {
    return txt.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p.length >= 3 && p[1])
      .map((p, i) => ({ id: p[1].toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').slice(0, 24) || 'x' + i, emoji: p[0] || '•', name: p[1], [numKey]: Math.max(1, parseInt(p[2], 10) || 1) }));
  }
  async function settingsAction(act, el) {
    switch (act) {
      case 'saveFamily': saveFamily(); break;
      case 'exportJson': exportJson(); break;
      case 'importJson': importJson($('#impTxt').value); break;
      case 'addCal': readCalForm(); settings.calendars.push({ id: U.uid(), name: 'Calendario ' + (settings.calendars.length + 1), color: ['#E8604C', '#3BA55C', '#2F80ED', '#8E5BC8', '#F5A623'][settings.calendars.length % 5], url: '' }); saveSettings(); render(); break;
      case 'delCal': readCalForm(); settings.calendars.splice(+el.dataset.i, 1); saveSettings(); render(); break;
      case 'showUrl': { const inp = el.parentElement.querySelector('.cs-url'); inp.type = inp.type === 'password' ? 'text' : 'password'; break; }
      case 'saveCals':
        readCalForm();
        settings.calendars.forEach((c) => { if (!c.id) c.id = U.uid(); if (c.url && !/^https:\/\//i.test(c.url)) c.url = c.url.replace(/^webcal:\/\//i, 'https://'); });
        settings.proxy = $('#proxy').value.trim();
        { const want = $('#demo').checked; const def = realCalendars().length === 0; settings.demo = want === def ? null : want; }
        saveSettings(); toast('Guardado. Probando calendarios…'); await loadCalendars(); render(); toast(demoOn() ? 'Modo demo activo' : 'Calendarios actualizados'); break;
      case 'savePrices':
        settings.prices = {};
        ['punta', 'llano', 'valle'].forEach((k) => { const v = $('#p_' + k).value.trim().replace(',', '.'); settings.prices[k] = v === '' || isNaN(+v) ? null : +v; });
        saveSettings(); toast('Precios guardados'); break;
      case 'saveChores': {
        const ch = parseLines($('#choresTxt').value, 'stars'), rw = parseLines($('#rewardsTxt').value, 'cost');
        const adv = store.get('advanced', {}); if (ch.length) adv.chores = ch; if (rw.length) adv.rewards = rw;
        store.set('advanced', adv); CFG.chores = adv.chores || CFG.chores; CFG.rewards = adv.rewards || CFG.rewards; toast('Tareas y recompensas guardadas'); render(); break;
      }
      case 'resetStars': if (await requirePin('PIN para poner las estrellas a 0')) { const k = K(); k.stars = {}; k.pending = []; k.log.push(hm(now()) + ' · Estrellas a 0'); saveK(k); toast('Estrellas a 0'); } break;
      case 'savePin': {
        const v = $('#pin1').value.trim();
        if (!/^\d{4,8}$/.test(v)) { toast('El PIN debe tener de 4 a 8 cifras'); break; }
        if (store.get('pin', null) && !(await pinPad('PIN actual'))) break;
        store.set('pin', v); toast('PIN guardado'); render(); break;
      }
      case 'saveScreen': settings.nightClock = $('#night').checked; saveSettings(); toast('Guardado'); break;
      case 'fullscreen': try { await document.documentElement.requestFullscreen(); } catch (e) { toast('Este navegador no deja pantalla completa'); } break;
      case 'saveAdv':
        try { const j = JSON.parse($('#adv').value || '{}'); store.set('advanced', j); location.reload(); } catch (e) { toast('JSON no válido: ' + e.message); } break;
      case 'wipe':
        if (store.get('pin', null) && !(await pinPad('PIN para borrar todo'))) break;
        if (confirm('¿Borrar calendarios, listas, estrellas y ajustes de este dispositivo?')) { U.store.clearAll(); location.reload(); } break;
    }
  }

  /* ---------------- Modal de cita ---------------- */
  function openModal(html, noClose) {
    const m = $('#modal');
    m.innerHTML = '<div class="modal-card">' + html + (noClose ? '' : '<div class="modal-f"><button class="btn close" data-close>Cerrar</button></div>') + '</div>';
    m.classList.remove('hidden');
    m.onclick = (ev) => { if (ev.target === m || ev.target.closest('[data-close]')) closeModal(); else { const b = ev.target.closest('[data-ev]'); if (b) showEvent(b.dataset.ev); } };
  }
  function closeModal() { const m = $('#modal'); m.classList.add('hidden'); m.innerHTML = ''; m.onclick = null; }
  function showEvent(id) {
    const e = findEvent(id); if (!e) return;
    const s = e.start, en = e.end;
    let when;
    if (e.allDay) {
      const last = addDays(en, -1);
      when = sameDay(s, last) ? U.fechaLarga(s) + ' · todo el día' : 'Del ' + U.fechaLarga(s).toLowerCase() + ' al ' + U.fechaLarga(last).toLowerCase();
    } else when = U.fechaLarga(s) + ' · ' + hm(s) + '–' + (sameDay(s, en) ? '' : U.fechaCorta(en) + ' ') + hm(en);
    openModal('<div class="modal-cal" style="--c:' + esc(e.color) + '"><span class="dot"></span>' + esc(e.calName.toUpperCase()) + '</div>' +
      '<div class="modal-t">' + esc(e.title) + '</div><div class="modal-w">' + esc(when) + '</div>' +
      (e.location ? '<div class="modal-l">📍 ' + esc(e.location) + '</div>' : '') +
      (e.description ? '<div class="modal-d">' + esc(e.description).replace(/\n/g, '<br>') + '</div>' : ''));
  }
  function showDay(key) {
    const d = U.parseLocal(key);
    openModal('<div class="modal-t">' + esc(U.fechaLarga(d)) + '</div><div class="day-evs modal-list">' + eventsOn(d).map((e) => evItem(e, d)).join('') + '</div>');
  }

  /* ---------------- Navegación y eventos ---------------- */
  const SCREENS = { hoy: renderHoy, calendario: renderCalendario, luz: renderLuz, ninos: renderNinos, compra: renderCompra, ajustes: renderAjustes };
  function render() {
    document.querySelectorAll('#rail [data-go]').forEach((b) => b.classList.toggle('on', b.dataset.go === S.screen));
    document.body.dataset.screen = S.screen;
    try { (SCREENS[S.screen] || renderHoy)(); } catch (e) { console.error(e); screenEl.innerHTML = '<div class="card">Error al pintar: ' + esc(e.message) + '</div>'; }
    tickClocks();
  }
  async function go(name) {
    if (name === 'ajustes' && store.get('pin', null) && S.screen !== 'ajustes') { if (!(await pinPad('PIN de padres para Ajustes'))) return; }
    S.screen = name; S.lastTouch = Date.now(); render();
    screenEl.scrollTop = 0;
  }
  document.addEventListener('click', async (ev) => {
    S.lastTouch = Date.now();
    if (!$('#modal').classList.contains('hidden') && ev.target.closest('#modal')) return;
    const t = ev.target;
    const g = t.closest('[data-go]'); if (g) return go(g.dataset.go);
    const a = t.closest('[data-act]');
    if (a) {
      const act = a.dataset.act;
      if (act === 'refresh') return refreshAll(true);
      if (act === 'sleep') return sleep(true);
      if (act === 'clearDone') { const c = C(); c.items = c.items.filter((x) => !x.done); saveC(c); return render(); }
      if (act === 'share') {
        const txt = 'Lista de la compra:\n' + C().items.filter((x) => !x.done).map((x) => '• ' + x.name).join('\n');
        if (navigator.share) { try { await navigator.share({ text: txt }); return; } catch (e) { /* cancelado */ } }
        return openModal('<div class="modal-t">Lista para copiar</div><textarea class="share-ta" rows="8" readonly>' + esc(txt) + '</textarea>');
      }
      return settingsAction(act, a);
    }
    const e = t.closest('[data-ev]'); if (e) return showEvent(e.dataset.ev);
    const da = t.closest('[data-dayall]'); if (da) return showDay(da.dataset.dayall);
    const ch = t.closest('[data-chore]'); if (ch) return toggleChore(ch.dataset.chore, ch.dataset.kid);
    const ask = t.closest('[data-ask]');
    if (ask) { const k = K(); k.pending.push({ id: U.uid(), kid: ask.dataset.kid, reward: ask.dataset.ask, at: Date.now() }); saveK(k); toast('Pedido. Falta que lo apruebe un adulto.'); return render(); }
    const ap = t.closest('[data-approve]');
    if (ap) {
      if (!(await requirePin('PIN para aprobar el canje'))) return;
      const k = K(); const p = k.pending.find((x) => x.id === ap.dataset.approve); if (!p) return;
      const r = rewards().find((x) => x.id === p.reward); const kid = CFG.kids.find((x) => x.id === p.kid);
      if (r && (k.stars[p.kid] || 0) >= r.cost) {
        k.stars[p.kid] -= r.cost; k.log.push(hm(now()) + ' · ✅ ' + (kid ? kid.name : '') + ' canjea «' + r.name + '» (−' + r.cost + ' ⭐)'); toast('¡Canje aprobado! 🎉');
      } else toast('No le llegan las estrellas');
      k.pending = k.pending.filter((x) => x.id !== p.id); saveK(k); return render();
    }
    const rj = t.closest('[data-reject]');
    if (rj) { const k = K(); k.pending = k.pending.filter((x) => x.id !== rj.dataset.reject); saveK(k); return render(); }
    const it = t.closest('[data-item]');
    if (it) { const c = C(); const x = c.items.find((y) => y.id === it.dataset.item); if (x) x.done = !x.done; saveC(c); return render(); }
    const hb = t.closest('[data-hab]'); if (hb) return addItem(hb.dataset.hab);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  /* ---------------- Reloj, noche y refresco ---------------- */
  function tickClocks() {
    const t = now();
    document.querySelectorAll('[data-clock="big"],[data-clock="night"]').forEach((el) => { if (el.textContent !== hm(t)) el.textContent = hm(t); });
    const r = $('[data-clock="rail"]'); if (r) r.innerHTML = pad(t.getHours()) + '<br>' + pad(t.getMinutes());
    const nd = $('[data-clock="nightdate"]'); if (nd) nd.textContent = U.fechaLarga(t);
  }
  function inNightWindow(t) {
    if (!settings.nightClock) return false;
    const m = t.getHours() * 60 + t.getMinutes();
    const [fh, fm] = CFG.nightClock.from.split(':').map(Number), [th, tm] = CFG.nightClock.to.split(':').map(Number);
    const f = fh * 60 + fm, to = th * 60 + tm;
    return f > to ? (m >= f || m < to) : (m >= f && m < to);
  }
  function sleep(on) {
    S.sleeping = on; S.autoSleep = false; $('#night').classList.toggle('hidden', !on);
    if (!on) S.wakeUntil = Date.now() + 10 * 60000;
  }
  $('#night').addEventListener('click', () => sleep(false));

  let lastMinute = -1;
  function userBusy() {
    const a = document.activeElement;
    return (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) || !$('#modal').classList.contains('hidden') || S.screen === 'ajustes';
  }
  setInterval(() => {
    const t = now();
    tickClocks();
    if (t.getMinutes() !== lastMinute) {
      lastMinute = t.getMinutes();
      if (!userBusy()) render();
      // Vuelve a «Hoy» tras 3 min sin tocar
      if (S.screen !== 'hoy' && S.screen !== 'ajustes' && Date.now() - (S.lastTouch || 0) > 3 * 60000 && !userBusy()) { S.screen = 'hoy'; render(); }
      const inW = inNightWindow(t);
      if (inW && Date.now() > S.wakeUntil && !S.sleeping) { sleep(true); S.autoSleep = true; }
      if (!inW && S.sleeping && S.autoSleep) { sleep(false); S.autoSleep = false; }
      // Recarga completa a las 04:00 para coger cambios del código y limpiar memoria
      if (t.getHours() === 4 && t.getMinutes() === 0 && !U.simulated) location.reload();
    }
  }, 1000);
  setInterval(() => loadCalendars().then(() => { if (!userBusy()) render(); }).catch(() => { }), 15 * 60000);
  setInterval(() => loadWeather().then(() => { if (!userBusy()) render(); }), 30 * 60000);
  setInterval(() => loadPVPC().then(() => { if (!userBusy()) render(); }), 60 * 60000);
  window.addEventListener('online', () => refreshAll(false));

  // Arranque
  const hash = (location.hash || '').replace('#', '');
  if (SCREENS[hash] && hash !== 'ajustes') S.screen = hash;
  render();
  refreshAll(false);

  // Para pruebas automáticas
  window.Marco = { S, CFG, settings, render, go, allEvents, eventsOn, custodyEvents, demoOn, loadCalendars, showEvent };
})();
