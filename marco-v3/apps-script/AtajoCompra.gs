/**
 * Atajo de iOS → lista compartida de la compra (marco v3).
 *
 * Pégalo en el MISMO proyecto que Code.gs. No sustituye a Code.gs:
 * doPost y handle_ de Code.gs llaman aquí si estas funciones existen.
 * Si tu Code.gs es anterior y no tiene el gancho, añade solo esto
 * dentro de handle_, después de comprobar la clave:
 *
 *   if (action === 'compra' || action === 'atajo') return json_(atajoCompra_(body, params));
 *
 * Y, en doPost, si el cuerpo no es JSON:
 *
 *   if (typeof atajoDesdeTexto_ === 'function') return atajoDesdeTexto_(e, raw);
 *
 * La clave es la misma MARCO_KEY (Propiedades del script). No la escribas aquí.
 * Cómo montar el atajo: ATAJO.md
 */

function atajoCompra_(body, params) {
  params = params || {};
  body = body || {};
  var text = body.text || body.item || body.items || params.text || params.item || '';
  if (Array.isArray(text)) text = text.join('\n');
  return anadirCompraTexto_(String(text));
}

/** Cuerpo de texto plano o formulario, con la clave en el cuerpo o en ?key= */
function atajoDesdeTexto_(e, raw) {
  var params = (e && e.parameter) || {};
  var key = String(params.key || '');
  var text = String(raw || '');
  var action = String(params.action || '');
  if (text.indexOf('=') !== -1 && text.charAt(0) !== '{') {
    var form = parseFormAtajo_(text);
    if (form.key) key = String(form.key);
    if (form.action) action = String(form.action);
    if (form.text) text = String(form.text);
    else if (form.item) text = String(form.item);
  }
  if (action && action !== 'compra' && action !== 'atajo') return json_({ ok: false, error: 'Acción desconocida' });
  var auth = claveOk_(key);
  if (!auth.ok) return json_({ ok: false, error: auth.error });
  try {
    return json_(anadirCompraTexto_(text));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function anadirCompraTexto_(text) {
  var names = textosCompra_(text);
  if (!names.length) return { ok: false, error: 'Falta el texto (p. ej. leche)' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Prueba otra vez en unos segundos');
  try {
    var state = loadState_();
    if (!state || typeof state !== 'object' || Array.isArray(state)) state = {};
    var compra = state.compra || {};
    if (!compra.items) compra.items = [];
    if (!compra.counts) compra.counts = {};
    var added = [];
    names.forEach(function (name) {
      var rev = Date.now() * 1000;
      var low = name.toLowerCase();
      var ex = null;
      var tomb = null;
      compra.items.forEach(function (it) {
        if (!it || String(it.name || '').toLowerCase() !== low) return;
        if (it.deleted) tomb = it;
        else ex = it;
      });
      if (ex) {
        ex.done = false;
        ex.deleted = false;
        ex.rev = rev;
      } else if (tomb) {
        tomb.deleted = false;
        tomb.done = false;
        tomb.rev = rev;
        tomb.at = Date.now();
      } else {
        compra.items.push({
          id: idCompra_(),
          name: name,
          done: false,
          deleted: false,
          at: Date.now(),
          rev: rev
        });
      }
      compra.counts[name] = num_(compra.counts[name]) + 1;
      added.push(name);
    });
    state.compra = compra;
    saveState_(state);
    var pending = compra.items.filter(function (it) { return it && !it.deleted && !it.done; }).length;
    return { ok: true, added: added, pending: pending };
  } finally {
    lock.releaseLock();
  }
}

function textosCompra_(text) {
  var parts = String(text || '').replace(/\r/g, '\n').split(/[\n,;]+/);
  var out = [];
  var seen = {};
  parts.forEach(function (p) {
    var s = String(p || '').replace(/\s+/g, ' ').trim();
    s = s.replace(/^(comprar|compra|añadir|anadir|añade|anade|pon|poner)\s+/i, '').trim();
    if (!s) return;
    s = s.charAt(0).toLocaleUpperCase('es') + s.slice(1);
    var k = s.toLowerCase();
    if (seen[k]) return;
    seen[k] = 1;
    out.push(s);
  });
  return out;
}

function parseFormAtajo_(raw) {
  var out = {};
  String(raw || '').split('&').forEach(function (pair) {
    var i = pair.indexOf('=');
    var k = decodeURIComponent((i < 0 ? pair : pair.slice(0, i)).replace(/\+/g, ' '));
    var v = decodeURIComponent((i < 0 ? '' : pair.slice(i + 1)).replace(/\+/g, ' '));
    if (k) out[k] = v;
  });
  return out;
}

function idCompra_() {
  return 'atajo' + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}
