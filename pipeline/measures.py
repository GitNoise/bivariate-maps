"""The second measures the map pairs with the harvest shortfall, their source data, and their three classes.

Most are proxies for a country's capacity to cope with a bad harvest: income, extreme poverty, human development, life
expectancy. Cereal imports stand for dependence on world markets; undernourishment for chronic hunger before the shock.
Classes: 0 = strong capacity, 1 = middle, 2 = weak, with thresholds fixed before testing.
"""
from functools import cache

import numpy as np
import pandas as pd

from . import harvests
from .countries import COUNTRIES, PAGE_ORDER, TESTED
from .paths import MEASURES_DIR, PRODUCTION_CSV

ALL_MEASURES = ('imports', 'gdp', 'poverty', 'hdi', 'life', 'undernourishment')

# ---- country codes: UN M49 (the map) -> ISO3 (World Bank, Our World in Data), and country name -> ISO3 ----------------
M49_TO_ISO3 = {}
for _iso3, _m49 in harvests.ISO3_TO_M49.items():
    M49_TO_ISO3.setdefault(_m49, _iso3)
_entities = pd.read_csv(PRODUCTION_CSV, usecols=['Entity', 'Code'], dtype=str).dropna()
NAME_TO_ISO3 = dict(_entities[~_entities['Code'].str.startswith('OWID')].drop_duplicates('Entity', keep='last').values)


# ---- the sources, each as a table of iso3, year, value ----------------------------------------------------------------
def _world_bank(name):
    table = pd.read_csv(MEASURES_DIR / name, encoding='utf-8-sig')
    table = table.rename(columns={'Country Code': 'iso3', 'Year': 'year', 'Value': 'value'})
    return table.assign(value=pd.to_numeric(table['value'], errors='coerce')).dropna(subset=['value'])[['iso3', 'year', 'value']]


def _gdp_per_person():
    """GDP / population, for the years that have both (World Bank)."""
    both = _world_bank('gdp.csv').merge(_world_bank('population.csv'), on=['iso3', 'year'], suffixes=('_gdp', '_population'))
    return both.assign(value=both['value_gdp'] / both['value_population'])[['iso3', 'year', 'value']]


def _poverty():
    """% below the international poverty line, national surveys (World Bank PIP via Our World in Data); the first row per
    country and survey year counts."""
    pip = pd.read_csv(MEASURES_DIR / 'pip.csv', usecols=['country', 'year', 'reporting_level', 'headcount_ratio_international_povline'])
    pip = pip[(pip['reporting_level'] == 'national') & pip['headcount_ratio_international_povline'].notna()]
    pip = pip.assign(iso3=pip['country'].map(NAME_TO_ISO3), value=pip['headcount_ratio_international_povline']).dropna(subset=['iso3'])
    return pip.drop_duplicates(['iso3', 'year'])[['iso3', 'year', 'value']]


def _owid(name, column=None):
    """An Our World in Data CSV, countries only. column: the value column (default: the first that isn't Entity, Code or
    Year); values like '<2.5' count as 2.5. Empty when the file isn't there (undernourishment is optional)."""
    if not (MEASURES_DIR / name).exists():
        return pd.DataFrame(columns=['iso3', 'year', 'value'])
    table = pd.read_csv(MEASURES_DIR / name, encoding='utf-8-sig', dtype={'Code': str})
    column = column or next(c for c in table.columns if c not in ('Entity', 'Code', 'Year'))
    table = table[table['Code'].notna() & ~table['Code'].str.startswith('OWID', na=True)]
    values = pd.to_numeric(table[column].astype(str).str.replace('<', '', regex=False), errors='coerce')
    return pd.DataFrame({'iso3': table['Code'], 'year': table['Year'], 'value': values}).dropna(subset=['value'])


GDP_PER_PERSON = _gdp_per_person()
POVERTY = _poverty()
UNDERNOURISHMENT = _owid('undernourishment.csv')
# human development and life expectancy: one recent value per country (Our World in Data); the classes use these
RECENT = pd.read_csv(MEASURES_DIR / 'covid_latest.csv', usecols=['iso_code', 'human_development_index', 'life_expectancy']).set_index('iso_code')


@cache
def hdi_by_year():
    """HDI per country and year, for the tooltip only."""
    return _owid('human-development-index.csv', 'Human Development Index')


@cache
def life_by_year():
    """Life expectancy per country and year, for the tooltip only."""
    return _owid('life-expectancy.csv', 'Life expectancy')


def latest_up_to(table, year, look_back=None):
    """Each country's latest value up to the year (and no more than look_back years before it): a Series by iso3."""
    window = table[table['year'] <= year]
    if look_back is not None:
        window = window[window['year'] >= year - look_back]
    return window.sort_values('year').groupby('iso3')['value'].last()


# the measures on the map: undernourishment only when data/raw/measures/undernourishment.csv is there
MEASURES = [m for m in ALL_MEASURES if m != 'undernourishment' or not UNDERNOURISHMENT.empty]


# ---- classes ------------------------------------------------------------------------------------------------------
# life expectancy is split at its median over the tested countries
LIFE_EXPECTANCY_MEDIAN = float(RECENT['life_expectancy'].reindex(
    [M49_TO_ISO3[m49] for m49 in PAGE_ORDER if m49 in TESTED and m49 in M49_TO_ISO3]).median())

# the thresholds as (middle class from, weak class from); written to src/measures.js, where the scatter marks them
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


def classes(measure, values, year):
    """0, 1 or 2 (2 = weakest capacity) for a Series of values; <NA> where there is no value."""
    middle, weak = thresholds(measure, year)
    if HIGHER_IS_WEAKER[measure]:
        cls = np.select([values >= weak, values >= middle], [2, 1], 0)
    else:
        cls = np.select([values < weak, values < middle], [2, 1], 0)
    return pd.Series(cls, index=values.index).astype('Int64').where(values.notna())


@cache
def known_in(year):
    """Every measure for every country on the map as known in the year: a table indexed by m49 (page order) with a
    value column and a class column per measure (e.g. gdp, gdp_class)."""
    iso3 = pd.Series({m49: M49_TO_ISO3.get(m49) for m49 in PAGE_ORDER}, dtype=object)
    by_iso3 = {
        'gdp': latest_up_to(GDP_PER_PERSON, year, look_back=3),
        'poverty': latest_up_to(POVERTY, year),
        'hdi': RECENT['human_development_index'].dropna(),
        'life': RECENT['life_expectancy'].dropna(),
        'undernourishment': latest_up_to(UNDERNOURISHMENT, year),
    }
    table = pd.DataFrame({'imports': pd.Series({m49: COUNTRIES[m49].get('importShare') for m49 in PAGE_ORDER}, dtype=float)})
    for measure, values in by_iso3.items():
        table[measure] = iso3.map(values).astype(float)
    for measure in ALL_MEASURES:
        table[f'{measure}_class'] = classes(measure, table[measure], year)
    return table


def classes_known_then(outcomes, measure):
    """For each row of the walk-forward outcomes table, the measure's class as known at the end of that round's data
    window (its last harvest year): an Int64 Series, <NA> without data."""
    return pd.Series([known_in(year).at[m49, f'{measure}_class'] for m49, year in zip(outcomes['m49'], outcomes['last_harvest'])],
                     index=outcomes.index, dtype='Int64')
