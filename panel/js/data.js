// Datos del panel. Todo lo que es de ejemplo lleva la marca demo y se ve en pantalla con la
// etiqueta «Demo». Los datos reales llegan de Ajustes (personas, custodia, jornada), de tus
// calendarios iCal, de Open-Meteo (tiempo) y de lo que apuntes aquí (compra, tareas), que se
// guarda en este aparato. Todo lo de ejemplo es relativo a «hoy» para que la demo parezca actual.
window.DATA = (function () {
  var P = window.PANEL, CFG = P.CFG, store = P.store;
  var base = new Date();
  base.setHours(0, 0, 0, 0);

  function at(d, hm) {
    var p = hm.split(':');
    var x = new Date(base);
    x.setDate(x.getDate() + d);
    x.setHours(+p[0], +p[1], 0, 0);
    return x;
  }

  // ---------------------------------------------------------------- personas
  var DEMO_PEOPLE = [
    { id: 'alex', name: 'Ana', role: 'adult', color: '#2D5BFF' },
    { id: 'jordan', name: 'Pablo', role: 'adult', color: '#E4007C' },
    { id: 'maya', name: 'Leo', role: 'kid', color: '#00A36C' },
    { id: 'otto', name: 'Mía', role: 'kid', color: '#FFB000' }
  ].map(P.person);
  // Estado de presencia de ejemplo (el original lo saca de Home Assistant)
  var DEMO_STATUS = { alex: { home: false, status: 'Volviendo a casa', eta: 12 }, jordan: { home: false, status: 'En la oficina' }, maya: { home: true, status: 'En casa' }, otto: { home: true, status: 'En casa' } };

  var people = (CFG.peopleList || DEMO_PEOPLE).map(function (p) {
    var x = Object.assign({}, p);
    var st = CFG.peopleList ? { home: null, status: '' } : DEMO_STATUS[p.id];
    return Object.assign(x, st, { demoPresence: !CFG.peopleList });
  });
  var adults = people.filter(function (p) { return p.role !== 'kid'; }), kids = people.filter(function (p) { return p.role === 'kid'; });
  // Los datos de ejemplo usan 4 papeles (2 adultos, 2 peques); se reparten entre tus personas reales.
  var ROLE = {
    alex: (adults[0] || kids[0] || people[0]).id,
    jordan: (adults[1] || adults[0] || people[0]).id,
    maya: (kids[0] || adults[0] || people[0]).id,
    otto: (kids[1] || kids[0] || adults[0] || people[0]).id
  };
  function ids(list) {
    var out = [];
    list.forEach(function (id) { var m = ROLE[id] || id; if (out.indexOf(m) < 0) out.push(m); });
    return out;
  }
  var ALL = people.map(function (p) { return p.id; });
  var family = { id: 'family', name: 'Familia', color: '#111111', rgb: '17 17 17', ink: '#FFFFFF' };

  // ---------------------------------------------------------------- calendario (demo)
  var n = 0;
  function ev(d, s, e, title, who, extra) {
    return Object.assign({ id: 'e' + (++n), demo: true, start: at(d, s), end: at(d, e), title: title, people: who === 'ALL' ? ALL.slice() : ids(who) }, extra || {});
  }
  function allDay(d, days, title, who, extra) {
    return Object.assign({ id: 'e' + (++n), demo: true, allDay: true, start: at(d, '00:00'), end: at(d + days, '00:00'), title: title, people: who === 'ALL' ? ALL.slice() : ids(who) }, extra || {});
  }

  var demoEvents = [
    // Hoy
    allDay(0, 1, 'Día del pijama en el cole', ['otto']),
    allDay(0, 1, 'Sacar la basura y el reciclaje', 'ALL'),
    ev(0, '07:00', '07:45', 'Gimnasio', ['jordan'], { loc: 'Gimnasio del barrio' }),
    ev(0, '08:15', '08:40', 'Llevar al cole', ['alex'], { travel: 10, loc: 'Colegio' }),
    ev(0, '09:30', '10:30', 'Reunión de diseño', ['jordan'], { loc: 'Oficina · Sala 4B' }),
    ev(0, '12:00', '12:45', 'Dentista', ['maya', 'jordan'], { travel: 15, loc: 'Clínica dental' }),
    ev(0, '13:00', '14:00', 'Comida con Sara', ['alex'], { loc: 'Bar Rústico' }),
    ev(0, '15:45', '16:30', 'Clase de piano', ['otto'], { travel: 12, loc: 'Escuela de música', notes: 'Llevar el libro azul de solfeo.' }),
    ev(0, '16:05', '16:30', 'Llevar a Leo a fútbol', ['jordan']),
    ev(0, '16:25', '16:50', 'Recoger a Mía', ['jordan'], { loc: 'Escuela de música' }),
    ev(0, '16:30', '18:00', 'Entreno de fútbol', ['maya'], { travel: 20, loc: 'Campo municipal', notes: 'Espinilleras y botella de agua. Puede llover: chubasquero.' }),
    ev(0, '17:00', '17:30', 'Tutoría con la profe', ['alex', 'jordan'], { loc: 'Teams' }),
    ev(0, '18:30', '19:30', 'Cena en casa de la amama', 'ALL', { travel: 20, loc: 'Casa de la amama', notes: 'Llevar el bizcocho de limón.' }),
    ev(0, '20:00', '20:30', 'Baño y cuentos', ['otto']),

    allDay(1, 3, 'Ana en Madrid', ['alex'], { loc: 'Hotel' }),
    ev(1, '07:00', '07:45', 'Gimnasio', ['jordan'], { loc: 'Gimnasio del barrio' }),
    ev(1, '08:15', '08:40', 'Llevar al cole', ['jordan'], { travel: 10 }),
    ev(1, '10:30', '11:15', 'Veterinario · Txuri', ['jordan'], { travel: 10, loc: 'Clínica veterinaria' }),
    ev(1, '15:30', '16:30', 'Taller de arte', ['maya'], { loc: 'Cole' }),
    ev(1, '16:00', '18:00', 'Quedada con Unai', ['otto'], { travel: 8, loc: 'Casa de Unai' }),
    ev(1, '19:00', '21:00', 'Club de lectura', ['jordan'], { travel: 10, loc: 'Biblioteca' }),

    ev(2, '09:00', '14:00', 'Excursión al museo de ciencia', ['otto'], { loc: 'Museo de ciencia' }),
    ev(2, '13:00', '13:45', 'Peluquería', ['maya', 'otto'], { travel: 10, loc: 'Peluquería infantil' }),
    ev(2, '16:30', '18:00', 'Entreno de fútbol', ['maya'], { travel: 20, loc: 'Campo municipal' }),
    ev(2, '18:00', '19:30', 'Noche de pizza', 'ALL'),

    ev(3, '10:00', '10:45', 'Natación', ['otto'], { travel: 12, loc: 'Piscina municipal' }),
    ev(3, '11:00', '12:00', 'Compra semanal', ['jordan']),
    ev(3, '13:00', '15:30', 'Cumple de Zoe', ['maya'], { travel: 15, loc: 'Ludoteca' }),
    ev(3, '19:00', '21:00', 'Noche de peli', 'ALL'),

    ev(4, '10:30', '12:00', 'Almuerzo en familia', 'ALL', { travel: 15, loc: 'Cafetería' }),
    ev(4, '17:05', '18:20', 'Vuelo de vuelta', ['alex'], { loc: 'MAD → VIT' }),

    ev(5, '07:00', '07:45', 'Gimnasio', ['jordan']),
    ev(5, '15:45', '16:30', 'Clase de piano', ['otto'], { travel: 12 }),
    ev(5, '16:30', '18:00', 'Entreno de fútbol', ['maya'], { travel: 20 }),
    ev(5, '19:00', '20:00', 'Yoga', ['jordan']),

    allDay(6, 2, 'Visita de los abuelos', 'ALL'),
    ev(6, '09:00', '09:45', 'Dentista', ['otto'], { travel: 15, loc: 'Clínica dental' }),
    ev(6, '16:30', '18:00', 'Entreno de fútbol', ['maya'], { travel: 20 })
  ];
  for (var d = -40; d <= 45; d++) {
    if (d >= 0 && d <= 6) continue;
    var dow = new Date(at(d, '00:00')).getDay();
    if (dow === 1) demoEvents.push(ev(d, '15:45', '16:30', 'Clase de piano', ['otto']));
    if (dow === 2 || dow === 4) demoEvents.push(ev(d, '16:30', '18:00', 'Entreno de fútbol', ['maya']));
    if (dow === 3) demoEvents.push(ev(d, '19:00', '20:00', 'Yoga', ['jordan']));
    if (dow === 6) demoEvents.push(ev(d, '10:00', '10:45', 'Natación', ['otto']));
    if (dow === 0) demoEvents.push(ev(d, '17:30', '19:30', 'Cena en casa de la amama', 'ALL'));
    if (dow === 5 && d % 2 === 0) demoEvents.push(ev(d, '18:00', '19:30', 'Noche de pizza', 'ALL'));
    if (d % 9 === 0) demoEvents.push(ev(d, '12:00', '13:00', 'Comida de trabajo', ['alex']));
    if (d % 11 === 0) demoEvents.push(ev(d, '09:00', '10:00', 'Médico', ['jordan']));
  }
  demoEvents.push(allDay(12, 1, 'Cumple de Leo 🎂', 'ALL'));
  demoEvents.push(allDay(-8, 3, 'Finde en la casa rural', 'ALL'));

  var busyExtras = [
    ev(0, '10:00', '11:00', 'Viene el fontanero', ['jordan']),
    ev(0, '11:00', '11:30', 'Llamada al banco', ['alex']),
    ev(0, '14:30', '15:30', 'Voluntariado biblioteca', ['jordan']),
    ev(0, '15:30', '16:00', 'Preparar merienda', ['maya']),
    ev(0, '16:00', '16:45', 'Refuerzo de mates', ['otto']),
    ev(0, '16:15', '17:00', 'Recuperar natación', ['otto'], { travel: 10 }),
    ev(0, '19:45', '20:30', 'Preparar mercadillo', ['maya', 'jordan']),
    ev(0, '20:30', '21:30', 'Hockey', ['alex'], { travel: 15 })
  ];

  // ---------------------------------------------------------------- tareas
  var routines = [
    { id: 'morning', name: 'Mañana', range: '6:00 – 11:00', from: 0, to: 11 },
    { id: 'after', name: 'Tarde', range: '11:00 – 17:00', from: 11, to: 17 },
    { id: 'evening', name: 'Noche', range: '17:00 – 22:00', from: 17, to: 24 }
  ];
  var cid = 0;
  function chore(r, who, title, emoji, stars, done, extra) {
    return Object.assign({ id: 'c' + (++cid), r: r, who: who === 'any' ? 'any' : ROLE[who], title: title, emoji: emoji, stars: stars, done: !!done }, extra || {});
  }
  var demoChores = [
    chore('morning', 'maya', 'Hacer la cama', '🛏️', 1, true),
    chore('morning', 'maya', 'Lavarse los dientes', '🪥', 1, true),
    chore('morning', 'maya', 'Preparar la mochila', '🎒', 1, true),
    chore('morning', 'otto', 'Hacer la cama', '🛏️', 1, true),
    chore('morning', 'otto', 'Lavarse los dientes', '🪥', 1, true),
    chore('morning', 'otto', 'Vestirse', '👕', 1, false),
    chore('morning', 'alex', 'Llevar al cole', '🚗', 0, true),
    chore('morning', 'jordan', 'Preparar almuerzos', '🥪', 0, true),
    chore('morning', 'any', 'Dar de comer a Txuri', '🐶', 1, true),

    chore('after', 'maya', 'Vaciar la fiambrera', '🥪', 1, true),
    chore('after', 'maya', 'Deberes', '📚', 2, false),
    chore('after', 'maya', 'Bolsa de fútbol', '⚽', 1, false),
    chore('after', 'otto', 'Vaciar la fiambrera', '🥪', 1, true),
    chore('after', 'otto', 'Leer 20 minutos', '📖', 2, false),
    chore('after', 'otto', 'Practicar piano', '🎹', 2, false),
    chore('after', 'otto', 'Recoger el Lego', '🧱', 1, false),
    chore('after', 'alex', 'Bajar el reciclaje', '♻️', 0, false, { overdue: true }),
    chore('after', 'alex', 'Llamar al fontanero', '☎️', 0, true),
    chore('after', 'jordan', 'Doblar la ropa', '🧺', 0, false),
    chore('after', 'jordan', 'Comprar regalo de Zoe', '🎁', 0, true),
    chore('after', 'any', 'Regar las plantas', '🪴', 1, false),
    chore('after', 'any', 'Vaciar el lavavajillas', '🍽️', 2, false),
    chore('after', 'any', 'Pasear a Txuri', '🐕', 2, true),

    chore('evening', 'maya', 'Poner la mesa', '🍴', 1, false),
    chore('evening', 'maya', 'Preparar la ropa', '👕', 1, false),
    chore('evening', 'maya', 'Ducha', '🚿', 1, false),
    chore('evening', 'otto', 'Recoger los platos', '🍽️', 1, false),
    chore('evening', 'otto', 'Baño', '🛁', 1, false),
    chore('evening', 'otto', 'Preparar la ropa', '👕', 1, false),
    chore('evening', 'alex', 'Cerrar la casa', '🔐', 0, false),
    chore('evening', 'jordan', 'Poner el lavavajillas', '🫧', 0, false),
    chore('evening', 'any', 'Limpiar la encimera', '🧽', 1, false),
    chore('evening', 'any', 'Bajar la basura', '🗑️', 2, false)
  ];
  // Plantilla limpia para empezar con tus tareas (Ajustes → «Empezar con mis tareas»)
  var TEMPLATE = {
    kid: [['morning', 'Hacer la cama', '🛏️', 1], ['morning', 'Lavarse los dientes', '🪥', 1], ['morning', 'Preparar la mochila', '🎒', 1],
      ['after', 'Deberes', '📚', 2], ['after', 'Leer 20 minutos', '📖', 2], ['after', 'Ordenar la habitación', '🧸', 2],
      ['evening', 'Poner o recoger la mesa', '🍽️', 1], ['evening', 'Ducha', '🚿', 1], ['evening', 'Preparar la ropa', '👕', 1]],
    adult: [['morning', 'Preparar almuerzos', '🥪', 0], ['evening', 'Cerrar la casa', '🔐', 0]],
    any: [['after', 'Vaciar el lavavajillas', '🍽️', 2], ['after', 'Regar las plantas', '🪴', 1], ['evening', 'Bajar la basura', '🗑️', 2]]
  };
  function freshChores() {
    var out = [], k = 0;
    people.forEach(function (p) {
      TEMPLATE[p.role === 'kid' ? 'kid' : 'adult'].forEach(function (t) { out.push({ id: 'm' + (++k), r: t[0], who: p.id, title: t[1], emoji: t[2], stars: t[3], done: false }); });
    });
    TEMPLATE.any.forEach(function (t) { out.push({ id: 'm' + (++k), r: t[0], who: 'any', title: t[1], emoji: t[2], stars: t[3], done: false }); });
    return out;
  }
  var demoStars = {}, demoWeek = {};
  demoStars[ROLE.maya] = 42; demoStars[ROLE.otto] = 57;
  demoWeek[ROLE.maya] = [1, 1, 0, 1, 1, 0, 1]; demoWeek[ROLE.otto] = [1, 0, 1, 1, 1, 1, 0];

  var savedChores = store.get('chores', null);
  var choresDemo = !savedChores;
  var chores = savedChores ? savedChores.list : demoChores;
  var stars = savedChores ? savedChores.stars : demoStars;
  var week = savedChores ? (savedChores.week || {}) : demoWeek;
  // Las tareas guardadas se reinician cada día
  if (savedChores && savedChores.day !== base.toDateString()) chores.forEach(function (c) { c.done = false; delete c.doneBy; });

  // ---------------------------------------------------------------- compra
  var stores = [{ id: 'grocer', name: (CFG.stores && CFG.stores[0]) || 'Súper' }, { id: 'costco', name: (CFG.stores && CFG.stores[1]) || 'Mercado' }];
  var CATS = ['Fruta y verdura', 'Panadería', 'Carne y pescado', 'Lácteos y huevos', 'Despensa', 'Congelados', 'Picoteo', 'Hogar'];
  var catOrder = { all: CATS, grocer: CATS, costco: ['Hogar', 'Despensa', 'Picoteo', 'Lácteos y huevos', 'Carne y pescado', 'Congelados', 'Fruta y verdura', 'Panadería'] };
  var gid = 0;
  function g(name, cat, qty, st, done, note) {
    return { id: 'g' + (++gid), name: name, cat: cat, qty: qty, store: st, done: !!done, note: note || '' };
  }
  var demoGroceries = [
    g('Plátanos', 'Fruta y verdura', 1, 'grocer', false, 'Un racimo, no muy maduros'),
    g('Espinacas', 'Fruta y verdura', 1, 'grocer'),
    g('Aguacates', 'Fruta y verdura', 3, 'grocer'),
    g('Manzanas', 'Fruta y verdura', 6, 'grocer'),
    g('Pan de masa madre', 'Panadería', 1, 'grocer'),
    g('Pan de molde', 'Panadería', 2, 'costco', false, 'Integral'),
    g('Muslos de pollo', 'Carne y pescado', 1, 'grocer', false, 'Deshuesados'),
    g('Salmón', 'Carne y pescado', 2, 'grocer'),
    g('Leche', 'Lácteos y huevos', 2, 'costco', false, 'Semidesnatada'),
    g('Huevos', 'Lácteos y huevos', 1, 'costco', false, 'Dos docenas'),
    g('Yogur griego', 'Lácteos y huevos', 1, 'grocer'),
    g('Queso Idiazabal', 'Lácteos y huevos', 1, 'grocer'),
    g('Macarrones', 'Despensa', 2, 'grocer'),
    g('Aceite de oliva', 'Despensa', 1, 'costco'),
    g('Café en grano', 'Despensa', 1, 'grocer', false, 'Tueste natural'),
    g('Guisantes congelados', 'Congelados', 1, 'grocer'),
    g('Gofres', 'Congelados', 1, 'grocer'),
    g('Galletas saladas', 'Picoteo', 1, 'costco'),
    g('Barritas de cereales', 'Picoteo', 1, 'grocer'),
    g('Papel de cocina', 'Hogar', 1, 'costco'),
    g('Lavavajillas a mano', 'Hogar', 1, 'grocer'),
    g('Limones', 'Fruta y verdura', 2, 'grocer', true),
    g('Mantequilla', 'Lácteos y huevos', 1, 'grocer', true),
    g('Tortillas de trigo', 'Panadería', 1, 'grocer', true)
  ];
  var savedShop = store.get('compra', null);
  var groceriesDemo = !savedShop;
  var groceries = savedShop ? savedShop.list : demoGroceries;
  if (savedShop) gid = savedShop.gid || 1000;

  var catalog = [
    ['Manzanas', 'Fruta y verdura'], ['Aguacates', 'Fruta y verdura'], ['Plátanos', 'Fruta y verdura'], ['Espinacas', 'Fruta y verdura'], ['Arándanos', 'Fruta y verdura'],
    ['Brócoli', 'Fruta y verdura'], ['Zanahorias', 'Fruta y verdura'], ['Pepino', 'Fruta y verdura'], ['Ajos', 'Fruta y verdura'], ['Uvas', 'Fruta y verdura'],
    ['Limones', 'Fruta y verdura'], ['Naranjas', 'Fruta y verdura'], ['Cebollas', 'Fruta y verdura'], ['Patatas', 'Fruta y verdura'], ['Fresas', 'Fruta y verdura'],
    ['Tomates', 'Fruta y verdura'], ['Pimientos', 'Fruta y verdura'], ['Lechuga', 'Fruta y verdura'],
    ['Pan', 'Panadería'], ['Pan de molde', 'Panadería'], ['Cruasanes', 'Panadería'], ['Pan de masa madre', 'Panadería'], ['Tortillas de trigo', 'Panadería'], ['Pan de hamburguesa', 'Panadería'],
    ['Bacon', 'Carne y pescado'], ['Pechugas de pollo', 'Carne y pescado'], ['Muslos de pollo', 'Carne y pescado'], ['Carne picada', 'Carne y pescado'],
    ['Salmón', 'Carne y pescado'], ['Merluza', 'Carne y pescado'], ['Gambas', 'Carne y pescado'], ['Jamón', 'Carne y pescado'],
    ['Mantequilla', 'Lácteos y huevos'], ['Queso', 'Lácteos y huevos'], ['Queso Idiazabal', 'Lácteos y huevos'], ['Queso de untar', 'Lácteos y huevos'], ['Huevos', 'Lácteos y huevos'],
    ['Yogur griego', 'Lácteos y huevos'], ['Yogures', 'Lácteos y huevos'], ['Leche', 'Lácteos y huevos'], ['Bebida de avena', 'Lácteos y huevos'], ['Parmesano', 'Lácteos y huevos'],
    ['Alubias', 'Despensa'], ['Garbanzos', 'Despensa'], ['Lentejas', 'Despensa'], ['Cereales', 'Despensa'], ['Café en grano', 'Despensa'], ['Café', 'Despensa'], ['Harina', 'Despensa'], ['Miel', 'Despensa'],
    ['Aceite de oliva', 'Despensa'], ['Tomate frito', 'Despensa'], ['Crema de cacahuete', 'Despensa'], ['Arroz', 'Despensa'],
    ['Macarrones', 'Despensa'], ['Espaguetis', 'Despensa'], ['Azúcar', 'Despensa'], ['Té', 'Despensa'], ['Atún en lata', 'Despensa'],
    ['Guisantes congelados', 'Congelados'], ['Frutos rojos congelados', 'Congelados'], ['Helado', 'Congelados'], ['Pizza', 'Congelados'], ['Gofres', 'Congelados'],
    ['Patatas fritas', 'Picoteo'], ['Galletas saladas', 'Picoteo'], ['Chocolate negro', 'Picoteo'], ['Galletas', 'Picoteo'], ['Barritas de cereales', 'Picoteo'], ['Palomitas', 'Picoteo'],
    ['Lavavajillas a mano', 'Hogar'], ['Pastillas lavavajillas', 'Hogar'], ['Bolsas de basura', 'Hogar'], ['Detergente', 'Hogar'],
    ['Papel de cocina', 'Hogar'], ['Papel higiénico', 'Hogar'], ['Pasta de dientes', 'Hogar']
  ];
  var usuals = ['Leche', 'Huevos', 'Plátanos', 'Pan', 'Manzanas', 'Café', 'Yogures', 'Queso', 'Mantequilla', 'Tomates', 'Muslos de pollo', 'Papel higiénico'];

  // ---------------------------------------------------------------- casa (demo: el original usa Home Assistant)
  var rooms = [
    { id: 'kitchen', name: 'Cocina' },
    { id: 'living', name: 'Salón' },
    { id: 'entry', name: 'Entrada y garaje' },
    { id: 'upstairs', name: 'Dormitorios' },
    { id: 'yard', name: 'Terraza' }
  ];
  var nameK = (kids[0] || people[0]).name, nameK2 = (kids[1] || kids[0] || people[0]).name;
  var devices = [
    { id: 'k-pend', room: 'kitchen', type: 'light', name: 'Colgantes', on: true, level: 80 },
    { id: 'k-under', room: 'kitchen', type: 'light', name: 'Bajo muebles', on: true, level: 55 },
    { id: 'k-island', room: 'kitchen', type: 'light', name: 'Isla', on: false, level: 100 },
    { id: 'k-speaker', room: 'kitchen', type: 'blind', name: 'Estor ventana', pos: 100 },
    { id: 'l-lamp', room: 'living', type: 'light', name: 'Lámpara de pie', on: true, level: 45 },
    { id: 'l-ceil', room: 'living', type: 'light', name: 'Techo', on: false, level: 100 },
    { id: 'l-blinds', room: 'living', type: 'blind', name: 'Persianas', pos: 60 },
    { id: 'l-fire', room: 'living', type: 'light', name: 'Estantería', on: false, level: 70 },
    { id: 'e-door', room: 'entry', type: 'lock', name: 'Puerta principal', locked: true },
    { id: 'e-porch', room: 'entry', type: 'light', name: 'Portal', on: true, level: 100 },
    { id: 'g-door', room: 'entry', type: 'garage', name: 'Garaje', state: 'closed' },
    { id: 'g-side', room: 'entry', type: 'lock', name: 'Puerta lateral', locked: true },
    { id: 'u-maya', room: 'upstairs', type: 'light', name: 'Lámpara de ' + nameK, on: true, level: 30 },
    { id: 'u-otto', room: 'upstairs', type: 'light', name: 'Luz quitamiedos de ' + nameK2, on: false, level: 15 },
    { id: 'u-hall', room: 'upstairs', type: 'light', name: 'Pasillo', on: false, level: 60 },
    { id: 'u-bath', room: 'upstairs', type: 'light', name: 'Baño', on: false, level: 100 },
    { id: 'y-string', room: 'yard', type: 'light', name: 'Guirnalda', on: false, level: 100, flaky: true },
    { id: 'y-back', room: 'yard', type: 'lock', name: 'Puerta terraza', locked: true },
    { id: 'y-flood', room: 'yard', type: 'light', name: 'Foco', on: false, level: 100 }
  ];
  var climate = { current: 20.5, set: 21.5, mode: 'heat', humidity: 42, outside: 14 };
  var media = { room: 'Cocina', title: 'Harvest Moon', artist: 'Neil Young', playing: true, volume: 35, seed: 'harvest-vinyl' };
  var cameras = [
    { id: 'c-front', name: 'Portal', seed: 'porch-steps' },
    { id: 'c-drive', name: 'Garaje', seed: 'driveway-maple' },
    { id: 'c-yard', name: 'Terraza', seed: 'garden-yard' }
  ];
  var scenes = [
    { id: 'morning', name: 'Mañana', icon: 'sunrise', set: { 'k-pend': 100, 'k-under': 80, 'l-blinds': 100, 'l-lamp': 0, 'u-hall': 60 } },
    { id: 'dinner', name: 'Cena', icon: 'utensils', set: { 'k-pend': 55, 'k-under': 30, 'k-island': 70, 'l-lamp': 40, 'l-ceil': 0 } },
    { id: 'movie', name: 'Peli', icon: 'film', set: { 'k-pend': 0, 'k-under': 15, 'k-island': 0, 'l-lamp': 15, 'l-ceil': 0, 'l-blinds': 0, 'l-fire': 30 } },
    { id: 'away', name: 'Fuera', icon: 'away', set: { 'k-pend': 0, 'k-under': 0, 'k-island': 0, 'l-lamp': 0, 'l-ceil': 0, 'l-fire': 0, 'u-maya': 0, 'u-hall': 0, 'e-porch': 100 } },
    { id: 'night', name: 'A dormir', icon: 'moon', set: { 'k-pend': 0, 'k-under': 10, 'k-island': 0, 'l-lamp': 0, 'l-ceil': 0, 'l-fire': 0, 'u-hall': 10, 'u-otto': 15, 'e-porch': 0 } }
  ];

  // ---------------------------------------------------------------- tiempo de ejemplo (si Open-Meteo falla)
  var weather = {
    demo: true, hi: 17, lo: 8,
    t: [9, 9, 8, 8, 8, 8, 9, 10, 11, 12, 13, 15, 16, 17, 16, 15, 14, 13, 12, 12, 11, 10, 10, 9],
    c: ['moon', 'moon', 'moon', 'moon', 'moon', 'moon', 'partly', 'partly', 'sun', 'sun', 'sun', 'partly', 'partly', 'cloud', 'cloud', 'cloud', 'rain', 'rain', 'rain', 'rain', 'cloud', 'cloud', 'moon', 'moon'],
    p: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 10, 20, 25, 40, 80, 90, 70, 55, 20, 10, 0, 0]
  };

  // ---------------------------------------------------------------- fotos (demo: picsum.photos)
  var t = new Date(base);
  var mmdd = ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2);
  function ph(seed, o, date, place, from, tag) { return { seed: seed, o: o, date: date, place: place, from: ROLE[from] || from, tag: tag, demo: true }; }
  var demoPhotos = [
    ph('tofino-surf', 'l', '2021-' + mmdd, 'Zarautz', 'jordan', 'surf'),
    ph('cottage-dock', 'l', '2023-08-12', 'Embalse de Ullíbarri', 'alex', 'embalse'),
    ph('maya-kite', 'p', '2024-05-19', 'Parque de Salburua', 'jordan', 'spring24'),
    ph('otto-kite', 'p', '2024-05-19', 'Parque de Salburua', 'alex', 'spring24'),
    ph('autumn-walk', 'l', '2022-10-09', 'Parque de la Florida', 'alex', 'fall22'),
    ph('birthday-cake', 'p', '2025-10-12', 'Casa', 'jordan', 'bday25'),
    ph('candles-lit', 'p', '2025-10-12', 'Casa', 'alex', 'bday25'),
    ph('mountain-lake', 'l', '2019-' + mmdd, 'Pirineo', 'alex', 'pirineo'),
    ph('snow-day', 'l', '2024-01-21', 'Gorbeia', 'jordan', 'winter24'),
    ph('beach-dunes', 'l', '2023-07-02', 'Mundaka', 'maya', 'playa'),
    ph('city-night', 'l', '2022-12-18', 'Plaza de la Virgen Blanca', 'jordan', 'xmas22'),
    ph('garden-bloom', 'p', '2025-06-08', 'Terraza', 'otto', 'garden'),
    ph('tomato-haul', 'p', '2025-06-08', 'Huerta', 'maya', 'garden'),
    ph('road-trip', 'l', '2024-08-04', 'Picos de Europa', 'alex', 'picos'),
    ph('campfire', 'l', '2024-08-06', 'Cangas de Onís', 'jordan', 'picos'),
    ph('forest-path', 'l', '2020-09-26', 'Hayedo de Otzarreta', 'alex', 'hayedo'),
    ph('pancakes', 'p', '2026-03-14', 'Casa', 'maya', 'tortitas'),
    ph('sugar-shack', 'p', '2026-03-14', 'Sidrería', 'jordan', 'tortitas'),
    ph('harbour-sail', 'l', '2025-07-19', 'Bahía de La Concha', 'otto', 'vela'),
    ph('pumpkins', 'l', '2025-10-25', 'Mercado de otoño', 'maya', 'fall25')
  ];
  // Tus fotos: URLs en Ajustes (se muestran sin fecha ni lugar si no los conocemos)
  var userPhotos = (CFG.photos || []).filter(Boolean).map(function (u, i) { return { url: u, o: 'l', date: '', place: '', from: 'family', tag: 'u' + i }; });
  var favs = store.get('favs', {});
  var photos = (userPhotos.length ? userPhotos : demoPhotos);
  photos.forEach(function (p) { if (favs[p.url || p.seed]) p.fav = true; });

  // ---------------------------------------------------------------- agentes IA (demo, estilo CodexBar)
  var H5 = 300, DAY = 1440, WEEK = 10080, MONTH = 43200;
  var agents = [
    { id: 'claude', name: 'Claude', plan: 'Max 20×', color: '#D97757', rgb: '217 119 87', status: 'ok',
      meters: [{ label: 'Sesión', win: H5, used: 62, left: 134 }, { label: 'Semanal · todos los modelos', win: WEEK, used: 41, left: 4680 }],
      tokens: 3.1, cost: 21.4, week: [2.2, 3.8, 2.9, 4.4, 1.6, 0.8, 3.1] },
    { id: 'codex', name: 'Codex', plan: 'ChatGPT Pro', color: '#10A37F', rgb: '16 163 127', status: 'ok',
      meters: [{ label: 'Sesión', win: H5, used: 88, left: 38 }, { label: 'Semanal', win: WEEK, used: 57, left: 7320 }],
      tokens: 4.6, cost: 17.9, week: [3.1, 2.4, 5.2, 4.0, 2.2, 1.1, 4.6] },
    { id: 'cursor', name: 'Cursor', plan: 'Pro+', color: '#111111', rgb: '17 17 17', status: 'ok',
      meters: [{ label: 'Uso incluido', win: MONTH, used: 76, left: 17280, detail: '45,60 € de 60 €' }, { label: 'Bajo demanda', win: MONTH, used: 16, left: 17280, detail: '8,20 € de 50 € de tope' }],
      tokens: 1.8, cost: 6.3, week: [1.2, 1.9, 0.7, 2.3, 1.5, 0.4, 1.8] },
    { id: 'gemini', name: 'Gemini', plan: 'AI Ultra', color: '#3F6FE4', rgb: '63 111 228', status: 'ok',
      meters: [{ label: 'Peticiones · diario', win: DAY, used: 16, left: 522, detail: '320 de 2.000' }, { label: 'Modelo Pro · diario', win: DAY, used: 52, left: 522, detail: '104 de 200' }],
      tokens: 0.9, cost: 0, week: [0.4, 1.1, 0.6, 0.2, 0.9, 1.3, 0.9] },
    { id: 'copilot', name: 'Copilot', plan: 'Pro+', color: '#8957E5', rgb: '137 87 229', status: 'degraded', incident: 'Más errores de lo normal en el agente',
      meters: [{ label: 'Peticiones premium', win: MONTH, used: 75, left: 17280, detail: '1.124 de 1.500' }, { label: 'Agente de código', win: MONTH, used: 38, left: 17280, detail: '19 de 50 sesiones' }],
      tokens: 1.2, cost: 0, week: [0.9, 1.4, 1.1, 0.8, 1.6, 0.3, 1.2] }
  ];

  return {
    people: people, family: family, ALL: ALL, ROLE: ROLE,
    events: demoEvents.slice(), demoEvents: demoEvents, busyExtras: busyExtras, eventsDemo: true,
    routines: routines, chores: chores, stars: stars, week: week, choresDemo: choresDemo, freshChores: freshChores,
    stores: stores, catOrder: catOrder, groceries: groceries, catalog: catalog, usuals: usuals, groceriesDemo: groceriesDemo,
    rooms: rooms, devices: devices, climate: climate, media: media, cameras: cameras, scenes: scenes, homeDemo: true,
    weather: weather, photos: photos, photosDemo: !userPhotos.length, agents: agents, agentsDemo: true,
    _gid: function () { return 'g' + (++gid); },
    _eid: function () { return 'e' + (++n); },
    _gidNow: function () { return gid; }
  };
})();
