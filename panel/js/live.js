// Datos reales: tiempo (Open-Meteo), calendarios iCal, jornada y custodia (de Ajustes), uso de
// agentes (URL opcional) y guardado local de compra, tareas y citas añadidas en el panel.
(function () {
  'use strict';
  var D = window.DATA, P = window.PANEL, CFG = P.CFG, store = P.store;

  // ------------------------------------------------------------ tiempo (Open-Meteo, sin clave)
  function wmo(code, isDay) {
    if (code === 0 || code === 1) return isDay ? 'sun' : 'moon';
    if (code === 2) return isDay ? 'partly' : 'moon';
    if (code === 3) return 'cloud';
    if (code === 45 || code === 48) return 'fog';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code >= 95) return 'storm';
    if (code >= 51) return 'rain';
    return 'cloud';
  }
  function applyWeather(j) {
    var h = j.hourly, hours = [];
    for (var i = 0; i < h.time.length; i++) {
      hours.push({ time: new Date(h.time[i]), t: Math.round(h.temperature_2m[i]), c: wmo(h.weather_code[i], h.is_day[i]), p: h.precipitation_probability[i] || 0 });
    }
    D.weather = { demo: false, source: 'Open-Meteo', fetched: j._fetched, hi: Math.round(j.daily.temperature_2m_max[0]), lo: Math.round(j.daily.temperature_2m_min[0]), hours: hours };
  }
  function loadWeather(force) {
    var c = store.get('cache.weather', null);
    if (c && c.lat === CFG.lat && c.lon === CFG.lon) { try { applyWeather(c.data); } catch (e) {} }
    if (!force && c && Date.now() - c.data._fetched < 30 * 60000 && new Date(c.data._fetched).toDateString() === new Date().toDateString()) return Promise.resolve();
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + CFG.lat + '&longitude=' + CFG.lon +
      '&hourly=temperature_2m,weather_code,precipitation_probability,is_day&daily=temperature_2m_max,temperature_2m_min' +
      '&timezone=' + encodeURIComponent(CFG.timezone || 'Europe/Madrid') + '&past_days=1&forecast_days=3';
    return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) {
      // daily[0] es ayer (past_days=1): el máximo y mínimo de hoy son daily[1]
      j.daily.temperature_2m_max = j.daily.temperature_2m_max.slice(1);
      j.daily.temperature_2m_min = j.daily.temperature_2m_min.slice(1);
      j._fetched = Date.now();
      applyWeather(j);
      store.set('cache.weather', { lat: CFG.lat, lon: CFG.lon, data: j });
      App.liveStatus.weather = 'ok';
    }).catch(function (e) { App.liveStatus.weather = 'Error: ' + e.message; });
  }

  // ------------------------------------------------------------ jornada y custodia (de Ajustes)
  function parseLocal(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null;
  }
  function dayDiff(a, b) { return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5); }
  var custodyOn = function () { return !!(CFG.custody && CFG.custody.enabled && parseLocal(CFG.custody.anchor)); };
  // ¿Están los peques contigo en el instante t? (semanas alternas, cambio a la hora del ancla)
  function withParent(t) {
    var a = parseLocal(CFG.custody.anchor), hand = a.getHours() * 60 + a.getMinutes(), tm = t.getHours() * 60 + t.getMinutes();
    var d = dayDiff(a, t) - (tm < hand ? 1 : 0), cyc = +CFG.custody.cycleDays || 14;
    return ((d % cyc) + cyc) % cyc < (+CFG.custody.daysWithParent || 7);
  }
  App.withParent = function (t) { return custodyOn() ? withParent(t || App.now()) : null; };
  function hm(s, day) { var p = String(s).split(':'); var x = new Date(day); x.setHours(+p[0], +p[1] || 0, 0, 0); return x; }

  function derivedEvents() {
    var out = [], today = App.dayStart(new Date()), adults = D.people.filter(function (p) { return p.role !== 'kid'; });
    var kids = D.people.filter(function (p) { return p.role === 'kid'; });
    var w = CFG.work;
    var who = (w && (w.who || (adults[0] && adults[0].id)));
    for (var i = -14; i <= 60; i++) {
      var day = App.addDays(today, i);
      if (w && w.enabled && who && w.shifts) {
        var sh = w.shifts[day.getDay()] || w.shifts[String(day.getDay())];
        if (sh && sh.length === 2) out.push({ id: 'w' + i, title: w.label ? w.label : 'Trabajo', start: hm(sh[0], day), end: hm(sh[1], day), people: [who], derived: true, cal: 'Jornada (Ajustes)' });
      }
      if (custodyOn() && kids.length) {
        var a = parseLocal(CFG.custody.anchor);
        var t0 = new Date(day); t0.setHours(a.getHours(), a.getMinutes(), 0, 0);
        var before = new Date(+t0 - 60000), after = new Date(+t0 + 60000);
        if (withParent(before) !== withParent(after)) {
          var other = CFG.otherParent || 'el otro progenitor';
          var kidNames = kids.map(function (k) { return k.name; }).join(' y ');
          out.push({ id: 'cu' + i, title: withParent(after) ? 'Cambio: ' + kidNames + ' vuelven contigo' : 'Cambio: ' + kidNames + ' se van con ' + other,
            start: t0, end: new Date(+t0 + 30 * 60000), people: kids.map(function (k) { return k.id; }), derived: true, cal: 'Custodia (Ajustes)' });
        }
      }
    }
    return out;
  }

  // ------------------------------------------------------------ calendarios iCal (ical.js)
  function toDate(t) { return t.isDate ? new Date(t.year, t.month - 1, t.day) : t.toJSDate(); }
  function parseICS(text, cal, rs, re) {
    var comp = new ICAL.Component(ICAL.parse(text));
    comp.getAllSubcomponents('vtimezone').forEach(function (v) { try { ICAL.TimezoneService.register(v); } catch (e) {} });
    var masters = {}, loose = [], exc = [];
    comp.getAllSubcomponents('vevent').forEach(function (v, k) {
      if (v.hasProperty('recurrence-id')) exc.push(v); else masters[v.getFirstPropertyValue('uid') || ('x' + k)] = new ICAL.Event(v);
    });
    exc.forEach(function (v) { var ex = new ICAL.Event(v), m = masters[ex.uid]; if (m && m.isRecurring()) { try { m.relateException(ex); } catch (e) { loose.push(ex); } } else loose.push(ex); });
    var out = [], people = cal.who && cal.who.length ? cal.who.filter(function (id) { return D.ALL.indexOf(id) > -1; }) : [];
    if (!people.length) people = D.ALL.slice();
    function push(item, s, e) {
      if (String(item.component.getFirstPropertyValue('status') || '').toUpperCase() === 'CANCELLED') return;
      var allDay = !!item.startDate.isDate, start = toDate(s), end = e ? toDate(e) : new Date(+start + (allDay ? 864e5 : 36e5));
      if (end <= start) end = new Date(+start + (allDay ? 864e5 : 30 * 60000));
      if (end <= rs || start >= re) return;
      out.push({ id: 'i' + (item.uid || '') + '@' + (+start), title: item.summary || '(sin título)', start: start, end: end, allDay: allDay, loc: item.location || '', notes: item.description || '', people: people.slice(), cal: cal.name });
    }
    Object.keys(masters).forEach(function (k) {
      var ev = masters[k];
      if (!ev.startDate) return;
      if (ev.isRecurring()) {
        var it = ev.iterator(), next, n = 0;
        while ((next = it.next()) && n++ < 20000) {
          if (toDate(next) >= re) break;
          var det = ev.getOccurrenceDetails(next);
          push(det.item, det.startDate, det.endDate);
        }
      } else push(ev, ev.startDate, ev.endDate);
    });
    loose.forEach(function (ex) { push(ex, ex.startDate, ex.endDate); });
    return out;
  }
  function fetchICS(url, proxy) {
    var target = proxy ? proxy + encodeURIComponent(url) : url;
    return fetch(target, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (t) { if (!/BEGIN:VCALENDAR/.test(t)) throw new Error('no es un iCal'); return t; })
      .catch(function (e) { if (e && e.name === 'TypeError') throw new Error(proxy ? 'no se pudo conectar con el proxy' : 'bloqueado por CORS (Google necesita proxy)'); throw e; });
  }
  var realCals = function () { return (CFG.calendars || []).filter(function (c) { return c.url && String(c.url).trim(); }); };
  var calEvents = null;
  function reviveEvents(list) { return (list || []).map(function (e) { return Object.assign({}, e, { start: new Date(e.start), end: new Date(e.end) }); }); }
  function loadCalendars() {
    var cals = realCals();
    if (!cals.length) { calEvents = null; return Promise.resolve(); }
    if (!calEvents) calEvents = reviveEvents(store.get('cache.events', null)) || null;
    if (typeof ICAL === 'undefined') { App.liveStatus.calendars = 'Falta ical.js'; return Promise.resolve(); }
    var rs = App.addDays(App.dayStart(new Date()), -45), re = App.addDays(App.dayStart(new Date()), 75), all = [], errs = [];
    return Promise.all(cals.map(function (c) {
      return fetchICS(String(c.url).trim(), (CFG.proxy || '').trim()).then(function (t) { all = all.concat(parseICS(t, c, rs, re)); })
        .catch(function (e) { errs.push(c.name + ': ' + e.message); });
    })).then(function () {
      if (errs.length < cals.length) { calEvents = all; store.set('cache.events', all); }
      App.liveStatus.calendars = errs.length ? errs.join(' · ') : 'ok (' + all.length + ' citas)';
    });
  }

  // ------------------------------------------------------------ citas creadas en el panel
  App.saveLocalEvents = function () {
    store.set('localEvents', D.events.filter(function (e) { return e.local; }));
  };
  function localEvents() { return reviveEvents(store.get('localEvents', [])); }

  function rebuildEvents() {
    var real = calEvents && realCals().length;
    D.eventsDemo = !real;
    D.events = (real ? calEvents : D.demoEvents).concat(derivedEvents(), localEvents());
  }

  // ------------------------------------------------------------ presencia (sin Home Assistant)
  // Con personas propias: los peques según la custodia y los adultos según su agenda/jornada.
  function presence() {
    if (!CFG.peopleList) return;
    var now = App.now();
    D.people.forEach(function (p) {
      p.eta = null;
      if (p.role === 'kid' && custodyOn()) {
        var w = withParent(now);
        p.home = w; p.status = w ? 'Contigo' : 'Con ' + (CFG.otherParent || 'el otro progenitor');
        return;
      }
      var cur = App.timedOn(now, p.id).filter(function (e) { return e.start <= now && e.end > now; })[0];
      p.home = cur ? false : null;
      p.status = cur ? (cur.derived && /trabajo|jornada/i.test(cur.cal) ? 'Trabajando hasta ' + App.fmt.time(cur.end) : 'Ahora: ' + cur.title) : 'Sin citas ahora';
    });
  }

  // ------------------------------------------------------------ agentes IA (JSON opcional)
  App.loadAgents = function () {
    if (!CFG.agentsUrl) return Promise.resolve();
    return fetch(CFG.agentsUrl, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) {
      var list = Array.isArray(j) ? j : j.agents;
      if (!Array.isArray(list) || !list.length) throw new Error('formato no válido');
      D.agents = list.map(function (a) { return Object.assign({ color: '#111111', status: 'ok', meters: [], tokens: 0, cost: 0, week: [0, 0, 0, 0, 0, 0, 0] }, a, { rgb: a.rgb || P.hexRgb(a.color || '#111111') }); });
      D.agentsDemo = false;
      App.liveStatus.agents = 'ok';
      App.emit('data');
    }).catch(function (e) { App.liveStatus.agents = 'Error: ' + e.message + ' (se muestra la demo)'; });
  };

  // ------------------------------------------------------------ guardado local
  var saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      if (!D.groceriesDemo) store.set('compra', { list: D.groceries, gid: D._gidNow() });
      if (!D.choresDemo) store.set('chores', { list: D.chores, stars: D.stars, week: D.week, day: new Date().toDateString() });
    }, 300);
  }
  App.on('data', save);

  App.liveStatus = { weather: 'cargando…', calendars: realCals().length ? 'cargando…' : 'sin calendarios (demo)', agents: CFG.agentsUrl ? 'cargando…' : 'sin URL (demo)' };
  App.refreshLive = function (force) {
    rebuildEvents(); presence();
    return Promise.all([loadWeather(force), loadCalendars(), App.loadAgents()]).then(function () {
      rebuildEvents(); presence();
      App.emit('data');
      App.rerender();
      if (force) App.toast('Datos actualizados', { icon: 'check', ms: 2000 });
    });
  };
  // Primero lo que haya en caché (arranque sin red), luego refresco
  if (realCals().length) { calEvents = reviveEvents(store.get('cache.events', null)); if (!calEvents.length) calEvents = null; }
  rebuildEvents();
  presence();
  App.on('ready', function () { App.refreshLive(false); setInterval(function () { App.refreshLive(false); }, 15 * 60000); });
  App.on('minute', function () { presence(); });
})();
