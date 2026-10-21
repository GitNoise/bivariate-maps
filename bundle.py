#!/usr/bin/env python3
"""Fold index.html and its local CSS and JS files into one self-contained HTML file.

GitHub Pages serves the split files as they are. Some hosts (such as a Claude artifact) need a single file:

    python3 bundle.py [output.html]        # default: dist/index.html

Only local files are inlined; the d3 script from cdnjs stays a link.
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

html, nc = re.subn(r'<link rel="stylesheet" href="((?!https?:)[^"]+)">', css, html)
html, nj = re.subn(r'<script src="((?!https?:)[^"]+)"></script>', js, html)
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
open(out, 'w', encoding='utf-8').write(html)
print(f'{out}: {nc} stylesheet(s) and {nj} script(s) inlined, {len(html) // 1024} KB')
