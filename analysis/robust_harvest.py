"""Would a harvest measure that one extreme year cannot decide have warned better? Prints the walk-forward scores of three
ways to flag a country from its El Niño harvests, with and without the 1991–92 El Niño, beside the southern Africa rule.
The definitions were fixed before the results were seen:

    mean       El Niño harvests average 5% or more below neutral-year harvests (the map)
    median     the same, with the typical (median) El Niño and neutral harvest instead of the average
    how often  at least a third of El Niño harvests fell 10% or more below normal, and more often than neutral ones did

    python analysis/robust_harvest.py
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline import crises, enso, harvests, walkforward
from pipeline.walkforward import ROUNDS, FLAG_AT, MIN_HARVESTS_PER_ROUND, SOUTHERN_AFRICA, COUNTRIES

BAD_YEAR = -10        # % below normal: a bad harvest
OFTEN = 1 / 3         # share of El Niño harvests that were bad


def flags_known_before(rnd, leave_out=()):
    """{rule: {m49: flagged}} for the countries with enough harvests, from what was known before the round."""
    el_ninos = {y for y in enso.EL_NINO_YEARS if y <= rnd.last_el_nino and y not in leave_out}
    known = walkforward.anomalies()
    phased = harvests.by_phase(known[known['year'] <= rnd.last_harvest], el_ninos)
    out = {'mean': {}, 'median': {}, 'how often': {}}
    for m49, country in phased.groupby('m49'):
        en = country.loc[country['phase'] == 'El Niño', 'vs_trend']
        neutral = country.loc[country['phase'] == 'neutral', 'vs_trend']
        if len(en) < MIN_HARVESTS_PER_ROUND[0] or len(neutral) < MIN_HARVESTS_PER_ROUND[1]:
            continue
        out['mean'][m49] = harvests.shortfall_pct(en.mean(), neutral.mean()) >= FLAG_AT
        out['median'][m49] = harvests.shortfall_pct(en.median(), neutral.median()) >= FLAG_AT
        bad_en, bad_neutral = (en <= BAD_YEAR).mean(), (neutral <= BAD_YEAR).mean()
        out['how often'][m49] = bad_en >= OFTEN and bad_en > bad_neutral
    out['southern Africa'] = {m49: m49 in SOUTHERN_AFRICA for m49 in out['mean']}
    return out


def score(leave_out=()):
    """{rule: (caught, missed, false alarms, p, names caught)} over both rounds."""
    totals = {}
    for rnd in ROUNDS:
        for rule, flags in flags_known_before(rnd, leave_out).items():
            t = totals.setdefault(rule, [0, 0, 0, 0, []])   # caught, missed, false alarms, calm and unflagged, names
            for m49, flagged in flags.items():
                crisis = crises.had_crisis(m49, rnd.period)
                if flagged and crisis: t[0] += 1; t[4].append(f"{COUNTRIES[m49]['name'].split(' (')[0]} {rnd.period[2:4]}")
                elif crisis: t[1] += 1
                elif flagged: t[2] += 1
                else: t[3] += 1
    return {rule: (c, m, f, walkforward.fisher_one_sided(c, f, m, n), names) for rule, (c, m, f, n, names) in totals.items()}


if __name__ == '__main__':
    for title, leave_out in (('ALL EL NIÑOS', ()), ('WITHOUT 1991–92', (1991,))):
        print(title)
        for rule, (c, m, f, p, names) in score(leave_out).items():
            print(f"  {rule:16s} caught {c:2d}  missed {m:2d}  false alarms {f:3d}  p={p:.3f}   {', '.join(names)}")
        print()
