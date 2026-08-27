#!/usr/bin/env python3
"""
Tend - build.py

Inlines css/styles.css and every js/*.js file into index.html and writes
standalone/tend.html: one self-contained file you can email, drop on any
static host, or open straight off your desktop with no web server at all.

    python3 build.py

Local mode works from a file:// path. Cloud mode does not, because browsers
refuse to load the Supabase library from a page opened as a bare file - host
the file over http(s) if you want cloud accounts.
"""

import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(ROOT, "standalone")
OUT = os.path.join(OUT_DIR, "tend.html")


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as fh:
        return fh.read()


def main():
    html = read("index.html")

    css = read("css/styles.css")
    html = html.replace(
        '<link rel="stylesheet" href="css/styles.css">',
        "<style>\n" + css + "\n</style>",
    )

    scripts = re.findall(r'<script src="(js/[^"]+)"></script>', html)
    if not scripts:
        raise SystemExit("No <script src=...> tags found - has index.html changed?")

    bundle = []
    for rel in scripts:
        bundle.append("/* ===== " + rel + " ===== */\n" + read(rel))

    first = '<script src="%s"></script>' % scripts[0]
    html = html.replace(first, "<script>\n" + "\n\n".join(bundle) + "\n</script>")
    for rel in scripts[1:]:
        html = html.replace('<script src="%s"></script>' % rel, "")

    html = re.sub(r"\n{3,}", "\n\n", html)

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(html)

    print("wrote %s (%.0f KB)" % (OUT, os.path.getsize(OUT) / 1024))


if __name__ == "__main__":
    main()
