// Reveal only the answer; the professor controls when to advance the slide.
for (const button of document.querySelectorAll('.reveal')) {
  const answer = document.getElementById(button.getAttribute('aria-controls'));
  if (!answer) continue;
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    answer.hidden = expanded;
  });
}
