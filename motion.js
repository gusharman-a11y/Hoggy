/* Hoggy motion (docs/design/redesign.md): route transitions, scroll reveals, number roll-ups, the hero's pointer parallax,
   a lightly magnetic primary button and drag-to-dismiss sheets. Hand-written, no library. Everything here is decoration:
   the DOM already holds the final text and layout, transforms only (no layout shift, no fading text), and
   prefers-reduced-motion turns all of it off. */
(function () {
  'use strict';
  const mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const still = () => mq.matches, fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  const fmt = (v, dp) => v.toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp });

  /* numbers roll up once, the first time they are seen */
  function roll(el) {
    const end = Number(el.dataset.count), dp = (String(el.dataset.count).split('.')[1] || '').length, final = el.textContent;
    if (!isFinite(end) || end <= 0 || el.dataset.rolled) return; el.dataset.rolled = '1';
    const t0 = performance.now(), ms = 700 + Math.min(500, end / 4);
    const step = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 4); if (k < 1 && el.isConnected) { el.textContent = fmt(end * e, dp); requestAnimationFrame(step); } else el.textContent = final; };
    requestAnimationFrame(step);
  }
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); if (e.target.dataset.count != null) roll(e.target); else e.target.classList.add('in'); } }, { rootMargin: '0px 0px -6% 0px', threshold: .05 }) : null;

  /* after each render: blocks below the fold rise into place when scrolled to; what is already on screen never moves */
  const RISE = '.card, .step, .benefit, .wrow, .ticket, .panel, .live-grid > div, .dash > *, .shelf-sec > .section, .section';
  function scan(root) {
    if (!root || !io || still()) return;
    root.querySelectorAll('[data-count]').forEach(el => io.observe(el));
    const h = innerHeight;
    root.querySelectorAll(RISE).forEach((el, i) => { if (el.classList.contains('rv') || el.closest('.overlay, .shelf')) return; const r = el.getBoundingClientRect(); if (r.top > h * .92 && r.width) { el.classList.add('rv'); el.style.setProperty('--d', (i % 4) * 50 + 'ms'); io.observe(el); } });
  }

  /* route changes: a short cross-fade where the browser supports view transitions */
  function swap(fn) {
    if (still() || !document.startViewTransition) return fn();
    try { document.startViewTransition(fn); } catch (e) { fn(); }
  }

  /* hero plates lean a few degrees towards the pointer; the primary button drifts towards it */
  if (fine) {
    let raf = 0, last = null;
    document.addEventListener('pointermove', e => {
      last = e; if (raf || still()) return;
      raf = requestAnimationFrame(() => {
        raf = 0; const ev = last, hero = ev.target.closest && ev.target.closest('.hero-intro');
        if (hero) { const r = hero.getBoundingClientRect(), fan = hero.querySelector('.hero-fan'); if (fan) { fan.style.setProperty('--mx', ((ev.clientX - r.left) / r.width - .5).toFixed(3)); fan.style.setProperty('--my', ((ev.clientY - r.top) / r.height - .5).toFixed(3)); } }
        const b = ev.target.closest && ev.target.closest('.btn.primary.lg');
        document.querySelectorAll('.btn.mag').forEach(x => { if (x !== b) { x.classList.remove('mag'); x.style.translate = ''; } });
        if (b && !b.disabled) { const r = b.getBoundingClientRect(); b.classList.add('mag'); b.style.translate = `${((ev.clientX - r.left - r.width / 2) * .12).toFixed(1)}px ${((ev.clientY - r.top - r.height / 2) * .2).toFixed(1)}px`; }
      });
    }, { passive: true });
  }

  /* sheets follow a downward drag on their handle and close past a threshold (touch and pen) */
  let drag = null;
  document.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || still()) return;
    const grip = e.target.closest && e.target.closest('.sheet-wrap, .fsheet-head'); if (!grip || e.target.closest('button, a')) return;
    const sheet = grip.closest('.sheet, .fsheet'); if (!sheet || sheet.scrollTop > 4) return;
    drag = { sheet, y: e.clientY, dy: 0 };
  }, { passive: true });
  document.addEventListener('pointermove', e => { if (!drag) return; drag.dy = Math.max(0, e.clientY - drag.y); drag.sheet.style.transition = 'none'; drag.sheet.style.transform = `translateY(${drag.dy}px)`; }, { passive: true });
  const drop = () => {
    if (!drag) return; const { sheet, dy } = drag; drag = null; sheet.style.transition = ''; sheet.style.transform = '';
    if (dy > 110) { const c = sheet.querySelector('[data-act=close], [data-act=filtersclose]'); if (c) c.click(); }
  };
  document.addEventListener('pointerup', drop, { passive: true }); document.addEventListener('pointercancel', drop, { passive: true });

  window.HoggyMotion = { scan, swap, still };
})();
