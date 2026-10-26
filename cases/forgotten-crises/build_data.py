"""Need and missing money: writes data.js, each country's humanitarian need, how much of its UN appeals was funded, and
for how many years in a row it has had one.

    .venv/bin/python cases/forgotten-crises/build_data.py <GHO monthly table XLSX> <INFORM Severity XLSX> <FTS requirements and funding CSV>

Need: the INFORM Severity Index (1–5 before February 2026) and its category, from INFORM's country sheet (one row per
country; where a country has two, the more severe), or, for a country missing there, its most severe crisis in the sheet of
all crises (regional crises, listed for several countries at once, are left out). The January 2025 release, so need is
measured as the 2025 appeals began.

Funding: OCHA's Global Humanitarian Overview 2025, its table of appeals for December 2025: each country's own plans (needs
and response plans, flash appeals and other country plans; regional plans span several countries and are left out).
Requirements and funding are summed per country. People in need is the largest figure among the country's plans, since
plans for one country overlap (Myanmar's earthquake plan, Mozambique's three) and a sum would count people twice. A plan
with no people in need (Lebanon's flash appeal) leaves the country without a figure.

Years of appeals: OCHA's Financial Tracking Service, every country plan since 2000 (as above, regional plans left out):
the years in a row, up to 2025, in which the country had one. OCHA calls a crisis protracted after five.
Years below average: from the same file, the years in a row, up to 2025, in which the country's appeals were funded below
that year's share across all country appeals (funding over requirements, plans with requirements, since 2016). FTS's
figures for 2025 are later than the GHO table's (funding is reported late), but each year is compared with its own share.

Fields per country (UN M49 code), null where a source has no value:
  iso3; severity (the index), severityCategory (INFORM's label), crisis (the crisis it comes from);
  peopleInNeed; requirements and funding (US$); funded (% of the requirements); perPerson (funding per person in need, US$);
  plans (the appeals counted); appealYears (years in a row with a country appeal, up to 2025); gapYears (years in a row,
  up to 2025, funded below that year's share across all country appeals).
  Across all countries: fundedOverall (% of all requirements funded), perPersonAverage.
"""
import json
import sys
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1]))   # the repository root, for the shared pipeline
from pipeline.codes import ISO3_TO_M49   # noqa: E402

APPEAL_YEAR = 2025

# ---- the sources' columns, checked against the GHO table for December 2025 and INFORM's January 2025 file --------------
GHO = {'plan': 'Plans', 'type': 'Plan type', 'pin': 'People in need', 'requirements': 'Requirements', 'funding': 'Funding'}
GHO_LEFT_OUT = {'REG'}   # regional plans
# a plan's country: its name before any bracket ('Mozambique (Drought)'), in OCHA's spelling
GHO_COUNTRY = {
    'Afghanistan': 'AFG', 'Bangladesh': 'BGD', 'Burkina Faso': 'BFA', 'Cameroon': 'CMR', 'Central African Republic': 'CAF',
    'Chad': 'TCD', 'Colombia': 'COL', 'Democratic Republic of the Congo': 'COD', 'El Salvador': 'SLV', 'Guatemala': 'GTM',
    'Haiti': 'HTI', 'Honduras': 'HND', 'Lebanon': 'LBN', 'Malawi': 'MWI', 'Mali': 'MLI', 'Mozambique': 'MOZ', 'Myanmar': 'MMR',
    'Niger': 'NER', 'Nigeria': 'NGA', 'Occupied Palestinian Territory': 'PSE', 'Pakistan': 'PAK', 'Philippines': 'PHL',
    'Somalia': 'SOM', 'South Sudan': 'SSD', 'Sudan': 'SDN', 'Syrian Arab Republic': 'SYR', 'Ukraine': 'UKR', 'Venezuela': 'VEN',
    'Viet Nam': 'VNM', 'Yemen': 'YEM', 'Zambia': 'ZMB', 'Zimbabwe': 'ZWE',
}
FTS = {'iso3': 'countryCode', 'type': 'typeName', 'year': 'year'}   # checked against the FTS file of 23 October 2026
FTS_LEFT_OUT = {'Regional response plan'}
INFORM_SHEETS = ('INFORM Severity - country', 'INFORM Severity - all crises')   # the first, then the second for what it lacks
# two columns are called 'INFORM Severity category': the number (1–5), then the label (Very Low–Very High); pandas calls
# the second 'INFORM Severity category.1'
INFORM = {'iso3': 'ISO3', 'crisis': 'CRISIS', 'severity': 'INFORM Severity Index', 'category': 'INFORM Severity category.1'}


def require(table, columns, source):
    missing = [c for c in columns if c not in table.columns]
    if missing:
        raise SystemExit(f'{source}: no column {missing}; the file has {list(table.columns)}')


def read_appeals(path):
    """Per ISO3: people in need (the largest plan's), requirements, funding and the plans counted."""
    gho = pd.read_excel(path)
    require(gho, GHO.values(), 'GHO')
    gho = gho[gho[GHO['plan']].notna() & ~gho[GHO['type']].isin(GHO_LEFT_OUT)]
    country = gho[GHO['plan']].str.replace(r'\s*\(.*\)$', '', regex=True).str.strip()
    unknown = sorted(set(country) - set(GHO_COUNTRY))
    if unknown:
        raise SystemExit(f'GHO: no ISO3 code for the plan countries {unknown}; add them to GHO_COUNTRY')
    gho = gho.assign(iso3=country.map(GHO_COUNTRY))
    grouped = gho.groupby('iso3')
    return pd.DataFrame({
        'peopleInNeed': grouped[GHO['pin']].max(),
        'requirements': grouped[GHO['requirements']].sum(),
        'funding': grouped[GHO['funding']].sum(),
        'plans': grouped[GHO['plan']].agg(list),
    })


def read_appeal_years(path):
    """Per ISO3: the years in a row, up to APPEAL_YEAR, with a country appeal in OCHA's Financial Tracking Service."""
    fts = pd.read_csv(path)
    fts = fts[~fts[fts.columns[0]].astype(str).str.startswith('#')]   # an HXL tag row, where the file has one
    require(fts, FTS.values(), 'FTS')
    plans = fts[fts[FTS['type']].notna() & ~fts[FTS['type']].isin(FTS_LEFT_OUT)]
    years = plans.groupby(FTS['iso3'])[FTS['year']].agg(lambda ys: set(pd.to_numeric(ys, errors='coerce').dropna().astype(int)))
    def run(ys):
        n = 0
        while APPEAL_YEAR - n in ys:
            n += 1
        return n
    return years.map(run)


def read_gap_years(path):
    """Per ISO3: the years in a row, up to APPEAL_YEAR, its country appeals were funded below that year's overall share."""
    fts = pd.read_csv(path)
    fts = fts[~fts[fts.columns[0]].astype(str).str.startswith('#')]
    for column in ('requirements', 'funding'):
        fts[column] = pd.to_numeric(fts[column], errors='coerce').fillna(0)
    plans = fts[fts[FTS['type']].notna() & ~fts[FTS['type']].isin(FTS_LEFT_OUT) & (fts['requirements'] > 0)
                & pd.to_numeric(fts[FTS['year']], errors='coerce').between(2016, APPEAL_YEAR)]
    plans = plans.assign(year=pd.to_numeric(plans[FTS['year']]).astype(int))
    by = plans.groupby([FTS['iso3'], 'year'])[['requirements', 'funding']].sum()
    overall = plans.groupby('year')['funding'].sum() / plans.groupby('year')['requirements'].sum()
    below = (by['funding'] / by['requirements']) < overall.reindex(by.index.get_level_values('year')).to_numpy()
    def run(country):
        flags = below.loc[country]
        n = 0
        while APPEAL_YEAR - n in flags.index and flags[APPEAL_YEAR - n]:
            n += 1
        return n
    return pd.Series({country: run(country) for country in below.index.get_level_values(0).unique()})


def read_severity(path):
    """Per ISO3: the country's crisis, its index and category, from the country sheet, then the crisis sheet."""
    country, crises = (read_severity_sheet(path, sheet) for sheet in INFORM_SHEETS)
    return pd.concat([country, crises[~crises.index.isin(country.index)]])


def read_severity_sheet(path, sheet):
    """Per ISO3 in one sheet: the most severe row, its index and category. The header row is found by its ISO3 column."""
    raw = pd.read_excel(path, sheet_name=sheet, header=None)
    header = next((i for i, row in raw.iterrows() if INFORM['iso3'] in row.astype(str).str.strip().tolist()), None)
    if header is None:
        raise SystemExit(f'INFORM: no header row with a {INFORM["iso3"]} column in the sheet {sheet!r}')
    table = pd.read_excel(path, sheet_name=sheet, header=header)
    table.columns = [str(c).strip() for c in table.columns]
    require(table, INFORM.values(), 'INFORM')
    table = table.assign(severity=pd.to_numeric(table[INFORM['severity']], errors='coerce')).dropna(subset=['severity'])
    table = table[~table[INFORM['iso3']].astype(str).str.contains(',')]   # regional crises, listed with several ISO3 codes
    worst = table.sort_values('severity', ascending=False).drop_duplicates(INFORM['iso3'])
    return worst.set_index(INFORM['iso3'])[['severity', INFORM['category'], INFORM['crisis']]].rename(
        columns={INFORM['category']: 'severityCategory', INFORM['crisis']: 'crisis'})


def main(gho_path, inform_path, fts_path):
    appeals, severity, appeal_years = read_appeals(gho_path), read_severity(inform_path), read_appeal_years(fts_path)
    gap_years = read_gap_years(fts_path)
    countries, unmatched = {}, []
    for iso3 in sorted(set(appeals.index) | set(severity.index)):
        m49 = ISO3_TO_M49.get(iso3)
        if not m49:
            unmatched.append(iso3)
            continue
        a = appeals.loc[iso3] if iso3 in appeals.index else None
        s = severity.loc[iso3] if iso3 in severity.index else None
        pin = float(a['peopleInNeed']) if a is not None and a['peopleInNeed'] > 0 else None
        requirements = float(a['requirements']) if a is not None else None
        funding = float(a['funding']) if a is not None else None
        countries[m49] = {
            'iso3': iso3,
            'severity': round(float(s['severity']), 2) if s is not None else None,
            'severityCategory': s['severityCategory'] if s is not None else None,
            'crisis': s['crisis'] if s is not None else None,
            'peopleInNeed': pin,
            'requirements': requirements,
            'funding': funding,
            'funded': round(100 * funding / requirements, 1) if requirements else None,
            'perPerson': round(funding / pin, 2) if funding is not None and pin else None,
            'plans': a['plans'] if a is not None else [],
            'appealYears': int(appeal_years.get(iso3, 0)),
            'gapYears': int(gap_years.get(iso3, 0)),
        }
    if unmatched:
        print('no UN M49 code for', ', '.join(unmatched), '(left out; add them to pipeline/codes.py)')
    # the average across every country appeal with people in need: total funding over total people in need
    counted = [c for c in countries.values() if c['perPerson'] is not None]
    average = sum(c['funding'] for c in counted) / sum(c['peopleInNeed'] for c in counted)
    # the share of the ask funded across every country appeal: total funding over total requirements
    appealed = [c for c in countries.values() if c['requirements']]
    funded = 100 * sum(c['funding'] for c in appealed) / sum(c['requirements'] for c in appealed)
    data = {'year': APPEAL_YEAR, 'fundedOverall': round(funded, 1), 'perPersonAverage': round(average, 2),
            'sources': {'gho': Path(gho_path).name, 'inform': Path(inform_path).name, 'fts': Path(fts_path).name},
            'countries': countries}
    (HERE / 'data.js').write_text(
        '// Need and missing money: the data for the map, written by build_data.py. Do not edit by hand; its docstring describes\n'
        '// every field.\nexport const DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    both = sum(1 for c in counted if c['severity'] is not None)
    print(f'{len(countries)} countries, {both} with a severity and funding per person in need -> data.js; '
          f'{funded:.1f}% of the ask funded overall, ${average:.2f} per person in need')


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    main(*sys.argv[1:])
