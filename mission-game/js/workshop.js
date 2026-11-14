'use strict';
/* =========================================================================
   Atölye / Workshop — tek ekran, 4 adımlı tasarım ekranı
   ① Görev (hedefler, yörünge, süre) ② Aletler ③ Uzay aracı (güç, itki, anten) ④ Fırlatma
   - Üstte 5 canlı gösterge (Para, Ağırlık, Elektrik, Veri, Bilim), ortada uzay aracı sahnesi
   - Teknik parçalar (bilgisayar, kalkan, yedeklilik, batarya, yer istasyonu, yakıt yedeği) otomatik seçilir
   - ui.js'teki renderDesignShell / refreshDesign / calc fonksiyonlarını değiştirir (global yeniden atama)
   Bu dosya iki dil klasöründe de AYNIDIR; metinler LANG'e göre seçilir.
   ========================================================================= */
(function () {
  const TXT = {
    tr: {
      steps: { mission: 'Görev', payload: 'Aletler', craft: 'Uzay aracı', launch: 'Fırlatma' },
      g: { money: 'Para', mass: 'Ağırlık', power: 'Elektrik', data: 'Veri', science: 'Bilim' },
      gSub: { money: 'harcanan / bütçe', mass: 'araç / roket sınırı', power: 'gereken / üretilen', data: 'günlük üretilen / giden', science: 'hedeflerin dolu kısmı' },
      st: { ok: 'uygun', warn: 'sınırda', bad: 'aşıldı', low: 'düşük' },
      objectives: 'Hedefler', helps: 'İşe yarayan aletler', orbit: 'Yörünge', duration: 'Görev süresi',
      durNames: ['Kısa', 'Normal', 'Uzun'], months: 'ay',
      oStats: { res: 'Ayrıntı', shadow: 'Gölgede', fuel: 'Yakıt', sci: 'Bilim' },
      capTitle: 'Hedefler ne kadar dolu?', add: 'Ekle', added: 'Eklendi', remove: 'Çıkar', helpsFor: 'Yarar:',
      groups: { power: 'Güç kaynağı', propulsion: 'İtki', antenna: 'Anten' },
      auto: 'Otomatik seçilenler', autoNote: 'Görevine göre otomatik seçildi.',
      autoNames: { computer: 'Bilgisayar', shielding: 'Kalkan', redundancy: 'Yedeklilik', battery: 'Batarya', ground: 'Yer istasyonu' },
      rocket: 'Roket', lifts: 'taşır', fits: 'sığar', tooHeavy: 'çok ağır', reliable: 'güvenilir', vehicle: 'Aracın',
      problems: 'Kontrol listesi', noProblems: 'Sorun yok. Fırlatmaya hazır!', goals: 'Takım hedefleri', approvals: 'Onaylar',
      approve: 'Onayla', approved: 'Onaylandı', launch: 'Görevi fırlat', fixFirst: (n) => `Fırlatmadan önce ${n} sorunu düzelt.`, waitApprovals: 'Herkesin onayı bekleniyor.',
      total: 'Toplam maliyet', reserve: 'Yedek para', next: 'İleri', back: 'Geri', why: 'Neden önemli?', issues: (n) => `${n} sorun`,
      learn: {
        mission: 'Yıldızlı hedefler en önemlileridir. Yakın yörünge daha net görür ama daha çok yakıt ister. Uzun görev daha çok bilim, daha çok masraf demek.',
        payload: 'Her alet bir hedefi doldurur ama para, ağırlık ve elektrik ister. Etiketler hangi hedefe yaradığını gösterir.',
        craft: 'Güneş\'ten uzaklaştıkça paneller zayıflar. Uzak hedefler güçlü motor ve büyük anten ister.',
        launch: 'Roket aracını taşıyabilmeli. Kırmızı sorunlar fırlatmayı engeller, sarılar puanı düşürür.',
      },
    },
    en: {
      steps: { mission: 'Mission', payload: 'Instruments', craft: 'Spacecraft', launch: 'Launch' },
      g: { money: 'Money', mass: 'Mass', power: 'Power', data: 'Data', science: 'Science' },
      gSub: { money: 'spent / budget', mass: 'craft / rocket limit', power: 'needed / made', data: 'made / sent per day', science: 'objectives covered' },
      st: { ok: 'OK', warn: 'close to limit', bad: 'over', low: 'low' },
      objectives: 'Objectives', helps: 'Useful instruments', orbit: 'Orbit', duration: 'Mission length',
      durNames: ['Short', 'Normal', 'Long'], months: 'months',
      oStats: { res: 'Detail', shadow: 'In shadow', fuel: 'Fuel', sci: 'Science' },
      capTitle: 'How full are the objectives?', add: 'Add', added: 'Added', remove: 'Remove', helpsFor: 'Helps:',
      groups: { power: 'Power source', propulsion: 'Propulsion', antenna: 'Antenna' },
      auto: 'Chosen automatically', autoNote: 'Picked for your mission automatically.',
      autoNames: { computer: 'Computer', shielding: 'Shielding', redundancy: 'Redundancy', battery: 'Battery', ground: 'Ground station' },
      rocket: 'Rocket', lifts: 'lifts', fits: 'fits', tooHeavy: 'too heavy', reliable: 'reliable', vehicle: 'Your spacecraft',
      problems: 'Checklist', noProblems: 'No problems. Ready for launch!', goals: 'Team goals', approvals: 'Approvals',
      approve: 'Approve', approved: 'Approved', launch: 'Launch mission', fixFirst: (n) => `Fix ${n} problem(s) before launch.`, waitApprovals: 'Waiting for everyone to approve.',
      total: 'Total cost', reserve: 'Money left', next: 'Next', back: 'Back', why: 'Why it matters', issues: (n) => `${n} problem(s)`,
      learn: {
        mission: 'Starred objectives matter most. A close orbit sees more but needs more fuel. A longer mission means more science and more cost.',
        payload: 'Each instrument fills an objective but costs money, mass and power. Tags show which objective it helps.',
        craft: 'Panels get weaker far from the Sun. Far targets need a strong engine and a big antenna.',
        launch: 'The rocket must lift your craft. Red problems block launch, yellow ones lower your score.',
      },
    },
  };
  const T = TXT[LANG] || TXT.tr;
  const PC = (n) => (LANG === 'tr' ? '%' + Math.round(n) : Math.round(n) + '%'); // Türkçede %40, İngilizcede 40%

  /* ---------- 4 adım ---------- */
  STEPS.splice(0, STEPS.length,
    { id: 'mission', name: T.steps.mission, icon: '', owner: 'MM' },
    { id: 'payload', name: T.steps.payload, icon: '', owner: 'SL' },
    { id: 'craft', name: T.steps.craft, icon: '', owner: 'SE', owners: ['SE', 'CL'] },
    { id: 'launch', name: T.steps.launch, icon: '', owner: 'ALL' });
  Object.assign(LEARN, T.learn);

  /* ---------- azaltılmış seçenekler ---------- */
  const ORBIT_LIST = { earth: ['sso', 'leo400', 'geo'], moon: ['lpo100', 'llo50', 'nrho'], mars: ['mlo', 'melip', 'areo'], europa: ['jflyby', 'eorbit', 'single'] };
  const OPTS = {
    power: { earth: ['deploy3', 'deploy10'], moon: ['deploy3', 'deploy10', 'rtg'], mars: ['deploy3', 'deploy10', 'rtg'], europa: ['huge', 'rtg', 'rtg2'] },
    propulsion: { earth: ['mono', 'biprop'], moon: ['mono', 'biprop'], mars: ['mono', 'biprop'], europa: ['mono', 'biprop'] },
    antenna: { earth: ['mga', 'xhga'], moon: ['mga', 'xhga'], mars: ['xhga', 'kahga'], europa: ['xhga', 'kahga'] },
  };
  const DEFAULTS = {
    earth: { power: 'deploy3', propulsion: 'mono', antenna: 'xhga' },
    moon: { power: 'deploy3', propulsion: 'biprop', antenna: 'xhga' },
    mars: { power: 'deploy10', propulsion: 'biprop', antenna: 'kahga' },
    europa: { power: 'huge', propulsion: 'biprop', antenna: 'kahga' },
  };
  const LAUNCH_LIST = { LEO: ['rideshare', 'small', 'medium'], GEO: ['medium', 'heavy'], MOON: ['medium', 'heavy'], MARS: ['medium', 'heavy'], JUPITER: ['heavy', 'superheavy'] };
  const scenarioOf = (d) => SCENARIOS[S.scenario] || scen();
  const launchClassOf = (sc, d) => ORBITS[d.orbit].launchClass || sc.launchClass;
  function launchersFor(sc, d) {
    return (LAUNCH_LIST[launchClassOf(sc, d)] || []).filter((k) => { const L = LAUNCHERS[k]; return (L.cap[launchClassOf(sc, d)] || 0) > 0 && (!L.onlyOrbit || L.onlyOrbit.includes(d.orbit)); });
  }
  function relevantInstruments(sc) {
    const best = {};
    sc.objectives.forEach((o) => Object.entries(o.needs).forEach(([i, w]) => { best[i] = Math.max(best[i] || 0, w * (o.primary ? 1.2 : 1)); }));
    return Object.keys(best).sort((a, b) => best[b] - best[a]);
  }
  const durations = (sc) => [Math.max(12, Math.round(sc.defaultMonths / 2)), sc.defaultMonths, Math.round(sc.defaultMonths * 1.5)];

  /* Teknik parçaları göreve göre ayarla (kopya üzerinde çalışır) */
  function autoFix(src) {
    const sc = scenarioOf(src), id = sc.id, d = { ...src, instruments: { ...(src.instruments || {}) } };
    const first = !d._ws; d._ws = 1;
    if (first || !ORBIT_LIST[id].includes(d.orbit)) d.orbit = ORBIT_LIST[id][0];
    if (!durations(sc).includes(+d.months)) d.months = sc.defaultMonths;
    d.months = +d.months;
    for (const g of ['power', 'propulsion', 'antenna']) if (first || !OPTS[g][id].includes(d[g])) d[g] = DEFAULTS[id][g];
    for (const k of Object.keys(d.instruments)) if (d.instruments[k] > 1) d.instruments[k] = 1;
    d.structure = 'aluminum'; d.adcs = 'rw'; d.propMargin = '25'; d.aerobrake = false;
    d.computer = id === 'europa' ? 'radhard' : 'radtol';
    d.shielding = id === 'europa' ? 'vault' : id === 'earth' ? 'none' : 'std';
    d.redundancy = id === 'europa' ? 'dual' : 'single';
    d.ground = id === 'mars' || id === 'europa' ? 'dsn' : 'commercial';
    d.battery = 'xl';
    const need = computeDesign(sc, d, S.difficulty).power.battNeed;
    d.battery = ['s', 'm', 'l', 'xl'].find((b) => PARTS.battery.options[b].wh >= need) || 'xl';
    const ls = launchersFor(sc, d);
    if (first || !ls.includes(d.launcher)) {
      const fit = ls.find((k) => { const R = computeDesign(sc, { ...d, launcher: k }, S.difficulty); return R.mass.cap >= R.mass.wet; });
      d.launcher = fit || ls[ls.length - 1];
    }
    return d;
  }
  const _calc = window.calc;
  window.calc = function () { if (S.design) S.design = autoFix(S.design); return _calc(); };
  const whatIf = (patch) => { const d = autoFix({ ...S.design, ...patch, _ws: 1 }); return computeDesign(scenarioOf(d), d, S.difficulty); };

  /* ------------------------------------------------------------------ */
  /* KABUK / SHELL                                                        */
  /* ------------------------------------------------------------------ */
  let prevParts = null, prevVals = {}, prevStatus = {}, lastKey = '';
  window.renderDesignShell = function () {
    const sc = scen();
    prevParts = null; prevVals = {}; prevStatus = {};
    const body = LANG === 'tr' ? sc.bodyTr : sc.body;
    return `<div class="topbar">
        <div class="brand">${LANG === 'tr' ? 'Görev Mimarı' : 'Mission Architect'}</div>
        <div class="mission-name grow">${sc.name} · ${DIFFICULTY[S.difficulty].name}</div>
        <button class="btn small ghost" data-act="share">${LANG === 'tr' ? 'Paylaş' : 'Share'}</button>
        <button class="btn small ghost" data-act="gloss">${LANG === 'tr' ? 'Sözlük' : 'Glossary'}</button>
        <button class="btn small ghost" data-act="help">${LANG === 'tr' ? 'Yardım' : 'Help'}</button>
        <button class="btn small ghost" data-act="exit">✕ ${LANG === 'tr' ? 'Çıkış' : 'Exit'}</button>
        ${langSwitch()}
      </div>
      <div class="ws">
        <div class="ws-gauges" id="ws-gauges" data-tour="resources"></div>
        <div class="ws-stage" id="ws-stage" aria-live="off">
          <div class="ws-stars" aria-hidden="true"></div>
          <img class="ws-planet" src="${planetImage(sc.body)}" alt="">
          <div class="ws-craft" id="ws-craft"></div>
          <div class="ws-info"><b>${body}</b><span id="ws-orbit"></span></div>
          <div class="ws-flags" id="ws-flags"></div>
        </div>
        <nav class="ws-tabs" id="steps" aria-label="${LANG === 'tr' ? 'Tasarım adımları' : 'Design steps'}"></nav>
        <section class="ws-panel" id="main-col"></section>
      </div>`;
  };

  // yapışkan gösterge şeridi üst çubuğun hemen altına otursun (telefonda üst çubuk birkaç satır olabilir)
  function syncTopbar() {
    const tb = document.querySelector('.topbar');
    if (tb) document.documentElement.style.setProperty('--tb-h', tb.offsetHeight + 'px');
  }
  window.addEventListener('resize', syncTopbar);

  window.refreshDesign = function (which = { main: true, side: true }) {
    syncTopbar();
    if (!STEPS.some((s) => s.id === S.step)) S.step = S.step === 'review' ? 'launch' : 'mission';
    const R = calc();
    S.visited[S.step] = true;
    renderTabs(R);
    updateGauges(R);
    renderStage(R);
    if (which.main !== false) {
      const key = S.step;
      $('#main-col').innerHTML = renderPanel(R);
      const panel = $('#main-col');
      if (key !== lastKey && !REDUCED_MOTION) { panel.classList.remove('ws-enter'); void panel.offsetWidth; panel.classList.add('ws-enter'); }
      lastKey = key;
    }
    document.dispatchEvent(new CustomEvent('ma:refresh', { detail: S.step }));
  };

  /* ---------- sekmeler ---------- */
  const ROLE_TAB = { SL: 'payload', SE: 'craft', CL: 'craft', MM: 'launch' };
  function tabState(R, id) {
    const iss = R.issues.filter((i) => ROLE_TAB[i.role] === id && i.level !== 'good');
    if (iss.some((i) => i.level === 'error')) return 'err';
    if (iss.length) return 'warn';
    return S.visited[id] ? 'ok' : '';
  }
  function renderTabs(R) {
    const nav = $('#steps');
    const mark = { ok: '✓', warn: '!', err: '✗', '': '' };
    nav.innerHTML = STEPS.map((s, i) => { const st = tabState(R, s.id); return `<button class="ws-tab ${S.step === s.id ? 'sel' : ''} ${st}" data-act="step" data-v="${s.id}" aria-current="${S.step === s.id ? 'step' : 'false'}">
      <span class="num">${i + 1}</span><span class="lbl">${s.name}</span>${st ? `<span class="mk" aria-hidden="true">${mark[st]}</span>` : ''}</button>`; }).join('') + '<span class="ws-ind" aria-hidden="true"></span>';
    requestAnimationFrame(() => {
      const sel = nav.querySelector('.ws-tab.sel'), ind = nav.querySelector('.ws-ind');
      if (sel && ind) { ind.style.left = sel.offsetLeft + 'px'; ind.style.width = sel.offsetWidth + 'px'; }
    });
  }

  /* ---------- göstergeler ---------- */
  const GAUGES = [
    { k: 'money', val: (R) => R.cost.total, cap: (R) => R.budget, fmt: fmtMoney, ratio: (R) => (R.budget === Infinity ? 0.3 : R.cost.total / R.budget) },
    { k: 'mass', val: (R) => R.mass.wet, cap: (R) => R.mass.cap, fmt: kg, ratio: (R) => (R.mass.cap ? R.mass.wet / R.mass.cap : 2) },
    { k: 'power', val: (R) => R.power.load, cap: (R) => R.power.genAvg, fmt: W_, ratio: (R) => (R.power.genAvg ? R.power.load / R.power.genAvg : 2) },
    { k: 'data', val: (R) => R.data.genDay, cap: (R) => R.data.downDay, fmt: fmtData, ratio: (R) => (R.data.genDay ? (R.data.downDay ? R.data.genDay / R.data.downDay : 2) : 0) },
    { k: 'science', val: (R) => R.sciPotential * 100, cap: () => 100, fmt: (v) => PC(v), ratio: (R) => R.sciPotential, inverse: true },
  ];
  function updateGauges(R) {
    const box = $('#ws-gauges');
    if (!box.children.length) {
      box.innerHTML = GAUGES.map((g) => `<div class="gauge" data-k="${g.k}" title="${T.gSub[g.k]}">
        <div class="g-top"><span class="g-label">${T.g[g.k]}</span><span class="g-st sr-only"></span></div>
        <div class="g-nums"><span class="g-val">–</span>${g.inverse ? '' : '<span class="g-cap"></span>'}</div>
        <div class="g-bar"><i></i></div><div class="g-sub">${T.gSub[g.k]}</div></div>`).join('');
    }
    for (const g of GAUGES) {
      const el = box.querySelector(`[data-k="${g.k}"]`);
      const v = g.val(R), cap = g.cap(R), r = g.ratio(R);
      const st = g.inverse ? (r >= 0.85 ? 'ok' : r >= 0.6 ? 'warn' : 'bad') : (r > 1 ? 'bad' : r > 0.9 ? 'warn' : 'ok');
      el.dataset.st = st;
      el.querySelector('.g-bar i').style.width = Math.max(2, Math.min(100, (g.inverse ? r : Math.min(1, r)) * 100)) + '%';
      const capEl = el.querySelector('.g-cap'); if (capEl) capEl.textContent = '/ ' + (cap === Infinity ? '∞' : g.fmt(cap));
      el.querySelector('.g-st').textContent = g.inverse ? (st === 'ok' ? T.st.ok : T.st.low) : T.st[st];
      tween(el.querySelector('.g-val'), prevVals[g.k], v, g.fmt);
      if (st === 'bad' && prevStatus[g.k] && prevStatus[g.k] !== 'bad' && !REDUCED_MOTION) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
      prevVals[g.k] = v; prevStatus[g.k] = st;
    }
  }
  function tween(el, from, to, fmt) {
    if (from == null || REDUCED_MOTION || !isFinite(from) || !isFinite(to) || from === to) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = 450;
    const step = (now) => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* ---------- sahne ---------- */
  function renderStage(R) {
    const box = $('#ws-craft');
    // 3B (craft3d.js): Three.js hazırsa 3B çiz; yüklenince sahneyi yenile. Olmazsa SVG çizim.
    if (window.Craft3D && Craft3D.ready(() => { if (S.screen === 'design' && $('#ws-craft')) renderStage(calc()); }) && Craft3D.show(box, R)) {
      $('#ws-orbit').textContent = ORBITS[S.design.orbit].short;
      const errs3 = R.errors.length;
      $('#ws-flags').innerHTML = errs3 ? `<button class="ws-flag bad" data-act="step" data-v="launch">${T.issues(errs3)}</button>` : '';
      return;
    }
    box.classList.remove('is3d');
    box.innerHTML = craftSVG(R);
    const parts = [...box.querySelectorAll('[data-part]')].map((g) => g.dataset.part);
    if (!REDUCED_MOTION) box.querySelectorAll('[data-part]').forEach((g, i) => {
      if (!prevParts || !prevParts.has(g.dataset.part)) { g.classList.add('part-new'); g.style.animationDelay = (prevParts ? 0 : i * 70) + 'ms'; }
    });
    prevParts = new Set(parts);
    $('#ws-orbit').textContent = ORBITS[S.design.orbit].short;
    const errs = R.errors.length;
    $('#ws-flags').innerHTML = errs ? `<button class="ws-flag bad" data-act="step" data-v="launch">${T.issues(errs)}</button>` : '';
  }

  /* ------------------------------------------------------------------ */
  /* PANELLER / PANELS                                                    */
  /* ------------------------------------------------------------------ */
  const card = (sel, act, k, v, inner, extra = '') => `<button class="card ${sel ? 'sel' : ''}" data-act="${act}" data-k="${k}" data-v="${v}" aria-pressed="${sel}" ${extra}><span class="check">${sel ? '✓' : ''}</span>${inner}</button>`;
  const learnBox = (id) => `<details class="learn"><summary>${T.why}</summary><div style="margin-top:6px">${LEARN[id]}</div></details>`;
  function nav() {
    const i = STEPS.findIndex((s) => s.id === S.step);
    return `<div class="nav-bottom">${i > 0 ? `<button class="btn" data-act="step" data-v="${STEPS[i - 1].id}">← ${STEPS[i - 1].name}</button>` : '<span></span>'}
      ${i < STEPS.length - 1 ? `<button class="btn primary" data-act="step" data-v="${STEPS[i + 1].id}">${STEPS[i + 1].name} →</button>` : ''}</div>`;
  }
  function renderPanel(R) {
    const head = `<div class="step-head"><h2>${STEPS.find((s) => s.id === S.step).name}</h2>${roleBadgeFor(S.step)}</div>${learnBox(S.step)}`;
    const body = { mission: pMission, payload: pPayload, craft: pCraft, launch: pLaunch }[S.step](R);
    return head + body + nav();
  }
  function roleBadgeFor(id) {
    const st = STEPS.find((s) => s.id === id);
    if (!st || st.owner === 'ALL') return '';
    return (st.owners || [st.owner]).map((r) => roleBadge(r)).join(' ');
  }

  function pMission(R) {
    const sc = scen(), d = S.design;
    const objs = sc.objectives.map((o) => {
      // sade: sadece hedefin adı (hangi aletin yaradığı alet kartlarında yazıyor)
      return `<li><span class="ws-star">${o.primary ? '⭐' : '☆'}</span><div><b>${o.name}</b></div></li>`;
    }).join('');
    const orbits = ORBIT_LIST[sc.id].map((k) => {
      const o = ORBITS[k], a = whatIf({ orbit: k });
      const inner = `<span class="name">${o.name}</span><span class="desc">${o.desc}</span>
        ${R.insts.length ? `<span class="stats"><span class="stat ${a.sciPotential >= 0.85 ? 'good' : a.sciPotential < 0.6 ? 'bad' : ''}">${T.oStats.sci} ${PC(a.sciPotential * 100)}</span></span>` : ''}`;
      return card(d.orbit === k, 'set', 'orbit', k, inner);
    }).join('');
    const dur = durations(sc).map((m, i) => `<button data-act="ws-months" data-v="${m}" class="${+d.months === m ? 'sel' : ''}" aria-pressed="${+d.months === m}">${T.durNames[i]} · ${m} ${T.months}</button>`).join('');
    return `<div class="ws-grid2">
      <div class="panel pad" data-tour="objectives"><div class="row" style="align-items:flex-start;gap:14px"><img src="${planetImage(sc.body)}" alt="" width="56" height="56"><div><h3>${sc.name}</h3><p class="muted ws-small">${sc.brief}</p></div></div>
        <h3 style="margin-top:14px">${T.objectives}</h3><ul class="ws-objs">${objs}</ul></div>
      <div class="ws-col"><div><h3>${T.orbit}</h3><div class="ws-cards" data-tour="orbits">${orbits}</div></div>
        <div><h3>${T.duration}</h3><div class="seg ws-dur">${dur}</div></div></div>
    </div>`;
  }

  function pPayload(R) {
    const sc = scen(), d = S.design;
    const cards = relevantInstruments(sc).map((id) => {
      const I = INSTRUMENTS[id], on = (d.instruments[id] || 0) > 0;
      // sade: sadece en çok yaradığı (en fazla 2) hedef
      const uses = sc.objectives.filter((o) => (o.needs[id] || 0) >= 0.25).sort((a, b) => (b.needs[id] || 0) - (a.needs[id] || 0)).slice(0, 2).map((o) => `<span class="chip ${o.primary ? 'primary' : ''}">${o.primary ? '⭐' : '☆'} ${o.name}</span>`).join('');
      const inner = `<span class="ws-ic" data-icons>${I.icon}</span><span class="name">${I.name}</span><span class="desc">${I.desc}</span>
        <span class="stats"><span class="stat">$${I.cost}M</span><span class="stat">${I.mass} kg</span><span class="stat">${I.power} W</span></span>
        <span class="use">${uses}</span><span class="ws-tog">${on ? '✓ ' + T.added : '+ ' + T.add}</span>`;
      return card(on, 'inst', id, on ? 0 : 1, inner);
    }).join('');
    return `<div class="panel pad" data-tour="capability"><h3 style="margin-bottom:10px">${T.capTitle}</h3>${objBars(R.objectives)}</div>
      <div class="ws-cards" data-tour="instruments">${cards}</div>`;
  }

  function pCraft(R) {
    const sc = scen(), d = S.design;
    const group = (g, preview) => `<div class="group"><h3>${T.groups[g]}</h3><div class="ws-cards">${OPTS[g][sc.id].map((k) => {
      const o = PARTS[g].options[k];
      const inner = `<span class="name">${o.name}</span><span class="desc">${o.desc}</span><span class="stats">${o.cost ? `<span class="stat">$${o.cost}M</span>` : ''}${preview(k)}</span>`;
      return card(d[g] === k, 'set', g, k, inner);
    }).join('')}</div></div>`;
    const prevPower = (k) => { const a = whatIf({ power: k }); return `<span class="stat ${a.power.genAvg >= a.power.load ? 'good' : 'bad'}">→ ${W_(a.power.genAvg)}</span>`; };
    const prevProp = (k) => { const a = whatIf({ propulsion: k }); return `<span class="stat ${a.mass.cap && a.mass.wet <= a.mass.cap ? '' : 'bad'}">→ ${kg(a.mass.wet)}</span>`; };
    const prevAnt = (k) => { const a = whatIf({ antenna: k }); return `<span class="stat ${a.data.ratio >= 1 ? 'good' : 'bad'}">→ ${fmtData(a.data.downDay)}/${LANG === 'tr' ? 'gün' : 'day'}</span>`; };
    const autoRow = ['computer', 'shielding', 'redundancy', 'battery', 'ground'].map((g) => `<span class="chip">${T.autoNames[g]}: ${PARTS[g].options[d[g]].name}</span>`).join('');
    return `<div data-tour="craft" class="ws-col">${group('power', prevPower)}${group('propulsion', prevProp)}${group('antenna', prevAnt)}</div>
      <details class="panel pad ws-auto"><summary><b>${T.auto}</b></summary><p class="muted ws-small">${T.autoNote}</p><div class="role-chips">${autoRow}</div></details>`;
  }

  function pLaunch(R) {
    const sc = scen(), d = S.design, lc = launchClassOf(sc, d);
    const rockets = launchersFor(sc, d).map((k) => {
      const L = LAUNCHERS[k], cap = L.cap[lc] || 0, fits = cap >= R.mass.wet;
      const inner = `<span class="name">${L.name}</span><span class="desc">${L.desc}</span>
        <span class="stats"><span class="stat">$${L.cost}M</span>
        <span class="stat ${fits ? 'good' : 'bad'}">${fits ? T.fits : T.tooHeavy}</span></span>`;
      return card(d.launcher === k, 'set', 'launcher', k, inner);
    }).join('');
    const ps = players(), errs = R.errors.length;
    const allOK = S.mode === 'solo' || ps.every((p) => S.approvals[p.idx]);
    const list = R.issues.filter((i) => i.level !== 'good');
    const issues = list.length ? issueList(list, true) : `<div class="issue good"><span>✅</span><div>${T.noProblems}</div></div>`;
    const goals = Object.values(ROLES).map((r) => `<span class="chip" style="border-color:${r.color};color:${r.color}">${R.roleGoals[r.id] ? '✓' : '✗'} ${r.short}</span>`).join('');
    const appr = S.mode === 'team' ? `<div class="panel pad"><h3 style="margin-bottom:10px">${T.approvals}</h3><div class="approve-grid">${ps.map((p) => `<div class="approve ${S.approvals[p.idx] ? 'ok' : ''}"><b>${esc(p.name)}</b>
        <button class="btn small ${S.approvals[p.idx] ? '' : 'primary'}" data-act="approve" data-v="${p.idx}">${S.approvals[p.idx] ? '✓ ' + T.approved : T.approve}</button></div>`).join('')}</div></div>` : '';
    return `<div><h3>${T.rocket}</h3><p class="muted ws-small">${T.vehicle}: ${kg(R.mass.wet)} → ${DEST_NAME[lc]}</p><div class="ws-cards">${rockets}</div></div>
      <div class="ws-grid2">
        <div class="panel pad" data-tour="issues"><h3 style="margin-bottom:10px">${T.problems}</h3>${issues}</div>
        <div class="ws-col">
          <div class="panel pad"><div class="kv"><span>${T.total}</span><span>${fmtMoney(R.cost.total)}</span><span>${T.reserve}</span><span class="${R.cost.reserve < 0 ? 'bad' : ''}">${fmtMoney(R.cost.reserve)}</span></div>
            <h3 style="margin:12px 0 8px">${T.goals}</h3><div class="role-chips">${goals}</div></div>
          ${appr}
          <div class="panel pad ws-launchbox">${errs ? `<p class="bad">${T.fixFirst(errs)}</p>` : !allOK ? `<p class="warn">${T.waitApprovals}</p>` : ''}
            <button class="btn go big" data-act="launch" ${errs || !allOK ? 'disabled' : ''}>${T.launch}</button></div>
        </div>
      </div>`;
  }

  /* ---------- olaylar ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act="ws-months"]');
    if (!el || S.screen !== 'design') return;
    const O = window.MA_ONLINE;
    if (O && O.code && O.canEdit && !O.canEdit('months')) { toast(LANG === 'tr' ? 'Bu ayar Görev Yöneticisi\'nin görevinde.' : 'This setting belongs to the Mission Manager.'); return; }
    S.design.months = +el.dataset.v;
    onDesignChange();
  });

  // ui.js açılışta tasarım ekranını eski arayüzle çizmiş olabilir (dil değişimi sonrası): yeniden çiz
  if (typeof S !== 'undefined' && S.screen === 'design') render();
})();
