// In-class questions are local only: no names, accounts, network or scores.
for(const quiz of document.querySelectorAll('.quiz')){
 const choices=[...quiz.querySelectorAll('[data-correct]')],status=quiz.querySelector('[role="status"]');
 for(const button of choices)button.addEventListener('click',()=>{
  for(const item of choices)item.setAttribute('aria-pressed',String(item===button));
  status.textContent=(button.dataset.correct==='true'?'Saktë. ':'Mendo edhe një herë. ')+status.dataset.explanation;
 });
 quiz.querySelector('.quiz-reset').addEventListener('click',()=>{for(const item of choices)item.setAttribute('aria-pressed','false');status.textContent='';choices[0].focus();});
}
for(const button of document.querySelectorAll('.choose-trip'))button.addEventListener('click',()=>{
 const selected=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(selected));button.closest('tr').classList.toggle('selected',selected);
});
