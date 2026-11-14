'use strict';
/* =========================================================================
   Engineering model: turns a design into mass / power / cost / data /
   schedule / radiation budgets, objective capability and design issues.
   ========================================================================= */

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + f(x), 0);
const opt = (group, key) => PARTS[group].options[key];

function defaultDesign(sc) {
  return {
    orbit: sc.orbits[0],
    months: sc.defaultMonths,
    instruments: {},
    structure: 'aluminum', computer: 'radtol', adcs: 'rw', propulsion: 'mono', propMargin: '10',
    shielding: 'none', redundancy: 'single',
    power: 'deploy3', battery: 'm',
    antenna: 'mga', ground: 'commercial',
    launcher: 'medium', aerobrake: false,
  };
}

/* Pointing level actually achievable (magnetorquers fail away from Earth) */
function pointingLevel(sc, adcsKey, override) {
  if (override != null) return override;
  const a = opt('adcs', adcsKey);
  if (a.nearEarth && sc.body !== 'Earth') return 0.5;
  return a.level;
}

/* How well one instrument performs from this orbit with this pointing */
function instFactor(id, orbit, level) {
  const I = INSTRUMENTS[id];
  let f = 1;
  if (I.kind === 'imaging') f = Math.min(1.3, orbit.res) * orbit.light;
  else if (I.kind === 'radar') f = Math.pow(Math.min(1.3, orbit.res), 0.7);
  else if (I.kind === 'thermal') f = Math.pow(Math.min(1.3, orbit.res), 0.5);
  // pointing
  if (I.fine) f *= level >= 3 ? 1.15 : level >= 2 ? 1 : level >= 1 ? 0.35 : 0.15;
  else if (I.kind !== 'insitu') f *= level >= 2 ? 1 : level >= 1 ? 0.85 : 0.4;
  return f;
}

/* Capability (0..1) of the current instrument set for one objective.
   quality: optional {instId: multiplier} from in-flight damage            */
function objectiveCap(obj, insts, orbitKey, level, quality) {
  const orbit = ORBITS[orbitKey];
  let s = 0;
  for (const [id, w] of Object.entries(obj.needs)) {
    const tier = insts[id];
    if (!tier) continue;
    const q = quality ? (quality[id] ?? 1) : 1;
    s += w * TIER[tier].q * instFactor(id, orbit, level) * q;
  }
  const fit = (obj.fit && obj.fit[orbitKey]) || 1;
  return clamp(s * fit, 0, 1);
}

function computeDesign(sc, d, diffKey) {
  const diff = DIFFICULTY[diffKey];
  const orbit = ORBITS[d.orbit];
  const L = LAUNCHERS[d.launcher];
  const struct = opt('structure', d.structure), comp = opt('computer', d.computer), adcs = opt('adcs', d.adcs);
  const prop = opt('propulsion', d.propulsion), pm = opt('propMargin', d.propMargin), shield = opt('shielding', d.shielding);
  const red = opt('redundancy', d.redundancy), pwr = opt('power', d.power), batt = opt('battery', d.battery);
  const ant = opt('antenna', d.antenna), gnd = opt('ground', d.ground);
  const budget = diff.budgetMult ? Math.round(sc.budget * diff.budgetMult) : Infinity;
  const months = orbit.maxOps ? orbit.maxOps : d.months;
  const years = months / 12;
  const level = pointingLevel(sc, d.adcs);

  /* ---------- instruments ---------- */
  const insts = Object.entries(d.instruments).filter(([, t]) => t > 0).map(([id, t]) => {
    const I = INSTRUMENTS[id], T = TIER[t];
    return { id, t, I, mass: I.mass * T.m, power: I.power * T.p, cost: I.cost * T.c, data: I.data * T.d, dev: I.dev + T.dev };
  });

  /* ---------- mass ---------- */
  const avionicsMass = (comp.mass + adcs.mass + batt.mass + ant.mass) * red.mult;
  const massItems = [
    ['Instruments', sum(insts, (i) => i.mass)],
    ['Avionics & comms', avionicsMass],
    ['Power source', pwr.mass],
    ['Propulsion (dry)', prop.mass],
    ['Shielding', shield.mass],
  ];
  const sub = sum(massItems, (m) => m[1]);
  const structMass = sub * struct.frac;
  massItems.push(['Structure', structMass]);
  const dry = sub + structMass;

  /* ---------- Δv & propellant ---------- */
  const aero = !!(d.aerobrake && orbit.aerobrake);
  const insertDv = aero ? Math.max(300, orbit.insertDv - 1000) : orbit.insertDv;
  const skDv = orbit.skDv * years;
  const dvNeed = insertDv + skDv;
  const dvCap = dvNeed * (1 + pm.margin);
  let propMass = 0;
  if (prop.isp > 0) propMass = dry * (Math.exp(dvCap / (prop.isp * G0)) - 1);
  const tank = propMass * 0.1;
  const wet = dry + propMass + tank;
  massItems.push(['Propellant + tanks', propMass + tank]);
  const launchClass = orbit.launchClass || sc.launchClass;
  const cap = L.cap[launchClass] || 0;
  const massMargin = cap > 0 ? (cap - wet) / cap : -1;

  /* ---------- power ---------- */
  const heater = 12 * sc.sunAU * (pwr.rtg ? 0.5 : 1);
  const busLoad = comp.power + adcs.power + prop.power + heater;
  const instLoad = sum(insts, (i) => i.power);
  const hours = Math.min(24, gnd.hours * orbit.contact);
  const contactFrac = hours / 24;
  const antAvg = ant.power * contactFrac;
  const load = busLoad + instLoad + antAvg;
  const solarW = pwr.w1 ? pwr.w1 / (sc.sunAU * sc.sunAU) : 0;
  const genAvg = pwr.rtg ? pwr.rtg : solarW * (1 - orbit.eclipse);
  const powerMargin = (genAvg - load) / load;
  const battNeed = pwr.rtg
    ? Math.max(0, busLoad + instLoad + ant.power - pwr.rtg) * 1.5 / 0.5
    : load * orbit.eclipseH / 0.4;

  /* ---------- communications ---------- */
  const d2 = sc.distAU * sc.distAU;
  const pointOK = level >= ant.level ? 1 : (ant.level - level >= 1.5 ? 0.05 : ant.level === 1 ? 0.3 : 0.15);
  const rateRaw = Math.min(ant.max, ant.r1 * gnd.gain / d2);
  const rate = rateRaw * pointOK; // kbps
  const downDay = rate * hours * 3.6; // Mbit/day
  const duty = orbit.duty || 1;
  const genDay = sum(insts, (i) => i.data) * duty;
  const dataRatio = genDay > 0 ? downDay / genDay : Infinity;

  /* ---------- cruise & schedule ---------- */
  const cruise = sc.cruise * ((L.cruiseMult && L.cruiseMult[sc.launchClass]) || 1)
    + (d.propulsion === 'ion' ? insertDv / 400 : 0);
  const extraArrival = aero ? 6 : 0;
  const partDevs = ['structure', 'computer', 'adcs', 'propulsion', 'shielding', 'redundancy', 'power', 'antenna']
    .reduce((s, g) => s + (opt(g, d[g]).dev || 0), 0);
  const dev = Math.round(18 + partDevs + sum(insts, (i) => i.dev) * 0.6);
  const late = Math.max(0, dev - sc.deadline);
  const delay = sc.window && late > 0 ? Math.ceil(late / sc.window) * sc.window : late;

  /* ---------- cost ---------- */
  const avionicsCost = (comp.cost + adcs.cost + batt.cost + ant.cost) * red.mult;
  const costHW = [
    ['Instruments', sum(insts, (i) => i.cost)],
    ['Avionics & comms', avionicsCost],
    ['Power', pwr.cost],
    ['Propulsion', prop.cost],
    ['Structure', struct.cost],
    ['Shielding', shield.cost],
  ];
  const hardware = sum(costHW, (c) => c[1]);
  const iat = hardware * 0.25;
  const marching = 1 + hardware * 0.015;
  const delayCost = delay * marching;
  const opsCost = (sc.opsPerYear + gnd.perYear) * (months + extraArrival) / 12
    + (sc.opsPerYear * 0.5 + gnd.perYear) * cruise / 12;
  const costItems = [
    ['Hardware', hardware],
    ['Integration, test & management', iat],
    ['Launch', L.cost],
    ['Operations & ground', opsCost],
  ];
  if (delayCost > 0) costItems.push(['Schedule delay', delayCost]);
  const total = sum(costItems, (c) => c[1]);
  const reserve = budget - total;
  const reservePct = budget === Infinity ? 1 : reserve / budget;

  /* ---------- radiation ---------- */
  const doseYr = orbit.rad * shield.factor;
  const cruiseDose = sc.cruiseRad * shield.factor * cruise / 12;
  const missionDose = cruiseDose + doseYr * years;
  const radTol = comp.radTol;

  /* ---------- science capability ---------- */
  const instMap = d.instruments;
  const objectives = sc.objectives.map((o) => ({ ...o, cap: objectiveCap(o, instMap, d.orbit, level) }));
  const sciPotential = sum(objectives, (o) => o.cap * o.weight) / 100;

  /* ---------- issues ---------- */
  const issues = [];
  const E = (role, text, why) => issues.push({ level: 'error', role, text, why });
  const W = (role, text, why) => issues.push({ level: 'warn', role, text, why });
  const G = (role, text) => issues.push({ level: 'good', role, text });
  const fmtM = (x) => '$' + Math.round(x) + 'M';

  if (!insts.length) E('SL', 'No science instruments selected.', 'Add at least one instrument.');
  if (total > budget) E('MM', `Over budget by ${fmtM(total - budget)}.`, 'Cut instruments, pick a cheaper rocket or shorten the mission.');
  if (cap === 0) E('MM', `The ${L.name.toLowerCase()} cannot reach ${DEST_NAME[launchClass]}.`, 'Pick a bigger rocket.');
  else if (wet > cap) E('SE', `Too heavy: ${Math.round(wet)} kg wet vs ${Math.round(cap)} kg rocket capacity.`, 'Remove instruments or pick a bigger rocket.');
  if (L.onlyOrbit && !L.onlyOrbit.includes(d.orbit)) E('MM', `Rideshare only goes to ${L.onlyOrbit.map((o) => ORBITS[o].short).join(', ')}.`, 'Pick another orbit or another rocket.');
  if (prop.isp === 0 && insertDv > 0) E('SE', `This orbit needs ${Math.round(insertDv)} m/s of Δv, but there is no propulsion.`, 'Pick an engine.');
  if (struct.maxDry && dry > struct.maxDry) E('SE', `Small-sat bus is limited to ${struct.maxDry} kg dry (you have ${Math.round(dry)} kg).`, 'Pick a bigger frame or fewer instruments.');
  if (prop.needsW && (pwr.w1 || 0) < prop.needsW) E('SE', 'Ion engine needs ≥ 1 kW solar array power.', 'Pick bigger panels or another engine.');

  if (cap > 0 && wet <= cap && massMargin < 0.1) W('SE', `Mass margin only ${Math.round(massMargin * 100)}%.`, 'Craft get heavier while being built; leave some room.');
  if (genAvg < busLoad) W('SE', 'CRITICAL: power cannot even keep the spacecraft alive.', 'Pick a bigger power source.');
  else if (powerMargin < 0) W('SE', `Power-negative: ${Math.round(-powerMargin * 100)}% short.`, 'Instruments will sometimes switch off, less science.');
  else if (powerMargin < 0.15) W('SE', `Power margin only ${Math.round(powerMargin * 100)}%.`, 'Panels weaken over time; a little spare helps.');
  if (batt.wh < battNeed) W('SE', `Battery too small: needs ~${Math.round(battNeed)} Wh, has ${batt.wh} Wh.`, pwr.rtg ? 'A bigger battery is needed.' : 'In shadow everything runs on battery; get a bigger one.');
  if (genDay > 0 && dataRatio < 1) W('CL', `Only ${Math.round(dataRatio * 100)}% of the data can be sent.`, 'Pick a bigger antenna or fewer instruments.');
  if (pointOK < 1) W('CL', 'Pointing is not good enough for this antenna.', 'A dish must point right at Earth.');
  if (adcs.nearEarth && sc.body !== 'Earth') W('SE', 'This steering system does not work far from Earth.', 'Images and antenna will be poor.');
  if (missionDose > radTol) W('SE', `Radiation: ${Math.round(missionDose)} krad expected vs ${radTol} krad computer tolerance.`, 'Add shielding or a tougher computer.');
  if (prop.isp === 0 && orbit.natLife * 12 < months) W('MM', `No propulsion: orbit decays after ~${Math.round(orbit.natLife * 12)} months.`, 'Add an engine.');
  if (late > 0) W('MM', sc.window ? `Development is ${late} months late → miss the launch window, wait ${delay} months.` : `Development is ${late} months behind schedule.`, `Each month of delay costs ${fmtM(marching)}.`);
  for (const o of objectives) {
    if (o.primary && o.cap < 0.5) W('SL', `Weak capability for primary objective "${o.name}" (${Math.round(o.cap * 100)}%).`, 'Useful instruments: ' + Object.keys(o.needs).map((k) => INSTRUMENTS[k].name).join(', ') + '.');
    if (o.primary && o.months > months && !orbit.maxOps) W('MM', `"${o.name}" needs ${o.months} months; mission plan is ${months}.`, 'Make the mission longer.');
  }
  if (budget !== Infinity && total <= budget && reservePct < 0.1) W('MM', `Reserve only ${Math.round(reservePct * 100)}% of budget.`, 'Spare money pays for problems in flight.');
  if (L.rel - diff.relPenalty < 0.95) W('MM', `Launch reliability ${Math.round((L.rel - diff.relPenalty) * 100)}%.`, 'This rocket fails more often.');

  if (!issues.some((i) => i.level !== 'good')) G('ALL', 'All subsystems within limits — great engineering!');
  if (powerMargin >= 0.15 && powerMargin < 1) G('SE', 'Healthy power margin.');
  if (massMargin >= 0.1 && massMargin < 0.6) G('SE', 'Healthy mass margin.');
  if (dataRatio >= 1 && genDay > 0) G('CL', 'Downlink can carry all science data.');

  const roleGoals = {
    MM: total <= budget && reservePct >= 0.1,
    SE: powerMargin >= 0.15 && massMargin >= 0.1,
    SL: objectives.filter((o) => o.primary).every((o) => o.cap >= 0.7),
    CL: genDay > 0 && dataRatio >= 1,
  };

  return {
    sc, d, diff, orbit, L, insts, level, budget, months, years,
    mass: { items: massItems, dry, propMass: propMass + tank, wet, cap, margin: massMargin },
    dv: { insert: insertDv, sk: skDv, need: dvNeed, cap: dvCap, aero },
    power: { busLoad, instLoad, antAvg, load, genAvg, solarW, rtg: pwr.rtg || 0, margin: powerMargin, battNeed, batt: batt.wh, heater },
    data: { rate, rateRaw, hours, downDay, genDay, ratio: dataRatio, storage: comp.storage * 1000, duty, pointOK },
    schedule: { dev, deadline: sc.deadline, late, delay, marching, cruise, extraArrival },
    cost: { items: costItems, hwItems: costHW, hardware, total, reserve, reservePct, budget },
    rad: { doseYr, cruiseDose, missionDose, tol: radTol },
    objectives, sciPotential, issues, roleGoals,
    errors: issues.filter((i) => i.level === 'error'),
  };
}

function fmtRate(kbps) {
  if (kbps >= 1000) return (kbps / 1000).toFixed(kbps >= 10000 ? 0 : 1) + ' Mbps';
  if (kbps >= 1) return kbps.toFixed(kbps >= 10 ? 0 : 1) + ' kbps';
  return Math.round(kbps * 1000) + ' bps';
}
function fmtData(mbit) {
  if (mbit >= 1e6) return (mbit / 8e6).toFixed(1) + ' TB';
  if (mbit >= 8000) return (mbit / 8000).toFixed(1) + ' GB';
  if (mbit >= 8) return (mbit / 8).toFixed(0) + ' MB';
  return (mbit * 125).toFixed(0) + ' kB';
}
function fmtMoney(m) {
  if (m === Infinity) return '∞';
  if (Math.abs(m) >= 1000) return '$' + (m / 1000).toFixed(2) + 'B';
  return '$' + Math.round(m) + 'M';
}
