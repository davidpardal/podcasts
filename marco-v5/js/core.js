/* Marco familiar · núcleo: configuración, estado, datos y piezas comunes.
 * Sin framework ni compilación: los ficheros de js/ comparten el ámbito global del navegador
 * y se cargan en el orden de index.html (core, pantallas, main). */
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
  theme: 'auto', paleta: 'clasica', travelText: null, aisleText: null,
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
  outfit: null,
  casaTab: 'luz',
  ajustesOpen: {}
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
  // Si la carga termina mientras escribes en Ajustes o en un campo, no se repinta: se perdería lo tecleado.
  if (manual || !userBusy()) render();
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

/* ---------------- Modal de cita ---------------- */
function openModal(html, noClose, cls) {
  const m = $('#modal');
  m.innerHTML = '<div class="modal-card' + (cls ? ' ' + cls : '') + '">' + html + (noClose ? '' : '<div class="modal-f"><button class="btn close" data-close>Cerrar</button></div>') + '</div>';
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
