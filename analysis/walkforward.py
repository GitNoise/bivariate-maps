"""Walk-forward test helpers: shortfalls as known before each crisis period, crisis records, scoring."""
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # the repository
sys.path.insert(0, ROOT); sys.path.insert(0, os.path.join(ROOT, 'analysis'))
import statistics as st, sys, json, re
from math import comb
import build_data as B, trace as T
P=B.load_production(os.path.join(ROOT, 'data', 'cereal-production.csv'))
src=open(os.path.join(ROOT, 'js', 'data.js'),encoding='utf-8').read()
D=json.loads(re.search(r'^const DATA = (\{.*?\});\n',src,re.S|re.M).group(1))['world']
def periods(name):
    blk=re.search(r'^const '+name+r' = \{(.*?)^\};',src,re.S|re.M).group(1)
    return {m:set(re.findall(r"'(\d{4}–\d{2})'",ys)) for m,ys in re.findall(r"'(\d+)':\s*(\[[^\]]*\])", blk)}
FI=periods('FOOD_INSEC'); FIM=periods('FOOD_INSEC_MINOR')
def fisher(a,b,c,d):
    n1=a+b;K=a+c;N=a+b+c+d
    return sum(comb(K,x)*comb(N-K,n1-x)/comb(N,n1) for x in range(a,min(K,n1)+1))
SA={'426','454','508','516','710','716','894','748','072','024','450'}
ROUNDS=[('2015–16',2009,2014),('2023–24',2018,2022)]
RC=T.roni_class(); RONI_EN={y for y,c in RC.items() if c=='El Niño'}; RONI_NEU={y for y,c in RC.items() if c=='neutral'}
def anom(m,frac):
    ser={y:v for y,v in P[m].items() if y<=B.PROD_LAST}; yrs=[y for y in sorted(ser) if y>=1975 and ser[y]>0]
    tr=B.lowess(yrs,[ser[y] for y in yrs],frac=frac); return {y:(ser[y]/t-1)*100 for y,t in zip(yrs,tr) if t>0 and y>=1980}
AN={(m,f):anom(m,f) for m,r in D.items() if r.get('hgap') is not None and m in P for f in (0.3,0.75)}
def shortfall(m,lo,lh,en=None,neu=None,frac=0.3,drop=()):
    en=en or B.EL_NINO; neu=neu or B.NEUTRAL; lag=1 if m in B.LAG1 else 0; an=AN[(m,frac)]
    a=[v for y,v in an.items() if y-lag in en and y-lag<=lo and y<=lh and y-lag not in drop]
    b=[v for y,v in an.items() if y-lag in neu and y<=lh]
    if len(a)<6 or len(b)<7: return None
    return -(((1+st.mean(a)/100)/(1+st.mean(b)/100))-1)*100
def run(cut=5,en=None,neu=None,frac=0.3,drop=(),crises=(FI,),imports=None):
    out=[]
    for per,lo,lh in ROUNDS:
        g1=c1=g2=c2=0; hits=[]; sa=[0,0]
        for m,r in D.items():
            if (m,frac) not in AN: continue
            s=shortfall(m,lo,lh,en,neu,frac,drop)
            if s is None: continue
            if imports is not None and not imports(r.get('now')): continue
            cr=any(per in c.get(m,set()) for c in crises)
            if s>=cut:
                g1+=1;c1+=cr
                if cr: hits.append(r['name'])
                if m in SA: sa[0]+=1; sa[1]+=cr
            else: g2+=1;c2+=cr
        out.append((per,g1,c1,g2,c2,hits,sa))
    G1=sum(o[1] for o in out);C1=sum(o[2] for o in out);G2=sum(o[3] for o in out);C2=sum(o[4] for o in out)
    return out,(G1,C1,G2,C2,fisher(C1,G1-C1,C2,G2-C2))
def show(label,res):
    out,(G1,C1,G2,C2,p)=res
    parts=' | '.join(f"{per}: {c1}/{g1} vs {c2}/{g2} p={fisher(c1,g1-c1,c2,g2-c2):.4f}" for per,g1,c1,g2,c2,_,_ in out)
    print(f"{label:34s} {parts} || combined {C1}/{G1} vs {C2}/{G2} p={p:.4f}")
if __name__=='__main__':
    base=run(); show('BASE (cut 5%, ONI, span 0.3)',base)
    for per,g1,c1,g2,c2,hits,sa in base[0]: print('   ',per,'hits:',', '.join(sorted(hits)),'| southern Africa flagged',sa[0],'crises',sa[1])
    for c in (3,7.5,10): show(f'cut-off {c}%',run(cut=c))
    show('NOAA RONI years',run(en=RONI_EN,neu=RONI_NEU)); show('smoother trend (span 0.75)',run(frac=0.75))
    show('RONI + span 0.75',run(en=RONI_EN,neu=RONI_NEU,frac=0.75)); show('dashed borders count too',run(crises=(FI,FIM)))
    for o in [1982,1986,1987,1991,1994,1997,2002,2004,2006,2009,2014,2015,2018]: show(f'without the {o} El Niño',run(drop={o}))
    show('flagged, imports >= 25%',run(imports=lambda v: v is not None and v>=25)); show('flagged, imports < 25%',run(imports=lambda v: v is None or v<25))
