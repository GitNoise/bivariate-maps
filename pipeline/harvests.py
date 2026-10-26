"""Cereal production, its long-term trend, and the El Niño harvest shortfall.

The shortfall: each harvest is measured against the country's long-term trend (LOWESS); El Niño harvests are then compared
with neutral-year harvests. Production, not yield, because failed fields go unharvested and are part of the food lost.
"""
import math

import pandas as pd
from scipy.stats import mannwhitneyu
from statsmodels.nonparametric.smoothers_lowess import lowess

from . import codes, enso

TREND_FROM = 1975           # the trend is fitted from 1975, so 1980 has years on both sides
LAST_HARVEST_YEAR = 2024
TREND_SPAN = 0.3            # the LOWESS span the map uses; analysis/robustness.py also tries 0.75
MIN_TREND_WINDOW = 4
MAP_MIN_HARVESTS = (8, 7)   # El Niño and neutral harvests a country needs for a shortfall on the map

# ISO3 codes (Our World in Data) -> UN M49 codes (FAO, and the map); pre-split areas fold into their successors
ISO3_TO_M49 = {**codes.ISO3_TO_M49, 'OWID_ERE': '231', 'OWID_SDN': '729'}   # Ethiopia PDR -> Ethiopia, former Sudan -> Sudan


def load_production(path):
    """Cereal production from the Our World in Data CSV: a table of m49, year, tonnes, sorted by country and year.
    A pre-split area's figures fill its successor's years only where the successor has none of its own."""
    raw = pd.read_csv(path, dtype={'Code': str})
    raw = raw.assign(m49=raw['Code'].map(ISO3_TO_M49), tonnes=raw['Cereals - Production (tonnes)'],
                     predecessor=raw['Code'].str.startswith('OWID_', na=False))
    production = (raw.dropna(subset=['m49', 'tonnes'])
                     .sort_values('predecessor', kind='stable')   # successors' own rows first, so they win the duplicates
                     .drop_duplicates(['m49', 'Year'])
                     .rename(columns={'Year': 'year'}))
    return production[['m49', 'year', 'tonnes']].sort_values(['m49', 'year']).reset_index(drop=True)


def trend(years, tonnes, span=TREND_SPAN):
    """The long-term trend of a series: LOWESS (statsmodels, no robustness iterations) with each local fit on `span` of the
    years, rounded up, and at least MIN_TREND_WINDOW years."""
    window = max(MIN_TREND_WINDOW, math.ceil(span * len(years)))
    return lowess(tonnes, years, frac=window / len(years), it=0, delta=0, return_sorted=False)


def against_trend(production, span=TREND_SPAN):
    """Each harvest as % above or below its country's trend, fitted on the harvests from TREND_FROM to LAST_HARVEST_YEAR:
    a table of m49, year, tonnes, trend, vs_trend (%), from 1980."""
    fitted = production[production['year'].between(TREND_FROM, LAST_HARVEST_YEAR) & (production['tonnes'] > 0)].copy()
    fitted['trend'] = pd.concat([pd.Series(trend(c['year'].to_numpy(), c['tonnes'].to_numpy(), span), index=c.index)
                                 for _, c in fitted.groupby('m49', sort=False)])
    fitted = fitted[(fitted['trend'] > 0) & (fitted['year'] >= enso.FIRST_YEAR)]
    return fitted.assign(vs_trend=(fitted['tonnes'] / fitted['trend'] - 1) * 100).reset_index(drop=True)


def shortfall_pct(el_nino_mean, neutral_mean):
    """How much smaller (%) the mean El Niño harvest is than the mean neutral-year harvest, both measured against the
    trend (means of % anomalies). Positive = smaller. A plain percentage, easier to read than a gap in points."""
    return -(((1 + el_nino_mean / 100) / (1 + neutral_mean / 100)) - 1) * 100


def by_phase(anomalies, el_nino_years=None, neutral_years=None):
    """The harvests that follow El Niño and neutral years, each shifted by its country's harvest lag: the anomalies table
    with a `phase` column ('El Niño' or 'neutral'); other harvests are dropped. Years default to the map's."""
    el_nino_years = enso.EL_NINO_YEARS if el_nino_years is None else el_nino_years
    neutral_years = enso.NEUTRAL_YEARS if neutral_years is None else neutral_years
    event_year = anomalies['year'] - anomalies['m49'].map(enso.harvest_lag)
    phase = pd.Series(None, index=anomalies.index, dtype='object')
    phase[event_year.isin(el_nino_years)] = 'El Niño'
    phase[event_year.isin(neutral_years)] = 'neutral'
    return anomalies.assign(phase=phase).dropna(subset=['phase'])


def shortfalls(anomalies, min_harvests, el_nino_years=None, neutral_years=None):
    """Per country, indexed by m49: its numbers of El Niño and neutral harvests (n_el_nino, n_neutral), their mean
    anomalies (el_nino, neutral) and its shortfall (%), for the countries with at least min_harvests = (El Niño, neutral)."""
    stats = (by_phase(anomalies, el_nino_years, neutral_years)
             .groupby(['m49', 'phase'])['vs_trend'].agg(['count', 'mean']).unstack('phase'))
    table = pd.DataFrame({'n_el_nino': stats[('count', 'El Niño')], 'n_neutral': stats[('count', 'neutral')],
                          'el_nino': stats[('mean', 'El Niño')], 'neutral': stats[('mean', 'neutral')]})
    table = table[(table['n_el_nino'] >= min_harvests[0]) & (table['n_neutral'] >= min_harvests[1])].copy()
    table['shortfall'] = shortfall_pct(table['el_nino'], table['neutral'])
    return table


def mann_whitney_p(el_nino, neutral):
    """Two-sided Mann-Whitney U test, normal approximation without continuity correction (scipy): could the El Niño and
    neutral harvests come from the same distribution? The map hatches a shortfall with p of 0.1 or more."""
    return mannwhitneyu(el_nino, neutral, alternative='two-sided', method='asymptotic', use_continuity=False).pvalue
