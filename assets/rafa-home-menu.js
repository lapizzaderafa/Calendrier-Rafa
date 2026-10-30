/* Rafa Pizza — navigation interne, alignement stable de chaque destination. */
(() => {
  const menuButton = document.querySelector('.rafa-menu-toggle');
  const menuPanel = document.getElementById('rafa-nav-panel');
  const menuClose = menuPanel?.querySelector('.rafa-menu-close');
  if (!menuButton || !menuPanel || !menuClose) return;

  document.body.appendChild(menuPanel); // Évite le découpage causé par .site (overflow: clip).
  let lastFocus = menuButton;
  let navigationToken = 0;
  const menuIsOpen = () => !menuPanel.hidden;
  const OFFSET = 24; // Aligner le haut du titre à 24 px du haut de la fenêtre.

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

  // Cibler les vrais titres et non le début d'une section (avec ses espaces).
  function destinationFor(hash) {
    if (!/^#[A-Za-z][\w-]*$/.test(hash)) return null;
    const id = hash.slice(1);
    const titles = {
      accueil: 'accueil',
      fonctionnement: 'functionTitle',
      pizzas: 'pizzasTitle',
      prix: 'prixTitle',
      disponibilites: 'dateTitle',
      calendrier: 'dateTitle',
      avis: 'rafaReviewsTitle'
    };
    const explicit = document.getElementById(titles[id] || '');
    if (explicit) return explicit;
    const section = document.getElementById(id);
    if (!section) return null;
    return section.matches('h1, h2') ? section : (section.querySelector('h1, h2') || section);
  }

  function jumpTo(hash, recordHistory = true, behavior = 'auto') {
    const target = destinationFor(hash);
    if (!target) return;
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    const y = hash === '#accueil' ? 0 :
      window.scrollY + target.getBoundingClientRect().top - OFFSET;
    window.scrollTo({top: Math.max(0, Math.round(y)), behavior});
    root.style.scrollBehavior = previous;
    if (recordHistory && location.hash !== hash) history.pushState(null, '', hash);
  }

  function alignTo(hash, recordHistory = true, animated = false) {
    const target = destinationFor(hash);
    if (!target) return;
    const token = ++navigationToken;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Défilement doux uniquement pour la réservation; correction de fin au pixel.
    if (animated && !reduceMotion) {
      requestAnimationFrame(() => {
        jumpTo(hash, recordHistory, 'smooth');
        const settle = () => {
          if (token !== navigationToken || location.hash !== hash) return;
          const delta = target.getBoundingClientRect().top - OFFSET;
          // Ne pas ramener la page si la personne a volontairement défilé ailleurs.
          if (Math.abs(delta) > 2 && Math.abs(delta) < 140) jumpTo(hash, false);
        };
        if ('onscrollend' in window) window.addEventListener('scrollend', settle, {once: true});
        setTimeout(settle, 1000); // Repli pour Safari et versions sans scrollend.
      });
      return;
    }

    // Après fermeture du menu, polices chargées ou restauration de page, viser le même titre.
    requestAnimationFrame(() => {
      if (token !== navigationToken) return;
      jumpTo(hash, recordHistory);
      requestAnimationFrame(() => {
        if (token === navigationToken) jumpTo(hash, false);
      });
    });
    if (document.fonts) document.fonts.ready.then(() => {
      if (token === navigationToken && location.hash === hash)
        requestAnimationFrame(() => jumpTo(hash, false));
    });
  }

  menuButton.addEventListener('click', () => menuIsOpen() ? closeMenu() : openMenu());
  menuClose.addEventListener('click', () => closeMenu());
  menuPanel.addEventListener('click', event => {
    if (event.target === menuPanel) closeMenu();
  });

  document.addEventListener('click', event => {
    const anchor = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
    if (!anchor) return;
    const hash = anchor.getAttribute('href');
    if (!destinationFor(hash)) return;
    event.preventDefault();
    if (menuIsOpen()) closeMenu(false);
    alignTo(hash, true, hash === '#disponibilites' || hash === '#calendrier');
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
    if (menuIsOpen()) closeMenu(false);
    if (location.hash) alignTo(location.hash, false);
    else { ++navigationToken; window.scrollTo(0, 0); }
  });
  addEventListener('hashchange', () => {
    if (location.hash) alignTo(location.hash, false);
  });
  addEventListener('pageshow', () => {
    if (location.hash) alignTo(location.hash, false);
  });
  addEventListener('load', () => {
    if (location.hash) alignTo(location.hash, false);
  });
})();
