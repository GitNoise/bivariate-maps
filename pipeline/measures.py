"""The second measures the map pairs with the harvest shortfall, their source data, and their three classes.

Most are proxies for a country's capacity to cope with a bad harvest: income, extreme poverty, human development, life
expectancy. Cereal imports stand for dependence on world markets; undernourishment for chronic hunger before the shock.
Classes: 0 = strong capacity, 1 = middle, 2 = weak, with thresholds fixed before testing.
"""
import csv, statistics
from functools import cache

from . import harvests
from .countries import COUNTRIES, TESTED
from .paths import MEASURES_DIR, PRODUCTION_CSV

ALL_MEASURES = ('imports', 'gdp', 'poverty', 'hdi', 'life', 'undernourishment')


def _open(name, encoding='utf-8'):
    return open(MEASURES_DIR / name, encoding=encoding)


# ---- country codes: UN M49 (the map) -> ISO3 (World Bank, Our World in Data), and country name -> ISO3 ----------------
M49_TO_ISO3 = {}
for _iso3, _m49 in harvests.ISO3_TO_M49.items():
    M49_TO_ISO3.setdefault(_m49, _iso3)
# Our World in Data names, as in the poverty file, from the production file
NAME_TO_ISO3 = {row['Entity']: row['Code'] for row in csv.DictReader(open(PRODUCTION_CSV, encoding='utf-8'))
                if row['Code'] and not row['Code'].startswith('OWID')}


# ---- income: GDP and population (World Bank) -----------------------------------------------------------------------
def _world_bank(name):
    """A World Bank CSV as {ISO3: {year: value}}."""
    out = {}
    for row in csv.DictReader(_open(name, 'utf-8-sig')):
        try:
            out.setdefault(row['Country Code'], {})[int(row['Year'])] = float(row['Value'])
        except (KeyError, ValueError):
            pass
    return out


GDP = _world_bank('gdp.csv')
POPULATION = _world_bank('population.csv')


def gdp_per_person(iso3, year):
    """GDP per person in the year, or in the latest of the three years before."""
    for y in range(year, year - 4, -1):
        if y in GDP.get(iso3, {}) and y in POPULATION.get(iso3, {}):
            return GDP[iso3][y] / POPULATION[iso3][y]


def gdp_per_person_in(iso3, year):
    """GDP per person in exactly that year, rounded, for the tooltip's series."""
    gdp, population = GDP.get(iso3, {}).get(year), POPULATION.get(iso3, {}).get(year)
    return round(gdp / population) if gdp is not None and population else None


# ---- extreme poverty: % below the international poverty line, national surveys (World Bank PIP) ----------------------
POVERTY = {}   # {ISO3: {survey year: %}}
for _row in csv.DictReader(_open('pip.csv')):
    if _row['reporting_level'] != 'national' or not _row['headcount_ratio_international_povline']:
        continue
    _iso3 = NAME_TO_ISO3.get(_row['country'])
    if _iso3:
        POVERTY.setdefault(_iso3, {}).setdefault(int(_row['year']), float(_row['headcount_ratio_international_povline']))


def latest(series_by_year, year):
    """The latest value up to the year, or None."""
    years = [y for y in series_by_year if y <= year]
    return series_by_year[max(years)] if years else None


def poverty(iso3, year):
    """Extreme poverty in the latest survey up to the year."""
    return latest(POVERTY.get(iso3, {}), year)


# ---- human development and life expectancy: one recent value per country (Our World in Data) ------------------------
RECENT = {row['iso_code']: row for row in csv.DictReader(_open('covid_latest.csv'))}


def recent_value(iso3, column):
    value = RECENT.get(iso3, {}).get(column, '')
    return float(value) if value not in ('', None) else None


def hdi(iso3):
    return recent_value(iso3, 'human_development_index')


def life_expectancy(iso3):
    return recent_value(iso3, 'life_expectancy')


# ---- yearly Our World in Data series: HDI and life expectancy (tooltip only), undernourishment (classes and tooltip) -----
def _owid(name, column=None):
    """An Our World in Data CSV as {ISO3: {year: value}}, countries only. column: the value column (default: the first
    column that isn't Entity, Code or Year); values like '<2.5' count as 2.5."""
    out = {}
    if not (MEASURES_DIR / name).exists():
        return out
    for row in csv.DictReader(_open(name, 'utf-8-sig')):
        col = column or next(k for k in row if k not in ('Entity', 'Code', 'Year'))
        code, value = row.get('Code'), (row.get(col) or '').replace('<', '')
        if not code or code.startswith('OWID') or not value:
            continue
        try:
            out.setdefault(code, {})[int(row['Year'])] = float(value)
        except ValueError:
            pass
    return out


@cache
def hdi_by_year():
    """HDI per country and year, for the tooltip only (the classes use the recent value above)."""
    return _owid('human-development-index.csv', 'Human Development Index')


@cache
def life_by_year():
    """Life expectancy per country and year, for the tooltip only (the classes use the recent value above)."""
    return _owid('life-expectancy.csv', 'Life expectancy')


UNDERNOURISHMENT = _owid('undernourishment.csv')


def undernourishment(iso3, year):
    """FAO's prevalence of undernourishment (three-year average), latest up to the year."""
    return latest(UNDERNOURISHMENT.get(iso3, {}), year)


# the measures on the map: undernourishment only when data/proxies/undernourishment.csv is there
MEASURES = [m for m in ALL_MEASURES if m != 'undernourishment' or UNDERNOURISHMENT]


# ---- classes ------------------------------------------------------------------------------------------------------
# life expectancy is split at its median over the tested countries
LIFE_EXPECTANCY_MEDIAN = statistics.median(
    [v for v in (life_expectancy(M49_TO_ISO3.get(m49)) for m49 in COUNTRIES
                 if m49 in TESTED and M49_TO_ISO3.get(m49)) if v is not None])

# the thresholds as (middle class from, weak class from); written to js/measures.js, where the tooltip marks them
THRESHOLDS = {'imports': (25, 50), 'poverty': (25, 50), 'undernourishment': (10, 25),
              'hdi': (0.700, 0.550), 'life': (LIFE_EXPECTANCY_MEDIAN, 65)}
# World Bank income groups, with the thresholds of the time
GDP_THRESHOLDS = {'before 2020': (4125, 1045), 'from 2020': (4465, 1135)}
HIGHER_IS_WEAKER = {'imports': True, 'poverty': True, 'undernourishment': True, 'hdi': False, 'life': False, 'gdp': False}


def thresholds(measure, year):
    """(middle class from, weak class from); income's depend on the year."""
    if measure == 'gdp':
        return GDP_THRESHOLDS['before 2020' if year < 2020 else 'from 2020']
    return THRESHOLDS[measure]


def class_of(measure, value, year):
    """0, 1 or 2 (2 = weakest capacity), or None without a value."""
    if value is None:
        return None
    middle, weak = thresholds(measure, year)
    if HIGHER_IS_WEAKER[measure]:
        return 2 if value >= weak else 1 if value >= middle else 0
    return 2 if value < weak else 1 if value < middle else 0


@cache
def values_known_in(m49, year):
    """Every measure for the country as known in the year: {measure: (value, class)}."""
    iso3 = M49_TO_ISO3.get(m49)
    if iso3:
        found = {'gdp': gdp_per_person(iso3, year), 'poverty': poverty(iso3, year), 'undernourishment': undernourishment(iso3, year),
                 'hdi': hdi(iso3), 'life': life_expectancy(iso3)}
    else:   # no ISO code, no data
        found = dict.fromkeys(['gdp', 'poverty', 'undernourishment', 'hdi', 'life'])
    found['imports'] = COUNTRIES[m49].get('importShare')   # the 2020–22 average, for every year
    return {measure: (value, class_of(measure, value, year)) for measure, value in found.items()}
