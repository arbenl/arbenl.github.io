from zipfile import ZipFile, ZIP_DEFLATED
from pathlib import Path
import sys, re
from lxml import etree as E
path=Path(sys.argv[1]); ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
rel_ns='http://schemas.openxmlformats.org/package/2006/relationships'
with ZipFile(path) as z: files={name:z.read(name) for name in z.namelist()}
for name,data in list(files.items()):
 if not re.fullmatch(r'ppt/slides/slide\d+\.xml',name): continue
 doc=E.fromstring(data);found=False
 for run in doc.findall('.//a:r',ns):
  t=run.find('a:t',ns)
  if t is None or not (t.text or '').startswith('Animacioni live:'): continue
  props=run.find('a:rPr',ns)
  if props is None: props=E.Element('{'+ns['a']+'}rPr');run.insert(0,props)
  E.SubElement(props,'{'+ns['a']+'}hlinkClick',{'{'+ns['r']+'}id':'rIdWeek06Animation'});found=True
 if found:
  files[name]=E.tostring(doc,xml_declaration=True,encoding='UTF-8',standalone=True)
  relname=name.replace('ppt/slides/','ppt/slides/_rels/')+'.rels'
  rel=E.fromstring(files[relname]) if relname in files else E.Element('{'+rel_ns+'}Relationships',nsmap={None:rel_ns})
  E.SubElement(rel,'{'+rel_ns+'}Relationship',Id='rIdWeek06Animation',Type=ns['r']+'/hyperlink',Target='https://arbenl.github.io/lendet/2026-2027/mobile/java-06/infrastructure.html',TargetMode='External')
  files[relname]=E.tostring(rel,xml_declaration=True,encoding='UTF-8',standalone=True)
with ZipFile(path,'w',ZIP_DEFLATED) as z:
 for name,data in files.items():z.writestr(name,data)
