const target = document.querySelector('link[rel="canonical"]');
if (target) {
  const url = new URL(target.href);
  // Keep local previews local; only the observed canonical path is used.
  location.replace(url.pathname + location.search + location.hash);
}
