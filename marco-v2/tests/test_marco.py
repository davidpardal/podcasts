"""Pruebas del marco con Chromium headless (Playwright).

  python3 serve.py --port 8765 &
  python3 tests/test_marco.py

Opcional:
  MARCO_AJUSTES=/ruta/a/tus-ajustes.json  ajustes privados a importar para comprobar la custodia real
                                          (por defecto busca ../../marco-dashboard-privado/*.json)
  MARCO_SUBPATH_URL=http://127.0.0.1:8766/marco-v2/  comprueba que funciona bajo una subruta (GitHub Pages: /podcasts/marco-v2/)
Las capturas de capturas/ se hacen SIEMPRE con ajustes genéricos de ejemplo.
"""
import datetime as dt, glob, json, os, subprocess, sys
from urllib.parse import unquote
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.environ.get("MARCO_URL", "http://127.0.0.1:8765/")
SUB = os.environ.get("MARCO_SUBPATH_URL")
OUT = os.path.join(HERE, "..", "capturas")
os.makedirs(OUT, exist_ok=True)
PRIV = os.environ.get("MARCO_AJUSTES") or next(iter(sorted(glob.glob(os.path.join(HERE, "..", "..", "marco-dashboard-privado", "*.json")))), None)
TZ = dt.timezone(dt.timedelta(hours=2))
# Ajustes genéricos para las capturas: custodia de ejemplo activada
EJEMPLO = {"tipo": "marco-familiar-ajustes", "version": 1,
           "advanced": {"custody": {"enabled": True, "anchor": "2026-10-16T17:00", "cycleDays": 14, "daysWithParent": 7}}}
results, errors, netwarn = [], [], []

def check(name, cond, extra=""):
    results.append((name, bool(cond), extra))
    print(("OK   " if cond else "FAIL ") + name + (" · " + str(extra).replace("\n", " ") if extra != "" else ""))

def new_page(browser, w, h, when, mobile=False):
    ctx = browser.new_context(viewport={"width": w, "height": h}, timezone_id="Europe/Madrid", locale="es-ES",
                              is_mobile=mobile, has_touch=mobile, device_scale_factor=1)
    page = ctx.new_page()
    page.clock.install(time=when)
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    page.on("console", lambda m: errors.append("console.error: " + m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)
    # recursos que fallan: se apuntan con su URL (los servicios externos pueden fallar a ratos y no son errores de la app)
    page.on("response", lambda r: (errors if "127.0.0.1" in r.url and "/proxy" not in r.url else netwarn).append(f"{r.status} {r.url[:90]}") if r.status >= 400 else None)
    return ctx, page

def set_ajustes(page, data):
    page.evaluate("d => { localStorage.setItem('marco-v2.advanced', JSON.stringify(d.advanced || {})); }", data)
    page.reload(); page.wait_for_selector("#screen > *"); page.clock.run_for(1000)

def wait_data(page):
    page.wait_for_function("() => window.Marco && Marco.S.events.length > 0", timeout=15000)
    try: page.wait_for_selector(".wx-day", timeout=15000)
    except Exception: pass
    page.clock.run_for(1000)

with sync_playwright() as p:
    b = p.chromium.launch()

    # ================= 1) Por defecto (genérico, sin ajustes) =================
    ctx, page = new_page(b, 1280, 800, dt.datetime(2026, 10, 21, 17, 45, 5, tzinfo=TZ))
    page.goto(BASE); page.wait_for_selector(".hoy"); page.clock.run_for(1000); wait_data(page)
    check("demo activo por defecto", page.evaluate("Marco.demoOn()"))
    check("aviso MODO DEMO visible", page.is_visible(".demo-pill"))
    check("citas demo cargadas", page.evaluate("Marco.S.events.length") > 10, page.evaluate("Marco.S.events.length"))
    check("por defecto: custodia desactivada (sin aviso ni sombreado)", page.locator(".custody-badge").count() == 0 and page.locator(".day.c-padre").count() == 0)
    check("por defecto: niños genéricos", page.evaluate("Marco.CFG.kids.map(k => k.name).join(',')") == "Peque A,Peque B")
    check("por defecto: jornada de ejemplo 09:00–17:00", "09:00–17:00" in page.inner_text(".day.is-today .shift"))
    rr = page.evaluate("""() => {
      const evs = Marco.S.events.filter(e => e.title.startsWith('Baloncesto'));
      const mon = U.mondayOf(U.now());
      const thuNext = U.addDays(mon, 10), tueNext = U.addDays(mon, 8);
      return { n: evs.length, exdate: evs.some(e => U.sameDay(e.start, thuNext)),
        override: evs.filter(e => U.sameDay(e.start, tueNext)).map(e => e.title + ' ' + U.hm(e.start)),
        afterDST: evs.filter(e => e.start > new Date(2026,9,26) && !e.title.includes('cambio')).slice(0,2).map(e => U.hm(e.start)) };
    }""")
    check("RRULE semanal expandida", rr["n"] > 10, rr["n"])
    check("EXDATE quita el jueves de la semana que viene", not rr["exdate"])
    check("RECURRENCE-ID cambia la hora del martes siguiente", rr["override"] == ["Baloncesto (demo) · cambio de hora 18:30"], rr["override"])
    check("horas correctas tras el cambio de hora (17:30)", all(h == "17:30" for h in rr["afterDST"]), rr["afterDST"])
    t0 = page.inner_text("[data-clock=big]"); page.clock.run_for(60_000); t1 = page.inner_text("[data-clock=big]")
    check("el reloj avanza", t0 == "17:45" and t1 == "17:46", f"{t0} → {t1}")
    check("sin custodia las tareas no se pausan", "En pausa" not in page.locator(".sum").first.inner_text())
    check("a media tarde hay tareas de la mañana fuera de hora", "fuera de hora" in page.locator(".sum").first.inner_text())
    tip = page.evaluate("""() => Weather.advice(
      [{ time: '2026-10-21T17:00', temp: 14, pop: 80, code: 61, precip: 1.2 }],
      [{ title: 'Baloncesto (demo)', start: new Date(2026, 9, 21, 17, 30), end: new Date(2026, 9, 21, 19, 0), allDay: false }],
      new Date(2026, 9, 21, 16, 0))""")
    check("lluvia a las 17:00 y baloncesto: chubasquero", "chubasquero" in tip and "Baloncesto" in tip and "17:00" in tip, tip)

    # ================= 2) Capturas con ajustes genéricos de ejemplo =================
    set_ajustes(page, EJEMPLO); wait_data(page)
    check("ejemplo: custodia activa y semanas sombreadas", page.locator(".custody-badge").count() == 1 and page.locator(".day.c-padre").count() >= 1)
    check("ahora no lo tapa el turno de fondo", "Turno" not in page.inner_text(".next-title"))
    check("calendario de fondo visible", page.locator(".ev-bg").count() > 0)
    lay = page.evaluate("""() => {
      const rail = document.querySelector('#rail').getBoundingClientRect();
      const screen = document.querySelector('#screen').getBoundingClientRect();
      const menu = document.querySelector('.hoy-menu').getBoundingClientRect();
      const next = document.querySelector('.next').getBoundingClientRect();
      const label = getComputedStyle(document.querySelector('#rail [data-go=hoy] .nav-label'));
      return {
        railBeforeScreen: rail.right <= screen.left + 1,
        vertical: rail.height > rail.width * 1.5,
        labelShown: label.position !== 'absolute' && parseFloat(label.width) > 8,
        menuLeftOfNext: menu.right <= next.left + 2
      };
    }""")
    check("menú de pantallas a la izquierda, en vertical", lay["railBeforeScreen"] and lay["vertical"], lay)
    check("barra con iconos y etiquetas", lay["labelShown"] and "Salud" in page.inner_text("#rail") and "Hoy" in page.inner_text("#rail"))
    check("menú semanal en la columna izquierda", lay["menuLeftOfNext"] and "Menú semanal" in page.inner_text(".hoy-menu"))
    check("hoy muestra comida y cena", "Comida" in page.inner_text(".hoy-menu") and "Arroz" in page.inner_text(".hoy-menu"))
    page.focus("#rail [data-go=hoy]")
    page.keyboard.press("ArrowDown")
    check("flechas mueven el foco por el menú", page.evaluate("document.activeElement && document.activeElement.dataset.go") == "calendario")
    page.keyboard.press("Enter")
    page.wait_for_selector(".cal")
    check("enter abre la sección enfocada", page.evaluate("document.body.dataset.screen") == "calendario")
    w0 = page.evaluate("() => document.querySelector('#rail').getBoundingClientRect().width")
    page.click("[data-act=railToggle]")
    page.wait_for_timeout(100)
    collapsed = page.evaluate("""(w0) => {
      const rail = document.querySelector('#rail').getBoundingClientRect();
      const s = getComputedStyle(document.querySelector('#rail [data-go=hoy] .nav-label'));
      const hidden = s.position === 'absolute' || parseFloat(s.width) < 2;
      return { hidden, narrower: rail.width < w0 - 20, name: document.querySelector('[data-act=railToggle]').getAttribute('aria-label') };
    }""", w0)
    check("la barra se contrae a iconos y sigue teniendo nombre", collapsed["hidden"] and collapsed["narrower"] and "Ampliar" in (collapsed["name"] or ""), collapsed)
    page.click("[data-act=railToggle]")
    page.evaluate("localStorage.setItem('marco-v2.railCollapsed', 'false')")
    page.click("#rail [data-go=hoy]")
    page.wait_for_selector(".hoy-menu")
    check("mañana de un vistazo", page.inner_text(".next-tom").startswith("Mañana"))
    check("cita demo tachada", page.locator(".ev-done", has_text="Compra semanal").count() >= 1)
    if page.locator(".wx-h").count():
        check("tiempo por horas", page.locator(".wx-h").count() >= 4)
    page.screenshot(path=os.path.join(OUT, "1-hoy.png"))
    page.locator(".week [data-ev]", has_text="Dentista").first.click()
    page.wait_for_selector(".modal-card")
    check("al tocar una cita se abre el detalle", page.inner_text(".modal-t") == "Dentista (demo)")
    page.screenshot(path=os.path.join(OUT, "7-aviso-cita.png"))
    page.click("[data-close]")
    page.locator(".week [data-ev]", has_text="Dentista").first.click()
    page.wait_for_selector("[data-done]")
    page.click("[data-done]")
    check("marcar hecha tacha la cita", page.locator(".week .ev-done", has_text="Dentista").count() >= 1)
    page.click("[data-done]")
    page.click("[data-close]")
    for i, (tab, sel) in enumerate([("calendario", ".cal-week"), ("luz", ".luz"), ("ninos", ".ninos"), ("compra", ".compra"), ("ajustes", ".ajustes")], start=2):
        page.click(f"#rail [data-go={tab}]"); page.wait_for_selector(sel)
        if tab == "calendario":
            check("calendario: 13 semanas", page.locator(".cal-week").count() == 13)
            check("calendario: semanas de custodia sombreadas", page.locator(".cell.c-padre").count() >= 30)
        if tab == "luz":
            try: page.wait_for_selector(".bars", timeout=10000)
            except Exception: pass
            check("luz: periodo actual (mié 17:46 = llano)", "Llano" in page.inner_text(".per-big"))
            check("luz: PVPC marcado como referencia", "NO es tu tarifa" in page.inner_text(".luz-pvpc"))
            check("luz: gráfico PVPC pintado", page.locator(".bar").count() >= 23, page.locator(".bar").count())
        if tab == "ninos":
            check("tareas por franja", all(s in page.inner_text(".ninos").lower() for s in ("mañana", "después del cole", "noche")))
            check("una tarea solo de Peque A", page.locator("[data-chore=basura]").count() == 1)
            check("franja de la mañana fuera de hora", page.locator(".chore.overdue").count() >= 1)
            check("racha de la semana", page.locator(".streak").count() == 1)
            for c, k in [("cama", "peque-a"), ("deberes", "peque-a"), ("cama", "peque-b"), ("cuarto", "peque-b"), ("mesa", "peque-b")]:
                page.click(f"[data-chore={c}][data-kid={k}]")
            check("niños: estrellas suman", "Peque A ⭐ 3" in page.inner_text(".kid-chips") and "Peque B ⭐ 4" in page.inner_text(".kid-chips"), page.inner_text(".kid-chips"))
        if tab == "compra":
            for item in ["leche", "pan de molde", "plátanos", "café", "tomates"]:
                page.fill("#addInput", item); page.press("#addInput", "Enter")
            page.click(".item >> nth=3")
            check("compra: 4 pendientes", page.inner_text(".compra .count") == "4")
        if tab == "ajustes":
            check("ajustes: formulario de familia e importar/exportar", page.is_visible("#f_kids") and page.is_visible("#impTxt"))
            check("ajustes: calendarios de fondo", "De fondo" in page.inner_text(".ajustes"))
            check("ajustes: dinero, plazos y entreno", page.is_visible("#dinLuz") and page.is_visible("#dinSubs") and page.is_visible("#plazosTxt") and page.is_visible("#ent3"))
        page.screenshot(path=os.path.join(OUT, f"{i}-{tab}.png"))
    page.click("#rail [data-go=dinero]"); page.wait_for_selector(".dinero-ahorro")
    dinero0 = page.inner_text(".dinero")
    check("dinero: ejemplos en euros y ahorro vacío", "ejemplo" in dinero0.lower() and "€" in dinero0 and page.get_attribute(".dinero-ahorro", "data-ahorro") == "" and "Revista (ejemplo)" in dinero0)
    page.screenshot(path=os.path.join(OUT, "18-dinero.png"))
    page.click("#rail [data-go=plazos]"); page.wait_for_selector(".plazo")
    semaforo = page.evaluate("""() => Array.from(document.querySelectorAll('.plazo')).map(r => r.dataset.tone + ':' + r.dataset.title)""")
    check("plazos: fecha ascendente y semáforo", semaforo == ["rojo:Registro (ejemplo)", "ambar:Hotel (ejemplo)", "verde:Vuelo (ejemplo)"], semaforo)
    check("plazos: días que quedan", "quedan 2 días" in page.inner_text(".plazo.rojo") and "quedan 12 días" in page.inner_text(".plazo.ambar"))
    page.screenshot(path=os.path.join(OUT, "19-plazos.png"))
    page.click("#rail [data-go=semana]"); page.wait_for_selector(".semana-banner")
    semana = page.inner_text(".semana")
    check("semana con los niños: banner, tareas y compra", "Esta semana con los niños" in semana and "Hacer la cama" in semana and "Peque A" in semana and "Peque B" in semana and "pendiente" in semana.lower())
    check("semana: la agenda no inventa un cole", "colegio" not in semana.lower() and "Agenda" in semana)
    page.screenshot(path=os.path.join(OUT, "20-semana.png"))
    page.click("#rail [data-go=ajustes]"); page.wait_for_selector("#dinLuz")
    page.fill("#dinLuz", "40"); page.fill("#dinLuzP", "55")
    page.fill("#dinFibra", "45"); page.fill("#dinFibraP", "45"); page.fill("#dinFibraAlt", "39")
    page.fill("#dinSuscP", "20")
    page.click("[data-act=saveDinero]")
    page.click("#rail [data-go=dinero]"); page.wait_for_selector(".dinero-ahorro")
    check("ahorro = mes pasado − este mes", page.get_attribute(".dinero-ahorro", "data-ahorro") == "19.02" and "€" in page.inner_text(".dinero-ahorro"))
    check("fibra: compara la alternativa", "alternativa" in page.inner_text(".dinero").lower())
    page.click("#rail [data-go=ajustes]"); page.wait_for_selector("#ent3")
    page.select_option("#ent3", "running")
    page.click("[data-act=saveEntreno]")
    page.click("#rail [data-go=salud]"); page.wait_for_selector(".salud-hoy")
    hoy = page.inner_text(".salud-hoy").lower()
    check("salud: franja Hoy con el entreno de Ajustes", page.get_attribute(".hoy-bit[data-entreno]", "data-entreno") == "running" and "hoy" in hoy and "batería" in hoy)
    # PIN y canje
    page.evaluate("""() => { localStorage.setItem('marco-v2.pin', JSON.stringify('2468'));
      const k = JSON.parse(localStorage.getItem('marco-v2.ninos')); k.stars['peque-b'] = 6; localStorage.setItem('marco-v2.ninos', JSON.stringify(k)); }""")
    page.click("#rail [data-go=ninos]")
    page.click("[data-ask=pantalla][data-kid=peque-b]")
    page.click("[data-approve]")
    for k in "1111": page.click(f".pin-k[data-k='{k}']")
    page.click(".pin-k[data-k='✓']")
    check("PIN incorrecto no aprueba", page.locator(".pend").count() == 1)
    page.click("[data-approve]")
    for k in "2468": page.click(f".pin-k[data-k='{k}']")
    page.click(".pin-k[data-k='✓']")
    check("PIN correcto aprueba y descuenta 5 ⭐", page.locator(".pend").count() == 0 and "Peque B ⭐ 1" in page.inner_text(".kid-chips"), page.inner_text(".kid-chips"))
    # Guardar familia desde el formulario
    page.evaluate("localStorage.removeItem('marco-v2.pin')")
    page.click("#rail [data-go=ajustes]"); page.wait_for_selector("#f_kids")
    page.fill("#f_kids", "Peque X | #E8604C\nPeque Y | #8E5BC8\nPeque Z")
    page.fill("#wf5", ""); page.fill("#wt5", "")
    page.click("[data-act=saveFamily]"); page.wait_for_selector(".hoy"); page.clock.run_for(1000)
    fam = page.evaluate("[Marco.CFG.kids.map(k => k.name).join(','), Object.keys(Marco.CFG.work.shifts).join(',')]")
    check("formulario de familia guarda niños y jornada (viernes libre)", fam == ["Peque X,Peque Y,Peque Z", "1,2,3,4"], fam)
    # Exportar
    page.click("#rail [data-go=ajustes]"); page.wait_for_selector("#f_kids")
    page.click("[data-act=exportJson]"); page.wait_for_selector(".share-ta")
    exp = json.loads(page.input_value(".share-ta"))
    check("exportar da JSON importable sin calendarios", exp.get("tipo") == "marco-familiar-ajustes" and exp["settings"]["calendars"] == [] and exp["advanced"]["kids"][2]["name"] == "Peque Z" and exp.get("menu", {}).get("plan"))
    page.click("[data-close]")
    page.click("#rail [data-go=menu]"); page.wait_for_selector(".menu")
    page.screenshot(path=os.path.join(OUT, "11-menu.png"))
    check("menú de lunes a domingo", page.locator(".menu-day").count() == 7 and page.locator(".menu-slot").count() == 14)
    page.click(".menu-slot[data-day='2'][data-meal='comida']")
    page.click(".dish[data-dish='Pizza']")
    check("tocar asigna el plato", "Pizza" in page.locator(".menu-slot[data-day='2'][data-meal='comida']").inner_text())
    page.drag_and_drop(".dish[data-dish='Sopa']", ".menu-slot[data-day='2'][data-meal='cena']")
    check("arrastrar asigna la cena", "Sopa" in page.locator(".menu-slot[data-day='2'][data-meal='cena']").inner_text())
    page.click("[data-span='5']")
    check("el menú puede ser solo L–V", page.locator(".menu-day").count() == 5)
    page.click("#rail [data-go=hoy]"); page.wait_for_selector(".hoy-menu")
    check("hoy enseña la comida elegida", "Pizza" in page.inner_text(".hoy-menu"))
    page.click("#rail [data-go=menu]"); page.click("[data-act=resetMenu]")
    check("volver al menú de ejemplo", "Arroz" in page.locator(".menu-slot[data-day='2'][data-meal='comida']").inner_text())
    # Haz la cesta: copia, mailto y aviso. Sin webhook en el repo; el correo sale de Ajustes.
    page.evaluate("""() => {
      window.__cesta = { copied: null, href: null, exec: false };
      const clip = navigator.clipboard || (navigator.clipboard = {});
      clip.writeText = (t) => { window.__cesta.copied = t; return Promise.resolve(); };
      new MutationObserver((recs) => {
        recs.forEach((r) => Array.from(r.addedNodes).forEach((n) => {
          if (!n || n.tagName !== 'IFRAME') return;
          const s = n.getAttribute('src') || '';
          if (s.indexOf('mailto:') === 0) window.__cesta.href = n.src || s;
        }));
      }).observe(document.body, { childList: true });
    }""")
    page.click("#rail [data-go=compra]"); page.wait_for_selector("[data-act=hazCesta]")
    check("compra: botón Haz la cesta junto a compartir", page.inner_text("[data-act=hazCesta]") == "Haz la cesta" and page.is_visible("[data-act=share]"))
    page.click("[data-act=hazCesta]")
    page.clock.run_for(500)
    page.wait_for_function("() => window.__cesta && window.__cesta.href")
    mail = page.evaluate("""() => {
      const h = window.__cesta.href || '';
      const q = h.split('?')[1] || '';
      const p = new URLSearchParams(q);
      return { to: h.split('?')[0], subject: p.get('subject'), body: p.get('body'), copied: window.__cesta.copied, toast: document.querySelector('#toast').textContent };
    }""")
    pendiente = "Lista de la compra:\n• Leche\n• Pan de molde\n• Plátanos\n• Tomates"
    check("haz la cesta copia solo pendientes", mail["copied"] == pendiente and mail["body"] == pendiente and "Café" not in (mail["body"] or ""), mail)
    check("mailto sin destinatario y asunto Haz la cesta", mail["to"] == "mailto:" and mail["subject"] == "Haz la cesta", mail)
    check("toast lista lista para Grok Bot", mail["toast"] == "Lista lista para Grok Bot", mail["toast"])
    page.click("#rail [data-go=ajustes]"); page.wait_for_selector("#eroskiMail")
    check("ajustes: correo de la cesta vacío", page.input_value("#eroskiMail") == "")
    page.fill("#eroskiMail", "no-es-correo"); page.click("[data-act=saveEroski]")
    page.wait_for_function("() => document.querySelector('#toast').textContent.includes('válido')")
    guardado = page.evaluate("() => (JSON.parse(localStorage.getItem('marco-v2.settings') || '{}').eroskiNotifyEmail || '')")
    check("correo inválido no se guarda", guardado == "", guardado)
    page.fill("#eroskiMail", "bot@ejemplo.com"); page.click("[data-act=saveEroski]")
    page.wait_for_function("() => document.querySelector('#toast').textContent === 'Correo guardado'")
    check("correo de aviso guardado en marco-v2.settings", page.evaluate("() => JSON.parse(localStorage.getItem('marco-v2.settings')).eroskiNotifyEmail") == "bot@ejemplo.com")
    page.evaluate("() => { window.__cesta.copied = null; window.__cesta.href = null; }")
    page.click("#rail [data-go=compra]"); page.click("[data-act=hazCesta]")
    page.clock.run_for(500)
    page.wait_for_function("() => window.__cesta.href")
    mail2 = page.evaluate("""() => {
      const h = window.__cesta.href || '';
      const p = new URLSearchParams(h.split('?')[1] || '');
      return { to: decodeURIComponent(h.split('?')[0]), subject: p.get('subject'), body: p.get('body') };
    }""")
    check("mailto usa el correo de ajustes", mail2["to"] == "mailto:bot@ejemplo.com" and mail2["subject"] == "Haz la cesta" and mail2["body"].startswith("Lista de la compra:\n• Leche"), mail2)
    page.evaluate("""() => {
      window.__cesta = { copied: null, href: null, exec: false };
      navigator.clipboard.writeText = () => Promise.reject(new Error('denegado'));
      document.execCommand = (cmd) => { if (cmd === 'copy') { window.__cesta.exec = true; return false; } return false; };
    }""")
    page.click("[data-act=hazCesta]")
    page.clock.run_for(500)
    page.wait_for_selector(".share-ta")
    fallback = page.evaluate("""() => ({
      href: window.__cesta.href, exec: window.__cesta.exec, modal: document.querySelector('.share-ta').value,
      toast: document.querySelector('#toast').textContent
    })""")
    check("si no hay portapapeles, se ve la lista y sigue el mailto", fallback["exec"] and fallback["modal"] == pendiente and unquote(fallback["href"] or "").startswith("mailto:bot@ejemplo.com?") and fallback["toast"] == "Lista lista para Grok Bot", fallback)
    page.click("[data-close]")
    page.evaluate("""() => { const c = JSON.parse(localStorage.getItem('marco-v2.compra')); c.items.forEach(x => { x.done = true; }); localStorage.setItem('marco-v2.compra', JSON.stringify(c)); window.__cesta.href = null; }""")
    page.click("[data-act=hazCesta]")
    page.wait_for_function("() => document.querySelector('#toast').textContent.includes('pendiente')")
    check("lista vacía no abre correo", page.evaluate("window.__cesta.href") is None and "No hay nada pendiente" in page.inner_text("#toast"))
    # CORS
    cors = page.evaluate("""async () => {
      const u = 'https://calendar.google.com/calendar/ical/es.spain%23holiday%40group.v.calendar.google.com/public/basic.ics';
      let direct, viaProxy;
      try { const r = await fetch(u); direct = 'OK ' + r.status; } catch (e) { direct = e.name + ': ' + e.message; }
      try { const r = await fetch('/proxy?url=' + encodeURIComponent(u)); const t = await r.text(); viaProxy = r.status + ' ' + t.slice(0, 15); } catch (e) { viaProxy = e.name + ': ' + e.message; }
      return { direct, viaProxy };
    }""")
    check("CORS: Google bloquea la lectura directa", cors["direct"].startswith("TypeError"), cors["direct"])
    check("CORS: con /proxy funciona", cors["viaProxy"].startswith("200 BEGIN:VCALENDAR"), cors["viaProxy"])
    page.evaluate("""() => { localStorage.setItem('marco-v2.settings', JSON.stringify({ calendars: [{ id: 'f', name: 'Festivos', color: '#8E5BC8',
      url: 'https://calendar.google.com/calendar/ical/es.spain%23holiday%40group.v.calendar.google.com/public/basic.ics' }], proxy: '/proxy?url=', demo: null })); }""")
    page.reload(); page.wait_for_selector(".hoy")
    page.wait_for_function("() => Marco.S.calStatus.f", timeout=20000)
    st = page.evaluate("[Marco.demoOn(), Marco.S.calStatus.f]")
    check("iCal real vía proxy: demo se apaga y se leen citas", (not st[0]) and st[1]["ok"], st)
    page.evaluate("() => { const s = JSON.parse(localStorage.getItem('marco-v2.settings')); s.proxy = ''; localStorage.setItem('marco-v2.settings', JSON.stringify(s)); localStorage.removeItem('marco-v2.cache.calStatus'); }")
    page.reload(); page.wait_for_selector(".hoy")
    page.wait_for_function("() => Marco.S.calStatus.f", timeout=20000)
    st2 = page.evaluate("Marco.S.calStatus.f")
    check("iCal sin proxy: error CORS claro en Ajustes", (not st2["ok"]) and st2.get("cors"), st2.get("error"))
    sw = page.evaluate("""() => {
      const base = new URL('./', location.href);
      return navigator.serviceWorker.register(new URL('sw.js', base), { scope: base.href })
        .then(reg => reg.scope === base.href).catch(e => String(e));
    }""")
    check("service worker acotado a esta carpeta", sw is True, sw)
    page.context.set_offline(True)
    page.evaluate("() => Marco.paintOffline()")
    off = page.inner_text("#offline")
    check("aviso sin conexión con la hora de los datos", off.startswith("Sin conexión · datos de las ") or off.startswith("Sin conexión · sin datos"), off)
    page.context.set_offline(False)
    page.evaluate("() => Marco.paintOffline()")
    check("al volver la red se quita el aviso", page.locator("#offline.hidden").count() == 1)
    page.clock.set_fixed_time(dt.datetime(2026, 10, 21, 23, 15, tzinfo=TZ))
    page.clock.run_for(1500)
    page.wait_for_selector("#night:not(.hidden)")
    check("reloj nocturno: lo primero de mañana", "Lo primero de mañana" in page.inner_text("[data-clock=nightnext]"))
    ctx.close()

    # Sábado 24/10 y otras resoluciones, con ajustes genéricos
    ctx, page = new_page(b, 1280, 800, dt.datetime(2026, 10, 24, 10, 0, tzinfo=TZ))
    page.goto(BASE); page.wait_for_selector(".hoy"); set_ajustes(page, EJEMPLO); wait_data(page)
    page.screenshot(path=os.path.join(OUT, "8-hoy-sabado.png"))
    check("sábado sin niños: tareas en pausa", "En pausa" in page.locator(".sum").first.inner_text())
    page.click("#rail [data-go=ninos]"); page.wait_for_selector(".pause-banner")
    check("la pausa se explica en Niños", "pausa" in page.inner_text(".pause-banner").lower())
    page.click("#rail [data-go=semana]"); page.wait_for_selector(".semana-calma")
    check("sábado: semana sin niños y el menú sigue", "Semana sin niños — tareas pausadas" in page.inner_text(".semana") and page.is_visible("#rail [data-go=semana]"))
    page.click("#rail [data-go=plazos]"); page.wait_for_selector(".plazo.gris")
    check("plazo pasado en gris", page.get_attribute(".plazo.gris", "data-title") == "Registro (ejemplo)")
    page.click("#rail [data-go=luz]"); page.wait_for_selector(".luz")
    check("luz sábado = valle", "Valle" in page.inner_text(".per-big"))
    ctx.close()
    ctx, page = new_page(b, 1920, 1200, dt.datetime(2026, 10, 21, 9, 30, tzinfo=TZ))
    page.goto(BASE); page.wait_for_selector(".hoy"); set_ajustes(page, EJEMPLO); wait_data(page)
    page.screenshot(path=os.path.join(OUT, "9-hoy-1920x1200.png"))
    check("1920×1200 sin desbordes", page.evaluate("document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1"))
    ctx.close()
    ctx, page = new_page(b, 390, 844, dt.datetime(2026, 10, 21, 20, 30, tzinfo=TZ), mobile=True)
    page.goto(BASE); page.wait_for_selector(".hoy"); set_ajustes(page, EJEMPLO); wait_data(page)
    mob = page.evaluate("""() => {
      const rail = document.querySelector('#rail').getBoundingClientRect();
      const screen = document.querySelector('#screen').getBoundingClientRect();
      const label = getComputedStyle(document.querySelector('#rail [data-go=salud] .nav-label'));
      const menu = document.querySelector('.hoy-menu');
      return {
        left: rail.right <= screen.left + 1,
        vertical: rail.height > rail.width,
        compact: label.position === 'absolute' || parseFloat(label.width) < 2,
        notBottom: rail.top < 40,
        menu: !!(menu && menu.getBoundingClientRect().width > 40)
      };
    }""")
    check("móvil: carril izquierdo y compacto", mob["left"] and mob["vertical"] and mob["compact"] and mob["notBottom"] and mob["menu"], mob)
    page.click("[data-act=railToggle]")
    page.wait_for_selector("html.rail-drawer")
    check("móvil: el cajón muestra las etiquetas", "Salud" in page.inner_text("#rail") and page.evaluate("document.documentElement.classList.contains('rail-drawer')"))
    page.keyboard.press("Escape")
    check("móvil: escape cierra el cajón", not page.evaluate("document.documentElement.classList.contains('rail-drawer')"))
    page.click("[data-act=sleep]")
    page.wait_for_selector("#night:not(.hidden)")
    check("móvil: reloj nocturno", page.is_visible(".night-time") and page.is_visible(".night-hint"))
    page.click("#night")
    page.wait_for_function("() => document.querySelector('#night').classList.contains('hidden')")
    page.screenshot(path=os.path.join(OUT, "10-movil.png"))
    check("móvil sin scroll horizontal", page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
    ctx.close()

    # ================= 2b) Sincronización (endpoint simulado, datos de ejemplo) =================
    SYNC_JS = os.path.join(HERE, "..", "js", "sync.js")
    GS = os.path.join(HERE, "..", "apps-script", "Code.gs")
    MANIFEST = os.path.join(HERE, "..", "apps-script", "appsscript.json")
    gs = open(GS, encoding="utf-8").read()
    manifest = json.load(open(MANIFEST, encoding="utf-8"))
    check("script lee CalendarApp y exige la clave", "CalendarApp.getAllCalendars" in gs and "MARCO_KEY" in gs and "Clave incorrecta" in gs)
    check("script sin datos personales", "davidpardal" not in gs.lower() and "calendar.google.com/calendar/ical" not in gs)
    check("manifiesto: ejecutar como yo y acceso anónimo", manifest.get("webapp", {}).get("executeAs") == "USER_DEPLOYING" and manifest.get("webapp", {}).get("access") == "ANYONE_ANONYMOUS")
    check("script: acción salud y API personal de Garmin",
          "action === 'salud'" in gs and "GARMIN_PERSONAL_API_KEY" in gs
          and "personalapitoken-service/personal-api/personal-api-key/token" in gs
          and "Authorization: 'ApiKey '" in gs.replace(' + key', '')
          and "/activitylist-service/activities/search/activities" in gs
          and "/usersummary-service/v2/dailysummaries" in gs
          and "/sleep-service/sleep/dailySleepSummariesByDate" in gs
          and "/hrv-service/hrv/daily/" in gs
          and "/weight-service/weight/range/" in gs
          and "addDaysIso_(today, -27)" in gs and "addDaysIso_(today, -55)" in gs
          and "weightGrams" in gs
          and "Bearer " in gs)
    check("script no escribe la clave ni el token en el registro", "Logger.log(key" not in gs and "Logger.log(token" not in gs and "Logger.log(clave" not in gs)
    check("manifiesto puede llamar a Garmin", "https://www.googleapis.com/auth/script.external_request" in (manifest.get("oauthScopes") or []))
    readme_gs = open(os.path.join(HERE, "..", "apps-script", "README.md"), encoding="utf-8").read()
    check("readme de apps-script explica GARMIN_PERSONAL_API_KEY",
          "GARMIN_PERSONAL_API_KEY" in readme_gs and "Propiedades del script" in readme_gs and "no imprime" in readme_gs
          and "Nueva versión" in readme_gs and "28" in readme_gs and "weightGrams" in readme_gs)
    check("script guarda el token hasta 5 min antes de exp y la salud 30 min", "exp - now - 300" in gs and "1800" in gs and "old.stale = true" in gs)

    def js_merge(stored, incoming):
        proc = subprocess.run(
            ["node", "-e", r'''
const fs = require("fs");
const vm = require("vm");
const code = fs.readFileSync(process.argv[1], "utf8");
const sandbox = { window: {}, console: console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", function (c) { raw += c; });
process.stdin.on("end", function () {
  const input = JSON.parse(raw || "{}");
  process.stdout.write(JSON.stringify(sandbox.window.Sync.mergeState(input.a, input.b)));
});
''', SYNC_JS],
            input=json.dumps({"a": stored, "b": incoming}),
            capture_output=True, text=True, timeout=20)
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr or proc.stdout)
        return json.loads(proc.stdout)

    reunion_ms = int(dt.datetime(2026, 10, 21, 18, 0, tzinfo=TZ).timestamp() * 1000)
    turno_ms = int(dt.datetime(2026, 10, 21, 15, 0, tzinfo=TZ).timestamp() * 1000)
    CALENDARS = {"ok": True, "calendars": [
        {"id": "cal-familia", "name": "Familia ejemplo", "color": "#E8604C", "background": False},
        {"id": "cal-turno", "name": "Turno ejemplo", "color": "#8A8178", "background": True}],
        "events": [
            {"id": "reunion@" + str(reunion_ms), "title": "Reunión de ejemplo", "startLocal": "2026-10-21T18:00", "endLocal": "2026-10-21T19:00",
             "allDay": False, "location": "Sitio de ejemplo", "description": "Dato inventado.", "calId": "cal-familia", "calName": "Familia ejemplo", "color": "#E8604C", "background": False},
            {"id": "turno@" + str(turno_ms), "title": "Turno ejemplo", "startLocal": "2026-10-21T15:00", "endLocal": "2026-10-21T22:00",
             "allDay": False, "location": "", "description": "", "calId": "cal-turno", "calName": "Turno ejemplo", "color": "#8A8178", "background": True}]}
    box = {"state": {
        "compra": {"items": [{"id": "pan-remoto", "name": "Pan del otro móvil", "done": False, "deleted": False, "at": 1, "rev": 5}], "counts": {"Pan del otro móvil": 1}},
        "ninos": {"stars": {"peque-b": 2}, "starLog": [{"id": "op-remoto", "kid": "peque-b", "delta": 2, "at": 50, "kind": "delta"}], "done": {}, "doneMeta": {}, "pending": [], "log": []},
        "hechas": {}
    }, "fail": False, "posts": 0, "key_in_url": False}

    def handle_sync(route):
        req = route.request
        if "key=" in (req.url or ""):
            box["key_in_url"] = True
        try:
            body = json.loads(req.post_data or "{}")
        except Exception:
            body = {}
        if body.get("key") != "clave-de-ejemplo":
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": False, "error": "Clave incorrecta"}))
        if box["fail"]:
            return route.abort()
        if body.get("action") == "calendars":
            return route.fulfill(status=200, content_type="application/json", body=json.dumps(CALENDARS))
        if body.get("action") == "salud":
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({
                "ok": True, "stale": False, "stepsGoal": 8000,
                "days": [{"date": "2026-10-21", "steps": 4321, "restingHr": 55, "bodyBatteryMin": 20, "bodyBatteryMax": 90,
                          "sleepSeconds": 27000, "sleepScore": 77, "deepSeconds": 5000, "lightSeconds": 14000,
                          "remSeconds": 6000, "awakeSeconds": 1200, "hrv": 47, "hrvWeekly": 45, "hrvStatus": "BALANCED"}],
                "workouts": [{"date": "2026-10-20", "start": "2026-10-20T18:00:00", "type": "walking", "name": "Paseo de ejemplo",
                              "duration": 1200, "distance": 1500, "avgHr": 100, "calories": 90}]
            }))
        if body.get("action") == "sync":
            merged = js_merge(box["state"], body.get("state") or {})
            box["state"] = merged
            box["posts"] += 1
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True, "state": merged}))
        return route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": False, "error": "Acción desconocida"}))

    ctx, page = new_page(b, 1280, 800, dt.datetime(2026, 10, 21, 17, 45, tzinfo=TZ))
    page.route("**/__marco_sync", handle_sync)
    page.goto(BASE); page.wait_for_selector(".hoy"); page.clock.run_for(500)
    mix = page.evaluate("""() => {
      const ts = Date.now();
      const id = 'cita@' + ts;
      const R = ts * 1000;
      const m = Sync.mergeState({
        compra: { items: [
          { id: 'a', name: 'Leche', rev: R + 10, deleted: true, done: true },
          { id: 'c', name: 'Huevos', rev: R + 4, deleted: false, done: false }
        ], counts: { Leche: 1 } },
        menu: { span: 7, spanRev: 3, dishes: ['Pizza'], dishMeta: { pizza: { rev: 8, deleted: false } },
          plan: { '0': { comida: 'Pizza', comidaRev: 9, cena: 'Sopa', cenaRev: 2 } } },
        ninos: { starLog: [
          { id: 'a1', kid: 'peque-a', delta: 1, at: 10, kind: 'delta' },
          { id: 'rst', kind: 'reset', at: 20 },
          { id: 'a2', kid: 'peque-a', delta: 2, at: 30, kind: 'delta' }
        ] },
        hechas: { [id]: { on: true, rev: 3 } }
      }, {
        compra: { items: [
          { id: 'a', name: 'Leche', rev: R + 4, deleted: false, done: false },
          { id: 'b', name: 'Pan', rev: R + 6, deleted: false, done: false }
        ], counts: { Leche: 3, Pan: 1 } },
        menu: { span: 5, spanRev: 1, dishes: ['Pizza', 'Sopa'], dishMeta: { pizza: { rev: 2, deleted: false }, sopa: { rev: 4, deleted: false } },
          plan: { '0': { comida: 'Sopa', comidaRev: 4, cena: 'Tortilla', cenaRev: 7 } } },
        ninos: { starLog: [{ id: 'b1', kid: 'peque-b', delta: 4, at: 40, kind: 'delta' }] },
        hechas: { [id]: { on: false, rev: 8 } }
      });
      const names = {};
      (m.compra.items || []).forEach(it => { names[it.id] = it; });
      return {
        lecheBorrada: !!(names.a && names.a.deleted),
        huevos: !!(names.c && !names.c.deleted),
        pan: !!(names.b && !names.b.deleted),
        counts: m.compra.counts,
        span: m.menu.span,
        dishes: m.menu.dishes.slice().sort(),
        lunes: m.menu.plan['0'],
        stars: m.ninos.stars,
        hecha: m.hechas[id]
      };
    }""")
    check("mezcla: no pierde ítems y respeta la lápida", mix["lecheBorrada"] and mix["huevos"] and mix["pan"], mix)
    check("mezcla: el contador se queda con el máximo", mix["counts"].get("Leche") == 3 and mix["counts"].get("Pan") == 1, mix["counts"])
    check("mezcla: menú por casilla y platos de los dos", mix["span"] == 7 and mix["dishes"] == ["Pizza", "Sopa"] and mix["lunes"]["comida"] == "Pizza" and mix["lunes"]["cena"] == "Tortilla", mix)
    check("mezcla: estrellas suman y el reinicio no se come lo de después", mix["stars"].get("peque-a") == 2 and mix["stars"].get("peque-b") == 4, mix["stars"])
    check("mezcla: desmarcar una cita gana si es más nuevo", mix["hecha"]["on"] is False and mix["hecha"]["rev"] == 8, mix["hecha"])

    page.click("#rail [data-go=ajustes]"); page.wait_for_selector("#syncUrl")
    check("ajustes: tarjeta de sincronización", "Sincronización con Google" in page.inner_text("#syncCard"))
    page.fill("#syncUrl", BASE.rstrip("/") + "/__marco_sync")
    page.fill("#syncKey", "clave-de-ejemplo")
    page.click("[data-act=saveSync]")
    page.wait_for_function("() => { const s = document.querySelector('#syncStatus'); return s && s.className.indexOf('ok') !== -1; }", timeout=20000)
    page.click("[data-act=showSyncKey]")
    page.locator("#syncCard").screenshot(path=os.path.join(OUT, "12-sincronizacion.png"))
    check("la clave no viaja en la URL", not box["key_in_url"])
    check("demo apagado al conectar", page.evaluate("() => !Marco.demoOn()"))
    # La cita no se pinta en Ajustes: está en los eventos y el turno sale marcado de fondo.
    ev_txt = page.evaluate("() => Marco.S.events.map(e => e.title + (e.background ? '·fondo' : '')).join('|')")
    turno_on = page.locator(".sync-cal", has_text="Turno ejemplo").locator("input").is_checked()
    check("cita de ejemplo y turno de fondo", "Familia ejemplo" in page.inner_text("#syncCard") and turno_on and "Reunión de ejemplo" in ev_txt and "Turno ejemplo·fondo" in ev_txt, ev_txt)
    page.click("#rail [data-go=hoy]"); page.wait_for_selector(".next-title")
    check("ahora enseña la cita y no el turno de fondo", "Reunión" in page.inner_text(".next-title") and "Turno" not in page.inner_text(".next-title"))
    check("el turno se pinta de fondo", page.locator(".ev-bg", has_text="Turno ejemplo").count() >= 1)
    page.click("#rail [data-go=compra]"); page.wait_for_selector(".compra")
    check("llega la compra del otro dispositivo", "Pan del otro móvil" in page.inner_text(".items"))
    antes = page.evaluate("() => Marco.S.syncCount || 0")
    page.fill("#addInput", "leche"); page.press("#addInput", "Enter")
    page.clock.run_for(2500)
    page.wait_for_function("(n) => (Marco.S.syncCount || 0) > n", arg=antes, timeout=15000)
    names = sorted(x["name"] for x in box["state"]["compra"]["items"] if not x.get("deleted"))
    check("los dos aparatos conservan sus productos", names == ["Leche", "Pan del otro móvil"] and "Leche" in page.inner_text(".items") and "Pan del otro móvil" in page.inner_text(".items"), names)
    page.click("#rail [data-go=ninos]"); page.wait_for_selector(".kid-chips")
    check("llegan las estrellas del otro dispositivo", "Peque B ⭐ 2" in page.inner_text(".kid-chips"), page.inner_text(".kid-chips"))
    page.click("[data-chore=cama][data-kid=peque-a]")
    page.evaluate("() => Sync.syncNow()")
    page.wait_for_function("() => { const k = JSON.parse(localStorage.getItem('marco-v2.ninos')||'{}'); return (k.stars||{})['peque-a'] >= 1 && (k.stars||{})['peque-b'] >= 2; }")
    check("una estrella local no borra la del otro", "Peque A ⭐ 1" in page.inner_text(".kid-chips") and "Peque B ⭐ 2" in page.inner_text(".kid-chips"))
    page.click("#rail [data-go=hoy]")
    antes_hecha = page.evaluate("() => Marco.S.syncCount || 0")
    page.locator(".week [data-ev]", has_text="Reunión de ejemplo").first.click()
    page.click("[data-done]")
    page.evaluate("() => Sync.syncNow()")
    page.wait_for_function("(n) => (Marco.S.syncCount || 0) > n", arg=antes_hecha, timeout=15000)
    check("marcar hecha se guarda para sincronizar", any(v.get("on") for v in box["state"].get("hechas", {}).values()))
    page.click("[data-close]")
    page.click("#rail [data-go=compra]"); page.wait_for_selector("[data-act=hazCesta]")
    check("botón Haz la cesta presente", page.inner_text("[data-act=hazCesta]") == "Haz la cesta")
    page.click("#rail [data-go=ajustes]"); page.wait_for_selector("#syncKey")
    page.click("[data-act=exportJson]"); page.wait_for_selector(".share-ta")
    exported = json.loads(page.input_value(".share-ta"))
    check("exportar no incluye URL ni clave", "syncUrl" not in exported.get("settings", {}) and "syncKey" not in exported.get("settings", {}) and "clave-de-ejemplo" not in page.input_value(".share-ta"))
    page.click("[data-close]")
    page.fill("#syncKey", "clave-mala-123")
    page.click("[data-act=saveSync]")
    page.wait_for_function("() => { const s = document.querySelector('#syncStatus'); return s && s.textContent.toLowerCase().includes('clave'); }", timeout=20000)
    check("clave incorrecta no borra la lista local", "Pan del otro móvil" in page.evaluate("() => JSON.parse(localStorage.getItem('marco-v2.compra')).items.map(x => x.name).join(',')"))
    page.fill("#syncKey", "clave-de-ejemplo")
    page.click("[data-act=saveSync]")
    page.wait_for_function("() => { const s = document.querySelector('#syncStatus'); return s && s.className.indexOf('ok') !== -1; }", timeout=20000)
    box["fail"] = True
    page.evaluate("""() => Sync.syncNow()""")
    page.wait_for_function("() => document.querySelector('#offline') && !document.querySelector('#offline').classList.contains('hidden')")
    offsync = page.inner_text("#offline")
    check("si el script falla sigue el aviso y los datos locales", offsync.startswith("Sin sincronizar") and "Leche" in page.evaluate("() => JSON.parse(localStorage.getItem('marco-v2.compra')).items.map(x => x.name).join(',')"), offsync)
    box["fail"] = False
    page.evaluate("""() => { const s = JSON.parse(localStorage.getItem('marco-v2.settings'));
      s.calendars = [{ id: 'f', name: 'Festivos', color: '#8E5BC8', url: 'https://calendar.google.com/calendar/ical/es.spain%23holiday%40group.v.calendar.google.com/public/basic.ics', background: false }];
      s.proxy = '/proxy?url='; localStorage.setItem('marco-v2.settings', JSON.stringify(s)); }""")
    box["fail"] = True
    page.reload(); page.wait_for_selector(".hoy")
    page.wait_for_function("() => Marco.S.calStatus && Marco.S.calStatus.f", timeout=20000)
    fb = page.evaluate("() => ({ demo: Marco.demoOn(), ok: Marco.S.calStatus.f && Marco.S.calStatus.f.ok, n: Marco.S.events.length, off: document.querySelector('#offline').classList.contains('hidden') })")
    check("si el script falla, el iCal de respaldo sigue cargando", (not fb["demo"]) and fb["ok"] and fb["n"] > 3 and not fb["off"], fb)
    ctx.close()

    # ================= 2c) Salud con respuestas simuladas (sin Garmin real) =================
    def salud_payload(stale=False):
        days = []
        start = dt.date(2026, 10, 15)
        for i in range(7):
            d = start + dt.timedelta(days=i)
            last = i == 6
            days.append({
                "date": d.isoformat(),
                "steps": 12345 if last else 1000 * (i + 1),
                "restingHr": 48,
                "bodyBatteryMin": 22,
                "bodyBatteryMax": 95,
                "sleepSeconds": 28800 if last else 25200,
                "sleepScore": 91 if last else 70,
                "deepSeconds": 5400, "lightSeconds": 14400, "remSeconds": 7200, "awakeSeconds": 1800,
                "hrv": 62 if last else 40 + i, "hrvWeekly": 55, "hrvStatus": "BALANCED"
            })
        return {
            "ok": True, "stale": stale, "demo": False,
            "fetchedAt": "2026-10-21T16:00:00.000Z", "from": "2026-10-15", "to": "2026-10-21",
            "stepsGoal": 9000, "days": days,
            "workouts": [
                {"date": "2026-10-20", "start": "2026-10-20T18:30:00", "type": "rowing", "name": "Remo de ejemplo", "duration": 1500, "distance": 4000, "avgHr": 136, "calories": 320},
                {"date": "2026-10-18", "start": "2026-10-18T09:00:00", "type": "running", "name": "Carrera de prueba", "duration": 2400, "distance": 7000, "avgHr": 150, "calories": 500},
                {"date": "2026-10-16", "start": "2026-10-16T12:00:00", "type": "yoga", "name": "Yoga de ejemplo", "duration": 1800, "distance": 0, "avgHr": 90, "calories": 120}
            ]
        }

    ctx, page = new_page(b, 1024, 768, dt.datetime(2026, 10, 21, 17, 45, tzinfo=TZ))
    salud_box = {"mode": "ok", "n": 0, "key_in_url": False}

    def handle_salud(route):
        req = route.request
        if "key=" in (req.url or ""):
            salud_box["key_in_url"] = True
        try:
            body = json.loads(req.post_data or "{}")
        except Exception:
            body = {}
        if body.get("key") != "clave-de-ejemplo":
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": False, "error": "Clave incorrecta"}))
        action = body.get("action")
        if action == "salud":
            salud_box["n"] += 1
            if salud_box["mode"] == "down":
                return route.abort()
            if salud_box["mode"] == "error":
                return route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": False, "error": "Sin datos de Garmin"}))
            return route.fulfill(status=200, content_type="application/json", body=json.dumps(salud_payload(salud_box["mode"] == "stale")))
        if action == "calendars":
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True, "calendars": [], "events": []}))
        if action == "sync":
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True, "state": body.get("state") or {}}))
        return route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True}))

    page.route("**/__marco_salud", handle_salud)
    page.goto(BASE); page.wait_for_selector(".hoy"); page.clock.run_for(400)
    check("salud de ejemplo en Ahora", "EJEMPLO" in page.inner_text(".salud-mini") and "Sin datos de Garmin" not in page.inner_text(".salud-mini"))
    tab = page.evaluate("""() => {
      const rail = document.querySelector('#rail').getBoundingClientRect();
      const screen = document.querySelector('#screen').getBoundingClientRect();
      const menu = document.querySelector('.hoy-menu').getBoundingClientRect();
      const next = document.querySelector('.next').getBoundingClientRect();
      return { left: rail.right <= screen.left + 1, vertical: rail.height > rail.width, menu: menu.right <= next.left + 2 };
    }""")
    check("tablet apaisada: menú a la izquierda y semanal en la columna izquierda", tab["left"] and tab["vertical"] and tab["menu"], tab)
    page.screenshot(path=os.path.join(OUT, "13-tablet-hoy.png"))
    page.click("#rail [data-go=salud]"); page.wait_for_selector(".salud")
    page.wait_for_selector(".trend-card")
    demo_txt = page.inner_text(".salud")
    check("salud de ejemplo, con sueño, pasos y entrenos", "Datos de ejemplo" in demo_txt and "no son de tu Garmin" in demo_txt and "Sueño de anoche" in demo_txt and "Pasos de hoy" in demo_txt and "Carrera de ejemplo" in demo_txt and "Remo de ejemplo" not in demo_txt and page.locator(".trend-card").count() == 6 and page.locator(".wo").count() >= 3 and "EJEMPLO" in demo_txt)
    hoy_ej = page.inner_text(".salud-hoy").lower()
    check("salud de ejemplo: franja Hoy", page.locator(".salud-hoy").count() == 1 and "sueño" in hoy_ej and "descanso" in hoy_ej and "batería" in hoy_ej and page.get_attribute("[data-entreno]", "data-entreno") == "descanso")
    trends = page.evaluate("""() => {
      const d = Salud.demo(U.now());
      const t7 = Salud.trends(d, 7, U.now());
      const t28 = Salud.trends(d, 28, U.now());
      const steps = t7.find(m => m.key === 'steps');
      const peso = t28.find(m => m.key === 'weightGrams');
      const pulso = t7.find(m => m.key === 'restingHr');
      const gapSvg = Salud.chartSvg(
        [{ date: '2026-10-01', steps: 1000 }, { date: '2026-10-02' }, { date: '2026-10-03', steps: 0 }],
        'steps', '#3BA55C', 'int', 'pasos');
      const card = document.querySelector('[data-metric=steps]');
      return {
        days: d.days.length,
        demo: !!d.demo,
        nullSteps: d.days.filter(x => x.steps == null).length,
        zeroSteps: d.days.filter(x => x.steps === 0).length,
        nullWeight: d.days.filter(x => x.weightGrams == null).length,
        steps: { avg: steps.avg, delta: steps.delta, points: steps.count, gaps: steps.days.filter(x => Salud.num(x.steps) == null).length, circles: card.querySelectorAll('circle').length, domGaps: +card.dataset.gaps },
        pulso: { cur: pulso.current, avg: pulso.avg, delta: pulso.delta },
        peso: { cur: peso.current, avg: peso.avg, delta: peso.delta, gaps: peso.days.filter(x => Salud.num(x.weightGrams) == null).length },
        gapCircles: (gapSvg.match(/<circle /g) || []).length,
        gapLines: (gapSvg.split('<polyline').length - 1),
        keys: t7.map(m => m.key).join(',')
      };
    }""")
    check("demo: 28 días con huecos y sin ceros inventados", trends["days"] == 28 and trends["demo"] and trends["nullSteps"] >= 1 and trends["zeroSteps"] == 0 and trends["nullWeight"] >= 1 and trends["keys"] == "restingHr,hrv,steps,weightGrams,sleepSeconds,trainingSeconds", trends)
    check("demo: pasos a 7 días, media, variación y hueco sin punto", trends["steps"]["avg"] and trends["steps"]["delta"] is not None and trends["steps"]["gaps"] >= 1 and trends["steps"]["circles"] == trends["steps"]["points"] and trends["steps"]["domGaps"] == trends["steps"]["gaps"], trends["steps"])
    check("demo: pulso con valor, media y variación", trends["pulso"]["cur"] and trends["pulso"]["avg"] and trends["pulso"]["delta"] is not None, trends["pulso"])
    check("un cero real se pinta y un hueco no une la línea", trends["gapCircles"] == 2 and trends["gapLines"] == 0, trends)
    check("textos de las tendencias", "Pulso en reposo" in demo_txt and "Peso" in demo_txt and "VFC" in demo_txt and "Pasos" in demo_txt and "Descanso" in demo_txt and "Entreno" in demo_txt and "día sin dato" in demo_txt and "respecto a los 7 días anteriores" in demo_txt)
    page.screenshot(path=os.path.join(OUT, "14-salud-ejemplo.png"))
    check("tablet 1024: Salud sin scroll horizontal", page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
    page.set_viewport_size({"width": 1280, "height": 1500})
    page.evaluate("() => document.querySelector('.salud').scrollIntoView({block:'start'})")
    page.wait_for_timeout(150)
    check("tablet: tendencias de 7 días sin scroll horizontal", page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
    page.screenshot(path=os.path.join(OUT, "16-salud-tendencia-7.png"))
    page.click('[data-range="28"]')
    page.wait_for_function("() => document.querySelector('[data-range=\"28\"]').getAttribute('aria-pressed') === 'true'")
    page.evaluate("() => document.querySelector('.salud').scrollIntoView({block:'start'})")
    page.wait_for_timeout(150)
    wide28 = page.inner_text(".salud-trends")
    peso28 = page.evaluate("""() => {
      const m = Salud.trends(Salud.demo(U.now()), 28, U.now()).find(x => x.key === 'weightGrams');
      const card = document.querySelector('[data-metric=weightGrams]');
      return { cur: m.current, avg: m.avg, delta: m.delta, circles: card.querySelectorAll('circle').length, points: +card.dataset.points, gaps: +card.dataset.gaps };
    }""")
    check("demo: peso a 28 días con media, variación y huecos", "respecto a los 28 días anteriores" in wide28 and "7 días anteriores" not in wide28 and peso28["cur"] and peso28["avg"] and peso28["delta"] is not None and peso28["circles"] == peso28["points"] and peso28["gaps"] > peso28["points"], peso28)
    check("tablet: tendencias de 28 días sin scroll horizontal", page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
    page.screenshot(path=os.path.join(OUT, "17-salud-tendencia-28.png"))
    page.click('[data-range="7"]')
    page.set_viewport_size({"width": 1024, "height": 768})
    page.click("#rail [data-go=ajustes]"); page.wait_for_selector("#syncUrl")
    page.fill("#syncUrl", BASE.rstrip("/") + "/__marco_salud")
    page.fill("#syncKey", "clave-de-ejemplo")
    page.click("[data-act=saveSync]")
    page.wait_for_function("() => { const s = document.querySelector('#syncStatus'); return s && s.className.indexOf('ok') !== -1; }", timeout=20000)
    page.click("#rail [data-go=salud]"); page.wait_for_selector(".salud")
    page.wait_for_function("() => document.body.innerText.includes('91')")
    real = page.inner_text(".salud")
    check("salud usa la respuesta simulada y no el ejemplo", "91" in real and "12.345" in real and "Remo de ejemplo" in real and "Equilibrada" in real and "Datos de ejemplo" not in real and "22" in real and "95" in real, real[:240])
    check("la clave no va en la URL de salud", not salud_box["key_in_url"] and salud_box["n"] >= 1)
    stored = page.evaluate("() => localStorage.getItem('marco-v2.cache.salud') || ''")
    check("la copia local no guarda la clave", stored.startswith("{") and "clave-de-ejemplo" not in stored and "GARMIN" not in stored and "Bearer" not in stored)
    check("salud se pide al cargar y el intervalo es 30 min", page.evaluate("() => Marco.SALUD_EVERY === 30 * 60000 && Marco.S.saludLoads >= 1"))
    salud_box["mode"] = "stale"
    page.evaluate("() => Marco.loadSalud().then(() => Marco.render())")
    page.wait_for_function("() => document.body.innerText.includes('sin actualizar')")
    check("si Garmin marca la copia como antigua, se avisa", "sin actualizar" in page.inner_text(".salud-note"))
    salud_box["mode"] = "down"
    page.evaluate("() => Marco.loadSalud().then(() => Marco.render())")
    kept = page.inner_text(".salud")
    check("si Garmin no responde se queda la última copia", "12.345" in kept and "Remo de ejemplo" in kept and "Sin datos de Garmin" not in kept)
    page.evaluate("() => { localStorage.removeItem('marco-v2.cache.salud'); Marco.S.salud = null; }")
    salud_box["mode"] = "error"
    page.evaluate("() => Marco.loadSalud().then(() => Marco.render())")
    page.wait_for_selector(".salud-empty")
    check("sin copia y sin Garmin: Sin datos de Garmin", page.inner_text(".salud-empty").startswith("💓 Salud") or "Sin datos de Garmin" in page.inner_text(".salud-empty"))
    ctx.close()

    ctx, page = new_page(b, 390, 844, dt.datetime(2026, 10, 21, 20, 30, tzinfo=TZ), mobile=True)
    page.goto(BASE); page.wait_for_selector(".salud-mini"); page.clock.run_for(300)
    page.click("#rail [data-go=salud]"); page.wait_for_selector(".salud-note")
    check("móvil: salud de ejemplo visible", "Datos de ejemplo" in page.inner_text(".salud") and "Sueño de anoche" in page.inner_text(".salud") and "EJEMPLO" in page.inner_text(".salud"))
    movil_trend = page.evaluate("""() => {
      const cards = Array.prototype.slice.call(document.querySelectorAll('.trend-card'));
      if (cards.length < 2) return { ok: false, n: cards.length };
      const a = cards[0].getBoundingClientRect();
      const b = cards[1].getBoundingClientRect();
      return { ok: b.top >= a.bottom - 2 && document.documentElement.scrollWidth <= innerWidth + 1, n: cards.length, top: Math.round(b.top - a.bottom) };
    }""")
    check("móvil: tendencias en una columna y sin scroll horizontal", movil_trend.get("ok"), movil_trend)
    phone_rail = page.evaluate("""() => {
      const rail = document.querySelector('#rail').getBoundingClientRect();
      const screen = document.querySelector('#screen').getBoundingClientRect();
      return rail.right <= screen.left + 1 && rail.height > rail.width && rail.top < 30;
    }""")
    check("móvil en Salud: el menú sigue a la izquierda", phone_rail)
    page.screenshot(path=os.path.join(OUT, "15-salud-movil.png"))
    ctx.close()

    # ================= 3) Ajustes privados importados (NO se hacen capturas) =================
    if PRIV and os.path.exists(PRIV):
        priv = json.load(open(PRIV, encoding="utf-8"))
        names = [k["name"] for k in priv["advanced"]["kids"]]
        ctx, page = new_page(b, 1280, 800, dt.datetime(2026, 10, 21, 12, 0, tzinfo=TZ))
        page.goto(BASE); page.wait_for_selector(".hoy"); page.clock.run_for(1000)
        body = page.inner_text("body")
        check("sin ajustes no aparece ningún nombre privado", not any(n in body for n in names + [priv["advanced"]["otherParent"], priv["advanced"]["parent"]]))
        page.click("#rail [data-go=ajustes]"); page.wait_for_selector("#impTxt")
        page.fill("#impTxt", json.dumps(priv))
        page.click("[data-act=importJson]")
        page.clock.run_for(1000); page.wait_for_load_state(); page.wait_for_selector(".hoy"); page.clock.run_for(1000)
        check("importar ajustes privados desde Ajustes", page.evaluate("Marco.CFG.kids.map(k => k.name)") == names)
        badge = page.locator(".custody-badge")
        check("privado: 21/10/2026 = con el otro progenitor", badge.get_attribute("data-custody") == "otro" and priv["advanced"]["otherParent"] in badge.inner_text())
        cust = page.evaluate("""() => ({
          d23a: Custody.withParent(new Date(2026,9,23,16,59)), d23b: Custody.withParent(new Date(2026,9,23,17,0)),
          d24: Custody.withParent(new Date(2026,9,24,10,0)), d29: Custody.withParent(new Date(2026,9,29,23,0)),
          d30a: Custody.withParent(new Date(2026,9,30,16,59)), d30b: Custody.withParent(new Date(2026,9,30,17,1)),
          d06: Custody.withParent(new Date(2026,10,6,18,0)), d14: Custody.withParent(new Date(2026,10,14,12,0)), d21: Custody.withParent(new Date(2026,10,21,12,0)),
          next: Custody.nextHandover(new Date(2026,9,21,12,0)).at.toString() })""")
        check("privado: vie 23/10 16:59 otro / 17:00 contigo", (not cust["d23a"]) and cust["d23b"])
        check("privado: 24/10 y 29/10 contigo", cust["d24"] and cust["d29"])
        check("privado: vie 30/10 16:59 contigo / 17:01 otro", cust["d30a"] and not cust["d30b"])
        check("privado: 6/11 contigo, 14/11 otro, 21/11 contigo (tras cambio de hora)", cust["d06"] and not cust["d14"] and cust["d21"])
        check("privado: siguiente cambio vie 23/10 17:00", "Fri Oct 23 2026 17:00" in cust["next"], cust["next"])
        check("privado: jornada L–J 08:00–16:30 y V 08:00–14:00", "08:00–16:30" in page.inner_text(".day.is-today .shift") and "08:00–14:00" in page.locator(".day").nth(2).inner_text())
        ctx.close()
        ctx, page = new_page(b, 1280, 800, dt.datetime(2026, 10, 24, 10, 0, tzinfo=TZ))
        page.goto(BASE); page.wait_for_selector(".hoy"); set_ajustes(page, priv)
        badge = page.locator(".custody-badge")
        check("privado: 24/10/2026 = contigo", badge.get_attribute("data-custody") == "padre" and priv["advanced"]["parent"] in badge.inner_text())
        ctx.close()
    else:
        check("ajustes privados encontrados (MARCO_AJUSTES)", False, "no se probó la custodia real")

    # ================= 4) Bajo una subruta =================
    if SUB:
        ctx, page = new_page(b, 1280, 800, dt.datetime(2026, 10, 21, 17, 45, tzinfo=TZ))
        bad = []
        page.on("response", lambda r: bad.append(f"{r.status} {r.url}") if r.status >= 400 and r.url.startswith(SUB.split('/marco')[0]) else None)
        page.goto(SUB); page.wait_for_selector(".hoy"); page.clock.run_for(1000); wait_data(page)
        ok = True
        for tab, sel in [("calendario", ".cal-week"), ("luz", ".luz"), ("dinero", ".dinero"), ("plazos", ".plazos"), ("ninos", ".ninos"), ("semana", ".semana"), ("compra", ".compra"), ("menu", ".menu"), ("salud", ".salud"), ("ajustes", ".ajustes"), ("hoy", ".hoy")]:
            page.click(f"#rail [data-go={tab}]"); page.wait_for_selector(sel)
        check("subruta: todas las pestañas y sin 404", not bad and page.evaluate("getComputedStyle(document.body).backgroundColor") == "rgb(247, 238, 226)", bad)
        ctx.close()
    b.close()

real_errors = [e for e in errors if "calendar.google.com" not in e and "Access-Control" not in e and "ERR_FAILED" not in e]
check("sin errores JS", not real_errors, real_errors[:5])
if netwarn: print("Aviso (servicios externos):", netwarn[:5])
print("\n%d/%d pruebas OK" % (sum(1 for r in results if r[1]), len(results)))
sys.exit(0 if all(r[1] for r in results) else 1)
