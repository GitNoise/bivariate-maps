"""Builds js/axes.js: second-axis classes for the map and their walk-forward scores. Run: python3 analysis/build_axes.py"""
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # the repository
sys.path.insert(0, ROOT); sys.path.insert(0, os.path.join(ROOT, 'analysis'))
import json
import walkforward as W
import proxies as TP          # data loaders: gdppc, pov, num, M49_ISO, LE_MED
# ---- classes (0 = strong, 2 = weak), fixed before testing ---------------------------------------------
def cls_imports(v):  return None if v is None else (2 if v >= 50 else 1 if v >= 25 else 0)
def cls_gdp(v, yr):  return None if v is None else (2 if v < (1045 if yr < 2020 else 1135) else 1 if v < (4125 if yr < 2020 else 4465) else 0)
def cls_pov(v):      return None if v is None else (2 if v >= 50 else 1 if v >= 25 else 0)
def cls_hdi(v):      return None if v is None else (2 if v < 0.550 else 1 if v < 0.700 else 0)
def cls_le(v):       return None if v is None else (2 if v < 65 else 1 if v < TP.LE_MED else 0)
def cls_und(v):      return None if v is None else (2 if v >= 25 else 1 if v >= 10 else 0)
# ---- optional sixth axis: FAO prevalence of undernourishment (SDG 2.1.1), Our World in Data CSV in data/proxies/ ----
import csv as _csv
UND_PATH = os.path.join(ROOT, 'data', 'proxies', 'undernourishment.csv')
UND = {}
if os.path.exists(UND_PATH):
    for r in _csv.DictReader(open(UND_PATH, encoding='utf-8-sig')):
        col = [k for k in r if k not in ('Entity', 'Code', 'Year', 'entity', 'code', 'year')]
        try: UND.setdefault(r.get('Code') or r.get('code'), {})[int(r.get('Year') or r.get('year'))] = float(r[col[0]].replace('<', ''))
        except (ValueError, IndexError, TypeError): pass
def und(iso, yr):
    ys = [y for y in UND.get(iso, {}) if y <= yr]
    return UND[iso][max(ys)] if ys else None
def values(m, yr):
    iso = TP.M49_ISO.get(m); r = W.D[m]
    return {'imports': (r.get('now'), cls_imports(r.get('now'))),
            'gdp': (lambda v: (v, cls_gdp(v, yr)))(TP.gdppc(iso, yr) if iso else None),
            'poverty': (lambda v: (v, cls_pov(v)))(TP.pov(iso, yr) if iso else None),
            'hdi': (lambda v: (v, cls_hdi(v)))(TP.num(iso, 'human_development_index') if iso else None),
            'life': (lambda v: (v, cls_le(v)))(TP.num(iso, 'life_expectancy') if iso else None),
            'undernourishment': (lambda v: (v, cls_und(v)))(und(iso, yr) if iso else None)}
AX = ['imports', 'gdp', 'poverty', 'hdi', 'life'] + (['undernourishment'] if UND else [])
# ---- map display: latest values (2022) ------------------------------------------------------------------
disp = {a: {'vals': {}, 'cls': {}} for a in AX}
for m, r in W.D.items():
    if r.get('hgap') is None: continue
    for a, (v, c) in values(m, 2022).items():
        if a in AX and c is not None: disp[a]['vals'][m] = round(v, 3 if a == 'hdi' else 1); disp[a]['cls'][m] = c
# ---- walk-forward scores: flag = shortfall >= 5% (known then) and second axis class >= 1 -----------------
def score(axis, scope):
    out = {}
    for per, lo, lh in W.ROUNDS:
        tp = fp = fn = 0
        for m, r in W.D.items():
            if (m, 0.3) not in W.AN or (scope == 'sa' and m not in W.SA): continue
            s = W.shortfall(m, lo, lh)
            if s is None: continue
            c = per in W.FI.get(m, set())
            if axis == 'region':   f = m in W.SA
            elif axis == 'none':   f = s >= 5
            else:
                k = values(m, lh)[axis][1]
                f = s >= 5 and k is not None and k >= 1
            tp += f and c; fp += f and not c; fn += (not f) and c
        out[per[:4]] = {'hits': tp, 'false': fp, 'missed': fn}
    return out
SCORES = {sc: {a: score(a, sc) for a in ['region', 'none'] + AX} for sc in ('world', 'sa')}
# ---- per-country test results, so the page can count hits and false alarms for any view --------------------
# for each country and round: shortfall flag (>= 5%, as known then), crisis (0/1), and each measure's class (-1 = no data)
TEST = {}
for m, r in W.D.items():
    if (m, 0.3) not in W.AN: continue
    row = {'s': [], 'c': [], 'k': {a: [] for a in AX}}
    for per, lo, lh in W.ROUNDS:
        v = W.shortfall(m, lo, lh)
        row['s'].append(-1 if v is None else int(v >= 5)); row['c'].append(int(per in W.FI.get(m, set())))
        vals = values(m, lh)
        for a in AX: row['k'][a].append(-1 if vals[a][1] is None else vals[a][1])
    TEST[m] = row
meta = {
 'imports': {'label': 'Cereal imports', 'axis': 'Imports', 'title': 'Big shortfall, high imports', 'ticks': ['25', '50%'], 'unit': 'of cereals imported, 2020–22'},
 'gdp':     {'label': 'Income', 'axis': 'Poorer', 'title': 'Big shortfall, low income', 'ticks': ['4.5k', '1.1k'], 'unit': 'GDP per person, 2022'},
 'poverty': {'label': 'Extreme poverty', 'axis': 'Poverty', 'title': 'Big shortfall, high poverty', 'ticks': ['25', '50%'], 'unit': 'living in extreme poverty, latest survey'},
 'hdi':     {'label': 'Human development', 'axis': 'Lower HDI', 'title': 'Big shortfall, low HDI', 'ticks': ['.70', '.55'], 'unit': 'Human Development Index'},
 'undernourishment': {'label': 'Undernourishment', 'axis': 'Hungrier', 'title': 'Big shortfall, high hunger', 'ticks': ['10', '25%'], 'unit': 'undernourished, FAO three-year average'},
 'life':    {'label': 'Life expectancy', 'axis': 'Shorter life', 'title': 'Big shortfall, shorter lives', 'ticks': [f'{TP.LE_MED:.0f}', '65'], 'unit': 'life expectancy at birth, years'},
}
AXES = {a: {**meta[a], **disp[a]} for a in AX}
js = ('// Second-axis measures for the map and their walk-forward scores. Generated by proxies/build_axes.py; do not edit by hand.\n'
      '// Classes: 0 = strong, 1 = middle, 2 = weak (thresholds fixed before testing). Scores: flag = shortfall >= 5% (as known then)\n'
      '// and second-axis class >= 1; "region" = every southern African country; "none" = shortfall alone.\n'
      'const AXES = ' + json.dumps(AXES, ensure_ascii=False, separators=(',', ':')) + ';\n'
      'const AXIS_SCORES = ' + json.dumps(SCORES, separators=(',', ':')) + ';\n'
      'const AXIS_TEST = ' + json.dumps(TEST, separators=(',', ':')) + ';   // per country: s = shortfall flag, c = crisis, k = class per measure; one value per round (2015–16, 2023–24)\n')
open(os.path.join(ROOT, 'js', 'axes.js'), 'w', encoding='utf-8').write(js)
print('axes.js written:', len(js)//1024, 'KB | countries per axis:', {a: len(disp[a]['cls']) for a in AX})
for sc in ('world', 'sa'):
    print(sc)
    for a, v in SCORES[sc].items():
        H = v['2015']['hits'] + v['2023']['hits']; F = v['2015']['false'] + v['2023']['false']; M = v['2015']['missed'] + v['2023']['missed']
        print(f"   {a:8s} 2015 {v['2015']}  2023 {v['2023']}  | hit rate {H/(H+M):.0%} precision {H/max(1,H+F):.0%}")
