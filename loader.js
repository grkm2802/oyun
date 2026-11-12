/* Görev Mimarı — dil ve tema yükleyici (site sürümü).
   - Dil: localStorage 'ma_lang' (yoksa <html data-default-lang>) → mission-game/ (tr) veya mission-game-en/ (en)
   - Tema: localStorage 'ma_theme' (yoksa koyu) → <html data-theme>, sayfa çizilmeden önce uygulanır
   - Çevrimdışı: https üzerinde service worker (sw.js) kaydedilir; yerel geliştirmede kaydedilmez. */
(function () {
  var root = document.documentElement;
  var DEFAULT_LANG = root.getAttribute('data-default-lang') || 'tr';
  var lang = DEFAULT_LANG, theme = 'dark';
  try { lang = localStorage.getItem('ma_lang') || DEFAULT_LANG; } catch (e) { lang = DEFAULT_LANG; }
  try { theme = localStorage.getItem('ma_theme') || 'dark'; } catch (e) { theme = 'dark'; }
  if (lang !== 'tr' && lang !== 'en') lang = DEFAULT_LANG;
  root.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
  window.MA_LOADER = true;
  window.MA_SITE = true; // çevrimiçi mod sadece gerçek sitede (claude.ai önizlemesinde değil)
  root.lang = lang;
  document.title = lang === 'tr' ? 'Görev Mimarı · Mission Architect' : 'Mission Architect · Görev Mimarı';
  var base = lang === 'tr' ? 'mission-game/' : 'mission-game-en/';
  ['firebase-config.js'].concat(['icons', 'data', 'model', 'sim', 'viz', 'ui', 'tour', 'online'].map(function (f) { return base + 'js/' + f + '.js'; })).forEach(function (src) {
    var s = document.createElement('script');
    s.src = src;
    s.async = false;
    document.body.appendChild(s);
  });
  var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !local) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* çevrimdışı destek olmadan da çalışır */ });
    });
  }
})();
