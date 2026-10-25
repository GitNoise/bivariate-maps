"""Reading and writing the page's data files in src/.

src/data.js holds the map shapes, the country data (written by build_data.py) and hand-edited tables: the recorded crises,
with a source note on each line, and the UN regions. src/measures.js is written whole by build_measures.py.
"""
import json, re

from .paths import PAGE_DATA_JS, PAGE_SETTINGS_JS, PAGE_MEASURES_JS

_DATA_LINE = re.compile(r'^export const DATA = (\{.*?\});\n', re.S | re.M)
_source = None


def _data_js():
    global _source
    if _source is None:
        _source = PAGE_DATA_JS.read_text(encoding='utf-8')
    return _source


def read_country_data():
    """The DATA object of src/data.js: per country, its import share, harvest shortfall and series."""
    return json.loads(_DATA_LINE.search(_data_js()).group(1))


def read_crisis_table(name):
    """A hand-edited crisis table of src/data.js (NATIONAL_CRISES, SMALLER_CRISES) as {m49: (periods, source note)},
    each line written as   '716': ['2015–16', '2023–24'],   // Zimbabwe (26%, 32%)"""
    block = re.search(r'^export const ' + name + r' = \{(.*?)^\};', _data_js(), re.S | re.M).group(1)
    return {m.group(1): (re.findall(r"'([^']*)'", m.group(2)), (m.group(3) or '').strip())
            for m in re.finditer(r"'(\d+)':\s*(\[[^\]]*\]),?[ \t]*(?://[ \t]*(.*))?", block)}   # the source note is optional


def read_southern_africa():
    """The southern African countries (UN M49 codes), from SOUTHERN_AFRICA in src/settings.js: the baseline that flags
    every country there. The page and the analysis share this one list."""
    source = PAGE_SETTINGS_JS.read_text(encoding='utf-8')
    return set(re.findall(r"'(\d{3})'", re.search(r'^export const SOUTHERN_AFRICA = new Set\(\[(.*?)\]\)', source, re.M | re.S).group(1)))


def write_country_data(data):
    """Replace the DATA line of src/data.js; everything else in the file stays as it is."""
    line = 'export const DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
    global _source
    source, n = _DATA_LINE.subn(lambda _: line, _data_js(), count=1)
    if n != 1:
        raise SystemExit('DATA line not found in src/data.js')
    PAGE_DATA_JS.write_text(source, encoding='utf-8')
    _source = source   # later reads in this process see the new data


def write_measures(header, constants):
    """Write src/measures.js: the header comment lines, then one `export const NAME = <json>;` line per constant."""
    lines = ['// ' + line for line in header]
    for name, (value, ascii_only, comment) in constants.items():
        lines.append(f'export const {name} = ' + json.dumps(value, ensure_ascii=ascii_only, separators=(',', ':')) + ';' + (f'   // {comment}' if comment else ''))
    text = '\n'.join(lines) + '\n'
    PAGE_MEASURES_JS.write_text(text, encoding='utf-8')
    return text
