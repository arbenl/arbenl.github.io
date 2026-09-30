"""Export the Week 3 HTML lecture as editable, widescreen student slides.
Requires existing Python lxml and Pandoc. No student data or speaker notes.
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from tempfile import TemporaryDirectory
import subprocess
import json
import hashlib
import re
from lxml import etree as E, html

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'lendet/2026-2027/mobile/java-03'
OUT = ROOT / 'lendet/2026-2027/mobile/lectures/ligjerata-03-komponentet-app-router-rideshare-2026-v3.pptx'
DOC = html.fromstring((BASE / 'prezantimi-ligjerates.html').read_text())
SLIDES = DOC.xpath('//section[contains(@class,"step")]')

def text(node):
    return ' '.join(' '.join(node.itertext()).split())

def find(section, cls):
    return section.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," '+cls+' ")]')

def title(s):
    return text(s.xpath('.//h2')[0])

def markdown(node):
    tag = node.tag
    if tag in ('img','h2') or 'eyebrow' in node.get('class','') or (tag=='button' and 'reveal' in node.get('class','')):
        return ''
    if tag == 'pre': return '```tsx\n'+node.text_content().strip()+'\n```'
    if tag == 'a':
        url=node.get('href','')
        if not url.startswith('http'): url='https://arbenl.github.io/lendet/2026-2027/mobile/java-03/'+url
        return '['+text(node)+']('+url+')'
    if tag in ('p','small','button'): return text(node)
    if tag == 'h3': return '**'+text(node)+'**'
    if tag == 'li': return '- '+text(node)
    children=list(node)
    if tag=='div' and not node.xpath('.//p | .//h3 | .//pre | .//li | .//div'):
        return text(node)
    return '\n\n'.join(filter(None,(markdown(c) for c in children)))

md='\n\n'.join('# '+title(s)+'\n\n'+markdown(s) for s in SLIDES)+'\n'
(ROOT/'materials/week-03/ligjerata-03.md').write_text(md)

NS={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
REL='http://schemas.openxmlformats.org/package/2006/relationships'
CT='http://schemas.openxmlformats.org/package/2006/content-types'
INK='F4F7FF'; MINT='83EFD9'; CORAL='FFA58E'; MUTED='B9C8DB'; BG='101D30'; PANEL='172C42'

def el(parent,tag,**attrs): return E.SubElement(parent,'{'+NS[tag.split(':')[0]]+'}'+tag.split(':')[1],{k:str(v) for k,v in attrs.items()})
def xml(node): return E.tostring(node,xml_declaration=True,encoding='UTF-8',standalone=True)
def fill(parent,color): el(el(parent,'a:solidFill'),'a:srgbClr',val=color)
def inch(x): return round(x*914400)

class Canvas:
    def __init__(self):
        self.root=E.Element('{'+NS['p']+'}sld',nsmap=NS)
        cs=el(self.root,'p:cSld'); bg=el(cs,'p:bg'); bp=el(bg,'p:bgPr'); fill(bp,BG); el(bp,'a:effectLst')
        self.tree=el(cs,'p:spTree'); ng=el(self.tree,'p:nvGrpSpPr'); el(ng,'p:cNvPr',id=1,name=''); el(ng,'p:cNvGrpSpPr'); el(ng,'p:nvPr')
        gp=el(self.tree,'p:grpSpPr'); xf=el(gp,'a:xfrm')
        for tag,attrs in [('off',{'x':0,'y':0}),('ext',{'cx':0,'cy':0}),('chOff',{'x':0,'y':0}),('chExt',{'cx':0,'cy':0})]:el(xf,'a:'+tag,**attrs)
        self.id=1; self.links=[]
    def shape(self,x,y,w,h,color=None):
        assert w > 0 and h > 0, 'Shape dimensions must be positive'
        assert x >= 0 and y >= 0 and x+w <= 13.334 and y+h <= 7.501, 'Shape outside slide'
        self.id+=1; sp=el(self.tree,'p:sp'); nv=el(sp,'p:nvSpPr'); el(nv,'p:cNvPr',id=self.id,name='Editable shape '+str(self.id)); el(nv,'p:cNvSpPr',txBox=1); el(nv,'p:nvPr')
        pr=el(sp,'p:spPr'); xf=el(pr,'a:xfrm'); el(xf,'a:off',x=inch(x),y=inch(y)); el(xf,'a:ext',cx=inch(w),cy=inch(h))
        geo=el(pr,'a:prstGeom',prst='rect'); el(geo,'a:avLst')
        fill(pr,color) if color else el(pr,'a:noFill')
        el(el(pr,'a:ln'),'a:noFill'); return sp
    def box(self,x,y,w,h,copy,size=22,color=INK,bold=False,bg=None,font='Arial',link=None):
        sp=self.shape(x,y,w,h,bg); tb=el(sp,'p:txBody'); el(tb,'a:bodyPr',wrap='square',lIns=0,tIns=0,rIns=0,bIns=0); el(tb,'a:lstStyle')
        lines=copy.split('\n') if isinstance(copy,str) else copy
        for line in lines:
            p=el(tb,'a:p'); pp=el(p,'a:pPr',marL=0,indent=0); el(pp,'a:buNone'); ls=el(pp,'a:lnSpc');el(ls,'a:spcPct',val=115000)
            sa=el(pp,'a:spcAft');el(sa,'a:spcPts',val=600)
            r=el(p,'a:r'); rp=el(r,'a:rPr',lang='sq-AL',sz=round(size*100),b=int(bold)); fill(rp,color);el(rp,'a:latin',typeface=font)
            if link:
                rid='rIdLink'+str(len(self.links)+1); self.links.append((rid,link));el(rp,'a:hlinkClick',**{'{'+NS['r']+'}id':rid})
            el(r,'a:t').text=line
        return sp
    def panel(self,x,y,w,h,heading,copy,size=21):
        self.shape(x,y,w,h,PANEL)
        if h < 1.5:
            self.box(x+.22,y+.1,w-.44,.38,heading,21,MINT,True)
            self.box(x+.22,y+.6,w-.44,.4,copy,19)
        else:
            self.box(x+.22,y+.18,w-.44,.65,heading,24,MINT,True)
            self.box(x+.22,y+.95,w-.44,h-1.1,copy,size)
    def picture(self,x,y,w,h,rid):
        self.id+=1; p=el(self.tree,'p:pic'); nv=el(p,'p:nvPicPr'); el(nv,'p:cNvPr',id=self.id,name='Lecture illustration' if rid=='rIdArt' else 'Kolegji AAB'); el(nv,'p:cNvPicPr');el(nv,'p:nvPr')
        bf=el(p,'p:blipFill');el(bf,'a:blip',**{'{'+NS['r']+'}embed':rid});el(el(bf,'a:stretch'),'a:fillRect')
        pr=el(p,'p:spPr');xf=el(pr,'a:xfrm');el(xf,'a:off',x=inch(x),y=inch(y));el(xf,'a:ext',cx=inch(w),cy=inch(h));el(el(pr,'a:prstGeom',prst='rect'),'a:avLst')
    def footer(self,copy,size=18):
        self.shape(.6,6.3,12.13,.85,PANEL);self.box(.8,6.43,11.73,.58,copy,size)

with TemporaryDirectory() as temp:
    draft=Path(temp)/'draft.pptx'
    subprocess.run(['pandoc',str(ROOT/'materials/week-03/ligjerata-03.md'),'-f','markdown','-t','pptx','--slide-level=1','-o',str(draft)],check=True)
    with ZipFile(draft) as z: files={n:z.read(n) for n in z.namelist()}
    names=[n for n in files if re.fullmatch(r'ppt/slides/slide\d+\.xml',n)]
    assert len(names)==18, 'Unexpected slide pagination'
    for i,s in enumerate(SLIDES,1):
        c=Canvas(); name='ppt/slides/slide'+str(i)+'.xml'
        eyebrow=text(find(s,'eyebrow')[0]).split(f'{i:02} /')[0].strip()
        if i==1:
            c.picture(0,0,13.333,7.5,'rIdArt');c.shape(0,0,6.8,7.5,'091525');c.picture(.65,.65,2.3,.455,'rIdLogo')
            c.box(.65,1.5,6,2,'07:42.\nArta ka një problem.',42,bold=True)
            c.box(.65,3.8,5.7,1.6,'Duhet të shkojë në AAB.\nKa telefon. Ka pak kohë.\nNuk e di cilin udhëtim të zgjedhë.',25)
            c.box(.65,5.8,5.7,1,'Sot, një skicë bëhet një rrugë që mund ta ndjekë.',23,MINT)
            c.box(.65,7.05,8,.3,'JAVA 3 · 01.10.2026 · KOMPONENTËT DHE APP ROUTER',11,MUTED)
        else:
            c.box(.6,.35,10,.35,eyebrow,11,MINT,True);c.picture(10.7,.25,1.9,.376,'rIdLogo');c.box(.6,.92,12.1,1.25,title(s),34,bold=True)
            c.box(12.2,7.25,.7,.2,f'{i:02} / 18',10,MUTED)
        if i==2:
            for j,p in enumerate(find(s,'chat')[0].xpath('./p')):c.panel(.6,2.25+j*1.12,5.7,1.02,text(p).split('07:')[0].strip(),text(p.xpath('./strong')[0]),20)
            c.box(6.9,2.3,5.8,1.5,text(find(s,'lead')[0]),29,bold=True)
            c.box(6.9,4,5.8,1.5,'Aplikacioni lidh orën, vendtakimin dhe vendet e lira në një rrjedhë të qartë.',24)
            c.footer(text(find(s,'audience-cue')[0]).replace('✋ ',''),21)
        elif i==3:
            for j,v in enumerate(find(s,'choices')[0].xpath('./div')): c.panel(.6+j*6.2,2.3,5.9,3.2,('A · ' if j==0 else 'B · ')+text(v.xpath('./h3')[0]),text(v.xpath('./p')[0]),24)
            c.footer(text(find(s,'answer')[0]),21)
        elif i==4:
            c.panel(.6,2.3,5.9,3.65,'JAVA 2 · SKICA','Lista → Detajet → Kërkesa\nPRD (Product Requirements Document – dokumenti i kërkesave të produktit) përcakton sjelljen.',23)
            c.panel(6.8,2.3,5.9,3.65,'JAVA 3 · APLIKACIONI','Një prekje hap udhëtimin e duhur.\nTri faqe, një model karte dhe përgjigje kur diçka mungon.',25)
            c.footer(text(find(s,'takeaway')[0]),19)
        elif i==5:
            for j,li in enumerate(find(s,'route-flow')[0].xpath('./li')):
                c.panel(.6+j*4.15,2.3,3.8,3.7,str(j+1)+' · '+text(li.xpath('./strong')[0]),[text(li.xpath('./code')[0]),text(li.xpath('./span')[1]),text(li.xpath('./small')[0])],21)
                if j<2:c.box(4.42+j*4.15,3.5,.3,.5,'→',25,MINT)
            c.footer(text(find(s,'takeaway')[0]),20)
        elif i==6:
            for j,v in enumerate(find(s,'mini-trip')): c.panel(.6,2.2+j*1.26,5.5,1.1,text(v.xpath('./strong')[0]),text(v.xpath('./span')[0])+' · ID '+str(j+1),20)
            c.box(6.7,2.25,6,3.65,'Faqja është ekrani.\nKa adresën e vet dhe vendos cilat pjesë shfaqen.\nKomponenti është modeli.\nKartaUdhetimi përdoret tri herë, me të dhëna të ndryshme.',24)
            c.footer(text(find(s,'takeaway')[0]),20)
        elif i==7:
            c.box(.6,2.3,7,3,s.xpath('.//pre')[0].text_content(),19,MINT,bg='091525',font='Courier New')
            c.panel(8,2.3,4.7,3,'OBJEKTI ME ID 2','08:15 te karta.\n08:15 te detajet.\nDy pamje lexojnë të njëjtin burim.',24)
            c.box(.6,5.55,12,.5,text(find(s,'code-caption')[0]),18,MUTED)
            c.footer(text(find(s,'takeaway')[0]),20)
        elif i==8:
            c.box(.6,2.25,12,.6,'Karta 2 → “Shiko detajet” → /udhetimi/2',28,MINT,True)
            c.box(.6,3.1,12,1.6,s.xpath('.//pre')[0].text_content(),24,MINT,bg='091525',font='Courier New')
            c.box(.6,5.05,12,.9,[text(n) for n in find(s,'line-explain')[0]],22)
            c.footer(text(find(s,'takeaway')[0]),19)
        elif i==9:
            for j,v in enumerate(find(s,'route-map')[0]):c.box(.6,2.3+j*.88,12,.75,text(v),20,MINT,bg='091525',font='Courier New')
            c.box(.6,5.15,12,.95,'[id] ndryshon: 1, 2, 3… App Router i Next.js lidh dosjet me adresat. I njëjti skedar hap udhëtimin e kërkuar.',23)
            c.footer(text(find(s,'takeaway')[0]),20)
        elif i==10:
            c.box(.6,2.15,12,.6,'/udhetimi/2 → id = "2" → Objekti me ID 2',27,MINT,True)
            for j,v in enumerate(find(s,'explained-code')[0]):
                c.box(.6,3+j*1.5,12,.45,text(v.xpath('./code')[0]),20,MINT,font='Courier New')
                c.box(.6,3.55+j*1.5,12,.65,text(v.xpath('./p')[0]),22)
            c.footer(text(find(s,'takeaway')[0]),20)
        elif i==11:
            for j,v in enumerate(find(s,'decision-branches')[0]):c.panel(.6+j*6.2,2.3,5.9,2.3,text(v.xpath('./strong')[0]),text(v.xpath('./span')[0]),24)
            c.box(.6,4.95,12,.5,'if (!udhetim) notFound();',25,MINT,font='Courier New')
            c.footer(text(find(s,'answer')[0].xpath('./p')[0]),20)
        elif i==12:
            c.panel(.6,2.3,4.9,3.6,'ID 3 · LIPJAN → AAB','07:45 · 0 vende\n“Nuk ka vende të lira”\nButoni është i çaktivizuar. Detajet mund të lexohen.',24)
            c.box(6.3,2.3,6.3,2.3,'Nëse nuk ka vend, nuk ofrojmë “Kërko vend”.\nButoni dhe shpjegimi tregojnë pse veprimi nuk mund të kryhet.',26)
            c.box(6.3,4.9,6.3,1,text(find(s,'audience-cue')[0]),22,CORAL)
            c.footer(text(find(s,'takeaway')[0]),21)
        elif i==13:
            for j,v in enumerate(find(s,'choices')[0]):c.panel(.6+j*6.2,2.3,5.9,3.65,text(v.xpath('./span')[0]),text(v.xpath('./h3')[0])+'\n'+text(v.xpath('./p')[0]),25)
            c.footer(text(find(s,'takeaway')[0]),21)
        elif i==14:
            c.box(.6,2.15,12,.6,text(find(s,'lead')[0]),24)
            for j,p in enumerate(find(s,'address-options')[0]):c.box(.6,3+j*.8,12,.65,text(p),27,MINT,bg=PANEL,font='Courier New')
            c.box(.6,5.6,12,.5,'Cila adresë e ruan zgjedhjen? Shpjegoja personit pranë teje.',21,CORAL)
            c.footer(text(find(s,'answer')[0]),21)
        elif i==15:
            for j,v in enumerate(find(s,'demo-stops')[0]):c.panel(.6+j*3.1,2.3,2.85,2.8,text(v.xpath('./h3')[0]),text(v.xpath('./p')[0]),21)
            c.box(.6,5.4,12,.5,'Para çdo klikimi: çfarë prisni të ndodhë dhe pse?',24,CORAL)
            c.box(.6,6.05,12,.45,'Hap demonstrimin e Javës 3 →',23,MINT,True,link='https://arbenl.github.io/lendet/2026-2027/mobile/java-03/demo/')
            c.box(.6,6.65,12,.55,text(find(s,'code-caption')[0]),18,MUTED)
        elif i==16:
            c.panel(.6,2.3,4.5,3.9,'FUSHË KOSOVË → AAB','08:15 · 1 vend\nTe stacioni kryesor\nKërko vend →\n← Kthehu te lista',25)
            c.box(5.8,2.3,6.9,3.9,[text(p) for p in find(s,'checks')[0].xpath('./p')],23)
        elif i==17:
            headings=['3 faqe','1 komponent','3 prova']
            for j,v in enumerate(find(s,'deliverables')[0]):c.panel(.6+j*4.15,2.25,3.8,2.1,headings[j],text(v.xpath('./small')[0]),20)
            c.box(.6,4.7,12,1.05,'Plotësoni java-03.md, dorëzoni në GitHub dhe lexoni raportin. Mbajmë kohë për korrigjime deri në fund të orës.',24)
            c.footer(text(find(s,'takeaway')[0]),20)
        elif i==18:
            c.box(.6,2.35,12,.55,text(find(s,'closing-line')[0]),27,MINT,True)
            c.box(.6,3.25,12,1,text(s.xpath('./h3')[0]),29,bold=True)
            c.box(.6,4.65,12,.7,text(find(s,'lead')[0]),26)
            c.box(.6,5.5,12,.6,'Çfarë i jep kuptim numrit 2 në adresë?',24,CORAL)
            c.footer(text(find(s,'takeaway')[0]),20)
        files[name]=xml(c.root)
        rels=E.Element('{'+REL+'}Relationships',nsmap={None:REL})
        E.SubElement(rels,'{'+REL+'}Relationship',Id='rId1',Type=NS['r']+'/slideLayout',Target='../slideLayouts/slideLayout7.xml')
        E.SubElement(rels,'{'+REL+'}Relationship',Id='rIdLogo',Type=NS['r']+'/image',Target='../media/week03-logo.png')
        if i==1:E.SubElement(rels,'{'+REL+'}Relationship',Id='rIdArt',Type=NS['r']+'/image',Target='../media/week03-arta.jpg')
        for rid,url in c.links:E.SubElement(rels,'{'+REL+'}Relationship',Id=rid,Type=NS['r']+'/hyperlink',Target=url,TargetMode='External')
        files['ppt/slides/_rels/slide'+str(i)+'.xml.rels']=xml(rels)
    p=E.fromstring(files['ppt/presentation.xml']);sz=p.find('p:sldSz',NS);sz.set('cx',str(inch(13.333333)));sz.set('cy',str(inch(7.5)));sz.set('type','screen16x9');files['ppt/presentation.xml']=xml(p)
    ct=E.fromstring(files['[Content_Types].xml'])
    for ext,mime in [('jpg','image/jpeg'),('png','image/png')]:
        if not ct.xpath('./*[local-name()="Default" and @Extension="'+ext+'"]'):E.SubElement(ct,'{'+CT+'}Default',Extension=ext,ContentType=mime)
    files['[Content_Types].xml']=xml(ct)
    files['ppt/media/week03-logo.png']=(ROOT/'img/aab_logo_white.png').read_bytes()
    files['ppt/media/week03-arta.jpg']=(BASE/'story/arta-mengjes.jpg').read_bytes()
    assert not any('/notesSlides/' in n or '/notesMasters/' in n for n in files)
    with ZipFile(OUT,'w',ZIP_DEFLATED) as z:
        for n,b in files.items():z.writestr(n,b)
manifest_path=ROOT/'materials/manifest.json';manifest=json.loads(manifest_path.read_text())
manifest['lecture3'].update(file=str(OUT.relative_to(ROOT)),slides=18,updated='2026-09-30',sha256=hashlib.sha256(OUT.read_bytes()).hexdigest())
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Exported 18 editable slides:',OUT)
