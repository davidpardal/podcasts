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

  // Prefijo propio: misma web que /marco/ (github.io) no debe compartir listas, PIN ni calendarios.
  const PREFIX = 'marco-v2.';
  const store = {
    get(k, def) { try { const v = localStorage.getItem(PREFIX + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { console.warn('No se pudo guardar', k, e); } },
    del(k) { try { localStorage.removeItem(PREFIX + k); } catch (e) { } },
    clearAll() { try { Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k)); } catch (e) { } }
  };

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  window.U = { DIAS, DIAS_C, MESES, MESES_C, now, pad, hm, sod, addDays, sameDay, mondayOf, dayKey, dayDiff, esc, fechaLarga, fechaCorta, countdown, esFestivoNacional, store, uid, parseLocal, get simulated() { return offset !== 0; } };
})();
