'use strict';
/* =========================================================================
   Mission simulation: month-by-month flight with random events that the
   responsible team role must decide on, then scoring and lessons.
   ========================================================================= */

/* Çevrimiçi oyunda herkesin aynı uçuşu görmesi için zar (rastgele sayı) ortak bir tohumla üretilir. */
let SIM_RNG = Math.random;
const rand = () => SIM_RNG();

function createSim(R, seed) {
  SIM_RNG = seed == null ? Math.random : seeded(seed >>> 0);
  const d = R.d;
  const instOn = {};
  for (const i of R.insts) instOn[i.id] = i.t;
  const sim = {
    R, sc: R.sc, orbit: R.orbit, t: 0, phase: 'launch', done: false, endReason: null,
    cruiseLeft: Math.max(0, Math.round(R.schedule.cruise)), arrivalLeft: 1 + R.schedule.extraArrival,
    opsMonth: 0, plannedOps: R.months, extended: 0,
    reserve: R.cost.reserve, dvLeft: R.dv.cap, extraSk: 0, decay: null,
    dose: 0, doseMult: 1, level: R.level, quality: {}, instOn, spares: opt('redundancy', d.redundancy).spares,
    computerHealth: 1, radioHealth: 1, solarDamage: 1, opsEff: 1, linkMult: 1, temp: [],
    progress: {}, peakCap: {}, backlog: 0, dataGen: 0, dataDown: 0, dataLost: 0,
    pfSum: 0, dfSum: 0, opsCounted: 0, bonus: 0, lastEvent: -5, used: {},
    log: [], decisions: [], pending: null,
    series: { sci: [], reserve: [], backlog: [] },
    lastPower: R.power.genAvg, lastPF: 1, lastDF: 1, launched: false,
  };
  for (const o of sim.sc.objectives) { sim.progress[o.id] = 0; sim.peakCap[o.id] = 0; }
  if (R.orbit.natLife * 12 < 999 && R.d.propulsion === 'none') sim.decay = Math.round(R.orbit.natLife * 12);
  return sim;
}

function log(sim, text, type = 'info') { sim.log.push({ t: sim.t, text, type }); }
function addTemp(sim, months, mult) { sim.temp.push({ left: months, mult }); }
function tempFactor(sim) { return sim.temp.reduce((p, x) => p * x.mult, 1); }
function endSim(sim, reason, text, type = 'bad') {
  sim.done = true; sim.endReason = reason; sim.phase = 'ended';
  log(sim, text, type);
}

function hitComputer(sim, cause) {
  if (sim.spares > 0) {
    sim.spares--; addTemp(sim, 1, 0.7);
    return cause + ' The backup computer took over automatically — redundancy saved the day.';
  }
  sim.computerHealth *= 0.7; addTemp(sim, 2, 0.4);
  return cause + ' With no backup, the team spent weeks recovering. Some memory is permanently damaged.';
}

function currentLinkRate(sim) {
  const R = sim.R;
  const ant = opt('antenna', R.d.antenna);
  const lvl = sim.level;
  const pointOK = lvl >= ant.level ? 1 : (ant.level - lvl >= 1.5 ? 0.05 : ant.level === 1 ? 0.3 : 0.15);
  return R.data.rateRaw * pointOK;
}

/* ------------------------------------------------------------------ */
/* EVENTS                                                              */
/* ------------------------------------------------------------------ */
const EARTH_LOW = ['leo400', 'sso', 'ddsso'];
const EVENTS = [
  {
    id: 'solar_storm', role: 'SE', phases: ['cruise', 'ops'], weight: 3, max: 2,
    title: '☀️ Solar storm incoming',
    text: (s) => `A coronal mass ejection from the Sun will hit the spacecraft within hours. High-energy particles can flip bits or damage electronics. Your spacecraft has a ${opt('computer', s.R.d.computer).name.toLowerCase()} computer and "${opt('shielding', s.R.d.shielding).name}" radiation protection.`,
    learn: 'Real spacecraft often enter "safe mode" during storms: instruments off, only essential systems running.',
    choices: [
      { label: 'Enter safe mode', hint: 'Lose about two weeks of science. No risk.',
        apply: (s) => { addTemp(s, 1, 0.5); return 'Safe mode: the storm passed harmlessly; two weeks of observations were lost.'; } },
      { label: 'Keep observing', hint: 'Risky — depends on how radiation-hard your electronics are.',
        apply: (s) => {
          const base = { cots: 0.55, radtol: 0.2, radhard: 0.05 }[s.R.d.computer] * Math.sqrt(opt('shielding', s.R.d.shielding).factor);
          if (rand() < base) return hitComputer(s, 'The storm crashed the flight computer.');
          if (s.instOn.particles) { s.bonus += 15; return 'Your particle detector recorded the storm up close — bonus science!'; }
          return 'The electronics survived and science continued uninterrupted.';
        } },
    ],
  },
  {
    id: 'instrument_glitch', role: 'SL', phases: ['ops'], weight: 3, max: 2,
    setup: (s) => {
      const on = Object.keys(s.instOn).filter((k) => s.instOn[k] && (s.quality[k] ?? 1) > 0.5);
      if (!on.length) return null;
      const id = on[Math.floor(rand() * on.length)];
      return { id, cost: Math.round(3 + INSTRUMENTS[id].cost * TIER[s.instOn[id]].c * 0.15) };
    },
    title: (s, c) => `⚠️ ${INSTRUMENTS[c.id].name} anomaly`,
    text: (s, c) => `The ${INSTRUMENTS[c.id].name.toLowerCase()} is returning noisy, corrupted data. Engineers think a detector or electronics board is misbehaving.`,
    learn: 'Ground teams can often fix problems remotely by uploading new software or changing operating modes — but investigations cost time and money.',
    choices: [
      { label: 'Fund an investigation', hint: (s, c) => `Costs $${c.cost}M from reserve. ~80% chance of a full fix.`,
        can: (s, c) => s.reserve >= c.cost,
        apply: (s, c) => {
          s.reserve -= c.cost;
          if (rand() < 0.8) return `The team found a software workaround. The ${INSTRUMENTS[c.id].name.toLowerCase()} is fully working again.`;
          s.quality[c.id] = 0.6; return 'Despite the effort, the instrument can only run in a degraded mode.';
        } },
      { label: 'Operate in degraded mode', hint: 'Free, but the instrument delivers ~60% quality.',
        apply: (s, c) => { s.quality[c.id] = 0.6; return `The ${INSTRUMENTS[c.id].name.toLowerCase()} continues at reduced quality.`; } },
      { label: 'Switch it off', hint: 'Frees its power and data volume for other instruments.',
        apply: (s, c) => { s.instOn[c.id] = 0; return `The ${INSTRUMENTS[c.id].name.toLowerCase()} was switched off. Other instruments get more power and bandwidth.`; } },
    ],
  },
  {
    id: 'budget_cut', role: 'MM', phases: ['ops'], weight: 1.5, max: 1, cond: (s) => s.opsMonth >= 3 && s.R.budget !== Infinity,
    setup: (s) => ({ amount: Math.max(2, Math.round(s.R.budget * 0.05)) }),
    title: '🏛️ Agency budget cut',
    text: (s, c) => `The space agency's budget was reduced. Your mission must give back $${c.amount}M.`,
    learn: 'Missions compete for money every year. Reserves protect the mission from such cuts.',
    choices: [
      { label: 'Pay from reserve', hint: (s, c) => `Reserve: $${Math.round(s.reserve)}M`, can: (s, c) => s.reserve >= c.amount,
        apply: (s, c) => { s.reserve -= c.amount; return 'The cut was absorbed by the reserve. Science continues as planned.'; } },
      { label: 'Shorten the mission by 25%', hint: 'Fewer months of operations.',
        apply: (s) => { s.plannedOps = Math.max(s.opsMonth + 1, Math.round(s.plannedOps * 0.75)); return `The mission will now end after ${s.plannedOps} months of operations.`; } },
      { label: 'Shrink the operations team', hint: 'Science efficiency −15% for the rest of the mission.',
        apply: (s) => { s.opsEff *= 0.85; return 'With a smaller team, fewer observations can be planned each week.'; } },
    ],
  },
  {
    id: 'debris', role: 'MM', phases: ['ops'], weight: 2, max: 2, cond: (s) => EARTH_LOW.includes(s.R.d.orbit),
    title: '💥 Collision warning',
    text: () => 'Space surveillance predicts a close approach with a piece of debris in 2 days. Probability of collision: about 1 in 100.',
    learn: 'Tens of thousands of debris pieces orbit Earth. Operators perform avoidance manoeuvres when risk exceeds ~1 in 10,000.',
    choices: [
      { label: 'Perform avoidance manoeuvre', hint: 'Uses ~2 m/s of propellant.', can: (s) => s.R.d.propulsion !== 'none' && s.dvLeft >= 2,
        apply: (s) => { s.dvLeft -= 2; return 'A small burn moved the spacecraft safely out of the way.'; } },
      { label: 'Accept the risk', hint: '1 in 100 chance of losing the spacecraft.',
        apply: (s) => { if (rand() < 0.01) { endSim(s, 'collision', '💥 The debris struck the spacecraft. Mission lost.'); return 'The spacecraft was destroyed by the impact.'; } return 'The debris passed by harmlessly — this time.'; } },
    ],
  },
  {
    id: 'ground_outage', role: 'CL', phases: ['ops'], weight: 2, max: 2,
    title: '📡 Ground station outage',
    text: () => 'A storm damaged your main ground antenna. It will be offline for two weeks.',
    learn: 'Onboard storage lets a spacecraft keep observing while it cannot talk to Earth — up to the size of its memory.',
    choices: [
      { label: 'Rent backup antennas', hint: 'Costs $2M. No data loss.', can: (s) => s.reserve >= 2,
        apply: (s) => { s.reserve -= 2; return 'Backup antennas kept the data flowing.'; } },
      { label: 'Store data onboard', hint: (s) => `Free. Storage: ${fmtData(s.R.data.storage)}. Overflow is lost.`,
        apply: (s) => { s.linkMult = 0.5; return 'Data was stored onboard until the station came back.'; } },
    ],
  },
  {
    id: 'conjunction', role: 'CL', phases: ['ops'], weight: 2, max: 2, cond: (s) => s.sc.distAU > 1,
    title: '🌞 Solar conjunction',
    text: () => 'The Sun is moving between Earth and your spacecraft. For about two weeks, the Sun\'s radio noise will block all communication.',
    learn: 'Solar conjunctions happen regularly for Mars and outer-planet missions. Teams upload commands in advance and pause risky activities.',
    choices: [
      { label: 'Keep observing autonomously', hint: (s) => `Store data onboard (${fmtData(s.R.data.storage)}). Overflow is lost.`,
        apply: (s) => { s.linkMult = 0.5; if (s.R.d.computer === 'cots' && rand() < 0.3) return hitComputer(s, 'Without contact, a software fault went unnoticed.'); return 'The spacecraft ran its pre-loaded sequence perfectly.'; } },
      { label: 'Pause science', hint: 'Safe, but two weeks of science lost.',
        apply: (s) => { addTemp(s, 1, 0.5); s.linkMult = 0.5; return 'Science paused until the Sun moved out of the way.'; } },
    ],
  },
  {
    id: 'discovery', role: 'SL', phases: ['ops'], weight: 1.5, max: 1,
    title: '✨ Unexpected opportunity!',
    text: (s) => s.sc.discovery,
    learn: 'Flexible missions can react to surprises — but changing plans costs propellant, money and time.',
    choices: [
      { label: 'Retarget the spacecraft', hint: 'Costs $2M and ~5 m/s of propellant.', can: (s) => s.reserve >= 2 && s.dvLeft >= 5 && s.R.d.propulsion !== 'none',
        apply: (s) => {
          s.reserve -= 2; s.dvLeft -= 5;
          const imaging = Object.keys(s.instOn).filter((k) => s.instOn[k] && INSTRUMENTS[k].kind !== 'insitu');
          if (imaging.length) { s.bonus += 40; return 'Spectacular observations! Scientists are thrilled — bonus science points.'; }
          s.bonus += 8; return 'You got there, but your instruments are not well-suited to observe it. Small bonus.';
        } },
      { label: 'Stick to the plan', hint: 'No cost, no bonus.', apply: () => 'The team kept to the planned observations.' },
    ],
  },
  {
    id: 'dust_storm', role: 'SL', phases: ['ops'], weight: 2, max: 1, cond: (s) => s.sc.id === 'mars',
    title: '🌪️ Global dust storm',
    text: () => 'A dust storm is spreading over the whole planet. The surface will be hidden for months.',
    learn: 'Mars\' global dust storms block surface views — but they are exactly what climate scientists want to study.',
    choices: [
      { label: 'Focus on the storm', hint: 'Boosts weather science if you carry atmospheric/thermal instruments.',
        apply: (s) => {
          const has = s.instOn.atmo || s.instOn.thermal || s.instOn.multispec;
          if (has) { s.progress.weather += 2; s.bonus += 20; return 'A once-in-a-decade dataset on storm growth! Weather science boosted.'; }
          addTemp(s, 2, 0.7); return 'Without atmospheric instruments, there was little to measure. Surface science suffered.';
        } },
      { label: 'Wait it out', hint: 'Surface science reduced for 2 months.', apply: (s) => { addTemp(s, 2, 0.7); return 'The team waited for the dust to settle.'; } },
    ],
  },
  {
    id: 'rad_spike', role: 'SE', phases: ['ops'], weight: 2, max: 1, cond: (s) => s.sc.id === 'europa',
    title: '☢️ Radiation stronger than predicted',
    text: () => 'Measurements show Jupiter\'s radiation belts are more intense than the models predicted.',
    learn: 'Radiation is the biggest danger at Jupiter. Missions plan trajectories to limit time in the worst regions.',
    choices: [
      { label: 'Adjust the trajectory', hint: 'Dose −30% for the rest of the mission, science −10%.',
        apply: (s) => { s.doseMult *= 0.7; s.opsEff *= 0.9; return 'New trajectory avoids the harshest regions.'; } },
      { label: 'Ride it out', hint: 'Absorb about half a year of extra dose.', apply: (s) => { s.dose += s.R.rad.doseYr * 0.5; return 'The spacecraft absorbed a heavy extra dose.'; } },
    ],
  },
  {
    id: 'aerobrake', role: 'SE', phases: ['arrival'], weight: 5, max: 1, cond: (s) => s.R.dv.aero,
    title: '🔥 Aerobraking heating alert',
    text: () => 'The Martian upper atmosphere swelled unexpectedly. The last aerobraking pass heated the solar panels close to their limit.',
    learn: 'Aerobraking saves hundreds of kilograms of propellant, but each pass through the atmosphere is risky.',
    choices: [
      { label: 'Raise the low point', hint: '+2 months of aerobraking and ~15 m/s of propellant.',
        apply: (s) => { s.arrivalLeft += 2; s.dvLeft -= 15; return 'Gentler passes: aerobraking took longer but stayed safe.'; } },
      { label: 'Continue as planned', hint: '25% chance of damaging the solar arrays.',
        apply: (s) => { if (rand() < 0.25) { s.solarDamage = 0.75; return 'The panels were scorched and lost 25% of their power.'; } return 'The panels survived. Aerobraking finished on time.'; } },
    ],
  },
  {
    id: 'wheel', role: 'SE', phases: [], weight: 0, max: 9, forced: true,
    title: '⚙️ Reaction wheel failure',
    text: () => 'One reaction wheel has stopped spinning. Without it, the spacecraft cannot point precisely.',
    learn: 'Kepler and Hubble both lost reaction wheels; creative engineering kept them working.',
    choices: [
      { label: 'Hold pointing with thrusters', hint: 'Keeps precision but uses extra propellant every month.', can: (s) => s.R.d.propulsion !== 'none' && s.dvLeft > 10,
        apply: (s) => { s.extraSk += 25; return 'Thrusters now help hold the pointing. Propellant will run out sooner.'; } },
      { label: 'Accept coarse pointing', hint: 'Imaging and high-gain antenna performance drop.',
        apply: (s) => { s.level = Math.min(s.level, 1); return 'The spacecraft continues with coarse pointing.'; } },
    ],
  },
  {
    id: 'extended', role: 'MM', phases: [], weight: 0, max: 9, forced: true,
    setup: (s) => ({ cost: Math.round((s.sc.opsPerYear + opt('ground', s.R.d.ground).perYear) * 10) / 10 }),
    title: '🎉 Primary mission complete!',
    text: (s, c) => `The spacecraft is still healthy. The agency offers a 12-month extended mission for $${c.cost}M of operations money.`,
    learn: 'Many famous missions (Opportunity, Voyager, Hubble) returned most of their science during extended missions.',
    choices: [
      { label: 'Extend by 12 months', hint: (s, c) => `Costs $${c.cost}M · reserve $${Math.round(s.reserve)}M · needs propellant.`,
        can: (s, c) => (s.reserve >= c.cost || s.R.budget === Infinity) && (s.R.orbit.skDv === 0 || s.dvLeft >= s.R.orbit.skDv * 0.8 || s.R.d.propulsion === 'none'),
        apply: (s, c) => { s.reserve -= c.cost; s.plannedOps += 12; s.extended++; return 'Extended mission approved! 12 more months of discovery.'; } },
      { label: 'End the mission', hint: 'Safely shut down the spacecraft.', apply: (s) => { endSim(s, 'complete', '🏁 Mission complete. The spacecraft was safely decommissioned.', 'good'); return 'The team ended the mission on a high note.'; } },
    ],
  },
];
const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

function triggerEvent(sim, id) {
  const ev = EVENT_BY_ID[id];
  const ctx = ev.setup ? ev.setup(sim) : {};
  if (ctx === null) return false;
  sim.pending = { ev, ctx };
  sim.used[id] = (sim.used[id] || 0) + 1;
  sim.lastEvent = sim.t;
  return true;
}

function maybeRandomEvent(sim) {
  const rate = sim.R.diff.eventRate * (sim.phase === 'cruise' ? 0.35 : 1);
  if (rate <= 0 || sim.t - sim.lastEvent < 2 || rand() > rate) return;
  const pool = EVENTS.filter((e) => !e.forced && e.phases.includes(sim.phase) && (sim.used[e.id] || 0) < e.max && (!e.cond || e.cond(sim)));
  if (!pool.length) return;
  let r = rand() * sum(pool, (e) => e.weight);
  for (const e of pool) { r -= e.weight; if (r <= 0) { triggerEvent(sim, e.id); return; } }
}

function resolveEvent(sim, idx) {
  const { ev, ctx } = sim.pending;
  const ch = ev.choices[idx];
  const msg = ch.apply(sim, ctx);
  const title = typeof ev.title === 'function' ? ev.title(sim, ctx) : ev.title;
  sim.decisions.push({ t: sim.t, role: ev.role, title, choice: ch.label, result: msg });
  log(sim, `${title} → ${ch.label}. ${msg}`, 'event');
  sim.pending = null;
}

function randomFailure(sim) {
  const d = sim.R.d;
  const kinds = ['computer', 'radio', 'instrument'];
  if (d.adcs !== 'mtq' && sim.level > 1) kinds.push('wheel', 'wheel');
  const k = kinds[Math.floor(rand() * kinds.length)];
  if (k === 'computer') {
    if (sim.spares <= 0 && rand() < 0.3) { endSim(sim, 'failure', '💀 The flight computer failed permanently. With no backup, the spacecraft is lost.'); return; }
    log(sim, hitComputer(sim, '⚠️ Flight computer fault.'), sim.spares >= 0 ? 'warn' : 'bad');
  } else if (k === 'radio') {
    if (sim.spares > 0) { sim.spares--; log(sim, '⚠️ Radio transmitter failed — the backup radio took over.', 'warn'); }
    else { sim.radioHealth *= 0.5; log(sim, '⚠️ Main radio amplifier degraded. Downlink rate halved.', 'bad'); }
  } else if (k === 'wheel') {
    if (sim.spares > 0) { sim.spares--; log(sim, '⚠️ A reaction wheel failed — the spare wheel took over.', 'warn'); }
    else triggerEvent(sim, 'wheel');
  } else {
    if (sim.phase === 'ops') triggerEvent(sim, 'instrument_glitch');
  }
}

/* ------------------------------------------------------------------ */
/* STEP: advance the simulation by one month                           */
/* ------------------------------------------------------------------ */
function simStep(sim) {
  if (sim.done || sim.pending) return;
  const R = sim.R, sc = sim.sc, orbit = sim.orbit;

  if (sim.phase === 'launch') {
    const rel = R.L.rel - R.diff.relPenalty;
    sim.launched = true;
    if (rand() > rel) { endSim(sim, 'launch', `💥 Launch failure! The ${R.L.name.toLowerCase()} (${Math.round(rel * 100)}% reliable) exploded during ascent.`); return; }
    log(sim, `🚀 Liftoff! The ${R.L.name.toLowerCase()} delivered the spacecraft (${Math.round(R.mass.wet)} kg) to ${DEST_NAME[orbit.launchClass || sc.launchClass]}.`, 'good');
    sim.phase = sim.cruiseLeft > 0 ? 'cruise' : 'arrival';
    if (sim.phase === 'cruise') log(sim, `🛰️ Cruise begins: ${sim.cruiseLeft} months to ${sc.body}.`);
    return;
  }

  sim.t++;
  sim.temp.forEach((x) => x.left--);
  sim.temp = sim.temp.filter((x) => x.left > 0);

  if (sim.phase === 'cruise') {
    sim.cruiseLeft--;
    sim.dose += sc.cruiseRad * opt('shielding', R.d.shielding).factor / 12;
    if (rand() < 0.002 * Math.max(0.3, 1 - 0.6 * (sim.spares > 0))) randomFailure(sim);
    if (!sim.done && !sim.pending) maybeRandomEvent(sim);
    if (sim.cruiseLeft <= 0 && !sim.done) { sim.phase = 'arrival'; }
    return;
  }

  if (sim.phase === 'arrival') {
    if (!sim.inserted) {
      sim.inserted = true;
      sim.dvLeft -= R.dv.insert;
      if (R.dv.insert > 0) log(sim, `🔥 Orbit insertion burn: ${Math.round(R.dv.insert)} m/s. ${orbit.flyby ? 'Trajectory set for the flyby.' : 'Captured into ' + orbit.short + '!'}`, 'good');
      else log(sim, `🛰️ Arrived in ${orbit.short}.`, 'good');
      if (R.dv.aero) { log(sim, '🌬️ Aerobraking: dipping into the atmosphere to lower the orbit…'); if (rand() < 0.6) triggerEvent(sim, 'aerobrake'); }
    }
    sim.arrivalLeft--;
    if (sim.arrivalLeft <= 0) { sim.phase = 'ops'; log(sim, '🔬 Science operations begin!', 'good'); }
    return;
  }

  /* ---------------- operations ---------------- */
  sim.opsMonth++;
  const yrs = sim.t / 12;
  const degr = Math.pow(1 - (sc.id === 'europa' ? 0.04 : 0.02), yrs);
  const gen = R.power.rtg ? R.power.rtg * Math.pow(0.984, yrs) : R.power.solarW * (1 - orbit.eclipse) * degr * sim.solarDamage;
  sim.lastPower = gen;
  const onInsts = R.insts.filter((i) => sim.instOn[i.id]);
  const instLoad = sum(onInsts, (i) => i.power);
  if (gen < R.power.busLoad) {
    endSim(sim, 'power', `🧊 Power failure: only ${Math.round(gen)} W available but the spacecraft needs ${Math.round(R.power.busLoad)} W to stay alive. It froze and went silent.`);
    return;
  }
  const powerF = instLoad > 0 ? clamp((gen - R.power.busLoad - R.power.antAvg) / instLoad, 0, 1) : 1;
  const battF = R.power.batt >= R.power.battNeed ? 1 : 1 - Math.max(orbit.eclipse, R.power.rtg ? 0.3 : 0) * (1 - R.power.batt / R.power.battNeed);
  const pf = powerF * battF;

  // data
  const duty = R.data.duty;
  const genM = sum(onInsts, (i) => i.data * (sim.quality[i.id] ?? 1)) * duty * 30 * pf;
  const rate = currentLinkRate(sim) * sim.radioHealth;
  const downM = rate * R.data.hours * 3.6 * 30 * sim.linkMult;
  sim.linkMult = 1;
  const pool = sim.backlog + genM;
  const down = Math.min(pool, downM);
  const rest = pool - down;
  sim.backlog = Math.min(R.data.storage, rest);
  sim.dataLost += rest - sim.backlog;
  sim.dataGen += genM; sim.dataDown += down;
  const dF = genM > 0 ? clamp(down / genM, 0, 1) : 1;
  sim.lastPF = pf; sim.lastDF = dF;
  sim.pfSum += pf; sim.dfSum += dF; sim.opsCounted++;

  const eff = pf * Math.pow(dF, 0.7) * sim.opsEff * tempFactor(sim) * sim.computerHealth;
  for (const o of sc.objectives) {
    const cap = objectiveCap(o, sim.instOn, R.d.orbit, sim.level, sim.quality);
    sim.progress[o.id] += cap * eff;
    sim.peakCap[o.id] = Math.max(sim.peakCap[o.id], cap);
  }
  if (sim.extended && sim.opsMonth > R.months) sim.bonus += 2;

  // radiation
  sim.dose += R.rad.doseYr * sim.doseMult / 12;
  const tol = R.rad.tol;
  const radRisk = sim.dose > tol ? 0.05 * (sim.dose / tol) : 0;
  const failRate = 0.004 + radRisk;
  if (rand() < failRate) {
    if (radRisk > 0 && rand() < 0.5) log(sim, `☢️ Accumulated radiation (${Math.round(sim.dose)} krad) is damaging electronics.`, 'bad');
    randomFailure(sim);
    if (sim.done) return;
  }

  // station-keeping
  if (R.d.propulsion !== 'none') {
    sim.dvLeft -= (orbit.skDv + sim.extraSk) / 12;
    if (sim.dvLeft <= 0 && sim.decay === null && (orbit.skDv + sim.extraSk) > 0) {
      sim.dvLeft = 0;
      sim.decay = Math.max(1, Math.round(orbit.natLife * 12));
      log(sim, `⛽ Propellant exhausted! Without station-keeping the orbit will decay in ~${sim.decay} months.`, 'bad');
    }
  }
  if (sim.decay !== null) {
    sim.decay--;
    if (sim.decay <= 0) {
      const how = sc.body === 'Earth' ? 're-entered Earth\'s atmosphere and burned up' : 'crashed into the surface';
      endSim(sim, 'decay', `🔻 The orbit decayed and the spacecraft ${how}.`);
      return;
    }
  }

  sim.series.sci.push(currentScience(sim));
  sim.series.reserve.push(sim.reserve);
  sim.series.backlog.push(sim.backlog);

  if (!sim.pending) maybeRandomEvent(sim);

  if (sim.opsMonth >= sim.plannedOps && !sim.done) {
    if (orbit.flyby) { endSim(sim, 'complete', '🏁 Flyby complete. The spacecraft sails on into deep space.', 'good'); return; }
    const canOffer = sim.extended < 2 && (sim.R.budget === Infinity || sim.reserve > 0);
    if (canOffer && !sim.pending) triggerEvent(sim, 'extended');
    else if (!sim.pending) endSim(sim, 'complete', '🏁 Mission complete. The spacecraft was safely decommissioned.', 'good');
  }
}

/* ------------------------------------------------------------------ */
/* SCORING                                                              */
/* ------------------------------------------------------------------ */
function objectiveScores(sim) {
  return sim.sc.objectives.map((o) => {
    const fromTime = sim.progress[o.id] / o.months;
    return { ...o, score: clamp(Math.min(fromTime, sim.peakCap[o.id] || 0), 0, 1), cap: sim.peakCap[o.id] || 0 };
  });
}
function currentScience(sim) {
  return Math.round(sum(objectiveScores(sim), (o) => o.score * o.weight) * 6);
}

function finalScore(sim, approvals) {
  const R = sim.R;
  const objs = objectiveScores(sim);
  const science = Math.round(sum(objs, (o) => o.score * o.weight) * 6);
  const prim = objs.filter((o) => o.primary);
  const primOK = prim.filter((o) => o.score >= 0.6).length;
  const success = primOK === prim.length ? 150 : Math.round(75 * primOK / prim.length);
  let eff = 0;
  if (R.budget !== Infinity) eff += Math.round(60 * clamp(sim.reserve / R.budget / 0.15, 0, 1));
  else eff += 30;
  if (R.power.margin >= 0.1) eff += 30;
  if (R.mass.margin >= 0.1) eff += 30;
  const lostFrac = sim.dataGen > 0 ? sim.dataLost / sim.dataGen : 0;
  if (sim.dataGen > 0 && lostFrac < 0.1) eff += 30;
  const goals = Object.values(R.roleGoals).filter(Boolean).length;
  const team = goals * 20 + (approvals ? 20 : 0);
  const bonus = Math.min(100, Math.round(sim.bonus));
  const launchFail = sim.endReason === 'launch';
  const total = Math.min(1000, launchFail ? Math.round(eff * 0.3 + team * 0.5) : science + success + eff + team + bonus);
  const ranked = Math.round(total * R.diff.scoreMult);
  const grade = total >= 850 ? 'S' : total >= 700 ? 'A' : total >= 550 ? 'B' : total >= 400 ? 'C' : total >= 250 ? 'D' : 'F';
  const minPrim = prim.length ? Math.min(...prim.map((o) => o.score)) : 0;
  const outcome = launchFail ? 'Launch failure'
    : minPrim >= 0.8 ? 'Full success' : minPrim >= 0.6 ? 'Mission success'
      : objs.some((o) => o.score >= 0.3) ? 'Partial success' : 'Mission failure';
  return { objs, science, success, eff, team, bonus, total, ranked, grade, outcome, goals, lostFrac };
}

/* ------------------------------------------------------------------ */
/* LESSONS: explain WHY the mission went the way it did                 */
/* ------------------------------------------------------------------ */
function buildLessons(sim, score) {
  const R = sim.R, sc = sim.sc, L = [];
  const add = (type, title, text) => L.push({ type, title, text });
  if (sim.endReason === 'launch') add('bad', 'The rocket failed', `Your ${R.L.name.toLowerCase()} had a ${Math.round((R.L.rel - R.diff.relPenalty) * 100)}% success rate. Even reliable rockets fail sometimes — that is why expensive missions pick the most proven vehicles and why insurance exists. Try flying the same design again.`);
  if (sim.endReason === 'power') add('bad', 'Not enough power', `Sunlight at ${sc.body} is ${Math.round(100 / (sc.sunAU * sc.sunAU))}% of Earth's (inverse-square law). Your spacecraft produced ${Math.round(sim.lastPower)} W but needed ${Math.round(R.power.busLoad)} W just for its computer, pointing and heaters.`);
  if (sim.endReason === 'decay') add('bad', 'Orbit decayed', `${R.orbit.short} needs ${R.orbit.skDv} m/s of station-keeping per year. ${R.d.propulsion === 'none' ? 'Without propulsion there was no way to fight it.' : 'Your propellant ran out. A bigger propellant reserve or more efficient engine would have extended the mission.'}`);
  if (sim.endReason === 'failure') add('bad', 'Single point of failure', 'A failed part with no backup ended the mission. Redundancy adds mass and cost, but protects against exactly this.');
  if (sim.endReason === 'collision') add('bad', 'Space debris', 'Accepting collision risks occasionally backfires. Propulsion lets you dodge debris — an important reason to carry it even in Earth orbit.');

  if (sim.opsCounted > 0) {
    const pf = sim.pfSum / sim.opsCounted;
    if (pf < 0.95) add('warn', 'Instruments were power-starved', `On average only ${Math.round(pf * 100)}% of the needed instrument power was available${R.power.batt < R.power.battNeed ? ', partly because the battery could not cover the eclipses' : ''}. Bigger solar arrays, a larger battery or fewer power-hungry instruments would help.`);
    if (score.lostFrac > 0.1 || sim.dfSum / sim.opsCounted < 0.9) {
      const sent = sim.dataGen > 0 ? Math.round(100 * sim.dataDown / sim.dataGen) : 0;
      add('warn', 'Data stuck in space', `Only ${sent}% of the data collected reached Earth. Your link delivered ${fmtRate(currentLinkRate(sim))} for ${R.data.hours.toFixed(1)} h per day. Radio signals weaken with distance squared — a larger dish, Ka-band, or the Deep Space Network would carry more.`);
    }
    if (sim.dose > R.rad.tol) add('warn', 'Radiation took its toll', `Electronics absorbed ${Math.round(sim.dose)} krad against a tolerance of ${R.rad.tol} krad. Shielding and radiation-hardened parts are essential in harsh environments.`);
  }
  for (const o of score.objs) {
    if (o.cap < 0.4) add('warn', `Weak instruments for "${o.name}"`, `Your instruments could reach only ${Math.round(o.cap * 100)}% of what this objective needs. Better suited: ${Object.keys(o.needs).map((k) => INSTRUMENTS[k].icon + ' ' + INSTRUMENTS[k].name).join(', ')}.`);
    else if (o.score < o.cap * 0.8 && sim.endReason !== 'launch') add('info', `Not enough time for "${o.name}"`, `It needed ${o.months} months of good observations. Longer operations (or fewer interruptions) would have completed it.`);
  }
  if (R.level < 2 && R.insts.some((i) => i.I.fine)) add('warn', 'Blurry pointing', 'High-resolution instruments need reaction wheels and a star tracker. Coarse pointing smeared the images.');
  if (R.schedule.delay > 0) add('info', 'Schedule slip', `Development took ${R.schedule.dev} months against a ${R.schedule.deadline}-month plan, adding ${fmtMoney(R.schedule.delay * R.schedule.marching)} of cost.`);
  if (sim.extended) add('good', 'Extended mission', `Your healthy spacecraft earned ${sim.extended} extended mission year(s) — great margins pay off.`);
  if (sim.spares < opt('redundancy', R.d.redundancy).spares) add('good', 'Redundancy paid off', 'Backup units took over after failures, keeping the mission alive.');
  if (R.power.margin >= 0.15 && R.mass.margin >= 0.1 && R.data.ratio >= 1) add('good', 'Balanced design', 'Power, mass and data all had healthy margins. That is how real flight projects survive surprises.');
  if (!L.length) add('good', 'Smooth flight', 'Everything went to plan. Could you get the same science for less money?');
  return L;
}
