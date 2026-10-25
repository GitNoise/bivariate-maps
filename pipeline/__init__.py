"""The analysis behind the map, as a small library. Each module covers one topic:

    paths        where the data and the page's files are
    enso         which years count as El Niño, La Niña and neutral, and when each country's harvest follows an event
    harvests     cereal production, its long-term trend, and the El Niño harvest shortfall
    imports      FAO food balance sheets and the cereal import dependency ratio
    measures     the second measures (imports, income, poverty, HDI, life expectancy, undernourishment) and their classes
    page_files   reading and writing the page's data files in js/
    crises       the recorded food crises, from js/data.js
    walkforward  the map drawn as it would have looked before each crisis period, and its scores

The scripts that use it: build_data.py and build_measures.py (they write the page's data), trace.py (writes TRACE.md),
analysis/robustness.py and analysis/coping_capacity.py (print the checks behind the method notes).
"""
