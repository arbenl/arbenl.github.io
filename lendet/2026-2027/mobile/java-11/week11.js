for(const walk of document.querySelectorAll('[data-infra]')){const nodes=[...walk.querySelectorAll('[data-node]')];let at=0,timer=null;const play=walk.querySelector('[data-play]');function stop(){if(timer)clearInterval(timer);timer=null;play.textContent='Luaj rrjedhën';}function select(i){at=i;nodes.forEach((n,k)=>n.setAttribute('aria-pressed',String(k===at)));walk.querySelector('.walk-detail').textContent=nodes[at].dataset.detail;}nodes.forEach((n,i)=>n.addEventListener('click',()=>{stop();select(i)}));walk.querySelector('[data-advance]').addEventListener('click',()=>{stop();select((at+1)%nodes.length)});play.addEventListener('click',()=>{if(timer){stop();return}play.textContent='Ndalo rrjedhën';select(0);timer=setInterval(()=>{if(walk.closest('.step')?.hidden){stop();return}select((at+1)%nodes.length)},1800)});document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});}
for(const block of document.querySelectorAll('[data-version]')){let version=11;for(const button of block.querySelectorAll('[data-version-send]'))button.addEventListener('click',()=>{const incoming=Number(button.dataset.versionSend),accepted=incoming>=version;if(accepted)version=incoming;block.querySelector('[data-version-number]').textContent=version;block.querySelector('[data-version-message]').textContent=accepted?'U zbatua versioni '+incoming+'.':'Versioni '+incoming+' është i vjetër. Ekrani mban '+version+'.';});}
const slides = [...document.querySelectorAll('.step')];
const controls = document.querySelector('#controls');

if (controls && slides.length) {
  let current = 0;
  const modeButton = document.querySelector('#mode');
  const previous = document.querySelector('#prev');
  const next = document.querySelector('#next');
  const counter = document.querySelector('#counter');

  function show() {
    const projector = document.body.classList.contains('projector');
    slides.forEach((slide, index) => {
      slide.hidden = projector && index !== current;
      if (projector && index === current) slide.tabIndex = 0;
      else slide.removeAttribute('tabindex');
    });
    slides[current].scrollTop = 0;
    counter.textContent = (current + 1) + ' / ' + slides.length;
    previous.disabled = current === 0;
    next.disabled = current === slides.length - 1;
  }

  function mode(on) {
    document.body.classList.toggle('projector', on);
    controls.hidden = !on;
    show();
    (on ? next : modeButton).focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function move(delta) {
    const index = current + delta;
    if (index < 0 || index >= slides.length) return;
    const focusWasInSlide = slides[current].contains(document.activeElement);
    current = index;
    show();
    if (focusWasInSlide) slides[current].focus({ preventScroll: true });
  }

  modeButton.addEventListener('click', () => mode(true));
  document.querySelector('#exit').addEventListener('click', () => mode(false));
  previous.addEventListener('click', () => move(-1));
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
  if (document.body.dataset.startProjector === 'true' && matchMedia('(min-width:768px)').matches) {
    mode(true);
  }
}
for(const block of document.querySelectorAll('[data-permission-experiment]'))for(const button of block.querySelectorAll('[data-permission]'))button.addEventListener('click',()=>{const value=button.dataset.permission;block.querySelector('[data-permission-output]').textContent=value==='granted'?'granted: kanali i sistemit mund të përdoret kur platforma e lejon. Lista brenda aplikacionit vazhdon.':value==='denied'?'denied: nuk kërkojmë lejen sërish. Lista dhe hapja e përgjigjes funksionojnë.':'Pa mbështetje: përdorim listën brenda aplikacionit. Kjo nuk është dështim i punës kryesore.';});
