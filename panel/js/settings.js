// Ajustes: personas, custodia, jornada, calendarios, fuentes, importar/exportar. Todo se guarda
// solo en este aparato (localStorage). Se abre manteniendo pulsado el reloj → Ajustes.
(function () {
  'use strict';
  var D = window.DATA, P = window.PANEL, store = P.store, esc = App.esc;
  var WD = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo']];

  function cur() { return Object.assign({}, P.DEFAULTS, store.get('ajustes', {})); }

  function personRow(p, i) {
    return '<div class="set-row" data-person="' + i + '">' +
      '<input class="set-in" data-k="name" value="' + esc(p.name || '') + '" placeholder="Nombre">' +
      '<select class="set-in set-in--s" data-k="role"><option value="adult"' + (p.role !== 'kid' ? ' selected' : '') + '>Adulto</option><option value="kid"' + (p.role === 'kid' ? ' selected' : '') + '>Peque</option></select>' +
      '<input class="set-color" type="color" data-k="color" value="' + esc(p.color || P.PALETTE[i % P.PALETTE.length]) + '">' +
      '<input type="hidden" data-k="id" value="' + esc(p.id || '') + '">' +
      '<button class="btn btn--ghost set-x" data-del-person="' + i + '">Quitar</button></div>';
  }
  function calRow(c, i, people) {
    var who = c.who || [];
    return '<div class="set-cal" data-cal="' + i + '">' +
      '<div class="set-row"><input class="set-in set-in--s" data-k="name" value="' + esc(c.name || '') + '" placeholder="Nombre">' +
      '<input class="set-in" type="password" data-k="url" value="' + esc(c.url || '') + '" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" autocomplete="off" spellcheck="false">' +
      '<button class="btn btn--ghost set-x" data-del-cal="' + i + '">Quitar</button></div>' +
      '<div class="set-who">De quién: ' + people.map(function (p) {
        return '<label><input type="checkbox" data-who="' + esc(p.id) + '"' + (who.indexOf(p.id) > -1 ? ' checked' : '') + '> ' + esc(p.name) + '</label>';
      }).join('') + ' <small>(ninguno = toda la familia)</small></div></div>';
  }

  function html(s) {
    var people = s.people && s.people.length ? s.people : [];
    var shownPeople = people.length ? people : D.people;
    var w = Object.assign({ enabled: false, label: 'Trabajo', who: null, shifts: {} }, s.work || {});
    var cu = Object.assign({ enabled: false, anchor: '', cycleDays: 14, daysWithParent: 7 }, s.custody || {});
    var ha = s.homeAssistant || {};
    var st = App.liveStatus || {};
    return '<div class="sheet-pad set">' +
      '<div class="label">Solo se guarda en este aparato</div><h2 class="serif sheet-h">Ajustes</h2>' +
      '<div class="set-body">' +

      '<section><h3>Estado de los datos</h3><p class="set-note">Tiempo: <b>' + esc(st.weather || '–') + '</b> · Calendarios: <b>' + esc(st.calendars || '–') + '</b> · Agentes: <b>' + esc(st.agents || '–') + '</b>.<br>' +
      'Lo que sale con la etiqueta <span class="demo-tag">Demo</span> son datos de ejemplo.</p></section>' +

      '<section><h3>Lugar (tiempo de Open-Meteo)</h3><div class="set-row">' +
      '<input class="set-in" id="s-city" value="' + esc(s.city) + '" placeholder="Ciudad">' +
      '<input class="set-in set-in--s" id="s-lat" value="' + esc(s.lat) + '" placeholder="Latitud">' +
      '<input class="set-in set-in--s" id="s-lon" value="' + esc(s.lon) + '" placeholder="Longitud"></div></section>' +

      '<section><h3>Personas</h3>' + (people.length ? '' : '<p class="set-note">Ahora salen las personas de ejemplo. Añade las tuyas o usa Importar.</p>') +
      '<div id="s-people">' + people.map(personRow).join('') + '</div>' +
      '<button class="btn btn--ghost" data-add-person>+ Añadir persona</button></section>' +

      '<section><h3>Custodia por semanas alternas</h3><div class="set-row">' +
      '<label class="set-chk"><input type="checkbox" id="s-cu-on"' + (cu.enabled ? ' checked' : '') + '> Activada</label>' +
      '<input class="set-in set-in--s" id="s-other" value="' + esc(s.otherParent || '') + '" placeholder="Nombre del otro progenitor"></div>' +
      '<div class="set-row"><label class="set-lbl">Inicio de una semana contigo</label><input class="set-in set-in--s" type="datetime-local" id="s-cu-anchor" value="' + esc(cu.anchor || '') + '">' +
      '<label class="set-lbl">Ciclo (días)</label><input class="set-in set-in--xs" type="number" id="s-cu-cycle" value="' + esc(cu.cycleDays) + '">' +
      '<label class="set-lbl">Días contigo</label><input class="set-in set-in--xs" type="number" id="s-cu-days" value="' + esc(cu.daysWithParent) + '"></div></section>' +

      '<section><h3>Jornada de trabajo</h3><div class="set-row">' +
      '<label class="set-chk"><input type="checkbox" id="s-w-on"' + (w.enabled ? ' checked' : '') + '> Mostrarla en la agenda</label>' +
      '<input class="set-in set-in--s" id="s-w-label" value="' + esc(w.label || '') + '" placeholder="Nombre (p. ej. Trabajo)">' +
      '<select class="set-in set-in--s" id="s-w-who">' + shownPeople.filter(function (p) { return p.role !== 'kid'; }).map(function (p) {
        return '<option value="' + esc(p.id) + '"' + (w.who === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>';
      }).join('') + '</select></div>' +
      '<div class="set-shifts">' + WD.map(function (d) {
        var sh = w.shifts[d[0]] || w.shifts[String(d[0])] || ['', ''];
        return '<label>' + d[1] + '<input class="set-in set-in--xs" data-shift="' + d[0] + '" data-i="0" value="' + esc(sh[0] || '') + '" placeholder="--:--"><input class="set-in set-in--xs" data-shift="' + d[0] + '" data-i="1" value="' + esc(sh[1] || '') + '" placeholder="--:--"></label>';
      }).join('') + '</div></section>' +

      '<section><h3>Calendarios iCal</h3><div id="s-cals">' + (s.calendars || []).map(function (c, i) { return calRow(c, i, shownPeople); }).join('') + '</div>' +
      '<button class="btn btn--ghost" data-add-cal>+ Añadir calendario</button>' +
      '<div class="set-row"><input class="set-in" id="s-proxy" value="' + esc(s.proxy || '') + '" placeholder="Proxy CORS (opcional), termina en ?url=" spellcheck="false"></div>' +
      '<p class="set-note">Google Calendar → Configuración → tu calendario → «Dirección secreta en formato iCal». Google no deja leerla desde el navegador: hace falta un proxy (ver README).</p></section>' +

      '<section><h3>Fotos</h3><textarea class="set-ta" id="s-photos" rows="3" placeholder="Una URL de foto por línea (si lo dejas vacío, fotos de ejemplo)">' + esc((s.photos || []).join('\n')) + '</textarea></section>' +

      '<section><h3>Agentes IA</h3><input class="set-in" id="s-agents" value="' + esc(s.agentsUrl || '') + '" placeholder="URL de un JSON con el uso (mismo formato que la demo)"></section>' +

      '<section><h3>Casa (Home Assistant)</h3><div class="set-row"><input class="set-in" id="s-ha-url" value="' + esc(ha.url || '') + '" placeholder="https://homeassistant.local:8123">' +
      '<input class="set-in" type="password" id="s-ha-token" value="' + esc(ha.token || '') + '" placeholder="Token de larga duración"></div>' +
      '<p class="set-note">Todavía no conecta: la pantalla Casa, el timbre y las alertas son demo. Se guarda para cuando se implemente.</p></section>' +

      '<section><h3>Compra y tareas</h3><div class="set-row">' +
      '<input class="set-in set-in--s" id="s-store1" value="' + esc((s.stores || [])[0] || '') + '" placeholder="Tienda 1">' +
      '<input class="set-in set-in--s" id="s-store2" value="' + esc((s.stores || [])[1] || '') + '" placeholder="Tienda 2"></div><div class="set-row">' +
      '<button class="btn btn--ghost" data-own-shop>' + (D.groceriesDemo ? 'Empezar mi lista (vacía)' : 'Vaciar mi lista') + '</button>' +
      '<button class="btn btn--ghost" data-own-chores>' + (D.choresDemo ? 'Empezar con mis tareas' : 'Reiniciar mis tareas') + '</button></div></section>' +

      '<section><h3>Importar / exportar</h3><div class="set-row">' +
      '<label class="btn btn--ghost set-file">Importar archivo…<input type="file" id="s-file" accept=".json,application/json" hidden></label>' +
      '<button class="btn btn--ghost" data-export>Exportar (sin calendarios ni tokens)</button>' +
      '<button class="btn btn--ghost" data-wipe>Borrar todo</button></div>' +
      '<textarea class="set-ta" id="s-json" rows="3" placeholder="…o pega aquí el JSON y pulsa Importar texto"></textarea>' +
      '<button class="btn btn--ghost" data-import-text>Importar texto</button></section>' +

      '</div><div class="sheet-actions"><button class="btn btn--ghost" data-close>Cancelar</button><button class="btn btn--solid" data-save>Guardar y recargar</button></div></div>';
  }

  function collect(sheet) {
    function v(id) { var e = sheet.querySelector('#' + id); return e ? e.value.trim() : ''; }
    var people = App.$$('[data-person]', sheet).map(function (r, i) {
      var g = function (k) { return r.querySelector('[data-k="' + k + '"]').value.trim(); };
      return { id: g('id') || undefined, name: g('name'), role: g('role'), color: g('color') };
    }).filter(function (p) { return p.name; }).map(function (p, i) { var x = P.person(p, i); return { id: x.id, name: x.name, role: x.role, color: x.color }; });
    var shifts = {};
    WD.forEach(function (d) {
      var a = sheet.querySelector('[data-shift="' + d[0] + '"][data-i="0"]').value.trim(), b = sheet.querySelector('[data-shift="' + d[0] + '"][data-i="1"]').value.trim();
      if (/^\d{1,2}:\d{2}$/.test(a) && /^\d{1,2}:\d{2}$/.test(b)) shifts[d[0]] = [a, b];
    });
    var cals = App.$$('[data-cal]', sheet).map(function (r) {
      return { name: r.querySelector('[data-k="name"]').value.trim() || 'Calendario', url: r.querySelector('[data-k="url"]').value.trim(),
        who: App.$$('[data-who]', r).filter(function (c) { return c.checked; }).map(function (c) { return c.dataset.who; }) };
    }).filter(function (c) { return c.url; });
    var lat = parseFloat(v('s-lat').replace(',', '.')), lon = parseFloat(v('s-lon').replace(',', '.'));
    return {
      city: v('s-city') || P.DEFAULTS.city, lat: isNaN(lat) ? P.DEFAULTS.lat : lat, lon: isNaN(lon) ? P.DEFAULTS.lon : lon,
      people: people.length ? people : null,
      otherParent: v('s-other'),
      custody: { enabled: sheet.querySelector('#s-cu-on').checked, anchor: v('s-cu-anchor'), cycleDays: +v('s-cu-cycle') || 14, daysWithParent: +v('s-cu-days') || 7 },
      work: { enabled: sheet.querySelector('#s-w-on').checked, label: v('s-w-label'), who: v('s-w-who') || null, shifts: shifts },
      calendars: cals, proxy: v('s-proxy'),
      photos: v('s-photos').split(/\s*\n\s*/).filter(function (u) { return /^https?:\/\//.test(u); }),
      agentsUrl: v('s-agents'),
      homeAssistant: { url: v('s-ha-url'), token: v('s-ha-token') },
      stores: [v('s-store1') || 'Súper', v('s-store2') || 'Mercado']
    };
  }

  function doImport(txt) {
    try { P.importText(txt); } catch (e) { App.toast('No se pudo importar: ' + esc(e.message), { tone: 'error', icon: 'bolt' }); return; }
    store.del('cache.weather');
    App.toast('Ajustes importados · recargando', { icon: 'check', ms: 1500 });
    setTimeout(function () { location.reload(); }, 600);
  }

  App.openSettings = function () {
    store.set('tipSeen', true);
    var s = cur();
    App.sheet(html(s), {
      cls: 'sheet--wide sheet--settings',
      onMount: function (sheet, close) {
        sheet.addEventListener('click', function (e) {
          var b = e.target.closest('button');
          if (!b) return;
          if (b.hasAttribute('data-add-person')) {
            var box = sheet.querySelector('#s-people'), n = box.children.length;
            box.insertAdjacentHTML('beforeend', personRow({ name: '', role: 'kid' }, n));
          }
          if (b.dataset.delPerson != null) b.closest('[data-person]').remove();
          if (b.hasAttribute('data-add-cal')) {
            var cb = sheet.querySelector('#s-cals');
            cb.insertAdjacentHTML('beforeend', calRow({ name: '', url: '', who: [] }, cb.children.length, D.people));
          }
          if (b.dataset.delCal != null) b.closest('[data-cal]').remove();
          if (b.hasAttribute('data-save')) {
            P.save(collect(sheet));
            store.del('cache.weather');
            close();
            App.toast('Ajustes guardados · recargando', { icon: 'check', ms: 1500 });
            setTimeout(function () { location.reload(); }, 600);
          }
          if (b.hasAttribute('data-own-shop')) {
            D.groceries = []; D.groceriesDemo = false;
            store.set('compra', { list: [], gid: 1000 });
            App.emit('data'); App.toast('Lista de la compra vacía y lista para usar', { icon: 'cart' });
            b.textContent = 'Vaciar mi lista';
          }
          if (b.hasAttribute('data-own-chores')) {
            D.chores = D.freshChores(); D.choresDemo = false;
            var stars = {}; D.people.forEach(function (p) { if (p.role === 'kid') stars[p.id] = 0; });
            D.stars = stars; D.week = {};
            store.set('chores', { list: D.chores, stars: D.stars, week: D.week, day: new Date().toDateString() });
            App.emit('data'); App.toast('Tareas creadas para tus personas', { icon: 'tasks' });
            b.textContent = 'Reiniciar mis tareas';
          }
          if (b.hasAttribute('data-export')) {
            sheet.querySelector('#s-json').value = JSON.stringify(P.exportObj(false), null, 2);
            App.toast('Copia el texto de abajo', { icon: 'check', ms: 2000 });
          }
          if (b.hasAttribute('data-import-text')) doImport(sheet.querySelector('#s-json').value);
          if (b.hasAttribute('data-wipe')) {
            if (b.dataset.sure) { store.clear(); location.reload(); }
            else { b.dataset.sure = '1'; b.textContent = '¿Seguro? Pulsa otra vez'; }
          }
        });
        sheet.querySelector('#s-file').addEventListener('change', function (e) {
          var f = e.target.files && e.target.files[0];
          if (!f) return;
          var r = new FileReader();
          r.onload = function () { doImport(String(r.result)); };
          r.readAsText(f);
        });
      }
    });
  };
})();
