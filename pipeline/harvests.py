"""Cereal production, its long-term trend, and the El Niño harvest shortfall.

The shortfall: each harvest is measured against the country's long-term trend (LOWESS); El Niño harvests are then compared
with neutral-year harvests. Production, not yield, because failed fields go unharvested and are part of the food lost.
"""
import csv, math, statistics

from . import enso

TREND_FROM = 1975           # the trend is fitted from 1975, so 1980 has years on both sides
LAST_HARVEST_YEAR = 2024
TREND_SPAN = 0.3            # the LOWESS span the map uses; analysis/robustness.py also tries 0.75

# ISO3 codes (Our World in Data) -> UN M49 codes (FAO, and the map); pre-split areas fold into their successors
ISO3_TO_M49 = {"AFG":"004","ALB":"008","DZA":"012","AGO":"024","ATG":"028","ARG":"032","ARM":"051","AUS":"036","AUT":"040","AZE":"031","BHS":"044","BGD":"050","BRB":"052","BLR":"112","BEL":"056","BLZ":"084","BEN":"204","BTN":"064","BOL":"068","BIH":"070","BWA":"072","BRA":"076","BRN":"096","BGR":"100","BFA":"854","BDI":"108","KHM":"116","CMR":"120","CAN":"124","CPV":"132","CAF":"140","TCD":"148","CHL":"152","CHN":"156","COL":"170","COM":"174","COG":"178","CRI":"188","CIV":"384","HRV":"191","CUB":"192","CYP":"196","CZE":"203","COD":"180","DNK":"208","DJI":"262","DMA":"212","DOM":"214","TLS":"626","ECU":"218","EGY":"818","SLV":"222","ERI":"232","EST":"233","SWZ":"748","ETH":"231","FJI":"242","FIN":"246","FRA":"250","GUF":"254","GAB":"266","GMB":"270","GEO":"268","DEU":"276","GHA":"288","GRC":"300","GRD":"308","GLP":"312","GTM":"320","GIN":"324","GNB":"624","GUY":"328","HTI":"332","HND":"340","HKG":"344","HUN":"348","ISL":"352","IND":"356","IDN":"360","IRN":"364","IRQ":"368","IRL":"372","ISR":"376","ITA":"380","JAM":"388","JPN":"392","JOR":"400","KAZ":"398","KEN":"404","KWT":"414","KGZ":"417","LAO":"418","LVA":"428","LBN":"422","LSO":"426","LBR":"430","LBY":"434","LTU":"440","LUX":"442","MDG":"450","MWI":"454","MYS":"458","MDV":"462","MLI":"466","MLT":"470","MRT":"478","MUS":"480","MEX":"484","FSM":"583","MDA":"498","MNG":"496","MNE":"499","MAR":"504","MOZ":"508","MMR":"104","NAM":"516","NPL":"524","NLD":"528","NCL":"540","NZL":"554","NIC":"558","NER":"562","NGA":"566","PRK":"408","MKD":"807","NOR":"578","OMN":"512","PAK":"586","PSE":"275","PAN":"591","PNG":"598","PRY":"600","PER":"604","PHL":"608","POL":"616","PRT":"620","PRI":"630","QAT":"634","REU":"638","ROU":"642","RUS":"643","RWA":"646","LCA":"662","VCT":"670","STP":"678","SAU":"682","SEN":"686","SRB":"688","SLE":"694","SVK":"703","SVN":"705","SLB":"090","SOM":"706","ZAF":"710","KOR":"410","SSD":"728","ESP":"724","LKA":"144","SDN":"729","SUR":"740","SWE":"752","CHE":"756","SYR":"760","TWN":"158","TJK":"762","TZA":"834","THA":"764","TGO":"768","TTO":"780","TUN":"788","TUR":"792","TKM":"795","UGA":"800","UKR":"804","ARE":"784","GBR":"826","USA":"840","URY":"858","UZB":"860","VUT":"548","VEN":"862","VNM":"704","YEM":"887","ZMB":"894","ZWE":"716"}
ISO3_TO_M49.update({'OWID_ERE': '231', 'OWID_SDN': '729'})   # Ethiopia PDR -> Ethiopia, former Sudan -> Sudan


def load_production(path):
    """Cereal production in tonnes, from the Our World in Data CSV, as {m49: {year: tonnes}}."""
    out = {}
    for row in csv.DictReader(open(path, encoding='utf-8')):
        m49 = ISO3_TO_M49.get(row['Code'])
        value = row.get('Cereals - Production (tonnes)') or ''
        if not m49 or not value:
            continue
        year = int(row['Year'])
        if row['Code'].startswith('OWID_') and year in out.get(m49, {}):
            continue   # the successor's own figure wins where both exist
        out.setdefault(m49, {})[year] = float(value)
    return out


def lowess(xs, ys, frac=TREND_SPAN):
    """Local linear regression with tricube weights: the long-term trend of a series, one value per x."""
    n = len(xs)
    k = max(4, int(math.ceil(frac * n)))   # the points in each local fit
    out = []
    for x0 in xs:
        h = sorted(abs(x - x0) for x in xs)[k - 1] or 1
        w = [(1 - min(1, abs(x - x0) / h) ** 3) ** 3 for x in xs]
        sw = sum(w)
        mx = sum(wi * x for wi, x in zip(w, xs)) / sw
        my = sum(wi * y for wi, y in zip(w, ys)) / sw
        sxx = sum(wi * (x - mx) ** 2 for wi, x in zip(w, xs))
        sxy = sum(wi * (x - mx) * (y - my) for wi, x, y in zip(w, xs, ys))
        out.append(my + (sxy / sxx if sxx else 0) * (x0 - mx))
    return out


def trend_anomalies(series, first=TREND_FROM, frac=TREND_SPAN):
    """Each year's value as % above or below the long-term (LOWESS) trend, fitted from `first`."""
    years = [y for y in sorted(series) if y >= first and series[y] > 0]
    trend = lowess(years, [series[y] for y in years], frac=frac)
    return {y: (series[y] / t - 1) * 100 for y, t in zip(years, trend) if t > 0}


def harvest_anomalies(production, frac=TREND_SPAN):
    """Each harvest from 1980 to LAST_HARVEST_YEAR as % above or below the country's trend: {year: %}."""
    harvests = {y: v for y, v in production.items() if y <= LAST_HARVEST_YEAR}
    return {y: v for y, v in trend_anomalies(harvests, frac=frac).items() if y >= enso.FIRST_YEAR}


def shortfall_pct(el_nino, neutral):
    """How much smaller (%) the mean El Niño harvest is than the mean neutral-year harvest, both measured against the
    trend (lists of anomalies in %). Positive = smaller. A plain percentage, easier to read than a gap in points."""
    return -(((1 + statistics.mean(el_nino) / 100) / (1 + statistics.mean(neutral) / 100)) - 1) * 100


def split_by_phase(anomalies, lag, el_nino_years=None, neutral_years=None):
    """The anomalies of the harvests that follow El Niño years and neutral years, shifted by the country's harvest lag."""
    el_nino_years = el_nino_years or enso.EL_NINO_YEARS
    neutral_years = neutral_years or enso.NEUTRAL_YEARS
    el_nino = [v for y, v in anomalies.items() if y - lag in el_nino_years]
    neutral = [v for y, v in anomalies.items() if y - lag in neutral_years]
    return el_nino, neutral


def mann_whitney_p(a, b):
    """Two-sided Mann-Whitney U test, normal approximation (standard library only): could the El Niño and neutral harvests
    come from the same distribution? The map hatches a shortfall with p of 0.1 or more."""
    values = sorted([(v, 0) for v in a] + [(v, 1) for v in b])
    ranks, i = [0.0] * len(values), 0
    while i < len(values):   # tied values share their mean rank
        j = i
        while j + 1 < len(values) and values[j + 1][0] == values[i][0]:
            j += 1
        for k in range(i, j + 1):
            ranks[k] = (i + j) / 2 + 1
        i = j + 1
    rank_sum_a = sum(r for r, (_, group) in zip(ranks, values) if group == 0)
    n1, n2 = len(a), len(b)
    u = rank_sum_a - n1 * (n1 + 1) / 2
    sd = math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12)
    z = (u - n1 * n2 / 2) / sd if sd else 0
    return math.erfc(abs(z) / math.sqrt(2))
