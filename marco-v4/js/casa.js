/* Marco v4: salida, cole, pasillos, sol y texto del atajo.
 * Todo local. Sin red y sin secretos. */
(function () {
  function pad(n) { return String(n).padStart(2, '0'); }

  function sunTimes(date, lat, lon) {
    const rad = Math.PI / 180;
    const start = new Date(date.getFullYear(), 0, 0);
    const N = Math.round((date - start) / 86400000);
    const lngHour = lon / 15;
    function calc(isRise) {
      const t = N + ((isRise ? 6 : 18) - lngHour) / 24;
      const M = (0.9856 * t) - 3.289;
      let L = M + (1.916 * Math.sin(M * rad)) + (0.020 * Math.sin(2 * M * rad)) + 282.634;
      L = ((L % 360) + 360) % 360;
      let RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
      RA = ((RA % 360) + 360) % 360;
      const Lq = Math.floor(L / 90) * 90;
      const RAq = Math.floor(RA / 90) * 90;
      RA = (RA + (Lq - RAq)) / 15;
      const sinDec = 0.39782 * Math.sin(L * rad);
      const cosDec = Math.cos(Math.asin(sinDec));
      const cosH = (Math.cos(90.833 * rad) - (sinDec * Math.sin(lat * rad))) / (cosDec * Math.cos(lat * rad));
      if (cosH > 1 || cosH < -1) return null;
      const H = (isRise ? (360 - Math.acos(cosH) / rad) : (Math.acos(cosH) / rad)) / 15;
      const T = H + RA - (0.06571 * t) - 6.622;
      let UT = ((T - lngHour) % 24 + 24) % 24;
      let minutes = Math.round(UT * 60);
      const dayShift = Math.floor(minutes / 1440);
      minutes = ((minutes % 1440) + 1440) % 1440;
      const base = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() + dayShift, 0, minutes, 0);
      return new Date(base);
    }
    return { sunrise: calc(true), sunset: calc(false) };
  }

  function isNight(date, lat, lon) {
    const s = sunTimes(date, Number(lat), Number(lon));
    if (!s.sunrise || !s.sunset) return date.getHours() < 8 || date.getHours() >= 20;
    return date < s.sunrise || date >= s.sunset;
  }

  function linesOf(text) {
    return String(text || '').split('\n').map((l) => l.trim()).filter((l) => l && l.charAt(0) !== '#');
  }

  function parseTravel(text, fallback) {
    const lines = linesOf(text);
    if (!lines.length) return (fallback || []).slice();
    const out = [];
    lines.forEach((line) => {
      const eq = line.indexOf('=');
      let match, min;
      if (eq >= 0) {
        match = line.slice(0, eq).trim();
        min = parseInt(line.slice(eq + 1), 10);
      } else {
        const p = line.split('|').map((s) => s.trim());
        match = p[0];
        min = parseInt(p[1], 10);
      }
      if (!match || !isFinite(min) || min < 0 || min > 240) return;
      out.push({ match: match, min: min });
    });
    return out.length ? out : (fallback || []).slice();
  }

  function formatTravel(rules) {
    return (rules || []).map((r) => r.match + ' = ' + r.min).join('\n');
  }

  function ruleTest(pattern, text) {
    try { return new RegExp(pattern, 'i').test(text); }
    catch (e) { return String(text || '').toLowerCase().indexOf(String(pattern || '').toLowerCase()) !== -1; }
  }

  function travelMin(title, rules) {
    const t = String(title || '');
    for (let i = 0; i < (rules || []).length; i++) {
      const r = rules[i];
      if (r && r.match && ruleTest(r.match, t)) return Math.max(0, r.min | 0);
    }
    return 0;
  }

  function nextLeave(events, now, rules) {
    let best = null;
    (events || []).forEach((e) => {
      if (!e || e.allDay || e.background || e.virtual || e.done) return;
      const start = e.start;
      if (!(start instanceof Date) || isNaN(start.getTime()) || start <= now) return;
      if (e.end instanceof Date && !isNaN(e.end.getTime()) && e.end <= now) return;
      const min = travelMin(e.title, rules);
      const leave = new Date(start.getTime() - min * 60000);
      if (!best || leave < best.leave || (leave.getTime() === best.leave.getTime() && start < best.event.start)) best = { event: e, min: min, leave: leave };
    });
    return best;
  }

  function leavePhrase(plan, now) {
    if (!plan) return { late: false, main: 'Sin salidas', sub: '' };
    const mins = Math.round((plan.leave.getTime() - now.getTime()) / 60000);
    const title = String(plan.event.title || '').replace(/\s*\(demo\)/gi, '').trim();
    const sub = title + (plan.min ? ' · ' + plan.min + ' min' : '');
    if (mins <= 0) return { late: true, main: 'Sal ya', sub: sub };
    let wait = mins + ' min';
    if (mins >= 180) {
      const h = Math.round(mins / 60);
      wait = h < 48 ? (h + ' h') : (Math.round(h / 24) + ' días');
    }
    return { late: false, main: 'Sal en ' + wait, sub: sub };
  }

  function parseAisles(text, fallback) {
    const lines = linesOf(text);
    if (!lines.length) return (fallback || []).map((a) => ({ name: a.name, match: a.match || '' }));
    const out = [];
    lines.forEach((line) => {
      const i = line.indexOf('|');
      const name = (i < 0 ? line : line.slice(0, i)).trim();
      if (!name) return;
      const match = i < 0 ? '' : line.slice(i + 1).trim();
      out.push({ name: name, match: match });
    });
    if (!out.length) return (fallback || []).map((a) => ({ name: a.name, match: a.match || '' }));
    if (!out.some((a) => !a.match)) out.push({ name: 'Otros', match: '' });
    return out;
  }

  function formatAisles(aisles) {
    return (aisles || []).map((a) => a.match ? (a.name + ' | ' + a.match) : a.name).join('\n');
  }

  function aisleIndex(name, aisles) {
    const n = String(name || '');
    let fallback = -1;
    for (let i = 0; i < (aisles || []).length; i++) {
      if (!aisles[i].match) { fallback = i; continue; }
      if (ruleTest(aisles[i].match, n)) return i;
    }
    return fallback;
  }

  function groupByAisle(items, aisles) {
    const list = (aisles && aisles.length) ? aisles.map((a) => ({ name: a.name, match: a.match || '' })) : [{ name: 'Otros', match: '' }];
    if (!list.some((a) => !a.match)) list.push({ name: 'Otros', match: '' });
    const buckets = list.map((a) => ({ name: a.name, items: [] }));
    (items || []).forEach((it) => {
      const i = aisleIndex(it && it.name, list);
      buckets[i < 0 ? buckets.length - 1 : i].items.push(it);
    });
    return buckets.filter((b) => b.items.length);
  }

  function parseDateLines(text) {
    const out = [];
    String(text || '').split(/[\n,;]+/).forEach((raw) => {
      const line = String(raw || '').trim();
      if (!line || line.charAt(0) === '#') return;
      const range = line.split(/\s*(?:\.\.| a )\s*/i);
      if (range.length === 2 && /^\d{4}-\d{2}-\d{2}$/.test(range[0]) && /^\d{4}-\d{2}-\d{2}$/.test(range[1])) {
        let d = new Date(+range[0].slice(0, 4), +range[0].slice(5, 7) - 1, +range[0].slice(8, 10));
        const end = new Date(+range[1].slice(0, 4), +range[1].slice(5, 7) - 1, +range[1].slice(8, 10));
        for (let i = 0; i < 400 && d <= end; i++) {
          out.push(d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()));
          d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        }
        return;
      }
      const full = /^(\d{4})-(\d{2})-(\d{2})/.exec(line);
      if (full) { out.push(full[1] + '-' + full[2] + '-' + full[3]); return; }
      const md = /^(\d{2})-(\d{2})$/.exec(line);
      if (md) out.push(md[1] + '-' + md[2]);
    });
    return out;
  }

  function dayStamp(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }

  function covers(e, day) {
    if (!e || !e.start) return false;
    const start = e.start instanceof Date ? e.start : new Date(e.start);
    const end = e.end ? (e.end instanceof Date ? e.end : new Date(e.end)) : start;
    if (isNaN(start.getTime())) return false;
    const d0 = dayStamp(day);
    let a = dayStamp(start);
    let b = isNaN(end.getTime()) ? a : dayStamp(end);
    if (e.allDay && b > a) b -= 86400000;
    if (b < a) b = a;
    return d0 >= a && d0 <= b;
  }

  function schoolOff(day, opt) {
    opt = opt || {};
    const wd = day.getDay();
    if (opt.weekends !== false && (wd === 0 || wd === 6)) return { off: true, why: 'finde' };
    const fest = opt.festivo ? opt.festivo(day) : null;
    if (fest) return { off: true, why: 'festivo', name: fest.name || fest.label || 'Festivo' };
    const key = day.getFullYear() + '-' + pad(day.getMonth() + 1) + '-' + pad(day.getDate());
    const md = pad(day.getMonth() + 1) + '-' + pad(day.getDate());
    const dates = opt.dates || [];
    if (dates.indexOf(key) !== -1 || dates.indexOf(md) !== -1) return { off: true, why: 'fecha' };
    const events = opt.events || [];
    for (let i = 0; i < events.length; i++) {
      if (covers(events[i], day)) return { off: true, why: 'ics', name: events[i].title || '' };
    }
    if (opt.useDemo && (opt.demoDates || []).indexOf(md) !== -1) return { off: true, why: 'ejemplo' };
    return { off: false };
  }

  function parseKidLines(text) {
    return linesOf(text).map((line) => {
      const p = line.split('|').map((s) => s.trim());
      const name = p[0] || '';
      let from = '', to = '', extras = '';
      const hours = p[1] && /^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/.exec(p[1]);
      if (p.length >= 3 && hours) {
        from = hours[1]; to = hours[2]; extras = p.slice(2).join(' | ');
      } else extras = p.slice(1).join(' | ');
      return { name: name, from: from, to: to, extras: extras };
    }).filter((k) => k.name);
  }

  function textosCompra(text) {
    const parts = String(text || '').replace(/\r/g, '\n').split(/[\n,;]+/);
    const out = [];
    const seen = {};
    parts.forEach((p) => {
      let s = String(p || '').trim().replace(/\s+/g, ' ');
      s = s.replace(/^(comprar|compra|añadir|anadir|añade|anade|pon|poner)\s+/i, '').trim();
      if (!s) return;
      s = s.charAt(0).toLocaleUpperCase('es') + s.slice(1);
      const k = s.toLowerCase();
      if (seen[k]) return;
      seen[k] = 1;
      out.push(s);
    });
    return out;
  }

  window.Casa = {
    sunTimes, isNight, parseTravel, formatTravel, travelMin, nextLeave, leavePhrase,
    parseAisles, formatAisles, aisleIndex, groupByAisle, parseDateLines, schoolOff, covers,
    parseKidLines, textosCompra
  };
})();
