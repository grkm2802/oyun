'use strict';
/* =========================================================================
   GÖREV MİMARI — oyun verileri.
   Sayılar öğrenme için basitleştirildi ama gerçek oranları korur
   (güneş ışığı ve radyo için ters-kare yasası, roket denklemi vb.).
   Birimler: kütle kg · güç W · maliyet $M (milyon dolar) · veri Mbit/gün · süre ay
   ========================================================================= */

const G0 = 9.80665;

const ROLES = {
  MM: { id: 'MM', name: 'Görev Yöneticisi', icon: '🧭', color: 'var(--role-mm)',
        goal: 'Bütçenin en az %10\'u yedekte kalsın',
        short: 'Bütçe yedeği ≥ %10' },
  SE: { id: 'SE', name: 'Uzay Aracı Mühendisi', icon: '🔧', color: 'var(--role-se)',
        goal: 'Güç payı ≥ %15 ve fırlatma kütle payı ≥ %10',
        short: 'Güç ≥ %15 · Kütle ≥ %10 pay' },
  SL: { id: 'SL', name: 'Bilim Lideri', icon: '🔬', color: 'var(--role-sl)',
        goal: 'Her ana hedefte alet yeterliliği ≥ %70',
        short: 'Ana hedefler ≥ %70 yeterli' },
  CL: { id: 'CL', name: 'Haberleşme Lideri', icon: '📡', color: 'var(--role-cl)',
        goal: 'Üretilen verinin tamamı Dünya\'ya gönderilebilsin',
        short: 'Aktarım ≥ üretilen veri' },
};

/* Takım büyüklüğüne göre rollerin paylaşımı */
const ROLE_SPLIT = {
  1: [['MM', 'SE', 'SL', 'CL']],
  2: [['MM', 'SL'], ['SE', 'CL']],
  3: [['MM'], ['SE'], ['SL', 'CL']],
  4: [['MM'], ['SE'], ['SL'], ['CL']],
};

const DIFFICULTY = {
  easy:    { name: 'Öğrenci',     icon: '🟢', budgetMult: 1.3,  eventRate: 0.07, relPenalty: 0,    scoreMult: 0.8,  hideAdv: true,  hints: true,
             desc: 'Bol bütçe, az sürpriz, ipuçları açık.' },
  normal:  { name: 'Mühendis',    icon: '🟡', budgetMult: 1.0,  eventRate: 0.11, relPenalty: 0,    scoreMult: 1.0,  hideAdv: false, hints: true,
             desc: 'Gerçekçi bütçe ve tüm parça kataloğu.' },
  hard:    { name: 'Uçuş Direktörü', icon: '🟥', budgetMult: 0.85, eventRate: 0.17, relPenalty: 0.02, scoreMult: 1.25, hideAdv: false, hints: false,
             desc: 'Sıkı bütçe, çok arıza, ipucu yok.' },
  sandbox: { name: 'Serbest Mod', icon: '🧪', budgetMult: null, eventRate: 0.0,  relPenalty: 0,    scoreMult: 0,    hideAdv: false, hints: true,
             desc: 'Sınırsız bütçe, sürpriz yok. Sıralamaya girmez.' },
};

/* ------------------------------------------------------------------ */
/* BİLİMSEL ALETLER                                                     */
/* kind: imaging (çözünürlük + güneş ışığı ister) · thermal · radar · insitu */
/* ------------------------------------------------------------------ */
const INSTRUMENTS = {
  camera:       { name: 'Yüksek çözünürlüklü kamera', icon: '📷', kind: 'imaging', mass: 25, power: 30, cost: 22, data: 30000, dev: 4, fine: true,
                  desc: 'Çok net fotoğraflar çeker ama çok veri üretir.' },
  multispec:    { name: 'Çok bantlı görüntüleyici', icon: '🌈', kind: 'imaging', mass: 15, power: 20, cost: 15, data: 12000, dev: 3,
                  desc: 'Birkaç renkte görür: bitki, mineral ve suyu ayırt eder.' },
  thermal:      { name: 'Termal kızılötesi kamera', icon: '🔥', kind: 'thermal', mass: 20, power: 35, cost: 20, data: 6000, dev: 4,
                  desc: 'Isıyı görür: yangınları bulur, gece de çalışır.' },
  sar:          { name: 'Sentetik açıklıklı radar (SAR)', icon: '🛰️', kind: 'radar', mass: 110, power: 450, cost: 60, data: 50000, dev: 8,
                  desc: 'Radar: bulut ve dumanın ardını görür. Ağır ve çok güç ister.' },
  spectrometer: { name: 'Görüntüleyici spektrometre', icon: '🧪', kind: 'imaging', mass: 30, power: 40, cost: 35, data: 18000, dev: 6, fine: true,
                  desc: 'Işığı renklerine ayırır: su, CO₂ ve mineralleri tanır.' },
  altimeter:    { name: 'Lazer altimetre', icon: '📏', kind: 'radar', mass: 15, power: 35, cost: 15, data: 300, dev: 4,
                  desc: 'Lazerle yüzeyin yüksekliğini ölçer, 3B harita çıkarır.' },
  neutron:      { name: 'Nötron spektrometresi', icon: '💧', kind: 'insitu', mass: 8, power: 10, cost: 9, data: 20, dev: 3,
                  desc: 'Yüzeyin altındaki gömülü buzu bulur.' },
  radar_sounder:{ name: 'Buz delen radar sondası', icon: '🧊', kind: 'radar', mass: 35, power: 80, cost: 30, data: 4000, dev: 6,
                  desc: 'Buzun ve toprağın kilometrelerce içini görür.' },
  magnetometer: { name: 'Manyetometre', icon: '🧲', kind: 'insitu', mass: 5, power: 4, cost: 6, data: 10, dev: 2,
                  desc: 'Manyetik alanı ölçer: buz altındaki okyanusu ele verir.' },
  particles:    { name: 'Radyasyon ve parçacık dedektörü', icon: '☢️', kind: 'insitu', mass: 6, power: 8, cost: 7, data: 20, dev: 2,
                  desc: 'Radyasyonu ölçer; astronotlar için önemli.' },
  atmo:         { name: 'Atmosfer sondası', icon: '🌫️', kind: 'thermal', mass: 40, power: 45, cost: 30, data: 2500, dev: 5,
                  desc: 'Havanın sıcaklığını, tozunu ve nemini ölçer.' },
  gravity:      { name: 'Radyo bilim paketi', icon: '🌀', kind: 'insitu', mass: 3, power: 10, cost: 6, data: 5, dev: 2,
                  desc: 'Radyo sinyaliyle kütle çekimini ölçer, iç yapıyı gösterir.' },
};

const TIER = {
  1: { name: 'Temel',    m: 1,   p: 1,   c: 1,   d: 1,   q: 1,    dev: 0 },
  2: { name: 'Gelişmiş', m: 1.6, p: 1.6, c: 1.9, d: 2.5, q: 1.35, dev: 3 },
};

/* ------------------------------------------------------------------ */
/* YÖRÜNGELER                                                           */
/* insertDv: aracın kendisinin sağlaması gereken Δv (m/s)              */
/* skDv: yıllık yörünge koruma Δv · natLife: düşmeden önceki yıl        */
/* res: çözünürlük çarpanı · light: optik görüntü için ışık kalitesi    */
/* contact: yer istasyonu temas saati çarpanı · rad: krad / yıl         */
/* ------------------------------------------------------------------ */
const ORBITS = {
  leo400: { name: 'Alçak Dünya yörüngesi · 400 km', short: 'LEO 400 km', insertDv: 0, skDv: 70, natLife: 1.5, eclipse: 0.38, eclipseH: 0.6,
            res: 1.25, light: 1, contact: 1, rad: 0.3, viz: { a: 1.12, e: 0 },
            desc: 'Yakın, net görüntü. Ama hava sürtünmesi uyduyu düşürür.',
            pros: ['En keskin görüntüler', 'Ulaşması en ucuz'], cons: ['Hava sürtünmesi: yakıt gerekir', 'Kutupları görmez'] },
  sso:    { name: 'Güneş-eşzamanlı yörünge · 600 km', short: 'SSO 600 km', insertDv: 0, skDv: 8, natLife: 15, eclipse: 0.35, eclipseH: 0.6,
            res: 1.0, light: 1.1, contact: 1, rad: 1, rideshare: true, viz: { a: 1.18, e: 0 },
            desc: 'Her yeri hep aynı saatte görür. Klasik gözlem yörüngesi.',
            pros: ['Sabit aydınlatma', 'Küresel kapsama', 'Paylaşımlı fırlatma var'], cons: ['Günlük tutulmalar batarya ister'] },
  ddsso:  { name: 'Şafak–alacakaranlık SSO · 700 km', short: 'Şafak SSO', insertDv: 0, skDv: 5, natLife: 30, eclipse: 0.02, eclipseH: 0.3,
            res: 0.95, light: 0.5, contact: 1, rad: 1.2, viz: { a: 1.22, e: 0 },
            desc: 'Hep güneşte (bol güç), ama altı hep alacakaranlık.',
            pros: ['Neredeyse hiç tutulma yok', 'Küçük batarya yeterli'], cons: ['Alçak güneş → zayıf optik görüntü'] },
  geo:    { name: 'Yerdurağan yörünge · 35.786 km', short: 'GEO', launchClass: 'GEO', insertDv: 1500, skDv: 50, natLife: 99, eclipse: 0.01, eclipseH: 1.2,
            res: 0.15, light: 1, contact: 3, rad: 5, viz: { a: 2.6, e: 0 },
            desc: 'Tek bir yerin üstünde durur, ama çok uzak: görüntü bulanık.',
            pros: ['Kesintisiz izleme, anında uyarı', '24 saat yer teması'], cons: ['Düşük çözünürlük', 'Büyük yörünge yükseltme ateşlemesi'] },

  llo50:  { name: 'Alçak Ay kutup yörüngesi · 50 km', short: 'Alçak Ay 50 km', insertDv: 900, skDv: 160, natLife: 0.4, eclipse: 0.45, eclipseH: 0.8,
            res: 1.4, light: 1, contact: 0.9, rad: 3, viz: { a: 1.08, e: 0 },
            desc: 'Çok alçak, çok net. Ama yörünge çabuk bozulur, çok yakıt ister.',
            pros: ['En iyi çözünürlük', 'En iyi kütle çekim haritası'], cons: ['Kararsız: çok yörünge koruma yakıtı'] },
  lpo100: { name: 'Ay kutup yörüngesi · 100 km', short: 'Ay kutup 100 km', insertDv: 850, skDv: 60, natLife: 1, eclipse: 0.42, eclipseH: 0.8,
            res: 1.0, light: 1, contact: 0.9, rad: 3, viz: { a: 1.15, e: 0 },
            desc: 'Güvenilir seçim. Kutuplar dahil tüm Ay\'ı görür.',
            pros: ['Küresel kapsama', 'Dengeli'], cons: ['Düzenli yörünge koruma gerekir'] },
  nrho:   { name: 'Neredeyse doğrusal hale yörüngesi (NRHO)', short: 'NRHO', insertDv: 450, skDv: 6, natLife: 15, eclipse: 0.03, eclipseH: 1.2,
            res: 0.3, light: 1, contact: 1.6, rad: 3, viz: { a: 2.4, e: 0.75 },
            desc: 'Çok kararlı, hep Dünya\'yı görür ama çoğu zaman uzakta.',
            pros: ['Çok kararlı, korunması ucuz', 'Sürekli Dünya teması'], cons: ['Uzak → az ayrıntı'] },

  mlo:    { name: 'Alçak Mars kutup yörüngesi · 300 km', short: 'Alçak Mars', insertDv: 1450, skDv: 10, natLife: 20, eclipse: 0.4, eclipseH: 0.75,
            res: 1.2, light: 1, contact: 1, rad: 3, aerobrake: true, viz: { a: 1.12, e: 0 },
            desc: 'Alçak ve net, tüm Mars\'ı görür. En çok frenleme yakıtını ister.',
            pros: ['Yüksek çözünürlük', 'Küresel kapsama'], cons: ['Büyük yörüngeye giriş ateşlemesi'] },
  melip:  { name: 'Eliptik Mars yörüngesi', short: 'Eliptik', insertDv: 850, skDv: 5, natLife: 50, eclipse: 0.15, eclipseH: 1.2,
            res: 0.55, light: 1, contact: 1, rad: 3, viz: { a: 2.2, e: 0.65 },
            desc: 'Daha ucuz giriş. Bir yaklaşır bir uzaklaşır.',
            pros: ['Daha ucuz giriş', 'Geniş görüş'], cons: ['Çoğunlukla yüzeyden uzak'] },
  areo:   { name: 'Mars-durağan yörünge · 17.000 km', short: 'Mars-durağan', insertDv: 1300, skDv: 30, natLife: 99, eclipse: 0.01, eclipseH: 1.1,
            res: 0.25, light: 1, contact: 1, rad: 3, viz: { a: 2.6, e: 0 },
            desc: 'Tek bir yerin üstünde durur, havayı sürekli izler.',
            pros: ['Kesintisiz hava izleme'], cons: ['Düşük çözünürlük', 'Tek yarımküre'] },

  jflyby: { name: '~45 Europa yakın geçişli Jüpiter yörüngesi', short: 'Europa geçişleri', insertDv: 900, skDv: 45, natLife: 99, eclipse: 0.02, eclipseH: 3,
            res: 1.0, light: 1, contact: 1, rad: 120, duty: 0.15, viz: { a: 2.4, e: 0.6 },
            desc: 'Jüpiter\'in çevresinde döner, Europa\'nın yanından defalarca geçer.',
            pros: ['Çok daha düşük radyasyon dozu', 'Zamanla iyi kapsama'], cons: ['Uzun görev gerekir', 'Veri sadece geçişlerde'] },
  eorbit: { name: 'Europa yörüngesi · 100 km', short: 'Europa yörüngesi', insertDv: 2300, skDv: 30, natLife: 99, eclipse: 0.45, eclipseH: 1.8,
            res: 1.4, light: 1, contact: 0.9, rad: 900, viz: { a: 1.12, e: 0 },
            desc: 'Sürekli yakın gözlem, ama radyasyon çok güçlü.',
            pros: ['Günde en çok bilim'], cons: ['Aşırı radyasyon', 'Dev frenleme ateşlemesi'] },
  single: { name: 'Tek hızlı yakın geçiş', short: 'Yakın geçiş', insertDv: 40, skDv: 0, natLife: 99, eclipse: 0, eclipseH: 0,
            res: 0.6, light: 1, contact: 1, rad: 30, flyby: true, maxOps: 1, viz: { a: 0, e: 1 },
            desc: 'Hızla yanından geçer. En ucuz, ama sadece birkaç saat gözlem.',
            pros: ['Ucuz ve hafif'], cons: ['Neredeyse hiç gözlem süresi yok'] },
};

/* ------------------------------------------------------------------ */
/* GÖREV SENARYOLARI                                                    */
/* ------------------------------------------------------------------ */
const SCENARIOS = {
  earth: {
    id: 'earth', name: 'Orman Yangını Gözcüsü', body: 'Earth', bodyTr: 'Dünya', icon: '🌍', level: 'Başlangıç', color: '#3b7be0',
    tagline: 'Yer gözlem uydusu',
    brief: 'Orman yangınlarını erken fark eden ve bitkileri izleyen bir uydu tasarla.',
    budget: 550, opsPerYear: 4, sunAU: 1, distAU: 0.00002, launchClass: 'LEO', cruise: 0, cruiseRad: 0,
    deadline: 36, window: 0, defaultMonths: 36,
    orbits: ['leo400', 'sso', 'ddsso', 'geo'],
    objectives: [
      { id: 'fire', name: 'Aktif yangınları tespit et', primary: true, weight: 40, months: 12,
        needs: { thermal: 0.85, multispec: 0.3, sar: 0.25 }, fit: { geo: 1.25, leo400: 0.85, sso: 1, ddsso: 0.9 } },
      { id: 'veg', name: 'Bitki örtüsü ve ürün sağlığını haritala', primary: true, weight: 30, months: 12,
        needs: { multispec: 0.85, spectrometer: 0.5, camera: 0.25 }, fit: { geo: 0.4, leo400: 0.8, sso: 1.1, ddsso: 0.6 } },
      { id: 'burn', name: 'Dumanın altındaki yanık alanları haritala', primary: false, weight: 20, months: 6,
        needs: { sar: 0.85, camera: 0.35, multispec: 0.35, thermal: 0.2 } },
      { id: 'smoke', name: 'Dumanı ve hava kalitesini izle', primary: false, weight: 10, months: 6,
        needs: { atmo: 0.85, spectrometer: 0.5, multispec: 0.3 } },
    ],
    discovery: 'Başka bir kıtada dev bir yangın çıktı! Acil görüntü isteniyor.',
  },
  moon: {
    id: 'moon', name: 'Ay Buzu Avcısı', body: 'Moon', bodyTr: 'Ay', icon: '🌕', level: 'Orta', color: '#b9bcc4',
    tagline: 'Ay yörünge aracı',
    brief: 'Ay\'ın kutup kraterlerindeki buzu bul ve iniş yerlerini haritala.',
    budget: 460, opsPerYear: 8, sunAU: 1, distAU: 0.00257, launchClass: 'MOON', cruise: 1, cruiseRad: 2,
    deadline: 40, window: 0, defaultMonths: 24,
    orbits: ['llo50', 'lpo100', 'nrho'],
    objectives: [
      { id: 'ice', name: 'Kutup kraterlerindeki su buzunu haritala', primary: true, weight: 40, months: 12,
        needs: { neutron: 0.85, spectrometer: 0.4, radar_sounder: 0.4, altimeter: 0.2 } },
      { id: 'topo', name: 'İniş yerleri için araziyi haritala', primary: true, weight: 30, months: 9,
        needs: { altimeter: 0.85, camera: 0.6 } },
      { id: 'rad', name: 'Astronotlar için radyasyonu ölç', primary: false, weight: 15, months: 12,
        needs: { particles: 0.85, magnetometer: 0.3 } },
      { id: 'grav', name: 'Ay\'ın kütle çekim alanını haritala', primary: false, weight: 15, months: 6,
        needs: { gravity: 0.85, altimeter: 0.3 }, fit: { llo50: 1.2, lpo100: 1, nrho: 0.35 } },
    ],
    discovery: 'Güney kutbunun yakınına yeni bir göktaşı çarptı!',
  },
  mars: {
    id: 'mars', name: 'Kızıl Gezegen İklimi', body: 'Mars', bodyTr: 'Mars', icon: '🔴', level: 'İleri', color: '#c1502e',
    tagline: 'Mars iklim yörünge aracı',
    brief: 'Mars\'ın havasını, tozunu ve buzunu incele. Fırlatma fırsatı 26 ayda bir!',
    budget: 780, opsPerYear: 18, sunAU: 1.52, distAU: 1.5, launchClass: 'MARS', cruise: 7, cruiseRad: 2,
    deadline: 40, window: 26, defaultMonths: 36,
    orbits: ['mlo', 'melip', 'areo'],
    objectives: [
      { id: 'weather', name: 'Toz fırtınalarını ve günlük havayı izle', primary: true, weight: 35, months: 12,
        needs: { atmo: 0.85, multispec: 0.35, camera: 0.3, thermal: 0.35 }, fit: { areo: 1.3, mlo: 1, melip: 0.8 } },
      { id: 'water', name: 'Su ve CO₂\'yi tam bir Mars yılı boyunca izle', primary: true, weight: 30, months: 23,
        needs: { spectrometer: 0.85, atmo: 0.5, neutron: 0.25 } },
      { id: 'ice', name: 'Gömülü buzu bul', primary: false, weight: 20, months: 12,
        needs: { radar_sounder: 0.85, neutron: 0.5, thermal: 0.2 }, fit: { areo: 0.3, melip: 0.6 } },
      { id: 'geo', name: 'Yüksek çözünürlüklü jeoloji', primary: false, weight: 15, months: 12,
        needs: { camera: 0.85, spectrometer: 0.35, multispec: 0.3 } },
    ],
    discovery: 'Bir krater duvarında yeni koyu bir iz belirdi: akan su olabilir!',
  },
  europa: {
    id: 'europa', name: 'Okyanus Dünyası Kâşifi', body: 'Europa', bodyTr: 'Europa', icon: '🔵', level: 'Uzman', color: '#d8c8a8',
    tagline: 'Jüpiter / Europa sondası',
    brief: 'Europa\'nın buzunun altında bir okyanus var. Yaşam izi ara. Yol uzun, radyasyon güçlü.',
    budget: 1250, opsPerYear: 40, sunAU: 5.2, distAU: 5.2, launchClass: 'JUPITER', cruise: 66, cruiseRad: 3,
    deadline: 60, window: 13, defaultMonths: 48,
    orbits: ['jflyby', 'eorbit', 'single'],
    objectives: [
      { id: 'shell', name: 'Buz kabuğunun kalınlığını ölç', primary: true, weight: 35, months: 18,
        needs: { radar_sounder: 0.85, altimeter: 0.3, gravity: 0.25 } },
      { id: 'ocean', name: 'Okyanusu ve tuzluluğunu doğrula', primary: true, weight: 30, months: 18,
        needs: { magnetometer: 0.85, gravity: 0.4, particles: 0.2 } },
      { id: 'comp', name: 'Yüzey kimyası ve yaşanabilirlik', primary: false, weight: 20, months: 12,
        needs: { spectrometer: 0.85, thermal: 0.3, camera: 0.25 } },
      { id: 'map', name: 'Gelecekteki iniş yerlerini haritala', primary: false, weight: 15, months: 12,
        needs: { camera: 0.85, altimeter: 0.35 } },
    ],
    discovery: 'Europa\'nın güney kutbundan su fışkırıyor olabilir!',
  },
};

/* ------------------------------------------------------------------ */
/* UZAY ARACI PARÇALARI                                                 */
/* ------------------------------------------------------------------ */
const PARTS = {
  structure: { label: 'Gövde yapısı', owner: 'SE', options: {
    small:     { name: 'Küçük uydu gövdesi', frac: 0.12, cost: 3, dev: 0, maxDry: 250, desc: 'Hafif çerçeve. Sadece 250 kg altı araçlar için.' },
    aluminum:  { name: 'Alüminyum bal peteği', frac: 0.2, cost: 10, dev: 0, desc: 'Sağlam ve uygun fiyatlı, ama biraz ağır.' },
    composite: { name: 'Karbon kompozit', frac: 0.12, cost: 30, dev: 4, adv: true, desc: 'Çok hafif, ama pahalı.' },
  }},
  computer: { label: 'Uçuş bilgisayarı ve depolama', owner: 'SE', options: {
    cots:    { name: 'Ticari bilgisayar', mass: 1, power: 8, cost: 1, dev: 0, storage: 64, radTol: 5, desc: 'Ucuz ve hızlı, ama radyasyona dayanıksız.' },
    radtol:  { name: 'Radyasyona dayanıklı', mass: 4, power: 15, cost: 6, dev: 1, storage: 512, radTol: 50, desc: 'Orta düzey radyasyona dayanır.' },
    radhard: { name: 'Radyasyona sertleştirilmiş', mass: 8, power: 25, cost: 18, dev: 2, storage: 2048, radTol: 300, desc: 'Yavaş ama radyasyona çok dayanıklı.' },
  }},
  adcs: { label: 'Yönelim kontrolü (hedefleme)', owner: 'SE', options: {
    mtq:     { name: 'Sadece manyetik tork çubukları', mass: 2, power: 5, cost: 1, dev: 0, level: 1, nearEarth: true, desc: 'Ucuz ama kaba. Dünya\'dan uzakta çalışmaz.' },
    rw:      { name: 'Reaksiyon tekerleri + yıldız izleyici', mass: 18, power: 40, cost: 9, dev: 1, level: 2, desc: 'Dönen tekerlerle aracı hassasça çevirir.' },
    precise: { name: 'Hassas yönelim sistemi', mass: 35, power: 65, cost: 24, dev: 3, level: 3, adv: true, desc: 'En net görüntüler için çok kararlı.' },
  }},
  propulsion: { label: 'İtki sistemi', owner: 'SE', options: {
    none:   { name: 'İtki yok', mass: 0, power: 0, cost: 0, isp: 0, dev: 0, desc: 'En hafif, ama hiç manevra yapamaz.' },
    cold:   { name: 'Soğuk gaz iticileri', mass: 5, power: 5, cost: 2, isp: 65, dev: 0, desc: 'Basit ve güvenli, ama çok zayıf.' },
    mono:   { name: 'Tek yakıtlı (monopropellant)', mass: 20, power: 15, cost: 6, isp: 225, dev: 1, desc: 'Küçük ayarlar için standart motor.' },
    biprop: { name: 'Çift yakıtlı motor', mass: 45, power: 20, cost: 14, isp: 320, dev: 2, desc: 'Güçlü motor: büyük frenlemeler için.' },
    ion:    { name: 'Elektrikli iyon motoru', mass: 60, power: 0, cost: 35, isp: 3000, dev: 6, adv: true, needsW: 1000, desc: 'Çok verimli ama çok yavaş; bol güç ister.' },
  }},
  propMargin: { label: 'Yakıt yedeği', owner: 'SE', options: {
    10: { name: '+%10', margin: 0.10, desc: 'Ancak yetecek kadar. Sürprizlere az yer.' },
    25: { name: '+%25', margin: 0.25, desc: 'Kaçınma manevraları için biraz fazla yakıt.' },
    50: { name: '+%50', margin: 0.50, desc: 'Sürprizler için bol yakıt, ama daha ağır.' },
  }},
  shielding: { label: 'Radyasyon kalkanı', owner: 'SE', options: {
    none:  { name: 'Minimum', mass: 0, cost: 0, factor: 1, dev: 0, desc: 'Elektroniği sadece aracın duvarları korur.' },
    std:   { name: 'Bölgesel kalkan', mass: 15, cost: 3, factor: 0.35, dev: 0, desc: 'Radyasyonu yaklaşık üçte bire indirir.' },
    vault: { name: 'Radyasyon kasası', mass: 150, cost: 25, factor: 0.06, dev: 3, desc: 'Kalın kasa: radyasyonu neredeyse tamamen keser.' },
  }},
  redundancy: { label: 'Yedeklilik', owner: 'SE', options: {
    single: { name: 'Tekli sistem', mult: 1, fail: 1, spares: 0, dev: 0, desc: 'Her şeyden bir tane. Ucuz, ama tek arıza her şeyi bitirebilir.' },
    dual:   { name: 'Tam yedekli', mult: 1.35, fail: 1, spares: 2, dev: 4, desc: 'Yedek parçalı. Daha pahalı, ama çok daha dayanıklı.' },
  }},
  power: { label: 'Güç kaynağı', owner: 'SE', options: {
    body:    { name: 'Gövdeye yapışık güneş hücreleri', w1: 80, mass: 4, cost: 2, dev: 0, desc: 'Gövdeye yapışık paneller. Basit, az güç.' },
    deploy3: { name: 'Güneş paneli · 3 m²', w1: 900, mass: 18, cost: 9, dev: 0, desc: 'Açılır paneller: Dünya\'da yaklaşık 900 W.' },
    deploy10:{ name: 'Güneş kanatları · 10 m²', w1: 3000, mass: 55, cost: 25, dev: 1, desc: 'İki büyük kanat: Dünya\'da ~3 kW.' },
    huge:    { name: 'Dev güneş kanatları · 60 m²', w1: 16000, mass: 300, cost: 80, dev: 3, adv: true, desc: 'Dev paneller: Jüpiter\'de güneşle çalışmanın tek yolu.' },
    rtg:     { name: 'Radyoizotop jeneratörü (RTG)', rtg: 115, mass: 45, cost: 95, dev: 12, desc: 'Nükleer pil: her yerde, gece gündüz güç. Çok pahalı.' },
    rtg2:    { name: 'İki RTG', rtg: 230, mass: 90, cost: 180, dev: 12, adv: true, desc: 'İki kat nükleer güç, iki kat fiyat.' },
  }},
  battery: { label: 'Batarya', owner: 'SE', options: {
    s:  { name: '150 Wh', wh: 150, mass: 1.5, cost: 0.5, desc: 'Küçük pil, küçük yükler için.' },
    m:  { name: '600 Wh', wh: 600, mass: 5, cost: 2, desc: 'Orta paket.' },
    l:  { name: '2.000 Wh', wh: 2000, mass: 16, cost: 5, desc: 'Büyük pil, uzun gölge süreleri için.' },
    xl: { name: '6.000 Wh', wh: 6000, mass: 50, cost: 12, desc: 'Çok uzun tutulmalar için dev paket.' },
  }},
  antenna: { label: 'Anten ve radyo', owner: 'CL', options: {
    lga:   { name: 'S-bant çok yönlü anten', mass: 2, power: 15, cost: 2, r1: 0.3, max: 2000, level: 0, dev: 0, desc: 'Her yöne yayın yapar, ama uzakta çok zayıf.' },
    mga:   { name: 'S-bant orta kazançlı', mass: 6, power: 30, cost: 5, r1: 8, max: 8000, level: 1, dev: 0, desc: 'Küçük yönlü anten. Orta hız.' },
    xhga:  { name: 'X-bant çanak · 1,5 m', mass: 25, power: 70, cost: 18, r1: 250, max: 150000, level: 2, dev: 1, desc: 'Çanak anten: hızlı, Dünya\'ya tam dönmeli.' },
    kahga: { name: 'Ka-bant çanak · 3 m', mass: 55, power: 110, cost: 40, r1: 2500, max: 600000, level: 2, dev: 3, adv: true, desc: 'Büyük çanak: en hızlı, çok güç ister.' },
  }},
  ground: { label: 'Yer istasyonları', owner: 'CL', options: {
    uni:        { name: 'Üniversite istasyonu', hours: 1.5, gain: 0.002, perYear: 0.3, desc: 'Küçük okul anteni. Derin uzaya yetmez.' },
    commercial: { name: 'Ticari yer ağı', hours: 5, gain: 0.02, perYear: 2.5, desc: 'Dünyanın her yerinde kiralık antenler.' },
    dsn:        { name: 'Derin Uzay Ağı (DSN)', hours: 8, gain: 1, perYear: 9, desc: 'NASA\'nın dev antenleri. Ay\'ın ötesi için şart, pahalı.' },
  }},
};

/* ------------------------------------------------------------------ */
/* FIRLATMA ARAÇLARI · cap = her hedefe taşınabilen kg                  */
/* ------------------------------------------------------------------ */
const LAUNCHERS = {
  rideshare:  { name: 'Paylaşımlı fırlatma', cost: 4, rel: 0.97, cap: { LEO: 200 }, onlyOrbit: ['sso'],
                desc: 'Roketi başka uydularla paylaş. Çok ucuz, ama yörünge sabit.' },
  small:      { name: 'Küçük roket', cost: 9, rel: 0.93, cap: { LEO: 350, MOON: 40 },
                desc: 'Sana özel küçük roket. Sadece hafif araçlar.' },
  medium:     { name: 'Orta roket', cost: 70, rel: 0.98, cap: { LEO: 15000, GEO: 5500, MOON: 3000, MARS: 2400 },
                desc: 'Güvenilir orta roket. Dünya ve Ay için yeter.' },
  heavy:      { name: 'Ağır roket', cost: 150, rel: 0.96, cap: { LEO: 50000, GEO: 18000, MOON: 12000, MARS: 9000, JUPITER: 3800 },
                desc: 'Çok güçlü. Jüpiter\'e ~5,5 yılda ulaşır.' },
  superheavy: { name: 'Süper ağır roket', cost: 600, rel: 0.93, cap: { LEO: 95000, GEO: 35000, MOON: 27000, MARS: 20000, JUPITER: 7500 },
                cruiseMult: { JUPITER: 0.45, MARS: 0.85 },
                desc: 'Devasa ve yeni. Jüpiter\'e ~2,5 yılda, ama çok pahalı.' },
};

const DEST_NAME = { LEO: 'alçak Dünya yörüngesine', GEO: 'yerdurağan transfer yörüngesine', MOON: 'Ay\'a', MARS: 'Mars\'a', JUPITER: 'Jüpiter\'e' };

/* ------------------------------------------------------------------ */
/* TASARIM ADIMLARI                                                     */
/* ------------------------------------------------------------------ */
const STEPS = [
  { id: 'mission', name: 'Görev',          icon: '🎯', owner: 'MM' },
  { id: 'orbit',   name: 'Yörünge',        icon: '🪐', owner: 'MM' },
  { id: 'payload', name: 'Aletler',        icon: '🔬', owner: 'SL' },
  { id: 'bus',     name: 'Uzay aracı',     icon: '🛠️', owner: 'SE' },
  { id: 'power',   name: 'Güç',            icon: '⚡', owner: 'SE' },
  { id: 'comms',   name: 'Haberleşme',     icon: '📡', owner: 'CL' },
  { id: 'launch',  name: 'Fırlatma',       icon: '🚀', owner: 'MM' },
  { id: 'review',  name: 'Tasarım incelemesi', icon: '✅', owner: 'ALL' },
];

const LEARN = {
  mission: 'Her gerçek görev <b>hedeflerle</b> başlar: hangi bilimsel sorular cevaplanmalı? <b>Ana</b> hedefler başarıyı belirler; ikincil hedefler değer katar. Görev <b>süresi</b> de önemlidir: bazı olaylar (mevsimler gibi) uzun gözlem ister, ama her ek ay operasyon parası demektir.',
  orbit: 'Yörünge şunları belirler: <b>neyi görebileceğin</b> (çözünürlük, kapsama), <b>ne kadar güneş</b> alacağın (tutulmalar bataryayı tüketir), <b>ne kadar yakıt</b> gerektiği (Δv, "delta-v" = hız değişimi) ve <b>radyasyonun</b> ne kadar sert olduğu. Mükemmel yörünge yoktur — sadece ödünleşimler vardır.',
  payload: 'Aletler uçmanın sebebidir. Her biri <b>bilimsel değer</b> katar, ama aynı zamanda <b>kütle, güç, maliyet ve veri</b> de ekler. Gelişmiş sürümler daha çok görür ama çok daha pahalıdır. Hedeflerine uyan aletleri seç: bir kamera gömülü buzu göremez!',
  bus: '<b>Gövde (bus)</b> uzay aracının kendisidir: yapı, bilgisayar, yönelim, itki ve koruma. <b>Roket denklemi</b> yüzünden gereken yakıt Δv ile üstel olarak artar — verimli motorlar (yüksek Isp) çok daha az yakıt ister. Radyasyon elektroniği yavaşça öldürür; kalkan ve sertleştirilmiş parçalar ömür kazandırır.',
  power: 'Güneş ışığı Güneş\'ten uzaklığın <b>karesiyle</b> zayıflar: Mars\'ta Dünya\'daki ışığın %43\'ünü, Jüpiter\'de sadece %3,7\'sini alırsın. <b>Tutulmada</b> (gezegenin gölgesinde) her şey bataryayla çalışır. Güneş\'ten çok uzakta tek seçenek radyoizotop jeneratörleri (RTG) olabilir.',
  comms: 'Eve gönderemediğin veri değersizdir. Radyo sinyalleri uzaklığın <b>karesiyle</b> zayıflar: Mars, bir LEO uydusunun yer istasyonu geçişinden ~60.000 kat uzaktadır, bu yüzden sinyaller milyarlarca kat zayıftır. Daha büyük çanaklar, daha yüksek frekanslar (X→Ka bandı) ve daha büyük yer antenleri buna karşı savaşır.',
  launch: 'Roket, aracını yakıt dolu (<b>ıslak</b>) kütlesiyle hedefe taşımalıdır. Mühendisler bir <b>kütle payı</b> bırakır, çünkü uzay araçları geliştirme sırasında hep ağırlaşır. Gezegen görevlerinin ayrıca <b>fırlatma pencereleri</b> vardır — birini kaçırırsan gezegenlerin yeniden hizalanmasını beklersin.',
  review: 'Fırlatmadan önce her alt sistem lideri bir <b>tasarım incelemesinde</b> onay verir. Her kaynağın payı olduğunu ve ekibin ödünleşimlerde anlaştığını kontrol et. Takım modunda her oyuncu onaylamalı — hedefleriniz çatışıyorsa pazarlık edin!',
};

const GLOSSARY = [
  ['Δv (delta-v)', 'Aracın yakıtıyla yapabileceği hız değişimi.'],
  ['Isp (özgül itki)', 'Motor verimi. Yüksekse aynı yakıtla daha çok yol.'],
  ['Roket denklemi', 'Daha çok hız değişimi, çok daha fazla yakıt demek.'],
  ['Islak / kuru kütle', 'Kuru: yakıtsız ağırlık. Islak: yakıt dahil.'],
  ['Kütle payı', 'Roketin taşıyabileceğinden boş kalan pay.'],
  ['Ters-kare yasası', 'İki kat uzak, dörtte bir güç.'],
  ['Tutulma', 'Gezegenin gölgesi: paneller çalışmaz, pil devreye girer.'],
  ['Veri indirme (downlink)', 'Aracın Dünya\'ya veri göndermesi.'],
  ['Yörünge koruma', 'Aracı yörüngede tutan küçük ateşlemeler.'],
  ['Radyasyon dozu (krad)', 'Elektroniğin aldığı toplam radyasyon.'],
  ['Yedeklilik', 'Arızaya karşı yedek parça taşımak.'],
  ['Fırlatma penceresi', 'Gezegenlerin yolculuk için doğru dizildiği zaman.'],
  ['Atmosferik frenleme', 'Yakıt yerine havada sürtünerek yavaşlamak.'],
  ['Görev döngüsü (duty cycle)', 'Aletin açık çalıştığı zamanın oranı.'],
  ['RTG', 'Nükleer pil: plütonyumun ısısından elektrik üretir.'],
];
