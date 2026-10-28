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
  const settings = Object.assign({
    calendars: [], proxy: '', demo: null, prices: {}, nightClock: CFG.nightClock.enabled, eroskiNotifyEmail: '', syncUrl: '', syncKey: '', syncBg: {},
    theme: 'auto', travelText: null, outdoorText: null, aisleText: null,
    schoolIcs: '', schoolDates: null, schoolFrom: '', schoolTo: '', schoolKids: null
  }, store.get('settings', {}));
  if (!settings.syncBg || typeof settings.syncBg !== 'object') settings.syncBg = {};
  const saveSettings = () => store.set('settings', settings);
  const realCalendars = () => settings.calendars.filter((c) => c.url && c.url.trim());
  const syncReady = () => !!(String(settings.syncUrl || '').trim() && String(settings.syncKey || '').trim());
  const demoOn = () => (settings.demo === null || settings.demo === undefined) ? (realCalendars().length === 0 && !syncReady()) : !!settings.demo;
  const kidsNames = () => CFG.kids.map((k) => k.name).join(' y ');
  const custodyOn = () => !!(CFG.custody && CFG.custody.enabled !== false && CFG.custody.anchor);
  const dayStatus = (d) => custodyOn() ? Custody.dayStatus(d) : 'none';
  const tariffName = () => CFG.tariff.name || 'tu tarifa';
  const handoverDay = () => U.DIAS[U.parseLocal(CFG.custody.anchor).getDay()].toLowerCase();
  const prices = () => Object.assign({}, CFG.tariff.prices, settings.prices || {});

  const SLOTS = [
    { id: 'manana', name: 'Mañana', due: 9 * 60 + 30 },
    { id: 'cole', name: 'Después del cole', due: 19 * 60 + 30 },
    { id: 'noche', name: 'Noche', due: 21 * 60 + 30 }
  ];
  function slotId(c) {
    const s = (c && c.slot) || 'cole';
    return SLOTS.some((x) => x.id === s) ? s : 'cole';
  }
  function slotMeta(id) { return SLOTS.find((x) => x.id === id) || SLOTS[1]; }
  function slotOverdue(c, t) { return (t.getHours() * 60 + t.getMinutes()) > slotMeta(slotId(c)).due; }
  function choreKids(c) {
    if (!c.kids || !c.kids.length) return CFG.kids;
    const ks = CFG.kids.filter((k) => c.kids.indexOf(k.id) !== -1);
    return ks.length ? ks : CFG.kids;
  }
  function kidsHome(t) { return custodyOn() ? Custody.withParent(t) : true; }
  function kidsHomeOn(day) {
    if (!custodyOn()) return true;
    return Custody.withParent(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0));
  }

  function doneMap() { return store.get('hechas', {}) || {}; }
  function isDone(e) {
    const v = e && doneMap()[e.id];
    if (!v) return false;
    if (typeof v === 'object') return !!v.on;
    return true;
  }
  function toggleDone(id) {
    const map = doneMap();
    const cur = map[id];
    const on = cur && (typeof cur === 'object' ? !!cur.on : true);
    map[id] = { on: !on, rev: Sync.nextRev() };
    const cutoff = Date.now() - 90 * 86400000;
    Object.keys(map).forEach((k) => { const ts = +String(k).split('@').pop(); if (ts && ts < cutoff) delete map[k]; });
    store.set('hechas', map);
    Sync.touch();
    render();
    if (!$('#modal').classList.contains('hidden')) showEvent(id);
  }
  function seedDemoDone() {
    if (!demoOn() || store.get('hechasSeed', false)) return;
    const e = S.events.find((x) => x.title.indexOf('Compra semanal') === 0);
    if (!e) return;
    const map = doneMap();
    map[e.id] = e.start.getTime();
    store.set('hechas', map);
    store.set('hechasSeed', true);
  }

  function defaultMenu() { return JSON.parse(JSON.stringify(window.MARCO_DEFAULTS.menu)); }
  function menuState() {
    const s = store.get('menu', null);
    if (!s || typeof s !== 'object' || !s.plan) return defaultMenu();
    return {
      span: s.span === 5 ? 5 : 7,
      spanRev: s.spanRev || 0,
      dishes: Array.isArray(s.dishes) ? s.dishes.slice() : defaultMenu().dishes,
      dishMeta: Object.assign({}, s.dishMeta || {}),
      plan: JSON.parse(JSON.stringify(s.plan))
    };
  }
  function updateMenu(fn) {
    const prev = menuState();
    const m = menuState();
    fn(m);
    Sync.stampMenu(m, prev);
    store.set('menu', m);
    Sync.touch();
    render();
  }
  function weekdayIndex(day) { return (day.getDay() + 6) % 7; }
  function mealsFor(day) {
    const m = menuState();
    const idx = weekdayIndex(day);
    if (m.span === 5 && idx >= 5) return { comida: '', cena: '', off: true };
    const p = (m.plan && m.plan[String(idx)]) || {};
    return { comida: p.comida || '', cena: p.cena || '', off: false };
  }
  function assignMeal(day, meal, dish) {
    if (meal !== 'comida' && meal !== 'cena') return;
    S.menuPick = { day: String(day), meal: meal };
    updateMenu((m) => {
      m.plan[day] = Object.assign({ comida: '', cena: '' }, m.plan[day]);
      m.plan[day][meal] = dish || '';
    });
  }

  function markFresh() { store.set('cache.savedAt', Date.now()); }
  function lastDataAt() {
    const stamps = [];
    const s = store.get('cache.savedAt', 0); if (s) stamps.push(s);
    if (S.weather && S.weather.fetched) stamps.push(S.weather.fetched);
    if (S.pvpc && S.pvpc.fetched) stamps.push(S.pvpc.fetched);
    return stamps.length ? Math.max.apply(null, stamps) : 0;
  }
  function paintOffline() {
    const el = $('#offline'); if (!el) return;
    const off = typeof navigator !== 'undefined' && navigator.onLine === false;
    const down = !!(S && S.syncDown) && !off;
    document.body.classList.toggle('is-offline', off || down);
    if (!off && !down) { el.classList.add('hidden'); el.textContent = ''; return; }
    const at = lastDataAt();
    const prefix = off ? 'Sin conexión · ' : 'Sin sincronizar · ';
    const empty = off ? 'Sin conexión · sin datos guardados' : 'Sin sincronizar · sin datos guardados';
    el.textContent = at ? (prefix + 'datos de las ' + hm(new Date(at))) : empty;
    el.classList.remove('hidden');
  }

  function morningLine(t) {
    const late = t.getHours() >= 12;
    const day = late ? addDays(sod(t), 1) : sod(t);
    const label = late ? 'Lo primero de mañana' : 'Lo primero de hoy';
    const evs = eventsOn(day).filter((e) => !e.background && !e.virtual);
    const first = evs.filter((e) => !e.allDay).sort((a, b) => a.start - b.start)[0] || evs[0];
    const extra = packPhrase(day);
    if (!first) return label + ' · nada apuntado' + (extra ? ' · ' + extra : '');
    return label + ' · ' + (first.allDay ? 'todo el día' : hm(first.start)) + ' ' + first.title + (extra ? ' · ' + extra : '');
  }
  function tomorrowGlance(t) {
    const d = addDays(sod(t), 1);
    const evs = eventsOn(d).filter((e) => !e.background && !e.virtual && !isDone(e));
    const first = evs.filter((e) => !e.allDay).sort((a, b) => a.start - b.start)[0] || evs[0];
    let s = 'Mañana · ' + (first ? ((first.allDay ? 'todo el día ' : hm(first.start) + ' ') + first.title) : 'sin citas');
    const meals = mealsFor(d);
    if (meals && !meals.off && (meals.comida || meals.cena)) s += ' · ' + [meals.comida, meals.cena].filter(Boolean).join(' / ');
    const extra = packPhrase(d);
    if (extra) s += ' · ' + extra;
    return s;
  }
  function mochilaRules() {
    return (Array.isArray(CFG.backpack) && CFG.backpack.length) ? CFG.backpack : window.MARCO_DEFAULTS.backpack;
  }
  function packDay(day) {
    const evs = eventsOn(day).filter((e) => !e.background && !e.virtual);
    return Mochila.forDay(day, evs, { home: kidsHomeOn(day), rules: mochilaRules() });
  }
  function packPhrase(day) {
    const p = packDay(day);
    if (p.paused) return '';
    if (p.off) return 'día libre';
    if (!p.items.length) return '';
    return 'mochila: ' + p.items.map((i) => i.item).join(', ');
  }

  /* ---------------- Estado ---------------- */
  const S = {
    screen: 'hoy',
    events: [],
    calStatus: store.get('cache.calStatus', {}),
    calUpdated: null,
    weather: store.get('cache.weather', null),
    pvpc: store.get('cache.pvpc', null),
    schoolEvents: [],
    schoolAt: null,
    schoolError: '',
    undoItem: null,
    undoTimer: 0,
    lastTouch: Date.now(),
    sleeping: false,
    wakeUntil: 0,
    dataDown: false,
    calDown: false,
    syncDown: false,
    syncCount: 0,
    syncDataStatus: store.get('cache.syncData', null),
    syncCalStatus: store.get('cache.syncCal', null),
    salud: null,
    saludLoads: 0,
    saludDias: 7,
    avisos: { ok: true, alerts: [] },
    outfit: null
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

  function rememberSyncCal(st) {
    S.syncCalStatus = st;
    store.set('cache.syncCal', st);
    S.calDown = !!(st && st.offline);
    S.syncDown = !!(S.dataDown || S.calDown);
    paintOffline();
  }
  function cacheEvents(list) {
    store.set('cache.events', list.map((e) => Object.assign({}, e, { start: e.start.toISOString(), end: e.end.toISOString() })));
  }
  async function loadCalendars(opts) {
    const quiet = opts && opts.quiet;
    const [rs, re] = range();
    const out = [];
    if (demoOn()) {
      Cal.demoCalendars(sod(now())).forEach((c) => out.push.apply(out, Cal.parseICS(c.text, c, rs, re)));
      S.events = out; S.calUpdated = Date.now();
      seedDemoDone();
      S.calDown = false;
      S.syncDown = !!S.dataDown;
      paintOffline();
      return;
    }
    if (syncReady()) {
      try {
        const data = await Sync.fetchCalendars(rs, re);
        const events = Sync.toEvents(data, settings.syncBg || {});
        S.events = events;
        S.calUpdated = Date.now();
        store.set('cache.syncCals', data.calendars || []);
        markFresh();
        cacheEvents(events);
        const status = { google: { ok: true, n: events.length, at: Date.now() } };
        S.calStatus = status;
        store.set('cache.calStatus', status);
        rememberSyncCal({ ok: true, at: Date.now(), n: events.length, error: '', offline: false });
        return;
      } catch (e) {
        const msg = String(e.message || e);
        rememberSyncCal({ ok: false, at: Date.now(), error: msg, offline: !!(e && e.offline && !e.auth) });
        S.calStatus = Object.assign({}, S.calStatus, { google: { ok: false, error: msg, at: Date.now() } });
        store.set('cache.calStatus', S.calStatus);
        if (!quiet && e && e.auth && !S.syncAuthToasted) { toast('⚠️ ' + msg, 6000); S.syncAuthToasted = true; }
        if (!realCalendars().length) return;
      }
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
    if (!anyOk && !out.length && S.events.length) S.events.forEach((x) => out.push(x));
    S.calStatus = status; store.set('cache.calStatus', status);
    S.events = out; S.calUpdated = Date.now();
    if (anyOk) { markFresh(); cacheEvents(out); }
    const bad = Object.values(status).filter((s) => !s.ok);
    if (bad.length && !quiet) toast('⚠️ ' + bad.length + ' calendario(s) sin actualizar: ' + bad[0].error, 6000);
  }

  async function loadWeather() {
    try { S.weather = await Weather.load(CFG.lat, CFG.lon); store.set('cache.weather', S.weather); markFresh(); }
    catch (e) { console.warn(e); }
  }
  function reviveSchool(c) {
    return ((c && c.events) || []).map((ev) => ({ title: ev.title, allDay: !!ev.allDay, start: new Date(ev.start), end: new Date(ev.end) }));
  }
  function primeSchool() {
    const c = store.get('cache.school', null);
    S.schoolEvents = reviveSchool(c);
    S.schoolAt = c && c.at;
  }
  async function loadSchool() {
    const url = String(settings.schoolIcs || '').trim();
    if (!url) { S.schoolEvents = []; S.schoolAt = null; S.schoolError = ''; return; }
    const [rs, re] = range();
    try {
      const text = await Cal.fetchICS(url, (settings.proxy || '').trim());
      S.schoolEvents = Cal.parseICS(text, { name: 'Cole', color: '#2F80ED', id: 'cole' }, rs, re);
      S.schoolAt = Date.now();
      S.schoolError = '';
      store.set('cache.school', {
        at: S.schoolAt,
        events: S.schoolEvents.map((e) => ({ title: e.title, start: e.start.toISOString(), end: e.end.toISOString(), allDay: !!e.allDay }))
      });
    } catch (e) {
      const c = store.get('cache.school', null);
      S.schoolEvents = reviveSchool(c);
      S.schoolAt = c && c.at;
      S.schoolError = String(e.message || e);
    }
  }
  async function loadPVPC() {
    try { S.pvpc = await Luz.loadPVPC(sod(now())); store.set('cache.pvpc', S.pvpc); markFresh(); }
    catch (e) { console.warn(e); }
  }
  function primeSalud() {
    if (!syncReady()) { S.salud = Salud.demo(now()); return; }
    const cached = store.get('cache.salud', null);
    S.salud = (cached && cached.ok && !cached.demo) ? cached : { ok: false, empty: true };
  }
  async function loadSalud() {
    S.saludLoads = (S.saludLoads || 0) + 1;
    if (!syncReady()) { S.salud = Salud.demo(now()); return S.salud; }
    const cached = store.get('cache.salud', null);
    if (cached && cached.ok && !cached.demo) S.salud = cached;
    try {
      const data = await Sync.fetchSalud();
      if (!data || data.ok === false) throw new Error('Sin datos de Garmin');
      data.demo = false;
      S.salud = data;
      store.set('cache.salud', data);
      return data;
    } catch (e) {
      if (S.salud && S.salud.ok && !S.salud.demo) {
        S.salud = Object.assign({}, S.salud, { stale: true });
        store.set('cache.salud', S.salud);
        return S.salud;
      }
      S.salud = { ok: false, empty: true };
      return S.salud;
    }
  }
  function avisoMuestraOn() {
    try { return new URLSearchParams(location.search).get('aviso') === 'muestra'; }
    catch (e) { return false; }
  }
  function primeAvisos() {
    if (avisoMuestraOn()) { S.avisos = Mochila.avisoMuestra(); return; }
    const c = store.get('cache.avisos', null);
    const fresh = c && c.fetched && (Date.now() - new Date(c.fetched).getTime() < 3 * 3600000);
    S.avisos = (fresh && c.ok !== false && !c.sample) ? c : { ok: true, alerts: [] };
  }
  async function loadAvisos() {
    if (avisoMuestraOn()) { S.avisos = Mochila.avisoMuestra(); return S.avisos; }
    if (!syncReady()) return S.avisos;
    try {
      const data = await Sync.fetchAvisos();
      if (!data || data.ok === false) throw new Error('avisos');
      const norm = Mochila.normAvisos(data);
      norm.ok = true;
      norm.sample = false;
      norm.fetched = data.fetched || new Date().toISOString();
      S.avisos = norm;
      store.set('cache.avisos', norm);
      return norm;
    } catch (e) {
      S.avisos = { ok: false, alerts: [] };
      return S.avisos;
    }
  }
  function primeOutfit() {
    if (!syncReady()) { S.outfit = Outfit.demo(now()); return; }
    const n = Outfit.normalize(store.get('cache.outfit', null));
    S.outfit = n && !n.demo ? n : null;
  }
  function applyOutfitPayload(raw) {
    const n = Outfit.normalize(raw);
    if (!n || n.demo) {
      S.outfit = null;
      store.del('cache.outfit');
      return null;
    }
    n.demo = false;
    n.stale = false;
    S.outfit = n;
    store.set('cache.outfit', n);
    return n;
  }
  async function loadOutfit() {
    if (!syncReady()) { S.outfit = Outfit.demo(now()); return S.outfit; }
    try {
      const data = await Sync.fetchOutfit();
      if (!data || data.ok === false) throw new Error((data && data.error) || 'outfit');
      return applyOutfitPayload(data.outfit || null);
    } catch (e) {
      const c = Outfit.normalize(store.get('cache.outfit', null));
      if (c && !c.demo) { c.stale = true; S.outfit = c; return c; }
      S.outfit = null;
      return null;
    }
  }
  function showAviso(i) {
    const data = Mochila.normAvisos(S.avisos || {});
    const a = data.alerts[i];
    if (!a) return;
    const nombre = a.level === 'rojo' ? 'Aviso rojo' : 'Aviso naranja';
    let hasta = '';
    if (a.until) {
      const d = new Date(a.until);
      if (!isNaN(d.getTime())) hasta = 'hasta el ' + U.fechaCorta(d) + ' a las ' + hm(d);
    }
    const where = [a.area || 'Álava / Vitoria-Gasteiz', hasta].filter(Boolean).join(' · ');
    openModal('<div class="modal-h">' + esc(nombre) + (a.event ? ' · ' + esc(a.event) : '') + '</div>' +
      '<div class="modal-w">' + esc(where) + '</div>' +
      (a.headline ? '<div class="modal-t" style="font-size:1.2rem">' + esc(a.headline) + '</div>' : '') +
      '<div class="modal-d">' + esc(a.text || a.headline || 'Sin texto') + '</div>' +
      (data.sample ? '<div class="tag ej">EJEMPLO · no es un aviso real</div>' : '<div class="muted sm">Aviso oficial de AEMET</div>'));
  }
  function showPack(btn) {
    const item = btn.getAttribute('data-pack') || 'Mochila';
    const why = btn.getAttribute('data-pack-why') || '';
    openModal('<div class="modal-h">🎒 ' + esc(item) + '</div><div class="modal-d">' + esc(why || 'Sale de las citas de ese día.') + '</div>');
  }
  async function refreshAll(manual) {
    if (manual) toast('Actualizando…', 1500);
    await Promise.all([loadCalendars().catch((e) => console.warn(e)), loadWeather(), loadPVPC(), loadSchool().catch((e) => console.warn(e)), Sync.syncNow().catch((e) => console.warn(e)), loadSalud().catch((e) => console.warn(e)), loadAvisos().catch((e) => console.warn(e)), loadOutfit().catch((e) => console.warn(e))]);
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
      .sort((x, y) => (Number(!!x.background) - Number(!!y.background)) || (y.allDay - x.allDay) || (x.start - y.start) || x.title.localeCompare(y.title));
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
    const cls = ['ev'];
    if (e.virtual) cls.push('ev-virtual');
    if (e.background) cls.push('ev-bg');
    if (!e.allDay && e.end < now()) cls.push('ev-past');
    if (isDone(e)) cls.push('ev-done');
    if (compact) cls.push('compact');
    return '<button class="' + cls.join(' ') + '" data-ev="' + esc(e.id) + '" style="--c:' + esc(e.color) + '">' +
      '<span class="ev-t">' + esc(evTime(e, day)) + '</span><span class="ev-n">' + esc(e.title) + '</span></button>';
  }
  function demoPill() { return demoOn() ? '<div class="demo-pill" title="Datos inventados. Configura tus calendarios en Ajustes">MODO DEMO · citas inventadas</div>' : ''; }

  function custodyBadge(t) {
    if (!custodyOn()) return '';
    const w = Custody.withParent(t);
    const nh = Custody.nextHandover(t);
    let txt = w ? 'Esta semana en casa' : 'Semana sin niños';
    if (nh) {
      const dia = U.DIAS[nh.at.getDay()].toLowerCase();
      const hora = hm(nh.at);
      if (w) {
        const days = Math.max(0, U.dayDiff(sod(t), sod(nh.at)));
        const n = days === 0 ? 'hoy' : (days === 1 ? '1 día' : days + ' días');
        txt = 'Cambio el ' + dia + ' ' + hora + ' · ' + n;
      } else {
        txt = 'Vuelven el ' + dia + ' ' + nh.at.getDate() + '/' + pad(nh.at.getMonth() + 1) + ' ' + hora;
      }
    }
    return '<div class="custody-badge ' + (w ? 'is-parent' : 'is-other') + '" data-custody="' + (w ? 'padre' : 'otro') + '">' +
      '<span class="cb-ic">' + (w ? '🏠' : '🚗') + '</span><span><b>' + esc(kidsNames()) + '</b> · ' + esc(txt) + '</span></div>';
  }

  function travelRules() {
    if (typeof settings.travelText === 'string') return Casa.parseTravel(settings.travelText, CFG.travel || []);
    return CFG.travel || [];
  }
  function outdoorPattern() {
    if (typeof settings.outdoorText === 'string' && settings.outdoorText.trim()) return settings.outdoorText.trim();
    return CFG.outdoor || 'cole';
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
      return '<button type="button" class="card outfit-hoy" data-go="outfit" data-outfit="empty">' +
        '<div class="outfit-hoy-k">Outfit de mañana</div>' +
        '<div class="outfit-hoy-empty">Aún no hay propuesta. Outfit la deja sobre las 21:00.</div></button>';
    }
    const when = outfitDateLabel(o);
    const pieces = (o.pieces || []).map((p) => p.id + ' ' + p.name).join(' · ');
    return '<button type="button" class="card outfit-hoy" data-go="outfit" data-outfit="' + (o.demo ? 'demo' : 'live') + '">' +
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
  function mochilaSumHtml(t) {
    const hoy = packDay(sod(t));
    const man = packDay(addDays(sod(t), 1));
    if (hoy.paused && man.paused) return '<div class="sum-sub">Mochila en pausa esta semana</div>';
    function bit(label, p) {
      if (p.paused) return '';
      if (p.off) return esc(label) + ' día libre';
      if (!p.items.length) return '';
      return esc(label) + ' ' + p.items.map((i) => esc((i.emoji ? i.emoji + ' ' : '') + i.item)).join(', ');
    }
    const s = [bit('Hoy', hoy), bit('Mañana', man)].filter(Boolean).join(' · ');
    return s ? '<div class="sum-sub">' + s + '</div>' : '';
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
          return '<div class="wx-day"><div class="wx-dn">' + U.DIAS_C[dd.getDay()] + '</div><div class="wx-di">' + Weather.icon(d.code) + '</div><div class="wx-dmax">' + Math.round(d.max) + '°</div><div class="wx-dmin">' + Math.round(d.min) + '°</div><div class="wx-drain' + (d.rain >= 40 ? ' hi' : '') + '">💧 ' + (d.rain ?? '–') + ' %</div></div>';
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
      const kids = st === 'padre' ? '<div class="kids-chip">🏠 Con ' + esc(kidsNames()) + '</div>' : '';
      week += '<div class="day c-' + st + (i === 0 ? ' is-today' : '') + '">' +
        '<div class="day-h"><span class="day-n">' + (i === 0 ? 'Hoy' : U.DIAS_C[d.getDay()]) + '</span><span class="day-d">' + d.getDate() + '</span></div>' +
        (sh ? '<div class="shift">💼 ' + esc(sh.from + '–' + sh.to) + '</div>' : '<div class="shift off">Libre</div>') +
        (fest ? '<div class="day-tag" title="' + esc(fest.name) + '">' + esc(fest.label) + '</div>' : '') + kids +
        '<div class="day-evs">' + mainEv.concat(bgEv).map((e) => evItem(e, d)).join('') + (mainEv.length ? '' : '<div class="no-ev">—</div>') + '</div></div>';
    }

    // Resúmenes
    const ninos = choresSummary();
    const compra = (store.get('compra', { items: [] }).items || []).filter((x) => !x.done && !x.deleted);
    const p = Luz.period(t);
    const nw = Luz.nextWindow(t, 'valle');

    screenEl.innerHTML = demoPill() + '<div class="hoy">' +
      '<section class="sky ' + sky.cls + (sky.dark ? ' dark' : '') + '">' +
        '<div class="sky-left"><div class="big-clock" data-clock="big">' + hm(t) + '</div><div class="sky-date"><b>' + U.DIAS[t.getDay()] + '</b> ' + t.getDate() + ' de ' + U.MESES[t.getMonth()] + '</div>' + custodyBadge(t) + coleHtml(t) + freshHtml() + '</div>' +
        '<div class="sky-wx">' + wx + '</div></section>' +
      outfitHoyHtml() +
      renderHoyMenu(t) +
      '<section class="next card">' + nextHtml + '</section>' +
      '<section class="week">' + week + '</section>' +
      '<section class="sums">' +
        '<button class="card sum" data-go="ninos"><div class="sum-h c-orange">⭐ NIÑOS</div><div class="sum-big">' + (ninos.paused ? 'En pausa esta semana' : (ninos.pending + (ninos.pending === 1 ? ' tarea por hacer' : ' tareas por hacer') + (ninos.overdue ? ' · fuera de hora' : ''))) + '</div><div class="sum-chips">' + ninos.chips + '</div>' + mochilaSumHtml(t) + '</button>' +
        '<button class="card sum" data-go="compra"><div class="sum-h c-green">🛒 COMPRA</div><div class="sum-big">' + compra.length + (compra.length === 1 ? ' cosa' : ' cosas') + '</div><div class="sum-sub">' + esc(compra.slice(0, 5).map((x) => x.name).join(' · ') || 'Lista vacía') + '</div></button>' +
        '<button class="card sum" data-go="luz"><div class="sum-h c-amber">⚡ LUZ · 2.0TD</div><div class="sum-big"><span class="per-dot" style="--c:' + Luz.COLOR[p] + '"></span>Ahora ' + Luz.NOMBRE[p].toLowerCase() + '</div><div class="sum-sub">' + (p === 'valle' ? 'Buen momento para lavadora y lavavajillas' : nw ? 'Valle ' + whenTxt(nw.start, t) : '') + '</div></button>' +
        saludMini() +
      '</section></div>';
  }

  function renderHoyMenu(t) {
    const m = menuState();
    const letters = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const nDays = m.span === 5 ? 5 : 7;
    const todayIdx = weekdayIndex(t);
    let rows = '';
    for (let i = 0; i < nDays; i++) {
      const p = (m.plan && m.plan[String(i)]) || {};
      rows += '<button type="button" class="hoy-md' + (i === todayIdx ? ' is-today' : '') + '" data-go="menu">' +
        '<span class="hoy-md-n">' + letters[i] + '</span>' +
        '<span class="hoy-md-meal"><span class="k">Comida</span> <b>' + esc(p.comida || '—') + '</b></span>' +
        '<span class="hoy-md-meal"><span class="k">Cena</span> <b>' + esc(p.cena || '—') + '</b></span></button>';
    }
    return '<section class="hoy-menu card" aria-label="Menú semanal"><div class="card-h">🍲 Menú semanal</div><div class="hoy-mds">' + rows + '</div></section>';
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
        const mainEv = items.filter((e) => !e.background);
        const bgEv = items.filter((e) => e.background);
        const sh = shiftOn(d);
        const festTag = U.festivoEtiqueta(d);
        const wx = wxBy[dayKey(d)];
        const first = d.getDate() === 1;
        const max = 4;
        html += '<div class="cell c-' + st + (sameDay(d, today) ? ' is-today' : '') + (d < today ? ' is-past' : '') + (first ? ' is-first' : '') + '" data-day="' + dayKey(d) + '">' +
          '<div class="cell-h"><span class="cell-n">' + (sameDay(d, today) ? 'Hoy' : U.DIAS_C[d.getDay()]) + (first ? ' · ' + U.MESES_C[d.getMonth()] : '') + '</span><span class="cell-d">' + d.getDate() + '</span></div>' +
          (wx ? '<div class="cell-wx">' + Weather.icon(wx.code) + ' ' + Math.round(wx.max) + '°/' + Math.round(wx.min) + '° <span class="' + (wx.rain >= 40 ? 'hi' : '') + '">💧' + (wx.rain ?? '–') + '%</span></div>' : '') +
          (sh ? '<div class="shift sm">💼 ' + esc(sh.from + '–' + sh.to) + '</div>' : '') +
          (festTag ? '<div class="day-tag" title="' + esc(festTag.name) + '">' + esc(festTag.label) + '</div>' : '') +
          '<div class="cell-evs">' + mainEv.slice(0, max).map((e) => evItem(e, d, true)).join('') +
          (mainEv.length > max ? '<button class="more" data-dayall="' + dayKey(d) + '">+' + (mainEv.length - max) + ' más</button>' : '') +
          bgEv.slice(0, 2).map((e) => evItem(e, d, true)).join('') + '</div></div>';
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
  const saveK = (k) => { store.set('ninos', k); Sync.touch(); };
  const chores = () => CFG.chores;
  const rewards = () => CFG.rewards;

  function dayComplete(k, day) {
    if (!kidsHomeOn(day)) return false;
    const done = (k.done || {})[dayKey(day)] || {};
    const list = chores();
    if (!list.length) return false;
    return list.every((c) => choreKids(c).every((kid) => (done[c.id] || []).indexOf(kid.id) !== -1));
  }
  function streakCount(k, t) {
    let n = 0;
    let d = sod(t);
    if (!dayComplete(k, d)) d = addDays(d, -1);
    for (let i = 0; i < 42; i++) {
      const day = addDays(d, -i);
      if (!kidsHomeOn(day)) continue;
      if (dayComplete(k, day)) n++;
      else break;
    }
    return n;
  }
  function weekStripFor(t, doneFn) {
    const mon = mondayOf(t);
    const letters = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    let html = '';
    for (let i = 0; i < 7; i++) {
      const d = addDays(mon, i);
      let cls = 'future';
      if (sameDay(d, t)) cls = doneFn(d) ? 'ok' : 'today';
      else if (sod(d) < sod(t)) cls = !kidsHomeOn(d) ? 'paused' : doneFn(d) ? 'ok' : 'miss';
      html += '<span class="st-day ' + cls + '">' + letters[i] + '</span>';
    }
    return html;
  }
  function weekStrip(k, t) { return weekStripFor(t, (d) => dayComplete(k, d)); }
  function kidChores(kid) { return chores().filter((c) => choreKids(c).some((x) => x.id === kid.id)); }
  function kidDayComplete(k, kid, day) {
    if (!kidsHomeOn(day)) return false;
    const done = (k.done || {})[dayKey(day)] || {};
    const list = kidChores(kid);
    if (!list.length) return false;
    return list.every((c) => (done[c.id] || []).indexOf(kid.id) !== -1);
  }
  function kidTodayStats(k, kid, t) {
    const done = (k.done || {})[dayKey(t)] || {};
    const list = kidChores(kid);
    let ok = 0;
    list.forEach((c) => { if ((done[c.id] || []).indexOf(kid.id) !== -1) ok++; });
    return { ok: ok, total: list.length };
  }
  function kidStreak(k, kid, t) {
    let n = 0;
    let d = sod(t);
    if (!kidDayComplete(k, kid, d)) d = addDays(d, -1);
    for (let i = 0; i < 42; i++) {
      const day = addDays(d, -i);
      if (!kidsHomeOn(day)) continue;
      if (kidDayComplete(k, kid, day)) n++;
      else break;
    }
    return n;
  }
  function ringSvg(pct, color) {
    const circ = 94.2;
    const p = Math.max(0, Math.min(1, pct || 0));
    const dash = (p * circ).toFixed(1) + ' ' + circ.toFixed(1);
    return '<svg class="ring" viewBox="0 0 36 36" aria-hidden="true"><circle class="ring-bg" cx="18" cy="18" r="15"></circle><circle class="ring-fg" cx="18" cy="18" r="15" style="stroke:' + esc(color) + ';stroke-dasharray:' + dash + '"></circle></svg>';
  }
  function kidRingsHtml(k, t) {
    const paused = !kidsHome(t);
    return '<div class="kid-rings">' + CFG.kids.map((kid) => {
      const stats = kidTodayStats(k, kid, t);
      const pct = stats.total ? stats.ok / stats.total : 0;
      const streak = kidStreak(k, kid, t);
      const label = paused ? 'pausa' : (stats.ok + '/' + stats.total);
      return '<div class="kid-ring" style="--c:' + esc(kid.color) + '" data-kid-ring="' + esc(kid.id) + '">' +
        ringSvg(paused ? 0 : pct, kid.color) +
        '<div class="kr-txt"><div class="kr-n">' + esc(kid.name) + ' · ' + esc(label) + '</div>' +
        '<div class="kr-s">Racha ' + streak + (streak === 1 ? ' día' : ' días') + '</div>' +
        '<span class="streak-days">' + weekStripFor(t, (d) => kidDayComplete(k, kid, d)) + '</span></div></div>';
    }).join('') + '</div>';
  }
  function choresSummary() {
    const k = K(); const t = now(); const today = dayKey(t);
    const done = k.done[today] || {};
    const paused = !kidsHome(t);
    let pending = 0, overdue = 0;
    if (!paused) {
      chores().forEach((c) => choreKids(c).forEach((kid) => {
        if ((done[c.id] || []).indexOf(kid.id) === -1) { pending++; if (slotOverdue(c, t)) overdue++; }
      }));
    }
    const chips = CFG.kids.map((kid) => '<span class="kid-chip" style="--c:' + kid.color + '">' + esc(kid.name) + ' ⭐ ' + (k.stars[kid.id] || 0) + '</span>').join('');
    return { pending, overdue, paused, chips, streak: streakCount(k, t) };
  }

  function renderNinos() {
    const t = now();
    const k = K(); const today = dayKey(t);
    const done = k.done[today] || {};
    const paused = !kidsHome(t);
    const w = custodyOn() ? Custody.withParent(t) : null;
    const chips = CFG.kids.map((kid) => '<span class="kid-chip lg" style="--c:' + kid.color + '"><span class="av">' + esc(kid.name[0]) + '</span>' + esc(kid.name) + ' ⭐ ' + (k.stars[kid.id] || 0) + '</span>').join('');
    const streak = streakCount(k, t);
    const strip = '<div class="streak"><span class="streak-n">Racha · ' + streak + (streak === 1 ? ' día' : ' días') + '</span><span class="streak-days">' + weekStrip(k, t) + '</span></div>' + kidRingsHtml(k, t);
    const rows = SLOTS.map((slot) => {
      const list = chores().filter((c) => slotId(c) === slot.id);
      if (!list.length) return '';
      const late = !paused && list.some((c) => slotOverdue(c, t) && choreKids(c).some((kid) => (done[c.id] || []).indexOf(kid.id) === -1));
      return '<div class="slot-h">' + esc(slot.name) + (late ? '<span class="od-tag">fuera de hora</span>' : '') + '</div>' + list.map((c) => {
        const od = !paused && slotOverdue(c, t) && choreKids(c).some((kid) => (done[c.id] || []).indexOf(kid.id) === -1);
        return '<div class="chore' + (od ? ' overdue' : '') + (paused ? ' is-paused' : '') + '"><div class="ch-ic">' + esc(c.emoji) + '</div><div class="ch-n">' + esc(c.name) + '<div class="ch-s">+' + c.stars + ' ⭐' + (od ? ' · fuera de hora' : '') + '</div></div><div class="ch-kids">' +
          choreKids(c).map((kid) => { const on = (done[c.id] || []).includes(kid.id); return '<button class="kid-btn' + (on ? ' on' : '') + '" style="--c:' + kid.color + '" data-chore="' + esc(c.id) + '" data-kid="' + esc(kid.id) + '"' + (paused ? ' disabled' : '') + '>' + (on ? '✓ ' : '') + esc(kid.name) + '</button>'; }).join('') + '</div></div>';
      }).join('');
    }).join('');
    const pause = paused ? '<div class="pause-banner">Tareas en pausa · esta semana están con ' + esc(CFG.otherParent) + '. Se reanudan solas al volver.</div>' : '';
    const rws = rewards().map((r) => '<div class="reward"><div class="rw-h"><span class="rw-ic">' + esc(r.emoji) + '</span><span class="rw-n">' + esc(r.name) + '</span><span class="rw-c">' + r.cost + ' ⭐</span></div><div class="rw-kids">' +
      CFG.kids.map((kid) => {
        const s = k.stars[kid.id] || 0; const pct = Math.min(100, s / r.cost * 100);
        const asked = (k.pending || []).some((p) => !p.deleted && p.kid === kid.id && p.reward === r.id);
        return '<div class="rw-kid" style="--c:' + kid.color + '"><span class="av sm">' + esc(kid.name[0]) + '</span><div class="prog"><div style="width:' + pct + '%"></div></div>' +
          (asked ? '<span class="rw-st">Pedido</span>' : s >= r.cost ? '<button class="btn sm" data-ask="' + esc(r.id) + '" data-kid="' + esc(kid.id) + '">Canjear</button>' : '<span class="rw-st">faltan ' + (r.cost - s) + '</span>') + '</div>';
      }).join('') + '</div></div>').join('');
    const livePending = (k.pending || []).filter((p) => !p.deleted);
    const pend = livePending.map((p) => {
      const kid = CFG.kids.find((x) => x.id === p.kid) || { name: p.kid }; const r = rewards().find((x) => x.id === p.reward) || { name: p.reward, cost: 0, emoji: '🎁' };
      return '<div class="pend"><span>' + esc(r.emoji + ' ' + kid.name + ': ' + r.name) + ' (' + r.cost + ' ⭐)</span><span><button class="btn sm ok" data-approve="' + esc(p.id) + '">Aprobar 🔒</button> <button class="btn sm ghost" data-reject="' + esc(p.id) + '">No</button></span></div>';
    }).join('');
    const log = (k.log || []).slice(-6).reverse().map((l) => '<div class="log">' + esc(typeof l === 'string' ? l : (l.text || '')) + '</div>').join('');
    screenEl.innerHTML = '<div class="ninos">' +
      mochilaBlock(t) +
      '<section class="card"><div class="card-h">⭐ Tareas de hoy <span class="muted sm">' + (w === null ? '' : w ? 'Semana con ' + esc(CFG.parent) : 'Esta semana están con ' + esc(CFG.otherParent)) + '</span></div><div class="kid-chips">' + chips + '</div>' + strip + pause + rows +
        '<div class="muted sm">Cada uno toca su nombre al terminar. Volver a tocar lo deshace. Mañana, después del cole y noche. En la semana sin niños se pausan solas.</div></section>' +
      '<section class="col"><div class="card"><div class="card-h">🎁 Recompensas</div>' + rws + '</div>' +
        '<div class="card"><div class="card-h">🔒 Pendiente de aprobar <span class="count">' + livePending.length + '</span></div>' + (pend || '<div class="muted">Nada pendiente.</div>') +
        (log ? '<div class="card-h sub">Últimos movimientos</div>' + log : '') + '</div></section></div>';
  }

  function toggleChore(choreId, kidId) {
    if (!kidsHome(now())) { toast('Tareas en pausa: esta semana no están en casa'); return; }
    const k = K(); const today = dayKey(now());
    const c = chores().find((x) => x.id === choreId); const kid = choreKids(c || {}).find((x) => x.id === kidId);
    if (!c || !kid) return;
    k.done[today] = k.done[today] || {};
    const arr = k.done[today][choreId] = k.done[today][choreId] || [];
    const i = arr.indexOf(kidId);
    const off = i >= 0;
    if (off) arr.splice(i, 1); else arr.push(kidId);
    Sync.noteDone(k, today, choreId, kidId, !off);
    Sync.noteStar(k, kidId, off ? -c.stars : c.stars);
    Sync.noteLog(k, hm(now()) + ' · ' + kid.name + (off ? ' deshace «' : ' hizo «') + c.name + '» (' + (off ? '−' : '+') + c.stars + ' ⭐)');
    Object.keys(k.done).sort().slice(0, -45).forEach((d) => delete k.done[d]);
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
  const saveC = (c) => { store.set('compra', c); Sync.touch(); };
  const compraViva = (c) => (c.items || []).filter((x) => !x.deleted);
  function addItem(name) {
    name = (name || '').trim().replace(/\s+/g, ' ');
    if (!name) return;
    name = name[0].toUpperCase() + name.slice(1);
    const c = C();
    const rev = Sync.nextRev();
    const ex = (c.items || []).find((x) => !x.deleted && x.name.toLowerCase() === name.toLowerCase());
    const tomb = (c.items || []).find((x) => x.deleted && x.name.toLowerCase() === name.toLowerCase());
    if (ex) { ex.done = false; ex.rev = rev; }
    else if (tomb) { tomb.deleted = false; tomb.done = false; tomb.rev = rev; tomb.at = Date.now(); }
    else c.items.push({ id: U.uid(), name, done: false, deleted: false, at: Date.now(), rev: rev });
    c.counts[name] = (c.counts[name] || 0) + 1;
    saveC(c); render();
  }
  function habituales(c) {
    const onList = new Set(compraViva(c).filter((x) => !x.done).map((x) => x.name.toLowerCase()));
    const fromCounts = Object.entries(c.counts).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    const all = fromCounts.concat(CFG.habitualesBase);
    const seen = new Set(); const out = [];
    all.forEach((n) => { const l = n.toLowerCase(); if (!onList.has(l) && !seen.has(l)) { seen.add(l); out.push(n); } });
    return out.slice(0, 9);
  }
  function listaPendienteTexto() {
    const names = compraViva(C()).filter((x) => !x.done).map((x) => x.name);
    return { names: names, text: 'Lista de la compra:\n' + names.map((n) => '• ' + n).join('\n') };
  }
  function mailtoCesta(text) {
    const to = String(settings.eroskiNotifyEmail || '').trim();
    const addr = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) ? to : '';
    return 'mailto:' + addr + '?subject=' + encodeURIComponent('Haz la cesta') + '&body=' + encodeURIComponent(text);
  }
  function abrirMailto(href) {
    // Iframe: abre el correo sin navegar esta página (un <a> la deja en blanco al cancelar).
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;border:0;opacity:0';
    frame.src = href;
    document.body.appendChild(frame);
    setTimeout(() => { if (frame.parentNode) frame.remove(); }, 2000);
  }
  async function copiarTexto(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* WebView del marco o sin permiso */ }
    let ta = null;
    try {
      ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { ta.setSelectionRange(0, text.length); } catch (e2) { /* algunos WebView */ }
      return !!document.execCommand('copy');
    } catch (e) { return false; }
    finally { if (ta && ta.parentNode) ta.remove(); }
  }
  async function hazLaCesta() {
    const lista = listaPendienteTexto();
    if (!lista.names.length) { toast('No hay nada pendiente en la lista'); return; }
    const copied = await copiarTexto(lista.text);
    const href = mailtoCesta(lista.text);
    const avisar = () => toast('Lista lista para Grok Bot', 12000);
    let salio = false;
    const limpiar = () => {
      window.removeEventListener('blur', alSalir);
      window.removeEventListener('focus', alVolver);
      document.removeEventListener('visibilitychange', alVolver);
      clearTimeout(fin);
    };
    const alSalir = () => { salio = true; };
    const alVolver = () => {
      if (document.hidden) { salio = true; return; }
      if (!salio) return;
      limpiar();
      avisar();
    };
    const fin = setTimeout(limpiar, 120000);
    window.addEventListener('blur', alSalir);
    window.addEventListener('focus', alVolver);
    document.addEventListener('visibilitychange', alVolver);
    // El aviso va antes que el correo: el diálogo del sistema tapa la página.
    avisar();
    if (!copied) {
      openModal('<div class="modal-t">Lista lista para Grok Bot</div><div class="muted sm">No se pudo copiar sola. Selecciónala aquí. El correo se abre con la misma lista (el destinatario se pone en Ajustes).</div><textarea class="share-ta" rows="8" readonly>' + esc(lista.text) + '</textarea>');
    }
    setTimeout(() => abrirMailto(href), 400);
  }
  function clearUndo() {
    if (S.undoTimer) clearTimeout(S.undoTimer);
    S.undoTimer = 0;
    S.undoItem = null;
    const bar = $('#undo');
    if (bar) bar.classList.add('hidden');
  }
  function offerUndo(item) {
    if (S.undoTimer) clearTimeout(S.undoTimer);
    S.undoItem = { id: item.id, name: item.name };
    const bar = $('#undo');
    if (!bar) return;
    const name = bar.querySelector('[data-undo-name]');
    if (name) name.textContent = item.name;
    bar.classList.remove('hidden');
    S.undoTimer = setTimeout(clearUndo, 1200);
  }
  function undoCompra() {
    if (!S.undoItem) return;
    const id = S.undoItem.id;
    const c = C();
    const x = (c.items || []).find((y) => y.id === id);
    if (x && x.done && !x.deleted) { x.done = false; x.rev = Sync.nextRev(); saveC(c); }
    clearUndo();
    render();
  }
  function toggleItem(id) {
    const c = C();
    const x = (c.items || []).find((y) => y.id === id);
    if (!x || x.deleted) return;
    x.done = !x.done;
    x.rev = Sync.nextRev();
    saveC(c);
    if (x.done) offerUndo(x); else clearUndo();
    render();
  }
  function renderCompra() {
    const c = C();
    const items = compraViva(c);
    const pending = items.filter((x) => !x.done);
    const groups = Casa.groupByAisle(items, aisleRules());
    const itemBtn = (x) => '<button class="item' + (x.done ? ' done' : '') + '" data-item="' + esc(x.id) + '"><span class="box">' + (x.done ? '✓' : '') + '</span>' + esc(x.name) + '</button>';
    const itemsHtml = groups.length
      ? groups.map((g) => '<div class="aisle"><div class="aisle-h">' + esc(g.name) + '</div>' + g.items.map(itemBtn).join('') + '</div>').join('')
      : '<div class="muted">La lista está vacía.</div>';
    screenEl.innerHTML = '<div class="compra">' +
      '<section class="card"><div class="card-h">🛒 Lista de la compra <span class="count">' + pending.length + '</span></div>' +
        '<form class="add" id="addForm" autocomplete="off"><input id="addInput" placeholder="Añadir… (p. ej. leche)" maxlength="60" enterkeyhint="done"><button class="btn" type="submit">Añadir</button></form>' +
        '<div class="items">' + itemsHtml + '</div>' +
        '<div class="row-btns"><button class="btn ghost" data-act="clearDone">Quitar comprados</button><button class="btn ghost" data-act="share">Compartir lista</button><button class="btn" data-act="hazCesta">Haz la cesta</button></div>' +
        '<div class="muted sm">Pasillos de ejemplo, al estilo Eroski. El orden se cambia en Ajustes. Al tachar, un segundo para deshacer.</div></section>' +
      '<section class="card"><div class="card-h sub">HABITUALES · TOCA PARA AÑADIR</div><div class="habs">' +
        habituales(c).map((n) => '<button class="hab" data-hab="' + esc(n) + '"><b>' + esc(n) + '</b><span>+ Añadir</span></button>').join('') + '</div>' +
        '<div class="muted sm">La lista se guarda en este dispositivo y, si activas la sincronización, también en los demás. «Compartir lista» la pasa al móvil. «Haz la cesta» la copia y abre un correo para Grok Bot (el de Ajustes). El marco no entra en la tienda.</div></section></div>';
    const f = $('#addForm');
    f.onsubmit = (ev) => { ev.preventDefault(); const v = $('#addInput').value; addItem(v); setTimeout(() => { const i = $('#addInput'); if (i) i.focus(); }, 0); };
  }

  /* ---------------- MENÚ SEMANAL ---------------- */
  const DAY_LETTERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  function renderMenu() {
    const m = menuState();
    const t = now();
    const todayIdx = weekdayIndex(t);
    const nDays = m.span === 5 ? 5 : 7;
    const pick = S.menuPick || {};
    const days = [];
    for (let i = 0; i < nDays; i++) {
      const p = (m.plan && m.plan[String(i)]) || {};
      const slot = (meal, label) => {
        const on = pick.day === String(i) && pick.meal === meal;
        const val = p[meal] || '';
        return '<div class="menu-slot' + (on ? ' on' : '') + '" data-slot data-day="' + i + '" data-meal="' + meal + '">' +
          '<div class="ms-k">' + label + '</div><div class="ms-v">' + esc(val || '—') + '</div>' +
          (val ? '<button class="ms-x" data-clear-slot aria-label="Vaciar">×</button>' : '') + '</div>';
      };
      days.push('<div class="menu-day' + (i === todayIdx ? ' is-today' : '') + '"><div class="md-n">' + DAY_LETTERS[i] + '</div>' + slot('comida', 'COMIDA') + slot('cena', 'CENA') + '</div>');
    }
    const dishes = (m.dishes || []).map((n) => '<span class="dish-wrap"><button class="dish" draggable="true" data-dish="' + esc(n) + '">' + esc(n) + '</button><button class="dish-x" data-del-dish="' + esc(n) + '" aria-label="Quitar ' + esc(n) + '">×</button></span>').join('');
    screenEl.innerHTML = '<div class="menu">' +
      '<section class="card"><div class="menu-top"><div class="card-h" style="border:0;margin:0;padding:0">🍲 Menú de la semana</div><div class="span-toggle">' +
        '<button class="btn sm' + (m.span === 7 ? '' : ' ghost') + '" data-act="menuSpan" data-span="7">L–D</button>' +
        '<button class="btn sm' + (m.span === 5 ? '' : ' ghost') + '" data-act="menuSpan" data-span="5">L–V</button></div></div>' +
      '<div class="muted sm">Primero la casilla, luego el plato. También se puede arrastrar. Se guarda en este dispositivo y, si activas la sincronización, también en los demás.</div>' +
      days.join('') + '</section>' +
      '<section class="card"><div class="card-h sub">PLATOS HABITUALES</div><div class="dishes">' + dishes + '</div>' +
      '<form class="add" id="dishForm" autocomplete="off"><input id="dishInput" placeholder="Añadir plato" maxlength="40" enterkeyhint="done"><button class="btn" type="submit">Añadir</button></form>' +
      '<div class="row-btns"><button class="btn ghost" data-act="resetMenu">Volver al ejemplo</button></div></section></div>';
    const form = $('#dishForm');
    form.onsubmit = (ev) => {
      ev.preventDefault();
      const raw = $('#dishInput').value.trim().replace(/\s+/g, ' ');
      if (!raw) return;
      const name = raw.charAt(0).toUpperCase() + raw.slice(1);
      updateMenu((menu) => { if (!menu.dishes.some((d) => d.toLowerCase() === name.toLowerCase())) menu.dishes.push(name); });
    };
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
    if (!$('#expCals').checked) { st.calendars = []; st.proxy = ''; delete st.syncBg; delete st.schoolIcs; }
    delete st.syncUrl;
    delete st.syncKey;
    const data = { tipo: 'marco-familiar-ajustes', version: 1, advanced: store.get('advanced', {}), settings: st, menu: menuState() };
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
      if (!d.settings.syncUrl) next.syncUrl = cur.syncUrl || '';
      if (!d.settings.syncKey) next.syncKey = cur.syncKey || '';
      if (!d.settings.syncBg) next.syncBg = cur.syncBg || {};
      store.set('settings', next);
    }
    if (d.menu && typeof d.menu === 'object') store.set('menu', d.menu);
    store.del('cache.weather');
    toast('Ajustes importados'); setTimeout(() => location.reload(), 400);
    return true;
  }
  document.addEventListener('change', (ev) => {
    if (ev.target && ev.target.id === 'impFile' && ev.target.files[0]) {
      const r = new FileReader(); r.onload = () => importJson(String(r.result)); r.readAsText(ev.target.files[0]);
    }
  });

  /* ---------------- DINERO, PLAZOS, ENTRENO, SEMANA ---------------- */
  const ENTRENO_TIPOS = [
    { id: 'fuerza', label: 'Fuerza' },
    { id: 'running', label: 'Running' },
    { id: 'descanso', label: 'Descanso' }
  ];
  function parseEuro(raw) {
    const v = String(raw == null ? '' : raw).trim().replace(/\s/g, '').replace('€', '').replace(',', '.');
    if (v === '' || !isFinite(+v)) return null;
    return Math.round(+v * 100) / 100;
  }
  function fmtEuro(n) {
    if (n == null || !isFinite(+n)) return '—';
    const x = Math.round(+n * 100) / 100;
    let s;
    try { s = x.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    catch (e) { s = x.toFixed(2).replace('.', ','); }
    return s + ' €';
  }
  function euroTxt(n) { return n == null ? '' : String(n).replace('.', ','); }
  function dineroRaw() {
    if (settings.dinero && typeof settings.dinero === 'object') return settings.dinero;
    if (CFG.dinero && typeof CFG.dinero === 'object') return CFG.dinero;
    return window.MARCO_DEFAULTS.dinero;
  }
  function dinero() {
    const raw = dineroRaw() || {};
    const subs = Array.isArray(raw.suscripciones) ? raw.suscripciones : [];
    return {
      luzEste: parseEuro(raw.luzEste),
      luzPasado: parseEuro(raw.luzPasado),
      fibraEste: parseEuro(raw.fibraEste),
      fibraPasado: parseEuro(raw.fibraPasado),
      fibraAlt: parseEuro(raw.fibraAlt),
      suscPasado: parseEuro(raw.suscPasado),
      suscripciones: subs.filter((s) => s && String(s.name || '').trim()).map((s, i) => ({
        id: s.id || ('sub-' + i),
        name: String(s.name).trim(),
        euros: parseEuro(s.euros),
        eurosPasado: parseEuro(s.eurosPasado),
        cancelBy: /^\d{4}-\d{2}-\d{2}$/.test(String(s.cancelBy || '')) ? String(s.cancelBy) : ''
      }))
    };
  }
  function sumEuros(list, key) {
    let cents = 0;
    for (let i = 0; i < list.length; i++) {
      if (list[i][key] == null) return null;
      cents += Math.round(list[i][key] * 100);
    }
    return cents / 100;
  }
  function dineroTotales(d) {
    const subsEste = sumEuros(d.suscripciones, 'euros');
    let subsPasado = null;
    if (!d.suscripciones.length) subsPasado = 0;
    else if (d.suscripciones.every((s) => s.eurosPasado != null)) subsPasado = sumEuros(d.suscripciones, 'eurosPasado');
    else if (d.suscPasado != null) subsPasado = d.suscPasado;
    const este = (d.luzEste != null && d.fibraEste != null && subsEste != null)
      ? (Math.round(d.luzEste * 100) + Math.round(d.fibraEste * 100) + Math.round(subsEste * 100)) / 100 : null;
    const pasado = (d.luzPasado != null && d.fibraPasado != null && subsPasado != null)
      ? (Math.round(d.luzPasado * 100) + Math.round(d.fibraPasado * 100) + Math.round(subsPasado * 100)) / 100 : null;
    return { este: este, pasado: pasado, ahorro: (este != null && pasado != null) ? (Math.round(pasado * 100) - Math.round(este * 100)) / 100 : null, subsEste: subsEste, subsPasado: subsPasado };
  }
  function plazosRaw() {
    if (Array.isArray(settings.plazos)) return settings.plazos;
    if (Array.isArray(CFG.plazos)) return CFG.plazos;
    return window.MARCO_DEFAULTS.plazos || [];
  }
  function plazos() {
    return plazosRaw().filter((p) => p && String(p.title || '').trim() && /^\d{4}-\d{2}-\d{2}$/.test(String(p.due || ''))).map((p, i) => ({
      id: p.id || ('plazo-' + i),
      title: String(p.title).trim(),
      due: String(p.due),
      note: String(p.note || '').trim()
    })).sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title, 'es'));
  }
  function plazoEstado(due, t) {
    const d = U.parseLocal(due);
    if (isNaN(d)) return { tone: 'gris', days: null, label: 'fecha no válida' };
    const days = U.dayDiff(U.sod(t), U.sod(d));
    let tone = 'verde';
    if (days < 0) tone = 'gris';
    else if (days <= 3) tone = 'rojo';
    else if (days <= 14) tone = 'ambar';
    let label;
    if (days < 0) label = days === -1 ? 'hace 1 día' : 'hace ' + (-days) + ' días';
    else if (days === 0) label = 'hoy';
    else if (days === 1) label = 'queda 1 día';
    else label = 'quedan ' + days + ' días';
    return { tone: tone, days: days, label: label };
  }
  function entrenoMap() {
    const raw = (settings.entreno && typeof settings.entreno === 'object') ? settings.entreno : ((CFG.entreno && typeof CFG.entreno === 'object') ? CFG.entreno : {});
    const out = {};
    for (let i = 0; i < 7; i++) {
      const v = String(raw[String(i)] || 'descanso');
      out[String(i)] = ENTRENO_TIPOS.some((x) => x.id === v) ? v : 'descanso';
    }
    return out;
  }
  function entrenoHoy(t) { return entrenoMap()[String((t || now()).getDay())]; }
  function entrenoLabel(id) {
    const hit = ENTRENO_TIPOS.find((x) => x.id === id);
    return hit ? hit.label : 'Descanso';
  }
  function esEjemplo(s) { return /ejemplo/i.test(String(s || '')); }
  function subsToText(list) {
    return (list || []).map((s) => [s.name, euroTxt(s.euros), s.cancelBy || '', euroTxt(s.eurosPasado)].join(' | ')).join('\n');
  }
  function parseSubs(txt) {
    return String(txt || '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p[0]).map((p, i) => ({
      id: (slug(p[0], i) || 'sub') + '-' + i,
      name: p[0],
      euros: parseEuro(p[1]),
      cancelBy: /^\d{4}-\d{2}-\d{2}$/.test(p[2] || '') ? p[2] : '',
      eurosPasado: parseEuro(p[3])
    }));
  }
  function plazosToText(list) {
    return (list || []).map((p) => [p.title, p.due, p.note || ''].join(' | ')).join('\n');
  }
  function parsePlazos(txt) {
    const rows = String(txt || '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p[0] || p[1]);
    const ok = [];
    let bad = 0;
    rows.forEach((p, i) => {
      if (!p[0] || !/^\d{4}-\d{2}-\d{2}$/.test(p[1] || '')) { bad++; return; }
      ok.push({ id: (slug(p[0], i) || 'plazo') + '-' + p[1], title: p[0], due: p[1], note: p[2] || '' });
    });
    return { ok: ok, bad: bad };
  }
  function dineroCards() {
    const d = dinero();
    return '<section class="card wide" id="dineroCard"><div class="card-h">💶 Dinero del mes</div>' +
      '<div class="muted sm">Importes en € que rellenas tú. No hay cuentas, contratos ni lecturas del contador. Los nombres con «ejemplo» son de muestra.</div>' +
      '<div class="card-h sub">LUZ · TRAMOS HORARIOS</div>' +
      '<div class="muted sm">Coste previsto del mes. La tarifa va por tramos (punta, llano y valle); las horas de hoy están en Luz.</div>' +
      '<div class="grid2"><label class="lbl">Previsto este mes (€)<input id="dinLuz" inputmode="decimal" value="' + esc(euroTxt(d.luzEste)) + '" placeholder="0,00"></label>' +
      '<label class="lbl">Mes pasado (€)<input id="dinLuzP" inputmode="decimal" value="' + esc(euroTxt(d.luzPasado)) + '" placeholder="0,00"></label></div>' +
      '<div class="card-h sub">FIBRA Y MÓVIL</div>' +
      '<div class="grid3"><label class="lbl">Este mes (€)<input id="dinFibra" inputmode="decimal" value="' + esc(euroTxt(d.fibraEste)) + '" placeholder="0,00"></label>' +
      '<label class="lbl">Mes pasado (€)<input id="dinFibraP" inputmode="decimal" value="' + esc(euroTxt(d.fibraPasado)) + '" placeholder="0,00"></label>' +
      '<label class="lbl">Alternativa fibra + 1 línea (€)<input id="dinFibraAlt" inputmode="decimal" value="' + esc(euroTxt(d.fibraAlt)) + '" placeholder="opcional"></label></div>' +
      '<div class="card-h sub">SUSCRIPCIONES</div>' +
      '<div class="muted sm">Una por línea: <code>nombre | €/mes | baja AAAA-MM-DD | € mes pasado</code>. La baja y el mes pasado son opcionales. Vacío = ninguna.</div>' +
      '<textarea id="dinSubs" rows="4" spellcheck="false">' + esc(subsToText(d.suscripciones)) + '</textarea>' +
      '<label class="lbl">Total suscripciones del mes pasado (€), si no lo pones en cada línea<input id="dinSuscP" inputmode="decimal" value="' + esc(euroTxt(d.suscPasado)) + '" placeholder="opcional"></label>' +
      '<div class="row-btns"><button class="btn" data-act="saveDinero">Guardar dinero</button></div></section>';
  }
  function plazosCard() {
    return '<section class="card" id="plazosCard"><div class="card-h">⏳ Plazos</div>' +
      '<div class="muted sm">Una por línea: <code>título | AAAA-MM-DD | nota</code>. Rojo a 3 días o menos, ámbar a 14, verde después y gris si ya pasó. Los de «ejemplo» no son trámites reales.</div>' +
      '<textarea id="plazosTxt" rows="5" spellcheck="false">' + esc(plazosToText(plazos())) + '</textarea>' +
      '<div class="row-btns"><button class="btn" data-act="savePlazos">Guardar plazos</button></div></section>';
  }
  function entrenoCard() {
    const map = entrenoMap();
    const opts = (cur) => ENTRENO_TIPOS.map((t) => '<option value="' + t.id + '"' + (cur === t.id ? ' selected' : '') + '>' + esc(t.label) + '</option>').join('');
    const rows = WD.map(([n, name]) => '<label class="lbl">' + name + '<select id="ent' + n + '">' + opts(map[String(n)]) + '</select></label>').join('');
    return '<section class="card"><div class="card-h">💪 Entreno previsto</div>' +
      '<div class="muted sm">Tipo de cada día para la franja Hoy de Salud: fuerza, running o descanso. No hay un plan personal en el código.</div>' +
      '<div class="wds">' + rows + '</div>' +
      '<div class="row-btns"><button class="btn" data-act="saveEntreno">Guardar entreno</button></div></section>';
  }
  function renderDinero() {
    const d = dinero();
    const tot = dineroTotales(d);
    const ahorroCls = tot.ahorro == null ? '' : (tot.ahorro > 0 ? ' good' : (tot.ahorro < 0 ? ' bad' : ''));
    const luzSub = d.luzPasado != null ? 'Mes pasado ' + fmtEuro(d.luzPasado) : 'Mes pasado sin rellenar';
    let fibraSub = d.fibraPasado != null ? 'Mes pasado ' + fmtEuro(d.fibraPasado) : 'Mes pasado sin rellenar';
    if (d.fibraAlt != null) {
      fibraSub += ' · Alternativa fibra + 1 línea ' + fmtEuro(d.fibraAlt);
      if (d.fibraEste != null) {
        const diff = (Math.round(d.fibraAlt * 100) - Math.round(d.fibraEste * 100)) / 100;
        fibraSub += diff === 0 ? ' (igual)' : (diff > 0 ? ' (la alternativa cuesta ' + fmtEuro(diff) + ' más)' : ' (la alternativa cuesta ' + fmtEuro(-diff) + ' menos)');
      }
    }
    const rows = d.suscripciones.map((s) => {
      const baja = s.cancelBy ? ' · baja ' + U.fechaCorta(U.parseLocal(s.cancelBy)) : '';
      const tag = esEjemplo(s.name) ? ' <span class="tag ej">EJEMPLO</span>' : '';
      return '<div class="sub-row"><span>' + esc(s.name) + tag + '<div class="muted sm" style="margin:0">' + esc(baja.replace(/^ · /, '') || 'Sin fecha de baja') + '</div></span><b>' + esc(fmtEuro(s.euros)) + '</b></div>';
    }).join('');
    const subsTotal = tot.subsEste == null ? '—' : fmtEuro(tot.subsEste);
    screenEl.innerHTML = '<div class="dinero"><div class="dinero-grid">' +
      '<section class="card span2 dinero-ahorro" data-ahorro="' + (tot.ahorro == null ? '' : String(tot.ahorro)) + '" data-este="' + (tot.este == null ? '' : String(tot.este)) + '" data-pasado="' + (tot.pasado == null ? '' : String(tot.pasado)) + '"><div class="card-h">Ahorro vs mes pasado</div>' +
        '<div class="money-big' + ahorroCls + '">' + esc(fmtEuro(tot.ahorro)) + '</div>' +
        '<div class="muted sm">Es la suma del mes pasado menos la de este mes (luz + fibra y móvil + suscripciones). Si falta un importe, sale —. Este mes ' + esc(fmtEuro(tot.este)) + ' · mes pasado ' + esc(fmtEuro(tot.pasado)) + '.</div></section>' +
      '<section class="card"><div class="card-h">⚡ Luz del mes</div><div class="money-big">' + esc(fmtEuro(d.luzEste)) + '</div>' +
        '<div class="muted sm">Coste previsto. Tarifa por tramos horarios: punta, llano y valle. Las horas están en Luz; el € lo pones en Ajustes. ' + esc(luzSub) + '.</div></section>' +
      '<section class="card"><div class="card-h">📶 Fibra y móvil</div><div class="money-big">' + esc(fmtEuro(d.fibraEste)) + '</div>' +
        '<div class="muted sm">' + esc(fibraSub) + '.</div></section>' +
      '<section class="card span2"><div class="card-h">📌 Suscripciones <span class="count">' + esc(subsTotal) + '</span></div>' +
        (rows || '<div class="muted">Ninguna. Puedes añadirlas en Ajustes.</div>') +
        '<div class="muted sm">Los ítems «ejemplo» no son contratos reales. Precios siempre en €.</div></section>' +
      '</div></div>';
  }
  function renderPlazos() {
    const t = now();
    const list = plazos();
    const rows = list.map((p) => {
      const st = plazoEstado(p.due, t);
      const tag = esEjemplo(p.title) ? ' <span class="tag ej">EJEMPLO</span>' : '';
      return '<article class="plazo ' + st.tone + '" data-tone="' + st.tone + '" data-due="' + esc(p.due) + '" data-title="' + esc(p.title) + '"><span class="plazo-dot ' + st.tone + '" aria-hidden="true"></span><div class="plazo-n">' + esc(p.title) + tag +
        '<div class="muted sm" style="margin:0">' + esc(U.fechaCorta(U.parseLocal(p.due)) + (p.note ? ' · ' + p.note : '')) + '</div></div><div class="plazo-d">' + esc(st.label) + '</div></article>';
    }).join('');
    const legend = '<div class="muted sm"><span class="plazo-dot rojo"></span> Rojo: 3 días o menos · <span class="plazo-dot ambar"></span> Ámbar: 14 días o menos · <span class="plazo-dot verde"></span> Verde: más tarde · <span class="plazo-dot gris"></span> Gris: ya pasó. Ordenados por fecha.</div>';
    screenEl.innerHTML = '<div class="plazos"><section class="card"><div class="card-h">⏳ Plazos <span class="count">' + list.length + '</span></div>' +
      (rows || '<div class="muted">No hay plazos. Añádelos en Ajustes.</div>') + legend +
      '<div class="muted sm">Registro, hotel y vuelo, si salen con «ejemplo», son marcadores de muestra. Cámbialos en Ajustes.</div></section></div>';
  }
  function agendaHasta(t) {
    const next = custodyOn() ? Custody.nextHandover(t) : null;
    const end = next ? U.sod(next.at) : addDays(U.sod(t), 6);
    const seen = {};
    const out = [];
    let d = U.sod(t);
    for (let i = 0; i < 16 && d <= end; i++) {
      eventsOn(d).forEach((e) => {
        if (!e || e.background || e.virtual || seen[e.id]) return;
        seen[e.id] = true;
        out.push(e);
      });
      d = addDays(d, 1);
    }
    return { events: out.slice(0, 8), until: next };
  }
  function tareasPorNino(t) {
    const k = K();
    const today = dayKey(t);
    const done = (k.done || {})[today] || {};
    return CFG.kids.map((kid) => {
      const list = chores().filter((c) => choreKids(c).some((x) => x.id === kid.id));
      const rows = list.map((c) => {
        const on = (done[c.id] || []).indexOf(kid.id) !== -1;
        const od = !on && slotOverdue(c, t);
        return '<div class="chore' + (od ? ' overdue' : '') + '"><div class="ch-ic">' + esc(c.emoji) + '</div><div class="ch-n">' + esc(c.name) + '<div class="ch-s">' + esc(slotMeta(slotId(c)).name) + ' · +' + c.stars + ' ⭐' + (od ? ' · fuera de hora' : '') + '</div></div><div class="ch-kids"><button class="kid-btn' + (on ? ' on' : '') + '" style="--c:' + kid.color + '" data-chore="' + esc(c.id) + '" data-kid="' + esc(kid.id) + '">' + (on ? '✓ ' : '') + esc(kid.name) + '</button></div></div>';
      }).join('') || '<div class="muted">Sin tareas para este niño.</div>';
      return '<div class="semana-kid"><span class="kid-chip lg" style="--c:' + kid.color + '"><span class="av">' + esc((kid.name || '?')[0]) + '</span>' + esc(kid.name) + '</span>' + rows + '</div>';
    }).join('');
  }
  function renderSemana() {
    const t = now();
    const home = kidsHome(t);
    if (!home) {
      const nx = custodyOn() ? Custody.nextHandover(t) : null;
      const when = nx ? U.fechaCorta(nx.at) + ' a las ' + hm(nx.at) : '';
      screenEl.innerHTML = '<div class="semana"><section class="card semana-calma"><div class="semana-pause">Semana sin niños — tareas pausadas</div>' +
        '<div class="muted">Las tareas y la mochila esperan a la próxima semana en casa.' + (when ? ' Vuelven el ' + esc(when) + '.' : '') + ' El menú de la izquierda sigue aquí.</div></section></div>';
      return;
    }
    const nx = custodyOn() ? Custody.nextHandover(t) : null;
    const until = nx ? 'Hasta el ' + U.fechaCorta(nx.at) + ' a las ' + hm(nx.at) + '.' : 'Custodia sin activar: las tareas siguen en marcha.';
    const ag = agendaHasta(t);
    const citas = ag.events.length
      ? ag.events.map((e) => '<button type="button" class="agenda-row" data-ev="' + esc(e.id) + '"><b>' + esc(e.title) + '</b><span class="muted sm">' + esc((e.allDay ? 'Todo el día' : hm(e.start)) + ' · ' + U.fechaCorta(e.start)) + '</span></button>').join('')
      : '<div class="muted">Sin citas en la agenda de estos días.</div>';
    const n = compraViva(C()).filter((x) => !x.done).length;
    const compraTxt = n === 0 ? 'Nada pendiente en la lista' : (n === 1 ? '1 pendiente en la lista' : n + ' pendientes en la lista');
    screenEl.innerHTML = '<div class="semana"><div class="semana-banner">Esta semana con los niños</div><div class="semana-grid">' +
      mochilaBlock(t) +
      '<section class="card"><div class="card-h">Tareas de hoy <span class="muted sm">' + esc(until) + '</span></div>' + tareasPorNino(t) +
        '<div class="muted sm">Las mismas tareas que en Niños, agrupadas por niño. Los nombres salen de Ajustes.</div></section>' +
      '<div class="col"><section class="card"><div class="card-h">Agenda</div>' + citas +
        '<div class="muted sm">Citas de los calendarios que ya tienes, hasta el próximo cambio. No hay datos de cole en el código.</div></section>' +
        '<button type="button" class="card sum" data-go="compra"><div class="sum-h c-green">🛒 COMPRA</div><div class="sum-big">' + esc(compraTxt) + '</div><div class="sum-sub">La cesta se arma en Compra.</div></button></div></div></div>';
  }

  /* ---------------- AJUSTES ---------------- */
  function syncStatusLine() {
    if (!syncReady()) return '<div class="sync-status" id="syncStatus">Sin configurar. Todo sigue en este dispositivo y el modo demo se comporta como siempre.</div>';
    const d = S.syncDataStatus;
    const c = S.syncCalStatus;
    const parts = [];
    if (d && d.ok) parts.push('Datos compartidos a las ' + hm(new Date(d.at)));
    else if (d && d.error) parts.push('Datos: ' + d.error);
    if (c && c.ok) parts.push((c.n || 0) + ' citas a las ' + hm(new Date(c.at)));
    else if (c && c.error) parts.push('Calendarios: ' + c.error);
    if (!parts.length) return '<div class="sync-status" id="syncStatus">Guardado en este dispositivo. Pulsa «Guardar y probar».</div>';
    const bad = (d && !d.ok) || (c && !c.ok);
    return '<div class="sync-status ' + (bad ? 'bad' : 'ok') + '" id="syncStatus">' + esc(parts.join(' · ')) + '</div>';
  }
  function syncCard() {
    const cals = store.get('cache.syncCals', []) || [];
    const bg = settings.syncBg || {};
    const rows = cals.map((cal) => {
      const on = Object.prototype.hasOwnProperty.call(bg, cal.id) ? !!bg[cal.id] : !!cal.background;
      return '<label class="sync-cal"><span class="sync-dot" style="--c:' + esc(cal.color || '#C8243B') + '"></span><span class="sync-name">' + esc(cal.name || 'Calendario') + '</span><span class="bg-flag"><input type="checkbox" data-sync-bg="' + esc(cal.id) + '"' + (on ? ' checked' : '') + '> De fondo</span></label>';
    }).join('');
    return '<section class="card wide" id="syncCard"><div class="card-h">🔄 Sincronización con Google</div>' +
      '<div class="muted sm">Opcional. Si lo configuras, las citas salen de tus calendarios de Google (sin dirección iCal ni proxy) y la compra, el menú, las estrellas y las citas hechas se comparten entre el marco y el móvil. Salud usa la misma clave para pedirle al script el resumen de Garmin, y los avisos de AEMET también: esas claves se quedan en el script, no en el marco. El outfit de mañana llega por la misma clave (lo publica el bot; el marco solo lo lee). La URL y la clave compartida se guardan solo en este dispositivo.</div>' +
      '<label class="lbl">URL de la aplicación web</label><input id="syncUrl" type="text" inputmode="url" autocomplete="off" spellcheck="false" value="' + esc(settings.syncUrl || '') + '" placeholder="https://script.google.com/macros/s/…/exec">' +
      '<label class="lbl">Clave compartida</label><div class="sync-key"><input id="syncKey" type="password" autocomplete="off" spellcheck="false" value="' + esc(settings.syncKey || '') + '" placeholder="una clave larga, solo tuya"><button class="btn sm ghost" data-act="showSyncKey" type="button">👁</button></div>' +
      syncStatusLine() +
      (rows ? '<div class="card-h sub">CALENDARIOS DE GOOGLE · DE FONDO NO ENTRA EN AHORA</div><div class="sync-cals">' + rows + '</div>' : '') +
      '<div class="row-btns"><button class="btn" data-act="saveSync">Guardar y probar</button></div>' +
      '<div class="muted sm">Vacío = como hasta ahora (modo demo si no hay iCal). El iCal de abajo queda de respaldo si esta conexión falla. «Haz la cesta» no cambia: copia la lista y abre el correo. Los nombres de la familia, el PIN y las direcciones no se sincronizan.</div></section>';
  }
  function mochilaCard() {
    return '<section class="card"><div class="card-h">🎒 Mochila</div><div class="muted sm">Una regla por línea: <code>baloncesto|basket → equipación → 🏀</code>. Las palabras, separadas por <code>|</code>, se buscan en el título de la cita (sin mayúsculas ni tildes). Si el objeto es <code>día libre</code>, ese día no se prepara la mochila. En la semana sin niños se pausa sola.</div>' +
      '<textarea id="mochilaTxt" rows="6">' + esc(Mochila.texto(mochilaRules())) + '</textarea>' +
      '<div class="row-btns"><button class="btn" data-act="saveMochila">Guardar</button><button class="btn ghost" data-act="resetMochila">Restaurar lista por defecto</button></div></section>';
  }
  function casaCards() {
    const travelVal = typeof settings.travelText === 'string' ? settings.travelText : Casa.formatTravel(CFG.travel || []);
    const outdoorVal = typeof settings.outdoorText === 'string' ? settings.outdoorText : (CFG.outdoor || '');
    const aisleVal = typeof settings.aisleText === 'string' ? settings.aisleText : Casa.formatAisles(CFG.aisles || []);
    const kidsVal = typeof settings.schoolKids === 'string' ? settings.schoolKids : (schoolCfg().kids || []).map((k) => k.name + (k.extras ? ' | ' + k.extras : '')).join('\n');
    const sc = schoolCfg();
    return '<section class="card"><div class="card-h">🚶 Salida</div><div class="muted sm">Minutos de camino si el título de la cita casa. Una regla por línea: <code>palabras = minutos</code>. Ejemplo: colegio 10, Basquevolt 20. Si ya es la hora, Hoy pone <b>Sal ya</b>.</div>' +
      '<textarea id="travelTxt" rows="4">' + esc(travelVal) + '</textarea>' +
      '<label class="lbl">Al aire libre (consejo de ropa, no es el aviso de AEMET)</label><input id="outdoorTxt" value="' + esc(outdoorVal) + '">' +
      '<div class="row-btns"><button class="btn" data-act="saveTravel">Guardar</button><button class="btn ghost" data-act="resetTravel">Valores de ejemplo</button></div></section>' +
      '<section class="card"><div class="card-h">🏫 Cole</div><div class="muted sm">«Mañana no hay cole» usa el finde, los festivos, las fechas de abajo o un ICS solo de días sin clase. El horario y los extras son opcionales. Sin fechas ni ICS, el modo demo enseña unos días de Navidad de ejemplo.</div>' +
      '<label class="lbl">ICS de días sin cole<input id="schoolIcs" type="password" autocomplete="off" spellcheck="false" value="' + esc(settings.schoolIcs || '') + '" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"></label>' +
      '<label class="lbl">Fechas (una por línea, AAAA-MM-DD o MM-DD, o un rango con ..)</label><textarea id="schoolDates" rows="3" placeholder="2026-12-24&#10;12-25&#10;2026-12-23..2026-12-26">' + esc(settings.schoolDates || '') + '</textarea>' +
      '<div class="grid2"><label class="lbl">Empieza<input id="schoolFrom" type="time" value="' + esc(settings.schoolFrom || sc.from || '09:00') + '"></label><label class="lbl">Termina<input id="schoolTo" type="time" value="' + esc(settings.schoolTo || sc.to || '14:00') + '"></label></div>' +
      '<label class="lbl">Por niño: <code>nombre | extra</code> o <code>nombre | 09:00-14:00 | extra</code></label><textarea id="schoolKids" rows="3">' + esc(kidsVal) + '</textarea>' +
      '<div class="row-btns"><button class="btn" data-act="saveSchool">Guardar</button></div>' +
      (S.schoolError ? '<div class="muted sm">ICS: ' + esc(S.schoolError) + '</div>' : '') + '</section>' +
      '<section class="card"><div class="card-h">🛒 Pasillos</div><div class="muted sm">Orden de la tienda, de arriba a abajo. Una línea: <code>Nombre | palabras</code>. La última sin palabras es el cajón de Otros. Pensado para un Eroski; cámbialo a tu tienda.</div>' +
      '<textarea id="aisleTxt" rows="8">' + esc(aisleVal) + '</textarea>' +
      '<div class="row-btns"><button class="btn" data-act="saveAisles">Guardar</button><button class="btn ghost" data-act="resetAisles">Orden de ejemplo</button></div></section>';
  }
  function renderAjustes() {
    const calRows = (settings.calendars.length ? settings.calendars : []).map((c, i) => {
      const st = S.calStatus[c.id || String(i)];
      const stTxt = !c.url ? '' : st ? (st.ok ? '✅ ' + st.n + ' citas · ' + hm(new Date(st.at)) : '❌ ' + st.error) : 'Sin probar';
      return '<div class="cal-set" data-i="' + i + '"><input class="cs-name" value="' + esc(c.name) + '" placeholder="Nombre"><input class="cs-color" type="color" value="' + esc(c.color || '#E8604C') + '">' +
        '<input class="cs-url" type="password" value="' + esc(c.url) + '" placeholder="https://calendar.google.com/calendar/ical/…/private-…/basic.ics" autocomplete="off" spellcheck="false">' +
        '<button class="btn sm ghost" data-act="showUrl" data-i="' + i + '">👁</button><button class="btn sm ghost" data-act="delCal" data-i="' + i + '">Quitar</button><div class="cs-st"><label class="bg-flag"><input type="checkbox" class="cs-bg"' + (c.background ? ' checked' : '') + '> De fondo</label>' + esc(stTxt) + '</div></div>';
    }).join('');
    const pr = prices();
    const ch = chores().map((c) => [c.emoji, c.name, c.stars, c.slot || 'cole'].concat(c.kids && c.kids.length ? [c.kids.join(',')] : []).join(' | ')).join('\n');
    const rw = rewards().map((r) => [r.emoji, r.name, r.cost].join(' | ')).join('\n');
    screenEl.innerHTML = '<div class="ajustes">' +
      syncCard() +
      '<section class="card wide"><div class="card-h">🗓️ Calendarios (iCal secreto de Google)</div>' +
        '<div class="muted sm">Respaldo si no usas la sincronización de arriba, o si esa conexión falla. En Google Calendar (web): Configuración → tu calendario → «Dirección secreta en formato iCal». Se guarda SOLO en este dispositivo (localStorage), nunca en el código.</div>' +
        '<div id="calList">' + (calRows || '<div class="muted">No hay calendarios.</div>') + '</div>' +
        '<div class="row-btns"><button class="btn ghost" data-act="addCal">+ Añadir calendario</button></div>' +
        '<label class="lbl">Proxy CORS (opcional, prefijo que termina en <code>?url=</code>)</label><input id="proxy" value="' + esc(settings.proxy) + '" placeholder="https://marco-ics.tu-cuenta.workers.dev/?key=…&url=" spellcheck="false">' +
        '<div class="muted sm">«De fondo» pinta el calendario tenue (turnos, trabajo) y no entra en Ahora. En el modo demo ya hay un turno de ejemplo. Google no deja leer el iCal directamente desde el navegador (falta la cabecera CORS). Usa el Worker de <code>proxy/</code> o <code>serve.py</code>.</div>' +
        '<label class="switch"><input type="checkbox" id="demo" ' + (demoOn() ? 'checked' : '') + '> Modo demostración (citas inventadas)</label>' +
        '<div class="row-btns"><button class="btn" data-act="saveCals">Guardar y probar</button></div></section>' +
      familyCard() +
      '<section class="card"><div class="card-h">⚡ Precios de ' + esc(tariffName()) + '</div><div class="muted sm">Opcional. Cópialos de tu factura o contrato (€/kWh). Si los dejas vacíos no se enseña ningún precio.</div>' +
        '<div class="prices">' + ['punta', 'llano', 'valle'].map((k) => '<label>' + Luz.NOMBRE[k] + '<input id="p_' + k + '" inputmode="decimal" value="' + esc(pr[k] == null ? '' : pr[k]) + '" placeholder="0,000"></label>').join('') + '</div>' +
        '<div class="row-btns"><button class="btn" data-act="savePrices">Guardar precios</button></div></section>' +
      dineroCards() +
      plazosCard() +
      entrenoCard() +
      '<section class="card"><div class="card-h">⭐ Tareas y recompensas</div><div class="muted sm">Una por línea: <code>emoji | nombre | estrellas | franja | niños</code>. Franja: <code>manana</code>, <code>cole</code> o <code>noche</code>. Niños: ids separados por coma; vacío = todos. En la semana sin niños (custodia) se pausan solas.</div>' +
        '<label class="lbl">Tareas</label><textarea id="choresTxt" rows="5">' + esc(ch) + '</textarea><label class="lbl">Recompensas</label><textarea id="rewardsTxt" rows="4">' + esc(rw) + '</textarea>' +
        '<div class="row-btns"><button class="btn" data-act="saveChores">Guardar</button><button class="btn ghost" data-act="resetStars">Poner estrellas a 0 🔒</button></div></section>' +
      mochilaCard() +
      '<section class="card"><div class="card-h">🔒 PIN de padres</div><div class="muted sm">Para aprobar canjes y entrar en Ajustes. Se guarda en este dispositivo; es un candado para niños, no seguridad fuerte.</div>' +
        '<div class="row-btns"><input id="pin1" type="password" inputmode="numeric" maxlength="8" placeholder="Nuevo PIN (4–8 cifras)"><button class="btn" data-act="savePin">' + (store.get('pin', null) ? 'Cambiar PIN' : 'Crear PIN') + '</button></div></section>' +
      '<section class="card"><div class="card-h">🛒 Aviso de la cesta</div><div class="muted sm">Correo al que «Haz la cesta» abre el mensaje con la lista pendiente, para que Grok Bot la recoja cuando se lo pidas. Vacío hasta que lo pongas. Se guarda solo en este dispositivo. El marco no entra en la tienda.</div>' +
        '<label class="lbl">Correo<input id="eroskiMail" type="email" inputmode="email" autocomplete="off" spellcheck="false" value="' + esc(settings.eroskiNotifyEmail || '') + '" placeholder="bot@ejemplo.com"></label>' +
        '<div class="row-btns"><button class="btn" data-act="saveEroski">Guardar correo</button></div></section>' +
      '<section class="card"><div class="card-h">🌙 Pantalla</div><label class="switch"><input type="checkbox" id="night" ' + (settings.nightClock ? 'checked' : '') + '> Reloj nocturno de ' + esc(CFG.nightClock.from) + ' a ' + esc(CFG.nightClock.to) + '</label>' +
        '<label class="lbl">Tema<select id="theme">' +
          '<option value="auto"' + ((settings.theme || 'auto') === 'auto' ? ' selected' : '') + '>Automático</option>' +
          '<option value="dia"' + (settings.theme === 'dia' ? ' selected' : '') + '>Día</option>' +
          '<option value="noche"' + (settings.theme === 'noche' ? ' selected' : '') + '>Noche</option>' +
        '</select></label>' +
        '<div class="muted sm">Automático sigue el amanecer y el atardecer de Vitoria, calculados en el dispositivo (sin otra API). De día, 60 s sin tocar vuelve a Hoy.</div>' +
        '<div class="row-btns"><button class="btn ghost" data-act="fullscreen">Pantalla completa</button><button class="btn" data-act="saveScreen">Guardar</button></div></section>' +
      casaCards() +
      '<section class="card"><div class="card-h">🧩 Avanzado (JSON)</div><div class="muted sm">Sobrescribe la configuración a mano (para casos raros). Lo normal es usar «Familia» o «Importar».</div>' +
        '<textarea id="adv" rows="5" spellcheck="false">' + esc(JSON.stringify(store.get('advanced', {}), null, 2)) + '</textarea>' +
        '<div class="row-btns"><button class="btn" data-act="saveAdv">Guardar y recargar</button><button class="btn danger" data-act="wipe">Borrar todos los datos de este dispositivo</button></div>' +
        '<div class="muted sm">Marco familiar · sin sincronización todo se queda en el navegador. Con la tarjeta de arriba, un Apps Script tuyo reparte calendarios y listas. La clave no sale de este dispositivo.</div></section>' +
      '</div>';
  }
  function readSyncBg() {
    const bg = Object.assign({}, settings.syncBg || {});
    document.querySelectorAll('[data-sync-bg]').forEach((el) => { bg[el.getAttribute('data-sync-bg')] = el.checked; });
    settings.syncBg = bg;
  }
  function readCalForm() {
    document.querySelectorAll('.cal-set').forEach((row) => {
      const i = +row.dataset.i; const c = settings.calendars[i]; if (!c) return;
      c.name = row.querySelector('.cs-name').value.trim() || 'Calendario ' + (i + 1);
      c.color = row.querySelector('.cs-color').value;
      c.url = row.querySelector('.cs-url').value.trim();
      const bg = row.querySelector('.cs-bg');
      c.background = bg ? bg.checked : !!c.background;
    });
  }
  function parseLines(txt, numKey) {
    return txt.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p.length >= 3 && p[1])
      .map((p, i) => {
        const o = { id: p[1].toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').slice(0, 24) || 'x' + i, emoji: p[0] || '•', name: p[1], [numKey]: Math.max(1, parseInt(p[2], 10) || 1) };
        if (numKey === 'stars') {
          const slot = (p[3] || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (slot === 'manana' || slot === 'cole' || slot === 'noche') o.slot = slot;
          if (p[4]) o.kids = p[4].split(',').map((s) => s.trim()).filter(Boolean);
        }
        return o;
      });
  }
  async function settingsAction(act, el) {
    switch (act) {
      case 'saveFamily': saveFamily(); break;
      case 'exportJson': exportJson(); break;
      case 'importJson': importJson($('#impTxt').value); break;
      case 'addCal': readCalForm(); settings.calendars.push({ id: U.uid(), name: 'Calendario ' + (settings.calendars.length + 1), color: ['#E8604C', '#3BA55C', '#2F80ED', '#8E5BC8', '#F5A623'][settings.calendars.length % 5], url: '', background: false }); saveSettings(); render(); break;
      case 'menuSpan': updateMenu((m) => { m.span = el.dataset.span === '5' ? 5 : 7; }); break;
      case 'resetMenu': S.menuPick = null; updateMenu((m) => { const d = defaultMenu(); m.span = d.span; m.dishes = d.dishes.slice(); m.plan = JSON.parse(JSON.stringify(d.plan)); m._forceRev = true; }); toast('Menú de ejemplo'); break;
      case 'delCal': readCalForm(); settings.calendars.splice(+el.dataset.i, 1); saveSettings(); render(); break;
      case 'showUrl': { const inp = el.parentElement.querySelector('.cs-url'); inp.type = inp.type === 'password' ? 'text' : 'password'; break; }
      case 'saveCals':
        readCalForm();
        settings.calendars.forEach((c) => { if (!c.id) c.id = U.uid(); if (c.url && !/^https:\/\//i.test(c.url)) c.url = c.url.replace(/^webcal:\/\//i, 'https://'); });
        settings.proxy = $('#proxy').value.trim();
        { const want = $('#demo').checked; const def = realCalendars().length === 0 && !syncReady(); settings.demo = want === def ? null : want; }
        saveSettings(); toast('Guardado. Probando calendarios…'); await loadCalendars(); render(); toast(demoOn() ? 'Modo demo activo' : 'Calendarios actualizados'); break;
      case 'savePrices':
        settings.prices = {};
        ['punta', 'llano', 'valle'].forEach((k) => { const v = $('#p_' + k).value.trim().replace(',', '.'); settings.prices[k] = v === '' || isNaN(+v) ? null : +v; });
        saveSettings(); toast('Precios guardados'); break;
      case 'saveDinero': {
        const subs = parseSubs($('#dinSubs').value);
        if (subs.some((s) => s.euros == null)) { toast('Cada suscripción necesita un importe en €'); break; }
        settings.dinero = {
          luzEste: parseEuro($('#dinLuz').value),
          luzPasado: parseEuro($('#dinLuzP').value),
          fibraEste: parseEuro($('#dinFibra').value),
          fibraPasado: parseEuro($('#dinFibraP').value),
          fibraAlt: parseEuro($('#dinFibraAlt').value),
          suscPasado: parseEuro($('#dinSuscP').value),
          suscripciones: subs
        };
        saveSettings(); toast('Dinero guardado'); render(); break;
      }
      case 'savePlazos': {
        const parsed = parsePlazos($('#plazosTxt').value);
        if (parsed.bad && !parsed.ok.length && $('#plazosTxt').value.trim()) { toast('Cada plazo necesita título y fecha AAAA-MM-DD'); break; }
        settings.plazos = parsed.ok;
        saveSettings();
        toast(parsed.bad ? 'Plazos guardados. ' + parsed.bad + (parsed.bad === 1 ? ' línea no válida' : ' líneas no válidas') : 'Plazos guardados');
        render(); break;
      }
      case 'saveEntreno': {
        const ent = {};
        WD.forEach(([n]) => {
          const el = $('#ent' + n);
          const v = el ? el.value : 'descanso';
          ent[String(n)] = ENTRENO_TIPOS.some((x) => x.id === v) ? v : 'descanso';
        });
        settings.entreno = ent;
        saveSettings(); toast('Entreno guardado'); break;
      }
      case 'saveChores': {
        const ch = parseLines($('#choresTxt').value, 'stars'), rw = parseLines($('#rewardsTxt').value, 'cost');
        const adv = store.get('advanced', {}); if (ch.length) adv.chores = ch; if (rw.length) adv.rewards = rw;
        store.set('advanced', adv); CFG.chores = adv.chores || CFG.chores; CFG.rewards = adv.rewards || CFG.rewards; toast('Tareas y recompensas guardadas'); render(); break;
      }
      case 'saveMochila': {
        const parsed = Mochila.parse($('#mochilaTxt').value);
        if (!parsed.length) { toast('Escribe al menos una regla: palabras → objeto'); break; }
        const adv = store.get('advanced', {});
        adv.backpack = parsed;
        store.set('advanced', adv);
        CFG.backpack = parsed;
        toast('Mochila guardada');
        render();
        break;
      }
      case 'resetMochila': {
        const adv = store.get('advanced', {});
        delete adv.backpack;
        store.set('advanced', adv);
        delete CFG.backpack;
        toast('Lista por defecto');
        render();
        break;
      }
      case 'resetStars': if (await requirePin('PIN para poner las estrellas a 0')) { const k = K(); Sync.resetStars(k); Sync.noteLog(k, hm(now()) + ' · Estrellas a 0'); saveK(k); toast('Estrellas a 0'); } break;
      case 'showSyncKey': { const inp = $('#syncKey'); if (inp) inp.type = inp.type === 'password' ? 'text' : 'password'; break; }
      case 'saveSync': {
        const rawUrl = $('#syncUrl').value;
        const url = Sync.normalizeUrl(rawUrl);
        if (rawUrl.trim() && !url) { toast('La URL tiene que ser https (en casa vale http://127.0.0.1 o localhost)'); break; }
        const key = $('#syncKey').value.trim();
        if (url && key.length < 8) { toast('La clave tiene que tener al menos 8 caracteres'); break; }
        if (url && !key) { toast('Falta la clave'); break; }
        readSyncBg();
        settings.syncUrl = url || '';
        settings.syncKey = key;
        if (!url || !key) { settings.syncUrl = ''; settings.syncKey = ''; }
        saveSettings();
        S.syncAuthToasted = false;
        S.dataDown = false;
        S.calDown = false;
        S.syncDown = false;
        if (!syncReady()) { paintOffline(); toast('Sincronización apagada'); render(); break; }
        toast('Probando…', 1500);
        await Sync.syncNow();
        await loadCalendars({ quiet: true });
        await loadSalud().catch(() => {});
        await loadAvisos().catch(() => {});
        render();
        const bad = (S.syncDataStatus && !S.syncDataStatus.ok) || (S.syncCalStatus && !S.syncCalStatus.ok);
        toast(bad ? 'Guardado en este dispositivo. No he podido conectar.' : 'Sincronización lista');
        break;
      }
      case 'savePin': {
        const v = $('#pin1').value.trim();
        if (!/^\d{4,8}$/.test(v)) { toast('El PIN debe tener de 4 a 8 cifras'); break; }
        if (store.get('pin', null) && !(await pinPad('PIN actual'))) break;
        store.set('pin', v); toast('PIN guardado'); render(); break;
      }
      case 'saveEroski': {
        const v = $('#eroskiMail').value.trim();
        if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { toast('Pon un correo válido o déjalo vacío'); break; }
        settings.eroskiNotifyEmail = v;
        saveSettings();
        toast(v ? 'Correo guardado' : 'Sin correo: se elige al enviar');
        break;
      }
      case 'saveScreen': {
        settings.nightClock = $('#night').checked;
        const theme = ($('#theme') && $('#theme').value) || 'auto';
        settings.theme = (theme === 'dia' || theme === 'noche') ? theme : 'auto';
        saveSettings();
        applyTheme();
        toast('Guardado');
        break;
      }
      case 'saveTravel':
        settings.travelText = $('#travelTxt').value;
        settings.outdoorText = $('#outdoorTxt').value;
        saveSettings();
        toast('Salidas guardadas');
        render();
        break;
      case 'resetTravel':
        settings.travelText = null;
        settings.outdoorText = null;
        saveSettings();
        toast('Valores de ejemplo');
        render();
        break;
      case 'saveSchool': {
        settings.schoolIcs = $('#schoolIcs').value.trim();
        const dates = $('#schoolDates').value.trim();
        settings.schoolDates = dates ? $('#schoolDates').value : null;
        settings.schoolFrom = $('#schoolFrom').value;
        settings.schoolTo = $('#schoolTo').value;
        settings.schoolKids = $('#schoolKids').value;
        saveSettings();
        toast('Cole guardado');
        loadSchool().then(() => render());
        break;
      }
      case 'saveAisles':
        settings.aisleText = $('#aisleTxt').value;
        saveSettings();
        toast('Pasillos guardados');
        render();
        break;
      case 'resetAisles':
        settings.aisleText = null;
        saveSettings();
        toast('Orden de ejemplo');
        render();
        break;
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
    m.onclick = (ev) => {
      const doneBtn = ev.target.closest('[data-done]');
      if (doneBtn) { toggleDone(doneBtn.dataset.done); return; }
      if (ev.target === m || ev.target.closest('[data-close]')) closeModal();
      else { const b = ev.target.closest('[data-ev]'); if (b) showEvent(b.dataset.ev); }
    };
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
    const done = isDone(e);
    openModal('<div class="modal-cal" style="--c:' + esc(e.color) + '"><span class="dot"></span>' + esc(e.calName.toUpperCase()) + (e.background ? ' · DE FONDO' : '') + '</div>' +
      '<div class="modal-t' + (done ? ' done' : '') + '">' + esc(e.title) + '</div><div class="modal-w">' + esc(when) + '</div>' +
      (e.location ? '<div class="modal-l">📍 ' + esc(e.location) + '</div>' : '') +
      (e.description ? '<div class="modal-d">' + esc(e.description).replace(/\n/g, '<br>') + '</div>' : '') +
      (e.background ? '<div class="muted sm">Calendario de fondo: se ve tenue y no entra en Ahora.</div>' : '') +
      '<div class="row-btns"><button class="btn' + (done ? ' ghost' : '') + '" data-done="' + esc(e.id) + '">' + (done ? 'Deshacer' : 'Marcar hecha') + '</button></div>');
  }
  function showDay(key) {
    const d = U.parseLocal(key);
    openModal('<div class="modal-t">' + esc(U.fechaLarga(d)) + '</div><div class="day-evs modal-list">' + eventsOn(d).map((e) => evItem(e, d)).join('') + '</div>');
  }

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
    const tipoId = entrenoHoy(t);
    const wos = usable ? Salud.workouts(d).filter((w) => w.date === dayKey(t)) : [];
    const woSub = wos.length ? ('Garmin: ' + (wos[0].name || Salud.tipo(wos[0].type))) : 'Según Ajustes · fuerza, running o descanso';
    return '<section class="card salud-hoy"><div class="card-h">Hoy</div><div class="salud-hoy-row">' +
      '<div class="hoy-bit"><div class="wo-k">SUEÑO</div><div class="metric-n">' + esc(sleepMain) + '</div><div class="muted sm">' + esc(sleepSub) + '</div></div>' +
      '<div class="hoy-bit"><div class="wo-k">BATERÍA / ENERGÍA</div><div class="metric-n">' + esc(bbMain) + '</div><div class="muted sm">' + esc(bbSub) + '</div></div>' +
      '<div class="hoy-bit" data-entreno="' + esc(tipoId) + '"><div class="wo-k">ENTRENO</div><div class="metric-n">' + esc(entrenoLabel(tipoId)) + '</div><div class="muted sm">' + esc(woSub) + '</div></div>' +
      '</div></section>';
  }
  function renderSalud() {
    const d = saludNow();
    if (!d || d.empty || d.ok === false) {
      screenEl.innerHTML = '<div class="salud">' + saludHoyStrip(d) + '<section class="card salud-empty"><div class="card-h">💓 Salud</div><div class="sum-big">Sin datos de Garmin</div><div class="muted sm">Con la sincronización activa, el marco pide el resumen al script. Si Garmin no responde y no hay una copia en este dispositivo, no se inventan cifras. El tipo de entreno sí se elige en Ajustes.</div></section></div>';
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
    screenEl.innerHTML = '<div class="salud">' + note + saludHoyStrip(d) +
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

  /* ---------------- OUTFIT ---------------- */
  function renderOutfit() {
    const o = currentOutfit();
    if (!o) {
      screenEl.innerHTML = '<div class="outfit-page" data-outfit="empty"><section class="card outfit-empty"><div class="card-h">Outfit de mañana</div>' +
        '<p class="outfit-for">Aún no hay propuesta.</p>' +
        '<p class="muted">El bot la deja cada noche, sobre las 21:00. Cuando llegue, pulsa Actualizar. Sin script verías un ejemplo.</p></section></div>';
      return;
    }
    const when = outfitDateLabel(o);
    const pieces = (o.pieces || []).map((p) =>
      '<li class="outfit-piece"><span class="outfit-id">' + esc(p.id) + '</span><span class="outfit-name">' + esc(p.name) + '</span>' +
      (p.slot ? '<span class="outfit-slot">' + esc(p.slot) + '</span>' : '<span></span>') + '</li>'
    ).join('');
    screenEl.innerHTML = '<div class="outfit-page" data-outfit="' + (o.demo ? 'demo' : 'live') + '">' +
      '<div class="outfit-look">' + outfitImgHtml(o, 'outfit-hero') + '</div>' +
      '<div class="outfit-side"><section class="card"><div class="card-h">Outfit de mañana' + outfitTag(o) + '</div>' +
      (when ? '<div class="outfit-for">Para el ' + esc(when.toLowerCase()) + '</div>' : '') +
      (o.why ? '<p class="outfit-why">' + esc(o.why) + '</p>' : '') +
      (o.updatedAt ? '<div class="muted sm">Propuesto ' + esc(o.updatedAt) + '</div>' : '') +
      '<ul class="outfit-list">' + pieces + '</ul></section></div></div>';
  }

  /* ---------------- Navegación y eventos ---------------- */
  const SCREENS = { hoy: renderHoy, calendario: renderCalendario, luz: renderLuz, dinero: renderDinero, plazos: renderPlazos, ninos: renderNinos, semana: renderSemana, compra: renderCompra, menu: renderMenu, salud: renderSalud, outfit: renderOutfit, ajustes: renderAjustes };
  function render() {
    document.querySelectorAll('#rail [data-go]').forEach((b) => {
      const on = b.dataset.go === S.screen;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    document.body.dataset.screen = S.screen;
    try { (SCREENS[S.screen] || renderHoy)(); } catch (e) { console.error(e); screenEl.innerHTML = '<div class="card">Error al pintar: ' + esc(e.message) + '</div>'; }
    pintarFotosOutfit();
    tickClocks();
  }
  function closeDrawer() {
    if (!document.documentElement.classList.contains('rail-drawer')) return;
    document.documentElement.classList.remove('rail-drawer');
    document.body.classList.remove('rail-drawer');
    syncRailButton();
  }
  function railWantsCollapsed() {
    const w = window.innerWidth || 1200;
    if (w < 720) return true;
    const pref = store.get('railCollapsed', null);
    return pref === null ? w < 960 : !!pref;
  }
  function syncRailButton() {
    const btn = document.querySelector('[data-act=railToggle]');
    if (!btn) return;
    const phone = (window.innerWidth || 1200) < 720;
    const drawer = document.documentElement.classList.contains('rail-drawer');
    const collapsed = document.documentElement.classList.contains('rail-collapsed');
    const expanded = drawer || !collapsed;
    btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    btn.setAttribute('aria-label', expanded ? 'Contraer el menú' : 'Ampliar el menú');
    const label = btn.querySelector('.nav-label');
    if (label) label.textContent = phone ? (drawer ? 'Cerrar' : 'Menú') : (collapsed ? 'Ampliar' : 'Contraer');
  }
  function applyRail(opts) {
    const phone = (window.innerWidth || 1200) < 720;
    if (opts && opts.toggle) {
      if (phone) {
        const open = !document.documentElement.classList.contains('rail-drawer');
        document.documentElement.classList.toggle('rail-drawer', open);
        document.body.classList.toggle('rail-drawer', open);
      } else {
        const next = !document.documentElement.classList.contains('rail-collapsed');
        store.set('railCollapsed', next);
        document.documentElement.classList.toggle('rail-collapsed', next);
        document.body.classList.toggle('rail-collapsed', next);
        document.documentElement.classList.remove('rail-drawer');
        document.body.classList.remove('rail-drawer');
      }
    } else {
      const collapsed = railWantsCollapsed();
      document.documentElement.classList.toggle('rail-collapsed', collapsed);
      document.body.classList.toggle('rail-collapsed', collapsed);
      if (!phone) {
        document.documentElement.classList.remove('rail-drawer');
        document.body.classList.remove('rail-drawer');
      }
    }
    syncRailButton();
  }
  async function go(name) {
    closeDrawer();
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
      if (act === 'railToggle') return applyRail({ toggle: true });
      if (act === 'railClose') return closeDrawer();
      if (act === 'saludRange') {
        const n = a.dataset.range === '28' ? 28 : 7;
        if (S.saludDias === n) return;
        const top = screenEl.scrollTop;
        S.saludDias = n;
        render();
        screenEl.scrollTop = top;
        return;
      }
      if (act === 'clearDone') {
        const c = C();
        const rev = Sync.nextRev();
        (c.items || []).forEach((x) => { if (x.done && !x.deleted) { x.deleted = true; x.rev = rev; } });
        saveC(c);
        return render();
      }
      if (act === 'share') {
        const txt = listaPendienteTexto().text;
        if (navigator.share) { try { await navigator.share({ text: txt }); return; } catch (e) { /* cancelado */ } }
        return openModal('<div class="modal-t">Lista para copiar</div><textarea class="share-ta" rows="8" readonly>' + esc(txt) + '</textarea>');
      }
      if (act === 'hazCesta') return hazLaCesta();
      if (act === 'undoCompra') return undoCompra();
      return settingsAction(act, a);
    }
    const avisoBtn = t.closest('[data-aviso]'); if (avisoBtn) return showAviso(+avisoBtn.dataset.aviso);
    const packBtn = t.closest('[data-pack]'); if (packBtn) return showPack(packBtn);
    const e = t.closest('[data-ev]'); if (e) return showEvent(e.dataset.ev);
    const da = t.closest('[data-dayall]'); if (da) return showDay(da.dataset.dayall);
    const ch = t.closest('[data-chore]'); if (ch) return toggleChore(ch.dataset.chore, ch.dataset.kid);
    const ask = t.closest('[data-ask]');
    if (ask) { const k = K(); k.pending.push({ id: U.uid(), kid: ask.dataset.kid, reward: ask.dataset.ask, at: Date.now(), rev: Sync.nextRev(), deleted: false }); saveK(k); toast('Pedido. Falta que lo apruebe un adulto.'); return render(); }
    const ap = t.closest('[data-approve]');
    if (ap) {
      if (!(await requirePin('PIN para aprobar el canje'))) return;
      const k = K(); const p = k.pending.find((x) => x.id === ap.dataset.approve); if (!p) return;
      const r = rewards().find((x) => x.id === p.reward); const kid = CFG.kids.find((x) => x.id === p.kid);
      if (r && (k.stars[p.kid] || 0) >= r.cost) {
        Sync.noteStar(k, p.kid, -r.cost);
        Sync.noteLog(k, hm(now()) + ' · ✅ ' + (kid ? kid.name : '') + ' canjea «' + r.name + '» (−' + r.cost + ' ⭐)');
        toast('¡Canje aprobado! 🎉');
      } else toast('No le llegan las estrellas');
      Sync.dropPending(k, p.id); saveK(k); return render();
    }
    const rj = t.closest('[data-reject]');
    if (rj) { const k = K(); Sync.dropPending(k, rj.dataset.reject); saveK(k); return render(); }
    const it = t.closest('[data-item]');
    if (it) return toggleItem(it.dataset.item);
    const hb = t.closest('[data-hab]'); if (hb) return addItem(hb.dataset.hab);
    const clearSlot = t.closest('[data-clear-slot]');
    if (clearSlot) { const slot = clearSlot.closest('[data-slot]'); if (slot) assignMeal(slot.dataset.day, slot.dataset.meal, ''); return; }
    const slot = t.closest('[data-slot]');
    if (slot) { S.menuPick = { day: slot.dataset.day, meal: slot.dataset.meal }; return render(); }
    const delDish = t.closest('[data-del-dish]');
    if (delDish) {
      const name = delDish.dataset.delDish;
      return updateMenu((m) => {
        m.dishes = m.dishes.filter((d) => d.toLowerCase() !== name.toLowerCase());
        Object.keys(m.plan || {}).forEach((k) => ['comida', 'cena'].forEach((meal) => {
          if (m.plan[k] && m.plan[k][meal] && m.plan[k][meal].toLowerCase() === name.toLowerCase()) m.plan[k][meal] = '';
        }));
      });
    }
    const dish = t.closest('[data-dish]');
    if (dish) {
      if (!S.menuPick) { toast('Falta elegir comida o cena'); return; }
      return assignMeal(S.menuPick.day, S.menuPick.meal, dish.dataset.dish);
    }
  });
  let dragDish = '';
  document.addEventListener('dragstart', (ev) => {
    const d = ev.target.closest && ev.target.closest('[data-dish]');
    if (!d || !ev.dataTransfer) return;
    dragDish = d.dataset.dish;
    ev.dataTransfer.setData('text/plain', d.dataset.dish);
    ev.dataTransfer.effectAllowed = 'copy';
  });
  document.addEventListener('dragover', (ev) => {
    const slot = ev.target.closest && ev.target.closest('[data-slot]');
    if (!slot) return;
    ev.preventDefault();
    document.querySelectorAll('.menu-slot.drag').forEach((el) => el.classList.remove('drag'));
    slot.classList.add('drag');
  });
  document.addEventListener('dragleave', (ev) => {
    const slot = ev.target.closest && ev.target.closest('[data-slot]');
    if (slot) slot.classList.remove('drag');
  });
  document.addEventListener('drop', (ev) => {
    const slot = ev.target.closest && ev.target.closest('[data-slot]');
    if (!slot) return;
    ev.preventDefault();
    slot.classList.remove('drag');
    const dish = (ev.dataTransfer && ev.dataTransfer.getData('text/plain')) || dragDish;
    if (dish) assignMeal(slot.dataset.day, slot.dataset.meal, dish);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); closeDrawer(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const rail = document.getElementById('rail');
    if (!rail || !rail.contains(document.activeElement)) return;
    const items = Array.prototype.slice.call(rail.querySelectorAll('button.nav'));
    const i = items.indexOf(document.activeElement);
    if (i < 0 || !items.length) return;
    e.preventDefault();
    let n = i;
    if (e.key === 'ArrowDown') n = (i + 1) % items.length;
    else if (e.key === 'ArrowUp') n = (i - 1 + items.length) % items.length;
    else if (e.key === 'Home') n = 0;
    else n = items.length - 1;
    items[n].focus();
  });

  /* ---------------- Reloj, noche y refresco ---------------- */
  function tickClocks() {
    const t = now();
    document.querySelectorAll('[data-clock="big"],[data-clock="night"]').forEach((el) => { if (el.textContent !== hm(t)) el.textContent = hm(t); });
    const r = $('[data-clock="rail"]'); if (r) r.innerHTML = pad(t.getHours()) + '<br>' + pad(t.getMinutes());
    const nd = $('[data-clock="nightdate"]'); if (nd) nd.textContent = U.fechaLarga(t);
    const nn = $('[data-clock="nightnext"]');
    if (nn) { const line = nightStartLine(t); if (nn.textContent !== line) nn.textContent = line; }
    const no = $('[data-clock="nightoutfit"]');
    if (no) { const line = nightOutfitLine(); if (no.textContent !== line) no.textContent = line; }
    applyTheme();
  }
  function nightStartLine(t) {
    const morning = t.getHours() >= 12 ? addDays(sod(t), 1) : sod(t);
    const label = t.getHours() >= 12 ? 'Mañana empieza con' : 'Hoy empieza con';
    const evs = eventsOn(morning).filter((e) => !e.background && !e.virtual);
    const first = evs.filter((e) => !e.allDay).sort((a, b) => a.start - b.start)[0] || evs[0];
    const extra = packPhrase(morning);
    if (!first) return label + ' · nada apuntado' + (extra ? ' · ' + extra : '');
    return label + ' · ' + (first.allDay ? 'todo el día' : hm(first.start)) + ' ' + first.title + (extra ? ' · ' + extra : '');
  }
  function nightOutfitLine() {
    const o = currentOutfit();
    return o ? Outfit.brief(o) : '';
  }
  function applyTheme() {
    const mode = settings.theme === 'dia' || settings.theme === 'noche' ? settings.theme : 'auto';
    const night = mode === 'noche' || (mode !== 'dia' && Casa.isNight(now(), Number(CFG.lat) || 42.85, Number(CFG.lon) || -2.67));
    document.documentElement.classList.toggle('theme-night', !!night);
    document.documentElement.setAttribute('data-theme', mode);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', night ? '#1A1816' : '#F7EEE2');
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
    // De día, 60 s sin tocar vuelve a Hoy (el reloj falso de las pruebas no avanza solo).
    if (!inNightWindow(t) && !S.sleeping && S.screen !== 'hoy' && S.screen !== 'ajustes' && Date.now() - (S.lastTouch || 0) > 60000 && !userBusy()) {
      S.screen = 'hoy';
      render();
    }
    if (t.getMinutes() !== lastMinute) {
      lastMinute = t.getMinutes();
      if (!userBusy()) render();
      // De noche, vuelve a «Hoy» tras 3 min sin tocar
      if (inNightWindow(t) && S.screen !== 'hoy' && S.screen !== 'ajustes' && Date.now() - (S.lastTouch || 0) > 3 * 60000 && !userBusy()) { S.screen = 'hoy'; render(); }
      const inW = inNightWindow(t);
      if (inW && Date.now() > S.wakeUntil && !S.sleeping) { sleep(true); S.autoSleep = true; }
      if (!inW && S.sleeping && S.autoSleep) { sleep(false); S.autoSleep = false; }
      // Recarga completa a las 04:00 para coger cambios del código y limpiar memoria
      if (t.getHours() === 4 && t.getMinutes() === 0 && !U.simulated) location.reload();
    }
  }, 1000);
  setInterval(() => {
    Promise.all([loadCalendars().catch(() => {}), Sync.syncNow().catch(() => {})]).then(() => { if (!userBusy()) render(); });
  }, 15 * 60000);
  setInterval(() => { loadWeather().then(() => loadAvisos()).then(() => loadOutfit()).then(() => { if (!userBusy()) render(); }).catch(() => {}); }, 30 * 60000);
  setInterval(() => { if (!syncReady()) return; loadSalud().then(() => { if (!userBusy()) render(); }).catch(() => {}); }, Salud.EVERY);
  window.addEventListener('resize', () => applyRail());
  setInterval(() => loadPVPC().then(() => { if (!userBusy()) render(); }), 60 * 60000);
  window.addEventListener('online', () => { paintOffline(); refreshAll(false); });
  window.addEventListener('offline', paintOffline);
  paintOffline();
  if ('serviceWorker' in navigator) {
    // Alcance = la carpeta de esta página (/podcasts/marco-v4/), no /marco/ ni marco-v2 ni marco-v3.
    const base = new URL('./', location.href);
    navigator.serviceWorker.register(new URL('sw.js', base), { scope: base.href }).catch(() => {});
  }

  Sync.attach({
    settings: function () { return settings; },
    onApplied: function () {
      if (S.screen === 'ajustes' || !$('#modal').classList.contains('hidden')) return;
      const a = document.activeElement;
      const sel = a && a.id ? a.id : '';
      const val = a && 'value' in a ? a.value : '';
      const start = a && a.selectionStart;
      render();
      if (!sel) return;
      const n = document.getElementById(sel);
      if (n && 'value' in n) {
        n.value = val;
        try { n.focus(); if (start != null) n.setSelectionRange(start, start); } catch (e) { /* el campo ya no está */ }
      }
    },
    onDataStatus: function (st) {
      S.syncDataStatus = st;
      store.set('cache.syncData', st);
      S.dataDown = !!(st && st.offline);
      S.syncDown = !!(S.dataDown || S.calDown);
      if (st && st.ok) S.syncCount = (S.syncCount || 0) + 1;
      paintOffline();
    },
    toast: toast,
    onOutfit: function (raw) {
      if (!syncReady()) return;
      applyOutfitPayload(raw);
      if (S.screen === 'ajustes' || !$('#modal').classList.contains('hidden') || userBusy()) return;
      render();
    }
  });

  // Arranque
  applyRail();
  primeSalud();
  primeAvisos();
  primeOutfit();
  primeSchool();
  applyTheme();
  const hash = (location.hash || '').replace('#', '');
  if (SCREENS[hash] && hash !== 'ajustes') S.screen = hash;
  render();
  refreshAll(false);

  // Para pruebas automáticas
  window.Marco = { S, CFG, settings, render, go, allEvents, eventsOn, custodyEvents, demoOn, syncReady, loadCalendars, loadSalud, loadAvisos, loadOutfit, showEvent, showAviso, morningLine, nightStartLine, nightOutfitLine, packDay, menuState, kidsHome, mealsFor, paintOffline, applyTheme, leavePlan, schoolOpt, SALUD_EVERY: Salud.EVERY, DAY_IDLE_MS: 60000 };
  document.addEventListener('error', (ev) => {
    const img = ev.target;
    if (!img || !img.classList || !img.classList.contains('outfit-img')) return;
    if (img.getAttribute('data-outfit-src')) return;
    outfitPh(img);
  }, true);
})();
