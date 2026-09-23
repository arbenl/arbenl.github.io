const query = document.querySelector('#search');
const year = document.querySelector('#year');
const cards = [...document.querySelectorAll('[data-course]')];
const normalize = text => text.toLocaleLowerCase('sq').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function filter() {
  const term = normalize(query?.value || '');
  let count = 0;
  for (const card of cards) {
    card.hidden = Boolean((year?.value && card.dataset.year !== year.value) || !normalize(card.textContent + ' ' + card.dataset.course).includes(term));
    if (!card.hidden) count++;
  }
  const results = document.querySelector('#results');
  if (results) results.textContent = count ? `${count} lëndë të gjetura` : 'Nuk u gjet asnjë lëndë. Provo një emër ose vit tjetër.';
}
query?.addEventListener('input', filter);
year?.addEventListener('change', filter);
if (cards.length) filter();
// Bookmarked links from the previous one-course homepage keep their context.
const legacyHashes = new Set(['student-start','templates-hub','course-overview','setup','checkin','curriculum','project','policies','profile']);
if (location.pathname === '/' || location.pathname === '/index.html') {
  const hash = location.hash.slice(1);
  if (hash === 'profile') location.replace('/profili.html');
  else if (legacyHashes.has(hash) || /^week-(?:[1-9]|1[0-5])$/.test(hash)) location.replace('/lendet/2026-2027/mobile/syllabus.html' + location.search + location.hash);
}
