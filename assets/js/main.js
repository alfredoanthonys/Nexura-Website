(() => {
  'use strict';

  const { products, categories, categoryLeads, video, social, reviews, store } = window.NEXURA;
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
    header.classList.remove('is-hidden'); // the bar owns the cart button the drawer returns focus to
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
      closeSearch(true);
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

  function closeSearch(collapsePanel = false) {
    searchList.hidden = true;
    searchInput.setAttribute('aria-expanded', 'false');
    searchInput.removeAttribute('aria-activedescendant');
    if (collapsePanel && header.classList.contains('is-search-open')) {
      header.classList.remove('is-search-open');
      searchToggle.setAttribute('aria-expanded', 'false');
      searchToggle.focus();
    }
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
  document.addEventListener('click', (e) => { if (!e.target.closest('[data-search]') && !e.target.closest('[data-search-toggle]')) closeSearch(); });

  /* ------------------------------------------------------------------
     Header retracts on scroll down, returns on scroll up
     ------------------------------------------------------------------ */
  {
    const THRESHOLD = 6; // ignore sub-pixel jitter and trackpad noise
    let lastY = window.scrollY;
    let headerH = header.offsetHeight;
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY;
      // keep the bar put while an overlay, the search panel or a focused control needs it
      const pinned = openDrawer || header.classList.contains('is-search-open') || header.contains(document.activeElement);
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

  searchToggle.addEventListener('click', () => {
    const open = !header.classList.contains('is-search-open');
    header.classList.toggle('is-search-open', open);
    searchToggle.setAttribute('aria-expanded', String(open));
    if (open) searchInput.focus(); else closeSearch();
  });

  /* ------------------------------------------------------------------
     Ticker: the claim band between the nav and the banner
     ------------------------------------------------------------------ */
  {
    const ticker = $('[data-ticker]');
    const row = ticker && $('[data-ticker-row]', ticker);
    if (row) {
      // The figures are the same ones the stat band publishes, so they are read from
      // NEXURA.social rather than written into the markup twice. A missing key keeps the
      // em-dash that is already there.
      $$('[data-tick]', row).forEach((el) => {
        const value = (social || {})[el.dataset.tick];
        if (value) el.textContent = value;
      });

      // Seconds per claim, not a fixed duration: one more claim in the markup makes the row
      // longer rather than quicker.
      const claims = $$('.ticker__item', row);
      row.style.setProperty('--tick-dur', (claims.length * 5).toFixed(1) + 's');

      // The copy is what the loop drifts into, so it is hidden from assistive tech and from
      // the reduced-motion rail instead of being read out twice.
      const copy = row.cloneNode(true);
      $$('.ticker__item', copy).forEach((el) => {
        el.classList.add('ticker__item--dup');
        el.setAttribute('aria-hidden', 'true');
      });
      row.insertAdjacentHTML('beforeend', copy.innerHTML);

      // Stops once the band has scrolled past: animating out of view is frames nobody sees.
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(
          ([entry]) => ticker.classList.toggle('is-offscreen', !entry.isIntersecting),
          { rootMargin: '200px 0px' },
        ).observe(ticker);
      }
    }
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
  function cardHTML(p, { heading = 'h3', eager = false } = {}) {
    const color = colorOf(p);
    // `cover` is a lineup shot that beats any single variant on a card (see Reflex).
    const image = p.cover || imageOf(p, color && color.id);
    // Sold out: a "Sold Out" disc over the picture and no link, so the card cannot be opened.
    const out = p.stock === 'out';
    return `
      <article class="product-card${out ? ' is-out' : ''}" id="produk-${p.id}" data-id="${p.id}" data-category="${p.category}">
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
          <p class="product-card__meta">${[
            p.rating ? `<span class="product-card__rating">${icon('star')}<span class="sr-only">Rating </span>${p.rating}</span>` : '',
            p.sold ? `<span>${soldLabel(p.sold)} terjual</span>` : '',
          ].filter(Boolean).join('<span class="product-card__dot" aria-hidden="true"></span>')}</p>
          <p class="product-card__cat">${escapeHtml(categories[p.category] || '')}</p>
          ${p.note ? `<p class="product-card__note">${escapeHtml(p.note)}</p>` : ''}
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
    // The tile takes the last cell of the first row, so the grid shows one product fewer than the
    // row holds rather than pushing a control onto a line of its own. It leaves for the products
    // page, so the rest of the catalogue is that page's job, not this grid's.
    const COLLAPSED = 3;

    // Featured and in stock, best sellers first: a sold-out product drops out of the grid on
    // its own and the next featured one takes its place.
    grid.innerHTML = products.filter((p) => p.featured && p.stock !== 'out')
      .sort((a, b) => (a.popular || 99) - (b.popular || 99))
      .slice(0, COLLAPSED).map((p) => cardHTML(p)).join('') + `
      <a class="more-card" href="${PRODUCTS_PAGE}">
        <span class="more-card__icon">${icon('arrow-right', 'icon')}</span>
        <span class="more-card__label">Lihat produk lainnya</span>
      </a>`;
  }

  /* ------------------------------------------------------------------
     Products page: category chips, the Filter menu, the count
     ------------------------------------------------------------------ */
  const catalog = $('[data-catalog]');
  if (catalog) {
    const catalogGrid = $('[data-catalog-grid]', catalog);
    const rail = $('[data-chip-rail]', catalog);
    const chips = $$('[data-cat]', rail);
    const menuWrap = $('[data-filter-menu]', catalog);
    const menuBtn = $('[aria-haspopup="menu"]', menuWrap);
    const menu = $('[role="menu"]', menuWrap);
    const allMenuItems = $$('[role^="menuitem"]', menu);
    // The reset item is hidden while everything is at its default, so the keys skip it then.
    const menuItems = () => allMenuItems.filter((it) => !it.closest('[hidden]'));
    const menuReset = $('[data-menu-reset]', menu);
    const stockItem = $('[data-stock]', menu);
    const sortItems = $$('[data-sort]', menu);
    const activeDot = $('[data-filter-dot]', menuBtn);
    const empty = $('[data-catalog-empty]', catalog);
    const count = $('[data-catalog-count]', catalog);
    const title = $('[data-page-title]');
    const lead = $('[data-page-lead]');
    const crumbProduk = $('[data-crumb-produk]');
    const crumbCat = $$('[data-crumb-cat]');
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
    const DEFAULTS = { category: 'all', sort: 'terpopuler', inStock: false };
    const state = { ...DEFAULTS };

    // The URL carries the state, so a filtered list can be shared, bookmarked and reloaded, and
    // the navbar's category links can land straight on their category.
    const params = new URLSearchParams(location.search);
    if (categories[params.get('kategori')]) state.category = params.get('kategori');
    if (SORTS[params.get('urutkan')]) state.sort = params.get('urutkan');
    state.inStock = params.get('stok') === 'tersedia';

    const compare = (a, b) => SORTS[state.sort].cmp(a, b) || byPopular(a, b);
    const isDefaultMenu = () => state.sort === DEFAULTS.sort && state.inStock === DEFAULTS.inStock;
    const isDefault = () => isDefaultMenu() && state.category === DEFAULTS.category;
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
      const s = q.toString();
      history.replaceState(null, '', location.pathname + (s ? `?${s}` : ''));
    }

    // The headline and the trail name the category, so a chip reads as arriving somewhere
    // rather than as hiding cards. Produk turns back into a link once there is a level under it.
    function syncHeading() {
      const label = categoryLabel();
      const inCategory = state.category !== 'all';
      title.textContent = label;
      lead.textContent = categoryLeads[state.category] || '';
      // A category with its products on the banner (see .page-head[data-cat] in the CSS) shows them.
      head.dataset.cat = state.category;
      document.title = `${label} — Nexura | #GearYourAura`;
      crumbProduk.innerHTML = inCategory
        ? `<a href="${PRODUCTS_PAGE}" data-filter="all">Produk</a>`
        : '<span aria-current="page">Produk</span>';
      crumbCat.forEach((el) => { el.hidden = !inCategory; });
      $('[aria-current]', crumbCat[crumbCat.length - 1]).textContent = inCategory ? label : '';
    }

    function apply({ animate = false, url = true } = {}) {
      const list = products
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
      activeDot.hidden = isDefaultMenu();
      menuReset.hidden = isDefault();

      empty.hidden = list.length > 0;
      count.hidden = list.length === 0;
      $('[data-count-shown]', count).textContent = list.length;
      $('[data-count-total]', count).textContent = products.length;

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

    // The navbar dropdown, the menu drawer, the footer and the breadcrumb all carry
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
       choice and closes it. */
    const isMenuOpen = () => menuWrap.classList.contains('is-open');
    function openMenu(which = 'first') {
      menuWrap.classList.add('is-open');
      menuBtn.setAttribute('aria-expanded', 'true');
      const items = menuItems();
      (which === 'last' ? items[items.length - 1] : items[0]).focus();
    }
    function closeMenu(restoreFocus = true) {
      if (!isMenuOpen()) return;
      menuWrap.classList.remove('is-open');
      menuBtn.setAttribute('aria-expanded', 'false');
      if (restoreFocus) menuBtn.focus();
    }

    menuBtn.addEventListener('click', () => (isMenuOpen() ? closeMenu() : openMenu()));
    menuBtn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); openMenu('first'); }
      if (e.key === 'ArrowUp') { e.preventDefault(); openMenu('last'); }
    });
    menu.addEventListener('keydown', (e) => {
      const items = menuItems();
      const i = items.indexOf(document.activeElement);
      const focusAt = (n) => { e.preventDefault(); items[(n + items.length) % items.length].focus(); };
      if (e.key === 'ArrowDown') focusAt(i + 1);
      else if (e.key === 'ArrowUp') focusAt(i - 1);
      else if (e.key === 'Home') focusAt(0);
      else if (e.key === 'End') focusAt(items.length - 1);
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); }
      else if (e.key === 'Tab') closeMenu(false);
    });
    menu.addEventListener('click', (e) => {
      const item = e.target.closest('[role^="menuitem"]');
      if (!item) return;
      if (item.matches('[data-catalog-reset]')) {
        // The item hides itself once everything is back to default, so focus goes to the button.
        closeMenu();
        resetFilters();
      } else if (item === stockItem) {
        state.inStock = !state.inStock;
        const n = apply({ animate: true });
        announce(`${state.inStock ? 'Hanya stok tersedia' : 'Semua stok'}. ${countMessage(n)}`);
      } else {
        state.sort = item.dataset.sort;
        const n = apply({ animate: true });
        closeMenu();
        announce(`Diurutkan: ${SORTS[state.sort].label}. ${countMessage(n)}`);
      }
    });
    document.addEventListener('click', (e) => { if (!menuWrap.contains(e.target)) closeMenu(false); });

    apply({ url: false });
    updateRail();
    keepChipInView();
  }

  /* ------------------------------------------------------------------
     Cart
     ------------------------------------------------------------------ */
  const cart = (() => {
    const KEY = 'nexura-cart-v1';
    const drawer = $('[data-cart-drawer]');
    const list = $('[data-cart-list]');
    const empty = $('[data-cart-empty]');
    const foot = $('[data-cart-foot]');
    const totalEl = $('[data-cart-total]');
    const countEl = $('[data-cart-count]');
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
    const total = () => items.reduce((sum, it) => sum + (it.checked ? priceOf(byId[it.id], it.color) * it.qty : 0), 0);
    const label = (it) => { const p = byId[it.id]; const c = colorOf(p, it.color); return c ? `${p.short} ${c.label}` : p.short; };
    const save = () => { storage.set(KEY, items); notify(); };

    function render() {
      const n = count();
      badge.hidden = n === 0;
      badge.textContent = n > 9 ? '9+' : String(n);
      trigger.setAttribute('aria-label', n ? `Keranjang, ${n} item` : 'Keranjang, kosong');
      countEl.textContent = n;
      totalEl.textContent = rupiah(total());
      empty.hidden = items.length > 0;
      foot.hidden = items.length === 0;
      list.hidden = items.length === 0;

      list.innerHTML = items.map((it) => {
        const p = byId[it.id];
        const c = colorOf(p, it.color);
        const k = keyOf(it);
        return `
          <li class="cart-item${it.checked ? '' : ' is-unchecked'}" data-key="${k}">
            <label class="cart-item__check">
              <input type="checkbox" ${it.checked ? 'checked' : ''} aria-label="Ikutkan ${escapeHtml(label(it))} di total" data-act="check">
              <span class="cart-item__box">${icon('check')}</span>
            </label>
            <img class="cart-item__thumb" src="${img(imageOf(p, it.color), 160)}" alt="" width="64" height="64">
            <div class="cart-item__info">
              <p class="cart-item__name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</p>
              <p class="cart-item__variant">${c ? `${variantLabel(p)}: ${escapeHtml(c.label)}` : escapeHtml(categories[p.category])}${it.phone ? ` · HP: ${escapeHtml(it.phone)}` : ''}</p>
              <div class="cart-item__row">
                <span class="price">${rupiah(priceOf(p, it.color))}</span>
                <div class="stepper" role="group" aria-label="Jumlah ${escapeHtml(label(it))}">
                  <button type="button" aria-label="Kurangi" data-act="dec" ${it.qty <= 1 ? 'disabled' : ''}>${icon('minus')}</button>
                  <output aria-live="polite">${it.qty}</output>
                  <button type="button" aria-label="Tambah" data-act="inc" ${it.qty >= 99 ? 'disabled' : ''}>${icon('plus')}</button>
                </div>
              </div>
            </div>
            <button class="icon-btn cart-item__remove" type="button" aria-label="Hapus ${escapeHtml(label(it))} dari keranjang" data-act="remove">${icon('trash')}</button>
          </li>`;
      }).join('');
    }

    function bump() {
      if (reducedMotion.matches) return;
      badge.classList.remove('is-bump'); void badge.offsetWidth; badge.classList.add('is-bump');
    }

    list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn || btn.dataset.act === 'check') return;
      const row = btn.closest('.cart-item');
      const it = items.find((x) => keyOf(x) === row.dataset.key);
      if (!it) return;
      const act = btn.dataset.act;
      if (act === 'inc') it.qty = Math.min(99, it.qty + 1);
      if (act === 'dec') it.qty = Math.max(1, it.qty - 1);
      if (act === 'remove') {
        const idx = items.indexOf(it);
        items.splice(idx, 1);
        save(); render();
        announce(`${label(it)} dihapus dari keranjang.`);
        // keep focus inside the drawer
        const rows = $$('.cart-item', list);
        (rows[Math.min(idx, rows.length - 1)] ? $('[data-act="remove"]', rows[Math.min(idx, rows.length - 1)]) : $('[data-drawer-close]', drawer)).focus();
        return;
      }
      save(); render();
      announce(`Jumlah ${label(it)} jadi ${it.qty}. Estimasi total ${rupiah(total())}.`);
      // re-rendering replaced the button; put focus back on its replacement
      const again = $(`.cart-item[data-key="${CSS.escape(keyOf(it))}"] [data-act="${act}"]`, list);
      if (again && !again.disabled) again.focus();
      else $(`.cart-item[data-key="${CSS.escape(keyOf(it))}"] [data-act="${act === 'inc' ? 'dec' : 'inc'}"]`, list)?.focus();
    });

    list.addEventListener('change', (e) => {
      if (e.target.dataset.act !== 'check') return;
      const row = e.target.closest('.cart-item');
      const it = items.find((x) => keyOf(x) === row.dataset.key);
      it.checked = e.target.checked;
      row.classList.toggle('is-unchecked', !it.checked);
      totalEl.textContent = rupiah(total());
      save();
      announce(`Estimasi total ${rupiah(total())}.`);
    });

    // On the cart page the drawer would only repeat the page, so the icon goes to the top of it.
    trigger.addEventListener('click', () => {
      if ($('[data-cartpage]')) window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      else showDrawer(drawer, trigger);
    });

    // On the checkout page the drawer's Checkout only has to get out of the way.
    $('[data-checkout]').addEventListener('click', () => {
      if ($('[data-checkout-page]')) hideDrawer(drawer);
      else location.href = CHECKOUT_PAGE;
    });

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
      // `focusSel` names the control in the drawer that takes focus, e.g. '[data-checkout]'.
      open(from, focusSel) { showDrawer(drawer, from || trigger, focusSel && $(focusSel, drawer)); },
    };
  })();

  /* ------------------------------------------------------------------
     Cart page (/keranjang/)
     The same items as the drawer, laid out in full: every line with its variant, phone model,
     discount and own subtotal, a select-all bar, and a summary that breaks the total down.
     Edits go through cart.set, so the badge and the drawer follow.
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
            ${was ? `<s class="price-was"><span class="sr-only">Harga normal </span>${rupiah(was)}</s>` : ''}
          </p>
          <div class="cp-item__actions">
            ${it.qty > 1 ? `<p class="cp-item__sub">Subtotal <strong class="price">${rupiah(price * it.qty)}</strong></p>` : ''}
            <button class="icon-btn cp-item__remove" type="button" aria-label="Hapus ${name} dari keranjang" data-act="remove">${icon('trash')}</button>
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
      $$('[data-sum-total]', cartPage).forEach((el) => { el.textContent = rupiah(t.total); });
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
      (near ? $('[data-act="remove"]', near) : $('[data-cartpage-shop]', cartPage)).focus();
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
      if (act === 'remove') {
        removeWhere((it) => keyOf(it) === key, (r) => `${label(r[0])} dihapus dari keranjang.`);
        return;
      }
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

    // Product cards under the cart: best sellers that are in stock and not in it already. Drawn
    // once, so a line removed above does not reshuffle the grid under the reader.
    const inCart = new Set(cart.list().map((it) => it.id));
    $('[data-cartpage-more]', cartPage).innerHTML = products
      .filter((p) => p.stock !== 'out' && !inCart.has(p.id))
      .sort((a, b) => (a.popular || 99) - (b.popular || 99))
      .slice(0, 4).map((p) => cardHTML(p)).join('');

    cart.onChange(render);
    render();
  }

  /* ------------------------------------------------------------------
     Checkout page (/checkout/)
     Buys the lines ticked in the cart: an address (guest checkout, kept in this browser), a
     courier with optional insurance, a note, a payment method and a promo code. Couriers,
     payments and promos come from NEXURA.checkout in data.js. The cart stays the source of
     the lines, so a change in the drawer redraws the order here.
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
          <img class="co-item__thumb" src="${img(imageOf(p, it.color), 160)}" alt="" width="160" height="160" decoding="async">
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
      $('[data-co-addr-line]', coPage).textContent = `${address.street}, ${address.city}, ${address.province}, ${address.postal}`;
    }

    const field = (name) => addrForm.elements[name];
    const rules = {
      name: (v) => v.length >= 2 || 'Isi nama penerima.',
      phone: (v) => /^(\+?62|0)8\d{7,12}$/.test(v.replace(/[\s-]/g, '')) || 'Nomor WhatsApp diawali 08 atau +62, contoh 0812 3456 7890.',
      street: (v) => v.length >= 10 || 'Tulis alamat lengkap: jalan, nomor rumah, kelurahan, kecamatan.',
      city: (v) => !!v || 'Isi kota atau kabupaten.',
      province: (v) => !!v || 'Isi provinsi.',
      postal: (v) => /^\d{5}$/.test(v) || 'Kode pos 5 angka.',
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

    function openAddress() {
      Object.keys(rules).forEach((name) => {
        field(name).value = address ? address[name] : '';
        field(name).closest('.pdp-field').classList.remove('is-invalid');
        field(name).setAttribute('aria-invalid', 'false');
        const hint = $('#' + field(name).getAttribute('aria-describedby'));
        hint.textContent = hint.dataset.hint;
      });
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
    payList.addEventListener('change', (e) => {
      prefs.pay = e.target.value;
      savePrefs();
      announce(`Bayar pakai ${cfg.payments.find((m) => m.id === prefs.pay).label}.`);
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

    /* Produk Lainnya: four others in stock, this one's category first, then best sellers. */
    $('[data-pdp-more]', pdp).innerHTML = products
      .filter((o) => o.id !== p.id && o.stock !== 'out')
      .sort((a, b) => (b.category === p.category) - (a.category === p.category)
        || (a.popular || 99) - (b.popular || 99))
      .slice(0, 4).map((o) => cardHTML(o)).join('');

    /* Page head, trail, title, tags */
    document.title = `${p.short} — Nexura | #GearYourAura`;
    if (p.description) $('meta[name="description"]')?.setAttribute('content', p.description[0]);
    const crumbCat = $('[data-crumb-cat]', pdp);
    crumbCat.href = `${PRODUCTS_PAGE}?kategori=${p.category}`;
    crumbCat.textContent = categories[p.category];
    $('[data-crumb-name]', pdp).textContent = p.short;
    $('[data-pdp-name]', pdp).textContent = p.name;
    // Stock speaks twice: a badge by the name when it is news (low, out), and a line by the
    // quantity every time, since that is where the question comes up.
    const STOCK = {
      in: { note: 'Stok tersedia' },
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
    stockNote.classList.add(`pdp-stock--${p.stock}`);

    $('[data-buybar-text]', pdp).innerHTML = out
      ? `<strong>${escapeHtml(p.short)}</strong> lagi restock`
      : `Dapatkan <strong>${escapeHtml(p.short)}</strong> Sekarang`;

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

    /* Buying. Both buttons put the pick in the cart and open the drawer. */
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

    const addToCart = (trigger, focusSel) => {
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
      // from the sheet, focus comes back to the dock button that opened it, not the sheet's
      cart.open(sheetOpen() ? sheetTrigger : trigger, focusSel);
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
    $$('[data-add-cart]', pdp).forEach((b) => b.addEventListener('click', (e) => addToCart(e.currentTarget)));
    // Phase 1 has no checkout page, so Beli Sekarang differs only in where it leaves focus: on
    // the drawer's Checkout button, one step from paying. TODO: go straight to checkout with
    // just this item once that page exists.
    // On a phone the top bar's button works like the dock's: it opens the sheet set to buy, so
    // colour, quantity and phone model are picked first.
    $$('[data-buy-now]', pdp).forEach((b) => b.addEventListener('click', (e) => {
      if (phoneMq.matches && !buyBox.contains(b)) {
        sheetTrigger = b;
        buyBox.dataset.mode = 'buy';
        showDrawer(buyBox, b);
        return;
      }
      addToCart(e.currentTarget, '[data-checkout]');
    }));

    const chat = $('[data-pdp-chat]', pdp);
    if (store && store.whatsapp) {
      const ask = out ? `Halo Nexura, tolong kabari saya kalau ${p.short} sudah restock.` : `Halo Nexura, saya mau tanya soal ${p.short}.`;
      chat.href = `https://wa.me/${store.whatsapp}?text=${encodeURIComponent(ask)}`;
      $('[data-pdp-chat-text]', chat).textContent = out ? 'Kabari saya lewat WhatsApp saat restock' : 'Ada pertanyaan? Chat admin lewat WhatsApp';
    } else chat.hidden = true;

    /* Tab panels */
    panel('detail').innerHTML = [
      ...[].concat(p.notice || []).map((n) => `<p class="pdp-notice">${icon('alert')}<span>${escapeHtml(n)}</span></p>`),
      p.description ? `<div class="prose">${p.description.map((t) => `<p>${escapeHtml(t)}</p>`).join('')}</div>` : '',
      // A banner whose file has not been added yet drops out instead of leaving a broken frame
      // in the middle of the stack.
      p.showcase ? `
        <div class="showcase">${p.showcase.map((s) => `
          <img src="${galleryImg(s.image)}" alt="${escapeHtml(s.alt)}" width="800" height="800" loading="lazy" decoding="async" onerror="this.remove()">`).join('')}
        </div>` : '',
      p.features ? `
        <h2 class="pdp-h">Fitur unggulan</h2>
        <ul class="features">${p.features.map((f) => `
          <li class="feature">
            <span class="feature__icon">${icon(f.icon)}</span>
            <span class="feature__title">${escapeHtml(f.title)}</span>
            <span class="feature__text">${escapeHtml(f.text)}</span>
          </li>`).join('')}
        </ul>` : '',
      ...(p.sections || []).map((sec) => `
        <h2 class="pdp-h">${escapeHtml(sec.title)}</h2>
        ${sec.text ? `<p class="prose">${escapeHtml(sec.text)}</p>` : ''}`),
      p.inBox ? `
        <h2 class="pdp-h">Isi paket</h2>
        <ul class="inbox">${p.inBox.map((t) => `<li>${icon('check')}${escapeHtml(t)}</li>`).join('')}</ul>` : '',
      p.usage ? `
        <h2 class="pdp-h">Rekomendasi penggunaan</h2>
        ${p.usage.tips ? `<ul class="inbox inbox--single">${p.usage.tips.map((t) => `<li>${icon('check')}${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
        ${p.usage.games ? `
          <p class="pdp-games">Cocok untuk game populer seperti ${p.usage.games.map((g) => `<strong>${escapeHtml(g)}</strong>`).join(', ')}, dan game kompetitif lainnya.</p>` : ''}` : '',
      p.tagline ? `<p class="pdp-tagline">${escapeHtml(p.tagline)}</p>` : '',
    ].join('') || '<p class="prose">Detail produk segera hadir.</p>';

    const specRows = [['Kategori', categories[p.category]], ...(p.specs || [])];
    if (variants.length) specRows.push([variantLabel(p), variants.map((c) => c.label).join(', ')]);
    panel('spesifikasi').innerHTML = `
      <dl class="spec-table">${specRows.map(([k, v]) => `
        <div class="spec-row"><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}
      </dl>`;

    const toko = store && store.tokopedia;
    const summary = p.rating ? `
      <div class="rating-summary">
        <p class="rating-summary__score">${p.rating}<span>/5</span></p>
        <div class="rating-summary__meta">
          <span class="stars" aria-hidden="true">${starGlyphs(starsOf(p.rating))}</span>
          <p>${[p.ratingCount && `${num(p.ratingCount)} ulasan`, p.sold && `${soldLabel(p.sold)} terjual`].filter(Boolean).join(' · ') || 'Rating pembeli'}</p>
        </div>
      </div>` : '';
    // Real reviews only, filed under the listing they were written on (see data.js). A product
    // with none here points to the store rather than padding the tab.
    panel('ulasan').innerHTML = mine.length ? `
      ${summary}
      <div class="review-list">${mine.map((r) => `
        <figure class="review review--static">
          <span class="stars" role="img" aria-label="${r.rating} dari 5 bintang">${starGlyphs(r.rating)}</span>
          <blockquote class="review__quote">“${escapeHtml(r.text)}”</blockquote>
          <figcaption class="review__by">
            <span class="review__name">${escapeHtml(r.name)}</span>
            ${r.variant ? `<span class="review__meta">${escapeHtml(variantLabel(p))}: ${escapeHtml(r.variant)}</span>` : ''}
          </figcaption>
        </figure>`).join('')}
      </div>
      ${toko ? `<p class="pdp-note">Ulasan pilihan dari pembeli di Tokopedia. <a class="link-btn" href="${toko}" target="_blank" rel="noopener">Lihat semua ulasan</a></p>` : ''}`
      : `${summary}
      <div class="catalog-empty">
        ${icon('star', 'icon catalog-empty__icon')}
        <p class="catalog-empty__title">Ulasannya belum dipajang di sini</p>
        <p class="catalog-empty__text">Baca ulasan pembeli ${escapeHtml(p.short)} langsung di toko Tokopedia kami.</p>
        ${toko ? `<a class="btn btn--secondary" href="${toko}" target="_blank" rel="noopener">Buka Tokopedia</a>` : ''}
      </div>`;
    /* Tabs — the WAI-ARIA tabs pattern with automatic activation: arrows move and select,
       Home/End jump. The bar sticks under the buy bar, so every panel is one tap away from
       anywhere on the page; switching brings the new panel's top into view. */
    const tabsBox = $('[data-tabs]', pdp);
    const tabList = $('[role="tablist"]', tabsBox);
    const tabs = $$('[role="tab"]', tabList);
    const buybar = $('[data-buybar]', pdp);

    // Only scrolls when the reader is already below the tab bar's resting place (or `force`),
    // so picking a tab near the top of the page never yanks it.
    const revealTabs = (force) => {
      const top = tabsBox.getBoundingClientRect().top + window.scrollY - header.offsetHeight - buybar.offsetHeight;
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
    const list = reviews || [];
    const stats = social || {};

    const setStat = (sel, value) => { const el = $(sel); if (el && value) el.textContent = value; };
    setStat('[data-stat-sold]', stats.sold);
    setStat('[data-stat-rating]', stats.rating);
    setStat('[data-stat-reviews]', stats.reviewCount);

    const starBox = $('[data-stat-stars]');
    if (starBox && stats.rating) {
      starBox.innerHTML = starGlyphs(5);
      starBox.setAttribute('role', 'img');
      starBox.setAttribute('aria-label', `Rata-rata ${stats.rating} dari 5 bintang`);
    }

    if (marquee && list.length) {
      // The duplicate half is what the loop scrolls into, so it is hidden from AT and from
      // the reduced-motion rail rather than read out twice.
      const card = (r, dup) => `
        <figure class="review${dup ? ' review--dup' : ''}"${dup ? ' aria-hidden="true"' : ''}>
          <span class="stars"${dup ? '' : ` role="img" aria-label="${r.rating} dari 5 bintang"`}>${starGlyphs(r.rating)}</span>
          <blockquote class="review__quote">“${escapeHtml(r.text)}”</blockquote>
          <figcaption class="review__by">
            ${r.name ? `<span class="review__name">${escapeHtml(r.name)}</span>` : ''}
            <span class="review__meta">${escapeHtml([r.product, r.variant].filter(Boolean).join(' · '))}</span>
          </figcaption>
        </figure>`;

      const half = Math.ceil(list.length / 2);
      const rows = [list.slice(0, half), list.slice(half)];
      // Seconds per card rather than a fixed duration, so adding quotes in data.js makes the
      // row longer instead of faster. The two rates differ so the rows never march in step.
      const PACE = [7.5, 9];

      $$('[data-reviews-row]', marquee).forEach((row, i) => {
        const set = rows[i] || [];
        if (!set.length) return;
        row.innerHTML = set.map((r) => card(r, false)).join('') + set.map((r) => card(r, true)).join('');
        row.style.setProperty('--mq-dur', (set.length * PACE[i]).toFixed(1) + 's');
      });
      marquee.hidden = false;

      // Stops both rows while the section is off screen. The margin starts them again just
      // before they scroll into view, so they are never caught standing still.
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(
          ([entry]) => marquee.classList.toggle('is-offscreen', !entry.isIntersecting),
          { rootMargin: '200px 0px' },
        ).observe(marquee);
      }
    }
  }

  // Close the desktop-only search panel state if the viewport grows
  desktop.addEventListener('change', () => { header.classList.remove('is-search-open'); searchToggle.setAttribute('aria-expanded', 'false'); if (openDrawer === menuDrawer && desktop.matches) hideDrawer(menuDrawer, false); });
})();
