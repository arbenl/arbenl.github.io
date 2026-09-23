"""Package the public week-2 handouts; never include private teacher notes."""
from pathlib import Path
import posixpath
import re
import zipfile

base = Path('lendet/2026-2027/mobile')
files = [p for p in (base / 'java-02').rglob('*') if p.is_file() and p.suffix != '.zip']
files += [base / 'lectures/ligjerata-02-rideshare-vendimet-mvp-2026-v2.pptx', base / 'dorezimet.html']
files += [p for p in (base / 'demo/rideshare').rglob('*') if p.is_file()]
paths = {str(p) for p in files}
archive = base / 'java-02/java-02-paketa-studentit.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for p in files:
        data = p.read_bytes()
        if p.suffix == '.html':
            def local(match):
                target = match[2].split('#')[0].split('?')[0].lstrip('/')
                if target.endswith('/'):
                    target += 'index.html'
                url = posixpath.relpath(target, str(p.parent)) if target in paths else 'https://arbenl.github.io' + match[2]
                return match[1] + '="' + url + '"'
            data = re.sub(r'(href|src)="(/[^\"]*)"', local, data.decode()).encode()
        z.writestr(str(p), data)
    z.writestr('index.html', '<!doctype html><html lang="sq"><meta charset="utf-8"><title>Java 2 · Mobile</title><a href="lendet/2026-2027/mobile/java-02/index.html">Hap RideShare — Java 2</a></html>')
Path('materials/java-02/java-02-paketa-studentit.zip').write_bytes(archive.read_bytes())
print('Updated public week-2 package and compatibility download.')
