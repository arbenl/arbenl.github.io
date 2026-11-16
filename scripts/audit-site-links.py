"""Audit complete HTML documents without fetching remote pages or private data."""
import collections
import json
import os
from pathlib import Path
import re
from html.parser import HTMLParser
from urllib.parse import unquote, urljoin, urlsplit

ROOT = Path(__file__).resolve().parent.parent
ORIGIN = 'https://arbenl.github.io'
SKIP = {'node_modules', '.git', '.next', 'test-results', 'playwright-report', '.vercel'}


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs = []
        self.ids = []
        self.lang = None
        self.base = None
        self.title = False
        self.images_without_alt = []

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        if tag == 'html':
            self.lang = attrs.get('lang')
        if tag == 'base':
            self.base = attrs.get('href')
        if tag == 'title':
            self.title = True
        if tag == 'img' and 'alt' not in attrs:
            self.images_without_alt.append(attrs.get('src'))
        for key in ('href', 'src'):
            if key in attrs:
                self.refs.append(attrs[key])


pages = {}
fragments = 0
for directory, directories, files in os.walk(ROOT):
    directories[:] = [name for name in directories if name not in SKIP]
    for filename in files:
        if not filename.endswith('.html'):
            continue
        path = Path(directory) / filename
        try:
            source = path.read_text()
        except UnicodeError:
            continue
        # Email templates and document fragments are not standalone web pages.
        if not re.search(r'<(?:html|head)(?:\s|>)', source, re.I):
            fragments += 1
            continue
        page = Page()
        page.feed(source)
        pages[path.relative_to(ROOT).as_posix()] = page

findings = []
external = set()
local_references = 0
for name, page in pages.items():
    for element_id, count in collections.Counter(page.ids).items():
        if count > 1:
            findings.append(dict(kind='duplicate_id', page=name, id=element_id, count=count))
    if not page.lang:
        findings.append(dict(kind='missing_language', page=name))
    if not page.title:
        findings.append(dict(kind='missing_title', page=name))
    for target in page.images_without_alt:
        findings.append(dict(kind='image_without_alt', page=name, target=target))
    base = urljoin(f'{ORIGIN}/{name}', page.base or '')
    for reference in page.refs:
        if reference.startswith(('data:', 'javascript:', 'mailto:', 'tel:')):
            continue
        url = urlsplit(urljoin(base, reference))
        # This prefix is a separate repository's Pages deployment.
        if url.netloc != 'arbenl.github.io' or url.path.startswith('/arbenl-mobile-assignments-2026-2027/'):
            if url.scheme in ('http', 'https'):
                external.add(url.geturl())
            continue
        local_references += 1
        target = unquote(url.path).lstrip('/') or 'index.html'
        path = ROOT / target
        if path.is_dir():
            target = target.rstrip('/') + '/index.html'
            path = ROOT / target
        if not path.exists():
            findings.append(dict(kind='missing_target', page=name, target=reference))
        elif url.fragment and target in pages and unquote(url.fragment) not in pages[target].ids:
            findings.append(dict(kind='missing_fragment', page=name, target=reference))

print(json.dumps(dict(
    pages=len(pages), source_fragments=fragments,
    references=sum(len(page.refs) for page in pages.values()),
    local_references=local_references, external_urls=len(external),
    counts=dict(collections.Counter(finding['kind'] for finding in findings)),
    findings=findings,
), ensure_ascii=False))
