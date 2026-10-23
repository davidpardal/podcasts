/* Configuración por defecto del marco: GENÉRICA, sin datos personales.
 * Los datos de tu familia (nombres, custodia, jornada, tarifa…) se ponen en Ajustes → Familia
 * o se importan en Ajustes → Importar/Exportar. Se guardan solo en el dispositivo (localStorage).
 * Aquí no van secretos: las direcciones iCal se pegan en Ajustes. */
window.MARCO_DEFAULTS = {
  city: 'Vitoria-Gasteiz',
  lat: 42.85,
  lon: -2.67,
  timezone: 'Europe/Madrid',
  parent: 'Papá',
  otherParent: 'Mamá',
  kids: [
    { id: 'peque-a', name: 'Peque A', color: '#2F80ED' },
    { id: 'peque-b', name: 'Peque B', color: '#3BA55C' }
  ],
  // Custodia por semanas alternas (desactivada por defecto). anchor = inicio de una semana
  // contigo (fecha y hora del cambio); se repite cada cycleDays días y dura daysWithParent días.
  custody: { enabled: false, anchor: '2026-01-02T17:00', cycleDays: 14, daysWithParent: 7 },
  // Jornada de trabajo de ejemplo (0 = domingo, 1 = lunes … 6 = sábado). No se pinta en festivos nacionales.
  work: {
    enabled: true,
    label: 'Trabajo',
    shifts: { 1: ['09:00', '17:00'], 2: ['09:00', '17:00'], 3: ['09:00', '17:00'], 4: ['09:00', '17:00'], 5: ['09:00', '15:00'] }
  },
  // Tarifa de luz. NO se inventan precios: si quieres verlos, cópialos de tu factura en Ajustes.
  tariff: { name: '', prices: { punta: null, llano: null, valle: null } },
  nightClock: { enabled: true, from: '23:00', to: '07:00' },
  // slot: manana | cole | noche. kids vacío o ausente = todos. La semana sin niños (custodia) pausa las tareas.
  chores: [
    { id: 'cama', emoji: '🛏️', name: 'Hacer la cama', stars: 1, slot: 'manana' },
    { id: 'mesa', emoji: '🍽️', name: 'Poner o recoger la mesa', stars: 1, slot: 'noche' },
    { id: 'deberes', emoji: '📚', name: 'Deberes hechos', stars: 2, slot: 'cole' },
    { id: 'cuarto', emoji: '🧸', name: 'Ordenar la habitación', stars: 2, slot: 'cole' },
    { id: 'basura', emoji: '🗑️', name: 'Bajar la basura', stars: 1, slot: 'noche', kids: ['peque-a'] }
  ],
  rewards: [
    { id: 'pantalla', emoji: '🎮', name: '30 min extra de pantalla', cost: 5 },
    { id: 'cena', emoji: '🍕', name: 'Elegir la cena del viernes', cost: 10 },
    { id: 'plan', emoji: '🎳', name: 'Plan especial el finde', cost: 25 }
  ],
  habitualesBase: ['Leche', 'Pan', 'Huevos', 'Fruta', 'Yogures', 'Café', 'Papel higiénico', 'Tomates'],
  // Menú semanal de ejemplo (0 = lunes … 6 = domingo). Se sustituye al guardar en el dispositivo.
  menu: {
    span: 7,
    dishes: ['Macarrones', 'Lentejas', 'Tortilla de patata', 'Arroz', 'Pescado', 'Ensalada', 'Pollo asado', 'Sopa', 'Pizza', 'Crema de verduras', 'Hamburguesa', 'Cocido'],
    plan: {
      '0': { comida: 'Lentejas', cena: 'Tortilla de patata' },
      '1': { comida: 'Macarrones', cena: 'Pescado' },
      '2': { comida: 'Arroz', cena: 'Ensalada' },
      '3': { comida: 'Pollo asado', cena: 'Sopa' },
      '4': { comida: 'Pizza', cena: 'Crema de verduras' },
      '5': { comida: 'Hamburguesa', cena: 'Tortilla de patata' },
      '6': { comida: 'Cocido', cena: 'Pescado' }
    }
  }
};
