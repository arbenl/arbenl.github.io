// Copy one named example file at a time; no account or external service needed.
for (const section of document.querySelectorAll('[data-example-file]')) {
  const code = section.querySelector('pre code');
  if (!code) continue;
  const tools = document.createElement('p');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button secondary';
  button.textContent = 'Kopjo kodin · ' + section.dataset.exampleFile;
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.textContent);
      status.textContent = ' U kopjua. Ngjite në skedarin e treguar dhe ruaje.';
    } catch {
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = ' Kodi u përzgjodh. Kopjoje me Ctrl+C ose ⌘C.';
    }
  });
  tools.append(button, status);
  code.parentElement.before(tools);
}
