import {accuracyMap,portrait} from './illustrations.mjs';
import {simulation} from './scenes.mjs';
const icon=(name)=>'<img width="42" height="42" alt="" src="/assets/week06-icons/'+name+'.svg">';
const figure=(items)=>'<div class="concepts">'+items.map(([img,label,detail])=>'<div>'+icon(img)+'<strong>'+label+'</strong><span>'+detail+'</span></div>').join('')+'</div>';
const path=[
 ['cloud','Vercel','Dërgon faqen Next.js në shfletues. Në këtë çast vendndodhja mund të jetë ende e panjohur.'],
 ['smartphone','Telefoni i Artës','Arta shtyp butonin. Komponenti i klientit thërret Geolocation API në shfletues.'],
 ['lock-keyhole','Leja','Shfletuesi kontrollon lejen për këtë faqe. Nëse vendimi është ruajtur, mund ta përdorë pa shfaqur pyetje të re.'],
 ['route','Pajisja','Sistemi operativ vlerëson pozicionin duke përdorur burimet e disponueshme, si GPS ose Wi-Fi.'],
 ['refresh-cw','RideShare','Funksioni i suksesit merr pozicionin dhe saktësinë. Arta zgjedh përshkrimin e vendtakimit.'],
 ['database','Ndarja me Dritonin','Vetëm nëse ndërtojmë dërgimin: telefoni i dërgon vendtakimin serverit, serveri kontrollon lejen dhe e ruan në Neon. Në laborator përfundojmë te konfirmimi lokal.']
];
export const walk='<div data-walk><div class="nodes">'+path.map(([img,label,detail],i)=>'<button type="button" aria-pressed="'+(i===0)+'" data-detail="'+detail+'">'+icon(img)+'<span>'+label+'</span></button>').join('')+'</div><p class="walk-detail" role="status">'+path[0][2]+'</p><button type="button" data-advance>Hapi tjetër →</button></div>';
const sections=[
 ['','Sensorët dhe ndërfaqet e pajisjes (Device APIs)','Si mund ta zgjedhë Arta pikën e nisjes në RideShare? Sot ndjekim tri pjesë të ligjëratës.',figure([['smartphone','1 · Matja','Çfarë mat telefoni dhe si e lexon aplikacioni vendndodhjen?'],['lock-keyhole','2 · Leja dhe saktësia','Kush e lejon leximin dhe sa saktë mund ta dallojmë hyrjen?'],['car','3 · Vendtakimi','Shih tri raste: leja pranohet, refuzohet ose leximi dështon.']])],
 ['3–7 min','Një matje fizike bëhet e dhënë','Akselerometri mat përshpejtimin, xhiroskopi mat shpejtësinë e rrotullimit. Sistemi i pozicionimit vlerëson vendndodhjen. Një aplikacion zgjedh aftësinë që i duhet për punën e përdoruesit.',figure([['smartphone','Lëvizje','Telefoni ndryshon shpejtësi.'],['refresh-cw','Rrotullim','Telefoni kthehet rreth boshtit.'],['route','Pozicion','Ku ndodhet afërsisht Arta?']])],
 ['7–11 min','Si e lexon një aplikacion pajisjen?','API (Application Programming Interface) është ndërfaqja përmes së cilës kodi kërkon një aftësi. RideShare përdor navigator.geolocation në shfletues. Sistemi operativ zgjedh burimet e pozicionimit dhe shfletuesi ia kthen rezultatin aplikacionit.', '<p class="example">Për një pikë nisjeje mjafton një lexim me getCurrentPosition(). Ndjekja e vazhdueshme me watchPosition() do të jepte përditësime të tjera dhe do të kërkonte një arsye tjetër për përdoruesin.</p>'],
 ['11–16 min','Ndiq kërkesën nga klikimi te vendtakimi','Hap secilën hallkë të skemës. Dallo çastin kur Vercel shërben faqen nga çasti kur telefoni lexon pajisjen.',walk],
 ['16–21 min','Ku duhet të ndalet Dritoni?','Në këtë shembull ka dy hyrje, një pranë bibliotekës dhe një pranë parkingut, 40 m larg njëra-tjetrës. Telefoni jep një pikë (latitude, longitude) me saktësi të vlerësuar 80 m (accuracy). Të dyja hyrjet bien brenda rrethit.', '<p class="example">Hyrjet janë 40 m larg. Saktësia e vlerësuar është 80 m. Të dyja hyrjet mund të jenë brenda zonës së pasigurisë. Prandaj Arta e plotëson matjen me fjalët “Te hyrja lindore”.</p>'],
 ['21–25 min','Rasti 1 · Leja pranohet','Komponenti kërkon pozicionin pas klikimit dhe shfaq pritjen. Leximi kërkon një kontekst të sigurt, zakonisht HTTPS ose localhost gjatë zhvillimit. Kur vjen përgjigjja, Arta mund ta korrigjojë vendtakimin përpara konfirmimit.',figure([['clock','Në pritje','Butoni tregon se leximi po vazhdon.'],['route','Rezultati','Pika shoqërohet me saktësinë.'],['car','Zgjedhja','Arta emërton hyrjen.']])],
 ['25–29 min','Rasti 2 · Leja refuzohet','Leja lidhet me faqen dhe vendimin e përdoruesit. Kur shfletuesi raporton refuzim, RideShare e përfundon pritjen dhe mban të hapur fushën manuale. Arta mund ta caktojë Bibliotekën edhe pa dhënë pozicionin.', '<p class="example">Dallo dy leje nga javët 5 dhe 8. Shfletuesi vendos nëse faqja mund të lexojë pozicionin. Serveri vendos nëse llogaria e Artës mund të ndryshojë një udhëtim të Dritonit.</p>'],
 ['29–33 min','Rasti 3 · Leximi dështon','Kur API mungon, aplikacioni mund ta dallojë përpara thirrjes. Kur API ekziston, leximi mund të dështojë sepse pozicioni nuk gjendet ose koha mbaron. Në secilën degë ekrani duhet të dalë nga pritja.',figure([['smartphone','Pa mbështetje','Shfaq menjëherë fushën manuale.'],['wifi-off','Pa rezultat','Ofron riprovim ose vendtakim manual.'],['clock','Koha mbaroi','Trego se leximi nuk u krye në kohë.']])],
 ['33–39 min','Demonstrim · Një udhëtim, katër rezultate','Para çdo klikimi klasa parashikon çfarë do të shohë Arta. Pas klikimit një student shpjegon pse ndryshoi ekrani dhe një tjetër shpjegon çfarë di Dritoni.',simulation],
 ['39–43 min','Çfarë do ta provonte dërgimin?','Arta ka konfirmuar “Biblioteka” në telefonin e vet. Për të vërtetuar ndarjen, do të duhej të shihnim kërkesën e pranuar në server dhe të njëjtin vendtakim në ekranin e Dritonit për ID-në e duhur.',figure([['smartphone','Sot','Zgjedhje lokale e konfirmuar.'],['cloud','Hapi i ardhshëm','Serveri pranon dërgimin e autorizuar.'],['car','Prova përfundimtare','Shoferi lexon vendtakimin e duhur.']])],
 ['43–45 min','Dalja nga ligjërata','Në çift, njëri shpjegon si një matje bëhet vendtakim. Tjetri zgjedh një dështim dhe tregon si vazhdon Arta. Në ushtrime do t’i kthesh këto dy shpjegime në sjellje të provueshme.', '<p><a href="prezantimi-ushtrimeve.html">Hap laboratorin →</a></p>']
];
sections[4][3]=accuracyMap;
for(const [position,state] of [[9,3],[7,2],[6,1],[5,0]]){
 const [time,title]=sections[position];
 sections.splice(position+1,0,[time,title+' · Ekrani i '+(state===3?'Dritonit':'Artës'),'Ilustrim me të dhëna fiktive.',portrait(state)]);
}
const vote=(question,choices)=>'<div data-vote><p><strong>'+question+'</strong></p>'+choices.map(([label,reason])=>'<button aria-pressed="false" data-reason="'+reason+'">'+label+'</button>').join('')+'<output aria-live="polite"></output></div>';
sections.find(s=>s[1]==='Ku duhet të ndalet Dritoni?')[3]+=vote('Dritoni sheh vetëm pikën dhe rrethin. Çfarë duhet të bëjë para se të niset?',[
 ['Të ndalet te biblioteka','Edhe parkingu është brenda rrethit. Telefoni ende nuk tregon te cila hyrje pret Arta.'],
 ['Të ndalet te parkingu','Edhe biblioteka është brenda rrethit. Zgjedhja e parkingut do të ishte hamendje.'],
 ['Ta pyesë Artën ku pret','Saktë. Arta konfirmon «Po pres te hyrja pranë bibliotekës». Tani vendtakimi është i qartë.']
]);
sections.splice(1,0,['','Çfarë kemi ndërtuar deri tani?','RideShare nisi me një pyetje: si e gjen Arta udhëtimin e duhur? Sot vazhdojmë nga detajet e atij udhëtimi për të zgjedhur vendtakimin.',figure([
 ['route','Javët 1–3 · Nga ideja te ekranet','Përcaktuam problemin, skicuam rrjedhën dhe lidhëm listën me detajet e udhëtimit të zgjedhur.'],
 ['database','Javët 4–5 · Të dhënat dhe lejet','Lexuam udhëtimet nga Neon dhe pamë si kontrollon serveri kush mund ta ndryshojë një udhëtim.'],
 ['refresh-cw','Javët 6–7 · Pa internet dhe nën provë','Lexuam kopjen lokale dhe provuam çfarë i tregon RideShare përdoruesit kur të dhënat mungojnë ose vjetrohen.']
])]);
sections[0]=['','Ku duhet të ndalet Dritoni?',
'Arta pret pranë bibliotekës ose pranë parkingut. Hyrjet janë 40 m larg. Telefoni jep një pozicion me saktësi të vlerësuar prej 80 m. Dritoni sheh hartën. A ka informacion të mjaftueshëm për të zgjedhur hyrjen?',
accuracyMap+vote('Çfarë do t’i këshilloje Dritonit?',[
 ['Shko te biblioteka','Edhe parkingu bie brenda rrethit. Dritonit i mungon emri i vendtakimit.'],
 ['Shko te parkingu','Edhe biblioteka bie brenda rrethit. Dritonit i mungon emri i vendtakimit.'],
 ['Pyete Artën','Arta sqaron «Po pres te hyrja pranë bibliotekës». Tani Dritoni e di ku ta presë.']
])+ '<p><strong>Sensorët dhe ndërfaqet e pajisjes (Device APIs)</strong> · Sot ndjekim matjen në telefon, lejen në shfletues dhe konfirmimin e vendtakimit nga Arta.</p>'];
const measurement=sections.find(s=>s[1]==='Ku duhet të ndalet Dritoni?' && s!==sections[0]);
measurement[1]='Si lexohet përgjigjja e pajisjes?';
measurement[2]='Shfletuesi i kthen RideShare-it një matje. Secila vlerë i përgjigjet një pyetjeje të ndryshme.';
measurement[3]=figure([['route','latitude dhe longitude','Ku e vendos pajisja pikën në hartë?'],['smartphone','accuracy · 80 m','Sa e pasigurt është pika e raportuar?'],['clock','timestamp','Kur u mor kjo matje?']])+'<p class="example">RideShare i jep Artës mundësinë ta emërtojë vendtakimin edhe kur leximi dështon. Konfirmimi shfaqet fillimisht në telefonin e saj. Që Dritoni ta shohë, aplikacioni duhet t’ia dërgojë.</p>';
export const lesson=sections.map(([,title,body,visual],i)=>'<section class="step"><p class="eyebrow">JAVA 8 · '+(i+1)+' / '+sections.length+'</p><h2>'+title+'</h2><p>'+body+'</p>'+visual+'</section>').join('');
