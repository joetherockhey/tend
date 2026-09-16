#!/usr/bin/env python3
"""
Tend - build.py

Inlines css/styles.css and every js/*.js file into index.html and writes
standalone/tend.html: one self-contained file you can email, drop on any
static host, or open straight off your desktop with no web server at all.

    python3 build.py           local mode, works anywhere including file://
    python3 build.py --cloud   keeps the Supabase keys from js/config.js

By default the two Supabase values are blanked in the standalone copy, so the
file always opens straight into on-device profiles. That is deliberate: a
page opened as a bare file:// cannot load the Supabase library at all (the
browser blocks it), so a cloud-mode standalone would greet you with an error
instead of a sign-in box. Pass --cloud when you are hosting the single file
over http(s) and do want real accounts.
"""

import hashlib
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(ROOT, "standalone")
OUT = os.path.join(OUT_DIR, "tend.html")


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as fh:
        return fh.read()


def stamp_service_worker():
    """Put a hash of the app's own files into sw.js's VERSION line.

    A browser only installs a new service worker when the BYTES of sw.js
    change. Every update path in the app hangs off that: boot.js asks the
    registration to update, a new worker installs, controllerchange fires, and
    the page reloads itself. Edit only index.html and the js files and sw.js is
    byte-identical, so no new worker installs, so an app sitting on a home
    screen is resumed rather than reloaded and can serve yesterday's code for
    days with nothing to say so.

    Bumping VERSION by hand each deploy is the sort of step that gets
    forgotten - it already was - so it is computed from the files instead.
    Returns the version written.
    """
    sw_path = os.path.join(ROOT, "sw.js")
    sw = read("sw.js")

    watched = re.findall(r"'\./([^']+)'", sw.split("];")[0])
    digest = hashlib.sha256()
    for rel in sorted(watched):
        full = os.path.join(ROOT, rel)
        if os.path.isfile(full):
            with open(full, "rb") as fh:
                digest.update(rel.encode("utf-8"))
                # Line endings are normalised so a Windows checkout and a Linux
                # one agree - otherwise a fresh clone would stamp a different
                # version out of identical committed content.
                digest.update(fh.read().replace(b"\r\n", b"\n"))

    version = "tend-" + digest.hexdigest()[:12]
    stamped, n = re.subn(r"const VERSION = '[^']*';",
                         "const VERSION = '%s';" % version, sw, count=1)
    if not n:
        raise SystemExit("No VERSION line in sw.js - has it changed?")

    if stamped != sw:
        with open(sw_path, "w", encoding="utf-8", newline="") as fh:
            fh.write(stamped)
    return version


def main():
    version = stamp_service_worker()
    html = read("index.html")

    css = read("css/styles.css")
    html = html.replace(
        '<link rel="stylesheet" href="css/styles.css">',
        "<style>\n" + css + "\n</style>",
    )

    keep_cloud = "--cloud" in sys.argv

    scripts = re.findall(r'<script src="(js/[^"]+)"></script>', html)
    if not scripts:
        raise SystemExit("No <script src=...> tags found - has index.html changed?")

    bundle = []
    for rel in scripts:
        src = read(rel)
        if rel.endswith("config.js") and not keep_cloud:
            src = re.sub(r"SUPABASE_URL: '[^']*'", "SUPABASE_URL: ''", src)
            src = re.sub(r"SUPABASE_ANON_KEY: '[^']*'", "SUPABASE_ANON_KEY: ''", src)
        bundle.append("/* ===== " + rel + " ===== */\n" + src)

    first = '<script src="%s"></script>' % scripts[0]
    html = html.replace(first, "<script>\n" + "\n\n".join(bundle) + "\n</script>")
    for rel in scripts[1:]:
        html = html.replace('<script src="%s"></script>' % rel, "")

    html = re.sub(r"\n{3,}", "\n\n", html)

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(html)

    mode = "cloud mode (keys included)" if keep_cloud else "local mode (keys blanked)"
    print("wrote %s (%.0f KB) - %s" % (OUT, os.path.getsize(OUT) / 1024, mode))
    print("sw.js VERSION = %s" % version)


if __name__ == "__main__":
    main()
