/* Görev Mimarı — uçuş ekranında 3B yörünge görünümü (Three.js, craft3d.js'in yüklediği kopya).
   İki dil klasöründe de AYNI dosya. viz.js'teki drawFlight'ı sarar:
   - fırlatma ve yolculuk evreleri eskisi gibi 2B canvas,
   - yörünge/çalışma evresi 3B: dönen gezegen, yörünge çizgisi, yörüngede dolaşan uzay aracı (craft3d.js modeli),
     veri gönderirken Dünya yönüne akan veri noktaları (gezegen arkasındaysa gizlenir).
   Three.js/WebGL yoksa ya da hata olursa 2B çizim devam eder. */
(function () {
  'use strict';
  if (typeof drawFlight !== 'function') return;
  const draw2D = drawFlight;
  let failed = false;
  let V = null;

  /* ---------- gezegen dokusu (eşdikdörtgen; renkler viz.js bodyColorFn) ---------- */
  const TEXS = {};
  function planetTex(body) {
    if (TEXS[body]) return TEXS[body];
    const W = 640, H = 320;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), img = g.createImageData(W, H), D = img.data;
    const col = bodyColorFn(body);
    for (let py = 0; py < H; py++) {
      const th = ((py + 0.5) / H) * Math.PI, st = Math.sin(th), ct = Math.cos(th);
      for (let px = 0; px < W; px++) {
        const ph = ((px + 0.5) / W) * Math.PI * 2;
        // Three.js SphereGeometry ile aynı eşleme; bodyColorFn'de y aşağı doğru
        const x = -Math.cos(ph) * st, y = ct, z = Math.sin(ph) * st;
        const c3 = col(x, -y, z), i = (py * W + px) * 4;
        D[i] = c3[0]; D[i + 1] = c3[1]; D[i + 2] = c3[2]; D[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    TEXS[body] = t;
    return t;
  }
  // Önce NASA dokusu (craft3d.js nasaTex); yüklenene kadar koyu yer tutucu, yüklenemezse kodla üretilen doku.
  function planet(body, r) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.95, metalness: 0 });
    const use = (t) => { mat.map = t; mat.color.set(0xffffff); mat.needsUpdate = true; };
    const t = Craft3D.nasaTex(body, use, () => use(planetTex(body)));
    if (t) use(t);
    return new THREE.Mesh(new THREE.SphereGeometry(r, 64, 40), mat);
  }

  /* ---------- sahne ---------- */
  function createView() {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setClearColor(0x05080d, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const cv = renderer.domElement; cv.className = 'viz-3d'; cv.setAttribute('aria-hidden', 'true');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1.6, 0.05, 400);
    // güneş sol-üstten (2B görünüm ve atölyeyle aynı yön)
    const sun = new THREE.DirectionalLight(0xfff4e6, 2.2); sun.position.set(-6, 2.5, 2.5); scene.add(sun);
    scene.add(new THREE.AmbientLight(0x8899bb, 0.07));
    // yıldızlar
    const r = seeded(42), n = 1400, pos = new Float32Array(n * 3), colr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), d = 150;
      pos.set([Math.cos(a) * s * d, u * d, Math.sin(a) * s * d], i * 3);
      const b = 0.25 + Math.pow(r(), 3) * 0.75; colr.set([b, b, b * 1.05], i * 3);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true })));
    const world = new THREE.Group(); scene.add(world);
    const N = Craft3D.nav;
    const nav = N.createNav(0.35, 0.2, { pMin: -1.2, pMax: 1.2 });
    nav.minR = 1.12; // serbest kamera gezegenin (yarıçap 1) içine girmesin
    const v = { renderer, cv, scene, camera, world, key: null, nav, wrap: null, t: 0 };
    // çizim döngüsü ui.js'te (her karede drawFlight), ayrıca tetiklemeye gerek yok
    N.bindGestures(cv, nav, () => v.wrap, () => {});
    return v;
  }

  function clearWorld() {
    while (V.world.children.length) {
      const o = V.world.children[0]; V.world.remove(o);
      o.traverse((c) => { if (c.geometry) c.geometry.dispose(); }); // dokular önbellekte kalır
    }
  }

  // görev değişince (yeni uçuş, farklı yörünge) sahneyi kur
  function build(sim) {
    clearWorld();
    const sc = sim.sc, R = sim.R, k = R.d.orbit, ob = sim.orbit;
    const W = V.world;
    const S = {};
    S.flyby = !!ob.flyby;
    S.jup = k === 'jflyby';
    const center = S.jup ? 'Jupiter' : sc.body;
    S.planet = planet(center, 1);
    S.planet.rotation.z = 0.2; // eksen eğikliği
    W.add(S.planet);
    if (sc.body === 'Europa' && !S.jup) { // arka planda Jüpiter
      const jp = planet('Jupiter', 9); jp.position.set(-24, 9, -46); W.add(jp);
    }
    if (S.jup) { // Europa, Jüpiter'in çevresinde
      S.moonR = 2.3;
      S.moon = planet('Europa', 0.16); W.add(S.moon);
      W.add(ring(S.moonR, 0, 0xffffff, 0.14));
    }
    // yörünge düzlemi: biraz eğik (2B'deki gibi)
    S.plane = new THREE.Group(); S.plane.rotation.set(0.18, 0, -0.32); W.add(S.plane);
    if (S.flyby) {
      S.a = 0; S.e = 1;
      const pts = []; for (let i = -40; i <= 40; i++) { const x = i * 0.15; pts.push(new THREE.Vector3(x, 0, 1.6 + 0.07 * x * x)); }
      S.plane.add(line(pts, 0xffffff, 0.3));
      S.extent = 3.4;
    } else {
      S.a = Math.max(1.05, ob.viz.a); S.e = ob.viz.e || 0;
      const b = S.a * Math.sqrt(1 - S.e * S.e), fc = S.a * S.e, pts = [];
      for (let i = 0; i <= 160; i++) { const E = (i / 160) * Math.PI * 2; pts.push(new THREE.Vector3(S.a * Math.cos(E) - fc, 0, b * Math.sin(E))); }
      S.plane.add(line(pts, 0xffffff, 0.32));
      S.b = b; S.fc = fc;
      S.extent = Math.max(1.65, S.a * (1 + S.e) + 0.2, S.jup ? S.moonR + 0.4 : 0);
    }
    // uzay aracı: atölyedeki 3B model, görünür olsun diye büyütülmüş
    S.craft = new THREE.Group();
    const model = Craft3D.build(R);
    const sph = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
    const size = Math.max(0.26, S.extent * 0.1), ks = size / sph.radius;
    model.scale.setScalar(ks);
    // modelin merkezi tam yörünge çizgisinin üstünde olsun (kaydırma da ölçeklenmeli)
    model.position.copy(sph.center).multiplyScalar(-ks);
    S.craft.add(model);
    S.plane.add(S.craft);
    // veri noktaları (Dünya yönüne akar)
    S.earthDir = new THREE.Vector3(0.75, 0.55, 0.38).normalize();
    const dp = new Float32Array(8 * 3), dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    S.data = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x62cf8f, size: 4, sizeAttenuation: false, transparent: true, opacity: 0.9 }));
    S.data.frustumCulled = false;
    V.scene.add(S.data);
    V.S = S;
  }
  function line(pts, color, opacity) {
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  }
  function ring(r, y, color, op) { const pts = []; for (let i = 0; i <= 128; i++) { const a = (i / 128) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); } return line(pts, color, op); }

  // aracın konumu (yörünge düzleminde) — 2B ile aynı Kepler yaklaşımı ve aynı ui.orbAng
  function craftPos(sim, ui, S) {
    if (S.flyby) {
      const p = clamp((sim.opsMonth + ui.sub) / Math.max(1, sim.plannedOps), 0, 1), x = -6 + p * 12;
      return new THREE.Vector3(x, 0, 1.6 + 0.07 * x * x);
    }
    const speed = 1.1 / Math.pow(Math.max(1, S.a), 0.9);
    ui.orbAng = (ui.orbAng || 0) + speed * ui.dt * (ui.paused ? 0 : sim.done ? 0.3 : 1); // duraklatınca durur
    const E = ui.orbAng + S.e * Math.sin(ui.orbAng);
    return new THREE.Vector3(S.a * Math.cos(E) - S.fc, 0, -S.b * Math.sin(E));
  }

  function labels(wrap, sc) {
    let box = wrap.querySelector('.viz-3d-labels');
    if (!box) {
      box = document.createElement('div'); box.className = 'viz-3d-labels'; box.setAttribute('aria-hidden', 'true');
      box.innerHTML = `<span class="l">${VIZ_TXT.sunlight}</span>${sc.body !== 'Earth' ? `<span class="r">${VIZ_TXT.earthDir}</span>` : ''}`;
      wrap.appendChild(box);
    }
    box.hidden = false;
  }

  function render3D(canvas, sim, ui) {
    const wrap = canvas.parentElement;
    if (!wrap) return false;
    if (!V) V = createView();
    if (V.cv.parentElement !== wrap) {
      wrap.appendChild(V.cv); V.key = null; V.wrap = wrap;
      V.bar = Craft3D.nav.toolbar(wrap, () => V.wrap, V.nav, () => {}, 'viz-tools');
    }
    V.cv.hidden = false; if (V.bar && V.bar.hidden) { V.bar.hidden = false; V.bar.sync(); }
    // karar penceresi tam ekranın dışında kalır: karar gerekince tam ekrandan çık
    if (sim.pending && Craft3D.nav.isFull(wrap)) Craft3D.nav.exitFull(wrap);
    const key = sim; // her yeni uçuşta sahne yeniden kurulur
    if (V.key !== key || !V.S) { if (V.S && V.S.data) { V.scene.remove(V.S.data); V.S.data.geometry.dispose(); } build(sim); V.key = key; }
    labels(wrap, sim.sc);
    // 2B canvas'ı boşalt (erişilebilirlik etiketi onda kalır)
    if (!canvas.dataset.cleared) { const g = canvas.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height); canvas.dataset.cleared = '1'; }
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return true;
    if (V.w !== w || V.h !== h) { V.w = w; V.h = h; V.renderer.setSize(w, h, false); V.camera.aspect = w / h; V.camera.updateProjectionMatrix(); }
    const S = V.S, dt = ui.paused ? 0 : (ui.dt || 0.016); // duraklatınca gezegen, ay ve veri akışı da durur
    V.t += dt;
    if (!REDUCED_MOTION) S.planet.rotation.y += dt * 0.06;
    if (S.moon) { const a = (REDUCED_MOTION ? 0 : V.t * 0.25) + 1; S.moon.position.set(Math.cos(a) * S.moonR, 0, -Math.sin(a) * S.moonR); }
    // araç
    const p = craftPos(sim, ui, S);
    S.craft.position.copy(p);
    const dead = sim.done && sim.endReason !== 'complete';
    if (dead) { S.craft.rotation.x += dt * 0.7; S.craft.rotation.z += dt * 0.4; }
    else { S.craft.lookAt(S.plane.localToWorld(new THREE.Vector3(0, 0, 0))); } // aletler (+Z) gezegene baksın
    // kamera: sürükleyince döner; kendiliğinden dönmez (gece tarafına kaymasın, gezegen zaten dönüyor)
    const fov = (V.camera.fov * Math.PI) / 180;
    const fit = S.extent / Math.sin(Math.atan(Math.tan(fov / 2) * Math.min(1, V.camera.aspect))) * 1.05;
    Craft3D.nav.placeCamera(V.camera, new THREE.Vector3(0, 0, 0), V.nav, fit);
    // veri akışı: aracın dünya konumundan Dünya yönüne; gezegen arada ise yok
    const wp = S.craft.getWorldPosition(new THREE.Vector3());
    const dir = S.earthDir;
    const bproj = wp.dot(dir), cc = wp.lengthSq() - 1;
    const occluded = !(S.jup) && bproj < 0 && bproj * bproj - cc > 0;
    const down = !sim.done && !occluded && sim.lastDF > 0 && sim.sc.body !== 'Earth';
    S.data.visible = down;
    if (down) {
      const arr = S.data.geometry.attributes.position.array, L = S.extent * 2.2;
      for (let i = 0; i < 8; i++) {
        const t = (((REDUCED_MOTION ? 0 : V.t * 0.35) + i / 8) % 1) * L;
        arr[i * 3] = wp.x + dir.x * t; arr[i * 3 + 1] = wp.y + dir.y * t; arr[i * 3 + 2] = wp.z + dir.z * t;
      }
      S.data.geometry.attributes.position.needsUpdate = true;
    }
    V.renderer.render(V.scene, V.camera);
    return true;
  }

  function hide3D(canvas) {
    if (!V) return;
    V.cv.hidden = true; if (V.bar) { V.bar.hidden = true; V.bar.parts.forEach((x) => { x.hidden = true; }); }
    const wrap = canvas.parentElement, lb = wrap && wrap.querySelector('.viz-3d-labels');
    if (lb) lb.hidden = true;
    delete canvas.dataset.cleared;
  }

  function phaseOf(sim) {
    return sim.phase === 'ended' ? (sim.endReason === 'launch' ? 'launch' : sim.opsMonth > 0 || sim.inserted ? 'ops' : 'cruise') : sim.phase;
  }

  window.drawFlight = function (canvas, sim, ui) {
    const ph = phaseOf(sim);
    if (!failed && ph !== 'launch' && ph !== 'cruise' && window.Craft3D && Craft3D.ready()) {
      try { if (render3D(canvas, sim, ui)) return; } catch (e) { console.error(e); failed = true; }
    }
    hide3D(canvas);
    draw2D(canvas, sim, ui);
  };
  // uçuşa başlamadan önce Three.js yüklemesini başlat
  if (window.Craft3D) Craft3D.ready();
})();
