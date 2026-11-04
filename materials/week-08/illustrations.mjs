// One map unit is one metre; the two doors are 40 units apart.
export const accuracyMap = `<figure class="map8"><svg viewBox="0 0 340 188" role="img" aria-label="Dy hyrje 40 metra larg brenda rrethit me rreze 80 metra"><rect width="340" height="188" rx="15" fill="#14283b"/><path d="M0 45H340M0 140H340M95 0V188M245 0V188" stroke="#425366" stroke-width="7"/><circle cx="170" cy="94" r="80" fill="#427985" fill-opacity=".4" stroke="#86e7d4" stroke-dasharray="5 4"/><path d="M170 94V14" stroke="#ffcb80" stroke-width="2"/><text x="175" y="49" fill="#ffdb99" font-size="13">80 m</text><circle cx="170" cy="94" r="5" fill="white"/><path d="M150 103H190" stroke="white"/><text x="154" y="123" fill="white" font-size="13">40 m</text><g fill="#ffd393"><circle cx="150" cy="94" r="5"/><circle cx="190" cy="94" r="5"/></g><g fill="white" font-size="14"><text x="143" y="84" text-anchor="end">Biblioteka</text><text x="201" y="85">Parkingu</text></g></svg><figcaption>E bardha tregon pozicionin e vlerësuar të telefonit. Dy pikat e verdha janë vendtakimet e mundshme.</figcaption></figure>`;
const states=[
 ['Arta','Pozicioni u mor','Saktësia rreth 80 m','Te biblioteka','Arta plotëson matjen me një vend të dallueshëm.'],
 ['Arta','Leja u refuzua','Vendtakimi manual','Biblioteka','Refuzimi mbyll leximin. Arta ende mund ta përfundojë zgjedhjen.'],
 ['Arta','Koha mbaroi','Leximi përfundoi','Provo sërish','Ekrani del nga pritja dhe ofron edhe fushën manuale.'],
 ['Dritoni','Udhëtimi im','Nisja 08:15','Asnjë vendtakim i marrë','Arta e konfirmoi në telefonin e vet. Dritoni do ta shihte vetëm pas një dërgimi dhe leximi të suksesshëm.']
];
export function portrait(index){
 const [role,status,label,value,reason]=states[index];
 return `<div class="portrait8 ${index===3?'driver8':'passenger8'}"><div class="handset8" role="img" aria-label="Telefoni i ${role}. ${status}. ${value}"><i></i><strong>RideShare</strong><small>${role} · ID 2</small><hr><span>Ferizaj → AAB</span><section><small>${label}</small><b>${value}</b></section><em>${status}</em><div class="home8"></div></div><aside><strong>Çfarë ndryshoi në ekran?</strong><p>${reason}</p></aside></div>`;
}

export const journeyMap = `<figure style="margin:12px 0"><svg role="img" aria-label="Skemë e udhëtimit: Dritoni ndalet te biblioteka për Artën dhe vazhdojnë bashkë te Kolegji AAB" viewBox="0 0 840 240" style="display:block;width:100%;max-height:300px">
<rect width="840" height="240" rx="16" fill="#14283b"/>
<g fill="none" stroke="#334858" stroke-width="9"><path d="M0 80H840M0 180H840M190 0V240M530 0V240M680 0V240"/></g>
<path d="M20 155H215" fill="none" stroke="#ffcf86" stroke-width="6" stroke-dasharray="10 7"/>
<path d="M215 155H395Q420 155 420 130V100Q420 80 445 80H708" fill="none" stroke="#82ead2" stroke-width="9"/>
<path d="m555 68 18 12-18 12" fill="none" stroke="#14283b" stroke-width="5"/>
<circle cx="215" cy="155" r="13" fill="#ffcf86"/><circle cx="708" cy="80" r="13" fill="#82ead2"/>
<g font-family="Arial" fill="#fff"><text x="115" y="115" font-size="27" font-weight="bold">Biblioteka</text><text x="115" y="204" font-size="20">Arta pret te hyrja</text><text x="595" y="47" font-size="27" font-weight="bold">Kolegji AAB</text><text x="580" y="130" font-size="20">Mbërrijnë së bashku</text><text x="18" y="138" font-size="18">Dritoni</text></g></svg><figcaption>Skemë mësimore e udhëtimit. Vija e ndërprerë tregon ardhjen e shoferit te vendtakimi. Vija e plotë tregon udhëtimin e përbashkët.</figcaption></figure>`;
