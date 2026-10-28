"""Make standalone public course URLs clickable in generated student decks."""
from zipfile import ZipFile, ZIP_DEFLATED
from pathlib import Path
from lxml import etree as E
import re, sys
path = Path(sys.argv[1])
a = 'http://schemas.openxmlformats.org/drawingml/2006/main'
r = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
p = 'http://schemas.openxmlformats.org/package/2006/relationships'
with ZipFile(path) as z:
    files = {name: z.read(name) for name in z.namelist()}
for name, data in list(files.items()):
    if not re.fullmatch(r'ppt/slides/slide\d+\.xml', name):
        continue
    doc = E.fromstring(data)
    relname = name.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels'
    rel = E.fromstring(files[relname]) if relname in files else E.Element('{'+p+'}Relationships', nsmap={None:p})
    changed = False
    for run in doc.findall('.//{'+a+'}r'):
        node = run.find('{'+a+'}t')
        url = node.text if node is not None else ''
        if not re.fullmatch(r'https://arbenl\.github\.io/[^\s]+', url or ''):
            continue
        props = run.find('{'+a+'}rPr')
        if props is None:
            props = E.Element('{'+a+'}rPr'); run.insert(0, props)
        if props.find('{'+a+'}hlinkClick') is not None:
            continue
        ident = 'rIdCourseUrl' + str(len(rel)+1)
        E.SubElement(props, '{'+a+'}hlinkClick', {'{'+r+'}id':ident})
        E.SubElement(rel, '{'+p+'}Relationship', Id=ident, Type=r+'/hyperlink', Target=url, TargetMode='External')
        changed = True
    if changed:
        files[name] = E.tostring(doc, xml_declaration=True, encoding='UTF-8', standalone=True)
        files[relname] = E.tostring(rel, xml_declaration=True, encoding='UTF-8', standalone=True)
with ZipFile(path, 'w', ZIP_DEFLATED) as z:
    for name, data in files.items():
        z.writestr(name, data)
