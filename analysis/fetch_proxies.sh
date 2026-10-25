#!/bin/sh
# Downloads the second-axis source data into data/raw/measures/. Files as fetched on 13 October 2026 are already in the repository.
# Primary sources are named on each line; the URLs are public mirrors of them.
cd "$(dirname "$0")/../data/raw/measures" || exit 1
curl -sL -o gdp.csv          https://raw.githubusercontent.com/datasets/gdp/main/data/gdp.csv                        # World Bank WDI: GDP, current US$ (NY.GDP.MKTP.CD)
curl -sL -o population.csv   https://raw.githubusercontent.com/datasets/population/main/data/population.csv          # World Bank WDI: population (SP.POP.TOTL)
curl -sL -o pip.csv          https://raw.githubusercontent.com/owid/poverty-data/main/datasets/pip_dataset.csv        # World Bank Poverty and Inequality Platform, via Our World in Data
curl -sL -o covid_latest.csv https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/latest/owid-covid-latest.csv   # UNDP HDI and UN life expectancy, via Our World in Data
# yearly HDI and life expectancy, for the tooltip's sparklines only (fetched 23 October 2026)
curl -sL -o human-development-index.csv 'https://ourworldindata.org/grapher/human-development-index.csv?v=1&csvType=full&useColumnShortNames=false'   # UNDP HDI, via Our World in Data
curl -sL -o life-expectancy.csv         'https://ourworldindata.org/grapher/life-expectancy.csv?v=1&csvType=full&useColumnShortNames=false'           # UN World Population Prospects, via Our World in Data
# FAO prevalence of undernourishment (SDG 2.1.1), the sixth measure (fetched 25 October 2026)
curl -sL -o undernourishment.csv 'https://ourworldindata.org/grapher/prevalence-of-undernourishment.csv?v=1&csvType=full&useColumnShortNames=false'   # FAO, via Our World in Data
