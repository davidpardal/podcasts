/* Sincronización opcional con un Google Apps Script del dueño.
 * La URL y la clave viven solo en localStorage (marco-v2.settings).
 * Si no hay nada configurado, este módulo no llama a la red.
 * La mezcla es por elemento (la revisión más alta gana) para no perder
 * cosas cuando el marco y el móvil editan a la vez. El script aplica
 * la misma mezcla; aquí está la copia del navegador (y la de las pruebas). */
(function () {
  'use strict';

  let api = {
    settings: function () { return { syncUrl: '', syncKey: '' }; },
    onApplied: null,
    onDataStatus: null,
    toast: null
  };
  let revTick = 0;
  let timer = null;
  let again = false;
  let pending = null;
  let authToasted = false;

  function num(n) { return typeof n === 'number' && isFinite(n) ? n : 0; }
  function nextRev() {
    revTick = (revTick + 1) % 1000;
    return Date.now() * 1000 + revTick;
  }
  function dishKey(name) { return String(name || '').trim().toLowerCase(); }
  function dayCutoff(days) {
    const d = new Date(Date.now() - days * 86400000);
    const p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function mergeById(a, b) {
    const map = new Map();
    function add(list) {
      (list || []).forEach(function (item) {
        if (!item || item.id == null || item.id === '') return;
        const prev = map.get(item.id);
        if (!prev || num(item.rev) >= num(prev.rev)) map.set(item.id, item);
      });
    }
    add(a);
    add(b);
    return Array.from(map.values());
  }

  function normItem(it) {
    if (!it || !it.id) return null;
    return {
      id: String(it.id),
      name: String(it.name || ''),
      done: !!it.done,
      deleted: !!it.deleted,
      at: num(it.at),
      rev: typeof it.rev === 'number' ? it.rev : num(it.at)
    };
  }

  function mergeCompra(a, b) {
    a = a || {};
    b = b || {};
    const items = mergeById(
      (a.items || []).map(normItem).filter(Boolean),
      (b.items || []).map(normItem).filter(Boolean)
    );
    const cutoff = Date.now() * 1000 - 90 * 86400000 * 1000;
    const kept = items.filter(function (it) { return !(it.deleted && num(it.rev) < cutoff); });
    const counts = {};
    [a.counts || {}, b.counts || {}].forEach(function (src) {
      Object.keys(src).forEach(function (k) { counts[k] = Math.max(num(counts[k]), num(src[k])); });
    });
    return { items: kept, counts: counts };
  }

  function considerDish(into, key, name, rev, deleted) {
    const prev = into[key];
    if (!prev || rev >= prev.rev) {
      into[key] = { name: (!deleted && name) ? name : (prev && prev.name) || name || key, rev: rev, deleted: !!deleted };
    }
  }

  function collectDishes(src, into) {
    const names = Array.isArray(src.dishes) ? src.dishes : [];
    const meta = src.dishMeta || {};
    const seen = {};
    names.forEach(function (n) {
      const k = dishKey(n);
      if (!k) return;
      seen[k] = true;
      const rev = meta[k] ? num(meta[k].rev) : 0;
      considerDish(into, k, String(n).trim(), rev, false);
    });
    Object.keys(meta).forEach(function (k) {
      if (seen[k] || !meta[k] || !meta[k].deleted) return;
      considerDish(into, k, k, num(meta[k].rev), true);
    });
  }

  function mergeMenu(a, b) {
    a = a || {};
    b = b || {};
    const ra = num(a.spanRev);
    const rb = num(b.spanRev);
    const src = rb >= ra ? b : a;
    const into = {};
    collectDishes(a, into);
    collectDishes(b, into);
    const dishes = [];
    const dishMeta = {};
    Object.keys(into).forEach(function (k) {
      const m = into[k];
      dishMeta[k] = { rev: m.rev, deleted: !!m.deleted };
      if (!m.deleted) dishes.push(m.name);
    });
    const plan = {};
    for (let i = 0; i < 7; i++) {
      const ka = (a.plan && a.plan[String(i)]) || {};
      const kb = (b.plan && b.plan[String(i)]) || {};
      const row = {};
      ['comida', 'cena'].forEach(function (meal) {
        const rva = num(ka[meal + 'Rev']);
        const rvb = num(kb[meal + 'Rev']);
        if (rvb >= rva) { row[meal] = kb[meal] || ''; row[meal + 'Rev'] = rvb; }
        else { row[meal] = ka[meal] || ''; row[meal + 'Rev'] = rva; }
      });
      plan[String(i)] = row;
    }
    return {
      span: src.span === 5 ? 5 : 7,
      spanRev: Math.max(ra, rb),
      dishes: dishes,
      dishMeta: dishMeta,
      plan: plan
    };
  }

  function ensureStarLog(k) {
    if (!Array.isArray(k.starLog)) {
      k.starLog = [];
      Object.keys(k.stars || {}).forEach(function (kid) {
        const n = num(k.stars[kid]);
        if (n) k.starLog.push({ id: 'base-' + kid, kid: kid, delta: n, at: 1, kind: 'delta' });
      });
    }
    return k;
  }

  function starsFromLog(log) {
    let resetAt = 0;
    (log || []).forEach(function (op) { if (op && op.kind === 'reset') resetAt = Math.max(resetAt, num(op.at)); });
    const sums = {};
    (log || []).forEach(function (op) {
      if (!op || op.kind === 'reset' || !op.kid || num(op.at) <= resetAt) return;
      sums[op.kid] = (sums[op.kid] || 0) + num(op.delta);
    });
    Object.keys(sums).forEach(function (kid) { if (sums[kid] < 0) sums[kid] = 0; });
    return sums;
  }

  function compactStarLog(log) {
    let resetAt = 0;
    (log || []).forEach(function (op) { if (op && op.kind === 'reset') resetAt = Math.max(resetAt, num(op.at)); });
    return (log || []).filter(function (op) {
      if (!op || !op.id) return false;
      if (op.kind === 'reset') return num(op.at) === resetAt;
      return num(op.at) > resetAt;
    });
  }

  function hashText(s) {
    let h = 0;
    const str = String(s || '');
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  function normLog(log) {
    return (log || []).map(function (l) {
      if (typeof l === 'string') return { id: 'legacy-' + hashText(l), text: l, at: 0 };
      if (!l || !l.id) return null;
      return { id: String(l.id), text: String(l.text || ''), at: num(l.at) };
    }).filter(Boolean);
  }

  function ensureDoneMeta(k) {
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
    return k;
  }

  function rebuildDone(meta) {
    const done = {};
    Object.keys(meta || {}).forEach(function (key) {
      const m = meta[key];
      if (!m || !m.on) return;
      const parts = key.split('|');
      if (parts.length < 3) return;
      const day = parts[0];
      const chore = parts[1];
      const kid = parts.slice(2).join('|');
      done[day] = done[day] || {};
      done[day][chore] = done[day][chore] || [];
      if (done[day][chore].indexOf(kid) === -1) done[day][chore].push(kid);
    });
    return done;
  }

  function prepNinos(raw) {
    const k = {
      stars: Object.assign({}, (raw && raw.stars) || {}),
      starLog: raw && raw.starLog,
      done: (raw && raw.done) || {},
      doneMeta: raw && raw.doneMeta,
      pending: Array.isArray(raw && raw.pending) ? raw.pending.map(function (p) {
        return Object.assign({}, p, { deleted: !!(p && p.deleted), rev: p && typeof p.rev === 'number' ? p.rev : num(p && p.at) });
      }) : [],
      log: raw && raw.log
    };
    ensureStarLog(k);
    ensureDoneMeta(k);
    k.log = normLog(k.log);
    return k;
  }

  function mergeNinos(a, b) {
    const pa = prepNinos(a);
    const pb = prepNinos(b);
    const starMap = new Map();
    [pa.starLog, pb.starLog].forEach(function (list) {
      (list || []).forEach(function (op) { if (op && op.id) starMap.set(op.id, op); });
    });
    const starLog = compactStarLog(Array.from(starMap.values()));
    const doneMeta = {};
    [pa.doneMeta, pb.doneMeta].forEach(function (meta) {
      Object.keys(meta || {}).forEach(function (key) {
        const m = meta[key];
        if (!m) return;
        const prev = doneMeta[key];
        if (!prev || num(m.rev) >= num(prev.rev)) doneMeta[key] = { on: !!m.on, rev: num(m.rev) };
      });
    });
    const cutoff = dayCutoff(45);
    Object.keys(doneMeta).forEach(function (key) { if (key.split('|')[0] < cutoff) delete doneMeta[key]; });
    const pending = mergeById(pa.pending, pb.pending).filter(function (p) {
      return !(p.deleted && num(p.rev) < Date.now() * 1000 - 90 * 86400000 * 1000);
    });
    const logMap = new Map();
    [pa.log, pb.log].forEach(function (list) {
      (list || []).forEach(function (l) {
        const prev = logMap.get(l.id);
        if (!prev || num(l.at) >= num(prev.at)) logMap.set(l.id, l);
      });
    });
    const log = Array.from(logMap.values()).sort(function (x, y) { return num(x.at) - num(y.at); }).slice(-50);
    return { stars: starsFromLog(starLog), starLog: starLog, done: rebuildDone(doneMeta), doneMeta: doneMeta, pending: pending, log: log };
  }

  function normHecha(v) {
    if (v == null || v === false) return null;
    if (typeof v === 'object') return { on: !!v.on, rev: num(v.rev) };
    return { on: true, rev: num(v) || 1 };
  }

  function mergeHechas(a, b) {
    const out = {};
    [a || {}, b || {}].forEach(function (map) {
      Object.keys(map).forEach(function (id) {
        const v = normHecha(map[id]);
        if (!v) return;
        if (!out[id] || v.rev >= out[id].rev) out[id] = v;
      });
    });
    const cutoff = Date.now() - 90 * 86400000;
    Object.keys(out).forEach(function (id) {
      const ts = +String(id).split('@').pop();
      if (ts && ts < cutoff) delete out[id];
    });
    return out;
  }

  function mergeState(local, remote) {
    local = local || {};
    remote = remote || {};
    return {
      compra: mergeCompra(local.compra, remote.compra),
      menu: mergeMenu(local.menu, remote.menu),
      ninos: mergeNinos(local.ninos, remote.ninos),
      hechas: mergeHechas(local.hechas, remote.hechas)
    };
  }

  function readMenu() {
    const s = U.store.get('menu', null);
    if (!s || typeof s !== 'object' || !s.plan) return JSON.parse(JSON.stringify(window.MARCO_DEFAULTS.menu));
    return {
      span: s.span === 5 ? 5 : 7,
      spanRev: num(s.spanRev),
      dishes: Array.isArray(s.dishes) ? s.dishes.slice() : [],
      dishMeta: Object.assign({}, s.dishMeta || {}),
      plan: JSON.parse(JSON.stringify(s.plan))
    };
  }

  function snapshot() {
    const compra = mergeCompra(U.store.get('compra', { items: [], counts: {} }), { items: [], counts: {} });
    const menu = readMenu();
    const ninos = prepNinos(U.store.get('ninos', {}));
    const hechas = mergeHechas(U.store.get('hechas', {}), {});
    U.store.set('compra', compra);
    U.store.set('ninos', ninos);
    U.store.set('hechas', hechas);
    return { compra: compra, menu: menu, ninos: ninos, hechas: hechas };
  }

  function dump() {
    return JSON.stringify({
      compra: U.store.get('compra', null),
      menu: U.store.get('menu', null),
      ninos: U.store.get('ninos', null),
      hechas: U.store.get('hechas', null)
    });
  }

  function apply(state) {
    if (!state || typeof state !== 'object') return false;
    const before = dump();
    if (state.compra) U.store.set('compra', state.compra);
    if (state.menu) U.store.set('menu', state.menu);
    if (state.ninos) U.store.set('ninos', state.ninos);
    if (state.hechas) U.store.set('hechas', state.hechas);
    return dump() !== before;
  }

  function stampMenu(next, prev) {
    prev = prev || {};
    const force = !!next._forceRev;
    delete next._forceRev;
    const rev = nextRev();
    next.span = next.span === 5 ? 5 : 7;
    next.spanRev = (force || next.span !== (prev.span === 5 ? 5 : 7)) ? rev : num(prev.spanRev);
    next.dishMeta = Object.assign({}, prev.dishMeta || {});
    const prevNames = {};
    (prev.dishes || []).forEach(function (n) { const k = dishKey(n); if (k) prevNames[k] = n; });
    const nextNames = {};
    (next.dishes || []).forEach(function (n) { const k = dishKey(n); if (k) nextNames[k] = n; });
    Object.keys(nextNames).forEach(function (k) {
      const wasDeleted = next.dishMeta[k] && next.dishMeta[k].deleted;
      if (force || !prevNames[k] || wasDeleted) next.dishMeta[k] = { rev: rev, deleted: false };
      else if (!next.dishMeta[k]) next.dishMeta[k] = { rev: 0, deleted: false };
    });
    Object.keys(prevNames).forEach(function (k) {
      if (!nextNames[k]) next.dishMeta[k] = { rev: rev, deleted: true };
    });
    next.plan = next.plan || {};
    for (let i = 0; i < 7; i++) {
      const p = Object.assign({ comida: '', cena: '' }, prev.plan && prev.plan[String(i)]);
      const n = Object.assign({ comida: '', cena: '' }, next.plan[String(i)]);
      ['comida', 'cena'].forEach(function (meal) {
        if (force || (n[meal] || '') !== (p[meal] || '')) n[meal + 'Rev'] = rev;
        else n[meal + 'Rev'] = num(p[meal + 'Rev']);
      });
      next.plan[String(i)] = n;
    }
    return next;
  }

  function noteStar(k, kid, delta) {
    ensureStarLog(k);
    k.starLog.push({ id: U.uid(), kid: kid, delta: delta, at: nextRev(), kind: 'delta' });
    k.stars = k.stars || {};
    k.stars[kid] = Math.max(0, (k.stars[kid] || 0) + delta);
  }

  function resetStars(k) {
    ensureStarLog(k);
    k.starLog.push({ id: U.uid(), kind: 'reset', at: nextRev() });
    k.stars = {};
    const rev = nextRev();
    (k.pending || []).forEach(function (p) { p.deleted = true; p.rev = rev; });
  }

  function noteDone(k, day, chore, kid, on) {
    ensureDoneMeta(k);
    k.doneMeta[day + '|' + chore + '|' + kid] = { on: !!on, rev: nextRev() };
    const cutoff = dayCutoff(45);
    Object.keys(k.doneMeta).forEach(function (key) { if (key.split('|')[0] < cutoff) delete k.doneMeta[key]; });
  }

  function noteLog(k, text) {
    k.log = normLog(k.log);
    k.log.push({ id: U.uid(), text: text, at: nextRev() });
    k.log = k.log.slice(-50);
  }

  function dropPending(k, id) {
    const p = (k.pending || []).find(function (x) { return x.id === id; });
    if (!p) return;
    p.deleted = true;
    p.rev = nextRev();
  }

  function configured() {
    const st = api.settings() || {};
    return !!(String(st.syncUrl || '').trim() && String(st.syncKey || '').trim());
  }

  function normalizeUrl(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    let u;
    try { u = new URL(s); } catch (e) { return null; }
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol === 'http:' && !local) return null;
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    u.search = '';
    u.hash = '';
    return u.toString();
  }

  function report(st) { if (api.onDataStatus) api.onDataStatus(st); }

  async function call(action, extra) {
    const st = api.settings() || {};
    const url = String(st.syncUrl || '').trim();
    const key = String(st.syncKey || '');
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 25000);
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ key: key, action: action }, extra || {})),
        cache: 'no-store',
        redirect: 'follow',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: ctrl ? ctrl.signal : undefined
      });
      let text = await r.text();
      if (text.charAt(0) === ')') text = text.replace(/^\)\]\}',?\s*/, '');
      let data = null;
      try { data = JSON.parse(text); } catch (e) { data = null; }
      if (!data || typeof data !== 'object') {
        const err = new Error(r.ok ? 'El script no ha devuelto JSON. Revisa que sea una aplicación web con acceso «Cualquier persona» y que la URL acabe en /exec.' : ('HTTP ' + r.status));
        err.offline = true;
        throw err;
      }
      if (data.ok === false) {
        const err = new Error(data.error || 'Error del script');
        err.auth = /clave/i.test(err.message);
        err.offline = !err.auth;
        throw err;
      }
      return data;
    } catch (e) {
      if (e && (e.auth || e.offline)) throw e;
      const err = new Error(e && e.name === 'AbortError' ? 'Tiempo agotado' : 'Sin conexión con el script');
      err.offline = true;
      throw err;
    } finally { clearTimeout(timer); }
  }

  async function doSync() {
    const snap = snapshot();
    const data = await call('sync', { state: snap });
    const changed = again ? apply(mergeState(snapshot(), data.state || {})) : apply(data.state || {});
    authToasted = false;
    report({ ok: true, at: Date.now(), error: '', offline: false });
    return { changed: changed };
  }

  async function runSync() {
    let changed = false;
    try {
      do {
        again = false;
        const r = await doSync();
        if (r.changed) changed = true;
      } while (again);
      if (changed && api.onApplied) api.onApplied();
      return changed;
    } catch (e) {
      report({ ok: false, error: String(e.message || e), at: Date.now(), offline: !!(e && e.offline && !e.auth), auth: !!(e && e.auth) });
      if (e && e.auth && api.toast && !authToasted) {
        api.toast(String(e.message || 'Clave incorrecta'));
        authToasted = true;
      }
      return false;
    }
  }

  function syncNow() {
    if (!configured()) return Promise.resolve(false);
    if (pending) { again = true; return pending; }
    pending = runSync().finally(function () { pending = null; });
    return pending;
  }

  function touch() {
    if (!configured()) return;
    again = true;
    clearTimeout(timer);
    timer = setTimeout(function () { syncNow(); }, 2000);
  }

  function toEvents(data, bgMap) {
    bgMap = bgMap || {};
    return (data.events || []).map(function (e) {
      let start;
      let end;
      if (e.startLocal) start = U.parseLocal(e.startLocal);
      else start = new Date(e.start);
      if (e.endLocal) end = U.parseLocal(e.endLocal);
      else end = new Date(e.end);
      if (isNaN(start) || isNaN(end)) return null;
      let background = !!e.background;
      if (Object.prototype.hasOwnProperty.call(bgMap, e.calId)) background = !!bgMap[e.calId];
      return {
        id: String(e.id || U.uid()),
        title: e.title || '(sin título)',
        start: start,
        end: end,
        allDay: !!e.allDay,
        location: e.location || '',
        description: e.description || '',
        calName: e.calName || '',
        color: e.color || '#C8243B',
        background: background,
        calId: e.calId || ''
      };
    }).filter(Boolean);
  }

  async function fetchCalendars(start, end) {
    return call('calendars', { start: start.toISOString(), end: end.toISOString() });
  }

  async function fetchSalud() {
    return call('salud');
  }

  window.Sync = {
    attach: function (next) { api = Object.assign(api, next || {}); },
    configured: configured,
    normalizeUrl: normalizeUrl,
    mergeState: mergeState,
    stampMenu: stampMenu,
    nextRev: nextRev,
    noteStar: noteStar,
    resetStars: resetStars,
    noteDone: noteDone,
    noteLog: noteLog,
    dropPending: dropPending,
    touch: touch,
    syncNow: syncNow,
    fetchCalendars: fetchCalendars,
    fetchSalud: fetchSalud,
    toEvents: toEvents,
    snapshot: snapshot
  };
})();
