# The pipeline, step by step. `make` rebuilds what the page reads and the page itself; `make check` reruns the tests and checks.
PYTHON := .venv/bin/python

.PHONY: all setup measures trace analysis test check page dev data

all: measures trace page

setup:                       ## the exact versions used: a Python virtual environment, and the page's npm packages
	python3 -m venv .venv
	$(PYTHON) -m pip install -r requirements.lock
	npm ci

data:                        ## src/data.js and the import CSV; needs the two FAO balance-sheet files
	@test -n "$(HISTORIC)" -a -n "$(CURRENT)" || (echo 'usage: make data HISTORIC=<FAO historic sheets> CURRENT=<FAO current sheets>'; exit 1)
	$(PYTHON) build_data.py "$(HISTORIC)" "$(CURRENT)" data/raw/cereal-production.csv

measures:                    ## src/measures.js
	$(PYTHON) build_measures.py

trace:                       ## TRACE.md
	$(PYTHON) trace.py

analysis:                    ## the robustness and coping-capacity checks, printed
	$(PYTHON) analysis/robustness.py
	$(PYTHON) analysis/coping_capacity.py

test:
	$(PYTHON) -m unittest discover -s tests -t .

check: test analysis

page:                        ## dist/index.html, the whole page in one file
	npm run build

dev:                         ## the page on a local server that reloads on every change
	npm run dev
