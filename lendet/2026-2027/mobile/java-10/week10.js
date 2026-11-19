for(const walk of document.querySelectorAll('[data-infra]')){const nodes=[...walk.querySelectorAll('[data-node]')];let at=0,timer=null;const play=walk.querySelector('[data-play]');function stop(){if(timer)clearInterval(timer);timer=null;play.textContent='Luaj rrjedhën';}function select(i){at=i;nodes.forEach((n,k)=>n.setAttribute('aria-pressed',String(k===at)));walk.querySelector('.walk-detail').textContent=nodes[at].dataset.detail;}nodes.forEach((n,i)=>n.addEventListener('click',()=>{stop();select(i)}));walk.querySelector('[data-advance]').addEventListener('click',()=>{stop();select((at+1)%nodes.length)});play.addEventListener('click',()=>{if(timer){stop();return}play.textContent='Ndalo rrjedhën';select(0);timer=setInterval(()=>{if(walk.closest('.step')?.hidden){stop();return}select((at+1)%nodes.length)},1800)});document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});}
for(const block of document.querySelectorAll('[data-version]')){let version=11;for(const button of block.querySelectorAll('[data-version-send]'))button.addEventListener('click',()=>{const incoming=Number(button.dataset.versionSend),accepted=incoming>=version;if(accepted)version=incoming;block.querySelector('[data-version-number]').textContent=version;block.querySelector('[data-version-message]').textContent=accepted?'U zbatua versioni '+incoming+'.':'Versioni '+incoming+' është i vjetër. Ekrani mban '+version+'.';});}
const allSlides = [...document.querySelectorAll('.step')];
const controls = document.querySelector('#controls');

if (controls && allSlides.length) {
  const requestedSlide = allSlides.find(slide => '#' + slide.id === location.hash);
  const classroomSlides = allSlides.filter(slide => slide.hasAttribute('data-classroom-slide'));
  const fullView = new URLSearchParams(location.search).get('pamja') === 'plote';
  const useClassroom = classroomSlides.length > 0 && !fullView &&
    (!requestedSlide || classroomSlides.includes(requestedSlide));
  const slides = useClassroom ? classroomSlides : allSlides;
  const modeButton = document.querySelector('#mode');
  const prev = document.querySelector('#prev');
  const next = document.querySelector('#next');
  const counter = document.querySelector('#counter');
  let current = Math.max(0, slides.indexOf(requestedSlide));

  function show() {
    const enabled = document.body.classList.contains('projector');
    for (const slide of allSlides) slide.hidden = enabled && slide !== slides[current];
    counter.textContent = (current + 1) + ' / ' + slides.length;
    prev.disabled = current === 0;
    next.disabled = current === slides.length - 1;
  }

  function mode(on) {
    document.body.classList.toggle('projector', on);
    document.body.classList.toggle('classroom-projector', on && useClassroom);
    controls.hidden = !on;
    show();
    (on ? next : modeButton).focus();
    window.scrollTo(0, 0);
  }

  function move(delta) {
    current = Math.max(0, Math.min(slides.length - 1, current + delta));
    show();
    window.scrollTo(0, 0);
  }

  modeButton.addEventListener('click', () => mode(true));
  document.querySelector('#exit').addEventListener('click', () => mode(false));
  prev.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  document.addEventListener('keydown', event => {
    if (!document.body.classList.contains('projector') || event.altKey || event.ctrlKey ||
      event.metaKey || event.target.closest('input,textarea,select,[contenteditable=true]')) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      move(1);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      move(-1);
    }
    if (event.key === 'Escape') mode(false);
  });

  show();
  if (!fullView && document.body.dataset.startProjector === 'true' &&
    matchMedia('(min-width:768px)').matches) mode(true);
}
