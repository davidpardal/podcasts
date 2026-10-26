/* Calendarios: descarga los iCal (directo o vía proxy), los interpreta con ical.js
 * (RRULE, EXDATE, RDATE y excepciones RECURRENCE-ID) y genera las citas de un rango. */
(function () {
  const MAX_ITER = 20000;

  function toDate(t) {
    if (t.isDate) return new Date(t.year, t.month - 1, t.day);
    return t.toJSDate();
  }

  function parseICS(text, cal, rangeStart, rangeEnd) {
    const comp = new ICAL.Component(ICAL.parse(text));
    comp.getAllSubcomponents('vtimezone').forEach((v) => {
      try { ICAL.TimezoneService.register(v); } catch (e) { /* zona rara: se trata como hora local */ }
    });
    const vevents = comp.getAllSubcomponents('vevent');
    const masters = new Map();
    const exceptions = [];
    vevents.forEach((v) => {
      if (v.hasProperty('recurrence-id')) exceptions.push(v);
      else masters.set(v.getFirstPropertyValue('uid') || U.uid(), new ICAL.Event(v));
    });
    const loose = [];
    exceptions.forEach((v) => {
      const ex = new ICAL.Event(v);
      const m = masters.get(ex.uid);
      if (m && m.isRecurring()) { try { m.relateException(ex); } catch (e) { loose.push(ex); } }
      else loose.push(ex);
    });

    const out = [];
    const push = (ev, item, s, e) => {
      const status = String(item.component.getFirstPropertyValue('status') || '').toUpperCase();
      if (status === 'CANCELLED') return;
      const allDay = !!item.startDate.isDate;
      const start = toDate(s);
      let end = e ? toDate(e) : (allDay ? U.addDays(start, 1) : new Date(start.getTime() + 3600000));
      if (end <= start) end = allDay ? U.addDays(start, 1) : new Date(start.getTime() + 30 * 60000);
      if (end <= rangeStart || start >= rangeEnd) return;
      out.push({
        id: (item.uid || 'x') + '@' + start.getTime(),
        title: item.summary || '(sin título)',
        start, end, allDay,
        location: item.location || '',
        description: item.description || '',
        calName: cal.name, color: cal.color || '#C8243B',
        background: !!cal.background
      });
    };

    masters.forEach((ev) => {
      if (!ev.startDate) return;
      if (ev.isRecurring()) {
        const it = ev.iterator();
        let next, n = 0;
        while ((next = it.next()) && n++ < MAX_ITER) {
          const s = toDate(next);
          if (s >= rangeEnd) break;
          const det = ev.getOccurrenceDetails(next);
          push(ev, det.item, det.startDate, det.endDate);
        }
      } else {
        push(ev, ev, ev.startDate, ev.endDate);
      }
    });
    loose.forEach((ex) => push(ex, ex, ex.startDate, ex.endDate));
    return out;
  }

  // Descarga un calendario. Si hay proxy configurado se usa como prefijo: PROXY + encodeURIComponent(url)
  async function fetchICS(url, proxy) {
    const target = proxy ? proxy + encodeURIComponent(url) : url;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), 20000);
    try {
      const r = await fetch(target, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const t = await r.text();
      if (!/BEGIN:VCALENDAR/.test(t)) throw new Error('La respuesta no es un calendario iCal');
      return t;
    } catch (e) {
      if (e && e.name === 'TypeError') {
        const err = new Error(proxy ? 'No se pudo conectar con el proxy' : 'Bloqueado por CORS o sin conexión (Google no permite leer el iCal desde el navegador: configura un proxy)');
        err.cors = !proxy; throw err;
      }
      throw e;
    } finally { clearTimeout(timer); }
  }

  /* ---------- Modo demostración: un iCal inventado, generado alrededor de hoy ---------- */
  const VTZ = ['BEGIN:VTIMEZONE', 'TZID:Europe/Madrid', 'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST',
    'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT', 'BEGIN:STANDARD', 'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD', 'END:VTIMEZONE'];
  const fmt = (d, h, m) => d.getFullYear() + U.pad(d.getMonth() + 1) + U.pad(d.getDate()) + (h == null ? '' : 'T' + U.pad(h) + U.pad(m || 0) + '00');

  function demoCalendars(today) {
    const mon = U.mondayOf(today);
    const lastMon = U.addDays(mon, -7);
    const ev = (uid, summary, startLines, extra) => ['BEGIN:VEVENT', 'UID:' + uid + '@demo.marco', 'DTSTAMP:20260101T000000Z', 'SUMMARY:' + summary].concat(startLines, extra || [], ['END:VEVENT']);
    const tz = (d, h, m) => 'TZID=Europe/Madrid:' + fmt(d, h, m);
    const wrap = (name, lines) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Marco familiar//Demo//ES', 'X-WR-CALNAME:' + name].concat(VTZ, lines, ['END:VCALENDAR']).join('\r\n');

    const tue = U.addDays(lastMon, 1), wed = U.addDays(lastMon, 2);
    const thuNext = U.addDays(mon, 10), tueNext = U.addDays(mon, 8);
    const ninos = [].concat(
      // Semanal martes y jueves, con una excepción (EXDATE) y un cambio de hora (RECURRENCE-ID)
      ev('baloncesto', 'Baloncesto (demo)', ['DTSTART;' + tz(tue, 17, 30), 'DTEND;' + tz(tue, 19, 0)],
        ['RRULE:FREQ=WEEKLY;BYDAY=TU,TH', 'EXDATE;' + tz(thuNext, 17, 30), 'LOCATION:Polideportivo de ejemplo']),
      ev('baloncesto', 'Baloncesto (demo) · cambio de hora', ['RECURRENCE-ID;' + tz(tueNext, 17, 30), 'DTSTART;' + tz(tueNext, 18, 30), 'DTEND;' + tz(tueNext, 20, 0)],
        ['DESCRIPTION:Ejemplo de excepción RECURRENCE-ID: esta semana entrena una hora más tarde.']),
      ev('musica', 'Clase de música (demo)', ['DTSTART;' + tz(wed, 18, 0), 'DTEND;' + tz(wed, 19, 0)], ['RRULE:FREQ=WEEKLY;BYDAY=WE;COUNT=30', 'LOCATION:Escuela de música de ejemplo']),
      ev('ef', 'Educación física (demo)', ['DTSTART;' + tz(today, 9, 0), 'DTEND;' + tz(today, 10, 0)], ['DESCRIPTION:Cita de ejemplo para la mochila (chándal).']),
      ev('piscina', 'Piscina (demo)', ['DTSTART;' + tz(U.addDays(today, 1), 17, 0), 'DTEND;' + tz(U.addDays(today, 1), 18, 0)], ['DESCRIPTION:Cita de ejemplo para la mochila (toalla).']),
      ev('cole', 'Reunión del cole (demo)', ['DTSTART;' + tz(U.addDays(today, 6), 19, 0), 'DTEND;' + tz(U.addDays(today, 6), 20, 0)], ['DESCRIPTION:Reunión trimestral con la tutora (dato inventado).']),
      ev('cumple', 'Cumpleaños de Sara (demo)', ['DTSTART;VALUE=DATE:' + fmt(U.addDays(today, 9)), 'DTEND;VALUE=DATE:' + fmt(U.addDays(today, 10))]),
      ev('excursion', 'Excursión del cole (demo)', ['DTSTART;VALUE=DATE:' + fmt(U.addDays(today, 15)), 'DTEND;VALUE=DATE:' + fmt(U.addDays(today, 18))])
    );
    const familia = [].concat(
      ev('dentista', 'Dentista (demo)', ['DTSTART;' + tz(U.addDays(today, 1), 16, 45), 'DTEND;' + tz(U.addDays(today, 1), 17, 30)], ['LOCATION:Clínica de ejemplo', 'DESCRIPTION:Revisión anual. Evento de demostración.']),
      ev('compra', 'Compra semanal (demo)', ['DTSTART;' + tz(today, 19, 0), 'DTEND;' + tz(today, 20, 0)], ['LOCATION:Supermercado de ejemplo']),
      ev('cena', 'Cena con amigos (demo)', ['DTSTART;' + tz(U.addDays(mon, 5), 21, 0), 'DTEND;' + tz(U.addDays(mon, 5), 23, 30)]),
      ev('monte', 'Paseo por el monte (demo)', ['DTSTART;' + tz(U.addDays(mon, 6), 10, 0), 'DTEND;' + tz(U.addDays(mon, 6), 13, 0)], ['RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=8']),
      ev('coche', 'Revisión del coche (demo)', ['DTSTART;' + tz(U.addDays(today, 20), 9, 30), 'DTEND;' + tz(U.addDays(today, 20), 10, 30)]),
      ev('medico', 'Médico (demo)', ['DTSTART;' + tz(U.addDays(today, 34), 11, 0), 'DTEND;' + tz(U.addDays(today, 34), 11, 30)])
    );
    const turno = [].concat(
      ev('turno', 'Turno de tarde (demo)', ['DTSTART;' + tz(lastMon, 15, 0), 'DTEND;' + tz(lastMon, 22, 0)],
        ['RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', 'DESCRIPTION:Calendario de fondo de ejemplo. Se ve tenue y no entra en Ahora.'])
    );
    return [
      { name: 'Familia (demo)', color: '#E8604C', text: wrap('Familia (demo)', familia) },
      { name: 'Niños (demo)', color: '#3BA55C', text: wrap('Niños (demo)', ninos) },
      { name: 'Turno (demo)', color: '#8A8178', background: true, text: wrap('Turno (demo)', turno) }
    ];
  }

  window.Cal = { parseICS, fetchICS, demoCalendars };
})();
