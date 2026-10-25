"""The walk-forward test: the map drawn as it would have looked before each crisis period, from what was known then.

For each round, a country's shortfall uses only El Niños up to `last_el_nino` and harvests up to `last_harvest`. A country is
flagged at a shortfall of FLAG_AT % or more; a flag followed by a national crisis in the round's period is a hit.
"""
from collections import namedtuple
from math import comb

from . import crises, enso, harvests, page_files
from .paths import PRODUCTION_CSV

Round = namedtuple('Round', 'period last_el_nino last_harvest')
ROUNDS = [Round('2015–16', 2009, 2014), Round('2023–24', 2018, 2022)]
FLAG_AT = 5                       # % shortfall
MIN_EL_NINO, MIN_NEUTRAL = 6, 7   # harvests needed on each side for a shortfall

PRODUCTION = harvests.load_production(PRODUCTION_CSV)   # {m49: {year: tonnes}}
COUNTRIES = page_files.read_country_data()['countries']  # the map's country records
SOUTHERN_AFRICA = page_files.read_southern_africa()
TESTED = {m49 for m49, c in COUNTRIES.items() if c.get('harvestShortfall') is not None and m49 in PRODUCTION}

_anomalies = {}


def anomalies(m49, span=harvests.TREND_SPAN):
    """The country's harvests against its trend, cached per trend span."""
    if (m49, span) not in _anomalies:
        _anomalies[(m49, span)] = harvests.harvest_anomalies(PRODUCTION[m49], frac=span)
    return _anomalies[(m49, span)]


for _m49 in TESTED:   # the page's span, fitted up front; other spans are fitted on first use
    anomalies(_m49)


def shortfall_known_before(m49, rnd, el_nino_years=None, neutral_years=None, span=harvests.TREND_SPAN, leave_out=()):
    """The country's shortfall (%) as it could have been computed before the round, or None with too few harvests.
    el_nino_years, neutral_years: the classification to use (default: the map's); leave_out: El Niños to drop."""
    el_nino_years = el_nino_years or enso.EL_NINO_YEARS
    neutral_years = neutral_years or enso.NEUTRAL_YEARS
    lag = enso.harvest_lag(m49)
    by_year = anomalies(m49, span)
    el_nino = [v for y, v in by_year.items()
               if y - lag in el_nino_years and y - lag <= rnd.last_el_nino and y <= rnd.last_harvest and y - lag not in leave_out]
    neutral = [v for y, v in by_year.items() if y - lag in neutral_years and y <= rnd.last_harvest]
    if len(el_nino) < MIN_EL_NINO or len(neutral) < MIN_NEUTRAL:
        return None
    return harvests.shortfall_pct(el_nino, neutral)


def fisher_one_sided(a, b, c, d):
    """Fisher's exact test, one-sided: flagged with a crisis a, flagged without b, others with c, others without d.
    The chance of a or more crises among the flagged if flags and crises were unrelated."""
    flagged, with_crisis, total = a + b, a + c, a + b + c + d
    return sum(comb(with_crisis, x) * comb(total - with_crisis, flagged - x) / comb(total, flagged)
               for x in range(a, min(with_crisis, flagged) + 1))


Tally = namedtuple('Tally', 'period flagged flagged_crises others other_crises hits southern_africa')


def run(flag_at=FLAG_AT, el_nino_years=None, neutral_years=None, span=harvests.TREND_SPAN, leave_out=(),
        crisis_tables=(crises.NATIONAL,), import_filter=None):
    """Flag countries and count crises among flagged and other countries, per round.
    import_filter: only count countries whose import share passes it.
    Returns ([Tally per round], (flagged, flagged crises, others, other crises, Fisher's p) for both rounds together);
    southern_africa in each tally is [flagged, of which with a crisis]."""
    tallies = []
    for rnd in ROUNDS:
        flagged = flagged_crises = others = other_crises = 0
        hits, southern_africa = [], [0, 0]
        for m49, country in COUNTRIES.items():
            if m49 not in TESTED:
                continue
            shortfall = shortfall_known_before(m49, rnd, el_nino_years, neutral_years, span, leave_out)
            if shortfall is None:
                continue
            if import_filter is not None and not import_filter(country.get('importShare')):
                continue
            crisis = crises.had_crisis(m49, rnd.period, crisis_tables)
            if shortfall >= flag_at:
                flagged += 1; flagged_crises += crisis
                if crisis:
                    hits.append(country['name'])
                if m49 in SOUTHERN_AFRICA:
                    southern_africa[0] += 1; southern_africa[1] += crisis
            else:
                others += 1; other_crises += crisis
        tallies.append(Tally(rnd.period, flagged, flagged_crises, others, other_crises, hits, southern_africa))
    f = sum(t.flagged for t in tallies); fc = sum(t.flagged_crises for t in tallies)
    o = sum(t.others for t in tallies); oc = sum(t.other_crises for t in tallies)
    return tallies, (f, fc, o, oc, fisher_one_sided(fc, f - fc, oc, o - oc))


Score = namedtuple('Score', 'hits false_alarms missed')


def score_rule(flags, only=None):
    """Hits, false alarms and misses per round for a flagging rule: flags(m49, shortfall, rnd) -> bool.
    only: restrict to these countries. Returns {period: Score}."""
    scores = {}
    for rnd in ROUNDS:
        hits = false_alarms = missed = 0
        for m49 in COUNTRIES:
            if m49 not in TESTED or (only is not None and m49 not in only):
                continue
            shortfall = shortfall_known_before(m49, rnd)
            if shortfall is None:
                continue
            flag, crisis = flags(m49, shortfall, rnd), crises.had_crisis(m49, rnd.period)
            hits += flag and crisis; false_alarms += flag and not crisis; missed += (not flag) and crisis
        scores[rnd.period] = Score(hits, false_alarms, missed)
    return scores
