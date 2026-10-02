// From the Pit lightbox (holysmokesbbqco.com/pit). External file on purpose:
// the site's CSP script-src has no 'unsafe-inline', so an inline script never
// ran on the live site (found by the 2026-10-02 evidence pass). Native
// <dialog>: click a photo to open it full size; arrows or the buttons move;
// Escape (native) or the close button closes; focus returns to the opener.
// Without this file the grid still shows every photo.
(function () {
  var dlg = document.getElementById('lightbox');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  var btns = Array.prototype.slice.call(document.querySelectorAll('#gallery button'));
  var img = document.getElementById('lb-img'), count = document.getElementById('lb-count');
  var i = 0, opener = null;
  function show(n) {
    i = (n + btns.length) % btns.length;
    var b = btns[i];
    img.src = b.getAttribute('data-full');
    img.alt = b.querySelector('img').alt;
    count.textContent = (i + 1) + ' OF ' + btns.length;
  }
  btns.forEach(function (b, n) {
    b.addEventListener('click', function () { opener = b; show(n); dlg.showModal(); document.getElementById('lb-close').focus(); });
  });
  document.getElementById('lb-prev').addEventListener('click', function () { show(i - 1); });
  document.getElementById('lb-next').addEventListener('click', function () { show(i + 1); });
  document.getElementById('lb-close').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { show(i - 1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { show(i + 1); e.preventDefault(); }
  });
  dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.classList.contains('frame')) dlg.close(); });
  dlg.addEventListener('close', function () { img.removeAttribute('src'); if (opener) opener.focus(); });
})();
