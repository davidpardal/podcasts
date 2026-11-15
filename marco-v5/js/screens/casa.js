/* Pantalla Casa: luz, dinero y plazos. */
'use strict';

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
function luzHtml() {
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

  return '<div class="luz">' +
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

/* ---------------- DINERO Y PLAZOS ---------------- */
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
  return '<section class="card wide" id="dineroCard" data-fold="dinero"><div class="card-h">💶 Dinero del mes</div>' +
    '<div class="muted sm">Importes en € que rellenas tú. No hay cuentas, contratos ni lecturas del contador. Vacío hasta que lo rellenes.</div>' +
    '<div class="card-h sub">LUZ · TRAMOS HORARIOS</div>' +
    '<div class="muted sm">Coste previsto del mes. La tarifa va por tramos (punta, llano y valle); las horas de hoy están en Casa → Luz.</div>' +
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
  return '<section class="card" id="plazosCard" data-fold="plazos"><div class="card-h">⏳ Plazos</div>' +
    '<div class="muted sm">Una por línea: <code>título | AAAA-MM-DD | nota</code>. Rojo a 3 días o menos, ámbar a 14, verde después y gris si ya pasó.</div>' +
    '<textarea id="plazosTxt" rows="5" spellcheck="false">' + esc(plazosToText(plazos())) + '</textarea>' +
    '<div class="row-btns"><button class="btn" data-act="savePlazos">Guardar plazos</button></div></section>';
}
function dineroHtml() {
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
    return '<div class="sub-row"><span>' + esc(s.name) + '<div class="muted sm" style="margin:0">' + esc(baja.replace(/^ · /, '') || 'Sin fecha de baja') + '</div></span><b>' + esc(fmtEuro(s.euros)) + '</b></div>';
  }).join('');
  const subsTotal = tot.subsEste == null ? '—' : fmtEuro(tot.subsEste);
  const vacio = tot.este == null && tot.pasado == null && d.luzEste == null && d.fibraEste == null && !d.suscripciones.length;
  if (vacio) return '<div class="dinero" data-vacio="1"><section class="card casa-empty"><div class="card-h">💶 Dinero del mes</div><div class="sum-big">Sin importes todavía</div><div class="muted">Pon la luz, la fibra y las suscripciones del mes y aquí sale el ahorro frente al mes pasado.</div><div class="row-btns"><button class="btn" data-go="ajustes" data-fold="dinero">Rellenar en Ajustes</button></div></section></div>';
  return '<div class="dinero"><div class="dinero-grid">' +
    '<section class="card span2 dinero-ahorro" data-ahorro="' + (tot.ahorro == null ? '' : String(tot.ahorro)) + '" data-este="' + (tot.este == null ? '' : String(tot.este)) + '" data-pasado="' + (tot.pasado == null ? '' : String(tot.pasado)) + '"><div class="card-h">Ahorro vs mes pasado</div>' +
      '<div class="money-big' + ahorroCls + '">' + esc(fmtEuro(tot.ahorro)) + '</div>' +
      '<div class="muted sm">Es la suma del mes pasado menos la de este mes (luz + fibra y móvil + suscripciones). Si falta un importe, sale —. Este mes ' + esc(fmtEuro(tot.este)) + ' · mes pasado ' + esc(fmtEuro(tot.pasado)) + '.</div></section>' +
    '<section class="card"><div class="card-h">⚡ Luz del mes</div><div class="money-big">' + esc(fmtEuro(d.luzEste)) + '</div>' +
      '<div class="muted sm">Coste previsto. Tarifa por tramos horarios: punta, llano y valle. Las horas están en la pestaña Luz; el € lo pones en Ajustes. ' + esc(luzSub) + '.</div></section>' +
    '<section class="card"><div class="card-h">📶 Fibra y móvil</div><div class="money-big">' + esc(fmtEuro(d.fibraEste)) + '</div>' +
      '<div class="muted sm">' + esc(fibraSub) + '.</div></section>' +
    '<section class="card span2"><div class="card-h">📌 Suscripciones <span class="count">' + esc(subsTotal) + '</span></div>' +
      (rows || '<div class="muted">Ninguna. Puedes añadirlas en Ajustes.</div>') + '</section>' +
    '</div></div>';
}
function plazosHtml() {
  const t = now();
  const list = plazos();
  const rows = list.map((p) => {
    const st = plazoEstado(p.due, t);
    return '<article class="plazo ' + st.tone + '" data-tone="' + st.tone + '" data-due="' + esc(p.due) + '" data-title="' + esc(p.title) + '"><span class="plazo-dot ' + st.tone + '" aria-hidden="true"></span><div class="plazo-n">' + esc(p.title) +
      '<div class="muted sm" style="margin:0">' + esc(U.fechaCorta(U.parseLocal(p.due)) + (p.note ? ' · ' + p.note : '')) + '</div></div><div class="plazo-d">' + esc(st.label) + '</div></article>';
  }).join('');
  const legend = '<div class="muted sm"><span class="plazo-dot rojo"></span> Rojo: 3 días o menos · <span class="plazo-dot ambar"></span> Ámbar: 14 días o menos · <span class="plazo-dot verde"></span> Verde: más tarde · <span class="plazo-dot gris"></span> Gris: ya pasó. Ordenados por fecha.</div>';
  if (!list.length) return '<div class="plazos" data-vacio="1"><section class="card casa-empty"><div class="card-h">⏳ Plazos</div><div class="sum-big">Sin plazos apuntados</div><div class="muted">Trámites, reservas o bajas con fecha: a 3 días salen en rojo y también en Hoy.</div><div class="row-btns"><button class="btn" data-go="ajustes" data-fold="plazos">Añadir en Ajustes</button></div></section></div>';
  return '<div class="plazos"><section class="card"><div class="card-h">⏳ Plazos <span class="count">' + list.length + '</span></div>' + rows + legend + '</section></div>';
}

/* ---------------- CASA: tres pestañas en una pantalla ---------------- */
const CASA_TABS = [['luz', '⚡ Luz'], ['dinero', '💶 Dinero'], ['plazos', '⏳ Plazos']];
function casaTab() { return CASA_TABS.some((x) => x[0] === S.casaTab) ? S.casaTab : 'luz'; }
function plazosUrgentes(t) {
  return plazos().filter((p) => { const st = plazoEstado(p.due, t); return st.days != null && st.days >= 0 && st.days <= 3; }).length;
}
function renderCasa() {
  const tab = casaTab();
  const urg = plazosUrgentes(now());
  const tabs = CASA_TABS.map(([id, label]) => '<button type="button" role="tab" data-act="casaTab" data-tab="' + id + '" class="' + (id === tab ? 'on' : '') + '" aria-selected="' + (id === tab ? 'true' : 'false') + '">' +
    label + (id === 'plazos' && urg ? ' <span class="casa-urg" title="A 3 días o menos">' + urg + '</span>' : '') + '</button>').join('');
  const body = tab === 'dinero' ? dineroHtml() : (tab === 'plazos' ? plazosHtml() : luzHtml());
  screenEl.innerHTML = '<div class="casa" data-casa="' + tab + '"><div class="casa-tabs trend-toggle" role="tablist" aria-label="Casa">' + tabs + '</div>' + body + '</div>';
}
