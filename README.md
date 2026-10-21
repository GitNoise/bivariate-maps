# When do cereal shortfalls become food crises?

An interactive bivariate map of El Niño harvest shortfalls and cereal import dependence, with recorded El Niño food crises.

## Files

| File | What it holds |
|---|---|
| `index.html` | The page: headline, text, method notes and the map’s markup. No data or code. |
| `css/style.css` | All styles, light and dark themes. |
| `js/data.js` | The data: map shapes (`WORLD`), country figures (`DATA`), UN M49 regions (`M49_SUB`, `M49_NAME`), recorded food crises (`FOOD_INSEC`) and the caution list (`CAUTION`). |
| `js/settings.js` | Editorial and visual choices: the area the world view fits, small countries drawn as dots, watercolour settings, how UN subregions group into the region buttons (and the Sudan exception), button order, short country names, names that take “the”, and the text of the notes on the world view. The notes' clusters are found from the crisis records and the notes are placed by a force simulation, so no positions are set by hand. |
| `js/chart.js` | Everything that draws: the watercolour map, legend, labels, region zooms, tooltip and insight lines. |
| `js/vendor/topojson-client.min.js` | topojson-client 3.1.0 (ISC licence). d3 7.9.0 loads from cdnjs. |
| `data/cereal_import_dependency_ratio_1961_2022.csv` | The import share series, for reuse. |
| `build_data.py` | Rebuilds the `DATA` line in `js/data.js` and the CSV from the FAO and Our World in Data source files. |
| `bundle.py` | Folds the page and its local files into one self-contained HTML file, for hosts that need a single file. |

Scripts load in this order: d3, topojson-client, `js/data.js`, `js/settings.js`, `js/chart.js`. Facts live in `data.js`; choices live in `settings.js`.

## Updating the data

```bash
python3 build_data.py \
  "FoodBalanceSheetsHistoric_E_All_Data_(Normalized).csv" \
  "FoodBalanceSheets_E_All_Data_(Normalized).csv" \
  cereal-production.csv
```

`build_data.py` only rewrites the `DATA` line; everything else in `js/data.js` (crisis records, cautions) is edited by hand, with sources in the method section of `index.html`.

## Publishing

GitHub Pages serves the folder as it is. For a single file:

```bash
python3 bundle.py            # writes dist/index.html
```

Open `index.html` through a web server (for example `python3 -m http.server`) rather than straight from disk, so the scripts load in order.

## Reproducing the analysis

```bash
python3 build_data.py <FAO food balance sheets, historic> <FAO food balance sheets, current> data/cereal-production.csv   # map data (js/data.js)
python3 analysis/build_axes.py      # second-axis measures and their scores (js/axes.js)
python3 trace.py data/cereal-production.csv   # TRACE.md: step-by-step trace and every check
python3 analysis/proxies.py         # the coping-capacity test, printed
python3 bundle.py                   # one self-contained HTML file
```

Sources, mirrors and access dates: `SOURCES.md`.
