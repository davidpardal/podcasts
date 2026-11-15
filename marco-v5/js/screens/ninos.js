/* Pantalla Niños: tareas, rachas, recompensas y PIN de padres. */
'use strict';

/* ---------------- NIÑOS ---------------- */
const K = () => Object.assign({ stars: {}, done: {}, pending: [], log: [] }, store.get('ninos', {}));
const saveK = (k) => { store.set('ninos', k); Sync.touch(); };
const chores = () => CFG.chores;
const rewards = () => CFG.rewards;

function dayComplete(k, day) {
  if (!kidsHomeOn(day)) return false;
  const done = (k.done || {})[dayKey(day)] || {};
  const list = chores();
  if (!list.length) return false;
  return list.every((c) => choreKids(c).every((kid) => (done[c.id] || []).indexOf(kid.id) !== -1));
}
function streakCount(k, t) {
  let n = 0;
  let d = sod(t);
  if (!dayComplete(k, d)) d = addDays(d, -1);
  for (let i = 0; i < 42; i++) {
    const day = addDays(d, -i);
    if (!kidsHomeOn(day)) continue;
    if (dayComplete(k, day)) n++;
    else break;
  }
  return n;
}
function weekStripFor(t, doneFn) {
  const mon = mondayOf(t);
  const letters = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i);
    let cls = 'future';
    if (sameDay(d, t)) cls = doneFn(d) ? 'ok' : 'today';
    else if (sod(d) < sod(t)) cls = !kidsHomeOn(d) ? 'paused' : doneFn(d) ? 'ok' : 'miss';
    html += '<span class="st-day ' + cls + '">' + letters[i] + '</span>';
  }
  return html;
}
function weekStrip(k, t) { return weekStripFor(t, (d) => dayComplete(k, d)); }
function kidChores(kid) { return chores().filter((c) => choreKids(c).some((x) => x.id === kid.id)); }
function kidDayComplete(k, kid, day) {
  if (!kidsHomeOn(day)) return false;
  const done = (k.done || {})[dayKey(day)] || {};
  const list = kidChores(kid);
  if (!list.length) return false;
  return list.every((c) => (done[c.id] || []).indexOf(kid.id) !== -1);
}
function kidTodayStats(k, kid, t) {
  const done = (k.done || {})[dayKey(t)] || {};
  const list = kidChores(kid);
  let ok = 0;
  list.forEach((c) => { if ((done[c.id] || []).indexOf(kid.id) !== -1) ok++; });
  return { ok: ok, total: list.length };
}
function kidStreak(k, kid, t) {
  let n = 0;
  let d = sod(t);
  if (!kidDayComplete(k, kid, d)) d = addDays(d, -1);
  for (let i = 0; i < 42; i++) {
    const day = addDays(d, -i);
    if (!kidsHomeOn(day)) continue;
    if (kidDayComplete(k, kid, day)) n++;
    else break;
  }
  return n;
}
function ringSvg(pct, color) {
  const circ = 94.2;
  const p = Math.max(0, Math.min(1, pct || 0));
  const dash = (p * circ).toFixed(1) + ' ' + circ.toFixed(1);
  return '<svg class="ring" viewBox="0 0 36 36" aria-hidden="true"><circle class="ring-bg" cx="18" cy="18" r="15"></circle><circle class="ring-fg" cx="18" cy="18" r="15" style="stroke:' + esc(color) + ';stroke-dasharray:' + dash + '"></circle></svg>';
}
function kidRingsHtml(k, t) {
  const paused = !kidsHome(t);
  return '<div class="kid-rings">' + CFG.kids.map((kid) => {
    const stats = kidTodayStats(k, kid, t);
    const pct = stats.total ? stats.ok / stats.total : 0;
    const streak = kidStreak(k, kid, t);
    const label = paused ? 'pausa' : (stats.ok + '/' + stats.total);
    return '<div class="kid-ring" style="--c:' + esc(kid.color) + '" data-kid-ring="' + esc(kid.id) + '">' +
      ringSvg(paused ? 0 : pct, kid.color) +
      '<div class="kr-txt"><div class="kr-n">' + esc(kid.name) + ' · ' + esc(label) + '</div>' +
      '<div class="kr-s">Racha ' + streak + (streak === 1 ? ' día' : ' días') + '</div>' +
      '<span class="streak-days">' + weekStripFor(t, (d) => kidDayComplete(k, kid, d)) + '</span></div></div>';
  }).join('') + '</div>';
}
function choresSummary() {
  const k = K(); const t = now(); const today = dayKey(t);
  const done = k.done[today] || {};
  const paused = !kidsHome(t);
  let pending = 0, overdue = 0;
  if (!paused) {
    chores().forEach((c) => choreKids(c).forEach((kid) => {
      if ((done[c.id] || []).indexOf(kid.id) === -1) { pending++; if (slotOverdue(c, t)) overdue++; }
    }));
  }
  const chips = CFG.kids.map((kid) => '<span class="kid-chip" style="--c:' + kid.color + '">' + esc(kid.name) + ' ⭐ ' + (k.stars[kid.id] || 0) + '</span>').join('');
  return { pending, overdue, paused, chips, streak: streakCount(k, t) };
}

function renderNinos() {
  const t = now();
  const k = K(); const today = dayKey(t);
  const done = k.done[today] || {};
  const paused = !kidsHome(t);
  const w = custodyOn() ? Custody.withParent(t) : null;
  const chips = CFG.kids.map((kid) => '<span class="kid-chip lg" style="--c:' + kid.color + '"><span class="av">' + esc(kid.name[0]) + '</span>' + esc(kid.name) + ' ⭐ ' + (k.stars[kid.id] || 0) + '</span>').join('');
  const streak = streakCount(k, t);
  const strip = '<div class="streak"><span class="streak-n">Racha · ' + streak + (streak === 1 ? ' día' : ' días') + '</span><span class="streak-days">' + weekStrip(k, t) + '</span></div>' + kidRingsHtml(k, t);
  const rows = SLOTS.map((slot) => {
    const list = chores().filter((c) => slotId(c) === slot.id);
    if (!list.length) return '';
    const late = !paused && list.some((c) => slotOverdue(c, t) && choreKids(c).some((kid) => (done[c.id] || []).indexOf(kid.id) === -1));
    return '<div class="slot-h">' + esc(slot.name) + (late ? '<span class="od-tag">fuera de hora</span>' : '') + '</div>' + list.map((c) => {
      const od = !paused && slotOverdue(c, t) && choreKids(c).some((kid) => (done[c.id] || []).indexOf(kid.id) === -1);
      return '<div class="chore' + (od ? ' overdue' : '') + (paused ? ' is-paused' : '') + '"><div class="ch-ic">' + esc(c.emoji) + '</div><div class="ch-n">' + esc(c.name) + '<div class="ch-s">+' + c.stars + ' ⭐' + (od ? ' · fuera de hora' : '') + '</div></div><div class="ch-kids">' +
        choreKids(c).map((kid) => { const on = (done[c.id] || []).includes(kid.id); return '<button class="kid-btn' + (on ? ' on' : '') + '" style="--c:' + kid.color + '" data-chore="' + esc(c.id) + '" data-kid="' + esc(kid.id) + '"' + (paused ? ' disabled' : '') + '>' + (on ? '✓ ' : '') + esc(kid.name) + '</button>'; }).join('') + '</div></div>';
    }).join('');
  }).join('');
  const pause = paused ? '<div class="pause-banner">Tareas en pausa · esta semana están con ' + esc(CFG.otherParent) + '. Se reanudan solas al volver.</div>' : '';
  const rws = rewards().map((r) => '<div class="reward"><div class="rw-h"><span class="rw-ic">' + esc(r.emoji) + '</span><span class="rw-n">' + esc(r.name) + '</span><span class="rw-c">' + r.cost + ' ⭐</span></div><div class="rw-kids">' +
    CFG.kids.map((kid) => {
      const s = k.stars[kid.id] || 0; const pct = Math.min(100, s / r.cost * 100);
      const asked = (k.pending || []).some((p) => !p.deleted && p.kid === kid.id && p.reward === r.id);
      return '<div class="rw-kid" style="--c:' + kid.color + '"><span class="av sm">' + esc(kid.name[0]) + '</span><div class="prog"><div style="width:' + pct + '%"></div></div>' +
        (asked ? '<span class="rw-st">Pedido</span>' : s >= r.cost ? '<button class="btn sm" data-ask="' + esc(r.id) + '" data-kid="' + esc(kid.id) + '">Canjear</button>' : '<span class="rw-st">faltan ' + (r.cost - s) + '</span>') + '</div>';
    }).join('') + '</div></div>').join('');
  const livePending = (k.pending || []).filter((p) => !p.deleted);
  const pend = livePending.map((p) => {
    const kid = CFG.kids.find((x) => x.id === p.kid) || { name: p.kid }; const r = rewards().find((x) => x.id === p.reward) || { name: p.reward, cost: 0, emoji: '🎁' };
    return '<div class="pend"><span>' + esc(r.emoji + ' ' + kid.name + ': ' + r.name) + ' (' + r.cost + ' ⭐)</span><span><button class="btn sm ok" data-approve="' + esc(p.id) + '">Aprobar 🔒</button> <button class="btn sm ghost" data-reject="' + esc(p.id) + '">No</button></span></div>';
  }).join('');
  const log = (k.log || []).slice(-6).reverse().map((l) => '<div class="log">' + esc(typeof l === 'string' ? l : (l.text || '')) + '</div>').join('');
  screenEl.innerHTML = '<div class="ninos">' +
    mochilaBlock(t) +
    '<section class="card"><div class="card-h">⭐ Tareas de hoy <span class="muted sm">' + (w === null ? '' : w ? 'Semana con ' + esc(CFG.parent) : 'Esta semana están con ' + esc(CFG.otherParent)) + '</span></div><div class="kid-chips">' + chips + '</div>' + strip + pause + rows +
      '<div class="muted sm">Cada uno toca su nombre al terminar. Volver a tocar lo deshace. Mañana, después del cole y noche. En la semana sin niños se pausan solas.</div></section>' +
    '<section class="col"><div class="card"><div class="card-h">🎁 Recompensas</div>' + rws + '</div>' +
      '<div class="card"><div class="card-h">🔒 Pendiente de aprobar <span class="count">' + livePending.length + '</span></div>' + (pend || '<div class="muted">Nada pendiente.</div>') +
      (log ? '<div class="card-h sub">Últimos movimientos</div>' + log : '') + '</div></section></div>';
}

function toggleChore(choreId, kidId) {
  if (!kidsHome(now())) { toast('Tareas en pausa: esta semana no están en casa'); return; }
  const k = K(); const today = dayKey(now());
  const c = chores().find((x) => x.id === choreId); const kid = choreKids(c || {}).find((x) => x.id === kidId);
  if (!c || !kid) return;
  k.done[today] = k.done[today] || {};
  const arr = k.done[today][choreId] = k.done[today][choreId] || [];
  const i = arr.indexOf(kidId);
  const off = i >= 0;
  if (off) arr.splice(i, 1); else arr.push(kidId);
  Sync.noteDone(k, today, choreId, kidId, !off);
  Sync.noteStar(k, kidId, off ? -c.stars : c.stars);
  Sync.noteLog(k, hm(now()) + ' · ' + kid.name + (off ? ' deshace «' : ' hizo «') + c.name + '» (' + (off ? '−' : '+') + c.stars + ' ⭐)');
  Object.keys(k.done).sort().slice(0, -45).forEach((d) => delete k.done[d]);
  saveK(k); render();
}

/* ---------------- PIN de padres ---------------- */
function pinPad(title) {
  return new Promise((resolve) => {
    const lock = store.get('pinLock', { fails: 0, until: 0 });
    if (lock.until > Date.now()) { toast('Demasiados intentos. Espera ' + Math.ceil((lock.until - Date.now()) / 60000) + ' min.'); return resolve(false); }
    let val = '';
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];
    openModal('<div class="pin"><div class="modal-h">' + esc(title) + '</div><div class="pin-dots" id="pinDots"></div><div class="pin-grid">' + keys.map((x) => '<button class="pin-k" data-k="' + x + '">' + x + '</button>').join('') + '</div><button class="btn ghost" data-k="x">Cancelar</button></div>', true);
    const dots = () => { $('#pinDots').textContent = val.replace(/./g, '●') || ' '; };
    dots();
    $('#modal').onclick = (ev) => {
      const b = ev.target.closest('[data-k]'); if (!b) return;
      const kk = b.dataset.k;
      if (kk === 'x') { closeModal(); return resolve(false); }
      if (kk === '⌫') { val = val.slice(0, -1); return dots(); }
      if (kk === '✓') {
        closeModal();
        if (val === store.get('pin', null)) { store.set('pinLock', { fails: 0, until: 0 }); return resolve(true); }
        const l = store.get('pinLock', { fails: 0, until: 0 }); l.fails++;
        if (l.fails >= 5) { l.until = Date.now() + 5 * 60000; l.fails = 0; }
        store.set('pinLock', l); toast('PIN incorrecto'); return resolve(false);
      }
      if (val.length < 8) { val += kk; dots(); }
    };
  });
}
async function requirePin(title) {
  if (!store.get('pin', null)) { toast('Primero crea el PIN de padres en Ajustes'); return false; }
  return pinPad(title);
}
