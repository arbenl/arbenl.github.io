// One map unit is one metre; the two doors are 40 units apart.
export const accuracyMap = `<figure class="map8"><svg viewBox="0 0 340 188" role="img" aria-label="Dy hyrje 40 metra larg brenda rrethit me rreze 80 metra"><rect width="340" height="188" rx="15" fill="#14283b"/><path d="M0 45H340M0 140H340M95 0V188M245 0V188" stroke="#425366" stroke-width="7"/><circle cx="170" cy="94" r="80" fill="#427985" fill-opacity=".4" stroke="#86e7d4" stroke-dasharray="5 4"/><path d="M170 94V14" stroke="#ffcb80" stroke-width="2"/><text x="175" y="49" fill="#ffdb99" font-size="13">80 m</text><circle cx="170" cy="94" r="5" fill="white"/><path d="M150 103H190" stroke="white"/><text x="154" y="123" fill="white" font-size="13">40 m</text><g fill="#ffd393"><circle cx="150" cy="94" r="5"/><circle cx="190" cy="94" r="5"/></g><g fill="white" font-size="14"><text x="77" y="85">Hyrja A</text><text x="201" y="85">Hyrja B</text></g></svg><figcaption>Pika e bardhë është vlerësimi. Të dyja hyrjet bien brenda rrezes së raportuar.</figcaption></figure>`;
const states=[
 ['Arta','Pozicioni u mor','Saktësia rreth 80 m','Hyrja lindore','Arta plotëson matjen me një vend të dallueshëm.'],
 ['Arta','Leja u refuzua','Vendtakimi manual','Biblioteka','Refuzimi mbyll leximin. Arta ende mund ta përfundojë zgjedhjen.'],
 ['Arta','Koha mbaroi','Leximi përfundoi','Provo sërish','Ekrani del nga pritja dhe ofron edhe fushën manuale.'],
 ['Dritoni','Udhëtimi im','Nisja 08:15','Asnjë vendtakim i marrë','Arta e konfirmoi në telefonin e vet. Dritoni do ta shihte vetëm pas një dërgimi dhe leximi të suksesshëm.']
];
export function portrait(index){
 const [role,status,label,value,reason]=states[index];
 return `<div class="portrait8 ${index===3?'driver8':'passenger8'}"><div class="handset8" role="img" aria-label="Telefoni i ${role}. ${status}. ${value}"><i></i><strong>RideShare</strong><small>${role} · ID 2</small><hr><span>Ferizaj → AAB</span><section><small>${label}</small><b>${value}</b></section><em>${status}</em><div class="home8"></div></div><aside><strong>Çfarë ndryshoi në ekran?</strong><p>${reason}</p></aside></div>`;
}
