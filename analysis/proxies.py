"""Coping-capacity proxies: loaders, and the four-proxy walk-forward test (run this file to print the results)."""
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # the repository
sys.path.insert(0, ROOT); sys.path.insert(0, os.path.join(ROOT, 'analysis'))
import csv, sys, statistics as st
import walkforward as W
# name -> ISO3 from the production file (Our World in Data names, same as the poverty file)
NAME_ISO={r['Entity']:r['Code'] for r in csv.DictReader(open(os.path.join(ROOT, 'data', 'cereal-production.csv'),encoding='utf-8')) if r['Code'] and not r['Code'].startswith('OWID')}
M49_ISO={}
import build_data as B
for iso,m in B.ISO3_M49.items(): M49_ISO.setdefault(m,iso)
def series(path):
    out={}
    for r in csv.DictReader(open(path,encoding='utf-8-sig')):
        try: out.setdefault(r['Country Code'],{})[int(r['Year'])]=float(r['Value'])
        except: pass
    return out
GDP=series(os.path.join(ROOT, 'data', 'proxies', 'gdp.csv')); POP=series(os.path.join(ROOT, 'data', 'proxies', 'population.csv'))
def gdppc(iso,yr):
    for y in range(yr,yr-4,-1):
        if y in GDP.get(iso,{}) and y in POP.get(iso,{}): return GDP[iso][y]/POP[iso][y]
POV={}
for r in csv.DictReader(open(os.path.join(ROOT, 'data', 'proxies', 'pip.csv'),encoding='utf-8')):
    if r['reporting_level']!='national' or not r['headcount_ratio_international_povline']: continue
    iso=NAME_ISO.get(r['country'])
    if iso: POV.setdefault(iso,{}).setdefault(int(r['year']),float(r['headcount_ratio_international_povline']))
def pov(iso,yr):
    ys=[y for y in POV.get(iso,{}) if y<=yr]
    return POV[iso][max(ys)] if ys else None
COV={r['iso_code']:r for r in csv.DictReader(open(os.path.join(ROOT, 'data', 'proxies', 'covid_latest.csv'),encoding='utf-8'))}
def num(iso,col):
    v=COV.get(iso,{}).get(col,''); return float(v) if v not in ('',None) else None
isos=[M49_ISO.get(m) for m in W.D if (m,0.3) in W.AN]
LE_MED=st.median([v for v in (num(i,'life_expectancy') for i in isos if i) if v is not None])
PROXY={  # True = weak coping capacity, None = no data
 'GDP per person':  lambda iso,yr: (lambda v: None if v is None else v < (4125 if yr<2020 else 4465))(gdppc(iso,yr)),
 'Extreme poverty': lambda iso,yr: (lambda v: None if v is None else v >= 25)(pov(iso,yr)),
 'Life expectancy': lambda iso,yr: (lambda v: None if v is None else v < LE_MED)(num(iso,'life_expectancy')),
 'HDI':             lambda iso,yr: (lambda v: None if v is None else v < 0.700)(num(iso,'human_development_index')),
}
SAR=W.SA
def score(rule, sa_only):
    res=[]
    for per,lo,lh in W.ROUNDS:
        yr=lh   # capacity as known at the end of the data window: 2014, 2022
        tp=fp=fn=0; fa=[]; miss=[]; nodata=[]
        for m,r in W.D.items():
            if (m,0.3) not in W.AN or (sa_only and m not in SAR): continue
            s=W.shortfall(m,lo,lh)
            if s is None: continue
            iso=M49_ISO.get(m); f=rule(m,s,iso,yr); c=per in W.FI.get(m,set())
            if f=='nodata': nodata.append(r['name']); f=False
            if f and c: tp+=1
            elif f: fp+=1; fa.append(r['name'])
            elif c: fn+=1; miss.append(r['name'])
        res.append((per,tp,fp,fn,fa,miss,nodata))
    return res
def line(label,res):
    T=[sum(x[i] for x in res) for i in (1,2,3)]
    rounds=' | '.join(f"{per[:4]}: {tp} hits, {fp} false alarms, {fn} missed" for per,tp,fp,fn,_,_,_ in res)
    print(f"  {label:36s} {rounds} || both: hit rate {T[0]/(T[0]+T[2]):.0%}, precision {T[0]/max(1,T[0]+T[1]):.0%}")
    return res
if __name__ == '__main__':
    print(f"(life expectancy median = {LE_MED:.1f} years)\n")
    print("WITHIN SOUTHERN AFRICA (11 countries)")
    line('Baseline: every country',score(lambda m,s,iso,yr: True, True))
    line('Shortfall >= 5%',score(lambda m,s,iso,yr: s>=5, True))
    detail={}
    for name,P in PROXY.items():
        def rule(m,s,iso,yr,P=P):
            w=P(iso,yr) if iso else None
            return 'nodata' if w is None else (s>=5 and w)
        detail[name]=line(f'Shortfall >= 5% + weak: {name}',score(rule,True))
        def rule2(m,s,iso,yr,P=P):
            w=P(iso,yr) if iso else None
            return 'nodata' if w is None else w
        line(f'   weak {name} alone (no shortfall)',score(rule2,True))
    print("\nWORLDWIDE (all countries with harvest data)")
    line('Shortfall >= 5%',score(lambda m,s,iso,yr: s>=5, False))
    for name,P in PROXY.items():
        def rule(m,s,iso,yr,P=P):
            w=P(iso,yr) if iso else None
            return 'nodata' if w is None else (s>=5 and w)
        line(f'Shortfall >= 5% + weak: {name}',score(rule,False))
    print("\nDETAIL, southern Africa, shortfall + weak capacity:")
    for name,res in detail.items():
        for per,tp,fp,fn,fa,miss,nod in res:
            print(f"  {name:16s} {per}: false alarms {', '.join(fa) or '-'} | missed {', '.join(miss) or '-'}{' | no data: '+', '.join(nod) if nod else ''}")
