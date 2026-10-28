/* Rafa Pizza — navigation unifiee des liens internes. */
(() => {
  const menuButton = document.querySelector('.rafa-menu-toggle');
  const menuPanel = document.getElementById('rafa-nav-panel');
  const menuClose = menuPanel?.querySelector('.rafa-menu-close');
  if (!menuButton || !menuPanel || !menuClose) return;

  document.body.appendChild(menuPanel); // Hors de .site (overflow: clip).
  let lastFocus = menuButton;
  const menuIsOpen = () => !menuPanel.hidden;

  function openMenu() {
    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : menuButton;
    menuPanel.hidden = false;
    menuButton.setAttribute('aria-expanded', 'true');
    document.body.classList.add('rafa-menu-open');
    menuClose.focus({preventScroll: true});
  }

  function closeMenu(restoreFocus = true) {
    menuPanel.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('rafa-menu-open');
    if (restoreFocus) (lastFocus.isConnected ? lastFocus : menuButton).focus({preventScroll: true});
    else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  function destinationFor(hash) {
    if (hash === '#disponibilites' || hash === '#calendrier') {
      return document.getElementById('dateTitle') || document.getElementById('disponibilites');
    }
    if (!/^#[A-Za-z][\w-]*$/.test(hash)) return null;
    const section = document.getElementById(hash.slice(1));
    return section?.querySelector('h2') || section;
  }

  function jumpTo(hash, recordHistory = true) {
    const target = destinationFor(hash);
    if (!target) return;
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    const offset = hash === '#accueil' ? 0 : 24;
    const y = window.scrollY + target.getBoundingClientRect().top - offset;
    window.scrollTo(0, Math.max(0, Math.round(y)));
    root.style.scrollBehavior = previous;
    if (recordHistory && location.hash !== hash) history.pushState(null, '', hash);
  }

  menuButton.addEventListener('click', () => menuIsOpen() ? closeMenu() : openMenu());
  menuClose.addEventListener('click', () => closeMenu());

  document.addEventListener('click', event => {
    const anchor = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
    if (!anchor) return;
    const hash = anchor.getAttribute('href');
    if (!destinationFor(hash)) return;
    event.preventDefault();
    if (menuIsOpen()) closeMenu(false);
    requestAnimationFrame(() => {
      jumpTo(hash);
      requestAnimationFrame(() => jumpTo(hash, false));
    });
  });

  document.addEventListener('keydown', event => {
    if (!menuIsOpen()) return;
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...menuPanel.querySelectorAll('button, a[href]')];
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  });

  addEventListener('popstate', () => {
    if (location.hash) requestAnimationFrame(() => jumpTo(location.hash, false));
  });
  addEventListener('load', () => {
    if (location.hash) requestAnimationFrame(() => jumpTo(location.hash, false));
  });
})();
