"""The walk-forward test: the map drawn as it would have looked before each crisis period, from what was known then.

For each round, a country's shortfall uses only El Niños up to `last_el_nino` and harvests up to `last_harvest`. A country is
flagged at a shortfall of FLAG_AT % or more; a flag followed by a national crisis in the round's period is a hit.
"""
from collections import namedtuple
from math import comb

from . import crises, enso, harvests
from .countries import COUNTRIES, PRODUCTION, SOUTHERN_AFRICA, TESTED   # re-exported for the scripts

Round = namedtuple('Round', 'period last_el_nino last_harvest')
ROUNDS = [Round('2015–16', 2009, 2014), Round('2023–24', 2018, 2022)]
FLAG_AT = 5                            # % shortfall
MIN_HARVESTS_PER_ROUND = (6, 7)        # El Niño and neutral harvests needed for a shortfall as known before a round
LEAVE_ONE_OUT_YEARS = sorted(y for y in enso.EL_NINO_YEARS if y <= ROUNDS[-1].last_el_nino)   # the El Niños a round can see

_anomalies = {}


def anomalies(m49, span=harvests.TREND_SPAN):
    """The country's harvests against its trend, cached per trend span."""
    if (m49, span) not in _anomalies:
        _anomalies[(m49, span)] = harvests.harvest_anomalies(PRODUCTION[m49], frac=span)
    return _anomalies[(m49, span)]


def shortfall_known_before(m49, rnd, el_nino_years=None, neutral_years=None, span=harvests.TREND_SPAN, leave_out=()):
    """The country's shortfall (%) as it could have been computed before the round, or None with too few harvests.
    el_nino_years, neutral_years: the classification to use (default: the map's); leave_out: El Niños to drop."""
    el_nino_years = enso.EL_NINO_YEARS if el_nino_years is None else el_nino_years
    known_el_ninos = {y for y in el_nino_years if y <= rnd.last_el_nino and y not in leave_out}
    known_harvests = {y: v for y, v in anomalies(m49, span).items() if y <= rnd.last_harvest}
    result = harvests.shortfall(known_harvests, enso.harvest_lag(m49), MIN_HARVESTS_PER_ROUND, known_el_ninos, neutral_years)
    return None if result is None else result[0]


def fisher_one_sided(a, b, c, d):
    """Fisher's exact test, one-sided: flagged with a crisis a, flagged without b, others with c, others without d.
    The chance of a or more crises among the flagged if flags and crises were unrelated."""
    flagged, with_crisis, total = a + b, a + c, a + b + c + d
    return sum(comb(with_crisis, x) * comb(total - with_crisis, flagged - x) / comb(total, flagged)
               for x in range(a, min(with_crisis, flagged) + 1))


# ---- the outcome of every tested country in every round -------------------------------------------------------------
Outcome = namedtuple('Outcome', 'round m49 country shortfall crisis')
_default_shortfalls = {}


def outcomes(only=None):
    """Every tested country in every round that has a shortfall as known then (the map's settings), with its crisis.
    only: restrict to these countries. The shortfalls are computed once and reused."""
    for rnd in ROUNDS:
        for m49, country in COUNTRIES.items():
            if m49 not in TESTED or (only is not None and m49 not in only):
                continue
            if (m49, rnd) not in _default_shortfalls:
                _default_shortfalls[(m49, rnd)] = shortfall_known_before(m49, rnd)
            shortfall = _default_shortfalls[(m49, rnd)]
            if shortfall is not None:
                yield Outcome(rnd, m49, country, shortfall, crises.had_crisis(m49, rnd.period))


Score = namedtuple('Score', 'hits false_alarms missed')


def flags_shortfall(m49, shortfall, rnd):
    """The harvest measure alone: flag a shortfall of FLAG_AT % or more."""
    return shortfall >= FLAG_AT


def flags_southern_africa(m49, shortfall, rnd):
    """The baseline: flag every southern African country."""
    return m49 in SOUTHERN_AFRICA


def score_rule(flags, only=None):
    """Hits, false alarms and misses per round for a flagging rule: flags(m49, shortfall, rnd) -> bool.
    only: restrict to these countries. Returns {period: Score}."""
    tally = {rnd.period: [0, 0, 0] for rnd in ROUNDS}
    for o in outcomes(only):
        flag, counts = flags(o.m49, o.shortfall, o.round), tally[o.round.period]
        counts[0] += flag and o.crisis; counts[1] += flag and not o.crisis; counts[2] += (not flag) and o.crisis
    return {period: Score(*counts) for period, counts in tally.items()}


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
    southern_africa in each tally is [flagged, of which with a crisis], p its Fisher's p."""
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
        p = fisher_one_sided(flagged_crises, flagged - flagged_crises, other_crises, others - other_crises)
        tallies.append(Tally(rnd.period, flagged, flagged_crises, others, other_crises, hits, southern_africa, p))
    f = sum(t.flagged for t in tallies); fc = sum(t.flagged_crises for t in tallies)
    o = sum(t.others for t in tallies); oc = sum(t.other_crises for t in tallies)
    return tallies, (f, fc, o, oc, fisher_one_sided(fc, f - fc, oc, o - oc))
