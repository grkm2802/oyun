/* Görev Mimarı — atölyedeki 3B uzay aracı (Three.js r149, mission-game/vendor/three.min.js).
   İki dil klasöründe de AYNI dosya. Three.js ilk kez gerektiğinde yüklenir; yüklenemezse ya da
   WebGL yoksa atölye eski SVG çizimini (viz.js craftSVG) göstermeye devam eder.
   Kullanım: Craft3D.ready() → true ise Craft3D.show(kutu, R). */
(function () {
  'use strict';
  const TXT = {
    tr: { hint: 'Döndürmek için sürükle', label: 'Uzay aracının 3B görünümü' },
    en: { hint: 'Drag to rotate', label: '3D view of the spacecraft' },
  }[typeof LANG !== 'undefined' && LANG === 'en' ? 'en' : 'tr'];

  // three.min.js her iki dil için tek kopya: mission-game/vendor/
  const SELF = document.currentScript && document.currentScript.src;
  const THREE_URL = SELF ? new URL('../../mission-game/vendor/three.min.js', SELF).href : 'mission-game/vendor/three.min.js';

  // NASA gezegen dokuları (eşdikdörtgen): mission-game/textures/. Kaynaklar README'de.
  const TEX_BASE = SELF ? new URL('../../mission-game/textures/', SELF).href : 'mission-game/textures/';
  const NASA_FILE = { Earth: 'earth.jpg', Moon: 'moon.jpg', Mars: 'mars.jpg', Jupiter: 'jupiter.jpg', Europa: 'europa.jpg' };
  const NT = {};
  // Doku hazırsa döndürür; değilse yüklemeyi başlatır, null döner ve hazır olunca onLoad(tex) çağırır.
  // file:// ile açılınca WebGL yerel resmi kullanamaz → hiç denemez (onFail hemen).
  function nasaTex(body, onLoad, onFail) {
    if (!NASA_FILE[body] || location.protocol === 'file:') { if (onFail) onFail(); return null; }
    let e = NT[body];
    if (e && e.tex) return e.tex;
    if (e && e.failed) { if (onFail) onFail(); return null; }
    if (!e) {
      e = NT[body] = { tex: null, failed: false, ok: [], bad: [] };
      new THREE.TextureLoader().load(TEX_BASE + NASA_FILE[body], (t) => {
        t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; e.tex = t;
        e.ok.forEach((f) => f(t)); e.ok = []; e.bad = [];
      }, undefined, () => { e.failed = true; e.bad.forEach((f) => f()); e.ok = []; e.bad = []; });
    }
    if (onLoad) e.ok.push(onLoad);
    if (onFail) e.bad.push(onFail);
    return null;
  }

  let state = 'idle'; // idle | loading | ok | fail
  const waiters = [];
  function webglOK() {
    try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
  }
  function load(cb) {
    if (state === 'ok') return cb(true);
    if (state === 'fail') return cb(false);
    waiters.push(cb);
    if (state === 'loading') return;
    if (!webglOK()) { state = 'fail'; return flush(); }
    if (window.THREE && window.THREE.WebGLRenderer) { state = 'ok'; return flush(); }
    state = 'loading';
    const s = document.createElement('script');
    s.src = THREE_URL;
    s.onload = () => { state = window.THREE && window.THREE.WebGLRenderer ? 'ok' : 'fail'; flush(); };
    s.onerror = () => { state = 'fail'; flush(); };
    document.head.appendChild(s);
  }
  function flush() { while (waiters.length) { try { waiters.shift()(state === 'ok'); } catch (e) { console.error(e); } } }

  /* ---------------- malzemeler ve dokular (bir kez) ---------------- */
  let M = null;
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    return t;
  }
  function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function materials() {
    if (M) return M;
    const r = rnd(7);
    // altın ısı yalıtım folyosu (MLI): kırışık, parlak
    const mli = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#c99a3b'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 160; i++) {
        const x = r() * w, y = r() * h, l = 10 + r() * 40, a = r() * Math.PI;
        g.strokeStyle = r() < 0.5 ? 'rgba(245,214,140,.55)' : 'rgba(120,86,24,.5)';
        g.lineWidth = 1 + r() * 2;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
      g.strokeStyle = 'rgba(110,80,25,.8)'; g.lineWidth = 3; g.strokeRect(1, 1, w - 2, h - 2);
    });
    // güneş hücreleri: koyu mavi, ince ızgara
    const cells = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#16243f'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#2f4a7a'; g.lineWidth = 1;
      for (let x = 0; x <= w; x += 16) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, h); g.stroke(); }
      for (let y = 0; y <= h; y += 16) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); g.stroke(); }
      g.strokeStyle = '#aab3bd'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
    });
    const std = (o) => new THREE.MeshStandardMaterial(o);
    M = {
      mli: std({ map: mli, metalness: 0.75, roughness: 0.32 }),
      cells: std({ map: cells, metalness: 0.35, roughness: 0.38 }),
      cellBack: std({ color: 0x8a929b, metalness: 0.4, roughness: 0.6 }),
      silver: std({ color: 0xc9ced6, metalness: 0.8, roughness: 0.3 }),
      white: std({ color: 0xeef0f2, metalness: 0.05, roughness: 0.55, side: THREE.DoubleSide }),
      grey: std({ color: 0x5a6069, metalness: 0.6, roughness: 0.45 }),
      dark: std({ color: 0x22272e, metalness: 0.3, roughness: 0.5 }),
      lens: std({ color: 0x0e1622, metalness: 0.9, roughness: 0.08 }),
      nozzle: std({ color: 0x4a4f57, metalness: 0.85, roughness: 0.35, side: THREE.DoubleSide }),
      rtg: std({ color: 0x3f444b, metalness: 0.5, roughness: 0.6 }),
      ion: std({ color: 0x6aa9ff, emissive: 0x3b7bff, emissiveIntensity: 1.2 }),
    };
    return M;
  }

  /* ---------------- parçalar ---------------- */
  // Eksenler: +Y üst (anten), ±X güneş kanatları, -Y motor, +Z ön yüz (aletler).
  function mesh(geo, mat) { const m = new THREE.Mesh(geo, mat); return m; }
  function box(w, h, d, mat) { return mesh(new THREE.BoxGeometry(w, h, d), mat); }
  function cyl(rt, rb, h, mat, seg = 20) { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); }

  function buildParts(R) {
    const d = R.d, m = materials();
    const on = (id) => R.insts.find((i) => i.id === id);
    const big = (id) => (on(id) && on(id).t === 2 ? 1.3 : 1);
    const s = 0.9 + Math.min(0.7, Math.sqrt(Math.max(R.mass.dry, 1)) / 40); // gövde boyu
    const hx = s / 2, hy = s * 0.42, hz = s / 2;
    const parts = [];
    const add = (key, obj) => parts.push({ key, obj });

    // gövde
    const bus = new THREE.Group();
    bus.add(box(s, hy * 2, s, m.mli));
    const deck = box(s * 1.04, 0.04, s * 1.04, m.silver); deck.position.y = hy + 0.02; bus.add(deck);
    const deck2 = deck.clone(); deck2.position.y = -hy - 0.02; bus.add(deck2);
    if (d.adcs !== 'mtq') { const st = box(0.14, 0.14, 0.14, m.dark); st.position.set(hx - 0.12, hy - 0.12, hz + 0.05); bus.add(st);
      const l = cyl(0.045, 0.045, 0.04, m.lens); l.rotation.x = Math.PI / 2; l.position.set(hx - 0.12, hy - 0.12, hz + 0.13); bus.add(l); }
    add('bus', bus);

    // güç
    const wing = { deploy3: [1.3, 0.75, 2], deploy10: [1.8, 0.9, 3], huge: [2.6, 1.15, 4] }[d.power];
    if (wing) {
      const [w, h, n] = wing;
      const g = new THREE.Group();
      for (const side of [-1, 1]) {
        const boom = cyl(0.025, 0.025, 0.4, m.silver, 8); boom.rotation.z = Math.PI / 2; boom.position.x = side * (hx + 0.2); g.add(boom);
        for (let k = 0; k < n; k++) {
          const pw = w / n, x = side * (hx + 0.4 + pw * (k + 0.5) + k * 0.03);
          const p = box(pw, h, 0.025, [m.cellBack, m.cellBack, m.cellBack, m.cellBack, m.cells, m.cellBack]);
          p.position.x = x; g.add(p);
        }
      }
      g.rotation.x = -0.25; // panel güneşe dönük biraz eğik
      add('power-' + d.power, g);
    } else if (d.power === 'body') {
      const g = new THREE.Group();
      for (const side of [-1, 1]) { const p = box(0.012, hy * 1.8, s * 0.9, [m.cells, m.cells, m.cellBack, m.cellBack, m.cellBack, m.cellBack]); p.position.x = side * (hx + 0.01); g.add(p); }
      add('power-body', g);
    }
    const rtgN = d.power === 'rtg' ? 1 : d.power === 'rtg2' ? 2 : 0;
    for (let i = 0; i < rtgN; i++) {
      const side = i === 0 ? -1 : 1, g = new THREE.Group();
      const boom = cyl(0.02, 0.02, 0.6, m.silver, 8); boom.rotation.z = side * Math.PI / 2.6; boom.position.set(side * (hx + 0.22), -hy * 0.6, 0); g.add(boom);
      const r = new THREE.Group(); r.position.set(side * (hx + 0.5), -hy * 0.95, 0); r.rotation.z = side * 0.5;
      r.add(cyl(0.11, 0.11, 0.55, m.rtg));
      for (let k = 0; k < 4; k++) { const fin = box(0.36, 0.5, 0.02, m.rtg); fin.rotation.y = (k * Math.PI) / 4; r.add(fin); }
      g.add(r);
      add('power-rtg-' + i, g);
    }

    // anten (üstte)
    const ant = d.antenna, ag = new THREE.Group();
    if (ant === 'lga') {
      const rod = cyl(0.015, 0.015, 0.3, m.silver, 8); rod.position.y = hy + 0.17; rod.position.x = hx * 0.5; ag.add(rod);
      const cap = cyl(0.05, 0.05, 0.08, m.white); cap.position.set(hx * 0.5, hy + 0.36, 0); ag.add(cap);
    } else if (ant === 'mga') {
      const horn = cyl(0.17, 0.07, 0.3, m.white, 4); horn.rotation.y = Math.PI / 4; horn.position.y = hy + 0.19; ag.add(horn);
    } else {
      const R0 = ant === 'kahga' ? 0.95 : 0.65, depth = R0 * 0.32;
      const pts = []; for (let i = 0; i <= 16; i++) { const x = (R0 * i) / 16; pts.push(new THREE.Vector2(x, (depth * x * x) / (R0 * R0))); }
      const dish = mesh(new THREE.LatheGeometry(pts, 48), m.white);
      const mast = cyl(0.04, 0.05, 0.22, m.silver, 10); mast.position.y = hy + 0.11; ag.add(mast);
      dish.position.y = hy + 0.22; ag.add(dish);
      const feedH = R0 * 0.55;
      for (let k = 0; k < 3; k++) { const a = (k * Math.PI * 2) / 3, st = cyl(0.008, 0.008, Math.hypot(R0 * 0.75, feedH), m.silver, 6);
        st.position.set(Math.cos(a) * R0 * 0.37, hy + 0.22 + depth * 0.5 + feedH / 2, Math.sin(a) * R0 * 0.37);
        st.lookAt(0, hy + 0.22 + feedH + 0.05, 0); st.rotateX(Math.PI / 2); ag.add(st); }
      const feed = cyl(0.04, 0.03, 0.08, m.grey, 10); feed.position.y = hy + 0.22 + feedH + 0.05; ag.add(feed);
    }
    add('antenna-' + ant, ag);

    // itki (altta)
    const pr = d.propulsion;
    if (pr && pr !== 'none') {
      const g = new THREE.Group();
      if (pr === 'ion') {
        const c = cyl(0.2, 0.2, 0.12, m.grey, 28); c.position.y = -hy - 0.1; g.add(c);
        const glow = cyl(0.17, 0.17, 0.01, m.ion, 28); glow.position.y = -hy - 0.165; g.add(glow);
      } else {
        const size = { cold: 0.35, mono: 0.55, biprop: 1, ion: 0.6 }[pr] || 0.6;
        const L = 0.45 * size, rt = 0.07 * size, rb = 0.24 * size;
        const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(rt + (rb - rt) * Math.pow(t, 0.6), -t * L)); }
        const bell = mesh(new THREE.LatheGeometry(pts, 32), m.nozzle); bell.position.y = -hy - 0.06; g.add(bell);
        const throat = cyl(0.09 * size + 0.03, rt, 0.08, m.grey, 16); throat.position.y = -hy - 0.03; g.add(throat);
      }
      add('prop-' + pr, g);
    }

    // aletler (ön yüz)
    const front = ['camera', 'spectrometer', 'multispec', 'thermal', 'altimeter', 'atmo', 'neutron', 'particles'].filter(on).slice(0, 6);
    const cols = Math.min(3, front.length), rows = Math.ceil(front.length / 3);
    front.forEach((id, i) => {
      const k = big(id) * Math.min(1, s / 1.2), g = new THREE.Group();
      const c = i % 3, rI = Math.floor(i / 3), nInRow = rI < rows - 1 ? 3 : front.length - 3 * rI;
      const x = ((c + 0.5) / nInRow - 0.5) * s * 0.85, y = rows === 1 ? 0 : (rI === 0 ? 1 : -1) * hy * 0.45;
      g.position.set(x, y, hz);
      if (id === 'camera' || id === 'multispec') {
        const barrel = cyl(0.09 * k, 0.11 * k, 0.26 * k, id === 'camera' ? m.white : m.silver, 20); barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.13 * k; g.add(barrel);
        const lens = cyl(0.07 * k, 0.07 * k, 0.02, m.lens, 20); lens.rotation.x = Math.PI / 2; lens.position.z = 0.265 * k; g.add(lens);
      } else if (id === 'spectrometer') {
        const b = box(0.24 * k, 0.17 * k, 0.16 * k, m.dark); b.position.z = 0.08 * k; g.add(b);
        const ap = box(0.1 * k, 0.06 * k, 0.02, m.lens); ap.position.z = 0.17 * k; g.add(ap);
      } else if (id === 'thermal') {
        const b = box(0.2 * k, 0.2 * k, 0.12 * k, m.white); b.position.z = 0.06 * k; g.add(b);
        for (let f = -1; f <= 1; f++) { const fin = box(0.22 * k, 0.012, 0.13 * k, m.silver); fin.position.set(0, f * 0.07 * k, 0.07 * k); g.add(fin); }
        const l = cyl(0.04 * k, 0.04 * k, 0.02, m.lens, 16); l.rotation.x = Math.PI / 2; l.position.z = 0.13 * k; g.add(l);
      } else if (id === 'altimeter') {
        const c2 = cyl(0.09 * k, 0.09 * k, 0.12 * k, m.silver, 20); c2.rotation.x = Math.PI / 2; c2.position.z = 0.06 * k; g.add(c2);
        const l = cyl(0.065 * k, 0.065 * k, 0.02, m.lens, 20); l.rotation.x = Math.PI / 2; l.position.z = 0.125 * k; g.add(l);
      } else if (id === 'atmo') {
        const b = box(0.2 * k, 0.14 * k, 0.1 * k, m.white); b.position.z = 0.05 * k; g.add(b);
        const dome = mesh(new THREE.SphereGeometry(0.07 * k, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), m.lens); dome.rotation.x = Math.PI / 2; dome.position.z = 0.1 * k; g.add(dome);
      } else {
        const b = box(0.14 * k, 0.12 * k, 0.1 * k, m.silver); b.position.z = 0.05 * k; g.add(b);
      }
      add('i-' + id, g);
    });
    if (on('sar')) { // sentetik açıklıklı radar: arka yüzde uzun düz anten
      const k = big('sar'), g = new THREE.Group();
      const p = box(s * 1.5 * k, 0.32, 0.04, m.grey); p.position.set(0, 0, -hz - 0.16); g.add(p);
      for (const sx of [-0.25, 0.25]) { const st = box(0.03, 0.03, 0.16, m.silver); st.position.set(sx * s, 0, -hz - 0.08); g.add(st); }
      add('i-sar', g);
    }
    if (on('magnetometer')) {
      const g = new THREE.Group(), L = 1.6;
      const boom = cyl(0.012, 0.012, L, m.silver, 6); boom.rotation.z = -Math.PI / 3; boom.position.set(hx + Math.sin(Math.PI / 3) * L / 2, hy * 0.6 + Math.cos(Math.PI / 3) * L / 2, -hz * 0.6); g.add(boom);
      const tip = box(0.08, 0.06, 0.06, m.white); tip.position.set(hx + Math.sin(Math.PI / 3) * L, hy * 0.6 + Math.cos(Math.PI / 3) * L, -hz * 0.6); g.add(tip);
      add('i-magnetometer', g);
    }
    if (on('radar_sounder')) {
      const g = new THREE.Group(), L = 2.2 * big('radar_sounder');
      for (const side of [-1, 1]) { const a = cyl(0.008, 0.008, L, m.white, 6); a.rotation.z = side * (Math.PI / 2 - 0.35); a.position.set(side * (hx + Math.cos(0.35) * L / 2), -hy - Math.sin(0.35) * L / 2, -hz + 0.05); g.add(a); }
      add('i-radar_sounder', g);
    }
    return parts;
  }

  /* ---------------- ortak gezinme: tam ekran, yakınlaştırma, kaydırma, eksenler ----------------
     Atölye (bu dosya) ve uçuş ekranı (flight3d.js) aynı yardımcıları kullanır.
     Fare: sol tık sürükle = döndür, sağ tık ya da Shift + sürükle = kaydır, tekerlek = yakınlaştır (tam ekranda).
     Dokunmatik: bir parmak = döndür, iki parmak = yakınlaştır + kaydır. */
  const NAV_TXT = {
    tr: { full: 'Tam ekran', exit: 'Küçült', zin: 'Yakınlaştır', zout: 'Uzaklaştır', axes: 'Eksenler', reset: 'Sıfırla', tools: '3B görünüm denetimleri' },
    en: { full: 'Full screen', exit: 'Exit full screen', zin: 'Zoom in', zout: 'Zoom out', axes: 'Axes', reset: 'Reset', tools: '3D view controls' },
  }[typeof LANG !== 'undefined' && LANG === 'en' ? 'en' : 'tr'];

  function createNav(yaw, pitch, limits) {
    const nav = { yaw, pitch, zoom: 1, panX: 0, panY: 0, axes: true, idleAt: 0, active: false, home: { yaw, pitch }, lim: limits || { pMin: -0.9, pMax: 1.1 } };
    nav.reset = () => { nav.yaw = nav.home.yaw; nav.pitch = nav.home.pitch; nav.zoom = 1; nav.panX = 0; nav.panY = 0; nav.idleAt = performance.now(); };
    nav.setZoom = (z) => { nav.zoom = Math.max(0.35, Math.min(4, z)); nav.idleAt = performance.now(); };
    return nav;
  }
  function isFull(el) { return !!el && (document.fullscreenElement === el || document.webkitFullscreenElement === el || el.classList.contains('v3-full')); }
  function exitFull(el) {
    if (!el) return;
    el.classList.remove('v3-full'); setTimeout(syncBars, 0);
    const fe = document.fullscreenElement || document.webkitFullscreenElement;
    if (fe === el) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (_) {} }
  }
  function toggleFull(el) {
    if (isFull(el)) return exitFull(el);
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    // tarayıcı tam ekrana izin vermezse (ör. iPhone, gömülü sayfa) sayfa içinde tüm ekranı kapla
    const fallback = () => { el.classList.add('v3-full'); syncBars(); };
    if (!req) return fallback();
    try { const p = req.call(el); if (p && p.catch) p.catch(fallback); } catch (_) { fallback(); }
    // bazı gömülü tarayıcılar isteği ne kabul ne ret eder: kısa süre sonra hâlâ tam ekran değilse sayfa içinde kapla
    setTimeout(() => { if (!(document.fullscreenElement || document.webkitFullscreenElement)) fallback(); }, 800);
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.querySelector('.v3-full')) { document.querySelectorAll('.v3-full').forEach((el) => el.classList.remove('v3-full')); syncBars(); } });

  // sürükle / iki parmak / tekerlek
  function bindGestures(cv, nav, fullEl, kick) {
    const pts = new Map();
    let mode = null, st = null;
    const snap = () => {
      const a = [...pts.values()];
      const mid = a.length > 1 ? { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 } : a[0];
      const dist = a.length > 1 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0;
      return { mid, dist, yaw: nav.yaw, pitch: nav.pitch, zoom: nav.zoom, panX: nav.panX, panY: nav.panY };
    };
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // pointer capture kullanılmıyor: takılı kalırsa araç çubuğu tıklamaları tuvale gidiyordu; pencereyi dinle
      mode = pts.size >= 2 ? 'pinch' : (e.button === 2 || e.shiftKey ? 'pan' : 'rot');
      st = snap(); nav.active = true; nav.idleAt = performance.now();
      cv.classList.add('grab'); if (nav.onInteract) nav.onInteract();
      kick();
    });
    window.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId) || !mode) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const now = snap(), h = cv.clientHeight || 300, dx = now.mid.x - st.mid.x, dy = now.mid.y - st.mid.y;
      if (mode === 'rot') {
        nav.yaw = st.yaw + dx * 0.01;
        nav.pitch = Math.max(nav.lim.pMin, Math.min(nav.lim.pMax, st.pitch + dy * 0.006));
      } else {
        nav.panX = st.panX - (dx / h) * 1.6 / nav.zoom;
        nav.panY = st.panY + (dy / h) * 1.6 / nav.zoom;
        if (mode === 'pinch' && st.dist > 0) nav.setZoom(st.zoom * (now.dist / st.dist));
      }
      nav.idleAt = performance.now();
      kick();
    });
    const up = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size === 0) { mode = null; nav.active = false; cv.classList.remove('grab'); }
      else { mode = 'rot'; st = snap(); }
      nav.idleAt = performance.now();
    };
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    // tekerlek sayfayı kaydırmasın diye sadece tam ekranda yakınlaştırır
    cv.addEventListener('wheel', (e) => {
      if (!isFull(fullEl())) return;
      e.preventDefault();
      nav.setZoom(nav.zoom * Math.exp(-e.deltaY * 0.0015));
      kick();
    }, { passive: false });
  }

  // araç çubuğu: Tam ekran, +, −, Eksenler, Sıfırla
  function toolbar(container, fullEl, nav, kick, extraClass) {
    const bar = document.createElement('div');
    bar.className = 'v3-tools' + (extraClass ? ' ' + extraClass : '');
    bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', NAV_TXT.tools);
    bar.innerHTML = `<button type="button" class="v3-btn" data-v3="full">${NAV_TXT.full}</button>
      <button type="button" class="v3-btn" data-v3="in" aria-label="${NAV_TXT.zin}">+</button>
      <button type="button" class="v3-btn" data-v3="out" aria-label="${NAV_TXT.zout}">−</button>
      <button type="button" class="v3-btn" data-v3="axes" aria-pressed="${nav.axes}">${NAV_TXT.axes}</button>
      <button type="button" class="v3-btn" data-v3="reset">${NAV_TXT.reset}</button>`;
    const sync = () => {
      const f = isFull(fullEl());
      const b = bar.querySelector('[data-v3="full"]'); b.textContent = f ? NAV_TXT.exit : NAV_TXT.full; b.setAttribute('aria-pressed', f);
      bar.querySelector('[data-v3="axes"]').setAttribute('aria-pressed', nav.axes);
    };
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v3]'); if (!b) return;
      e.stopPropagation();
      const k = b.dataset.v3;
      if (k === 'full') toggleFull(fullEl());
      else if (k === 'in') nav.setZoom(nav.zoom * 1.25);
      else if (k === 'out') nav.setZoom(nav.zoom / 1.25);
      else if (k === 'axes') nav.axes = !nav.axes;
      else if (k === 'reset') nav.reset();
      setTimeout(sync, 60); kick();
    });
    bar.sync = sync;
    container.appendChild(bar);
    sync();
    return bar;
  }
  // tam ekrana girip çıkınca tüm araç çubuklarını güncelle
  function syncBars() { document.querySelectorAll('.v3-tools').forEach((b) => b.sync && b.sync()); }
  document.addEventListener('fullscreenchange', syncBars);
  document.addEventListener('webkitfullscreenchange', syncBars);

  // eksenler: X kırmızı, Y yeşil, Z mavi; -boy..+boy çizgi, + uçta ok ve harf
  function makeAxes(size) {
    const g = new THREE.Group();
    const AX = [['X', 0xe5534b, [1, 0, 0]], ['Y', 0x57ab5a, [0, 1, 0]], ['Z', 0x539bf5, [0, 0, 1]]];
    for (const [name, col, d] of AX) {
      const v = new THREE.Vector3(...d);
      const geo = new THREE.BufferGeometry().setFromPoints([v.clone().multiplyScalar(-size), v.clone().multiplyScalar(size)]);
      g.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.85 })));
      const tip = new THREE.Mesh(new THREE.ConeGeometry(size * 0.025, size * 0.07, 12), new THREE.MeshBasicMaterial({ color: col }));
      tip.position.copy(v.clone().multiplyScalar(size));
      tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
      g.add(tip);
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d'); x.font = 'bold 44px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = '#' + col.toString(16).padStart(6, '0'); x.fillText(name, 32, 34);
      const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      sp.position.copy(v.clone().multiplyScalar(size * 1.13)); sp.scale.setScalar(size * 0.13);
      g.add(sp);
    }
    return g;
  }

  // arka plan yıldızları (yarıçap r küresi üzerinde), birkaç parlak yıldızla
  function makeStars(n, r, seed) {
    let s = seed >>> 0; const rr = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rr() * 2 - 1, a = rr() * Math.PI * 2, q = Math.sqrt(1 - u * u);
      pos.set([Math.cos(a) * q * r, u * r, Math.sin(a) * q * r], i * 3);
      const b = 0.25 + Math.pow(rr(), 3) * 0.75, warm = rr() < 0.15;
      col.set(warm ? [b, b * 0.88, b * 0.72] : [b * 0.95, b, b * 1.05], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const grp = new THREE.Group();
    grp.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true })));
    const bp = new Float32Array(24 * 3);
    for (let i = 0; i < 24; i++) { const u = rr() * 2 - 1, a = rr() * Math.PI * 2, q = Math.sqrt(1 - u * u); bp.set([Math.cos(a) * q * r, u * r, Math.sin(a) * q * r], i * 3); }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    grp.add(new THREE.Points(bg, new THREE.PointsMaterial({ size: 3.2, sizeAttenuation: false, color: 0xf4f7ff })));
    return grp;
  }

  // kamerayı merkez etrafında yerleştir; yakınlaştırma ve kaydırmayı uygula
  function placeCamera(cam, c, nav, dist) {
    const d = dist / nav.zoom;
    cam.position.set(c.x + Math.sin(nav.yaw) * Math.cos(nav.pitch) * d, c.y + Math.sin(nav.pitch) * d, c.z + Math.cos(nav.yaw) * Math.cos(nav.pitch) * d);
    cam.lookAt(c);
    cam.translateX(nav.panX * dist * 0.5);
    cam.translateY(nav.panY * dist * 0.5);
  }

  /* ---------------- sahne ---------------- */
  let V = null; // { host, renderer, scene, camera, craft, ... }
  function createView(host) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const cv = renderer.domElement;
    cv.className = 'ws-3d'; cv.setAttribute('aria-hidden', 'true');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    // güneş sol-üstten (gezegen resimleriyle aynı yönden)
    const sun = new THREE.DirectionalLight(0xfff4e6, 2.6); sun.position.set(-4, 5, 4); scene.add(sun);
    const fill = new THREE.DirectionalLight(0x9fb8d9, 0.55); fill.position.set(4, -2, -3); scene.add(fill);
    scene.add(new THREE.HemisphereLight(0xbfd2ff, 0x1a1410, 0.5));
    const craft = new THREE.Group(); scene.add(craft);
    // arka plandaki gezegen ayrı katmanda, sabit kamerayla (araç dönerken yerinde durur)
    const pscene = new THREE.Scene(), pcam = new THREE.OrthographicCamera(0, 1, 0, -1, -2000, 2000);
    const psun = new THREE.DirectionalLight(0xfff4e6, 2.4); psun.position.set(-3, 1.6, 2.2); pscene.add(psun);
    pscene.add(new THREE.AmbientLight(0x8899bb, 0.05));
    renderer.autoClear = false;
    // yıldızlar ayrı sahnede, en arkada (araçla birlikte döner)
    const sscene = new THREE.Scene(); sscene.add(makeStars(900, 60, 7));
    const axes = makeAxes(1); scene.add(axes);
    const nav = createNav(-0.55, 0.28);
    const v = { pscene, pcam, planet: null, pBody: null, sscene, axes, nav, host, renderer, cv, scene, camera, craft, parts: new Map(), dist: 0, distT: 6, pops: [], raf: 0, visible: true, hinted: false };
    nav.onInteract = () => { if (!v.hinted) { v.hinted = true; const h = v.host.querySelector('.ws-3d-hint'); if (h) h.classList.add('gone'); } };
    // sürükle = döndür, iki parmak / sağ tık = kaydır ve yakınlaştır (dikey tek parmak sayfayı kaydırır)
    bindGestures(cv, nav, () => v.host.parentElement, () => kick());
    if ('IntersectionObserver' in window) {
      v.io = new IntersectionObserver((es) => { v.visible = es[0].isIntersecting; if (v.visible) kick(); });
    }
    return v;
  }

  function attach(host) {
    if (V && V.host === host && host.contains(V.cv)) return;
    if (!V) V = createView(host);
    V.host = host;
    host.classList.add('is3d');
    host.setAttribute('role', 'img'); host.setAttribute('aria-label', TXT.label);
    host.innerHTML = '';
    host.appendChild(V.cv);
    const hint = document.createElement('span'); hint.className = 'ws-3d-hint' + (V.hinted ? ' gone' : ''); hint.textContent = TXT.hint; host.appendChild(hint);
    toolbar(host, () => V.host.parentElement, V.nav, () => kick(), 'ws-tools');
    if (host.parentElement) host.parentElement.classList.add('has3d');
    if (V.io) { V.io.disconnect(); V.io.observe(host); }
    V.parts.clear(); clearCraft();
    V.first = true;
    hideImg();
  }
  // NASA dokulu 3B gezegen hazırsa atölyedeki 2B gezegen resmini gizle
  function hideImg() {
    const img = V.host.parentElement && V.host.parentElement.querySelector('.ws-planet');
    if (img) img.style.visibility = V.planet ? 'hidden' : '';
  }
  function setPlanet(body) {
    if (V.pBody === body) return;
    V.pBody = body;
    if (V.planet) { V.pscene.remove(V.planet); V.planet.geometry.dispose(); V.planet = null; }
    hideImg();
    const make = (tex) => {
      if (V.pBody !== body || V.planet) return;
      V.planet = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 }));
      V.planet.rotation.set(0.25, -1.2, 0.1);
      V.pscene.add(V.planet);
      hideImg(); kick();
    };
    const t = nasaTex(body, make);
    if (t) make(t);
  }
  function clearCraft() {
    while (V.craft.children.length) { const o = V.craft.children[0]; V.craft.remove(o); disposeObj(o); }
  }
  function disposeObj(o) { o.traverse((c) => { if (c.geometry) c.geometry.dispose(); }); }

  function setParts(R) {
    const list = buildParts(R);
    const prev = V.parts;
    clearCraft();
    V.parts = new Map();
    const now = performance.now();
    V.pops = [];
    list.forEach((p) => { V.craft.add(p.obj); V.parts.set(p.key, p.obj); });
    // tüm araç kadraja sığsın (parçalar tam boyuttayken ölç)
    V.craft.position.set(0, 0, 0);
    const sph = new THREE.Box3().setFromObject(V.craft).getBoundingSphere(new THREE.Sphere());
    // yeni parçalar küçükten büyüyerek belirir
    list.forEach((p, i) => {
      if (prev.has(p.key) || REDUCED_MOTION) return;
      p.obj.scale.setScalar(0.001);
      V.pops.push({ obj: p.obj, t0: now + (V.first ? i * 90 : 0) });
    });
    V.first = false;
    V.center = sph.center.clone();
    const fov = (V.camera.fov * Math.PI) / 180, aspect = V.camera.aspect || 1.6;
    const fitV = sph.radius / Math.sin(fov / 2), fitH = sph.radius / Math.sin(Math.atan(Math.tan(fov / 2) * aspect));
    V.distT = Math.max(fitV, fitH) * 0.78;
    V.radius = sph.radius;
    V.axes.scale.setScalar(sph.radius * 1.15); V.axes.position.copy(sph.center);
    if (!V.dist) V.dist = V.distT;
  }

  function resize() {
    const w = V.host.clientWidth, h = V.host.clientHeight;
    if (!w || !h) return false;
    if (V.w !== w || V.h !== h) {
      V.w = w; V.h = h; V.renderer.setSize(w, h, false); V.camera.aspect = w / h; V.camera.updateProjectionMatrix();
      if (V.radius) { const fov = (V.camera.fov * Math.PI) / 180; V.distT = Math.max(V.radius / Math.sin(fov / 2), V.radius / Math.sin(Math.atan(Math.tan(fov / 2) * V.camera.aspect))) * 0.78; }
    }
    return true;
  }

  const ease = (t) => { const c = 1.7; t -= 1; return 1 + t * t * ((c + 1) * t + c); }; // hafif taşmalı
  function frame() {
    V.raf = 0;
    if (!V.host.isConnected) return;
    if (!resize()) return;
    const now = performance.now();
    let busy = false;
    // parça belirme
    V.pops = V.pops.filter((p) => {
      const t = Math.min(1, Math.max(0, (now - p.t0) / 550));
      p.obj.scale.setScalar(t <= 0 ? 0.001 : Math.max(0.001, ease(t)));
      if (t < 1) { busy = true; return true; }
      p.obj.scale.setScalar(1); return false;
    });
    // kendiliğinden yavaş dönüş (kullanıcı bıraktıktan 2,5 sn sonra)
    if (!REDUCED_MOTION && !V.nav.active && now - V.nav.idleAt > 2500) { V.nav.yaw += 0.0035; busy = true; }
    if (Math.abs(V.dist - V.distT) > 0.01) { V.dist += (V.distT - V.dist) * 0.12; busy = true; } else V.dist = V.distT;
    const c = V.center || new THREE.Vector3();
    placeCamera(V.camera, c, V.nav, V.dist);
    V.axes.visible = V.nav.axes;
    V.craft.position.y = REDUCED_MOTION ? 0 : Math.sin(now / 900) * 0.04;
    V.renderer.clear();
    V.sscene.position.copy(V.camera.position); // yıldızlar sonsuz uzakta gibi
    V.renderer.render(V.sscene, V.camera);
    V.renderer.clearDepth();
    if (V.planet) {
      // 2B resmin yeri: sağ alt köşe, kısmen dışarıda (style.css .ws-planet ile aynı ölçüler)
      const w = V.w, h = V.h, full = isFull(V.host.parentElement);
      // tam ekranda gezegen daha büyük ve daha görünür; normalde 2B resmin yeri
      const d = full ? Math.min(w, h) * 0.75 : Math.min(0.46 * w, 360);
      V.pcam.left = 0; V.pcam.right = w; V.pcam.top = 0; V.pcam.bottom = -h; V.pcam.updateProjectionMatrix();
      V.planet.scale.setScalar(d / 2);
      if (full) V.planet.position.set(w - d * 0.2, -(h - d * 0.18), -d);
      else V.planet.position.set(w * 1.04 - d / 2, -(h * 1.34 - d / 2), -d);
      if (!REDUCED_MOTION) V.planet.rotation.y += 0.0008;
      V.renderer.render(V.pscene, V.pcam);
      V.renderer.clearDepth();
    }
    V.renderer.render(V.scene, V.camera);
    if ((busy || !REDUCED_MOTION) && V.visible && !document.hidden) kick();
  }
  function kick() { if (V && !V.raf) V.raf = requestAnimationFrame(frame); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  window.addEventListener('resize', () => kick());

  window.Craft3D = {
    // true: Three.js hazır, 3B çizilebilir. false: henüz değil (yüklemeyi başlatır) ya da hiç olmayacak.
    ready(onReady) { if (state === 'ok') return true; if (state !== 'fail') load((ok) => { if (ok && onReady) onReady(); }); return false; },
    failed() { return state === 'fail'; },
    nasaTex,
    // uçuş ekranı da aynı gezinme araçlarını kullanır
    nav: { createNav, bindGestures, toolbar, makeAxes, makeStars, placeCamera, isFull, exitFull },
    // uçuş ekranı (flight3d.js) için: aracın tüm parçaları tek grup halinde
    build(R) { const g = new THREE.Group(); buildParts(R).forEach((p) => g.add(p.obj)); return g; },
    show(host, R) {
      try { attach(host); setParts(R); setPlanet(R.sc.body); kick(); return true; } catch (e) { console.error(e); state = 'fail'; return false; }
    },
  };
})();
