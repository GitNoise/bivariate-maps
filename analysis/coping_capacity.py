"""Do proxies for coping capacity sharpen the warning? Prints the walk-forward scores of the shortfall alone, the shortfall
with weak capacity on each of four proxies, and each proxy alone, within southern Africa and worldwide.

    python analysis/coping_capacity.py
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd

from pipeline import measures, walkforward
from pipeline.walkforward import SOUTHERN_AFRICA, flags_shortfall

# each proxy and its measure; weak capacity = the measure's middle or weak class, as known at the end of each round's data
# window (2014, 2022)
PROXIES = {'GDP per person': 'gdp', 'Extreme poverty': 'poverty', 'Life expectancy': 'life', 'HDI': 'hdi'}

# a rule takes the outcomes table and returns (flagged, no data): two boolean Series


def everyone(o):
    return pd.Series(True, index=o.index), pd.Series(False, index=o.index)


def shortfall_alone(o):
    return flags_shortfall(o), pd.Series(False, index=o.index)


def with_shortfall(measure):
    """Flag the harvest measure's shortfall together with weak capacity."""
    def rule(o):
        cls = measures.classes_known_then(o, measure)
        return flags_shortfall(o) & (cls.fillna(-1) >= 1), cls.isna()
    return rule


def capacity_alone(measure):
    """Flag weak capacity, whatever the harvests."""
    def rule(o):
        cls = measures.classes_known_then(o, measure)
        return cls.fillna(-1) >= 1, cls.isna()
    return rule


def score(rule, southern_africa_only):
    """Per round: (period, hits, false alarms, missed, false-alarm names, missed names, no-data names)."""
    o = walkforward.outcomes()
    if southern_africa_only:
        o = o[o['m49'].isin(SOUTHERN_AFRICA)]
    flagged, no_data = rule(o)
    flagged = flagged & ~no_data
    out = []
    for rnd in walkforward.ROUNDS:
        here = o['period'] == rnd.period
        hit, false_alarm, missed = here & flagged & o['crisis'], here & flagged & ~o['crisis'], here & ~flagged & o['crisis']
        out.append((rnd.period, int(hit.sum()), int(false_alarm.sum()), int(missed.sum()),
                    list(o.loc[false_alarm, 'name']), list(o.loc[missed, 'name']), list(o.loc[here & no_data, 'name'])))
    return out


def line(label, result):
    _, hit_rate, precision = walkforward.combined({period: walkforward.Score(h, f, m) for period, h, f, m, *_ in result})
    rounds = ' | '.join(f"{period[:4]}: {h} hits, {f} false alarms, {m} missed" for period, h, f, m, _, _, _ in result)
    print(f"  {label:36s} {rounds} || both: hit rate {hit_rate:.0%}, precision {precision:.0%}")
    return result


if __name__ == '__main__':
    print(f"(life expectancy median = {measures.LIFE_EXPECTANCY_MEDIAN:.1f} years)\n")
    print(f"WITHIN SOUTHERN AFRICA ({len(SOUTHERN_AFRICA)} countries)")
    line('Baseline: every country', score(everyone, True))
    line('Shortfall >= 5%', score(shortfall_alone, True))
    detail = {}
    for name, measure in PROXIES.items():
        detail[name] = line(f'Shortfall >= 5% + weak: {name}', score(with_shortfall(measure), True))
        line(f'   weak {name} alone (no shortfall)', score(capacity_alone(measure), True))
    print("\nWORLDWIDE (all countries with harvest data)")
    line('Shortfall >= 5%', score(shortfall_alone, False))
    for name, measure in PROXIES.items():
        line(f'Shortfall >= 5% + weak: {name}', score(with_shortfall(measure), False))
    print("\nDETAIL, southern Africa, shortfall + weak capacity:")
    for name, result in detail.items():
        for period, h, f, m, false_alarm_names, missed_names, no_data in result:
            print(f"  {name:16s} {period}: false alarms {', '.join(false_alarm_names) or '-'} | missed {', '.join(missed_names) or '-'}"
                  f"{' | no data: ' + ', '.join(no_data) if no_data else ''}")
