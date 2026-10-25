#!/usr/bin/env python3
"""Trace the El Niño harvest-shortfall calculation from the raw data to the map, and check it. Writes TRACE.md.

    python3 trace.py [cereal-production.csv]

Sections:
  1. The El Niño / La Niña / neutral years the map uses, against NOAA's Relative Oceanic Niño Index (RONI).
  2. Five countries step by step: raw production, trend, each year against trend, which years count, the shortfall, the
     test and the colour class. It uses the pipeline's own functions, then checks them against scipy and statsmodels.
  3. Whether the recomputed numbers match the ones on the map (js/data.js).
  4. The walk-forward test, its sensitivity to our choices, and a comparison with flagging every southern African country.
  5. Which countries' shortfalls depend on a single El Niño.
  6. Every crisis border, with its figure and source, as recorded in js/data.js.
Needs scipy and statsmodels for the cross-checks in section 2.
"""
import statistics, sys
from pathlib import Path

from pipeline import crises, enso, harvests, walkforward
from pipeline.paths import PRODUCTION_CSV, TRACE_MD
from pipeline.walkforward import ROUNDS, fisher_one_sided, run, score_rule

TRACE_COUNTRIES = ['516', '716', '710', '454', '036']   # Namibia, Zimbabwe, South Africa, Malawi, Australia


def full_shortfall(anomalies, lag, el_nino_years=enso.EL_NINO_YEARS, neutral_years=enso.NEUTRAL_YEARS):
    """(shortfall %, El Niño anomalies, neutral anomalies) over all years, as on the map; None with too few harvests."""
    el_nino, neutral = harvests.split_by_phase(anomalies, lag, el_nino_years, neutral_years)
    if len(el_nino) < walkforward.MIN_EL_NINO or len(neutral) < walkforward.MIN_NEUTRAL:
        return None
    return harvests.shortfall_pct(el_nino, neutral), el_nino, neutral


def section_years(out):
    out('## 1. Which years count as El Niño, La Niña and neutral\n')
    out('The map classifies each year by the **onset** of an episode (`EL_NINO_EVENTS` and `LA_NINA_YEARS` in `pipeline/enso.py`, '
        'based on NOAA\'s Oceanic Niño Index). NOAA now uses the **Relative** Oceanic Niño Index (RONI) officially. '
        'Below, each year is also classed by RONI\'s October–December season (an episode needs five consecutive seasons '
        'beyond ±0.5 °C). Rows marked ⚠ differ.\n')
    out('| Year | Map uses | NOAA RONI (OND) | |')
    out('|---|---|---|---|')
    roni = enso.roni_phases()
    differ = []
    for year in range(1980, 2025):
        ours, theirs = enso.phase(year), roni[year]
        if ours != theirs:
            differ.append((year, ours, theirs))
        out(f'| {year} | {ours} | {theirs} | {"⚠" if ours != theirs else ""} |')
    out(f'\n**{len(differ)} of 45 years differ.** ' + '; '.join(f'{y}: map says {o}, RONI says {r}' for y, o, r in differ) + '.\n')
    neutral_but_la_nina = [y for y, o, r in differ if o == 'neutral' and r == 'La Niña']
    if neutral_but_la_nina:
        out(f'The years the map counts as **neutral** while RONI shows **La Niña** ({", ".join(map(str, neutral_but_la_nina))}) matter most: '
            'in southern Africa La Niña usually brings good rains, so counting them as neutral can make "neutral" harvests look '
            'better and the El Niño shortfall bigger. Section 4 measures how much.\n')
    return differ


def section_countries(out, production):
    from scipy.stats import mannwhitneyu
    from statsmodels.nonparametric.smoothers_lowess import lowess as statsmodels_lowess
    out('## 2. Five countries, step by step\n')
    out('For each country: cereal production (FAO via Our World in Data), the long-term trend (LOWESS, span 0.3, from 1975), '
        'each harvest as % above or below trend, and whether that harvest counts as El Niño, neutral or neither. '
        f'Countries whose main harvest comes the year after the event (`HARVEST_THE_YEAR_AFTER`, {len(enso.HARVEST_THE_YEAR_AFTER)} countries) are shifted by a year.\n')
    for m49 in TRACE_COUNTRIES:
        country = walkforward.COUNTRIES.get(m49, {}); name = country.get('name', m49); tonnes = production[m49]
        lag = enso.harvest_lag(m49)
        years = [y for y in sorted(tonnes) if y >= harvests.TREND_FROM and tonnes[y] > 0 and y <= harvests.LAST_HARVEST_YEAR]
        trend = harvests.lowess(years, [tonnes[y] for y in years])
        trend_check = statsmodels_lowess([tonnes[y] for y in years], years, frac=0.3, it=0, delta=0, return_sorted=False)
        anomalies = walkforward.anomalies(m49)
        out(f'### {name} (M49 {m49}){" — harvest counted the year after the event" if lag else ""}\n')
        out('| Harvest year | Production (t) | Trend (t) | vs trend | ENSO year it follows | Counts as |')
        out('|---|---|---|---|---|---|')
        for year, t in zip(years, trend):
            if year < 1980:
                continue
            event_year = year - lag; p = enso.phase(event_year)
            counts_as = p if p in ('El Niño', 'neutral') else '—'
            out(f'| {year} | {tonnes[year]:,.0f} | {t:,.0f} | {anomalies[year]:+.1f}% | {event_year} ({p}) | {counts_as} |')
        shortfall, el_nino, neutral = full_shortfall(anomalies, lag)
        p_ours = harvests.mann_whitney_p(el_nino, neutral)
        p_scipy = mannwhitneyu(el_nino, neutral, alternative='two-sided', method='asymptotic', use_continuity=False).pvalue
        p_exact = mannwhitneyu(el_nino, neutral, alternative='two-sided', method='exact').pvalue
        trend_gap = max(abs(x - z) / z * 100 for x, z in zip(trend, trend_check))
        out(f'\n- **El Niño harvests:** {len(el_nino)}, averaging {statistics.mean(el_nino):+.1f}% against trend. **Neutral harvests:** {len(neutral)}, averaging {statistics.mean(neutral):+.1f}%.')
        out(f'- **Shortfall:** El Niño harvests are **{shortfall:.1f}% smaller** than neutral ones '
            f'(map: {country.get("harvestShortfall", float("nan")):.1f}%). ')
        out(f'- **Test (Mann-Whitney):** p = {p_ours:.3f} in our code · {p_scipy:.3f} in scipy (same method) · {p_exact:.3f} exact. '
            f'{"Hatched on the map (p ≥ 0.1)." if p_ours >= 0.1 else "Not hatched (p < 0.1)."}')
        out(f'- **Trend check:** our LOWESS and statsmodels\' differ by at most {trend_gap:.3f}% of the trend.')
        border = ('solid — ' + crises.NATIONAL_TABLE[m49][1] if m49 in crises.NATIONAL_TABLE
                  else 'dashed — ' + crises.SMALLER_TABLE[m49][1] if m49 in crises.SMALLER_TABLE else 'none')
        out(f'- **Imports:** {country.get("importShare")}% of cereals (2020–22), from the map data. **Crisis border:** {border}.\n')


def section_consistency(out, production):
    out('## 3. Do the recomputed numbers match the map?\n')
    mismatches, checked = [], 0
    for m49, country in walkforward.COUNTRIES.items():
        if country.get('harvestShortfall') is None or m49 not in production:
            continue
        result = full_shortfall(walkforward.anomalies(m49), enso.harvest_lag(m49))
        if not result:
            continue
        checked += 1
        if abs(result[0] - country['harvestShortfall']) > 0.15:
            mismatches.append((country.get('name', m49), country['harvestShortfall'], round(result[0], 1)))
    out(f'Recomputed the shortfall for all {checked} countries on the map from the raw file: '
        + ('**all match** the published values (to 0.1 percentage points).\n' if not mismatches else
           f'**{len(mismatches)} differ**: ' + '; '.join(f'{n} map {a} vs {b}' for n, a, b in mismatches[:15]) + '\n'))
    return checked, mismatches


def tally_cell(t):
    p = fisher_one_sided(t.flagged_crises, t.flagged - t.flagged_crises, t.other_crises, t.others - t.other_crises)
    return f'{t.flagged_crises} of {t.flagged} vs {t.other_crises} of {t.others} (p = {p:.3f})'


def section_walkforward(out):
    out('## 4. The test: would the map have warned in time?\n')
    out('The map is drawn as it would have looked **before each crisis period**, from what was known then: El Niños up to 2009 and '
        'harvests up to 2014 to predict 2015–16; El Niños up to 2018–19 and harvests up to 2022 to predict 2023–24. A country is '
        '**flagged** at a shortfall of 5% or more. A crisis is a solid border on the map in that period. Fisher\'s exact test, one-sided.\n')
    tallies, (flagged, flagged_crises, others, other_crises, p) = run()
    out('| Predicting | Flagged with a crisis | Others with a crisis | p | Correct flags |')
    out('|---|---|---|---|---|')
    for t in tallies:
        p_round = fisher_one_sided(t.flagged_crises, t.flagged - t.flagged_crises, t.other_crises, t.others - t.other_crises)
        out(f'| {t.period} | {t.flagged_crises} of {t.flagged} ({100 * t.flagged_crises / t.flagged:.0f}%) | {t.other_crises} of {t.others} '
            f'({100 * t.other_crises / t.others:.0f}%) | {p_round:.4f} | {", ".join(sorted(t.hits))} |')
    out(f'\nBoth rounds together: {flagged_crises} of {flagged} against {other_crises} of {others} (p = {p:.4f}). Countries appear in both rounds, so this is optimistic.\n')

    out('### Does it depend on our choices?\n')
    out('| Version | 2015–16 | 2023–24 |')
    out('|---|---|---|')
    roni_el_nino, roni_neutral = enso.roni_years('El Niño'), enso.roni_years('neutral')
    versions = (('As on the page', {}), ('Cut-off 3%', {'flag_at': 3}), ('Cut-off 7.5%', {'flag_at': 7.5}), ('Cut-off 10%', {'flag_at': 10}),
                ('NOAA RONI years', {'el_nino_years': roni_el_nino, 'neutral_years': roni_neutral}), ('Smoother trend (span 0.75)', {'span': 0.75}),
                ('Dashed borders count as crises too', {'crisis_tables': (crises.NATIONAL, crises.SMALLER)}))
    for label, options in versions:
        tallies = run(**options)[0]
        out(f'| {label} | {tally_cell(tallies[0])} | {tally_cell(tallies[1])} |')
    out('\n### Does it depend on one El Niño?\n')
    out('Each row leaves one El Niño out of every country\'s shortfall.\n')
    out('| Left out | 2015–16 | 2023–24 |')
    out('|---|---|---|')
    for left_out in sorted(y for y in enso.EL_NINO_YEARS if y <= 2018):
        tallies = run(leave_out={left_out})[0]
        out(f'| {left_out} | {tally_cell(tallies[0])} | {tally_cell(tallies[1])} |')
    out('\nWithout the 1991–92 El Niño, southern Africa\'s worst drought in decades, neither round is significant: much of the signal rests on that one event.\n')

    out('### Does the harvest measure beat simply flagging southern Africa?\n')
    out('Forecast scores per round. **Hit rate:** share of crises flagged in advance. **Precision:** share of flags followed by a crisis. '
        'Southern Africa here means Angola, Botswana, Eswatini, Lesotho, Madagascar, Malawi, Mozambique, Namibia, South Africa, Zambia and Zimbabwe.\n')
    southern_africa = walkforward.SOUTHERN_AFRICA
    rules = (('Harvest measure (shortfall ≥ 5%)', lambda m49, shortfall, rnd: shortfall >= 5),
             ('Baseline: every southern African country', lambda m49, shortfall, rnd: m49 in southern_africa),
             ('Southern Africa and shortfall ≥ 5%', lambda m49, shortfall, rnd: m49 in southern_africa and shortfall >= 5))
    out('| Rule | Round | Flagged | Hits | False alarms | Misses | Hit rate | Precision |')
    out('|---|---|---|---|---|---|---|---|')
    for label, rule in rules:
        by_period = score_rule(rule)
        for period, s in by_period.items():
            out(f'| {label} | {period} | {s.hits + s.false_alarms} | {s.hits} | {s.false_alarms} | {s.missed} | '
                f'{s.hits / (s.hits + s.missed):.0%} | {s.hits / max(1, s.hits + s.false_alarms):.0%} |')
        hits, false_alarms, missed = (sum(getattr(s, k) for s in by_period.values()) for k in ('hits', 'false_alarms', 'missed'))
        out(f'| {label} | **both** | {hits + false_alarms} | {hits} | {false_alarms} | {missed} | {hits / (hits + missed):.0%} | {hits / max(1, hits + false_alarms):.0%} |')
    out('\nThe region itself is the warning: flagging every southern African country catches more crises with far fewer false alarms than the '
        'harvest measure alone. Within the region, the harvest measure removes some false alarms, mainly in 2023–24.\n')


def section_leave_one_out(out, production):
    out('## 5. Which countries\' shortfalls depend on a single El Niño?\n')
    out('For every country with a shortfall of 5% or more on the map, the shortfall recomputed 14 times, each time leaving one El Niño out. '
        '**Fragile** means it falls below 5% without at least one of them: a coinciding shock (war, economic collapse) or luck may explain it.\n')
    out('| Country | Map | p | Lowest without one El Niño | Verdict |')
    out('|---|---|---|---|---|')
    rows = []
    for m49, country in walkforward.COUNTRIES.items():
        if country.get('harvestShortfall') is None or m49 not in production or country['harvestShortfall'] < 5:
            continue
        lag, anomalies = enso.harvest_lag(m49), walkforward.anomalies(m49)
        def shortfall_without(left_out):
            years = enso.EL_NINO_YEARS - left_out
            el_nino, neutral = harvests.split_by_phase(anomalies, lag, years, enso.NEUTRAL_YEARS)
            return harvests.shortfall_pct(el_nino, neutral)
        without_each = [(year, shortfall_without({year})) for year in sorted(enso.EL_NINO_YEARS)]
        lowest = min(without_each, key=lambda t: t[1])
        below = [year for year, v in without_each if v < 5]
        rows.append((country['harvestShortfall'], country['name'], country.get('shortfallPValue', 1), lowest, below))
    for full, name, p, lowest, below in sorted(rows, reverse=True):
        verdict = 'fragile: below 5% without ' + ', '.join(map(str, below)) if below else 'robust'
        out(f'| {name} | {full:.1f}% | {p:.3f} | {lowest[1]:.1f}% (without {lowest[0]}) | {verdict} |')
    out('')


def section_crisis_sources(out):
    out('## 6. Crisis borders: figure and source for each\n')
    out('Shares are of the whole population in IPC Phase 3 or worse (or the Global Report\'s accepted equivalent), '
        'as recorded in `js/data.js`. Check each against its source.\n')
    out('| Country | Border | Years | Figure and source note |')
    out('|---|---|---|---|')
    for border, table in (('solid', crises.NATIONAL_TABLE), ('dashed', crises.SMALLER_TABLE)):
        for m49, (periods, note) in table.items():
            out(f'| {walkforward.COUNTRIES.get(m49, {}).get("name", m49)} | {border} | {", ".join(periods)} | {note} |')
    out('\nSources: Global Report on Food Crises 2017 (2016 table) and its 2024 and 2025 country profiles; IPC Timor-Leste '
        '(November 2023–April 2024); Viet Nam joint government–UN Emergency Response Plan (April 2016).\n')


def main():
    production = harvests.load_production(sys.argv[1] if len(sys.argv) > 1 else PRODUCTION_CSV)
    lines = []
    out = lines.append
    out('# Trace: from raw data to the map\n')
    out('Generated by `trace.py` from the raw production file and `js/data.js`. It reuses the functions in '
        '`pipeline/`, so it shows what the code actually does. Regenerate it whenever the data changes.\n')
    differ = section_years(out)
    section_countries(out, production)
    checked, mismatches = section_consistency(out, production)
    section_walkforward(out)
    section_leave_one_out(out, production)
    section_crisis_sources(out)
    Path(TRACE_MD).write_text('\n'.join(lines), encoding='utf-8')
    print('TRACE.md written:', len(lines), 'lines;', len(differ), 'year classifications differ from RONI;', checked, 'countries checked,', len(mismatches), 'mismatches')


if __name__ == '__main__':
    main()
