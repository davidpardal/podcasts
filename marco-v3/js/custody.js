/* Custodia compartida por semanas alternas con cambio los viernes a las 17:00 (configurable). */
(function () {
  function cfg() { return window.CFG.custody; }
  function anchor() { return U.parseLocal(cfg().anchor); }

  // ¿Están los niños contigo en este instante?
  function withParent(t) {
    const a = anchor();
    const handMin = a.getHours() * 60 + a.getMinutes();
    const tMin = t.getHours() * 60 + t.getMinutes();
    // El "día de custodia" empieza a la hora del cambio: antes de esa hora cuenta como el día anterior.
    const d = U.dayDiff(a, t) - (tMin < handMin ? 1 : 0);
    const cyc = cfg().cycleDays || 14;
    const idx = ((d % cyc) + cyc) % cyc;
    return idx < (cfg().daysWithParent || 7);
  }

  // Siguiente cambio (instante) a partir de t
  function nextHandover(t) {
    const a = anchor();
    let probe = new Date(t);
    for (let i = 0; i < 15 * 24 * 4; i++) { // busca en pasos de 15 min, máximo 15 días
      const n = new Date(probe.getTime() + 15 * 60000);
      if (withParent(n) !== withParent(probe)) {
        const h = new Date(n.getFullYear(), n.getMonth(), n.getDate(), a.getHours(), a.getMinutes());
        return { at: h, toParent: withParent(n) };
      }
      probe = n;
    }
    return null;
  }

  // Estado de un día completo: 'padre' | 'otro' | 'cambio-a-padre' | 'cambio-a-otro'
  function dayStatus(day) {
    const a = anchor();
    const before = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 30);
    const after = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 30);
    const wb = withParent(before), wa = withParent(after);
    if (wb === wa) return wb ? 'padre' : 'otro';
    return wa ? 'cambio-a-padre' : 'cambio-a-otro';
  }

  function handoverTime() { return U.hm(anchor()); }

  window.Custody = { withParent, nextHandover, dayStatus, handoverTime };
})();
