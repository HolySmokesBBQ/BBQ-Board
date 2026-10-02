/* Holy Smokes website: the two authored motions (DESIGN.md, MOTION 2).

   1. Smoke drift behind the hero. A few soft puffs rise and fade across the
      hero photo, the way smoke leaves a pit. Canvas, pointer-events none,
      clipped to the hero, paused when the tab is hidden, and never created
      when the visitor prefers reduced motion. Purpose: the site is named
      after smoke; the hero should have some.
   2. Photos ease up into place as they scroll in (opacity 0.35 -> 1, 12px
      rise). Text never animates. IntersectionObserver, with a timeout so a
      photo can never stay dim, and no-op under reduced motion (CSS handles
      the static state).

   Loaded with defer; the CSP forbids inline scripts. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');

  function initSmoke() {
    var host = document.querySelector('[data-smoke]');
    if (!host || reduce) return;
    var canvas = document.createElement('canvas');
    canvas.className = 'smoke-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var w = 0, h = 0, puffs = [], animId = null;

    function resize() {
      w = canvas.width = host.clientWidth;
      h = canvas.height = host.clientHeight;
    }
    function spawn(initial) {
      return {
        x: w * (0.1 + Math.random() * 0.8),
        y: initial ? Math.random() * h : h + 40,
        r: 110 + Math.random() * 160, // Joel, 2026-10-02: bigger smoke
        vy: 0.18 + Math.random() * 0.22,
        vx: (Math.random() - 0.5) * 0.15,
        life: initial ? Math.random() : 0,
        wobble: Math.random() * Math.PI * 2,
      };
    }
    function reset() { puffs = []; for (var i = 0; i < 12; i++) puffs.push(spawn(true)); }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < puffs.length; i++) {
        var p = puffs[i];
        p.life += 0.0018;
        p.y -= p.vy;
        p.wobble += 0.004;
        p.x += p.vx + Math.sin(p.wobble) * 0.25;
        p.r += 0.12;
        var a = Math.sin(Math.min(p.life, 1) * Math.PI) * 0.13; // fade in, then out
        if (a > 0) {
          var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          g.addColorStop(0, 'rgba(230, 216, 184, ' + a + ')');
          g.addColorStop(1, 'rgba(230, 216, 184, 0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }
        if (p.life >= 1 || p.y < -p.r) puffs[i] = spawn(false);
      }
      animId = requestAnimationFrame(draw);
    }
    resize(); reset(); draw();
    window.addEventListener('resize', function () { resize(); reset(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { cancelAnimationFrame(animId); animId = null; }
      else if (animId === null) draw();
    });
  }

  function initReveal() {
    var els = document.querySelectorAll('.rise');
    if (!els.length) return;
    if (reduce || !('IntersectionObserver' in window)) {
      for (var i = 0; i < els.length; i++) els[i].classList.add('is-in');
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { entries[i].target.classList.add('is-in'); io.unobserve(entries[i].target); }
      }
    }, { threshold: 0.05, rootMargin: '0px 0px 60px 0px' });
    for (var j = 0; j < els.length; j++) io.observe(els[j]);
    setTimeout(function () { for (var k = 0; k < els.length; k++) els[k].classList.add('is-in'); }, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initSmoke(); initReveal(); });
  } else { initSmoke(); initReveal(); }
})();
