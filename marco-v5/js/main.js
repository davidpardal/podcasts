/* Navegación, eventos, reloj, refrescos y arranque. Se carga el último. */
'use strict';

/* ---------------- Navegación y eventos ---------------- */
const SCREENS = { hoy: renderHoy, calendario: renderCalendario, ninos: renderNinos, compra: renderCompra, menu: renderMenu, salud: renderSalud, casa: renderCasa, ajustes: renderAjustes };
// Enlaces de versiones anteriores: #luz, #dinero y #plazos abren Casa en su pestaña; #semana y #outfit, Hoy.
const ALIAS = { luz: ['casa', 'luz'], dinero: ['casa', 'dinero'], plazos: ['casa', 'plazos'], semana: ['hoy'], outfit: ['hoy'] };
function resolveScreen(name) {
  const a = ALIAS[name];
  if (a) { if (a[1]) S.casaTab = a[1]; return a[0]; }
  return SCREENS[name] ? name : 'hoy';
}
function render() {
  document.querySelectorAll('#rail [data-go]').forEach((b) => {
    const on = b.dataset.go === S.screen;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  document.body.dataset.screen = S.screen;
  try { (SCREENS[S.screen] || renderHoy)(); } catch (e) { console.error(e); screenEl.innerHTML = '<div class="card">Error al pintar: ' + esc(e.message) + '</div>'; }
  pintarFotosOutfit();
  tickClocks();
}
function closeDrawer() {
  if (!document.documentElement.classList.contains('rail-drawer')) return;
  document.documentElement.classList.remove('rail-drawer');
  document.body.classList.remove('rail-drawer');
  syncRailButton();
}
function railWantsCollapsed() {
  const w = window.innerWidth || 1200;
  if (w < 720) return true;
  const pref = store.get('railCollapsed', null);
  return pref === null ? w < 960 : !!pref;
}
function syncRailButton() {
  const btn = document.querySelector('[data-act=railToggle]');
  if (!btn) return;
  const phone = (window.innerWidth || 1200) < 720;
  const drawer = document.documentElement.classList.contains('rail-drawer');
  const collapsed = document.documentElement.classList.contains('rail-collapsed');
  const expanded = drawer || !collapsed;
  btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  btn.setAttribute('aria-label', expanded ? 'Contraer el menú' : 'Ampliar el menú');
  const label = btn.querySelector('.nav-label');
  if (label) label.textContent = phone ? (drawer ? 'Cerrar' : 'Menú') : (collapsed ? 'Ampliar' : 'Contraer');
}
function applyRail(opts) {
  const phone = (window.innerWidth || 1200) < 720;
  if (opts && opts.toggle) {
    if (phone) {
      const open = !document.documentElement.classList.contains('rail-drawer');
      document.documentElement.classList.toggle('rail-drawer', open);
      document.body.classList.toggle('rail-drawer', open);
    } else {
      const next = !document.documentElement.classList.contains('rail-collapsed');
      store.set('railCollapsed', next);
      document.documentElement.classList.toggle('rail-collapsed', next);
      document.body.classList.toggle('rail-collapsed', next);
      document.documentElement.classList.remove('rail-drawer');
      document.body.classList.remove('rail-drawer');
    }
  } else {
    const collapsed = railWantsCollapsed();
    document.documentElement.classList.toggle('rail-collapsed', collapsed);
    document.body.classList.toggle('rail-collapsed', collapsed);
    if (!phone) {
      document.documentElement.classList.remove('rail-drawer');
      document.body.classList.remove('rail-drawer');
    }
  }
  syncRailButton();
}
async function go(name, opts) {
  closeDrawer();
  name = resolveScreen(name);
  if (opts && opts.tab) S.casaTab = opts.tab;
  if (opts && opts.fold) { S.ajustesOpen = S.ajustesOpen || {}; S.ajustesOpen[opts.fold] = true; }
  if (name === 'ajustes' && store.get('pin', null) && S.screen !== 'ajustes') { if (!(await pinPad('PIN de padres para Ajustes'))) return; }
  S.screen = name; S.lastTouch = Date.now(); render();
  screenEl.scrollTop = 0;
}
document.addEventListener('click', async (ev) => {
  S.lastTouch = Date.now();
  if (!$('#modal').classList.contains('hidden') && ev.target.closest('#modal')) return;
  const t = ev.target;
  const g = t.closest('[data-go]'); if (g) return go(g.dataset.go, { tab: g.dataset.tab, fold: g.dataset.fold });
  const a = t.closest('[data-act]');
  if (a) {
    const act = a.dataset.act;
    if (act === 'refresh') return refreshAll(true);
    if (act === 'sleep') return sleep(true);
    if (act === 'railToggle') return applyRail({ toggle: true });
    if (act === 'railClose') return closeDrawer();
    if (act === 'outfit') return showOutfit();
    if (act === 'casaTab') {
      if (S.casaTab === a.dataset.tab) return;
      S.casaTab = a.dataset.tab;
      render();
      screenEl.scrollTop = 0;
      return;
    }
    if (act === 'foldAll') {
      const all = !store.get('ajustesAll', false);
      store.set('ajustesAll', all);
      S.ajustesOpen = {};
      return render();
    }
    if (act === 'saludRange') {
      const n = a.dataset.range === '28' ? 28 : 7;
      if (S.saludDias === n) return;
      const top = screenEl.scrollTop;
      S.saludDias = n;
      render();
      screenEl.scrollTop = top;
      return;
    }
    if (act === 'clearDone') {
      const c = C();
      const rev = Sync.nextRev();
      (c.items || []).forEach((x) => { if (x.done && !x.deleted) { x.deleted = true; x.rev = rev; } });
      saveC(c);
      return render();
    }
    if (act === 'share') {
      const txt = listaPendienteTexto().text;
      if (navigator.share) { try { await navigator.share({ text: txt }); return; } catch (e) { /* cancelado */ } }
      return openModal('<div class="modal-t">Lista para copiar</div><textarea class="share-ta" rows="8" readonly>' + esc(txt) + '</textarea>');
    }
    if (act === 'hazCesta') return hazLaCesta();
    if (act === 'undoCompra') return undoCompra();
    return settingsAction(act, a);
  }
  const avisoBtn = t.closest('[data-aviso]'); if (avisoBtn) return showAviso(+avisoBtn.dataset.aviso);
  const packBtn = t.closest('[data-pack]'); if (packBtn) return showPack(packBtn);
  const e = t.closest('[data-ev]'); if (e) return showEvent(e.dataset.ev);
  const da = t.closest('[data-dayall]'); if (da) return showDay(da.dataset.dayall);
  const ch = t.closest('[data-chore]'); if (ch) return toggleChore(ch.dataset.chore, ch.dataset.kid);
  const ask = t.closest('[data-ask]');
  if (ask) { const k = K(); k.pending.push({ id: U.uid(), kid: ask.dataset.kid, reward: ask.dataset.ask, at: Date.now(), rev: Sync.nextRev(), deleted: false }); saveK(k); toast('Pedido. Falta que lo apruebe un adulto.'); return render(); }
  const ap = t.closest('[data-approve]');
  if (ap) {
    if (!(await requirePin('PIN para aprobar el canje'))) return;
    const k = K(); const p = k.pending.find((x) => x.id === ap.dataset.approve); if (!p) return;
    const r = rewards().find((x) => x.id === p.reward); const kid = CFG.kids.find((x) => x.id === p.kid);
    if (r && (k.stars[p.kid] || 0) >= r.cost) {
      Sync.noteStar(k, p.kid, -r.cost);
      Sync.noteLog(k, hm(now()) + ' · ✅ ' + (kid ? kid.name : '') + ' canjea «' + r.name + '» (−' + r.cost + ' ⭐)');
      toast('¡Canje aprobado! 🎉');
    } else toast('No le llegan las estrellas');
    Sync.dropPending(k, p.id); saveK(k); return render();
  }
  const rj = t.closest('[data-reject]');
  if (rj) { const k = K(); Sync.dropPending(k, rj.dataset.reject); saveK(k); return render(); }
  const it = t.closest('[data-item]');
  if (it) return toggleItem(it.dataset.item);
  const hb = t.closest('[data-hab]'); if (hb) return addItem(hb.dataset.hab);
  const clearSlot = t.closest('[data-clear-slot]');
  if (clearSlot) { const slot = clearSlot.closest('[data-slot]'); if (slot) assignMeal(slot.dataset.day, slot.dataset.meal, ''); return; }
  const slot = t.closest('[data-slot]');
  if (slot) { S.menuPick = { day: slot.dataset.day, meal: slot.dataset.meal }; return render(); }
  const delDish = t.closest('[data-del-dish]');
  if (delDish) {
    const name = delDish.dataset.delDish;
    return updateMenu((m) => {
      m.dishes = m.dishes.filter((d) => d.toLowerCase() !== name.toLowerCase());
      Object.keys(m.plan || {}).forEach((k) => ['comida', 'cena'].forEach((meal) => {
        if (m.plan[k] && m.plan[k][meal] && m.plan[k][meal].toLowerCase() === name.toLowerCase()) m.plan[k][meal] = '';
      }));
    });
  }
  const dish = t.closest('[data-dish]');
  if (dish) {
    if (!S.menuPick) { toast('Falta elegir comida o cena'); return; }
    return assignMeal(S.menuPick.day, S.menuPick.meal, dish.dataset.dish);
  }
});
let dragDish = '';
document.addEventListener('dragstart', (ev) => {
  const d = ev.target.closest && ev.target.closest('[data-dish]');
  if (!d || !ev.dataTransfer) return;
  dragDish = d.dataset.dish;
  ev.dataTransfer.setData('text/plain', d.dataset.dish);
  ev.dataTransfer.effectAllowed = 'copy';
});
document.addEventListener('dragover', (ev) => {
  const slot = ev.target.closest && ev.target.closest('[data-slot]');
  if (!slot) return;
  ev.preventDefault();
  document.querySelectorAll('.menu-slot.drag').forEach((el) => el.classList.remove('drag'));
  slot.classList.add('drag');
});
document.addEventListener('dragleave', (ev) => {
  const slot = ev.target.closest && ev.target.closest('[data-slot]');
  if (slot) slot.classList.remove('drag');
});
document.addEventListener('drop', (ev) => {
  const slot = ev.target.closest && ev.target.closest('[data-slot]');
  if (!slot) return;
  ev.preventDefault();
  slot.classList.remove('drag');
  const dish = (ev.dataTransfer && ev.dataTransfer.getData('text/plain')) || dragDish;
  if (dish) assignMeal(slot.dataset.day, slot.dataset.meal, dish);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); closeDrawer(); return; }
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
  const rail = document.getElementById('rail');
  if (!rail || !rail.contains(document.activeElement)) return;
  const items = Array.prototype.slice.call(rail.querySelectorAll('button.nav'));
  const i = items.indexOf(document.activeElement);
  if (i < 0 || !items.length) return;
  e.preventDefault();
  let n = i;
  if (e.key === 'ArrowDown') n = (i + 1) % items.length;
  else if (e.key === 'ArrowUp') n = (i - 1 + items.length) % items.length;
  else if (e.key === 'Home') n = 0;
  else n = items.length - 1;
  items[n].focus();
});

/* ---------------- Reloj, noche y refresco ---------------- */
function tickClocks() {
  const t = now();
  document.querySelectorAll('[data-clock="big"],[data-clock="night"]').forEach((el) => { if (el.textContent !== hm(t)) el.textContent = hm(t); });
  const r = $('[data-clock="rail"]'); if (r) r.innerHTML = pad(t.getHours()) + '<br>' + pad(t.getMinutes());
  const nd = $('[data-clock="nightdate"]'); if (nd) nd.textContent = U.fechaLarga(t);
  const nn = $('[data-clock="nightnext"]');
  if (nn) { const line = nightStartLine(t); if (nn.textContent !== line) nn.textContent = line; }
  const no = $('[data-clock="nightoutfit"]');
  if (no) { const line = nightOutfitLine(); if (no.textContent !== line) no.textContent = line; }
  applyTheme();
}
function nightStartLine(t) {
  const morning = t.getHours() >= 12 ? addDays(sod(t), 1) : sod(t);
  const label = t.getHours() >= 12 ? 'Mañana empieza con' : 'Hoy empieza con';
  const evs = eventsOn(morning).filter((e) => !e.background && !e.virtual);
  const first = evs.filter((e) => !e.allDay).sort((a, b) => a.start - b.start)[0] || evs[0];
  const extra = packPhrase(morning);
  if (!first) return label + ' · nada apuntado' + (extra ? ' · ' + extra : '');
  return label + ' · ' + (first.allDay ? 'todo el día' : hm(first.start)) + ' ' + first.title + (extra ? ' · ' + extra : '');
}
function nightOutfitLine() {
  const o = currentOutfit();
  return o ? Outfit.brief(o, now()) : '';
}
// Fondo de día y de noche de cada juego de colores (el CSS lleva el resto).
const PALETAS = { clasica: ['#F7EEE2', '#1A1816'], blanco: ['#F2F3F5', '#1A1816'], azul: ['#E9F1FB', '#0F1A2E'], salvia: ['#E8EFE4', '#1A1816'] };
function applyTheme() {
  const mode = settings.theme === 'dia' || settings.theme === 'noche' ? settings.theme : 'auto';
  const night = mode === 'noche' || (mode !== 'dia' && Casa.isNight(now(), Number(CFG.lat) || 42.85, Number(CFG.lon) || -2.67));
  document.documentElement.classList.toggle('theme-night', !!night);
  document.documentElement.setAttribute('data-theme', mode);
  const paleta = PALETAS[settings.paleta] ? settings.paleta : 'clasica';
  document.documentElement.setAttribute('data-paleta', paleta);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', PALETAS[paleta][night ? 1 : 0]);
}
function inNightWindow(t) {
  if (!settings.nightClock) return false;
  const m = t.getHours() * 60 + t.getMinutes();
  const [fh, fm] = CFG.nightClock.from.split(':').map(Number), [th, tm] = CFG.nightClock.to.split(':').map(Number);
  const f = fh * 60 + fm, to = th * 60 + tm;
  return f > to ? (m >= f || m < to) : (m >= f && m < to);
}
function sleep(on) {
  S.sleeping = on; S.autoSleep = false; $('#night').classList.toggle('hidden', !on);
  if (!on) S.wakeUntil = Date.now() + 10 * 60000;
}
$('#night').addEventListener('click', () => sleep(false));

let lastMinute = -1;
function userBusy() {
  const a = document.activeElement;
  return (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) || !$('#modal').classList.contains('hidden') || S.screen === 'ajustes';
}
setInterval(() => {
  const t = now();
  tickClocks();
  // De día, 60 s sin tocar vuelve a Hoy (el reloj falso de las pruebas no avanza solo).
  if (!inNightWindow(t) && !S.sleeping && S.screen !== 'hoy' && S.screen !== 'ajustes' && Date.now() - (S.lastTouch || 0) > 60000 && !userBusy()) {
    S.screen = 'hoy';
    render();
  }
  if (t.getMinutes() !== lastMinute) {
    lastMinute = t.getMinutes();
    if (!userBusy()) render();
    // De noche, vuelve a «Hoy» tras 3 min sin tocar
    if (inNightWindow(t) && S.screen !== 'hoy' && S.screen !== 'ajustes' && Date.now() - (S.lastTouch || 0) > 3 * 60000 && !userBusy()) { S.screen = 'hoy'; render(); }
    const inW = inNightWindow(t);
    if (inW && Date.now() > S.wakeUntil && !S.sleeping) { sleep(true); S.autoSleep = true; }
    if (!inW && S.sleeping && S.autoSleep) { sleep(false); S.autoSleep = false; }
    // Recarga completa a las 04:00 para coger cambios del código y limpiar memoria
    if (t.getHours() === 4 && t.getMinutes() === 0 && !U.simulated) location.reload();
  }
}, 1000);
setInterval(() => {
  Promise.all([loadCalendars().catch(() => {}), Sync.syncNow().catch(() => {})]).then(() => { if (!userBusy()) render(); });
}, 15 * 60000);
setInterval(() => { loadWeather().then(() => loadAvisos()).then(() => loadOutfit()).then(() => { if (!userBusy()) render(); }).catch(() => {}); }, 30 * 60000);
setInterval(() => { if (!syncReady()) return; loadSalud().then(() => { if (!userBusy()) render(); }).catch(() => {}); }, Salud.EVERY);
window.addEventListener('resize', () => applyRail());
setInterval(() => loadPVPC().then(() => { if (!userBusy()) render(); }), 60 * 60000);
window.addEventListener('online', () => { paintOffline(); refreshAll(false); });
window.addEventListener('offline', paintOffline);
paintOffline();
if ('serviceWorker' in navigator) {
  // Alcance = la carpeta de esta página (/podcasts/marco-v5/), no /marco/ ni las versiones anteriores.
  const base = new URL('./', location.href);
  navigator.serviceWorker.register(new URL('sw.js', base), { scope: base.href }).catch(() => {});
}

Sync.attach({
  settings: function () { return settings; },
  onApplied: function () {
    if (S.screen === 'ajustes' || !$('#modal').classList.contains('hidden')) return;
    const a = document.activeElement;
    const sel = a && a.id ? a.id : '';
    const val = a && 'value' in a ? a.value : '';
    const start = a && a.selectionStart;
    render();
    if (!sel) return;
    const n = document.getElementById(sel);
    if (n && 'value' in n) {
      n.value = val;
      try { n.focus(); if (start != null) n.setSelectionRange(start, start); } catch (e) { /* el campo ya no está */ }
    }
  },
  onDataStatus: function (st) {
    S.syncDataStatus = st;
    store.set('cache.syncData', st);
    S.dataDown = !!(st && st.offline);
    S.syncDown = !!(S.dataDown || S.calDown);
    if (st && st.ok) S.syncCount = (S.syncCount || 0) + 1;
    paintOffline();
  },
  toast: toast,
  onOutfit: function (raw) {
    if (!syncReady()) return;
    applyOutfitPayload(raw);
    if (S.screen === 'ajustes' || !$('#modal').classList.contains('hidden') || userBusy()) return;
    render();
  }
});

// Arranque
applyRail();
primeSalud();
primeAvisos();
primeOutfit();
primeSchool();
applyTheme();
const hash = (location.hash || '').replace('#', '');
if ((SCREENS[hash] || ALIAS[hash]) && hash !== 'ajustes') S.screen = resolveScreen(hash);
render();
refreshAll(false);

// Para pruebas automáticas
window.Marco = { S, CFG, settings, render, go, allEvents, eventsOn, custodyEvents, demoOn, syncReady, loadCalendars, loadSalud, planHoy, loadAvisos, loadOutfit, showOutfit, showEvent, showAviso, morningLine, nightStartLine, nightOutfitLine, packDay, menuState, kidsHome, mealsFor, paintOffline, applyTheme, leavePlan, schoolOpt, SALUD_EVERY: Salud.EVERY, DAY_IDLE_MS: 60000 };
document.addEventListener('error', (ev) => {
  const img = ev.target;
  if (!img || !img.classList || !img.classList.contains('outfit-img')) return;
  if (img.getAttribute('data-outfit-src')) return;
  outfitPh(img);
}, true);
