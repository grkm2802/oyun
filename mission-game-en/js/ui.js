'use strict';
/* =========================================================================
   UI: title → design workspace → flight simulation → mission report
   ========================================================================= */

const LANG = 'en';
const S = {
  screen: 'title', mode: 'solo', nPlayers: 2, names: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
  difficulty: 'normal', scenario: 'earth', design: null, step: 'mission', approvals: {}, visited: {},
  sim: null, ui: null, history: [], result: null, shared: null,
};

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (x) => (isFinite(x) ? Math.round(x * 100) + '%' : '—');
const kg = (x) => (x >= 10000 ? (x / 1000).toFixed(1) + ' t' : Math.round(x) + ' kg');
const W_ = (x) => (x >= 10000 ? (x / 1000).toFixed(1) + ' kW' : Math.round(x) + ' W');

function players() {
  const n = S.mode === 'solo' ? 1 : S.nPlayers;
  return ROLE_SPLIT[n].map((roles, i) => ({ idx: i, name: S.names[i] || `Player ${i + 1}`, roles }));
}
function ownerOf(role) { return players().find((p) => p.roles.includes(role)); }
function roleBadge(role, withName = true) {
  if (role === 'ALL') return `<span class="owner" style="border-color:var(--line2)">👥 Whole team</span>`;
  const r = ROLES[role], p = ownerOf(role);
  return `<span class="owner" style="border-color:${r.color};color:${r.color}">${r.icon} ${r.name}${withName && S.mode === 'team' ? ' · ' + esc(p.name) : ''}</span>`;
}
function scen() { return SCENARIOS[S.scenario]; }
function calc() { return computeDesign(scen(), S.design, S.difficulty); }

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------------- persistence ---------------- */
function loadBoard() { try { return JSON.parse(localStorage.getItem('ma_board') || '[]'); } catch { return []; } }
function saveBoard(b) { try { localStorage.setItem('ma_board', JSON.stringify(b.slice(0, 60))); } catch { /* storage unavailable */ } }
function encodeDesign() {
  const json = JSON.stringify({ v: 1, s: S.scenario, f: S.difficulty, d: S.design });
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeDesign(code) {
  try {
    const b = code.trim().replace(/^.*#design=/, '').replace(/-/g, '+').replace(/_/g, '/');
    const o = JSON.parse(decodeURIComponent(escape(atob(b))));
    if (!SCENARIOS[o.s] || !o.d) return null;
    return o;
  } catch { return null; }
}

/* =========================================================================
   RENDER ROOT
   ========================================================================= */
function render() {
  if (S.screen !== 'sim' && S.ui) { cancelAnimationFrame(S.ui.raf); S.ui = null; }
  const app = $('#app');
  if (S.screen === 'title') app.innerHTML = renderTitle();
  else if (S.screen === 'design') { app.innerHTML = renderDesignShell(); refreshDesign(); }
  else if (S.screen === 'sim') { app.innerHTML = renderSimShell(); startSimLoop(); }
  else if (S.screen === 'report') app.innerHTML = renderReport();
  window.scrollTo(0, 0);
}

/* =========================================================================
   TITLE SCREEN
   ========================================================================= */
function renderTitle() {
  const ps = players();
  const board = loadBoard();
  const crew = S.mode === 'solo'
    ? `<p class="muted" style="margin:10px 0 0">You will play all four roles: Mission Manager, Spacecraft Engineer, Science Lead and Communications Lead.</p>`
    : `<div class="row wrap" style="margin-top:12px"><span class="muted">Players:</span>
        <div class="seg">${[2, 3, 4].map((n) => `<button data-act="nplayers" data-v="${n}" class="${S.nPlayers === n ? 'sel' : ''}">${n}</button>`).join('')}</div></div>
       <div class="players">${ps.map((p) => `<div class="player-row">
          <input data-name="${p.idx}" value="${esc(p.name)}" maxlength="18" aria-label="Player ${p.idx + 1} name">
          <div class="role-chips">${p.roles.map((r) => `<span class="chip" style="border-color:${ROLES[r].color};color:${ROLES[r].color}">${ROLES[r].icon} ${ROLES[r].name}</span>`).join('')}</div>
        </div>`).join('')}</div>
       <p class="muted" style="font-size:13px;margin:10px 0 0">Pass the device around: each role owns part of the design and must approve it before launch. During flight, the responsible role decides on emergencies.</p>`;

  return `<div class="title-wrap">
    <div class="row" style="justify-content:flex-end">${langSwitch()}</div>
    <div class="hero">
      <div class="tag">A space mission design game</div>
      <h1>Mission Architect</h1>
      <p>Pick a destination, design the spacecraft, choose the rocket — then fly it. Every choice changes the mass, power, budget, data and risk of your mission.</p>
    </div>

    <div class="section-title"><span class="n">1</span> Choose your mission</div>
    <div class="scen-grid">
      ${Object.values(SCENARIOS).map((sc) => `<button class="scen ${S.scenario === sc.id ? 'sel' : ''}" data-act="scen" data-v="${sc.id}">
        <div class="icon"><img src="${planetImage(sc.body)}" alt="" width="72" height="72"></div>
        <h3>${sc.name}</h3>
        <div class="tag">${sc.tagline}</div>
        <p>${sc.brief}</p>
        <div class="meta"><span class="chip">${sc.level}</span><span class="chip">💰 ${fmtMoney(sc.budget)}</span><span class="chip">${sc.body}</span></div>
      </button>`).join('')}
    </div>

    <div class="setup-grid" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><span class="n">2</span> Crew</div>
        <div class="seg">
          <button data-act="mode" data-v="solo" class="${S.mode === 'solo' ? 'sel' : ''}">👤 Solo</button>
          <button data-act="mode" data-v="team" class="${S.mode === 'team' ? 'sel' : ''}">👥 Team (2–4)</button>
        </div>
        ${crew}
      </div>
      <div class="panel">
        <div class="section-title"><span class="n">3</span> Difficulty</div>
        <div class="choice-list">
          ${Object.entries(DIFFICULTY).map(([k, d]) => `<button class="choice ${S.difficulty === k ? 'sel' : ''}" data-act="diff" data-v="${k}">
            <span style="font-size:20px">${d.icon}</span><span><b>${d.name}</b><small>${d.desc}</small></span></button>`).join('')}
        </div>
      </div>
    </div>

    <div class="start-bar">
      <button class="btn primary big" data-act="start">🛠️ Start designing</button>
      <button class="btn big" data-act="help">❓ How to play</button>
      <button class="btn big" data-act="gloss">📖 Glossary</button>
      <button class="btn big" data-act="loadcode">🔗 Load a shared design</button>
    </div>
    ${S.shared ? `<div class="panel pad" style="margin-top:16px;text-align:center">A shared design for <b>${SCENARIOS[S.shared.s].name}</b> was found in the link. <button class="btn small primary" data-act="useshared">Open it</button></div>` : ''}

    <div class="panel pad lb" style="margin-top:22px">
      <div class="row sp"><h3>🏆 Mission leaderboard</h3>${board.length ? '<button class="btn small ghost" data-act="lbclear">Clear</button>' : ''}</div>
      ${board.length ? `<table style="margin-top:8px"><thead><tr><th>#</th><th>Crew</th><th>Mission</th><th>Level</th><th>Outcome</th><th>Score</th></tr></thead><tbody>
        ${board.slice().sort((a, b) => b.ranked - a.ranked).slice(0, 10).map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.crew)}</td><td>${SCENARIOS[r.s]?.icon || ''} ${esc(r.mission)}</td><td>${esc(r.level)}</td><td>${esc(r.outcome)}</td><td class="mono"><b>${r.ranked}</b> <span class="dim">(${r.grade})</span></td></tr>`).join('')}
      </tbody></table>` : '<p class="muted">No missions flown yet on this device. Be the first!</p>'}
    </div>
    <div class="footer">Built for the NASA Space Apps Challenge · Space Mission Design Game. Numbers are simplified for learning but keep real-world proportions.</div>
  </div>`;
}

/* =========================================================================
   DESIGN WORKSPACE
   ========================================================================= */
function renderDesignShell() {
  const sc = scen();
  return `<div class="topbar">
      <div class="brand">🛰️ Mission Architect</div>
      <div class="mission-name grow">${sc.icon} ${sc.name} · ${DIFFICULTY[S.difficulty].icon} ${DIFFICULTY[S.difficulty].name}</div>
      <button class="btn small ghost" data-act="share">🔗 Share</button>
      <button class="btn small ghost" data-act="gloss">📖 Glossary</button>
      <button class="btn small ghost" data-act="help">Help</button>
      <button class="btn small ghost" data-act="exit">✕ Exit</button>
      ${langSwitch()}
    </div>
    <nav class="steps" id="steps"></nav>
    <div class="design">
      <div class="main-col" id="main-col"></div>
      <aside class="side-col" id="side-col"></aside>
    </div>`;
}

function refreshDesign(which = { main: true, side: true }) {
  const R = calc();
  S.visited[S.step] = true;
  $('#steps').innerHTML = renderSteps(R);
  if (which.main) $('#main-col').innerHTML = renderStep(R);
  if (which.side) $('#side-col').innerHTML = renderDashboard(R);
}

function stepStatus(R, step) {
  const map = { payload: ['SL'], bus: ['SE'], power: ['SE'], comms: ['CL'], launch: ['MM'] };
  const roles = map[step];
  if (!roles) return S.visited[step] ? 'ok' : '';
  const iss = R.issues.filter((i) => roles.includes(i.role));
  if (iss.some((i) => i.level === 'error')) return 'err';
  if (iss.some((i) => i.level === 'warn')) return 'warn';
  return S.visited[step] ? 'ok' : '';
}

function renderSteps(R) {
  return STEPS.map((st, i) => `<button class="step ${S.step === st.id ? 'sel' : ''}" data-act="step" data-v="${st.id}">
    <span class="dot ${stepStatus(R, st.id)}" ${stepStatus(R, st.id) ? `role="img" aria-label="${{ err: 'blocking problem', warn: 'warning', ok: 'done' }[stepStatus(R, st.id)]}"` : ''}></span><span>${i + 1}. ${st.name}</span></button>`).join('');
}

function stepHeader(st, sub) {
  return `<div class="step-head"><div><h2>${st.name}</h2>${sub ? `<div class="muted" style="margin-top:4px">${sub}</div>` : ''}</div>${roleBadge(st.owner)}</div>
    <details class="learn" ${DIFFICULTY[S.difficulty].hints ? 'open' : ''}><summary>📘 Why it matters</summary><div style="margin-top:6px">${LEARN[st.id]}</div></details>`;
}

function stat(text, cls = '') { return `<span class="stat ${cls}">${text}</span>`; }

/* Option cards for one PARTS group. preview(key) → extra stat html */
function optionGroup(group, preview, filter) {
  const G = PARTS[group];
  const hide = DIFFICULTY[S.difficulty].hideAdv;
  const cur = String(S.design[group]);
  const entries = Object.entries(G.options).filter(([k, o]) => (!hide || !o.adv || cur === k) && (!filter || filter(k, o)));
  return `<div class="group"><h3>${G.label}</h3><div class="cards">
    ${entries.map(([k, o]) => `<button class="card ${cur === k ? 'sel' : ''}" data-act="set" data-k="${group}" data-v="${k}" aria-pressed="${cur === k}">
      <span class="check">${cur === k ? '✓' : ''}</span>
      <span class="name">${o.name}${o.adv ? '<span class="badge-adv">adv</span>' : ''}</span>
      <span class="desc">${o.desc || ''}</span>
      <span class="stats">${partStats(group, o)}${preview ? preview(k, o) : ''}</span>
    </button>`).join('')}
  </div></div>`;
}

function partStats(group, o) {
  const s = [];
  if (o.mass != null && o.mass > 0) s.push(stat('⚖️ ' + o.mass + ' kg'));
  if (o.power) s.push(stat('⚡ ' + o.power + ' W'));
  if (o.cost != null && o.cost > 0) s.push(stat('💰 $' + o.cost + 'M'));
  if (o.dev) s.push(stat('⏱️ +' + o.dev + ' mo'));
  if (group === 'structure') s.push(stat('frame ' + Math.round(o.frac * 100) + '% of mass'));
  if (group === 'computer') s.push(stat('☢️ ' + o.radTol + ' krad'), stat('💾 ' + fmtData(o.storage * 1000)));
  if (group === 'propulsion' && o.isp) s.push(stat('Isp ' + o.isp + ' s'));
  if (group === 'battery') s.push(stat('🔋 ' + o.wh + ' Wh'));
  if (group === 'ground') s.push(stat(o.hours + ' h/day'), stat('$' + o.perYear + 'M/yr'));
  if (group === 'redundancy' && o.spares) s.push(stat(o.spares + ' spare units'));
  if (group === 'shielding' && o.factor < 1) s.push(stat('dose ×' + o.factor));
  return s.join('');
}

/* Evaluate a hypothetical change to show its consequence on the card */
function whatIf(patch) { return computeDesign(scen(), { ...S.design, ...patch }, S.difficulty); }

function renderStep(R) {
  const st = STEPS.find((s) => s.id === S.step);
  const sc = scen();
  const idx = STEPS.indexOf(st);
  const nav = `<div class="nav-bottom">
      ${idx > 0 ? `<button class="btn" data-act="step" data-v="${STEPS[idx - 1].id}">← ${STEPS[idx - 1].name}</button>` : '<span></span>'}
      ${idx < STEPS.length - 1 ? `<button class="btn primary" data-act="step" data-v="${STEPS[idx + 1].id}">${STEPS[idx + 1].name} →</button>` : ''}
    </div>`;
  let body = '';

  if (st.id === 'mission') {
    const hints = DIFFICULTY[S.difficulty].hints;
    const flyby = R.orbit.maxOps;
    body = `${stepHeader(st, sc.tagline + ' · ' + sc.body)}
      <div class="panel pad"><div class="row" style="gap:16px;align-items:flex-start"><div style="font-size:54px">${sc.icon}</div>
        <div><h3 style="font-size:22px">${sc.name}</h3><p style="margin:6px 0 0">${sc.brief}</p>
        <div class="row wrap" style="margin-top:10px"><span class="chip">💰 Budget cap ${fmtMoney(R.budget)}</span><span class="chip">⏱️ Ready to launch in ${sc.deadline} months</span>
        ${sc.window ? `<span class="chip">🪟 Launch window every ${sc.window} months</span>` : ''}${sc.cruise ? `<span class="chip">🛰️ Cruise ~${sc.cruise} months</span>` : ''}</div></div></div></div>
      <div class="panel pad"><h3 style="margin-bottom:10px">🎯 Science objectives</h3>
        <div class="choice-list">${sc.objectives.map((o) => `<div class="choice" style="cursor:default">
          <span style="font-size:20px">${o.primary ? '⭐' : '☆'}</span>
          <span class="grow"><b>${o.name}</b>
          <small>${o.primary ? '<span class="chip primary">Primary</span> ' : '<span class="chip">Secondary</span> '}worth ${o.weight}% of science · needs ${o.months} months of observations</small>
          ${hints ? `<div class="use" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">${Object.keys(o.needs).map((k) => `<span class="chip">${INSTRUMENTS[k].icon} ${INSTRUMENTS[k].name}</span>`).join('')}</div>` : ''}</span></div>`).join('')}
        </div>
        <p class="muted" style="font-size:13px;margin:10px 0 0">The mission succeeds if every ⭐ primary objective reaches at least 60%.</p>
      </div>
      <div class="panel pad"><h3>⏳ Planned science operations</h3>
        ${flyby ? `<p class="muted">A flyby only gives about ${flyby} month of close observations — duration is fixed by physics.</p>` : `
        <div class="slider-row" style="margin-top:10px"><input type="range" min="6" max="120" step="3" value="${S.design.months}" data-act="months" aria-label="Mission duration in months">
        <b class="mono" id="months-lbl" style="min-width:110px">${S.design.months} months</b></div>
        <p class="muted" style="font-size:13px;margin:6px 0 0">Longer missions gather more science but cost <b>${fmtMoney(sc.opsPerYear + opt('ground', S.design.ground).perYear)}</b> per year in operations and need more propellant for station-keeping.</p>`}
      </div>
      <div class="panel pad"><h3 style="margin-bottom:10px">👥 Team roles & personal goals</h3>
        <div class="choice-list">${Object.values(ROLES).map((r) => `<div class="goal"><span class="ri" style="color:${r.color}"></span><div class="grow"><b style="color:${r.color}">${r.name}${S.mode === 'team' ? ' · ' + esc(ownerOf(r.id).name) : ''}</b><div class="muted" style="font-size:13px">${r.goal}</div></div><span>${R.roleGoals[r.id] ? '✅' : '⬜'}</span></div>`).join('')}</div>
        <p class="muted" style="font-size:13px;margin:10px 0 0">Goals often conflict — more instruments please the Science Lead but strain the Engineer's power and mass margins. Negotiate!</p>
      </div>`;
  }

  if (st.id === 'orbit') {
    body = `${stepHeader(st, 'Where exactly will your spacecraft fly?')}
      <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">
      ${sc.orbits.map((k) => {
        const o = ORBITS[k], sel = S.design.orbit === k;
        const alt = whatIf({ orbit: k });
        return `<button class="card ${sel ? 'sel' : ''}" data-act="set" data-k="orbit" data-v="${k}">
          <span class="check">${sel ? '✓' : ''}</span>
          <span class="name">${o.name}</span><span class="desc">${o.desc}</span>
          <span class="pros"><span class="good">＋ ${o.pros.join(' · ')}</span><span class="warn">－ ${o.cons.join(' · ')}</span></span>
          <span class="stats">
            ${stat('Δv in ' + o.insertDv + ' m/s')}${stat('keep ' + o.skDv + ' m/s/yr')}${stat('🌑 eclipse ' + Math.round(o.eclipse * 100) + '%')}
            ${stat('🔎 res ×' + o.res)}${stat('☢️ ' + o.rad + ' krad/yr')}${o.natLife < 99 ? stat('decays ~' + (o.natLife < 1 ? Math.round(o.natLife * 12) + ' mo' : o.natLife + ' yr'), o.natLife < 2 ? 'bad' : '') : ''}
            ${stat('science potential ' + pct(alt.sciPotential), alt.sciPotential >= R.sciPotential ? 'good' : '')}
          </span></button>`;
      }).join('')}</div>
      ${R.orbit.aerobrake ? `<div class="panel pad"><label class="toggle"><input type="checkbox" data-act="aero" ${S.design.aerobrake ? 'checked' : ''}>
        <span><b>🌬️ Use aerobraking</b><br><span class="muted" style="font-size:13px">Dip through the upper atmosphere hundreds of times to slow down. Saves ~1000 m/s of Δv (much less propellant) but adds ~6 months before science starts and carries some risk.</span></span></label></div>` : ''}`;
  }

  if (st.id === 'payload') {
    const hints = DIFFICULTY[S.difficulty].hints;
    body = `${stepHeader(st, 'Choose what your spacecraft will measure.')}
      <div class="panel pad"><h3 style="margin-bottom:10px">Objective capability</h3>${objBars(R.objectives)}</div>
      <div class="inst-list">
      ${Object.entries(INSTRUMENTS).map(([id, I]) => {
        const t = S.design.instruments[id] || 0;
        const uses = sc.objectives.filter((o) => o.needs[id]);
        return `<div class="inst ${t ? 'on' : ''}">
          <div class="ic" data-icons>${I.icon}</div>
          <div><b>${I.name}</b> <span class="muted" style="font-size:13px">— ${I.desc}</span>
            <div class="stats" style="margin-top:6px">${stat('⚖️ ' + I.mass + ' kg')}${stat('⚡ ' + I.power + ' W')}${stat('💰 $' + I.cost + 'M')}${stat('📦 ' + fmtData(I.data) + '/day')}${I.fine ? stat('🎯 needs fine pointing') : ''}</div>
            ${hints ? `<div class="use">${uses.length ? uses.map((o) => `<span class="chip ${o.primary ? 'primary' : ''}">${o.primary ? '⭐' : '☆'} ${o.name}</span>`).join('') : '<span class="chip dim">Not useful for this mission</span>'}</div>` : ''}
          </div>
          <div class="seg" role="group" aria-label="${I.name} level">
            ${[0, 1, 2].map((v) => `<button data-act="inst" data-k="${id}" data-v="${v}" class="${t === v ? 'sel' : ''}">${['Off', 'Basic', 'Advanced'][v]}</button>`).join('')}
          </div></div>`;
      }).join('')}</div>
      <p class="muted" style="font-size:13px">Advanced = ×1.35 capability, but ×1.6 mass & power, ×1.9 cost and ×2.5 data.</p>`;
  }

  if (st.id === 'bus') {
    body = `${stepHeader(st, 'Build the spacecraft that carries and supports your instruments.')}
      <div class="panel pad"><div class="kv">
        <span>Δv needed (insertion + station-keeping)</span><span>${Math.round(R.dv.insert)} + ${Math.round(R.dv.sk)} m/s</span>
        <span>Δv carried (with reserve)</span><span>${Math.round(R.dv.cap)} m/s</span>
        <span>Dry mass → propellant</span><span>${kg(R.mass.dry)} → ${kg(R.mass.propMass)}</span>
        <span>Radiation expected / computer tolerance</span><span class="${R.rad.missionDose > R.rad.tol ? 'bad' : 'good'}">${Math.round(R.rad.missionDose)} / ${R.rad.tol} krad</span>
      </div></div>
      ${optionGroup('structure')}
      ${optionGroup('computer')}
      ${optionGroup('adcs', (k, o) => (o.nearEarth && sc.body !== 'Earth' ? stat('✗ no magnetic field here', 'bad') : ''))}
      ${optionGroup('propulsion', (k) => { const a = whatIf({ propulsion: k }); return a.mass.propMass > 0 || R.dv.need > 0 ? stat('→ propellant ' + (PARTS.propulsion.options[k].isp ? kg(a.mass.propMass) : '✗'), PARTS.propulsion.options[k].isp ? '' : 'bad') : ''; })}
      ${optionGroup('propMargin', (k) => { const a = whatIf({ propMargin: k }); return stat('Δv ' + Math.round(a.dv.cap) + ' m/s'); })}
      ${optionGroup('shielding', (k) => { const a = whatIf({ shielding: k }); return stat('☢️ ' + Math.round(a.rad.missionDose) + ' krad', a.rad.missionDose > a.rad.tol ? 'bad' : 'good'); })}
      ${optionGroup('redundancy')}`;
  }

  if (st.id === 'power') {
    const P = R.power;
    body = `${stepHeader(st, `Sunlight at ${sc.body}: ${Math.round(100 / (sc.sunAU * sc.sunAU))}% of Earth's.`)}
      ${optionGroup('power', (k, o) => { const a = whatIf({ power: k }); return stat('→ ' + W_(a.power.genAvg) + ' avg', a.power.genAvg >= a.power.load ? 'good' : 'bad'); })}
      ${optionGroup('battery', (k, o) => stat(o.wh >= P.battNeed ? '✓ covers eclipse' : '✗ too small', o.wh >= P.battNeed ? 'good' : 'bad'))}
      <div class="panel pad"><h3 style="margin-bottom:8px">⚡ Power budget (orbit average)</h3>
        <table class="budget">
          <tr><td>Computer, pointing, propulsion & heaters</td><td>${W_(P.busLoad)}</td></tr>
          <tr><td>Instruments</td><td>${W_(P.instLoad)}</td></tr>
          <tr><td>Radio (while transmitting ${R.data.hours.toFixed(1)} h/day)</td><td>${W_(P.antAvg)}</td></tr>
          <tr class="total"><td>Total demand</td><td>${W_(P.load)}</td></tr>
          <tr><td>${P.rtg ? 'RTG output' : `Solar output at ${sc.body} × sunlit fraction (${pct(1 - R.orbit.eclipse)})`}</td><td>${W_(P.genAvg)}</td></tr>
          <tr class="total"><td>Margin</td><td class="${P.margin < 0 ? 'bad' : P.margin < 0.15 ? 'warn' : 'good'}">${pct(P.margin)}</td></tr>
          <tr><td>Battery needed / installed</td><td class="${P.batt < P.battNeed ? 'bad' : 'good'}">${Math.round(P.battNeed)} / ${P.batt} Wh</td></tr>
        </table></div>`;
  }

  if (st.id === 'comms') {
    const D = R.data;
    const distTxt = sc.distAU < 0.001 ? '~1,000 km (ground pass)' : sc.distAU < 0.01 ? '384,000 km' : sc.distAU + ' AU (' + Math.round(sc.distAU * 150) + ' million km)';
    body = `${stepHeader(st, 'Get the science data home.')}
      ${optionGroup('antenna', (k) => { const a = whatIf({ antenna: k }); return stat('→ ' + fmtData(a.data.downDay) + '/day', a.data.ratio >= 1 ? 'good' : 'bad'); })}
      ${optionGroup('ground', (k) => { const a = whatIf({ ground: k }); return stat('→ ' + fmtData(a.data.downDay) + '/day', a.data.ratio >= 1 ? 'good' : 'bad'); })}
      <div class="panel pad"><h3 style="margin-bottom:8px">📡 Link budget</h3>
        <table class="budget">
          <tr><td>Distance to Earth</td><td>${distTxt}</td></tr>
          <tr><td>Data rate</td><td>${fmtRate(D.rate)}${D.pointOK < 1 ? ' <span class="bad">(pointing loss)</span>' : ''}</td></tr>
          <tr><td>Contact time per day</td><td>${D.hours.toFixed(1)} h</td></tr>
          <tr class="total"><td>Downlink capacity</td><td>${fmtData(D.downDay)}/day</td></tr>
          <tr><td>Science data generated${D.duty < 1 ? ` (instruments on ${pct(D.duty)} of the time)` : ''}</td><td>${fmtData(D.genDay)}/day</td></tr>
          <tr class="total"><td>Share of data that can reach Earth</td><td class="${D.ratio >= 1 ? 'good' : 'bad'}">${D.genDay ? pct(Math.min(1, D.ratio)) : '—'}</td></tr>
          <tr><td>Onboard storage (buffer)</td><td>${fmtData(D.storage)}</td></tr>
        </table></div>`;
  }

  if (st.id === 'launch') {
    const lc = R.orbit.launchClass || sc.launchClass;
    body = `${stepHeader(st, `Your spacecraft weighs ${kg(R.mass.wet)} fully fuelled. Destination: ${DEST_NAME[lc]}.`)}
      <div class="group"><h3>Launch vehicle</h3><div class="cards">
      ${Object.entries(LAUNCHERS).map(([k, L]) => {
        const cap = L.cap[lc] || 0, sel = S.design.launcher === k;
        const fits = cap >= R.mass.wet && (!L.onlyOrbit || L.onlyOrbit.includes(S.design.orbit));
        return `<button class="card ${sel ? 'sel' : ''}" data-act="set" data-k="launcher" data-v="${k}">
          <span class="check">${sel ? '✓' : ''}</span><span class="name">🚀 ${L.name}</span><span class="desc">${L.desc}</span>
          <span class="stats">${stat('💰 $' + L.cost + 'M')}${stat('✔ ' + Math.round((L.rel - R.diff.relPenalty) * 100) + '% reliable')}
          ${cap ? stat('lifts ' + kg(cap), fits ? 'good' : 'bad') : stat('✗ cannot reach', 'bad')}
          ${L.onlyOrbit && !L.onlyOrbit.includes(S.design.orbit) ? stat('✗ wrong orbit', 'bad') : ''}
          ${L.cruiseMult && L.cruiseMult[sc.launchClass] ? stat('faster cruise', 'good') : ''}</span></button>`;
      }).join('')}</div></div>
      <div class="two">
        <div class="panel pad"><h3 style="margin-bottom:8px">⚖️ Mass budget</h3><table class="budget">
          ${R.mass.items.map(([n, v]) => `<tr><td>${n}</td><td>${kg(v)}</td></tr>`).join('')}
          <tr class="total"><td>Wet mass</td><td>${kg(R.mass.wet)}</td></tr>
          <tr><td>Rocket capacity</td><td>${R.mass.cap ? kg(R.mass.cap) : '—'}</td></tr>
          <tr class="total"><td>Margin</td><td class="${R.mass.margin < 0 ? 'bad' : R.mass.margin < 0.1 ? 'warn' : 'good'}">${R.mass.cap ? pct(R.mass.margin) : '—'}</td></tr>
        </table></div>
        <div class="panel pad"><h3 style="margin-bottom:8px">💰 Cost & schedule</h3><table class="budget">
          ${R.cost.items.map(([n, v]) => `<tr><td>${n}</td><td>${fmtMoney(v)}</td></tr>`).join('')}
          <tr class="total"><td>Total</td><td>${fmtMoney(R.cost.total)}</td></tr>
          <tr><td>Budget cap</td><td>${fmtMoney(R.budget)}</td></tr>
          <tr class="total"><td>Reserve</td><td class="${R.cost.reserve < 0 ? 'bad' : R.cost.reservePct < 0.1 ? 'warn' : 'good'}">${fmtMoney(R.cost.reserve)}</td></tr>
          <tr><td>Development time / deadline</td><td class="${R.schedule.late ? 'warn' : 'good'}">${R.schedule.dev} / ${R.schedule.deadline} mo</td></tr>
          ${R.schedule.delay ? `<tr><td>Launch delayed by</td><td class="bad">${R.schedule.delay} mo</td></tr>` : ''}
        </table></div>
      </div>`;
  }

  if (st.id === 'review') {
    const ps = players();
    const errs = R.errors.length;
    const allOK = S.mode === 'solo' || ps.every((p) => S.approvals[p.idx]);
    body = `${stepHeader(st, 'Final check before committing to launch.')}
      <div class="panel pad"><div class="row sp wrap"><div class="craft-view" style="flex:1;min-width:240px">${craftSVG(R)}</div>
        <div style="flex:1;min-width:240px" class="kv">
          <span>Wet mass</span><span>${kg(R.mass.wet)}</span><span>Total cost</span><span>${fmtMoney(R.cost.total)}</span>
          <span>Power margin</span><span>${pct(R.power.margin)}</span><span>Downlink / data</span><span>${R.data.genDay ? pct(R.data.ratio) : '—'}</span>
          <span>Science potential</span><span>${pct(R.sciPotential)}</span><span>Launch in</span><span>${R.schedule.dev + (R.schedule.delay - R.schedule.late)} months</span>
        </div></div></div>
      <div class="panel pad"><h3 style="margin-bottom:10px">Design issues</h3>${issueList(R.issues, true)}</div>
      <div class="panel pad"><h3 style="margin-bottom:10px">Role goals</h3><div class="choice-list">
        ${Object.values(ROLES).map((r) => `<div class="goal"><span class="ri" style="color:${r.color}"></span><div class="grow"><b style="color:${r.color}">${r.name}</b><div class="muted" style="font-size:13px">${r.goal}</div></div><span style="font-size:20px">${R.roleGoals[r.id] ? '✅' : '❌'}</span></div>`).join('')}
      </div><p class="muted" style="font-size:13px;margin:10px 0 0">Each goal met is worth 20 teamwork points. You can still launch with unmet goals — that's a team decision.</p></div>
      ${S.mode === 'team' ? `<div class="panel pad"><h3 style="margin-bottom:10px">✍️ Sign-off</h3><div class="approve-grid">
        ${ps.map((p) => `<div class="approve ${S.approvals[p.idx] ? 'ok' : ''}"><b>${esc(p.name)}</b><div class="role-chips">${p.roles.map((r) => `<span class="chip">${ROLES[r].icon} ${ROLES[r].short}</span>`).join('')}</div>
          <button class="btn small ${S.approvals[p.idx] ? '' : 'primary'}" data-act="approve" data-v="${p.idx}">${S.approvals[p.idx] ? '✓ Approved (undo)' : 'Approve design'}</button></div>`).join('')}
      </div><p class="muted" style="font-size:13px;margin:10px 0 0">Any change to the design clears all approvals.</p></div>` : ''}
      <div class="panel pad" style="text-align:center">
        ${errs ? `<p class="bad" style="margin-top:0">Fix ${errs} blocking problem${errs > 1 ? 's' : ''} before launch.</p>` : !allOK ? '<p class="warn" style="margin-top:0">Waiting for every crew member to approve.</p>' : '<p class="good" style="margin-top:0">All systems go!</p>'}
        <button class="btn go big" data-act="launch" ${errs || !allOK ? 'disabled' : ''}>🚀 Launch mission</button>
      </div>`;
  }
  return body + nav;
}

function objBars(objs) {
  return `<div class="objbars">${objs.map((o) => {
    const c = o.cap >= 0.7 ? 'var(--good)' : o.cap >= 0.4 ? 'var(--warn)' : 'var(--bad)';
    return `<div class="objbar"><div class="lbl"><span>${o.primary ? '⭐' : '☆'} ${o.name}</span><span class="mono">${pct(o.cap)}</span></div>
      <div class="bar"><i style="width:${o.cap * 100}%;background:${c}"></i><span class="mark" style="left:70%"></span></div></div>`;
  }).join('')}</div>`;
}

function issueList(issues, full) {
  const list = full ? issues : issues.filter((i) => i.level !== 'good').slice(0, 5);
  if (!list.length) return '<div class="issue good"><span>✅</span><div>No problems detected.</div></div>';
  const ic = { error: '⛔', warn: '⚠️', good: '✅' };
  return `<div class="issues">${list.map((i) => `<div class="issue ${i.level}"><span>${ic[i.level]}</span><div>${i.role !== 'ALL' ? `<span style="color:${ROLES[i.role].color}">${ROLES[i.role].icon}</span> ` : ''}${i.text}${i.why && (full || i.level === 'error') ? `<div class="why">${i.why}</div>` : ''}</div></div>`).join('')}
    ${!full && issues.filter((i) => i.level !== 'good').length > 5 ? `<button class="btn small ghost" data-act="step" data-v="review">See all issues →</button>` : ''}</div>`;
}

function meter(label, used, cap, valText, opts = {}) {
  const ratio = cap > 0 && isFinite(cap) ? used / cap : (cap === Infinity ? 0.3 : 2);
  const color = ratio > 1 ? 'var(--bad)' : ratio > (opts.warnAt || 0.9) ? 'var(--warn)' : 'var(--good)';
  const st = ratio > 1 ? ['bad', '✗', 'over limit'] : ratio > (opts.warnAt || 0.9) ? ['warn', '!', 'near limit'] : ['ok', '✓', 'OK'];
  return `<div class="meter"><div class="top"><b>${label}<span class="st ${st[0]}" aria-hidden="true">${st[1]}</span><span class="sr-only"> (${st[2]})</span></b><span class="val">${valText}</span></div>
    <div class="bar"><i style="width:${Math.min(100, ratio * 100)}%;background:${color}"></i></div></div>`;
}

function renderDashboard(R) {
  const P = R.power, D = R.data;
  return `<div class="panel pad dash">
      <h3><span>Spacecraft</span><span class="mono" style="text-transform:none">${kg(R.mass.wet)}</span></h3>
      <div class="craft-view">${craftSVG(R)}</div>
    </div>
    <div class="panel pad dash">
      <h3><span>Resources</span></h3>
      ${meter('💰 Budget', R.cost.total, R.budget, `${fmtMoney(R.cost.total)} / ${fmtMoney(R.budget)}`)}
      ${meter('⚖️ Launch mass', R.mass.wet, R.mass.cap, R.mass.cap ? `${kg(R.mass.wet)} / ${kg(R.mass.cap)}` : 'rocket can\'t reach')}
      ${meter('⚡ Power', P.load, P.genAvg, `${W_(P.load)} / ${W_(P.genAvg)}`, { warnAt: 0.87 })}
      ${meter('🔋 Battery', P.battNeed, P.batt, `${Math.round(P.battNeed)} / ${P.batt} Wh`)}
      ${meter('📡 Data', D.genDay, D.downDay, D.genDay ? `${fmtData(D.genDay)} / ${fmtData(D.downDay)} per day` : 'no instruments', { warnAt: 0.95 })}
      ${meter('⏱️ Schedule', R.schedule.dev, R.schedule.deadline, `${R.schedule.dev} / ${R.schedule.deadline} months`, { warnAt: 0.95 })}
      ${meter('☢️ Radiation', R.rad.missionDose, R.rad.tol, `${Math.round(R.rad.missionDose)} / ${R.rad.tol} krad`, { warnAt: 0.8 })}
    </div>
    <div class="panel pad dash"><h3><span>Science potential</span><span class="mono">${pct(R.sciPotential)}</span></h3>${objBars(R.objectives)}</div>
    <div class="panel pad dash"><h3><span>Issues</span><span class="mono">${R.errors.length ? R.errors.length + ' ⛔' : ''} ${R.issues.filter((i) => i.level === 'warn').length} ⚠️</span></h3>${issueList(R.issues, false)}</div>`;
}

/* =========================================================================
   SIMULATION
   ========================================================================= */
function renderSimShell() {
  const sc = scen();
  return `<div class="topbar"><div class="brand">🛰️ Mission Architect</div><div class="mission-name grow">${sc.icon} ${sc.name} — flight</div>
      <button class="btn small ghost" data-act="gloss">📖 Glossary</button>${langSwitch()}</div>
    <div class="sim">
      <div style="display:grid;gap:12px;align-content:start;min-width:0">
        <div id="sr-live" class="sr-only" aria-live="polite"></div><div class="viz-wrap"><canvas id="viz" role="img" aria-label="Flight view: spacecraft position and status"></canvas>
          <div class="viz-hud"><div class="ph" id="hud-phase"></div><div class="clock" id="hud-clock"></div></div></div>
        <div class="timeline" id="timeline"></div>
        <div class="controls panel pad" style="padding:10px 12px">
          <button class="btn small" data-act="pause" id="btn-pause">⏸ Pause</button>
          <div class="seg" id="speed">${[1, 2, 4, 8].map((v) => `<button data-act="speed" data-v="${v}" class="${v === 1 ? 'sel' : ''}">${v}×</button>`).join('')}</div>
          <button class="btn small" data-act="skip">⏭ Skip ahead</button>
          <span class="grow"></span>
          <button class="btn small primary" data-act="report" id="btn-report" style="display:none">📋 Mission report</button>
        </div>
        <div class="panel pad"><h3 style="margin-bottom:8px">📜 Mission log</h3><div class="log" id="log"></div></div>
      </div>
      <aside style="display:grid;gap:12px;align-content:start">
        <div class="panel pad" id="sim-stats"></div>
        <div class="panel pad"><h3 style="margin-bottom:8px">🎯 Science progress</h3><div id="sim-obj"></div>
          <div class="tag" style="margin-top:12px">Science score</div><canvas class="spark" id="spark-sci"></canvas></div>
        <div class="panel pad"><div class="tag">Reserve ($M)</div><canvas class="spark" id="spark-res"></canvas></div>
      </aside>
    </div>`;
}

function startSimLoop() {
  const sim = S.sim;
  S.ui = { speed: 1, paused: false, acc: 0, sub: 0, launchAnim: 0, last: performance.now(), dt: 0, raf: 0, orbAng: 0, launchRolled: false };
  const canvas = $('#viz');
  updateSimPanels();
  const frame = (ts) => {
    const ui = S.ui; if (!ui || S.screen !== 'sim') return;
    ui.dt = Math.min(0.1, (ts - ui.last) / 1000); ui.last = ts;
    if (!ui.paused && !sim.pending) {
      if (sim.phase === 'launch' || (sim.endReason === 'launch' && ui.launchAnim < 1)) {
        ui.launchAnim = Math.min(1, ui.launchAnim + ui.dt / (REDUCED_MOTION ? 0.8 : 3) * Math.min(ui.speed, 2));
        if (ui.launchAnim >= 0.5 && !ui.launchRolled) { ui.launchRolled = true; simStep(sim); afterStep(); }
      } else if (!sim.done) {
        const dur = (sim.phase === 'cruise' ? 0.28 : 0.9) / ui.speed;
        ui.acc += ui.dt; ui.sub = Math.min(1, ui.acc / dur);
        if (ui.acc >= dur) { ui.acc = 0; ui.sub = 0; simStep(sim); afterStep(); }
      }
    }
    drawFlight(canvas, sim, ui);
    updateHud();
    ui.raf = requestAnimationFrame(frame);
  };
  S.ui.raf = requestAnimationFrame(frame);
}

function afterStep() {
  updateSimPanels();
  if (S.sim.pending) showEventModal();
  if (S.sim.done) {
    $('#btn-report').style.display = '';
    $('#btn-pause').disabled = true;
  }
}

const PHASE_NAME = { launch: '🚀 Launch', cruise: '🛰️ Cruise', arrival: '🔥 Arrival', ops: '🔬 Science operations', ended: '' };
function updateHud() {
  const sim = S.sim;
  let ph = PHASE_NAME[sim.phase];
  if (sim.done) ph = sim.endReason === 'complete' ? '🏁 Mission complete' : '⛔ Mission lost';
  const hp = $('#hud-phase'); if (hp.dataset.ph !== ph) { hp.dataset.ph = ph; hp.textContent = ph; }
  const y = Math.floor(sim.t / 12), m = sim.t % 12;
  $('#hud-clock').innerHTML = `T+ ${y}y ${m}m<br>${sim.phase === 'ops' || sim.opsMonth ? `ops month ${sim.opsMonth}/${sim.plannedOps}` : sim.phase === 'cruise' ? `${sim.cruiseLeft} months to go` : ''}`;
}

function updateSimPanels() {
  const sim = S.sim, R = sim.R;
  const lastLogs = sim.log.slice(-40).reverse();
  $('#log').innerHTML = lastLogs.map((l) => `<div class="${l.type}"><span class="t">T+${l.t}m</span>${esc(l.text)}</div>`).join('');
  const live = $('#sr-live'), lastL = sim.log[sim.log.length - 1];
  if (live && lastL && live.dataset.n !== String(sim.log.length)) { live.dataset.n = String(sim.log.length); live.textContent = lastL.text; }
  const objs = objectiveScores(sim);
  $('#sim-obj').innerHTML = objBars(objs.map((o) => ({ ...o, cap: o.score })));
  const dvTxt = R.d.propulsion === 'none' ? '—' : Math.max(0, Math.round(sim.dvLeft)) + ' m/s';
  $('#sim-stats').innerHTML = `<h3 style="margin-bottom:10px">🛰️ Spacecraft status</h3><div class="kv">
    <span>💰 Reserve</span><span class="${sim.reserve < 0 ? 'bad' : ''}">${fmtMoney(sim.reserve)}</span>
    <span>⛽ Δv left</span><span>${dvTxt}</span>
    <span>⚡ Power available</span><span>${W_(sim.lastPower)}</span>
    <span>🔬 Instrument power</span><span class="${sim.lastPF < 0.95 ? 'warn' : ''}">${pct(sim.lastPF)}</span>
    <span>📡 Data reaching Earth</span><span class="${sim.lastDF < 0.9 ? 'warn' : ''}">${pct(sim.lastDF)}</span>
    <span>💾 Data waiting onboard</span><span>${fmtData(sim.backlog)}</span>
    <span>☢️ Radiation dose</span><span class="${sim.dose > R.rad.tol ? 'bad' : ''}">${Math.round(sim.dose)} / ${R.rad.tol} krad</span>
    <span>🛟 Spare units</span><span>${sim.spares}</span>
    <span>⭐ Bonus</span><span>${Math.round(sim.bonus)}</span>
  </div>`;
  // timeline
  const cr = Math.max(0, Math.round(R.schedule.cruise)), ar = 1 + R.schedule.extraArrival, op = sim.plannedOps;
  const tot = 1 + cr + ar + op;
  const seg = (n, label, color) => (n > 0 ? `<div style="flex:${n};background:${color}">${label}</div>` : '');
  const pos = sim.phase === 'launch' ? 0 : sim.t + 1 + (sim.phase === 'ops' ? 0 : 0);
  $('#timeline').innerHTML = seg(1, '🚀', 'var(--seg-launch)') + seg(cr, 'Cruise', 'var(--seg-cruise)') + seg(ar, 'Arrival', 'var(--seg-arrive)') + seg(op, 'Science operations', 'var(--seg-ops)')
    + `<span class="cursor" style="left:${Math.min(100, (pos / tot) * 100)}%"></span>`;
  sparkline($('#spark-sci'), sim.series.sci, '--accent', 600);
  sparkline($('#spark-res'), sim.series.reserve, '--warn');
}

function showEventModal() {
  const sim = S.sim;
  const { ev, ctx } = sim.pending;
  const title = typeof ev.title === 'function' ? ev.title(sim, ctx) : ev.title;
  const r = ROLES[ev.role], p = ownerOf(ev.role);
  const html = `<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="tag">Month ${sim.t} · decision required</div>
    <h2>${title}</h2>
    <div class="decider" style="border:1px solid ${r.color};color:${r.color}">${r.icon} ${r.name}${S.mode === 'team' ? ' <b>' + esc(p.name) + '</b>' : ''} decides — discuss with your team!</div>
    <p style="margin:0 0 10px">${ev.text(sim, ctx)}</p>
    <div class="learn" style="margin-bottom:6px">📘 ${ev.learn}</div>
    ${ev.choices.map((c, i) => {
      const ok = !c.can || c.can(sim, ctx);
      const hint = typeof c.hint === 'function' ? c.hint(sim, ctx) : c.hint;
      return `<button class="opt-btn" data-act="choose" data-v="${i}" ${ok ? '' : 'disabled'}><b>${c.label}</b><small>${hint}${ok ? '' : ' — not possible'}</small></button>`;
    }).join('')}
  </div></div>`;
  $('#modal-root').innerHTML = html;
}

function showEventResult() {
  const d = S.sim.decisions[S.sim.decisions.length - 1];
  $('#modal-root').innerHTML = `<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true"><div class="tag">Outcome</div><h2>${d.title}</h2>
    <p><b>Decision:</b> ${esc(d.choice)}</p><p style="font-size:16px">${esc(d.result)}</p>
    <div style="text-align:right"><button class="btn primary" data-act="closemodal">Continue ▶</button></div></div></div>`;
}

/* =========================================================================
   REPORT
   ========================================================================= */
function finishMission() {
  const sim = S.sim;
  const approvals = S.mode === 'team' && players().every((p) => S.approvals[p.idx]);
  const score = finalScore(sim, approvals);
  const lessons = buildLessons(sim, score);
  const R = sim.R;
  const entry = {
    s: S.scenario, mission: scen().name, level: DIFFICULTY[S.difficulty].name, crew: players().map((p) => p.name).join(', '),
    outcome: score.outcome, total: score.total, ranked: score.ranked, grade: score.grade,
    cost: Math.round(R.cost.total), wet: Math.round(R.mass.wet), science: score.science, date: new Date().toISOString().slice(0, 10),
    orbit: R.orbit.short, launcher: R.L.name, insts: R.insts.map((i) => i.I.icon).join(''),
  };
  S.history.push(entry);
  if (S.difficulty !== 'sandbox') { const b = loadBoard(); b.push(entry); saveBoard(b); }
  S.result = { score, lessons, entry, prev: S.history.filter((h) => h.s === S.scenario).slice(-2, -1)[0] };
  S.screen = 'report';
  render();
}

function renderReport() {
  const { score, lessons, entry, prev } = S.result;
  const sim = S.sim, R = sim.R, sc = scen();
  const cmpRow = (label, a, b, higherBetter = true, fmt = (x) => x) => {
    if (b == null) return `<tr><td>${label}</td><td class="mono">${fmt(a)}</td><td class="dim">—</td></tr>`;
    const better = higherBetter ? a > b : a < b;
    return `<tr><td>${label}</td><td class="mono ${a === b ? '' : better ? 'up' : 'down'}">${fmt(a)}</td><td class="mono dim">${fmt(b)}</td></tr>`;
  };
  return `<div class="topbar no-print"><div class="brand">🛰️ Mission Architect</div><div class="mission-name grow">${sc.icon} ${sc.name} — mission report</div>${langSwitch()}</div>
  <div class="report">
    <div class="panel report-hero">
      <div class="grade ${score.grade}">${score.grade}</div>
      <div><div class="tag">${sc.icon} ${sc.name} · ${DIFFICULTY[S.difficulty].name} · ${esc(entry.crew)}</div>
        <h1 style="font-size:34px;margin-top:4px">${score.outcome}</h1>
        <p class="muted" style="margin:6px 0 0">${R.orbit.short} · ${R.L.name} · ${kg(R.mass.wet)} · ${fmtMoney(R.cost.total)} · ${sim.opsMonth} months of operations${sim.extended ? ` (incl. ${sim.extended} extension${sim.extended > 1 ? 's' : ''})` : ''}</p></div>
      <div><div class="score-big">${score.total}</div><div class="muted" style="text-align:right">/ 1000 points${S.difficulty !== 'sandbox' ? `<br>ranked score <b class="mono">${score.ranked}</b>` : ''}</div></div>
    </div>
    <div class="breakdown">
      <div class="bd"><div class="v">${score.science}</div><div class="l">🔬 Science /600</div></div>
      <div class="bd"><div class="v">${score.success}</div><div class="l">🎯 Mission success /150</div></div>
      <div class="bd"><div class="v">${score.eff}</div><div class="l">⚙️ Resource efficiency /150</div></div>
      <div class="bd"><div class="v">${score.team}</div><div class="l">👥 Teamwork & goals /100</div></div>
      <div class="bd"><div class="v">${score.bonus}</div><div class="l">✨ Bonus</div></div>
    </div>
    <div class="two">
      <div class="panel pad"><h3 style="margin-bottom:10px">🎯 Objectives</h3>${objBars(score.objs.map((o) => ({ ...o, cap: o.score })))}
        <p class="muted" style="font-size:13px;margin:10px 0 0">The white line marks 70%. Primary objectives need ≥ 60% for mission success.</p></div>
      <div class="panel pad"><h3 style="margin-bottom:10px">👥 Role goals at launch</h3><div class="choice-list">
        ${Object.values(ROLES).map((r) => `<div class="goal"><span class="ri" style="color:${r.color}"></span><div class="grow"><b style="color:${r.color}">${r.name}</b><div class="muted" style="font-size:13px">${r.short}</div></div><span>${R.roleGoals[r.id] ? '✅' : '❌'}</span></div>`).join('')}</div></div>
    </div>
    <div class="panel pad"><h3 style="margin-bottom:10px">🧠 Why did it go this way?</h3><div style="display:grid;gap:10px">
      ${lessons.map((l) => `<div class="lesson ${l.type}"><b>${{ bad: '⛔', warn: '⚠️', good: '✅', info: '💡' }[l.type]} ${l.title}</b><p>${l.text}</p></div>`).join('')}
    </div></div>
    <div class="two">
      <div class="panel pad"><h3 style="margin-bottom:10px">🗳️ Decisions in flight</h3>
        ${sim.decisions.length ? `<div class="log" style="max-height:none">${sim.decisions.map((d) => `<div class="event"><span class="t">T+${d.t}m</span>${ROLES[d.role].icon} <b>${esc(d.title)}</b> → ${esc(d.choice)}<br><span class="muted">${esc(d.result)}</span></div>`).join('')}</div>` : '<p class="muted">No emergencies — a quiet flight.</p>'}
      </div>
      <div class="panel pad"><h3 style="margin-bottom:10px">📊 Compared with your previous attempt</h3>
        <table class="budget cmp"><tr><td></td><td><b>This flight</b></td><td><b>Previous</b></td></tr>
          ${cmpRow('Score', entry.total, prev?.total)}
          ${cmpRow('Science', entry.science, prev?.science)}
          ${cmpRow('Cost', entry.cost, prev?.cost, false, (x) => '$' + x + 'M')}
          ${cmpRow('Wet mass', entry.wet, prev?.wet, false, (x) => x + ' kg')}
          <tr><td>Orbit</td><td>${entry.orbit}</td><td class="dim">${prev ? prev.orbit : '—'}</td></tr>
          <tr><td>Instruments</td><td data-icons>${entry.insts}</td><td class="dim" data-icons>${prev ? prev.insts : '—'}</td></tr>
        </table>
        <p class="muted" style="font-size:13px;margin:10px 0 0">There is rarely a single perfect design. Try a different orbit, rocket or payload and compare!</p></div>
    </div>
    <div class="start-bar no-print">
      <button class="btn primary big" data-act="redesign">🔧 Improve the design</button>
      <button class="btn big" data-act="refly">🔁 Fly the same design again</button>
      <button class="btn big" data-act="share">🔗 Share design</button>
      <button class="btn big" data-act="home">🏠 New mission</button>
    </div>
  </div>`;
}

/* =========================================================================
   MODALS: help, glossary, share/load
   ========================================================================= */
function modal(html) {
  $('#modal-root').innerHTML = `<div class="modal-bg" data-act="bgclose"><div class="modal" role="dialog" aria-modal="true">${html}
    <div style="text-align:right;margin-top:14px"><button class="btn primary" data-act="closemodal">Close</button></div></div></div>`;
}
function helpModal() {
  modal(`<h2>❓ How to play</h2>
    <div class="help-steps">
      <div><b>1 · Define</b><br>Pick a mission and read its science objectives. ⭐ Primary objectives decide success.</div>
      <div><b>2 · Design</b><br>Choose orbit, instruments, spacecraft parts, power, comms and rocket. The dashboard updates live.</div>
      <div><b>3 · Review</b><br>Fix blocking problems (⛔). In team mode every player signs off on the design.</div>
      <div><b>4 · Fly</b><br>Watch launch, cruise and operations. When emergencies happen, the responsible role decides.</div>
    </div>
    <p><b>Scoring (max 1000):</b> 🔬 Science 600 · 🎯 Mission success 150 · ⚙️ Efficiency 150 (reserve, margins, data) · 👥 Role goals & sign-off 100 · ✨ bonus for discoveries and extended missions. Harder levels multiply the ranked score.</p>
    <p><b>Team mode:</b> 2–4 players share four roles. Each role owns some design steps and has a personal goal. Goals conflict — talk it through!</p>
    <p class="muted">Tip: every option card shows what would happen if you picked it (→ values). Use them to explore trade-offs.</p>`);
}
function glossModal() {
  modal(`<h2>📖 Glossary</h2><dl class="gloss">${GLOSSARY.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('')}</dl>`);
}
function shareModal() {
  const code = encodeDesign();
  modal(`<h2>🔗 Share this design</h2><p class="muted">Send this code to classmates. They paste it into "Load a shared design" on the start screen to open and fly your exact design.</p>
    <textarea class="code" readonly id="share-code">${esc(code)}</textarea>
    <div class="row" style="margin-top:8px"><button class="btn small" data-act="copy">📋 Copy</button></div>`);
}
function loadModal() {
  modal(`<h2>🔗 Load a shared design</h2><p class="muted">Paste the design code a classmate sent you.</p>
    <textarea class="code" id="load-code" placeholder="https://…#design=…"></textarea>
    <div class="row" style="margin-top:8px"><button class="btn small primary" data-act="doload">Load design</button></div>`);
}
function closeModal() { $('#modal-root').innerHTML = ''; }
/* In-page confirmation (browser confirm() dialogs are blocked inside embedded viewers) */
function askConfirm(text, yes, no, cb) {
  S.confirmCb = cb;
  $('#modal-root').innerHTML = `<div class="modal-bg" data-act="bgclose"><div class="modal" role="alertdialog" aria-modal="true">
    <p style="font-size:17px;margin:0 0 16px">${esc(text)}</p>
    <div class="row" style="justify-content:flex-end"><button class="btn" data-act="closemodal">${esc(no)}</button><button class="btn primary" data-act="confirm-yes">${esc(yes)}</button></div></div></div>`;
}

function openDesign(o) {
  S.scenario = o.s; S.difficulty = DIFFICULTY[o.f] ? o.f : 'normal';
  S.design = { ...defaultDesign(SCENARIOS[o.s]), ...o.d };
  S.step = 'review'; S.approvals = {}; S.visited = {}; S.screen = 'design';
  closeModal(); render(); toast('Shared design loaded');
}

/* =========================================================================
   EVENTS
   ========================================================================= */
function onDesignChange(fullMain = true) {
  S.approvals = {};
  refreshDesign({ main: fullMain, side: true });
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, v = el.dataset.v;
  if (act === 'bgclose') { if (e.target === el) closeModal(); return; }
  switch (act) {
    case 'lang': switchLang(v); break;
    case 'theme': setTheme(v === 'light' ? 'light' : 'dark'); break;
    case 'scen': S.scenario = v; render(); break;
    case 'mode': S.mode = v; render(); break;
    case 'nplayers': S.nPlayers = +v; render(); break;
    case 'diff': S.difficulty = v; render(); break;
    case 'start':
      S.design = defaultDesign(scen()); S.step = 'mission'; S.approvals = {}; S.visited = {}; S.screen = 'design'; render(); break;
    case 'help': helpModal(); break;
    case 'gloss': glossModal(); break;
    case 'loadcode': loadModal(); break;
    case 'useshared': openDesign(S.shared); S.shared = null; history.replaceState(null, '', location.pathname); break;
    case 'doload': { const o = decodeDesign($('#load-code').value); if (o) openDesign(o); else toast('That code could not be read.'); break; }
    case 'lbclear': askConfirm('Clear the leaderboard on this device?', 'Yes, clear it', 'Cancel', () => { saveBoard([]); render(); }); break;
    case 'closemodal':
      closeModal();
      break;
    case 'copy': { const t = $('#share-code'); t.select(); (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(() => toast('Copied!'), () => { document.execCommand('copy'); toast('Copied!'); }); break; }
    case 'share': shareModal(); break;
    case 'exit': askConfirm('Leave this mission? Your design will be lost.', 'Yes, leave', 'Cancel', () => { S.screen = 'title'; render(); }); break;
    case 'step': S.step = v; refreshDesign(); $('#main-col').scrollIntoView({ block: 'start' }); window.scrollTo({ top: 0 }); break;
    case 'set': S.design[el.dataset.k] = v; if (el.dataset.k === 'orbit' && ORBITS[v].maxOps == null && S.design.months < 6) S.design.months = scen().defaultMonths; onDesignChange(); break;
    case 'inst': S.design.instruments[el.dataset.k] = +v; onDesignChange(); break;
    case 'approve': S.approvals[v] = !S.approvals[v]; refreshDesign(); break;
    case 'launch': {
      const R = calc();
      if (R.errors.length) return;
      S.sim = createSim(R); S.screen = 'sim'; render(); break;
    }
    case 'pause': if (S.ui) { S.ui.paused = !S.ui.paused; el.textContent = S.ui.paused ? '▶ Resume' : '⏸ Pause'; } break;
    case 'speed': if (S.ui) { S.ui.speed = +v; document.querySelectorAll('#speed button').forEach((b) => b.classList.toggle('sel', b.dataset.v === v)); } break;
    case 'skip': {
      const sim = S.sim; if (!S.ui || sim.phase === 'launch') return;
      let n = 0; while (!sim.done && !sim.pending && n++ < 400) simStep(sim);
      afterStep(); break;
    }
    case 'choose': resolveEvent(S.sim, +v); showEventResult(); updateSimPanels(); if (S.sim.done) afterStep(); break;
    case 'report': finishMission(); break;
    case 'redesign': S.screen = 'design'; S.step = 'review'; S.approvals = {}; render(); break;
    case 'refly': S.sim = createSim(calc()); S.screen = 'sim'; render(); break;
    case 'home': S.screen = 'title'; render(); break;
    case 'confirm-yes': { const cb = S.confirmCb; S.confirmCb = null; closeModal(); if (cb) cb(); break; }
  }
});

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.name != null) { S.names[+el.dataset.name] = el.value || `Player ${+el.dataset.name + 1}`; return; }
  if (el.dataset.act === 'months') {
    S.design.months = +el.value; $('#months-lbl').textContent = el.value + ' months';
    S.approvals = {}; refreshDesign({ main: false, side: true });
  }
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.act === 'aero') { S.design.aerobrake = el.checked; onDesignChange(); }
  if (el.dataset.act === 'months') refreshDesign({ main: true, side: true });
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !(S.sim && S.sim.pending && S.screen === 'sim')) closeModal(); });

/* ---------------- boot ---------------- */
/* ---------------- modal focus management (keyboard & screen readers) ---------------- */
let lastFocus = null;
new MutationObserver(() => {
  const m = $('#modal-root .modal');
  if (m) {
    if (!lastFocus) lastFocus = document.activeElement;
    const first = m.querySelector('button:not(:disabled), textarea, input');
    if (first && !m.contains(document.activeElement)) first.focus();
  } else if (lastFocus) {
    if (document.body.contains(lastFocus)) lastFocus.focus();
    lastFocus = null;
  }
}).observe(document.getElementById('modal-root'), { childList: true, subtree: true });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const m = $('#modal-root .modal'); if (!m) return;
  const items = [...m.querySelectorAll('button:not(:disabled), textarea, input, [tabindex]:not([tabindex="-1"])')];
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  else if (!m.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
});


/* ---------------- dil seçimi / language switch ---------------- */
/* ---------------- tema / theme ---------------- */
function currentTheme() { return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t === 'dark' ? '#0f151c' : '#eef1f4');
}
function setTheme(t) {
  applyTheme(t);
  try { localStorage.setItem('ma_theme', t); } catch { /* depolama yok */ }
  document.querySelectorAll('[data-act="theme"]').forEach((b) => { const on = b.dataset.v === t; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', String(on)); });
  if (S.screen === 'sim') updateSimPanels();
}
function themeSwitch() {
  const t = currentTheme();
  return `<div class="seg theme-seg" role="group" aria-label="Theme">
    <button data-act="theme" data-v="light" class="${t === 'light' ? 'sel' : ''}" aria-pressed="${t === 'light'}" title="Light theme">Light</button>
    <button data-act="theme" data-v="dark" class="${t === 'dark' ? 'sel' : ''}" aria-pressed="${t === 'dark'}" title="Dark theme">Dark</button></div>`;
}
function langSwitch() {
  return `<div class="prefs">${themeSwitch()}<div class="seg lang-seg" role="group" aria-label="Language">
    <button data-act="lang" data-v="tr" class="${LANG === 'tr' ? 'sel' : ''}" aria-pressed="${LANG === 'tr'}" lang="tr" title="Türkçe">TR</button>
    <button data-act="lang" data-v="en" class="${LANG === 'en' ? 'sel' : ''}" aria-pressed="${LANG === 'en'}" lang="en" title="English">EN</button></div></div>`;
}
/* Dil değişince sayfa diğer dilin dosyalarıyla yeniden açılır; tasarım sessionStorage ile taşınır. */
function switchLang(lang) {
  if (lang === LANG) return;
  const carry = { scenario: S.scenario, difficulty: S.difficulty, mode: S.mode, nPlayers: S.nPlayers, names: S.names,
    design: S.screen === 'title' ? null : S.design, step: S.screen === 'design' ? S.step : 'review' };
  try { localStorage.setItem('ma_lang', lang); } catch { /* depolama yok */ }
  try { sessionStorage.setItem('ma_carry', JSON.stringify(carry)); } catch { /* depolama yok */ }
  if (window.MA_LOADER) location.reload();
  else location.href = lang === 'en' ? '../mission-game-en/index.html' : '../mission-game/index.html';
}
function restoreCarry() {
  let c = null;
  try { c = JSON.parse(sessionStorage.getItem('ma_carry') || 'null'); sessionStorage.removeItem('ma_carry'); } catch { c = null; }
  if (!c || !SCENARIOS[c.scenario]) return;
  S.scenario = c.scenario; S.difficulty = DIFFICULTY[c.difficulty] ? c.difficulty : S.difficulty;
  S.mode = c.mode === 'team' ? 'team' : 'solo'; S.nPlayers = [2, 3, 4].includes(c.nPlayers) ? c.nPlayers : 2;
  if (Array.isArray(c.names)) S.names = c.names.slice(0, 4).map(String);
  if (c.design) { S.design = { ...defaultDesign(SCENARIOS[c.scenario]), ...c.design }; S.step = STEPS.some((s) => s.id === c.step) ? c.step : 'mission'; S.screen = 'design'; }
}

(function boot() {
  drawStarfield();
  { let t = 'dark'; try { t = localStorage.getItem('ma_theme') || 'dark'; } catch { t = 'dark'; } applyTheme(t === 'light' ? 'light' : 'dark'); }
  restoreCarry();
  if (location.hash.startsWith('#design=')) S.shared = decodeDesign(location.hash);
  render();
})();
