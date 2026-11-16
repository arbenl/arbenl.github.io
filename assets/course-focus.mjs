import { getCourseMoment } from './course-lifecycle.mjs';
const host=document.querySelector('#course-focus');
if(host) {
  try {
    const response=await fetch('/assets/course-schedule.json',{cache:'no-cache'});
    if(!response.ok) throw new Error('Calendar unavailable');
    const schedule=await response.json();
    const update=()=>{
      const {nextWeek,status}=getCourseMoment(schedule);
      const title=host.querySelector('h2');
      const message=host.querySelector('[data-course-focus-status]');
      const actions=host.querySelector('[data-course-focus-actions]');
      actions.replaceChildren();
      if(!nextWeek){
        title.textContent='Orari i semestrit përfundoi';
        message.textContent='Materialet, dorëzimet dhe rezultatet mbeten të arritshme sipas javëve më poshtë.';
        host.removeAttribute('data-focus-week');return;
      }
      host.dataset.focusWeek=String(nextWeek.week);
      title.textContent=`${status==='today'?'Sot':'Ora e radhës'} · Java ${nextWeek.week} · ${nextWeek.date.split('-').reverse().join('.')}`;
      message.textContent=nextWeek.title;
      const link=document.createElement('a');link.className='button';link.href=nextWeek.weekUrl;link.textContent=`Hap materialet · Java ${nextWeek.week} →`;actions.append(link);
      if(nextWeek.week===7) {
        const exam=document.createElement('a');exam.className='button secondary';exam.href='https://aab-mobile-attendance.vercel.app/colloquium';exam.textContent='Kolokviumi I · Hyrja dhe rezultatet';actions.append(exam);
      }
    };
    update();setInterval(update,60_000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
  }catch{
    // Keep the complete server-generated calendar usable without JS/network.
    host.querySelector('[data-course-focus-status]').textContent='Hap javën nga kalendari më poshtë. Të gjitha materialet mbeten të arritshme.';
  }
}
