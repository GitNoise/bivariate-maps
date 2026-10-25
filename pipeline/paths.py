"""Where the data and the page's files are."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent   # the repository
DATA_DIR = ROOT / 'data'
MEASURES_DIR = DATA_DIR / 'proxies'              # the second measures' source files
JS_DIR = ROOT / 'js'

PRODUCTION_CSV = DATA_DIR / 'cereal-production.csv'
IMPORTS_CSV = DATA_DIR / 'cereal_import_dependency_ratio_1961_2022.csv'
PAGE_DATA_JS = JS_DIR / 'data.js'
PAGE_SETTINGS_JS = JS_DIR / 'settings.js'
PAGE_MEASURES_JS = JS_DIR / 'measures.js'
TRACE_MD = ROOT / 'TRACE.md'
