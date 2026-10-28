/**
 * Marco familiar v4 · puente con Google (calendarios + datos compartidos).
 * La compra por atajo vive en AtajoCompra.gs (mismo proyecto). No pongas la clave aquí.
 * Se pega en script.google.com. NO pongas aquí claves ni datos personales.
 * MARCO_KEY, GARMIN_PERSONAL_API_KEY y AEMET_API_KEY van en Propiedades del script
 * (Ajustes del proyecto). El script no las escribe en el registro ni las devuelve.
 * El outfit de mañana usa la misma MARCO_KEY (acción outfit). No hay otra clave.
 * El detalle del JSON está en OUTFIT.md.
 *
 * La mezcla es la misma que en js/sync.js (mergeState): por elemento,
 * gana la revisión más alta, y un borrado es una lápida para no resucitarlo.
 *
 * Calendarios de fondo: el nombre tal como se ve en Google Calendar.
 * En Ajustes del marco se puede cambiar por dispositivo (pisa esta lista).
 */
var BACKGROUND_CALENDARS = [
  // 'Trabajo',
  // 'Turnos'
];

var CHUNK = 6000;
var MAX_CHUNKS = 20;
var MAX_WEEKS = 16;
var MAX_EVENTS = 2000;

function doGet(e) {
  return handle_(e, null);
}

function doPost(e) {
  var body = {};
  var raw = '';
  try {
    if (e && e.postData && e.postData.contents) raw = String(e.postData.contents);
    if (raw) body = JSON.parse(raw);
  } catch (err) {
    // Texto del atajo («leche», «comprar pilas») o un formulario. AtajoCompra.gs.
    if (typeof atajoDesdeTexto_ === 'function') return atajoDesdeTexto_(e, raw);
    return json_({ ok: false, error: 'JSON no válido' });
  }
  return handle_(e, body);
}

/** Ejecútala una vez en el editor (▶) para comprobar la clave y ver los calendarios. No imprime la clave. */
function probar() {
  var key = PropertiesService.getScriptProperties().getProperty('MARCO_KEY');
  if (!key || String(key).length < 8) {
    throw new Error('Crea la propiedad MARCO_KEY (8 caracteres o más) en Ajustes del proyecto → Propiedades del script.');
  }
  var cals = calendariosVisibles_();
  Logger.log('Clave configurada. Calendarios visibles: ' + cals.map(function (c) { return c.getName(); }).join(', '));
  Logger.log('De fondo: ' + BACKGROUND_CALENDARS.join(', '));
  var garminListo = claveGarmin_().length > 0;
  Logger.log(garminListo ? 'Garmin: propiedad GARMIN_PERSONAL_API_KEY presente (no se muestra).' : 'Garmin: falta GARMIN_PERSONAL_API_KEY. Salud no tendrá datos.');
  var aemetListo = claveAemet_().length > 0;
  Logger.log(aemetListo ? 'AEMET: propiedad AEMET_API_KEY presente (no se muestra).' : 'AEMET: falta AEMET_API_KEY. No habrá avisos.');
  var outfitGuardado = leerOutfit_();
  Logger.log(outfitGuardado ? ('Outfit guardado para ' + outfitGuardado.forDate + ' (' + (outfitGuardado.pieces || []).length + ' piezas).') : 'Outfit: todavía no hay propuesta guardada.');
}

function handle_(e, body) {
  body = body || {};
  var params = (e && e.parameter) || {};
  var action = String(body.action || params.action || '');
  if (!action && (body.text || body.item || params.text || params.item)) action = 'compra';
  if (!action) action = 'ping';
  var key = String(body.key || params.key || '');
  var auth = claveOk_(key);
  if (!auth.ok) return json_({ ok: false, error: auth.error });

  try {
    if (action === 'ping') return json_({ ok: true, service: 'marco-v4' });
    if (action === 'calendars') return json_(calendarios_(body));
    if (action === 'sync') return json_(sincronizar_(body.state || {}));
    if (action === 'salud') return json_(salud_());
    if (action === 'avisos') return json_(avisos_());
    if (action === 'outfit') return json_(outfit_(body));
    if ((action === 'compra' || action === 'atajo') && typeof atajoCompra_ === 'function') return json_(atajoCompra_(body, params));
    return json_({ ok: false, error: 'Acción desconocida' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function claveOk_(got) {
  var expected = PropertiesService.getScriptProperties().getProperty('MARCO_KEY') || '';
  if (!expected) return { ok: false, error: 'El script no tiene clave (propiedad MARCO_KEY)' };
  if (!got) return { ok: false, error: 'Falta la clave' };
  if (!mismaClave_(expected, got)) return { ok: false, error: 'Clave incorrecta' };
  return { ok: true };
}

function mismaClave_(a, b) {
  a = String(a);
  b = String(b);
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Calendarios ---------- */

function calendarios_(body) {
  var win = ventana_(body);
  var metas = [];
  var events = [];
  var warnings = [];
  calendariosVisibles_().forEach(function (cal) {
    var name = '';
    var id = '';
    try {
      name = cal.getName();
      id = cal.getId();
      var bg = esFondo_(name);
      var color = color_(cal.getColor());
      metas.push({ id: id, name: name, color: color, background: bg });
      var evs = cal.getEvents(win.start, win.end);
      evs.forEach(function (ev) {
        if (events.length >= MAX_EVENTS) return;
        var start = ev.getStartTime();
        var end = ev.getEndTime();
        events.push({
          id: String(ev.getId()) + '@' + start.getTime(),
          title: ev.getTitle() || '(sin título)',
          start: start.toISOString(),
          end: end.toISOString(),
          startLocal: Utilities.formatDate(start, 'Europe/Madrid', "yyyy-MM-dd'T'HH:mm"),
          endLocal: Utilities.formatDate(end, 'Europe/Madrid', "yyyy-MM-dd'T'HH:mm"),
          allDay: ev.isAllDayEvent(),
          location: String(ev.getLocation() || '').slice(0, 300),
          description: plano_(ev.getDescription() || ''),
          calId: id,
          calName: name,
          color: color,
          background: bg
        });
      });
    } catch (err) {
      warnings.push(name || id || 'calendario');
    }
  });
  return {
    ok: true,
    from: win.start.toISOString(),
    to: win.end.toISOString(),
    calendars: metas,
    events: events,
    truncated: events.length >= MAX_EVENTS,
    warnings: warnings
  };
}

function calendariosVisibles_() {
  var all = CalendarApp.getAllCalendars();
  var vis = all.filter(function (c) {
    try { return c.isSelected(); } catch (e) { return true; }
  });
  return vis.length ? vis : all;
}

function esFondo_(name) {
  var n = String(name || '').trim().toLowerCase();
  return BACKGROUND_CALENDARS.some(function (x) { return String(x || '').trim().toLowerCase() === n; });
}

function color_(c) {
  var s = String(c || '').trim();
  return /^#[0-9a-f]{6}$/i.test(s) ? s : '#C8243B';
}

function plano_(s) {
  return String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').slice(0, 2000);
}

function ventana_(body) {
  var now = new Date();
  var start = body && body.start ? new Date(body.start) : new Date(now.getTime() - 7 * 86400000);
  var end = body && body.end ? new Date(body.end) : new Date(now.getTime() + 13 * 7 * 86400000);
  if (isNaN(start.getTime())) start = new Date(now.getTime() - 7 * 86400000);
  if (isNaN(end.getTime())) end = new Date(now.getTime() + 13 * 7 * 86400000);
  var maxEnd = new Date(start.getTime() + MAX_WEEKS * 7 * 86400000);
  if (end.getTime() > maxEnd.getTime()) end = maxEnd;
  if (end.getTime() <= start.getTime()) end = new Date(start.getTime() + 13 * 7 * 86400000);
  return { start: start, end: end };
}

/* ---------- Datos compartidos ---------- */

function sincronizar_(incoming) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    throw new Error('Falta el estado');
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Prueba otra vez en unos segundos');
  try {
    var stored = loadState_();
    var merged = mergeState_(stored, incoming);
    saveState_(merged);
    return { ok: true, state: merged, outfit: leerOutfit_() };
  } finally {
    lock.releaseLock();
  }
}

function loadState_() {
  var props = PropertiesService.getScriptProperties();
  var n = parseInt(props.getProperty('MARCO_STATE_N') || '0', 10);
  if (!n) return {};
  var parts = [];
  for (var i = 0; i < n; i++) parts.push(props.getProperty('MARCO_STATE_' + i) || '');
  try { return JSON.parse(parts.join('')) || {}; } catch (e) { return {}; }
}

function saveState_(state) {
  var json = JSON.stringify(state);
  var n = Math.max(1, Math.ceil(json.length / CHUNK));
  if (n > MAX_CHUNKS) throw new Error('Los datos compartidos no caben. Quita cosas antiguas de la lista.');
  var props = PropertiesService.getScriptProperties();
  var prev = parseInt(props.getProperty('MARCO_STATE_N') || '0', 10);
  for (var i = 0; i < n; i++) props.setProperty('MARCO_STATE_' + i, json.substring(i * CHUNK, (i + 1) * CHUNK));
  for (var j = n; j < prev; j++) props.deleteProperty('MARCO_STATE_' + j);
  props.setProperty('MARCO_STATE_N', String(n));
}

/* Mezcla. Misma regla que mergeState en js/sync.js: el segundo argumento gana si la revisión empata. */

function num_(n) { return typeof n === 'number' && isFinite(n) ? n : 0; }

function mergeState_(local, remote) {
  local = local || {};
  remote = remote || {};
  return {
    compra: mergeCompra_(local.compra, remote.compra),
    menu: mergeMenu_(local.menu, remote.menu),
    ninos: mergeNinos_(local.ninos, remote.ninos),
    hechas: mergeHechas_(local.hechas, remote.hechas)
  };
}

function mergeById_(a, b) {
  var map = {};
  var order = [];
  function add(list) {
    (list || []).forEach(function (item) {
      if (!item || item.id == null || item.id === '') return;
      var id = String(item.id);
      if (!map[id]) order.push(id);
      if (!map[id] || num_(item.rev) >= num_(map[id].rev)) map[id] = item;
    });
  }
  add(a);
  add(b);
  return order.map(function (id) { return map[id]; });
}

function normItem_(it) {
  if (!it || !it.id) return null;
  return {
    id: String(it.id),
    name: String(it.name || ''),
    done: !!it.done,
    deleted: !!it.deleted,
    at: num_(it.at),
    rev: typeof it.rev === 'number' ? it.rev : num_(it.at)
  };
}

function mergeCompra_(a, b) {
  a = a || {};
  b = b || {};
  var items = mergeById_(
    (a.items || []).map(normItem_).filter(Boolean),
    (b.items || []).map(normItem_).filter(Boolean)
  );
  var cutoff = Date.now() * 1000 - 90 * 86400000 * 1000;
  var kept = items.filter(function (it) { return !(it.deleted && num_(it.rev) < cutoff); });
  var counts = {};
  [a.counts || {}, b.counts || {}].forEach(function (src) {
    Object.keys(src).forEach(function (k) { counts[k] = Math.max(num_(counts[k]), num_(src[k])); });
  });
  return { items: kept, counts: counts };
}

function dishKey_(name) { return String(name || '').trim().toLowerCase(); }

function considerDish_(into, key, name, rev, deleted) {
  var prev = into[key];
  if (!prev || rev >= prev.rev) {
    into[key] = { name: (!deleted && name) ? name : (prev && prev.name) || name || key, rev: rev, deleted: !!deleted };
  }
}

function collectDishes_(src, into) {
  var names = Array.isArray(src.dishes) ? src.dishes : [];
  var meta = src.dishMeta || {};
  var seen = {};
  names.forEach(function (n) {
    var k = dishKey_(n);
    if (!k) return;
    seen[k] = true;
    considerDish_(into, k, String(n).trim(), meta[k] ? num_(meta[k].rev) : 0, false);
  });
  Object.keys(meta).forEach(function (k) {
    if (seen[k] || !meta[k] || !meta[k].deleted) return;
    considerDish_(into, k, k, num_(meta[k].rev), true);
  });
}

function mergeMenu_(a, b) {
  a = a || {};
  b = b || {};
  var ra = num_(a.spanRev);
  var rb = num_(b.spanRev);
  var src = rb >= ra ? b : a;
  var into = {};
  collectDishes_(a, into);
  collectDishes_(b, into);
  var dishes = [];
  var dishMeta = {};
  Object.keys(into).forEach(function (k) {
    dishMeta[k] = { rev: into[k].rev, deleted: !!into[k].deleted };
    if (!into[k].deleted) dishes.push(into[k].name);
  });
  var plan = {};
  for (var i = 0; i < 7; i++) {
    var ka = (a.plan && a.plan[String(i)]) || {};
    var kb = (b.plan && b.plan[String(i)]) || {};
    var row = {};
    ['comida', 'cena'].forEach(function (meal) {
      var rva = num_(ka[meal + 'Rev']);
      var rvb = num_(kb[meal + 'Rev']);
      if (rvb >= rva) { row[meal] = kb[meal] || ''; row[meal + 'Rev'] = rvb; }
      else { row[meal] = ka[meal] || ''; row[meal + 'Rev'] = rva; }
    });
    plan[String(i)] = row;
  }
  return { span: src.span === 5 ? 5 : 7, spanRev: Math.max(ra, rb), dishes: dishes, dishMeta: dishMeta, plan: plan };
}

function prepNinos_(raw) {
  raw = raw || {};
  var k = {
    stars: raw.stars || {},
    starLog: raw.starLog,
    done: raw.done || {},
    doneMeta: raw.doneMeta,
    pending: Array.isArray(raw.pending) ? raw.pending.map(function (p) {
      p = p || {};
      return {
        id: p.id, kid: p.kid, reward: p.reward, at: num_(p.at),
        deleted: !!p.deleted, rev: typeof p.rev === 'number' ? p.rev : num_(p.at)
      };
    }) : [],
    log: raw.log
  };
  if (!Array.isArray(k.starLog)) {
    k.starLog = [];
    Object.keys(k.stars || {}).forEach(function (kid) {
      var n = num_(k.stars[kid]);
      if (n) k.starLog.push({ id: 'base-' + kid, kid: kid, delta: n, at: 1, kind: 'delta' });
    });
  }
  if (!k.doneMeta || typeof k.doneMeta !== 'object') {
    k.doneMeta = {};
    Object.keys(k.done || {}).forEach(function (day) {
      Object.keys(k.done[day] || {}).forEach(function (chore) {
        (k.done[day][chore] || []).forEach(function (kid) {
          k.doneMeta[day + '|' + chore + '|' + kid] = { on: true, rev: 1 };
        });
      });
    });
  }
  k.log = normLog_(k.log);
  return k;
}

function hashText_(s) {
  var h = 0;
  s = String(s || '');
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function normLog_(log) {
  return (log || []).map(function (l) {
    if (typeof l === 'string') return { id: 'legacy-' + hashText_(l), text: l, at: 0 };
    if (!l || !l.id) return null;
    return { id: String(l.id), text: String(l.text || ''), at: num_(l.at) };
  }).filter(Boolean);
}

function starsFromLog_(log) {
  var resetAt = 0;
  (log || []).forEach(function (op) { if (op && op.kind === 'reset') resetAt = Math.max(resetAt, num_(op.at)); });
  var sums = {};
  (log || []).forEach(function (op) {
    if (!op || op.kind === 'reset' || !op.kid || num_(op.at) <= resetAt) return;
    sums[op.kid] = (sums[op.kid] || 0) + num_(op.delta);
  });
  Object.keys(sums).forEach(function (kid) { if (sums[kid] < 0) sums[kid] = 0; });
  return sums;
}

function compactStarLog_(log) {
  var resetAt = 0;
  (log || []).forEach(function (op) { if (op && op.kind === 'reset') resetAt = Math.max(resetAt, num_(op.at)); });
  return (log || []).filter(function (op) {
    if (!op || !op.id) return false;
    if (op.kind === 'reset') return num_(op.at) === resetAt;
    return num_(op.at) > resetAt;
  });
}

function rebuildDone_(meta) {
  var done = {};
  Object.keys(meta || {}).forEach(function (key) {
    var m = meta[key];
    if (!m || !m.on) return;
    var parts = key.split('|');
    if (parts.length < 3) return;
    var day = parts[0], chore = parts[1], kid = parts.slice(2).join('|');
    done[day] = done[day] || {};
    done[day][chore] = done[day][chore] || [];
    if (done[day][chore].indexOf(kid) === -1) done[day][chore].push(kid);
  });
  return done;
}

function dayCutoff_(days) {
  return Utilities.formatDate(new Date(Date.now() - days * 86400000), 'Europe/Madrid', 'yyyy-MM-dd');
}

function mergeNinos_(a, b) {
  var pa = prepNinos_(a);
  var pb = prepNinos_(b);
  var starMap = {};
  [pa.starLog, pb.starLog].forEach(function (list) {
    (list || []).forEach(function (op) { if (op && op.id) starMap[op.id] = op; });
  });
  var starLog = compactStarLog_(Object.keys(starMap).map(function (id) { return starMap[id]; }));
  var doneMeta = {};
  [pa.doneMeta, pb.doneMeta].forEach(function (meta) {
    Object.keys(meta || {}).forEach(function (key) {
      var m = meta[key];
      if (!m) return;
      if (!doneMeta[key] || num_(m.rev) >= num_(doneMeta[key].rev)) doneMeta[key] = { on: !!m.on, rev: num_(m.rev) };
    });
  });
  var cutoff = dayCutoff_(45);
  Object.keys(doneMeta).forEach(function (key) { if (key.split('|')[0] < cutoff) delete doneMeta[key]; });
  var pending = mergeById_(pa.pending, pb.pending).filter(function (p) {
    return !(p.deleted && num_(p.rev) < Date.now() * 1000 - 90 * 86400000 * 1000);
  });
  var logMap = {};
  [pa.log, pb.log].forEach(function (list) {
    (list || []).forEach(function (l) {
      if (!logMap[l.id] || num_(l.at) >= num_(logMap[l.id].at)) logMap[l.id] = l;
    });
  });
  var log = Object.keys(logMap).map(function (id) { return logMap[id]; });
  log.sort(function (x, y) { return num_(x.at) - num_(y.at); });
  log = log.slice(-50);
  return { stars: starsFromLog_(starLog), starLog: starLog, done: rebuildDone_(doneMeta), doneMeta: doneMeta, pending: pending, log: log };
}

function normHecha_(v) {
  if (v == null || v === false) return null;
  if (typeof v === 'object') return { on: !!v.on, rev: num_(v.rev) };
  return { on: true, rev: num_(v) || 1 };
}

function mergeHechas_(a, b) {
  var out = {};
  [a || {}, b || {}].forEach(function (map) {
    Object.keys(map).forEach(function (id) {
      var v = normHecha_(map[id]);
      if (!v) return;
      if (!out[id] || v.rev >= out[id].rev) out[id] = v;
    });
  });
  var cutoff = Date.now() - 90 * 86400000;
  Object.keys(out).forEach(function (id) {
    var ts = +String(id).split('@').pop();
    if (ts && ts < cutoff) delete out[id];
  });
  return out;
}

/* ---------- Salud (Garmin Personal API) ----------
 * La clave GARMIN_PERSONAL_API_KEY solo se lee de Propiedades del script.
 * El JWT vive en CacheService hasta ~5 min antes de exp. No se registra ni se devuelve.
 * Cualquier fallo de Garmin devuelve la última respuesta buena con stale:true.
 * La respuesta trae 28 días (hoy incluido). Un día sin medida no lleva ese campo:
 * el marco lo pinta como un corte, no como cero. El peso va en gramos.
 * `previous.avg` es la media del periodo anterior (otros 28 días), para la variación.
 */

var GARMIN_BASE = 'https://personal.connectapi.garmin.com';
var GARMIN_TOKEN_URL = GARMIN_BASE + '/personalapitoken-service/personal-api/personal-api-key/token';
var GARMIN_SALUD_KEY = 'mv2-garmin-salud-28';

function claveGarmin_() {
  return String(PropertiesService.getScriptProperties().getProperty('GARMIN_PERSONAL_API_KEY') || '').trim();
}

function salud_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(GARMIN_SALUD_KEY);
  if (hit) {
    try {
      var parsed = JSON.parse(hit);
      if (parsed && parsed.days) {
        parsed.ok = true;
        parsed.stale = false;
        return parsed;
      }
    } catch (e) { /* caché rota: se pide otra vez */ }
  }
  if (!claveGarmin_()) return saludAntiguo_();
  try {
    var data = construirSalud_();
    var json = JSON.stringify(data);
    cache.put(GARMIN_SALUD_KEY, json, 1800);
    try { guardarCopiaSalud_(json); } catch (e2) { /* la copia de 30 min basta */ }
    return data;
  } catch (err) {
    try { cache.remove('mv2-garmin-jwt'); } catch (e3) { /* sin caché de token */ }
    return saludAntiguo_();
  }
}

function guardarCopiaSalud_(json) {
  var props = PropertiesService.getScriptProperties();
  var n = Math.max(1, Math.ceil(json.length / CHUNK));
  if (n > 4) return;
  var prev = parseInt(props.getProperty('GARMIN_SALUD_N') || '0', 10);
  for (var i = 0; i < n; i++) props.setProperty('GARMIN_SALUD_' + i, json.substring(i * CHUNK, (i + 1) * CHUNK));
  for (var j = n; j < prev; j++) props.deleteProperty('GARMIN_SALUD_' + j);
  props.setProperty('GARMIN_SALUD_N', String(n));
  try { props.deleteProperty('GARMIN_SALUD_LAST'); } catch (e) { /* la copia vieja, de una sola propiedad, ya no hace falta */ }
}

function leerCopiaSalud_() {
  var props = PropertiesService.getScriptProperties();
  var n = parseInt(props.getProperty('GARMIN_SALUD_N') || '0', 10);
  if (n > 0) {
    var parts = [];
    for (var i = 0; i < n; i++) parts.push(props.getProperty('GARMIN_SALUD_' + i) || '');
    return parts.join('');
  }
  return props.getProperty('GARMIN_SALUD_LAST') || '';
}

function saludAntiguo_() {
  var last = '';
  try { last = leerCopiaSalud_(); } catch (e) { last = ''; }
  if (!last) {
    try {
      var cache = CacheService.getScriptCache();
      last = cache.get(GARMIN_SALUD_KEY) || cache.get('mv2-garmin-salud') || '';
    } catch (e2) { last = ''; }
  }
  if (last) {
    try {
      var old = JSON.parse(last);
      if (old && old.days) {
        old.ok = true;
        old.stale = true;
        return old;
      }
    } catch (e3) { /* se ignora */ }
  }
  return { ok: false, error: 'Sin datos de Garmin' };
}

function construirSalud_() {
  try {
    return pedirSalud_(garminToken_(false));
  } catch (e) {
    try { CacheService.getScriptCache().remove('mv2-garmin-jwt'); } catch (e2) { /* sigue */ }
    return pedirSalud_(garminToken_(true));
  }
}

function garminToken_(force) {
  var cache = CacheService.getScriptCache();
  if (!force) {
    var cached = cache.get('mv2-garmin-jwt');
    if (cached) return cached;
  }
  var key = claveGarmin_();
  if (!key) throw new Error('garmin-no-key');
  var res = UrlFetchApp.fetch(GARMIN_TOKEN_URL, {
    method: 'post',
    headers: { Authorization: 'ApiKey ' + key, Accept: 'text/plain, application/json' },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) throw new Error('garmin-http');
  var token = limpiaToken_(res.getContentText() || '');
  if (!token || token.split('.').length < 3) throw new Error('garmin-token');
  var ttl = tokenTtl_(token);
  if (ttl >= 60) cache.put('mv2-garmin-jwt', token, Math.min(21600, Math.floor(ttl)));
  return token;
}

function limpiaToken_(body) {
  var s = String(body || '').replace(/^\uFEFF/, '').trim();
  if (!s) return '';
  if (s.charAt(0) === '{' || s.charAt(0) === '"') {
    try {
      var j = JSON.parse(s);
      if (typeof j === 'string') s = j.trim();
      else if (j && typeof j.token === 'string') s = String(j.token).trim();
      else if (j && typeof j.access_token === 'string') s = String(j.access_token).trim();
    } catch (e) { /* el cuerpo ya es el JWT en texto */ }
  }
  if (s.indexOf('Bearer ') === 0) s = s.slice(7).trim();
  return s;
}

function tokenTtl_(token) {
  var exp = jwtExp_(token);
  var now = Math.floor(Date.now() / 1000);
  if (!exp) return 600;
  if (exp <= now + 15) throw new Error('garmin-token');
  var ttl = exp - now - 300;
  return ttl > 0 ? ttl : 0;
}

function jwtExp_(token) {
  try {
    var part = String(token).split('.')[1] || '';
    part = part.replace(/-/g, '+').replace(/_/g, '/');
    while (part.length % 4) part += '=';
    var json = Utilities.newBlob(Utilities.base64Decode(part)).getDataAsString();
    var payload = JSON.parse(json);
    var exp = Number(payload && payload.exp);
    return isFinite(exp) ? exp : 0;
  } catch (e) {
    return 0;
  }
}

function pedirSalud_(token) {
  var today = Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyy-MM-dd');
  var start = addDaysIso_(today, -27);
  var prevEnd = addDaysIso_(today, -28);
  var prevStart = addDaysIso_(today, -55);
  var qNow = 'startDate=' + encodeURIComponent(start) + '&endDate=' + encodeURIComponent(today);
  var qPrev = 'startDate=' + encodeURIComponent(prevStart) + '&endDate=' + encodeURIComponent(prevEnd);
  var qAll = 'startDate=' + encodeURIComponent(prevStart) + '&endDate=' + encodeURIComponent(today);
  var calls = [
    { path: '/activitylist-service/activities/search/activities?start=0&limit=50&' + qAll, optional: true },
    { path: '/usersummary-service/v2/dailysummaries?' + qAll, optional: false },
    { path: '/sleep-service/sleep/dailySleepSummariesByDate?' + qNow, optional: false },
    { path: '/sleep-service/sleep/dailySleepSummariesByDate?' + qPrev, optional: true },
    { path: '/hrv-service/hrv/daily/' + encodeURIComponent(prevStart) + '/' + encodeURIComponent(today), optional: false },
    { path: '/weight-service/weight/range/' + encodeURIComponent(prevStart) + '/' + encodeURIComponent(today) + '?includeAll=true', optional: true }
  ];
  var reqs = calls.map(function (c) {
    return {
      url: GARMIN_BASE + c.path,
      method: 'get',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      muteHttpExceptions: true
    };
  });
  var res = UrlFetchApp.fetchAll(reqs);
  var payloads = [];
  for (var i = 0; i < res.length; i++) payloads.push(leeJson_(res[i], calls[i].optional));
  var activities = payloads[0];
  if (asList_(activities, ['activities']).length >= 50) {
    try {
      var more = UrlFetchApp.fetch(GARMIN_BASE + '/activitylist-service/activities/search/activities?start=50&limit=50&' + qAll, {
        method: 'get',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        muteHttpExceptions: true
      });
      activities = juntarActividades_(activities, leeJson_(more, true));
    } catch (e) { /* con la primera página de entrenos basta */ }
  }
  return compactarSalud_(activities, payloads[1], payloads[2], payloads[3], payloads[4], payloads[5], start, prevStart, prevEnd, today);
}

function leeJson_(res, optional) {
  var code = res.getResponseCode();
  if (code === 401 || code === 403) {
    if (optional) return null;
    throw new Error('garmin-http');
  }
  if (code < 200 || code >= 300) {
    if (optional) return null;
    throw new Error('garmin-http');
  }
  var text = res.getContentText() || '';
  if (!text) return optional ? null : {};
  try { return JSON.parse(text); } catch (e) {
    if (optional) return null;
    throw new Error('garmin-json');
  }
}

function juntarActividades_(a, b) {
  var left = asList_(a, ['activities']);
  var right = asList_(b, ['activities']);
  if (!right.length) return a || [];
  return left.concat(right);
}

function addDaysIso_(iso, delta) {
  var p = String(iso).split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  d.setUTCDate(d.getUTCDate() + delta);
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}

function asList_(payload, keys) {
  if (!payload) return [];
  if (Object.prototype.toString.call(payload) === '[object Array]') return payload;
  if (typeof payload !== 'object') return [];
  for (var i = 0; i < keys.length; i++) {
    if (Object.prototype.toString.call(payload[keys[i]]) === '[object Array]') return payload[keys[i]];
  }
  var names = Object.keys(payload);
  for (var j = 0; j < names.length; j++) {
    if (Object.prototype.toString.call(payload[names[j]]) === '[object Array]') return payload[names[j]];
  }
  if (payload.calendarDate || payload.startTimeLocal) return [payload];
  return [];
}

function unwrap_(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v === 'string') {
    var n = Number(v);
    return v.trim() !== '' && isFinite(n) ? n : null;
  }
  if (typeof v === 'object') {
    if (v.value != null) return unwrap_(v.value);
    return null;
  }
  return null;
}

function descend_(obj, keys) {
  var cur = obj;
  for (var i = 0; i < keys.length; i++) {
    if (cur == null || typeof cur !== 'object') return null;
    if (cur[keys[i]] == null && cur.value != null && typeof cur.value === 'object') cur = cur.value;
    cur = cur[keys[i]];
  }
  return unwrap_(cur);
}

function entero_(v) {
  var n = typeof v === 'number' ? v : unwrap_(v);
  if (n == null || !isFinite(n)) return null;
  return Math.round(n);
}

function textoEstado_(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'object') {
    if (typeof v.value === 'string') return v.value.trim() || null;
    if (typeof v.status === 'string') return v.status.trim() || null;
    if (v.status != null) return textoEstado_(v.status);
  }
  return null;
}

function corto_(s, n) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, n || 80);
}

function diaVacio_(date) {
  return {
    date: date,
    steps: null,
    restingHr: null,
    bodyBatteryMin: null,
    bodyBatteryMax: null,
    bodyBatteryCharged: null,
    sleepSeconds: null,
    sleepScore: null,
    deepSeconds: null,
    lightSeconds: null,
    remSeconds: null,
    awakeSeconds: null,
    hrv: null,
    hrvWeekly: null,
    hrvStatus: null,
    weightGrams: null,
    trainingSeconds: null
  };
}

function dentro_(date, start, end) {
  return !!date && date >= start && date <= end;
}

function aplicarSueno_(map, sleep) {
  asList_(sleep, ['dailySleepSummaries', 'sleepSummaries', 'data']).forEach(function (row) {
    if (!row) return;
    var date = String(row.calendarDate || '').slice(0, 10);
    if (!map[date]) return;
    var day = map[date];
    day.sleepSeconds = entero_(row.sleepTimeSeconds);
    day.deepSeconds = entero_(row.deepSleepSeconds);
    day.lightSeconds = entero_(row.lightSleepSeconds);
    day.remSeconds = entero_(row.remSleepSeconds);
    day.awakeSeconds = entero_(row.awakeSleepSeconds);
    var scores = row.sleepScores;
    if (scores && typeof scores === 'object') day.sleepScore = entero_(scores.overall != null ? scores.overall : scores);
    else day.sleepScore = entero_(scores);
  });
}

function fechaPeso_(row) {
  if (!row || typeof row !== 'object') return '';
  var d = row.summaryDate || row.calendarDate || '';
  if (!d && row.latestWeight && row.latestWeight.calendarDate) d = row.latestWeight.calendarDate;
  if (!d && typeof row.date === 'string') d = row.date;
  return String(d || '').slice(0, 10);
}

function marcaPeso_(row) {
  if (!row || typeof row !== 'object') return 0;
  var src = row.latestWeight && typeof row.latestWeight === 'object' ? row.latestWeight : row;
  var t = Number(src.timestampGMT || src.samplePk || 0);
  if (!isFinite(t) || t <= 0) t = Number(src.date);
  return isFinite(t) ? t : 0;
}

/* Garmin manda el peso en gramos. Si el número es de una báscula en kg (menos de 500), se pasa a gramos. */
function gramosPeso_(row) {
  if (row == null || row === '') return null;
  var raw = null;
  if (typeof row === 'number' || typeof row === 'string') raw = unwrap_(row);
  else if (typeof row === 'object') {
    raw = unwrap_(row.weight);
    if (raw == null && row.latestWeight != null) raw = gramosPeso_(row.latestWeight);
    if (raw == null && row.value != null) raw = unwrap_(row.value.weight != null ? row.value.weight : row.value);
  }
  if (raw == null || !isFinite(raw) || raw <= 0) return null;
  if (raw < 500) raw = raw * 1000;
  return Math.round(raw);
}

function filasPeso_(payload) {
  if (!payload) return [];
  var summaries = asList_(payload, ['dailyWeightSummaries', 'weightSummaries']);
  var looksDaily = summaries.length && (summaries[0].latestWeight != null || summaries[0].summaryDate || summaries[0].minWeight != null);
  var rows = looksDaily ? summaries : asList_(payload, ['allWeightMetrics', 'weightMetrics', 'weights', 'dateWeightList']);
  return rows.map(function (row) {
    var src = looksDaily && row.latestWeight != null ? row.latestWeight : row;
    return { date: fechaPeso_(row), grams: gramosPeso_(src), at: marcaPeso_(row) };
  });
}

function aplicarPeso_(map, payload) {
  var best = {};
  filasPeso_(payload).forEach(function (p) {
    if (!p.date || !map[p.date] || p.grams == null) return;
    var prev = best[p.date];
    if (!prev || p.at >= prev.at) best[p.date] = p;
  });
  Object.keys(best).forEach(function (d) { map[d].weightGrams = best[d].grams; });
}

function mediaCampo_(rows, key) {
  var sum = 0;
  var n = 0;
  rows.forEach(function (row) {
    var v = row ? row[key] : null;
    if (v == null || !isFinite(v)) return;
    sum += v;
    n++;
  });
  if (!n) return null;
  return Math.round(sum / n);
}

function sinNulos_(day) {
  var out = { date: day.date };
  Object.keys(day).forEach(function (k) {
    if (k === 'date' || day[k] == null || day[k] === '') return;
    out[k] = day[k];
  });
  return out;
}

function compactarSalud_(activities, summaries, sleepNow, sleepPrev, hrv, weight, start, prevStart, prevEnd, today) {
  var shown = [];
  var prevDates = [];
  for (var i = 27; i >= 0; i--) shown.push(addDaysIso_(today, -i));
  for (var j = 55; j >= 28; j--) prevDates.push(addDaysIso_(today, -j));
  var map = {};
  shown.concat(prevDates).forEach(function (d) { map[d] = diaVacio_(d); });
  var stepsGoal = null;
  var stepsGoalDate = '';

  asList_(summaries, ['data', 'dailySummaries', 'summaries']).forEach(function (row) {
    if (!row) return;
    var date = String(row.calendarDate || '').slice(0, 10);
    if (!map[date]) return;
    var day = map[date];
    var steps = entero_(descend_(row, ['movement', 'steps']));
    if (steps == null) steps = entero_(row.totalSteps);
    day.steps = steps;
    var rhr = entero_(descend_(row, ['heartRate', 'restingValue']));
    if (rhr == null) rhr = entero_(row.restingHeartRate);
    day.restingHr = rhr;
    day.bodyBatteryMin = entero_(descend_(row, ['bodyBattery', 'minValue']));
    day.bodyBatteryMax = entero_(descend_(row, ['bodyBattery', 'maxValue']));
    var bbNow = entero_(descend_(row, ['bodyBattery', 'chargedValue']));
    if (bbNow == null) bbNow = entero_(descend_(row, ['bodyBattery', 'currentValue']));
    if (bbNow == null) bbNow = entero_(descend_(row, ['bodyBattery', 'mostRecentValue']));
    day.bodyBatteryCharged = bbNow;
    var goal = entero_(descend_(row, ['movement', 'stepGoal']));
    if (goal == null) goal = entero_(descend_(row, ['movement', 'goal']));
    if (goal == null) goal = entero_(descend_(row, ['movement', 'stepsGoal']));
    if (goal != null && date >= stepsGoalDate) { stepsGoal = goal; stepsGoalDate = date; }
  });

  aplicarSueno_(map, sleepPrev);
  aplicarSueno_(map, sleepNow);

  asList_(hrv, ['hrvSummaries']).forEach(function (row) {
    if (!row) return;
    var date = String(row.calendarDate || '').slice(0, 10);
    if (!map[date]) return;
    var day = map[date];
    day.hrv = entero_(row.lastNightAvg);
    day.hrvWeekly = entero_(row.weeklyAvg);
    day.hrvStatus = textoEstado_(row.status);
  });

  aplicarPeso_(map, weight);

  var workouts = [];
  asList_(activities, ['activities']).forEach(function (a) {
    if (!a) return;
    var startLocal = corto_(a.startTimeLocal, 32);
    var date = (startLocal.match(/^(\d{4}-\d{2}-\d{2})/) || [null, ''])[1];
    if (!dentro_(date, prevStart, today) || !map[date]) return;
    var dur = entero_(a.duration);
    if (dur != null) {
      if (map[date].trainingSeconds == null) map[date].trainingSeconds = 0;
      map[date].trainingSeconds += dur;
    }
    if (!dentro_(date, start, today)) return;
    var typeKey = '';
    if (a.activityType && typeof a.activityType === 'object' && a.activityType.typeKey) typeKey = corto_(a.activityType.typeKey, 40);
    else if (typeof a.activityType === 'string') typeKey = corto_(a.activityType, 40);
    workouts.push({
      date: date,
      start: startLocal,
      type: typeKey,
      name: corto_(a.activityName || typeKey || 'Actividad', 80),
      duration: dur,
      distance: entero_(a.distance),
      avgHr: entero_(a.averageHR),
      calories: entero_(a.calories)
    });
  });
  workouts.sort(function (a, b) { return String(b.start || b.date).localeCompare(String(a.start || a.date)); });
  if (workouts.length > 7) workouts = workouts.slice(0, 7);

  var avg = {};
  ['steps', 'restingHr', 'hrv', 'weightGrams', 'sleepSeconds', 'trainingSeconds'].forEach(function (key) {
    var m = mediaCampo_(prevDates.map(function (d) { return map[d]; }), key);
    if (m != null) avg[key] = m;
  });

  return {
    ok: true,
    stale: false,
    fetchedAt: new Date().toISOString(),
    from: shown[0],
    to: today,
    stepsGoal: stepsGoal,
    days: shown.map(function (d) { return sinNulos_(map[d]); }),
    previous: { from: prevStart, to: prevEnd, avg: avg },
    workouts: workouts
  };
}

/* ---------- Avisos AEMET (OpenData, CAP) ----------
 * La clave AEMET_API_KEY solo se lee de Propiedades del script.
 * No se escribe en el registro ni se devuelve al marco.
 * Área por defecto: eus (País Vasco). Se queda lo naranja y lo rojo de Álava / Vitoria.
 * Si AEMET falla, ok:false y el marco no pinta chip.
 */

var AEMET_AVISOS_URL = 'https://opendata.aemet.es/opendata/api/avisos_cap/ultimoelaborado/area/';
var AEMET_CACHE_KEY = 'mv2-aemet-avisos';

function claveAemet_() {
  return String(PropertiesService.getScriptProperties().getProperty('AEMET_API_KEY') || '').trim();
}

function areaAemet_() {
  var raw = String(PropertiesService.getScriptProperties().getProperty('AEMET_AREA') || 'eus').trim().toLowerCase();
  return /^[a-z]{2,8}$/.test(raw) ? raw : 'eus';
}

function foldAemet_(s) {
  return String(s || '').toLowerCase()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o')
    .replace(/ú/g, 'u').replace(/ü/g, 'u').replace(/ñ/g, 'n');
}

function avisoFallo_(msg, key) {
  var s = String(msg || 'Sin avisos de AEMET');
  if (key) s = s.split(key).join('…');
  return { ok: false, error: s.slice(0, 180) };
}

function avisos_() {
  var key = claveAemet_();
  if (!key) return { ok: true, alerts: [], configured: false };
  var cache = CacheService.getScriptCache();
  var hit = cache.get(AEMET_CACHE_KEY);
  if (hit) {
    try { return JSON.parse(hit); } catch (e) { /* caché rara: se pide otra vez */ }
  }
  try {
    var area = areaAemet_();
    var url = AEMET_AVISOS_URL + area + '?api_key=' + encodeURIComponent(key);
    var first = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    var code = first.getResponseCode();
    var metaText = first.getContentText() || '';
    if (code < 200 || code >= 300) return avisoFallo_('AEMET no responde', key);
    var meta = {};
    try { meta = JSON.parse(metaText); } catch (e) { return avisoFallo_('AEMET no ha devuelto JSON', key); }
    if (!meta || !meta.datos) return avisoFallo_('AEMET sin datos', key);
    var second = UrlFetchApp.fetch(String(meta.datos), { muteHttpExceptions: true, followRedirects: true });
    if (second.getResponseCode() < 200 || second.getResponseCode() >= 300) return avisoFallo_('AEMET sin el aviso', key);
    var alerts = filtrarAvisos_(cuerpoAvisos_(second.getContentText() || ''));
    var out = { ok: true, alerts: alerts, fetched: new Date().toISOString(), area: area };
    try { cache.put(AEMET_CACHE_KEY, JSON.stringify(out), 1800); } catch (e2) { /* el marco igual recibe la lista */ }
    return out;
  } catch (err) {
    return avisoFallo_('Sin avisos de AEMET', key);
  }
}

function cuerpoAvisos_(raw) {
  var s = String(raw || '').replace(/^\uFEFF/, '').trim();
  if (!s) return [];
  if (s.charAt(0) === '"' || s.charAt(0) === '{' || s.charAt(0) === '[') {
    try {
      var parsed = JSON.parse(s);
      if (typeof parsed === 'string') s = String(parsed).trim();
      else return avisosDesdeJson_(parsed);
    } catch (e) { /* sigue como XML */ }
  }
  return avisosDesdeXmlTexto_(s);
}

function avisosDesdeXmlTexto_(s) {
  var out = [];
  if (s.indexOf('<alert') === -1) return out;
  var parts = s.split(/<\/alert>/i);
  parts.forEach(function (part) {
    var i = part.search(/<alert[\s>]/i);
    if (i < 0) return;
    var xml = part.slice(i) + '</alert>';
    try {
      var root = XmlService.parse(xml).getRootElement();
      avisosDeAlerta_(root).forEach(function (a) { out.push(a); });
    } catch (e) { /* un aviso mal formado no tira el resto */ }
  });
  return out;
}

function hijo_(el, name) {
  if (!el) return null;
  var ns = el.getNamespace();
  var c = ns ? el.getChild(name, ns) : null;
  if (!c) c = el.getChild(name);
  return c;
}

function hijos_(el, name) {
  if (!el) return [];
  var ns = el.getNamespace();
  var list = ns ? el.getChildren(name, ns) : [];
  if (!list || !list.length) list = el.getChildren(name);
  return list || [];
}

function texto_(el, name) {
  var c = hijo_(el, name);
  return c ? String(c.getText() || '').trim() : '';
}

function avisosDeAlerta_(alertEl) {
  var status = foldAemet_(texto_(alertEl, 'status'));
  var msg = foldAemet_(texto_(alertEl, 'msgType'));
  if (msg === 'cancel' || status === 'cancel' || status === 'test' || status === 'exercise' || status === 'draft') return [];
  var infos = hijos_(alertEl, 'info');
  if (!infos.length) return [];
  var prefer = infos.filter(function (info) { return foldAemet_(texto_(info, 'language')).indexOf('es') === 0; });
  var list = prefer.length ? prefer : infos;
  var out = [];
  list.forEach(function (info) {
    var aviso = avisoDeInfo_(info);
    if (aviso) out.push(aviso);
  });
  return out;
}

function avisoDeInfo_(info) {
  var params = [];
  var nivelTxt = '';
  hijos_(info, 'parameter').forEach(function (p) {
    var name = texto_(p, 'valueName');
    var value = texto_(p, 'value');
    if (!value) return;
    params.push(value);
    if (/nivel/i.test(name)) nivelTxt += ' ' + value;
  });
  var level = nivelAviso_(nivelTxt || params.join(' '), texto_(info, 'severity'));
  if (!level) return null;
  var areas = [];
  var codes = [];
  hijos_(info, 'area').forEach(function (area) {
    var desc = texto_(area, 'areaDesc');
    if (desc) areas.push(desc);
    hijos_(area, 'geocode').forEach(function (g) {
      var value = texto_(g, 'value');
      if (value) codes.push(value);
    });
  });
  var blob = areas.concat(params).join(' · ');
  if (!esAlava_(blob, codes)) return null;
  var onset = texto_(info, 'onset') || texto_(info, 'effective');
  var expires = texto_(info, 'expires');
  if (!vigenteAviso_(onset, expires)) return null;
  var event = texto_(info, 'event');
  var headline = texto_(info, 'headline');
  var description = texto_(info, 'description');
  var instruction = texto_(info, 'instruction');
  var text = description;
  if (instruction) text = text ? (text + '\n\n' + instruction) : instruction;
  if (!text) text = headline;
  return {
    level: level,
    event: event.slice(0, 80),
    headline: headline.slice(0, 240),
    text: String(text || '').slice(0, 1500),
    area: areas.join(', ').slice(0, 160) || 'Álava',
    until: expires,
    onset: onset
  };
}

function nivelAviso_(params, severity) {
  var n = foldAemet_(params);
  if (/\brojo\b/.test(n)) return 'rojo';
  if (/\bnaranja\b/.test(n)) return 'naranja';
  if (/\bamarillo\b/.test(n)) return '';
  var s = foldAemet_(severity);
  if (s === 'extreme') return 'rojo';
  if (s === 'severe') return 'naranja';
  return '';
}

function codigoAlava_(code) {
  var c = String(code || '').trim();
  return c === '01' || c === '1' || /^01\d{3}$/.test(c);
}

function codigoFuera_(code) {
  var c = String(code || '').trim();
  return c === '20' || c === '48' || /^20\d{3}$/.test(c) || /^48\d{3}$/.test(c);
}

function esAlava_(text, codes) {
  var list = codes || [];
  if (list.some(codigoAlava_)) return true;
  var t = foldAemet_(text);
  var alava = /alava|araba|vitoria|gasteiz/.test(t);
  var otra = /bizkaia|vizcaya|gipuzkoa|guipuzcoa|donostia|bilbao/.test(t) || list.some(codigoFuera_);
  if (alava) return true;
  if (otra) return false;
  return /pais vasco|euskadi|comunidad autonoma vasca/.test(t);
}

function vigenteAviso_(onset, expires) {
  var now = Date.now();
  var exp = Date.parse(expires || '');
  if (!isNaN(exp) && exp < now) return false;
  var on = Date.parse(onset || '');
  if (!isNaN(on) && on > now + 48 * 3600000) return false;
  return true;
}

function filtrarAvisos_(list) {
  var seen = {};
  var out = [];
  (list || []).forEach(function (a) {
    if (!a || (a.level !== 'rojo' && a.level !== 'naranja')) return;
    var k = a.level + '|' + foldAemet_(a.event) + '|' + foldAemet_(a.area);
    if (seen[k]) return;
    seen[k] = true;
    out.push(a);
  });
  out.sort(function (a, b) { return (a.level === 'rojo' ? 0 : 1) - (b.level === 'rojo' ? 0 : 1); });
  return out.slice(0, 6);
}

function avisosDesdeJson_(j) {
  if (!j) return [];
  if (typeof j === 'string') return avisosDesdeXmlTexto_(j);
  var arr = Array.isArray(j) ? j : (j.alerts || j.avisos || []);
  if (!Array.isArray(arr)) return [];
  return arr.map(function (a) {
    if (!a || typeof a !== 'object') return null;
    var level = nivelAviso_(a.level || a.nivel || '', a.severity || a.severidad || '');
    var area = String(a.area || a.areaDesc || a.zona || '');
    var text = String(a.text || a.description || a.descripcion || a.headline || '');
    if (!level || !esAlava_(area + ' ' + text, a.codes || [])) return null;
    return {
      level: level,
      event: String(a.event || a.evento || '').slice(0, 80),
      headline: String(a.headline || a.titulo || '').slice(0, 240),
      text: text.slice(0, 1500),
      area: area.slice(0, 160) || 'Álava',
      until: String(a.until || a.expires || ''),
      onset: String(a.onset || '')
    };
  }).filter(function (a) { return !!a; });
}

/* ---------- Outfit de mañana ---------- */
/* El bot manda un POST con action outfit. El marco lo lee con la misma acción
 * (sin piezas) o dentro de la respuesta de sync. Misma MARCO_KEY. Ver OUTFIT.md. */

var OUTFIT_CHUNK = 6000;
var OUTFIT_MAX_CHUNKS = 8;

function outfit_(body) {
  body = body || {};
  if (body.pieces || body.forDate || body.why || body.imageUrl) return guardarOutfit_(body);
  return { ok: true, outfit: leerOutfit_() };
}

function guardarOutfit_(body) {
  var norm = validarOutfit_(body);
  if (norm.error) return { ok: false, error: norm.error };
  var json = JSON.stringify(norm.outfit);
  if (json.length > OUTFIT_CHUNK * OUTFIT_MAX_CHUNKS) {
    return { ok: false, error: 'El outfit no cabe. Usa una URL https para la imagen.' };
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'Prueba otra vez en unos segundos' };
  try {
    guardarOutfitJson_(json);
    return { ok: true, outfit: norm.outfit };
  } finally {
    lock.releaseLock();
  }
}

function validarOutfit_(body) {
  var forDate = String(body.forDate || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(forDate)) return { error: 'forDate tiene que ser AAAA-MM-DD' };
  var piecesIn = body.pieces;
  if (!piecesIn || typeof piecesIn.length !== 'number') return { error: 'pieces tiene que ser una lista' };
  if (!piecesIn.length) return { error: 'Faltan las piezas' };
  if (piecesIn.length > 8) return { error: 'Demasiadas piezas' };
  var pieces = [];
  for (var i = 0; i < piecesIn.length; i++) {
    var p = piecesIn[i] || {};
    var id = String(p.id || '').trim().toLowerCase();
    if (!/^p\d{3}$/.test(id)) return { error: 'Id de pieza no válido (' + id + '). Usa p001, p002…' };
    var name = String(p.name || '').trim();
    if (!name) return { error: 'Falta el nombre de ' + id };
    var slot = slotOutfit_(p.slot);
    if (!slot) return { error: 'Hueco no válido en ' + id + '. Usa arriba, capa, pantalón, calzado o exterior.' };
    pieces.push({ id: id, name: name.substring(0, 80), slot: slot });
  }
  var imageUrl = String(body.imageUrl || '').trim();
  if (imageUrl && !/^https:\/\//i.test(imageUrl) && !/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);/i.test(imageUrl)) {
    return { error: 'imageUrl tiene que ser https o un data URL de imagen' };
  }
  if (imageUrl.length > 50000) return { error: 'La imagen es demasiado grande. Usa una URL https.' };
  var updatedAt = String(body.updatedAt || '').trim();
  if (!updatedAt) updatedAt = ahoraMadrid_();
  return {
    outfit: {
      forDate: forDate,
      updatedAt: updatedAt.substring(0, 40),
      why: String(body.why || '').trim().substring(0, 180),
      imageUrl: imageUrl,
      pieces: pieces
    }
  };
}

function slotOutfit_(s) {
  var t = String(s || '').trim().toLowerCase();
  if (t === 'pantalon' || t === 'pantalón') return 'pantalón';
  if (t === 'arriba' || t === 'capa' || t === 'calzado' || t === 'exterior') return t;
  return '';
}

function ahoraMadrid_() {
  var tz = 'Europe/Madrid';
  var stamp = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm:ss");
  var z = Utilities.formatDate(new Date(), tz, 'Z');
  if (/^[+-]\d{4}$/.test(z)) z = z.slice(0, 3) + ':' + z.slice(3);
  else z = '';
  return (stamp + z).substring(0, 40);
}

function leerOutfit_() {
  var props = PropertiesService.getScriptProperties();
  var n = parseInt(props.getProperty('MARCO_OUTFIT_N') || '0', 10);
  if (!n) return null;
  var parts = [];
  for (var i = 0; i < n && i < OUTFIT_MAX_CHUNKS; i++) parts.push(props.getProperty('MARCO_OUTFIT_' + i) || '');
  try {
    var o = JSON.parse(parts.join(''));
    return (o && o.pieces && o.pieces.length) ? o : null;
  } catch (e) {
    return null;
  }
}

function guardarOutfitJson_(json) {
  var n = Math.max(1, Math.ceil(json.length / OUTFIT_CHUNK));
  if (n > OUTFIT_MAX_CHUNKS) throw new Error('El outfit no cabe. Usa una URL https para la imagen.');
  var props = PropertiesService.getScriptProperties();
  var prev = parseInt(props.getProperty('MARCO_OUTFIT_N') || '0', 10);
  for (var i = 0; i < n; i++) props.setProperty('MARCO_OUTFIT_' + i, json.substring(i * OUTFIT_CHUNK, (i + 1) * OUTFIT_CHUNK));
  for (var j = n; j < prev; j++) props.deleteProperty('MARCO_OUTFIT_' + j);
  props.setProperty('MARCO_OUTFIT_N', String(n));
}
