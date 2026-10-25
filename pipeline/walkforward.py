"""The walk-forward test: the map drawn as it would have looked before each crisis period, from what was known then.

For each round, a country's shortfall uses only El Niños up to `last_el_nino` and harvests up to `last_harvest`. A country is
flagged at a shortfall of FLAG_AT % or more; a flag followed by a national crisis in the round's period is a hit.
"""
from collections import namedtuple
from functools import cache

import pandas as pd
from scipy.stats import fisher_exact

from . import crises, enso, harvests
from .countries import COUNTRIES, PAGE_ORDER, PRODUCTION, SOUTHERN_AFRICA, TESTED   # re-exported for the scripts

Round = namedtuple('Round', 'period last_el_nino last_harvest')
ROUNDS = [Round('2015–16', 2009, 2014), Round('2023–24', 2018, 2022)]
FLAG_AT = 5                            # % shortfall
MIN_HARVESTS_PER_ROUND = (6, 7)        # El Niño and neutral harvests needed for a shortfall as known before a round
LEAVE_ONE_OUT_YEARS = sorted(y for y in enso.EL_NINO_YEARS if y <= ROUNDS[-1].last_el_nino)   # the El Niños a round can see


@cache
def anomalies(span=harvests.TREND_SPAN):
    """The tested countries' harvests against their trend: a table of m49, year, tonnes, trend, vs_trend."""
    return harvests.against_trend(PRODUCTION[PRODUCTION['m49'].isin(TESTED)], span)


def shortfalls_known_before(rnd, el_nino_years=None, neutral_years=None, span=harvests.TREND_SPAN, leave_out=()):
    """Each tested country's shortfall (%) as it could have been computed before the round: a Series indexed by m49, without
    the countries with too few harvests. el_nino_years, neutral_years: the classification (default: the map's);
    leave_out: El Niños to drop."""
    el_nino_years = enso.EL_NINO_YEARS if el_nino_years is None else el_nino_years
    known_el_ninos = {y for y in el_nino_years if y <= rnd.last_el_nino and y not in leave_out}
    known = anomalies(span)
    known = known[known['year'] <= rnd.last_harvest]
    return harvests.shortfalls(known, MIN_HARVESTS_PER_ROUND, known_el_ninos, neutral_years)['shortfall']


def fisher_one_sided(flagged_crises, flagged_calm, other_crises, other_calm):
    """Fisher's exact test, one-sided (scipy): the chance of this many crises or more among the flagged countries if
    flags and crises were unrelated."""
    return fisher_exact([[flagged_crises, flagged_calm], [other_crises, other_calm]], alternative='greater').pvalue


# ---- the outcome of every tested country in every round, with the map's settings -----------------------------------
@cache
def outcomes():
    """A table of period, last_harvest, m49, name, shortfall, crisis: every tested country with a shortfall as known
    before each round, rounds in order and countries in page order."""
    rows = []
    for rnd in ROUNDS:
        known = shortfalls_known_before(rnd)
        for m49 in PAGE_ORDER:
            if m49 in known.index:
                rows.append((rnd.period, rnd.last_harvest, m49, COUNTRIES[m49]['name'], known[m49], crises.had_crisis(m49, rnd.period)))
    return pd.DataFrame(rows, columns=['period', 'last_harvest', 'm49', 'name', 'shortfall', 'crisis'])


Score = namedtuple('Score', 'hits false_alarms missed')


# flagging rules take the outcomes table and return a boolean Series
def flags_shortfall(o):
    """The harvest measure alone: flag a shortfall of FLAG_AT % or more."""
    return o['shortfall'] >= FLAG_AT


def flags_southern_africa(o):
    """The baseline: flag every southern African country."""
    return o['m49'].isin(SOUTHERN_AFRICA)


def score_rule(flags, only=None):
    """Hits, false alarms and misses per round for a flagging rule. only: restrict to these countries. {period: Score}."""
    o = outcomes()
    if only is not None:
        o = o[o['m49'].isin(only)]
    flag, crisis = flags(o), o['crisis']
    counts = pd.DataFrame({'period': o['period'], 'hits': flag & crisis, 'false_alarms': flag & ~crisis, 'missed': ~flag & crisis})
    totals = counts.groupby('period', sort=False).sum()
    return {rnd.period: Score(*(int(totals.loc[rnd.period, k]) if rnd.period in totals.index else 0 for k in Score._fields))
            for rnd in ROUNDS}


def combined(scores):
    """Both rounds together: (Score, hit rate, precision)."""
    total = Score(*(sum(getattr(s, field) for s in scores.values()) for field in Score._fields))
    return total, total.hits / (total.hits + total.missed), total.hits / max(1, total.hits + total.false_alarms)


# ---- the robustness checks: other cut-offs, years, trend spans, crisis definitions ------------------------------------
Tally = namedtuple('Tally', 'period flagged flagged_crises others other_crises hits southern_africa p')


def run(flag_at=FLAG_AT, el_nino_years=None, neutral_years=None, span=harvests.TREND_SPAN, leave_out=(),
        crisis_tables=(crises.NATIONAL,), import_filter=None):
    """Flag countries and count crises among flagged and other countries, per round.
    import_filter: only count countries whose import share passes it.
    Returns ([Tally per round], (flagged, flagged crises, others, other crises, Fisher's p) for both rounds together);
    hits in each tally lists the flagged countries with a crisis, southern_africa is [flagged, of which with a crisis]."""
    tallies = []
    for rnd in ROUNDS:
        known = shortfalls_known_before(rnd, el_nino_years, neutral_years, span, leave_out)
        countries = [m49 for m49 in PAGE_ORDER if m49 in known.index
                     and (import_filter is None or import_filter(COUNTRIES[m49].get('importShare')))]
        t = pd.DataFrame({'m49': countries, 'shortfall': known[countries].to_numpy(),
                          'crisis': [crises.had_crisis(m49, rnd.period, crisis_tables) for m49 in countries]})
        flagged = t[t['shortfall'] >= flag_at]
        others = t[t['shortfall'] < flag_at]
        f, fc, o, oc = len(flagged), int(flagged['crisis'].sum()), len(others), int(others['crisis'].sum())
        in_southern_africa = flagged[flagged['m49'].isin(SOUTHERN_AFRICA)]
        tallies.append(Tally(rnd.period, f, fc, o, oc, [COUNTRIES[m]['name'] for m in flagged.loc[flagged['crisis'], 'm49']],
                             [len(in_southern_africa), int(in_southern_africa['crisis'].sum())], fisher_one_sided(fc, f - fc, oc, o - oc)))
    f = sum(t.flagged for t in tallies); fc = sum(t.flagged_crises for t in tallies)
    o = sum(t.others for t in tallies); oc = sum(t.other_crises for t in tallies)
    return tallies, (f, fc, o, oc, fisher_one_sided(fc, f - fc, oc, o - oc))
