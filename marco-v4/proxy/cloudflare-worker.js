/**
 * Proxy CORS mínimo para leer calendarios iCal de Google desde el navegador del marco.
 * NO está desplegado. Para usarlo (necesita tu cuenta de Cloudflare):
 *   npx wrangler deploy proxy/cloudflare-worker.js --name marco-ics --compatibility-date 2026-10-01
 *   npx wrangler secret put PROXY_KEY --name marco-ics      (una clave larga inventada)
 * En el marco, Ajustes → Proxy CORS:
 *   https://marco-ics.<tu-subdominio>.workers.dev/?key=<PROXY_KEY>&url=
 *
 * Seguridad:
 * - Solo reenvía a calendar.google.com (lista ALLOWED_HOSTS), así no es un proxy abierto.
 * - Con PROXY_KEY nadie más puede usar tu Worker.
 * - No guarda nada ni registra la URL. La dirección secreta viaja por HTTPS a TU Worker.
 * - Opcional: variable ALLOW_ORIGIN (p. ej. https://tu-usuario.github.io) para limitar el origen.
 */
const ALLOWED_HOSTS = ['calendar.google.com'];

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': (env && env.ALLOW_ORIGIN) || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
const reply = (body, status, env, extra) => new Response(body, { status, headers: Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, corsHeaders(env), extra || {}) });

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return reply(null, 204, env);
    if (request.method !== 'GET') return reply('Método no permitido', 405, env);
    const u = new URL(request.url);
    if (env.PROXY_KEY && u.searchParams.get('key') !== env.PROXY_KEY) return reply('Clave incorrecta', 403, env);
    let target;
    try { target = new URL(u.searchParams.get('url') || ''); } catch (e) { return reply('Falta ?url=', 400, env); }
    if (target.protocol !== 'https:' || !ALLOWED_HOSTS.includes(target.hostname) || !target.pathname.startsWith('/calendar/ical/')) {
      return reply('Destino no permitido', 403, env);
    }
    const res = await fetch(target.toString(), { headers: { 'User-Agent': 'marco-familiar-ics-proxy' }, cf: { cacheTtl: 300, cacheEverything: true } });
    const finalHost = new URL(res.url || target.toString()).hostname;
    if (!ALLOWED_HOSTS.includes(finalHost)) return reply('Redirección no permitida', 502, env);
    if (!res.ok) return reply('Google respondió ' + res.status, res.status, env);
    return new Response(res.body, {
      status: 200,
      headers: Object.assign({ 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=300', 'Referrer-Policy': 'no-referrer' }, corsHeaders(env))
    });
  }
};
