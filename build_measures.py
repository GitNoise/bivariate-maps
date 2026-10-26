"""Write src/measures.js: the second measures for the map (values, classes, yearly series, thresholds), their walk-forward
scores, and each country's test results, so the page can count hits and false alarms for any view.

    python build_measures.py
"""
import pandas as pd

from pipeline import crises, measures, walkforward
from pipeline.harvests import LAST_HARVEST_YEAR
from pipeline.measures import M49_TO_ISO3, MEASURES, known_in
from pipeline.page_files import write_measures
from pipeline.walkforward import COUNTRIES, PAGE_ORDER, ROUNDS, TESTED

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
DIGITS = {'hdi': 3}   # decimals of the values on the map; the others have 1


def yearly_tables():
    """The yearly series for the tooltip's sparklines, as tables of iso3, year, value, rounded as the page shows them.
    Imports' series is in src/data.js."""
    gdp = measures.GDP_PER_PERSON.assign(value=measures.GDP_PER_PERSON['value'].round().astype(int))
    return {'gdp': gdp,
            'poverty': measures.POVERTY.assign(value=measures.POVERTY['value'].map(lambda v: round(v, 1))),
            'hdi': measures.hdi_by_year().assign(value=measures.hdi_by_year()['value'].map(lambda v: round(v, 3))),
            'life': measures.life_by_year().assign(value=measures.life_by_year()['value'].map(lambda v: round(v, 1))),
            'undernourishment': measures.UNDERNOURISHMENT}


def measure_data():
    """Per measure: labels, the 2022 value and class of every country with a harvest test, yearly series, thresholds."""
    table = known_in(MAP_YEAR)
    on_map = [m49 for m49 in PAGE_ORDER if COUNTRIES[m49].get('harvestShortfall') is not None]
    series_sources = yearly_tables()
    out = {}
    for measure in MEASURES:
        known = table.loc[on_map, [measure, f'{measure}_class']].dropna()
        out[measure] = {**LABELS[measure],
                        'values': {m49: round(float(v), DIGITS.get(measure, 1)) for m49, v in known[measure].items()},
                        'classes': {m49: int(c) for m49, c in known[f'{measure}_class'].items()}}
        if measure in series_sources:
            by_key = {(iso3, year): value for iso3, year, value in series_sources[measure][['iso3', 'year', 'value']].itertuples(index=False)}
            out[measure]['series'] = {}
            for m49 in out['imports']['values']:   # every country on the map with any data in the years
                iso3 = M49_TO_ISO3.get(m49)
                yearly = [by_key.get((iso3, year)) for year in SERIES_YEARS]
                if any(v is not None for v in yearly):
                    out[measure]['series'][m49] = [v if v is None or isinstance(v, int) else float(v) for v in yearly]
        out[measure]['thresholds'] = [round(t, 3) for t in measures.thresholds(measure, MAP_YEAR)]
    return out


def flags_with(theory):
    """The flagging rule for a theory, on the outcomes table: 'region' flags every southern African country, 'none' the
    shortfall alone, and a measure flags the shortfall together with that measure's middle or weak class, as known then."""
    if theory == 'region':
        return walkforward.flags_southern_africa
    if theory == 'none':
        return walkforward.flags_shortfall
    def flags(o):
        return walkforward.flags_shortfall(o) & (measures.classes_known_then(o, theory).fillna(-1) >= 1)
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
    known = {rnd.period: walkforward.shortfalls_known_before(rnd) for rnd in ROUNDS}
    out = {}
    for m49 in PAGE_ORDER:
        if m49 not in TESTED:
            continue
        row = {'flagged': [], 'crisis': [], 'classes': {measure: [] for measure in MEASURES}}
        for rnd in ROUNDS:
            shortfall = known[rnd.period].get(m49)
            row['flagged'].append(-1 if shortfall is None else int(shortfall >= walkforward.FLAG_AT))
            row['crisis'].append(int(crises.had_crisis(m49, rnd.period)))
            classes_then = known_in(rnd.last_harvest).loc[m49]
            for measure in MEASURES:
                cls = classes_then[f'{measure}_class']
                row['classes'][measure].append(-1 if pd.isna(cls) else int(cls))
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
    print('src/measures.js written:', len(text) // 1024, 'KB | countries per measure:', {m: len(data[m]['classes']) for m in MEASURES},
          '| series:', {m: len(data[m]['series']) for m in MEASURES if 'series' in data[m]})
    for scope, theories in score_table.items():
        print(scope)
        for theory, by_period in theories.items():
            s15, s23 = by_period['2015'], by_period['2023']
            _, hit_rate, precision = walkforward.combined({p: walkforward.Score(s['hits'], s['falseAlarms'], s['missed']) for p, s in by_period.items()})
            print(f"   {theory:8s} 2015 {s15}  2023 {s23}  | hit rate {hit_rate:.0%} precision {precision:.0%}")


if __name__ == '__main__':
    main()
