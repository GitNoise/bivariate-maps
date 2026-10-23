"""Builds js/axes.js: the second-axis measures for the map, their walk-forward scores, and yearly series for the tooltip.

    python3 analysis/build_axes.py
"""
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # the repository
sys.path.insert(0, ROOT); sys.path.insert(0, os.path.join(ROOT, 'analysis'))
import csv, json
from functools import lru_cache
import walkforward as W
import proxies as TP          # data loaders: GDP, POP, POV, gdppc, pov, num, M49_ISO, LE_MED

SERIES_YEARS = range(1980, 2025)   # the tooltip's yearly series: its timeline, 1980 to the latest harvest year


# ---- classes (0 = strong coping capacity, 2 = weak), fixed before testing ------------------------------------
def three_classes(v, weak, middle, higher_is_weaker):
    """2 past the `weak` threshold, 1 past `middle`, else 0; None without a value."""
    if v is None:
        return None
    if higher_is_weaker:
        return 2 if v >= weak else 1 if v >= middle else 0
    return 2 if v < weak else 1 if v < middle else 0

# the thresholds: (middle, weak). Also written to js/axes.js, where the tooltip marks them on the sparklines
CUTS = {'imports': (25, 50), 'poverty': (25, 50), 'undernourishment': (10, 25),
        'hdi': (0.700, 0.550), 'life': (TP.LE_MED, 65)}
GDP_CUTS = {'before 2020': (4125, 1045), 'from 2020': (4465, 1135)}   # World Bank income groups, with the thresholds of the time

def cls_imports(v):  return three_classes(v, CUTS['imports'][1], CUTS['imports'][0], True)
def cls_pov(v):      return three_classes(v, CUTS['poverty'][1], CUTS['poverty'][0], True)
def cls_und(v):      return three_classes(v, CUTS['undernourishment'][1], CUTS['undernourishment'][0], True)
def cls_hdi(v):      return three_classes(v, CUTS['hdi'][1], CUTS['hdi'][0], False)
def cls_le(v):       return three_classes(v, CUTS['life'][1], CUTS['life'][0], False)
def cls_gdp(v, yr):
    middle, weak = GDP_CUTS['before 2020' if yr < 2020 else 'from 2020']
    return three_classes(v, weak, middle, False)


# ---- optional sixth measure: FAO prevalence of undernourishment (SDG 2.1.1), an Our World in Data CSV in data/proxies/ ----
UND_PATH = os.path.join(ROOT, 'data', 'proxies', 'undernourishment.csv')
UND = {}
if os.path.exists(UND_PATH):
    for r in csv.DictReader(open(UND_PATH, encoding='utf-8-sig')):
        col = [k for k in r if k not in ('Entity', 'Code', 'Year', 'entity', 'code', 'year')]
        try:
            UND.setdefault(r.get('Code') or r.get('code'), {})[int(r.get('Year') or r.get('year'))] = float(r[col[0]].replace('<', ''))
        except (ValueError, IndexError, TypeError):
            pass

def und(iso, yr):
    ys = [y for y in UND.get(iso, {}) if y <= yr]
    return UND[iso][max(ys)] if ys else None

AX = ['imports', 'gdp', 'poverty', 'hdi', 'life'] + (['undernourishment'] if UND else [])


@lru_cache(maxsize=None)   # asked for one measure at a time, for two years, by score() and the TEST loop
def values(m, yr):
    """Every measure for country m as known in year yr: {measure: (value, class)}."""
    iso = TP.M49_ISO.get(m)
    if iso:
        gdp, poverty, undernourished = TP.gdppc(iso, yr), TP.pov(iso, yr), und(iso, yr)
        hdi, life = TP.num(iso, 'human_development_index'), TP.num(iso, 'life_expectancy')
    else:   # no ISO code, no data
        gdp = poverty = undernourished = hdi = life = None
    imports = W.D[m].get('now')
    return {'imports': (imports, cls_imports(imports)),
            'gdp': (gdp, cls_gdp(gdp, yr)),
            'poverty': (poverty, cls_pov(poverty)),
            'hdi': (hdi, cls_hdi(hdi)),
            'life': (life, cls_le(life)),
            'undernourishment': (undernourished, cls_und(undernourished))}


# ---- the map: latest values (2022) and their classes, for countries with a harvest test ------------------------
disp = {a: {'vals': {}, 'cls': {}} for a in AX}
for m, r in W.D.items():
    if r.get('hgap') is None:
        continue
    for a, (v, c) in values(m, 2022).items():
        if a in AX and c is not None:
            disp[a]['vals'][m] = round(v, 3 if a == 'hdi' else 1)
            disp[a]['cls'][m] = c


# ---- the tooltip: yearly series (income, poverty, HDI, life expectancy); one value per year from 1980, null where missing ----
def yearly(value_in):
    """{m49: [value per year]} for every country on the map with any data in SERIES_YEARS."""
    out = {}
    for m in disp['imports']['vals']:
        iso = TP.M49_ISO.get(m)
        vals = [value_in(iso, y) if iso else None for y in SERIES_YEARS]
        if any(v is not None for v in vals):
            out[m] = vals
    return out

def gdp_in(iso, y):
    gdp, pop = TP.GDP.get(iso, {}).get(y), TP.POP.get(iso, {}).get(y)
    return round(gdp / pop) if gdp is not None and pop else None

def poverty_in(iso, y):
    v = TP.POV.get(iso, {}).get(y)
    return None if v is None else round(v, 1)

disp['gdp']['series'] = yearly(gdp_in)
def hdi_in(iso, y):
    v = TP.HDI_YEARLY.get(iso, {}).get(y)
    return None if v is None else round(v, 3)

def life_in(iso, y):
    v = TP.LIFE_YEARLY.get(iso, {}).get(y)
    return None if v is None else round(v, 1)

disp['poverty']['series'] = yearly(poverty_in)
disp['hdi']['series'] = yearly(hdi_in)
disp['life']['series'] = yearly(life_in)


# ---- walk-forward scores: flag = shortfall >= 5% (as known then) and the measure's class >= 1 ---------------------
def score(axis, scope):
    """Hits, false alarms and misses per round; axis 'region' flags every southern African country, 'none' the shortfall alone."""
    out = {}
    for per, lo, lh in W.ROUNDS:
        tp = fp = fn = 0
        for m in W.D:
            if (m, 0.3) not in W.AN or (scope == 'sa' and m not in W.SA):
                continue
            s = W.shortfall(m, lo, lh)
            if s is None:
                continue
            crisis = per in W.FI.get(m, set())
            if axis == 'region':
                flag = m in W.SA
            elif axis == 'none':
                flag = s >= 5
            else:
                k = values(m, lh)[axis][1]
                flag = s >= 5 and k is not None and k >= 1
            tp += flag and crisis; fp += flag and not crisis; fn += (not flag) and crisis
        out[per[:4]] = {'hits': tp, 'false': fp, 'missed': fn}
    return out

SCORES = {scope: {a: score(a, scope) for a in ['region', 'none'] + AX} for scope in ('world', 'sa')}


# ---- per-country test results, so the page can count hits and false alarms for any view ----------------------------
# for each country and round: shortfall flag (>= 5%, as known then), crisis (0/1), and each measure's class (-1 = no data)
TEST = {}
for m in W.D:
    if (m, 0.3) not in W.AN:
        continue
    row = {'s': [], 'c': [], 'k': {a: [] for a in AX}}
    for per, lo, lh in W.ROUNDS:
        v = W.shortfall(m, lo, lh)
        row['s'].append(-1 if v is None else int(v >= 5))
        row['c'].append(int(per in W.FI.get(m, set())))
        vals = values(m, lh)
        for a in AX:
            row['k'][a].append(-1 if vals[a][1] is None else vals[a][1])
    TEST[m] = row


# ---- labels for the legend and the explorer ----------------------------------------------------------------------
meta = {
 'imports': {'label': 'Cereal imports', 'axis': 'Imports', 'title': 'Big shortfall, high imports', 'ticks': ['25', '50%'], 'unit': 'of cereals imported, 2020–22'},
 'gdp':     {'label': 'Income', 'axis': 'Poorer', 'title': 'Big shortfall, low income', 'ticks': ['4.5k', '1.1k'], 'unit': 'GDP per person, 2022'},
 'poverty': {'label': 'Extreme poverty', 'axis': 'Poverty', 'title': 'Big shortfall, high poverty', 'ticks': ['25', '50%'], 'unit': 'living in extreme poverty, latest survey'},
 'hdi':     {'label': 'Human development', 'axis': 'Lower HDI', 'title': 'Big shortfall, low HDI', 'ticks': ['.70', '.55'], 'unit': 'Human Development Index'},
 'undernourishment': {'label': 'Undernourishment', 'axis': 'Hungrier', 'title': 'Big shortfall, high hunger', 'ticks': ['10', '25%'], 'unit': 'undernourished, FAO three-year average'},
 'life':    {'label': 'Life expectancy', 'axis': 'Shorter life', 'title': 'Big shortfall, shorter lives', 'ticks': [f'{TP.LE_MED:.0f}', '65'], 'unit': 'life expectancy at birth, years'},
}
cuts = {**CUTS, 'gdp': GDP_CUTS['from 2020']}   # the map shows 2022 values
AXES = {a: {**meta[a], **disp[a], 'cuts': [round(c, 3) for c in cuts[a]]} for a in AX}


# ---- write js/axes.js ----------------------------------------------------------------------------------------------
js = ('// Second-axis measures for the map and their walk-forward scores. Generated by analysis/build_axes.py; do not edit by hand.\n'
      '// Classes: 0 = strong, 1 = middle, 2 = weak (thresholds fixed before testing). Scores: flag = shortfall >= 5% (as known then)\n'
      '// and second-axis class >= 1; "region" = every southern African country; "none" = shortfall alone.\n'
      '// series (income, poverty, HDI, life expectancy): one value per year from 1980 to 2024, null where missing, for the tooltip.\n'
      'const AXES = ' + json.dumps(AXES, ensure_ascii=False, separators=(',', ':')) + ';\n'
      'const AXIS_SCORES = ' + json.dumps(SCORES, separators=(',', ':')) + ';\n'
      'const AXIS_TEST = ' + json.dumps(TEST, separators=(',', ':')) + ';   // per country: s = shortfall flag, c = crisis, k = class per measure; one value per round (2015–16, 2023–24)\n')
open(os.path.join(ROOT, 'js', 'axes.js'), 'w', encoding='utf-8').write(js)

print('axes.js written:', len(js) // 1024, 'KB | countries per axis:', {a: len(disp[a]['cls']) for a in AX},
      '| series:', {a: len(disp[a]['series']) for a in AX if 'series' in disp[a]})
for scope in ('world', 'sa'):
    print(scope)
    for a, v in SCORES[scope].items():
        H = v['2015']['hits'] + v['2023']['hits']; F = v['2015']['false'] + v['2023']['false']; M = v['2015']['missed'] + v['2023']['missed']
        print(f"   {a:8s} 2015 {v['2015']}  2023 {v['2023']}  | hit rate {H/(H+M):.0%} precision {H/max(1,H+F):.0%}")
