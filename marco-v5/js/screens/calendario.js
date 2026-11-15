/* Pantalla Calendario (13 semanas). */
'use strict';

/* ---------------- CALENDARIO ---------------- */
function renderCalendario() {
  const t = now();
  const today = sod(t);
  const start = mondayOf(t);
  const evs = allEvents();
  const wxBy = {};
  (S.weather && S.weather.days || []).forEach((d) => { wxBy[d.date] = d; });
  let html = '<div class="cal-head">' + ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => '<div>' + d + '</div>').join('') + '</div><div class="cal-body">';
  for (let wk = 0; wk < 13; wk++) {
    const ws = addDays(start, wk * 7);
    const we = addDays(ws, 6);
    const label = U.MESES[ws.getMonth()] + (ws.getMonth() !== we.getMonth() ? ' – ' + U.MESES[we.getMonth()] : '') + ' ' + we.getFullYear();
    html += '<div class="cal-week"><div class="cal-wl">' + esc(label) + '</div><div class="cal-row">';
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      const st = dayStatus(d);
      const items = eventsOn(d, evs);
      const mainEv = items.filter((e) => !e.background);
      const bgEv = items.filter((e) => e.background);
      const sh = shiftOn(d);
      const festTag = U.festivoEtiqueta(d);
      const wx = wxBy[dayKey(d)];
      const first = d.getDate() === 1;
      const max = 4;
      html += '<div class="cell c-' + st + (sameDay(d, today) ? ' is-today' : '') + (d < today ? ' is-past' : '') + (first ? ' is-first' : '') + '" data-day="' + dayKey(d) + '">' +
        '<div class="cell-h"><span class="cell-n">' + (sameDay(d, today) ? 'Hoy' : U.DIAS_C[d.getDay()]) + (first ? ' · ' + U.MESES_C[d.getMonth()] : '') + '</span><span class="cell-d">' + d.getDate() + '</span></div>' +
        (wx ? '<div class="cell-wx">' + Weather.icon(wx.code) + ' ' + Math.round(wx.max) + '°/' + Math.round(wx.min) + '° <span class="' + (wx.rain >= 40 ? 'hi' : '') + '">💧' + (wx.rain ?? '–') + '%</span></div>' : '') +
        (sh ? '<div class="shift sm">💼 ' + esc(sh.from + '–' + sh.to) + '</div>' : '') +
        (festTag ? '<div class="day-tag" title="' + esc(festTag.name) + '">' + esc(festTag.label) + '</div>' : '') +
        '<div class="cell-evs">' + mainEv.slice(0, max).map((e) => evItem(e, d, true)).join('') +
        (mainEv.length > max ? '<button class="more" data-dayall="' + dayKey(d) + '">+' + (mainEv.length - max) + ' más</button>' : '') +
        bgEv.slice(0, 2).map((e) => evItem(e, d, true)).join('') + '</div></div>';
    }
    html += '</div></div>';
  }
  html += '</div>' + (custodyOn() ? '<div class="cal-legend"><span class="lgd lgd-p"></span>Semana con ' + esc(kidsNames()) + ' (cambio los ' + handoverDay() + (handoverDay().endsWith('s') ? '' : 's') + ' a las ' + Custody.handoverTime() + ')<span class="lgd lgd-o"></span>Con ' + esc(CFG.otherParent) + '</div>' : '');
  screenEl.innerHTML = demoPill() + '<div class="cal">' + html + '</div>';
}
