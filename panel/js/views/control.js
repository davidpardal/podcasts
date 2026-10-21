// Casa (DEMO): resumen, escenas, habitaciones, clima, cámaras y música. El original usa Home
// Assistant; aquí todo es de ejemplo hasta conectar uno (ver Ajustes y README).
(function () {
  'use strict';
  var D = window.DATA;
  var V = { el: null, pending: {}, scene: null, camTimer: null, camAge: 4 };

  function dev(id) { return D.devices.filter(function (d) { return d.id === id; })[0]; }

  // Optimistic device update: flip immediately, confirm (or revert) shortly after.
  App.setDevice = function (id, patch, opts) {
    var d = dev(id), before = {};
    Object.keys(patch).forEach(function (k) { before[k] = d[k]; d[k] = patch[k]; });
    V.pending[id] = true;
    changed([id]);
    setTimeout(function () {
      delete V.pending[id];
      if (d.flaky && !(opts && opts.silent)) {
        Object.keys(before).forEach(function (k) { d[k] = before[k]; });
        App.toast('No responde <b>' + d.name + '</b> · puede estar desconectado', { tone: 'error', icon: 'bolt' });
        changed([id]);
      } else paintTile(id);
    }, d.flaky ? 2600 : 600);
  };

  // ------------------------------------------------------------ tiles
  function tile(d) {
    var pend = V.pending[d.id] ? '<i class="pend"></i>' : '';
    if (d.type === 'light') {
      return '<div class="tile tile--light' + (d.on ? ' is-on' : '') + '" data-dev="' + d.id + '" style="--lvl:' + (d.on ? d.level : 0) + '%">' +
        '<span class="tile-fill"></span>' + pend +
        '<span class="tile-icon">' + App.icon('bulb', 28) + '</span>' +
        '<span class="tile-name">' + d.name + '</span>' +
        '<span class="tile-state num">' + (d.on ? d.level + '%' : 'Apagada') + '</span></div>';
    }
    if (d.type === 'blind') {
      return '<div class="tile tile--blind' + (d.pos > 0 ? ' is-on' : '') + '" data-dev="' + d.id + '" style="--lvl:' + d.pos + '%">' +
        '<span class="tile-fill"></span>' + pend +
        '<span class="tile-icon">' + App.icon('blinds', 28) + '</span>' +
        '<span class="tile-name">' + d.name + '</span>' +
        '<span class="tile-state num">' + (d.pos === 0 ? 'Cerrada' : d.pos === 100 ? 'Abierta' : d.pos + '% abierta') + '</span></div>';
    }
    if (d.type === 'lock') {
      return '<div class="tile tile--lock' + (d.locked ? '' : ' is-warn') + '" data-dev="' + d.id + '">' + pend +
        '<span class="tile-icon">' + App.icon(d.locked ? 'lock' : 'unlock', 28) + '</span>' +
        '<span class="tile-name">' + d.name + '</span>' +
        '<span class="tile-state">' + (d.locked ? 'Cerrada<small>Mantén para abrir</small>' : 'Abierta<small>Toca para cerrar</small>') + '</span>' +
        '<svg class="hold-ring" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17"/></svg></div>';
    }
    if (d.type === 'garage') {
      var label = { closed: 'Cerrado', open: 'Abierto', opening: 'Abriendo…', closing: 'Cerrando…' }[d.state];
      return '<div class="tile tile--garage' + (d.state !== 'closed' ? ' is-warn' : '') + (/ing$/.test(d.state) ? ' is-moving' : '') + '" data-dev="' + d.id + '">' + pend +
        '<span class="tile-icon">' + App.icon('garage', 28) + '</span>' +
        '<span class="tile-name">' + d.name + '</span>' +
        '<span class="tile-state">' + label + '</span></div>';
    }
    return '';
  }

  function summary() {
    var lights = D.devices.filter(function (d) { return d.type === 'light' && d.on; });
    var unlocked = D.devices.filter(function (d) { return d.type === 'lock' && !d.locked; });
    var garage = dev('g-door');
    var secure = !unlocked.length && garage.state === 'closed';
    var c = D.climate, m = D.media;
    var gEs = { closed: 'cerrado', open: 'abierto', opening: 'abriendo', closing: 'cerrando' }[garage.state];
    var nRooms = unique(lights.map(function (l) { return l.room; })).length;
    return '<button class="sum' + (lights.length ? ' sum--warm' : '') + '" data-sum="lights"><span class="label">Luces' + App.demoTag(D.homeDemo) + '</span><b class="num">' + lights.length + '</b><small>encendidas en ' + nRooms + (nRooms === 1 ? ' estancia' : ' estancias') + '</small></button>' +
      '<button class="sum' + (secure ? '' : ' sum--warn') + '" data-sum="security"><span class="label">Seguridad</span><b class="num">' + (secure ? 'Cerrado' : unlocked.length + (garage.state !== 'closed' ? 1 : 0)) + '</b><small>' + (secure ? 'Puertas y garaje' : (garage.state !== 'closed' ? 'Garaje ' + gEs : '') + (unlocked.length ? (garage.state !== 'closed' ? ' · ' : '') + unlocked.map(function (u) { return u.name; }).join(', ') + ' abierta' : '')) + '</small></button>' +
      '<button class="sum" data-sum="climate"><span class="label">Clima</span><b class="num">' + App.fmt.dec(c.current) + '°</b><small>' + (c.mode === 'off' ? 'Apagado' : (c.set > c.current ? 'Calentando' : c.set < c.current ? 'Enfriando' : 'Mantiene') + ' a ' + App.fmt.dec(c.set) + '°') + '</small></button>' +
      '<button class="sum" data-sum="media"><span class="label">Música</span><b class="num">' + (m.playing ? 'Sonando' : 'En pausa') + '</b><small>Altavoz ' + m.room.toLowerCase() + '</small></button>';
  }
  function unique(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }

  function scenes() {
    return D.scenes.map(function (s) {
      return '<button class="scene' + (V.scene === s.id ? ' is-on' : '') + '" data-scene="' + s.id + '">' + App.icon(s.icon, 26) + '<span>' + s.name + '</span></button>';
    }).join('');
  }

  function roomCount(room) {
    var on = D.devices.filter(function (d) { return d.room === room && d.type === 'light' && d.on; }).length;
    return on ? on + (on === 1 ? ' encendida' : ' encendidas') : 'Todo apagado';
  }
  function rooms() {
    return D.rooms.map(function (r) {
      var list = D.devices.filter(function (d) { return d.room === r.id; });
      var on = list.filter(function (d) { return d.type === 'light' && d.on; }).length;
      return '<section class="room"><div class="room-h"><h3 class="serif">' + r.name + '</h3><span class="label" data-room-count="' + r.id + '">' + roomCount(r.id) + '</span></div>' +
        '<div class="tiles">' + list.map(tile).join('') + '</div></section>';
    }).join('');
  }

  function climate() {
    var c = D.climate;
    var verb = c.mode === 'off' ? 'Off' : c.set > c.current ? 'Heating' : c.set < c.current ? 'Cooling' : 'Holding';
    var verbEs = { Off: 'Apagado', Heating: 'Calentando', Cooling: 'Enfriando', Holding: 'Mantiene' }[verb];
    return '<div class="label label--light">Clima · Planta principal' + App.demoTag(D.homeDemo) + '</div>' +
      '<div class="th-main"><button class="th-btn" data-temp="-0.5" aria-label="Bajar">' + App.icon('minus', 36) + '</button>' +
      '<div class="th-set"><span class="num">' + App.fmt.dec(c.set.toFixed(1).replace('.0', '')) + '°</span><small>Objetivo</small></div>' +
      '<button class="th-btn" data-temp="0.5" aria-label="Subir">' + App.icon('plus', 36) + '</button></div>' +
      '<div class="th-now"><span><b class="num">' + App.fmt.dec(c.current) + '°</b> dentro</span><span class="th-verb th-verb--' + verb.toLowerCase() + '">' + verbEs + '</span><span><b class="num">' + c.humidity + '%</b> humedad</span></div>' +
      '<div class="seg seg--dark">' + [['heat', 'Calor'], ['cool', 'Frío'], ['auto', 'Auto'], ['off', 'Apagado']].map(function (m) {
        return '<button class="' + (c.mode === m[0] ? 'is-on' : '') + '" data-tmode="' + m[0] + '">' + m[1] + '</button>';
      }).join('') + '</div>';
  }

  function cams() {
    return '<div class="label">Cámaras · foto cada 20 s' + App.demoTag(D.homeDemo) + '</div><div class="cams">' + D.cameras.slice(0, 2).map(function (c) {
      return '<button class="cam" data-cam="' + c.id + '"><img src="' + App.img(c.seed, 400, 250) + '" alt=""><span class="cam-name">' + c.name + '</span><span class="cam-age">hace ' + V.camAge + ' s</span></button>';
    }).join('') + '</div>';
  }

  function media() {
    var m = D.media;
    return '<img class="np-art" src="' + App.img(m.seed, 160, 160) + '" alt="">' +
      '<div class="np-text"><span class="label">' + m.room + '</span><b>' + m.title + '</b><span>' + m.artist + '</span></div>' +
      '<button class="np-btn" data-play aria-label="Reproducir o pausar">' + App.icon(m.playing ? 'pause' : 'play', 30) + '</button>';
  }

  // Granular updates: an action repaints only what it touched (full paint() rebuilds ~270 nodes,
  // which costs ~350ms on the wall tablet).
  function paintTile(id) {
    var d = dev(id);
    [V.el && V.el.querySelector('.hc-rooms'), V.sheetBox].forEach(function (root) {
      var old = root && root.querySelector('[data-dev="' + id + '"]');
      if (!old) return;
      var tmp = document.createElement('div');
      tmp.innerHTML = tile(d);
      var nt = tmp.firstChild;
      old.parentNode.replaceChild(nt, old);
      bindTile(nt);
    });
    var c = V.el && V.el.querySelector('[data-room-count="' + d.room + '"]');
    if (c) c.textContent = roomCount(d.room);
  }
  function paintPart(sel, html) { if (V.el) V.el.querySelector(sel).innerHTML = html; }
  function changed(ids) {
    ids.forEach(paintTile);
    paintPart('.hc-sum', summary());
    App.emit('data');
  }

  function paint() {
    if (!V.el) return;
    var el = V.el;
    el.querySelector('.hc-sum').innerHTML = summary();
    el.querySelector('.hc-scenes').innerHTML = scenes();
    var rs = el.querySelector('.hc-rooms'), st = rs.scrollTop;
    rs.innerHTML = rooms();
    rs.scrollTop = st;
    bindTiles(rs);
    el.querySelector('.hc-climate').innerHTML = climate();
    el.querySelector('.hc-media').innerHTML = media();
  }

  // ------------------------------------------------------------ tile gestures
  // Lights + blinds: tap toggles, horizontal drag sets level (whole tile is the slider).
  function sliderTile(t, d) {
    var sx, startLvl, dragging = false, w;
    t.addEventListener('pointerdown', function (e) {
      sx = e.clientX; dragging = false; w = t.getBoundingClientRect().width;
      startLvl = d.type === 'light' ? (d.on ? d.level : 0) : d.pos;
      try { t.setPointerCapture(e.pointerId); } catch (err) {}
    });
    t.addEventListener('pointermove', function (e) {
      if (sx == null) return;
      var dx = e.clientX - sx;
      if (!dragging && Math.abs(dx) > 10) { dragging = true; t.classList.add('is-drag'); }
      if (!dragging) return;
      var lvl = Math.max(0, Math.min(100, Math.round(startLvl + dx / w * 100)));
      t.style.setProperty('--lvl', lvl + '%');
      t.classList.toggle('is-on', lvl > 0);
      t.querySelector('.tile-state').textContent = d.type === 'light' ? (lvl ? lvl + '%' : 'Apagada') : (lvl === 0 ? 'Cerrada' : lvl === 100 ? 'Abierta' : lvl + '% abierta');
      t._lvl = lvl;
    });
    t.addEventListener('pointerup', function () {
      if (sx == null) return;
      sx = null;
      t.classList.remove('is-drag');
      V.scene = null;
      if (dragging) {
        var lvl = t._lvl;
        if (d.type === 'light') App.setDevice(d.id, lvl ? { on: true, level: lvl } : { on: false });
        else App.setDevice(d.id, { pos: lvl });
      } else if (d.type === 'light') App.setDevice(d.id, { on: !d.on, level: d.level || 100 });
      else App.setDevice(d.id, { pos: d.pos > 0 ? 0 : 100 });
    });
    t.addEventListener('pointercancel', function () { sx = null; t.classList.remove('is-drag'); paintTile(d.id); });
  }

  function bindTiles(root) { App.$$('[data-dev]', root).forEach(bindTile); }
  function bindTile(t) {
    (function () {
      var d = dev(t.dataset.dev);
      if (d.type === 'light' || d.type === 'blind') sliderTile(t, d);
      if (d.type === 'lock') {
        App.hold(t, 1000, {
          enabled: function () { return d.locked; },
          done: function () { V.lastHold = Date.now(); App.setDevice(d.id, { locked: false }); App.toast('<b>' + d.name + '</b> abierta', { icon: 'unlock' }); },
          cancel: function () { App.toast('Mantén un segundo para abrir <b>' + d.name + '</b>', { icon: 'lock', ms: 2200 }); }
        });
        t.addEventListener('click', function () { if (!d.locked && Date.now() - (V.lastHold || 0) > 800) App.setDevice(d.id, { locked: true }); });
      }
      if (d.type === 'garage') t.addEventListener('click', function () { App.openGarageSheet(); });
    })();
  }

  // Deslizar para confirmar (garaje)
  App.openGarageSheet = function () {
    var g = dev('g-door'), opening = g.state === 'closed';
    var stEs = { closed: 'cerrado', open: 'abierto', opening: 'abriendo', closing: 'cerrando' };
    App.sheet('<div class="sheet-pad"><div class="label">Puerta del garaje · ahora ' + stEs[g.state] + App.demoTag(D.homeDemo) + '</div><h2 class="serif sheet-h">¿' + (opening ? 'Abrir' : 'Cerrar') + ' el garaje?</h2>' +
      '<p class="sheet-p">' + (opening ? 'Comprueba que la entrada está despejada.' : 'La puerta se para y vuelve atrás si algo se cruza.') + '</p>' +
      '<div class="slide-confirm"><span class="sc-label">Desliza para ' + (opening ? 'abrir' : 'cerrar') + ' →</span><span class="sc-fill"></span><span class="sc-knob">' + App.icon('garage', 30) + '</span></div></div>', {
      onMount: function (s, close) {
        var track = s.querySelector('.slide-confirm'), knob = s.querySelector('.sc-knob'), fill = s.querySelector('.sc-fill');
        var sx = null, max;
        knob.addEventListener('pointerdown', function (e) {
          sx = e.clientX; max = track.getBoundingClientRect().width - knob.getBoundingClientRect().width - 8;
          knob.setPointerCapture(e.pointerId);
        });
        knob.addEventListener('pointermove', function (e) {
          if (sx == null) return;
          var k = App.$('#stage').getBoundingClientRect().width / 1280;
          var x = Math.max(0, Math.min(max / k, (e.clientX - sx) / k));
          knob.style.transform = 'translateX(' + x + 'px)';
          fill.style.width = (x + 76) + 'px';
          knob._x = x; knob._max = max / k;
        });
        knob.addEventListener('pointerup', function () {
          if (sx == null) return;
          sx = null;

          if (knob._x >= knob._max - 6) {
            close();
            g.state = opening ? 'opening' : 'closing';
            V.scene = null;
            changed(['g-door']);
            setTimeout(function () { g.state = opening ? 'open' : 'closed'; changed(['g-door']); App.toast('Garaje ' + stEs[g.state], { icon: 'garage', ms: 2500 }); }, 4000);
          } else { knob.style.transform = ''; fill.style.width = ''; }
        });
      }
    });
  };

  App.cameraSheet = function (c) {
    App.sheet('<div class="cam-big"><img src="' + App.img(c.seed, 1200, 750) + '" alt=""><div class="cam-big-bar"><span class="tk-live"><i></i>' + c.name + '</span><span class="label label--light">Foto · hace ' + V.camAge + ' s' + (D.homeDemo ? ' · demo' : '') + '</span></div></div>', { cls: 'sheet--cam' });
  };

  function listSheet(kind) {
    var list = D.devices.filter(function (d) { return kind === 'lights' ? d.type === 'light' : (d.type === 'lock' || d.type === 'garage'); });
    if (kind === 'lights') list.sort(function (a, b) { return b.on - a.on; });
    App.sheet('<div class="sheet-pad"><div class="label">' + (kind === 'lights' ? 'Todas las luces de casa' : 'Puertas y garaje') + '</div>' +
      '<h2 class="serif sheet-h">' + (kind === 'lights' ? 'Luces' : 'Seguridad') + '</h2>' +
      '<div class="tiles tiles--sheet">' + list.map(tile).join('') + '</div>' +
      '<div class="sheet-actions">' + (kind === 'lights' ? '<button class="btn btn--solid" data-alloff>Apagar todo</button>' : '<button class="btn btn--solid" data-lockall>Cerrar todas las puertas</button>') + '</div></div>', {
      cls: 'sheet--wide',
      onClose: function () { V.sheetBox = null; },
      onMount: function (s, close) {
        var box = s.querySelector('.tiles--sheet');
        V.sheetBox = box;
        bindTiles(box);
        var off = s.querySelector('[data-alloff]'), lk = s.querySelector('[data-lockall]');
        if (off) off.onclick = function () {
          var prev = D.devices.filter(function (d) { return d.type === 'light' && d.on; });
          prev.forEach(function (d) { d.on = false; });
          close(); changed(prev.map(function (d) { return d.id; }));
          App.toast(prev.length + ' luces apagadas', { icon: 'bulb', undo: function () { prev.forEach(function (d) { d.on = true; }); changed(prev.map(function (d) { return d.id; })); } });
        };
        if (lk) lk.onclick = function () {
          var locks = D.devices.filter(function (d) { return d.type === 'lock'; });
          locks.forEach(function (d) { d.locked = true; });
          close(); changed(locks.map(function (d) { return d.id; }));
          App.toast('Todas las puertas cerradas', { icon: 'lock' });
        };
      }
    });
  }

  function applyScene(id) {
    var s = D.scenes.filter(function (x) { return x.id === id; })[0];
    var snapshot = D.devices.map(function (d) { return Object.assign({}, d); });
    var prevScene = V.scene;
    Object.keys(s.set).forEach(function (k) {
      var d = dev(k), v = s.set[k];
      if (d.type === 'blind') d.pos = v;
      else if (v === 0) d.on = false;
      else { d.on = true; d.level = v; }
    });
    if (id === 'away' || id === 'night') D.devices.forEach(function (d) { if (d.type === 'lock') d.locked = true; });
    V.scene = id;
    function diff() {
      return snapshot.filter(function (o) { var d = dev(o.id); return o.on !== d.on || o.level !== d.level || o.pos !== d.pos || o.locked !== d.locked; })
        .map(function (o) { return o.id; });
    }
    var ids = diff();
    paintPart('.hc-scenes', scenes());
    changed(ids);
    App.toast('Escena <b>' + s.name + '</b> activada', {
      icon: s.icon, undo: function () {
        snapshot.forEach(function (o) { Object.assign(dev(o.id), o); });
        V.scene = prevScene;
        paintPart('.hc-scenes', scenes());
        changed(ids);
      }
    });
  }

  function onClick(e) {
    var t;
    if ((t = e.target.closest('[data-scene]'))) return applyScene(t.dataset.scene);
    if ((t = e.target.closest('[data-sum]'))) {
      var k = t.dataset.sum;
      if (k === 'lights' || k === 'security') return listSheet(k);
      var target = V.el.querySelector(k === 'climate' ? '.hc-climate' : '.hc-media');
      target.classList.add('is-pulse'); setTimeout(function () { target.classList.remove('is-pulse'); }, 900);
      return;
    }
    if ((t = e.target.closest('[data-temp]'))) {
      D.climate.set = Math.max(15, Math.min(28, D.climate.set + +t.dataset.temp));
      if (D.climate.mode === 'off') D.climate.mode = 'heat';
      return climateChanged();
    }
    if ((t = e.target.closest('[data-tmode]'))) { D.climate.mode = t.dataset.tmode; return climateChanged(); }
    if ((t = e.target.closest('[data-cam]'))) return App.cameraSheet(D.cameras.filter(function (c) { return c.id === t.dataset.cam; })[0]);
    if ((t = e.target.closest('[data-play]'))) { D.media.playing = !D.media.playing; paintPart('.hc-media', media()); paintPart('.hc-sum', summary()); }
  }
  function climateChanged() { paintPart('.hc-climate', climate()); paintPart('.hc-sum', summary()); App.emit('data'); }

  function camTimer() {
    clearInterval(V.camTimer);
    V.camTimer = setInterval(function () {
      V.camAge = V.camAge >= 20 ? 1 : V.camAge + 1;
      App.$$('.cam-age', V.el).forEach(function (a) { a.textContent = 'hace ' + V.camAge + ' s'; });
    }, 1000);
  }

  App.register('control', {
    show: function (el) {
      if (!V.el) {
        V.el = el;
        el.innerHTML = '<div class="hc">' +
          '<div class="hc-left"><div class="hc-sum"></div><div class="hc-scenes"></div><div class="hc-rooms"></div></div>' +
          '<div class="hc-right"><div class="hc-climate"></div><div class="hc-cams"></div><div class="hc-media card"></div></div>' +
          '</div>';
        el.addEventListener('click', onClick);
      }
      el.querySelector('.hc-cams').innerHTML = cams();
      paint();
      camTimer();
    },
    resume: function () { camTimer(); },
    hide: function () { clearInterval(V.camTimer); }
  });
})();
