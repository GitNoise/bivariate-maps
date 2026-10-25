#!/usr/bin/env python3
"""Fold index.html and its local CSS and JS files into one self-contained HTML file.

GitHub Pages serves the split files as they are. Some hosts (such as a Claude artifact) need a single file:

    python3 bundle.py [output.html]        # default: dist/index.html

Only local files are inlined; the d3 script from cdnjs stays a link. The ES modules in js/ become one inline module:
each file once, in the order the browser would run them (dependencies first), without its import and export keywords.
"""
import os, re, sys

here = os.path.dirname(os.path.abspath(__file__))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, 'dist', 'index.html')

html = open(os.path.join(here, 'index.html'), encoding='utf-8').read()
read = lambda p: open(os.path.join(here, p), encoding='utf-8').read()

def css(m):
    return '<style>\n' + read(m.group(1)) + '</style>'
def js(m):
    return '<script>\n' + read(m.group(1)).replace('</script', '<\\/script') + '</script>'

IMPORT = re.compile(r"^import \{[^}]*\} from '([^']+)';\n", re.M)
def module_order(path, done=None):
    """The module and everything it imports, depth first, each once: the order the browser evaluates them."""
    done = [] if done is None else done
    if path not in done:
        done.append(path)   # mark first, so import cycles end
        for dep in IMPORT.findall(read(path)):
            module_order(os.path.normpath(os.path.join(os.path.dirname(path), dep)), done)
        done.remove(path); done.append(path)
    return done
def module(m):
    files = module_order(m.group(1))
    body = '\n'.join(re.sub(r'^export ', '', IMPORT.sub('', read(f)), flags=re.M) for f in files)
    return '<script type="module">\n' + body.replace('</script', '<\\/script') + '</script>'

html, nc = re.subn(r'<link rel="stylesheet" href="((?!https?:)[^"]+)">', css, html)
html, nj = re.subn(r'<script src="((?!https?:)[^"]+)"></script>', js, html)
html, nm = re.subn(r'<script type="module" src="((?!https?:)[^"]+)"></script>', module, html)
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
open(out, 'w', encoding='utf-8').write(html)
print(f'{out}: {nc} stylesheet(s), {nj} script(s) and {nm} module tree(s) inlined, {len(html) // 1024} KB')
