from zipfile import ZipFile, ZIP_DEFLATED
from lxml import etree as E
from pathlib import Path
import sys
p=Path(sys.argv[1]);q=p.with_suffix('.without-notes.pptx')
with ZipFile(p) as z,ZipFile(q,'w',ZIP_DEFLATED) as out:
 for item in z.infolist():
  if item.filename.startswith(('ppt/notesSlides/','ppt/notesMasters/')):continue
  data=z.read(item.filename)
  if item.filename.endswith('.rels') or item.filename in ('[Content_Types].xml','ppt/presentation.xml'):
   tree=E.fromstring(data)
   for parent in tree.iter():
    for child in list(parent):
     if any('notesSlide' in v or 'notesMaster' in v for v in child.attrib.values()) or child.tag.endswith('notesMasterIdLst'):
      parent.remove(child)
   data=E.tostring(tree,encoding='utf-8',xml_declaration=True)
  out.writestr(item,data)
q.replace(p)
