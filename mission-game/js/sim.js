'use strict';
/* =========================================================================
   Görev simülasyonu: ay ay uçuş, sorumlu rolün karar verdiği rastgele
   olaylar, ardından puanlama ve dersler.
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
    return cause + ' Yedek bilgisayar otomatik olarak devreye girdi — yedeklilik günü kurtardı.';
  }
  sim.computerHealth *= 0.7; addTemp(sim, 2, 0.4);
  return cause + ' Yedek olmadığı için ekip toparlanmak için haftalarca uğraştı. Belleğin bir kısmı kalıcı olarak hasar gördü.';
}

function currentLinkRate(sim) {
  const R = sim.R;
  const ant = opt('antenna', R.d.antenna);
  const lvl = sim.level;
  const pointOK = lvl >= ant.level ? 1 : (ant.level - lvl >= 1.5 ? 0.05 : ant.level === 1 ? 0.3 : 0.15);
  return R.data.rateRaw * pointOK;
}
const instName = (id) => INSTRUMENTS[id].name;

/* ------------------------------------------------------------------ */
/* OLAYLAR                                                              */
/* ------------------------------------------------------------------ */
const EARTH_LOW = ['leo400', 'sso', 'ddsso'];
const EVENTS = [
  {
    id: 'solar_storm', role: 'SE', phases: ['cruise', 'ops'], weight: 3, max: 2,
    title: '☀️ Güneş fırtınası geliyor',
    text: (s) => `Güneş'ten gelen bir parçacık fırtınası birkaç saat içinde araca çarpacak. Elektroniğe zarar verebilir.`,
    learn: 'Gerçek uydular fırtınada "güvenli moda" geçer: aletler kapanır.',
    choices: [
      { label: 'Güvenli moda geç', hint: 'Yaklaşık iki haftalık bilim kaybı. Risk yok.',
        apply: (s) => { addTemp(s, 1, 0.5); return 'Güvenli mod: fırtına zararsız geçti; iki haftalık gözlem kaybedildi.'; } },
      { label: 'Gözleme devam et', hint: 'Riskli: elektroniğine bağlı.',
        apply: (s) => {
          const base = { cots: 0.55, radtol: 0.2, radhard: 0.05 }[s.R.d.computer] * Math.sqrt(opt('shielding', s.R.d.shielding).factor);
          if (rand() < base) return hitComputer(s, 'Fırtına uçuş bilgisayarını çökertti.');
          if (s.instOn.particles) { s.bonus += 15; return 'Parçacık dedektörün fırtınayı yakından kaydetti — bonus bilim!'; }
          return 'Elektronik dayandı ve bilim kesintisiz sürdü.';
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
    title: (s, c) => `⚠️ Alet arızası: ${instName(c.id)}`,
    text: (s, c) => `"${instName(c.id)}" bozuk veri gönderiyor.`,
    learn: 'Çoğu sorun, Dünya\'dan yeni yazılım gönderilerek çözülür.',
    choices: [
      { label: 'Araştırma başlat', hint: (s, c) => `Yedekten $${c.cost}M. ~%80 tam onarım şansı.`,
        can: (s, c) => s.reserve >= c.cost,
        apply: (s, c) => {
          s.reserve -= c.cost;
          if (rand() < 0.8) return `Ekip bir yazılım çözümü buldu. "${instName(c.id)}" yeniden tam çalışıyor.`;
          s.quality[c.id] = 0.6; return 'Tüm çabaya rağmen alet sadece düşük kalitede çalışabiliyor.';
        } },
      { label: 'Düşük kalitede çalıştır', hint: 'Ücretsiz, ama alet ~%60 kalite verir.',
        apply: (s, c) => { s.quality[c.id] = 0.6; return `"${instName(c.id)}" düşük kalitede çalışmaya devam ediyor.`; } },
      { label: 'Kapat', hint: 'Gücü diğer aletlere kalır.',
        apply: (s, c) => { s.instOn[c.id] = 0; return `"${instName(c.id)}" kapatıldı. Diğer aletler daha fazla güç ve bant genişliği alıyor.`; } },
    ],
  },
  {
    id: 'budget_cut', role: 'MM', phases: ['ops'], weight: 1.5, max: 1, cond: (s) => s.opsMonth >= 3 && s.R.budget !== Infinity,
    setup: (s) => ({ amount: Math.max(2, Math.round(s.R.budget * 0.05)) }),
    title: '🏛️ Ajans bütçesinde kesinti',
    text: (s, c) => `Uzay ajansının bütçesi azaltıldı. Görevin $${c.amount}M geri vermek zorunda.`,
    learn: 'Yedek para, görevi bu tür kesintilere karşı korur.',
    choices: [
      { label: 'Yedekten öde', hint: (s) => `Yedek: $${Math.round(s.reserve)}M`, can: (s, c) => s.reserve >= c.amount,
        apply: (s, c) => { s.reserve -= c.amount; return 'Kesinti yedekten karşılandı. Bilim planlandığı gibi sürüyor.'; } },
      { label: 'Görevi %25 kısalt', hint: 'Daha az operasyon ayı.',
        apply: (s) => { s.plannedOps = Math.max(s.opsMonth + 1, Math.round(s.plannedOps * 0.75)); return `Görev artık ${s.plannedOps} aylık operasyondan sonra bitecek.`; } },
      { label: 'Operasyon ekibini küçült', hint: 'Görevin geri kalanında bilim verimi −%15.',
        apply: (s) => { s.opsEff *= 0.85; return 'Daha küçük ekiple her hafta daha az gözlem planlanabiliyor.'; } },
    ],
  },
  {
    id: 'debris', role: 'MM', phases: ['ops'], weight: 2, max: 2, cond: (s) => EARTH_LOW.includes(s.R.d.orbit),
    title: '💥 Çarpışma uyarısı',
    text: () => 'Bir uzay çöpü 2 gün içinde çok yakından geçecek. Çarpma ihtimali 100\'de 1.',
    learn: 'Dünya\'nın çevresinde on binlerce uzay çöpü dolaşıyor.',
    choices: [
      { label: 'Kaçınma manevrası yap', hint: '~2 m/s yakıt harcar.', can: (s) => s.R.d.propulsion !== 'none' && s.dvLeft >= 2,
        apply: (s) => { s.dvLeft -= 2; return 'Küçük bir ateşleme aracı güvenle yoldan çekti.'; } },
      { label: 'Riski kabul et', hint: 'Aracı kaybetme şansı 100\'de 1.',
        apply: (s) => { if (rand() < 0.01) { endSim(s, 'collision', '💥 Enkaz araca çarptı. Görev kaybedildi.'); return 'Araç çarpmayla yok oldu.'; } return 'Enkaz zararsızca geçti — bu sefer.'; } },
    ],
  },
  {
    id: 'ground_outage', role: 'CL', phases: ['ops'], weight: 2, max: 2,
    title: '📡 Yer istasyonu arızası',
    text: () => 'Fırtına yer antenini bozdu. İki hafta çalışmayacak.',
    learn: 'Araç, belleği dolana kadar veriyi kendinde saklayabilir.',
    choices: [
      { label: 'Yedek anten kirala', hint: '$2M. Veri kaybı yok.', can: (s) => s.reserve >= 2,
        apply: (s) => { s.reserve -= 2; return 'Yedek antenler veri akışını sürdürdü.'; } },
      { label: 'Veriyi araçta sakla', hint: (s) => `Ücretsiz. Depolama: ${fmtData(s.R.data.storage)}. Taşan veri kaybolur.`,
        apply: (s) => { s.linkMult = 0.5; return 'Veri istasyon geri gelene kadar araçta saklandı.'; } },
    ],
  },
  {
    id: 'conjunction', role: 'CL', phases: ['ops'], weight: 2, max: 2, cond: (s) => s.sc.distAU > 1,
    title: '🌞 Güneş kavuşumu',
    text: () => 'Güneş, Dünya ile aracın arasına giriyor. İki hafta iletişim olmayacak.',
    learn: 'Bu, Mars görevlerinde düzenli olarak yaşanır.',
    choices: [
      { label: 'Otomatik gözleme devam et', hint: (s) => `Veriyi araçta sakla (${fmtData(s.R.data.storage)}). Taşan veri kaybolur.`,
        apply: (s) => { s.linkMult = 0.5; if (s.R.d.computer === 'cots' && rand() < 0.3) return hitComputer(s, 'İletişim yokken bir yazılım hatası fark edilmedi.'); return 'Araç önceden yüklenen komut dizisini kusursuz uyguladı.'; } },
      { label: 'Bilimi durdur', hint: 'Güvenli, ama iki haftalık bilim kaybı.',
        apply: (s) => { addTemp(s, 1, 0.5); s.linkMult = 0.5; return 'Güneş yoldan çekilene kadar bilim durduruldu.'; } },
    ],
  },
  {
    id: 'discovery', role: 'SL', phases: ['ops'], weight: 1.5, max: 1,
    title: '✨ Beklenmedik fırsat!',
    text: (s) => s.sc.discovery,
    learn: 'Planı değiştirmek yakıt ve para ister.',
    choices: [
      { label: 'Aracı yeni hedefe çevir', hint: '$2M ve ~5 m/s yakıt.', can: (s) => s.reserve >= 2 && s.dvLeft >= 5 && s.R.d.propulsion !== 'none',
        apply: (s) => {
          s.reserve -= 2; s.dvLeft -= 5;
          const imaging = Object.keys(s.instOn).filter((k) => s.instOn[k] && INSTRUMENTS[k].kind !== 'insitu');
          if (imaging.length) { s.bonus += 40; return 'Muhteşem gözlemler! Bilim insanları çok heyecanlı — bonus bilim puanı.'; }
          s.bonus += 8; return 'Oraya yöneldin ama aletlerin bunu gözlemlemeye pek uygun değil. Küçük bonus.';
        } },
      { label: 'Plana sadık kal', hint: 'Maliyet yok, bonus yok.', apply: () => 'Ekip planlanan gözlemlere devam etti.' },
    ],
  },
  {
    id: 'dust_storm', role: 'SL', phases: ['ops'], weight: 2, max: 1, cond: (s) => s.sc.id === 'mars',
    title: '🌪️ Küresel toz fırtınası',
    text: () => 'Toz fırtınası tüm gezegeni sardı. Yüzey aylarca görünmeyecek.',
    learn: 'Bu fırtınalar iklim bilimciler için büyük fırsattır.',
    choices: [
      { label: 'Fırtınaya odaklan', hint: 'Hava aletlerin varsa bilim artar.',
        apply: (s) => {
          const has = s.instOn.atmo || s.instOn.thermal || s.instOn.multispec;
          if (has) { s.progress.weather += 2; s.bonus += 20; return 'On yılda bir görülecek bir fırtına veri seti! Hava bilimi güçlendi.'; }
          addTemp(s, 2, 0.7); return 'Atmosfer aletleri olmadan ölçecek pek bir şey yoktu. Yüzey bilimi zarar gördü.';
        } },
      { label: 'Geçmesini bekle', hint: '2 ay boyunca yüzey bilimi azalır.', apply: (s) => { addTemp(s, 2, 0.7); return 'Ekip tozun yatışmasını bekledi.'; } },
    ],
  },
  {
    id: 'rad_spike', role: 'SE', phases: ['ops'], weight: 2, max: 1, cond: (s) => s.sc.id === 'europa',
    title: '☢️ Radyasyon tahminden güçlü',
    text: () => 'Jüpiter\'in radyasyonu beklenenden güçlü çıktı.',
    learn: 'Jüpiter\'deki en büyük tehlike radyasyondur.',
    choices: [
      { label: 'Rotayı değiştir', hint: 'Radyasyon −%30, bilim −%10.',
        apply: (s) => { s.doseMult *= 0.7; s.opsEff *= 0.9; return 'Yeni rota en sert bölgelerden kaçınıyor.'; } },
      { label: 'Göze al', hint: 'Yaklaşık yarım yıllık ek doz al.', apply: (s) => { s.dose += s.R.rad.doseYr * 0.5; return 'Araç ağır bir ek doz aldı.'; } },
    ],
  },
  {
    id: 'aerobrake', role: 'SE', phases: ['arrival'], weight: 5, max: 1, cond: (s) => s.R.dv.aero,
    title: '🔥 Atmosferik frenleme ısınma alarmı',
    text: () => 'Mars\'ın havası beklenenden kalın. Son geçişte paneller çok ısındı.',
    learn: 'Havada sürtünerek yavaşlamak yakıt kazandırır ama risklidir.',
    choices: [
      { label: 'En alçak noktayı yükselt', hint: '+2 ay frenleme ve ~15 m/s yakıt.',
        apply: (s) => { s.arrivalLeft += 2; s.dvLeft -= 15; return 'Daha yumuşak geçişler: frenleme uzun sürdü ama güvenli kaldı.'; } },
      { label: 'Plana devam et', hint: 'Güneş panellerine zarar verme şansı %25.',
        apply: (s) => { if (rand() < 0.25) { s.solarDamage = 0.75; return 'Paneller yandı ve güçlerinin %25\'ini kaybetti.'; } return 'Paneller dayandı. Frenleme zamanında bitti.'; } },
    ],
  },
  {
    id: 'wheel', role: 'SE', phases: [], weight: 0, max: 9, forced: true,
    title: '⚙️ Reaksiyon tekeri arızası',
    text: () => 'Yön veren tekerlerden biri durdu. Araç artık tam dönemiyor.',
    learn: 'Hubble da aynı arızayı yaşadı ve çalışmaya devam etti.',
    choices: [
      { label: 'Yönelimi iticilerle koru', hint: 'Hassasiyet kalır, her ay yakıt gider.', can: (s) => s.R.d.propulsion !== 'none' && s.dvLeft > 10,
        apply: (s) => { s.extraSk += 25; return 'İticiler artık yönelime yardım ediyor. Yakıt daha erken bitecek.'; } },
      { label: 'Kaba yönelimi kabul et', hint: 'Görüntü ve anten zayıflar.',
        apply: (s) => { s.level = Math.min(s.level, 1); return 'Araç kaba yönelimle devam ediyor.'; } },
    ],
  },
  {
    id: 'extended', role: 'MM', phases: [], weight: 0, max: 9, forced: true,
    setup: (s) => ({ cost: Math.round((s.sc.opsPerYear + opt('ground', s.R.d.ground).perYear) * 10) / 10 }),
    title: '🎉 Ana görev tamamlandı!',
    text: (s, c) => `Araç hâlâ sağlam. $${c.cost}M karşılığında görev 12 ay uzatılabilir.`,
    learn: 'Voyager ve Hubble bilimin çoğunu uzatılan sürede üretti.',
    choices: [
      { label: '12 ay uzat', hint: (s, c) => `$${c.cost}M · yedek $${Math.round(s.reserve)}M · yakıt gerekir.`,
        can: (s, c) => (s.reserve >= c.cost || s.R.budget === Infinity) && (s.R.orbit.skDv === 0 || s.dvLeft >= s.R.orbit.skDv * 0.8 || s.R.d.propulsion === 'none'),
        apply: (s, c) => { s.reserve -= c.cost; s.plannedOps += 12; s.extended++; return 'Uzatılmış görev onaylandı! 12 ay daha keşif.'; } },
      { label: 'Görevi bitir', hint: 'Aracı güvenle kapat.', apply: (s) => { endSim(s, 'complete', '🏁 Görev tamamlandı. Araç güvenle hizmet dışı bırakıldı.', 'good'); return 'Ekip görevi yüksek bir notla bitirdi.'; } },
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
    if (sim.spares <= 0 && rand() < 0.3) { endSim(sim, 'failure', '💀 Uçuş bilgisayarı kalıcı olarak arızalandı. Yedek olmadığı için araç kaybedildi.'); return; }
    log(sim, hitComputer(sim, '⚠️ Uçuş bilgisayarı arızası.'), 'warn');
  } else if (k === 'radio') {
    if (sim.spares > 0) { sim.spares--; log(sim, '⚠️ Radyo vericisi arızalandı — yedek radyo devreye girdi.', 'warn'); }
    else { sim.radioHealth *= 0.5; log(sim, '⚠️ Ana radyo yükselteci bozuldu. Veri hızı yarıya indi.', 'bad'); }
  } else if (k === 'wheel') {
    if (sim.spares > 0) { sim.spares--; log(sim, '⚠️ Bir reaksiyon tekeri arızalandı — yedek teker devreye girdi.', 'warn'); }
    else triggerEvent(sim, 'wheel');
  } else {
    if (sim.phase === 'ops') triggerEvent(sim, 'instrument_glitch');
  }
}

/* ------------------------------------------------------------------ */
/* ADIM: simülasyonu bir ay ilerlet                                     */
/* ------------------------------------------------------------------ */
function simStep(sim) {
  if (sim.done || sim.pending) return;
  const R = sim.R, sc = sim.sc, orbit = sim.orbit;

  if (sim.phase === 'launch') {
    const rel = R.L.rel - R.diff.relPenalty;
    sim.launched = true;
    if (rand() > rel) { endSim(sim, 'launch', `💥 Fırlatma başarısız! ${R.L.name} (%${Math.round(rel * 100)} güvenilir) yükseliş sırasında patladı.`); return; }
    log(sim, `🚀 Kalkış! ${R.L.name}, aracı (${Math.round(R.mass.wet)} kg) ${DEST_NAME[orbit.launchClass || sc.launchClass]} ulaştırdı.`, 'good');
    sim.phase = sim.cruiseLeft > 0 ? 'cruise' : 'arrival';
    if (sim.phase === 'cruise') log(sim, `🛰️ Yolculuk başladı: ${sc.bodyTr} hedefine ${sim.cruiseLeft} ay.`);
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
      if (R.dv.insert > 0) log(sim, `🔥 Yörüngeye giriş ateşlemesi: ${Math.round(R.dv.insert)} m/s. ${orbit.flyby ? 'Yakın geçiş rotası ayarlandı.' : orbit.short + ' yörüngesine yakalandı!'}`, 'good');
      else log(sim, `🛰️ ${orbit.short} yörüngesine varıldı.`, 'good');
      if (R.dv.aero) { log(sim, '🌬️ Atmosferik frenleme: yörüngeyi alçaltmak için atmosfere dalınıyor…'); if (rand() < 0.6) triggerEvent(sim, 'aerobrake'); }
    }
    sim.arrivalLeft--;
    if (sim.arrivalLeft <= 0) { sim.phase = 'ops'; log(sim, '🔬 Bilimsel operasyonlar başladı!', 'good'); }
    return;
  }

  /* ---------------- operasyonlar ---------------- */
  sim.opsMonth++;
  const yrs = sim.t / 12;
  const degr = Math.pow(1 - (sc.id === 'europa' ? 0.04 : 0.02), yrs);
  const gen = R.power.rtg ? R.power.rtg * Math.pow(0.984, yrs) : R.power.solarW * (1 - orbit.eclipse) * degr * sim.solarDamage;
  sim.lastPower = gen;
  const onInsts = R.insts.filter((i) => sim.instOn[i.id]);
  const instLoad = sum(onInsts, (i) => i.power);
  if (gen < R.power.busLoad) {
    endSim(sim, 'power', `🧊 Güç arızası: sadece ${Math.round(gen)} W var ama aracın hayatta kalmak için ${Math.round(R.power.busLoad)} W\'a ihtiyacı var. Araç dondu ve sustu.`);
    return;
  }
  const powerF = instLoad > 0 ? clamp((gen - R.power.busLoad - R.power.antAvg) / instLoad, 0, 1) : 1;
  const battF = R.power.batt >= R.power.battNeed ? 1 : 1 - Math.max(orbit.eclipse, R.power.rtg ? 0.3 : 0) * (1 - R.power.batt / R.power.battNeed);
  const pf = powerF * battF;

  // veri
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

  // radyasyon
  sim.dose += R.rad.doseYr * sim.doseMult / 12;
  const tol = R.rad.tol;
  const radRisk = sim.dose > tol ? 0.05 * (sim.dose / tol) : 0;
  const failRate = 0.004 + radRisk;
  if (rand() < failRate) {
    if (radRisk > 0 && rand() < 0.5) log(sim, `☢️ Biriken radyasyon (${Math.round(sim.dose)} krad) elektroniğe zarar veriyor.`, 'bad');
    randomFailure(sim);
    if (sim.done) return;
  }

  // yörünge koruma
  if (R.d.propulsion !== 'none') {
    sim.dvLeft -= (orbit.skDv + sim.extraSk) / 12;
    if (sim.dvLeft <= 0 && sim.decay === null && (orbit.skDv + sim.extraSk) > 0) {
      sim.dvLeft = 0;
      sim.decay = Math.max(1, Math.round(orbit.natLife * 12));
      log(sim, `⛽ Yakıt bitti! Yörünge koruma olmadan yörünge ~${sim.decay} ay içinde çökecek.`, 'bad');
    }
  }
  if (sim.decay !== null) {
    sim.decay--;
    if (sim.decay <= 0) {
      const how = sc.body === 'Earth' ? 'Dünya atmosferine girip yandı' : 'yüzeye çarptı';
      endSim(sim, 'decay', `🔻 Yörünge çöktü ve araç ${how}.`);
      return;
    }
  }

  sim.series.sci.push(currentScience(sim));
  sim.series.reserve.push(sim.reserve);
  sim.series.backlog.push(sim.backlog);

  if (!sim.pending) maybeRandomEvent(sim);

  if (sim.opsMonth >= sim.plannedOps && !sim.done) {
    if (orbit.flyby) { endSim(sim, 'complete', '🏁 Yakın geçiş tamamlandı. Araç derin uzaya doğru yoluna devam ediyor.', 'good'); return; }
    const canOffer = sim.extended < 2 && (sim.R.budget === Infinity || sim.reserve > 0);
    if (canOffer && !sim.pending) triggerEvent(sim, 'extended');
    else if (!sim.pending) endSim(sim, 'complete', '🏁 Görev tamamlandı. Araç güvenle hizmet dışı bırakıldı.', 'good');
  }
}

/* ------------------------------------------------------------------ */
/* PUANLAMA                                                             */
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
  const outcome = launchFail ? 'Fırlatma başarısız'
    : minPrim >= 0.8 ? 'Tam başarı' : minPrim >= 0.6 ? 'Görev başarılı'
      : objs.some((o) => o.score >= 0.3) ? 'Kısmi başarı' : 'Görev başarısız';
  return { objs, science, success, eff, team, bonus, total, ranked, grade, outcome, goals, lostFrac };
}

/* ------------------------------------------------------------------ */
/* DERSLER: görevin NEDEN böyle geçtiğini açıkla                        */
/* ------------------------------------------------------------------ */
function buildLessons(sim, score) {
  const R = sim.R, sc = sim.sc, L = [];
  const add = (type, title, text) => L.push({ type, title, text });
  if (sim.endReason === 'launch') add('bad', 'Roket başarısız oldu', `Bu roketin başarı şansı %${Math.round((R.L.rel - R.diff.relPenalty) * 100)} idi. Bazen olur, tekrar dene.`);
  if (sim.endReason === 'power') add('bad', 'Yetersiz güç', `${sc.bodyTr}'da güneş zayıf. Araç ${Math.round(sim.lastPower)} W üretti, ${Math.round(R.power.busLoad)} W gerekiyordu.`);
  if (sim.endReason === 'decay') add('bad', 'Yörünge çöktü', `${R.d.propulsion === 'none' ? 'Motor olmadığı için yörünge korunamadı.' : 'Yakıt bitti. Daha çok yakıt görevi uzatırdı.'}`);
  if (sim.endReason === 'failure') add('bad', 'Tek arıza noktası', 'Yedeği olmayan bir parça bozuldu. Yedek parça bunu önlerdi.');
  if (sim.endReason === 'collision') add('bad', 'Uzay enkazı', 'Uzay çöpü çarptı. Motor olsaydı kaçabilirdin.');

  if (sim.opsCounted > 0) {
    const pf = sim.pfSum / sim.opsCounted;
    if (pf < 0.95) add('warn', 'Aletler güç sıkıntısı çekti', `Aletler gücün sadece %${Math.round(pf * 100)} kadarını alabildi. Daha büyük panel ya da pil yardımcı olurdu.`);
    if (score.lostFrac > 0.1 || sim.dfSum / sim.opsCounted < 0.9) {
      const sent = sim.dataGen > 0 ? Math.round(100 * sim.dataDown / sim.dataGen) : 0;
      add('warn', 'Veri uzayda takıldı', `Verinin sadece %${sent} kadarı Dünya'ya ulaştı. Daha büyük anten daha çok veri taşırdı.`);
    }
    if (sim.dose > R.rad.tol) add('warn', 'Radyasyon bedelini aldı', `Elektronik fazla radyasyon aldı. Kalkan ve dayanıklı parça gerekirdi.`);
  }
  for (const o of score.objs) {
    if (o.cap < 0.4) add('warn', `"${o.name}" için zayıf aletler`, `Daha uygun aletler: ${Object.keys(o.needs).map((k) => INSTRUMENTS[k].icon + ' ' + INSTRUMENTS[k].name).join(', ')}.`);
    else if (o.score < o.cap * 0.8 && sim.endReason !== 'launch') add('info', `"${o.name}" için yeterli süre yoktu`, `${o.months} ay gözlem gerekiyordu. Görevi uzat.`);
  }
  if (R.level < 2 && R.insts.some((i) => i.I.fine)) add('warn', 'Bulanık yönelim', 'Görüntüler bulanık çıktı; daha iyi yön sistemi gerekirdi.');
  if (R.schedule.delay > 0) add('info', 'Takvim kayması', `Yapım gecikti, ${fmtMoney(R.schedule.delay * R.schedule.marching)} fazla tuttu.`);
  if (sim.extended) add('good', 'Uzatılmış görev', `Araç sağlam kaldı, görev ${sim.extended} yıl uzadı.`);
  if (sim.spares < opt('redundancy', R.d.redundancy).spares) add('good', 'Yedeklilik işe yaradı', 'Yedek parçalar görevi kurtardı.');
  if (R.power.margin >= 0.15 && R.mass.margin >= 0.1 && R.data.ratio >= 1) add('good', 'Dengeli tasarım', 'Güç, ağırlık ve veri dengeliydi.');
  if (!L.length) add('good', 'Sorunsuz uçuş', 'Her şey plana göre gitti. Daha ucuza yapabilir misin?');
  return L;
}
