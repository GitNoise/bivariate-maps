# When do cereal shortfalls become food crises?

An interactive bivariate map of El Niño harvest shortfalls and a second measure (cereal imports, income, poverty, human development, life expectancy or undernourishment), with recorded El Niño food crises.

## How it fits together

```
data/  ──▶  pipeline/ (Python)  ──▶  js/data.js, js/measures.js  ──▶  the page (js/*.js)
                  │
                  └──▶  TRACE.md, analysis/ reports
```

Facts live in `js/data.js` and `js/measures.js`; editorial choices live in `js/settings.js`.

## The page

| File | What it holds |
|---|---|
| `index.html` | The page: headline, text, method notes and the map's markup. No data or code. |
| `css/style.css` | All styles, light and dark themes. |
| `js/data.js` | Facts: map shapes (`WORLD`), country data (`DATA`, written by `build_data.py`), UN subregions (`UN_SUBREGION`, `UN_SUBREGION_NAME`) and the recorded crises (`NATIONAL_CRISES`, `SMALLER_CRISES`, edited by hand, a source note on each line). |
| `js/settings.js` | Editorial and visual choices: class thresholds, watercolour settings, how UN subregions group into the region buttons (and the Sudan exception), short names, the second measures' definitions and formats, and the notes on the world view. |
| `js/measures.js` | Written by `build_measures.py`: the second measures (values, classes, yearly series, thresholds), their scores, and each country's test results. |
| `js/classes.js` | What a country's colour means (its class on each axis), which countries are named, and which belong to each zoom region. Draws nothing. |
| `js/geometry.js` | Small geometry helpers for label placement and the swoopy arrows. |
| `js/map.js` | The SVG layers, crisis borders, how each view is framed, and `redrawMap()`. |
| `js/watercolour.js` | The watercolour washes on a canvas under the map, the raised highest-risk countries, and the zoom transition. |
| `js/labels.js` | Text on the map: notes on the crisis clusters in the world view, and the names of the highest-risk countries when zoomed in. |
| `js/legend.js` | The diamond legend. |
| `js/tooltip.js` | The tooltip: a country's figures, and sparklines for its harvests and the selected measure. |
| `js/explorer.js` | The controls, the score line beside the map, the table of every measure, and starting the page. |
| `js/vendor/topojson-client.min.js` | topojson-client 3.1.0 (ISC licence). d3 7.9.0 loads from cdnjs. |

Scripts load in this order: d3, topojson-client, `js/data.js`, `js/settings.js`, `js/measures.js`, then the drawing code from `js/classes.js` to `js/explorer.js` as listed above (each uses only the ones before it at load).

## The analysis

| File | What it does |
|---|---|
| `pipeline/enso.py` | Which years count as El Niño, La Niña and neutral; which countries harvest the year after an event; NOAA's RONI for comparison. |
| `pipeline/harvests.py` | Cereal production, its long-term trend (LOWESS), the El Niño harvest shortfall and its significance test. |
| `pipeline/imports.py` | FAO food balance sheets and the cereal import dependency ratio. |
| `pipeline/measures.py` | The second measures' source data and their three classes. |
| `pipeline/crises.py` | The recorded crises, read from `js/data.js`. |
| `pipeline/walkforward.py` | The map as it would have looked before each crisis period, and its scores. |
| `pipeline/page_files.py`, `pipeline/paths.py` | Reading and writing the page's data files; where everything is. |
| `build_data.py` | Writes the `DATA` line of `js/data.js` and `data/cereal_import_dependency_ratio_1961_2022.csv`; its docstring describes every field. |
| `build_measures.py` | Writes `js/measures.js`. |
| `trace.py` | Traces the calculation from the raw data to the map, with every check; writes `TRACE.md`. |
| `analysis/robustness.py` | Prints how the test changes with other cut-offs, ENSO indexes, trend spans and each El Niño left out. |
| `analysis/coping_capacity.py` | Prints whether proxies for coping capacity sharpen the warning. |
| `analysis/fetch_proxies.sh` | Downloads the second measures' source files into `data/proxies/`. |
| `bundle.py` | Folds the page and its local files into one self-contained HTML file. |

## Reproducing it

```bash
python3 build_data.py <FAO food balance sheets, historic> <FAO food balance sheets, current> data/cereal-production.csv   # js/data.js
python3 build_measures.py                     # js/measures.js
python3 trace.py data/cereal-production.csv   # TRACE.md (needs scipy and statsmodels for two cross-checks)
python3 analysis/robustness.py                # the robustness checks, printed
python3 analysis/coping_capacity.py           # the coping-capacity test, printed
python3 bundle.py                             # dist/index.html
```

`build_data.py` only rewrites the `DATA` line; everything else in `js/data.js` is edited by hand, with sources in the method section of `index.html`. Sources, mirrors and access dates: `SOURCES.md`.

## Publishing

GitHub Pages serves the folder as it is. Open `index.html` through a web server (for example `python3 -m http.server`) rather than straight from disk, so the scripts load in order.
