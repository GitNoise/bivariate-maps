# When do cereal shortfalls become food crises?

An interactive bivariate map of El Niño harvest shortfalls and a second measure (cereal imports, income, poverty, human development, life expectancy or undernourishment), with recorded El Niño food crises.

## How it fits together

```
data/  ──▶  pipeline/ (Python)  ──▶  src/data.js, src/measures.js  ──▶  the page (src/, Svelte)
                  │
                  └──▶  TRACE.md, analysis/ reports
```

Facts live in `src/data.js` and `src/measures.js`; editorial choices live in `src/settings.js`.

## The page

| File | What it holds |
|---|---|
| `index.html` | The page: headline, text and method notes. The figure and the score table's rows are Svelte components (`src/main.js` mounts them). |
| `css/page.css`, `css/style.css` | Styles, light and dark themes: the page shell every case shares, then what only this page has. |
| `src/data.js` | Facts: country data (`DATA`, written by `build_data.py`) and the recorded crises (`NATIONAL_CRISES`, `SMALLER_CRISES`, edited by hand, a source note on each line). |
| `src/settings.js` | Editorial and visual choices: class thresholds, watercolour settings, how UN subregions group into the region buttons (and the Sudan exception), short names, the second measures' definitions and formats, and the notes on the world view. |
| `src/measures.js` | Written by `build_measures.py`: the second measures (values, classes, yearly series, thresholds), their scores, and each country's test results. |
| `src/state.svelte.js` | The shared state: the selected measure and region. Whatever reads a value updates when it changes. |
| `src/Figure.svelte` | The figure: the measure dropdown, the region buttons, the bivariate map with this page's data, the score line and the key. |
| `src/classes.js` | What a country's colour means (its cell for each measure), which countries are named, hatched and outlined, and which belong to each zoom region. |
| `src/map.js` | The map's geometry: Natural Earth's countries, framed on the inhabited world. |
| `src/Labels.svelte`, `src/labels.js` | Text on the map: notes on the crisis clusters in the world view, the names of the highest-risk countries when zoomed in. `labels.js` places them; the component draws them. |
| `src/Tooltip.svelte`, `src/Sparkline.svelte` | The tooltip's content: a country's figures, and sparklines for its harvests and the selected measure. |
| `src/ScoreLine.svelte`, `src/ScoreTable.svelte` | The score line beside the map, and the table of every measure. |
| `src/Scatter.svelte` | The scatters, one small multiple per measure. |
| `src/bivariate/` | The bivariate map, reusable on another page: it imports nothing from this one. `BivariateMap.svelte` takes the shapes, each country's cell, the raised cells, hatched and outlined countries, zoom regions, the legend's text and snippets for the tooltip and labels (its header lists them). `geo.js` makes the geometry, `wash.js` and `brush.js` paint the watercolour, `Legend.svelte` is the diamond, `regions.js` and `RegionButtons.svelte` set up the zoom regions (the UN grouping by default) and their buttons, `colour.js` reads the palette (`--bi{j}{i}`) from the CSS, `geometry.js` holds small helpers, `world.js` the map shapes (Natural Earth), UN subregions, the default frame and small countries, and `bivariate.css` the map's styles. |
| `vite.config.js`, `package.json`, `package-lock.json` | The build: Svelte 5, d3 and topojson-client, compiled by Vite into one file per page: `dist/index.html`, and `dist/cases/<case>/index.html` for each case. |

## Other cases

Each case is a page of its own in `cases/<case>/`, built with the same bivariate map (`src/bivariate/`) and page shell (`css/page.css`). Its README says where its data comes from.

| Case | What it maps |
|---|---|
| `cases/forgotten-crises/` | Draft, "Need and missing money": humanitarian need (INFORM Severity) against the unfunded share of each country's 2025 UN appeals (OCHA), with new appeals outlined. |

## The analysis

| File | What it does |
|---|---|
| `pipeline/enso.py` | Which years count as El Niño, La Niña and neutral; which countries harvest the year after an event; NOAA's RONI for comparison. |
| `pipeline/harvests.py` | Cereal production, its long-term trend (LOWESS), the El Niño harvest shortfall and its significance test. |
| `pipeline/imports.py` | FAO food balance sheets and the cereal import dependency ratio. |
| `pipeline/measures.py` | The second measures' source data and their three classes. |
| `pipeline/countries.py` | The countries on the map, the southern Africa list and cereal production, shared by the modules below. |
| `pipeline/crises.py` | The recorded crises, read from `src/data.js`. |
| `pipeline/walkforward.py` | The map as it would have looked before each crisis period, and its scores. |
| `pipeline/codes.py` | ISO3 to UN M49 country codes, shared by every case. |
| `pipeline/page_files.py`, `pipeline/paths.py` | Reading and writing the page's data files; where everything is. |
| `build_data.py` | Writes the `DATA` line of `src/data.js` and `data/processed/cereal_import_dependency_ratio_1961_2022.csv`; its docstring describes every field. |
| `build_measures.py` | Writes `src/measures.js`. |
| `trace.py` | Traces the calculation from the raw data to the map, with every check; writes `TRACE.md`. |
| `analysis/robustness.py` | Prints how the test changes with other cut-offs, ENSO indexes, trend spans and each El Niño left out. |
| `analysis/coping_capacity.py` | Prints whether proxies for coping capacity sharpen the warning. |
| `analysis/fetch_proxies.sh` | Downloads the second measures' source files into `data/raw/measures/`. |
| `tests/` | Unit tests (`make test`). |
| `Makefile`, `pyproject.toml`, `requirements.lock` | How to run it, its Python dependencies, and their exact versions. |

## Reproducing it

Python 3.11 or later, with pandas, scipy and statsmodels, and Node 20 or later for the page. `requirements.lock` and `package-lock.json` pin the exact versions the published files were built with.

```bash
make setup                                      # .venv and node_modules, with the pinned versions
make data HISTORIC=<FAO food balance sheets, historic> CURRENT=<FAO food balance sheets, current>   # src/data.js
make measures                                   # src/measures.js
make trace                                      # TRACE.md
make analysis                                   # the robustness and coping-capacity checks, printed
make test                                       # unit tests: the formulas, classes, and the values in src/data.js
make dev                                        # the page on a local server, reloading on every change
make page                                       # dist/index.html, the page in one file
```

Each target runs one script with `.venv/bin/python` (for example `build_measures.py`), so the scripts can also be run directly. `TRACE.md` is the readable walk-through of the calculation; it is generated by the same pipeline code, not written separately.

`build_data.py` only rewrites the `DATA` line; everything else in `src/data.js` is edited by hand, with sources in the method section of `index.html`. Sources, mirrors and access dates: `SOURCES.md`.

## Publishing

On every push to `main`, `.github/workflows/pages.yml` builds the page and publishes `dist/` on GitHub Pages (the repository's Pages source must be set to GitHub Actions). `dist/index.html` is self-contained, so it can also be hosted anywhere as a single file.
