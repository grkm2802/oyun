/* Görev Mimarı — açılış ekranı.
   1) Açılış videosu (mission-game/media/acilis-ekrani.mp4) tam ekran oynar (sessiz başlar; "Sesi aç" ve "Geç" düğmeleri).
   2) Video siyah ekranla biter → siyah ekranın ortasında "Başla" düğmesi.
   3) Başla'ya basınca bir roket ateş ve duman püskürterek yukarı uzaklaşır, ekran kararıp açılır ve site görünür.
   - Site her açıldığında oynar. Sadece dil değişimi yenilemesinde atlanır (ui.js switchLang sessionStorage 'ma_intro_skip' koyar, burada silinir).
   - Hareketleri azalt (prefers-reduced-motion) açıksa video kendiliğinden oynamaz; doğrudan Başla gösterilir, roket uçuşu yerine kısa geçiş.
   - Video yüklenemezse (dosya yok, eski tarayıcı) doğrudan Başla gösterilir.
   - Rehberli tur (tour.js) açılış bitene kadar bekler: window.MA_INTRO_ACTIVE ve 'ma:intro-done' olayı. */
(function () {
  'use strict';
  var root = document.documentElement;
  var seen = false;
  try { seen = sessionStorage.getItem('ma_intro_skip') === '1'; sessionStorage.removeItem('ma_intro_skip'); } catch (e) { /* depolama yok */ }
  if (seen) { root.classList.remove('intro-pending'); return; }
  var lang = 'tr';
  try { lang = localStorage.getItem('ma_lang') || root.getAttribute('data-default-lang') || 'tr'; } catch (e) { /* */ }
  var T = lang === 'en'
    ? { start: 'Start', skip: 'Skip', sound: 'Sound on', mute: 'Sound off', label: 'Intro' }
    : { start: 'Başla', skip: 'Geç', sound: 'Sesi aç', mute: 'Sesi kapat', label: 'Açılış' };
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  window.MA_INTRO_ACTIVE = true;

  var box = document.createElement('div');
  box.id = 'intro'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', T.label);
  box.innerHTML =
    '<video class="intro-video" playsinline muted preload="auto" src="mission-game/media/acilis-ekrani.mp4"></video>' +
    '<canvas class="intro-fx" aria-hidden="true"></canvas>' +
    '<div class="intro-top"><button type="button" class="intro-btn" data-i="sound">' + T.sound + '</button>' +
    '<button type="button" class="intro-btn" data-i="skip">' + T.skip + '</button></div>' +
    '<button type="button" class="intro-start" data-i="start" hidden>' + T.start + '</button>';
  (document.body || root).appendChild(box);
  root.classList.remove('intro-pending');
  var video = box.querySelector('video'), startBtn = box.querySelector('.intro-start'), top = box.querySelector('.intro-top');
  var fx = box.querySelector('canvas'), g = fx.getContext('2d');
  var stage = 'video';

  function showStart() {
    if (stage !== 'video') return;
    stage = 'start';
    try { video.pause(); } catch (e) { /* */ }
    box.classList.add('ended');
    top.hidden = true;
    startBtn.hidden = false;
    startBtn.focus({ preventScroll: true });
  }
  video.addEventListener('ended', showStart);
  video.addEventListener('error', showStart);
  if (reduced) showStart();
  else {
    var p = video.play();
    if (p && p.catch) p.catch(showStart); // otomatik oynatma engellendiyse doğrudan Başla
    // video hiç başlamazsa (ağ) bir süre sonra Başla
    setTimeout(function () { if (stage === 'video' && video.currentTime === 0) showStart(); }, 6000);
  }

  box.addEventListener('click', function (e) {
    var b = e.target.closest('[data-i]'); if (!b) return;
    var k = b.getAttribute('data-i');
    if (k === 'sound') { video.muted = !video.muted; b.textContent = video.muted ? T.sound : T.mute; if (!video.muted && video.paused) video.play().catch(function () {}); }
    else if (k === 'skip') showStart();
    else if (k === 'start') launch();
  });
  box.addEventListener('keydown', function (e) { if (e.key === 'Escape' && stage === 'video') showStart(); });

  function finish() {
    if (stage === 'done') return;
    stage = 'done';
    box.classList.add('out');
    window.MA_INTRO_ACTIVE = false;
    setTimeout(function () {
      box.remove();
      document.dispatchEvent(new CustomEvent('ma:intro-done'));
      var app = document.getElementById('app'); if (app) { var f = app.querySelector('button, [href], [tabindex]'); if (f) f.focus({ preventScroll: true }); }
    }, 650);
  }

  /* ---------- roket: ateş ve duman püskürterek yukarı uzaklaşır ---------- */
  function launch() {
    if (stage !== 'start') return;
    stage = 'launch';
    startBtn.hidden = true;
    if (reduced) return finish();
    var dpr = Math.min(window.devicePixelRatio || 1, 2), W = 0, H = 0;
    function size() { W = fx.clientWidth; H = fx.clientHeight; fx.width = Math.round(W * dpr); fx.height = Math.round(H * dpr); }
    size(); window.addEventListener('resize', size);
    var parts = [], smoke = [], stars = [];
    for (var i = 0; i < 140; i++) stars.push([Math.random(), Math.random(), Math.random()]);
    var t0 = performance.now(), last = t0, DUR = 2600;
    var S = Math.min(W, H) / 900; // ölçek
    function rocket(x, y, s, shake) {
      g.save(); g.translate(x + shake, y); g.scale(s, s);
      // gövde (yükseklik ~240, genişlik ~36) — burun yukarıda, motor y=0'da
      var body = g.createLinearGradient(-18, 0, 18, 0);
      body.addColorStop(0, '#b9bec6'); body.addColorStop(0.35, '#ffffff'); body.addColorStop(0.7, '#e9ebef'); body.addColorStop(1, '#9aa1ab');
      g.fillStyle = body;
      g.beginPath(); g.moveTo(-18, -12); g.lineTo(-18, -190); g.quadraticCurveTo(-18, -238, 0, -262); g.quadraticCurveTo(18, -238, 18, -190); g.lineTo(18, -12); g.closePath(); g.fill();
      g.fillStyle = '#1d2228'; g.fillRect(-18, -150, 36, 7); g.fillRect(-18, -70, 36, 5);
      g.fillStyle = '#2b3a8f'; g.fillRect(-18, -120, 36, 14);
      // kanatçıklar
      g.fillStyle = '#c4c8ce';
      g.beginPath(); g.moveTo(-18, -55); g.lineTo(-38, -8); g.lineTo(-18, -12); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(18, -55); g.lineTo(38, -8); g.lineTo(18, -12); g.closePath(); g.fill();
      // motor ağzı
      g.fillStyle = '#4a4f57'; g.beginPath(); g.moveTo(-10, -12); g.lineTo(-15, 4); g.lineTo(15, 4); g.lineTo(10, -12); g.closePath(); g.fill();
      g.restore();
    }
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      var t = (now - t0) / DUR; // 0→1
      var ign = Math.min(1, t / 0.12);
      var lift = Math.max(0, t - 0.12) / 0.88;
      var s = S * (1 - lift * 0.55); // uzaklaştıkça küçülür
      var rx = W / 2, ry = H * 0.92 - lift * lift * (H * 1.25);
      var shake = t < 0.3 ? (Math.random() - 0.5) * 3 * ign : 0;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      // yıldızlar yavaşça belirir
      for (var k = 0; k < stars.length; k++) { var st = stars[k]; g.globalAlpha = Math.min(1, t * 2) * (0.25 + st[2] * 0.55); g.fillStyle = '#fff'; g.fillRect(st[0] * W, st[1] * H, st[2] > 0.85 ? 2 : 1, st[2] > 0.85 ? 2 : 1); }
      g.globalAlpha = 1;
      var nx = rx, ny = ry + 4 * s; // motor ağzı
      // yeni parçacıklar
      var n = Math.round(14 * ign);
      for (var j = 0; j < n; j++) {
        parts.push({ x: nx + (Math.random() - 0.5) * 10 * s, y: ny, vx: (Math.random() - 0.5) * 60 * s, vy: (420 + Math.random() * 260) * s * (0.6 + ign * 0.4), life: 0.25 + Math.random() * 0.25, age: 0, r: (10 + Math.random() * 8) * s });
      }
      var m = lift < 0.25 ? 6 : 2;
      for (var q = 0; q < m * ign; q++) {
        var ground = lift < 0.2, side = Math.random() < 0.5 ? -1 : 1;
        smoke.push({ x: nx + (Math.random() - 0.5) * 20 * s, y: ground ? H * 0.95 : ny + 30 * s, vx: ground ? side * (80 + Math.random() * 160) : (Math.random() - 0.5) * 30, vy: ground ? -Math.random() * 30 : 40 + Math.random() * 40, life: 1.6 + Math.random() * 1.2, age: 0, r: (24 + Math.random() * 20) * S });
      }
      // duman (alevin arkasında)
      for (var a = smoke.length - 1; a >= 0; a--) {
        var p = smoke[a]; p.age += dt; var u = p.age / p.life; if (u >= 1) { smoke.splice(a, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 0.8; p.vy *= 1 - dt * 0.6;
        var rr = p.r * (1 + u * 2.6);
        var gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
        var al = 0.32 * (1 - u) * Math.min(1, u * 6), warm = Math.max(0, 1 - u * 4);
        gr.addColorStop(0, 'rgba(' + Math.round(170 + 60 * warm) + ',' + Math.round(165 + 20 * warm) + ',' + Math.round(160 - 40 * warm) + ',' + al + ')');
        gr.addColorStop(1, 'rgba(120,120,120,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, rr, 0, 6.283); g.fill();
      }
      // alev parçacıkları (toplamalı ışık)
      g.globalCompositeOperation = 'lighter';
      for (var b = parts.length - 1; b >= 0; b--) {
        var f = parts[b]; f.age += dt; var v = f.age / f.life; if (v >= 1) { parts.splice(b, 1); continue; }
        f.x += f.vx * dt; f.y += f.vy * dt;
        var fr = f.r * (1 + v * 1.8);
        var fg = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, fr);
        fg.addColorStop(0, 'rgba(255,248,225,' + (0.55 * (1 - v)) + ')');
        fg.addColorStop(0.35, 'rgba(255,190,90,' + (0.4 * (1 - v)) + ')');
        fg.addColorStop(1, 'rgba(255,90,20,0)');
        g.fillStyle = fg; g.beginPath(); g.arc(f.x, f.y, fr, 0, 6.283); g.fill();
      }
      // motor ağzındaki parlak çekirdek
      var cg = g.createRadialGradient(nx, ny + 8 * s, 0, nx, ny + 8 * s, 60 * s * (0.5 + ign * 0.5));
      cg.addColorStop(0, 'rgba(255,255,240,' + 0.9 * ign + ')'); cg.addColorStop(0.3, 'rgba(255,200,120,' + 0.45 * ign + ')'); cg.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = cg; g.beginPath(); g.arc(nx, ny + 8 * s, 60 * s, 0, 6.283); g.fill();
      g.globalCompositeOperation = 'source-over';
      rocket(rx, ry, s, shake);
      // sona doğru ekran açılır → site
      if (t >= 0.8) box.classList.add('reveal');
      if (t >= 1) { window.removeEventListener('resize', size); return finish(); }
      requestAnimationFrame(frame);
    }
    box.classList.add('launching');
    requestAnimationFrame(frame);
  }
})();
