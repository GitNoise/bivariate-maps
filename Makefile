# The pipeline, step by step. `make` rebuilds what the page reads; `make check` reruns the tests and checks.
PYTHON := .venv/bin/python

.PHONY: all setup measures trace analysis test check bundle data

all: measures trace bundle

setup:                       ## a virtual environment with the exact versions used
	python3 -m venv .venv
	$(PYTHON) -m pip install -r requirements.lock

data:                        ## js/data.js and the import CSV; needs the two FAO balance-sheet files
	@test -n "$(HISTORIC)" -a -n "$(CURRENT)" || (echo 'usage: make data HISTORIC=<FAO historic sheets> CURRENT=<FAO current sheets>'; exit 1)
	$(PYTHON) build_data.py "$(HISTORIC)" "$(CURRENT)" data/raw/cereal-production.csv

measures:                    ## js/measures.js
	$(PYTHON) build_measures.py

trace:                       ## TRACE.md
	$(PYTHON) trace.py

analysis:                    ## the robustness and coping-capacity checks, printed
	$(PYTHON) analysis/robustness.py
	$(PYTHON) analysis/coping_capacity.py

test:
	$(PYTHON) -m unittest discover -s tests -t .

check: test analysis

bundle:                      ## dist/index.html
	$(PYTHON) bundle.py
