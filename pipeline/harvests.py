"""Cereal production, its long-term trend, and the El Niño harvest shortfall.

The shortfall: each harvest is measured against the country's long-term trend (LOWESS); El Niño harvests are then compared
with neutral-year harvests. Production, not yield, because failed fields go unharvested and are part of the food lost.
"""
import math

import pandas as pd
from scipy.stats import mannwhitneyu
from statsmodels.nonparametric.smoothers_lowess import lowess

from . import enso

TREND_FROM = 1975           # the trend is fitted from 1975, so 1980 has years on both sides
LAST_HARVEST_YEAR = 2024
TREND_SPAN = 0.3            # the LOWESS span the map uses; analysis/robustness.py also tries 0.75
MIN_TREND_WINDOW = 4
MAP_MIN_HARVESTS = (8, 7)   # El Niño and neutral harvests a country needs for a shortfall on the map

# ISO3 codes (Our World in Data) -> UN M49 codes (FAO, and the map); pre-split areas fold into their successors
ISO3_TO_M49 = {"AFG":"004","ALB":"008","DZA":"012","AGO":"024","ATG":"028","ARG":"032","ARM":"051","AUS":"036","AUT":"040","AZE":"031","BHS":"044","BGD":"050","BRB":"052","BLR":"112","BEL":"056","BLZ":"084","BEN":"204","BTN":"064","BOL":"068","BIH":"070","BWA":"072","BRA":"076","BRN":"096","BGR":"100","BFA":"854","BDI":"108","KHM":"116","CMR":"120","CAN":"124","CPV":"132","CAF":"140","TCD":"148","CHL":"152","CHN":"156","COL":"170","COM":"174","COG":"178","CRI":"188","CIV":"384","HRV":"191","CUB":"192","CYP":"196","CZE":"203","COD":"180","DNK":"208","DJI":"262","DMA":"212","DOM":"214","TLS":"626","ECU":"218","EGY":"818","SLV":"222","ERI":"232","EST":"233","SWZ":"748","ETH":"231","FJI":"242","FIN":"246","FRA":"250","GUF":"254","GAB":"266","GMB":"270","GEO":"268","DEU":"276","GHA":"288","GRC":"300","GRD":"308","GLP":"312","GTM":"320","GIN":"324","GNB":"624","GUY":"328","HTI":"332","HND":"340","HKG":"344","HUN":"348","ISL":"352","IND":"356","IDN":"360","IRN":"364","IRQ":"368","IRL":"372","ISR":"376","ITA":"380","JAM":"388","JPN":"392","JOR":"400","KAZ":"398","KEN":"404","KWT":"414","KGZ":"417","LAO":"418","LVA":"428","LBN":"422","LSO":"426","LBR":"430","LBY":"434","LTU":"440","LUX":"442","MDG":"450","MWI":"454","MYS":"458","MDV":"462","MLI":"466","MLT":"470","MRT":"478","MUS":"480","MEX":"484","FSM":"583","MDA":"498","MNG":"496","MNE":"499","MAR":"504","MOZ":"508","MMR":"104","NAM":"516","NPL":"524","NLD":"528","NCL":"540","NZL":"554","NIC":"558","NER":"562","NGA":"566","PRK":"408","MKD":"807","NOR":"578","OMN":"512","PAK":"586","PSE":"275","PAN":"591","PNG":"598","PRY":"600","PER":"604","PHL":"608","POL":"616","PRT":"620","PRI":"630","QAT":"634","REU":"638","ROU":"642","RUS":"643","RWA":"646","LCA":"662","VCT":"670","STP":"678","SAU":"682","SEN":"686","SRB":"688","SLE":"694","SVK":"703","SVN":"705","SLB":"090","SOM":"706","ZAF":"710","KOR":"410","SSD":"728","ESP":"724","LKA":"144","SDN":"729","SUR":"740","SWE":"752","CHE":"756","SYR":"760","TWN":"158","TJK":"762","TZA":"834","THA":"764","TGO":"768","TTO":"780","TUN":"788","TUR":"792","TKM":"795","UGA":"800","UKR":"804","ARE":"784","GBR":"826","USA":"840","URY":"858","UZB":"860","VUT":"548","VEN":"862","VNM":"704","YEM":"887","ZMB":"894","ZWE":"716"}
ISO3_TO_M49.update({'OWID_ERE': '231', 'OWID_SDN': '729'})   # Ethiopia PDR -> Ethiopia, former Sudan -> Sudan


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
