"""Write js/measures.js: the second measures for the map (values, classes, yearly series, thresholds), their walk-forward
scores, and each country's test results, so the page can count hits and false alarms for any view.

    python3 build_measures.py
"""
from pipeline import measures, walkforward
from pipeline.harvests import LAST_HARVEST_YEAR
from pipeline.measures import M49_TO_ISO3, MEASURES, values_known_in
from pipeline.page_files import write_measures

SERIES_YEARS = range(1980, LAST_HARVEST_YEAR + 1)   # the tooltip's timeline
MAP_YEAR = 2022                                     # the map shows values as of 2022

# labels for the legend and the explorer
LABELS = {
    'imports':          {'label': 'Cereal imports', 'axis': 'Imports', 'ticks': ['25', '50%']},
    'gdp':              {'label': 'Income', 'axis': 'Poorer', 'ticks': ['4.5k', '1.1k']},
    'poverty':          {'label': 'Extreme poverty', 'axis': 'Poverty', 'ticks': ['25', '50%']},
    'hdi':              {'label': 'Human development', 'axis': 'Lower HDI', 'ticks': ['.70', '.55']},
    'life':             {'label': 'Life expectancy', 'axis': 'Shorter life', 'ticks': [f'{measures.LIFE_EXPECTANCY_MEDIAN:.0f}', '65']},
    'undernourishment': {'label': 'Undernourishment', 'axis': 'Hungrier', 'ticks': ['10', '25%']},
}


def rounded(value, digits):
    return None if value is None else round(value, digits)


# yearly values per measure for the tooltip's sparklines: (ISO3, year) -> value. Imports' series is in js/data.js
SERIES_SOURCES = {
    'gdp': measures.gdp_per_person_in,
    'poverty': lambda iso3, year: rounded(measures.POVERTY.get(iso3, {}).get(year), 1),
    'hdi': lambda iso3, year: rounded(measures.HDI_BY_YEAR.get(iso3, {}).get(year), 3),
    'life': lambda iso3, year: rounded(measures.LIFE_BY_YEAR.get(iso3, {}).get(year), 1),
    'undernourishment': lambda iso3, year: measures.UNDERNOURISHMENT.get(iso3, {}).get(year),
}


def measure_data():
    """Per measure: labels, the 2022 value and class of every country with a harvest test, yearly series, thresholds."""
    on_map = [m49 for m49, c in walkforward.COUNTRIES.items() if c.get('harvestShortfall') is not None]
    out = {}
    for measure in MEASURES:
        values, classes = {}, {}
        for m49 in on_map:
            value, cls = values_known_in(m49, MAP_YEAR)[measure]
            if cls is not None:
                values[m49] = round(value, 3 if measure == 'hdi' else 1)
                classes[m49] = cls
        out[measure] = {**LABELS[measure], 'values': values, 'classes': classes}
        if measure in SERIES_SOURCES:
            out[measure]['series'] = {}
            for m49 in out['imports']['values']:   # every country on the map with any data in the years
                iso3 = M49_TO_ISO3.get(m49)
                yearly = [SERIES_SOURCES[measure](iso3, year) if iso3 else None for year in SERIES_YEARS]
                if any(v is not None for v in yearly):
                    out[measure]['series'][m49] = yearly
        out[measure]['thresholds'] = [round(t, 3) for t in measures.thresholds(measure, MAP_YEAR)]
    return out


def flags_with(measure):
    """The flagging rule for a theory: 'region' flags every southern African country, 'none' the shortfall alone, and a
    measure flags the shortfall together with that measure's middle or weak class."""
    if measure == 'region':
        return lambda m49, shortfall, rnd: m49 in walkforward.SOUTHERN_AFRICA
    if measure == 'none':
        return lambda m49, shortfall, rnd: shortfall >= walkforward.FLAG_AT
    def flags(m49, shortfall, rnd):
        cls = values_known_in(m49, rnd.last_harvest)[measure][1]
        return shortfall >= walkforward.FLAG_AT and cls is not None and cls >= 1
    return flags


def scores():
    """{'world' | 'southernAfrica': {theory: {'2015' | '2023': {hits, falseAlarms, missed}}}}"""
    out = {}
    for scope, only in (('world', None), ('southernAfrica', walkforward.SOUTHERN_AFRICA)):
        out[scope] = {}
        for theory in ['region', 'none'] + MEASURES:
            by_period = walkforward.score_rule(flags_with(theory), only)
            out[scope][theory] = {period[:4]: {'hits': s.hits, 'falseAlarms': s.false_alarms, 'missed': s.missed}
                                  for period, s in by_period.items()}
    return out


def test_results():
    """Per country and round: flagged by its shortfall (1/0, −1 = too few harvests), crisis (1/0), and each measure's
    class as known then (−1 = no data)."""
    out = {}
    for m49 in walkforward.COUNTRIES:
        if m49 not in walkforward.TESTED:
            continue
        row = {'flagged': [], 'crisis': [], 'classes': {measure: [] for measure in MEASURES}}
        for rnd in walkforward.ROUNDS:
            shortfall = walkforward.shortfall_known_before(m49, rnd)
            row['flagged'].append(-1 if shortfall is None else int(shortfall >= walkforward.FLAG_AT))
            row['crisis'].append(int(walkforward.crises.had_crisis(m49, rnd.period)))
            known = values_known_in(m49, rnd.last_harvest)
            for measure in MEASURES:
                row['classes'][measure].append(-1 if known[measure][1] is None else known[measure][1])
        out[m49] = row
    return out


def main():
    data, score_table = measure_data(), scores()
    text = write_measures(
        ['The second measures for the map and their walk-forward scores. Written by build_measures.py; do not edit by hand.',
         'Classes: 0 = strong capacity, 1 = middle, 2 = weak (thresholds fixed before testing). Scores: flag = shortfall >= 5%',
         '(as known then) and the measure\'s class >= 1; "region" = every southern African country; "none" = shortfall alone.',
         'series: one value per year from 1980 to 2024, null where missing, for the tooltip.'],
        {'MEASURE_DATA': (data, False, ''),
         'MEASURE_SCORES': (score_table, True, ''),
         'TEST_RESULTS': (test_results(), True, 'per country: one value per round (2015–16, 2023–24)')})
    print('js/measures.js written:', len(text) // 1024, 'KB | countries per measure:', {m: len(data[m]['classes']) for m in MEASURES},
          '| series:', {m: len(data[m]['series']) for m in MEASURES if 'series' in data[m]})
    for scope, theories in score_table.items():
        print(scope)
        for theory, by_period in theories.items():
            s15, s23 = by_period['2015'], by_period['2023']
            hits, false_alarms, missed = (s15[k] + s23[k] for k in ('hits', 'falseAlarms', 'missed'))
            print(f"   {theory:8s} 2015 {s15}  2023 {s23}  | hit rate {hits / (hits + missed):.0%} precision {hits / max(1, hits + false_alarms):.0%}")


if __name__ == '__main__':
    main()
