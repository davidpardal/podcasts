// Ajustes del panel. Aquí NO hay datos personales: todo lo tuyo (personas, custodia, jornada,
// calendarios, fotos…) se mete en Ajustes o se importa desde un archivo, y se guarda solo en
// este aparato (localStorage). Mantén pulsado el reloj de la barra lateral → Ajustes.
(function () {
  'use strict';
  var KEY = 'panel.';
  var store = {
    get: function (k, def) { try { var v = localStorage.getItem(KEY + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set: function (k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { console.warn('No se pudo guardar', k); } },
    del: function (k) { try { localStorage.removeItem(KEY + k); } catch (e) {} },
    clear: function () { try { Object.keys(localStorage).filter(function (k) { return k.indexOf(KEY) === 0; }).forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {} }
  };

  // Paleta del original (azul, magenta, verde, ámbar) para quien no traiga color
  var PALETTE = ['#2D5BFF', '#E4007C', '#00A36C', '#FFB000', '#7C4DFF', '#00A3C4'];

  var DEFAULTS = {
    city: 'Vitoria-Gasteiz', lat: 42.85, lon: -2.67, timezone: 'Europe/Madrid',
    // Personas de ejemplo (demo). Las tuyas se ponen en Ajustes o con Importar.
    people: null,
    otherParent: '',
    custody: { enabled: false, anchor: '', cycleDays: 14, daysWithParent: 7 },
    work: { enabled: false, label: 'Trabajo', who: null, shifts: {} },
    calendars: [],      // [{ name, url, who: ['id', …] }]  (who vacío = toda la familia)
    proxy: '',          // prefijo CORS que termina en ?url= (ver proxy/ del marco)
    photos: [],         // URLs de fotos (una por línea en Ajustes)
    agentsUrl: '',      // JSON con el uso de agentes IA (mismo formato que la demo)
    homeAssistant: { url: '', token: '' },
    stores: ['Súper', 'Mercado']
  };

  function hexRgb(h) {
    var m = /^#?([0-9a-f]{6})$/i.exec(h || '');
    if (!m) return '17 17 17';
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(' ');
  }
  function ink(h) {
    var c = hexRgb(h).split(' ').map(Number);
    var l = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
    return l > 0.62 ? '#111111' : '#FFFFFF';
  }
  function slug(s, i) { return (String(s || 'p').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '') || 'p') + '-' + i; }

  function person(p, i) {
    var color = p.color || PALETTE[i % PALETTE.length];
    return { id: p.id || slug(p.name, i), name: p.name || ('Persona ' + (i + 1)), role: p.role === 'kid' ? 'kid' : 'adult', color: color, rgb: hexRgb(color), ink: ink(color) };
  }

  // Convierte el archivo de ajustes del «marco familiar» (tipo marco-familiar-ajustes) a este formato
  function fromMarco(d) {
    var a = d.advanced || {}, s = d.settings || {}, out = {};
    ['city', 'lat', 'lon', 'otherParent', 'custody'].forEach(function (k) { if (a[k] != null) out[k] = a[k]; });
    var people = [];
    if (a.parent) people.push({ id: 'adulto', name: a.parent, role: 'adult', color: PALETTE[0] });
    (a.kids || []).forEach(function (k) { people.push({ id: k.id, name: k.name, role: 'kid', color: k.color }); });
    if (people.length) out.people = people;
    if (a.work) out.work = { enabled: a.work.enabled !== false, label: a.work.label || 'Trabajo', who: people.length && people[0].role === 'adult' ? people[0].id : null, shifts: a.work.shifts || {} };
    if (s.calendars && s.calendars.length) out.calendars = s.calendars.map(function (c) { return { name: c.name || 'Calendario', url: c.url || '', who: c.who || [] }; });
    if (s.proxy) out.proxy = s.proxy;
    return out;
  }

  function normalize(d) {
    if (!d || typeof d !== 'object') throw new Error('El archivo no es un objeto JSON');
    if (d.tipo === 'marco-familiar-ajustes' || d.advanced) return fromMarco(d);
    if (d.tipo === 'panel-ajustes' || d.version) { var c = Object.assign({}, d); delete c.tipo; delete c.version; return c; }
    return d;
  }

  var saved = store.get('ajustes', {});
  var CFG = Object.assign({}, DEFAULTS, saved);
  CFG.custody = Object.assign({}, DEFAULTS.custody, saved.custody || {});
  CFG.work = Object.assign({}, DEFAULTS.work, saved.work || {});
  CFG.homeAssistant = Object.assign({}, DEFAULTS.homeAssistant, saved.homeAssistant || {});
  CFG.hasPeople = !!(saved.people && saved.people.length);
  CFG.peopleList = CFG.hasPeople ? saved.people.map(person) : null;

  window.PANEL = {
    store: store, CFG: CFG, DEFAULTS: DEFAULTS, PALETTE: PALETTE, person: person, hexRgb: hexRgb, ink: ink,
    save: function (patch) { var cur = store.get('ajustes', {}); store.set('ajustes', Object.assign(cur, patch)); },
    importText: function (txt) {
      var d = normalize(JSON.parse(txt));
      var cur = store.get('ajustes', {});
      // No borra calendarios/proxy guardados si el archivo no los trae
      if (!d.calendars || !d.calendars.length) delete d.calendars;
      if (!d.proxy) delete d.proxy;
      store.set('ajustes', Object.assign(cur, d));
      return d;
    },
    exportObj: function (withSecrets) {
      var d = Object.assign({ tipo: 'panel-ajustes', version: 1 }, store.get('ajustes', {}));
      if (!withSecrets) { delete d.calendars; delete d.proxy; if (d.homeAssistant) d.homeAssistant = { url: d.homeAssistant.url || '', token: '' }; }
      return d;
    }
  };
})();
