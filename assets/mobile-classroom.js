const service='https://aab-rideshare-classroom.vercel.app';
export function studentLaunch(state){return state?.released===true&&state.week===15&&state.launchUrl===service+'/course'?state.launchUrl:null;}
async function refresh(root){
 const status=root.querySelector('[data-classroom-status]'),launch=root.querySelector('[data-classroom-launch]');
 try{
  const response=await fetch(service+'/api/course-access',{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('unavailable');
  const state=await response.json(),url=studentLaunch(state);
  launch.replaceChildren();
  if(url){const link=document.createElement('a');link.className='button';link.href=url;link.textContent='Hap RideShare · Hyr me profilin tënd';launch.append(link);status.textContent='Aktiviteti i Javës 15 është i hapur. Skano ftesën e profesorit për hyrjen e parë.';}
  else status.textContent='Hapet në Javën 15 · 24 dhjetor 2026, ora 16:30.';
 }catch{launch.replaceChildren();status.textContent='Hapet në Javën 15 · 24 dhjetor 2026, ora 16:30. Hyrja shfaqet kur aktiviteti të jetë i hapur.';}
}
if(typeof document!=='undefined'){
 const root=document.querySelector('[data-classroom-access]');
 if(root){refresh(root);setInterval(()=>{if(document.visibilityState==='visible')refresh(root);},60000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh(root);});}
}
