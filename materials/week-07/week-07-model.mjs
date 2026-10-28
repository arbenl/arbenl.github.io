// Learning scenarios only. No accounts, database connections or reservation writes.
export function personalCase(value){
 const login=String(value).trim().toLowerCase();
 if(!/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/.test(login))throw new Error('Shkruaj emrin publik GitHub, pa @, email ose link.');
 let hash=0;for(const char of login)hash=(hash*31+char.charCodeAt(0))%1000;
 const towns=['Prizren','Ferizaj','Gjilan','Pejë','Gjakovë','Mitrovicë'];
 const hour=8+Math.floor(hash/6)%3,minute=(hash%6)*5;
 return {login,code:'P7-'+String(hash).padStart(3,'0'),from:towns[hash%6],to:'AAB',time:String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0'),seats:1+hash%3,newTime:String(hour).padStart(2,'0')+':'+String(minute+5).padStart(2,'0')};
}
export function demoState(scenario,selectedId=2){
 if(!['normal','pa-vende','id-gabuar','offline','rikthimi'].includes(scenario))throw new Error('Skenar i panjohur');
 const offline=scenario==='offline';
 // Special scenarios always demonstrate Dritoni (ID 2); normal permits any card.
 if(scenario!=='normal')selectedId=2;
 const trips=[{id:1,driver:'Dreni',from:'Prizren',time:'08:00',seats:3},{id:2,driver:'Dritoni',from:'Ferizaj',time:scenario==='rikthimi'?'08:25':'08:15',seats:offline?1:scenario==='pa-vende'||scenario==='rikthimi'?0:2},{id:3,driver:'Lira',from:'Gjilan',time:'08:30',seats:1}];
 const id=scenario==='id-gabuar'?999:selectedId;
 const trip=trips.find(t=>t.id===id)||null;
 return {trips,trip,offline,source:offline?'Kopje e ruajtur në 07:00. Mund të jetë e vjetër.':'Përgjigje e serverit në këtë simulim.',disabled:!trip||offline||trip.seats===0,message:!trip?'Udhëtimi nuk u gjet. Kthehu te lista.':offline?'Lexim nga kopja. Kërkesa është e çaktivizuar.':trip.seats===0?'Nuk ka vende të lira. Zgjidh udhëtim tjetër.':'Mund të provosh kërkesën demonstrative.'};
}
export const runtimeSteps=[
 ['Telefoni','Arta hap listën e udhëtimeve.'],
 ['Vercel','Serveri Next.js merr kërkesën e leximit.'],
 ['Neon PostgreSQL','Serveri lexon rreshtat publikë. GitHub nuk merr pjesë në këtë kërkesë.'],
 ['Telefoni','Lista dhe ID-të shfaqen nga përgjigjja.'],
 ['Vercel','Për ndryshime reale serveri kontrollon sesionin dhe pronësinë.'],
 ['Neon PostgreSQL','Vetëm veprimi i lejuar mund të ndryshojë të dhëna. Ky demonstrim nuk shkruan asgjë.']
];
export const offlineSteps=[['Telefoni','Kërkohet lista, por rruga drejt serverit nuk përgjigjet.'],['Kopja në telefon','Lexohet lista publike e ruajtur më parë me kohën e saj.'],['Telefoni','Shfaqet paralajmërimi. Kërkesa për vend mbetet e çaktivizuar.']];
