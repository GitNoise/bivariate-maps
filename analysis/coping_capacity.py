"""Do proxies for coping capacity sharpen the warning? Prints the walk-forward scores of the shortfall alone, the shortfall
with weak capacity on each of four proxies, and each proxy alone, within southern Africa and worldwide.

    python3 analysis/coping_capacity.py
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline import crises, measures, walkforward
from pipeline.measures import M49_TO_ISO3


def weak_if(value, is_weak):
    """True = weak capacity, None = no data."""
    return None if value is None else is_weak(value)


# each proxy: (ISO3, year) -> weak capacity? Capacity is taken as known at the end of each round's data window (2014, 2022)
PROXIES = {
    'GDP per person':  lambda iso3, year: weak_if(measures.gdp_per_person(iso3, year), lambda v: v < (4125 if year < 2020 else 4465)),   # below upper-middle income
    'Extreme poverty': lambda iso3, year: weak_if(measures.poverty(iso3, year), lambda v: v >= 25),
    'Life expectancy': lambda iso3, year: weak_if(measures.life_expectancy(iso3), lambda v: v < measures.LIFE_EXPECTANCY_MEDIAN),
    'HDI':             lambda iso3, year: weak_if(measures.hdi(iso3), lambda v: v < 0.700),
}


def score(rule, southern_africa_only):
    """Score a rule(shortfall, iso3, year) -> True, False or 'nodata', per round. Returns
    [(period, hits, false alarms, missed, false-alarm names, missed names, no-data names)]."""
    out = []
    for rnd in walkforward.ROUNDS:
        hits = false_alarms = missed = 0
        false_alarm_names, missed_names, no_data = [], [], []
        for m49, country in walkforward.COUNTRIES.items():
            if m49 not in walkforward.TESTED or (southern_africa_only and m49 not in walkforward.SOUTHERN_AFRICA):
                continue
            shortfall = walkforward.shortfall_known_before(m49, rnd)
            if shortfall is None:
                continue
            flag, crisis = rule(shortfall, M49_TO_ISO3.get(m49), rnd.last_harvest), crises.had_crisis(m49, rnd.period)
            if flag == 'nodata':
                no_data.append(country['name']); flag = False
            if flag and crisis:
                hits += 1
            elif flag:
                false_alarms += 1; false_alarm_names.append(country['name'])
            elif crisis:
                missed += 1; missed_names.append(country['name'])
        out.append((rnd.period, hits, false_alarms, missed, false_alarm_names, missed_names, no_data))
    return out


def line(label, result):
    hits, false_alarms, missed = (sum(r[i] for r in result) for i in (1, 2, 3))
    rounds = ' | '.join(f"{period[:4]}: {h} hits, {f} false alarms, {m} missed" for period, h, f, m, _, _, _ in result)
    print(f"  {label:36s} {rounds} || both: hit rate {hits / (hits + missed):.0%}, precision {hits / max(1, hits + false_alarms):.0%}")
    return result


def with_shortfall(weak):
    """Flag a shortfall of 5% or more together with weak capacity."""
    def rule(shortfall, iso3, year):
        w = weak(iso3, year) if iso3 else None
        return 'nodata' if w is None else (shortfall >= 5 and w)
    return rule


def alone(weak):
    """Flag weak capacity, whatever the harvests."""
    def rule(shortfall, iso3, year):
        w = weak(iso3, year) if iso3 else None
        return 'nodata' if w is None else w
    return rule


if __name__ == '__main__':
    print(f"(life expectancy median = {measures.LIFE_EXPECTANCY_MEDIAN:.1f} years)\n")
    print("WITHIN SOUTHERN AFRICA (11 countries)")
    line('Baseline: every country', score(lambda shortfall, iso3, year: True, True))
    line('Shortfall >= 5%', score(lambda shortfall, iso3, year: shortfall >= 5, True))
    detail = {}
    for name, weak in PROXIES.items():
        detail[name] = line(f'Shortfall >= 5% + weak: {name}', score(with_shortfall(weak), True))
        line(f'   weak {name} alone (no shortfall)', score(alone(weak), True))
    print("\nWORLDWIDE (all countries with harvest data)")
    line('Shortfall >= 5%', score(lambda shortfall, iso3, year: shortfall >= 5, False))
    for name, weak in PROXIES.items():
        line(f'Shortfall >= 5% + weak: {name}', score(with_shortfall(weak), False))
    print("\nDETAIL, southern Africa, shortfall + weak capacity:")
    for name, result in detail.items():
        for period, h, f, m, false_alarm_names, missed_names, no_data in result:
            print(f"  {name:16s} {period}: false alarms {', '.join(false_alarm_names) or '-'} | missed {', '.join(missed_names) or '-'}"
                  f"{' | no data: ' + ', '.join(no_data) if no_data else ''}")
