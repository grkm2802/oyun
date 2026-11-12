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
        goal: 'Bütçenin en az %10\'unu harcanmamış yedek olarak tut',
        short: 'Bütçe yedeği ≥ %10' },
  SE: { id: 'SE', name: 'Uzay Aracı Mühendisi', icon: '🔧', color: 'var(--role-se)',
        goal: 'Güç payı ≥ %15 ve fırlatma kütle payı ≥ %10',
        short: 'Güç ≥ %15 · Kütle ≥ %10 pay' },
  SL: { id: 'SL', name: 'Bilim Lideri', icon: '🔬', color: 'var(--role-sl)',
        goal: 'Her ana hedefte alet yeterliliği ≥ %70',
        short: 'Ana hedefler ≥ %70 yeterli' },
  CL: { id: 'CL', name: 'Haberleşme Lideri', icon: '📡', color: 'var(--role-cl)',
        goal: 'Dünya\'ya veri aktarım kapasitesi, üretilen bilimsel verinin ≥ %100\'ü',
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
             desc: 'Daha büyük bütçe, daha az sürpriz, daha basit parçalar ve yardımcı ipuçları.' },
  normal:  { name: 'Mühendis',    icon: '🟡', budgetMult: 1.0,  eventRate: 0.11, relPenalty: 0,    scoreMult: 1.0,  hideAdv: false, hints: true,
             desc: 'Gerçekçi bütçe ve tüm parça kataloğu.' },
  hard:    { name: 'Uçuş Direktörü', icon: '🟥', budgetMult: 0.85, eventRate: 0.17, relPenalty: 0.02, scoreMult: 1.25, hideAdv: false, hints: false,
             desc: 'Sıkı bütçe, daha çok arıza, daha az güvenilir roketler, ipucu yok.' },
  sandbox: { name: 'Serbest Mod', icon: '🧪', budgetMult: null, eventRate: 0.0,  relPenalty: 0,    scoreMult: 0,    hideAdv: false, hints: true,
             desc: 'Sınırsız bütçe, rastgele olay yok. Özgürce dene (sıralamaya girmez).' },
};

/* ------------------------------------------------------------------ */
/* BİLİMSEL ALETLER                                                     */
/* kind: imaging (çözünürlük + güneş ışığı ister) · thermal · radar · insitu */
/* ------------------------------------------------------------------ */
const INSTRUMENTS = {
  camera:       { name: 'Yüksek çözünürlüklü kamera', icon: '📷', kind: 'imaging', mass: 25, power: 30, cost: 22, data: 30000, dev: 4, fine: true,
                  desc: 'Keskin görünür ışık fotoğrafları. Çok ayrıntılı, ama çok fazla veri üretir ve çok sabit yönelim ister.' },
  multispec:    { name: 'Çok bantlı görüntüleyici', icon: '🌈', kind: 'imaging', mass: 15, power: 20, cost: 15, data: 12000, dev: 3,
                  desc: 'Yakın kızılötesi dahil birkaç renk bandında görüntüler — bitki sağlığını, mineralleri ve suyu ortaya çıkarır.' },
  thermal:      { name: 'Termal kızılötesi kamera', icon: '🔥', kind: 'thermal', mass: 20, power: 35, cost: 20, data: 6000, dev: 4,
                  desc: 'Isıyı görür. Yangınları ve sıcak noktaları algılar, gece de çalışır.' },
  sar:          { name: 'Sentetik açıklıklı radar (SAR)', icon: '🛰️', kind: 'radar', mass: 110, power: 450, cost: 60, data: 50000, dev: 8,
                  desc: 'Radyo dalgalarını yüzeyden yansıtır. Bulutların, dumanın ve karanlığın ardını görür — ama ağır ve çok güç tüketir.' },
  spectrometer: { name: 'Görüntüleyici spektrometre', icon: '🧪', kind: 'imaging', mass: 30, power: 40, cost: 35, data: 18000, dev: 6, fine: true,
                  desc: 'Işığı yüzlerce renge ayırarak kimyasalları tanır: su, CO₂, mineraller, organik maddeler.' },
  altimeter:    { name: 'Lazer altimetre', icon: '📏', kind: 'radar', mass: 15, power: 35, cost: 15, data: 300, dev: 4,
                  desc: 'Lazer atımları gönderip yankıyı ölçerek yüzey yüksekliğini bulur — 3B haritalar çıkarır.' },
  neutron:      { name: 'Nötron spektrometresi', icon: '💧', kind: 'insitu', mass: 8, power: 10, cost: 9, data: 20, dev: 3,
                  desc: 'Yüzeyden kaçan nötronları sayar. Hidrojen (su buzu) onları emer; böylece gömülü buzun "kokusunu alır".' },
  radar_sounder:{ name: 'Buz delen radar sondası', icon: '🧊', kind: 'radar', mass: 35, power: 80, cost: 30, data: 4000, dev: 6,
                  desc: 'Buzun ve kuru toprağın kilometrelerce içini gören düşük frekanslı radar; katmanları ve gömülü suyu bulur.' },
  magnetometer: { name: 'Manyetometre', icon: '🧲', kind: 'insitu', mass: 5, power: 4, cost: 6, data: 10, dev: 2,
                  desc: 'Manyetik alanları ölçer. Buzun altındaki tuzlu bir okyanus belirgin bir manyetik iz bırakır.' },
  particles:    { name: 'Radyasyon ve parçacık dedektörü', icon: '☢️', kind: 'insitu', mass: 6, power: 8, cost: 7, data: 20, dev: 2,
                  desc: 'Yüklü parçacıkları ve radyasyon dozunu ölçer — astronotlar için hayati bilgi.' },
  atmo:         { name: 'Atmosfer sondası', icon: '🌫️', kind: 'thermal', mass: 40, power: 45, cost: 30, data: 2500, dev: 5,
                  desc: 'Atmosferin birçok yüksekliğinde sıcaklığı, tozu ve su buharını ölçer.' },
  gravity:      { name: 'Radyo bilim paketi', icon: '🌀', kind: 'insitu', mass: 3, power: 10, cost: 6, data: 5, dev: 2,
                  desc: 'Radyo sinyalindeki küçük Doppler kaymalarıyla kütle çekimini haritalar — gizli kütleleri ve iç yapıyı ortaya çıkarır.' },
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
            desc: 'Dünya\'ya yakın → keskin görüntüler. Ama ince atmosfer sürtünmesi, iticilerle yükseltilmezse uyduyu 1–2 yılda düşürür. Kutupların üzerinden geçmez.',
            pros: ['En keskin görüntüler', 'Ulaşması en ucuz'], cons: ['Hava sürtünmesi: yakıt gerekir', 'Kutupları görmez'] },
  sso:    { name: 'Güneş-eşzamanlı yörünge · 600 km', short: 'SSO 600 km', insertDv: 0, skDv: 8, natLife: 15, eclipse: 0.35, eclipseH: 0.6,
            res: 1.0, light: 1.1, contact: 1, rad: 1, rideshare: true, viz: { a: 1.18, e: 0 },
            desc: 'Her yerin üzerinden hep aynı yerel saatte (~10:30) geçer, bu yüzden aydınlatma hep aynıdır. Tüm dünyayı kapsar. Klasik yer gözlem yörüngesi.',
            pros: ['Sabit aydınlatma', 'Küresel kapsama', 'Paylaşımlı fırlatma var'], cons: ['Günlük tutulmalar batarya ister'] },
  ddsso:  { name: 'Şafak–alacakaranlık SSO · 700 km', short: 'Şafak SSO', insertDv: 0, skDv: 5, natLife: 30, eclipse: 0.02, eclipseH: 0.3,
            res: 0.95, light: 0.5, contact: 1, rad: 1.2, viz: { a: 1.22, e: 0 },
            desc: 'Gece ile gündüzün sınırında uçar: neredeyse hep güneşte (güç için harika) — ama altındaki yer gün doğumu/batımındadır, gölgeler uzundur. Optik görüntü için zayıf.',
            pros: ['Neredeyse hiç tutulma yok', 'Küçük batarya yeterli'], cons: ['Alçak güneş → zayıf optik görüntü'] },
  geo:    { name: 'Yerdurağan yörünge · 35.786 km', short: 'GEO', launchClass: 'GEO', insertDv: 1500, skDv: 50, natLife: 99, eclipse: 0.01, eclipseH: 1.2,
            res: 0.15, light: 1, contact: 3, rad: 5, viz: { a: 2.6, e: 0 },
            desc: 'Günde bir tur atar, yani tek bir noktanın üzerinde asılı kalır ve bir yarımküreyi kesintisiz izler — ama LEO\'dan ~90 kat uzaktan, bu yüzden görüntüler bulanıktır.',
            pros: ['Kesintisiz izleme, anında uyarı', '24 saat yer teması'], cons: ['Düşük çözünürlük', 'Büyük yörünge yükseltme ateşlemesi'] },

  llo50:  { name: 'Alçak Ay kutup yörüngesi · 50 km', short: 'Alçak Ay 50 km', insertDv: 900, skDv: 160, natLife: 0.4, eclipse: 0.45, eclipseH: 0.8,
            res: 1.4, light: 1, contact: 0.9, rad: 3, viz: { a: 1.08, e: 0 },
            desc: 'Yüzeyin sadece 50 km üzerinden geçer. En iyi ayrıntı, ama Ay\'ın düzensiz kütle çekimi ("maskonlar") yörüngeyi hızla düşürür — ya çok yakıt ya da aylar içinde çarpma.',
            pros: ['En iyi çözünürlük', 'En iyi kütle çekim haritası'], cons: ['Kararsız: çok yörünge koruma yakıtı'] },
  lpo100: { name: 'Ay kutup yörüngesi · 100 km', short: 'Ay kutup 100 km', insertDv: 850, skDv: 60, natLife: 1, eclipse: 0.42, eclipseH: 0.8,
            res: 1.0, light: 1, contact: 0.9, rad: 3, viz: { a: 1.15, e: 0 },
            desc: 'Kendini kanıtlamış iş atı yörüngesi. Kutup kraterleri dahil tüm Ay\'ı görür.',
            pros: ['Küresel kapsama', 'Dengeli'], cons: ['Düzenli yörünge koruma gerekir'] },
  nrho:   { name: 'Neredeyse doğrusal hale yörüngesi (NRHO)', short: 'NRHO', insertDv: 450, skDv: 6, natLife: 15, eclipse: 0.03, eclipseH: 1.2,
            res: 0.3, light: 1, contact: 1.6, rad: 3, viz: { a: 2.4, e: 0.75 },
            desc: 'Gateway istasyonu için planlanana benzer uzun, gerilmiş bir yörünge. Çok kararlı ve hep Dünya\'yı görür, ama zamanının çoğunu yüzeyden uzakta geçirir.',
            pros: ['Çok kararlı, korunması ucuz', 'Sürekli Dünya teması'], cons: ['Uzak → az ayrıntı'] },

  mlo:    { name: 'Alçak Mars kutup yörüngesi · 300 km', short: 'Alçak Mars', insertDv: 1450, skDv: 10, natLife: 20, eclipse: 0.4, eclipseH: 0.75,
            res: 1.2, light: 1, contact: 1, rad: 3, aerobrake: true, viz: { a: 1.12, e: 0 },
            desc: 'Kutupların üzerinden geçen alçak, dairesel yörünge — birkaç günde tüm Mars\'ı yüksek çözünürlükte görür. Atmosferik frenleme yapmazsan en büyük frenleme ateşlemesini ister.',
            pros: ['Yüksek çözünürlük', 'Küresel kapsama'], cons: ['Büyük yörüngeye giriş ateşlemesi'] },
  melip:  { name: 'Eliptik Mars yörüngesi', short: 'Eliptik', insertDv: 850, skDv: 5, natLife: 50, eclipse: 0.15, eclipseH: 1.2,
            res: 0.55, light: 1, contact: 1, rad: 3, viz: { a: 2.2, e: 0.65 },
            desc: 'Daha ucuz bir yakalanma yörüngesi: her turda bir kez yaklaşır, sonra uzağa savrulur. Yakın ve uzak karışık görüntüler.',
            pros: ['Daha ucuz giriş', 'Geniş görüş'], cons: ['Çoğunlukla yüzeyden uzak'] },
  areo:   { name: 'Mars-durağan yörünge · 17.000 km', short: 'Mars-durağan', insertDv: 1300, skDv: 30, natLife: 99, eclipse: 0.01, eclipseH: 1.1,
            res: 0.25, light: 1, contact: 1, rad: 3, viz: { a: 2.6, e: 0 },
            desc: 'Mars\'ın yerdurağan yörüngesi: tek bir boylamın üzerinde asılı kalır ve hava durumunu kesintisiz izler.',
            pros: ['Kesintisiz hava izleme'], cons: ['Düşük çözünürlük', 'Tek yarımküre'] },

  jflyby: { name: '~45 Europa yakın geçişli Jüpiter yörüngesi', short: 'Europa geçişleri', insertDv: 900, skDv: 45, natLife: 99, eclipse: 0.02, eclipseH: 3,
            res: 1.0, light: 1, contact: 1, rad: 120, duty: 0.15, viz: { a: 2.4, e: 0.6 },
            desc: 'Jüpiter\'in etrafında dön ve Europa\'nın yanından tekrar tekrar geç; geçişler arasında en kötü radyasyondan kaç. Bilim çoğunlukla her geçiş sırasında yapılır.',
            pros: ['Çok daha düşük radyasyon dozu', 'Zamanla iyi kapsama'], cons: ['Uzun görev gerekir', 'Veri sadece geçişlerde'] },
  eorbit: { name: 'Europa yörüngesi · 100 km', short: 'Europa yörüngesi', insertDv: 2300, skDv: 30, natLife: 99, eclipse: 0.45, eclipseH: 1.8,
            res: 1.4, light: 1, contact: 0.9, rad: 900, viz: { a: 1.12, e: 0 },
            desc: 'Sürekli yakından bilim, ama Jüpiter\'in radyasyon kuşaklarının içinde yaşarsın. Ağır kalkan olmadan elektronik hızla ölür.',
            pros: ['Günde en çok bilim'], cons: ['Aşırı radyasyon', 'Dev frenleme ateşlemesi'] },
  single: { name: 'Tek hızlı yakın geçiş', short: 'Yakın geçiş', insertDv: 40, skDv: 0, natLife: 99, eclipse: 0, eclipseH: 0,
            res: 0.6, light: 1, contact: 1, rad: 30, flyby: true, maxOps: 1, viz: { a: 0, e: 1 },
            desc: 'Durmadan hızla yanından geç. En ucuz ve en hafif — ama sadece birkaç saatlik yakın gözlem.',
            pros: ['Ucuz ve hafif'], cons: ['Neredeyse hiç gözlem süresi yok'] },
};

/* ------------------------------------------------------------------ */
/* GÖREV SENARYOLARI                                                    */
/* ------------------------------------------------------------------ */
const SCENARIOS = {
  earth: {
    id: 'earth', name: 'Orman Yangını Gözcüsü', body: 'Earth', bodyTr: 'Dünya', icon: '🌍', level: 'Başlangıç', color: '#3b7be0',
    tagline: 'Yer gözlem uydusu',
    brief: 'Orman yangınları giderek sıklaşıyor. Yangınları erkenden fark eden ve ormanlarla tarım arazilerinin sağlığını izleyen bir uydu tasarla.',
    budget: 200, opsPerYear: 4, sunAU: 1, distAU: 0.00002, launchClass: 'LEO', cruise: 0, cruiseRad: 0,
    deadline: 36, window: 0, defaultMonths: 36,
    orbits: ['leo400', 'sso', 'ddsso', 'geo'],
    objectives: [
      { id: 'fire', name: 'Aktif yangınları tespit et', primary: true, weight: 40, months: 12,
        needs: { thermal: 0.8, multispec: 0.3, sar: 0.2 }, fit: { geo: 1.25, leo400: 0.85, sso: 1, ddsso: 0.9 } },
      { id: 'veg', name: 'Bitki örtüsü ve ürün sağlığını haritala', primary: true, weight: 30, months: 12,
        needs: { multispec: 0.8, spectrometer: 0.5, camera: 0.2 }, fit: { geo: 0.4, leo400: 0.8, sso: 1.1, ddsso: 0.6 } },
      { id: 'burn', name: 'Duman ve bulut ardındaki yanık alanları haritala', primary: false, weight: 20, months: 6,
        needs: { sar: 0.9, camera: 0.3, multispec: 0.3 } },
      { id: 'smoke', name: 'Dumanı ve hava kalitesini izle', primary: false, weight: 10, months: 6,
        needs: { atmo: 0.7, spectrometer: 0.4, multispec: 0.2 } },
    ],
    discovery: 'Başka bir kıtada dev bir yangın salgını başladı. Acil durum ekipleri acil görüntü istiyor.',
  },
  moon: {
    id: 'moon', name: 'Ay Buzu Avcısı', body: 'Moon', bodyTr: 'Ay', icon: '🌕', level: 'Orta', color: '#b9bcc4',
    tagline: 'Ay yörünge aracı',
    brief: 'Ay\'a dönecek astronotların suya ihtiyacı olacak. Kutuplardaki hiç güneş görmeyen kraterlerde saklanan buzu bul ve güvenli iniş yerleri için araziyi haritala.',
    budget: 290, opsPerYear: 8, sunAU: 1, distAU: 0.00257, launchClass: 'MOON', cruise: 1, cruiseRad: 2,
    deadline: 36, window: 0, defaultMonths: 24,
    orbits: ['llo50', 'lpo100', 'nrho'],
    objectives: [
      { id: 'ice', name: 'Kutup kraterlerindeki su buzunu haritala', primary: true, weight: 40, months: 12,
        needs: { neutron: 0.6, spectrometer: 0.4, radar_sounder: 0.4, altimeter: 0.15 } },
      { id: 'topo', name: 'İniş yerleri için araziyi haritala', primary: true, weight: 30, months: 9,
        needs: { altimeter: 0.6, camera: 0.6 } },
      { id: 'rad', name: 'Astronotlar için radyasyonu ölç', primary: false, weight: 15, months: 12,
        needs: { particles: 0.9, magnetometer: 0.2 } },
      { id: 'grav', name: 'Ay\'ın kütle çekim alanını haritala', primary: false, weight: 15, months: 6,
        needs: { gravity: 0.9, altimeter: 0.2 }, fit: { llo50: 1.2, lpo100: 1, nrho: 0.35 } },
    ],
    discovery: 'Dünya\'daki teleskoplar parlak bir ışık gördü: güney kutbu yakınında taze bir göktaşı çarpması!',
  },
  mars: {
    id: 'mars', name: 'Kızıl Gezegen İklimi', body: 'Mars', bodyTr: 'Mars', icon: '🔴', level: 'İleri', color: '#c1502e',
    tagline: 'Mars iklim yörünge aracı',
    brief: 'Mars\'ın havasını ve iklimini anla: gezegen çapındaki toz fırtınaları, su döngüsü ve gömülü buz. Mars\'a fırlatma pencereleri sadece 26 ayda bir açılır — kaçırırsan beklersin.',
    budget: 600, opsPerYear: 18, sunAU: 1.52, distAU: 1.5, launchClass: 'MARS', cruise: 7, cruiseRad: 2,
    deadline: 34, window: 26, defaultMonths: 36,
    orbits: ['mlo', 'melip', 'areo'],
    objectives: [
      { id: 'weather', name: 'Toz fırtınalarını ve günlük havayı izle', primary: true, weight: 35, months: 12,
        needs: { atmo: 0.6, multispec: 0.3, camera: 0.3, thermal: 0.3 }, fit: { areo: 1.3, mlo: 1, melip: 0.8 } },
      { id: 'water', name: 'Su ve CO₂\'yi tam bir Mars yılı boyunca izle', primary: true, weight: 30, months: 23,
        needs: { spectrometer: 0.6, atmo: 0.5, neutron: 0.2 } },
      { id: 'ice', name: 'Gömülü buzu bul', primary: false, weight: 20, months: 12,
        needs: { radar_sounder: 0.8, neutron: 0.4 }, fit: { areo: 0.3, melip: 0.6 } },
      { id: 'geo', name: 'Yüksek çözünürlüklü jeoloji', primary: false, weight: 15, months: 12,
        needs: { camera: 0.8, spectrometer: 0.3 } },
    ],
    discovery: 'Bir krater duvarında yeni koyu bir çizgi belirdi — belki yüzeyde akan tuzlu su!',
  },
  europa: {
    id: 'europa', name: 'Okyanus Dünyası Kâşifi', body: 'Europa', bodyTr: 'Europa', icon: '🔵', level: 'Uzman', color: '#d8c8a8',
    tagline: 'Jüpiter / Europa sondası',
    brief: 'Europa\'nın buz kabuğunun altında küresel bir okyanus var — Dünya dışında yaşam aramak için en iyi yerlerden biri. Jüpiter çok uzak, çok karanlık ve ölümcül radyasyonla dolu.',
    budget: 1100, opsPerYear: 40, sunAU: 5.2, distAU: 5.2, launchClass: 'JUPITER', cruise: 66, cruiseRad: 3,
    deadline: 60, window: 13, defaultMonths: 48,
    orbits: ['jflyby', 'eorbit', 'single'],
    objectives: [
      { id: 'shell', name: 'Buz kabuğunun kalınlığını ölç', primary: true, weight: 35, months: 18,
        needs: { radar_sounder: 0.85, altimeter: 0.3, gravity: 0.2 } },
      { id: 'ocean', name: 'Okyanusu ve tuzluluğunu doğrula', primary: true, weight: 30, months: 18,
        needs: { magnetometer: 0.7, gravity: 0.4, particles: 0.15 } },
      { id: 'comp', name: 'Yüzey kimyası ve yaşanabilirlik', primary: false, weight: 20, months: 12,
        needs: { spectrometer: 0.7, thermal: 0.25, camera: 0.2 } },
      { id: 'map', name: 'Gelecekteki iniş yerlerini haritala', primary: false, weight: 15, months: 12,
        needs: { camera: 0.8, altimeter: 0.3 } },
    ],
    discovery: 'Uzay teleskopları, Europa\'nın güney kutbundan fışkıran bir su sütunu olabileceğini gösteriyor!',
  },
};

/* ------------------------------------------------------------------ */
/* UZAY ARACI PARÇALARI                                                 */
/* ------------------------------------------------------------------ */
const PARTS = {
  structure: { label: 'Gövde yapısı', owner: 'SE', options: {
    small:     { name: 'Küçük uydu gövdesi', frac: 0.12, cost: 3, dev: 0, maxDry: 250, desc: 'Hafif, standart çerçeve. Sadece 250 kg altı (kuru) araçlar için.' },
    aluminum:  { name: 'Alüminyum bal peteği', frac: 0.2, cost: 10, dev: 0, desc: 'Klasik, sağlam ve uygun fiyatlı — ama kompozitten ağır.' },
    composite: { name: 'Karbon kompozit', frac: 0.12, cost: 30, dev: 4, adv: true, desc: 'Çok sert ve hafif, ama pahalı ve onaylanması uzun sürer.' },
  }},
  computer: { label: 'Uçuş bilgisayarı ve depolama', owner: 'SE', options: {
    cots:    { name: 'Ticari bilgisayar', mass: 1, power: 8, cost: 1, dev: 0, storage: 64, radTol: 5, desc: 'Telefon sınıfı işlemci. Ucuz ve hızlı, ama radyasyon onu bozabilir veya öldürebilir. 64 Gbit depolama.' },
    radtol:  { name: 'Radyasyona dayanıklı', mass: 4, power: 15, cost: 6, dev: 1, storage: 512, radTol: 50, desc: 'Orta düzey radyasyona dayanacak şekilde tasarlandı. 512 Gbit depolama.' },
    radhard: { name: 'Radyasyona sertleştirilmiş', mass: 8, power: 25, cost: 18, dev: 2, storage: 2048, radTol: 300, desc: 'Yavaş ama neredeyse kurşun geçirmez — Mars gezginlerinde kullanılan türden. 2 Tbit depolama.' },
  }},
  adcs: { label: 'Yönelim kontrolü (hedefleme)', owner: 'SE', options: {
    mtq:     { name: 'Sadece manyetik tork çubukları', mass: 2, power: 5, cost: 1, dev: 0, level: 1, nearEarth: true, desc: 'Dünya\'nın manyetik alanına karşı iter. Ucuz ama kaba — ve Dünya\'dan uzakta işe yaramaz.' },
    rw:      { name: 'Reaksiyon tekerleri + yıldız izleyici', mass: 18, power: 40, cost: 9, dev: 1, level: 2, desc: 'Dönen tekerler aracı hassasça çevirir; bir yıldız kamerası nereye baktığını söyler.' },
    precise: { name: 'Hassas yönelim sistemi', mass: 35, power: 65, cost: 24, dev: 3, level: 3, adv: true, desc: 'En keskin görüntüler ve büyük antenler için ekstra kararlı kontrol.' },
  }},
  propulsion: { label: 'İtki sistemi', owner: 'SE', options: {
    none:   { name: 'İtki yok', mass: 0, power: 0, cost: 0, isp: 0, dev: 0, desc: 'En hafif ve en basit — ama yörünge değiştiremez, enkazdan kaçamaz, sürtünmeyle savaşamazsın.' },
    cold:   { name: 'Soğuk gaz iticileri', mass: 5, power: 5, cost: 2, isp: 65, dev: 0, desc: 'Sıkıştırılmış gaz püskürtmeleri. Basit ve güvenli ama çok verimsiz (düşük Isp).' },
    mono:   { name: 'Tek yakıtlı (monopropellant)', mass: 20, power: 15, cost: 6, isp: 225, dev: 1, desc: 'Hidrazin iticileri: yörünge ayarları için standart. Güvenilir, orta verim.' },
    biprop: { name: 'Çift yakıtlı motor', mass: 45, power: 20, cost: 14, isp: 320, dev: 2, desc: 'Yakıt + oksitleyici: verimli ve güçlü. Büyük yörüngeye giriş ateşlemeleri için.' },
    ion:    { name: 'Elektrikli iyon motoru', mass: 60, power: 0, cost: 35, isp: 3000, dev: 6, adv: true, needsW: 1000, desc: 'Kimyasaldan 10 kat verimli, ama ≥ 1 kW güneş gücü ister ve çok nazik iter — büyük manevralar aylar sürer.' },
  }},
  propMargin: { label: 'Yakıt yedeği', owner: 'SE', options: {
    10: { name: '+%10', margin: 0.10, desc: 'Ancak yetecek kadar. Sürprizlere az yer.' },
    25: { name: '+%25', margin: 0.25, desc: 'Kaçınma manevraları ve hedef değiştirme için yer.' },
    50: { name: '+%50', margin: 0.50, desc: 'Sürprizler ve olası uzatılmış görev için bol yakıt — ama daha ağır.' },
  }},
  shielding: { label: 'Radyasyon kalkanı', owner: 'SE', options: {
    none:  { name: 'Minimum', mass: 0, cost: 0, factor: 1, dev: 0, desc: 'Elektroniği sadece aracın duvarları korur.' },
    std:   { name: 'Bölgesel kalkan', mass: 15, cost: 3, factor: 0.35, dev: 0, desc: 'En hassas kutuların etrafına ekstra metal. Dozu ~%65 azaltır.' },
    vault: { name: 'Radyasyon kasası', mass: 150, cost: 25, factor: 0.06, dev: 3, desc: 'Tüm elektroniği içine alan kalın titanyum kutu. Dozu ~%94 azaltır.' },
  }},
  redundancy: { label: 'Yedeklilik', owner: 'SE', options: {
    single: { name: 'Tekli sistem', mult: 1, fail: 1, spares: 0, dev: 0, desc: 'Her şeyden bir tane. Daha hafif ve ucuz — ama tek bir arıza görevi bitirebilir.' },
    dual:   { name: 'Tam yedekli', mult: 1.35, fail: 1, spares: 2, dev: 4, desc: 'Yedek bilgisayar, tekerler ve radyo. Elektronik kütle ve maliyeti +%35, ama çok daha dayanıklı.' },
  }},
  power: { label: 'Güç kaynağı', owner: 'SE', options: {
    body:    { name: 'Gövdeye yapışık güneş hücreleri', w1: 80, mass: 4, cost: 2, dev: 0, desc: 'Aracın gövdesine yapıştırılmış hücreler. Basit ama az güç.' },
    deploy3: { name: 'Güneş paneli · 3 m²', w1: 900, mass: 18, cost: 9, dev: 0, desc: 'Açılır paneller: Dünya\'nın güneş ışığında ~900 W.' },
    deploy10:{ name: 'Güneş kanatları · 10 m²', w1: 3000, mass: 55, cost: 25, dev: 1, desc: 'İki büyük kanat: Dünya\'da ~3 kW.' },
    huge:    { name: 'Dev güneş kanatları · 60 m²', w1: 16000, mass: 300, cost: 80, dev: 3, adv: true, desc: 'Devasa kanatlar — Jüpiter\'de güneş enerjisi kullanmanın tek yolu.' },
    rtg:     { name: 'Radyoizotop jeneratörü (RTG)', rtg: 115, mass: 45, cost: 95, dev: 12, desc: 'Bozunan plütonyum-238\'in ısısından gece gündüz her yerde sabit güç. Çok pahalı ve onayı uzun sürer.' },
    rtg2:    { name: 'İki RTG', rtg: 230, mass: 90, cost: 180, dev: 12, adv: true, desc: 'Nükleer gücün iki katı — ve fiyatın da iki katı.' },
  }},
  battery: { label: 'Batarya', owner: 'SE', options: {
    s:  { name: '150 Wh', wh: 150, mass: 1.5, cost: 0.5, desc: 'Küçük paket — küçük yükler veya tutulmasız yörüngeler için.' },
    m:  { name: '600 Wh', wh: 600, mass: 5, cost: 2, desc: 'Orta paket.' },
    l:  { name: '2.000 Wh', wh: 2000, mass: 16, cost: 5, desc: 'Uzun tutulmalar veya aç aletler için büyük paket.' },
    xl: { name: '6.000 Wh', wh: 6000, mass: 50, cost: 12, desc: 'Çok uzun tutulmalar için dev paket.' },
  }},
  antenna: { label: 'Anten ve radyo', owner: 'CL', options: {
    lga:   { name: 'S-bant çok yönlü anten', mass: 2, power: 15, cost: 2, r1: 0.3, max: 2000, level: 0, dev: 0, desc: 'Her yöne konuşur — hedefleme gerekmez — ama sinyal uzaklıkta çok zayıflar.' },
    mga:   { name: 'S-bant orta kazançlı', mass: 6, power: 30, cost: 5, r1: 8, max: 8000, level: 1, dev: 0, desc: 'Küçük yönlü anten. Orta hız, kaba hedefleme yeterli.' },
    xhga:  { name: 'X-bant çanak · 1,5 m', mass: 25, power: 70, cost: 18, r1: 250, max: 150000, level: 2, dev: 1, desc: 'Yüksek kazançlı çanak: odaklı ışın, yüksek veri hızı. Dünya\'ya tam hedeflenmeli.' },
    kahga: { name: 'Ka-bant çanak · 3 m', mass: 55, power: 110, cost: 40, r1: 2500, max: 600000, level: 2, dev: 3, adv: true, desc: 'Büyük, çok yüksek hızlı çanak. Hassas yönelim ve çok güç ister.' },
  }},
  ground: { label: 'Yer istasyonları', owner: 'CL', options: {
    uni:        { name: 'Üniversite istasyonu', hours: 1.5, gain: 0.002, perYear: 0.3, desc: 'Kampüste küçük bir çanak: günde birkaç kısa geçiş. Derin uzay için çok küçük.' },
    commercial: { name: 'Ticari yer ağı', hours: 5, gain: 0.02, perYear: 2.5, desc: 'Dünyanın dört bir yanında kiralık antenler. Dünya yakınında günde çok geçiş.' },
    dsn:        { name: 'Derin Uzay Ağı (DSN)', hours: 8, gain: 1, perYear: 9, desc: 'Kaliforniya, İspanya ve Avustralya\'daki 34 m\'lik dev çanaklar. Ay\'ın ötesinde şart — ve pahalı.' },
  }},
};

/* ------------------------------------------------------------------ */
/* FIRLATMA ARAÇLARI · cap = her hedefe taşınabilen kg                  */
/* ------------------------------------------------------------------ */
const LAUNCHERS = {
  rideshare:  { name: 'Paylaşımlı fırlatma', cost: 4, rel: 0.97, cap: { LEO: 200 }, onlyOrbit: ['sso'],
                desc: 'Roketi onlarca uyduyla paylaş. Çok ucuz — ama ana müşteri nereye giderse oraya gidersin (SSO) ve kütle sınırlı.' },
  small:      { name: 'Küçük roket', cost: 9, rel: 0.93, cap: { LEO: 350, MOON: 40 },
                desc: 'Sana özel küçük bir roket. Yörüngeyi sen seçersin, ama sadece hafif araçları taşır.' },
  medium:     { name: 'Orta roket', cost: 70, rel: 0.98, cap: { LEO: 15000, GEO: 5500, MOON: 3000, MARS: 2400 },
                desc: 'Kendini kanıtlamış iş atı. Dünya ve Ay görevleri için bol, derin uzay için sınırlı.' },
  heavy:      { name: 'Ağır roket', cost: 150, rel: 0.96, cap: { LEO: 50000, GEO: 18000, MOON: 12000, MARS: 9000, JUPITER: 3800 },
                desc: 'Çok güçlü. Gezegenlerden kütle çekim desteği alarak Jüpiter\'e ulaşır (~5,5 yıllık yolculuk).' },
  superheavy: { name: 'Süper ağır roket', cost: 600, rel: 0.93, cap: { LEO: 95000, GEO: 35000, MOON: 27000, MARS: 20000, JUPITER: 7500 },
                cruiseMult: { JUPITER: 0.45, MARS: 0.85 },
                desc: 'Devasa ve yeni. Ağır sondaları doğrudan Jüpiter\'e gönderir (~2,5 yıl) — dev bir fiyata ve daha az uçuş geçmişiyle.' },
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
  ['Δv (delta-v)', 'Bir uzay aracının yakıtıyla yapabileceği hız değişimi. Her yörünge değişikliğinin bir Δv "maliyeti" vardır.'],
  ['Isp (özgül itki)', 'Motor verimi. Yüksek Isp = aynı yakıtla daha çok Δv. Soğuk gaz ≈ 65 s, hidrazin ≈ 225 s, iyon ≈ 3000 s.'],
  ['Roket denklemi', 'Yakıt kütlesi = kuru kütle × (e^(Δv / (Isp·g₀)) − 1). Δv\'yi ikiye katlamak yakıtı ikiden fazla katlar.'],
  ['Islak / kuru kütle', 'Kuru kütle, aracın yakıtsız hâlidir; ıslak kütle yakıtı da içerir. Roketler ıslak kütleyi kaldırmalıdır.'],
  ['Kütle payı', 'Boş fırlatma kapasitesi. Araçlar geliştirme sırasında hep büyür, bu yüzden mühendisler %10–30 pay bırakır.'],
  ['Ters-kare yasası', 'Güneş ışığı ve radyo sinyalleri uzaklıkla yayılır: iki kat uzak → dörtte bir güç.'],
  ['Tutulma', 'Gezegenin gölgesinde geçen süre. Güneş panelleri hiç üretmez; yükü bataryalar taşır.'],
  ['Veri indirme (downlink)', 'Uzay aracından Dünya\'ya veri gönderme. Anten boyutu, güç, uzaklık ve yer istasyonu süresiyle sınırlıdır.'],
  ['Yörünge koruma', 'Aracı sürtünmeye veya kütle çekim bozulmalarına karşı yörüngede tutan küçük, düzenli ateşlemeler.'],
  ['Radyasyon dozu (krad)', 'Elektroniğin biriktirdiği radyasyon. Parçanın toleransını aşınca arızalar olası hâle gelir.'],
  ['Yedeklilik', 'Tek bir arızanın görevi bitirmemesi için yedek birimler taşımak.'],
  ['Fırlatma penceresi', 'Gezegenlerin verimli bir transfer için hizalandığı dönem. Dünya→Mars pencereleri ~26 ayda bir açılır.'],
  ['Atmosferik frenleme', 'Yakıt yerine sürtünmeyle yavaşlamak için gezegenin üst atmosferine dalmak. Yakıt kazandırır, zaman kaybettirir.'],
  ['Görev döngüsü (duty cycle)', 'Bir aletin açık kalıp veri topladığı zamanın oranı.'],
  ['RTG', 'Radyoizotop Termoelektrik Jeneratör: plütonyum-238 bozunmasının ısısını elektriğe çevirir. Her yerde, onlarca yıl çalışır.'],
];
