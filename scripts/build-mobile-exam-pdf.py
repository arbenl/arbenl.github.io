"""Build the Mobile 2025/2026 study PDF with ReportLab (bundled Python runtime)."""
from pathlib import Path
import re
import math
from html import unescape, escape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'lendet/2025-2026/mobile/materiale/material-pergatitor-provim-mobile-2025-2026.pdf'
SOURCE = (ROOT / 'materials/archive/mobile-exam-guide.html').read_text()
FONT_DIR = Path('/System/Library/Fonts/Supplemental')
for name, file in [('Arial', 'Arial.ttf'), ('Arial-Bold', 'Arial Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / file)))
W, H = A4
NAVY, BLUE, CYAN = '#101b31', '#2563eb', '#0891b2'
GREEN, ORANGE, PURPLE = '#059669', '#b45309', '#7c3aed'
M = 34
WIDTH = W - 2*M

def plain(s):
    return unescape(re.sub('<[^>]+>', '', s)).strip()

qa = [(plain(q), plain(a)) for q, a in re.findall(
    r'<article><h3>(\d+\. .*?)</h3><details><summary>.*?</summary><p>(.*?)</p>', SOURCE)]
assert len(qa) == 12

# Title, subtitle, idea, concepts, application, example, diagram labels, edge labels.
LESSONS = [
('Arkitektura mobile dhe Supabase', 'Nga veprimi në telefon te të dhënat',
 'Një aplikacion mobile ndan ndërfaqen, logjikën dhe shërbimet cloud; çdo shtresë ka përgjegjësi të qarta.',
 ['UI-ja merr input dhe shfaq rezultatin; state-i përshkruan gjendjen e ekranit.', 'API/SDK lidh klientin me backend-in përmes kërkesave të autorizuara.', 'Supabase ofron Auth, PostgreSQL Database, Storage dhe Realtime.', 'Kredencialet e privilegjuara dhe sekretet qëndrojnë në server.'],
 ['Shpjego cilët komponentë ekzekutohen në telefon dhe cilët në cloud.', 'Kërkesa kthen rezultat ose gabim; UI-ja përditësohet sipas tij.', 'Zgjedhja e Flutter, React Native, Compose ose PWA nuk e ndryshon nevojën për kontroll të qasjes.'],
 'Studenti shton një shënim: formulari validohet, API-ja kontrollon qasjen dhe databaza ruan shënimin me pronarin.',
 ['Telefoni\nUI dhe state', 'API / SDK\nKërkesa', 'Supabase\nAuth dhe RLS', 'Database\nTë dhënat'], ['input', 'sesioni', 'ruajtja']),
('Authentication dhe authorization', 'Identiteti dhe veprimet e lejuara',
 'Login-i identifikon përdoruesin; kontrolli i qasjes përcakton cilat të dhëna dhe veprime i lejohen.',
 ['Authentication vërteton identitetin, p.sh. përmes emailit dhe fjalëkalimit.', 'Sesioni dhe token-i lidhin kërkesat me përdoruesin e autentifikuar.', 'Authorization kontrollon të drejtat për çdo veprim.', 'Logout-i mbyll sesionin; gabimet e login-it duhen trajtuar qartë.'],
 ['Një përdorues i kyçur nuk ka automatikisht qasje në të dhënat e të tjerëve.', 'Kontrolli i qasjes kryhet në backend/databazë, jo vetëm në ekran.', 'Mos ruaj fjalëkalime ose token-e në log-e dhe skedarë publikë.'],
 'Dy studentë kyçen në të njëjtin aplikacion. Secili mund të lexojë dhe ndryshojë vetëm shënimet e veta.',
 ['Login\nIdentiteti', 'Sesioni\nToken-i', 'Kërkesa\nKontrolli', 'Lejo / refuzo\nRezultati'], ['vërteto', 'dërgo', 'autorizo']),
('RLS dhe pronësia e të dhënave', 'Siguri në nivel rreshti',
 'RLS zbaton rregulla në databazë për të kufizuar rreshtat që një përdorues mund të lexojë ose ndryshojë.',
 ['RLS do të thotë Row Level Security.', 'Lejet e tabelës përcaktojnë operacionet; politikat RLS përcaktojnë rreshtat.', 'SELECT, INSERT, UPDATE dhe DELETE kërkojnë rregulla sipas nevojës.', 'Një fushë owner_id lidh rreshtin me pronarin e autentifikuar.'],
 ['Fshehja e butonit ose filtrimi në UI nuk ndal thirrjet direkte të API-së.', 'Politikat duhen provuar edhe me një përdorues tjetër dhe pa login.', 'Çelësat secret/service_role kanë privilegje të larta dhe mbahen vetëm në server.'],
 'A krijon një shënim. B provon ta lexojë dhe ndryshojë me ID-në e tij; databaza duhet ta refuzojë qasjen.',
 ['Përdoruesi B\nKërkesa', 'API\nIdentiteti', 'Politika RLS\nPronari?', 'Refuzim\nRreshti i A-së'], ['token', 'verifiko', 'pa qasje']),
('CRUD dhe modeli i të dhënave', 'Krijim lexim ndryshim fshirje',
 'CRUD përmbledh operacionet bazë të një aplikacioni që menaxhon të dhëna.',
 ['Create shton të dhëna; Read lexon listën ose detajet.', 'Update ndryshon një rresht; Delete e fshin.', 'Primary key identifikon rreshtin; foreign key lidh tabela.', 'Validimi dhe kufizimet e databazës mbrojnë integritetin e të dhënave.'],
 ['Kontrollo input-in dhe të drejtat para ndryshimit.', 'Përditëso UI-në vetëm sipas rezultatit real të operacionit.', 'Një ID e saktë nuk është provë se përdoruesi ka leje për atë rresht.'],
 'Në notes ruhen id, owner_id, title dhe body. Studenti krijon, lexon, ndryshon dhe fshin shënimin e vet.',
 ['Formulari\nInput-i', 'Validimi\nKufizimet', 'CRUD\nOperacioni', 'Lista\nGjendja e re'], ['kontrollo', 'autorizo', 'rifresko']),
('Storage dhe upload media', 'Skedari dhe metadata',
 'Media ruhet në Storage, ndërsa metadata dhe lidhja me pronarin ruhen në databazë.',
 ['Bucket-i organizon skedarët dhe rregullat e qasjes.', 'Kontrollo madhësinë dhe formatin para dhe gjatë përpunimit.', 'Databaza ruan path-in, pronarin dhe të dhënat përshkruese.', 'Media private kërkon qasje të autorizuar ose lidhje me afat.'],
 ['Trajto gabimin e upload-it dhe të ruajtjes së metadata-s veçmas.', 'Nëse një hap dështon, planifiko pastrim ose riprovim.', 'Mos supozo se suksesi i upload-it garanton sukses të të gjithë operacionit.'],
 'Aplikacioni ngarkon fotografinë në Storage dhe ruan path-in te profili. Nëse databaza dështon, skedari pastrohet ose riprovohet lidhja.',
 ['Fotografia\nZgjedhja', 'Validimi\nMadhësi / tip', 'Storage\nSkedari', 'Database\nMetadata'], ['kontrollo', 'upload', 'path']),
('State management dhe UI UX', 'Një ekran që shpjegon gjendjen',
 'Ndërfaqja duhet ta pasqyrojë gjendjen e aplikacionit në mënyrë të kuptueshme, edhe kur kërkesa dështon.',
 ['State-i përfshin përdoruesin, input-in, të dhënat dhe statusin e kërkesës.', 'Loading tregon kërkesën në proces; empty tregon mungesë rezultatesh.', 'Success shfaq të dhënat; error shfaq gabimin dhe rrugën për riprovim.', 'UI/UX lidhet me ndërfaqen dhe përvojën e përdoruesit.'],
 ['Gabimi nuk duhet të paraqitet si një listë bosh.', 'Ruaj input-in e formularit kur kërkesa dështon.', 'Përdor etiketa të qarta, kontrast të lexueshëm dhe butona për ekran të vogël.'],
 'Lista e shënimeve shfaq tregues loading. Nëse nuk ka shënime, ofron krijimin e të parit; nëse rrjeti dështon, ofron riprovim.',
 ['Loading\nNë proces', 'Success\nTë dhënat', 'Empty\nPa rezultate', 'Error\nRiprovo'], ['gjendje', 'alternative', 'alternative']),
('Realtime push dhe Maps', 'Integrime me sjellje të ndryshme',
 'Realtime, push notifications dhe Maps zgjidhin nevoja të ndryshme dhe kërkojnë trajtim të lidhjes dhe lejeve.',
 ['Realtime përditëson klientin përmes një lidhjeje aktive.', 'Push notifications përdorin shërbimin e platformës për njoftime.', 'Maps shfaq hartën; vendndodhja kërkon leje të përdoruesit.', 'Moduli unik duhet të ketë një qëllim të qartë, p.sh. chat, rating ose maps.'],
 ['Trajto refuzimin e lejes për vendndodhje.', 'Rilidhja e Realtime nuk garanton se klienti ka marrë çdo ndryshim.', 'Push mund të njoftojë kur aplikacioni nuk është aktiv; nuk zëvendëson ruajtjen e të dhënave.'],
 'Një chat përdor Realtime për mesazhet gjatë përdorimit dhe push për njoftim jashtë aplikacionit. Mesazhet mbeten në databazë.',
 ['Database\nMesazhi', 'Realtime\nKlienti aktiv', 'Push\nNjoftimi', 'Telefoni\nPërdoruesi'], ['live', 'rrugë tjetër', 'platforma']),
('REST API dhe Edge Functions', 'Logjika dhe sekretet në server',
 'Edge Functions mund të përpunojnë kërkesa në server kur veprimi kërkon sekrete ose kontroll të besueshëm.',
 ['API përcakton si komunikojnë komponentët; SDK lehtëson përdorimin e saj.', 'Në REST, GET lexon, POST krijon, PATCH ndryshon dhe DELETE fshin.', 'Edge Function duhet të kontrollojë identitetin, lejet dhe input-in.', 'Sekretet e integrimeve të jashtme ruhen në server.'],
 ['Mos i vendos çelësat secret/service_role në klient ose repository publik.', 'Backend-i nuk duhet t’i besojë identitetit të dërguar thjesht në body.', 'Trajto timeout-in dhe përgjigjet e gabimit nga shërbimi i jashtëm.'],
 'Telefoni kërkon një shërbim të jashtëm përmes Edge Function. Funksioni autorizon kërkesën dhe përdor sekretin e ruajtur në server.',
 ['Telefoni\nKërkesa', 'Edge Function\nKontrolli', 'Shërbimi\nSekreti', 'UI\nRezultati'], ['HTTPS', 'server', 'përgjigjja']),
('Rrjeti gabimet dhe riprovimi', 'Sjellje e besueshme në telefon',
 'Aplikacioni duhet të ruajë punën e përdoruesit dhe të tregojë saktë çfarë ndodhi kur lidhja ndërpritet.',
 ['Timeout-i dhe humbja e rrjetit nuk janë provë e suksesit ose dështimit të ruajtjes.', 'Ruaj input-in dhe shfaq mesazh me mundësi riprovimi.', 'Cache-i lokal mund të ndihmojë leximin, por mund të jetë i vjetruar.', 'Riprovimet e shkrimeve duhet të shmangin dublikatat.'],
 ['Mos shfaq sukses pa konfirmim nga operacioni.', 'Në një projekt offline, dallo gjendjen lokale nga ajo e sinkronizuar.', 'Shpjego si trajtohen konfliktet dhe kërkesat e përsëritura sipas projektit.'],
 'Studenti dërgon një shënim dhe rrjeti ndërpritet. Aplikacioni ruan formularin dhe kontrollon nëse shënimi është krijuar para riprovimit.',
 ['Formulari\nInput-i', 'Kërkesa\nRrjeti', 'Gabimi\nRuaj input', 'Riprovimi\nPa dublikata'], ['dërgo', 'ndërpritet', 'kontrollo']),
('AI debugging dhe optimizimi', 'Sugjerim verifikim dhe provë',
 'AI-ja mund të ndihmojë zhvillimin, por studenti mbetet përgjegjës për kuptimin dhe verifikimin e kodit.',
 ['Prompt-i përmban kontekst, qëllim, kufizime dhe sjelljen e pritur.', 'Rasti minimal dhe log-et ndihmojnë riprodhimin e gabimit.', 'Kontrollo sugjerimin kundrejt kodit dhe dokumentacionit.', 'Mat vonesën, kërkesat dhe madhësinë e të dhënave para optimizimit.'],
 ['Mos dërgo sekrete ose të dhëna reale private te mjetet AI.', 'AI-log shënon ndihmën, ndryshimin dhe provën e kryer.', 'Një ndryshim që duket i saktë duhet provuar në rrjedhën normale dhe në rastin e gabimit.'],
 'AI sugjeron korrigjimin e një kërkese CRUD. Studenti riprodhon gabimin, kontrollon lejet dhe teston korrigjimin me dy përdorues.',
 ['Gabimi\nRiprodhimi', 'AI\nSugjerimi', 'Studenti\nShqyrtimi', 'Testi\nVerifikimi'], ['kontekst', 'kontrollo', 'provo']),
('Testimi siguria dhe stabiliteti', 'Prova që aplikacioni punon',
 'Testimi duhet të mbulojë sjelljen e pritshme dhe veprimet që aplikacioni duhet t’i refuzojë.',
 ['Testo login/logout, CRUD dhe modulin unik.', 'Provo input bosh, input të gabuar dhe rrjet të ndërprerë.', 'Përdor dy llogari për të kontrolluar ndarjen e të dhënave.', 'Kontrollo Storage-in, konfigurimin dhe funksionimin në telefon.'],
 ['Një demo që punon vetëm me llogarinë e profesorit nuk mjafton si provë e lejeve.', 'Krahaso sjelljen e pritur me rezultatin real dhe dokumento mospërputhjet.', 'Pas korrigjimit provo rastin fillestar dhe rrjedhat që preken prej tij.'],
 'Përdoruesi B kërkon shënimin e A-së: qasja refuzohet. A vazhdon ta lexojë dhe ndryshojë të njëjtin shënim.',
 ['Rasti\nSjellja e pritur', 'Veprimi\nEkzekutimi', 'Rezultati\nKrahasimi', 'Prova\nDokumentimi'], ['përgatit', 'provo', 'shëno']),
('Deployment dokumentimi dhe demo', 'Një projekt që mund të riprodhohet',
 'Projekti final duhet të funksionojë, të dokumentohet dhe të shpjegohet nga studenti që e dorëzon.',
 ['Deployment publikon versionin e aplikacionit në mjedisin e zgjedhur.', 'README përmban setup, konfigurim dhe udhëzime nisjeje.', 'Repository dhe demo ofrojnë evidencë të funksionimit.', 'AI-log dhe burimet bëjnë të qartë ndihmën e përdorur.'],
 ['Demonstro problemin, arkitekturën, Auth, CRUD dhe modulin unik.', 'Shpjego një vendim teknik, një gabim dhe si e verifikove zgjidhjen.', 'Deklaro kufizimet dhe kontrollo versionin e publikuar në telefon.'],
 'Një koleg ndjek README-n dhe e nis aplikacionin me konfigurimin e vet, pa sekrete të autorit në repository.',
 ['Repository\nKodi', 'README\nSetup-i', 'Deployment\nVersioni', 'Demo\nShpjegimi'], ['dokumento', 'publiko', 'verifiko']),
]

OUT.parent.mkdir(parents=True, exist_ok=True)
c = canvas.Canvas(str(OUT), pagesize=A4)
c.setTitle('Material përgatitor për provim në Programimin për Pajisje Mobile 2025/2026')
c.setAuthor('Arben Lila')
c.setSubject('12 tema me diagrame, shembuj dhe pyetje ushtruese me përgjigje model')

def para(text, x, top, width, size=10, color=NAVY, bold=False, leading=None):
    p = Paragraph(text, ParagraphStyle('body', fontName='Arial-Bold' if bold else 'Arial', fontSize=size,
                  leading=leading or size*1.28, textColor=HexColor(color), spaceAfter=0))
    _, height = p.wrap(width, H)
    p.drawOn(c, x, top-height)
    return height

def rect(x, top, width, height, fill, stroke=None, radius=0):
    c.setFillColor(HexColor(fill)); c.setStrokeColor(HexColor(stroke or fill)); c.setLineWidth(.7)
    if radius: c.roundRect(x, top-height, width, height, radius, stroke=bool(stroke), fill=1)
    else: c.rect(x, top-height, width, height, stroke=bool(stroke), fill=1)

def footer(number):
    para('Programimi për Pajisje Mobile 2025/2026 · Arben Lila · arbenl.github.io', M, 26, WIDTH-55, 7, '#64748b')
    para(f'Faqe {number}', W-M-40, 26, 40, 8)
    c.showPage()

def bullets(items, x, top, width):
    y = top
    for t in items:
        para('•', x, y, 9, 9)
        height = para(escape(t), x+12, y, width-12, 9.3)
        y -= height+5
    return top-y

def icon(x, y, size=30, color=BLUE):
    c.setFillColor(HexColor(color)); c.circle(x+size/2, y+size/2, size/2, stroke=0, fill=1)
    c.setStrokeColor(white); c.setLineWidth(2)
    c.roundRect(x+size*.32,y+size*.17,size*.36,size*.66,2,stroke=1,fill=0)
    c.line(x+size*.43,y+size*.25,x+size*.57,y+size*.25)

def arrow(x1, y, x2, color='#94a3b8'):
    c.setStrokeColor(HexColor(color)); c.setFillColor(HexColor(color)); c.setLineWidth(1.4)
    c.line(x1,y,x2-4,y)
    p=c.beginPath(); p.moveTo(x2,y);p.lineTo(x2-5,y+3);p.lineTo(x2-5,y-3);p.close()
    c.drawPath(p,fill=1,stroke=0)

def diagram(labels, links, top=664):
    rect(M, top, WIDTH, 120, '#f6f8fc')
    x=M+13; gap=28; bw=(WIDTH-26-3*gap)/4
    colors=[BLUE,CYAN,GREEN,PURPLE]
    for i, lab in enumerate(labels):
        bx=x+i*(bw+gap)
        rect(bx,top-17,bw,86,'#ffffff',colors[i],8)
        icon(bx+bw/2-13,top-56,26,colors[i])
        para(escape(lab).replace('\n','<br/>'),bx+5,top-64,bw-10,8.7,bold=True)
        if i<3:
            arrow(bx+bw+1,top-60,bx+bw+gap-1)
            para(escape(links[i]),bx+bw,top-42,gap,5.8,'#64748b')

def connector(x1,y1,x2,y2):
    c.setStrokeColor(HexColor('#94a3b8'));c.setFillColor(HexColor('#94a3b8'));c.setLineWidth(1.3)
    c.line(x1,y1,x2,y2)
    angle=math.atan2(y2-y1,x2-x1)
    p=c.beginPath();p.moveTo(x2,y2)
    for offset in [-.55,.55]: p.lineTo(x2-6*math.cos(angle+offset),y2-6*math.sin(angle+offset))
    p.close();c.drawPath(p,fill=1,stroke=0)

def alternate_diagram(kind,top=664):
    rect(M,top,WIDTH,120,'#f6f8fc')
    if kind=='state':
        x=M+15;right=M+285
        rect(x,top-32,165,55,'#ffffff',BLUE,7)
        para('Loading<br/>Kërkesa në proces',x+12,top-42,141,10,bold=True)
        for i,(title,desc,color) in enumerate([('Success','Ka të dhëna',GREEN),('Empty','Pa rezultate',CYAN),('Error','Dështim dhe riprovim',ORANGE)]):
            y=top-8-i*36
            rect(right,y,WIDTH-300,30,'#ffffff',color,5)
            para(f'<b>{title}</b> · {desc}',right+8,y-8,WIDTH-316,8.5)
            connector(x+165,top-60,right,y-15)
        para('Rezultate alternative',x+12,top-95,210,8,'#64748b')
    else:
        x=M+10;middle=M+185;right=M+385
        rect(x,top-36,120,50,'#ffffff',BLUE,7)
        para('<b>Database</b><br/>Mesazhi i ruajtur',x+9,top-44,102,9.5)
        for i,(title,desc,color) in enumerate([('Realtime','Klienti aktiv',CYAN),('Push','Shërbimi i platformës',GREEN)]):
            y=top-12-i*58
            rect(middle,y,150,40,'#ffffff',color,6)
            para(f'<b>{title}</b><br/>{desc}',middle+9,y-6,132,9)
            connector(x+120,top-61,middle,y-20)
            connector(middle+150,y-20,right,top-61)
        rect(right,top-36,WIDTH-395,50,'#ffffff',PURPLE,7)
        para('<b>Telefoni</b><br/>Përdoruesi',right+8,top-45,WIDTH-411,9)

def box(title, body, top, fill, stroke, title_color, height=None):
    p=Paragraph(escape(body),ParagraphStyle('box',fontName='Arial',fontSize=9.7,leading=12.5,textColor=HexColor(NAVY)))
    _,bh=p.wrap(WIDTH-20,H)
    height=height or bh+37
    rect(M,top,WIDTH,height,fill,stroke)
    para(title,M+10,top-8,WIDTH-20,10,title_color,True)
    p.drawOn(c,M+10,top-26-bh)
    return height

def page_title(title, subtitle=''):
    h=para(title,M,H-32,WIDTH,21,bold=True)
    if subtitle: para(subtitle,M,H-40-h,WIDTH,10,'#64748b')

# Cover, matching the reference's navy background and white author card.
rect(M,H-34,WIDTH,H-72,NAVY)
rect(M+32,H-68,235,27,BLUE,radius=13)
para('MATERIAL PËRGATITOR PËR PROVIM',M+43,H-76,225,10,'#ffffff',True)
for i,col in enumerate([BLUE,CYAN,PURPLE,GREEN]): icon(M+35+i*62,H-225,44,col)
para('PROGRAMIMI PËR',M+32,H-292,WIDTH-64,29,'#ffffff',True)
para('PAJISJE MOBILE',M+32,H-334,WIDTH-64,31,'#67e8f9',True)
para('2025/2026',M+32,H-380,WIDTH-64,27,'#93c5fd',True)
para('Përmbledhje e 12 temave kryesore me diagrame, shembuj praktikë dhe pyetje ushtruese me përgjigje model.',M+32,H-429,WIDTH-64,12,'#cbd5e1')
rect(M+32,265,WIDTH-64,146,'#ffffff',radius=14)
para('Ligjërues',M+49,249,260,9,'#64748b',True)
para('Arben Lila',M+49,232,260,18,bold=True)
para('Lënda',M+49,203,260,9,'#64748b',True)
para('Programimi për Pajisje Mobile',M+49,187,285,11,bold=True)
para('Institucioni',M+49,164,260,9,'#64748b',True)
para('Kolegji AAB',M+49,148,260,12,bold=True)
url='https://arbenl.github.io/lendet/2025-2026/mobile/udhezim-provim.html'
widget=qr.QrCodeWidget(url); bounds=widget.getBounds(); qw=bounds[2]-bounds[0]
d=Drawing(85,85,transform=[85/qw,0,0,85/qw,0,0]);d.add(widget);renderPDF.draw(d,c,W-M-130,157)
para('Hap materialet Mobile',W-M-142,146,110,7,BLUE,True)
c.linkURL(url,(W-M-145,125,W-M-35,250),relative=0)
para('Material për përsëritje dhe përgatitje për provim.<br/>Bazuar në syllabusin 2025/2026 · Publikuar më 05.10.2026',M+32,97,WIDTH-64,9,'#94a3b8')
footer(1)

# Contents.
page_title('Si ta përdorni këtë material')
para('Çdo temë ka një ide kryesore, një diagram, koncepte, shembull praktik, pyetje dhe përgjigje model. Përgjigjuni vetë dhe pastaj krahasojeni arsyetimin tuaj.',M,H-70,WIDTH,10.5)
box('Qëllimi','Të shpjegoni si funksionon aplikacioni juaj, pse e keni zgjedhur një zgjidhje dhe si e keni provuar. Materiali vlen për stack-un që keni përdorur: Flutter, React Native, Kotlin Compose ose PWA.',H-116,'#eff6ff','#93c5fd',BLUE)
para('Harta e 12 temave',M,625,WIDTH,16,bold=True)
cw=(WIDTH-12)/2
for i,lesson in enumerate(LESSONS):
    x=M+(i%2)*(cw+12); top=592-(i//2)*61
    rect(x,top,cw,50,'#f8fafc','#dbe4f0',7);icon(x+9,top-37,26,[BLUE,CYAN,PURPLE,GREEN][i%4])
    para(f'{i+1:02d}',x+45,top-7,cw-54,8,BLUE,True)
    para(escape(lesson[0]),x+45,top-21,cw-54,9.4,bold=True)
for i,(title,text) in enumerate([('1. Lexo konceptin','Lidhe me kodin dhe zgjedhjet e projektit tënd.'),('2. Shiko diagramin','Shpjego rrjedhën pa lexuar përgjigjen.'),('3. Përgjigju vetë','Jep konceptin, shembullin dhe arsyetimin.')]):
    x=M+i*WIDTH/3
    rect(x,207,WIDTH/3,65,['#eff6ff','#f5f3ff','#ecfdf5'][i],'#cbd5e1')
    para(title,x+7,199,WIDTH/3-14,9,[BLUE,PURPLE,GREEN][i],True)
    para(text,x+7,181,WIDTH/3-14,9)
para('Pyetjet janë për ushtrim. Data, kohëzgjatja, forma dhe mjetet e lejuara të provimit komunikohen nga profesori për afatin përkatës.',M,119,WIDTH,9.5,'#64748b')
footer(2)

# One complete lesson per page.
for i,(title,sub,idea,concepts,application,example,labels,links) in enumerate(LESSONS):
    rect(M,H-30,WIDTH,67,'#dbeafe');rect(M,H-30,6,67,BLUE)
    icon(M+17,H-80,35)
    para(f'TEMA {i+1:02d}',M+64,H-41,WIDTH-76,8,BLUE,True)
    para(escape(title),M+64,H-57,WIDTH-76,15,bold=True)
    para(escape(sub),M+64,H-78,WIDTH-76,8.5,'#64748b')
    box('Ideja kryesore',idea,738,'#f8fafc','#cbd5e1',NAVY,height=61)
    if i==5: alternate_diagram('state')
    elif i==6: alternate_diagram('realtime')
    else: diagram(labels,links)
    top=532; column=(WIDTH-12)/2
    # Compute right text size before drawing its background.
    def measure(t,width,size=9.3):
        p=Paragraph(escape(t),ParagraphStyle('m',fontName='Arial',fontSize=size,leading=size*1.28))
        return p.wrap(width,H)[1]
    left_h=sum(measure(t,column-30)+5 for t in concepts)
    app_h=sum(measure(t,column-30)+5 for t in application)
    ex_h=measure(example,column-18)
    panel_h=max(left_h+43,app_h+ex_h+70)
    rect(M,top,column,panel_h,'#ffffff','#dbe4f0')
    rect(M+column+12,top,column,panel_h,'#f8fafc','#dbe4f0')
    para('Konceptet që duhet të dini',M+9,top-8,column-18,10,BLUE,True)
    bullets(concepts,M+9,top-30,column-18)
    rx=M+column+21
    para('Lidhja me aplikacionin mobile',rx,top-8,column-18,10,PURPLE,True)
    used=bullets(application,rx,top-30,column-18)
    ey=top-35-used
    para('Shembull praktik',rx,ey,column-18,10,GREEN,True)
    para(escape(example),rx,ey-18,column-18,9.3)
    q,a=qa[i];q=re.sub(r'^\d+\.\s*','',q)
    qtop=top-panel_h-16
    qh=box('Pyetje ushtruese',q,qtop,'#fff7ed','#fdba74',ORANGE)
    atop=qtop-qh-15
    ah=box('Përgjigjja e modelit',a,atop,'#ecfdf5','#6ee7b7',GREEN)
    assert atop-ah>55,(title,atop-ah)
    footer(i+3)

# Integrating diagram and practical exercise.
page_title('Nga telefoni te projekti i plotë','Një rrjedhë që bashkon ndërfaqen, identitetin, të dhënat dhe provat')
diagram(['Telefoni\nUI dhe state','API / SDK\nSesioni','Supabase\nAuth dhe RLS','Database\nStorage'],['kërkesa','autorizimi','ruajtja'],top=740)
box('Modeli mendor','Klienti merr input dhe shfaq gjendjen. Auth identifikon përdoruesin, API-ja bart kërkesën dhe lejet me RLS mbrojnë të dhënat. Edge Functions kryejnë logjikë serveri kur nevojitet; Realtime dhe push plotësojnë komunikimin sipas rastit.',600,'#eff6ff','#93c5fd',BLUE)
para('Ushtrim praktik për vetëkontroll',M,481,WIDTH,16,bold=True)
para('Përdorni modulin tuaj të shënimeve me fusha id, owner_id, title, body dhe created_at. Demonstrojeni në telefon.',M,450,WIDTH,10)
bullets(['A krijon një shënim dhe lexon listën e vet.', 'B nuk mund ta lexojë, ndryshojë ose fshijë shënimin e A-së, edhe përmes API-së.', 'Titulli bosh refuzohet me mesazh të qartë.', 'Rrjeti i ndërprerë nuk prodhon mesazh të rremë suksesi ose shënime të dyfishta.', 'Pas rihapjes, të dhënat e ruajtura mbeten dhe aplikacioni tregon gjendjen e saktë.'],M,402,WIDTH)
box('Përgatitja e demonstrimit','Shpjegoni problemin, stack-un, arkitekturën, Auth, CRUD dhe modulin unik. Paraqitni një vendim teknik, një gabim të zgjidhur dhe provën që e verifikoi. README-ja duhet të lejojë nisjen e projektit; AI-log duhet të bëjë të qartë ndihmën e përdorur.',232,'#ecfdf5','#6ee7b7',GREEN)
para('Ky ushtrim është për përgatitje dhe nuk shton një detyrë të re me pikë.',M,103,WIDTH,9,'#64748b')
footer(15)

# Comparisons.
page_title('Tabela e krahasimeve kryesore','Dallime që duhet t’i shpjegoni me shembuj nga projekti')
rows=[('Authentication / Authorization','Identiteti / të drejtat','Login-i identifikon; lejet vendosin çfarë mund të bësh.'),('UI / State','Pamja / gjendja','Ekrani pasqyron input-in, të dhënat dhe statusin e kërkesës.'),('Filtër në UI / RLS','Paraqitje / kontroll në databazë','RLS mbron rreshtat edhe ndaj kërkesave jashtë UI-së.'),('Database / Storage','Rreshta / skedarë','Të dhënat dhe metadata / fotografi e dokumente.'),('Realtime / Push','Lidhje aktive / njoftim platforme','Përditësim gjatë përdorimit / njoftim jashtë aplikacionit.'),('Klient / Edge Function','Telefoni / serveri','UI dhe reagimi / logjika me sekrete dhe kontrolle.'),('Loading / Empty / Error','Në proces / bosh / dështim','Mungesa e rezultateve nuk është e njëjtë me gabimin.'),('Cache / Të dhëna qendrore','Kopje lokale / versioni në backend','Kopja lokale mund të jetë e vjetruar; sinkronizimi kërkon rregulla.'),('Sugjerim AI / Verifikim','Propozim / provë','Studenti shqyrton kodin dhe teston rezultatin.'),('README / AI-log','Riprodhim / transparencë','Nisja e projektit / ndihma e përdorur dhe provat.')]
col=[145,143,WIDTH-288];xpos=[M,M+145,M+288];y=749
for idx,row in enumerate([('Koncepti','Kuptimi','Shembulli ose arsyeja')]+rows):
    h=49 if idx else 28
    for j,t in enumerate(row):
        rect(xpos[j],y,col[j],h,'#e2e8f0' if idx==0 else ('#f8fafc' if idx%2 else '#ffffff'),'#cbd5e1')
        para(escape(t),xpos[j]+7,y-7,col[j]-14,9.1,bold=(idx==0 or j==0))
    y-=h
para('Kontroll i shpejtë para provimit',M,202,WIDTH,15,bold=True)
bullets(['Mund ta vizatoj rrjedhën nga UI-ja te backend-i dhe të dhënat.', 'Mund ta provoj ndarjen e të dhënave me dy përdorues.', 'Mund të shpjegoj gabimet, riprovimin dhe kufizimet e projektit.', 'Mund të demonstroj Auth, CRUD dhe modulin unik pa u mbështetur vetëm te AI-ja.'],M,172,WIDTH)
footer(16)

# Sources and assessment scope.
page_title('Burimet dhe vlerësimi','Syllabusi 2025/2026 dhe dokumentacioni për përsëritje')
box('Autoriteti i lëndës','Ky material mbështetet në syllabusin origjinal Programimi për pajisje mobile 2025/2026. Syllabusi parashikon 10% pjesëmarrje dhe angazhim dhe 90% projekt final me Auth, CRUD, një modul unik, README dhe AI-log. Për studentët që nuk marrin pjesë, politika parashikon provim final me 100% në afatin e radhës.',746,'#eff6ff','#93c5fd',BLUE)
para('Kushtet e afatit',M,610,WIDTH,14,bold=True)
para('Data, kohëzgjatja, forma e provimit dhe mjetet e lejuara komunikohen nga profesori. Pyetjet në këtë dokument janë ushtruese dhe nuk përbëjnë listë të garantuar të pyetjeve të provimit.',M,583,WIDTH,10)
sources=[('Syllabusi origjinal 2025/2026','https://arbenl.github.io/lendet/2025-2026/mobile/materiale/syllabusi-mobile-2025-2026.pdf'),('Materialet dhe udhëzimi Mobile','https://arbenl.github.io/lendet/2025-2026/mobile/'),('Supabase Auth','https://supabase.com/docs/guides/auth'),('Supabase Row Level Security','https://supabase.com/docs/guides/database/postgres/row-level-security'),('Supabase API keys','https://supabase.com/docs/guides/getting-started/api-keys'),('Supabase Storage','https://supabase.com/docs/guides/storage'),('Supabase Realtime','https://supabase.com/docs/guides/realtime'),('Supabase Edge Functions','https://supabase.com/docs/guides/functions'),('Flutter','https://docs.flutter.dev/'),('React Native','https://reactnative.dev/docs/getting-started'),('Android Compose','https://developer.android.com/compose')]
y=521
for i,(name,link) in enumerate(sources):
    para(f'{i+1:02d}',M,y,25,9,BLUE,True)
    para(escape(name),M+30,y,WIDTH-30,10,bold=True)
    hh=para(f'<link href="{escape(link,quote=True)}" color="#2563eb">{escape(link)}</link>',M+30,y-15,WIDTH-30,8)
    y-=hh+30
para('Shënim pedagogjik',M,y-8,WIDTH,12,bold=True)
para('Shembujt përdorin Supabase dhe aplikacion shënimesh. Zbatoni të njëjtat parime në stack-un e projektit tuaj dhe shpjegoni zgjedhjet me prova nga aplikacioni.',M,y-30,WIDTH,9.5)
footer(17)
c.save()
print(f'Created {OUT} (17 pages)')
