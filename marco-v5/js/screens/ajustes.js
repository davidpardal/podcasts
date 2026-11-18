/* Pantalla Ajustes: familia, importar/exportar y el resto de tarjetas. */
'use strict';

/* ---------------- Familia e importar/exportar ---------------- */
const WD = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo']];
function familyCard() {
  const c = CFG.custody || {}, w = CFG.work || {};
  const kidsTxt = CFG.kids.map((k) => k.name + ' | ' + (k.color || '')).join('\n');
  const shifts = WD.map(([n, name]) => { const sh = (w.shifts || {})[String(n)] || ['', ''];
    return '<div class="wd"><span>' + name + '</span><input type="time" id="wf' + n + '" value="' + esc(sh[0]) + '"><input type="time" id="wt' + n + '" value="' + esc(sh[1]) + '"></div>'; }).join('');
  return '<section class="card fam" data-fold="familia"><div class="card-h">👨‍👧‍👦 Familia, custodia y jornada</div>' +
    '<div class="muted sm">Se guarda solo en este dispositivo. Al guardar se recarga la página.</div>' +
    '<div class="grid2"><label class="lbl">Tu nombre<input id="f_parent" value="' + esc(CFG.parent) + '"></label><label class="lbl">Otro progenitor<input id="f_other" value="' + esc(CFG.otherParent) + '"></label></div>' +
    '<label class="lbl">Niños (uno por línea: <code>nombre | color</code>)</label><textarea id="f_kids" rows="3">' + esc(kidsTxt) + '</textarea>' +
    '<label class="switch"><input type="checkbox" id="f_cus" ' + (custodyOn() ? 'checked' : '') + '> Custodia por semanas alternas</label>' +
    '<div class="grid3"><label class="lbl">Inicio de una semana contigo (día y hora del cambio)<input id="f_anchor" type="datetime-local" value="' + esc((c.anchor || '').slice(0, 16)) + '"></label>' +
    '<label class="lbl">Ciclo (días)<input id="f_cycle" type="number" min="2" max="60" value="' + esc(c.cycleDays || 14) + '"></label>' +
    '<label class="lbl">Días contigo<input id="f_days" type="number" min="1" max="59" value="' + esc(c.daysWithParent || 7) + '"></label></div>' +
    '<div class="muted sm">El día de la semana y la hora del cambio salen de esa fecha (p. ej. un viernes a las 17:00).</div>' +
    '<label class="switch"><input type="checkbox" id="f_work" ' + (w.enabled !== false ? 'checked' : '') + '> Jornada de trabajo</label>' +
    '<label class="lbl">Nombre<input id="f_wlabel" value="' + esc(w.label || '') + '"></label><div class="wds">' + shifts + '</div>' +
    '<div class="muted sm">Deja vacío un día para marcarlo libre.</div>' +
    '<div class="grid3"><label class="lbl">Ciudad (tiempo)<input id="f_city" value="' + esc(CFG.city) + '"></label><label class="lbl">Latitud<input id="f_lat" inputmode="decimal" value="' + esc(CFG.lat) + '"></label><label class="lbl">Longitud<input id="f_lon" inputmode="decimal" value="' + esc(CFG.lon) + '"></label></div>' +
    '<label class="lbl">Nombre de tu tarifa de luz (opcional)<input id="f_tariff" value="' + esc(CFG.tariff.name || '') + '"></label>' +
    '<div class="row-btns"><button class="btn" data-act="saveFamily">Guardar familia</button></div></section>' +
    '<section class="card" data-fold="importar"><div class="card-h">📦 Importar / exportar ajustes</div>' +
    '<div class="muted sm">Pega aquí un JSON de ajustes (por ejemplo el que te has preparado en privado) y pulsa «Importar». Sustituye familia, custodia, jornada, tareas y demás.</div>' +
    '<textarea id="impTxt" rows="5" spellcheck="false" placeholder=\'{"tipo":"marco-familiar-ajustes", ...}\'></textarea>' +
    '<div class="row-btns"><button class="btn" data-act="importJson">Importar</button><label class="btn ghost filebtn">Desde archivo<input type="file" id="impFile" accept=".json,application/json" hidden></label></div>' +
    '<label class="switch"><input type="checkbox" id="expCals"> Incluir direcciones de calendarios al exportar (son secretas)</label>' +
    '<div class="row-btns"><button class="btn ghost" data-act="exportJson">Exportar</button></div></section>';
}
function slug(t, i) { return (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'peque-' + i; }
function saveFamily() {
  const adv = store.get('advanced', {});
  const kids = $('#f_kids').value.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p[0])
    .map((p, i) => ({ id: slug(p[0], i), name: p[0], color: /^#[0-9a-f]{6}$/i.test(p[1] || '') ? p[1] : ['#2F80ED', '#3BA55C', '#E8604C', '#8E5BC8'][i % 4] }));
  if (!kids.length) { toast('Pon al menos un niño'); return; }
  const shifts = {};
  WD.forEach(([n]) => { const f = $('#wf' + n).value, t = $('#wt' + n).value; if (f && t) shifts[String(n)] = [f, t]; });
  const anchor = $('#f_anchor').value;
  if ($('#f_cus').checked && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(anchor)) { toast('Pon la fecha y hora de inicio de una semana contigo'); return; }
  const lat = parseFloat(String($('#f_lat').value).replace(',', '.')), lon = parseFloat(String($('#f_lon').value).replace(',', '.'));
  Object.assign(adv, {
    parent: $('#f_parent').value.trim() || 'Papá', otherParent: $('#f_other').value.trim() || 'Mamá', kids,
    custody: { enabled: $('#f_cus').checked, anchor: anchor || (CFG.custody || {}).anchor || '', cycleDays: Math.max(2, parseInt($('#f_cycle').value, 10) || 14), daysWithParent: Math.max(1, parseInt($('#f_days').value, 10) || 7) },
    work: { enabled: $('#f_work').checked, label: $('#f_wlabel').value.trim(), shifts },
    city: $('#f_city').value.trim() || CFG.city,
    tariff: Object.assign({}, adv.tariff || {}, { name: $('#f_tariff').value.trim() })
  });
  if (!isNaN(lat) && !isNaN(lon)) { adv.lat = lat; adv.lon = lon; }
  store.set('advanced', adv); store.del('cache.weather');
  location.reload();
}
function exportJson() {
  const st = JSON.parse(JSON.stringify(settings));
  if (!$('#expCals').checked) { st.calendars = []; st.proxy = ''; delete st.syncBg; delete st.schoolIcs; }
  delete st.syncUrl;
  delete st.syncKey;
  const data = { tipo: 'marco-familiar-ajustes', version: 1, advanced: store.get('advanced', {}), settings: st, menu: menuState() };
  const txt = JSON.stringify(data, null, 2);
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
    a.download = 'ajustes-marco.json'; document.body.appendChild(a); a.click(); a.remove();
  } catch (e) { /* algunos navegadores de quiosco no descargan */ }
  openModal('<div class="modal-t">Ajustes exportados</div><div class="muted sm">También puedes copiarlos de aquí.</div><textarea class="share-ta" rows="10" readonly>' + esc(txt) + '</textarea>');
}
function importJson(txt) {
  let d;
  try { d = JSON.parse(txt); } catch (e) { toast('JSON no válido: ' + e.message); return false; }
  if (!d || typeof d !== 'object') { toast('JSON no válido'); return false; }
  const adv = d.advanced || (d.tipo ? {} : d);   // también acepta solo el bloque «advanced»
  store.set('advanced', adv);
  if (d.settings && typeof d.settings === 'object') {
    const cur = store.get('settings', {});
    const next = Object.assign({}, cur, d.settings);
    if (!d.settings.calendars || !d.settings.calendars.length) next.calendars = cur.calendars || [];
    if (!d.settings.proxy) next.proxy = cur.proxy || '';
    if (!d.settings.syncUrl) next.syncUrl = cur.syncUrl || '';
    if (!d.settings.syncKey) next.syncKey = cur.syncKey || '';
    if (!d.settings.syncBg) next.syncBg = cur.syncBg || {};
    store.set('settings', next);
  }
  if (d.menu && typeof d.menu === 'object') store.set('menu', d.menu);
  store.del('cache.weather');
  toast('Ajustes importados'); setTimeout(() => location.reload(), 400);
  return true;
}
document.addEventListener('change', (ev) => {
  if (ev.target && ev.target.id === 'impFile' && ev.target.files[0]) {
    const r = new FileReader(); r.onload = () => importJson(String(r.result)); r.readAsText(ev.target.files[0]);
  }
});

/* ---------------- AJUSTES ---------------- */
function syncStatusLine() {
  if (!syncReady()) return '<div class="sync-status" id="syncStatus">Sin configurar. Todo sigue en este dispositivo y el modo demo se comporta como siempre.</div>';
  const d = S.syncDataStatus;
  const c = S.syncCalStatus;
  const parts = [];
  if (d && d.ok) parts.push('Datos compartidos a las ' + hm(new Date(d.at)));
  else if (d && d.error) parts.push('Datos: ' + d.error);
  if (c && c.ok) parts.push((c.n || 0) + ' citas a las ' + hm(new Date(c.at)));
  else if (c && c.error) parts.push('Calendarios: ' + c.error);
  if (!parts.length) return '<div class="sync-status" id="syncStatus">Guardado en este dispositivo. Pulsa «Guardar y probar».</div>';
  const bad = (d && !d.ok) || (c && !c.ok);
  return '<div class="sync-status ' + (bad ? 'bad' : 'ok') + '" id="syncStatus">' + esc(parts.join(' · ')) + '</div>';
}
function syncCard() {
  const cals = store.get('cache.syncCals', []) || [];
  const bg = settings.syncBg || {};
  const rows = cals.map((cal) => {
    const on = Object.prototype.hasOwnProperty.call(bg, cal.id) ? !!bg[cal.id] : !!cal.background;
    return '<label class="sync-cal"><span class="sync-dot" style="--c:' + esc(cal.color || '#C8243B') + '"></span><span class="sync-name">' + esc(cal.name || 'Calendario') + '</span><span class="bg-flag"><input type="checkbox" data-sync-bg="' + esc(cal.id) + '"' + (on ? ' checked' : '') + '> De fondo</span></label>';
  }).join('');
  return '<section class="card wide" id="syncCard" data-fold="sync"><div class="card-h">🔄 Sincronización con Google</div>' +
    '<div class="muted sm">Opcional. Si lo configuras, las citas salen de tus calendarios de Google (sin dirección iCal ni proxy) y la compra, el menú, las estrellas y las citas hechas se comparten entre el marco y el móvil. Salud usa la misma clave para pedirle al script el resumen de Garmin, y los avisos de AEMET también: esas claves se quedan en el script, no en el marco. El outfit de mañana llega por la misma clave (lo publica el bot; el marco solo lo lee). La URL y la clave compartida se guardan solo en este dispositivo.</div>' +
    '<label class="lbl">URL de la aplicación web</label><input id="syncUrl" type="text" inputmode="url" autocomplete="off" spellcheck="false" value="' + esc(settings.syncUrl || '') + '" placeholder="https://script.google.com/macros/s/…/exec">' +
    '<label class="lbl">Clave compartida</label><div class="sync-key"><input id="syncKey" type="password" autocomplete="off" spellcheck="false" value="' + esc(settings.syncKey || '') + '" placeholder="una clave larga, solo tuya"><button class="btn sm ghost" data-act="showSyncKey" type="button">👁</button></div>' +
    syncStatusLine() +
    (rows ? '<div class="card-h sub">CALENDARIOS DE GOOGLE · DE FONDO NO ENTRA EN AHORA</div><div class="sync-cals">' + rows + '</div>' : '') +
    '<div class="row-btns"><button class="btn" data-act="saveSync">Guardar y probar</button></div>' +
    '<div class="muted sm">Vacío = como hasta ahora (modo demo si no hay iCal). El iCal de abajo queda de respaldo si esta conexión falla. «Haz la cesta» no cambia: copia la lista y abre el correo. Los nombres de la familia, el PIN y las direcciones no se sincronizan.</div></section>';
}
function mochilaCard() {
  return '<section class="card" data-fold="mochila"><div class="card-h">🎒 Mochila</div><div class="muted sm">Una regla por línea: <code>baloncesto|basket → equipación → 🏀</code>. Las palabras, separadas por <code>|</code>, se buscan en el título de la cita (sin mayúsculas ni tildes). Si el objeto es <code>día libre</code>, ese día no se prepara la mochila. En la semana sin niños se pausa sola.</div>' +
    '<textarea id="mochilaTxt" rows="6">' + esc(Mochila.texto(mochilaRules())) + '</textarea>' +
    '<div class="row-btns"><button class="btn" data-act="saveMochila">Guardar</button><button class="btn ghost" data-act="resetMochila">Restaurar lista por defecto</button></div></section>';
}
function casaCards() {
  const travelVal = typeof settings.travelText === 'string' ? settings.travelText : Casa.formatTravel(CFG.travel || []);
  const aisleVal = typeof settings.aisleText === 'string' ? settings.aisleText : Casa.formatAisles(CFG.aisles || []);
  const kidsVal = typeof settings.schoolKids === 'string' ? settings.schoolKids : (schoolCfg().kids || []).map((k) => k.name + (k.extras ? ' | ' + k.extras : '')).join('\n');
  const sc = schoolCfg();
  return '<section class="card" data-fold="salida"><div class="card-h">🚶 Salida</div><div class="muted sm">Minutos de camino si el título de la cita casa. Una regla por línea: <code>palabras = minutos</code>. Ejemplo: colegio 10, Basquevolt 20. Si ya es la hora, Hoy pone <b>Sal ya</b>.</div>' +
    '<textarea id="travelTxt" rows="4">' + esc(travelVal) + '</textarea>' +
    '<div class="row-btns"><button class="btn" data-act="saveTravel">Guardar</button><button class="btn ghost" data-act="resetTravel">Valores de ejemplo</button></div></section>' +
    '<section class="card" data-fold="cole"><div class="card-h">🏫 Cole</div><div class="muted sm">«Mañana no hay cole» usa el finde, los festivos, las fechas de abajo o un ICS solo de días sin clase. El horario y los extras son opcionales. Sin fechas ni ICS, el modo demo enseña unos días de Navidad de ejemplo.</div>' +
    '<label class="lbl">ICS de días sin cole<input id="schoolIcs" type="password" autocomplete="off" spellcheck="false" value="' + esc(settings.schoolIcs || '') + '" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"></label>' +
    '<label class="lbl">Fechas (una por línea, AAAA-MM-DD o MM-DD, o un rango con ..)</label><textarea id="schoolDates" rows="3" placeholder="2026-12-24&#10;12-25&#10;2026-12-23..2026-12-26">' + esc(settings.schoolDates || '') + '</textarea>' +
    '<div class="grid2"><label class="lbl">Empieza<input id="schoolFrom" type="time" value="' + esc(settings.schoolFrom || sc.from || '09:00') + '"></label><label class="lbl">Termina<input id="schoolTo" type="time" value="' + esc(settings.schoolTo || sc.to || '14:00') + '"></label></div>' +
    '<label class="lbl">Por niño: <code>nombre | extra</code> o <code>nombre | 09:00-14:00 | extra</code></label><textarea id="schoolKids" rows="3">' + esc(kidsVal) + '</textarea>' +
    '<div class="row-btns"><button class="btn" data-act="saveSchool">Guardar</button></div>' +
    (S.schoolError ? '<div class="muted sm">ICS: ' + esc(S.schoolError) + '</div>' : '') + '</section>' +
    '<section class="card" data-fold="pasillos"><div class="card-h">🛒 Pasillos</div><div class="muted sm">Orden de la tienda, de arriba a abajo. Una línea: <code>Nombre | palabras</code>. La última sin palabras es el cajón de Otros. Pensado para un Eroski; cámbialo a tu tienda.</div>' +
    '<textarea id="aisleTxt" rows="8">' + esc(aisleVal) + '</textarea>' +
    '<div class="row-btns"><button class="btn" data-act="saveAisles">Guardar</button><button class="btn ghost" data-act="resetAisles">Orden de ejemplo</button></div></section>';
}
function renderAjustes() {
  const calRows = (settings.calendars.length ? settings.calendars : []).map((c, i) => {
    const st = S.calStatus[c.id || String(i)];
    const stTxt = !c.url ? '' : st ? (st.ok ? '✅ ' + st.n + ' citas · ' + hm(new Date(st.at)) : '❌ ' + st.error) : 'Sin probar';
    return '<div class="cal-set" data-i="' + i + '"><input class="cs-name" value="' + esc(c.name) + '" placeholder="Nombre"><input class="cs-color" type="color" value="' + esc(c.color || '#E8604C') + '">' +
      '<input class="cs-url" type="password" value="' + esc(c.url) + '" placeholder="https://calendar.google.com/calendar/ical/…/private-…/basic.ics" autocomplete="off" spellcheck="false">' +
      '<button class="btn sm ghost" data-act="showUrl" data-i="' + i + '">👁</button><button class="btn sm ghost" data-act="delCal" data-i="' + i + '">Quitar</button><div class="cs-st"><label class="bg-flag"><input type="checkbox" class="cs-bg"' + (c.background ? ' checked' : '') + '> De fondo</label>' + esc(stTxt) + '</div></div>';
  }).join('');
  const pr = prices();
  const ch = chores().map((c) => [c.emoji, c.name, c.stars, c.slot || 'cole'].concat(c.kids && c.kids.length ? [c.kids.join(',')] : []).join(' | ')).join('\n');
  const rw = rewards().map((r) => [r.emoji, r.name, r.cost].join(' | ')).join('\n');
  screenEl.innerHTML = '<div class="ajustes">' +
    syncCard() +
    '<section class="card wide" data-fold="cal"><div class="card-h">🗓️ Calendarios (iCal secreto de Google)</div>' +
      '<div class="muted sm">Respaldo si no usas la sincronización de arriba, o si esa conexión falla. En Google Calendar (web): Configuración → tu calendario → «Dirección secreta en formato iCal». Se guarda SOLO en este dispositivo (localStorage), nunca en el código.</div>' +
      '<div id="calList">' + (calRows || '<div class="muted">No hay calendarios.</div>') + '</div>' +
      '<div class="row-btns"><button class="btn ghost" data-act="addCal">+ Añadir calendario</button></div>' +
      '<label class="lbl">Proxy CORS (opcional, prefijo que termina en <code>?url=</code>)</label><input id="proxy" value="' + esc(settings.proxy) + '" placeholder="https://marco-ics.tu-cuenta.workers.dev/?key=…&url=" spellcheck="false">' +
      '<div class="muted sm">«De fondo» pinta el calendario tenue (turnos, trabajo) y no entra en Ahora. En el modo demo ya hay un turno de ejemplo. Google no deja leer el iCal directamente desde el navegador (falta la cabecera CORS). Usa el Worker de <code>proxy/</code> o <code>serve.py</code>.</div>' +
      '<label class="switch"><input type="checkbox" id="demo" ' + (demoOn() ? 'checked' : '') + '> Modo demostración (citas inventadas)</label>' +
      '<div class="row-btns"><button class="btn" data-act="saveCals">Guardar y probar</button></div></section>' +
    familyCard() +
    '<section class="card" data-fold="precios"><div class="card-h">⚡ Precios de ' + esc(tariffName()) + '</div><div class="muted sm">Opcional. Cópialos de tu factura o contrato (€/kWh). Si los dejas vacíos no se enseña ningún precio.</div>' +
      '<div class="prices">' + ['punta', 'llano', 'valle'].map((k) => '<label>' + Luz.NOMBRE[k] + '<input id="p_' + k + '" inputmode="decimal" value="' + esc(pr[k] == null ? '' : pr[k]) + '" placeholder="0,000"></label>').join('') + '</div>' +
      '<div class="row-btns"><button class="btn" data-act="savePrices">Guardar precios</button></div></section>' +
    dineroCards() +
    plazosCard() +
    '<section class="card" data-fold="tareas"><div class="card-h">⭐ Tareas y recompensas</div><div class="muted sm">Una por línea: <code>emoji | nombre | estrellas | franja | niños</code>. Franja: <code>manana</code>, <code>cole</code> o <code>noche</code>. Niños: ids separados por coma; vacío = todos. En la semana sin niños (custodia) se pausan solas.</div>' +
      '<label class="lbl">Tareas</label><textarea id="choresTxt" rows="5">' + esc(ch) + '</textarea><label class="lbl">Recompensas</label><textarea id="rewardsTxt" rows="4">' + esc(rw) + '</textarea>' +
      '<div class="row-btns"><button class="btn" data-act="saveChores">Guardar</button><button class="btn ghost" data-act="resetStars">Poner estrellas a 0 🔒</button></div></section>' +
    mochilaCard() +
    '<section class="card" data-fold="pin"><div class="card-h">🔒 PIN de padres</div><div class="muted sm">Para aprobar canjes y entrar en Ajustes. Se guarda en este dispositivo; es un candado para niños, no seguridad fuerte.</div>' +
      '<div class="row-btns"><input id="pin1" type="password" inputmode="numeric" maxlength="8" placeholder="Nuevo PIN (4–8 cifras)"><button class="btn" data-act="savePin">' + (store.get('pin', null) ? 'Cambiar PIN' : 'Crear PIN') + '</button></div></section>' +
    '<section class="card" data-fold="cesta"><div class="card-h">🛒 Aviso de la cesta</div><div class="muted sm">Correo al que «Haz la cesta» abre el mensaje con la lista pendiente, para que Grok Bot la recoja cuando se lo pidas. Vacío hasta que lo pongas. Se guarda solo en este dispositivo. El marco no entra en la tienda.</div>' +
      '<label class="lbl">Correo<input id="eroskiMail" type="email" inputmode="email" autocomplete="off" spellcheck="false" value="' + esc(settings.eroskiNotifyEmail || '') + '" placeholder="bot@ejemplo.com"></label>' +
      '<div class="row-btns"><button class="btn" data-act="saveEroski">Guardar correo</button></div></section>' +
    '<section class="card" data-fold="pantalla"><div class="card-h">🌙 Pantalla</div><label class="switch"><input type="checkbox" id="night" ' + (settings.nightClock ? 'checked' : '') + '> Reloj nocturno de ' + esc(CFG.nightClock.from) + ' a ' + esc(CFG.nightClock.to) + '</label>' +
      '<label class="lbl">Tema<select id="theme">' +
        '<option value="auto"' + ((settings.theme || 'auto') === 'auto' ? ' selected' : '') + '>Automático</option>' +
        '<option value="dia"' + (settings.theme === 'dia' ? ' selected' : '') + '>Día</option>' +
        '<option value="noche"' + (settings.theme === 'noche' ? ' selected' : '') + '>Noche</option>' +
      '</select></label>' +
      '<label class="lbl">Colores<select id="paleta">' +
        [['clasica', 'Clásico · crema de día, oscuro de noche'], ['blanco', 'Blanco de día, oscuro de noche'], ['azul', 'Azul claro de día, azul noche de noche'], ['salvia', 'Verde salvia de día, oscuro de noche']]
          .map((o) => '<option value="' + o[0] + '"' + ((settings.paleta || 'clasica') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') +
      '</select></label>' +
      '<div class="muted sm">Automático sigue el amanecer y el atardecer de Vitoria, calculados en el dispositivo (sin otra API). De día, 60 s sin tocar vuelve a Hoy.</div>' +
      '<div class="row-btns"><button class="btn ghost" data-act="fullscreen">Pantalla completa</button><button class="btn" data-act="saveScreen">Guardar</button></div></section>' +
    casaCards() +
    '<section class="card" data-fold="avanzado"><div class="card-h">🧩 Avanzado (JSON)</div><div class="muted sm">Sobrescribe la configuración a mano (para casos raros). Lo normal es usar «Familia» o «Importar».</div>' +
      '<textarea id="adv" rows="5" spellcheck="false">' + esc(JSON.stringify(store.get('advanced', {}), null, 2)) + '</textarea>' +
      '<div class="row-btns"><button class="btn" data-act="saveAdv">Guardar y recargar</button><button class="btn danger" data-act="wipe">Borrar todos los datos de este dispositivo</button></div>' +
      '<div class="muted sm">Marco familiar · v5 · sin sincronización todo se queda en el navegador. Con la tarjeta de arriba, un Apps Script tuyo reparte calendarios y listas. La clave no sale de este dispositivo.</div></section>' +
    '</div>';
  foldAjustes();
}

/* Ajustes plegables: cada tarjeta se convierte en un <details> y se ordena por grupos.
 * Cerradas por defecto; se recuerda cuáles abres mientras dure la sesión. «Desplegar todo» se guarda en el dispositivo. */
const AJUSTES_GRUPOS = [
  ['Conexión', ['sync', 'cal']],
  ['Familia y niños', ['familia', 'cole', 'tareas', 'mochila', 'salida']],
  ['Casa', ['precios', 'dinero', 'plazos', 'pasillos', 'cesta']],
  ['Este dispositivo', ['pantalla', 'pin', 'importar', 'avanzado']]
];
function foldAjustes() {
  const root = document.querySelector('.ajustes');
  if (!root) return;
  const all = !!store.get('ajustesAll', false);
  const open = S.ajustesOpen || (S.ajustesOpen = {});
  const byKey = {};
  root.querySelectorAll(':scope > section.card[data-fold]').forEach((sec) => {
    const key = sec.dataset.fold;
    const h = sec.querySelector(':scope > .card-h');
    const det = document.createElement('details');
    det.className = sec.className + ' fold';
    if (sec.id) det.id = sec.id;
    det.dataset.fold = key;
    const sum = document.createElement('summary');
    sum.className = 'card-h';
    if (h) { sum.innerHTML = h.innerHTML; h.remove(); }
    const body = document.createElement('div');
    body.className = 'fold-body';
    while (sec.firstChild) body.appendChild(sec.firstChild);
    det.appendChild(sum);
    det.appendChild(body);
    det.open = all || !!open[key];
    det.addEventListener('toggle', () => { open[key] = det.open; });
    byKey[key] = det;
    sec.remove();
  });
  const frag = document.createDocumentFragment();
  const bar = document.createElement('div');
  bar.className = 'aj-bar';
  bar.innerHTML = '<span class="muted sm">Toca una sección para abrirla.</span><button type="button" class="btn sm ghost" data-act="foldAll">' + (all ? 'Plegar todo' : 'Desplegar todo') + '</button>';
  frag.appendChild(bar);
  AJUSTES_GRUPOS.forEach(([name, keys]) => {
    const got = keys.map((k) => byKey[k]).filter(Boolean);
    if (!got.length) return;
    const h = document.createElement('h3');
    h.className = 'aj-group';
    h.textContent = name;
    frag.appendChild(h);
    got.forEach((d) => { frag.appendChild(d); delete byKey[d.dataset.fold]; });
  });
  Object.keys(byKey).forEach((k) => frag.appendChild(byKey[k]));
  root.insertBefore(frag, root.firstChild);
}
function readSyncBg() {
  const bg = Object.assign({}, settings.syncBg || {});
  document.querySelectorAll('[data-sync-bg]').forEach((el) => { bg[el.getAttribute('data-sync-bg')] = el.checked; });
  settings.syncBg = bg;
}
function readCalForm() {
  document.querySelectorAll('.cal-set').forEach((row) => {
    const i = +row.dataset.i; const c = settings.calendars[i]; if (!c) return;
    c.name = row.querySelector('.cs-name').value.trim() || 'Calendario ' + (i + 1);
    c.color = row.querySelector('.cs-color').value;
    c.url = row.querySelector('.cs-url').value.trim();
    const bg = row.querySelector('.cs-bg');
    c.background = bg ? bg.checked : !!c.background;
  });
}
function parseLines(txt, numKey) {
  return txt.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p.length >= 3 && p[1])
    .map((p, i) => {
      const o = { id: p[1].toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').slice(0, 24) || 'x' + i, emoji: p[0] || '•', name: p[1], [numKey]: Math.max(1, parseInt(p[2], 10) || 1) };
      if (numKey === 'stars') {
        const slot = (p[3] || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (slot === 'manana' || slot === 'cole' || slot === 'noche') o.slot = slot;
        if (p[4]) o.kids = p[4].split(',').map((s) => s.trim()).filter(Boolean);
      }
      return o;
    });
}
async function settingsAction(act, el) {
  switch (act) {
    case 'saveFamily': saveFamily(); break;
    case 'exportJson': exportJson(); break;
    case 'importJson': importJson($('#impTxt').value); break;
    case 'addCal': readCalForm(); settings.calendars.push({ id: U.uid(), name: 'Calendario ' + (settings.calendars.length + 1), color: ['#E8604C', '#3BA55C', '#2F80ED', '#8E5BC8', '#F5A623'][settings.calendars.length % 5], url: '', background: false }); saveSettings(); render(); break;
    case 'menuSpan': updateMenu((m) => { m.span = el.dataset.span === '5' ? 5 : 7; }); break;
    case 'resetMenu': S.menuPick = null; updateMenu((m) => { const d = defaultMenu(); m.span = d.span; m.dishes = d.dishes.slice(); m.plan = JSON.parse(JSON.stringify(d.plan)); m._forceRev = true; }); toast('Menú de ejemplo'); break;
    case 'delCal': readCalForm(); settings.calendars.splice(+el.dataset.i, 1); saveSettings(); render(); break;
    case 'showUrl': { const inp = el.parentElement.querySelector('.cs-url'); inp.type = inp.type === 'password' ? 'text' : 'password'; break; }
    case 'saveCals':
      readCalForm();
      settings.calendars.forEach((c) => { if (!c.id) c.id = U.uid(); if (c.url && !/^https:\/\//i.test(c.url)) c.url = c.url.replace(/^webcal:\/\//i, 'https://'); });
      settings.proxy = $('#proxy').value.trim();
      { const want = $('#demo').checked; const def = realCalendars().length === 0 && !syncReady(); settings.demo = want === def ? null : want; }
      saveSettings(); toast('Guardado. Probando calendarios…'); await loadCalendars(); render(); toast(demoOn() ? 'Modo demo activo' : 'Calendarios actualizados'); break;
    case 'savePrices':
      settings.prices = {};
      ['punta', 'llano', 'valle'].forEach((k) => { const v = $('#p_' + k).value.trim().replace(',', '.'); settings.prices[k] = v === '' || isNaN(+v) ? null : +v; });
      saveSettings(); toast('Precios guardados'); break;
    case 'saveDinero': {
      const subs = parseSubs($('#dinSubs').value);
      if (subs.some((s) => s.euros == null)) { toast('Cada suscripción necesita un importe en €'); break; }
      settings.dinero = {
        luzEste: parseEuro($('#dinLuz').value),
        luzPasado: parseEuro($('#dinLuzP').value),
        fibraEste: parseEuro($('#dinFibra').value),
        fibraPasado: parseEuro($('#dinFibraP').value),
        fibraAlt: parseEuro($('#dinFibraAlt').value),
        suscPasado: parseEuro($('#dinSuscP').value),
        suscripciones: subs
      };
      saveSettings(); toast('Dinero guardado'); render(); break;
    }
    case 'savePlazos': {
      const parsed = parsePlazos($('#plazosTxt').value);
      if (parsed.bad && !parsed.ok.length && $('#plazosTxt').value.trim()) { toast('Cada plazo necesita título y fecha AAAA-MM-DD'); break; }
      settings.plazos = parsed.ok;
      saveSettings();
      toast(parsed.bad ? 'Plazos guardados. ' + parsed.bad + (parsed.bad === 1 ? ' línea no válida' : ' líneas no válidas') : 'Plazos guardados');
      render(); break;
    }
    case 'saveChores': {
      const ch = parseLines($('#choresTxt').value, 'stars'), rw = parseLines($('#rewardsTxt').value, 'cost');
      const adv = store.get('advanced', {}); if (ch.length) adv.chores = ch; if (rw.length) adv.rewards = rw;
      store.set('advanced', adv); CFG.chores = adv.chores || CFG.chores; CFG.rewards = adv.rewards || CFG.rewards; toast('Tareas y recompensas guardadas'); render(); break;
    }
    case 'saveMochila': {
      const parsed = Mochila.parse($('#mochilaTxt').value);
      if (!parsed.length) { toast('Escribe al menos una regla: palabras → objeto'); break; }
      const adv = store.get('advanced', {});
      adv.backpack = parsed;
      store.set('advanced', adv);
      CFG.backpack = parsed;
      toast('Mochila guardada');
      render();
      break;
    }
    case 'resetMochila': {
      const adv = store.get('advanced', {});
      delete adv.backpack;
      store.set('advanced', adv);
      delete CFG.backpack;
      toast('Lista por defecto');
      render();
      break;
    }
    case 'resetStars': if (await requirePin('PIN para poner las estrellas a 0')) { const k = K(); Sync.resetStars(k); Sync.noteLog(k, hm(now()) + ' · Estrellas a 0'); saveK(k); toast('Estrellas a 0'); } break;
    case 'showSyncKey': { const inp = $('#syncKey'); if (inp) inp.type = inp.type === 'password' ? 'text' : 'password'; break; }
    case 'saveSync': {
      const rawUrl = $('#syncUrl').value;
      const url = Sync.normalizeUrl(rawUrl);
      if (rawUrl.trim() && !url) { toast('La URL tiene que ser https (en casa vale http://127.0.0.1 o localhost)'); break; }
      const key = $('#syncKey').value.trim();
      if (url && key.length < 8) { toast('La clave tiene que tener al menos 8 caracteres'); break; }
      if (url && !key) { toast('Falta la clave'); break; }
      readSyncBg();
      settings.syncUrl = url || '';
      settings.syncKey = key;
      if (!url || !key) { settings.syncUrl = ''; settings.syncKey = ''; }
      saveSettings();
      S.syncAuthToasted = false;
      S.dataDown = false;
      S.calDown = false;
      S.syncDown = false;
      if (!syncReady()) { paintOffline(); toast('Sincronización apagada'); render(); break; }
      toast('Probando…', 1500);
      await Sync.syncNow();
      await loadCalendars({ quiet: true });
      await loadSalud().catch(() => {});
      await loadAvisos().catch(() => {});
      render();
      const bad = (S.syncDataStatus && !S.syncDataStatus.ok) || (S.syncCalStatus && !S.syncCalStatus.ok);
      toast(bad ? 'Guardado en este dispositivo. No he podido conectar.' : 'Sincronización lista');
      break;
    }
    case 'savePin': {
      const v = $('#pin1').value.trim();
      if (!/^\d{4,8}$/.test(v)) { toast('El PIN debe tener de 4 a 8 cifras'); break; }
      if (store.get('pin', null) && !(await pinPad('PIN actual'))) break;
      store.set('pin', v); toast('PIN guardado'); render(); break;
    }
    case 'saveEroski': {
      const v = $('#eroskiMail').value.trim();
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { toast('Pon un correo válido o déjalo vacío'); break; }
      settings.eroskiNotifyEmail = v;
      saveSettings();
      toast(v ? 'Correo guardado' : 'Sin correo: se elige al enviar');
      break;
    }
    case 'saveScreen': {
      settings.nightClock = $('#night').checked;
      const theme = ($('#theme') && $('#theme').value) || 'auto';
      settings.theme = (theme === 'dia' || theme === 'noche') ? theme : 'auto';
      const paleta = ($('#paleta') && $('#paleta').value) || 'clasica';
      settings.paleta = ['blanco', 'azul', 'salvia'].indexOf(paleta) >= 0 ? paleta : 'clasica';
      saveSettings();
      applyTheme();
      toast('Guardado');
      break;
    }
    case 'saveTravel':
      settings.travelText = $('#travelTxt').value;
      saveSettings();
      toast('Salidas guardadas');
      render();
      break;
    case 'resetTravel':
      settings.travelText = null;
      saveSettings();
      toast('Valores de ejemplo');
      render();
      break;
    case 'saveSchool': {
      settings.schoolIcs = $('#schoolIcs').value.trim();
      const dates = $('#schoolDates').value.trim();
      settings.schoolDates = dates ? $('#schoolDates').value : null;
      settings.schoolFrom = $('#schoolFrom').value;
      settings.schoolTo = $('#schoolTo').value;
      settings.schoolKids = $('#schoolKids').value;
      saveSettings();
      toast('Cole guardado');
      loadSchool().then(() => render());
      break;
    }
    case 'saveAisles':
      settings.aisleText = $('#aisleTxt').value;
      saveSettings();
      toast('Pasillos guardados');
      render();
      break;
    case 'resetAisles':
      settings.aisleText = null;
      saveSettings();
      toast('Orden de ejemplo');
      render();
      break;
    case 'fullscreen': try { await document.documentElement.requestFullscreen(); } catch (e) { toast('Este navegador no deja pantalla completa'); } break;
    case 'saveAdv':
      try { const j = JSON.parse($('#adv').value || '{}'); store.set('advanced', j); location.reload(); } catch (e) { toast('JSON no válido: ' + e.message); } break;
    case 'wipe':
      if (store.get('pin', null) && !(await pinPad('PIN para borrar todo'))) break;
      if (confirm('¿Borrar calendarios, listas, estrellas y ajustes de este dispositivo?')) { U.store.clearAll(); location.reload(); } break;
  }
}
