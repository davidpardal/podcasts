/* Entreno de hoy (js/plan.js), sin navegador: node tests/test_plan.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.window = global;
eval(fs.readFileSync(path.join(__dirname, '..', 'js/plan.js'), 'utf8'));
const Plan = global.Plan;

function pad(n) { return String(n).padStart(2, '0'); }
function key(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function datos(hoy, rhrPrev) {
  const t = new Date(2026, 10, 8, 9, 0);
  const days = [];
  for (let i = 7; i >= 1; i--) { const d = new Date(t); d.setDate(d.getDate() - i); days.push({ date: key(d), restingHr: rhrPrev == null ? 58 : rhrPrev }); }
  days.push(Object.assign({ date: key(t) }, hoy));
  return { ok: true, days: days, workouts: [{ date: '2026-11-04', type: 'strength_training' }] };
}
const T = new Date(2026, 10, 8, 9, 0); // domingo 8/11
const verde = { sleepSeconds: 7.5 * 3600, sleepScore: 80, hrvStatus: 'BALANCED', hrv: 40, restingHr: 59, bodyBatteryMax: 80 };

let s = Plan.semaforo(datos(verde), T);
assert.strictEqual(s.luz, 'verde');
assert.strictEqual(s.huecos.length, 0);

s = Plan.semaforo(datos(Object.assign({}, verde, { sleepSeconds: 6 * 3600, sleepScore: 65 })), T);
assert.strictEqual(s.luz, 'ambar');
s = Plan.semaforo(datos(Object.assign({}, verde, { hrvStatus: 'UNBALANCED' })), T);
assert.strictEqual(s.luz, 'ambar');
s = Plan.semaforo(datos(Object.assign({}, verde, { restingHr: 61 })), T); // +3
assert.strictEqual(s.luz, 'ambar');
s = Plan.semaforo(datos(Object.assign({}, verde, { restingHr: 60 })), T); // +2
assert.strictEqual(s.luz, 'verde');
s = Plan.semaforo(datos(Object.assign({}, verde, { restingHr: 63 })), T); // +5
assert.strictEqual(s.luz, 'rojo');
s = Plan.semaforo(datos(Object.assign({}, verde, { bodyBatteryMax: 16 })), T);
assert.strictEqual(s.luz, 'rojo');

// Varios rojos a la vez (3,42 h, nota 40, VFC baja, batería 16): gana el peor
const real = { sleepSeconds: 3.42 * 3600, sleepScore: 40, hrvStatus: 'LOW', hrv: 25, restingHr: 61, bodyBatteryMax: 16 };
s = Plan.semaforo(datos(real), T);
assert.strictEqual(s.luz, 'rojo');
assert.ok(s.motivos.some((m) => m.txt === 'Sueño 3,4 h · nota 40' && m.luz === 'rojo'));
assert.ok(s.motivos.some((m) => /VFC 25 ms · baja/.test(m.txt)));

// Huecos: sin dato no se inventa
s = Plan.semaforo(datos({}), T);
assert.strictEqual(s.luz, 'nada');
assert.ok(s.huecos.includes('sueño de anoche') && s.huecos.includes('estado de la VFC') && s.huecos.includes('batería corporal'));
s = Plan.semaforo(datos({ sleepSeconds: 8 * 3600 }), T);
assert.strictEqual(s.luz, 'verde');
assert.ok(s.huecos.includes('nota del sueño'));
assert.strictEqual(Plan.semaforo({ ok: false }, T).luz, 'nada');
// El sueño de ayer no cuenta como el de hoy
const ayer = datos({}); ayer.days[6].sleepSeconds = 3 * 3600;
assert.strictEqual(Plan.semaforo(ayer, T).luz, 'nada');

// Custodia: semana con niños = lunes–domingo después del cambio del domingo 15/11 20:00, ciclo 14
const anchor = new Date(2026, 10, 15, 20, 0);
function kidsAt(x) {
  const days = Math.floor((x - anchor) / 86400000);
  return ((days % 14) + 14) % 14 < 7;
}
assert.strictEqual(Plan.semanaConNinos(new Date(2026, 10, 8, 9), kidsAt), true); // lun 2–dom 8: con niños (cambio el 1/11)
assert.strictEqual(Plan.semanaConNinos(new Date(2026, 10, 9, 9), kidsAt), false);
assert.strictEqual(Plan.semanaConNinos(new Date(2026, 10, 15, 21), kidsAt), false); // domingo 15: último día sin niños
assert.strictEqual(Plan.semanaConNinos(new Date(2026, 10, 16, 7), kidsAt), true);
assert.strictEqual(Plan.semanaConNinos(new Date(2026, 10, 22, 19), kidsAt), true);
assert.strictEqual(Plan.semanaConNinos(new Date(2026, 10, 23, 7), kidsAt), false);
assert.strictEqual(Plan.semanaConNinos(new Date(2026, 10, 30, 7), kidsAt), true);
assert.strictEqual(Plan.semanaConNinos(new Date(2026, 11, 14, 7), kidsAt), true);
assert.strictEqual(Plan.semanaConNinos(T, null), null);

// Sesión ajustada
let h = Plan.hoy(datos(real), new Date(2026, 10, 9, 8), { kidsAt: kidsAt }); // lunes 9/11, sin datos de ese día
assert.strictEqual(h.prevista.t, 'Fuerza A');
assert.strictEqual(h.prevista.d, '50–60′');
assert.strictEqual(h.semaforo.luz, 'nada');
h = Plan.hoy(datos(real), T, { kidsAt: kidsAt }); // domingo 8/11, último de la semana con niños: descanso
assert.strictEqual(h.conNinos, true);
assert.strictEqual(h.ajustada.titulo, 'Descanso o paseo 30–40′ + 10′ movilidad');
assert.ok(/Ya tocaba descanso/.test(h.ajustada.nota));
h = Plan.hoy(datos(real), T, { kidsAt: () => false }); // mismo día en semana sin niños: Fuerza C, rojo
assert.strictEqual(h.ajustada.titulo, 'Descanso o paseo 30–40′ + 10′ movilidad');
assert.ok(/Fuerza C/.test(h.ajustada.nota));
assert.strictEqual(h.semana.length, 7);
assert.strictEqual(h.semana[6].hoy, true);
assert.strictEqual(h.semana[2].hecho, true); // miércoles 4/11 con fuerza en Garmin
h = Plan.hoy(datos(Object.assign({}, verde, { hrvStatus: 'UNBALANCED' })), T, { kidsAt: () => false });
assert.ok(/RPE ≤6/.test(h.ajustada.nota) && /20–30 %/.test(h.ajustada.nota));
const kidMon = new Date(2026, 10, 16, 8);
h = Plan.hoy({ ok: true, days: [] }, kidMon, { kidsAt: kidsAt });
assert.strictEqual(h.conNinos, true);
assert.strictEqual(h.prevista.t, 'Fuerza A');
assert.strictEqual(h.prevista.d, '45′');
assert.strictEqual(h.semana[1].sesion.t, 'Rodillo Z2 en casa');
assert.strictEqual(Plan.ajustar({ k: 'descanso', t: 'Descanso', d: '' }, 'ambar').titulo, 'Descanso');

console.log('test_plan.js: OK');
