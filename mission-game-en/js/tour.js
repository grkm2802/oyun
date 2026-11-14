'use strict';
/* =========================================================================
   Rehberli tur / Guided tour
   - main:   başlangıç + tasarım ekranı (ilk ziyarette kendiliğinden açılır)
   - flight: ilk uçuşta (tur süresince uçuş duraklar)
   - report: ilk raporda
   Her adım ekrandaki gerçek bir öğeyi parlatır. Görülen turlar localStorage 'ma_tour' içinde.
   Bu dosya iki dil klasöründe de AYNIDIR; metinler LANG'e göre seçilir.
   ========================================================================= */
(function () {
  const go = (fn) => () => fn();
  const toDesign = (step) => () => {
    if (S.screen !== 'design') {
      if (!S.design) S.design = defaultDesign(scen());
      S.approvals = {}; S.screen = 'design'; S.step = step; render();
    } else if (S.step !== step) { S.step = step; refreshDesign(); }
  };
  const demoInstruments = () => {
    toDesign('payload')();
    if (!Object.values(S.design.instruments).some((t) => t > 0)) {
      const sc = scen();
      const prim = sc.objectives.filter((o) => o.primary);
      for (const o of prim) { const best = Object.entries(o.needs).sort((a, b) => b[1] - a[1])[0][0]; S.design.instruments[best] = 1; }
      refreshDesign();
    }
  };

  const TXT = {
    tr: {
      next: 'İleri', back: 'Geri', done: 'Bitir', skip: 'Turu bitir', of: '/', label: 'Rehberli tur',
      main: [
        { title: 'Görev Mimarı\'na hoş geldin!', text: 'Bir uzay görevini nasıl tasarlayıp uçuracağını 2 dakikada gösteriyorum. İstediğin an "Turu bitir" diyebilirsin.' },
        { screen: 'title', target: '.scen-grid', title: '1. Görevini seç', text: 'Her kart başka bir hedef. Senin için en kolayını seçtim.', before: go(() => { if (S.scenario !== 'earth') { S.scenario = 'earth'; render(); } }) },
        { screen: 'title', target: '.setup-grid', title: '2. Ekip ve zorluk', text: 'Tek başına ya da arkadaşlarınla oyna. Zorluk, bütçeyi ve sürprizleri belirler.' },
        { screen: 'title', target: '[data-act="start"]', title: '3. Tasarlamaya başla', text: 'Hazır olunca buna bas. Şimdi "İleri" de, tasarım ekranına geçelim.' },
        { screen: 'design', target: '#steps', title: 'Tasarım 4 adımdan oluşur', text: 'Görev, Aletler, Uzay aracı, Fırlatma. Yeşil tamam, sarı uyarı, kırmızı sorun demek.', before: toDesign('mission') },
        { screen: 'design', target: '[data-tour="resources"]', title: 'Beş gösterge', text: 'Her seçim bunları değiştirir. Kırmızı, sınır aşıldı demek. Bilimi doldurmaya çalış!', before: toDesign('mission') },
        { screen: 'design', target: '.ws-stage', title: 'Uzay aracın burada', text: 'Seçtiğin her parça burada araca eklenir.', before: toDesign('mission') },
        { screen: 'design', target: '[data-tour="objectives"]', title: 'Önce hedefleri oku', text: 'Görevin amacı burada. Yıldızlı hedefler en az %60 dolmalı.', before: toDesign('mission') },
        { screen: 'design', target: '[data-tour="orbits"]', title: 'Yörüngeyi seç', text: 'Yakın yörünge daha net görür ama daha çok yakıt ister.', before: toDesign('mission') },
        { screen: 'design', target: '[data-tour="capability"]', title: 'Aletler hedefleri doldurur', text: 'Aletler bu çubukları doldurur. İki alet ekledim, bak.', before: demoInstruments },
        { screen: 'design', target: '[data-tour="instruments"]', title: 'Alet eklemek', text: 'Karta dokun: alet eklenir. Tekrar dokun: çıkar.', before: toDesign('payload') },
        { screen: 'design', target: '[data-tour="craft"]', title: 'Uzay aracını tamamla', text: 'Güç, motor ve anten seç. Yeşil yeterli, kırmızı yetersiz demek.', before: toDesign('craft') },
        { screen: 'design', target: '[data-tour="issues"]', title: 'Kontrol listesi', text: 'Kırmızı sorunları düzelt, roketini seç.', before: toDesign('launch') },
        { screen: 'design', target: '[data-act="launch"]', title: 'Fırlat!', text: 'Sorun kalmayınca bu düğme açılır.', before: toDesign('launch') },
        { title: 'Sıra sende!', text: 'Eksikleri düzelt ve fırlat. Başarısız olursan tekrar dene. İyi uçuşlar!' },
      ],
      flight: [
        { target: '.viz-wrap', title: 'Uçuşunu izle', text: 'Fırlatma, yolculuk ve yörünge burada. Sürükleyerek çevirebilirsin.' },
        { target: '#timeline', title: 'Görevin aşamaları', text: 'Turuncu çizgi şu an nerede olduğunu gösterir.' },
        { target: '.controls', title: 'Hızı sen belirle', text: 'Duraklat, hızlandır ya da ileri sar.' },
        { target: '#sim-stats', title: 'Aracın durumu', text: 'Sarı ya da kırmızı değer, zayıf bir nokta demek.' },
        { target: '#sim-obj', title: 'Bilim ilerlemesi', text: 'Hedeflerin doldukça puanın artar.' },
        { title: 'Beklenmedik olaylar', text: 'Yolda sürprizler çıkabilir. O zaman bir karar vermen gerekir.' },
      ],
      report: [
        { target: '.report-hero', title: 'Görev raporu', text: 'Notun (S en iyisi) ve 1000 üzerinden puanın.' },
        { target: '.breakdown', title: 'Puan nereden geldi?', text: 'Puanın nereden geldiğini buradan görürsün.' },
        { target: '[data-tour="lessons"]', title: 'Neden böyle oldu?', text: 'Ne iyi gitti, ne kötü gitti ve neden.' },
        { target: '[data-act="redesign"]', title: 'Tekrar dene', text: 'Tasarımı değiştir ve puanını yükseltmeyi dene!' },
      ],
    },
    en: {
      next: 'Next', back: 'Back', done: 'Finish', skip: 'End tour', of: '/', label: 'Guided tour',
      main: [
        { title: 'Welcome to Mission Architect!', text: 'A 2-minute tour of how to design and fly a mission. Press "End tour" any time.' },
        { screen: 'title', target: '.scen-grid', title: '1. Pick your mission', text: 'Each card is a different target. I picked the easiest one.', before: go(() => { if (S.scenario !== 'earth') { S.scenario = 'earth'; render(); } }) },
        { screen: 'title', target: '.setup-grid', title: '2. Crew and difficulty', text: 'Play alone or with friends. Difficulty sets the budget and surprises.' },
        { screen: 'title', target: '[data-act="start"]', title: '3. Start designing', text: 'Press this when ready. Now press "Next" to go to the design screen.' },
        { screen: 'design', target: '#steps', title: 'Design has 4 steps', text: 'Mission, Instruments, Spacecraft, Launch. Green is done, yellow a warning, red a problem.', before: toDesign('mission') },
        { screen: 'design', target: '[data-tour="resources"]', title: 'Five gauges', text: 'Every choice moves these. Red means over the limit. Try to fill Science!', before: toDesign('mission') },
        { screen: 'design', target: '.ws-stage', title: 'Your spacecraft', text: 'Every part you pick is added to the craft here.', before: toDesign('mission') },
        { screen: 'design', target: '[data-tour="objectives"]', title: 'Read the objectives first', text: 'The mission goals. Starred ones must reach at least 60%.', before: toDesign('mission') },
        { screen: 'design', target: '[data-tour="orbits"]', title: 'Pick an orbit', text: 'A close orbit sees more but needs more fuel.', before: toDesign('mission') },
        { screen: 'design', target: '[data-tour="capability"]', title: 'Instruments fill the objectives', text: 'Instruments fill these bars. I added two, look.', before: demoInstruments },
        { screen: 'design', target: '[data-tour="instruments"]', title: 'Adding instruments', text: 'Tap a card to add it. Tap again to remove it.', before: toDesign('payload') },
        { screen: 'design', target: '[data-tour="craft"]', title: 'Finish the spacecraft', text: 'Pick power, engine and antenna. Green is enough, red is not.', before: toDesign('craft') },
        { screen: 'design', target: '[data-tour="issues"]', title: 'Checklist', text: 'Fix the red problems and pick your rocket.', before: toDesign('launch') },
        { screen: 'design', target: '[data-act="launch"]', title: 'Launch!', text: 'This button unlocks when no problems are left.', before: toDesign('launch') },
        { title: 'Your turn!', text: 'Fix what is missing and launch. If it fails, try again. Have a great flight!' },
      ],
      flight: [
        { target: '.viz-wrap', title: 'Watch your flight', text: 'Launch, journey and orbit show here. Drag to turn the view.' },
        { target: '#timeline', title: 'Mission phases', text: 'The orange line shows where you are now.' },
        { target: '.controls', title: 'You control the speed', text: 'Pause, speed up or skip ahead.' },
        { target: '#sim-stats', title: 'Spacecraft status', text: 'A yellow or red value means a weak spot.' },
        { target: '#sim-obj', title: 'Science progress', text: 'Your score grows as objectives fill up.' },
        { title: 'Surprises', text: 'Surprises can happen on the way. Then you have to make a choice.' },
      ],
      report: [
        { target: '.report-hero', title: 'Mission report', text: 'Your grade (S is best) and score out of 1000.' },
        { target: '.breakdown', title: 'Where did the points come from?', text: 'See where your points came from.' },
        { target: '[data-tour="lessons"]', title: 'Why did it go this way?', text: 'What went well, what went wrong and why.' },
        { target: '[data-act="redesign"]', title: 'Try again', text: 'Change your design and try for a higher score!' },
      ],
    },
  };
  const L = TXT[LANG] || TXT.tr;

  let tour = null, idx = 0, pausedByTour = false, root = null, raf = 0;
  const read = () => { try { return JSON.parse(localStorage.getItem('ma_tour') || '{}'); } catch { return {}; } };
  const seen = (k) => !!read()[k];
  const markSeen = (k) => { try { const o = read(); o[k] = 1; localStorage.setItem('ma_tour', JSON.stringify(o)); } catch { /* depolama yok */ } };

  function start(name) {
    if (!L[name]) return;
    if (document.querySelector('#modal-root .modal') && name === 'main') closeModal();
    tour = name;
    idx = 0;
    if (name === 'main' && S.screen !== 'title') idx = L.main.findIndex((s) => s.screen === 'design');
    if (name === 'flight' && S.ui) { pausedByTour = !S.ui.paused; S.ui.paused = true; }
    if (!root) {
      root = document.createElement('div');
      root.id = 'tour-root';
      document.body.appendChild(root);
      addEventListener('resize', schedule); addEventListener('scroll', schedule, true);
    }
    show();
  }
  function end() {
    if (!tour) return;
    markSeen(tour);
    if (tour === 'flight' && S.ui && pausedByTour) S.ui.paused = false;
    pausedByTour = false; tour = null;
    if (root) { root.remove(); root = null; removeEventListener('resize', schedule); removeEventListener('scroll', schedule, true); }
  }
  function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); }

  function show() {
    const steps = L[tour], st = steps[idx];
    if (st.before) st.before();
    const last = idx === steps.length - 1;
    root.innerHTML = `<div class="tour-catch"></div><div class="tour-spot" hidden></div>
      <div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text">
        <div class="tour-prog">${L.label} · ${idx + 1} ${L.of} ${steps.length}</div>
        <h3 id="tour-title">${st.title}</h3>
        <p id="tour-text">${st.text}</p>
        <div class="tour-btns">
          <button class="btn ghost small" data-tour-act="skip">${L.skip}</button>
          <span class="grow"></span>
          ${idx > 0 ? `<button class="btn small" data-tour-act="back">${L.back}</button>` : ''}
          <button class="btn primary small" data-tour-act="next">${last ? L.done : L.next}</button>
        </div></div>`;
    const el = st.target ? document.querySelector(st.target) : null;
    // anında kaydır: yumuşak kaydırma bazı düzenlerde yarıda kesilip hedefi ekran dışında bırakıyordu
    if (el) el.scrollIntoView({ block: 'center', behavior: 'auto' });
    place();
    setTimeout(place, 60);
    root.querySelector('[data-tour-act="next"]').focus({ preventScroll: true });
  }

  function place() {
    if (!tour || !root) return;
    const st = L[tour][idx];
    const el = st.target ? document.querySelector(st.target) : null;
    const spot = root.querySelector('.tour-spot'), card = root.querySelector('.tour-card'), catcher = root.querySelector('.tour-catch');
    const vw = innerWidth, vh = innerHeight, m = 16;
    const narrow = vw < 720;
    if (!el || !el.getClientRects().length) {
      spot.hidden = true; catcher.classList.add('dim');
      card.style.left = Math.max(m, (vw - card.offsetWidth) / 2) + 'px';
      card.style.top = Math.max(m, (vh - card.offsetHeight) / 2) + 'px';
      return;
    }
    catcher.classList.remove('dim');
    const r = el.getBoundingClientRect(), pad = 6;
    const top = Math.max(4, r.top - pad), left = Math.max(4, r.left - pad);
    const h = Math.min(vh - 8, r.bottom + pad) - top, w = Math.min(vw - 8, r.right + pad) - left;
    spot.hidden = false;
    Object.assign(spot.style, { top: top + 'px', left: left + 'px', width: Math.max(0, w) + 'px', height: Math.max(0, h) + 'px' });
    const ch = card.offsetHeight, cw = card.offsetWidth;
    let cy, cx;
    if (narrow) { cx = m; cy = (top + h / 2 > vh / 2) ? m : vh - ch - m; }
    else {
      cx = Math.min(Math.max(m, left), vw - cw - m);
      if (top + h + 12 + ch < vh - m) cy = top + h + 12;
      else if (top - 12 - ch > m) cy = top - 12 - ch;
      else { cy = Math.max(m, Math.min(vh - ch - m, top)); cx = left + w + 12 + cw < vw - m ? left + w + 12 : Math.max(m, left - cw - 12); }
    }
    card.style.left = cx + 'px'; card.style.top = cy + 'px';
  }

  function move(d) {
    const n = idx + d;
    if (n < 0) return;
    if (n >= L[tour].length) { end(); return; }
    idx = n; show();
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act="tour"]');
    if (t) { e.preventDefault(); if (document.querySelector('#modal-root .modal')) closeModal(); start(t.dataset.v || 'main'); return; }
    const b = e.target.closest('[data-tour-act]');
    if (!b) return;
    const a = b.dataset.tourAct;
    if (a === 'next') move(1); else if (a === 'back') move(-1); else end();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (!tour) return;
    if (e.key === 'Escape') { e.stopPropagation(); end(); }
    else if (e.key === 'ArrowRight') move(1);
    else if (e.key === 'ArrowLeft') move(-1);
    else if (e.key === 'Tab') {
      const items = [...root.querySelectorAll('button')]; const i = items.indexOf(document.activeElement);
      e.preventDefault(); items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
    }
  }, true);

  /* Ekran değişince: ilk ziyarette ilgili turu öner */
  window.onScreen = (screen) => {
    if (tour) { const home = { main: ['title', 'design'], flight: ['sim'], report: ['report'] }[tour] || []; if (!home.includes(screen)) end(); else schedule(); return; }
    if (screen === 'title' && !seen('main')) {
      // açılış ekranı (intro.js) bitene kadar bekle
      const go = () => setTimeout(() => { if (!tour && S.screen === 'title') start('main'); }, 400);
      if (window.MA_INTRO_ACTIVE) document.addEventListener('ma:intro-done', go, { once: true }); else go();
    }
    if (screen === 'sim' && !seen('flight')) {
      const wait = () => {
        if (S.screen !== 'sim' || tour) return;
        if (!S.sim || S.sim.done) return;
        if (S.sim.phase === 'launch' || S.sim.pending) { setTimeout(wait, 500); return; }
        setTimeout(() => { if (!tour && S.screen === 'sim' && S.sim && !S.sim.pending && !S.sim.done) start('flight'); }, 1200);
      };
      setTimeout(wait, 800);
    }
    if (screen === 'report' && !seen('report')) setTimeout(() => { if (!tour && S.screen === 'report') start('report'); }, 400);
  };
  // ui.js ilk render'ı tour.js yüklenmeden yaptı; o ekran için de kontrol et
  if (typeof S !== 'undefined') window.onScreen(S.screen);
})();
