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

  async function load(lat, lon) {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&current=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset' +
      '&timezone=Europe%2FMadrid&forecast_days=16';
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('Open-Meteo HTTP ' + r.status);
    const j = await r.json();
    const days = j.daily.time.map((t, i) => ({
      date: t, code: j.daily.weather_code[i], max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i],
      rain: j.daily.precipitation_probability_max[i], sunrise: j.daily.sunrise[i], sunset: j.daily.sunset[i]
    }));
    return { current: { temp: j.current.temperature_2m, code: j.current.weather_code, isDay: j.current.is_day }, days, fetched: Date.now() };
  }

  window.Weather = { load, icon, desc };
})();
