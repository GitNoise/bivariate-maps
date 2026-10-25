"""Does the walk-forward result depend on our choices? Prints the test as on the page, then with other cut-offs, NOAA's
relative index (RONI), a smoother trend, dashed borders counted as crises, each El Niño left out in turn, and split by
import share.

    python3 analysis/robustness.py
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline import crises, enso
from pipeline.walkforward import fisher_one_sided, run

RONI_EL_NINO, RONI_NEUTRAL = enso.roni_years('El Niño'), enso.roni_years('neutral')


def show(label, result):
    tallies, (flagged, flagged_crises, others, other_crises, p) = result
    rounds = ' | '.join(f"{t.period}: {t.flagged_crises}/{t.flagged} vs {t.other_crises}/{t.others} "
                        f"p={fisher_one_sided(t.flagged_crises, t.flagged - t.flagged_crises, t.other_crises, t.others - t.other_crises):.4f}"
                        for t in tallies)
    print(f"{label:34s} {rounds} || combined {flagged_crises}/{flagged} vs {other_crises}/{others} p={p:.4f}")


if __name__ == '__main__':
    base = run()
    show('BASE (cut 5%, ONI, span 0.3)', base)
    for t in base[0]:
        print('   ', t.period, 'hits:', ', '.join(sorted(t.hits)), '| southern Africa flagged', t.southern_africa[0], 'crises', t.southern_africa[1])
    for cut in (3, 7.5, 10):
        show(f'cut-off {cut}%', run(flag_at=cut))
    show('NOAA RONI years', run(el_nino_years=RONI_EL_NINO, neutral_years=RONI_NEUTRAL))
    show('smoother trend (span 0.75)', run(span=0.75))
    show('RONI + span 0.75', run(el_nino_years=RONI_EL_NINO, neutral_years=RONI_NEUTRAL, span=0.75))
    show('dashed borders count too', run(crisis_tables=(crises.NATIONAL, crises.SMALLER)))
    for left_out in [1982, 1986, 1987, 1991, 1994, 1997, 2002, 2004, 2006, 2009, 2014, 2015, 2018]:
        show(f'without the {left_out} El Niño', run(leave_out={left_out}))
    show('flagged, imports >= 25%', run(import_filter=lambda v: v is not None and v >= 25))
    show('flagged, imports < 25%', run(import_filter=lambda v: v is None or v < 25))
