#!/usr/bin/env python3
"""Genera vinilo/index.html (versión de prueba estilo vinilo) desde template.html,
../episodes.json y timings.json (tiempos por párrafo; ver build_timings.py)."""
import json, os
D=os.path.dirname(os.path.abspath(__file__))
eps=json.load(open(os.path.join(D,'..','episodes.json')))
tp=os.path.join(D,'timings.json')
tim=json.load(open(tp)) if os.path.exists(tp) else {}
html=open(os.path.join(D,'template.html')).read()
html=html.replace('/*EPISODES*/[]',json.dumps(eps,ensure_ascii=False)).replace('/*TIMINGS*/{}',json.dumps(tim,separators=(',',':')))
open(os.path.join(D,'index.html'),'w').write(html)
print('ok',len(eps),'episodios',len(html),'bytes')
