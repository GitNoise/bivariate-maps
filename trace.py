#!/usr/bin/env python3
"""Trace the El Niño harvest-shortfall calculation from the raw data to the map, and check it.

    python3 trace.py <cereal-production.csv>          # writes TRACE.md next to this script

What it does, in order:
  1. Compares the El Niño / La Niña / neutral years used by build_data.py with NOAA's Relative Oceanic
     Niño Index (RONI, the index NOAA now uses officially), season by season.
  2. Traces five countries step by step: raw production, trend, each year against trend, which years
     count as El Niño or neutral, the shortfall, the test, and the colour class. It reuses the functions
     in build_data.py, so it traces the real code, then checks them against scipy and statsmodels.
  3. Checks that the recomputed numbers match the ones on the map (js/data.js).
  4. The walk-forward test: the map drawn before each crisis period from what was known then, plus checks
     with other cut-offs, NOAA's relative index, a smoother trend, and leaving out one El Niño at a time.
  5. Which countries' shortfalls depend on a single El Niño (leave-one-out).
  6. Lists every crisis border with its figure and source, as recorded in js/data.js.
"""
import json, math, os, re, statistics as st, sys
from math import comb

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_data as B   # the real calculation

PROD = sys.argv[1] if len(sys.argv) > 1 else '/mnt/user-data/uploads/cereal-production.csv'
TRACE_COUNTRIES = ['516', '716', '710', '454', '036']   # Namibia, Zimbabwe, South Africa, Malawi, Australia

# NOAA CPC Relative Oceanic Niño Index (ERSSTv5), 3-month seasons DJF ... NDJ, 1979-2025.
# Source: https://cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/v5/ (read 13 October 2026)
RONI = {
 1979:[0.2,0.2,0.2,0.2,0.1,-0.1,0.0,0.2,0.4,0.5,0.5,0.7], 1980:[0.6,0.5,0.3,0.2,0.3,0.3,0.2,0.0,0.0,0.1,0.2,0.2],
 1981:[0.0,-0.3,-0.3,-0.3,-0.3,-0.3,-0.3,-0.2,-0.1,-0.2,-0.2,0.0], 1982:[0.1,0.3,0.4,0.6,0.8,0.8,0.9,1.3,1.8,2.2,2.4,2.5],
 1983:[2.5,2.2,1.7,1.4,1.0,0.6,0.1,-0.2,-0.6,-0.9,-1.1,-1.0], 1984:[-0.5,-0.3,-0.3,-0.5,-0.6,-0.4,-0.2,-0.1,-0.1,-0.5,-0.8,-1.0],
 1985:[-0.8,-0.6,-0.6,-0.7,-0.7,-0.5,-0.4,-0.3,-0.2,-0.2,-0.1,-0.2], 1986:[-0.3,-0.3,-0.2,-0.1,-0.1,-0.1,0.3,0.6,0.9,1.2,1.4,1.5],
 1987:[1.6,1.5,1.3,1.0,0.9,1.1,1.3,1.6,1.5,1.3,1.0,0.9], 1988:[0.7,0.3,-0.2,-0.7,-1.4,-1.7,-1.6,-1.3,-1.4,-1.6,-1.9,-1.9],
 1989:[-1.7,-1.4,-1.1,-0.8,-0.6,-0.4,-0.3,-0.3,-0.2,-0.2,-0.1,0.0], 1990:[0.2,0.3,0.3,0.3,0.2,0.2,0.3,0.4,0.4,0.4,0.4,0.5],
 1991:[0.6,0.5,0.4,0.4,0.5,0.7,0.8,0.8,0.9,1.2,1.7,2.1], 1992:[2.3,2.2,2.0,1.7,1.4,0.9,0.5,0.3,0.2,0.1,0.1,0.3],
 1993:[0.5,0.7,0.9,1.0,0.9,0.7,0.5,0.5,0.5,0.4,0.3,0.3], 1994:[0.3,0.3,0.4,0.5,0.6,0.6,0.7,0.8,1.0,1.1,1.3,1.4],
 1995:[1.3,1.0,0.7,0.4,0.1,-0.1,-0.3,-0.5,-0.7,-0.9,-0.9,-0.9], 1996:[-0.9,-0.8,-0.6,-0.4,-0.3,-0.3,-0.2,-0.2,-0.2,-0.3,-0.3,-0.3],
 1997:[-0.2,-0.1,0.2,0.5,1.0,1.3,1.7,2.0,2.3,2.4,2.4,2.3], 1998:[2.2,1.8,1.3,0.8,0.1,-0.5,-1.2,-1.4,-1.5,-1.5,-1.6,-1.6],
 1999:[-1.5,-1.3,-1.1,-1.0,-1.0,-1.0,-1.0,-1.0,-1.0,-1.1,-1.4,-1.6], 2000:[-1.7,-1.4,-1.1,-0.8,-0.6,-0.5,-0.4,-0.4,-0.4,-0.6,-0.7,-0.7],
 2001:[-0.6,-0.5,-0.5,-0.5,-0.3,-0.1,0.0,0.0,0.0,-0.2,-0.2,-0.3], 2002:[-0.1,0.0,0.0,0.1,0.4,0.7,0.9,1.1,1.3,1.4,1.5,1.2],
 2003:[0.9,0.5,0.2,-0.2,-0.4,-0.3,0.0,0.2,0.2,0.2,0.3,0.3], 2004:[0.3,0.1,0.1,0.2,0.3,0.5,0.7,0.8,0.9,0.8,0.7,0.7],
 2005:[0.6,0.4,0.3,0.3,0.2,0.0,-0.1,-0.1,0.0,-0.2,-0.5,-0.8], 2006:[-0.9,-0.9,-0.6,-0.4,-0.1,0.0,0.1,0.3,0.5,0.8,0.9,0.9],
 2007:[0.6,0.2,-0.2,-0.4,-0.4,-0.5,-0.6,-0.8,-1.0,-1.3,-1.4,-1.5], 2008:[-1.6,-1.5,-1.3,-0.9,-0.8,-0.5,-0.3,-0.2,-0.3,-0.4,-0.6,-0.8],
 2009:[-0.9,-0.8,-0.7,-0.4,-0.1,0.1,0.3,0.4,0.6,0.9,1.3,1.6], 2010:[1.5,1.1,0.6,0.1,-0.5,-1.0,-1.3,-1.5,-1.7,-1.7,-1.7,-1.6],
 2011:[-1.4,-1.2,-0.9,-0.7,-0.5,-0.3,-0.4,-0.5,-0.7,-0.9,-1.0,-1.0], 2012:[-0.8,-0.6,-0.6,-0.5,-0.3,0.0,0.3,0.4,0.4,0.2,-0.1,-0.4],
 2013:[-0.6,-0.6,-0.5,-0.4,-0.4,-0.4,-0.4,-0.3,-0.3,-0.2,-0.2,-0.3], 2014:[-0.5,-0.5,-0.3,0.0,0.1,0.0,-0.1,-0.1,0.1,0.4,0.5,0.6],
 2015:[0.5,0.4,0.5,0.6,0.8,1.0,1.3,1.6,1.9,2.2,2.3,2.4], 2016:[2.2,1.8,1.3,0.5,-0.1,-0.6,-0.9,-1.0,-1.1,-1.1,-1.1,-1.0],
 2017:[-0.7,-0.5,-0.3,-0.1,0.1,0.1,-0.2,-0.5,-0.7,-1.0,-1.1,-1.3], 2018:[-1.1,-1.0,-0.9,-0.7,-0.3,0.0,0.1,0.2,0.4,0.7,0.8,0.7],
 2019:[0.6,0.6,0.6,0.5,0.3,0.2,0.0,-0.1,0.0,0.1,0.2,0.2], 2020:[0.1,0.1,0.0,-0.3,-0.6,-0.8,-0.8,-0.9,-1.2,-1.5,-1.5,-1.4],
 2021:[-1.2,-1.0,-1.0,-0.8,-0.6,-0.5,-0.6,-0.7,-0.9,-1.1,-1.2,-1.2], 2022:[-1.2,-1.2,-1.3,-1.3,-1.2,-1.0,-0.9,-1.0,-1.1,-1.1,-1.0,-1.0],
 2023:[-0.8,-0.6,-0.4,-0.2,0.1,0.4,0.6,0.9,1.1,1.4,1.5,1.5], 2024:[1.2,0.9,0.5,0.1,-0.3,-0.5,-0.5,-0.6,-0.8,-0.8,-0.9,-1.1],
 2025:[-1.1,-0.9,-0.7,-0.5,-0.5,-0.4,-0.5,-0.6,-0.8,-0.9,-0.9,-1.0],
}

def roni_class():
    """NOAA's rule: El Niño (La Niña) when the index is >= +0.5 (<= -0.5) for at least five consecutive seasons.
    A year is classed by its October-December season (OND), when episodes usually peak."""
    seq = [(y, i, v) for y in sorted(RONI) for i, v in enumerate(RONI[y])]
    flag = [None] * len(seq)
    for sign in (1, -1):
        run = []
        for k, (_, _, v) in enumerate(seq + [(0, 0, 0)]):
            if k < len(seq) and v * sign >= 0.5:
                run.append(k)
            else:
                if len(run) >= 5:
                    for j in run: flag[j] = 'El Niño' if sign == 1 else 'La Niña'
                run = []
    out = {}
    for k, (y, i, _) in enumerate(seq):
        if i == 10: out[y] = flag[k] or 'neutral'
    return out

def ours_class(y):
    return 'El Niño' if y in B.EL_NINO else 'La Niña' if y in B.LA_NINA else 'neutral'

def fisher(a, b, c, d):
    n1 = a + b; K = a + c; N = a + b + c + d
    return sum(comb(K, x) * comb(N - K, n1 - x) / comb(N, n1) for x in range(a, min(K, n1) + 1))

def load_js(name):
    src = open(os.path.join(HERE, 'js', 'data.js'), encoding='utf-8').read()
    if name == 'DATA':
        return json.loads(re.search(r'^const DATA = (\{.*?\});\n', src, re.S | re.M).group(1))
    block = re.search(r'^const ' + name + r' = \{(.*?)^\};', src, re.S | re.M).group(1)
    return {m.group(1): (m.group(2), m.group(3).strip()) for m in re.finditer(r"'(\d+)':\s*(\[[^\]]*\]),\s*//\s*(.*)", block)}

def shortfall(anom, lag, en_years, neu_years, skip=()):
    a = [v for y, v in anom.items() if y - lag in en_years and y not in skip]
    b = [v for y, v in anom.items() if y - lag in neu_years]
    if len(a) < 6 or len(b) < 7: return None
    return -(((1 + st.mean(a) / 100) / (1 + st.mean(b) / 100)) - 1) * 100, a, b

def main():
    from scipy.stats import mannwhitneyu
    from statsmodels.nonparametric.smoothers_lowess import lowess as sm_lowess
    DATA = load_js('DATA'); FI = load_js('FOOD_INSEC'); FIM = load_js('FOOD_INSEC_MINOR')
    P = B.load_production(PROD)
    RC = roni_class()
    L = []; w = L.append

    w('# Trace: from raw data to the map\n')
    w('Generated by `trace.py` from the raw production file and `js/data.js`. It reuses the functions in '
      '`build_data.py`, so it shows what the code actually does. Regenerate it whenever the data changes.\n')

    # ---------------------------------------------------------------- 1. years
    w('## 1. Which years count as El Niño, La Niña and neutral\n')
    w('The map classifies each year by the **onset** of an episode (`EVENTS` and `LA_NINA` in `build_data.py`, '
      'based on NOAA\'s Oceanic Niño Index). NOAA now uses the **Relative** Oceanic Niño Index (RONI) officially. '
      'Below, each year is also classed by RONI\'s October–December season (an episode needs five consecutive seasons '
      'beyond ±0.5 °C). Rows marked ⚠ differ.\n')
    w('| Year | Map uses | NOAA RONI (OND) | |')
    w('|---|---|---|---|')
    diffs = []
    for y in range(1980, 2025):
        o, r = ours_class(y), RC[y]
        flag = '⚠' if o != r else ''
        if flag: diffs.append((y, o, r))
        w(f'| {y} | {o} | {r} | {flag} |')
    w(f'\n**{len(diffs)} of 45 years differ.** ' + '; '.join(f'{y}: map says {o}, RONI says {r}' for y, o, r in diffs) + '.\n')
    neu_tail = [y for y, o, r in diffs if o == 'neutral' and r == 'La Niña']
    if neu_tail:
        w(f'The years the map counts as **neutral** while RONI shows **La Niña** ({", ".join(map(str, neu_tail))}) matter most: '
          'in southern Africa La Niña usually brings good rains, so counting them as neutral can make "neutral" harvests look '
          'better and the El Niño shortfall bigger. Section 4 measures how much.\n')

    # ---------------------------------------------------------------- 2. country traces
    w('## 2. Five countries, step by step\n')
    w('For each country: cereal production (FAO via Our World in Data), the long-term trend (LOWESS, span 0.3, from 1975), '
      'each harvest as % above or below trend, and whether that harvest counts as El Niño, neutral or neither. '
      f'Countries whose main harvest comes the year after the event (`LAG1`, {len(B.LAG1)} countries) are shifted by a year.\n')
    for m in TRACE_COUNTRIES:
        r = DATA['world'].get(m, {}); name = r.get('name', m); ser = P[m]
        lag = 1 if m in B.LAG1 else 0
        yrs = [y for y in sorted(ser) if y >= 1975 and ser[y] > 0 and y <= B.PROD_LAST]
        tr = B.lowess(yrs, [ser[y] for y in yrs])
        tr_sm = sm_lowess([ser[y] for y in yrs], yrs, frac=0.3, it=0, delta=0, return_sorted=False)
        anom = B.trend_anomalies({y: v for y, v in ser.items() if y <= B.PROD_LAST})
        w(f'### {name} (M49 {m}){" — harvest counted the year after the event" if lag else ""}\n')
        w('| Harvest year | Production (t) | Trend (t) | vs trend | ENSO year it follows | Counts as |')
        w('|---|---|---|---|---|---|')
        for y, t in zip(yrs, tr):
            if y < 1980: continue
            ev = y - lag; c = ours_class(ev)
            use = 'El Niño' if c == 'El Niño' else 'neutral' if c == 'neutral' else '—'
            w(f'| {y} | {ser[y]:,.0f} | {t:,.0f} | {anom[y]:+.1f}% | {ev} ({c}) | {use} |')
        res = shortfall({y: v for y, v in anom.items() if y >= 1980}, lag, B.EL_NINO, B.NEUTRAL)
        sf, a, b = res
        p_ours = B.mann_whitney_p(a, b)
        p_sp = mannwhitneyu(a, b, alternative='two-sided', method='asymptotic', use_continuity=False).pvalue
        p_exact = mannwhitneyu(a, b, alternative='two-sided', method='exact').pvalue
        dmax = max(abs(x - z) / z * 100 for x, z in zip(tr, tr_sm))
        w(f'\n- **El Niño harvests:** {len(a)}, averaging {st.mean(a):+.1f}% against trend. **Neutral harvests:** {len(b)}, averaging {st.mean(b):+.1f}%.')
        w(f'- **Shortfall:** El Niño harvests are **{sf:.1f}% smaller** than neutral ones '
          f'(map: {-r.get("hgap", float("nan")):.1f}%). ')
        w(f'- **Test (Mann-Whitney):** p = {p_ours:.3f} in our code · {p_sp:.3f} in scipy (same method) · {p_exact:.3f} exact. '
          f'{"Hatched on the map (p ≥ 0.1)." if p_ours >= 0.1 else "Not hatched (p < 0.1)."}')
        w(f'- **Trend check:** our LOWESS and statsmodels\' differ by at most {dmax:.3f}% of the trend.')
        imp = r.get('now')
        w(f'- **Imports:** {imp}% of cereals (2020–22), from the map data. '
          f'**Crisis border:** {"solid — " + FI[m][1] if m in FI else "dashed — " + FIM[m][1] if m in FIM else "none"}.\n')

    # ---------------------------------------------------------------- 3. consistency
    w('## 3. Do the recomputed numbers match the map?\n')
    mism = []; checked = 0
    for m, r in DATA['world'].items():
        if r.get('hgap') is None or m not in P: continue
        lag = 1 if m in B.LAG1 else 0
        anom = {y: v for y, v in B.trend_anomalies({y: v for y, v in P[m].items() if y <= B.PROD_LAST}).items() if y >= 1980}
        res = shortfall(anom, lag, B.EL_NINO, B.NEUTRAL)
        if not res: continue
        checked += 1
        if abs(-res[0] - r['hgap']) > 0.15: mism.append((r.get('name', m), r['hgap'], round(-res[0], 1)))
    w(f'Recomputed the shortfall for all {checked} countries on the map from the raw file: '
      + ('**all match** the published values (to 0.1 percentage points).\n' if not mism else
         f'**{len(mism)} differ**: ' + '; '.join(f'{n} map {a} vs {b}' for n, a, b in mism[:15]) + '\n'))

    # ---------------------------------------------------------------- 4. walk-forward test
    w('## 4. The test: would the map have warned in time?\n')
    w('The map is drawn as it would have looked **before each crisis period**, from what was known then: El Niños up to 2009 and '
      'harvests up to 2014 to predict 2015–16; El Niños up to 2018–19 and harvests up to 2022 to predict 2023–24. A country is '
      '**flagged** at a shortfall of 5% or more. A crisis is a solid border on the map in that period. Fisher\'s exact test, one-sided.\n')
    def periods(d): return {m: set(re.findall(r"'([^']*)'", ys)) for m, (ys, _) in d.items()}
    FIp, FIMp = periods(FI), periods(FIM)
    roni_en = {y for y, c in RC.items() if c == 'El Niño'}; roni_neu = {y for y, c in RC.items() if c == 'neutral'}
    AN = {}
    def anomf(m, frac):
        if (m, frac) not in AN:
            ser = {y: v for y, v in P[m].items() if y <= B.PROD_LAST}; yrs = [y for y in sorted(ser) if y >= 1975 and ser[y] > 0]
            tr = B.lowess(yrs, [ser[y] for y in yrs], frac=frac)
            AN[(m, frac)] = {y: (ser[y] / t - 1) * 100 for y, t in zip(yrs, tr) if t > 0 and y >= 1980}
        return AN[(m, frac)]
    ROUNDS = (('2015–16', 2009, 2014), ('2023–24', 2018, 2022))
    def wf(cut=5, en=None, neu=None, frac=0.3, drop=(), crises=None):
        en = en or B.EL_NINO; neu = neu or B.NEUTRAL; crises = crises or (FIp,); out = []
        for per, lo, lh in ROUNDS:
            g1 = c1 = g2 = c2 = 0; hits = []
            for m, r in DATA['world'].items():
                if r.get('hgap') is None or m not in P: continue
                lag = 1 if m in B.LAG1 else 0; an = anomf(m, frac)
                a = [v for y, v in an.items() if y - lag in en and y - lag <= lo and y <= lh and y - lag not in drop]
                b = [v for y, v in an.items() if y - lag in neu and y <= lh]
                if len(a) < 6 or len(b) < 7: continue
                sfv = -(((1 + st.mean(a) / 100) / (1 + st.mean(b) / 100)) - 1) * 100
                cr = any(per in c.get(m, set()) for c in crises)
                if sfv >= cut: g1 += 1; c1 += cr; hits += [r['name']] if cr else []
                else: g2 += 1; c2 += cr
            out.append((per, g1, c1, g2, c2, hits))
        return out
    def cell(o): per, g1, c1, g2, c2, _ = o; return f'{c1} of {g1} vs {c2} of {g2} (p = {fisher(c1, g1-c1, c2, g2-c2):.3f})'
    base = wf()
    w('| Predicting | Flagged with a crisis | Others with a crisis | p | Correct flags |')
    w('|---|---|---|---|---|')
    for per, g1, c1, g2, c2, hits in base:
        w(f'| {per} | {c1} of {g1} ({100*c1/g1:.0f}%) | {c2} of {g2} ({100*c2/g2:.0f}%) | {fisher(c1, g1-c1, c2, g2-c2):.4f} | {", ".join(sorted(hits))} |')
    G1 = sum(o[1] for o in base); C1 = sum(o[2] for o in base); G2 = sum(o[3] for o in base); C2 = sum(o[4] for o in base)
    w(f'\nBoth rounds together: {C1} of {G1} against {C2} of {G2} (p = {fisher(C1, G1-C1, C2, G2-C2):.4f}). Countries appear in both rounds, so this is optimistic.\n')
    w('### Does it depend on our choices?\n')
    w('| Version | 2015–16 | 2023–24 |')
    w('|---|---|---|')
    for label, kw in (('As on the page', {}), ('Cut-off 3%', {'cut': 3}), ('Cut-off 7.5%', {'cut': 7.5}), ('Cut-off 10%', {'cut': 10}),
                      ('NOAA RONI years', {'en': roni_en, 'neu': roni_neu}), ('Smoother trend (span 0.75)', {'frac': 0.75}),
                      ('Dashed borders count as crises too', {'crises': (FIp, FIMp)})):
        o = wf(**kw); w(f'| {label} | {cell(o[0])} | {cell(o[1])} |')
    w('\n### Does it depend on one El Niño?\n')
    w('Each row leaves one El Niño out of every country\'s shortfall.\n')
    w('| Left out | 2015–16 | 2023–24 |')
    w('|---|---|---|')
    for o_ in sorted(e for e in B.EL_NINO if e <= 2018):
        o = wf(drop={o_}); w(f'| {o_} | {cell(o[0])} | {cell(o[1])} |')
    w('\nWithout the 1991–92 El Niño, southern Africa\'s worst drought in decades, neither round is significant: much of the signal rests on that one event.\n')

    # ---------------------------------------------------------------- 4a. against a naive baseline
    w('### Does the harvest measure beat simply flagging southern Africa?\n')
    w('Forecast scores per round. **Hit rate:** share of crises flagged in advance. **Precision:** share of flags followed by a crisis. '
      'Southern Africa here means Angola, Botswana, Eswatini, Lesotho, Madagascar, Malawi, Mozambique, Namibia, South Africa, Zambia and Zimbabwe.\n')
    SAR = {'024','072','748','426','450','454','508','516','710','894','716'}
    rules = (('Harvest measure (shortfall ≥ 5%)', lambda m, v: v >= 5), ('Baseline: every southern African country', lambda m, v: m in SAR),
             ('Southern Africa and shortfall ≥ 5%', lambda m, v: m in SAR and v >= 5))
    w('| Rule | Round | Flagged | Hits | False alarms | Misses | Hit rate | Precision |')
    w('|---|---|---|---|---|---|---|---|')
    for label, rule in rules:
        T = [0, 0, 0]
        for per, lo, lh in ROUNDS:
            tp = fp = fn = 0
            for m, r in DATA['world'].items():
                if r.get('hgap') is None or m not in P: continue
                lag = 1 if m in B.LAG1 else 0; an = anomf(m, 0.3)
                a = [v for y, v in an.items() if y - lag in B.EL_NINO and y - lag <= lo and y <= lh]
                b = [v for y, v in an.items() if y - lag in B.NEUTRAL and y <= lh]
                if len(a) < 6 or len(b) < 7: continue
                v = -(((1 + st.mean(a) / 100) / (1 + st.mean(b) / 100)) - 1) * 100
                f = rule(m, v); c = per in FIp.get(m, set())
                tp += f and c; fp += f and not c; fn += (not f) and c
            T = [T[0] + tp, T[1] + fp, T[2] + fn]
            w(f'| {label} | {per} | {tp+fp} | {tp} | {fp} | {fn} | {tp/(tp+fn):.0%} | {tp/max(1,tp+fp):.0%} |')
        tp, fp, fn = T
        w(f'| {label} | **both** | {tp+fp} | {tp} | {fp} | {fn} | {tp/(tp+fn):.0%} | {tp/max(1,tp+fp):.0%} |')
    w('\nThe region itself is the warning: flagging every southern African country catches more crises with far fewer false alarms than the '
      'harvest measure alone. Within the region, the harvest measure removes some false alarms, mainly in 2023–24.\n')

    # ---------------------------------------------------------------- 4b. leave one out, per country
    w('## 5. Which countries\' shortfalls depend on a single El Niño?\n')
    w('For every country with a shortfall of 5% or more on the map, the shortfall recomputed 14 times, each time leaving one El Niño out. '
      '**Fragile** means it falls below 5% without at least one of them: a coinciding shock (war, economic collapse) or luck may explain it.\n')
    w('| Country | Map | p | Lowest without one El Niño | Verdict |')
    w('|---|---|---|---|---|')
    rows = []
    for m, r in DATA['world'].items():
        if r.get('hgap') is None or m not in P or -r['hgap'] < 5: continue
        lag = 1 if m in B.LAG1 else 0; an = anomf(m, 0.3)
        def sf_(drop):
            a = [v for y, v in an.items() if y - lag in B.EL_NINO and y - lag not in drop]; b = [v for y, v in an.items() if y - lag in B.NEUTRAL]
            return -(((1 + st.mean(a) / 100) / (1 + st.mean(b) / 100)) - 1) * 100
        loo = [(o_, sf_({o_})) for o_ in sorted(B.EL_NINO)]
        low = min(loo, key=lambda t: t[1]); below = [o_ for o_, v in loo if v < 5]
        rows.append((-r['hgap'], r['name'], r.get('hp', 1), low, below))
    for full, name, p_, low, below in sorted(rows, reverse=True):
        w(f'| {name} | {full:.1f}% | {p_:.3f} | {low[1]:.1f}% (without {low[0]}) | {"fragile: below 5% without " + ", ".join(map(str, below)) if below else "robust"} |')
    w('')

    # ---------------------------------------------------------------- 5. crisis provenance
    w('## 6. Crisis borders: figure and source for each\n')
    w('Shares are of the whole population in IPC Phase 3 or worse (or the Global Report\'s accepted equivalent), '
      'as recorded in `js/data.js`. Check each against its source.\n')
    w('| Country | Border | Years | Figure and source note |')
    w('|---|---|---|---|')
    for tag, d in (('solid', FI), ('dashed', FIM)):
        for m, (years, note) in d.items():
            name = DATA['world'].get(m, {}).get('name', m)
            w(f'| {name} | {tag} | {", ".join(re.findall(r"'([^']*)'", years))} | {note} |')
    w('\nSources: Global Report on Food Crises 2017 (2016 table) and its 2024 and 2025 country profiles; IPC Timor-Leste '
      '(November 2023–April 2024); Viet Nam joint government–UN Emergency Response Plan (April 2016).\n')

    open(os.path.join(HERE, 'TRACE.md'), 'w', encoding='utf-8').write('\n'.join(L))
    print('TRACE.md written:', len(L), 'lines;', len(diffs), 'year classifications differ from RONI;', checked, 'countries checked,', len(mism), 'mismatches')

if __name__ == '__main__':
    main()
