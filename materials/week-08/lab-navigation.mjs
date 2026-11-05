// Returning from the demo should open preparation, not restart the presentation.
function openStepFromHash() {
  const id=location.hash.slice(1);
  const steps=[...document.querySelectorAll('.step')];
  const wanted=steps.findIndex(step=>step.id===id);
  if(wanted<0)return;
  if(!document.body.classList.contains('projector')){steps[wanted].scrollIntoView();return;}
  let shown=steps.findIndex(step=>!step.hidden);
  while(shown<wanted){document.querySelector('#next').click();shown++;}
  while(shown>wanted){document.querySelector('#prev').click();shown--;}
}
openStepFromHash();
window.addEventListener('hashchange',openStepFromHash);
