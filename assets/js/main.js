(() => {
  'use strict';

  const { products, categories, categoryLeads, compareLabels, video, social, reviews, store } = window.NEXURA;
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Must track the CSS breakpoint where the nav goes horizontal, or the menu drawer stays
  // open behind a nav bar that has already replaced it.
  const desktop = window.matchMedia('(min-width: 768px)');
  const rupiah = (n) => 'Rp' + new Intl.NumberFormat('id-ID').format(n);
  // Resolved from this script's own URL, so the same file draws product images on the home page
  // and on the products page without either page passing a base path in.
  const ASSETS = new URL('../', document.currentScript.src).href;
  const img = (name, size = 800) => `${ASSETS}img/${name}-${size}.webp`;
  const imgFallback = (name) => `${ASSETS}img/${name}.jpg`;
  // Pages too, so the site works under a sub-path (GitHub Pages serves it at /Nexura-Website/).
  const SITE = new URL('../../', document.currentScript.src).href;
  const PRODUCTS_PAGE = `${SITE}produk/`;
  const CHECKOUT_PAGE = `${SITE}checkout/`;
  const colorOf = (p, colorId) => (p.colors || []).find((c) => c.id === colorId) || (p.colors || [])[0] || null;
  const priceOf = (p, colorId) => (colorOf(p, colorId) && colorOf(p, colorId).price) || p.price;
  // The crossed-out price, or 0 when there is no real one above what the buyer pays.
  const wasOf = (p, colorId) => { const price = priceOf(p, colorId); return p.compareAt && p.compareAt > price ? p.compareAt : 0; };
  const imageOf = (p, colorId) => (colorOf(p, colorId) ? colorOf(p, colorId).image : p.image);
  const variantLabel = (p) => p.variantLabel || 'Warna';
  const soldLabel = (n) => (n >= 1000 ? `${Math.floor(n / 1000)}rb+` : String(n));
  const starsOf = (rating) => Math.round(parseFloat(String(rating).replace(',', '.')));
  const detailUrl = (p) => `${PRODUCTS_PAGE}detail/?id=${encodeURIComponent(p.id)}`;
  const icon = (id, cls = 'icon') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  // Five glyphs either way, the unearned ones filled in the border grey — a row that
  // shortens as the score drops reads as a different number of stars, not a lower score.
  const starGlyphs = (n) => Array.from({ length: 5 }, (_, i) =>
    `<svg class="icon${i < n ? '' : ' is-off'}" aria-hidden="true"><use href="#i-star"/></svg>`).join('');
  const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const live = $('[data-live]');
  const announce = (msg) => { live.textContent = ''; requestAnimationFrame(() => { live.textContent = msg; }); };

  /* Draco headlines: the skew that stands the face upright goes on each word, not the whole
     headline. Skewing the block leans its lines too, so a headline that wraps steps sideways
     line by line: a centred one drifts, a left-aligned one becomes a staircase. Each word as
     an inline-block skews about its own middle, so every line keeps its place. Text only:
     child elements (a .nowrap span) are walked into, and screen readers still get the words
     in order. Without this script the CSS skews the whole headline instead. */
  $$('.section-title').forEach((title) => {
    const wrap = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 1) { wrap(n); return; }
        if (n.nodeType !== 3 || !n.textContent.trim()) return;
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          const w = document.createElement('span');
          w.className = 'section-title__w';
          w.textContent = part;
          frag.appendChild(w);
        });
        n.replaceWith(frag);
      });
    };
    wrap(title);
    title.classList.add('is-worded');
  });

  /* Beranda motion, after gamesir.com's home page (its MotionReveal). The first time a block
     comes into view it eases into place over 850ms on cubic-bezier(.22, 1, .36, 1), from one
     of three starts: 20px to the left, 20px to the right, or 96% scale. Nothing rises and
     nothing is hidden first; only position and scale move. Headlines alternate sides down the
     page, the Produk Andalan rail comes in from the right as one, the video and the clips
     scale up, and the Teknologi cards take their side from where they sit in the grid (centred
     ones scale). Once landed, the block loses its motion attribute. Skipped for readers who
     ask for reduced motion. */
  if ($('main.home') && !reducedMotion.matches && 'IntersectionObserver' in window) {
    const set = (el, variant) => { if (el) el.dataset.reveal = variant; };
    // A section any of which is on screen when the page opens moves straight away, all of it,
    // rather than waiting for the reader to scroll it further in. Judged by the section, not
    // the block: on an iPhone in Safari the Produk Andalan head shows but its rail starts just
    // under the toolbar, and would otherwise slide in mid-scroll.
    const onScreen = (el) => {
      const r = (el.closest('section') || el).getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    };
    // Clears the motion once the block has landed (translate or scale, whichever it moved by).
    const reveal = (el) => {
      const done = (e) => {
        if (e.target !== el) return;
        el.removeEventListener('transitionend', done);
        delete el.dataset.reveal; el.classList.remove('is-revealed');
      };
      el.addEventListener('transitionend', done);
      el.classList.add('is-revealed');
    };
    const sides = ['slide-left', 'slide-right'];

    $$('.home .section-head').forEach((h, k) => set(h, sides[k % 2]));
    set($('#produk-grid'), 'slide-right');
    set($('[data-rail-ctrl="produk-grid"]'), 'slide-right');
    set($('.home .video'), 'scale');
    set($('#clips-rail'), 'scale');
    set($('[data-rail-ctrl="clips-rail"]'), 'scale');
    // Teknologi: per card from 600 up, by which third of the grid its middle falls in; on a
    // phone the cards are a coverflow that moves them itself, so the grid comes in whole.
    const techGrid = $('.home .tech-grid');
    if (techGrid && window.matchMedia('(min-width: 600px)').matches) {
      const g = techGrid.getBoundingClientRect();
      $$('.tech-card', techGrid).forEach((c) => {
        const r = c.getBoundingClientRect();
        const mid = (r.left + r.width / 2 - g.left) / g.width;
        set(c, mid < 0.4 ? 'slide-left' : mid > 0.6 ? 'slide-right' : 'scale');
      });
    } else set(techGrid, 'scale');

    // Waits until a block is a fifth of the screen in, so the move happens where the reader is
    // looking rather than at the bottom edge as the block first peeks in.
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      reveal(en.target);
      io.unobserve(en.target);
    }), { rootMargin: '0px 0px -20% 0px' });
    // two frames, so the start position paints before the first move
    requestAnimationFrame(() => requestAnimationFrame(() => $$('[data-reveal]').forEach((el) => {
      if (onScreen(el)) reveal(el); else io.observe(el);
    })));
  }

  const storage = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode: cart lives for this visit only */ } },
  };

  /* ------------------------------------------------------------------
     Overlays: drawers, backdrop, scroll lock, focus trap
     ------------------------------------------------------------------ */
  const backdrop = $('[data-backdrop]');
  let openDrawer = null;
  let returnFocus = null;

  const focusables = (root) => $$('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])', root)
    .filter((el) => el.offsetParent !== null);

  function lockScroll(lock) {
    const root = document.documentElement;
    if (lock) {
      const gap = window.innerWidth - root.clientWidth;
      root.style.overflow = 'hidden';
      if (gap) document.body.style.paddingRight = gap + 'px';
    } else {
      root.style.overflow = '';
      document.body.style.paddingRight = '';
    }
  }

  // `focusTarget` overrides where focus lands; by default it is the drawer's first control.
  function showDrawer(drawer, trigger, focusTarget) {
    if (openDrawer && openDrawer !== drawer) hideDrawer(openDrawer, false);
    openDrawer = drawer;
    returnFocus = trigger || document.activeElement;
    header.classList.remove('is-hidden'); // the bar owns the menu button the drawer returns focus to
    drawer.inert = false;
    backdrop.hidden = false;
    document.body.classList.add('is-overlay-open');
    lockScroll(true);
    requestAnimationFrame(() => {
      backdrop.classList.add('is-visible');
      drawer.classList.add('is-open');
    });
    $$(`[aria-controls="${drawer.id}"]`).forEach((b) => b.setAttribute('aria-expanded', 'true'));
    const first = focusables(drawer)[0];
    // wait for visibility to flip before moving focus
    setTimeout(() => (focusTarget || first || drawer).focus({ preventScroll: true }), 30);
  }

  function hideDrawer(drawer = openDrawer, restoreFocus = true) {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.inert = true;
    $$(`[aria-controls="${drawer.id}"]`).forEach((b) => b.setAttribute('aria-expanded', 'false'));
    if (openDrawer === drawer) {
      openDrawer = null;
      backdrop.classList.remove('is-visible');
      const done = () => { if (!openDrawer) backdrop.hidden = true; };
      reducedMotion.matches ? done() : setTimeout(done, 260);
      document.body.classList.remove('is-overlay-open');
      lockScroll(false);
      if (restoreFocus && returnFocus) returnFocus.focus({ preventScroll: true });
    }
  }

  backdrop.addEventListener('click', () => hideDrawer());
  $$('[data-drawer-close]').forEach((b) => b.addEventListener('click', () => hideDrawer()));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (openDrawer) { hideDrawer(); return; }
      closeDropdowns(true);
    }
    if (e.key === 'Tab' && openDrawer) {
      const items = focusables(openDrawer);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* Cart and checkout pin their pay bar to the screen's bottom below 900px. Its height changes
     (a hint line comes and goes), so it is measured into --dock-h, which the page keeps as room
     at its foot. Above 900px the bar is back in the side column and measures as in-flow, so
     the room is only kept while it is actually fixed. */
  const payDock = $('[data-pay-dock]');
  if (payDock) {
    const setDock = () => {
      const fixed = getComputedStyle(payDock).position === 'fixed';
      document.documentElement.style.setProperty('--dock-h', fixed ? `${payDock.offsetHeight}px` : '0px');
    };
    new ResizeObserver(setDock).observe(payDock);
    window.addEventListener('resize', setDock);
  }

  /* ------------------------------------------------------------------
     Navbar: dropdown, mobile menu, mobile search toggle
     ------------------------------------------------------------------ */
  const header = $('[data-header]');
  const dropdowns = $$('[data-dropdown]');

  function closeDropdowns(focusTrigger = false) {
    dropdowns.forEach((dd) => {
      if (!dd.classList.contains('is-open')) return;
      dd.classList.remove('is-open');
      const btn = $('button', dd);
      btn.setAttribute('aria-expanded', 'false');
      if (focusTrigger && dd.contains(document.activeElement)) btn.focus();
    });
  }

  dropdowns.forEach((dd) => {
    const btn = $('button', dd);
    let hoverTimer;
    const setOpen = (open) => {
      dd.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    };
    btn.addEventListener('click', () => setOpen(!dd.classList.contains('is-open')));
    // hover opens on pointer devices; a short delay on leave keeps it forgiving
    dd.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { clearTimeout(hoverTimer); setOpen(true); } });
    dd.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hoverTimer = setTimeout(() => setOpen(false), 160); });
    dd.addEventListener('focusout', (e) => { if (!dd.contains(e.relatedTarget)) setOpen(false); });
    $$('a', dd).forEach((a) => a.addEventListener('click', () => setOpen(false)));
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('[data-dropdown]')) closeDropdowns(); });

  const menuDrawer = $('[data-menu-drawer]');
  $('[data-menu-open]').addEventListener('click', (e) => showDrawer(menuDrawer, e.currentTarget));
  $$('a[href^="#"]', menuDrawer).forEach((a) => a.addEventListener('click', () => hideDrawer(menuDrawer, false)));

  // Beranda: scroll to the very top rather than under the sticky bar
  $$('a[href="#top"]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    history.replaceState(null, '', location.pathname + location.search);
  }));

  /* ------------------------------------------------------------------
     Search (client-side, over the catalog in data.js)
     ------------------------------------------------------------------ */
  const searchForm = $('[data-search]');
  const searchInput = $('#search-input');
  const searchList = $('#search-results');
  const searchToggle = $('[data-search-toggle]');
  const searchDialog = $('[data-search-dialog]');
  const searchHint = $('[data-search-hint]');
  let results = [];
  let activeIndex = -1;

  const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function runSearch(q) {
    const terms = normalize(q).trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return products.filter((p) => {
      const hay = normalize([p.name, p.short, categories[p.category], p.keywords || '', (p.colors || []).map((c) => c.label).join(' ')].join(' '));
      return terms.every((t) => hay.includes(t));
    });
  }

  function renderResults() {
    const q = searchInput.value.trim();
    searchHint.hidden = Boolean(q);
    if (!q) { closeSearch(); return; }
    results = runSearch(q);
    activeIndex = results.length ? 0 : -1;
    searchList.innerHTML = results.length
      ? results.map((p, i) => `
        <li class="search__option${p.stock === 'out' ? ' is-out' : ''}" id="search-opt-${i}" role="option" aria-selected="${i === activeIndex}"${p.stock === 'out' ? ' aria-disabled="true"' : ''} data-index="${i}">
          <img src="${img(imageOf(p), 160)}" alt="" width="44" height="44">
          <span><span class="search__option-name">${escapeHtml(p.short)}</span><br><span class="search__option-cat">${categories[p.category]}${p.stock === 'out' ? ' · Sold out' : ''}</span></span>
          <span class="price">${rupiah(p.price)}</span>
        </li>`).join('')
      : `<li class="search__empty" role="option" aria-disabled="true">Produk “${escapeHtml(q)}” nggak ketemu. Coba “cooler” atau “hydrogel”.</li>`;
    searchList.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
    updateActive();
  }

  function updateActive() {
    $$('.search__option', searchList).forEach((el, i) => el.setAttribute('aria-selected', String(i === activeIndex)));
    if (activeIndex >= 0) {
      searchInput.setAttribute('aria-activedescendant', `search-opt-${activeIndex}`);
      $(`#search-opt-${activeIndex}`).scrollIntoView({ block: 'nearest' });
    } else searchInput.removeAttribute('aria-activedescendant');
  }

  function closeSearch() {
    searchList.hidden = true;
    searchInput.setAttribute('aria-expanded', 'false');
    searchInput.removeAttribute('aria-activedescendant');
  }

  // A pick opens that product's page; a sold-out product has none to open.
  function chooseResult(i) {
    const p = results[i];
    if (p && p.stock !== 'out') location.href = detailUrl(p);
  }

  searchInput.addEventListener('input', renderResults);
  searchInput.addEventListener('focus', () => { if (searchInput.value.trim()) renderResults(); });
  searchInput.addEventListener('keydown', (e) => {
    if (searchList.hidden || !results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = (activeIndex + 1) % results.length; updateActive(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = (activeIndex - 1 + results.length) % results.length; updateActive(); }
  });
  searchForm.addEventListener('submit', (e) => { e.preventDefault(); if (activeIndex >= 0) chooseResult(activeIndex); });
  searchList.addEventListener('pointerdown', (e) => e.preventDefault()); // keep focus in the input
  searchList.addEventListener('click', (e) => { const opt = e.target.closest('[data-index]'); if (opt) chooseResult(Number(opt.dataset.index)); });

  // The dialog handles Escape and returns focus to the icon itself. A click on its backdrop
  // lands on the <dialog> element, outside the form, so that closes it too.
  searchToggle.addEventListener('click', () => {
    searchDialog.showModal();
    searchToggle.setAttribute('aria-expanded', 'true');
    searchInput.select();
    if (searchInput.value.trim()) renderResults();
  });
  $('[data-search-close]', searchDialog).addEventListener('click', () => searchDialog.close());
  searchDialog.addEventListener('click', (e) => { if (e.target === searchDialog) searchDialog.close(); });
  searchDialog.addEventListener('close', () => {
    closeSearch();
    searchToggle.setAttribute('aria-expanded', 'false');
  });

  /* ------------------------------------------------------------------
     Header retracts on scroll down, returns on scroll up — except on the product page, where
     the bar stays put the whole way down
     ------------------------------------------------------------------ */
  if (!document.querySelector('.pdp')) {
    const THRESHOLD = 6; // ignore sub-pixel jitter and trackpad noise
    let lastY = window.scrollY;
    let headerH = header.offsetHeight;
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY;
      // keep the bar put while an overlay, the search panel or a focused control needs it
      const pinned = openDrawer || searchDialog.open || header.contains(document.activeElement);
      if (pinned || y <= headerH) header.classList.remove('is-hidden');
      else if (Math.abs(delta) > THRESHOLD) header.classList.toggle('is-hidden', delta > 0);
      if (Math.abs(delta) > THRESHOLD) lastY = y;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', () => { headerH = header.offsetHeight; });
    header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
  }


  /* ------------------------------------------------------------------
     Hero slider (native scroll-snap; JS only adds arrows, dots, autoplay)
     ------------------------------------------------------------------ */
  const hero = $('[data-hero]');
  if (hero) {
    const track = $('[data-hero-track]', hero);
    const slides = $$('.hero__slide', track);
    const dots = $$('button', $('[data-hero-dots]', hero));
    const fills = $$('.hero__dot-fill', hero);
    const AUTOPLAY = 6000;
    let current = 0;
    let paused = false;

    // Wrapping last -> first by scrolling back to 0 reads as a rewind. Instead a clone of
    // slide 0 sits after the last slide, so autoplay keeps travelling forward into it; once
    // it settles we snap to the real slide 0, which is pixel-identical, so the jump is
    // invisible. Kept inert + aria-hidden so AT and keyboard never see the duplicate.
    const clone = slides[0].cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.removeAttribute('aria-label');
    clone.inert = true;
    track.appendChild(clone);
    const CLONE = slides.length;          // scroll index of the clone
    const slidesAll = [...slides, clone];
    const realOf = (i) => i % slides.length;

    // The progress bar and the timer are the same thing: the slide advances when the active
    // dot finishes filling, so pausing the animation pauses the carousel exactly in step.
    hero.style.setProperty('--autoplay', AUTOPLAY + 'ms');
    const setPaused = (v) => { paused = v; hero.classList.toggle('is-paused', v); };

    // Takes a scroll index, which may be CLONE — one past the last real slide.
    const goTo = (i, smooth = true) => {
      track.scrollTo({ left: i * track.clientWidth, behavior: smooth && !reducedMotion.matches ? 'smooth' : 'auto' });
    };
    const setCurrent = (i) => {
      current = i;
      dots.forEach((d, k) => (k === i ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
      // keep keyboard users out of off-screen slides
      slides.forEach((s, k) => { s.inert = k !== i; });
    };
    setCurrent(0);

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting && en.intersectionRatio > 0.6) setCurrent(realOf(slidesAll.indexOf(en.target)));
      });
    }, { root: track, threshold: [0.6] });
    slidesAll.forEach((s) => io.observe(s));

    // Runs on every rest, so a manual swipe onto the clone is rebased too. The active dot's
    // fill already restarted when the clone came into view, so it is left alone here.
    const normalize = () => {
      if (Math.round(track.scrollLeft / track.clientWidth) === CLONE) goTo(0, false);
    };
    if ('onscrollend' in window) {
      track.addEventListener('scrollend', normalize);
    } else {
      let idle;
      track.addEventListener('scroll', () => { clearTimeout(idle); idle = setTimeout(normalize, 140); }, { passive: true });
    }

    $('[data-hero-prev]', hero).addEventListener('click', () => goTo((current - 1 + slides.length) % slides.length));
    $('[data-hero-next]', hero).addEventListener('click', () => goTo(current + 1));
    dots.forEach((d, k) => d.addEventListener('click', () => goTo(k)));

    fills.forEach((f) => f.addEventListener('animationend', (e) => {
      // reduced motion collapses every animation to ~0s, so never autoplay off it
      if (e.animationName !== 'dot-progress' || reducedMotion.matches) return;
      if (!paused && !document.hidden && !openDrawer) goTo(current + 1);
    }));

    hero.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') setPaused(true); });
    hero.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') setPaused(false); });
    hero.addEventListener('focusin', () => setPaused(true));
    hero.addEventListener('focusout', (e) => { if (!hero.contains(e.relatedTarget)) setPaused(false); });
    track.addEventListener('touchstart', () => setPaused(true), { passive: true });
    track.addEventListener('touchend', () => setPaused(false), { passive: true });
    window.addEventListener('resize', () => goTo(current, false));
  }

  /* ------------------------------------------------------------------
     Product cards (one template for the home grid and the products page)
     ------------------------------------------------------------------ */
  // `heading` follows the page outline: h3 under the home page's section h2, h2 under the
  // products page's h1. `eager` skips lazy loading for the cards that land above the fold.
  /* A review as its own Tokopedia screenshot, untouched, so a buyer sees the real thing (the
     home page's rows and the product page's Ulasan tab). The words are its alt text, so a
     screen reader hears the review too. Drawn over the screenshot, not into it: a second set of
     stars laid exactly on the screenshot's own, which lift and glow when the card pops, and a
     sticker quoting a few of the reviewer's own words; both decoration. The card is a button
     that opens the screenshot full size (openReviewZoom). `dup` is the home rows' loop copy: a
     plain picture, hidden from screen readers. */
  function reviewShotHTML(r, dup = false) {
    const alt = `Ulasan bintang ${r.rating} dari ${r.name}${r.variant ? `, varian ${r.variant}` : ''}: ${r.text}`;
    const img = `<img src="${ASSETS}img/reviews/${r.screenshot}.webp" alt="${dup ? '' : escapeHtml(alt)}" loading="lazy" decoding="async">`;
    const extras = `<span class="review-shot__stars" aria-hidden="true">${starGlyphs(r.rating)}</span>${
      r.highlight ? `<span class="review-shot__tag" aria-hidden="true">\u201c${escapeHtml(r.highlight)}\u201d</span>` : ''}`;
    return dup
      ? `<figure class="review-shot review--dup" aria-hidden="true">${img}${extras}</figure>`
      : `<figure class="review-shot"><button class="review-shot__btn" type="button" data-review-zoom aria-label="Perbesar ulasan dari ${escapeHtml(r.name)}">${img}</button>${extras}</figure>`;
  }

  /* Full-size view of one review screenshot: a modal dialog, closed by its button, Escape, or a
     tap outside the picture. Built on first use, so any page with screenshot cards gets it.
     Taps on [data-review-zoom] inside `scope` open it; onToggle(open) lets the caller pause. */
  function wireReviewZoom(scope, onToggle = () => {}) {
    let zoom = $('[data-review-dialog]');
    if (!zoom) {
      zoom = document.createElement('dialog');
      zoom.className = 'review-zoom';
      zoom.dataset.reviewDialog = '';
      zoom.setAttribute('aria-label', 'Ulasan pembeli');
      zoom.innerHTML = `<button class="review-zoom__close" type="button" data-review-close aria-label="Tutup">${icon('x')}</button><img alt="">`;
      document.body.appendChild(zoom);
    }
    const zoomImg = $('img', zoom);
    scope.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-review-zoom]');
      if (!btn) return;
      const src = $('img', btn);
      zoomImg.src = src.currentSrc || src.src;
      zoomImg.alt = src.alt;
      zoom.showModal();
      onToggle(true);
    });
    if (!zoom.dataset.wired) {
      zoom.dataset.wired = '1';
      zoom.addEventListener('click', (e) => { if (e.target === zoom || e.target.closest('[data-review-close]')) zoom.close(); });
    }
    zoom.addEventListener('close', () => onToggle(false));
  }

  function cardHTML(p, { heading = 'h3', eager = false } = {}) {
    const color = colorOf(p);
    // `cover` is a lineup shot that beats any single variant on a card (see Reflex).
    const image = p.cover || imageOf(p, color && color.id);
    // Sold out: a "Sold Out" disc over the picture and no link, so the card cannot be opened.
    const out = p.stock === 'out';
    return `
      <article class="product-card${out ? ' is-out' : ''}" id="produk-${p.id}" data-id="${p.id}" data-category="${p.category}">
          ${p.compareAt && !out ? `<span class="product-card__off"><span class="sr-only">Diskon </span>${Math.round((1 - priceOf(p, color && color.id) / p.compareAt) * 100)}%</span>` : ''}
        <div class="product-card__media">
          <picture>
            <source type="image/webp" srcset="${img(image)}">
            <img src="${imgFallback(image)}" width="800" height="800" ${eager ? '' : 'loading="lazy" '}decoding="async" alt="${escapeHtml(p.alt)}${color && !p.cover ? ` ${variantLabel(p).toLowerCase()} ${color.label.toLowerCase()}` : ''}">
          </picture>
          ${out ? '<span class="sold-out" aria-hidden="true">Sold<br>Out</span>' : ''}
        </div>
        <div class="product-card__body">
          <${heading} class="product-card__name" title="${escapeHtml(p.name)}">${out
            ? `${escapeHtml(p.name)}<span class="sr-only"> (sold out)</span>`
            : `<a class="product-card__link" href="${detailUrl(p)}" data-product-link>${escapeHtml(p.name)}</a>`}</${heading}>
          <p class="product-card__price">
            <span class="price" data-price>${rupiah(priceOf(p, color && color.id))}</span>
            ${p.compareAt ? `<s class="price-was"><span class="sr-only">Harga normal </span>${rupiah(p.compareAt)}</s>` : ''}
          </p>
          ${p.note ? `<p class="product-card__note">${escapeHtml(p.note)}</p>` : ''}
          <p class="product-card__meta">${[
            p.rating ? `<span class="product-card__rating">${icon('star')}<span class="sr-only">Rating </span>${p.rating}</span>` : '',
            p.sold ? `<span>${soldLabel(p.sold)} terjual</span>` : '',
          ].filter(Boolean).join('<span class="product-card__dot" aria-hidden="true"></span>')}<span class="product-card__cat">${escapeHtml(categories[p.category] || '')}</span></p>
        </div>
      </article>`;
  }

  const replayEnter = (card) => {
    if (reducedMotion.matches) return;
    card.classList.remove('is-entering'); void card.offsetWidth; card.classList.add('is-entering');
  };

  /* ------------------------------------------------------------------
     Home: Produk Andalan
     ------------------------------------------------------------------ */
  const grid = $('[data-product-grid]');
  if (grid) {
    // A rail of six in stock: featured first, then best sellers, so a sold-out product drops
    // out on its own. The tile closes the rail and leaves for the products page.
    const RAIL = 6;
    grid.innerHTML = products.filter((p) => p.stock !== 'out')
      .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (a.popular || 99) - (b.popular || 99))
      .slice(0, RAIL).map((p) => cardHTML(p)).join('') + `
      <a class="more-card" href="${PRODUCTS_PAGE}">
        <span class="more-card__icon">${icon('arrow-right', 'icon')}</span>
        <span class="more-card__label">Lihat produk lainnya</span>
      </a>`;
  }

  /* ------------------------------------------------------------------
     Home rails (Produk Andalan, clips): dots, arrows, autoplay
     ------------------------------------------------------------------ */
  /* After GameSir's product carousel: every 5s the rail moves one stop on, in 300ms on an
     `ease` curve (Swiper's defaults), and after the last stop it slides back to the first.
     A stop is one card further along, or with data-rail-page one screenful (two cards on a
     phone, three on a tablet, four on desktop), so a rail of 7 showing 2 has 4 stops and 4
     dots, the last at the far end. The rails swipe by hand too, snapping to the same stops
     (CSS snaps to the cards marked .is-snap); the dots follow the scroll.
     The active dot's fill is the timer: the rail moves on when it is full, so pausing the
     fill pauses the rail in step. Unlike GameSir it pauses while the pointer, a finger or
     focus is on it, and while it is off screen, so a card never slides out from under a
     reader. Reduced motion: no autoplay, the arrows and dots still work. */
  const RAIL_AUTOPLAY = 5000;
  const RAIL_SPEED = 300;
  // CSS `ease`, cubic-bezier(.25, .1, .25, 1), solved for y at time t
  const ease = (t) => {
    const bez = (a, b, u) => 3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;
    let lo = 0, hi = 1, u = t;
    for (let k = 0; k < 20; k++) { u = (lo + hi) / 2; if (bez(.25, .25, u) < t) lo = u; else hi = u; }
    return bez(.1, 1, u);
  };

  $$('[data-rail]').forEach((rail) => {
    const ctrl = $(`[data-rail-ctrl="${rail.id}"]`);
    if (!ctrl) return;
    const dotsBox = $('[data-rail-dots]', ctrl);
    const prev = $('[data-rail-prev]', ctrl);
    const next = $('[data-rail-next]', ctrl);
    const items = [...rail.children];
    let stops = 0, step = 0, current = -1, anim = 0;
    let hovered = false, focused = false, touching = false, visible = false;
    ctrl.style.setProperty('--rail-autoplay', RAIL_AUTOPLAY + 'ms');

    const maxScroll = () => rail.scrollWidth - rail.clientWidth;
    const leftOf = (i) => Math.min(i * step, maxScroll());

    const setPaused = () => ctrl.classList.toggle('is-paused', hovered || focused || touching || !visible);

    const setCurrent = (i) => {
      if (i === current) return;
      current = i;
      $$('button', dotsBox).forEach((d, k) => (k === i ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
      prev.setAttribute('aria-disabled', String(i <= 0));
      next.setAttribute('aria-disabled', String(i >= stops - 1));
    };

    // Measures the rail: how far one card moves it, and how many stops that leaves. Rebuilds
    // the dots only when the count changes (a breakpoint), so the active fill isn't restarted
    // by every resize.
    const measure = () => {
      const card = items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : rail.clientWidth;
      let per = 1;
      if (rail.hasAttribute('data-rail-page') && items.length > 1) {
        const gap = card - items[0].offsetWidth;
        const col = rail.clientWidth - parseFloat(getComputedStyle(rail).paddingLeft);
        per = Math.max(1, Math.floor((col + gap) / card + 0.01));
      }
      items.forEach((it, k) => it.classList.toggle('is-snap', k % per === 0));
      step = card * per;
      // the last stop is the far end, even when it is less than a screenful on
      const n = step > 0 ? Math.ceil(maxScroll() / step - 0.01) + 1 : 1;
      ctrl.hidden = n < 2;
      if (n !== stops) {
        stops = n;
        dotsBox.innerHTML = Array.from({ length: n }, (_, k) =>
          `<button type="button" aria-label="Ke posisi ${k + 1} dari ${n}"></button>`).join('');
        current = -1;
      }
      sync();
    };
    // the stop nearest the scroll position; the last one is the far end, wherever it lands
    const sync = () => {
      const x = rail.scrollLeft;
      setCurrent(x >= maxScroll() - 2 ? stops - 1 : Math.min(stops - 1, Math.round(x / step)));
    };

    const cancel = () => {
      if (anim) { cancelAnimationFrame(anim); anim = 0; }
      rail.classList.remove('is-tweening');
    };
    // Its own 300ms tween rather than scrollTo's smooth, whose length the browser picks.
    const goTo = (i) => {
      i = Math.max(0, Math.min(stops - 1, i));
      cancel();
      const from = rail.scrollLeft, to = leftOf(i);
      setCurrent(i);
      rail.classList.add('is-tweening');
      if (reducedMotion.matches || from === to) { rail.scrollLeft = to; cancel(); return; }
      const t0 = performance.now();
      const frame = (now) => {
        const t = Math.min(1, (now - t0) / RAIL_SPEED);
        rail.scrollLeft = from + (to - from) * ease(t);
        if (t < 1) anim = requestAnimationFrame(frame); else { anim = 0; cancel(); }
      };
      anim = requestAnimationFrame(frame);
    };

    let ticking = false;
    rail.addEventListener('scroll', () => {
      if (anim || ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; sync(); });
    }, { passive: true });

    prev.addEventListener('click', () => { if (current > 0) goTo(current - 1); });
    next.addEventListener('click', () => { if (current < stops - 1) goTo(current + 1); });
    dotsBox.addEventListener('click', (e) => {
      const d = e.target.closest('button');
      if (d) goTo($$('button', dotsBox).indexOf(d));
    });

    // the fill finishing is the tick; after the last stop the rail slides back to the first
    dotsBox.addEventListener('animationend', (e) => {
      if (e.animationName !== 'dot-progress' || reducedMotion.matches) return;
      if (ctrl.classList.contains('is-paused') || document.hidden || openDrawer) return;
      goTo(current >= stops - 1 ? 0 : current + 1);
    });

    const zone = [rail, ctrl];
    zone.forEach((el) => {
      el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hovered = true; setPaused(); } });
      el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { hovered = false; setPaused(); } });
      el.addEventListener('focusin', () => { focused = true; setPaused(); });
      el.addEventListener('focusout', (e) => { if (!zone.some((z) => z.contains(e.relatedTarget))) { focused = false; setPaused(); } });
    });
    // a finger on the rail takes over from a tween still running
    rail.addEventListener('touchstart', () => { cancel(); touching = true; setPaused(); }, { passive: true });
    rail.addEventListener('touchend', () => { touching = false; setPaused(); }, { passive: true });

    new IntersectionObserver(([en]) => { visible = en.isIntersecting; setPaused(); }, { threshold: 0.5 }).observe(rail);
    // Only a change of width re-measures; images loading in change the height, and re-seating
    // the rail then would yank it out from under a swipe.
    let lastWidth = 0;
    new ResizeObserver(() => {
      if (rail.clientWidth === lastWidth) return;
      lastWidth = rail.clientWidth;
      cancel(); measure(); rail.scrollLeft = leftOf(Math.max(0, current));
    }).observe(rail);
    setPaused();
    measure();
  });

  /* ------------------------------------------------------------------
     Products page: category chips, the Filter menu, the count
     ------------------------------------------------------------------ */
  const catalog = $('[data-catalog]');
  if (catalog) {
    const catalogGrid = $('[data-catalog-grid]', catalog);
    const rail = $('[data-chip-rail]', catalog);
    const chips = $$('[data-cat]', rail);
    const menuWraps = $$('[data-menu-wrap]', catalog);
    const menuReset = $('[data-menu-reset]', catalog);
    const stockItem = $('[data-stock]', catalog);
    const sortItems = $$('[data-sort]', catalog);
    const activeDot = $('[data-filter-dot]', catalog);
    const barCount = $('[data-bar-count]', catalog);
    const empty = $('[data-catalog-empty]', catalog);
    const count = $('[data-catalog-count]', catalog);
    const searchField = $('[data-catalog-search]', catalog);
    const title = $('[data-page-title]');
    const lead = $('[data-page-lead]');
    const head = $('.page-head');

    // Ties fall back to popularity, so equal prices still come out in a stable, sensible order.
    // `added` is ISO, so the dates sort correctly as plain strings.
    const SORTS = {
      termurah: { label: 'Harga Termurah', cmp: (a, b) => priceOf(a) - priceOf(b) },
      tertinggi: { label: 'Harga Tertinggi', cmp: (a, b) => priceOf(b) - priceOf(a) },
      terbaru: { label: 'Terbaru', cmp: (a, b) => (b.added || '').localeCompare(a.added || '') },
      terpopuler: { label: 'Terpopuler', cmp: () => 0 },
    };
    const byPopular = (a, b) => (a.popular || 99) - (b.popular || 99);
    const DEFAULTS = { category: 'all', sort: 'terpopuler', inStock: false, q: '' };
    const state = { ...DEFAULTS };

    // The URL carries the state, so a filtered list can be shared, bookmarked and reloaded, and
    // the navbar's category links can land straight on their category.
    const params = new URLSearchParams(location.search);
    if (categories[params.get('kategori')]) state.category = params.get('kategori');
    if (SORTS[params.get('urutkan')]) state.sort = params.get('urutkan');
    state.inStock = params.get('stok') === 'tersedia';
    state.q = params.get('cari') || '';

    const compare = (a, b) => SORTS[state.sort].cmp(a, b) || byPopular(a, b);
    const isDefault = () => state.sort === DEFAULTS.sort && state.inStock === DEFAULTS.inStock
      && state.category === DEFAULTS.category && !state.q.trim();
    const categoryLabel = () => (state.category === 'all' ? 'Semua Produk' : categories[state.category]);

    // Drawn once in the opening order, then only reordered and hidden — the nodes, and the
    // images already decoded inside them, survive every filter change.
    catalogGrid.innerHTML = [...products].sort(compare)
      .map((p, i) => cardHTML(p, { heading: 'h2', eager: i < 4 })).join('');
    const cardOf = Object.fromEntries($$('.product-card', catalogGrid).map((c) => [c.dataset.id, c]));

    function syncUrl() {
      const q = new URLSearchParams();
      if (state.category !== DEFAULTS.category) q.set('kategori', state.category);
      if (state.sort !== DEFAULTS.sort) q.set('urutkan', state.sort);
      if (state.inStock) q.set('stok', 'tersedia');
      if (state.q.trim()) q.set('cari', state.q.trim());
      const s = q.toString();
      history.replaceState(null, '', location.pathname + (s ? `?${s}` : ''));
    }

    // The headline names the category, so a chip reads as arriving somewhere
    // rather than as hiding cards.
    function syncHeading() {
      const label = categoryLabel();
      title.textContent = label;
      lead.textContent = categoryLeads[state.category] || '';
      // No category shows the band (see .page-head[data-cat] in the CSS).
      head.dataset.cat = state.category;
      document.title = `${label} — Nexura | #GearYourAura`;
    }

    function apply({ animate = false, url = true } = {}) {
      // Same matching as the navbar search: every word must appear somewhere in the product.
      const hits = state.q.trim() ? new Set(runSearch(state.q)) : null;
      const list = products
        .filter((p) => !hits || hits.has(p))
        .filter((p) => state.category === 'all' || p.category === state.category)
        .filter((p) => !state.inStock || p.stock !== 'out')
        .sort(compare);
      const shown = new Set(list.map((p) => p.id));

      list.forEach((p) => catalogGrid.appendChild(cardOf[p.id]));
      Object.values(cardOf).forEach((card) => {
        card.hidden = !shown.has(card.dataset.id);
        if (animate && !card.hidden) replayEnter(card);
      });

      chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.cat === state.category)));
      stockItem.setAttribute('aria-checked', String(state.inStock));
      sortItems.forEach((it) => it.setAttribute('aria-checked', String(it.dataset.sort === state.sort)));
      activeDot.hidden = !state.inStock && state.sort === DEFAULTS.sort;
      menuReset.hidden = isDefault();

      empty.hidden = list.length > 0;
      count.hidden = list.length === 0;
      $('[data-count-shown]', count).textContent = list.length;
      $('[data-count-total]', count).textContent = products.length;
      if (searchField.value !== state.q) searchField.value = state.q;
      barCount.textContent = list.length;

      syncHeading();
      if (url) syncUrl();
      return list.length;
    }

    const countMessage = (n) => `Menampilkan ${n} produk dari ${products.length} produk.`;

    function setCategory(cat, { scroll = false } = {}) {
      state.category = cat === 'all' || !categories[cat] ? 'all' : cat;
      const n = apply({ animate: true });
      keepChipInView();
      if (scroll) window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      announce(`${categoryLabel()}. ${countMessage(n)}`);
    }

    chips.forEach((chip) => chip.addEventListener('click', () => setCategory(chip.dataset.cat)));

    // The navbar dropdown, the menu drawer and the footer all carry
    // data-filter. Here they switch the list in place instead of reloading the same page; a
    // modified click still opens a new tab the way a link should.
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-filter]');
      if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      if (openDrawer) hideDrawer(openDrawer, false);
      setCategory(link.dataset.filter, { scroll: !link.closest('[data-catalog]') });
    });

    // Two of these: in the Filter menu, and in the empty state when nothing matches.
    function resetFilters() {
      Object.assign(state, DEFAULTS);
      const n = apply({ animate: true });
      keepChipInView();
      announce(`Filter direset. ${countMessage(n)}`);
    }
    $('[data-catalog-reset]', empty).addEventListener('click', resetFilters);

    // Filters on every keystroke; the count is announced once typing pauses.
    let searchIdle;
    searchField.addEventListener('input', () => {
      state.q = searchField.value;
      const n = apply();
      clearTimeout(searchIdle);
      searchIdle = setTimeout(() => announce(countMessage(n)), 500);
    });

    // The chip rail scrolls sideways on narrow screens. Each end fades only while there is more
    // to scroll that way, so a row that fits shows no fade at all.
    function updateRail() {
      const max = rail.scrollWidth - rail.clientWidth;
      rail.classList.toggle('has-more-start', rail.scrollLeft > 2);
      rail.classList.toggle('has-more-end', rail.scrollLeft < max - 2);
    }
    function keepChipInView() {
      const chip = chips.find((c) => c.dataset.cat === state.category);
      if (!chip) return;
      const left = chip.offsetLeft - rail.offsetLeft;
      if (left < rail.scrollLeft || left + chip.offsetWidth > rail.scrollLeft + rail.clientWidth) {
        rail.scrollTo({ left: left - 24, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      }
    }
    rail.addEventListener('scroll', updateRail, { passive: true });
    window.addEventListener('resize', updateRail);

    /* Filter menu — the WAI-ARIA menu button pattern: arrows move, Home/End jump, Escape closes
       and hands focus back, Tab closes and lets focus carry on. The stock toggle is a checkbox
       and leaves the menu open, so a sort can be picked straight after; a sort is a single
       choice and closes it. Written per [data-menu-wrap], one open at a time, should a second
       menu join the bar. */
    menuWraps.forEach((wrap) => {
      const btn = $('[aria-haspopup="menu"]', wrap);
      const menu = $('[role="menu"]', wrap);
      const allItems = $$('[role^="menuitem"]', menu);
      // The reset item is hidden while everything is at its default, so the keys skip it then.
      const items = () => allItems.filter((it) => !it.closest('[hidden]'));
      const isOpen = () => wrap.classList.contains('is-open');
      function open(which = 'first') {
        menuWraps.forEach((w) => { if (w !== wrap) w.dispatchEvent(new Event('menu:close')); });
        wrap.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
        const list = items();
        (which === 'last' ? list[list.length - 1] : list[0]).focus();
      }
      function close(restoreFocus = true) {
        if (!isOpen()) return;
        wrap.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        if (restoreFocus) btn.focus();
      }
      wrap.addEventListener('menu:close', () => close(false));

      btn.addEventListener('click', () => (isOpen() ? close() : open()));
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); open('first'); }
        if (e.key === 'ArrowUp') { e.preventDefault(); open('last'); }
      });
      menu.addEventListener('keydown', (e) => {
        const list = items();
        const i = list.indexOf(document.activeElement);
        const focusAt = (n) => { e.preventDefault(); list[(n + list.length) % list.length].focus(); };
        if (e.key === 'ArrowDown') focusAt(i + 1);
        else if (e.key === 'ArrowUp') focusAt(i - 1);
        else if (e.key === 'Home') focusAt(0);
        else if (e.key === 'End') focusAt(list.length - 1);
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
        else if (e.key === 'Tab') close(false);
      });
      menu.addEventListener('click', (e) => {
        const item = e.target.closest('[role^="menuitem"]');
        if (!item) return;
        if (item.matches('[data-catalog-reset]')) {
          // The item hides itself once everything is back to default, so focus goes to the button.
          close();
          resetFilters();
        } else if (item === stockItem) {
          state.inStock = !state.inStock;
          const n = apply({ animate: true });
          announce(`${state.inStock ? 'Hanya stok tersedia' : 'Semua stok'}. ${countMessage(n)}`);
        } else {
          state.sort = item.dataset.sort;
          const n = apply({ animate: true });
          close();
          announce(`Diurutkan: ${SORTS[state.sort].label}. ${countMessage(n)}`);
        }
      });
      document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) close(false); });
    });

    apply({ url: false });
    updateRail();
    keepChipInView();
  }

  /* ------------------------------------------------------------------
     Cart
     ------------------------------------------------------------------ */
  const cart = (() => {
    const KEY = 'nexura-cart-v1';
    const badge = $('[data-cart-badge]');
    const trigger = $('[data-cart-open]');

    const load = () => (storage.get(KEY) || []).filter((it) => byId[it.id] && byId[it.id].stock !== 'out' && it.qty > 0)
      .map((it) => ({ id: it.id, color: colorOf(byId[it.id], it.color)?.id || null, qty: Math.min(99, it.qty | 0), checked: it.checked !== false, phone: it.phone || '' }));
    let items = load();
    // The cart page draws the same items; it re-renders whenever anything here changes them.
    const listeners = [];
    const notify = () => listeners.forEach((fn) => fn());

    // The same sheet cut for two different phones is two lines, not one line of two.
    const keyOf = (it) => `${it.id}:${it.color || ''}:${(it.phone || '').toLowerCase()}`;
    const count = () => items.reduce((n, it) => n + it.qty, 0);
    const label = (it) => { const p = byId[it.id]; const c = colorOf(p, it.color); return c ? `${p.short} ${c.label}` : p.short; };
    const save = () => { storage.set(KEY, items); notify(); };

    function render() {
      const n = count();
      badge.hidden = n === 0;
      badge.textContent = n > 9 ? '9+' : String(n);
      trigger.setAttribute('aria-label', n ? `Keranjang, ${n} item` : 'Keranjang, kosong');
    }

    // On the cart page the icon goes to the top of the page instead of reloading it.
    trigger.addEventListener('click', (e) => {
      if (!$('[data-cartpage]')) return;
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    });

    function bump() {
      if (reducedMotion.matches) return;
      badge.classList.remove('is-bump'); void badge.offsetWidth; badge.classList.add('is-bump');
    }

    // Another tab changed the cart: pick it up, so the two never disagree.
    window.addEventListener('storage', (e) => {
      if (e.key !== KEY) return;
      items = load();
      render(); notify();
    });

    render();

    return {
      list: () => items,
      keyOf, label,
      // The cart page edits by handing back a whole new list (also how its undo restores one).
      set(next) { items = next; save(); render(); },
      onChange(fn) { listeners.push(fn); },
      add(id, colorId, qty = 1, phone = '') {
        const p = byId[id];
        if (!p || p.stock === 'out') return;
        const color = colorOf(p, colorId);
        const it = { id, color: color ? color.id : null, qty: Math.min(99, qty), checked: true, phone };
        const existing = items.find((x) => keyOf(x) === keyOf(it));
        if (existing) { existing.qty = Math.min(99, existing.qty + qty); existing.checked = true; }
        else items.push(it);
        save(); render(); bump();
        announce(`${qty > 1 ? qty + ' ' : ''}${label(it)} masuk keranjang. Total ${count()} item.`);
      },
    };
  })();

  /* ------------------------------------------------------------------
     Cart page (/keranjang/)
     The cart's items, laid out in full: every line with its variant, phone model,
     discount and own subtotal, a select-all bar, and a summary that breaks the total down.
     Edits go through cart.set, so the badge follows.
     ------------------------------------------------------------------ */
  const cartPage = $('[data-cartpage]');
  if (cartPage) {
    const filled = $('[data-cartpage-filled]', cartPage);
    const emptyEl = $('[data-cartpage-empty]', cartPage);
    const list = $('[data-cartpage-list]', cartPage);
    const all = $('[data-select-all]', cartPage);
    const lines = $('[data-cartpage-lines]', cartPage);
    const clearBtn = $('[data-remove-selected]', cartPage);
    const undoBar = $('[data-undo]', cartPage);
    const undoText = $('[data-undo-text]', cartPage);
    const payBtn = $('[data-cartpage-checkout]', cartPage);
    const payHint = $('[data-pay-hint]', cartPage);
    const promoSheet = $('[data-promo-sheet]', cartPage);
    const promoScrim = $('[data-promo-scrim]', cartPage);
    const promoToggle = $('[data-promo-toggle]', cartPage);
    const { keyOf, label } = cart;
    const lineUrl = (it) => detailUrl(byId[it.id]) + (it.color ? `&varian=${encodeURIComponent(it.color)}` : '');
    let undo = null;
    let undoTimer;

    function rowHTML(it) {
      const p = byId[it.id];
      const c = colorOf(p, it.color);
      const price = priceOf(p, it.color);
      const was = wasOf(p, it.color);
      const name = escapeHtml(label(it));
      return `
        <li class="cp-item${it.checked ? '' : ' is-unchecked'}" data-key="${escapeHtml(keyOf(it))}">
          <label class="cart-item__check cp-item__check">
            <input type="checkbox" ${it.checked ? 'checked' : ''} aria-label="Pilih ${name}" data-act="check">
            <span class="cart-item__box">${icon('check')}</span>
          </label>
          <a class="cp-item__thumb" href="${lineUrl(it)}" tabindex="-1" aria-hidden="true">
            <img src="${img(imageOf(p, it.color), 160)}" alt="" width="160" height="160" decoding="async">
            ${was ? `<span class="cp-item__off">-${Math.round((1 - price / was) * 100)}%</span>` : ''}
          </a>
          <div class="cp-item__info">
            <a class="cp-item__name" href="${lineUrl(it)}">${escapeHtml(p.name)}</a>
            <p class="cp-item__variant">${c ? `${variantLabel(p)}: ${escapeHtml(c.label)}` : escapeHtml(categories[p.category])}</p>
            ${it.phone ? `<p class="cp-item__variant">Tipe HP: ${escapeHtml(it.phone)}</p>` : ''}
            ${p.stock === 'low' ? '<p class="cp-item__stock">Stok terakhir</p>' : ''}
          </div>
          <p class="cp-item__price">
            <span class="price">${rupiah(price)}</span>
            ${was ? `<span class="cp-item__was"><s class="price-was"><span class="sr-only">Harga normal </span>${rupiah(was)}</s>
            <span class="cp-item__pct" aria-hidden="true">${Math.round((1 - price / was) * 100)}%</span></span>` : ''}
          </p>
          <div class="cp-item__actions">
            ${it.qty > 1 ? `<p class="cp-item__sub">Subtotal <strong class="price">${rupiah(price * it.qty)}</strong></p>` : ''}
            <div class="stepper" role="group" aria-label="Jumlah ${name}">
              <button type="button" aria-label="Kurangi" data-act="dec" ${it.qty <= 1 ? 'disabled' : ''}>${icon('minus')}</button>
              <output aria-live="polite">${it.qty}</output>
              <button type="button" aria-label="Tambah" data-act="inc" ${it.qty >= 99 ? 'disabled' : ''}>${icon('plus')}</button>
            </div>
          </div>
        </li>`;
    }

    // Everything here counts the ticked lines only: what "Beli" would actually buy.
    function totals() {
      return cart.list().filter((it) => it.checked).reduce((t, it) => {
        const p = byId[it.id];
        const price = priceOf(p, it.color);
        const was = wasOf(p, it.color) || price;
        t.units += it.qty; t.gross += was * it.qty; t.total += price * it.qty;
        return t;
      }, { units: 0, gross: 0, total: 0 });
    }

    function setPromo(open, refocusToggle) {
      promoSheet.hidden = !open;
      promoScrim.hidden = !open;
      promoToggle.setAttribute('aria-expanded', String(open));
      if (!open && refocusToggle) promoToggle.focus();
    }
    promoToggle.addEventListener('click', () => setPromo(promoSheet.hidden));
    $('[data-promo-close]', cartPage).addEventListener('click', () => setPromo(false, true));
    promoScrim.addEventListener('click', () => setPromo(false, true));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !promoSheet.hidden) setPromo(false, true);
    });

    function render() {
      const items = cart.list();
      filled.hidden = !items.length;
      emptyEl.hidden = items.length > 0;
      list.innerHTML = items.map(rowHTML).join('');

      const ticked = items.filter((it) => it.checked).length;
      all.checked = items.length > 0 && ticked === items.length;
      all.indeterminate = ticked > 0 && ticked < items.length;
      lines.textContent = items.length;
      clearBtn.hidden = ticked === 0;

      const t = totals();
      $$('[data-sum-units]', cartPage).forEach((el) => { el.textContent = t.units; });
      $('[data-sum-gross]', cartPage).textContent = rupiah(t.gross);
      $('[data-sum-disc-row]', cartPage).hidden = t.gross === t.total;
      $('[data-sum-disc]', cartPage).textContent = '-' + rupiah(t.gross - t.total);
      // Nothing ticked reads as a dash, not Rp0: there is no total yet, rather than a free order.
      $$('[data-sum-total]', cartPage).forEach((el) => { el.textContent = t.units ? rupiah(t.total) : '-'; });
      // Total diskon and its breakdown only while something ticked is actually discounted.
      const disc = t.units ? t.gross - t.total : 0;
      promoToggle.hidden = !disc;
      if (!disc) setPromo(false);
      $('[data-promo-disc-short]', cartPage).textContent = rupiah(disc);
      $('[data-promo-gross]', cartPage).textContent = rupiah(t.gross);
      $('[data-promo-disc]', cartPage).textContent = '-' + rupiah(disc);
      // One text node: the button is a flex row, so a separate number would be gapped off its brackets.
      payBtn.textContent = `Beli (${t.units})`;
      payBtn.disabled = t.units === 0;
      payHint.hidden = t.units > 0;
    }

    // Re-rendering replaces every control, so focus is put back on the same control of the
    // same line, or on its neighbour when that one is gone or disabled.
    function refocus(key, act, fallbackIdx) {
      const row = key && $(`.cp-item[data-key="${CSS.escape(key)}"]`, list);
      const target = row && $(`[data-act="${act}"]:not(:disabled)`, row)
        || row && $(`[data-act="${act === 'inc' ? 'dec' : 'inc'}"]`, row);
      if (target) { target.focus(); return; }
      const rows = $$('.cp-item', list);
      const near = rows[Math.min(fallbackIdx, rows.length - 1)];
      (near ? $('[data-act="check"]', near) : $('[data-cartpage-shop]', cartPage)).focus();
    }

    function removeWhere(test, message) {
      const before = cart.list();
      const removed = before.filter(test);
      if (!removed.length) return;
      const firstIdx = before.findIndex(test);
      undo = before.slice();
      cart.set(before.filter((it) => !test(it)));
      const msg = message(removed);
      undoText.textContent = msg;
      undoBar.hidden = false;
      clearTimeout(undoTimer);
      undoTimer = setTimeout(() => { undoBar.hidden = true; undo = null; }, 8000);
      announce(`${msg} Total ${rupiah(totals().total)}.`);
      refocus(null, 'remove', firstIdx);
    }

    list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn || btn.dataset.act === 'check') return;
      const key = btn.closest('.cp-item').dataset.key;
      const act = btn.dataset.act;
      const next = cart.list().map((it) => (keyOf(it) !== key ? it
        : { ...it, qty: act === 'inc' ? Math.min(99, it.qty + 1) : Math.max(1, it.qty - 1) }));
      cart.set(next);
      const it = next.find((x) => keyOf(x) === key);
      announce(`Jumlah ${label(it)} jadi ${it.qty}. Total ${rupiah(totals().total)}.`);
      refocus(key, act, 0);
    });

    list.addEventListener('change', (e) => {
      if (e.target.dataset.act !== 'check') return;
      const key = e.target.closest('.cp-item').dataset.key;
      cart.set(cart.list().map((it) => (keyOf(it) === key ? { ...it, checked: e.target.checked } : it)));
      announce(`Total ${rupiah(totals().total)}.`);
      $(`.cp-item[data-key="${CSS.escape(key)}"] [data-act="check"]`, list)?.focus();
    });

    all.addEventListener('change', () => {
      cart.set(cart.list().map((it) => ({ ...it, checked: all.checked })));
      announce(`${all.checked ? 'Semua produk dipilih' : 'Semua pilihan dilepas'}. Total ${rupiah(totals().total)}.`);
    });

    clearBtn.addEventListener('click', () => removeWhere((it) => it.checked,
      (r) => `${r.length} produk dihapus dari keranjang.`));

    $('[data-undo-btn]', cartPage).addEventListener('click', () => {
      if (!undo) return;
      cart.set(undo);
      undo = null;
      clearTimeout(undoTimer);
      undoBar.hidden = true;
      announce(`Produk dikembalikan ke keranjang. Total ${rupiah(totals().total)}.`);
      all.focus();
    });

    payBtn.addEventListener('click', () => { location.href = CHECKOUT_PAGE; });

    cart.onChange(render);
    render();
  }

  /* ------------------------------------------------------------------
     Checkout page (/checkout/)
     Buys the lines ticked in the cart: an address (guest checkout, kept in this browser), a
     courier with optional insurance, a note, a payment method and a promo code. Couriers,
     payments and promos come from NEXURA.checkout in data.js. The cart stays the source of
     the lines, so a change in another tab redraws the order here.
     ------------------------------------------------------------------ */
  const coPage = $('[data-checkout-page]');
  if (coPage) {
    const cfg = window.NEXURA.checkout;
    const ADDR_KEY = 'nexura-address-v1';
    const PREFS_KEY = 'nexura-checkout-v1';
    const filled = $('[data-co-filled]', coPage);
    const emptyEl = $('[data-co-empty]', coPage);
    const itemsEl = $('[data-co-items]', coPage);
    const addrCard = $('[data-co-address]', coPage);
    const addrError = $('[data-co-address-error]', coPage);
    const shipToggle = $('[data-co-ship-toggle]', coPage);
    const courierSet = $('[data-co-couriers]', coPage);
    const insured = $('[data-co-insured]', coPage);
    const noteToggle = $('[data-co-note-toggle]', coPage);
    const note = $('[data-co-note]', coPage);
    const payList = $('[data-co-pay-list]', coPage);
    const promoToggle = $('[data-co-promo-toggle]', coPage);
    const promoForm = $('[data-co-promo-form]', coPage);
    const promoInput = $('input', promoForm);
    const promoMsg = $('[data-co-promo-msg]', coPage);
    const dialog = $('[data-co-dialog]', coPage);
    const addrForm = $('[data-co-address-form]', coPage);

    const courierOf = (id) => cfg.couriers.find((c) => c.id === id);
    const promoOf = (code) => Object.keys(cfg.promos).find((k) => k.toUpperCase() === String(code).toUpperCase());

    // Choices survive a reload; an id that data.js no longer lists falls back to the default.
    const prefs = { courier: cfg.couriers[0].id, insured: true, pay: cfg.payments[0].id, note: '', promo: '', ...storage.get(PREFS_KEY) };
    if (!courierOf(prefs.courier)) prefs.courier = cfg.couriers[0].id;
    if (!cfg.payments.some((m) => m.id === prefs.pay)) prefs.pay = cfg.payments[0].id;
    prefs.promo = promoOf(prefs.promo) || '';
    const savePrefs = () => storage.set(PREFS_KEY, prefs);
    let address = storage.get(ADDR_KEY);

    const dayFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });
    const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
    function etaOf(c) {
      const [a, b] = c.days.map(inDays);
      if (c.days[0] === c.days[1]) return `Estimasi tiba ${c.days[0] === 1 ? 'besok, ' : ''}${dayFmt.format(a)}`;
      return `Estimasi tiba ${a.getMonth() === b.getMonth() ? a.getDate() : dayFmt.format(a)} - ${dayFmt.format(b)}`;
    }

    const lines = () => cart.list().filter((it) => it.checked);
    function totals() {
      const t = lines().reduce((t, it) => {
        const p = byId[it.id];
        const price = priceOf(p, it.color);
        t.units += it.qty; t.gross += (wasOf(p, it.color) || price) * it.qty; t.goods += price * it.qty;
        return t;
      }, { units: 0, gross: 0, goods: 0 });
      t.ship = courierOf(prefs.courier).price;
      // Rounded up to the next Rp100, the way couriers bill it.
      t.ins = prefs.insured ? Math.max(cfg.insurance.min, Math.ceil(t.goods * cfg.insurance.rate / 100) * 100) : 0;
      t.promo = prefs.promo ? Math.min(cfg.promos[prefs.promo].off, t.goods) : 0;
      t.total = t.goods + t.ship + t.ins - t.promo;
      return t;
    }

    function itemHTML(it) {
      const p = byId[it.id];
      const c = colorOf(p, it.color);
      const price = priceOf(p, it.color);
      const was = wasOf(p, it.color);
      const meta = [c ? `${variantLabel(p)}: ${escapeHtml(c.label)}` : escapeHtml(categories[p.category]), it.phone ? `Tipe HP: ${escapeHtml(it.phone)}` : ''].filter(Boolean);
      return `
        <li class="co-item">
          <span class="co-item__thumb">
            <img src="${img(imageOf(p, it.color), 160)}" alt="" width="160" height="160" decoding="async">
            ${was ? `<span class="co-item__off" aria-hidden="true">-${Math.round((1 - price / was) * 100)}%</span>` : ''}
          </span>
          <div class="co-item__info">
            <p class="co-item__name">${escapeHtml(p.name)}</p>
            <p class="co-item__variant">${meta.join(' · ')}</p>
          </div>
          <p class="co-item__price">
            <span class="price">${it.qty} x ${rupiah(price)}</span>
            ${was ? `<s class="price-was"><span class="sr-only">Harga normal </span>${rupiah(was)}</s>` : ''}
          </p>
        </li>`;
    }

    function renderTotals() {
      const t = totals();
      $('[data-co-units]', coPage).textContent = t.units;
      $('[data-co-gross]', coPage).textContent = rupiah(t.gross);
      $('[data-co-disc-row]', coPage).hidden = t.gross === t.goods;
      $('[data-co-disc]', coPage).textContent = '-' + rupiah(t.gross - t.goods);
      $('[data-co-ship-fee]', coPage).textContent = rupiah(t.ship);
      $('[data-co-ins-row]', coPage).hidden = !t.ins;
      $('[data-co-ins]', coPage).textContent = rupiah(t.ins);
      $('[data-co-promo-row]', coPage).hidden = !t.promo;
      $('[data-co-promo]', coPage).textContent = '-' + rupiah(t.promo);
      $('[data-co-total]', coPage).textContent = rupiah(t.total);
      // The fee shown on the checkbox is what ticking it would add, ticked or not.
      $('[data-co-ins-fee]', coPage).textContent = rupiah(Math.max(cfg.insurance.min, Math.ceil(t.goods * cfg.insurance.rate / 100) * 100));
    }

    function render() {
      const list = lines();
      filled.hidden = !list.length;
      emptyEl.hidden = list.length > 0;
      itemsEl.innerHTML = list.map(itemHTML).join('');
      renderTotals();
    }

    /* Address */
    function renderAddress() {
      $('[data-co-address-filled]', coPage).hidden = !address;
      $('[data-co-address-empty]', coPage).hidden = !!address;
      if (!address) return;
      addrError.hidden = true;
      addrCard.classList.remove('is-invalid');
      $('[data-co-addr-name]', coPage).textContent = address.name;
      $('[data-co-addr-phone]', coPage).textContent = address.phone;
      $('[data-co-addr-line]', coPage).textContent = `${address.street}, ${address.city}, ${address.postal}`;
      const noteEl = $('[data-co-addr-note]', coPage);
      noteEl.hidden = !address.courierNote;
      noteEl.textContent = address.courierNote ? `Catatan kurir: ${address.courierNote}` : '';
      $('[data-co-addr-pin]', coPage).hidden = !address.pin;
    }

    const field = (name) => addrForm.elements[name];
    const rules = {
      name: (v) => v.length >= 2 || 'Isi nama penerima.',
      phone: (v) => /^(\+?62|0)8\d{7,12}$/.test(v.replace(/[\s-]/g, '')) || 'Nomor WhatsApp diawali 08 atau +62, contoh 0812 3456 7890.',
      street: (v) => v.length >= 10 || 'Tulis alamat lengkap: jalan, nomor rumah, kelurahan, kecamatan.',
      city: (v) => !!v || 'Isi kota atau kabupaten.',
      postal: (v) => /^\d{5}$/.test(v) || 'Kode pos 5 angka.',
      courierNote: () => true, // optional
    };
    function check(name) {
      const el = field(name);
      const ok = rules[name](el.value.trim());
      const hint = $('#' + el.getAttribute('aria-describedby'));
      el.closest('.pdp-field').classList.toggle('is-invalid', ok !== true);
      el.setAttribute('aria-invalid', String(ok !== true));
      hint.textContent = ok === true ? hint.dataset.hint : ok;
      return ok === true;
    }

    const counts = $$('[data-count-for]', dialog);
    const renderCount = (el) => {
      const input = $('#' + el.dataset.countFor);
      el.textContent = `${input.value.length}/${input.maxLength}`;
    };
    const renderCounts = () => counts.forEach(renderCount);
    counts.forEach((el) => $('#' + el.dataset.countFor).addEventListener('input', () => renderCount(el)));

    /* Map pin (UI only). The browser's location prompt is real, but nothing is looked up yet: the
       map is a drawn placeholder and each drop of the pin shows the next sample address below.
       TODO: connect a map provider (Google Maps or Leaflet) and reverse geocoding. */
    const SAMPLE_PLACES = [
      { title: 'Jl. Kemang Raya No. 12', sub: 'Bangka, Mampang Prapatan, Kota Jakarta Selatan, DKI Jakarta', street: 'Jl. Kemang Raya No. 12', city: 'Jakarta Selatan', postal: '12730' },
      { title: 'Jl. Tebet Barat Dalam Raya No. 45', sub: 'Tebet Barat, Tebet, Kota Jakarta Selatan, DKI Jakarta', street: 'Jl. Tebet Barat Dalam Raya No. 45', city: 'Jakarta Selatan', postal: '12810' },
      { title: 'Jl. Pemuda No. 118', sub: 'Embong Kaliasin, Genteng, Kota Surabaya, Jawa Timur', street: 'Jl. Pemuda No. 118', city: 'Surabaya', postal: '60271' },
    ];
    const formView = $('[data-co-form-view]', dialog);
    const formFoot = $('[data-co-form-foot]', dialog);
    const dlgTitle = $('[data-co-dialog-title]', dialog);
    const mapView = $('[data-co-map-view]', dialog);
    const mapBack = $('[data-co-map-back]', dialog);
    const canvas = $('[data-co-map-canvas]', dialog);
    const mapTitle = $('[data-co-map-title]', dialog);
    const mapSub = $('[data-co-map-sub]', dialog);
    const mapConfirm = $('[data-co-map-confirm]', dialog);
    const mapLocate = $('[data-co-map-locate]', dialog);
    const mapQ = $('[data-co-map-q]', dialog);
    const locEmpty = $('[data-co-loc-empty]', dialog);
    const locSet = $('[data-co-loc-set]', dialog);
    const locGps = $('[data-co-loc-gps]', dialog);
    const locGpsLabel = $('[data-co-loc-gps-label]', dialog);
    const locMsg = $('[data-co-loc-msg]', dialog);
    let pin = null;      // the pin saved with the address being edited
    let draft = null;    // the place under the pin while the map is open
    let lastFill = {};   // what the pin last wrote into each field, so typed edits are never overwritten
    let sampleAt = 0;
    let lookupTimer;
    const offset = { x: 0, y: 0 };

    function renderPin() {
      locEmpty.hidden = !!pin || !canLocate;
      locSet.hidden = !pin;
      if (!pin) return;
      $('[data-co-loc-title]', dialog).textContent = pin.title;
      $('[data-co-loc-sub]', dialog).textContent = pin.sub;
    }
    const setLocMsg = (text) => { locMsg.hidden = !text; locMsg.textContent = text; };
    const panTo = (x, y) => {
      offset.x = x; offset.y = y;
      canvas.style.backgroundPosition = `${x}px ${y}px`;
    };

    // Stands in for reverse geocoding: a short wait, then the next sample address.
    function lookUp() {
      clearTimeout(lookupTimer);
      draft = null;
      mapConfirm.disabled = true;
      mapTitle.textContent = 'Mencari alamat…';
      mapSub.textContent = '';
      lookupTimer = setTimeout(() => {
        draft = SAMPLE_PLACES[sampleAt++ % SAMPLE_PLACES.length];
        mapTitle.textContent = draft.title;
        mapSub.textContent = draft.sub;
        mapConfirm.disabled = false;
      }, 600);
    }

    function showMap(open, { focus = true } = {}) {
      formView.hidden = open;
      formFoot.hidden = open;
      mapView.hidden = !open;
      mapBack.hidden = !open;
      dlgTitle.textContent = open ? 'Tandai Lokasi' : 'Alamat Pengiriman';
      clearTimeout(lookupTimer);
      if (open) { mapQ.value = ''; lookUp(); }
      if (focus) (open ? mapBack : pin ? $('[data-co-loc-pick]', locSet) : locGps).focus();
    }

    // UI only: location access is taken as already granted, so the button goes straight to the
    // map after a short "Mencari lokasi…". TODO: when connecting, ask through
    // navigator.geolocation.getCurrentPosition on the press (never on open), hide the button where
    // it is missing or the page is not HTTPS, and on failure call `fail` with
    //   denied:  `Akses lokasi ditolak. Izinkan lokasi untuk situs ini di pengaturan browser, atau ${fallback}.`
    //   other:   `Lokasi belum ketemu. Coba lagi, atau ${fallback}.`
    const canLocate = true;
    const locate = (done) => setTimeout(done, 500);
    const setBusy = (busy) => {
      locGps.setAttribute('aria-busy', String(busy));
      locGps.disabled = busy;
      locGpsLabel.textContent = busy ? 'Mencari lokasi…' : 'Gunakan lokasi saat ini';
    };
    locGps.addEventListener('click', () => {
      setLocMsg('');
      setBusy(true);
      locate(() => { setBusy(false); panTo(0, 0); showMap(true); }, (msg) => { setBusy(false); setLocMsg(msg); }, 'isi alamatnya di bawah');
    });
    mapLocate.addEventListener('click', () => {
      locate(() => { panTo(0, 0); lookUp(); }, (msg) => { mapTitle.textContent = 'Lokasi belum ketemu'; mapSub.textContent = msg; }, 'geser peta ke lokasi kamu');
    });
    $$('[data-co-loc-pick]', dialog).forEach((b) => b.addEventListener('click', () => showMap(true)));
    $('[data-co-loc-preview]', dialog).addEventListener('click', () => showMap(true));
    mapBack.addEventListener('click', () => showMap(false));
    // Esc steps back to the form rather than closing the whole dialog.
    dialog.addEventListener('cancel', (e) => { if (!mapView.hidden) { e.preventDefault(); showMap(false); } });

    // Drag the map under the fixed pin; the address updates once it is let go.
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX - offset.x, y: e.clientY - offset.y, sx: e.clientX, sy: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      mapView.classList.add('is-moving');
      panTo(e.clientX - drag.x, e.clientY - drag.y);
    });
    const endDrag = (e) => {
      if (!drag) return;
      const moved = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 3;
      drag = null;
      mapView.classList.remove('is-moving');
      if (moved) lookUp();
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('keydown', (e) => {
      const step = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[e.key];
      if (!step) return;
      e.preventDefault();
      panTo(offset.x + step[0], offset.y + step[1]);
      lookUp();
    });

    const search = () => { if (mapQ.value.trim()) { panTo(offset.x - 160, offset.y + 90); lookUp(); } };
    mapQ.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } });

    // The pin fills Alamat, Kota and Kode pos, except where the buyer has typed their own.
    mapConfirm.addEventListener('click', () => {
      if (!draft) return;
      pin = draft;
      ['street', 'city', 'postal'].forEach((name) => {
        const el = field(name);
        if (!el.value.trim() || el.value.trim() === lastFill[name]) el.value = pin[name];
        if (el.closest('.is-invalid')) check(name);
      });
      lastFill = { street: pin.street, city: pin.city, postal: pin.postal };
      renderCounts();
      renderPin();
      showMap(false);
      announce('Titik lokasi dipilih. Lengkapi detail alamat kalau perlu.');
    });

    function openAddress() {
      Object.keys(rules).forEach((name) => {
        field(name).value = address?.[name] ?? '';
        field(name).closest('.pdp-field').classList.remove('is-invalid');
        field(name).setAttribute('aria-invalid', 'false');
        const hint = $('#' + field(name).getAttribute('aria-describedby'));
        hint.textContent = hint.dataset.hint;
      });
      renderCounts();
      pin = address?.pin ?? null;
      lastFill = {};
      setLocMsg('');
      renderPin();
      showMap(false, { focus: false });
      lockScroll(true);
      dialog.showModal();
    }
    dialog.addEventListener('close', () => lockScroll(false));
    $$('[data-co-dialog-close]', dialog).forEach((b) => b.addEventListener('click', () => dialog.close()));
    // A press that starts and ends on the dimmed area outside the box closes it.
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    $$('[data-co-address-edit]', coPage).forEach((b) => b.addEventListener('click', openAddress));

    // Errors show once a field has been left, then follow every keystroke until it is right.
    Object.keys(rules).forEach((name) => {
      field(name).addEventListener('blur', () => { if (field(name).value.trim()) check(name); });
      field(name).addEventListener('input', () => { if (field(name).closest('.is-invalid')) check(name); });
    });
    field('postal').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, ''); });

    addrForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const bad = Object.keys(rules).filter((name) => !check(name));
      if (bad.length) { field(bad[0]).focus(); return; }
      address = Object.fromEntries(Object.keys(rules).map((name) => [name, field(name).value.trim().replace(/\s+/g, ' ')]));
      if (pin) address.pin = pin;
      storage.set(ADDR_KEY, address);
      renderAddress();
      dialog.close();
      announce('Alamat pengiriman disimpan.');
    });

    /* Delivery */
    courierSet.insertAdjacentHTML('beforeend', cfg.couriers.map((c) => `
      <label class="co-option">
        <span class="co-option__text">
          <span class="co-option__name">${escapeHtml(c.label)} (${rupiah(c.price)})</span>
          <span class="co-option__note">${etaOf(c)}</span>
        </span>
        <input class="co-radio" type="radio" name="courier" value="${c.id}" ${c.id === prefs.courier ? 'checked' : ''}>
      </label>`).join(''));

    function renderCourier() {
      const c = courierOf(prefs.courier);
      $('[data-co-ship-label]', coPage).textContent = `${c.label} (${rupiah(c.price)})`;
      $('[data-co-ship-eta]', coPage).textContent = etaOf(c);
    }
    const setCouriersOpen = (open, focusToggle = false) => {
      courierSet.hidden = !open;
      shipToggle.setAttribute('aria-expanded', String(open));
      if (open) $('input:checked', courierSet).focus();
      else if (focusToggle) shipToggle.focus();
    };
    shipToggle.addEventListener('click', () => setCouriersOpen(courierSet.hidden));
    // Arrow keys move the pick without closing; a click or Enter/Space settles it.
    courierSet.addEventListener('change', (e) => {
      prefs.courier = e.target.value;
      savePrefs(); renderCourier(); renderTotals();
      announce(`Pengiriman ${courierOf(prefs.courier).label}. Total ${rupiah(totals().total)}.`);
    });
    // e.detail is 0 for the clicks arrow keys fire; the frame's wait lets the label hand its
    // click to the radio before the list hides.
    courierSet.addEventListener('click', (e) => { if (e.detail) requestAnimationFrame(() => setCouriersOpen(false, true)); });
    courierSet.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setCouriersOpen(false, true); }
    });
    document.addEventListener('click', (e) => { if (!courierSet.hidden && !e.target.closest('[data-co-ship]')) setCouriersOpen(false); });

    insured.checked = prefs.insured;
    insured.addEventListener('change', () => {
      prefs.insured = insured.checked;
      savePrefs(); renderTotals();
      announce(`${prefs.insured ? 'Pakai' : 'Tanpa'} asuransi pengiriman. Total ${rupiah(totals().total)}.`);
    });

    /* Note */
    const noteCount = $('[data-co-note-count]', coPage);
    const setNoteOpen = (open) => {
      $('#co-note').hidden = !open;
      noteToggle.setAttribute('aria-expanded', String(open));
    };
    note.value = prefs.note;
    noteCount.textContent = `${note.value.length}/200`;
    setNoteOpen(!!prefs.note);
    noteToggle.addEventListener('click', () => {
      const open = noteToggle.getAttribute('aria-expanded') !== 'true';
      setNoteOpen(open);
      if (open) note.focus();
    });
    note.addEventListener('input', () => {
      prefs.note = note.value;
      noteCount.textContent = `${note.value.length}/200`;
      savePrefs();
    });

    /* Payment */
    function renderPayments() {
      payList.innerHTML = cfg.payments.map((m) => `
          <label class="co-option co-pm">
            <span class="co-pm__logo"><img src="${ASSETS}img/pay/${m.logo}" alt="" width="${m.w}" height="${m.h}" loading="lazy" decoding="async"></span>
            <span class="co-option__text">
              <span class="co-option__name">${escapeHtml(m.label)}</span>
              ${m.note ? `<span class="co-option__note">${escapeHtml(m.note)}</span>` : ''}
            </span>
            <input class="co-radio" type="radio" name="pay" value="${m.id}" ${m.id === prefs.pay ? 'checked' : ''}>
          </label>`).join('');
    }
    // A dropdown in effect: closed, only the chosen method shows. Picking one with a tap closes
    // the list again; arrow keys leave it open, so stepping through the methods doesn't fold
    // it shut under the keyboard.
    const payToggle = $('[data-co-pay-toggle]', coPage);
    let payByKey = false;
    function setPayOpen(open) {
      payList.classList.toggle('is-open', open);
      payToggle.setAttribute('aria-expanded', String(open));
      $('[data-co-pay-toggle-text]', payToggle).textContent = open ? 'Tutup' : 'Lihat Semua';
    }
    payToggle.addEventListener('click', () => setPayOpen(!payList.classList.contains('is-open')));
    payList.addEventListener('keydown', (e) => { payByKey = e.key.startsWith('Arrow'); });
    payList.addEventListener('change', (e) => {
      prefs.pay = e.target.value;
      savePrefs();
      announce(`Bayar pakai ${cfg.payments.find((m) => m.id === prefs.pay).label}.`);
      if (!payByKey) setPayOpen(false);
      payByKey = false;
    });

    /* Promo */
    function renderPromo(msg, ok) {
      $('[data-co-promo-label]', coPage).textContent = prefs.promo
        ? `Promo ${prefs.promo.toUpperCase()} dipakai`
        : 'Punya kode promo? Pakai di sini';
      promoToggle.classList.toggle('is-applied', !!prefs.promo);
      promoMsg.hidden = !msg;
      promoMsg.classList.toggle('is-error', ok === false);
      promoMsg.innerHTML = msg || '';
    }
    promoToggle.addEventListener('click', () => {
      const open = promoForm.hidden;
      promoForm.hidden = !open;
      promoToggle.setAttribute('aria-expanded', String(open));
      if (open) promoInput.focus();
    });
    promoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = promoInput.value.trim();
      if (!code) { promoInput.focus(); return; }
      const key = promoOf(code);
      if (!key) { renderPromo(`Kode “${escapeHtml(code)}” nggak ketemu atau udah nggak berlaku.`, false); return; }
      prefs.promo = key;
      savePrefs(); renderTotals();
      promoInput.value = '';
      renderPromo(`${escapeHtml(cfg.promos[key].label)}: hemat ${rupiah(totals().promo)}. <button class="link-btn" type="button" data-co-promo-remove>Hapus</button>`, true);
    });
    promoMsg.addEventListener('click', (e) => {
      if (!e.target.closest('[data-co-promo-remove]')) return;
      prefs.promo = '';
      savePrefs(); renderTotals(); renderPromo();
      announce('Promo dihapus.');
      promoInput.focus();
    });

    /* Pay */
    $('[data-co-submit]', coPage).addEventListener('click', () => {
      if (!address) {
        addrError.hidden = false;
        addrCard.classList.add('is-invalid');
        addrCard.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
        $$('[data-co-address-edit]', addrCard).find((b) => b.offsetParent).focus({ preventScroll: true });
        return;
      }
      // TODO: hand the order (lines(), address, prefs, totals()) to the payment gateway and go
      // to the order confirmation page (PRD 16). Neither exists yet, so a complete order stops here.
    });

    renderAddress();
    renderCourier();
    renderPayments();
    renderPromo();
    cart.onChange(render);
    render();
  }

  /* ------------------------------------------------------------------
     Product detail page (/produk/detail/?id=<id>)
     One page draws every product: the id in the URL picks the entry in data.js, so a new
     product needs data, not a new page. The markup is the empty frame; everything product-
     specific is filled in here.
     ------------------------------------------------------------------ */
  const pdp = $('[data-pdp]');
  const pdpProduct = pdp && byId[new URLSearchParams(location.search).get('id')];

  if (pdp && !pdpProduct) {
    $$('[data-pdp-body]', pdp).forEach((el) => { el.hidden = true; });
    $('[data-pdp-missing]', pdp).hidden = false;
    document.title = 'Produk nggak ketemu — Nexura | #GearYourAura';
  }

  if (pdpProduct) {
    const p = pdpProduct;
    const params = new URLSearchParams(location.search);
    const out = p.stock === 'out';
    const variants = p.colors || [];
    const state = { color: colorOf(p, params.get('varian'))?.id || null, qty: 1 };
    const behavior = () => (reducedMotion.matches ? 'auto' : 'smooth');
    const num = (n) => new Intl.NumberFormat('id-ID').format(n);
    // Gallery photos are JPG only (see `gallery` in data.js), unlike the WebP card images.
    const galleryImg = (name, size) => `${ASSETS}img/${name}${size === 160 ? '-160' : ''}.jpg`;
    const panel = (key) => $(`[data-panel="${key}"]`, pdp);
    const mine = (reviews || []).filter((r) => r.product === p.short);

    /* Page head, title, tags */
    document.title = `${p.short} — Nexura | #GearYourAura`;
    if (p.description) $('meta[name="description"]')?.setAttribute('content', p.description[0]);
    $('[data-pdp-name]', pdp).textContent = p.name;
    // Stock speaks only when it is news (low, out): a badge by the name and a line by the
    // quantity, since that is where the question comes up.
    const STOCK = {
      in: { note: '' },
      low: { note: 'Stok terakhir', badge: 'Stok terakhir' },
      out: { note: 'Stok habis', badge: 'Restock segera' },
    }[p.stock] || { note: '' };
    const stockBadge = $('[data-pdp-stock]', pdp);
    if (STOCK.badge) {
      $('[data-pdp-tags]', pdp).hidden = false;
      stockBadge.textContent = STOCK.badge;
      stockBadge.classList.add(`badge--${p.stock}`);
    }
    const stockNote = $('[data-pdp-stock-note]', pdp);
    stockNote.textContent = STOCK.note;
    stockNote.hidden = !STOCK.note;
    stockNote.classList.add(`pdp-stock--${p.stock}`);

    /* Rating line: only what is known. A missing figure drops out rather than showing a zero. */
    const ratingBits = [];
    if (p.rating) ratingBits.push(`<span class="stars" role="img" aria-label="Rating ${p.rating} dari 5">${starGlyphs(starsOf(p.rating))}</span><strong>${p.rating}</strong>`);
    if (p.ratingCount) ratingBits.push(`<a href="#ulasan" data-tab-link="ulasan">${num(p.ratingCount)} ulasan</a>`);
    else if (mine.length) ratingBits.push('<a href="#ulasan" data-tab-link="ulasan">Lihat ulasan</a>');
    if (p.sold) ratingBits.push(`<span>${soldLabel(p.sold)} terjual</span>`);
    const ratingEl = $('[data-pdp-rating]', pdp);
    if (ratingBits.length) {
      ratingEl.hidden = false;
      ratingEl.innerHTML = ratingBits.join('<span class="pdp-rating__sep" aria-hidden="true"></span>');
    }

    /* Variant picker: native radios, so arrows, labels and announcements come for free.
       Each option shows its own photo when every variant has a different one; where some share
       a photo (FrostByte's variant shot), a photo would not tell them apart, so the swatch stays. */
    const optBox = $('[data-variant-opts]', pdp);
    const photoOpts = variants.length > 1 && new Set(variants.map((c) => c.image)).size === variants.length;
    if (variants.length) {
      $('[data-pdp-variants]', pdp).hidden = false;
      $('[data-variant-label]', pdp).textContent = variantLabel(p);
      optBox.innerHTML = variants.map((c) => {
        const mark = photoOpts ? `<img class="opt__thumb" src="${galleryImg(c.image, 160)}" alt="" width="160" height="160" loading="lazy" decoding="async">`
          : c.swatch ? `<span class="opt__swatch" style="background:${c.swatch}"></span>` : '';
        return `
        <label class="opt${photoOpts ? ' opt--photo' : c.swatch ? '' : ' opt--text'}">
          <input type="radio" name="varian" value="${escapeHtml(c.id)}"${c.id === state.color ? ' checked' : ''}>
          ${mark}
          <span>${escapeHtml(c.label)}</span>
        </label>`;
      }).join('');
    }

    /* Gallery: a scroll-snap track like the hero, so it swipes on touch and scrolls with the
       arrow keys, plus a thumbnail strip. The colour photos sit inside the gallery, so picking
       a colour jumps to its photo instead of replacing one. */
    const gallery = $('[data-gallery]', pdp);
    const track = $('[data-gallery-track]', gallery);
    const strip = $('[data-gallery-strip]', gallery);
    const thumbs = $('[data-gallery-thumbs]', gallery);
    const prev = $('[data-gallery-prev]', gallery);
    const next = $('[data-gallery-next]', gallery);
    const shots = p.gallery && p.gallery.length ? p.gallery
      : [...new Set(variants.map((c) => c.image).concat(p.image || []))].map((image) => ({ image, alt: p.alt }));

    track.innerHTML = shots.length
      ? shots.map((g, i) => `
        <div class="gallery__slide" role="group" aria-roledescription="foto" aria-label="${i + 1} dari ${shots.length}">
          <img src="${galleryImg(g.image)}" alt="${escapeHtml(g.alt || p.alt)}" width="800" height="800" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">
        </div>`).join('')
      : `<div class="gallery__slide gallery__slide--empty">${icon('package')}<span>Foto menyusul</span></div>`;
    thumbs.innerHTML = shots.map((g, i) => `
      <button class="gallery__thumb" type="button" aria-label="Foto ${i + 1} dari ${shots.length}" data-index="${i}">
        <img src="${galleryImg(g.image, 160)}" alt="" width="160" height="160" loading="lazy" decoding="async">
      </button>`).join('');
    gallery.classList.toggle('is-single', shots.length < 2);
    $('[data-gallery-total]', gallery).textContent = Math.max(1, shots.length);

    const slides = $$('.gallery__slide', track);
    const thumbBtns = $$('.gallery__thumb', thumbs);
    let current = 0;

    const goTo = (i, smooth = true) => {
      const n = Math.max(0, Math.min(slides.length - 1, i));
      track.scrollTo({ left: n * track.clientWidth, behavior: smooth ? behavior() : 'auto' });
    };
    // Scrolls the strip itself rather than calling scrollIntoView, which would also move the page.
    const keepThumbInView = (t) => {
      const { scrollLeft, clientWidth } = thumbs;
      if (t.offsetLeft < scrollLeft) thumbs.scrollTo({ left: t.offsetLeft - 4, behavior: behavior() });
      else if (t.offsetLeft + t.offsetWidth > scrollLeft + clientWidth) thumbs.scrollTo({ left: t.offsetLeft + t.offsetWidth - clientWidth + 4, behavior: behavior() });
    };
    const setCurrent = (i) => {
      current = i;
      $('[data-gallery-index]', gallery).textContent = i + 1;
      prev.disabled = i === 0;
      next.disabled = i === slides.length - 1;
      thumbBtns.forEach((b, k) => (k === i ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
      if (thumbBtns[i]) keepThumbInView(thumbBtns[i]);
    };
    const colorShot = () => {
      const c = colorOf(p, state.color);
      return c ? shots.findIndex((g) => g.image === c.image) : -1;
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) setCurrent(slides.indexOf(en.target)); });
    }, { root: track, threshold: 0.6 });
    slides.forEach((s) => io.observe(s));

    prev.addEventListener('click', () => goTo(current - 1));
    next.addEventListener('click', () => goTo(current + 1));
    thumbs.addEventListener('click', (e) => { const t = e.target.closest('[data-index]'); if (t) goTo(Number(t.dataset.index)); });

    // The strip's arrows page through the thumbnails; they keep their room when there is
    // nothing to page through, so the strip never changes width and flips between the two.
    const stripPrev = $('[data-strip-prev]', strip);
    const stripNext = $('[data-strip-next]', strip);
    const updateStrip = () => {
      const max = thumbs.scrollWidth - thumbs.clientWidth;
      strip.classList.toggle('has-overflow', max > 2);
      stripPrev.disabled = thumbs.scrollLeft <= 2;
      stripNext.disabled = thumbs.scrollLeft >= max - 2;
    };
    stripPrev.addEventListener('click', () => thumbs.scrollBy({ left: -thumbs.clientWidth * 0.8, behavior: behavior() }));
    stripNext.addEventListener('click', () => thumbs.scrollBy({ left: thumbs.clientWidth * 0.8, behavior: behavior() }));
    thumbs.addEventListener('scroll', updateStrip, { passive: true });
    window.addEventListener('resize', () => { updateStrip(); goTo(current, false); });

    /* Price, quantity, subtotal — and the bar's copy of the price */
    const sheetThumb = $('[data-sheet-thumb]', pdp);
    const subtotal = $('[data-pdp-subtotal]', pdp);
    const qtyOut = $('[data-qty-value]', pdp);
    const dec = $('[data-qty="dec"]', pdp);
    const inc = $('[data-qty="inc"]', pdp);

    function sync() {
      const c = colorOf(p, state.color);
      const price = priceOf(p, state.color);
      const was = p.compareAt && p.compareAt > price ? p.compareAt : 0;
      $$('[data-pdp-price]', pdp).forEach((el) => { el.textContent = rupiah(price); });
      $$('[data-pdp-was]', pdp).forEach((el) => {
        el.hidden = !was;
        el.innerHTML = was ? `<span class="sr-only">Harga normal </span>${rupiah(was)}` : '';
      });
      $$('[data-pdp-off]', pdp).forEach((el) => {
        el.hidden = !was;
        el.textContent = was ? `-${Math.round((1 - price / was) * 100)}%` : '';
      });
      const shot = c ? c.image : p.image || (shots[0] && shots[0].image);
      if (shot) sheetThumb.src = galleryImg(shot, 160);
      subtotal.textContent = rupiah(price * state.qty);
      qtyOut.textContent = state.qty;
      dec.disabled = out || state.qty <= 1;
      inc.disabled = out || state.qty >= 99;
      $$('[data-variant-current]', pdp).forEach((el) => { el.textContent = c ? c.label : ''; });
    }

    const syncUrl = () => {
      const q = new URLSearchParams({ id: p.id });
      if (state.color && variants[0] && state.color !== variants[0].id) q.set('varian', state.color);
      history.replaceState(null, '', `${location.pathname}?${q}${location.hash}`);
    };

    optBox.addEventListener('change', (e) => {
      const before = priceOf(p, state.color);
      state.color = e.target.value;
      sync();
      syncUrl();
      const i = colorShot();
      if (i >= 0) goTo(i);
      if (priceOf(p, state.color) !== before) announce(`Harga jadi ${rupiah(priceOf(p, state.color))}.`);
    });

    [dec, inc].forEach((b) => b.addEventListener('click', () => {
      state.qty = Math.max(1, Math.min(99, state.qty + (b === inc ? 1 : -1)));
      sync();
      // the button just pressed can disable itself at 1 or 99; hand focus to its partner
      if (b.disabled) (b === inc ? dec : inc).focus();
    }));

    /* Buying. Both buttons put the pick in the cart; Beli Sekarang then goes on to checkout. */
    if (out) {
      $$('[data-pdp-actions]', pdp).forEach((el) => { el.innerHTML = '<button class="btn btn--block" type="button" disabled>Restock segera</button>'; });
      $$('[data-buy-now]', pdp).forEach((b) => { b.disabled = true; b.textContent = 'Restock segera'; });
    }
    // Products cut per phone ask for the model first. An empty field stops the add, says why
    // under the field, and takes the buyer there — the bar's button is far above it.
    const phoneBox = $('[data-pdp-phone]', pdp);
    const phoneInput = $('#pdp-phone', pdp);
    const phoneHint = $('#pdp-phone-hint', pdp);
    const PHONE_HINT = phoneHint.textContent;
    const setPhoneError = (on) => {
      phoneInput.setAttribute('aria-invalid', String(on));
      phoneBox.classList.toggle('is-invalid', on);
      phoneHint.textContent = on ? 'Tulis tipe HP kamu dulu, ya. Tanpa tipe HP, hydrogel dikirim tanpa potongan.' : PHONE_HINT;
    };
    if (p.phoneModel) {
      phoneBox.hidden = false;
      phoneInput.addEventListener('input', () => { if (phoneInput.value.trim()) setPhoneError(false); });
    }

    const addToCart = (then) => {
      const phone = p.phoneModel ? phoneInput.value.trim().replace(/\s+/g, ' ') : '';
      if (p.phoneModel && !phone) {
        setPhoneError(true);
        // inside the sheet only the sheet scrolls; the page behind it is locked
        phoneInput.scrollIntoView({ behavior: behavior(), block: sheetOpen() ? 'nearest' : 'center' });
        phoneInput.focus({ preventScroll: true });
        announce('Tulis tipe HP kamu dulu.');
        return;
      }
      cart.add(p.id, state.color, state.qty, phone);
      if (then) { location.href = then; return; }
      // from the sheet, focus comes back to the dock button that opened it
      if (sheetOpen()) hideDrawer(buyBox);
    };

    /* Phones: the buy card is a bottom sheet. The dock's two buttons open it, each setting
       which of the card's buttons finishes the order (data-mode); it rides the drawer
       machinery, so backdrop, scroll lock, focus trap and Escape all come along. */
    const buyBox = $('[data-pdp-buy]', pdp);
    const phoneMq = window.matchMedia('(max-width: 599px)');
    let sheetTrigger = null;
    const sheetOpen = () => buyBox.classList.contains('is-open');
    const asSheet = () => {
      if (phoneMq.matches) {
        buyBox.setAttribute('role', 'dialog');
        buyBox.setAttribute('aria-modal', 'true');
        buyBox.setAttribute('aria-labelledby', 'pdp-sheet-title');
      } else {
        if (sheetOpen()) hideDrawer(buyBox, false);
        ['role', 'aria-modal', 'aria-labelledby', 'data-mode'].forEach((a) => buyBox.removeAttribute(a));
        buyBox.inert = false; // hideDrawer leaves it inert; on wide screens it is the page's own card
      }
    };
    asSheet();
    phoneMq.addEventListener('change', asSheet);
    $$('[data-sheet-open]', pdp).forEach((b) => b.addEventListener('click', () => {
      sheetTrigger = b;
      buyBox.dataset.mode = b.dataset.sheetOpen;
      showDrawer(buyBox, b);
    }));
    $('[data-sheet-close]', pdp).addEventListener('click', () => hideDrawer(buyBox));
    $$('[data-add-cart]', pdp).forEach((b) => b.addEventListener('click', () => addToCart()));
    // Beli Sekarang adds the item and goes straight on to checkout.
    $$('[data-buy-now]', pdp).forEach((b) => b.addEventListener('click', () => addToCart(CHECKOUT_PAGE)));

    const chat = $('[data-pdp-chat]', pdp);
    if (store && store.whatsapp) {
      const ask = out ? `Halo Nexura, tolong kabari saya kalau ${p.short} sudah restock.` : `Halo Nexura, saya mau tanya soal ${p.short}.`;
      chat.href = `https://wa.me/${store.whatsapp}?text=${encodeURIComponent(ask)}`;
      $('[data-pdp-chat-text]', chat).textContent = out ? 'Kabari saya lewat WhatsApp saat restock' : 'Ada pertanyaan? Chat admin lewat WhatsApp';
    } else chat.hidden = true;

    /* Tab panels */
    panel('detail').innerHTML = [
      p.description ? `<div class="prose">${p.description.map((t) => `<p>${escapeHtml(t)}</p>`).join('')}</div>` : '',
      // Notes read as part of the description, not as a warning that leads the tab.
      ...[].concat(p.notice || []).map((n) => `<p class="prose">Catatan: ${escapeHtml(n)}</p>`),
      // A banner whose file has not been added yet drops out instead of leaving a broken frame
      // in the middle of the stack.
      p.showcase ? `
        <div class="showcase">${p.showcase.map((s) => `
          <img src="${galleryImg(s.image)}" alt="${escapeHtml(s.alt)}" width="800" height="800" loading="lazy" decoding="async" onerror="this.remove()">`).join('')}
        </div>` : '',
      ...(p.sections || []).map((sec) => `
        ${sec.text ? `<p class="prose">${escapeHtml(sec.text)}</p>` : ''}`),
      // Each list gets a heading, so the box contents and the usage tips don't read as one run
      // of ticks.
      p.inBox ? `
        <section class="pdp-block">
          <h3 class="pdp-block__title">Isi Produk</h3>
          <ul class="inbox">${p.inBox.map((t) => `<li>${icon('check')}${escapeHtml(t)}</li>`).join('')}</ul>
        </section>` : '',
      // The heading only stands over usage tips; a games line on its own goes without one.
      p.usage ? `
        <section class="pdp-block">
          ${p.usage.tips ? '<h3 class="pdp-block__title">Rekomendasi Penggunaan</h3>' : ''}
          ${p.usage.tips ? `<ul class="inbox">${p.usage.tips.map((t) => `<li>${icon('check')}${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
          ${p.usage.games ? `
            <p class="pdp-games">Cocok untuk game populer seperti ${p.usage.games.map((g) => `<strong>${escapeHtml(g)}</strong>`).join(', ')}, dan game kompetitif lainnya.</p>` : ''}
        </section>` : '',
    ].join('') || '<p class="prose">Detail produk segera hadir.</p>';

    const specRows = [['Kategori', categories[p.category]], ...(p.specs || [])];
    if (variants.length) specRows.push([variantLabel(p), variants.map((c) => c.label).join(', ')]);
    panel('spesifikasi').innerHTML = `
      <dl class="spec-table">${specRows.map(([k, v]) => `
        <div class="spec-row"><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}
      </dl>`;

    const toko = store && store.tokopedia;
    // The figures are copied by hand from this product's Tokopedia listing; the card says so,
    // and says when (store.metricsUpdated in data.js), so a buyer knows how fresh they are.
    const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const updated = (() => {
      const [y, m, d] = String((store && store.metricsUpdated) || '').split('-').map(Number);
      return y && m && d ? `${d} ${MONTHS_ID[m - 1]} ${y}` : '';
    })();
    const summary = p.rating ? `
      <div class="rating-summary">
        <p class="rating-summary__score">${p.rating}<span>/5</span></p>
        <div class="rating-summary__meta">
          <span class="stars" aria-hidden="true">${starGlyphs(starsOf(p.rating))}</span>
          <p>${[p.ratingCount && `${num(p.ratingCount)} ulasan`, p.sold && `${soldLabel(p.sold)} terjual`].filter(Boolean).join(' · ') || 'Rating pembeli'}</p>
        </div>
        <p class="rating-summary__source">
          ${icon('badge-check', 'icon icon--sm')}
          <span>Rating, ulasan, dan jumlah terjual diambil dari toko resmi Nexura di Tokopedia${toko ? ` (<a href="${toko}" target="_blank" rel="noopener">lihat tokonya</a>)` : ''}.${updated ? ` Terakhir diperbarui ${updated}.` : ''}</span>
        </p>
      </div>` : '';
    // Reviews with a Tokopedia screenshot show as the screenshot itself, as on the home page;
    // a product with none yet keeps its written reviews.
    const shotReviews = mine.filter((r) => r.screenshot);
    // Real reviews only, filed under the listing they were written on (see data.js). A product
    // with none here points to the store rather than padding the tab.
    panel('ulasan').innerHTML = mine.length ? `
      ${summary}
      ${shotReviews.length ? `<div class="review-list review-list--shots" data-review-shots>${shotReviews.map((r) => reviewShotHTML(r)).join('')}</div>` : `
      <div class="review-list">${mine.map((r) => `
        <figure class="review review--static">
          <span class="stars" role="img" aria-label="${r.rating} dari 5 bintang">${starGlyphs(r.rating)}</span>
          <blockquote class="review__quote">“${escapeHtml(r.text)}”</blockquote>
          <figcaption class="review__by">
            <span class="review__name">${escapeHtml(r.name)}</span>
            ${r.variant ? `<span class="review__meta">${escapeHtml(variantLabel(p))}: ${escapeHtml(r.variant)}</span>` : ''}
          </figcaption>
        </figure>`).join('')}
      </div>`}
      ${toko ? `<p class="pdp-note">Ulasan pilihan dari pembeli di Tokopedia. <a class="link-btn" href="${toko}" target="_blank" rel="noopener">Lihat semua ulasan</a></p>` : ''}`
      : `${summary}
      <div class="catalog-empty">
        ${icon('star', 'icon catalog-empty__icon')}
        <p class="catalog-empty__title">Ulasannya belum dipajang di sini</p>
        <p class="catalog-empty__text">Baca ulasan pembeli ${escapeHtml(p.short)} langsung di toko Tokopedia kami.</p>
        ${toko ? `<a class="btn btn--secondary" href="${toko}" target="_blank" rel="noopener">Buka Tokopedia</a>` : ''}
      </div>`;
    // The screenshot cards pop (stars lift, sticker springs up) as each comes into view; the
    // grid doesn't move, so an IntersectionObserver is enough here. Once popped, they stay.
    const shotGrid = $('[data-review-shots]', panel('ulasan'));
    if (shotGrid) {
      wireReviewZoom(shotGrid);
      const cardsIn = $$('.review-shot', shotGrid);
      if (reducedMotion.matches || !('IntersectionObserver' in window)) cardsIn.forEach((c) => c.classList.add('is-popped'));
      else {
        const io = new IntersectionObserver((entries) => entries.forEach((en) => {
          if (en.isIntersecting) { en.target.classList.add('is-popped'); io.unobserve(en.target); }
        }), { threshold: 0.7 });
        cardsIn.forEach((c) => io.observe(c));
      }
    }

    /* Bandingkan: this product side by side with one other from its own category, and only its
       own, since a fan cooler and a screen protector share no specs worth lining up. Two columns
       keep every value readable on a phone. Each column is headed by the product's photo, which
       opens its page; the other product is swapped from the dropdown over it. Specs line up by label, with the
       listings' differing names merged via `compareLabels` in data.js. */
    const rivals = products.filter((q) => q.category === p.category && q.id !== p.id)
      // in stock first, then best sellers: the likeliest alternative a buyer is weighing
      .sort((a, b) => (a.stock === 'out') - (b.stock === 'out') || a.popular - b.popular);
    if (!rivals.length) {
      $('#tab-bandingkan', pdp).hidden = true;
    } else {
      let rival = rivals[0];
      const aliases = compareLabels || {};
      const STOCK_TEXT = { in: 'Tersedia', low: 'Stok terakhir', out: 'Stok habis' };
      const box = panel('bandingkan');
      const specsOf = (q) => {
        const m = new Map();
        (q.specs || []).forEach(([k, v]) => { const key = aliases[k] || k; if (!m.has(key)) m.set(key, v); });
        // The variant list counts as a spec, under the listing's own word for it ("Warna"),
        // so YinYang's written-out colours line up with Vortex's picker colours.
        const vs = q.colors || [];
        if (vs.length && !m.has(variantLabel(q))) m.set(variantLabel(q), vs.map((c) => c.label).join(', '));
        return m;
      };
      const none = '<span aria-hidden="true">—</span><span class="sr-only">Tidak ada data</span>';

      function cardOf(q, self) {
        const image = q.cover || imageOf(q, colorOf(q) && colorOf(q).id);
        const name = escapeHtml(q.short);
        const photo = `
              <picture>
                <source type="image/webp" srcset="${img(image)}">
                <img src="${imgFallback(image)}" width="800" height="800" loading="lazy" decoding="async" alt="">
              </picture>`;
        return `
          <div class="cmp__prod" role="columnheader">
            ${self
              ? `<p class="cmp__pick cmp__pick--self">${name}</p>`
              : `<div class="cmp__dd" data-cmp-dd>
                  <button class="cmp__pick" type="button" id="cmp-pick" aria-haspopup="listbox" aria-expanded="false" aria-controls="cmp-list" aria-label="Bandingkan dengan: ${name}">
                    <span class="cmp__pick-name">${name}</span>${icon('chevron-down', 'icon cmp__chev')}
                  </button>
                  <ul class="menu cmp__list" id="cmp-list" role="listbox" aria-label="Bandingkan dengan">${rivals.map((r) => `
                    <li class="menu__item cmp__opt" role="option" tabindex="-1" aria-selected="${r === q}" data-cmp-opt="${r.id}">
                      ${icon('check', 'icon menu__check')}
                      <span class="cmp__opt-name">${escapeHtml(r.short)}</span>
                      ${r.stock === 'out' ? '<span class="cmp__opt-note">Stok habis</span>' : ''}
                    </li>`).join('')}
                  </ul>
                </div>`}
            ${self || q.stock === 'out'
              // sold out has no page to open, the same as its card on /produk/
              ? `<div class="cmp__media">${photo}</div>`
              : `<a class="cmp__media" href="${detailUrl(q)}" aria-label="Lihat ${name}">${photo}</a>`}
          </div>`;
      }

      function renderCompare() {
        const cols = [p, rival];
        const maps = cols.map(specsOf);
        const rows = [
          ['Harga', cols.map((q) => rupiah(priceOf(q, colorOf(q) && colorOf(q).id)))],
          ['Rating', cols.map((q) => (q.rating ? `${q.rating}/5${q.ratingCount ? ` (${num(q.ratingCount)} ulasan)` : ''}` : null))],
          ['Terjual', cols.map((q) => (q.sold ? soldLabel(q.sold) : null))],
          ['Stok', cols.map((q) => STOCK_TEXT[q.stock] || null)],
          ...[...new Set(maps.flatMap((m) => [...m.keys()]))].map((k) => [k, maps.map((m) => m.get(k) ?? null)]),
        ].filter(([, vals]) => vals.some((v) => v != null));

        box.innerHTML = `
          <div class="cmp" role="table" aria-label="Perbandingan ${escapeHtml(p.short)} dan ${escapeHtml(rival.short)}">
            <div class="cmp__row cmp__row--head" role="row">
              <span class="cmp__corner" role="columnheader"><span class="sr-only">Fitur</span></span>
              ${cardOf(p, true)}${cardOf(rival, false)}
            </div>
            ${rows.map(([k, vals]) => `
              <div class="cmp__row" role="row">
                <span class="cmp__label" role="rowheader">${escapeHtml(k)}</span>
                ${vals.map((v) => `<span class="cmp__cell" role="cell">${v == null ? none : escapeHtml(v)}</span>`).join('')}
              </div>`).join('')}
          </div>`;
      }

      /* The picker: a button that opens a listbox drawn as the site's own menus (the products
         page's sort menu) rather than the browser's native list. Arrows, Home/End move through
         it, Enter/Space pick, Escape closes and hands focus back, Tab or a click outside just
         closes. The box re-renders on a pick, so focus goes to the new button. */
      const dd = () => $('[data-cmp-dd]', box);
      const isOpen = () => dd() && dd().classList.contains('is-open');
      const opts = () => $$('[data-cmp-opt]', box);
      function openList(at) {
        dd().classList.add('is-open');
        $('#cmp-pick', box).setAttribute('aria-expanded', 'true');
        const list = opts();
        (at === 'last' ? list[list.length - 1] : list.find((o) => o.getAttribute('aria-selected') === 'true') || list[0]).focus();
      }
      function closeList(restoreFocus = true) {
        if (!isOpen()) return;
        dd().classList.remove('is-open');
        $('#cmp-pick', box).setAttribute('aria-expanded', 'false');
        if (restoreFocus) $('#cmp-pick', box).focus();
      }
      function choose(id) {
        if (id !== rival.id) {
          rival = byId[id];
          renderCompare();
          announce(`Membandingkan dengan ${rival.short}.`);
        }
        closeList(false);
        $('#cmp-pick', box).focus();
      }

      box.addEventListener('click', (e) => {
        const opt = e.target.closest('[data-cmp-opt]');
        if (opt) { choose(opt.dataset.cmpOpt); return; }
        if (e.target.closest('#cmp-pick')) { if (isOpen()) closeList(); else openList(); }
      });
      box.addEventListener('keydown', (e) => {
        if (e.target.id === 'cmp-pick' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
          e.preventDefault();
          openList(e.key === 'ArrowUp' ? 'last' : 'selected');
          return;
        }
        if (!e.target.closest('[data-cmp-opt]')) return;
        const list = opts();
        const i = list.indexOf(document.activeElement);
        const focusAt = (n) => { e.preventDefault(); list[(n + list.length) % list.length].focus(); };
        if (e.key === 'ArrowDown') focusAt(i + 1);
        else if (e.key === 'ArrowUp') focusAt(i - 1);
        else if (e.key === 'Home') focusAt(0);
        else if (e.key === 'End') focusAt(list.length - 1);
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(list[i].dataset.cmpOpt); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeList(); }
        else if (e.key === 'Tab') closeList(false);
      });
      document.addEventListener('click', (e) => { if (isOpen() && !dd().contains(e.target)) closeList(false); });
      renderCompare();
    }

    /* Tabs — the WAI-ARIA tabs pattern with automatic activation: arrows move and select,
       Home/End jump. The bar sticks under the navbar, so every panel is one tap away from
       anywhere on the page; switching brings the new panel's top into view. */
    const tabsBox = $('[data-tabs]', pdp);
    const tabList = $('[role="tablist"]', tabsBox);
    // a tab with nothing to show (Bandingkan for a product alone in its category) is hidden
    const tabs = $$('[role="tab"]', tabList).filter((t) => !t.hidden);

    // Only scrolls when the reader is already below the tab bar's resting place (or `force`),
    // so picking a tab near the top of the page never yanks it.
    const revealTabs = (force) => {
      const top = tabsBox.getBoundingClientRect().top + window.scrollY - header.offsetHeight;
      if (force || window.scrollY > top + 1) window.scrollTo({ top, behavior: behavior() });
    };

    function selectTab(tab, { focus = false, scroll = false } = {}) {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        $('#' + t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus({ preventScroll: true });
      const { offsetLeft, offsetWidth } = tab;
      if (offsetLeft < tabList.scrollLeft || offsetLeft + offsetWidth > tabList.scrollLeft + tabList.clientWidth) {
        tabList.scrollTo({ left: offsetLeft - 24, behavior: behavior() });
      }
      history.replaceState(null, '', `${location.pathname}${location.search}#${tab.dataset.tab}`);
      revealTabs(scroll);
    }

    tabs.forEach((t) => t.addEventListener('click', () => selectTab(t)));
    tabList.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(document.activeElement);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (i < 0 || to === undefined) return;
      e.preventDefault();
      selectTab(tabs[(to + tabs.length) % tabs.length], { focus: true });
    });
    // "Lihat ulasan" by the rating, and any other in-page link that names a tab
    pdp.addEventListener('click', (e) => {
      const link = e.target.closest('[data-tab-link]');
      const tab = link && tabs.find((t) => t.dataset.tab === link.dataset.tabLink);
      if (!tab) return;
      e.preventDefault();
      selectTab(tab, { focus: true, scroll: true });
    });

    /* First paint */
    sync();
    updateStrip();
    // Opens on the product's lead photo; only a link that names a variant (?varian=) opens on
    // that variant's photo instead.
    const start = params.get('varian') ? Math.max(0, colorShot()) : 0;
    setCurrent(start);
    goTo(start, false);
    const fromHash = tabs.find((t) => `#${t.dataset.tab}` === location.hash);
    if (fromHash) requestAnimationFrame(() => selectTab(fromHash, { scroll: true }));
  }

  /* ------------------------------------------------------------------
     Compilation video (YouTube loads only after a tap)
     ------------------------------------------------------------------ */
  const videoBox = $('[data-video]');
  if (videoBox && video && video.youtubeId) {
    const id = encodeURIComponent(video.youtubeId);
    videoBox.innerHTML = `
      <button class="video__poster" type="button" aria-label="Putar video: ${escapeHtml(video.title)}">
        <img src="https://i.ytimg.com/vi/${id}/maxresdefault.jpg" alt="" loading="lazy" decoding="async">
        <span class="play-btn play-btn--lg" aria-hidden="true">${icon('play')}</span>
      </button>`;
    $('button', videoBox).addEventListener('click', () => {
      videoBox.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" title="${escapeHtml(video.title)}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      $('iframe', videoBox).focus();
    });
  }

  /* ------------------------------------------------------------------
     Ulasan pembeli: the stat band and the two drifting rows
     ------------------------------------------------------------------ */
  {
    const marquee = $('[data-reviews]');
    // the home page shows the reviews flagged for it in data.js, in that order
    const list = (reviews || []).filter((r) => r.home);
    const stats = social || {};

    // every match, not the first: the rating shows both in the band and in its source line
    const setStat = (sel, value) => { if (value) $$(sel).forEach((el) => { el.textContent = value; }); };
    setStat('[data-stat-sold]', stats.sold);
    setStat('[data-stat-rating]', stats.rating);
    setStat('[data-stat-reviews]', stats.reviewCount);
    setStat('[data-stat-review-total]', stats.reviewTotal);
    setStat('[data-stat-asof]', stats.asOf);

    const starBox = $('[data-stat-stars]');
    if (starBox && stats.rating) {
      starBox.innerHTML = starGlyphs(5);
      starBox.setAttribute('role', 'img');
      starBox.setAttribute('aria-label', `Rata-rata ${stats.rating} dari 5 bintang`);
    }

    if (marquee && list.length) {
      // The duplicate half is what the loop scrolls into, so it is hidden from AT and from
      // the reduced-motion rail rather than read out twice.
      const card = reviewShotHTML;

      const shots = list.filter((r) => r.screenshot);
      // Seconds per card rather than a fixed duration, so adding reviews in data.js makes the
      // row longer instead of faster.
      const PACE = 11;
      // The reviews split over two rows at every width, alternating, the second drifting the
      // other way.
      const second = $('[data-reviews-second]', marquee);
      const renderRows = () => {
        const rows = [shots.filter((_, k) => k % 2 === 0), shots.filter((_, k) => k % 2 === 1)];
        second.hidden = false;
        $$('[data-reviews-row]', marquee).forEach((row, i) => {
          const set = rows[i] || [];
          row.innerHTML = set.length ? set.map((r) => card(r, false)).join('') + set.map((r) => card(r, true)).join('') : '';
          row.style.setProperty('--mq-dur', (set.length * PACE).toFixed(1) + 's');
        });
      };
      // A card pops (stars lift, sticker springs up) once both its stars and its sticker are
      // wholly on screen and clear of the row's faded ends (7% each side, so 8% here) and out of
      // the screen's bottom fifth, so the whole pop is seen, on a phone and on a desktop, in the
      // row drifting left and in the one drifting right; and again on every later pass, as the
      // rows loop. It settles once both parts have left that area entirely, so the sticker,
      // which grows as it pops, can't flicker it at the edge. An IntersectionObserver can't do
      // this: the rows move by a CSS animation, which it never re-checks, so cards would only
      // pop when the page scrolled. Instead the cards are measured about ten times a second,
      // and only while the section is on screen.
      let checking = 0;
      const inside = (r, z) => r.left >= z.l && r.right <= z.r && r.top >= z.t && r.bottom <= z.b;
      const outside = (r, z) => r.right <= z.l || r.left >= z.r || r.bottom <= z.t || r.top >= z.b;
      const check = () => {
        const W = innerWidth, H = innerHeight;
        const z = { l: W * 0.08, r: W * 0.92, t: 0, b: H * 0.8 };
        $$('.review-shot', marquee).forEach((c) => {
          const rs = [$('.review-shot__stars', c), $('.review-shot__tag', c)].filter(Boolean).map((e) => e.getBoundingClientRect());
          if (rs.every((r) => inside(r, z))) c.classList.add('is-popped');
          else if (rs.every((r) => outside(r, z))) c.classList.remove('is-popped');
        });
      };
      const loop = () => {
        if (marquee.classList.contains('is-offscreen') || document.hidden) { checking = 0; return; }
        check();
        checking = setTimeout(loop, 100);
      };
      const watch = () => {
        if (reducedMotion.matches) { $$('.review-shot', marquee).forEach((c) => c.classList.add('is-popped')); return; }
        if (!checking) loop();
      };
      // the section's own observer (below) flips .is-offscreen; restart the checks when it clears
      new MutationObserver(() => { if (!marquee.classList.contains('is-offscreen')) watch(); })
        .observe(marquee, { attributes: true, attributeFilter: ['class'] });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) watch(); });

      renderRows();
      watch();
      marquee.hidden = false;

      // tapping a card opens it full size; the rows stop while it is open
      wireReviewZoom(marquee, (open) => marquee.classList.toggle('is-zoomed', open));

      // Stops the row while the section is off screen. The margin starts them again just
      // before they scroll into view, so they are never caught standing still.
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(
          ([entry]) => marquee.classList.toggle('is-offscreen', !entry.isIntersecting),
          { rootMargin: '200px 0px' },
        ).observe(marquee);
      }
    }
  }

  // Close the menu drawer once the layout reaches desktop, where the links sit in the bar
  desktop.addEventListener('change', () => { if (openDrawer === menuDrawer && desktop.matches) hideDrawer(menuDrawer, false); });

  /* ------------------------------------------------------------------
     Teknologi cards (phones): copy behind a show-more button
     ------------------------------------------------------------------ */
  /* Below 600 the card's copy opens as a bubble over its headline, on a tap on the card or the
     (visually hidden) show-more button. One open at a time; a tap anywhere else or Escape
     closes it, Escape handing focus back. */
  const techGrid = $('.tech-grid');
  if (techGrid) {
    let openedAt = 0;
    const setOpen = (btn, open) => {
      btn.closest('.tech-card').classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
      $('span', btn).textContent = open ? 'Tutup' : 'Lihat detail';
    };
    const closeAll = (except) => $$('[data-tech-more][aria-expanded="true"]', techGrid)
      .forEach((b) => { if (b !== except) setOpen(b, false); });

    techGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.tech-card');
      const btn = e.target.closest('[data-tech-more]') ||
        (card && window.matchMedia('(max-width: 599px)').matches && $('[data-tech-more]', card));
      if (!btn) return;
      const open = btn.getAttribute('aria-expanded') !== 'true';
      closeAll(btn);
      setOpen(btn, open);
      openedAt = techGrid.scrollLeft;
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.tech-card.is-open')) closeAll(); });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const btn = $('[data-tech-more][aria-expanded="true"]', techGrid);
      if (!btn) return;
      setOpen(btn, false);
      btn.focus();
    });
    // Swiping the rail on to the next card closes the bubble; a nudge of a few pixels (the snap
    // settling after a tap) does not.
    techGrid.addEventListener('scroll', () => { if (Math.abs(techGrid.scrollLeft - openedAt) > 40) closeAll(); }, { passive: true });

    /* Phones: the cards as a coverflow (CSS under .tech-grid.is-flow), stepped through by the
       sliding dots and the prev/next arrows under it, the same dots and 5s fill as the home rails. It loops: each card's
       place is its distance from the current one around the ring, -1 left, 0 middle, 1 right,
       2 parked out of sight on the right (with four cards one is always parked). A card leaving
       on the left glides out to -2 first and only then jumps, unseen, to the parked spot on the
       right, so it never sweeps back across behind the middle. A sideways swipe steps it like
       the arrows. Only the middle card can be reached; the rest are inert, so a tap on a side
       card does nothing. It pauses with a finger, pointer or focus on it, while a
       detail bubble is open, and off screen. From 600 up the grid comes back untouched. */
    const techCtrl = $('[data-tech-ctrl]');
    const phone = window.matchMedia('(max-width: 599px)');
    if (techCtrl) {
      const cards = $$('.tech-card', techGrid);
      const dotsBox = $('[data-rail-dots]', techCtrl);
      dotsBox.innerHTML = cards.map((_, k) =>
        `<button type="button" aria-label="Ke kartu ${k + 1} dari ${cards.length}"></button>`).join('');
      const dots = $$('button', dotsBox);
      techCtrl.style.setProperty('--rail-autoplay', RAIL_AUTOPLAY + 'ms');
      let current = 0, hovered = false, focused = false, touching = false, visible = false;

      const setPaused = () => techCtrl.classList.toggle('is-paused',
        hovered || focused || touching || !visible || !!$('.tech-card.is-open', techGrid));

      const n = cards.length;
      // distance around the ring, from -1 up to 2 for four cards
      const ring = (k, i) => { let d = (k - i + n) % n; if (d > n / 2) d -= n; return d; };
      const place = (c, off, snap = false) => {
        if (snap) c.classList.add('is-snapping');
        c.style.setProperty('--off', String(off));
        c.style.setProperty('--far', off === 0 ? '0' : '1');
        c.style.setProperty('--z', String(off === 0 ? 3 : Math.abs(off) === 1 ? 2 : 1));
        c.dataset.cf = off === 0 ? 'middle' : Math.abs(off) === 1 ? 'side' : 'parked';
        // Every card but the middle one is out of reach: no tap, no focus, hidden from screen
        // readers. The arrows and dots are what move the row on.
        c.inert = off !== 0;
        const side = off !== 0;
        c.tabIndex = side ? -1 : 0;
        c.toggleAttribute('aria-hidden', side);
        $$('button', c).forEach((b) => { b.tabIndex = side ? -1 : 0; });
        if (snap) { void c.offsetWidth; c.classList.remove('is-snapping'); }
      };
      const timers = new Map();
      const show = (i, first = false) => {
        current = i;
        closeAll();
        cards.forEach((c, k) => {
          clearTimeout(timers.get(c));
          const was = c.style.getPropertyValue('--off') === '' ? null : Number(c.style.getPropertyValue('--off'));
          const off = ring(k, i);
          if (first || was === null) { place(c, off, true); return; }
          if (off === 2 && was < 0) {
            // left the row on the left: out to -2, then across to the parked spot unseen
            place(c, -2);
            timers.set(c, setTimeout(() => place(c, 2, true), 620));
          } else if (off === -1 && was === 2) {
            // stepping back: the parked card comes in from the left, not across the middle
            place(c, -2, true);
            requestAnimationFrame(() => place(c, -1));
          } else {
            place(c, off);
          }
        });
        dots.forEach((d, k) => (k === i ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
        setPaused();
      };
      const reset = () => cards.forEach((c) => {
        clearTimeout(timers.get(c));
        ['--off', '--far', '--z'].forEach((v) => c.style.removeProperty(v));
        delete c.dataset.cf; c.inert = false;
        c.tabIndex = 0; c.removeAttribute('aria-hidden');
        $$('button', c).forEach((b) => b.removeAttribute('tabindex'));
      });

      const apply = () => {
        techGrid.classList.toggle('is-flow', phone.matches);
        techCtrl.hidden = !phone.matches;
        if (phone.matches) show(current, true); else reset();
      };

      dotsBox.addEventListener('click', (e) => {
        const d = e.target.closest('button');
        if (d) show(dots.indexOf(d));
      });
      // The ring loops, so neither arrow ever runs out.
      $('[data-tech-prev]', techCtrl).addEventListener('click', () => show((current - 1 + n) % n));
      $('[data-tech-next]', techCtrl).addEventListener('click', () => show((current + 1) % n));
      dotsBox.addEventListener('animationend', (e) => {
        if (e.animationName !== 'dot-progress' || reducedMotion.matches || !phone.matches) return;
        if (techCtrl.classList.contains('is-paused') || document.hidden || openDrawer) return;
        show((current + 1) % cards.length);
      });
      // a bubble opening or closing changes whether the stack may move on
      techGrid.addEventListener('click', () => requestAnimationFrame(setPaused));
      document.addEventListener('click', () => requestAnimationFrame(setPaused));

      const zone = [techGrid, techCtrl];
      zone.forEach((el) => {
        el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hovered = true; setPaused(); } });
        el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { hovered = false; setPaused(); } });
        el.addEventListener('focusin', () => { focused = true; setPaused(); });
        el.addEventListener('focusout', (e) => { if (!zone.some((z) => z.contains(e.relatedTarget))) { focused = false; setPaused(); } });
      });
      // A drag further sideways than down, past 40px, steps the row: left on, right back.
      // Pointer events, so a finger and a mouse both swipe; the tap that ends a swipe doesn't
      // also open the card's bubble.
      let x0 = null, y0 = 0, swiped = false;
      techGrid.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        x0 = e.clientX; y0 = e.clientY; swiped = false;
        if (e.pointerType !== 'mouse') { touching = true; setPaused(); }
      });
      const endSwipe = (e) => {
        if (x0 === null) return;
        const dx = e.clientX - x0, dy = e.clientY - y0;
        x0 = null; touching = false;
        if (e.type === 'pointerup' && phone.matches && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
          swiped = true;
          show((current + (dx < 0 ? 1 : -1) + n) % n);
        } else setPaused();
      };
      techGrid.addEventListener('pointerup', endSwipe);
      techGrid.addEventListener('pointercancel', endSwipe);
      techGrid.addEventListener('click', (e) => { if (swiped) { swiped = false; e.stopImmediatePropagation(); } }, true);
      // a mouse drag would otherwise pick up the picture and drag it out as a file
      techGrid.addEventListener('dragstart', (e) => e.preventDefault());
      new IntersectionObserver(([en]) => { visible = en.isIntersecting; setPaused(); }, { threshold: 0.5 }).observe(techGrid);

      phone.addEventListener('change', apply);
      apply();
    }
  }

  /* ------------------------------------------------------------------
     Tentang Kami: light beams behind the opening
     ------------------------------------------------------------------ */
  /* A port of the "Beams Background" React component to plain canvas. Thirty soft columns of
     light lean across the section and drift upward; each pulses gently and, once it has risen
     off the top, comes back in from the bottom in one of three lanes so the light stays spread.
     Recoloured from the original's cyan-blue (hue 190-260) to the brand's violet-to-magenta
     (hue ~265-300, #8E48C4 to #DB4DFF). The blur is CSS on the canvas, so the canvas itself is
     drawn at a quarter of the screen's resolution: the blur hides it and the drawing gets far
     cheaper. It sizes to its section, stops while off screen or in a background tab, and draws
     one still frame for readers who ask for reduced motion. */
  const beamsBox = $('[data-beams]');
  const beamsCanvas = beamsBox && $('canvas', beamsBox);
  const beamsCtx = beamsCanvas && beamsCanvas.getContext('2d');
  if (beamsCtx) {
    const COUNT = 30;
    const SCALE = 0.25;
    const HUE = [265, 300];
    let w = 0, h = 0, beams = [], frame = 0, last = 0, visible = true;
    // Beam widths were made for a desktop screen; on a phone the same widths overlap into one
    // even wash under the blur. They scale with the section's width instead (down to 40%).
    let k = 1;

    const makeBeam = () => ({
      x: Math.random() * w * 1.5 - w * 0.25,
      y: Math.random() * h * 1.5 - h * 0.25,
      width: (30 + Math.random() * 60) * k,
      length: h * 2.5,
      angle: -35 + Math.random() * 10,
      speed: 0.6 + Math.random() * 1.2,
      opacity: 0.12 + Math.random() * 0.16,
      hue: HUE[0] + Math.random() * (HUE[1] - HUE[0]),
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.02 + Math.random() * 0.03,
    });
    function resetBeam(beam, i) {
      const lane = w / 3;
      beam.y = h + 100;
      beam.x = (i % 3) * lane + lane / 2 + (Math.random() - 0.5) * lane * 0.5;
      beam.width = (100 + Math.random() * 100) * k;
      beam.speed = 0.5 + Math.random() * 0.4;
      beam.hue = HUE[0] + (i * (HUE[1] - HUE[0])) / COUNT;
      beam.opacity = 0.2 + Math.random() * 0.1;
    }
    function drawBeam(b) {
      // x1.9: the original's strength, which its full-resolution canvas and lighter page lost here
      // and narrower beams carry less light, so they burn brighter in step (up to x1.5 on a phone)
      const a = Math.min(1, b.opacity * (0.8 + Math.sin(b.pulse) * 0.2) * 1.9 * (1 + (1 - k) * 0.8));
      const c = (k) => `hsla(${b.hue}, 85%, 62%, ${a * k})`;
      beamsCtx.save();
      beamsCtx.translate(b.x, b.y);
      beamsCtx.rotate((b.angle * Math.PI) / 180);
      const g = beamsCtx.createLinearGradient(0, 0, 0, b.length);
      g.addColorStop(0, c(0)); g.addColorStop(0.1, c(0.5)); g.addColorStop(0.4, c(1));
      g.addColorStop(0.6, c(1)); g.addColorStop(0.9, c(0.5)); g.addColorStop(1, c(0));
      beamsCtx.fillStyle = g;
      beamsCtx.fillRect(-b.width / 2, 0, b.width, b.length);
      beamsCtx.restore();
    }
    function paint(step) {
      beamsCtx.setTransform(1, 0, 0, 1, 0, 0);
      beamsCtx.clearRect(0, 0, beamsCanvas.width, beamsCanvas.height);
      beamsCtx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      beams.forEach((b, i) => {
        b.y -= b.speed * step;
        b.pulse += b.pulseSpeed * step;
        if (b.y + b.length < -100) resetBeam(b, i);
        drawBeam(b);
      });
    }
    function size() {
      const r = beamsBox.getBoundingClientRect();
      w = r.width; h = r.height;
      k = Math.min(1, Math.max(0.4, w / 1280));
      beamsCanvas.width = Math.max(1, Math.round(w * SCALE));
      beamsCanvas.height = Math.max(1, Math.round(h * SCALE));
      beams = Array.from({ length: COUNT }, makeBeam);
      if (reducedMotion.matches) paint(0);
    }
    // Movement is per 60th of a second, so the drift is the same speed on any refresh rate.
    function tick(t) {
      const step = last ? Math.min((t - last) / (1000 / 60), 3) : 1;
      last = t;
      paint(step);
      frame = requestAnimationFrame(tick);
    }
    const run = () => {
      cancelAnimationFrame(frame); frame = 0; last = 0;
      if (reducedMotion.matches) { paint(0); return; }
      if (visible && !document.hidden) frame = requestAnimationFrame(tick);
    };

    size();
    run();
    new ResizeObserver(() => { size(); if (!frame) run(); }).observe(beamsBox);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }).observe(beamsBox);
    document.addEventListener('visibilitychange', run);
    reducedMotion.addEventListener('change', run);
  }

  /* ------------------------------------------------------------------
     Hubungi Kami: the form writes the message and hands it to WhatsApp or the visitor's email
     app, already filled in. There is no server behind the site, so nothing is sent or stored
     here; the visitor sends it from their own app.
     ------------------------------------------------------------------ */
  const contactForm = $('[data-contact-form]');
  if (contactForm) {
    const nameField = $('#ct-name', contactForm);
    const orderField = $('#ct-order', contactForm);
    const message = $('#ct-message', contactForm);
    const orderWrap = $('[data-order-field]', contactForm);
    const counter = $('[data-contact-count]', contactForm);
    const status = $('[data-contact-status]', contactForm);
    const topic = () => $('input[name="topic"]:checked', contactForm);

    // The order number only asks for itself where it helps: orders and warranty claims.
    const syncTopic = () => { orderWrap.hidden = !topic().hasAttribute('data-needs-order'); };
    $$('input[name="topic"]', contactForm).forEach((r) => r.addEventListener('change', syncTopic));
    syncTopic();

    const renderCount = () => { counter.textContent = `${message.value.length}/${message.maxLength}`; };
    message.addEventListener('input', renderCount);
    renderCount();

    const fieldOf = (input) => input.closest('.pdp-field');
    const setError = (input, text) => {
      fieldOf(input).classList.toggle('is-invalid', Boolean(text));
      $('.pdp-hint', fieldOf(input)).textContent = text;
      input.setAttribute('aria-invalid', String(Boolean(text)));
    };
    [nameField, message].forEach((input) => input.addEventListener('input', () => {
      if (fieldOf(input).classList.contains('is-invalid')) setError(input, '');
    }));

    function validate() {
      const errors = [];
      if (nameField.value.trim().length < 2) errors.push([nameField, 'Isi nama kamu dulu ya.']);
      if (message.value.trim().length < 10) errors.push([message, 'Ceritain sedikit lebih detail (minimal 10 karakter).']);
      [nameField, message].forEach((input) => setError(input, ''));
      errors.forEach(([input, text]) => setError(input, text));
      if (errors.length) errors[0][0].focus();
      return !errors.length;
    }

    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validate()) return;
      const name = nameField.value.trim();
      const subject = topic().value;
      const order = orderWrap.hidden ? '' : orderField.value.trim();
      const lines = [`Halo Nexura, saya ${name}.`, `Topik: ${subject}`];
      if (order) lines.push(`No. pesanan: ${order}`);
      lines.push('', message.value.trim());
      const text = lines.join('\n');

      const viaEmail = e.submitter && e.submitter.value === 'email';
      const url = viaEmail
        ? `mailto:${contactForm.dataset.email}?subject=${encodeURIComponent(`[${subject}] ${name}`)}&body=${encodeURIComponent(text)}`
        : `https://wa.me/${contactForm.dataset.wa}?text=${encodeURIComponent(text)}`;
      if (viaEmail) location.href = url;
      else window.open(url, '_blank', 'noopener');

      // Said out loud too (role="status"), with a way in should a blocker have stopped it.
      status.hidden = false;
      status.innerHTML = viaEmail
        ? `Pesanmu udah kami siapin di aplikasi email. Tinggal tekan kirim. Nggak kebuka? <a href="${escapeHtml(url)}">Coba lagi</a> atau email ke ${escapeHtml(contactForm.dataset.email)}.`
        : `Pesanmu udah kami siapin di WhatsApp. Tinggal tekan kirim. Nggak kebuka? <a href="${escapeHtml(url)}" target="_blank" rel="noopener">Buka WhatsApp</a>.`;
    });
  }


  /* ------------------------------------------------------------------
     Chat bubble: a WhatsApp shortcut pinned bottom-right on every page. Added here rather than
     in each page's markup, so the number lives in one place. On a phone it rides above
     whichever bar is pinned to the bottom (product dock, cart or checkout pay bar).
     ------------------------------------------------------------------ */
  {
    const bubble = document.createElement('a');
    bubble.className = 'chat-bubble';
    bubble.href = 'https://wa.me/6212345678901?text=' + encodeURIComponent('Halo Nexura, saya mau tanya.');
    bubble.target = '_blank';
    bubble.rel = 'noopener';
    bubble.setAttribute('aria-label', 'Chat dengan Nexura di WhatsApp');
    bubble.innerHTML = `<svg class="chat-bubble__icon" viewBox="0 0 32 32" aria-hidden="true">
        <path class="chat-bubble__shape" d="M16 5C9 5 4 9.6 4 15.2c0 3.1 1.5 5.8 4 7.7-.2 1.6-.9 3.2-2.1 4.4-.3.3-.1.8.3.8 2.5 0 4.6-.9 6.1-2.2 1.2.3 2.4.5 3.7.5 7 0 12-4.6 12-10.2S23 5 16 5Z"/>
        <circle cx="10.6" cy="15.4" r="1.9"/><circle cx="16" cy="15.4" r="1.9"/><circle cx="21.4" cy="15.4" r="1.9"/>
      </svg>`;
    document.body.appendChild(bubble);

    const docks = $$('.pdp-dock, .cart-pay, .co-paybar');
    if (docks.length) {
      const lift = () => {
        const h = docks.reduce((max, d) => {
          if (getComputedStyle(d).position !== 'fixed') return max;
          const r = d.getBoundingClientRect();
          return r.height && r.top < innerHeight ? Math.max(max, innerHeight - r.top) : max;
        }, 0);
        document.documentElement.style.setProperty('--chat-lift', `${Math.round(h)}px`);
      };
      const ro = new ResizeObserver(lift);
      docks.forEach((d) => ro.observe(d));
      addEventListener('resize', lift);
      lift();
    }
  }

})();
