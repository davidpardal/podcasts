#!/usr/bin/env python3
"""Genera timings.json: segundo de inicio de cada línea (párrafo) de ep/<id>.md.
Usa la duración real de cada trozo TTS (chunks/*.mp3) como ancla y reparte
dentro de cada trozo por número de caracteres. Si no hay trozos, el reproductor
estima de forma proporcional sobre la duración total."""
import json, re, subprocess, os
BASE='/workspace/podcasts'
EPS={'hussain-vender':'hussainibarra','dankoe-human30':'dankoe'}
def dur(f):
    return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f]).decode())
def md_lines(md):
    out=[]
    for l in md.split('\n'):
        s=l.strip()
        if not s or s=='>': continue
        if re.match(r'^Por [^.]{2,40}$',s) and len(out)==1: continue  # línea de autor
        out.append(s)
    return out
res={}
for ep,d in EPS.items():
    md=open(f'{BASE}/web/ep/{ep}.md').read()
    lines=md_lines(md)
    narr=open(f'{BASE}/{d}/narracion.txt').read()
    chunks=[c for c in narr.split('\n\n\n\n') if c.strip()]
    order=[re.sub(r"^file '|'$",'',x.strip()) for x in open(f'{BASE}/{d}/list.txt') if x.strip()]
    # duración por trozo de texto (agrupando a/b) + silencio tras cada archivo
    files=[f for f in order if not f.endswith('sil.mp3')]
    sil=dur(f'{BASE}/{d}/chunks/sil.mp3')
    groups={}
    for f in files:
        k=re.search(r'c(\d{3})',f).group(1); groups.setdefault(k,[]).append(f)
    keys=sorted(groups)
    assert len(keys)==len(chunks),(ep,len(keys),len(chunks))
    paras_per_chunk=[[p for p in c.strip().split('\n\n') if p.strip()] for c in chunks]
    n=sum(len(p) for p in paras_per_chunk)
    assert n==len(lines),(ep,n,len(lines))
    starts=[];t=0.0
    for k,ps in zip(keys,paras_per_chunk):
        fs=groups[k]
        # si el trozo se partió (a/b), cada mitad tiene su propia duración
        if len(fs)==1: parts=[(ps,dur(fs[0]))]
        else:
            h=len(ps)//2; parts=[(ps[:h],dur(fs[0])),(ps[h:],dur(fs[1]))]
        for pp,dd in parts:
            tot=sum(len(p)+12 for p in pp)  # +12: pausa aprox. entre párrafos
            for p in pp:
                starts.append(round(t,2)); t+=dd*(len(p)+12)/tot
            t+=sil
    total=dur(f'{BASE}/web/ep/{ep}.mp3')
    print(ep,len(starts),'calc end',round(t,1),'real',round(total,1))
    res[ep]=starts
json.dump(res,open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'timings.json'),'w'))
