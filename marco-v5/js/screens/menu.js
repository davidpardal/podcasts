/* Pantalla Menú semanal. */
'use strict';

/* ---------------- MENÚ SEMANAL ---------------- */
const DAY_LETTERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
function renderMenu() {
  const m = menuState();
  const t = now();
  const todayIdx = weekdayIndex(t);
  const nDays = m.span === 5 ? 5 : 7;
  const pick = S.menuPick || {};
  const days = [];
  for (let i = 0; i < nDays; i++) {
    const p = (m.plan && m.plan[String(i)]) || {};
    const slot = (meal, label) => {
      const on = pick.day === String(i) && pick.meal === meal;
      const val = p[meal] || '';
      return '<div class="menu-slot' + (on ? ' on' : '') + '" data-slot data-day="' + i + '" data-meal="' + meal + '">' +
        '<div class="ms-k">' + label + '</div><div class="ms-v">' + esc(val || '—') + '</div>' +
        (val ? '<button class="ms-x" data-clear-slot aria-label="Vaciar">×</button>' : '') + '</div>';
    };
    days.push('<div class="menu-day' + (i === todayIdx ? ' is-today' : '') + '"><div class="md-n">' + DAY_LETTERS[i] + '</div>' + slot('comida', 'COMIDA') + slot('cena', 'CENA') + '</div>');
  }
  const dishes = (m.dishes || []).map((n) => '<span class="dish-wrap"><button class="dish" draggable="true" data-dish="' + esc(n) + '">' + esc(n) + '</button><button class="dish-x" data-del-dish="' + esc(n) + '" aria-label="Quitar ' + esc(n) + '">×</button></span>').join('');
  screenEl.innerHTML = '<div class="menu">' +
    '<section class="card"><div class="menu-top"><div class="card-h" style="border:0;margin:0;padding:0">🍲 Menú de la semana</div><div class="span-toggle">' +
      '<button class="btn sm' + (m.span === 7 ? '' : ' ghost') + '" data-act="menuSpan" data-span="7">L–D</button>' +
      '<button class="btn sm' + (m.span === 5 ? '' : ' ghost') + '" data-act="menuSpan" data-span="5">L–V</button></div></div>' +
    '<div class="muted sm">Primero la casilla, luego el plato. También se puede arrastrar. Se guarda en este dispositivo y, si activas la sincronización, también en los demás.</div>' +
    days.join('') + '</section>' +
    '<section class="card"><div class="card-h sub">PLATOS HABITUALES</div><div class="dishes">' + dishes + '</div>' +
    '<form class="add" id="dishForm" autocomplete="off"><input id="dishInput" placeholder="Añadir plato" maxlength="40" enterkeyhint="done"><button class="btn" type="submit">Añadir</button></form>' +
    '<div class="row-btns"><button class="btn ghost" data-act="resetMenu">Volver al ejemplo</button></div></section></div>';
  const form = $('#dishForm');
  form.onsubmit = (ev) => {
    ev.preventDefault();
    const raw = $('#dishInput').value.trim().replace(/\s+/g, ' ');
    if (!raw) return;
    const name = raw.charAt(0).toUpperCase() + raw.slice(1);
    updateMenu((menu) => { if (!menu.dishes.some((d) => d.toLowerCase() === name.toLowerCase())) menu.dishes.push(name); });
  };
}
