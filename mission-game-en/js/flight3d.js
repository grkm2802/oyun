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
    // Three.js tuvale satır içi display:block yazar; gizleme (hidden) çalışsın diye kaldır (yoksa yolculukta fırlatmanın son karesi donup kalıyordu)
    cv.style.display = '';
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
      // Yörünge gezegene ORTALI çizilir (kullanıcı isteği 2026-11-14: Jüpiter'de uydu merkez etrafında dönmüyordu).
      // Basık yörüngeler (Jüpiter, Mars eliptik, NRHO) ortalı bir elips olur; kısa yarı eksen bile gezegen yüzeyi +
      // büyütülmüş uydu boyunun dışında kalır, yani uydu gezegenin içine girmez.
      const a0 = Math.max(1.05, ob.viz.a), e0 = ob.viz.e || 0;
      const ra = a0 * (1 + e0) * (e0 > 0 ? 0.75 : 1); // uzun yarı eksen (ortalı elipste biraz kısaltılır)
      const sizeEst = Math.max(0.26, Math.max(1.65, ra + 0.2, S.jup ? S.moonR + 0.4 : 0) * 0.1);
      const rMin = 1.08 + sizeEst; // uydunun yarıçapı = sizeEst
      S.a = Math.max(ra, rMin);
      const b = Math.max(rMin, S.a * Math.sqrt(1 - Math.min(0.6, e0) * Math.min(0.6, e0))), fc = 0, pts = [];
      S.e = 0;
      for (let i = 0; i <= 160; i++) { const E = (i / 160) * Math.PI * 2; pts.push(new THREE.Vector3(S.a * Math.cos(E), 0, b * Math.sin(E))); }
      S.plane.add(line(pts, 0xffffff, 0.32));
      S.b = b; S.fc = fc;
      S.extent = Math.max(1.65, S.a + 0.2, S.jup ? S.moonR + 0.4 : 0);
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
    // varış: 3B görünüm yolculuk çiziminin üstünde yavaşça belirir, kamera uzaktan yaklaşır (ani geçmesin)
    const nowMs = performance.now();
    if (V.mode !== 'orbit') { V.mode = 'orbit'; V.arriveAt = nowMs; fadeIn(1400); }
    // 2B canvas'ı boşalt (erişilebilirlik etiketi onda kalır) — belirme bitince, yoksa geçiş görünmez
    if (!canvas.dataset.cleared && nowMs - V.arriveAt > 1500) { const g = canvas.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height); canvas.dataset.cleared = '1'; }
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
    let fit = S.extent / Math.sin(Math.atan(Math.tan(fov / 2) * Math.min(1, V.camera.aspect))) * 1.05;
    // varış yaklaşması: ilk ~3 sn kamera uzaktan yavaşlayarak yaklaşır
    if (!REDUCED_MOTION) { const k = Math.min(1, (nowMs - V.arriveAt) / 3200), e = 1 - Math.pow(1 - k, 3); fit *= 1 + 2.4 * (1 - e); }
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
    V.renderer.toneMappingExposure = 1;
    V.renderer.render(V.scene, V.camera);
    return true;
  }

  /* ---------------- 3B fırlatma sahnesi ----------------
     ui.launchAnim 0→1 (ui.js): 0–0,1 ateşleme, sonra roket hızlanarak yükselir; ~0,5'te fırlatma sonucu belli olur.
     Arıza (sim.endReason === 'launch') 0,55'ten sonra patlama.
     Roketler NASA 3D Resources modelleri (mission-game/models): küçük roketler Explorer 1'i fırlatan Jupiter-C,
     büyükler Saturn V. Model yüklenene kadar (ya da yüklenemezse) kodla çizilen roket görünür.
     Alev ve duman parçacıklarla: alev = motordan hızla akan toplamalı (additive) parçacıklar + parlak çekirdek;
     duman = kalkışta alev kanalından iki yana yayılan, yavaşlayan ve büyüyen bulutlar + havada asılı kalan iz sütunu. */
  const ROCKETS = {
    rideshare: { h: 9, r: 0.42, boosters: 0, model: 'jupiter_c.glb' },
    small: { h: 8, r: 0.38, boosters: 0, model: 'jupiter_c.glb' },
    medium: { h: 12, r: 0.55, boosters: 0, model: 'saturn_v.glb' },
    heavy: { h: 14, r: 0.62, boosters: 0, model: 'saturn_v.glb' },
    superheavy: { h: 18, r: 0.8, boosters: 0, model: 'saturn_v.glb' },
  };
  const rnd = () => Math.random(); // sadece görsel efekt (simülasyonu etkilemez)

  // dokular (bir kez üretilir)
  let FX = null;
  function fxTextures() {
    if (FX) return FX;
    const mk = (draw, n = 128) => { const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n); const t = new THREE.CanvasTexture(c); return t; };
    // alev parçacığı: beyaz-sarı çekirdek, turuncu kenar
    const fire = mk((g, n) => { const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      gr.addColorStop(0, 'rgba(255,255,245,1)'); gr.addColorStop(0.2, 'rgba(255,236,170,0.95)'); gr.addColorStop(0.5, 'rgba(255,150,50,0.55)'); gr.addColorStop(1, 'rgba(255,80,10,0)');
      g.fillStyle = gr; g.fillRect(0, 0, n, n); });
    // duman bulutu: üst üste binmiş yumuşak lekeler (pürüzlü, kabarık görünüm)
    const smoke = mk((g, n) => {
      let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 26; i++) {
        const a = r() * Math.PI * 2, d = r() * n * 0.22, x = n / 2 + Math.cos(a) * d, y = n / 2 + Math.sin(a) * d, rad = n * (0.14 + r() * 0.2);
        const gr = g.createRadialGradient(x, y, 0, x, y, rad); const v = 200 + Math.floor(r() * 55);
        gr.addColorStop(0, `rgba(${v},${v},${v},0.55)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
      }
      // kenarları yumuşat
      g.globalCompositeOperation = 'destination-in';
      const m = g.createRadialGradient(n / 2, n / 2, n * 0.15, n / 2, n / 2, n / 2); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = m; g.fillRect(0, 0, n, n);
    });
    const glow = mk((g, n) => { const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.3, 'rgba(255,190,110,0.5)'); gr.addColorStop(1, 'rgba(255,140,60,0)');
      g.fillStyle = gr; g.fillRect(0, 0, n, n); }, 64);
    const sun = mk((g, n) => { const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      gr.addColorStop(0, 'rgba(255,255,250,1)'); gr.addColorStop(0.08, 'rgba(255,250,230,1)'); gr.addColorStop(0.25, 'rgba(255,230,180,0.35)'); gr.addColorStop(1, 'rgba(255,220,170,0)');
      g.fillStyle = gr; g.fillRect(0, 0, n, n); });
    FX = { fire, smoke, glow, sun };
    return FX;
  }

  // gökyüzü: ufukta açık, tepede koyu mavi; yükseldikçe ikisi de uzay siyahına döner
  function skyDome() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x1f4f9a) }, horizon: { value: new THREE.Color(0xbfd6ee) }, space: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 horizon; uniform float space; varying vec3 vP;' +
        'void main(){ float h = clamp(vP.y, -0.2, 1.0); float k = pow(clamp(h, 0.0, 1.0), 0.45);' +
        ' vec3 c = mix(horizon, top, k); vec3 sp = vec3(0.012,0.016,0.03); c = mix(c, sp, space * (0.6 + 0.4 * k));' +
        ' if (h < 0.0) c = mix(c, horizon * 0.6, -h * 2.0 * (1.0 - space)); gl_FragColor = vec4(c, 1.0); }',
    });
    return new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), mat);
  }

  // Gök: varsa Preetham atmosfer modeli (THREE.Sky, mission-game/vendor/Sky.js), yoksa basit gradyan kubbe.
  // update(t): t=0 yerde, t=1 uzayda (atmosfer incelir, gök kararır).
  function makeSky(sunDir) {
    if (THREE.Sky) {
      const mesh = new THREE.Sky(); mesh.scale.setScalar(20000); mesh.renderOrder = -1;
      // ACES ton eşleme göğü soluklaştırıyor: rengi biraz doygunlaştır
      mesh.material.fragmentShader = mesh.material.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );',
        'retColor = mix( vec3( dot( retColor, vec3( 0.299, 0.587, 0.114 ) ) ), retColor, 1.45 ); gl_FragColor = vec4( retColor, 1.0 );');
      const u = mesh.material.uniforms;
      u.turbidity.value = 1; u.rayleigh.value = 3; u.mieCoefficient.value = 0.0012; u.mieDirectionalG.value = 0.8;
      u.sunPosition.value.copy(sunDir);
      mesh.material.uniforms.uSpace = { value: 0 };
      mesh.material.fragmentShader = 'uniform float uSpace;\n' + mesh.material.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );', 'retColor *= ( 1.0 - 0.97 * uSpace ); gl_FragColor = vec4( retColor, 1.0 );');
      return { kind: 'preetham', mesh, update(t) { mesh.material.uniforms.uSpace.value = sstep(0.35, 1, t); u.rayleigh.value = 3 * Math.pow(1 - t, 1.6) + 0.015; u.turbidity.value = 1.4 * (1 - t) + 0.4; u.mieCoefficient.value = 0.002 * (1 - t) + 0.0004; } };
    }
    const mesh = skyDome(); mesh.renderOrder = -1;
    return { kind: 'dome', mesh, update(t) { mesh.material.uniforms.space.value = t; } };
  }

  // Yakın zemin dokusu: Florida kıyısı gibi — koyu bitki örtüsü, bataklık gölleri, kumsal, beton alan ve yollar.
  // Su olan yerler saydam (alphaTest) → altındaki parlak deniz görünür. Bir kez üretilir.
  let GROUND_TEX = null;
  function groundTexture() {
    if (GROUND_TEX) return GROUND_TEX;
    const N = 1024, SIZE = 3200; // doku pikseli ↔ dünya: x = -1600 + px·3,125 ; z = -1600 + py·3,125
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'), img = g.createImageData(N, N), D = img.data;
    const fbm = makeNoise(4242);
    const coastZ = (x) => -230 + (fbm(x * 0.004, 3.1, 0.7, 4) - 0.5) * 220 + Math.sin(x * 0.0021) * 60;
    for (let py = 0; py < N; py++) {
      const z = -SIZE / 2 + (py + 0.5) * SIZE / N;
      for (let px = 0; px < N; px++) {
        const x = -SIZE / 2 + (px + 0.5) * SIZE / N, i = (py * N + px) * 4;
        const cz = coastZ(x), dz = z - cz; // dz < 0 → deniz
        if (dz < 0) { D[i + 3] = 0; continue; }
        const n = fbm(x * 0.006, z * 0.006, 1.3, 4), m = fbm(x * 0.02 + 9, z * 0.02, 4.2, 3);
        // bitki örtüsü: koyu yeşil – zeytin – kahverengimsi lekeler
        let col = mix([30, 46, 24], [64, 76, 38], n);
        col = mix(col, [86, 82, 52], sstep(0.55, 0.75, m) * 0.6);
        // iç kesimde bataklık gölleri (koyu su)
        const lagoon = fbm(x * 0.0035 + 20, z * 0.0035, 7.7, 4);
        if (dz > 120 && lagoon > 0.62) col = mix(col, [22, 46, 52], sstep(0.62, 0.66, lagoon));
        // kumsal ve kıyı çizgisi
        if (dz < 14) col = mix([206, 196, 160], col, sstep(6, 14, dz));
        // rampa çevresi beton/çakıl alan
        const r = Math.hypot(x, z);
        if (r < 40) col = mix([112, 110, 102], col, sstep(30, 40, r));
        // yollar: rampadan sağa ve geriye (paletli taşıyıcı yolu)
        if ((Math.abs(z - 4) < 4 && x > 0 && x < 1500) || (Math.abs(x - 6) < 3 && z > 0 && z < 1500)) col = [128, 126, 118];
        D[i] = col[0]; D[i + 1] = col[1]; D[i + 2] = col[2]; D[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    GROUND_TEX = t;
    return t;
  }
  // deniz için dalga normal haritası (tekrarlanır)
  let WAVE_TEX = null;
  function waveTexture() {
    if (WAVE_TEX) return WAVE_TEX;
    const N = 128, c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'), img = g.createImageData(N, N), D = img.data;
    const hgt = (x, y) => Math.sin((x + y * 0.3) * 0.2) * 0.5 + Math.sin((x * 0.6 - y) * 0.33) * 0.3 + Math.sin((x * 1.7 + y * 1.3) * 0.18) * 0.2;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = hgt(x + 1, y) - hgt(x - 1, y), dy = hgt(x, y + 1) - hgt(x, y - 1);
      const nx = -dx, ny = -dy, nz = 1, l = Math.hypot(nx, ny, nz), i = (y * N + x) * 4;
      D[i] = (nx / l * 0.5 + 0.5) * 255; D[i + 1] = (ny / l * 0.5 + 0.5) * 255; D[i + 2] = (nz / l * 0.5 + 0.5) * 255; D[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    WAVE_TEX = new THREE.CanvasTexture(c);
    return WAVE_TEX;
  }

  // kodla çizilen yedek roket (model yüklenene kadar)
  function buildRocket(spec) {
    const g = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f3f5, roughness: 0.5, metalness: 0.1 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.6, metalness: 0.3 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x5a6069, roughness: 0.35, metalness: 0.85 });
    const { h, r } = spec;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h * 0.78, 32), white); body.position.y = h * 0.39; g.add(body);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.01, r * 1.01, h * 0.03, 32), dark); band.position.y = h * 0.55; g.add(band);
    const fair = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.02, h * 0.1, 32), white); fair.position.y = h * 0.83; g.add(fair);
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(r * 1.12 * Math.sqrt(1 - t * t), t * h * 0.14)); }
    const nose = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), white); nose.position.y = h * 0.88; g.add(nose);
    const bellPts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; bellPts.push(new THREE.Vector2(r * (0.25 + 0.45 * Math.pow(t, 0.7)), -t * r * 0.9)); }
    const bell = new THREE.Mesh(new THREE.LatheGeometry(bellPts, 20), metal); g.add(bell);
    return g;
  }
  // NASA modelini dik, tabanı y=0'da, yüksekliği spec.h olacak şekilde yerleştir
  function fitModel(m, spec) {
    const wrap = new THREE.Group(); wrap.add(m);
    let box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
    // en uzun eksen roketin boyu: Y'ye çevir
    if (size.x > size.y && size.x >= size.z) m.rotation.z = Math.PI / 2;
    else if (size.z > size.y && size.z > size.x) m.rotation.x = -Math.PI / 2;
    m.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(m); size = box.getSize(new THREE.Vector3());
    const k = spec.h / size.y; m.scale.multiplyScalar(k); m.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(m);
    const c = box.getCenter(new THREE.Vector3());
    m.position.x -= c.x; m.position.z -= c.z; m.position.y -= box.min.y;
    m.traverse((o) => { if (o.isMesh) o.userData.shared = true; }); // geometri önbellekteki modelle ortak: silme
    return wrap;
  }

  function buildLaunch(sim) {
    const spec = ROCKETS[sim.R.d.launcher] || ROCKETS.medium;
    const T = fxTextures();
    const scene = new THREE.Scene();
    // iki katman: uzak katman (gök, yıldızlar, NASA Dünya küresi; büyük kamera menzili) + yakın katman (rampa, roket, duman)
    const far = new THREE.Scene();
    scene.fog = new THREE.Fog(0xb8cde4, 300, 1700);
    far.fog = new THREE.Fog(0xb8cde4, 1200, 14000);
    const cam = new THREE.PerspectiveCamera(40, 1.6, 0.1, 5000);
    // güneş: solda, ufkun ~23° üstünde; roketi yandan-önden aydınlatır
    const sunDir = new THREE.Vector3(0.45, 0.78, 0.5).normalize(); // güneş kameranın sağ arkasında: önümüzde koyu mavi gök, roket önden aydınlık
    const sky = makeSky(sunDir); far.add(sky.mesh);
    const sunSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.sun, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    sunSp.scale.setScalar(900); far.add(sunSp);
    const sun = new THREE.DirectionalLight(0xfff0dc, 2.6); sun.position.copy(sunDir).multiplyScalar(100); scene.add(sun);
    const hemi = new THREE.HemisphereLight(0xbcd4f2, 0x2c3324, 0.55); scene.add(hemi);
    const farSun = new THREE.DirectionalLight(0xffffff, 2.2); farSun.position.copy(sunDir); far.add(farSun);
    far.add(new THREE.AmbientLight(0x6f86a8, 0.12));
    // yükseldikçe görünen Dünya: NASA Blue Marble dokulu dev küre, Florida rampanın altında
    const RE = 2600;
    const earthMat = new THREE.MeshStandardMaterial({ color: 0x223322, roughness: 0.9, metalness: 0 });
    const earthUse = (tx) => { earthMat.map = tx; earthMat.color.set(0xffffff); earthMat.needsUpdate = true; };
    const etx = Craft3D.nasaTex('Earth', earthUse); if (etx) earthUse(etx);
    const earth = new THREE.Mesh(new THREE.SphereGeometry(RE, 128, 64), earthMat);
    // doku eşlemesi (SphereGeometry): enlem 28,5° K, boylam 80,6° B noktası +Y'ye gelsin
    const lon = -80.6, lat = 28.5, eph = ((lon + 180) / 360) * Math.PI * 2, eth = ((90 - lat) / 180) * Math.PI;
    const fl = new THREE.Vector3(-Math.cos(eph) * Math.sin(eth), Math.cos(eth), Math.sin(eph) * Math.sin(eth));
    earth.quaternion.setFromUnitVectors(fl, new THREE.Vector3(0, 1, 0));
    // kıyı (doğusu Atlantik) kameranın karşısına, -Z yönüne dönsün
    earth.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * 0.5));
    earth.position.set(0, -RE - 2.5, 0); far.add(earth);
    // ince atmosfer: kürenin kenarında mavi parıltı (yükseklerde görünür)
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(RE * 1.025, 96, 48), new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { k: { value: 0 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float k; varying vec3 vN; varying vec3 vV; void main(){ float r = pow(clamp(1.0 + dot(vN, vV), 0.0, 1.0), 3.0); gl_FragColor = vec4(vec3(0.35,0.6,1.0) * r * 1.5 * k, 1.0); }',
    }));
    atmo.position.copy(earth.position); far.add(atmo);
    // alev ışığı: rampayı ve dumanı turuncuya boyar
    const fireLight = new THREE.PointLight(0xffa040, 0, 120, 1.6); scene.add(fireLight);
    // yakın zemin: kodla üretilen kıyı dokusu (bitki örtüsü, bataklık, kumsal, yollar); su kısmı saydam → altındaki deniz görünür
    const gtex = groundTexture();
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1600, 96), new THREE.MeshLambertMaterial({ map: gtex, alphaTest: 0.5 })); // yuvarlak: köşesi ufukta çizgi yapmasın
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const sea = new THREE.Mesh(new THREE.CircleGeometry(1600, 96), new THREE.MeshStandardMaterial({ color: 0x0e3352, roughness: 0.22, metalness: 0.35, normalMap: waveTexture(), normalScale: new THREE.Vector2(0.35, 0.35) }));
    sea.material.normalMap.wrapS = sea.material.normalMap.wrapT = THREE.RepeatWrapping; sea.material.normalMap.repeat.set(40, 40);
    sea.rotation.x = -Math.PI / 2; sea.position.y = -0.4; scene.add(sea);
    const concrete = new THREE.MeshStandardMaterial({ color: 0x55575a, roughness: 0.95 });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.8, 0.8, 48), concrete); pad.position.y = 0.4; scene.add(pad);
    const mound = new THREE.Mesh(new THREE.CylinderGeometry(12, 17, 2.2, 48), new THREE.MeshLambertMaterial({ color: 0x3b3830 })); mound.position.y = -0.7; scene.add(mound);
    const trench = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 22), new THREE.MeshStandardMaterial({ color: 0x2c2d30, roughness: 1 })); trench.position.set(0, 0.4, 0); scene.add(trench);
    // uzakta su kulesi ve birkaç bina (ölçek hissi)
    const bldg = new THREE.MeshLambertMaterial({ color: 0xb9b6ad });
    for (const [x, z, w, hh, d] of [[60, 40, 14, 8, 10], [75, 60, 8, 5, 8], [-70, 55, 10, 6, 14], [40, -60, 6, 22, 6]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), bldg); b.position.set(x, hh / 2, z); scene.add(b); }
    // kule: kafes direk + kollar
    const steel = new THREE.MeshStandardMaterial({ color: 0x8a3b2a, roughness: 0.7, metalness: 0.4 });
    const tower = new THREE.Group(), th = spec.h * 1.15, tw = 1.8;
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, th, 0.14), steel); p.position.set(x * tw / 2, th / 2, z * tw / 2); tower.add(p); }
    for (let y = 1; y < th; y += 1.1) {
      for (const [w, d, x, z] of [[tw, 0.07, 0, -tw / 2], [tw, 0.07, 0, tw / 2], [0.07, tw, -tw / 2, 0], [0.07, tw, tw / 2, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, d), steel); b.position.set(x, y, z); tower.add(b); }
      const dg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.4, 0.05), steel); dg.position.set(-tw / 2, y + 0.55, 0); dg.rotation.x = 0.9; tower.add(dg);
    }
    for (const yy of [spec.h * 0.45, spec.h * 0.8]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(spec.r + 2.4, 0.25, 0.6), steel); arm.position.set(-(spec.r + 2.4) / 2 + 0.2, yy, 0); tower.add(arm); }
    tower.position.set(spec.r + 3.2, 0.8, 0); scene.add(tower);
    // roket
    const rocket = new THREE.Group(); scene.add(rocket);
    const body = new THREE.Group(); rocket.add(body);
    body.add(buildRocket(spec));
    Craft3D.loadModel(spec.model, (m) => { if (V && V.L && V.L.rocket === rocket) { body.clear(); body.add(fitModel(m, spec)); } });
    // parlak alev çekirdeği (kısa) + parıltı
    const core = new THREE.Mesh(new THREE.ConeGeometry(spec.r * 0.55, spec.h * 0.22, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    core.rotation.x = Math.PI; core.position.y = -spec.h * 0.11; rocket.add(core);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    glow.scale.setScalar(spec.r * 5); glow.position.y = -spec.r * 0.8; rocket.add(glow);
    // parçacık havuzları
    const mkPool = (n, map, additive) => Array.from({ length: n }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, opacity: 0, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: !additive }));
      s.visible = false; s.userData = { life: 0, age: 0, v: new THREE.Vector3(), s0: 1, s1: 1, rot: 0, op: 1 }; scene.add(s); return s;
    });
    const fire = mkPool(420, T.fire, true);
    const smoke = mkPool(260, T.smoke, false);
    // yıldızlar (yükseldikçe görünür)
    const stars = Craft3D.nav.makeStars(1400, 1800, 11);
    stars.traverse((o) => { if (o.material) { o.material.transparent = true; o.material.opacity = 0; o.material.fog = false; } });
    far.add(stars);
    // atmosfer modeli henüz yüklenmediyse yükle; gelince gök değiştirilir (renderLaunch)
    if (!THREE.Sky) Craft3D.loadSky(() => {});
    // patlama (arıza): turuncu ateş topu + koyu duman
    const boom = new THREE.Group();
    const bf = [], bd = [];
    const dTex = T.smoke;
    for (let i = 0; i < 8; i++) { const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.fire, transparent: true, depthWrite: false, opacity: 0, fog: false })); f.userData.o = new THREE.Vector3(Math.cos(i * 2.4), Math.sin(i * 1.7) * 0.8, Math.sin(i * 2.4)).multiplyScalar(i ? 0.5 : 0); boom.add(f); bf.push(f); }
    for (let i = 0; i < 18; i++) { const d = new THREE.Sprite(new THREE.SpriteMaterial({ map: dTex, color: 0x6b645c, transparent: true, depthWrite: false, opacity: 0, fog: false })); d.userData.o = new THREE.Vector3(Math.cos(i * 1.9), Math.sin(i * 2.3) * 0.7 + 0.2, Math.sin(i * 1.9)); boom.add(d); bd.push(d); }
    boom.userData = { fire: bf, dsmoke: bd };
    scene.add(boom);
    return { ground, sea, earth, atmo, scene, far, cam, spec, rocket, core, glow, fire, smoke, fi: 0, si: 0, emitF: 0, emitS: 0, stars, sky, sunSp, sunDir, sun, hemi, fireLight, boom, sim, lastPos: null };
  }

  function emit(pool, idx, set) { const s = pool[idx % pool.length]; set(s, s.userData); s.visible = true; return idx + 1; }

  function renderLaunch(canvas, sim, ui) {
    const wrap = canvas.parentElement;
    if (!wrap) return false;
    if (!attachCanvas(wrap)) return false;
    // fırlatmada gezinme araçları ve yörünge etiketleri yok
    if (V.bar) { V.bar.hidden = true; V.bar.parts.forEach((x) => { x.hidden = true; }); }
    const lb = wrap.querySelector('.viz-3d-labels'); if (lb) lb.hidden = true;
    if (!V.L || V.L.sim !== sim) { if (V.L) { disposeScene(V.L.scene); disposeScene(V.L.far); } V.L = buildLaunch(sim); }
    if (V.mode !== 'launch') { V.mode = 'launch'; fadeIn(600); }
    if (!canvas.dataset.cleared) { const g = canvas.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height); canvas.dataset.cleared = '1'; }
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return true;
    const L = V.L, sp = L.spec;
    if (window.MA_DEBUG) window.MA_DEBUG.launch = L; // test için
    if (V.w !== w || V.h !== h) { V.w = w; V.h = h; V.renderer.setSize(w, h, false); }
    if (L.cam.aspect !== w / h) { L.cam.aspect = w / h; L.cam.updateProjectionMatrix(); }
    const p = ui.launchAnim || 0, now = performance.now() / 1000;
    const dt = ui.paused ? 0 : Math.min(0.05, ui.dt || 0.016);
    const failed = sim.endReason === 'launch' && p > 0.55;
    // arızada roket patladığı yerde kalır
    const lift = Math.max(0, (failed ? 0.55 : p) - 0.1) / 0.9;
    const alt = lift * lift * 900; // yükseklik (sahne birimi)
    // gök: yükseldikçe uzay siyahı, yıldızlar çıkar
    const t = Math.min(1, alt / 600);
    // atmosfer modeli yüklendiyse basit kubbeyi onunla değiştir
    if (L.sky.kind === 'dome' && THREE.Sky) { L.far.remove(L.sky.mesh); L.sky = makeSky(L.sunDir); L.far.add(L.sky.mesh); }
    L.sky.update(t);
    L.atmo.material.uniforms.k.value = sstep(0.55, 1, t);
    // yükseklerde yakın zemin (rampa çevresi) gizlenir; altta sadece NASA Dünya küresi kalır
    const lowAlt = alt < 200; L.ground.visible = lowAlt; L.sea.visible = lowAlt;
    // sis: yerde ufuk pusu, yükseldikçe incelir (Dünya küresi görünür hale gelir)
    // sis rengi ton eşlemeden geçer: Preetham'ın düşük pozlamasında ufuk göğüyle eşleşsin diye güçlendir
    const fogK = L.sky.kind === 'preetham' ? 2.5 : 1;
    const fogC = new THREE.Color(0.66 * fogK, 0.76 * fogK, 0.88 * fogK).lerp(new THREE.Color(0.02, 0.03, 0.06), t);
    L.scene.fog.color.copy(fogC); L.far.fog.color.copy(fogC);
    L.far.fog.near = 1200 + t * 20000; L.far.fog.far = 14000 + t * 90000;
    L.stars.traverse((o) => { if (o.material) o.material.opacity = Math.max(0, (t - 0.7) / 0.3); });
    // roket konumu ve yatışı (yörüngeye dönüş manevrası)
    const baseY = 0.8;
    L.rocket.position.set(alt * 0.05 * lift, baseY + alt, 0);
    L.rocket.rotation.z = -0.35 * lift * lift;
    L.rocket.visible = !failed;
    const firing = p > 0.01 && !failed;
    const ign = Math.min(1, p / 0.06);
    const fl = REDUCED_MOTION ? 1 : 1 + Math.sin(now * 47) * 0.08 + Math.sin(now * 29) * 0.06;
    L.core.visible = firing; L.glow.visible = firing;
    L.core.scale.set(1, ign * fl * (1 + lift * 0.8), 1);
    L.glow.material.opacity = 0.75 * ign; L.glow.scale.setScalar(sp.r * (4.5 + 1.2 * fl) * (1 + lift * 0.6));
    // alev ışığı
    L.fireLight.position.copy(L.rocket.position); L.fireLight.position.y -= sp.r;
    L.fireLight.intensity = firing ? 3.5 * ign * fl : 0;
    // nozul dünya konumu ve roketin aşağı yönü
    L.rocket.updateMatrixWorld();
    const nozzle = new THREE.Vector3(0, -sp.r * 0.6, 0).applyMatrix4(L.rocket.matrixWorld);
    const down = new THREE.Vector3(0, -1, 0).applyQuaternion(L.rocket.quaternion);
    const rv = L.lastPos ? L.rocket.position.clone().sub(L.lastPos).divideScalar(Math.max(dt, 1e-3)) : new THREE.Vector3();
    if (dt > 0) L.lastPos = L.rocket.position.clone();
    // --- alev parçacıkları: motordan aşağı hızla akar, kısa ömürlü
    if (firing && dt > 0) {
      L.emitF += dt * (REDUCED_MOTION ? 120 : 900);
      while (L.emitF >= 1) {
        L.emitF -= 1;
        L.fi = emit(L.fire, L.fi, (s, u) => {
          const sprd = 0.18;
          u.v.copy(down).multiplyScalar(sp.h * (1.6 + rnd() * 1.0)).add(new THREE.Vector3((rnd() - 0.5) * sp.h * sprd, (rnd() - 0.5) * sp.h * sprd * 0.3, (rnd() - 0.5) * sp.h * sprd)).addScaledVector(rv, 0.85);
          u.age = 0; u.life = 0.18 + rnd() * 0.22; u.s0 = sp.r * (1.4 + rnd() * 0.5); u.s1 = sp.r * (2.4 + rnd() * 1.6) * (1 + lift * 1.2);
          s.position.copy(nozzle).addScaledVector(down, rnd() * sp.r);
          s.material.rotation = rnd() * 6.28;
        });
      }
    }
    for (const s of L.fire) {
      const u = s.userData; if (!s.visible) continue;
      u.age += dt; const a = u.age / u.life;
      if (a >= 1) { s.visible = false; continue; }
      s.position.addScaledVector(u.v, dt);
      s.scale.setScalar(u.s0 + (u.s1 - u.s0) * a);
      // beyaz-sarı → turuncu → kırmızımsı, sönerek
      s.material.color.setRGB(1, 0.95 - a * 0.45, 0.8 - a * 0.7);
      s.material.opacity = Math.pow(1 - a, 1.4) * 0.42 * ign;
    }
    // --- duman: yerdeyken kanaldan iki yana fışkırır; havada iz bırakır
    const nearGround = alt < sp.h * 3;
    if (firing && dt > 0) {
      L.emitS += dt * (nearGround ? (REDUCED_MOTION ? 15 : 70) : (REDUCED_MOTION ? 6 : 26));
      while (L.emitS >= 1) {
        L.emitS -= 1;
        L.si = emit(L.smoke, L.si, (s, u) => {
          if (nearGround) {
            const side = rnd() < 0.5 ? -1 : 1, spd = sp.h * (2.2 + rnd() * 2.2) * Math.min(1, ign + 0.3);
            u.v.set((rnd() - 0.5) * spd * 0.35, rnd() * sp.h * 0.5, side * spd);
            s.position.set(L.rocket.position.x + (rnd() - 0.5) * 2, 1.2 + rnd(), side * (2 + rnd() * 3));
            u.life = 4 + rnd() * 3; u.s0 = sp.r * 4; u.s1 = sp.h * (1.2 + rnd() * 0.9); u.drag = 0.55;
          } else {
            u.v.copy(rv).multiplyScalar(0.05).add(new THREE.Vector3((rnd() - 0.5) * 2, (rnd() - 0.5) * 2, (rnd() - 0.5) * 2));
            s.position.copy(nozzle).addScaledVector(down, sp.h * (0.35 + rnd() * 0.25)).add(new THREE.Vector3((rnd() - 0.5) * sp.r, 0, (rnd() - 0.5) * sp.r));
            u.life = 5 + rnd() * 3; u.s0 = sp.r * 3; u.s1 = sp.h * (0.8 + rnd() * 0.6) * (1 + lift * 2); u.drag = 0.2;
          }
          u.age = 0; u.op = 0.55 + rnd() * 0.3; s.material.rotation = rnd() * 6.28; u.rot = (rnd() - 0.5) * 0.3;
        });
      }
    }
    for (const s of L.smoke) {
      const u = s.userData; if (!s.visible) continue;
      u.age += dt; const a = u.age / u.life;
      if (a >= 1) { s.visible = false; continue; }
      u.v.multiplyScalar(Math.max(0, 1 - u.drag * dt * 2));
      u.v.y += dt * 0.6; // sıcak duman hafifçe yükselir
      s.position.addScaledVector(u.v, dt);
      if (s.position.y < 0.8) s.position.y = 0.8;
      s.scale.setScalar(u.s0 + (u.s1 - u.s0) * Math.sqrt(a));
      s.material.rotation += u.rot * dt;
      // doğarken alevden turuncumsu, sonra güneşte beyaz-gri
      const warm = Math.max(0, 1 - a * 6);
      const shade = 0.82 + 0.18 * (1 - a);
      s.material.color.setRGB(shade, shade * (1 - warm * 0.25), shade * (1 - warm * 0.5));
      s.material.opacity = u.op * Math.min(1, a * 8) * (1 - a) * (1 - t * 0.6);
    }
    // arıza: patlama
    const B = L.boom.userData;
    if (failed) {
      const k = Math.min(1, (p - 0.55) * 2.2);
      L.boom.position.copy(L.rocket.position); L.boom.position.y += sp.h * 0.4;
      B.fire.forEach((f, i) => { const r = sp.h * (0.45 + k * 1.4) * (i ? 0.75 : 1); f.position.copy(f.userData.o).multiplyScalar(sp.h * 0.5 * k); f.scale.setScalar(r); f.material.opacity = Math.max(0, 1 - k * 1.3); });
      B.dsmoke.forEach((d, i) => { d.position.copy(d.userData.o).multiplyScalar(sp.h * (0.3 + 1.1 * k)); d.scale.setScalar(sp.h * (0.6 + 1.6 * k) * (0.7 + (i % 3) * 0.2)); d.material.rotation = i * 1.3 + k; d.material.opacity = Math.min(0.55, k * 1.6) * (1 - Math.max(0, k - 0.75) * 2); });
    } else { B.fire.forEach((f) => { f.material.opacity = 0; }); B.dsmoke.forEach((d) => { d.material.opacity = 0; }); }
    // kamera: rampaya yakın, hafif aşağıdan; roketi izler, yükseldikçe geri çekilir
    const focus = new THREE.Vector3(L.rocket.position.x, L.rocket.position.y + sp.h * 0.42, 0);
    const back = sp.h * 2.6 + alt * 0.09;
    // yükseldikçe kamera roketin üstüne çıkar ve aşağı bakar: altta Dünya ve ufkun eğrisi görünür
    const up = sstep(120, 650, alt);
    L.cam.position.set(focus.x + back * 0.62, Math.max(1.6, focus.y + (-sp.h * 0.3 - alt * 0.04) * (1 - up) + back * 0.6 * up), focus.z + back);
    L.cam.lookAt(focus);
    // gök kubbesi, güneş ve yıldızlar kamerayla gider (sonsuz uzakta gibi)
    L.sky.mesh.position.copy(L.cam.position); L.stars.position.copy(L.cam.position);
    L.sunSp.position.copy(L.cam.position).addScaledVector(L.sunDir, 15000);
    const R = V.renderer, pre = L.sky.kind === 'preetham';
    // Preetham göğü düşük pozlama ister; ışıkları buna göre güçlendir
    R.toneMappingExposure = pre ? 0.34 : 1;
    L.sun.intensity = pre ? 6.8 : 2.6; L.hemi.intensity = pre ? 1.5 : 0.55;
    R.autoClear = false; R.clear();
    L.cam.near = 40; L.cam.far = 220000; L.cam.updateProjectionMatrix();
    R.render(L.far, L.cam);
    R.clearDepth();
    L.cam.near = 0.1; L.cam.far = 5000; L.cam.updateProjectionMatrix();
    R.render(L.scene, L.cam);
    R.autoClear = true;
    return true;
  }
  function disposeScene(sc) { sc.traverse((o) => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); }); }


  // 3B görünümü yumuşakça aç / kapat (CSS opaklık geçişi); hareketleri azalt açıksa anında
  function fadeIn(ms) {
    if (V.hideTimer) { clearTimeout(V.hideTimer); V.hideTimer = 0; }
    V.cv.hidden = false;
    if (REDUCED_MOTION) { V.cv.style.transition = ''; V.cv.style.opacity = ''; return; }
    V.cv.style.transition = 'none'; V.cv.style.opacity = '0';
    void V.cv.offsetWidth; // başlangıç opaklığını uygula
    V.cv.style.transition = 'opacity ' + ms + 'ms ease'; V.cv.style.opacity = '1';
  }

  function hide3D(canvas) {
    if (!V) return;
    // fırlatma/yörüngeden 2B'ye geçerken 3B görünüm yavaşça kaybolur; altındaki 2B çizim ortaya çıkar
    if (V.mode !== '2d') {
      V.mode = '2d';
      if (REDUCED_MOTION || V.cv.hidden) V.cv.hidden = true;
      else {
        V.cv.style.transition = 'opacity 1100ms ease'; V.cv.style.opacity = '0';
        V.hideTimer = setTimeout(() => { if (V.mode === '2d') { V.cv.hidden = true; } V.hideTimer = 0; }, 1150);
      }
    }
    if (V.bar) { V.bar.hidden = true; V.bar.parts.forEach((x) => { x.hidden = true; }); }
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
