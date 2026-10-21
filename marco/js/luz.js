/* Luz: periodos de los peajes 2.0TD (península) y precio PVPC de referencia (REE, sin clave).
 * El PVPC NO es tu tarifa (salvo que la tengas contratada): solo se enseña como referencia del mercado. */
(function () {
  // Lunes a viernes laborables: valle 0–8, llano 8–10, punta 10–14, llano 14–18, punta 18–22, llano 22–24.
  // Sábados, domingos y festivos nacionales de fecha fija: todo el día valle.
  const TRAMOS = [[0, 8, 'valle'], [8, 10, 'llano'], [10, 14, 'punta'], [14, 18, 'llano'], [18, 22, 'punta'], [22, 24, 'llano']];
  const NOMBRE = { punta: 'Punta', llano: 'Llano', valle: 'Valle' };
  const COLOR = { punta: '#D9483B', llano: '#F5A623', valle: '#3BA55C' };

  const esFinde = (d) => d.getDay() === 0 || d.getDay() === 6 || U.esFestivoNacional(d);
  function period(d) {
    if (esFinde(d)) return 'valle';
    const h = d.getHours();
    for (const [a, b, p] of TRAMOS) if (h >= a && h < b) return p;
    return 'valle';
  }
  function tramosDelDia(d) {
    if (esFinde(d)) return [[0, 24, 'valle']];
    return TRAMOS;
  }
  // Próximo instante (>= t) en que empieza un periodo dado, y cuánto dura seguido
  function nextWindow(t, p) {
    let x = new Date(t); x.setMinutes(0, 0, 0);
    if (period(t) === p) { // ya estamos dentro: desde ahora
      let end = new Date(x); while (period(end) === p && end - t < 72 * 3600000) end = new Date(end.getTime() + 3600000);
      return { start: new Date(t), end };
    }
    for (let i = 0; i < 72; i++) {
      x = new Date(x.getTime() + 3600000);
      if (period(x) === p) {
        let end = new Date(x); while (period(end) === p && end - x < 72 * 3600000) end = new Date(end.getTime() + 3600000);
        return { start: x, end };
      }
    }
    return null;
  }

  async function loadPVPC(today) {
    const tomorrow = U.addDays(today, 1);
    const url = 'https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real?start_date=' + U.dayKey(today) + 'T00:00&end_date=' + U.dayKey(tomorrow) + 'T23:59&time_trunc=hour';
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('REE HTTP ' + r.status);
    const j = await r.json();
    const serie = (j.included || []).find((s) => s.id === '1001' || /pvpc/i.test((s.attributes || {}).title || ''));
    if (!serie) throw new Error('REE: no viene la serie PVPC');
    const byDay = {};
    serie.attributes.values.forEach((v) => {
      const d = new Date(v.datetime);
      const k = U.dayKey(d);
      (byDay[k] = byDay[k] || []).push({ hour: d.getHours(), at: d.getTime(), eur: v.value / 1000 });
    });
    return { byDay, updated: serie.attributes['last-update'], fetched: Date.now() };
  }

  // Ventana más barata de N horas seguidas en una serie horaria (solo referencia PVPC)
  function cheapest(values, n, fromTs) {
    const v = values.filter((x) => x.at >= (fromTs || 0));
    let best = null;
    for (let i = 0; i + n <= v.length; i++) {
      const slice = v.slice(i, i + n);
      if (slice.some((x, k) => k && x.at - slice[k - 1].at > 3700000)) continue;
      const avg = slice.reduce((s, x) => s + x.eur, 0) / n;
      if (!best || avg < best.avg) best = { start: slice[0].at, end: slice[n - 1].at + 3600000, avg };
    }
    return best;
  }

  window.Luz = { period, tramosDelDia, nextWindow, loadPVPC, cheapest, esFinde, NOMBRE, COLOR };
})();
