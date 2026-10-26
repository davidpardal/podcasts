/* Utilidades: fechas en español, almacenamiento local y escape de HTML. */
(function () {
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const DIAS_C = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  // Reloj: permite simular una fecha con ?fecha=2026-10-24T10:00 (para pruebas); sigue avanzando.
  let offset = 0;
  try {
    const q = new URLSearchParams(location.search).get('fecha');
    if (q) { const t = parseLocal(q); if (!isNaN(t)) offset = t.getTime() - Date.now(); }
  } catch (e) { /* sin URL */ }

  function parseLocal(s) {
    // 'YYYY-MM-DD' o 'YYYY-MM-DDTHH:MM' en hora local del dispositivo
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(s || '');
    if (!m) return new Date(NaN);
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  }
  const now = () => new Date(Date.now() + offset);
  const pad = (n) => String(n).padStart(2, '0');
  const hm = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes());
  const sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const mondayOf = (d) => { const x = sod(d); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); };
  const dayKey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  // Días naturales entre dos fechas (inmune al cambio de hora)
  const dayDiff = (a, b) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fechaLarga = (d) => DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()];
  const fechaCorta = (d) => DIAS_C[d.getDay()] + ' ' + d.getDate() + '/' + pad(d.getMonth() + 1);

  function countdown(ms) {
    const min = Math.max(0, Math.round(ms / 60000));
    if (min < 1) return 'ya';
    if (min < 60) return min + ' min';
    const h = Math.floor(min / 60), m = min % 60;
    if (h < 24) return h + ' h' + (m ? ' ' + m + ' min' : '');
    const d = Math.floor(h / 24), hh = h % 24;
    return d + (d === 1 ? ' día' : ' días') + (hh ? ' ' + hh + ' h' : '');
  }

  // Festivos nacionales de fecha fija (2.0TD: todo el día en valle). Los móviles (Viernes Santo) no cuentan.
  const FESTIVOS_FIJOS = ['01-01', '01-06', '05-01', '08-15', '10-12', '11-01', '12-06', '12-08', '12-25'];
  const esFestivoNacional = (d) => FESTIVOS_FIJOS.includes(pad(d.getMonth() + 1) + '-' + pad(d.getDate()));

  // Domingo de Pascua (algoritmo gregoriano anónimo). Sirve para Viernes Santo y Lunes de Pascua.
  function domingoPascua(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  // Etiqueta de día para la mochila (festivo). No cambia la luz: ahí siguen solo los nacionales de fecha fija.
  // Fechas públicas de Álava / Vitoria-Gasteiz y del País Vasco, sin calendario escolar.
  const FESTIVOS_ALAVA = {
    '01-01': 'Año Nuevo',
    '01-06': 'Epifanía',
    '04-28': 'San Prudencio',
    '05-01': 'Día del Trabajador',
    '07-25': 'Santiago',
    '08-05': 'Virgen Blanca',
    '08-15': 'Asunción',
    '10-12': 'Fiesta Nacional',
    '11-01': 'Todos los Santos',
    '12-06': 'Constitución',
    '12-08': 'Inmaculada',
    '12-25': 'Navidad'
  };
  function festivoEtiqueta(d) {
    if (!d || isNaN(d.getTime())) return null;
    const key = pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    if (FESTIVOS_ALAVA[key]) return { id: 'festivo', label: 'Festivo', name: FESTIVOS_ALAVA[key] };
    const pascua = domingoPascua(d.getFullYear());
    const viernes = addDays(pascua, -2);
    const lunes = addDays(pascua, 1);
    if (sameDay(d, viernes)) return { id: 'festivo', label: 'Festivo', name: 'Viernes Santo' };
    if (sameDay(d, lunes)) return { id: 'festivo', label: 'Festivo', name: 'Lunes de Pascua' };
    return null;
  }

  // Prefijo propio: misma web que /marco/ (github.io) no debe compartir listas, PIN ni calendarios.
  const PREFIX = 'marco-v2.';
  const store = {
    get(k, def) { try { const v = localStorage.getItem(PREFIX + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { console.warn('No se pudo guardar', k, e); } },
    del(k) { try { localStorage.removeItem(PREFIX + k); } catch (e) { } },
    clearAll() { try { Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k)); } catch (e) { } }
  };

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  window.U = { DIAS, DIAS_C, MESES, MESES_C, now, pad, hm, sod, addDays, sameDay, mondayOf, dayKey, dayDiff, esc, fechaLarga, fechaCorta, countdown, esFestivoNacional, festivoEtiqueta, domingoPascua, store, uid, parseLocal, get simulated() { return offset !== 0; } };
})();
