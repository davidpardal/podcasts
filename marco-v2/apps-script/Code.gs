/**
 * Marco familiar v2 · puente con Google (calendarios + datos compartidos).
 * Se pega en script.google.com. NO pongas aquí claves ni datos personales.
 * MARCO_KEY y GARMIN_PERSONAL_API_KEY van en Propiedades del script
 * (Ajustes del proyecto). El script no las escribe en el registro ni las devuelve.
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
  try {
    if (e && e.postData && e.postData.contents) body = JSON.parse(e.postData.contents);
  } catch (err) {
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
}

function handle_(e, body) {
  body = body || {};
  var params = (e && e.parameter) || {};
  var action = String(body.action || params.action || 'ping');
  var key = String(body.key || params.key || '');
  var auth = claveOk_(key);
  if (!auth.ok) return json_({ ok: false, error: auth.error });

  try {
    if (action === 'ping') return json_({ ok: true, service: 'marco-v2' });
    if (action === 'calendars') return json_(calendarios_(body));
    if (action === 'sync') return json_(sincronizar_(body.state || {}));
    if (action === 'salud') return json_(salud_());
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
    return { ok: true, state: merged };
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
 */

var GARMIN_BASE = 'https://personal.connectapi.garmin.com';
var GARMIN_TOKEN_URL = GARMIN_BASE + '/personalapitoken-service/personal-api/personal-api-key/token';

function claveGarmin_() {
  return String(PropertiesService.getScriptProperties().getProperty('GARMIN_PERSONAL_API_KEY') || '').trim();
}

function salud_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('mv2-garmin-salud');
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
    cache.put('mv2-garmin-salud', json, 1800);
    try { PropertiesService.getScriptProperties().setProperty('GARMIN_SALUD_LAST', json); } catch (e2) { /* la copia de 30 min basta */ }
    return data;
  } catch (err) {
    try { cache.remove('mv2-garmin-jwt'); } catch (e3) { /* sin caché de token */ }
    return saludAntiguo_();
  }
}

function saludAntiguo_() {
  var last = '';
  try { last = PropertiesService.getScriptProperties().getProperty('GARMIN_SALUD_LAST') || ''; } catch (e) { last = ''; }
  if (!last) {
    try { last = CacheService.getScriptCache().get('mv2-garmin-salud') || ''; } catch (e2) { last = ''; }
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
  var start = addDaysIso_(today, -6);
  var q = 'startDate=' + encodeURIComponent(start) + '&endDate=' + encodeURIComponent(today);
  var paths = [
    '/activitylist-service/activities/search/activities?start=0&limit=10&' + q,
    '/usersummary-service/v2/dailysummaries?' + q,
    '/sleep-service/sleep/dailySleepSummariesByDate?' + q,
    '/hrv-service/hrv/daily/' + encodeURIComponent(start) + '/' + encodeURIComponent(today)
  ];
  var reqs = paths.map(function (p) {
    return {
      url: GARMIN_BASE + p,
      method: 'get',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      muteHttpExceptions: true
    };
  });
  var res = UrlFetchApp.fetchAll(reqs);
  var payloads = res.map(function (r) {
    if (r.getResponseCode() < 200 || r.getResponseCode() >= 300) throw new Error('garmin-http');
    try { return JSON.parse(r.getContentText() || 'null'); } catch (e) { throw new Error('garmin-json'); }
  });
  return compactarSalud_(payloads[0], payloads[1], payloads[2], payloads[3], start, today);
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
    sleepSeconds: null,
    sleepScore: null,
    deepSeconds: null,
    lightSeconds: null,
    remSeconds: null,
    awakeSeconds: null,
    hrv: null,
    hrvWeekly: null,
    hrvStatus: null
  };
}

function dentro_(date, start, end) {
  return !!date && date >= start && date <= end;
}

function compactarSalud_(activities, summaries, sleep, hrv, start, today) {
  var dates = [];
  for (var i = 6; i >= 0; i--) dates.push(addDaysIso_(today, -i));
  var map = {};
  dates.forEach(function (d) { map[d] = diaVacio_(d); });
  var stepsGoal = null;

  asList_(summaries, ['data', 'dailySummaries', 'summaries']).forEach(function (row) {
    if (!row) return;
    var date = String(row.calendarDate || '').slice(0, 10);
    if (!map[date]) return;
    var day = map[date];
    day.steps = entero_(descend_(row, ['movement', 'steps']));
    day.restingHr = entero_(descend_(row, ['heartRate', 'restingValue']));
    day.bodyBatteryMin = entero_(descend_(row, ['bodyBattery', 'minValue']));
    day.bodyBatteryMax = entero_(descend_(row, ['bodyBattery', 'maxValue']));
    if (stepsGoal == null) {
      stepsGoal = entero_(descend_(row, ['movement', 'stepGoal']));
      if (stepsGoal == null) stepsGoal = entero_(descend_(row, ['movement', 'goal']));
      if (stepsGoal == null) stepsGoal = entero_(descend_(row, ['movement', 'stepsGoal']));
    }
  });

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

  asList_(hrv, ['hrvSummaries']).forEach(function (row) {
    if (!row) return;
    var date = String(row.calendarDate || '').slice(0, 10);
    if (!map[date]) return;
    var day = map[date];
    day.hrv = entero_(row.lastNightAvg);
    day.hrvWeekly = entero_(row.weeklyAvg);
    day.hrvStatus = textoEstado_(row.status);
  });

  var workouts = [];
  asList_(activities, ['activities']).forEach(function (a) {
    if (!a) return;
    var startLocal = corto_(a.startTimeLocal, 32);
    var date = (startLocal.match(/^(\d{4}-\d{2}-\d{2})/) || [null, ''])[1];
    if (!dentro_(date, start, today)) return;
    var typeKey = '';
    if (a.activityType && typeof a.activityType === 'object' && a.activityType.typeKey) typeKey = corto_(a.activityType.typeKey, 40);
    else if (typeof a.activityType === 'string') typeKey = corto_(a.activityType, 40);
    workouts.push({
      date: date,
      start: startLocal,
      type: typeKey,
      name: corto_(a.activityName || typeKey || 'Actividad', 80),
      duration: entero_(a.duration),
      distance: entero_(a.distance),
      avgHr: entero_(a.averageHR),
      calories: entero_(a.calories)
    });
  });
  workouts.sort(function (a, b) { return String(b.start || b.date).localeCompare(String(a.start || a.date)); });
  if (workouts.length > 7) workouts = workouts.slice(0, 7);

  return {
    ok: true,
    stale: false,
    fetchedAt: new Date().toISOString(),
    from: dates[0],
    to: today,
    stepsGoal: stepsGoal,
    days: dates.map(function (d) { return map[d]; }),
    workouts: workouts
  };
}
