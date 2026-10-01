/* Brand font loader (Adobe Fonts / Typekit, Thornwood VF).
   Loaded synchronously in <head> on every website page so the kit is
   requested as early as a static <link> would have been.

   The kit is a third-party request: Adobe receives the visitor's IP and
   user agent for licence counting. For EEA/UK/CH visitors that is a
   personal-data transfer that needs consent (LG München 2022, Google
   Fonts; Overseer ruling L-8, 2026-10-01), so:
     hs_geo=eu  and no stored choice   -> do not load; fallback faces
     hs_geo=eu  and stored "granted"   -> load
     hs_geo=eu  and stored "denied"    -> do not load
     anything else (other/unknown/no cookie) -> load (US behaviour)
   When the consent banner (gtm-init.js) records a grant on this page it
   dispatches 'hs-consent'; the kit loads then without a reload.
   Oswald and Inter are in every font stack as self-hosted fallbacks, so a
   page without the kit still renders the previous design. */
(function () {
  var KIT = 'https://use.typekit.net/rrv8ywt.css';
  var ORIGIN = 'https://use.typekit.net';
  var CONSENT_KEY = 'hs-consent-v1';
  var loaded = false;

  function region() {
    var m = /(?:^|;\s*)hs_geo=([a-z]+)/.exec(document.cookie || '');
    return m ? m[1] : null;
  }
  function storedChoice() {
    try {
      var raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      return v && (v.choice === 'granted' || v.choice === 'denied') ? v.choice : null;
    } catch (e) { return null; }
  }
  function load() {
    if (loaded) return;
    loaded = true;
    var pre = document.createElement('link');
    pre.rel = 'preconnect';
    pre.href = ORIGIN;
    pre.crossOrigin = 'anonymous';
    document.head.appendChild(pre);
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = KIT;
    document.head.appendChild(css);
  }

  if (region() !== 'eu') {
    load();
  } else {
    var choice = storedChoice();
    if (choice === 'granted') load();
    else if (choice === null) {
      // Banner is up (or absent on this page). Load the moment it's accepted.
      addEventListener('hs-consent', function (e) {
        if (e && e.detail && e.detail.choice === 'granted') load();
      });
    }
  }
})();
