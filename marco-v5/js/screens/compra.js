/* Pantalla Compra. */
'use strict';

/* ---------------- COMPRA ---------------- */
const C = () => Object.assign({ items: [], counts: {} }, store.get('compra', {}));
const saveC = (c) => { store.set('compra', c); Sync.touch(); };
const compraViva = (c) => (c.items || []).filter((x) => !x.deleted);
function addItem(name) {
  name = (name || '').trim().replace(/\s+/g, ' ');
  if (!name) return;
  name = name[0].toUpperCase() + name.slice(1);
  const c = C();
  const rev = Sync.nextRev();
  const ex = (c.items || []).find((x) => !x.deleted && x.name.toLowerCase() === name.toLowerCase());
  const tomb = (c.items || []).find((x) => x.deleted && x.name.toLowerCase() === name.toLowerCase());
  if (ex) { ex.done = false; ex.rev = rev; }
  else if (tomb) { tomb.deleted = false; tomb.done = false; tomb.rev = rev; tomb.at = Date.now(); }
  else c.items.push({ id: U.uid(), name, done: false, deleted: false, at: Date.now(), rev: rev });
  c.counts[name] = (c.counts[name] || 0) + 1;
  saveC(c); render();
}
function habituales(c) {
  const onList = new Set(compraViva(c).filter((x) => !x.done).map((x) => x.name.toLowerCase()));
  const fromCounts = Object.entries(c.counts).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  const all = fromCounts.concat(CFG.habitualesBase);
  const seen = new Set(); const out = [];
  all.forEach((n) => { const l = n.toLowerCase(); if (!onList.has(l) && !seen.has(l)) { seen.add(l); out.push(n); } });
  return out.slice(0, 9);
}
function listaPendienteTexto() {
  const names = compraViva(C()).filter((x) => !x.done).map((x) => x.name);
  return { names: names, text: 'Lista de la compra:\n' + names.map((n) => '• ' + n).join('\n') };
}
function mailtoCesta(text) {
  const to = String(settings.eroskiNotifyEmail || '').trim();
  const addr = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) ? to : '';
  return 'mailto:' + addr + '?subject=' + encodeURIComponent('Haz la cesta') + '&body=' + encodeURIComponent(text);
}
function abrirMailto(href) {
  // Iframe: abre el correo sin navegar esta página (un <a> la deja en blanco al cancelar).
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;border:0;opacity:0';
  frame.src = href;
  document.body.appendChild(frame);
  setTimeout(() => { if (frame.parentNode) frame.remove(); }, 2000);
}
async function copiarTexto(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* WebView del marco o sin permiso */ }
  let ta = null;
  try {
    ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { ta.setSelectionRange(0, text.length); } catch (e2) { /* algunos WebView */ }
    return !!document.execCommand('copy');
  } catch (e) { return false; }
  finally { if (ta && ta.parentNode) ta.remove(); }
}
async function hazLaCesta() {
  const lista = listaPendienteTexto();
  if (!lista.names.length) { toast('No hay nada pendiente en la lista'); return; }
  const copied = await copiarTexto(lista.text);
  const href = mailtoCesta(lista.text);
  const avisar = () => toast('Lista lista para Grok Bot', 12000);
  let salio = false;
  const limpiar = () => {
    window.removeEventListener('blur', alSalir);
    window.removeEventListener('focus', alVolver);
    document.removeEventListener('visibilitychange', alVolver);
    clearTimeout(fin);
  };
  const alSalir = () => { salio = true; };
  const alVolver = () => {
    if (document.hidden) { salio = true; return; }
    if (!salio) return;
    limpiar();
    avisar();
  };
  const fin = setTimeout(limpiar, 120000);
  window.addEventListener('blur', alSalir);
  window.addEventListener('focus', alVolver);
  document.addEventListener('visibilitychange', alVolver);
  // El aviso va antes que el correo: el diálogo del sistema tapa la página.
  avisar();
  if (!copied) {
    openModal('<div class="modal-t">Lista lista para Grok Bot</div><div class="muted sm">No se pudo copiar sola. Selecciónala aquí. El correo se abre con la misma lista (el destinatario se pone en Ajustes).</div><textarea class="share-ta" rows="8" readonly>' + esc(lista.text) + '</textarea>');
  }
  setTimeout(() => abrirMailto(href), 400);
}
function clearUndo() {
  if (S.undoTimer) clearTimeout(S.undoTimer);
  S.undoTimer = 0;
  S.undoItem = null;
  const bar = $('#undo');
  if (bar) bar.classList.add('hidden');
}
function offerUndo(item) {
  if (S.undoTimer) clearTimeout(S.undoTimer);
  S.undoItem = { id: item.id, name: item.name };
  const bar = $('#undo');
  if (!bar) return;
  const name = bar.querySelector('[data-undo-name]');
  if (name) name.textContent = item.name;
  bar.classList.remove('hidden');
  S.undoTimer = setTimeout(clearUndo, 1200);
}
function undoCompra() {
  if (!S.undoItem) return;
  const id = S.undoItem.id;
  const c = C();
  const x = (c.items || []).find((y) => y.id === id);
  if (x && x.done && !x.deleted) { x.done = false; x.rev = Sync.nextRev(); saveC(c); }
  clearUndo();
  render();
}
function toggleItem(id) {
  const c = C();
  const x = (c.items || []).find((y) => y.id === id);
  if (!x || x.deleted) return;
  x.done = !x.done;
  x.rev = Sync.nextRev();
  saveC(c);
  if (x.done) offerUndo(x); else clearUndo();
  render();
}
function renderCompra() {
  const c = C();
  const items = compraViva(c);
  const pending = items.filter((x) => !x.done);
  const groups = Casa.groupByAisle(items, aisleRules());
  const itemBtn = (x) => '<button class="item' + (x.done ? ' done' : '') + '" data-item="' + esc(x.id) + '"><span class="box">' + (x.done ? '✓' : '') + '</span>' + esc(x.name) + '</button>';
  const itemsHtml = groups.length
    ? groups.map((g) => '<div class="aisle"><div class="aisle-h">' + esc(g.name) + '</div>' + g.items.map(itemBtn).join('') + '</div>').join('')
    : '<div class="muted">La lista está vacía.</div>';
  screenEl.innerHTML = '<div class="compra">' +
    '<section class="card"><div class="card-h">🛒 Lista de la compra <span class="count">' + pending.length + '</span></div>' +
      '<form class="add" id="addForm" autocomplete="off"><input id="addInput" placeholder="Añadir… (p. ej. leche)" maxlength="60" enterkeyhint="done"><button class="btn" type="submit">Añadir</button></form>' +
      '<div class="items">' + itemsHtml + '</div>' +
      '<div class="row-btns"><button class="btn ghost" data-act="clearDone">Quitar comprados</button><button class="btn ghost" data-act="share">Compartir lista</button><button class="btn" data-act="hazCesta">Haz la cesta</button></div>' +
      '<div class="muted sm">Pasillos de ejemplo, al estilo Eroski. El orden se cambia en Ajustes. Al tachar, un segundo para deshacer.</div></section>' +
    '<section class="card"><div class="card-h sub">HABITUALES · TOCA PARA AÑADIR</div><div class="habs">' +
      habituales(c).map((n) => '<button class="hab" data-hab="' + esc(n) + '"><b>' + esc(n) + '</b><span>+ Añadir</span></button>').join('') + '</div>' +
      '<div class="muted sm">La lista se guarda en este dispositivo y, si activas la sincronización, también en los demás. «Compartir lista» la pasa al móvil. «Haz la cesta» la copia y abre un correo para Grok Bot (el de Ajustes). El marco no entra en la tienda.</div></section></div>';
  const f = $('#addForm');
  f.onsubmit = (ev) => { ev.preventDefault(); const v = $('#addInput').value; addItem(v); setTimeout(() => { const i = $('#addInput'); if (i) i.focus(); }, 0); };
}
