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
    ['Aletler', sum(insts, (i) => i.mass)],
    ['Elektronik ve haberleşme', avionicsMass],
    ['Güç kaynağı', pwr.mass],
    ['İtki (kuru)', prop.mass],
    ['Kalkan', shield.mass],
  ];
  const sub = sum(massItems, (m) => m[1]);
  const structMass = sub * struct.frac;
  massItems.push(['Gövde yapısı', structMass]);
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
  massItems.push(['Yakıt + tanklar', propMass + tank]);
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
    ['Aletler', sum(insts, (i) => i.cost)],
    ['Elektronik ve haberleşme', avionicsCost],
    ['Güç', pwr.cost],
    ['İtki', prop.cost],
    ['Gövde yapısı', struct.cost],
    ['Kalkan', shield.cost],
  ];
  const hardware = sum(costHW, (c) => c[1]);
  const iat = hardware * 0.25;
  const marching = 1 + hardware * 0.015;
  const delayCost = delay * marching;
  const opsCost = (sc.opsPerYear + gnd.perYear) * (months + extraArrival) / 12
    + (sc.opsPerYear * 0.5 + gnd.perYear) * cruise / 12;
  const costItems = [
    ['Donanım', hardware],
    ['Entegrasyon, test ve yönetim', iat],
    ['Fırlatma', L.cost],
    ['Operasyon ve yer istasyonu', opsCost],
  ];
  if (delayCost > 0) costItems.push(['Takvim gecikmesi', delayCost]);
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

  if (!insts.length) E('SL', 'Hiç bilimsel alet seçilmedi.', 'Aletsiz bir uzay aracı görevin hiçbir sorusunu cevaplayamaz.');
  if (total > budget) E('MM', `Bütçe ${fmtM(total - budget)} aşıldı.`, 'Uzay ajansları maliyet sınırını aşan görevleri iptal eder. Alet azalt, daha ucuz roket seç veya operasyonu kısalt.');
  if (cap === 0) E('MM', `${L.name} ${DEST_NAME[launchClass]} ulaşamıyor.`, 'Her roketin yüke verebileceği en yüksek bir enerji vardır. Uzak hedefler daha büyük roket ister.');
  else if (wet > cap) E('SE', `Çok ağır: ıslak kütle ${Math.round(wet)} kg, roket kapasitesi ${Math.round(cap)} kg.`, 'Kütleyi azalt (daha hafif parçalar, daha az alet, daha verimli motor daha az yakıt ister) ya da daha büyük roket seç.');
  if (L.onlyOrbit && !L.onlyOrbit.includes(d.orbit)) E('MM', `Paylaşımlı fırlatma sadece ${L.onlyOrbit.map((o) => ORBITS[o].short).join(', ')} yörüngesine gider.`, 'Paylaşımlı yolcu, ana müşteri nereye giderse oraya gider.');
  if (prop.isp === 0 && insertDv > 0) E('SE', `Bu yörünge ${Math.round(insertDv)} m/s Δv ister, ama itki sistemi yok.`, 'Motor olmadan araç yörüngeye girmek için frenleyemez — yanından geçip gider.');
  if (struct.maxDry && dry > struct.maxDry) E('SE', `Küçük uydu gövdesi en fazla ${struct.maxDry} kg kuru kütle taşır (seninki ${Math.round(dry)} kg).`, 'Küçük uydu çerçeveleri sert fırlatma sırasında ağır yükler için yeterince sağlam değildir.');
  if (prop.needsW && (pwr.w1 || 0) < prop.needsW) E('SE', 'İyon motoru ≥ 1 kW güneş paneli gücü ister.', 'İyon motorları iyonları elektrikle hızlandırır — güç yoksa itki de yok.');

  if (cap > 0 && wet <= cap && massMargin < 0.1) W('SE', `Kütle payı sadece %${Math.round(massMargin * 100)}.`, 'Uzay araçları geliştirme sırasında neredeyse hep ağırlaşır. Gerçek projeler %10–30 pay bırakır.');
  if (genAvg < busLoad) W('SE', 'KRİTİK: güç, aracı hayatta tutmaya bile yetmiyor.', `Yörünge ortalaması güç ${Math.round(genAvg)} W ama gövde tek başına ${Math.round(busLoad)} W istiyor. Araç donup ölecek.`);
  else if (powerMargin < 0) W('SE', `Güç eksik: %${Math.round(-powerMargin * 100)} yetersiz.`, 'Aletler zamanın bir kısmında kapatılmak zorunda kalacak, bu da bilimi azaltır.');
  else if (powerMargin < 0.15) W('SE', `Güç payı sadece %${Math.round(powerMargin * 100)}.`, 'Güneş panelleri zamanla yıpranır (≈ yılda %2). Pay, görevin sonlarında seni korur.');
  if (batt.wh < battNeed) W('SE', `Batarya çok küçük: ~${Math.round(battNeed)} Wh gerekli, ${batt.wh} Wh var.`, pwr.rtg ? 'RTG\'ler küçük ama sabit güç verir; her şey aynı anda çalışınca piklerini batarya karşılar.' : 'Tutulmada tüm yükü batarya taşır. Binlerce döngüye dayanması için bataryalar her döngüde sadece ~%40 boşaltılır.');
  if (genDay > 0 && dataRatio < 1) W('CL', `Veri bağlantısı üretilen verinin sadece %${Math.round(dataRatio * 100)} kadarını taşıyabiliyor.`, `${sc.distAU >= 0.01 ? sc.distAU + ' AU uzaklıkta' : 'Bu uzaklıkta'} bağlantı günde ${hours.toFixed(1)} saat boyunca ${fmtRate(rate)} veriyor. Daha büyük anten, daha büyük yer istasyonu veya daha az veri üreten aletler yardımcı olur.`);
  if (pointOK < 1) W('CL', 'Anten, yönelim sisteminin sağlayabileceğinden daha hassas hedefleme istiyor.', 'Yüksek kazançlı çanakların ışını dardır: Dünya\'ya tam çevrilmezse sinyal kaybolur.');
  if (adcs.nearEarth && sc.body !== 'Earth') W('SE', 'Manyetik tork çubukları Dünya\'nın manyetik alanından uzakta neredeyse çalışmaz.', 'Yönelim çok zayıf olacak: görüntüleme ve antenler ciddi zarar görür.');
  if (missionDose > radTol) W('SE', `Radyasyon: ${Math.round(missionDose)} krad bekleniyor, bilgisayar toleransı ${radTol} krad.`, 'Tolerans aşılınca elektronik giderek daha sık arızalanır. Kalkan ekle ya da sertleştirilmiş bilgisayar seç.');
  if (prop.isp === 0 && orbit.natLife * 12 < months) W('MM', `İtki yok: yörünge ~${Math.round(orbit.natLife * 12)} ay sonra çöküyor.`, 'Yörünge koruma ateşlemeleri olmadan sürtünme veya kütle çekim bozulmaları görevi erken bitirir.');
  if (late > 0) W('MM', sc.window ? `Geliştirme ${late} ay gecikti → fırlatma penceresi kaçıyor, ${delay} ay bekleme.` : `Geliştirme takvimin ${late} ay gerisinde.`, `Her gecikme ayı ekibin maaşını ödemeye devam etmek demek (≈ ayda ${fmtM(marching)}).`);
  for (const o of objectives) {
    if (o.primary && o.cap < 0.5) W('SL', `"${o.name}" ana hedefi için zayıf yeterlilik (%${Math.round(o.cap * 100)}).`, 'İşe yarayan aletler: ' + Object.keys(o.needs).map((k) => INSTRUMENTS[k].name).join(', ') + '.');
    if (o.primary && o.months > months && !orbit.maxOps) W('MM', `"${o.name}" ${o.months} ay ister; görev planı ${months} ay.`, 'Mevsimler gibi bazı olaylar ancak uzun sürede incelenebilir.');
  }
  if (budget !== Infinity && total <= budget && reservePct < 0.1) W('MM', `Yedek bütçe sadece %${Math.round(reservePct * 100)}.`, 'Yedekler uçuş sırasındaki arızaları karşılar. Yedek yoksa sorunlar görevi kısaltmaya zorlar.');
  if (L.rel - diff.relPenalty < 0.95) W('MM', `Fırlatma güvenilirliği %${Math.round((L.rel - diff.relPenalty) * 100)}.`, 'Az denenmiş roketler daha sık başarısız olur. Tasarruf bu riske değer mi?');

  if (!issues.some((i) => i.level !== 'good')) G('ALL', 'Tüm alt sistemler sınırlar içinde — harika mühendislik!');
  if (powerMargin >= 0.15 && powerMargin < 1) G('SE', 'Sağlıklı güç payı.');
  if (massMargin >= 0.1 && massMargin < 0.6) G('SE', 'Sağlıklı kütle payı.');
  if (dataRatio >= 1 && genDay > 0) G('CL', 'Veri bağlantısı tüm bilimsel veriyi taşıyabiliyor.');

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
  if (Math.abs(m) >= 1000) return '$' + (m / 1000).toFixed(2).replace('.', ',') + ' milyar';
  return '$' + Math.round(m) + 'M';
}
