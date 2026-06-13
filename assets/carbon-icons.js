/* Carbon icon loader — injects authentic @carbon/icons SVGs INLINE.
   Icons are vendored into assets/icons/ (same-origin) so they can be
   fetched and recolored with `fill: currentColor`. Base path resolves
   relative to THIS script, so it works at any folder depth. */
(function () {
  var here = (document.currentScript && document.currentScript.src) || '';
  var BASE = here.replace(/[^/]*$/, '') + 'icons/';   // .../assets/icons/
  var cache = {};

  function load(name) {
    if (!cache[name]) {
      cache[name] = fetch(BASE + name + '.svg')
        .then(function (r) { return r.ok ? r.text() : ''; })
        .catch(function () { return ''; });
    }
    return cache[name];
  }

  function stamp(el) {
    if (el.__cdsDone) return;
    var name = el.getAttribute('data-icon');
    if (!name) return;
    el.__cdsDone = true;
    load(name).then(function (svg) {
      if (!svg) { el.__cdsDone = false; return; }
      el.innerHTML = svg;
      var s = el.firstElementChild;
      if (s && s.tagName.toLowerCase() === 'svg') {
        s.setAttribute('fill', 'currentColor');
        s.removeAttribute('width');
        s.removeAttribute('height');
      }
    });
  }

  function run(root) {
    (root || document).querySelectorAll('.cds-icon[data-icon]').forEach(stamp);
  }

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', function () { run(); });
  window.CarbonIcons = { run: run, stamp: stamp, load: load, BASE: BASE };
})();
