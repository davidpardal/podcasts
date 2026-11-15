/* Mochila: reglas de palabras en el título de la cita → objeto del día.
 * Inspirada en las reglas "backpack" de HomeView, en español y editable en Ajustes.
 * Un festivo (nacional, Álava o Vitoria) cuenta como la palabra «festivo» y, con la
 * regla por defecto, deja el día libre: no hay mochila. */
(function () {
  function fold(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function emojiDe(item, emoji) {
    if (emoji) return emoji;
    const k = fold(item);
    if (k === 'equipacion') return '🏀';
    if (k === 'chandal') return '👕';
    if (k === 'toalla') return '🏊';
    if (k === 'almuerzo') return '🥪';
    if (k === 'dia libre') return '🏠';
    return '🎒';
  }

  function compile(rules) {
    const src = (Array.isArray(rules) && rules.length) ? rules : (window.MARCO_DEFAULTS.backpack || []);
    return src.map((r) => {
      const words = fold(r.match || '').split('|').map((w) => w.trim()).filter(Boolean)
        .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      if (!words.length || !r.item) return null;
      const item = String(r.item).trim();
      const off = !!(r.off) || fold(item) === 'dia libre';
      return {
        re: new RegExp('(^|[^a-z0-9])(' + words.join('|') + ')([^a-z0-9]|$)', 'i'),
        item: item,
        emoji: emojiDe(item, r.emoji || ''),
        off: off
      };
    }).filter(Boolean);
  }

  function matches(rules, title) {
    const text = fold(title || '');
    if (!text) return [];
    const found = [];
    rules.forEach((rule) => {
      const m = rule.re.exec(text);
      if (m) found.push({ rule: rule, word: m[2] || '' });
    });
    return found;
  }

  function hit(rules, title) {
    const found = matches(rules, title);
    return found.length ? found[0] : null;
  }

  function esLectivo(day, off) {
    const wd = day.getDay();
    return wd >= 1 && wd <= 5 && !off;
  }

  /* events: citas de ESE día (ya filtradas). home=false → semana sin niños, mochila en pausa. */
  function forDay(day, events, opts) {
    opts = opts || {};
    const rules = compile(opts.rules);
    const home = opts.home !== false;
    const tags = [];
    const fest = U.festivoEtiqueta(day);
    if (fest) tags.push({ id: 'festivo', label: fest.label, name: fest.name });
    const base = {
      paused: !home,
      off: false,
      school: esLectivo(day, false),
      items: [],
      tags: tags,
      why: ''
    };
    if (!home) return base;

    let off = false;
    let offWhy = fest ? fest.name : '';
    const items = [];
    const seen = {};
    function addItem(rule, why) {
      const key = fold(rule.item);
      if (seen[key]) {
        if (why && items[seen[key] - 1].why.indexOf(why) === -1) items[seen[key] - 1].why += ' · ' + why;
        return;
      }
      seen[key] = items.length + 1;
      items.push({ item: rule.item, emoji: rule.emoji, off: false, why: why || '' });
    }
    function consider(title, why) {
      const found = matches(rules, title);
      if (!found.length) return;
      const h = found.find((x) => x.rule.off) || found[0];
      if (h.rule.off) {
        off = true;
        if (why && offWhy.indexOf(why) === -1) offWhy = offWhy ? (offWhy + ' · ' + why) : why;
        const w = fold(h.word);
        if ((w === 'sin cole' || w === 'no hay cole') && !tags.some((t) => t.id === 'sin-cole')) {
          tags.push({ id: 'sin-cole', label: 'Sin cole', name: why || title });
        }
        if (w === 'festivo' && !tags.some((t) => t.id === 'festivo')) {
          tags.push({ id: 'festivo', label: 'Festivo', name: why || title });
        }
        return;
      }
      addItem(h.rule, why || title);
    }

    (events || []).forEach((e) => {
      if (!e || e.background || e.virtual) return;
      consider(e.title, e.title);
    });
    if (fest) consider('festivo', fest.name);

    if (off) {
      const libre = rules.find((r) => r.off) || { item: 'día libre', emoji: '🏠' };
      return {
        paused: false,
        off: true,
        school: false,
        items: [{ item: libre.item, emoji: libre.emoji || '🏠', off: true, why: offWhy }],
        tags: tags,
        why: offWhy
      };
    }
    return {
      paused: false,
      off: false,
      school: esLectivo(day, false),
      items: items,
      tags: tags,
      why: ''
    };
  }

  function texto(rules) {
    const list = (Array.isArray(rules) && rules.length) ? rules : (window.MARCO_DEFAULTS.backpack || []);
    return list.map((r) => {
      const bits = [String(r.match || '').trim(), String(r.item || '').trim()];
      if (r.emoji) bits.push(String(r.emoji).trim());
      return bits.filter(Boolean).join(' → ');
    }).filter((l) => l.indexOf('→') !== -1).join('\n');
  }

  function parse(txt) {
    const out = [];
    String(txt || '').split('\n').forEach((line) => {
      const raw = line.trim();
      if (!raw || raw.charAt(0) === '#') return;
      const parts = raw.split('→').map((s) => s.trim());
      if (parts.length < 2 || !parts[0] || !parts[1]) return;
      const item = parts[1];
      const emoji = parts[2] || '';
      out.push({ match: parts[0], item: item, emoji: emojiDe(item, emoji), off: fold(item) === 'dia libre' });
    });
    return out;
  }

  function avisoMuestra() {
    return {
      ok: true,
      sample: true,
      fetched: new Date().toISOString(),
      alerts: [{
        level: 'naranja',
        event: 'Viento',
        headline: 'Aviso naranja por viento en Álava',
        text: 'Rachas de viento fuertes en el interior de Álava y en Vitoria-Gasteiz. Esto es un aviso de ejemplo para probar el marco: no es un aviso real de AEMET.',
        area: 'Álava',
        until: ''
      }]
    };
  }

  function normAvisos(data) {
    const alerts = ((data && data.alerts) || []).map((a) => {
      if (!a || typeof a !== 'object') return null;
      const level = fold(a.level || '');
      if (level !== 'rojo' && level !== 'naranja') return null;
      return {
        level: level,
        event: String(a.event || '').slice(0, 80),
        headline: String(a.headline || '').slice(0, 240),
        text: String(a.text || a.description || '').slice(0, 2000),
        area: String(a.area || '').slice(0, 160),
        until: String(a.until || ''),
        onset: String(a.onset || '')
      };
    }).filter(Boolean);
    alerts.sort((a, b) => (a.level === 'rojo' ? 0 : 1) - (b.level === 'rojo' ? 0 : 1));
    return {
      ok: data ? data.ok !== false : false,
      sample: !!(data && data.sample),
      alerts: alerts.slice(0, 6),
      fetched: (data && data.fetched) || ''
    };
  }

  window.Mochila = { fold, compile, hit, matches, forDay, texto, parse, avisoMuestra, normAvisos, emojiDe };
})();
