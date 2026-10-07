/* Portfolio: category filter (home) + lightbox (all pages). No dependencies. */
(function () {
  var d = document, $$ = function (s, r) { return [].slice.call((r || d).querySelectorAll(s)); };

  /* ---- filter chips: progressive enhancement, all cards visible without JS ---- */
  var chips = d.querySelector('.chips');
  if (chips) {
    var btns = $$('button', chips), cards = $$('.card'), status = d.querySelector('.filter-status');
    var apply = function (c, save) {
      if (!btns.some(function (b) { return b.dataset.cat === c; })) c = 'all';
      btns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.cat === c); });
      cards[0].parentNode.classList.toggle('filtered', c !== 'all');
      var n = 0;
      cards.forEach(function (el) { var on = c === 'all' || el.dataset.cat === c; el.hidden = !on; if (on) n++; });
      if (status) status.textContent = n + (n === 1 ? ' project' : ' projects') + ' shown';
      if (save) history.replaceState(null, '', c === 'all' ? location.pathname : '#work=' + c);
    };
    chips.hidden = false;
    chips.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) apply(b.dataset.cat, true);
    });
    var m = location.hash.match(/^#work=([\w-]+)/);
    if (m) {
      apply(m[1]);
      var w = d.getElementById('work');
      if (w) w.scrollIntoView();
    }
  }

  /* ---- home: top bar is clear while it sits over the hero image ---- */
  var bar = d.querySelector('.bar'), hm = d.querySelector('.has-img .hero-media');
  if (bar && hm) {
    var tick = function () { bar.classList.toggle('clear', scrollY < hm.offsetHeight - bar.offsetHeight - 40); };
    addEventListener('scroll', tick, { passive: true });
    tick();
  }

  /* ---- scroll reveal (only for elements still below the fold) ---- */
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.groups .fig, .card, .pn, .portrait, .contained .frame').forEach(function (el) {
      if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('pre'); io.observe(el); }
    });
  }

  /* ---- lightbox ---- */
  var zooms = $$('.fig .zoom');
  if (!zooms.length) return;
  var lb = d.createElement('div');
  lb.id = 'lb';
  lb.hidden = true;
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Image viewer');
  lb.innerHTML = '<div class="lb-top"><span class="lb-n" aria-live="polite"></span><button type="button" class="lb-btn lb-x">Close</button></div>' +
    '<div class="lb-stage"><img alt=""><button type="button" class="lb-btn lb-prev" aria-label="Previous image">←</button>' +
    '<button type="button" class="lb-btn lb-next" aria-label="Next image">→</button></div><p class="lb-cap"></p>';
  d.body.appendChild(lb);
  var im = lb.querySelector('img'), cap = lb.querySelector('.lb-cap'), num = lb.querySelector('.lb-n'),
    bx = lb.querySelector('.lb-x'), bp = lb.querySelector('.lb-prev'), bn = lb.querySelector('.lb-next'),
    stage = lb.querySelector('.lb-stage'), idx = 0, last = null, multi = zooms.length > 1;
  if (!multi) { bp.hidden = bn.hidden = true; }

  function preload(i) { var z = zooms[(i + zooms.length) % zooms.length]; if (z) new Image().src = z.dataset.full; }
  function show(i) {
    idx = (i + zooms.length) % zooms.length;
    var z = zooms[idx], th = z.querySelector('img'), f = z.closest('figure'), c = f && f.querySelector('figcaption');
    var full = z.dataset.full || th.currentSrc || th.src;
    im.alt = th.alt || '';
    im.onload = null;
    if (im.getAttribute('src') !== full) {
      im.src = th.currentSrc || th.src;      /* show what is already loaded, swap to the large file */
      im.classList.add('ld');
      var big = new Image();
      big.onload = function () { if (zooms[idx] === z) { im.src = full; im.classList.remove('ld'); } };
      big.src = full;
    }
    cap.textContent = c ? c.textContent : '';
    num.textContent = multi ? (idx + 1) + ' / ' + zooms.length : '';
    if (multi) { preload(idx + 1); preload(idx - 1); }
  }
  function open(i) {
    last = d.activeElement;
    lb.hidden = false;
    d.body.classList.add('lb-on');
    show(i);
    bx.focus();
  }
  function close() {
    lb.hidden = true;
    d.body.classList.remove('lb-on');
    im.removeAttribute('src');
    if (last && last.focus) last.focus();
  }
  zooms.forEach(function (z, i) { z.addEventListener('click', function () { open(i); }); });
  bx.addEventListener('click', close);
  bp.addEventListener('click', function () { show(idx - 1); });
  bn.addEventListener('click', function () { show(idx + 1); });
  stage.addEventListener('click', function (e) { if (e.target === stage) close(); });
  d.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight' && multi) { e.preventDefault(); show(idx + 1); }
    else if (e.key === 'ArrowLeft' && multi) { e.preventDefault(); show(idx - 1); }
    else if (e.key === 'Tab') {               /* focus trap */
      var f = [bx, bp, bn].filter(function (b) { return !b.hidden; }), k = f.indexOf(d.activeElement);
      e.preventDefault();
      f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });
  var x0 = null;
  stage.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', function (e) {
    if (x0 === null || !multi) return;
    var dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
  });
})();
