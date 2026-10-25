"""Which years count as El Niño, La Niña and neutral, and when each country's harvest follows an event.

Years are classed by the onset of an episode, after NOAA's Oceanic Niño Index (ONI). For comparison, NOAA's newer Relative
Oceanic Niño Index (RONI) is included too; trace.py and analysis/robustness.py show how much the choice matters.
"""

FIRST_YEAR, LAST_YEAR = 1980, 2024   # the years the analysis covers

# El Niño events since 1980 (NOAA ONI): onset year, strength (W weak, M moderate, S strong, VS very strong), label
EL_NINO_EVENTS = [
    (1982, 'VS', '1982–83'), (1986, 'M', '1986–87'), (1987, 'S', '1987–88'), (1991, 'S', '1991–92'),
    (1994, 'M', '1994–95'), (1997, 'VS', '1997–98'), (2002, 'M', '2002–03'), (2004, 'W', '2004–05'),
    (2006, 'W', '2006–07'), (2009, 'M', '2009–10'), (2014, 'W', '2014–15'), (2015, 'VS', '2015–16'),
    (2018, 'W', '2018–19'), (2023, 'S', '2023–24'),
]
EL_NINO_YEARS = {onset for onset, _, _ in EL_NINO_EVENTS}
LA_NINA_YEARS = {1983, 1984, 1988, 1995, 1998, 1999, 2000, 2005, 2007, 2008, 2010, 2011, 2016, 2017, 2020, 2021, 2022, 2024}
NEUTRAL_YEARS = set(range(FIRST_YEAR, LAST_YEAR + 1)) - EL_NINO_YEARS - LA_NINA_YEARS   # neither El Niño nor La Niña


def phase(year):
    """'El Niño', 'La Niña' or 'neutral', as the map classes the year."""
    return 'El Niño' if year in EL_NINO_YEARS else 'La Niña' if year in LA_NINA_YEARS else 'neutral'


# Countries whose main harvest comes in the calendar year after an event's onset (UN M49 codes)
HARVEST_THE_YEAR_AFTER = {
    '024', '894', '454', '508', '716', '072', '516', '710', '426', '748', '450', '834',
    '604', '068', '152', '032', '858', '600', '554', '598', '626', '360', '458', '608',
    '704', '764', '116', '418', '104', '144', '076',
}


def harvest_lag(m49):
    """Years between an El Niño's onset and the harvest it affects, in this country: 0 or 1."""
    return 1 if m49 in HARVEST_THE_YEAR_AFTER else 0


# ---- NOAA's Relative Oceanic Niño Index (RONI, ERSSTv5): 12 three-month seasons a year, DJF ... NDJ, 1979–2025 ----------
# Source: https://cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/v5/ (read 13 October 2026)
RONI = {
 1979:[0.2,0.2,0.2,0.2,0.1,-0.1,0.0,0.2,0.4,0.5,0.5,0.7], 1980:[0.6,0.5,0.3,0.2,0.3,0.3,0.2,0.0,0.0,0.1,0.2,0.2],
 1981:[0.0,-0.3,-0.3,-0.3,-0.3,-0.3,-0.3,-0.2,-0.1,-0.2,-0.2,0.0], 1982:[0.1,0.3,0.4,0.6,0.8,0.8,0.9,1.3,1.8,2.2,2.4,2.5],
 1983:[2.5,2.2,1.7,1.4,1.0,0.6,0.1,-0.2,-0.6,-0.9,-1.1,-1.0], 1984:[-0.5,-0.3,-0.3,-0.5,-0.6,-0.4,-0.2,-0.1,-0.1,-0.5,-0.8,-1.0],
 1985:[-0.8,-0.6,-0.6,-0.7,-0.7,-0.5,-0.4,-0.3,-0.2,-0.2,-0.1,-0.2], 1986:[-0.3,-0.3,-0.2,-0.1,-0.1,-0.1,0.3,0.6,0.9,1.2,1.4,1.5],
 1987:[1.6,1.5,1.3,1.0,0.9,1.1,1.3,1.6,1.5,1.3,1.0,0.9], 1988:[0.7,0.3,-0.2,-0.7,-1.4,-1.7,-1.6,-1.3,-1.4,-1.6,-1.9,-1.9],
 1989:[-1.7,-1.4,-1.1,-0.8,-0.6,-0.4,-0.3,-0.3,-0.2,-0.2,-0.1,0.0], 1990:[0.2,0.3,0.3,0.3,0.2,0.2,0.3,0.4,0.4,0.4,0.4,0.5],
 1991:[0.6,0.5,0.4,0.4,0.5,0.7,0.8,0.8,0.9,1.2,1.7,2.1], 1992:[2.3,2.2,2.0,1.7,1.4,0.9,0.5,0.3,0.2,0.1,0.1,0.3],
 1993:[0.5,0.7,0.9,1.0,0.9,0.7,0.5,0.5,0.5,0.4,0.3,0.3], 1994:[0.3,0.3,0.4,0.5,0.6,0.6,0.7,0.8,1.0,1.1,1.3,1.4],
 1995:[1.3,1.0,0.7,0.4,0.1,-0.1,-0.3,-0.5,-0.7,-0.9,-0.9,-0.9], 1996:[-0.9,-0.8,-0.6,-0.4,-0.3,-0.3,-0.2,-0.2,-0.2,-0.3,-0.3,-0.3],
 1997:[-0.2,-0.1,0.2,0.5,1.0,1.3,1.7,2.0,2.3,2.4,2.4,2.3], 1998:[2.2,1.8,1.3,0.8,0.1,-0.5,-1.2,-1.4,-1.5,-1.5,-1.6,-1.6],
 1999:[-1.5,-1.3,-1.1,-1.0,-1.0,-1.0,-1.0,-1.0,-1.0,-1.1,-1.4,-1.6], 2000:[-1.7,-1.4,-1.1,-0.8,-0.6,-0.5,-0.4,-0.4,-0.4,-0.6,-0.7,-0.7],
 2001:[-0.6,-0.5,-0.5,-0.5,-0.3,-0.1,0.0,0.0,0.0,-0.2,-0.2,-0.3], 2002:[-0.1,0.0,0.0,0.1,0.4,0.7,0.9,1.1,1.3,1.4,1.5,1.2],
 2003:[0.9,0.5,0.2,-0.2,-0.4,-0.3,0.0,0.2,0.2,0.2,0.3,0.3], 2004:[0.3,0.1,0.1,0.2,0.3,0.5,0.7,0.8,0.9,0.8,0.7,0.7],
 2005:[0.6,0.4,0.3,0.3,0.2,0.0,-0.1,-0.1,0.0,-0.2,-0.5,-0.8], 2006:[-0.9,-0.9,-0.6,-0.4,-0.1,0.0,0.1,0.3,0.5,0.8,0.9,0.9],
 2007:[0.6,0.2,-0.2,-0.4,-0.4,-0.5,-0.6,-0.8,-1.0,-1.3,-1.4,-1.5], 2008:[-1.6,-1.5,-1.3,-0.9,-0.8,-0.5,-0.3,-0.2,-0.3,-0.4,-0.6,-0.8],
 2009:[-0.9,-0.8,-0.7,-0.4,-0.1,0.1,0.3,0.4,0.6,0.9,1.3,1.6], 2010:[1.5,1.1,0.6,0.1,-0.5,-1.0,-1.3,-1.5,-1.7,-1.7,-1.7,-1.6],
 2011:[-1.4,-1.2,-0.9,-0.7,-0.5,-0.3,-0.4,-0.5,-0.7,-0.9,-1.0,-1.0], 2012:[-0.8,-0.6,-0.6,-0.5,-0.3,0.0,0.3,0.4,0.4,0.2,-0.1,-0.4],
 2013:[-0.6,-0.6,-0.5,-0.4,-0.4,-0.4,-0.4,-0.3,-0.3,-0.2,-0.2,-0.3], 2014:[-0.5,-0.5,-0.3,0.0,0.1,0.0,-0.1,-0.1,0.1,0.4,0.5,0.6],
 2015:[0.5,0.4,0.5,0.6,0.8,1.0,1.3,1.6,1.9,2.2,2.3,2.4], 2016:[2.2,1.8,1.3,0.5,-0.1,-0.6,-0.9,-1.0,-1.1,-1.1,-1.1,-1.0],
 2017:[-0.7,-0.5,-0.3,-0.1,0.1,0.1,-0.2,-0.5,-0.7,-1.0,-1.1,-1.3], 2018:[-1.1,-1.0,-0.9,-0.7,-0.3,0.0,0.1,0.2,0.4,0.7,0.8,0.7],
 2019:[0.6,0.6,0.6,0.5,0.3,0.2,0.0,-0.1,0.0,0.1,0.2,0.2], 2020:[0.1,0.1,0.0,-0.3,-0.6,-0.8,-0.8,-0.9,-1.2,-1.5,-1.5,-1.4],
 2021:[-1.2,-1.0,-1.0,-0.8,-0.6,-0.5,-0.6,-0.7,-0.9,-1.1,-1.2,-1.2], 2022:[-1.2,-1.2,-1.3,-1.3,-1.2,-1.0,-0.9,-1.0,-1.1,-1.1,-1.0,-1.0],
 2023:[-0.8,-0.6,-0.4,-0.2,0.1,0.4,0.6,0.9,1.1,1.4,1.5,1.5], 2024:[1.2,0.9,0.5,0.1,-0.3,-0.5,-0.5,-0.6,-0.8,-0.8,-0.9,-1.1],
 2025:[-1.1,-0.9,-0.7,-0.5,-0.5,-0.4,-0.5,-0.6,-0.8,-0.9,-0.9,-1.0],
}
OCT_DEC = 10   # the season a year is classed by: October–December (OND), when episodes usually peak


def roni_phases():
    """{year: 'El Niño' | 'La Niña' | 'neutral'} by RONI. NOAA's rule: an episode is at least five consecutive seasons
    at +0.5 °C or more (El Niño) or −0.5 °C or less (La Niña); each year is classed by its October–December season."""
    seasons = [(year, season, value) for year in sorted(RONI) for season, value in enumerate(RONI[year])]
    episode = [None] * len(seasons)
    for sign, name in ((1, 'El Niño'), (-1, 'La Niña')):
        run = []
        for i, (_, _, value) in enumerate(seasons + [(0, 0, 0)]):   # a sentinel season ends the last run
            if i < len(seasons) and value * sign >= 0.5:
                run.append(i)
                continue
            if len(run) >= 5:
                for j in run:
                    episode[j] = name
            run = []
    return {year: episode[i] or 'neutral' for i, (year, season, _) in enumerate(seasons) if season == OCT_DEC}


def roni_years(name):
    """The years RONI classes as `name` ('El Niño' or 'neutral')."""
    return {year for year, p in roni_phases().items() if p == name}
