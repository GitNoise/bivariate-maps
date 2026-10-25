"""FAO food balance sheets and the cereal import dependency ratio.

    import dependency (%) = (imports − exports) / (production + imports − exports) × 100

for FAOSTAT item 2905, "Cereals - Excluding Beer". The historic sheets cover up to 2009 and the current ones from 2010.
"""
import csv, io, zipfile

CEREALS = '2905'
PRODUCTION, IMPORTS, EXPORTS = '5511', '5611', '5911'   # FAOSTAT element codes
LAST_SHEET_YEAR = 2022

# pre-split areas folded into their successors, so series reach back to 1980
SUCCESSOR = {'230': '231',   # Ethiopia PDR -> Ethiopia
             '736': '729'}   # Sudan (former) -> Sudan


def _rows(path):
    """The rows of a balance-sheet file, zipped or not."""
    if path.endswith('.zip'):
        z = zipfile.ZipFile(path)
        name = next(n for n in z.namelist() if 'All_Data' in n and n.endswith('.csv'))
        return csv.DictReader(io.TextIOWrapper(z.open(name), encoding='utf-8', errors='replace'))
    return csv.DictReader(open(path, encoding='utf-8', errors='replace'))


def load_balance_sheet(path):
    """Cereal production, imports and exports: ({m49: {year: {element: tonnes}}}, {m49: country name})."""
    out, names = {}, {}
    for row in _rows(path):
        if row['Item Code'] != CEREALS or row['Element Code'] not in (PRODUCTION, IMPORTS, EXPORTS):
            continue
        try:
            value = float(row['Value'])
        except ValueError:
            continue
        if int(row['Area Code']) >= 5000:   # FAO regional aggregates
            continue
        m49 = row['Area Code (M49)'].strip("'").zfill(3)
        out.setdefault(m49, {}).setdefault(int(row['Year']), {})[row['Element Code']] = value
        names[m49] = row['Area']
    return out, names


def merge_sheets(historic, current):
    """Historic sheets up to 2009, current sheets from 2010, pre-split areas folded into their successors."""
    merged = {}
    for m49, years in historic.items():
        target = SUCCESSOR.get(m49, m49)
        for year, elements in years.items():
            if year <= 2009 and (target == m49 or year not in historic.get(target, {})):
                merged.setdefault(target, {})[year] = elements
    for m49, years in current.items():
        for year, elements in years.items():
            if year >= 2010:
                merged.setdefault(m49, {})[year] = elements
    return merged


def import_dependency(elements):
    """The import dependency ratio (%) for one country and year, or None without production and import figures."""
    production, imports, exports = elements.get(PRODUCTION), elements.get(IMPORTS), elements.get(EXPORTS, 0.0)
    if production is None or imports is None:
        return None
    supply = production + imports - exports
    return None if supply <= 0 else (imports - exports) / supply * 100


def import_dependency_by_country(historic_path, current_path):
    """({m49: {year: import dependency %}}, {m49: country name}) from the two balance-sheet files."""
    historic, historic_names = load_balance_sheet(historic_path)
    current, current_names = load_balance_sheet(current_path)
    merged = merge_sheets(historic, current)
    ratios = {m49: {year: r for year, elements in years.items() if (r := import_dependency(elements)) is not None}
              for m49, years in merged.items()}
    return ratios, {**historic_names, **current_names}
