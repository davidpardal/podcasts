/* Tiempo de Open-Meteo (sin clave). */
(function () {
  const WMO = {
    0: ['☀️', 'Despejado'], 1: ['🌤️', 'Casi despejado'], 2: ['⛅', 'Nubes y claros'], 3: ['☁️', 'Nublado'],
    45: ['🌫️', 'Niebla'], 48: ['🌫️', 'Niebla con escarcha'], 51: ['🌦️', 'Llovizna débil'], 53: ['🌦️', 'Llovizna'], 55: ['🌧️', 'Llovizna intensa'],
    56: ['🌧️', 'Llovizna helada'], 57: ['🌧️', 'Llovizna helada'], 61: ['🌦️', 'Lluvia débil'], 63: ['🌧️', 'Lluvia'], 65: ['🌧️', 'Lluvia fuerte'],
    66: ['🌧️', 'Lluvia helada'], 67: ['🌧️', 'Lluvia helada'], 71: ['🌨️', 'Nieve débil'], 73: ['🌨️', 'Nieve'], 75: ['❄️', 'Nieve fuerte'], 77: ['🌨️', 'Granizo fino'],
    80: ['🌦️', 'Chubascos'], 81: ['🌧️', 'Chubascos'], 82: ['⛈️', 'Chubascos fuertes'], 85: ['🌨️', 'Chubascos de nieve'], 86: ['❄️', 'Chubascos de nieve'],
    95: ['⛈️', 'Tormenta'], 96: ['⛈️', 'Tormenta con granizo'], 99: ['⛈️', 'Tormenta con granizo']
  };
  const icon = (c) => (WMO[c] || ['🌡️', ''])[0];
  const desc = (c) => (WMO[c] || ['', '—'])[1];

  const RAIN_CODES = { 51: 1, 53: 1, 55: 1, 56: 1, 57: 1, 61: 1, 63: 1, 65: 1, 66: 1, 67: 1, 80: 1, 81: 1, 82: 1, 95: 1, 96: 1, 99: 1 };
  const SNOW_CODES = { 71: 1, 73: 1, 75: 1, 77: 1, 85: 1, 86: 1 };
  const STORM_CODES = { 95: 1, 96: 1, 99: 1 };

  function hourDate(h) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec((h && h.time) || '');
    if (!m) return new Date(NaN);
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  }
  function hh(h) {
    const d = hourDate(h);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function shortName(title) {
    return String(title || '').replace(/\s*\(demo\)/gi, '').replace(/\s*·\s*cambio de hora/gi, '').trim();
  }
  function wet(h) {
    return !!(h && ((h.pop != null && h.pop >= 40) || RAIN_CODES[h.code] || (h.precip != null && h.precip >= 0.2)));
  }

  // Consejo según las horas y las citas de hoy/mañana. Cadena vacía si no hay nada que avisar.
  function advice(hourly, events, now) {
    hourly = hourly || [];
    const limit = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
    const soon = (events || []).filter((e) => e && !e.allDay && !e.background && !e.virtual && e.end > now && e.start < limit)
      .slice().sort((a, b) => a.start - b.start);
    for (let i = 0; i < soon.length; i++) {
      const e = soon[i];
      const from = new Date(e.start.getTime() - 60 * 60000);
      from.setMinutes(0, 0, 0);
      const slice = hourly.filter((h) => { const d = hourDate(h); return d >= from && d <= e.end; });
      const name = shortName(e.title);
      const storm = slice.find((h) => STORM_CODES[h.code]);
      const snow = slice.find((h) => SNOW_CODES[h.code]);
      const rain = slice.find(wet);
      if (storm) return '⛈️ Tormenta hacia las ' + hh(storm) + ' · ' + name + ': mejor ir con tiempo.';
      if (snow) return '❄️ Puede nevar hacia las ' + hh(snow) + ' · ' + name + ': abrigo y calzado.';
      if (rain) return '☔ Lluvia hacia las ' + hh(rain) + ' · ' + name + ': chubasquero.';
      const cold = slice.find((h) => h.temp != null && h.temp <= 5);
      if (cold) return '🧥 Frío (' + Math.round(cold.temp) + '°) a la hora de ' + name + ': abrigo.';
      const hot = slice.find((h) => h.temp != null && h.temp >= 32);
      if (hot) return '🥵 Calor (' + Math.round(hot.temp) + '°) en ' + name + ': agua y gorra.';
    }
    const fromNow = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
    const upcoming = hourly.filter((h) => hourDate(h) >= fromNow).slice(0, 8);
    const g = upcoming.find((h) => (h.pop != null && h.pop >= 50) || RAIN_CODES[h.code] || SNOW_CODES[h.code]);
    if (g && SNOW_CODES[g.code]) return '❄️ Puede nevar hacia las ' + hh(g) + ': abrigo si hay que salir.';
    if (g) return '☔ Lluvia hacia las ' + hh(g) + ': chubasquero si hay que salir.';
    return '';
  }

  // Ropa corta para citas al aire libre. No es el chip de AEMET ni el aviso de la cita.
  function ropa(hourly, events, now, outdoor) {
    hourly = hourly || [];
    let re;
    try { re = outdoor instanceof RegExp ? outdoor : new RegExp(outdoor || 'parque|cole', 'i'); }
    catch (e) { re = /parque|cole/i; }
    const limit = new Date(now.getTime() + 36 * 3600000);
    const outdoorEvs = (events || []).filter((e) => e && !e.allDay && !e.background && !e.virtual && e.end > now && e.start < limit && re.test(String(e.title || '')))
      .slice().sort((a, b) => a.start - b.start);
    function clothes(slice, name) {
      if (!slice.length) return '';
      const storm = slice.find((h) => STORM_CODES[h.code]);
      const snow = slice.find((h) => SNOW_CODES[h.code]);
      const rain = slice.find(wet);
      const temps = slice.map((h) => h.temp).filter((n) => n != null && isFinite(n));
      const minT = temps.length ? Math.min.apply(null, temps) : null;
      const who = name ? (' para ' + name) : '';
      if (storm || rain) return 'Chubasquero' + who + '.';
      if (snow) return 'Abrigo y botas' + who + '.';
      if (minT != null && minT <= 5) return 'Abrigo' + who + ' (' + Math.round(minT) + '°).';
      if (minT != null && minT <= 12) return 'Chaqueta' + who + '.';
      if (minT != null && minT >= 28) return 'Gorra y agua' + who + '.';
      if (minT != null && minT >= 20) return 'Manga corta' + who + '.';
      if (name || minT != null) return 'Manga larga' + who + '.';
      return '';
    }
    for (let i = 0; i < outdoorEvs.length; i++) {
      const e = outdoorEvs[i];
      const from = new Date(e.start.getTime() - 60 * 60000);
      from.setMinutes(0, 0, 0);
      const slice = hourly.filter((h) => { const d = hourDate(h); return d >= from && d <= e.end; });
      const tip = clothes(slice, shortName(e.title));
      if (tip) return tip;
    }
    const fromNow = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
    const upcoming = hourly.filter((h) => hourDate(h) >= fromNow).slice(0, 8);
    const generic = clothes(upcoming, '');
    if (!generic) return '';
    return generic.replace(/\.$/, '') + ' si sales.';
  }

  async function load(lat, lon) {
    const daily = '&current=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset';
    const hourly = '&hourly=temperature_2m,precipitation_probability,weather_code,precipitation';
    const base = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&timezone=Europe%2FMadrid&forecast_days=16';
    let r = await fetch(base + daily + hourly, { cache: 'no-store' });
    if (!r.ok) r = await fetch(base + daily, { cache: 'no-store' });
    if (!r.ok) throw new Error('Open-Meteo HTTP ' + r.status);
    const j = await r.json();
    const days = j.daily.time.map((t, i) => ({
      date: t, code: j.daily.weather_code[i], max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i],
      rain: j.daily.precipitation_probability_max[i], sunrise: j.daily.sunrise[i], sunset: j.daily.sunset[i]
    }));
    const hours = [];
    if (j.hourly && j.hourly.time) {
      const keepAfter = j.daily.time[0];
      for (let i = 0; i < j.hourly.time.length && hours.length < 72; i++) {
        if (j.hourly.time[i].slice(0, 10) < keepAfter) continue;
        hours.push({
          time: j.hourly.time[i],
          temp: j.hourly.temperature_2m[i],
          pop: j.hourly.precipitation_probability[i],
          code: j.hourly.weather_code[i],
          precip: j.hourly.precipitation[i]
        });
      }
    }
    return { current: { temp: j.current.temperature_2m, code: j.current.weather_code, isDay: j.current.is_day }, days, hourly: hours, fetched: Date.now() };
  }

  window.Weather = { load, icon, desc, advice, ropa };
})();
