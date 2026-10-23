"""Coping-capacity measures: loaders for the data in data/proxies/, and the four-measure walk-forward test.

Run this file to print the results; build_axes.py uses the loaders.
"""
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # the repository
sys.path.insert(0, ROOT); sys.path.insert(0, os.path.join(ROOT, 'analysis'))
import csv, statistics as st
import walkforward as W
import build_data as B

def data_file(*parts):
    return open(os.path.join(ROOT, 'data', *parts), encoding='utf-8')

# ---- country codes ----------------------------------------------------------------------------------------------
# name -> ISO3, from the production file (Our World in Data names, the same as in the poverty file)
NAME_ISO = {r['Entity']: r['Code'] for r in csv.DictReader(data_file('cereal-production.csv'))
            if r['Code'] and not r['Code'].startswith('OWID')}
M49_ISO = {}
for iso, m in B.ISO3_M49.items():
    M49_ISO.setdefault(m, iso)

# ---- income: GDP and population (World Bank) -------------------------------------------------------------------
def series(path):
    """A World Bank CSV as {ISO3: {year: value}}."""
    out = {}
    for r in csv.DictReader(open(path, encoding='utf-8-sig')):
        try:
            out.setdefault(r['Country Code'], {})[int(r['Year'])] = float(r['Value'])
        except (KeyError, ValueError):
            pass
    return out

GDP = series(os.path.join(ROOT, 'data', 'proxies', 'gdp.csv'))
POP = series(os.path.join(ROOT, 'data', 'proxies', 'population.csv'))

def gdppc(iso, yr):
    """GDP per person in year yr, or the latest of the three years before."""
    for y in range(yr, yr - 4, -1):
        if y in GDP.get(iso, {}) and y in POP.get(iso, {}):
            return GDP[iso][y] / POP[iso][y]

# ---- extreme poverty: share below the international poverty line, national surveys (World Bank PIP) ---------------
POV = {}
for r in csv.DictReader(data_file('proxies', 'pip.csv')):
    if r['reporting_level'] != 'national' or not r['headcount_ratio_international_povline']:
        continue
    iso = NAME_ISO.get(r['country'])
    if iso:
        POV.setdefault(iso, {}).setdefault(int(r['year']), float(r['headcount_ratio_international_povline']))

def pov(iso, yr):
    """The latest survey up to year yr."""
    ys = [y for y in POV.get(iso, {}) if y <= yr]
    return POV[iso][max(ys)] if ys else None

# ---- human development and life expectancy: one recent value per country, and yearly series (Our World in Data) ----
COV = {r['iso_code']: r for r in csv.DictReader(data_file('proxies', 'covid_latest.csv'))}

def num(iso, col):
    v = COV.get(iso, {}).get(col, '')
    return float(v) if v not in ('', None) else None

# the same two measures year by year (Our World in Data), for the tooltip's sparklines only: the classes and the test
# keep the single recent values above
def owid(path, column):
    """An Our World in Data CSV as {ISO3: {year: value}}, countries only."""
    out = {}
    for r in csv.DictReader(data_file('proxies', path)):
        if r['Code'] and not r['Code'].startswith('OWID') and r[column]:
            out.setdefault(r['Code'], {})[int(r['Year'])] = float(r[column])
    return out

HDI_YEARLY = owid('human-development-index.csv', 'Human Development Index')
LIFE_YEARLY = owid('life-expectancy.csv', 'Life expectancy')

isos = [M49_ISO.get(m) for m in W.D if (m, 0.3) in W.AN]
LE_MED = st.median([v for v in (num(i, 'life_expectancy') for i in isos if i) if v is not None])   # life expectancy, median over the tested countries

# ---- the test --------------------------------------------------------------------------------------------------
# each measure: True = weak coping capacity, None = no data
def weak_if(v, is_weak):
    return None if v is None else is_weak(v)

PROXY = {
    'GDP per person':  lambda iso, yr: weak_if(gdppc(iso, yr), lambda v: v < (4125 if yr < 2020 else 4465)),   # below upper-middle income
    'Extreme poverty': lambda iso, yr: weak_if(pov(iso, yr), lambda v: v >= 25),
    'Life expectancy': lambda iso, yr: weak_if(num(iso, 'life_expectancy'), lambda v: v < LE_MED),
    'HDI':             lambda iso, yr: weak_if(num(iso, 'human_development_index'), lambda v: v < 0.700),
}
SAR = W.SA

def score(rule, sa_only):
    """Score a flagging rule(m, shortfall, iso, year) -> True, False or 'nodata', per round, worldwide or in southern Africa only.
    Capacity is taken as known at the end of each round's data window (2014, 2022)."""
    res = []
    for per, lo, lh in W.ROUNDS:
        tp = fp = fn = 0; false_alarms = []; missed = []; nodata = []
        for m, r in W.D.items():
            if (m, 0.3) not in W.AN or (sa_only and m not in SAR):
                continue
            s = W.shortfall(m, lo, lh)
            if s is None:
                continue
            flag, crisis = rule(m, s, M49_ISO.get(m), lh), per in W.FI.get(m, set())
            if flag == 'nodata':
                nodata.append(r['name']); flag = False
            if flag and crisis: tp += 1
            elif flag: fp += 1; false_alarms.append(r['name'])
            elif crisis: fn += 1; missed.append(r['name'])
        res.append((per, tp, fp, fn, false_alarms, missed, nodata))
    return res

def line(label, res):
    T = [sum(x[i] for x in res) for i in (1, 2, 3)]
    rounds = ' | '.join(f"{per[:4]}: {tp} hits, {fp} false alarms, {fn} missed" for per, tp, fp, fn, _, _, _ in res)
    print(f"  {label:36s} {rounds} || both: hit rate {T[0]/(T[0]+T[2]):.0%}, precision {T[0]/max(1,T[0]+T[1]):.0%}")
    return res

def with_shortfall(weak):
    """Flag a shortfall >= 5% together with weak capacity."""
    def rule(m, s, iso, yr):
        w = weak(iso, yr) if iso else None
        return 'nodata' if w is None else (s >= 5 and w)
    return rule

def alone(weak):
    """Flag weak capacity, whatever the harvests."""
    def rule(m, s, iso, yr):
        w = weak(iso, yr) if iso else None
        return 'nodata' if w is None else w
    return rule

if __name__ == '__main__':
    print(f"(life expectancy median = {LE_MED:.1f} years)\n")
    print("WITHIN SOUTHERN AFRICA (11 countries)")
    line('Baseline: every country', score(lambda m, s, iso, yr: True, True))
    line('Shortfall >= 5%', score(lambda m, s, iso, yr: s >= 5, True))
    detail = {}
    for name, weak in PROXY.items():
        detail[name] = line(f'Shortfall >= 5% + weak: {name}', score(with_shortfall(weak), True))
        line(f'   weak {name} alone (no shortfall)', score(alone(weak), True))
    print("\nWORLDWIDE (all countries with harvest data)")
    line('Shortfall >= 5%', score(lambda m, s, iso, yr: s >= 5, False))
    for name, weak in PROXY.items():
        line(f'Shortfall >= 5% + weak: {name}', score(with_shortfall(weak), False))
    print("\nDETAIL, southern Africa, shortfall + weak capacity:")
    for name, res in detail.items():
        for per, tp, fp, fn, fa, miss, nod in res:
            print(f"  {name:16s} {per}: false alarms {', '.join(fa) or '-'} | missed {', '.join(miss) or '-'}{' | no data: '+', '.join(nod) if nod else ''}")
