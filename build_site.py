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
def secs(d):
    t=0
    for x in str(d or '0').split(':'): t=t*60+int(x or 0)
    return t
cards=[]
for n,e in enumerate(eps):
    i=e['id']; txt=md2html(open(f'ep/{i}.md').read())
    btns=''.join(f'<button class="sp" data-r="{s}">{str(s).replace(".",",")}×</button>' for s in [0.75,1,1.25,1.5,1.75,2])
    cards.append(f'''<section class="ep" data-id="{i}" data-n="{n}" data-dur="{secs(e.get('duration'))}">
<h2>{html.escape(e['title'])}</h2>
<div class="meta">{html.escape(e['author'])} · {e.get('duration','')} · <a href="{e.get('source','#')}">original</a></div>
<audio controls preload="metadata" src="ep/{i}.mp3"></audio>
<div class="speeds">{btns}</div>
<div class="nav"><button class="bk">⟲ 15 s</button><button class="pp">▶︎ Reproducir</button><button class="fw">30 s ⟳</button></div>
<div class="pos"></div>
<div class="bar"><i></i></div>
<button class="mk"></button>
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
h2.sec,summary.sec{display:flex;align-items:center;gap:10px;font-size:1.25rem;margin:22px 4px 12px;scroll-margin-top:12px}
.sec .n{font-size:.85rem;font-weight:600;padding:2px 10px;border-radius:999px;background:#0001}
#s-done>summary.sec{cursor:pointer;padding:0}
#s-done>summary.sec::after{content:'+';margin-left:auto;opacity:.6}#s-done[open]>summary.sec::after{content:'−'}
.seg{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 6px}
.bar{height:5px;border-radius:3px;background:#0001;overflow:hidden;margin-top:8px}.bar i{display:block;height:100%;width:0;background:#007aff}
.bar.z{display:none}
button.mk{width:100%;margin-top:10px;font-size:1rem;padding:12px 4px}
.ep.done{opacity:.92}.ep.done h2::before{content:'✓ ';color:#34c759}
.empty{padding:18px;text-align:center;opacity:.7;border:1px dashed #8886;border-radius:14px}
@media(prefers-color-scheme:dark){.sec .n,.bar{background:#ffffff1a!important}.bar i{background:#0a84ff}}
.txt h3{font-size:1.05rem;margin-top:1.2em}blockquote{border-left:4px solid #999;margin:0;padding-left:12px;opacity:.85}
</style></head><body>
<h1>🎧 Vinilos para pensar</h1>
<nav class="seg"><button data-go="s-pend">Sin escuchar (<b class="np">0</b>)</button><button data-go="s-done">Escuchados (<b class="nd">0</b>)</button></nav>
<h2 class="sec" id="s-pend">Sin escuchar <span class="n np">0</span></h2>
<div id="pend">
'''+'\n'.join(cards)+'''
</div>
<details id="s-done" open><summary class="sec">Escuchados <span class="n nd">0</span></summary><div id="done"></div></details>
<script>
const KD=id=>'done:'+id,THR=0.95,isDone=id=>!!localStorage.getItem(KD(id));
const EPS=[...document.querySelectorAll('.ep')];
// migración: lo guardado casi al final cuenta como escuchado (mismas claves que /vinilo/)
EPS.forEach(ep=>{const id=ep.dataset.id,d=+ep.dataset.dur,p=+localStorage.getItem('pos:'+id)||0;if(d&&p/d>=THR&&!isDone(id))localStorage.setItem(KD(id),String(Date.now()))});
function setDone(id,on){if(on){if(!isDone(id))localStorage.setItem(KD(id),String(Date.now()))}else{localStorage.removeItem(KD(id));const ep=EPS.find(x=>x.dataset.id===id),d=+ep.dataset.dur,p=+localStorage.getItem('pos:'+id)||0;if(d&&p/d>=THR){localStorage.setItem('pos:'+id,0);const a=ep.querySelector('audio');if(a.currentTime/(a.duration||d)>=THR)a.currentTime=0}}}
function place(){ // mueve cada episodio a su sección (sin tocar el que está sonando), del más nuevo al más antiguo
  let np=0,nd=0;
  EPS.forEach(ep=>{const id=ep.dataset.id,on=isDone(id),a=ep.querySelector('audio');on?nd++:np++;
    ep.classList.toggle('done',on);
    ep.querySelector('.mk').textContent=on?'↺ Marcar como pendiente':'✓ Marcar como escuchado';
    const d=a.duration||+ep.dataset.dur,p=Math.min(1,(a.currentTime||+localStorage.getItem('pos:'+id)||0)/d)||0;
    ep.querySelector('.bar').classList.toggle('z',on||p<0.01);ep.querySelector('.bar i').style.width=(p*100).toFixed(1)+'%';
    const box=document.getElementById(on?'done':'pend');
    if(ep.parentNode!==box&&a.paused){const next=[...box.children].find(x=>+x.dataset.n>+ep.dataset.n);box.insertBefore(ep,next||null)}});
  document.querySelectorAll('.np').forEach(x=>x.textContent=np);document.querySelectorAll('.nd').forEach(x=>x.textContent=nd);
  ['pend','done'].forEach(k=>{const b=document.getElementById(k);let m=b.querySelector('.empty');const has=b.querySelector('.ep');
    if(!has&&!m){m=document.createElement('p');m.className='empty';m.textContent=k==='pend'?'Lo tienes todo escuchado.':'Aún no has terminado ninguno. Se marcan solos al llegar al 95 %.';b.appendChild(m)}
    if(has&&m)m.remove()});
}
document.querySelector('.seg').onclick=ev=>{const b=ev.target.closest('button');if(!b)return;if(b.dataset.go==='s-done')document.getElementById('s-done').open=true;document.getElementById(b.dataset.go).scrollIntoView({behavior:'smooth'})};
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
  a.addEventListener('pause',()=>{pp.textContent='▶︎ Reproducir';localStorage.setItem(KP,a.currentTime);place()});
  a.addEventListener('ratechange',()=>{if(Math.abs(a.playbackRate-rate())>0.01&&a.playbackRate>0)setR(a.playbackRate)});
  const upd=()=>{pos.textContent=fmt(a.currentTime)+' / '+fmt(a.duration)+' · quedan '+fmt((a.duration-a.currentTime)/rate())+' a '+String(rate()).replace('.',',')+'×'};
  a.addEventListener('timeupdate',()=>{upd();if(!a.paused)localStorage.setItem(KP,a.currentTime);
    const d=a.duration||+ep.dataset.dur;ep.querySelector('.bar i').style.width=(Math.min(1,a.currentTime/d)*100).toFixed(1)+'%';
    if(d&&a.currentTime/d>=THR&&!isDone(id)){setDone(id,true);place()}});
  a.addEventListener('ended',()=>{localStorage.setItem(KP,0);setDone(id,true);place()});
  ep.querySelector('.mk').onclick=()=>{setDone(id,!isDone(id));place()};
  const seek=d=>{a.currentTime=Math.max(0,Math.min((a.duration||1e9)-1,a.currentTime+d))};
  ep.querySelector('.bk').onclick=()=>seek(-15);
  ep.querySelector('.fw').onclick=()=>seek(30);
  pp.onclick=()=>a.paused?a.play():a.pause();
  const p=parseFloat(localStorage.getItem(KP)||'0');if(p>0)pos.textContent='Seguirás en '+fmt(p);
  if('mediaSession' in navigator){a.addEventListener('play',()=>{navigator.mediaSession.metadata=new MediaMetadata({title:ep.querySelector('h2').textContent,artist:ep.querySelector('.meta').textContent.split(' · ')[0],album:'Vinilos para pensar'});navigator.mediaSession.setActionHandler('seekbackward',()=>seek(-15));navigator.mediaSession.setActionHandler('seekforward',()=>seek(30))})}
});
place();
addEventListener('storage',ev=>{if(ev.key&&/^(done|pos):/.test(ev.key))place()});
</script></body></html>'''
open('index.html','w').write(page); print('ok',len(eps),'episodios')
