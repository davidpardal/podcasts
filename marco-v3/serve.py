#!/usr/bin/env python3
"""Servidor local del marco: sirve los ficheros estáticos y, opcionalmente, un proxy
para los iCal de Google (que no mandan cabeceras CORS).

  python3 serve.py                 # http://127.0.0.1:8080 (solo este ordenador)
  python3 serve.py --host 0.0.0.0  # para abrirlo desde la tablet en la misma wifi

Si el marco abre la web desde este servidor, en Ajustes → Proxy CORS pon:  /proxy?url=
Solo reenvía a https://calendar.google.com/calendar/ical/… y no guarda ni registra las URL.
"""
import argparse, functools, http.server, os, urllib.parse, urllib.request

ALLOWED = {"calendar.google.com"}

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):  # no registrar rutas (pueden llevar la URL secreta)
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        if self.path.startswith("/proxy"):
            return self.proxy()
        return super().do_GET()

    def proxy(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        url = (q.get("url") or [""])[0]
        p = urllib.parse.urlparse(url)
        if p.scheme != "https" or p.hostname not in ALLOWED or not p.path.startswith("/calendar/ical/"):
            self.send_error(403, "Destino no permitido")
            return
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "marco-familiar"})
            with urllib.request.urlopen(req, timeout=20) as r:
                if urllib.parse.urlparse(r.geturl()).hostname not in ALLOWED:
                    self.send_error(502, "Redirección no permitida")
                    return
                body = r.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/calendar; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:  # noqa
            self.send_error(502, "No se pudo leer el calendario")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8080)
    a = ap.parse_args()
    root = os.path.dirname(os.path.abspath(__file__))
    srv = http.server.ThreadingHTTPServer((a.host, a.port), functools.partial(Handler, directory=root))
    print(f"Marco familiar en http://{a.host}:{a.port}  (Ctrl+C para parar)")
    srv.serve_forever()

if __name__ == "__main__":
    main()
