'use strict';
const REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
/* =========================================================================
   Görseller: uzay aracı çizimi (SVG), gerçekçi gezegenler ve uçuş ekranı (canvas)
   ========================================================================= */
const VIZ_TXT = { sun: 'Güneş', earthDir: 'Dünya bu yönde ↗', sunlight: '← Güneş ışığı', craftLabel: 'Uzay aracı önizlemesi' };

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function drawStarfield() { /* sade tasarımda sayfa arka planında yıldız yok */ }

/* ---------------- 3B değer gürültüsü (gezegen dokuları için) ---------------- */
function makeNoise(seed) {
  const r = seeded(seed), P = new Uint8Array(512), V = new Float32Array(256);
  for (let i = 0; i < 256; i++) { P[i] = i; V[i] = r(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [P[i], P[j]] = [P[j], P[i]]; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const h = (x, y, z) => V[P[P[P[x & 255] + (y & 255)] + (z & 255)]];
  const f = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const n3 = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = f(x - xi), yf = f(y - yi), zf = f(z - zi);
    return lerp(
      lerp(lerp(h(xi, yi, zi), h(xi + 1, yi, zi), xf), lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), xf), yf),
      lerp(lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), xf), lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), xf), yf), zf);
  };
  return (x, y, z, oct = 5) => { let a = 0, amp = 0.5, fr = 1, norm = 0; for (let o = 0; o < oct; o++) { a += amp * n3(x * fr, y * fr, z * fr); norm += amp; amp *= 0.5; fr *= 2.03; } return a / norm; };
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* Bir gezegenin aydınlatılmış küre görüntüsü. Işık sol-üstten gelir. */
const TEX = {};
function bodyTexture(body, size = 256) {
  const key = body + size;
  if (TEX[key]) return TEX[key];
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size), D = img.data;
  const fbm = makeNoise(body.length * 977 + body.charCodeAt(0));
  const R = size / 2 - 1;
  const L = (() => { const v = [-0.75, -0.35, 0.56], m = Math.hypot(...v); return v.map((x) => x / m); })();
  const craters = [];
  if (body === 'Moon') { const r = seeded(11); for (let i = 0; i < 40; i++) { const th = r() * 6.283, z = r() * 2 - 1, s = Math.sqrt(1 - z * z); craters.push([s * Math.cos(th), z, s * Math.sin(th), 0.03 + r() * r() * 0.16]); } }
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px - size / 2 + 0.5) / R, y = (py - size / 2 + 0.5) / R;
      const rr = x * x + y * y;
      const i = (py * size + px) * 4;
      if (rr > 1) { D[i + 3] = 0; continue; }
      const z = Math.sqrt(1 - rr);
      let col;
      if (body === 'Earth') {
        const h = fbm(x * 1.6 + 3, y * 1.6, z * 1.6, 6);
        const land = h > 0.53;
        const lat = Math.abs(y);
        if (lat > 0.88) col = [236, 240, 245];
        else if (land) { const d = fbm(x * 4, y * 4 + 7, z * 4, 4); col = mix([62, 112, 52], [158, 132, 84], sstep(0.4, 0.62, d) * (1 - lat * 0.3)); }
        else col = mix([14, 48, 112], [26, 82, 150], sstep(0.35, 0.53, h));
        const cl = fbm(x * 3 + 11, y * 5, z * 3, 5);
        col = mix(col, [245, 247, 250], sstep(0.52, 0.7, cl) * 0.85);
      } else if (body === 'Moon') {
        const h = fbm(x * 2.2, y * 2.2, z * 2.2, 5);
        const mare = sstep(0.5, 0.6, fbm(x * 0.9 + 5, y * 0.9, z * 0.9, 3));
        col = mix([170, 170, 168], [104, 104, 104], mare * 0.8);
        col = mix(col, [190, 190, 186], (h - 0.5) * 0.9 + 0.2);
        for (const [cx, cy, cz, cr] of craters) {
          const d = Math.hypot(x - cx, y - cy, z - cz);
          if (d < cr * 1.25) { const k = d / cr; col = k < 1 ? mix(col, [118, 118, 116], 0.35 * (1 - k)) : mix(col, [205, 205, 200], 0.4 * (1.25 - k) * 4); }
        }
      } else if (body === 'Mars') {
        const h = fbm(x * 2, y * 2, z * 2, 6);
        const dark = sstep(0.5, 0.62, fbm(x * 1.2 + 9, y * 1.2, z * 1.2, 4));
        col = mix([196, 102, 58], [222, 140, 90], h);
        col = mix(col, [110, 58, 38], dark * 0.65);
        if (y < -0.86) col = mix(col, [240, 236, 230], sstep(-0.86, -0.92, y));
      } else if (body === 'Europa') {
        const b = fbm(x * 2, y * 2, z * 2, 4);
        col = mix([214, 200, 172], [236, 228, 212], b);
        const ridge = 1 - Math.abs(2 * fbm(x * 3.5 + 2, y * 3.5, z * 3.5, 5) - 1);
        const ridge2 = 1 - Math.abs(2 * fbm(x * 6 + 8, y * 6, z * 6, 4) - 1);
        col = mix(col, [150, 98, 64], Math.pow(ridge, 14) * 0.85 + Math.pow(ridge2, 18) * 0.5);
      } else { // Jupiter
        const w = fbm(x * 3, y * 3, z * 3, 5);
        const band = Math.sin((y + (w - 0.5) * 0.25) * 22);
        col = mix([214, 186, 150], [240, 226, 204], band * 0.5 + 0.5);
        col = mix(col, [158, 112, 80], sstep(0.6, 0.95, -band) * 0.6 * (1 - Math.abs(y)));
        const sx = (x + 0.25) / 0.2, sy = (y - 0.32) / 0.11;
        if (sx * sx + sy * sy < 1) col = mix(col, [190, 92, 62], 0.75 * (1 - (sx * sx + sy * sy)));
      }
      // aydınlatma: yumuşak gece-gündüz sınırı + kenar kararması
      const ndl = x * L[0] + y * L[1] + z * L[2];
      const light = 0.03 + 0.97 * sstep(-0.12, 0.35, ndl) * (0.55 + 0.45 * Math.max(0, ndl));
      const limb = 0.75 + 0.25 * z;
      let r = col[0] * light * limb, gg = col[1] * light * limb, b = col[2] * light * limb;
      if (body === 'Earth' || body === 'Mars') { // ince atmosfer kenarı
        const rim = Math.pow(1 - z, 3) * sstep(-0.2, 0.4, ndl);
        const ac = body === 'Earth' ? [110, 170, 255] : [235, 170, 130];
        r += ac[0] * rim * 0.8; gg += ac[1] * rim * 0.8; b += ac[2] * rim * 0.8;
      }
      const edge = clamp((1 - Math.sqrt(rr)) * R, 0, 1);
      D[i] = Math.min(255, r); D[i + 1] = Math.min(255, gg); D[i + 2] = Math.min(255, b); D[i + 3] = 255 * edge;
    }
  }
  g.putImageData(img, 0, 0);
  TEX[key] = c;
  return c;
}
const PLANET_IMG = {};
function planetImage(body) {
  if (!PLANET_IMG[body]) PLANET_IMG[body] = bodyTexture(body, 144).toDataURL();
  return PLANET_IMG[body];
}
function drawBody(g, body, x, y, r) {
  g.drawImage(bodyTexture(body, r > 140 ? 512 : 256), x - r, y - r, r * 2, r * 2);
}

/* ---------------- uzay aracı çizimi (yan görünüş) ---------------- */
function craftSVG(R) {
  const d = R.d;
  const W = 360, H = 230, cx = 180, cy = 104;
  const bw = 58 + Math.min(44, Math.sqrt(R.mass.dry) * 1.2), bh = bw * 0.82;
  const x0 = cx - bw / 2, y0 = cy - bh / 2, yb = y0 + bh;
  const P = [];
  const on = (id) => R.insts.find((i) => i.id === id);
  const big = (id) => (on(id) && on(id).t === 2 ? 1.3 : 1);

  // güneş panelleri: bağlantı kolu + hücreli paneller
  const wing = { body: null, deploy3: [52, 34, 2], deploy10: [72, 42, 3], huge: [104, 52, 4] }[d.power];
  if (wing) {
    const [w, h, n] = wing;
    for (const side of [-1, 1]) {
      const bx = side < 0 ? x0 : x0 + bw, ex = bx + side * 16;
      P.push(`<line x1="${bx}" y1="${cy}" x2="${ex}" y2="${cy}" stroke="#9aa3ad" stroke-width="3"/>`);
      const px = side < 0 ? ex - w : ex;
      P.push(`<rect x="${px}" y="${cy - h / 2}" width="${w}" height="${h}" fill="#1b2a47" stroke="#aab3bd" stroke-width="1.2"/>`);
      for (let k = 1; k < n; k++) P.push(`<line x1="${px + (w * k) / n}" y1="${cy - h / 2}" x2="${px + (w * k) / n}" y2="${cy + h / 2}" stroke="#aab3bd" stroke-width="1.2"/>`);
      for (let yy = cy - h / 2 + 6; yy < cy + h / 2; yy += 6) P.push(`<line x1="${px + 1}" y1="${yy}" x2="${px + w - 1}" y2="${yy}" stroke="#2b416b" stroke-width=".7"/>`);
      for (let xx = px + 6; xx < px + w; xx += 6) P.push(`<line x1="${xx}" y1="${cy - h / 2 + 1}" x2="${xx}" y2="${cy + h / 2 - 1}" stroke="#2b416b" stroke-width=".5"/>`);
    }
  }
  // RTG: kanatçıklı silindir, kol ucunda
  const rtgN = d.power === 'rtg' ? 1 : d.power === 'rtg2' ? 2 : 0;
  for (let i = 0; i < rtgN; i++) {
    const side = i === 0 ? -1 : 1, bx = side < 0 ? x0 : x0 + bw, by = yb - 10;
    const ex = bx + side * 46, ey = by + 22;
    P.push(`<line x1="${bx}" y1="${by}" x2="${ex}" y2="${ey}" stroke="#9aa3ad" stroke-width="2.5"/>`);
    P.push(`<g transform="translate(${ex},${ey}) rotate(${side * 30})"><rect x="-6" y="-16" width="12" height="32" fill="#4a4f57" stroke="#80868f"/>` +
      [-14, -7, 0, 7].map((yy) => `<rect x="-13" y="${yy}" width="26" height="2.2" fill="#6b717a"/>`).join('') + `</g>`);
  }
  // manyetometre direği
  if (on('magnetometer')) P.push(`<line x1="${x0 + bw}" y1="${y0 + 8}" x2="${x0 + bw + 95}" y2="${y0 - 30}" stroke="#c9ced6" stroke-width="1.6"/><rect x="${x0 + bw + 92}" y="${y0 - 35}" width="9" height="7" fill="#e6e8eb" stroke="#80868f"/>`);
  // radar sondası dipolleri
  if (on('radar_sounder')) { const L2 = 120 * big('radar_sounder'); P.push(`<line x1="${x0 + 6}" y1="${yb}" x2="${x0 + 6 - L2 * 0.8}" y2="${yb + L2 * 0.35}" stroke="#d6dbe1" stroke-width="1.4"/><line x1="${x0 + bw - 6}" y1="${yb}" x2="${x0 + bw - 6 + L2 * 0.8}" y2="${yb + L2 * 0.35}" stroke="#d6dbe1" stroke-width="1.4"/>`); }

  // anten (üst yüz)
  const ant = d.antenna;
  if (ant === 'lga') P.push(`<line x1="${cx + bw * 0.25}" y1="${y0}" x2="${cx + bw * 0.25}" y2="${y0 - 16}" stroke="#c9ced6" stroke-width="2"/><rect x="${cx + bw * 0.25 - 4}" y="${y0 - 22}" width="8" height="7" rx="2" fill="#e6e8eb"/>`);
  else if (ant === 'mga') P.push(`<path d="M ${cx - 7} ${y0} L ${cx - 12} ${y0 - 16} L ${cx + 12} ${y0 - 16} L ${cx + 7} ${y0} Z" fill="#d9dde2" stroke="#8a919a"/>`);
  else {
    const ar = ant === 'kahga' ? 46 : 32, dy = ar * 0.32;
    P.push(`<line x1="${cx}" y1="${y0}" x2="${cx}" y2="${y0 - 10}" stroke="#9aa3ad" stroke-width="4"/>`);
    P.push(`<path d="M ${cx - ar} ${y0 - 10 - dy} Q ${cx} ${y0 - 10 + dy * 0.9} ${cx + ar} ${y0 - 10 - dy} Z" fill="#eef0f2" stroke="#a7aeb6" stroke-width="1.2"/>`);
    P.push(`<path d="M ${cx - ar * 0.7} ${y0 - 10 - dy * 0.75} L ${cx} ${y0 - 10 - ar * 0.55} L ${cx + ar * 0.7} ${y0 - 10 - dy * 0.75}" fill="none" stroke="#a7aeb6" stroke-width="1"/><rect x="${cx - 3}" y="${y0 - 14 - ar * 0.55}" width="6" height="6" fill="#d0d4d9"/>`);
  }

  // gövde: altın ısı yalıtım folyosu (MLI) + kırışıklar
  P.push(`<rect x="${x0}" y="${y0}" width="${bw}" height="${bh}" fill="#c99a3b"/>`);
  P.push(`<rect x="${x0}" y="${y0}" width="${bw * 0.42}" height="${bh}" fill="#d9ae55" opacity=".7"/>`);
  const rr = seeded(Math.round(bw));
  for (let k = 0; k < 9; k++) { const ax = x0 + rr() * bw, ay = y0 + rr() * bh; P.push(`<path d="M ${ax} ${ay} l ${rr() * 18 - 9} ${rr() * 18 - 4}" stroke="${rr() < 0.5 ? '#f0cf7d' : '#9c7426'}" stroke-width="1" opacity=".8"/>`); }
  P.push(`<rect x="${x0}" y="${y0}" width="${bw}" height="${bh}" fill="none" stroke="#8a6a24" stroke-width="1.2"/>`);
  P.push(`<rect x="${x0 - 2}" y="${y0 - 3}" width="${bw + 4}" height="3" fill="#b8bfc7"/>`);
  if (d.shielding !== 'none') P.push(`<rect x="${x0 + 6}" y="${y0 + bh * 0.5}" width="${bw - 12}" height="${bh * 0.38}" fill="none" stroke="#7b5b1c" stroke-width="1" stroke-dasharray="3 2"/>`);
  // yıldız izleyici
  if (d.adcs !== 'mtq') P.push(`<rect x="${x0 + bw - 14}" y="${y0 + 6}" width="9" height="9" fill="#2a2f36"/><circle cx="${x0 + bw - 9.5}" cy="${y0 + 10.5}" r="2.5" fill="#5d7ea8"/>`);

  // itki: nozul
  const pr = d.propulsion;
  if (pr !== 'none') {
    const nw = { cold: 7, mono: 11, biprop: 20, ion: 18 }[pr], nh = { cold: 6, mono: 10, biprop: 22, ion: 6 }[pr];
    if (pr === 'ion') P.push(`<rect x="${cx - nw / 2}" y="${yb}" width="${nw}" height="${nh}" fill="#3b4149"/><ellipse cx="${cx}" cy="${yb + nh}" rx="${nw / 2}" ry="2.5" fill="#6aa9ff" opacity=".8"/>`);
    else P.push(`<path d="M ${cx - nw * 0.25} ${yb} L ${cx - nw / 2} ${yb + nh} L ${cx + nw / 2} ${yb + nh} L ${cx + nw * 0.25} ${yb} Z" fill="#5a6069" stroke="#9aa3ad"/>`);
  }
  // alt yüz aletleri (yer gözlem yüzü)
  if (on('sar')) { const sw = bw * 1.35 * big('sar'); P.push(`<rect x="${cx - sw / 2}" y="${yb + 26}" width="${sw}" height="8" fill="#5a6370" stroke="#9aa3ad"/><line x1="${cx - sw / 4}" y1="${yb}" x2="${cx - sw / 4}" y2="${yb + 26}" stroke="#9aa3ad"/><line x1="${cx + sw / 4}" y1="${yb}" x2="${cx + sw / 4}" y2="${yb + 26}" stroke="#9aa3ad"/>`); }
  const slots = ['camera', 'spectrometer', 'multispec', 'thermal', 'altimeter', 'atmo', 'neutron', 'particles'].filter(on);
  const used = slots.slice(0, 6);
  used.forEach((id, i) => {
    const sx = x0 + 8 + ((bw - 16) * (i + 0.5)) / used.length;
    const k = big(id);
    if (id === 'camera') P.push(`<rect x="${sx - 6 * k}" y="${yb}" width="${12 * k}" height="${16 * k}" fill="#e9ebee" stroke="#8a919a"/><rect x="${sx - 6 * k}" y="${yb + 16 * k - 3}" width="${12 * k}" height="3" fill="#1d2228"/>`);
    else if (id === 'spectrometer') P.push(`<rect x="${sx - 7 * k}" y="${yb}" width="${14 * k}" height="${10 * k}" fill="#3a4048" stroke="#8a919a"/><rect x="${sx - 4 * k}" y="${yb + 10 * k}" width="${8 * k}" height="4" fill="#1d2228"/>`);
    else if (id === 'thermal') P.push(`<rect x="${sx - 6 * k}" y="${yb}" width="${12 * k}" height="${10 * k}" fill="#e2e5e8" stroke="#8a919a"/>${[2, 5, 8].map((o) => `<line x1="${sx - 6 * k}" y1="${yb + o * k}" x2="${sx + 6 * k}" y2="${yb + o * k}" stroke="#9aa3ad"/>`).join('')}`);
    else if (id === 'altimeter') P.push(`<rect x="${sx - 4 * k}" y="${yb}" width="${8 * k}" height="${9 * k}" fill="#cfd4d9" stroke="#8a919a"/><circle cx="${sx}" cy="${yb + 9 * k}" r="${3 * k}" fill="#1d2228"/>`);
    else if (id === 'atmo') P.push(`<rect x="${sx - 6 * k}" y="${yb}" width="${12 * k}" height="${8 * k}" fill="#d7dbe0" stroke="#8a919a"/><circle cx="${sx}" cy="${yb + 8 * k}" r="${4 * k}" fill="#7a838e"/>`);
    else P.push(`<rect x="${sx - 4 * k}" y="${yb}" width="${8 * k}" height="${6 * k}" fill="#bfc5cc" stroke="#8a919a"/>`);
  });
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${VIZ_TXT.craftLabel}">${P.join('')}</svg>`;
}

/* ---------------- uçuş ekranı ---------------- */
const VIZ_STARS = (() => { const r = seeded(42); return Array.from({ length: 160 }, () => [r(), r(), r()]); })();

function stars(g, W, H) {
  for (const [x, y, b] of VIZ_STARS) { g.globalAlpha = 0.15 + b * 0.45; g.fillStyle = '#fff'; g.fillRect(x * W, y * H, b < 0.9 ? 1 : 1.6, b < 0.9 ? 1 : 1.6); }
  g.globalAlpha = 1;
}

function drawFlight(canvas, sim, ui) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (canvas.width !== Math.round(W * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const now = REDUCED_MOTION ? 0 : performance.now() / 1000;
  const sc = sim.sc, R = sim.R;
  g.font = '13px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  const phase = sim.phase === 'ended' ? (sim.endReason === 'launch' ? 'launch' : sim.opsMonth > 0 || sim.inserted ? 'ops' : 'cruise') : sim.phase;

  if (phase === 'launch') {
    const p = ui.launchAnim;
    // gökyüzü yükseldikçe kararır
    const sky = g.createLinearGradient(0, 0, 0, H);
    const t = clamp(p * 1.6, 0, 1);
    sky.addColorStop(0, `rgb(${Math.round(70 * (1 - t) + 6)},${Math.round(120 * (1 - t) + 9)},${Math.round(190 * (1 - t) + 16)})`);
    sky.addColorStop(1, `rgb(${Math.round(150 * (1 - t) + 20)},${Math.round(190 * (1 - t) + 30)},${Math.round(230 * (1 - t) + 50)})`);
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    if (t > 0.5) { g.globalAlpha = (t - 0.5) * 2; stars(g, W, H); g.globalAlpha = 1; }
    const lift = Math.max(0, p - 0.1) / 0.9;
    const groundY = H * 0.86 + lift * lift * H * 1.2;
    // zemin ve kule
    g.fillStyle = '#2d3a2e'; g.fillRect(0, groundY, W, H);
    g.fillStyle = '#3c3f44'; g.fillRect(W / 2 + 22, groundY - H * 0.42, 10, H * 0.42);
    for (let k = 0; k < 9; k++) { g.fillRect(W / 2 + 6, groundY - H * 0.42 + k * H * 0.047, 26, 2); }
    const rx = W / 2, ry = groundY - 64 - lift * lift * H * 1.25;
    const failed = sim.endReason === 'launch' && p > 0.55;
    if (!failed) {
      if (p > 0.05) { // egzoz
        const len = 60 + Math.sin(now * 30) * 6;
        const fl = g.createLinearGradient(rx, ry + 60, rx, ry + 60 + len);
        fl.addColorStop(0, 'rgba(255,250,230,1)'); fl.addColorStop(0.3, 'rgba(255,190,90,.9)'); fl.addColorStop(1, 'rgba(255,120,40,0)');
        g.fillStyle = fl; g.beginPath(); g.moveTo(rx - 6, ry + 60); g.lineTo(rx + 6, ry + 60); g.lineTo(rx, ry + 60 + len); g.fill();
      }
      g.fillStyle = '#f2f3f5'; g.fillRect(rx - 6, ry, 12, 60);
      g.fillStyle = '#c9ccd1'; g.fillRect(rx - 6, ry + 22, 12, 3);
      g.fillStyle = '#f2f3f5'; g.beginPath(); g.moveTo(rx - 6, ry); g.quadraticCurveTo(rx - 6, ry - 14, rx, ry - 20); g.quadraticCurveTo(rx + 6, ry - 14, rx + 6, ry); g.fill();
      g.fillStyle = '#4a4f57'; g.fillRect(rx - 5, ry + 58, 10, 3);
    } else {
      const k = Math.min(1, (p - 0.55) * 3);
      g.fillStyle = `rgba(90,90,95,${0.8 - k * 0.5})`;
      for (let i = 0; i < 14; i++) { const a = i * 0.45, dd = k * 60 * (0.5 + (i % 4) / 4); g.beginPath(); g.arc(rx + Math.cos(a) * dd, ry + 30 + Math.sin(a) * dd, 14 * (1 - k * 0.3), 0, 7); g.fill(); }
      g.fillStyle = `rgba(255,150,60,${1 - k})`; g.beginPath(); g.arc(rx, ry + 30, 22 * (1 - k * 0.5), 0, 7); g.fill();
    }
    return;
  }

  g.fillStyle = '#05080d'; g.fillRect(0, 0, W, H);
  stars(g, W, H);

  if (phase === 'cruise') {
    const total = Math.max(1, Math.round(R.schedule.cruise));
    const prog = clamp((total - sim.cruiseLeft + ui.sub) / total, 0, 1);
    const cx = W / 2, cy = H / 2;
    if (sc.body === 'Moon') {
      const r2 = Math.min(W, H) * 0.38;
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(cx, cy, r2, 0, 7); g.stroke();
      drawBody(g, 'Earth', cx, cy, Math.min(W, H) * 0.1);
      const ma = -0.3;
      drawBody(g, 'Moon', cx + Math.cos(ma) * r2, cy + Math.sin(ma) * r2, Math.min(W, H) * 0.035);
      const a0 = Math.PI * 0.9, a1 = ma + Math.PI * 2;
      const ang = a0 + (a1 - a0) * prog, rr = Math.min(W, H) * 0.11 + (r2 - Math.min(W, H) * 0.11) * prog;
      drawProbe(g, cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
      return;
    }
    const r1 = Math.min(W, H) * (sc.body === 'Europa' ? 0.15 : 0.27), r2 = Math.min(W, H) * 0.42;
    const sg = g.createRadialGradient(cx, cy, 0, cx, cy, 26);
    sg.addColorStop(0, '#fffbe8'); sg.addColorStop(0.35, '#ffe9a8'); sg.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = sg; g.beginPath(); g.arc(cx, cy, 26, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.arc(cx, cy, r1, 0, 7); g.stroke(); g.beginPath(); g.arc(cx, cy, r2, 0, 7); g.stroke();
    const ta = 0.2, tp = ta + Math.PI;
    const ea = tp + prog * 2.4;
    drawBody(g, 'Earth', cx + Math.cos(ea) * r1, cy + Math.sin(ea) * r1, 6);
    drawBody(g, sc.body === 'Europa' ? 'Jupiter' : 'Mars', cx + Math.cos(ta) * r2, cy + Math.sin(ta) * r2, sc.body === 'Europa' ? 13 : 6);
    const ecc = (r2 - r1) / (r2 + r1), pp = r1 * (1 + ecc);
    const pos = (th) => { const rr = pp / (1 + ecc * Math.cos(th)); return [cx + Math.cos(th + tp) * rr, cy + Math.sin(th + tp) * rr]; };
    g.strokeStyle = 'rgba(120,180,255,.55)'; g.setLineDash([3, 5]);
    g.beginPath();
    for (let i = 0; i <= 60; i++) { const [px, py] = pos((i / 60) * Math.PI); if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); }
    g.stroke(); g.setLineDash([]);
    const [qx, qy] = pos(prog * Math.PI);
    drawProbe(g, qx, qy);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText(VIZ_TXT.sun, cx - 14, cy + 40);
    return;
  }

  // ---------- yörünge / operasyon ----------
  const orbitK = R.d.orbit, ob = sim.orbit;
  const cx = W / 2, cy = H / 2;
  let center = sc.body, br = Math.min(W, H) * 0.2;
  if (orbitK === 'jflyby') { center = 'Jupiter'; br = Math.min(W, H) * 0.14; }
  if (sc.body === 'Europa' && orbitK !== 'jflyby') drawBody(g, 'Jupiter', W * 0.08, H * 0.14, Math.min(W, H) * 0.42);

  if (ob.flyby) {
    drawBody(g, center, cx, cy, br);
    const p = clamp((sim.opsMonth + ui.sub) / Math.max(1, sim.plannedOps), 0, 1);
    const path = (xx) => cy - br * 1.6 + Math.pow((xx - cx) / W, 2) * H * 0.8;
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.setLineDash([4, 5]); g.beginPath();
    for (let xx = -40; xx < W + 40; xx += 10) { if (xx === -40) g.moveTo(xx, path(xx)); else g.lineTo(xx, path(xx)); }
    g.stroke(); g.setLineDash([]);
    const x = -40 + p * (W + 80);
    drawProbe(g, x, path(x));
    return;
  }

  const a = Math.min(br * ob.viz.a, Math.min(W, H) * 0.46);
  const e = ob.viz.e, b = a * Math.sqrt(1 - e * e), fc = a * e, tilt = -0.35;
  const speed = 1.1 / Math.pow(Math.max(1, ob.viz.a), 0.9);
  ui.orbAng = (ui.orbAng || 0) + speed * ui.dt * (sim.done ? 0.3 : 1);
  const E = ui.orbAng + e * Math.sin(ui.orbAng);
  const lx = a * Math.cos(E) - fc, ly = b * Math.sin(E);
  const px = cx + lx * Math.cos(tilt) - ly * Math.sin(tilt);
  const py = cy + lx * Math.sin(tilt) + ly * Math.cos(tilt);
  const behind = Math.sin(E) < 0 && Math.hypot(px - cx, py - cy) < br; // gezegenin arkasında
  const orbitPath = () => { g.save(); g.translate(cx, cy); g.rotate(tilt); g.beginPath(); g.ellipse(-fc, 0, a, b, 0, 0, Math.PI * 2); g.restore(); };
  g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1;
  if (behind) { if (!sim.done || sim.endReason === 'complete') drawProbe(g, px, py, true); }
  orbitPath(); g.stroke();
  drawBody(g, center, cx, cy, br);
  if (orbitK === 'jflyby') {
    const er = br * 2.3, ea = now * 0.25 + 1;
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(cx, cy, er, 0, 7); g.stroke();
    drawBody(g, 'Europa', cx + Math.cos(ea) * er, cy + Math.sin(ea) * er, br * 0.2);
  }
  if (!behind) {
    const dx = px - cx, dy = py - cy;
    const lit = (dx * -0.75 + dy * -0.35) > -br * 0.2 || Math.hypot(dx, dy) > br * 1.25;
    // gezegen, araç ile Dünya arasındaki görüş hattını kesiyorsa sinyal yok (örtülme)
    const tx = W - 16, ty = 16, vx = tx - px, vy = ty - py, len2 = vx * vx + vy * vy;
    const tt = clamp(((cx - px) * vx + (cy - py) * vy) / len2, 0, 1);
    const occluded = Math.hypot(px + vx * tt - cx, py + vy * tt - cy) < br * 0.98;
    const down = !sim.done && !occluded && sim.lastDF > 0 && sc.body !== 'Earth';
    if (down) {
      g.strokeStyle = 'rgba(98,207,143,.7)'; g.lineWidth = 1.5; g.setLineDash([5, 6]); g.lineDashOffset = -now * 25;
      g.beginPath(); g.moveTo(px, py); g.lineTo(tx, ty); g.stroke(); g.setLineDash([]); g.lineWidth = 1;
    }
    drawProbe(g, px, py, !lit, sim.done && sim.endReason !== 'complete');
  }
  g.fillStyle = 'rgba(255,255,255,.65)'; g.textAlign = 'right';
  if (sc.body !== 'Earth') g.fillText(VIZ_TXT.earthDir, W - 14, H - 14);
  g.textAlign = 'left';
  g.fillText(VIZ_TXT.sunlight, 14, H - 14);
}

/* Küçük uzay aracı: altın gövde, iki panel */
function drawProbe(g, x, y, shadow, dead) {
  g.save(); g.translate(x, y);
  const body = dead ? '#c22b2b' : shadow ? '#5c4a22' : '#d6a64a';
  const pan = shadow ? '#141c2c' : '#2a4677';
  g.fillStyle = pan; g.fillRect(-15, -3, 9, 6); g.fillRect(6, -3, 9, 6);
  g.fillStyle = shadow ? '#555' : '#aab3bd'; g.fillRect(-6, -0.6, 12, 1.2);
  g.fillStyle = body; g.fillRect(-4, -4, 8, 8);
  if (!shadow && !dead) { g.fillStyle = '#eef0f2'; g.beginPath(); g.ellipse(0, -5.5, 4, 1.6, 0, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

function sparkline(canvas, series, color, maxV) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const g = canvas.getContext('2d'); g.scale(dpr, dpr);
  g.clearRect(0, 0, W, H);
  if (series.length < 2) return;
  const css = getComputedStyle(document.documentElement);
  const col = color && color.startsWith('--') ? css.getPropertyValue(color).trim() : color;
  g.strokeStyle = css.getPropertyValue('--line').trim(); g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, H - 1); g.lineTo(W, H - 1); g.stroke();
  const mx = maxV || Math.max(...series, 1);
  const mn = Math.min(0, ...series);
  g.beginPath();
  series.forEach((v, i) => { const x = (i / (series.length - 1)) * W, y = H - 3 - ((v - mn) / (mx - mn || 1)) * (H - 8); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
  g.strokeStyle = col; g.lineWidth = 2; g.stroke();
  const lastV = series[series.length - 1], ly = H - 3 - ((lastV - mn) / (mx - mn || 1)) * (H - 8);
  g.fillStyle = col; g.beginPath(); g.arc(W - 3, ly, 3, 0, 7); g.fill();
}
