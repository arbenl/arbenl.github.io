// In-class questions are local only: no names, accounts, network or scores.
for(const quiz of document.querySelectorAll('.quiz')){
 const choices=[...quiz.querySelectorAll('[data-correct]')];
 const status=quiz.querySelector('.vote-status'),answer=quiz.querySelector('.quiz-answer'),reveal=quiz.querySelector('.quiz-reveal');
 let selected=null;
 for(const button of choices)button.addEventListener('click',()=>{
  selected=button;
  for(const item of choices)item.setAttribute('aria-pressed',String(item===button));
  answer.hidden=true;answer.textContent='';reveal.setAttribute('aria-expanded','false');reveal.disabled=false;
  status.textContent='Zgjodhët '+String.fromCharCode(65+choices.indexOf(button))+'. Diskutoni arsyen me kolegun, pastaj zbuloni përgjigjen.';
 });
 reveal.addEventListener('click',()=>{
  if(!selected)return;
  const expanded=reveal.getAttribute('aria-expanded')==='true';
  reveal.setAttribute('aria-expanded',String(!expanded));answer.hidden=expanded;
  if(!expanded){const correct=choices.findIndex(item=>item.dataset.correct==='true');answer.textContent=(selected.dataset.correct==='true'?'Saktë. ':'Krahasoni arsyetimin tuaj. ')+ 'Përgjigjja '+String.fromCharCode(65+correct)+'. '+answer.dataset.explanation;}
 });
 quiz.querySelector('.quiz-reset').addEventListener('click',()=>{
  selected=null;for(const item of choices)item.setAttribute('aria-pressed','false');
  status.textContent='Votoni A, B ose C. Diskutoni 30 sekonda në çift para përgjigjes.';answer.hidden=true;answer.textContent='';reveal.disabled=true;reveal.setAttribute('aria-expanded','false');choices[0].focus();
 });
}
for(const checklist of document.querySelectorAll('.readiness')){
 const inputs=[...checklist.querySelectorAll('input[type="checkbox"]')],status=checklist.querySelector('.readiness-status');
 for(const input of inputs)input.addEventListener('change',()=>{
  const count=inputs.filter(item=>item.checked).length;
  status.textContent=count+' / '+inputs.length+' kontrolle. '+(count===inputs.length?checklist.dataset.complete:'Nëse diçka mungon, rregullojeni para se të vazhdoni.');
 });
}
for(const button of document.querySelectorAll('.choose-trip'))button.addEventListener('click',()=>{
 const selected=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(selected));button.closest('tr').classList.toggle('selected',selected);
});
