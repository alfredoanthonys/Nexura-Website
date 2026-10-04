(() => {
  'use strict';

  const { products, categories, video } = window.NEXURA;
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Must track the CSS breakpoint where the nav goes horizontal, or the menu drawer stays
  // open behind a nav bar that has already replaced it.
  const desktop = window.matchMedia('(min-width: 768px)');
  const rupiah = (n) => 'Rp' + new Intl.NumberFormat('id-ID').format(n);
  const img = (name, size = 800) => `assets/img/${name}-${size}.webp`;
  const imgFallback = (name) => `assets/img/${name}.jpg`;
  const colorOf = (p, colorId) => (p.colors || []).find((c) => c.id === colorId) || (p.colors || [])[0] || null;
  const priceOf = (p, colorId) => (colorOf(p, colorId) && colorOf(p, colorId).price) || p.price;
  const imageOf = (p, colorId) => (colorOf(p, colorId) ? colorOf(p, colorId).image : p.image);
  const icon = (id, cls = 'icon') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
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

  function showDrawer(drawer, trigger) {
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
    setTimeout(() => (first || drawer).focus({ preventScroll: true }), 30);
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
  $$('[data-accordion]', menuDrawer).forEach((btn) => {
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      $('#' + btn.getAttribute('aria-controls')).hidden = !open;
    });
  });
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
        <li class="search__option" id="search-opt-${i}" role="option" aria-selected="${i === activeIndex}" data-index="${i}">
          <img src="${img(imageOf(p), 160)}" alt="" width="44" height="44">
          <span><span class="search__option-name">${escapeHtml(p.short)}</span><br><span class="search__option-cat">${categories[p.category]}${p.stock === 'out' ? ' · Restock segera' : ''}</span></span>
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

  function chooseResult(i) {
    const p = results[i];
    if (!p) return;
    closeSearch();
    searchInput.value = '';
    searchInput.blur();
    header.classList.remove('is-search-open');
    searchToggle.setAttribute('aria-expanded', 'false');
    revealProduct(p.id);
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
     Products
     ------------------------------------------------------------------ */
  const grid = $('[data-product-grid]');
  const moreBtn = $('[data-more]');
  const filterStatus = $('[data-filter-status]');
  const filterLabel = $('[data-filter-label]');
  const selectedColor = {}; // productId -> colorId
  let expanded = false;
  let activeFilter = null;

  function cardHTML(p) {
    const color = colorOf(p);
    if (color) selectedColor[p.id] = color.id;
    const image = imageOf(p, color && color.id);
    const out = p.stock === 'out';
    const badge = out ? '<span class="badge badge--out">Restock segera</span>' : '';
    const swatches = p.colors
      ? `<div class="swatches" role="group" aria-label="Pilih warna ${escapeHtml(p.short)}">
          ${p.colors.map((c) => `<button class="swatch" type="button" style="--swatch:${c.swatch}" aria-label="${c.label}" aria-pressed="${c.id === color.id}" data-color="${c.id}"></button>`).join('')}
          <span class="swatches__label" data-color-label>${color.label}</span>
        </div>`
      : `<p class="product-card__note">${p.note || ''}</p>`;
    return `
      <article class="product-card${out ? ' is-out' : ''}" id="produk-${p.id}" data-id="${p.id}" data-category="${p.category}">
        <div class="product-card__media">
          <picture>
            <source type="image/webp" srcset="${img(image)}">
            <img src="${imgFallback(image)}" width="800" height="800" loading="lazy" decoding="async" alt="${escapeHtml(p.alt)}${color ? ' warna ' + color.label.toLowerCase() : ''}">
          </picture>
        </div>
        <div class="product-card__body">
          <h3 class="product-card__name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</h3>
          <p class="product-card__price">
            <span class="price" data-price>${rupiah(priceOf(p, color && color.id))}</span>
            ${p.compareAt ? `<s class="price-was"><span class="sr-only">Harga normal </span>${rupiah(p.compareAt)}</s>` : ''}
            ${badge}
          </p>
          ${swatches}
          ${out
            ? '<button class="btn btn--add btn--block" type="button" disabled>Stok habis</button>'
            : `<button class="btn btn--add btn--block" type="button" data-add>${icon('cart', 'icon icon--sm icon--long')}${icon('plus', 'icon icon--sm icon--short')}<span class="label-long">Masukkan Keranjang</span><span class="label-short">Keranjang</span></button>`}
        </div>
      </article>`;
  }

  grid.innerHTML = products.map(cardHTML).join('');
  const cards = $$('.product-card', grid);

  function applyVisibility({ animate = false } = {}) {
    cards.forEach((card) => {
      const p = byId[card.dataset.id];
      const show = activeFilter ? (activeFilter === 'all' || p.category === activeFilter) : (expanded || p.featured);
      const wasHidden = card.hidden;
      card.hidden = !show;
      if (animate && show && wasHidden && !reducedMotion.matches) {
        card.classList.remove('is-entering'); void card.offsetWidth; card.classList.add('is-entering');
      }
    });
    const filtered = activeFilter && activeFilter !== 'all';
    filterStatus.hidden = !filtered;
    if (filtered) filterLabel.textContent = categories[activeFilter];
    moreBtn.parentElement.hidden = Boolean(activeFilter);
  }
  applyVisibility();

  // Placeholder for the future "Produk" page: it is deliberately inert until that page
  // exists, rather than expanding the grid in place. The non-featured products stay
  // reachable through the category filters and "Lihat Semua".

  function setFilter(cat) {
    activeFilter = cat === 'all' ? 'all' : cat;
    if (cat === 'all') expanded = true;
    applyVisibility({ animate: true });
    $('#produk').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
    announce(cat === 'all' ? 'Menampilkan semua produk.' : `Menampilkan produk ${categories[cat]}.`);
  }
  $$('[data-filter]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); setFilter(a.dataset.filter); }));
  $('[data-filter-reset]').addEventListener('click', () => { activeFilter = null; expanded = true; applyVisibility({ animate: true }); announce('Menampilkan semua produk.'); });

  function revealProduct(id) {
    const card = $(`#produk-${id}`);
    if (!card) return;
    if (card.hidden) { activeFilter = null; expanded = true; applyVisibility(); }
    card.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
    card.classList.add('is-highlight');
    setTimeout(() => card.classList.remove('is-highlight'), 1800);
    setTimeout(() => $('[data-add], .swatch', card)?.focus({ preventScroll: true }), reducedMotion.matches ? 0 : 450);
  }

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.product-card');
    if (!card) return;
    const p = byId[card.dataset.id];

    const swatch = e.target.closest('.swatch');
    if (swatch) {
      const c = colorOf(p, swatch.dataset.color);
      selectedColor[p.id] = c.id;
      $$('.swatch', card).forEach((s) => s.setAttribute('aria-pressed', String(s === swatch)));
      $('[data-color-label]', card).textContent = c.label;
      const priceEl = $('[data-price]', card);
      const newPrice = rupiah(priceOf(p, c.id));
      if (priceEl.textContent !== newPrice) { priceEl.textContent = newPrice; announce(`${p.short} ${c.label}: ${newPrice}`); }
      const picture = $('picture', card);
      const imgEl = $('img', picture);
      const next = c.image;
      if (!imgEl.src.endsWith(imgFallback(next)) || !$('source', picture).srcset.endsWith(img(next))) {
        imgEl.classList.add('is-swapping');
        const pre = new Image();
        pre.onload = pre.onerror = () => {
          $('source', picture).srcset = img(next);
          imgEl.src = imgFallback(next);
          imgEl.alt = `${p.alt} warna ${c.label.toLowerCase()}`;
          imgEl.classList.remove('is-swapping');
        };
        pre.src = img(next);
      }
      return;
    }

    const addBtn = e.target.closest('[data-add]');
    if (addBtn) {
      cart.add(p.id, selectedColor[p.id] || null);
      addBtn.classList.add('is-added');
      $('.label-long', addBtn).textContent = 'Ditambahkan';
      $('.label-short', addBtn).textContent = 'Ditambahkan';
      $$('use', addBtn).forEach((u) => u.setAttribute('href', '#i-check'));
      clearTimeout(addBtn._t);
      addBtn._t = setTimeout(() => {
        addBtn.classList.remove('is-added');
        $('.label-long', addBtn).textContent = 'Masukkan Keranjang';
        $('.label-short', addBtn).textContent = 'Keranjang';
        $('.icon--long use', addBtn).setAttribute('href', '#i-cart');
        $('.icon--short use', addBtn).setAttribute('href', '#i-plus');
      }, 1600);
      cart.open(addBtn);
    }
  });

  // Hero "Beli Sekarang": straight into the cart with the colour shown on the slide
  $$('[data-buy]').forEach((btn) => btn.addEventListener('click', () => {
    cart.add(btn.dataset.buy, btn.dataset.color || null);
    cart.open(btn);
  }));

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

    let items = (storage.get(KEY) || []).filter((it) => byId[it.id] && byId[it.id].stock !== 'out' && it.qty > 0)
      .map((it) => ({ id: it.id, color: colorOf(byId[it.id], it.color)?.id || null, qty: Math.min(99, it.qty | 0), checked: it.checked !== false }));

    const keyOf = (it) => `${it.id}:${it.color || ''}`;
    const count = () => items.reduce((n, it) => n + it.qty, 0);
    const total = () => items.reduce((sum, it) => sum + (it.checked ? priceOf(byId[it.id], it.color) * it.qty : 0), 0);
    const label = (it) => { const p = byId[it.id]; const c = colorOf(p, it.color); return c ? `${p.short} ${c.label}` : p.short; };
    const save = () => storage.set(KEY, items);

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
              <p class="cart-item__variant">${c ? 'Warna: ' + c.label : escapeHtml(categories[p.category])}</p>
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

    trigger.addEventListener('click', () => showDrawer(drawer, trigger));

    // Phase 1: both buttons are visible and active but do nothing (PRD 8.3).
    // TODO: connect when the checkout / cart page exists.
    $('[data-checkout]').addEventListener('click', () => {});
    $('[data-view-cart]').addEventListener('click', () => {});

    render();

    return {
      add(id, colorId) {
        const p = byId[id];
        if (!p || p.stock === 'out') return;
        const color = colorOf(p, colorId);
        const it = { id, color: color ? color.id : null, qty: 1, checked: true };
        const existing = items.find((x) => keyOf(x) === keyOf(it));
        if (existing) { existing.qty = Math.min(99, existing.qty + 1); existing.checked = true; }
        else items.push(it);
        save(); render(); bump();
        announce(`${label(it)} masuk keranjang. Total ${count()} item.`);
      },
      open(from) { showDrawer(drawer, from || trigger); },
    };
  })();

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

  // Close the desktop-only search panel state if the viewport grows
  desktop.addEventListener('change', () => { header.classList.remove('is-search-open'); searchToggle.setAttribute('aria-expanded', 'false'); if (openDrawer === menuDrawer && desktop.matches) hideDrawer(menuDrawer, false); });
})();
