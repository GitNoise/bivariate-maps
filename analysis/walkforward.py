"""Walk-forward test: the map drawn as it would have looked before each crisis period, from what was known then.

Shared by proxies.py and build_axes.py; run this file to print the test and its robustness checks.
"""
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # the repository
sys.path.insert(0, ROOT); sys.path.insert(0, os.path.join(ROOT, 'analysis'))
import re
import build_data as B, trace as T

P = B.load_production(os.path.join(ROOT, 'data', 'cereal-production.csv'))   # cereal production per country and year
D = T.load_js('DATA')['world']                                                # the map's country records

def periods(name):
    """A crisis table from js/data.js as {m49: {'2015–16', ...}}."""
    return {m: set(re.findall(r"'(\d{4}–\d{2})'", ys)) for m, (ys, _) in T.load_js(name).items()}

FI = periods('FOOD_INSEC')          # national food crises (solid borders)
FIM = periods('FOOD_INSEC_MINOR')   # smaller crises (dashed borders)
fisher = T.fisher
SA = set(B.REGIONS['saf'][1])       # southern Africa, the baseline that flags every country there
# each round: the crisis period, the last El Niño known before it, and the last harvest year known before it
ROUNDS = [('2015–16', 2009, 2014), ('2023–24', 2018, 2022)]
RC = T.roni_class()
RONI_EN = {y for y, c in RC.items() if c == 'El Niño'}
RONI_NEU = {y for y, c in RC.items() if c == 'neutral'}

def anom(m, frac):
    """Each harvest from 1980 as % above or below the country's LOWESS trend (span frac)."""
    production = {y: v for y, v in P[m].items() if y <= B.PROD_LAST}
    return {y: v for y, v in B.trend_anomalies(production, frac=frac).items() if y >= 1980}

TESTED = {m for m, r in D.items() if r.get('hgap') is not None and m in P}   # countries with a harvest shortfall on the map
AN = {(m, 0.3): anom(m, 0.3) for m in TESTED}   # the page's span; other spans are fitted on first use

def shortfall(m, lo, lh, en=None, neu=None, frac=0.3, drop=()):
    """Country m's shortfall (%) from El Niños up to lo and harvests up to lh; None with too few years.
    en, neu: El Niño and neutral years (default: the map's); drop: El Niños to leave out."""
    en = en or B.EL_NINO; neu = neu or B.NEUTRAL; lag = B.lag_of(m)
    if (m, frac) not in AN:
        AN[(m, frac)] = anom(m, frac)
    an = AN[(m, frac)]
    a = [v for y, v in an.items() if y - lag in en and y - lag <= lo and y <= lh and y - lag not in drop]
    b = [v for y, v in an.items() if y - lag in neu and y <= lh]
    if len(a) < 6 or len(b) < 7:
        return None
    return B.shortfall_pct(a, b)

def run(cut=5, en=None, neu=None, frac=0.3, drop=(), crises=(FI,), imports=None):
    """Flag countries with a shortfall >= cut and count crises among flagged and other countries, per round.
    crises: the crisis tables that count; imports: an optional filter on the import share.
    Returns the rounds [(period, flagged, flagged with a crisis, others, others with a crisis, hits, southern Africa [flagged, crises])]
    and both rounds together (flagged, with a crisis, others, with a crisis, Fisher's p)."""
    out = []
    for per, lo, lh in ROUNDS:
        g1 = c1 = g2 = c2 = 0; hits = []; sa = [0, 0]
        for m, r in D.items():
            if m not in TESTED:
                continue
            s = shortfall(m, lo, lh, en, neu, frac, drop)
            if s is None:
                continue
            if imports is not None and not imports(r.get('now')):
                continue
            crisis = any(per in c.get(m, set()) for c in crises)
            if s >= cut:
                g1 += 1; c1 += crisis
                if crisis: hits.append(r['name'])
                if m in SA: sa[0] += 1; sa[1] += crisis
            else:
                g2 += 1; c2 += crisis
        out.append((per, g1, c1, g2, c2, hits, sa))
    G1 = sum(o[1] for o in out); C1 = sum(o[2] for o in out); G2 = sum(o[3] for o in out); C2 = sum(o[4] for o in out)
    return out, (G1, C1, G2, C2, fisher(C1, G1 - C1, C2, G2 - C2))

def show(label, res):
    out, (G1, C1, G2, C2, p) = res
    parts = ' | '.join(f"{per}: {c1}/{g1} vs {c2}/{g2} p={fisher(c1, g1 - c1, c2, g2 - c2):.4f}" for per, g1, c1, g2, c2, _, _ in out)
    print(f"{label:34s} {parts} || combined {C1}/{G1} vs {C2}/{G2} p={p:.4f}")

if __name__ == '__main__':
    base = run(); show('BASE (cut 5%, ONI, span 0.3)', base)
    for per, g1, c1, g2, c2, hits, sa in base[0]:
        print('   ', per, 'hits:', ', '.join(sorted(hits)), '| southern Africa flagged', sa[0], 'crises', sa[1])
    for c in (3, 7.5, 10):
        show(f'cut-off {c}%', run(cut=c))
    show('NOAA RONI years', run(en=RONI_EN, neu=RONI_NEU))
    show('smoother trend (span 0.75)', run(frac=0.75))
    show('RONI + span 0.75', run(en=RONI_EN, neu=RONI_NEU, frac=0.75))
    show('dashed borders count too', run(crises=(FI, FIM)))
    for o in [1982, 1986, 1987, 1991, 1994, 1997, 2002, 2004, 2006, 2009, 2014, 2015, 2018]:
        show(f'without the {o} El Niño', run(drop={o}))
    show('flagged, imports >= 25%', run(imports=lambda v: v is not None and v >= 25))
    show('flagged, imports < 25%', run(imports=lambda v: v is None or v < 25))
