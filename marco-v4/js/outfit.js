/* Outfit de mañana. El bot lo deja en el Apps Script; sin script hay un ejemplo.
 * No hay catálogo que editar aquí: solo se pinta el payload. */
(function () {
  'use strict';

  var SLOTS = ['arriba', 'capa', 'pantalón', 'calzado', 'exterior'];
  var DEMO_PIECES = [
    { id: 'p011', name: 'camiseta Nike negra ATHLETE', slot: 'arriba' },
    { id: 'p007', name: 'sudadera cerrada negra', slot: 'capa' },
    { id: 'p002', name: 'chino azul grisáceo', slot: 'pantalón' },
    { id: 'p019', name: 'New Balance 327', slot: 'calzado' },
    { id: 'p006', name: 'softshell Jack & Jones', slot: 'exterior' }
  ];

  function pad(n) { return String(n).padStart(2, '0'); }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function slotCanon(s) {
    var t = String(s || '').trim().toLowerCase();
    if (t === 'pantalon') return 'pantalón';
    return SLOTS.indexOf(t) >= 0 ? t : '';
  }

  function safeImage(url) {
    var s = String(url || '').trim();
    if (!s || s.length > 60000) return '';
    if (/^https:\/\//i.test(s)) return s;
    if (/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);/i.test(s)) return s;
    if (/^img\/[a-z0-9._-]+\.(svg|png|jpe?g|webp)$/i.test(s)) return s;
    return '';
  }

  function normalize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var src = raw.outfit && typeof raw.outfit === 'object' ? raw.outfit : raw;
    var list = src.pieces;
    if (!list || !list.length) return null;
    var pieces = [];
    for (var i = 0; i < list.length && pieces.length < 8; i++) {
      var p = list[i];
      if (!p) continue;
      var id = String(p.id || '').trim().toLowerCase();
      var name = String(p.name || '').trim();
      if (!/^p\d{3}$/.test(id) || !name) continue;
      pieces.push({ id: id, name: name.slice(0, 80), slot: slotCanon(p.slot) });
    }
    if (!pieces.length) return null;
    var forDate = /^\d{4}-\d{2}-\d{2}$/.test(String(src.forDate || '')) ? String(src.forDate) : '';
    return {
      forDate: forDate,
      updatedAt: String(src.updatedAt || '').slice(0, 40),
      why: String(src.why || '').trim().slice(0, 180),
      imageUrl: safeImage(src.imageUrl),
      pieces: pieces,
      demo: !!src.demo,
      stale: !!src.stale
    };
  }

  function demo(now) {
    var t = now || new Date();
    var man = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
    var updated = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 21, 0, 0);
    if (t.getHours() < 21) updated = new Date(updated.getTime() - 86400000);
    return {
      forDate: dayKey(man),
      updatedAt: dayKey(updated) + 'T21:00:00+01:00',
      why: 'Fresquito y planta Basquevolt',
      imageUrl: 'img/outfit-demo.svg',
      pieces: DEMO_PIECES.map(function (p) { return { id: p.id, name: p.name, slot: p.slot }; }),
      demo: true,
      stale: false
    };
  }

  function brief(raw) {
    var o = normalize(raw);
    if (!o) return '';
    var bits = o.pieces.map(function (p) { return p.name; });
    var s = 'Outfit de mañana · ' + bits.join(', ');
    if (o.why) s += ' · ' + o.why;
    if (o.demo) s += ' (ejemplo)';
    return s;
  }

  window.Outfit = { SLOTS: SLOTS, normalize: normalize, demo: demo, brief: brief, safeImage: safeImage };
})();
