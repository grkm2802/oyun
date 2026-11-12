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
        { title: 'Görev Mimarı\'na hoş geldin!', text: 'Bu kısa turda bir uzay görevini nasıl tasarlayıp uçuracağını göstereceğim. Yaklaşık 2 dakika sürer. İstediğin an "Turu bitir" ile çıkabilirsin; turu daha sonra "Nasıl oynanır" düğmesiyle yeniden açabilirsin.' },
        { screen: 'title', target: '.scen-grid', title: '1. Görevini seç', text: 'Her kart farklı bir hedef: Dünya, Ay, Mars ya da Jüpiter\'in uydusu Europa. İlk görev için en kolayı olan "Orman Yangını Gözcüsü"nü seçtim.', before: go(() => { if (S.scenario !== 'earth') { S.scenario = 'earth'; render(); } }) },
        { screen: 'title', target: '.setup-grid', title: '2. Ekip ve zorluk', text: 'Tek başına ya da 2–4 kişilik takım olarak oynayabilirsin. Takımda herkesin bir görevi olur. Zorluk; bütçeyi ve yolda çıkacak sürprizleri belirler. İlk oyun için "Öğrenci" ya da "Mühendis" iyi bir seçim.' },
        { screen: 'title', target: '[data-act="start"]', title: '3. Tasarlamaya başla', text: 'Hazır olduğunda bu düğmeye basarsın. "İleri" dediğinde seni tasarım ekranına götüreceğim.' },
        { screen: 'design', target: '#steps', title: 'Tasarım 8 adımdan oluşur', text: 'Soldan sağa ilerle: Görev, Yörünge, Aletler, Uzay aracı, Güç, Haberleşme, Fırlatma ve Tasarım incelemesi. Adımın yanındaki işaret yeşilse sorun yok; sarı uyarı, kırmızı ise düzeltilmesi gereken bir sorun demek.', before: toDesign('mission') },
        { screen: 'design', target: '[data-tour="objectives"]', title: 'Önce hedefleri oku', text: 'Bu görevde neyi öğrenmek istediğimiz burada yazıyor. Yıldızlı hedefler ana hedeftir: görevin başarılı sayılması için hepsinin en az %60 tamamlanması gerekir. Altındaki etiketler hangi aletin işe yarayacağını söyler.', before: toDesign('mission') },
        { screen: 'design', target: '.learn', title: '"Neden önemli?" kutuları', text: 'Her adımda bu kutu konuyu basitçe anlatır. Bir şeyi anlamadıysan önce buraya bak. Üst menüdeki "Sözlük" de zor kelimeleri açıklar.', before: toDesign('mission') },
        { screen: 'design', target: '[data-tour="resources"]', title: 'Kaynakların burada', text: 'Bütçe, roketin taşıyabileceği kütle, elektrik gücü, batarya, veri, takvim ve radyasyon. Çubuk yeşilse iyi, sarıysa sınırda, kırmızıysa aşıldı demek. Her seçim bu çubukları değiştirir: gerçek mühendisler de hep bu dengeyi kurar.', before: toDesign('mission') },
        { screen: 'design', target: '[data-tour="capability"]', title: 'Aletler hedefleri doldurur', text: 'Seçtiğin aletler bu çubukları doldurur. Senin için iki alet seçtim; çubukların nasıl dolduğuna bak. Beyaz çizgi %70\'i gösterir.', before: demoInstruments },
        { screen: 'design', target: '[data-tour="instruments"]', title: 'Alet seçmek', text: 'Her alet için Kapalı, Temel ya da Gelişmiş seçebilirsin. Gelişmiş daha çok görür ama daha ağır, daha pahalı ve daha çok elektrik ister. Altındaki sarı etiketler hangi hedefe yaradığını gösterir.', before: toDesign('payload') },
        { screen: 'design', target: '.main-col .cards', title: 'Seçmeden önce sonucu gör', text: 'Kartlardaki "→" ile başlayan değer, o seçeneği seçersen ne olacağını gösterir. Yeşil yeterli, kırmızı yetersiz demek. Böylece denemeden önce karşılaştırabilirsin.', before: toDesign('power') },
        { screen: 'design', target: '[data-tour="issues"]', title: 'Sorun listesi', text: 'Kırmızı işaretli sorunlar fırlatmayı engeller; önce onları düzelt. Sarı uyarılar engellemez ama puanını düşürebilir. Her sorunun altında nedeni ve çözüm önerisi yazar.', before: toDesign('review') },
        { screen: 'design', target: '[data-act="launch"]', title: 'Fırlat!', text: 'Engelleyici sorun kalmayınca bu düğme açılır. Takımda oynuyorsanız önce herkes tasarımı onaylar. Sonra uçuşu izlersin.', before: toDesign('review') },
        { title: 'Sıra sende!', text: 'Önce eksikleri düzelt, sonra fırlat. Uçuşta ve raporda kısa ipuçları göreceksin. Bir görev başarısız olursa üzülme: rapor nedenini açıklar ve tasarımını geliştirip tekrar deneyebilirsin. İyi uçuşlar!' },
      ],
      flight: [
        { target: '.viz-wrap', title: 'Uçuşunu izle', text: 'Uzay aracın fırlatıldı! Burada roketi, yolculuğu ve yörüngeyi görürsün. Yeşil kesikli çizgi Dünya\'ya veri gönderildiğini gösterir; gezegenin arkasına geçince sinyal kesilir.' },
        { target: '#timeline', title: 'Görevin aşamaları', text: 'Fırlatma, yolculuk, varış ve bilim operasyonu. Turuncu çizgi şu an nerede olduğunu gösterir.' },
        { target: '.controls', title: 'Hızı sen belirle', text: 'Uçuşu duraklatabilir, 2×–8× hızlandırabilir ya da "İleri sar" ile bir sonraki olaya atlayabilirsin.' },
        { target: '#sim-stats', title: 'Aracın durumu', text: 'Kalan para, yakıt, elektrik, Dünya\'ya ulaşan veri ve radyasyon. Bir değer sarı ya da kırmızı olursa tasarımında zayıf bir nokta var demektir.' },
        { target: '#sim-obj', title: 'Bilim ilerlemesi', text: 'Hedeflerin gün gün dolar. Görev bitince puanın bunlara göre hesaplanır.' },
        { title: 'Beklenmedik olaylar', text: 'Yolda güneş fırtınası, arıza ya da bütçe kesintisi gibi sürprizler çıkabilir. O zaman oyun durur ve sorumlu rol karar verir. Her seçeneğin bir bedeli var; altındaki açıklamayı oku. Uçuş şimdi devam ediyor.' },
      ],
      report: [
        { target: '.report-hero', title: 'Görev raporu', text: 'Harf notun (S en iyisi) ve 1000 üzerinden puanın burada. Başlık görevin sonucunu söyler.' },
        { target: '.breakdown', title: 'Puan nereden geldi?', text: 'Bilim, görev başarısı, kaynakları iyi kullanma, takım hedefleri ve bonus. Hangisinde zayıf olduğunu buradan görürsün.' },
        { target: '[data-tour="lessons"]', title: 'Neden böyle oldu?', text: 'En önemli bölüm burası. Ne iyi gitti, ne kötü gitti ve neden: gerçek uzay biliminden basit açıklamalar.' },
        { target: '[data-act="redesign"]', title: 'Tekrar dene', text: '"Tasarımı geliştir" ile aynı tasarıma dönüp değişiklik yapabilirsin. Tek bir doğru tasarım yok: farklı yörünge, roket ya da aletlerle puanını yükseltmeye çalış!' },
      ],
    },
    en: {
      next: 'Next', back: 'Back', done: 'Finish', skip: 'End tour', of: '/', label: 'Guided tour',
      main: [
        { title: 'Welcome to Mission Architect!', text: 'This short tour shows you how to design and fly a space mission. It takes about 2 minutes. You can leave any time with "End tour" and open it again later with "How to play".' },
        { screen: 'title', target: '.scen-grid', title: '1. Pick your mission', text: 'Each card is a different destination: Earth, the Moon, Mars or Jupiter\'s moon Europa. I picked the easiest one, "Wildfire Watch", for your first mission.', before: go(() => { if (S.scenario !== 'earth') { S.scenario = 'earth'; render(); } }) },
        { screen: 'title', target: '.setup-grid', title: '2. Crew and difficulty', text: 'Play alone or as a team of 2–4. In a team everyone has a job. Difficulty sets the budget and how many surprises happen on the way. "Cadet" or "Engineer" is a good first choice.' },
        { screen: 'title', target: '[data-act="start"]', title: '3. Start designing', text: 'When you are ready you press this button. Press "Next" and I will take you to the design screen.' },
        { screen: 'design', target: '#steps', title: 'Design has 8 steps', text: 'Work from left to right: Mission, Orbit, Instruments, Spacecraft, Power, Comms, Launch and Design review. A green mark means fine, yellow is a warning and red is a problem you must fix.', before: toDesign('mission') },
        { screen: 'design', target: '[data-tour="objectives"]', title: 'Read the objectives first', text: 'This is what the mission wants to find out. Starred objectives are primary: every one must reach at least 60% for the mission to succeed. The tags below say which instruments help.', before: toDesign('mission') },
        { screen: 'design', target: '.learn', title: '"Why it matters" boxes', text: 'Every step has one of these boxes explaining the idea in plain words. The "Glossary" in the top bar explains hard words.', before: toDesign('mission') },
        { screen: 'design', target: '[data-tour="resources"]', title: 'Your resources', text: 'Budget, the mass the rocket can lift, electrical power, battery, data, schedule and radiation. Green is good, yellow is close to the limit, red is over. Every choice moves these bars: real engineers balance them too.', before: toDesign('mission') },
        { screen: 'design', target: '[data-tour="capability"]', title: 'Instruments fill the objectives', text: 'The instruments you pick fill these bars. I picked two for you; see how the bars grow. The white line marks 70%.', before: demoInstruments },
        { screen: 'design', target: '[data-tour="instruments"]', title: 'Choosing instruments', text: 'Set each instrument to Off, Basic or Advanced. Advanced sees more but is heavier, costs more and needs more power. The yellow tags show which objective it helps.', before: toDesign('payload') },
        { screen: 'design', target: '.main-col .cards', title: 'See the result before you choose', text: 'The value starting with "→" shows what would happen if you picked that option. Green means enough, red means not enough. Compare before you try.', before: toDesign('power') },
        { screen: 'design', target: '[data-tour="issues"]', title: 'Problem list', text: 'Red problems block the launch, so fix them first. Yellow warnings do not block, but can lower your score. Each problem explains why and how to fix it.', before: toDesign('review') },
        { screen: 'design', target: '[data-act="launch"]', title: 'Launch!', text: 'This button unlocks when no blocking problems are left. In a team, everyone approves the design first. Then you watch the flight.', before: toDesign('review') },
        { title: 'Your turn!', text: 'Fix what is missing, then launch. You will see short tips during the flight and on the report. If a mission fails, don\'t worry: the report explains why, and you can improve your design and try again. Have a great flight!' },
      ],
      flight: [
        { target: '.viz-wrap', title: 'Watch your flight', text: 'Your spacecraft is on its way! Here you see the rocket, the journey and the orbit. The dashed green line means data is being sent to Earth; it stops when the planet blocks the signal.' },
        { target: '#timeline', title: 'Mission phases', text: 'Launch, cruise, arrival and science operations. The orange line shows where you are now.' },
        { target: '.controls', title: 'You control the speed', text: 'Pause, speed up 2×–8×, or use "Skip ahead" to jump to the next event.' },
        { target: '#sim-stats', title: 'Spacecraft status', text: 'Money left, fuel, power, data reaching Earth and radiation. A yellow or red value points to a weak spot in your design.' },
        { target: '#sim-obj', title: 'Science progress', text: 'Your objectives fill up over time. Your score is based on them when the mission ends.' },
        { title: 'Surprises', text: 'Solar storms, failures or budget cuts can happen. The game then pauses and the responsible role decides. Every option has a cost, so read the note below it. The flight continues now.' },
      ],
      report: [
        { target: '.report-hero', title: 'Mission report', text: 'Your letter grade (S is best) and your score out of 1000. The headline tells you how the mission ended.' },
        { target: '.breakdown', title: 'Where did the points come from?', text: 'Science, mission success, using resources well, team goals and bonus. See where you were weakest.' },
        { target: '[data-tour="lessons"]', title: 'Why did it go this way?', text: 'The most important part. What went well, what went wrong and why, explained with real space science.' },
        { target: '[data-act="redesign"]', title: 'Try again', text: '"Improve the design" takes you back to the same design. There is no single right answer: try another orbit, rocket or instruments to raise your score!' },
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
    if (tour) { if (tour === 'main' && screen !== 'title' && screen !== 'design') end(); else schedule(); return; }
    if (screen === 'title' && !seen('main')) setTimeout(() => { if (!tour && S.screen === 'title') start('main'); }, 400);
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
