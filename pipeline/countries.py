"""The countries on the map, as the page has them, and their cereal production. Shared by measures and walkforward.

    COUNTRIES        the country records of js/data.js (name, import share, harvest shortfall, series), in page order
    SOUTHERN_AFRICA  the southern African countries, from js/settings.js: the baseline that flags every country there
    PRODUCTION       cereal production in tonnes, {m49: {year: tonnes}}, from data/cereal-production.csv
    TESTED           the countries with a harvest shortfall on the map and production data
"""
from . import harvests, page_files
from .paths import PRODUCTION_CSV

COUNTRIES = page_files.read_country_data()['countries']
SOUTHERN_AFRICA = page_files.read_southern_africa()
PRODUCTION = harvests.load_production(PRODUCTION_CSV)
TESTED = {m49 for m49, c in COUNTRIES.items() if c.get('harvestShortfall') is not None and m49 in PRODUCTION}
