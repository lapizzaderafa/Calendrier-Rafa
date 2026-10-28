/* Rafa Pizza — menu d'accueil. Aucun lien avec le calendrier ou les reservations. */
(() => {
  const button = document.querySelector('.rafa-menu-toggle');
  const panel = document.getElementById('rafa-nav-panel');
  const closeButton = panel?.querySelector('.rafa-menu-close');
  if (!button || !panel || !closeButton) return;
  // Outside .site, to avoid clipping the full-screen menu by the site's overflow rule.
  document.body.appendChild(panel);
  let returnFocus = button;
  function setOpen(open) {
    if (open) returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : button;
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    document.body.classList.toggle('rafa-menu-open', open);
    if (open) closeButton.focus({ preventScroll: true });
    else (returnFocus || button).focus({ preventScroll: true });
  }
  button.addEventListener('click', () => setOpen(panel.hidden));
  closeButton.addEventListener('click', () => setOpen(false));
  panel.querySelectorAll('.rafa-nav-links a').forEach(link => {
    link.addEventListener('click', () => setOpen(false));
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) setOpen(false);
    if (event.key === 'Tab' && !panel.hidden) {
      const focusables = [...panel.querySelectorAll('button, a[href]')];
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
})();

/* Acces direct au calendrier depuis le bouton de l'accueil.
   Evite le long defilement anime qui passe devant l'estimation des prix. */
(() => {
  const button = document.querySelector('.rafa-intro .text-cta[href="#calendrier"]');
  if (!button) return;
  button.addEventListener('click', (event) => {
    const calendar = document.getElementById('calendrier');
    if (!calendar) return; // lien HTML utilisable meme sans JavaScript
    event.preventDefault();
    const root = document.documentElement;
    const originalBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    try {
      const y = window.scrollY + calendar.getBoundingClientRect().top - 16;
      window.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
    } finally {
      root.style.scrollBehavior = originalBehavior;
    }
    window.history.replaceState(null, '', '#calendrier');
  });
})();
