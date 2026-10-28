/* Comprobaciones locales de marco-v4 (sin navegador). */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

global.window = global;
function load(file) {
  eval(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'));
}
load('js/casa.js');
load('js/weather.js');
const Casa = global.Casa;
const Weather = global.Weather;

assert.deepStrictEqual(Casa.textosCompra('leche'), ['Leche']);
assert.deepStrictEqual(Casa.textosCompra('comprar pilas'), ['Pilas']);
assert.deepStrictEqual(Casa.textosCompra('leche, pilas\npan'), ['Leche', 'Pilas', 'Pan']);

const rules = Casa.parseTravel('colegio|cole = 10\nbasquevolt = 20');
assert.strictEqual(Casa.travelMin('Reunión del cole', rules), 10);
assert.strictEqual(Casa.travelMin('Basquevolt mañana', rules), 20);
assert.strictEqual(Casa.travelMin('Dentista', rules), 0);

const now = new Date(2026, 9, 21, 17, 45);
const events = [
  { title: 'Colegio (demo)', start: new Date(2026, 9, 21, 18, 10), end: new Date(2026, 9, 21, 18, 40) },
  { title: 'Dentista', start: new Date(2026, 9, 21, 18, 0), end: new Date(2026, 9, 21, 18, 30) }
];
const plan = Casa.nextLeave(events, now, rules);
assert.strictEqual(plan.event.title, 'Dentista');
assert.strictEqual(plan.min, 0);
assert.strictEqual(Casa.leavePhrase(plan, now).main, 'Sal en 15 min');
const sooner = Casa.nextLeave([
  { title: 'Música', start: new Date(2026, 9, 21, 18, 0), end: new Date(2026, 9, 21, 19, 0) },
  { title: 'Colegio', start: new Date(2026, 9, 21, 18, 0), end: new Date(2026, 9, 21, 18, 30) }
], now, rules);
assert.strictEqual(sooner.event.title, 'Colegio');
assert.strictEqual(sooner.min, 10);
assert.strictEqual(Casa.leavePhrase(sooner, now).main, 'Sal en 5 min');
assert.strictEqual(Casa.leavePhrase(sooner, new Date(2026, 9, 21, 17, 50)).main, 'Sal ya');

const groups = Casa.groupByAisle(
  [{ name: 'Leche' }, { name: 'Pilas' }, { name: 'Pan de molde' }, { name: 'Algo raro' }],
  Casa.parseAisles('Lácteos | leche\nDroguería | pila\nPanadería | pan\nOtros')
);
assert.deepStrictEqual(groups.map((g) => g.name + ':' + g.items.map((i) => i.name).join(',')), [
  'Lácteos:Leche', 'Droguería:Pilas', 'Panadería:Pan de molde', 'Otros:Algo raro'
]);

const off = Casa.schoolOff(new Date(2026, 9, 25), { weekends: true, dates: [], demoDates: [], useDemo: false });
assert.strictEqual(off.off && off.why, 'finde');
const nav = Casa.schoolOff(new Date(2026, 11, 25), { weekends: true, dates: [], useDemo: true, demoDates: ['12-25'] });
assert.strictEqual(nav.why, 'ejemplo');
const sheet = Casa.schoolOff(new Date(2026, 4, 2), { weekends: true, dates: Casa.parseDateLines('2026-05-01..2026-05-03'), useDemo: false });
assert.strictEqual(sheet.off, true);

const sun = Casa.sunTimes(new Date(2026, 9, 21, 12), 42.85, -2.67);
const sh = sun.sunrise.getHours() + sun.sunrise.getMinutes() / 60;
const ss = sun.sunset.getHours() + sun.sunset.getMinutes() / 60;
assert.ok(sh > 6.5 && sh < 9.5, 'amanecer ' + sun.sunrise.toString());
assert.ok(ss > 18 && ss < 20.5, 'atardecer ' + sun.sunset.toString());
assert.strictEqual(Casa.isNight(new Date(2026, 9, 21, 17, 45), 42.85, -2.67), false);
assert.strictEqual(Casa.isNight(new Date(2026, 9, 21, 23, 15), 42.85, -2.67), true);
assert.strictEqual(Casa.isNight(new Date(2026, 9, 22, 6, 30), 42.85, -2.67), true);

const ropa = Weather.ropa(
  [{ time: '2026-10-21T17:00', temp: 14, pop: 80, code: 61, precip: 1.2 }],
  [{ title: 'Baloncesto (demo)', start: new Date(2026, 9, 21, 17, 30), end: new Date(2026, 9, 21, 19, 0), allDay: false }],
  new Date(2026, 9, 21, 16, 0),
  'baloncesto|piscina|cole'
);
assert.ok(ropa.indexOf('Chubasquero') === 0 && ropa.indexOf('Baloncesto') !== -1, ropa);
const aviso = Weather.advice(
  [{ time: '2026-10-21T17:00', temp: 14, pop: 80, code: 61, precip: 1.2 }],
  [{ title: 'Baloncesto (demo)', start: new Date(2026, 9, 21, 17, 30), end: new Date(2026, 9, 21, 19, 0), allDay: false }],
  new Date(2026, 9, 21, 16, 0)
);
assert.notStrictEqual(ropa, aviso);

load('js/outfit.js');
const Outfit = global.Outfit;
const demo = Outfit.demo(new Date(2026, 9, 28, 22, 10));
assert.strictEqual(demo.forDate, '2026-10-29');
assert.strictEqual(demo.demo, true);
assert.deepStrictEqual(demo.pieces.map((p) => p.id + ':' + p.slot), [
  'p011:arriba', 'p007:capa', 'p002:pantalón', 'p019:calzado', 'p006:exterior'
]);
assert.ok(Outfit.brief(demo).indexOf('Outfit de mañana') === 0 && Outfit.brief(demo).indexOf('Basquevolt') !== -1, Outfit.brief(demo));
const live = Outfit.normalize({
  forDate: '2026-10-29',
  why: 'Fresquito',
  imageUrl: 'javascript:alert(1)',
  pieces: [
    { id: 'P011', name: 'camiseta', slot: 'arriba' },
    { id: 'nope', name: 'x', slot: 'capa' },
    { id: 'p002', name: 'chino', slot: 'pantalon' }
  ]
});
assert.strictEqual(live.imageUrl, '');
assert.strictEqual(live.demo, false);
assert.deepStrictEqual(live.pieces.map((p) => p.id + ':' + p.slot), ['p011:arriba', 'p002:pantalón']);
assert.strictEqual(Outfit.normalize({ pieces: [] }), null);
assert.strictEqual(Outfit.safeImage('https://ejemplo.invalid/a.png').indexOf('https://'), 0);
assert.strictEqual(Outfit.brief(null), '');
assert.strictEqual(Outfit.esFotoScript('https://script.google.com/macros/s/ABC/exec?action=outfitImg&tok=abc'), true);
assert.strictEqual(Outfit.esFotoScript('https://script.google.com/macros/s/ABC/exec?action=outfitImg&tok=abc&key=secreto'), false);
assert.strictEqual(Outfit.esFotoScript('img/outfit-demo.svg'), false);
assert.strictEqual(Outfit.dataUrlFoto('404'), '');
assert.strictEqual(Outfit.dataUrlFoto('data:image/jpeg;base64,/9j/abc+def='), 'data:image/jpeg;base64,/9j/abc+def=');
assert.strictEqual(Outfit.dataUrlFoto('data:image/gif;base64,aaaa'), '');

const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
assert.ok(sw.indexOf('marco-v4-shell-v10') !== -1);
assert.ok(sw.indexOf("k.indexOf('marco-v4-shell-')") !== -1);
assert.ok(sw.indexOf("indexOf('marco-v2") === -1 && sw.indexOf("indexOf('marco-v3") === -1);

console.log('ok', { sunrise: sun.sunrise.toTimeString().slice(0, 5), sunset: sun.sunset.toTimeString().slice(0, 5), ropa: ropa, outfit: demo.forDate });
