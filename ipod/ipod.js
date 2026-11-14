/* Thinkpod
   Marca del sitio: cambia SITE_TITLE. El <title>, las metas y manifest.json
   repiten el mismo nombre para que se vea antes de que arranque el script.
   Episodios: ../episodes.json. Audio: ../ep/<id>.mp3. No se copia el catálogo.
   Progreso compartido con la web de la raíz (pos:<id>, rate:<id>, done:<id>). */
(function () {
  const SITE_TITLE = "Thinkpod";
  const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
  const DONE_AT = 0.95;
  const WHEEL_STEP = 20;

  const DATA_URL = new URL("../episodes.json", document.baseURI);

  const device = document.getElementById("device");
  const lcd = document.getElementById("lcd");
  const lcdTitle = document.getElementById("lcd-title");
  const menu = document.getElementById("menu");
  const nowEl = document.getElementById("now");
  const npEmpty = document.getElementById("np-empty");
  const npMain = document.getElementById("np-main");
  const npArt = document.getElementById("np-art");
  const npTitle = document.getElementById("np-title");
  const npBy = document.getElementById("np-by");
  const npAlbum = document.getElementById("np-album");
  const npFill = document.getElementById("np-fill");
  const npKnob = document.getElementById("np-knob");
  const npEl = document.getElementById("np-el");
  const npRate = document.getElementById("np-rate");
  const npRem = document.getElementById("np-rem");
  const npStatus = document.getElementById("np-status");
  const track = document.getElementById("track");
  const wheel = document.getElementById("wheel");
  const press = document.getElementById("press");
  const center = document.getElementById("center");
  const battery = document.getElementById("battery");
  const batFill = document.getElementById("bat-fill");
  const batBolt = document.getElementById("bat-bolt");
  const audio = document.getElementById("audio");
  const live = document.getElementById("live");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let episodes = [];
  let stack = [{ kind: "root", selected: 0 }];
  let screen = "menu";
  let current = null;
  let queue = [];
  let queuePos = 0;
  let phase = "loading";
  let errorMsg = "No se pudieron cargar los episodios";
  let pendingSeek = 0;
  let restored = true;
  let scrubTo = null;
  let gesture = null;
  let seekTimer = 0;
  let wheelAccum = 0;
  let lastSave = 0;
  let lastAnnounce = "";
  let bufTimer = 0;
  let audioCtx = null;
  const covers = new Map();

  const PALETTES = [
    ["#16386a", "#4c8fe6"],
    ["#3c1848", "#c46ad4"],
    ["#0e3b34", "#1fa87a"],
    ["#6a2c16", "#e18448"],
    ["#242833", "#8d96aa"],
    ["#4a2e10", "#d4a15a"],
    ["#10283f", "#3d86b0"],
    ["#3a1230", "#d4527a"],
    ["#1c2f1a", "#6ea85a"],
    ["#3d2018", "#c46a4a"],
    ["#1a2744", "#6a7cae"],
    ["#2c2416", "#b59662"]
  ];

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function parseDur(s) {
    const parts = String(s || "").split(":").map((x) => parseInt(x, 10));
    if (!parts.length || parts.some((n) => !Number.isFinite(n))) return 0;
    return parts.reduce((t, n) => t * 60 + n, 0);
  }
  function fmt(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = String(sec % 60).padStart(2, "0");
    if (h) return h + ":" + String(m).padStart(2, "0") + ":" + s;
    return m + ":" + s;
  }
  function fmtRate(r) { return String(r).replace(".", ",") + "×"; }

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  function applyBrand() {
    document.title = SITE_TITLE;
    const named = {
      "apple-mobile-web-app-title": SITE_TITLE,
      "application-name": SITE_TITLE,
      "twitter:title": SITE_TITLE
    };
    Object.keys(named).forEach((key) => {
      const node = document.querySelector('meta[name="' + key + '"]');
      if (node) node.setAttribute("content", named[key]);
    });
    const og = document.querySelector('meta[property="og:title"]');
    if (og) og.setAttribute("content", SITE_TITLE);
    const site = document.querySelector('meta[property="og:site_name"]');
    if (site) site.setAttribute("content", SITE_TITLE);
    device.setAttribute("aria-label", SITE_TITLE);
  }

  function isDone(id) { return !!store.get("done:" + id); }
  function setDone(id, on) {
    if (on) {
      if (!isDone(id)) store.set("done:" + id, String(Date.now()));
      return;
    }
    store.del("done:" + id);
    const ep = episodes.find((e) => e.id === id);
    const d = ep ? ep.durationSec : 0;
    const p = parseFloat(store.get("pos:" + id)) || 0;
    if (d && p / d >= DONE_AT) {
      store.set("pos:" + id, "0");
      if (current && current.id === id) {
        const dur = durationOf() || d;
        if (dur && audio.currentTime / dur >= DONE_AT) audio.currentTime = 0;
      }
    }
  }
  function savedPos(ep) {
    const p = parseFloat(store.get("pos:" + ep.id));
    if (!Number.isFinite(p) || p <= 1) return 0;
    if (ep.durationSec && p / ep.durationSec >= DONE_AT) return 0;
    return p;
  }
  function rateFor(id) {
    const specific = parseFloat(store.get("rate:" + id));
    if (specific > 0) return specific;
    const pref = parseFloat(store.get("ipod:rate"));
    if (pref > 0) return pref;
    return 1;
  }
  function currentRate() {
    if (current) return rateFor(current.id);
    const pref = parseFloat(store.get("ipod:rate"));
    return pref > 0 ? pref : 1;
  }
  function applyRateValue(r) {
    audio.defaultPlaybackRate = r;
    audio.playbackRate = r;
    audio.preservesPitch = true;
    try { audio.webkitPreservesPitch = true; } catch (e) {}
  }
  function setRate(r) {
    store.set("ipod:rate", String(r));
    if (current) store.set("rate:" + current.id, String(r));
    applyRateValue(r);
    updateRateLabel();
  }
  function migrate() {
    episodes.forEach((ep) => {
      const p = parseFloat(store.get("pos:" + ep.id)) || 0;
      if (ep.durationSec && p / ep.durationSec >= DONE_AT && !isDone(ep.id)) {
        store.set("done:" + ep.id, String(Date.now()));
      }
    });
  }

  function authorList() {
    const map = new Map();
    episodes.forEach((ep) => {
      if (!map.has(ep.author)) map.set(ep.author, []);
      map.get(ep.author).push(ep);
    });
    return [...map.entries()]
      .map(([name, eps]) => ({ name, eps }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }
  function filterEps(frame) {
    if (frame.filter === "todo") return episodes.filter((e) => !isDone(e.id));
    if (frame.filter === "done") return episodes.filter((e) => isDone(e.id));
    if (frame.filter === "author") return episodes.filter((e) => e.author === frame.author);
    return episodes.slice();
  }
  function menuItem(label, go, count, extra) {
    const item = { t: "menu", label, go };
    if (count != null) item.count = count;
    if (extra) item.extra = extra;
    return item;
  }
  function viewOf(frame) {
    if (frame.kind === "root") {
      return {
        title: SITE_TITLE,
        items: [
          menuItem("Podcasts", { kind: "eps", filter: "all" }, episodes.length),
          menuItem("Autores", { kind: "authors" }, authorList().length),
          menuItem("Sin escuchar", { kind: "eps", filter: "todo" }, episodes.filter((e) => !isDone(e.id)).length),
          menuItem("Escuchados", { kind: "eps", filter: "done" }, episodes.filter((e) => isDone(e.id)).length),
          menuItem("Ahora suena", { kind: "now" }),
          menuItem("Ajustes", { kind: "settings" })
        ]
      };
    }
    if (frame.kind === "authors") {
      const list = authorList();
      return {
        title: "Autores",
        items: list.length
          ? list.map((a) => menuItem(a.name, { kind: "eps", filter: "author", author: a.name }, a.eps.length))
          : [{ t: "empty", label: "No hay autores" }]
      };
    }
    if (frame.kind === "eps") {
      const list = filterEps(frame);
      const title = frame.filter === "all" ? "Podcasts"
        : frame.filter === "todo" ? "Sin escuchar"
        : frame.filter === "done" ? "Escuchados"
        : (frame.author || "Podcasts");
      if (!list.length) {
        const label = frame.filter === "done" ? "Todavía no has terminado ninguno" : "No hay episodios";
        return { title, items: [{ t: "empty", label }] };
      }
      return { title, items: list.map((ep) => ({ t: "ep", ep, label: ep.title })) };
    }
    if (frame.kind === "settings") {
      const items = [menuItem("Velocidad", { kind: "rates" }, null, fmtRate(currentRate()))];
      if (current) {
        items.push({
          t: "mark",
          gap: true,
          label: isDone(current.id) ? "Marcar como pendiente" : "Marcar como escuchado"
        });
      }
      return { title: "Ajustes", items };
    }
    if (frame.kind === "rates") {
      const cur = currentRate();
      return {
        title: "Velocidad",
        items: RATES.map((r) => ({
          t: "rate",
          rate: r,
          label: fmtRate(r),
          on: Math.abs(r - cur) < 0.001
        }))
      };
    }
    return { title: SITE_TITLE, items: [] };
  }

  function frame() { return stack[stack.length - 1]; }
  function currentItem() {
    if (screen !== "menu" || phase !== "ready") return null;
    const view = viewOf(frame());
    return view.items[frame().selected] || null;
  }
  function episodesInCurrentMenu() {
    const f = frame();
    if (f.kind === "eps") return filterEps(f);
    return episodes.slice();
  }

  function announce(text) {
    if (!text || text === lastAnnounce) return;
    lastAnnounce = text;
    live.textContent = text;
  }
  function setHeader(text) { lcdTitle.textContent = text; }

  function speakerNode() {
    const wrap = document.createElement("span");
    wrap.innerHTML = '<svg class="spk" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M1.8 6h2.2L8 2.8v10.4L4 10H1.8z"/><path class="wave" d="M10 6.2a2.8 2.8 0 010 3.6M11.7 4.7a5 5 0 010 6.6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
    return wrap.firstElementChild;
  }
  function progressRatio(ep) {
    const saved = parseFloat(store.get("pos:" + ep.id)) || 0;
    let t = saved;
    let dur = ep.durationSec || 0;
    if (current && current.id === ep.id) {
      t = shownTime();
      const liveDur = durationOf();
      if (liveDur) dur = liveDur;
    }
    if (!dur || t <= 0) return 0;
    return t / dur;
  }

  function startMarquee(title) {
    title.classList.remove("slide");
    if (reduceMotion) return;
    const extra = title.scrollWidth - title.clientWidth;
    if (extra > 6) {
      title.style.setProperty("--shift", -(extra + 18) + "px");
      title.classList.add("slide");
    }
  }
  function ensureVisible(row) {
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < menu.scrollTop) menu.scrollTop = top;
    else if (bottom > menu.scrollTop + menu.clientHeight) menu.scrollTop = bottom - menu.clientHeight;
  }
  function updateSelection() {
    if (screen !== "menu") return;
    const rows = [...menu.querySelectorAll(".row")];
    const sel = frame().selected;
    rows.forEach((row, i) => {
      const on = i === sel;
      row.classList.toggle("on", on);
      row.setAttribute("aria-selected", on ? "true" : "false");
      const title = row.querySelector(".t");
      if (!title) return;
      title.classList.remove("slide");
      if (on) {
        announce(title.textContent);
        requestAnimationFrame(() => {
          if (!row.isConnected) return;
          ensureVisible(row);
          startMarquee(title);
        });
      }
    });
    menu.dataset.selected = String(sel);
  }

  function renderMenu() {
    const f = frame();
    const view = viewOf(f);
    if (f.selected >= view.items.length) f.selected = Math.max(0, view.items.length - 1);
    if (f.selected < 0) f.selected = 0;
    setHeader(view.title);
    menu.hidden = false;
    nowEl.hidden = true;
    lcd.dataset.view = "menu";
    lcd.dataset.menu = f.kind;
    menu.replaceChildren();
    if (!view.items.length) {
      menu.appendChild(el("p", "msg", "No hay nada aquí"));
      return;
    }
    view.items.forEach((item, i) => {
      const row = el("div", "row" + (item.t === "ep" ? " ep" : " folder") + (item.gap ? " gap" : ""));
      row.setAttribute("role", "option");
      row.tabIndex = -1;
      row.dataset.i = String(i);
      const main = el("div", "main");
      const wrap = el("div", "twrap");
      wrap.appendChild(el("div", "t", item.label || ""));
      main.appendChild(wrap);
      if (item.t === "ep") {
        main.appendChild(el("div", "m", item.ep.author + " · " + (item.ep.duration || "")));
        const ratio = progressRatio(item.ep);
        if (!isDone(item.ep.id) && ratio > 0.01 && ratio < DONE_AT) {
          const bar = el("i", "pbar");
          bar.style.width = (Math.min(1, ratio) * 100) + "%";
          row.appendChild(bar);
        }
        if (current && current.id === item.ep.id) row.classList.add("current");
      }
      row.appendChild(main);
      const extra = el("div", "extra");
      if (item.count != null) extra.appendChild(el("span", "count", String(item.count)));
      if (item.extra) extra.appendChild(el("span", "count", item.extra));
      if (item.t === "menu") extra.appendChild(el("span", "chev", "›"));
      if (item.t === "rate" && item.on) extra.appendChild(el("span", "tick", "✓"));
      if (item.t === "ep" && current && current.id === item.ep.id) extra.appendChild(speakerNode());
      if (item.t === "ep" && isDone(item.ep.id)) extra.appendChild(el("span", "tick", "✓"));
      if (extra.childNodes.length) row.appendChild(extra);
      row.addEventListener("click", () => {
        f.selected = i;
        if (!item || item.t === "empty") {
          updateSelection();
          return;
        }
        activate(item);
      });
      menu.appendChild(row);
    });
    updateSelection();
  }

  function renderNow() {
    setHeader(SITE_TITLE);
    menu.hidden = true;
    nowEl.hidden = false;
    lcd.dataset.view = "now";
    if (!current) {
      npEmpty.hidden = false;
      npMain.hidden = true;
      announce("Nada en reproducción");
      return;
    }
    npEmpty.hidden = true;
    npMain.hidden = false;
    npTitle.textContent = current.title;
    npBy.textContent = current.author;
    npAlbum.textContent = SITE_TITLE;
    const art = drawCover(current);
    if (art) npArt.src = art;
    npArt.alt = "Carátula de " + current.author;
    if (npStatus.textContent === "No se puede reproducir") npStatus.textContent = "";
    updateRateLabel();
    updateProgress();
    announce(current.title + ", " + current.author);
  }

  function render() {
    if (phase !== "ready") {
      setHeader(SITE_TITLE);
      menu.hidden = false;
      nowEl.hidden = true;
      lcd.dataset.view = "menu";
      menu.replaceChildren(el("p", "msg", phase === "error" ? errorMsg : "Cargando…"));
      return;
    }
    if (screen === "now") renderNow();
    else renderMenu();
    renderPlayState();
  }

  function activate(item) {
    if (!item || item.t === "empty") return;
    if (item.t === "menu") {
      if (item.go.kind === "now") {
        screen = "now";
        render();
        return;
      }
      stack.push(Object.assign({ selected: 0 }, item.go));
      render();
      return;
    }
    if (item.t === "ep") {
      playEpisode(item.ep, episodesInCurrentMenu());
      return;
    }
    if (item.t === "rate") {
      setRate(item.rate);
      render();
      return;
    }
    if (item.t === "mark" && current) {
      setDone(current.id, !isDone(current.id));
      render();
    }
  }
  function onSelect() {
    flashCenter();
    clickTick();
    if (phase !== "ready" || screen === "now") return;
    activate(currentItem());
  }
  function back() {
    if (screen === "now") {
      screen = "menu";
      render();
      clickTick();
      return;
    }
    if (stack.length > 1) {
      stack.pop();
      render();
      clickTick();
    }
  }
  function goHome() {
    if (screen === "menu" && stack.length === 1) return;
    screen = "menu";
    stack = [{ kind: "root", selected: 0 }];
    render();
    clickTick();
  }
  function moveSelection(dir) {
    if (screen !== "menu" || phase !== "ready") return;
    const rows = menu.querySelectorAll(".row").length;
    if (!rows) return;
    const f = frame();
    const next = f.selected + dir;
    if (next < 0 || next >= rows) return;
    f.selected = next;
    updateSelection();
    clickTick();
  }

  function durationOf() {
    const d = audio.duration;
    if (Number.isFinite(d) && d > 0) return d;
    return current && current.durationSec ? current.durationSec : 0;
  }
  function shownTime() {
    if (scrubTo != null) return scrubTo;
    return audio.currentTime || 0;
  }
  function updateProgress() {
    const d = durationOf();
    const t = shownTime();
    const ratio = d ? clamp(t / d, 0, 1) : 0;
    npFill.style.width = (ratio * 100) + "%";
    npKnob.style.left = (ratio * 100) + "%";
    npEl.textContent = fmt(t);
    npRem.textContent = d ? "-" + fmt(Math.max(0, d - t)) : "--:--";
    track.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
    track.setAttribute("aria-valuetext", fmt(t) + (d ? " de " + fmt(d) : ""));
  }
  function updateRateLabel() {
    const r = current ? rateFor(current.id) : currentRate();
    npRate.textContent = Math.abs(r - 1) < 0.001 ? "" : fmtRate(r);
  }
  function updateLiveRow() {
    if (screen !== "menu" || !current) return;
    const row = menu.querySelector(".row.current");
    if (!row) return;
    let bar = row.querySelector(".pbar");
    const ratio = progressRatio(current);
    if (isDone(current.id) || ratio <= 0.01 || ratio >= DONE_AT) {
      if (bar) bar.remove();
      return;
    }
    if (!bar) {
      bar = el("i", "pbar");
      row.appendChild(bar);
    }
    bar.style.width = (Math.min(1, ratio) * 100) + "%";
  }
  function savePosNow() {
    if (!current || !restored) return;
    const v = audio.currentTime;
    if (!Number.isFinite(v)) return;
    store.set("pos:" + current.id, String(Math.max(0, v)));
  }
  function maybeDone() {
    if (!current || isDone(current.id)) return;
    const d = durationOf();
    if (!d || d < 1) return;
    if (shownTime() / d >= DONE_AT) setDone(current.id, true);
  }
  function renderPlayState() {
    const on = !!(current && audio.src && !audio.paused && !audio.ended);
    device.classList.toggle("is-playing", on);
    nowEl.classList.toggle("playing", on);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = on ? "playing" : "paused";
    }
  }
  function play() {
    const p = audio.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        if (npStatus.textContent === "Pulsa reproducir") npStatus.textContent = "";
      }).catch(() => {
        npStatus.textContent = "Pulsa reproducir";
      });
    }
    return p;
  }
  function audioURL(id) {
    return new URL("../ep/" + encodeURIComponent(id) + ".mp3", document.baseURI).href;
  }
  function playEpisode(ep, list) {
    queue = list && list.length ? list.slice() : [ep];
    const idx = queue.findIndex((x) => x.id === ep.id);
    queuePos = idx >= 0 ? idx : 0;
    const same = !!(current && current.id === ep.id && audio.getAttribute("src"));
    current = ep;
    screen = "now";
    if (!same) {
      pendingSeek = savedPos(ep);
      restored = false;
      npStatus.textContent = "";
      applyRateValue(rateFor(ep.id));
      audio.src = audioURL(ep.id);
    }
    // Arranca dentro del gesto (antes del render) para que iPhone no bloquee el audio.
    play();
    render();
    setMediaSession(ep);
  }
  function togglePlay() {
    if (phase !== "ready" || !episodes.length) return;
    clickTick();
    if (!current || !audio.getAttribute("src")) {
      const item = currentItem();
      if (screen === "menu" && item && item.t === "ep") {
        playEpisode(item.ep, episodesInCurrentMenu());
        return;
      }
      if (screen === "menu" && item && item.t === "menu" && item.go && item.go.kind === "eps") {
        const list = filterEps(item.go);
        if (list[0]) playEpisode(list[0], list);
        return;
      }
      playEpisode(episodes[0], episodes.slice());
      return;
    }
    if (audio.paused || audio.ended) play();
    else audio.pause();
  }
  function prevTrack() {
    if (phase !== "ready" || !episodes.length) return;
    clickTick();
    if (!current || !audio.getAttribute("src")) {
      playEpisode(episodes[0], episodes.slice());
      return;
    }
    if ((audio.currentTime || 0) > 3) {
      audio.currentTime = 0;
      scrubTo = null;
      updateProgress();
      savePosNow();
      return;
    }
    if (queuePos > 0) playEpisode(queue[queuePos - 1], queue);
    else {
      audio.currentTime = 0;
      updateProgress();
      savePosNow();
    }
  }
  function nextTrack() {
    if (phase !== "ready" || !episodes.length) return;
    clickTick();
    if (!current || !audio.getAttribute("src")) {
      playEpisode(episodes[0], episodes.slice());
      return;
    }
    if (queue.length && queuePos < queue.length - 1) playEpisode(queue[queuePos + 1], queue);
  }
  function seekBy(sec) {
    const d = durationOf();
    if (!d || !current) return;
    audio.currentTime = clamp((audio.currentTime || 0) + sec, 0, Math.max(0, d - 0.2));
    scrubTo = null;
    updateProgress();
    savePosNow();
  }
  function stepBy(dir) {
    if (phase !== "ready") return;
    if (screen === "now") {
      if (current) seekBy(dir * 5);
      return;
    }
    moveSelection(dir);
  }

  function scrubByDegrees(delta, dt) {
    const d = durationOf();
    if (!d || !current) return;
    const vel = Math.abs(delta) / Math.max(dt, 16);
    const per = vel > 0.45 ? 0.85 : vel > 0.16 ? 0.22 : 0.04;
    if (scrubTo == null) scrubTo = audio.currentTime || 0;
    scrubTo = clamp(scrubTo + delta * per, 0, Math.max(0, d - 0.2));
    updateProgress();
  }
  function endScrub() {
    if (scrubTo == null) return;
    const t = scrubTo;
    scrubTo = null;
    const d = audio.duration;
    if (Number.isFinite(d) && d > 0) audio.currentTime = clamp(t, 0, Math.max(0, d - 0.05));
    updateProgress();
    savePosNow();
  }
  function startSeek(dir) {
    stopSeek();
    const started = performance.now();
    const tick = () => {
      const d = durationOf();
      if (!d || !current) return;
      const held = (performance.now() - started) / 1000;
      const step = held > 2 ? 12 : held > 0.8 ? 5 : 2;
      audio.currentTime = clamp(audio.currentTime + dir * step, 0, Math.max(0, d - 0.2));
      scrubTo = null;
      updateProgress();
    };
    tick();
    seekTimer = window.setInterval(tick, 160);
  }
  function stopSeek() {
    if (seekTimer) window.clearInterval(seekTimer);
    seekTimer = 0;
  }

  function drawCover(ep) {
    if (covers.has(ep.id)) return covers.get(ep.id);
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const g = c.getContext("2d");
      const pal = PALETTES[hash(ep.author) % PALETTES.length];
      const grd = g.createLinearGradient(0, 0, 256, 256);
      grd.addColorStop(0, pal[0]);
      grd.addColorStop(1, pal[1]);
      g.fillStyle = grd;
      g.fillRect(0, 0, 256, 256);
      g.fillStyle = "rgba(255,255,255,.12)";
      g.beginPath();
      g.arc(188, 74, 86, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(255,255,255,.35)";
      g.lineWidth = 6;
      g.beginPath();
      g.arc(128, 112, 52, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = "rgba(255,255,255,.96)";
      g.font = "700 92px Inter, Helvetica, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText((ep.author || "?").trim().charAt(0).toUpperCase() || "?", 128, 108);
      g.font = "600 18px Inter, Helvetica, sans-serif";
      g.fillStyle = "rgba(255,255,255,.9)";
      const name = ep.author.length > 22 ? ep.author.slice(0, 21) + "…" : ep.author;
      g.fillText(name.toUpperCase(), 128, 226);
      const url = c.toDataURL("image/png");
      covers.set(ep.id, url);
      return url;
    } catch (e) {
      covers.set(ep.id, "");
      return "";
    }
  }
  function setMediaSession(ep) {
    if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    const art = drawCover(ep);
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: ep.title,
        artist: ep.author,
        album: SITE_TITLE,
        artwork: art ? [{ src: art, sizes: "256x256", type: "image/png" }] : []
      });
    } catch (e) {}
    const safe = (name, fn) => { try { navigator.mediaSession.setActionHandler(name, fn); } catch (e) {} };
    safe("play", () => play());
    safe("pause", () => audio.pause());
    safe("previoustrack", () => prevTrack());
    safe("nexttrack", () => nextTrack());
    safe("seekbackward", (d) => seekBy(-((d && d.seekOffset) || 15)));
    safe("seekforward", (d) => seekBy((d && d.seekOffset) || 30));
    safe("seekto", (d) => {
      if (d && typeof d.seekTime === "number") {
        audio.currentTime = d.seekTime;
        scrubTo = null;
        updateProgress();
        savePosNow();
      }
    });
    updateSessionPos();
  }
  function updateSessionPos() {
    if (!("mediaSession" in navigator) || !current || !navigator.mediaSession.setPositionState) return;
    const d = durationOf();
    if (!d) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: d,
        playbackRate: audio.playbackRate || 1,
        position: clamp(shownTime(), 0, d)
      });
    } catch (e) {}
  }

  function clickTick() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const t = audioCtx.currentTime;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(1700, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.02, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start(t);
      o.stop(t + 0.032);
    } catch (e) {}
  }
  function flashCenter() {
    center.classList.add("down");
    window.setTimeout(() => center.classList.remove("down"), 120);
  }

  function angleFromEvent(e) {
    const r = wheel.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let deg = Math.atan2(e.clientX - cx, cy - e.clientY) * 180 / Math.PI;
    if (deg < 0) deg += 360;
    return deg;
  }
  function sectorOf(deg) {
    if (deg >= 315 || deg < 45) return "menu";
    if (deg < 135) return "next";
    if (deg < 225) return "play";
    return "prev";
  }
  function showPress(sector) {
    press.className = "press " + sector;
    press.hidden = false;
    wheel.classList.add("pressing-" + sector);
  }
  function hidePress() {
    press.hidden = true;
    press.className = "press";
    wheel.classList.remove("pressing-menu", "pressing-prev", "pressing-next", "pressing-play");
  }
  function finishGesture(e, cancel) {
    if (!gesture || (e && e.pointerId !== gesture.id)) return;
    window.clearTimeout(gesture.holdTimer);
    stopSeek();
    const g = gesture;
    gesture = null;
    wheel.classList.remove("drag");
    hidePress();
    if (cancel || g.moved || g.holdUsed) {
      if (!cancel && g.moved && screen === "now") endScrub();
      else scrubTo = null;
      if (g.holdUsed) savePosNow();
      return;
    }
    if (g.sector === "menu") back();
    else if (g.sector === "prev") prevTrack();
    else if (g.sector === "next") nextTrack();
    else if (g.sector === "play") togglePlay();
  }

  function bindWheel() {
    wheel.addEventListener("pointerdown", (e) => {
      if (e.target.closest && e.target.closest(".center")) return;
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      device.focus({ preventScroll: true });
      const ang = angleFromEvent(e);
      gesture = {
        id: e.pointerId,
        lastAng: ang,
        accum: 0,
        rot: 0,
        moved: false,
        holdUsed: false,
        sector: sectorOf(ang),
        lastT: performance.now(),
        x: e.clientX,
        y: e.clientY
      };
      showPress(gesture.sector);
      try { wheel.setPointerCapture(e.pointerId); } catch (err) {}
      gesture.holdTimer = window.setTimeout(() => {
        if (!gesture || gesture.moved) return;
        if (gesture.sector === "menu") {
          gesture.holdUsed = true;
          goHome();
          return;
        }
        if (gesture.sector === "prev" || gesture.sector === "next") {
          gesture.holdUsed = true;
          startSeek(gesture.sector === "next" ? 1 : -1);
        }
      }, 420);
    });
    wheel.addEventListener("pointermove", (e) => {
      if (!gesture || e.pointerId !== gesture.id) return;
      const ang = angleFromEvent(e);
      let delta = ang - gesture.lastAng;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      gesture.lastAng = ang;
      wheel.style.setProperty("--ang", ang + "deg");
      // Ignore a flip across the center. A fast drag still jumps by well under this.
      if (Math.abs(delta) > 140) return;
      gesture.rot += delta;
      const dx = e.clientX - gesture.x;
      const dy = e.clientY - gesture.y;
      if (!gesture.moved && (dx * dx + dy * dy > 64 || Math.abs(gesture.rot) > 12)) {
        gesture.moved = true;
        if (!gesture.holdUsed) window.clearTimeout(gesture.holdTimer);
        wheel.classList.add("drag");
      }
      if (gesture.holdUsed || !gesture.moved || phase !== "ready") return;
      if (screen === "now") {
        const nowMs = performance.now();
        const dt = nowMs - gesture.lastT;
        gesture.lastT = nowMs;
        scrubByDegrees(delta, dt);
        return;
      }
      gesture.accum += delta;
      while (gesture.accum >= WHEEL_STEP) {
        gesture.accum -= WHEEL_STEP;
        moveSelection(1);
      }
      while (gesture.accum <= -WHEEL_STEP) {
        gesture.accum += WHEEL_STEP;
        moveSelection(-1);
      }
    });
    wheel.addEventListener("pointerup", (e) => finishGesture(e, false));
    wheel.addEventListener("pointercancel", (e) => finishGesture(e, true));
    wheel.addEventListener("click", (e) => {
      if (e.target.closest && e.target.closest(".center")) return;
      e.preventDefault();
    });
  }

  function bindCenter() {
    center.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      center.classList.add("down");
    });
    const up = () => center.classList.remove("down");
    center.addEventListener("pointerup", up);
    center.addEventListener("pointercancel", up);
    center.addEventListener("click", (e) => {
      e.stopPropagation();
      onSelect();
    });
    center.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") e.preventDefault();
    });
  }

  function bindTrack() {
    const at = (e) => {
      const rect = track.getBoundingClientRect();
      const d = durationOf();
      if (!rect.width || !d || !current) return;
      const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      audio.currentTime = ratio * Math.max(0, d - 0.15);
      scrubTo = null;
      updateProgress();
      savePosNow();
    };
    track.addEventListener("pointerdown", (e) => {
      if (e.button != null && e.button !== 0) return;
      track.setPointerCapture(e.pointerId);
      track.classList.add("drag");
      at(e);
    });
    track.addEventListener("pointermove", (e) => {
      if (!track.classList.contains("drag")) return;
      at(e);
    });
    const end = () => track.classList.remove("drag");
    track.addEventListener("pointerup", end);
    track.addEventListener("pointercancel", end);
  }

  function bindKeys() {
    document.addEventListener("keydown", (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (document.activeElement === document.body) device.focus({ preventScroll: true });
      const key = e.key;
      if (key === "ArrowDown" || key === "ArrowUp" || key === "ArrowRight" || key === "ArrowLeft") {
        e.preventDefault();
        const dir = key === "ArrowDown" || key === "ArrowRight" ? 1 : -1;
        stepBy(dir);
        return;
      }
      if ((key === " " || key === "Enter" || key === "Escape" || key === "Backspace") && e.repeat) {
        e.preventDefault();
        return;
      }
      if (key === "Enter") {
        e.preventDefault();
        onSelect();
        return;
      }
      if (key === "Escape" || key === "Backspace") {
        e.preventDefault();
        back();
        return;
      }
      if (key === " " || key === "MediaPlayPause") {
        e.preventDefault();
        togglePlay();
        return;
      }
      if (key === "MediaTrackNext") { e.preventDefault(); nextTrack(); }
      if (key === "MediaTrackPrevious") { e.preventDefault(); prevTrack(); }
    });
    window.addEventListener("wheel", (e) => {
      if (phase !== "ready") return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? 80 : 1;
      const raw = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      wheelAccum += raw * unit;
      const thresh = 36;
      while (wheelAccum >= thresh) { wheelAccum -= thresh; stepBy(1); }
      while (wheelAccum <= -thresh) { wheelAccum += thresh; stepBy(-1); }
    }, { passive: false });
  }

  function bindAudio() {
    audio.addEventListener("loadedmetadata", () => {
      const want = pendingSeek;
      pendingSeek = 0;
      if (want > 1 && Number.isFinite(audio.duration) && want < audio.duration - 2) {
        audio.currentTime = want;
      }
      if (current) applyRateValue(rateFor(current.id));
      restored = true;
      updateProgress();
      updateSessionPos();
    });
    audio.addEventListener("play", () => {
      if (current) applyRateValue(rateFor(current.id));
      renderPlayState();
      updateSessionPos();
    });
    audio.addEventListener("pause", () => {
      savePosNow();
      renderPlayState();
      updateSessionPos();
    });
    audio.addEventListener("timeupdate", () => {
      updateProgress();
      updateLiveRow();
      const nowMs = performance.now();
      if (restored && nowMs - lastSave > 1000) {
        savePosNow();
        updateSessionPos();
        lastSave = nowMs;
      }
      maybeDone();
    });
    audio.addEventListener("ended", () => {
      if (current) {
        store.set("pos:" + current.id, "0");
        setDone(current.id, true);
      }
      scrubTo = null;
      if (queue.length && queuePos < queue.length - 1) playEpisode(queue[queuePos + 1], queue);
      else {
        updateProgress();
        renderPlayState();
      }
    });
    audio.addEventListener("error", () => {
      restored = true;
      npStatus.textContent = "No se puede reproducir";
      renderPlayState();
    });
    audio.addEventListener("waiting", () => {
      window.clearTimeout(bufTimer);
      bufTimer = window.setTimeout(() => {
        if (audio.readyState < 3 && npStatus.textContent !== "No se puede reproducir") {
          npStatus.textContent = "Cargando…";
        }
      }, 450);
    });
    const clearBuf = () => {
      window.clearTimeout(bufTimer);
      if (npStatus.textContent === "Cargando…") npStatus.textContent = "";
    };
    audio.addEventListener("playing", clearBuf);
    audio.addEventListener("canplay", clearBuf);
    window.addEventListener("pagehide", savePosNow);
    document.addEventListener("visibilitychange", () => { if (document.hidden) savePosNow(); });
  }

  function bindBattery() {
    const set = (level, charging, known) => {
      const pct = clamp(level, 0, 1);
      batFill.setAttribute("width", (20 * pct).toFixed(2));
      batBolt.setAttribute("visibility", charging ? "visible" : "hidden");
      battery.classList.toggle("low", known && pct <= 0.2 && !charging);
      battery.classList.toggle("charging", !!charging);
      const n = Math.round(pct * 100);
      battery.setAttribute("aria-label", known
        ? (charging ? "Batería al " + n + " %, cargando" : "Batería al " + n + " %")
        : "Batería");
    };
    set(0.82, false, false);
    if (!navigator.getBattery) return;
    navigator.getBattery().then((b) => {
      const upd = () => set(b.level, b.charging, true);
      upd();
      b.addEventListener("levelchange", upd);
      b.addEventListener("chargingchange", upd);
    }).catch(() => {});
  }

  function normalize(data) {
    if (!Array.isArray(data)) throw new Error("formato");
    return data.filter((e) => e && e.id && e.title).map((e) => ({
      id: String(e.id),
      title: String(e.title),
      author: String(e.author || "Desconocido"),
      date: String(e.date || ""),
      duration: String(e.duration || ""),
      durationSec: parseDur(e.duration),
      source: String(e.source || "")
    }));
  }

  async function init() {
    applyBrand();
    bindWheel();
    bindCenter();
    bindTrack();
    bindKeys();
    bindAudio();
    bindBattery();
    window.addEventListener("storage", (e) => {
      if (!e.key || !/^(done|pos|rate):/.test(e.key)) return;
      if (screen === "menu" && phase === "ready") render();
    });
    window.addEventListener("resize", () => { if (screen === "menu") updateSelection(); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { if (screen === "menu" && phase === "ready") updateSelection(); });
    }
    try {
      const res = await fetch(DATA_URL);
      if (!res.ok) throw new Error(String(res.status));
      episodes = normalize(await res.json());
      migrate();
      phase = "ready";
      document.body.dataset.state = "ready";
      render();
    } catch (err) {
      phase = "error";
      document.body.dataset.state = "error";
      render();
    }
  }

  init();
})();
