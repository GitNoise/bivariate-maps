"""The recorded food crises after the last two El Niños, from the hand-edited tables in src/data.js.

National crisis: at least 10% of the whole population in IPC Phase 3 (Crisis) or worse, with weather extremes as the main
driver (solid border on the map). Smaller crisis: 5–10%, or a joint government–UN El Niño appeal (dashed border).
"""
from .page_files import read_crisis_table

NATIONAL_TABLE = read_crisis_table('NATIONAL_CRISES')   # {m49: (periods, source note)}
SMALLER_TABLE = read_crisis_table('SMALLER_CRISES')

NATIONAL = {m49: set(periods) for m49, (periods, _) in NATIONAL_TABLE.items()}   # {m49: {'2015–16', ...}}
SMALLER = {m49: set(periods) for m49, (periods, _) in SMALLER_TABLE.items()}


def had_crisis(m49, period, tables=(NATIONAL,)):
    """Did the country have a crisis in the period ('2015–16' or '2023–24'), in any of the tables?"""
    return any(period in table.get(m49, set()) for table in tables)
