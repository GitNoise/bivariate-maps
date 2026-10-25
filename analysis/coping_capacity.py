"""Do proxies for coping capacity sharpen the warning? Prints the walk-forward scores of the shortfall alone, the shortfall
with weak capacity on each of four proxies, and each proxy alone, within southern Africa and worldwide.

    python3 analysis/coping_capacity.py
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline import measures, walkforward
from pipeline.walkforward import SOUTHERN_AFRICA, flags_shortfall

# each proxy and its measure; weak capacity = the measure's middle or weak class, as known at the end of each round's data
# window (2014, 2022)
PROXIES = {'GDP per person': 'gdp', 'Extreme poverty': 'poverty', 'Life expectancy': 'life', 'HDI': 'hdi'}


def weak_capacity(measure):
    """(m49, year) -> True (weak), False, or None (no data)."""
    def weak(m49, year):
        cls = measures.values_known_in(m49, year)[measure][1]
        return None if cls is None else cls >= 1
    return weak


def score(rule, southern_africa_only):
    """Score a rule(m49, shortfall, rnd) -> True, False or 'nodata', per round. Returns
    [(period, hits, false alarms, missed, false-alarm names, missed names, no-data names)]."""
    by_round = {rnd.period: [0, 0, 0, [], [], []] for rnd in walkforward.ROUNDS}
    for o in walkforward.outcomes(SOUTHERN_AFRICA if southern_africa_only else None):
        counts, name = by_round[o.round.period], o.country['name']
        flag = rule(o.m49, o.shortfall, o.round)
        if flag == 'nodata':
            counts[5].append(name); flag = False
        if flag and o.crisis:
            counts[0] += 1
        elif flag:
            counts[1] += 1; counts[3].append(name)
        elif o.crisis:
            counts[2] += 1; counts[4].append(name)
    return [(period, *counts) for period, counts in by_round.items()]


def line(label, result):
    _, hit_rate, precision = walkforward.combined({period: walkforward.Score(h, f, m) for period, h, f, m, *_ in result})
    rounds = ' | '.join(f"{period[:4]}: {h} hits, {f} false alarms, {m} missed" for period, h, f, m, _, _, _ in result)
    print(f"  {label:36s} {rounds} || both: hit rate {hit_rate:.0%}, precision {precision:.0%}")
    return result


def with_shortfall(weak):
    """Flag the harvest measure's shortfall together with weak capacity."""
    def rule(m49, shortfall, rnd):
        w = weak(m49, rnd.last_harvest)
        return 'nodata' if w is None else (flags_shortfall(m49, shortfall, rnd) and w)
    return rule


def alone(weak):
    """Flag weak capacity, whatever the harvests."""
    def rule(m49, shortfall, rnd):
        w = weak(m49, rnd.last_harvest)
        return 'nodata' if w is None else w
    return rule


if __name__ == '__main__':
    print(f"(life expectancy median = {measures.LIFE_EXPECTANCY_MEDIAN:.1f} years)\n")
    print(f"WITHIN SOUTHERN AFRICA ({len(SOUTHERN_AFRICA)} countries)")
    line('Baseline: every country', score(lambda m49, shortfall, rnd: True, True))
    line('Shortfall >= 5%', score(flags_shortfall, True))
    detail = {}
    for name, measure in PROXIES.items():
        weak = weak_capacity(measure)
        detail[name] = line(f'Shortfall >= 5% + weak: {name}', score(with_shortfall(weak), True))
        line(f'   weak {name} alone (no shortfall)', score(alone(weak), True))
    print("\nWORLDWIDE (all countries with harvest data)")
    line('Shortfall >= 5%', score(flags_shortfall, False))
    for name, measure in PROXIES.items():
        line(f'Shortfall >= 5% + weak: {name}', score(with_shortfall(weak_capacity(measure)), False))
    print("\nDETAIL, southern Africa, shortfall + weak capacity:")
    for name, result in detail.items():
        for period, h, f, m, false_alarm_names, missed_names, no_data in result:
            print(f"  {name:16s} {period}: false alarms {', '.join(false_alarm_names) or '-'} | missed {', '.join(missed_names) or '-'}"
                  f"{' | no data: ' + ', '.join(no_data) if no_data else ''}")
