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
      // Uydu gezegenin içine girmesin: yörüngenin en yakın noktası (a·(1−e)) gezegen yüzeyi + büyütülmüş uydu
      // boyunun dışında kalmalı. En uzak nokta korunur; basık elipslerde (Jüpiter, Mars eliptik, NRHO) en yakın nokta dışarı çekilir.
      const ra = S.a * (1 + S.e);
      const sizeEst = Math.max(0.26, Math.max(1.65, ra + 0.2, S.jup ? S.moonR + 0.4 : 0) * 0.1);
      const rpMin = 1.08 + sizeEst; // uydunun yarıçapı = sizeEst
      if (S.a * (1 - S.e) < rpMin) {
        if (S.e > 0 && ra > rpMin) { S.a = (ra + rpMin) / 2; S.e = (ra - rpMin) / (ra + rpMin); }
        else { S.a = rpMin; S.e = 0; }
      }
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

  // 3B tuvali uçuş görünümünün kabına yerleştir (ekran yeniden çizilince yeni kaba taşınır)
  function attachCanvas(wrap) {
    if (!V) V = createView();
    if (V.cv.parentElement !== wrap) {
      wrap.appendChild(V.cv); V.key = null; V.wrap = wrap;
      V.bar = Craft3D.nav.toolbar(wrap, () => V.wrap, V.nav, () => {}, 'viz-tools');
    }
    V.cv.hidden = false;
    return true;
  }

  function render3D(canvas, sim, ui) {
    const wrap = canvas.parentElement;
    if (!wrap) return false;
    attachCanvas(wrap);
    if (V.bar && V.bar.hidden) { V.bar.hidden = false; V.bar.sync(); }
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
    V.camera.aspect = w / h; V.camera.updateProjectionMatrix();
    V.renderer.render(V.scene, V.camera);
    return true;
  }

  /* ---------------- 3B fırlatma sahnesi ----------------
     ui.launchAnim 0→1 (ui.js): 0–0,1 ateşleme, sonra roket hızlanarak yükselir; ~0,5'te fırlatma sonucu belli olur.
     Arıza (sim.endReason === 'launch') 0,55'ten sonra patlama. Roketin boyu ve yan roketleri seçilen rokete göre. */
  const ROCKETS = {
    rideshare: { h: 9, r: 0.42, boosters: 0 },
    small: { h: 8, r: 0.38, boosters: 0 },
    medium: { h: 12, r: 0.55, boosters: 0 },
    heavy: { h: 14, r: 0.6, boosters: 2 },
    superheavy: { h: 19, r: 0.85, boosters: 2 },
  };
  function softTex(inner, outer) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, inner); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  function buildRocket(spec) {
    const g = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f3f5, roughness: 0.5, metalness: 0.1 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.6, metalness: 0.3 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x5a6069, roughness: 0.35, metalness: 0.85 });
    const { h, r } = spec;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h * 0.78, 32), white); body.position.y = h * 0.39; g.add(body);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.01, r * 1.01, h * 0.03, 32), dark); band.position.y = h * 0.55; g.add(band);
    // faydalı yük kaplaması (fairing) + burun
    const fair = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.02, h * 0.1, 32), white); fair.position.y = h * 0.83; g.add(fair);
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(r * 1.12 * Math.sqrt(1 - t * t), t * h * 0.14)); }
    const nose = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), white); nose.position.y = h * 0.88; g.add(nose);
    // motor ağızları
    const bellPts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; bellPts.push(new THREE.Vector2(r * (0.25 + 0.45 * Math.pow(t, 0.7)), -t * r * 0.9)); }
    const bellGeo = new THREE.LatheGeometry(bellPts, 20);
    const nb = spec.r > 0.5 ? 3 : 1;
    for (let i = 0; i < nb; i++) { const b = new THREE.Mesh(bellGeo, metal); const a = (i / nb) * Math.PI * 2; if (nb > 1) b.position.set(Math.cos(a) * r * 0.45, 0, Math.sin(a) * r * 0.45); b.scale.setScalar(nb > 1 ? 0.6 : 1); g.add(b); }
    // kanatçıklar
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.04, h * 0.08, r * 0.7), dark); const a = (i / 4) * Math.PI * 2 + Math.PI / 4; f.position.set(Math.cos(a) * r * 1.15, h * 0.05, Math.sin(a) * r * 1.15); f.rotation.y = -a; g.add(f); }
    // yan roketler
    const boosters = [];
    for (let i = 0; i < spec.boosters; i++) {
      const side = i === 0 ? -1 : 1, bg = new THREE.Group(), br = r * 0.75, bh = h * 0.62;
      const bb = new THREE.Mesh(new THREE.CylinderGeometry(br, br, bh, 24), white); bb.position.y = bh / 2; bg.add(bb);
      const bn = new THREE.Mesh(new THREE.ConeGeometry(br, br * 2, 24), white); bn.position.y = bh + br; bg.add(bn);
      const bm = new THREE.Mesh(bellGeo, metal); bm.scale.setScalar(0.8); bg.add(bm);
      bg.position.x = side * (r + br + 0.05); g.add(bg); boosters.push(bg);
    }
    return { g, boosters };
  }
  function makeFlame(len, rad) {
    const f = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.ConeGeometry(rad, len, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    outer.rotation.x = Math.PI; outer.position.y = -len / 2; f.add(outer);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.55, len * 0.55, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3d0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    inner.rotation.x = Math.PI; inner.position.y = -len * 0.275; f.add(inner);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex('rgba(255,210,140,1)', 'rgba(255,140,40,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.scale.setScalar(rad * 6); glow.position.y = -rad * 0.6; f.add(glow);
    return f;
  }

  function buildLaunch(sim) {
    const spec = ROCKETS[sim.R.d.launcher] || ROCKETS.medium;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x4a78bf);
    scene.fog = new THREE.Fog(0x7f9cc4, 700, 3000);
    const cam = new THREE.PerspectiveCamera(42, 1.6, 0.1, 3000);
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.4); sun.position.set(-40, 60, 30); scene.add(sun);
    const hemi = new THREE.HemisphereLight(0xb8d4ff, 0x3a4a30, 0.6); scene.add(hemi);
    // zemin: kıyı otu + beton rampa + alev kanalı
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshLambertMaterial({ color: 0x1c2b13 }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 1400), new THREE.MeshStandardMaterial({ color: 0x123150, roughness: 0.35, metalness: 0.2 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.02, -900); scene.add(sea);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.6, 0.6, 48), new THREE.MeshStandardMaterial({ color: 0x7d8086, roughness: 0.95 }));
    pad.position.y = 0.3; scene.add(pad);
    const trench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.65, 10), new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 1 }));
    trench.position.set(0, 0.31, 5.5); scene.add(trench);
    // kule: kafes direk + kollar
    const steel = new THREE.MeshStandardMaterial({ color: 0x6c3a2e, roughness: 0.7, metalness: 0.4 });
    const tower = new THREE.Group(), th = spec.h * 1.15, tw = 1.6;
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, th, 0.14), steel); p.position.set(x * tw / 2, th / 2, z * tw / 2); tower.add(p); }
    for (let y = 1; y < th; y += 1.2) {
      for (const [w, d, x, z] of [[tw, 0.08, 0, -tw / 2], [tw, 0.08, 0, tw / 2], [0.08, tw, -tw / 2, 0], [0.08, tw, tw / 2, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), steel); b.position.set(x, y, z); tower.add(b); }
    }
    for (const yy of [spec.h * 0.45, spec.h * 0.8]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(spec.r + 2.2, 0.25, 0.5), steel); arm.position.set(-(spec.r + 2.2) / 2 + 0.2, yy, 0); tower.add(arm); }
    tower.position.set(spec.r + 2.6 + (spec.boosters ? spec.r * 1.6 : 0), 0.6, 0); scene.add(tower);
    // roket
    const { g: rocket, boosters } = buildRocket(spec);
    rocket.position.y = 0.6 + spec.r * 0.9; scene.add(rocket);
    const flames = [makeFlame(spec.h * 0.5, spec.r * 0.9)];
    rocket.add(flames[0]);
    boosters.forEach((b) => { const f = makeFlame(spec.h * 0.35, spec.r * 0.6); b.add(f); flames.push(f); });
    // yıldızlar (yükseldikçe görünür)
    const stars = Craft3D.nav.makeStars(1200, 1500, 11);
    stars.traverse((o) => { if (o.material) { o.material.transparent = true; o.material.opacity = 0; o.material.fog = false; } });
    scene.add(stars);
    // duman bulutları
    const smokeTex = softTex('rgba(235,235,235,0.9)', 'rgba(200,200,200,0)');
    const smoke = [];
    for (let i = 0; i < 70; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
      s.userData = { born: -1 }; scene.add(s); smoke.push(s);
    }
    // patlama
    // patlama: turuncu ateş topu + koyu duman (normal karışım; toplamalı karışım gökyüzünde soluk görünüyordu)
    const fireTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,248,220,1)'); gr.addColorStop(0.25, 'rgba(255,196,80,1)'); gr.addColorStop(0.55, 'rgba(238,96,24,0.9)'); gr.addColorStop(1, 'rgba(120,30,10,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    const boom = new THREE.Group();
    const fire = []; const dsmoke = [];
    for (let i = 0; i < 7; i++) { const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, transparent: true, depthWrite: false, opacity: 0, fog: false })); f.userData.o = new THREE.Vector3(Math.cos(i * 2.4), Math.sin(i * 1.7) * 0.8, Math.sin(i * 2.4)).multiplyScalar(i ? 0.5 : 0); boom.add(f); fire.push(f); }
    const dTex = softTex('rgba(28,26,25,0.95)', 'rgba(20,20,20,0)');
    for (let i = 0; i < 9; i++) { const d = new THREE.Sprite(new THREE.SpriteMaterial({ map: dTex, transparent: true, depthWrite: false, opacity: 0, fog: false })); d.userData.o = new THREE.Vector3(Math.cos(i * 1.9), Math.sin(i * 2.3) * 0.7 + 0.2, Math.sin(i * 1.9)); boom.add(d); dsmoke.push(d); }
    boom.userData = { fire, dsmoke };
    scene.add(boom);
    return { scene, cam, spec, rocket, flames, stars, smoke, boom, sky0: new THREE.Color(0x4a78bf), sky1: new THREE.Color(0x03050a), fog0: new THREE.Color(0x7f9cc4), si: 0, lastP: 0, sim };
  }

  function renderLaunch(canvas, sim, ui) {
    const wrap = canvas.parentElement;
    if (!wrap) return false;
    if (!attachCanvas(wrap)) return false;
    // fırlatmada gezinme araçları ve yörünge etiketleri yok
    if (V.bar) { V.bar.hidden = true; V.bar.parts.forEach((x) => { x.hidden = true; }); }
    const lb = wrap.querySelector('.viz-3d-labels'); if (lb) lb.hidden = true;
    if (!V.L || V.L.sim !== sim) { if (V.L) disposeScene(V.L.scene); V.L = buildLaunch(sim); }
    if (!canvas.dataset.cleared) { const g = canvas.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height); canvas.dataset.cleared = '1'; }
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return true;
    const L = V.L, sp = L.spec;
    if (V.w !== w || V.h !== h) { V.w = w; V.h = h; V.renderer.setSize(w, h, false); }
    if (L.cam.aspect !== w / h) { L.cam.aspect = w / h; L.cam.updateProjectionMatrix(); }
    const p = ui.launchAnim || 0, now = performance.now() / 1000;
    const failed = sim.endReason === 'launch' && p > 0.55;
    // arızada roket patladığı yerde kalır (patlama yükselmeye devam etmesin)
    const lift = Math.max(0, (failed ? 0.55 : p) - 0.1) / 0.9;
    const alt = lift * lift * 900; // yükseklik (sahne birimi)
    // gökyüzü yükseldikçe kararır, yıldızlar çıkar
    const t = Math.min(1, alt / 500);
    L.scene.background.copy(L.sky0).lerp(L.sky1, t);
    L.scene.fog.color.copy(L.fog0).lerp(L.sky1, t);
    L.stars.traverse((o) => { if (o.material) o.material.opacity = Math.max(0, (t - 0.35) / 0.65); });
    // roket: hafif yatış (yörüngeye dönüş manevrası)
    const baseY = 0.6 + sp.r * 0.9;
    L.rocket.position.set(alt * 0.05 * lift, baseY + alt, 0);
    L.rocket.rotation.z = -0.35 * lift * lift;
    L.rocket.visible = !failed;
    // alev: ateşlemeyle büyür, titrer
    const ign = Math.min(1, p / 0.08), fl = REDUCED_MOTION ? 1 : 1 + Math.sin(now * 40) * 0.06 + Math.sin(now * 23) * 0.05;
    L.flames.forEach((f) => { f.visible = p > 0.01 && !failed; f.scale.set(1, (0.3 + 0.7 * ign) * fl * (1 + lift * 0.6), 1); });
    // duman: kalkışta rampadan yayılır, sonra roketin arkasında iz
    if (!REDUCED_MOTION && p > 0.02 && !failed && p > L.lastP) {
      const n = alt < 40 ? 3 : 1;
      for (let k = 0; k < n; k++) {
        const s = L.smoke[L.si++ % L.smoke.length];
        const ground = alt < 25;
        s.userData = { born: now, life: ground ? 3.5 : 2.2, vx: (Math.random() - 0.5) * (ground ? 14 : 2), vy: ground ? Math.random() * 2 : -3, vz: (Math.random() - 0.5) * (ground ? 14 : 2), s0: sp.r * (ground ? 4 : 3), grow: ground ? 14 : 5 };
        s.position.set(L.rocket.position.x + (Math.random() - 0.5) * sp.r, ground ? 1.2 : L.rocket.position.y - sp.h * 0.1, (Math.random() - 0.5) * sp.r);
      }
    }
    L.smoke.forEach((s) => {
      const u = s.userData; if (u.born < 0) return;
      const a = (now - u.born) / u.life;
      if (a >= 1) { u.born = -1; s.material.opacity = 0; return; }
      const dt = ui.paused ? 0 : (ui.dt || 0.016);
      s.position.x += u.vx * dt; s.position.y += u.vy * dt; s.position.z += u.vz * dt;
      s.scale.setScalar(u.s0 + u.grow * a * sp.r * 3);
      s.material.opacity = 0.75 * (1 - a);
    });
    L.lastP = p;
    // arıza: patlama
    const B = L.boom.userData;
    if (failed) {
      const k = Math.min(1, (p - 0.55) * 2.2);
      L.boom.position.copy(L.rocket.position); L.boom.position.y += sp.h * 0.4;
      // ateş hızla büyüyüp söner, duman yavaşça büyüyüp kalır
      B.fire.forEach((f, i) => { const r = sp.h * (0.45 + k * 1.4) * (i ? 0.75 : 1); f.position.copy(f.userData.o).multiplyScalar(sp.h * 0.5 * k); f.scale.setScalar(r); f.material.opacity = Math.max(0, 1 - k * 1.3); });
      B.dsmoke.forEach((d) => { d.position.copy(d.userData.o).multiplyScalar(sp.h * (0.3 + 0.9 * k)); d.scale.setScalar(sp.h * (0.4 + 1.3 * k)); d.material.opacity = Math.min(0.85, k * 2) * (1 - Math.max(0, k - 0.7)); });
    } else { B.fire.forEach((f) => { f.material.opacity = 0; }); B.dsmoke.forEach((d) => { d.material.opacity = 0; }); }
    // kamera: rampaya yakın başlar, roketi izler; yükseldikçe geri çekilir
    const focus = new THREE.Vector3(L.rocket.position.x, L.rocket.position.y + sp.h * 0.45, 0);
    const back = sp.h * 2.4 + alt * 0.08;
    L.cam.position.set(focus.x + back * 0.55, Math.max(2, focus.y - sp.h * 0.25 - alt * 0.04), focus.z + back);
    L.cam.lookAt(focus);
    V.renderer.render(L.scene, L.cam);
    return true;
  }
  function disposeScene(sc) { sc.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); }); }


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
    if (!failed && ph !== 'cruise' && window.Craft3D && Craft3D.ready()) {
      try { if (ph === 'launch' ? renderLaunch(canvas, sim, ui) : render3D(canvas, sim, ui)) return; } catch (e) { console.error(e); failed = true; }
    }
    hide3D(canvas);
    draw2D(canvas, sim, ui);
  };
  // uçuşa başlamadan önce Three.js yüklemesini başlat
  if (window.Craft3D) Craft3D.ready();
})();
