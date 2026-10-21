# Sources

Primary sources first; where the data was taken from a mirror, that is noted. Access dates are when the copy in this repository was made.

## Harvests and El Niño

| Data | Primary source | Copy used | Accessed |
|---|---|---|---|
| Cereal production, tonnes, 1961–2024 | FAO, FAOSTAT Crops and livestock products | Our World in Data, "Cereal production" (`data/cereal-production.csv`) | September 2026 |
| Cereal imports, exports, production (import share) | FAO, FAOSTAT Food Balance Sheets (historic 1961–2013 and current 2010 onwards) | FAOSTAT bulk download; result in `data/cereal_import_dependency_ratio_1961_2022.csv` | September 2026 |
| El Niño, La Niña and neutral years | NOAA Climate Prediction Center, Oceanic Niño Index (ONI v5) | as published by NOAA | September 2026 |
| Check of the year classification | NOAA Climate Prediction Center, Relative Oceanic Niño Index (RONI v5) | values copied into `trace.py` | 13 October 2026 |
| El Niño forecast | NOAA, ENSO diagnostic discussion, 8 October 2026; SADC, SARCOF-33 statement, August 2026 | as published | 9–13 October 2026 |

## Food crises (map borders)

| Data | Primary source | Accessed |
|---|---|---|
| 2016 crisis figures | FSIN, Global Report on Food Crises 2017 | October 2026 |
| 2023/24 crisis figures | FSIN, Global Report on Food Crises 2024 and 2025 country profiles | October 2026 |
| Timor-Leste 2023/24 | IPC, Timor-Leste acute food insecurity analysis, November 2023–April 2024 | October 2026 |
| Viet Nam 2016 appeal | Government of Viet Nam and UN, Emergency Response Plan, April 2016 | October 2026 |

Each country's figure and source note is listed in `TRACE.md`, section 6.

## Second-axis measures (the explorer)

| Measure | Primary source | Copy used | Accessed |
|---|---|---|---|
| GDP, current US$ | World Bank, World Development Indicators (NY.GDP.MKTP.CD) | public mirror `github.com/datasets/gdp` (`data/proxies/gdp.csv`) | 13 October 2026 |
| Population | World Bank, World Development Indicators (SP.POP.TOTL) | public mirror `github.com/datasets/population` (`data/proxies/population.csv`) | 13 October 2026 |
| Extreme poverty | World Bank, Poverty and Inequality Platform | Our World in Data, `github.com/owid/poverty-data` (`data/proxies/pip.csv`) | 13 October 2026 |
| Human Development Index | UNDP, Human Development Report | Our World in Data country table (`data/proxies/covid_latest.csv`); single recent value | 13 October 2026 |
| Life expectancy | UN, World Population Prospects | Our World in Data country table (`data/proxies/covid_latest.csv`); single recent value | 13 October 2026 |
| Undernourishment (optional sixth axis) | FAO, prevalence of undernourishment (SDG 2.1.1) | Our World in Data, "Share of people who are undernourished" (`data/proxies/undernourishment.csv`, when added) | — |

`analysis/fetch_proxies.sh` re-downloads the second-axis files.

## Research cited

- Iizumi, T. et al. (2014). Impacts of El Niño Southern Oscillation on the global yields of major crops. *Nature Communications* 5, 3712.
- WFP (August 2026). Analysis of the 2026 El Niño's impact on acute food insecurity.
- FAO–WFP (June 2026). Hunger Hotspots: early warnings on acute food insecurity, June to November 2026.
