"""Build the country data for the map: the DATA line of js/data.js, and data/cereal_import_dependency_ratio_1961_2022.csv.

Per country:
  importShare            cereal import dependency (%), the 2020–22 average, from FAO's food balance sheets
  importShareByYear      the same, yearly 1980–2022, for the tooltip
  harvestShortfall       how much smaller (%) El Niño harvests are than neutral-year harvests, both against the
                         country's trend; positive = smaller (cereal production, FAOSTAT via Our World in Data)
  shortfallPValue        Mann-Whitney test of El Niño against neutral harvests; the map hatches p of 0.1 or more
  harvestVsTrendByYear   every harvest against the trend, yearly 1980–2024, for the tooltip
  elNinoHarvestYears     the harvest years that follow an El Niño, shaded in the tooltip

Usage (balance-sheet files as .zip or the unzipped .csv, "Normalized" versions):
    python3 build_data.py FoodBalanceSheetsHistoric_E_All_Data_(Normalized).zip \\
                          FoodBalanceSheets_E_All_Data_(Normalized).zip \\
                          cereal-production.csv

cereal-production.csv: https://ourworldindata.org/grapher/cereal-production.csv?v=1&csvType=full&useColumnShortNames=false
Requires Python 3.9+, standard library only.
"""
import csv, statistics, sys

from pipeline import enso, harvests, imports
from pipeline.page_files import write_country_data
from pipeline.paths import DATA_DIR, IMPORTS_CSV

IMPORT_SHARE_YEARS = (2020, 2021, 2022)    # averaged; at least two of them needed
MIN_PRODUCTION_YEARS = 30                  # years of harvests since 1980 for a shortfall
MIN_MEAN_TONNES = 50_000                   # smaller producers are too erratic


def import_shares(ratios, names):
    """{m49: {name, importShare, importShareByYear}} for every country with at least two years in 2020–22."""
    countries = {}
    for m49, by_year in ratios.items():
        recent = [by_year[y] for y in IMPORT_SHARE_YEARS if y in by_year]
        if len(recent) < 2:
            continue
        countries[m49] = {'name': names.get(m49, m49), 'importShare': round(statistics.mean(recent), 1),
                          'importShareByYear': [round(by_year[y]) if y in by_year else None
                                                for y in range(enso.FIRST_YEAR, imports.LAST_SHEET_YEAR + 1)]}
    return countries


def has_usable_record(production):
    """Enough years of harvests since 1980, and a producer large enough not to be erratic."""
    years = [y for y in production if enso.FIRST_YEAR <= y <= harvests.LAST_HARVEST_YEAR]
    return len(years) >= MIN_PRODUCTION_YEARS and statistics.mean(production[y] for y in years) >= MIN_MEAN_TONNES


def shortfall_fields(m49, production):
    """{harvestShortfall, shortfallPValue, harvestVsTrendByYear, elNinoHarvestYears}, or None without a valid test."""
    if not has_usable_record(production):
        return None
    lag = enso.harvest_lag(m49)
    anomalies = harvests.harvest_anomalies(production)
    result = harvests.shortfall(anomalies, lag, harvests.MAP_MIN_HARVESTS)
    if result is None:
        return None
    shortfall, el_nino, neutral = result
    return {'harvestShortfall': round(shortfall, 1),
            'shortfallPValue': round(harvests.mann_whitney_p(el_nino, neutral), 3),
            'harvestVsTrendByYear': [round(anomalies[y]) if y in anomalies else None
                                     for y in range(enso.FIRST_YEAR, harvests.LAST_HARVEST_YEAR + 1)],
            'elNinoHarvestYears': [y for y in sorted(anomalies) if y - lag in enso.EL_NINO_YEARS]}


def build(historic_path, current_path, production_path=None):
    """(DATA for the page, import ratios by country and year, country names)."""
    ratios, names = imports.import_dependency_by_country(historic_path, current_path)
    countries = import_shares(ratios, names)
    production = harvests.load_production(production_path) if production_path else {}
    for m49, tonnes in production.items():
        if m49 in countries:
            fields = shortfall_fields(m49, tonnes)
            if fields:
                countries[m49].update(fields)
    data = {'importsLastYear': imports.LAST_SHEET_YEAR,
            'harvestsLastYear': harvests.LAST_HARVEST_YEAR if production else None,
            'countries': countries}
    return data, ratios, names


def write_import_csv(ratios, names):
    DATA_DIR.mkdir(exist_ok=True)
    with open(IMPORTS_CSV, 'w', newline='', encoding='utf-8') as f:
        out = csv.writer(f)
        out.writerow(['m49_code', 'area', 'year', 'cereal_import_dependency_ratio_pct', 'source_sheet'])
        for m49 in sorted(ratios, key=lambda k: names.get(k, k)):
            for year in sorted(ratios[m49]):
                out.writerow([m49, names.get(m49, m49), year, round(ratios[m49][year], 1), 'FBS historic' if year <= 2009 else 'FBS 2010-'])


def main():
    if len(sys.argv) not in (3, 4):
        sys.exit(__doc__)
    data, ratios, names = build(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) == 4 else None)
    write_country_data(data)
    write_import_csv(ratios, names)
    tested = sum(1 for c in data['countries'].values() if 'harvestShortfall' in c)
    print(f"js/data.js updated: {len(data['countries'])} countries on the map, {tested} with a harvest shortfall, imports to {imports.LAST_SHEET_YEAR}")


if __name__ == '__main__':
    main()
