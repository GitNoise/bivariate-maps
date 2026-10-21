"""Build every number on the dashboard from FAO's Food Balance Sheets.

Two FAO series are used:
  1. the cereal import dependency ratio, from the Food Balance Sheets
  2. cereal production (tonnes), from FAOSTAT via Our World in Data (optional third file):
     El Niño harvest shortfall = how much smaller (in %) the mean El Niño harvest is than the mean neutral-year harvest, both against trend

The cereal import dependency ratio is:
    (imports - exports) / (production + imports - exports) * 100
applied to FAOSTAT item 2905 "Cereals - Excluding Beer".

Usage (files can be the .zip or the unzipped .csv, "Normalized" versions):
    python build_data.py FoodBalanceSheetsHistoric_E_All_Data_(Normalized).zip \
                         FoodBalanceSheets_E_All_Data_(Normalized).zip \
                         cereal-production.csv

cereal-production.csv: https://ourworldindata.org/grapher/cereal-production.csv?v=1&csvType=full&useColumnShortNames=false

Writes the DATA line of js/data.js and data/cereal_import_dependency_ratio_1961_2022.csv.
Requires Python 3.9+, standard library only.
"""
import csv, io, json, os, re, statistics as st, sys, zipfile

ITEM, PROD, IMP, EXP = '2905', '5511', '5611', '5911'

# NOAA Oceanic Niño Index events since 1980: onset year, strength (W/M/S/VS), label
EVENTS = [(1982,'VS','1982–83'),(1986,'M','1986–87'),(1987,'S','1987–88'),
          (1991,'S','1991–92'),(1994,'M','1994–95'),(1997,'VS','1997–98'),
          (2002,'M','2002–03'),(2004,'W','2004–05'),(2006,'W','2006–07'),
          (2009,'M','2009–10'),(2014,'W','2014–15'),(2015,'VS','2015–16'),
          (2018,'W','2018–19'),(2023,'S','2023–24')]

# NOAA Oceanic Niño Index La Niña onset years since 1980; neutral years are neither El Niño nor La Niña
LA_NINA = {1983, 1984, 1988, 1995, 1998, 1999, 2000, 2005, 2007, 2008, 2010, 2011, 2016, 2017, 2020, 2021, 2022, 2024}
EL_NINO = {e for e, _, _ in EVENTS}
NEUTRAL = set(range(1980, 2025)) - EL_NINO - LA_NINA

# Countries whose main harvest falls in the calendar year after the event peaks (M49 codes)
LAG1 = {'024','894','454','508','716','072','516','710','426','748','450','834',
        '604','068','152','032','858','600','554','598','626','360','458','608',
        '704','764','116','418','104','144','076'}

# Pre-split areas folded into their successors so series reach back to 1980
SUCCESSOR = {'230': '231',   # Ethiopia PDR -> Ethiopia
             '736': '729'}   # Sudan (former) -> Sudan

SMALL_MULTIPLES = [('716','Zimbabwe'),('894','Zambia'),('454','Malawi'),('508','Mozambique'),
                   ('710','South Africa'),('426','Lesotho'),('516','Namibia'),('332','Haiti'),
                   ('222','El Salvador'),('320','Guatemala'),('608','Philippines')]
REGIONS = {
    'saf': ('Southern Africa (11 countries)', ['716','894','454','508','710','426','516','072','748','450','024'], 1),
    'cam': ('Dry Corridor and Haiti (5 countries)', ['320','340','222','558','332'], 0),
}
FIRST, LAST = 1978, 2022


# ISO3 (as used by Our World in Data) -> M49 (as used by FAO); pre-split areas folded like SUCCESSOR
ISO3_M49 = {"AFG":"004","ALB":"008","DZA":"012","AGO":"024","ATG":"028","ARG":"032","ARM":"051","AUS":"036","AUT":"040","AZE":"031","BHS":"044","BGD":"050","BRB":"052","BLR":"112","BEL":"056","BLZ":"084","BEN":"204","BTN":"064","BOL":"068","BIH":"070","BWA":"072","BRA":"076","BRN":"096","BGR":"100","BFA":"854","BDI":"108","KHM":"116","CMR":"120","CAN":"124","CPV":"132","CAF":"140","TCD":"148","CHL":"152","CHN":"156","COL":"170","COM":"174","COG":"178","CRI":"188","CIV":"384","HRV":"191","CUB":"192","CYP":"196","CZE":"203","COD":"180","DNK":"208","DJI":"262","DMA":"212","DOM":"214","TLS":"626","ECU":"218","EGY":"818","SLV":"222","ERI":"232","EST":"233","SWZ":"748","ETH":"231","FJI":"242","FIN":"246","FRA":"250","GUF":"254","GAB":"266","GMB":"270","GEO":"268","DEU":"276","GHA":"288","GRC":"300","GRD":"308","GLP":"312","GTM":"320","GIN":"324","GNB":"624","GUY":"328","HTI":"332","HND":"340","HKG":"344","HUN":"348","ISL":"352","IND":"356","IDN":"360","IRN":"364","IRQ":"368","IRL":"372","ISR":"376","ITA":"380","JAM":"388","JPN":"392","JOR":"400","KAZ":"398","KEN":"404","KWT":"414","KGZ":"417","LAO":"418","LVA":"428","LBN":"422","LSO":"426","LBR":"430","LBY":"434","LTU":"440","LUX":"442","MDG":"450","MWI":"454","MYS":"458","MDV":"462","MLI":"466","MLT":"470","MRT":"478","MUS":"480","MEX":"484","FSM":"583","MDA":"498","MNG":"496","MNE":"499","MAR":"504","MOZ":"508","MMR":"104","NAM":"516","NPL":"524","NLD":"528","NCL":"540","NZL":"554","NIC":"558","NER":"562","NGA":"566","PRK":"408","MKD":"807","NOR":"578","OMN":"512","PAK":"586","PSE":"275","PAN":"591","PNG":"598","PRY":"600","PER":"604","PHL":"608","POL":"616","PRT":"620","PRI":"630","QAT":"634","REU":"638","ROU":"642","RUS":"643","RWA":"646","LCA":"662","VCT":"670","STP":"678","SAU":"682","SEN":"686","SRB":"688","SLE":"694","SVK":"703","SVN":"705","SLB":"090","SOM":"706","ZAF":"710","KOR":"410","SSD":"728","ESP":"724","LKA":"144","SDN":"729","SUR":"740","SWE":"752","CHE":"756","SYR":"760","TWN":"158","TJK":"762","TZA":"834","THA":"764","TGO":"768","TTO":"780","TUN":"788","TUR":"792","TKM":"795","UGA":"800","UKR":"804","ARE":"784","GBR":"826","USA":"840","URY":"858","UZB":"860","VUT":"548","VEN":"862","VNM":"704","YEM":"887","ZMB":"894","ZWE":"716"}
ISO3_M49.update({'OWID_ERE': '231', 'OWID_SDN': '729'})
PROD_LAST = 2024


def load_production(path):
    out = {}
    for r in csv.DictReader(open(path, encoding='utf-8')):
        m49 = ISO3_M49.get(r['Code'])
        val = r.get('Cereals - Production (tonnes)') or ''
        if not m49 or not val:
            continue
        y = int(r['Year'])
        if r['Code'].startswith('OWID_') and y in out.get(m49, {}):
            continue                      # successor's own figure wins where both exist
        out.setdefault(m49, {})[y] = float(val)
    return out


def pct_dev(series, lag):
    """Harvest as % change against the mean of the five previous non-El Niño harvests."""
    en = {e + lag for e, _, _ in EVENTS}
    out = {}
    for y in sorted(series):
        base = [series[k] for k in range(y - 1, y - 9, -1) if k in series and k not in en][:5]
        if len(base) >= 3 and st.mean(base) > 0:
            out[y] = series[y] / st.mean(base) * 100 - 100
    return out


def lowess(xs, ys, frac=0.3):
    """Local linear regression with tricube weights: the long-term trend of a series."""
    import math
    n = len(xs); k = max(4, int(math.ceil(frac * n))); out = []
    for x0 in xs:
        h = sorted(abs(x - x0) for x in xs)[k - 1] or 1
        w = [(1 - min(1, abs(x - x0) / h) ** 3) ** 3 for x in xs]
        sw = sum(w); mx = sum(wi * x for wi, x in zip(w, xs)) / sw; my = sum(wi * y for wi, y in zip(w, ys)) / sw
        sxx = sum(wi * (x - mx) ** 2 for wi, x in zip(w, xs)); sxy = sum(wi * (x - mx) * (y - my) for wi, x, y in zip(w, xs, ys))
        out.append(my + (sxy / sxx if sxx else 0) * (x0 - mx))
    return out


def trend_anomalies(series, first=1975):
    """Each year's value as % above or below the country's long-term (LOWESS) trend."""
    yrs = [y for y in sorted(series) if y >= first and series[y] > 0]
    tr = lowess(yrs, [series[y] for y in yrs])
    return {y: (series[y] / t - 1) * 100 for y, t in zip(yrs, tr) if t > 0}


def mann_whitney_p(a, b):
    """Two-sided Mann-Whitney U test, normal approximation (standard library only)."""
    import math
    allv = sorted([(v, 0) for v in a] + [(v, 1) for v in b])
    ranks, i = [0.0] * len(allv), 0
    while i < len(allv):
        j = i
        while j + 1 < len(allv) and allv[j + 1][0] == allv[i][0]:
            j += 1
        for k in range(i, j + 1):
            ranks[k] = (i + j) / 2 + 1
        i = j + 1
    r1 = sum(r for r, (_, g) in zip(ranks, allv) if g == 0)
    n1, n2 = len(a), len(b)
    u = r1 - n1 * (n1 + 1) / 2
    sd = math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12)
    z = (u - n1 * n2 / 2) / sd if sd else 0
    return math.erfc(abs(z) / math.sqrt(2))


def rows(path):
    if path.endswith('.zip'):
        z = zipfile.ZipFile(path)
        name = next(n for n in z.namelist() if 'All_Data' in n and n.endswith('.csv'))
        return csv.DictReader(io.TextIOWrapper(z.open(name), encoding='utf-8', errors='replace'))
    return csv.DictReader(open(path, encoding='utf-8', errors='replace'))


def load(path):
    out, names = {}, {}
    for r in rows(path):
        if r['Item Code'] != ITEM or r['Element Code'] not in (PROD, IMP, EXP):
            continue
        try:
            v = float(r['Value'])
        except ValueError:
            continue
        if int(r['Area Code']) >= 5000:   # FAO regional aggregates
            continue
        m49 = r['Area Code (M49)'].strip("'").zfill(3)
        out.setdefault(m49, {}).setdefault(int(r['Year']), {})[r['Element Code']] = v
        names[m49] = r['Area']
    return out, names


def ratio(d):
    p, i, x = d.get(PROD), d.get(IMP), d.get(EXP, 0.0)
    if p is None or i is None:
        return None
    den = p + i - x
    return None if den <= 0 else (i - x) / den * 100


def merge(hist, new):
    """Historic sheets up to 2009, current sheets from 2010; fold pre-split areas."""
    pix = {}
    for m49, ys in hist.items():
        tgt = SUCCESSOR.get(m49, m49)
        for y, d in ys.items():
            if y <= 2009 and (tgt == m49 or y not in hist.get(tgt, {})):
                pix.setdefault(tgt, {})[y] = d
    for m49, ys in new.items():
        for y, d in ys.items():
            if y >= 2010:
                pix.setdefault(m49, {})[y] = d
    return pix


def deviations(series, lag):
    """Ratio minus the mean of the five previous non-El Niño harvest years (>=3 needed)."""
    en = {e + lag for e, _, _ in EVENTS}
    out = {}
    for y in sorted(series):
        base = [series[k] for k in range(y - 1, y - 9, -1) if k in series and k not in en][:5]
        if len(base) >= 3:
            out[y] = (series[y] - st.mean(base), st.mean(base))
    return out


def build(hist_path, new_path, prod_path=None):
    H, hn = load(hist_path)
    N, nn = load(new_path)
    names = {**hn, **nn}
    pix = merge(H, N)
    R = {m: {y: ratio(d) for y, d in ys.items() if ratio(d) is not None} for m, ys in pix.items()}

    # --- map: dependency today and change since the 1980s ------------------------
    world = {}
    for m, s_ in R.items():
        now = [s_[y] for y in (2020, 2021, 2022) if y in s_]
        e80 = [s_[y] for y in range(1980, 1990) if y in s_]
        if len(now) < 2:
            continue
        pk = max((v, y) for y, v in s_.items() if 1980 <= y <= LAST)
        world[m] = {'name': names.get(m, m), 'now': round(st.mean(now), 1),
                    'e80': round(st.mean(e80), 1) if len(e80) >= 5 else None,
                    'from': min(s_), 'peak': [round(pk[0], 1), pk[1]],
                    # yearly import share 1980-2022 for the insights panel (null where missing)
                    'imp': [round(s_[y]) if y in s_ else None for y in range(1980, LAST + 1)]}

    # --- production: El Niño harvest shortfall per country -----------------------
    # production (not yield: failed, unharvested fields are part of the food lost), detrended with LOWESS,
    # El Niño harvest years compared with neutral harvest years (neither El Niño nor La Niña)
    P = load_production(prod_path) if prod_path else {}
    for m, ser in P.items():
        yrs = [y for y in ser if 1980 <= y <= PROD_LAST]
        if m not in world or len(yrs) < 30 or st.mean(ser[y] for y in yrs) < 50000:
            continue
        lag = 1 if m in LAG1 else 0
        anom = {y: v for y, v in trend_anomalies({y: v for y, v in ser.items() if y <= PROD_LAST}).items() if y >= 1980}
        a = [v for y, v in anom.items() if y - lag in EL_NINO]
        b = [v for y, v in anom.items() if y - lag in NEUTRAL]
        if len(a) < 8 or len(b) < 7:
            continue
        # shortfall as a plain percentage: how much smaller the average El Niño harvest is than the average neutral-year harvest
        # (both measured against the country's trend); negative = smaller. Easier to read than a gap in percentage points.
        rel = ((1 + st.mean(a) / 100) / (1 + st.mean(b) / 100) - 1) * 100
        world[m].update(hgap=round(rel, 1), hen=round(st.mean(a), 1),
                        hoth=round(st.mean(b), 1), hhits=sum(1 for v in a if v <= -10),
                        hnev=len(a), hnneu=len(b), hp=round(mann_whitney_p(a, b), 3),
                        # each El Niño harvest against the long-term trend, for the insights panel
                        hev=[[y, round(v)] for y, v in sorted(anom.items()) if y - lag in EL_NINO],
                        # every harvest against trend, 1980 onward, for the tooltip sparkline (null where missing)
                        han=[round(anom[y]) if y in anom else None for y in range(1980, PROD_LAST + 1)])

    # --- small multiples: line series + El Niño-year bullets ----------------------
    majors = [e for e in EVENTS if e[1] != 'W']
    countries = []
    for m, name in SMALL_MULTIPLES:
        s = R[m]; lag = 1 if m in LAG1 else 0
        dev = deviations({y: v for y, v in s.items() if y <= LAST}, lag)
        hdev = pct_dev({y: v for y, v in P.get(m, {}).items() if 1970 <= y <= PROD_LAST}, lag) if P else {}
        bullets = []
        for onset, strength, label in majors:
            hy = onset + lag
            if hy in dev:
                d, base = dev[hy]
                bullets.append({'ev': label, 'st': strength, 'hy': hy, 'v': round(s[hy], 1), 'base': round(base, 1)})
            else:
                bullets.append({'ev': label, 'st': strength, 'hy': hy, 'v': None, 'base': None})
            bullets[-1]['h'] = round(hdev[hy], 1) if hy in hdev else None
        countries.append({'id': m, 'name': name, 'lag': lag, 'bullets': bullets,
                          'series': {y: round(v, 1) for y, v in s.items() if FIRST <= y <= LAST}})

    # --- regional aggregates from summed tonnages --------------------------------
    regions = {}
    for key, (title, members, lag) in REGIONS.items():
        agg = {}
        for y in range(FIRST - 8, LAST + 1):
            ds = [pix.get(m, {}).get(y) for m in members]
            if all(d and PROD in d and IMP in d for d in ds):
                tot = {PROD: sum(d[PROD] for d in ds), IMP: sum(d[IMP] for d in ds), EXP: sum(d.get(EXP, 0) for d in ds)}
                agg[y] = ratio(tot)
        dev = deviations(agg, lag)
        hagg = {y: sum(P[m][y] for m in members) for y in range(1970, PROD_LAST + 1)
                if P and all(y in P.get(m, {}) for m in members)}
        hd = pct_dev(hagg, lag) if hagg else {}
        en = {e + lag for e, _, _ in EVENTS}
        hstats = None
        if hd:
            a = [v for y, v in hd.items() if y in en and y >= 1980]; b = [v for y, v in hd.items() if y not in en and y >= 1980]
            hstats = {'en': round(st.mean(a), 1), 'oth': round(st.mean(b), 1), 'p': round(mann_whitney_p(a, b), 3)}
        regions[key] = {'title': title, 'lag': lag, 'harvest': hstats,
                        'series': {y: round(v, 1) for y, v in agg.items() if FIRST <= y <= LAST},
                        'dev': {y: round(d, 1) for y, (d, _) in dev.items() if FIRST <= y <= LAST}}

    data = {'events': [{'onset': e, 'st': s, 'label': l} for e, s, l in EVENTS],
            'world': world, 'countries': countries, 'regions': regions, 'last': LAST, 'plast': PROD_LAST if P else None}
    return data, R, names


def main():
    if len(sys.argv) not in (3, 4):
        sys.exit(__doc__)
    hist_path, new_path = sys.argv[1], sys.argv[2]
    prod_path = sys.argv[3] if len(sys.argv) == 4 else None
    data, R, names = build(hist_path, new_path, prod_path)
    here = os.path.dirname(os.path.abspath(__file__))
    js_path = os.path.join(here, 'js', 'data.js')
    src = open(js_path, encoding='utf-8').read()
    blob = 'const DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
    src, n = re.subn(r'^const DATA = \{.*?\};\n', lambda _: blob, src, count=1, flags=re.S | re.M)
    if n != 1:
        sys.exit('DATA line not found in js/data.js')
    open(js_path, 'w', encoding='utf-8').write(src)
    os.makedirs(os.path.join(here, 'data'), exist_ok=True)
    with open(os.path.join(here, 'data', 'cereal_import_dependency_ratio_1961_2022.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['m49_code', 'area', 'year', 'cereal_import_dependency_ratio_pct', 'source_sheet'])
        for m in sorted(R, key=lambda k: names.get(k, k)):
            for y in sorted(R[m]):
                w.writerow([m, names.get(m, m), y, round(R[m][y], 1), 'FBS historic' if y <= 2009 else 'FBS 2010-'])
    print(f"js/data.js updated: {len(data['world'])} countries on the map, "
          f"{len(data['countries'])} small multiples, data to {LAST}")


if __name__ == '__main__':
    main()
