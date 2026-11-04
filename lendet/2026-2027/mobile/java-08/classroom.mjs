const outcomes = {
  accepted: ['Pozicioni u mor', 'Saktësia e vlerësuar është 80 m. Cila hyrje të përshtatet?', 'Arta mund ta korrigjojë vendtakimin para konfirmimit.'],
  denied: ['Leja u refuzua', 'Mund ta shkruash vendtakimin vetë.', 'Refuzimi ndryshon mënyrën si zgjidhet vendi. Udhëtimi mbetet i hapur.'],
  timeout: ['Koha e pritjes mbaroi', 'Provo përsëri ose shkruaj vendtakimin.', 'Koha mbaroi pa rezultat. Nga kjo nuk mund të nxjerrim që Arta e refuzoi lejen.'],
  unavailable: ['Leximi nuk ofrohet', 'Shkruaj një pikë takimi që Dritoni mund ta njohë.', 'Rruga manuale funksionon edhe në një pajisje pa këtë aftësi.']
};
for (const demo of document.querySelectorAll('[data-demo]')) {
  const field = demo.querySelector('input');
  const status = demo.querySelector('[role=status]');
  const explanation = demo.querySelector('.observation');
  function start() {
    status.textContent = 'Udhëtimi 2 · Ferizaj → AAB · 08:15';
    explanation.textContent = 'Parashiko mesazhin e radhës. Dritoni ende sheh udhëtimin e tij.';
    field.value = '';
  }
  for (const button of demo.querySelectorAll('[data-result]')) {
    button.onclick = () => {
      const [heading, message, reason] = outcomes[button.dataset.result];
      status.textContent = heading + ' · ' + message;
      explanation.textContent = reason;
    };
  }
  demo.querySelector('.confirm').onclick = () => {
    if (!field.value.trim()) { field.focus(); status.textContent = 'Shkruaj vendtakimin përpara konfirmimit.'; return; }
    status.textContent = 'Vendtakimi i zgjedhur: ' + field.value.trim();
    explanation.textContent = 'Arta e konfirmoi në këtë ekran. Dritoni ende nuk ka marrë mesazh nga serveri.';
  };
  demo.querySelector('.reset').onclick = start;
  start();
}
