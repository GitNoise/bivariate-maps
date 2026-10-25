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
| `js/map.js` | The SVG layers, crisis borders and how each view is framed. |
| `js/redraw.js` | `redrawMap()`, which redraws everything for the current state, and `zoomTo()`, which switches the region. |
| `js/watercolour.js` | The watercolour washes on a canvas under the map, the raised highest-risk countries, and the zoom transition. |
| `js/labels.js` | Text on the map: notes on the crisis clusters in the world view, and the names of the highest-risk countries when zoomed in. |
| `js/legend.js` | The diamond legend. |
| `js/tooltip.js` | The tooltip: a country's figures, and sparklines for its harvests and the selected measure. |
| `js/explorer.js` | The controls, the score line beside the map, the table of every measure, and starting the page. The page loads this module; it imports the rest. |
| `js/vendor/topojson-client.min.js` | topojson-client 3.1.0 (ISC licence). d3 7.9.0 loads from cdnjs. |

The files in `js/` are ES modules: each imports what it uses, so the imports at the top of a file show what it depends on. d3 and topojson-client load first as plain scripts and are used as globals. State shared across modules (the selected measure and region) changes only through setters such as `setSelectedMeasure()`.

## The analysis

| File | What it does |
|---|---|
| `pipeline/enso.py` | Which years count as El Niño, La Niña and neutral; which countries harvest the year after an event; NOAA's RONI for comparison. |
| `pipeline/harvests.py` | Cereal production, its long-term trend (LOWESS), the El Niño harvest shortfall and its significance test. |
| `pipeline/imports.py` | FAO food balance sheets and the cereal import dependency ratio. |
| `pipeline/measures.py` | The second measures' source data and their three classes. |
| `pipeline/countries.py` | The countries on the map, the southern Africa list and cereal production, shared by the modules below. |
| `pipeline/crises.py` | The recorded crises, read from `js/data.js`. |
| `pipeline/walkforward.py` | The map as it would have looked before each crisis period, and its scores. |
| `pipeline/page_files.py`, `pipeline/paths.py` | Reading and writing the page's data files; where everything is. |
| `build_data.py` | Writes the `DATA` line of `js/data.js` and `data/processed/cereal_import_dependency_ratio_1961_2022.csv`; its docstring describes every field. |
| `build_measures.py` | Writes `js/measures.js`. |
| `trace.py` | Traces the calculation from the raw data to the map, with every check; writes `TRACE.md`. |
| `analysis/robustness.py` | Prints how the test changes with other cut-offs, ENSO indexes, trend spans and each El Niño left out. |
| `analysis/coping_capacity.py` | Prints whether proxies for coping capacity sharpen the warning. |
| `analysis/fetch_proxies.sh` | Downloads the second measures' source files into `data/raw/measures/`. |
| `bundle.py` | Folds the page and its local files into one self-contained HTML file. |
| `tests/` | Unit tests (`make test`). |
| `Makefile`, `pyproject.toml`, `requirements.lock` | How to run it, its dependencies, and their exact versions. |

## Reproducing it

Python 3.11 or later, with pandas, scipy and statsmodels. `requirements.lock` pins the exact versions the published files were built with.

```bash
make setup                                      # .venv with the pinned versions
make data HISTORIC=<FAO food balance sheets, historic> CURRENT=<FAO food balance sheets, current>   # js/data.js
make measures                                   # js/measures.js
make trace                                      # TRACE.md
make analysis                                   # the robustness and coping-capacity checks, printed
make test                                       # unit tests: the formulas, classes, and the values in js/data.js
make bundle                                     # dist/index.html
```

Each target runs one script with `.venv/bin/python` (for example `build_measures.py`), so the scripts can also be run directly. `TRACE.md` is the readable walk-through of the calculation; it is generated by the same pipeline code, not written separately.

`build_data.py` only rewrites the `DATA` line; everything else in `js/data.js` is edited by hand, with sources in the method section of `index.html`. Sources, mirrors and access dates: `SOURCES.md`.

## Publishing

GitHub Pages serves the folder as it is. Open `index.html` through a web server (for example `python3 -m http.server`) rather than straight from disk: browsers do not load ES modules from `file://`. `bundle.py` folds the modules into one file for hosts that need that.
