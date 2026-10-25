"""Where the data and the page's files are."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent   # the repository
RAW_DIR = ROOT / 'data' / 'raw'               # the source files as downloaded; never edited
PROCESSED_DIR = ROOT / 'data' / 'processed'   # tables the pipeline writes
MEASURES_DIR = RAW_DIR / 'measures'           # the second measures' source files
PAGE_SRC = ROOT / 'src'   # the page's source; its data files are written here

PRODUCTION_CSV = RAW_DIR / 'cereal-production.csv'
IMPORTS_CSV = PROCESSED_DIR / 'cereal_import_dependency_ratio_1961_2022.csv'
PAGE_DATA_JS = PAGE_SRC / 'data.js'
PAGE_SETTINGS_JS = PAGE_SRC / 'settings.js'
PAGE_MEASURES_JS = PAGE_SRC / 'measures.js'
TRACE_MD = ROOT / 'TRACE.md'
