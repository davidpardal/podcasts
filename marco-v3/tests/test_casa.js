/* Comprobaciones locales de marco-v3 (sin navegador). */
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

console.log('ok', { sunrise: sun.sunrise.toTimeString().slice(0, 5), sunset: sun.sunset.toTimeString().slice(0, 5), ropa: ropa });
