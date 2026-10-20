#!/usr/bin/env python3
"""Genera index.html a partir de episodes.json + ep/<id>.mp3 + ep/<id>.md"""
import json, html, re, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
eps=json.load(open('episodes.json'))
def md2html(md):
    out=[]
    for block in md.split('\n\n'):
        b=block.strip()
        if not b: continue
        if b.startswith('# '): continue  # el título ya va en la tarjeta
        if b.startswith('Por '): continue
        m=re.match(r'^(#{2,3}) (.*)',b)
        if m: out.append(f'<h3>{html.escape(m.group(2))}</h3>'); continue
        if b.startswith('- '): out.append(f'<ul><li>{html.escape(b[2:])}</li></ul>'); continue
        if re.match(r'^1\.\s',b): out.append(f'<ol><li>{html.escape(b[3:])}</li></ol>'); continue
        if b.startswith('>'):
            ps=[re.sub(r'^>\s?','',l) for l in b.split('\n') if re.sub(r'^>\s?','',l).strip()]
            out.append('<blockquote>'+''.join(f'<p>{html.escape(p)}</p>' for p in ps)+'</blockquote>'); continue
        out.append(f'<p>{html.escape(b)}</p>')
    return '\n'.join(out).replace('</ul>\n<ul>','\n').replace('</ol>\n<ol>','\n')
cards=[]
for e in eps:
    i=e['id']; txt=md2html(open(f'ep/{i}.md').read())
    btns=''.join(f'<button class="sp" data-r="{s}">{str(s).replace(".",",")}×</button>' for s in [0.75,1,1.25,1.5,1.75,2])
    cards.append(f'''<section class="ep" data-id="{i}">
<h2>{html.escape(e['title'])}</h2>
<div class="meta">{html.escape(e['author'])} · {e.get('duration','')} · <a href="{e.get('source','#')}">original</a></div>
<audio controls preload="metadata" src="ep/{i}.mp3"></audio>
<div class="speeds">{btns}</div>
<div class="nav"><button class="bk">⟲ 15 s</button><button class="pp">▶︎ Reproducir</button><button class="fw">30 s ⟳</button></div>
<div class="pos"></div>
<details><summary>Leer el texto</summary><div class="txt">{txt}</div></details>
</section>''')
page='''<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Podcasts">
<meta name="robots" content="noindex,nofollow">
<title>Vinilos para pensar</title>
<style>
:root{color-scheme:light dark}
body{font-family:-apple-system,system-ui,sans-serif;margin:0;padding:16px 14px calc(30px + env(safe-area-inset-bottom));max-width:760px;margin:auto;line-height:1.55;background:#f4f4f6;color:#1c1c1e}
@media(prefers-color-scheme:dark){body{background:#000;color:#eee}.ep{background:#1c1c1e!important}button{background:#2c2c2e!important;color:#eee!important;border-color:#444!important}button.on{background:#0a84ff!important;color:#fff!important}.meta,.pos{color:#aaa!important}}
h1{font-size:1.6rem;margin:6px 4px 14px}
.ep{background:#fff;border-radius:16px;padding:14px;margin-bottom:18px;box-shadow:0 1px 4px #0001}
.ep h2{font-size:1.15rem;margin:0 0 4px}.meta{color:#666;font-size:.9rem;margin-bottom:10px}.meta a{color:inherit}
audio{width:100%}
.speeds{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
.nav{display:grid;grid-template-columns:1fr 1.4fr 1fr;gap:8px;margin-top:8px}
button{font-size:1.15rem;padding:14px 4px;border-radius:12px;border:1px solid #ccc;background:#fff;color:#1c1c1e;-webkit-tap-highlight-color:transparent}
button.on{background:#007aff;color:#fff;border-color:#007aff;font-weight:600}
.pos{font-size:.85rem;color:#666;margin-top:6px;text-align:center}
details{margin-top:12px}summary{font-weight:600;padding:8px 0;cursor:pointer}
.txt h3{font-size:1.05rem;margin-top:1.2em}blockquote{border-left:4px solid #999;margin:0;padding-left:12px;opacity:.85}
</style></head><body>
<h1>🎧 Vinilos para pensar</h1>
'''+'\n'.join(cards)+'''
<script>
const fmt=s=>{s=Math.floor(s||0);const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=String(s%60).padStart(2,'0');return (h?h+':'+String(m).padStart(2,'0'):m)+':'+x};
document.querySelectorAll('.ep').forEach(ep=>{
  const id=ep.dataset.id,a=ep.querySelector('audio'),KP='pos:'+id,KR='rate:'+id,pos=ep.querySelector('.pos'),pp=ep.querySelector('.pp');
  const sps=ep.querySelectorAll('.sp');
  const rate=()=>parseFloat(localStorage.getItem(KR)||'1');
  const setR=r=>{a.defaultPlaybackRate=r;a.playbackRate=r;a.preservesPitch=true;a.webkitPreservesPitch=true;localStorage.setItem(KR,r);sps.forEach(b=>b.classList.toggle('on',parseFloat(b.dataset.r)===r))};
  sps.forEach(b=>b.onclick=()=>setR(parseFloat(b.dataset.r)));
  setR(rate());
  let restored=false;
  a.addEventListener('loadedmetadata',()=>{if(!restored){const p=parseFloat(localStorage.getItem(KP)||'0');if(p>0&&p<a.duration-5)a.currentTime=p;restored=true}upd()});
  a.addEventListener('play',()=>{a.playbackRate=rate();document.querySelectorAll('audio').forEach(o=>{if(o!==a)o.pause()});pp.textContent='❚❚ Pausa'});
  a.addEventListener('pause',()=>{pp.textContent='▶︎ Reproducir';localStorage.setItem(KP,a.currentTime)});
  a.addEventListener('ratechange',()=>{if(Math.abs(a.playbackRate-rate())>0.01&&a.playbackRate>0)setR(a.playbackRate)});
  const upd=()=>{pos.textContent=fmt(a.currentTime)+' / '+fmt(a.duration)+' · quedan '+fmt((a.duration-a.currentTime)/rate())+' a '+String(rate()).replace('.',',')+'×'};
  a.addEventListener('timeupdate',()=>{upd();if(!a.paused)localStorage.setItem(KP,a.currentTime)});
  a.addEventListener('ended',()=>localStorage.setItem(KP,0));
  const seek=d=>{a.currentTime=Math.max(0,Math.min((a.duration||1e9)-1,a.currentTime+d))};
  ep.querySelector('.bk').onclick=()=>seek(-15);
  ep.querySelector('.fw').onclick=()=>seek(30);
  pp.onclick=()=>a.paused?a.play():a.pause();
  const p=parseFloat(localStorage.getItem(KP)||'0');if(p>0)pos.textContent='Seguirás en '+fmt(p);
  if('mediaSession' in navigator){a.addEventListener('play',()=>{navigator.mediaSession.metadata=new MediaMetadata({title:ep.querySelector('h2').textContent,artist:ep.querySelector('.meta').textContent.split(' · ')[0],album:'Vinilos para pensar'});navigator.mediaSession.setActionHandler('seekbackward',()=>seek(-15));navigator.mediaSession.setActionHandler('seekforward',()=>seek(30))})}
});
</script></body></html>'''
open('index.html','w').write(page); print('ok',len(eps),'episodios')
