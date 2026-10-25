"""Build the country data for the map: the DATA line of src/data.js, and data/processed/cereal_import_dependency_ratio_1961_2022.csv.

Per country:
  importShare            cereal import dependency (%), the 2020–22 average, from FAO's food balance sheets
  importShareByYear      the same, yearly 1980–2022, for the tooltip
  harvestShortfall       how much smaller (%) El Niño harvests are than neutral-year harvests, both against the
                         country's trend; positive = smaller (cereal production, FAOSTAT via Our World in Data)
  shortfallPValue        Mann-Whitney test of El Niño against neutral harvests; the map hatches p of 0.1 or more
  harvestVsTrendByYear   every harvest against the trend, yearly 1980–2024, for the tooltip
  elNinoHarvestYears     the harvest years that follow an El Niño, shaded in the tooltip

Usage (balance-sheet files as .zip or the unzipped .csv, "Normalized" versions):
    python build_data.py FoodBalanceSheetsHistoric_E_All_Data_(Normalized).zip \\
                         FoodBalanceSheets_E_All_Data_(Normalized).zip \\
                         data/raw/cereal-production.csv

cereal-production.csv: https://ourworldindata.org/grapher/cereal-production.csv?v=1&csvType=full&useColumnShortNames=false
"""
import statistics, sys

from pipeline import enso, harvests, imports
from pipeline.page_files import write_country_data
from pipeline.paths import IMPORTS_CSV

IMPORT_SHARE_YEARS = [2020, 2021, 2022]    # averaged; at least two of them needed
MIN_PRODUCTION_YEARS = 30                  # years of harvests since 1980 for a shortfall
MIN_MEAN_TONNES = 50_000                   # smaller producers are too erratic


def import_shares(ratios):
    """{m49: {name, importShare, importShareByYear}} for every country with at least two years in 2020–22, in the order
    the balance sheets list them."""
    countries = {}
    for m49, country in ratios.groupby('m49', sort=False):
        by_year = dict(zip(country['year'], country['import_dependency']))
        recent = [by_year[y] for y in IMPORT_SHARE_YEARS if y in by_year]
        if len(recent) < 2:
            continue
        countries[m49] = {'name': country['area'].iloc[0], 'importShare': round(statistics.mean(recent), 1),
                          'importShareByYear': [round(float(by_year[y])) if y in by_year else None
                                                for y in range(enso.FIRST_YEAR, imports.LAST_SHEET_YEAR + 1)]}
    return countries


def usable_records(production):
    """The countries with enough harvests since 1980 and large enough not to be erratic."""
    recent = production[production['year'].between(enso.FIRST_YEAR, harvests.LAST_HARVEST_YEAR)]
    stats = recent.groupby('m49')['tonnes'].agg(['count', 'mean'])
    return set(stats.index[(stats['count'] >= MIN_PRODUCTION_YEARS) & (stats['mean'] >= MIN_MEAN_TONNES)])


def shortfall_fields(production, countries):
    """{m49: {harvestShortfall, shortfallPValue, harvestVsTrendByYear, elNinoHarvestYears}} for the countries on the map
    with a usable record and enough El Niño and neutral harvests."""
    eligible = usable_records(production) & set(countries)
    anomalies = harvests.against_trend(production[production['m49'].isin(eligible)])
    table = harvests.shortfalls(anomalies, harvests.MAP_MIN_HARVESTS)
    phased = harvests.by_phase(anomalies)
    fields = {}
    for m49, row in table.iterrows():
        mine, phases = anomalies[anomalies['m49'] == m49], phased[phased['m49'] == m49]
        by_year = dict(zip(mine['year'], mine['vs_trend']))
        el_nino = phases[phases['phase'] == 'El Niño']
        fields[m49] = {'harvestShortfall': round(float(row['shortfall']), 1),
                       'shortfallPValue': round(float(harvests.mann_whitney_p(el_nino['vs_trend'], phases.loc[phases['phase'] == 'neutral', 'vs_trend'])), 3),
                       'harvestVsTrendByYear': [round(float(by_year[y])) if y in by_year else None
                                                for y in range(enso.FIRST_YEAR, harvests.LAST_HARVEST_YEAR + 1)],
                       'elNinoHarvestYears': sorted(int(y) for y in el_nino['year'])}
    return fields


def build(historic_path, current_path, production_path=None):
    """(DATA for the page, the import ratios table)."""
    ratios = imports.import_dependency_by_country(historic_path, current_path)
    countries = import_shares(ratios)
    production = harvests.load_production(production_path) if production_path else None
    if production is not None:
        fields = shortfall_fields(production, countries)
        for m49 in countries:   # keep the page's country order
            if m49 in fields:
                countries[m49].update(fields[m49])
    data = {'importsLastYear': imports.LAST_SHEET_YEAR,
            'harvestsLastYear': harvests.LAST_HARVEST_YEAR if production is not None else None,
            'countries': countries}
    return data, ratios


def write_import_csv(ratios):
    """The import share series, every country and year, for reuse."""
    IMPORTS_CSV.parent.mkdir(parents=True, exist_ok=True)
    table = ratios.assign(cereal_import_dependency_ratio_pct=[round(float(v), 1) for v in ratios['import_dependency']],
                          source_sheet=['FBS historic' if y <= 2009 else 'FBS 2010-' for y in ratios['year']])
    table = table.sort_values(['area', 'year'], kind='stable')
    table.rename(columns={'m49': 'm49_code'})[['m49_code', 'area', 'year', 'cereal_import_dependency_ratio_pct', 'source_sheet']] \
         .to_csv(IMPORTS_CSV, index=False)


def main():
    if len(sys.argv) not in (3, 4):
        sys.exit(__doc__)
    data, ratios = build(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) == 4 else None)
    write_country_data(data)
    write_import_csv(ratios)
    tested = sum(1 for c in data['countries'].values() if 'harvestShortfall' in c)
    print(f"src/data.js updated: {len(data['countries'])} countries on the map, {tested} with a harvest shortfall, imports to {imports.LAST_SHEET_YEAR}")


if __name__ == '__main__':
    main()
