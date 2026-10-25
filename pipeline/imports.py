"""FAO food balance sheets and the cereal import dependency ratio.

    import dependency (%) = (imports − exports) / (production + imports − exports) × 100

for FAOSTAT item 2905, "Cereals - Excluding Beer". The historic sheets cover up to 2009 and the current ones from 2010.
"""
import pandas as pd

CEREALS = 2905
ELEMENTS = {5511: 'production', 5611: 'imports', 5911: 'exports'}   # FAOSTAT element codes
LAST_SHEET_YEAR = 2022

# pre-split areas folded into their successors, so series reach back to 1980
SUCCESSOR = {'230': '231',   # Ethiopia PDR -> Ethiopia
             '736': '729'}   # Sudan (former) -> Sudan


def load_balance_sheet(path):
    """Cereal production, imports and exports from a balance-sheet file (zipped or not): a table of m49, area, year,
    production, imports, exports (tonnes), without FAO's regional aggregates."""
    rows = pd.read_csv(path, encoding='utf-8', encoding_errors='replace',
                       usecols=['Area Code', 'Area Code (M49)', 'Area', 'Item Code', 'Element Code', 'Year', 'Value'])
    rows = rows[(rows['Item Code'] == CEREALS) & rows['Element Code'].isin(ELEMENTS) & (rows['Area Code'] < 5000)]
    rows = rows.assign(m49=rows['Area Code (M49)'].astype(str).str.strip("'").str.zfill(3),
                       value=pd.to_numeric(rows['Value'], errors='coerce')).dropna(subset=['value'])
    table = rows.pivot_table(index=['m49', 'Year'], columns='Element Code', values='value', aggfunc='last')
    table = table.rename(columns=ELEMENTS).rename_axis(columns=None).reset_index().rename(columns={'Year': 'year'})
    for element in ELEMENTS.values():   # an element with no rows at all still gets its column
        if element not in table:
            table[element] = float('nan')
    names = rows.drop_duplicates('m49', keep='last').set_index('m49')['Area']
    first_seen = {m49: i for i, m49 in enumerate(rows['m49'].drop_duplicates())}   # keep the file's country order
    table = table.assign(area=table['m49'].map(names), order=table['m49'].map(first_seen))
    return table.sort_values(['order', 'year'], kind='stable').drop(columns='order').reset_index(drop=True)


def merge_sheets(historic, current):
    """Historic sheets up to 2009, current sheets from 2010, pre-split areas folded into their successors (only into
    years the successor has no figures of its own in the historic sheets). Rows keep the files' order."""
    successor_years = set(zip(historic['m49'], historic['year']))
    target = historic['m49'].map(SUCCESSOR).fillna(historic['m49'])
    folded_in = pd.Series([m49 == t or (t, year) not in successor_years for m49, t, year in zip(historic['m49'], target, historic['year'])],
                          index=historic.index)
    historic = historic.assign(m49=target)[(historic['year'] <= 2009) & folded_in]
    return pd.concat([historic, current[current['year'] >= 2010]], ignore_index=True)


def import_dependency(sheet):
    """The import dependency ratio (%) per row; NaN without production or import figures, or a supply of zero or less."""
    exports = sheet['exports'].fillna(0.0) if 'exports' in sheet else 0.0
    supply = sheet['production'] + sheet['imports'] - exports
    return ((sheet['imports'] - exports) / supply * 100).where(supply > 0)


def import_dependency_by_country(historic_path, current_path):
    """A table of m49, area, year, import_dependency (%) from the two balance-sheet files, every country and year with a
    ratio; the area name is the current sheets' where both name a country."""
    historic, current = load_balance_sheet(historic_path), load_balance_sheet(current_path)
    merged = merge_sheets(historic, current)
    names = pd.concat([historic, current]).drop_duplicates('m49', keep='last').set_index('m49')['area']
    merged = merged.assign(import_dependency=import_dependency(merged), area=merged['m49'].map(names))
    return merged.dropna(subset=['import_dependency'])[['m49', 'area', 'year', 'import_dependency']].reset_index(drop=True)
