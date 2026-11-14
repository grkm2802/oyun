# Görev Mimarı / Mission Architect

NASA Space Apps Challenge 2026 — *Space Mission Design Game* görevi için tarayıcıda çalışan, Türkçe ve İngilizce eğitsel bir uzay görevi tasarım oyunu. Oyuncu bir görev seçer, uzay aracını tasarlar, fırlatır ve sonucun nedenlerini öğrenir.

## Yerelde çalıştırma
Kurulum gerekmez. Proje klasöründe bir web sunucusu başlat:

```bash
python -m http.server 8765
```

Ardından tarayıcıda `http://localhost:8765` adresini aç. Sağ üstteki düğmelerle tema (Açık/Koyu) ve dil (TR/EN) değiştirilir.

## Çevrimiçi takım oyunu
2–4 arkadaş, kendi cihazlarından aynı odaya katılıp tek bir uzay aracını birlikte tasarlar ve uçurur. Oda kurucusu bir kod paylaşır (örn. `K7M-2QX`) ya da davet bağlantısı gönderir (`…/oyun/?oda=K7M2QX`). Roller katılma sırasına göre dağıtılır; her tasarım adımını sadece o adımın sorumlusu değiştirebilir, diğerleri canlı izler. Fırlatmadan önce herkes onay verir. Uçuşta olay çıkınca sorumlu oyuncu karar verir ve karar herkese uygulanır (uçuşlar ortak bir tohumla herkeste birebir aynı geçer).

**Sohbet güvenliği:** sohbet sadece oda içinde; bağlantı, e-posta ve telefon numaraları otomatik gizlenir, Türkçe/İngilizce kötü sözler yıldızlanır, mesaj başına 200 karakter ve hız sınırı vardır. Her oyuncu bir başkasının mesajlarını gizleyebilir; kurucu sohbeti kapatabilir ve oyuncu çıkarabilir (çıkarılan oyuncu geri dönemez). Filtre basittir ve kusursuz değildir; asıl koruma odaların gizli koda dayanmasıdır.

**Altyapı:** Google Firebase (Realtime Database + anonim giriş). Oyuncuların hesap açması gerekmez.

### Firebase kurulumu (bir kez, ~5 dakika)
1. https://console.firebase.google.com → **Proje ekle** → ad: `gorev-mimari` → Google Analytics'i kapatabilirsin → **Proje oluştur**.
2. Sol menü **Build → Authentication → Başlayın** → **Sign-in method** sekmesi → **Anonymous** → **Etkinleştir** → Kaydet.
3. **Authentication → Settings → Authorized domains** → **Alan adı ekle** → `grkm2802.github.io`.
4. Sol menü **Build → Realtime Database → Veritabanı oluştur** → konum: **europe-west1 (Belçika)** → **Kilitli modda başlat**.
5. Realtime Database → **Kurallar (Rules)** sekmesi → içeriği silip bu depodaki `database.rules.json` dosyasının tamamını yapıştır → **Yayınla**.
6. Proje ayarları (sol üst dişli) → **Genel** → aşağıda **Uygulamalarınız** → web simgesi `</>` → takma ad `oyun` → **Uygulamayı kaydet** (Hosting kutusunu işaretleme) → gösterilen `firebaseConfig = { … }` nesnesini kopyala.
7. Bu nesneyi `firebase-config.js` dosyasında `window.FIREBASE_CONFIG = { … };` olarak yaz (anahtarlar gizli değildir; güvenliği kurallar sağlar) ve yayınla.

Firebase ayarı yokken sitede çevrimiçi panel "henüz kurulmadı" der. Yerel geliştirmede (localhost) Firebase ayarı yoksa ya da adres `?net=local` ile açılırsa, aynı tarayıcıdaki sekmeleri birbirine bağlayan **LocalNet** kullanılır: iki sekme açıp birinde oda kurup diğerinde katılarak test edilir.

## Siteyi yayınlama

Yayına giden dosyalar `dist/` klasöründe toplanır. Klasörü yayın betiği oluşturur; betik site adresini de sayfalara yazar:

```bash
python scripts/build_site.py --url https://SITE-ADRESİN/
```

Adres, paylaşım önizlemesi (WhatsApp, X, LinkedIn vb.), arama motoru site haritası ve 404 sayfası için gerekir. Sonunda `/` olmalı.

### Seçenek 1 · GitHub Pages (önerilen, ücretsiz)
1. Projeyi bir GitHub deposuna yükle (`main` dalı).
2. Depo → **Settings → Pages → Source: GitHub Actions**.
3. Her `main` gönderiminde `.github/workflows/deploy-pages.yml` siteyi kurup yayınlar. Adres: `https://KULLANICI.github.io/DEPO/`.
4. Kendi alan adın varsa: Settings → Pages → Custom domain, ve Settings → Variables → `SITE_URL` = `https://alanadin.com/`.

### Seçenek 2 · Netlify
- **Depo bağlayarak:** Netlify → Add new site → depoyu seç. `netlify.toml` ayarları otomatik kullanılır.
- **Sürükle-bırak:** `python scripts/build_site.py --url https://SITE-ADI.netlify.app/` çalıştır, `dist/` klasörünü app.netlify.com/drop sayfasına bırak.

### Seçenek 3 · Herhangi bir statik barındırma
`dist/` klasörünün içeriğini sunucunun yayın klasörüne yükle (Cloudflare Pages, Vercel, okul sunucusu vb.). Derleme adımı ve sunucu tarafı kod yoktur.

### Yayındaki site neler içeriyor
- Arama motoru ve paylaşım bilgileri: açıklama, Open Graph / Twitter kartı, `og-image.png` önizleme görseli, `robots.txt`, `sitemap.xml`
- Simgeler: favicon, iPhone ana ekran simgesi, Android uygulama simgeleri (`site.webmanifest`); telefonda "Ana ekrana ekle" ile uygulama gibi açılır
- Çevrimdışı çalışma: ilk ziyaretten sonra internet olmadan da açılır (`sw.js`, sadece https üzerinde)
- Güvenlik: içerik güvenlik politikası (CSP), `_headers` ile ek güvenlik başlıkları (Netlify / Cloudflare Pages)
- Özel 404 sayfası, JavaScript kapalıysa uyarı

Site simgelerini yeniden üretmek için: `python scripts/make_assets.py` (Pillow gerekir).

## Dosyalar
| Dosya | İçerik |
|---|---|
| `index.html`, `loader.js` | Site girişi; seçilen dile ve temaya göre oyunu yükler |
| `mission-game/` | Türkçe oyun (ve ortak `css/style.css`) |
| `mission-game-en/` | İngilizce oyun |
| `js/data.js` | Görevler, yörüngeler, aletler, parçalar, roketler, sözlük (tüm sayılar burada) |
| `js/model.js` | Mühendislik modeli: kütle, güç, maliyet, veri, takvim ve radyasyon bütçeleri, tasarım sorunları |
| `js/sim.js` | Ay ay uçuş simülasyonu, rastgele olaylar, puanlama, "neden böyle oldu" dersleri |
| `js/viz.js` | Uzay aracı çizimi ve gerçekçi gezegenler, uçuş ekranı |
| `js/ui.js` | Ekranlar: başlangıç, tasarım, uçuş, rapor; tema ve dil düğmeleri |
| `js/icons.js` | SVG simgeler |
| `assets/` | Site simgeleri ve paylaşım görseli |
| `scripts/` | `build_site.py` (yayın klasörü), `make_assets.py` (simgeler) |

## Lisanslar
- Simgeler: [Lucide](https://lucide.dev) v0.460.0, ISC lisansı. Gezegen görselleri, uzay aracı çizimi ve site simgeleri bu proje için kodla üretildi.
- 3B çizim: [Three.js](https://threejs.org) r149, MIT lisansı (`mission-game/vendor/`).
- Gezegen dokuları (`mission-game/textures/`, küçültülmüş kopyalar), NASA kaynaklarından:
  - Dünya: NASA/Goddard Space Flight Center Scientific Visualization Studio; Blue Marble Next Generation verisi Reto Stöckli (NASA/GSFC) ve NASA Earth Observatory'nin katkısıyla ([SVS 3615](https://svs.gsfc.nasa.gov/3615)).
  - Ay: NASA's Scientific Visualization Studio, CGI Moon Kit; LRO LROC WAC renk mozaiği ([SVS 4720](https://svs.gsfc.nasa.gov/4720)).
  - Mars: NASA/Jet Propulsion Laboratory & Caltech, USGS'de işlenmiş Viking görüntüleri ([NASA 3D Resources](https://science.nasa.gov/3d-resources/mars/)).
  - Jüpiter: JPL & Caltech, Voyager görüntüleri ([NASA 3D Resources](https://science.nasa.gov/3d-resources/jupiter/)).
  - Europa: USGS, JPL & Caltech, Voyager mozaiği ([NASA 3D Resources](https://science.nasa.gov/3d-resources/jupiter-europa/)).
  - NASA görselleri [NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) kapsamında kullanıldı; bu proje NASA tarafından onaylanmış ya da desteklenmiş değildir.
- Yazı tipi: Atkinson Hyperlegible Next (Google Fonts, SIL Open Font License).
- Projenin kendi kodu için henüz bir lisans seçilmedi (açık kaynak yapmak istersen örneğin MIT eklenebilir).

## Yarışma gereksinimlerinin karşılanması
- **Görevi tanımlama:** 4 senaryo (Dünya, Ay, Mars, Europa); ana ve ikincil bilimsel hedefler
- **Uzay aracı tasarımı:** gövde, bilgisayar, yönelim, itki, kalkan, yedeklilik, güç, batarya, anten
- **Alet seçimi:** 12 alet, her biri temel ve gelişmiş sürümde (kütle, güç, maliyet, veri ve bilimsel değer)
- **Yörünge ve fırlatma:** 13 yörünge, 5 roket; kütle ve yörünge uyumu kontrol ediliyor
- **Kaynaklar:** bütçe, kütle, güç, batarya, veri, takvim, radyasyon (canlı gösterge paneli)
- **Takım modu:** 2–4 oyuncu, 4 rol, rollere özel çatışan hedefler, fırlatma öncesi onay, olaylarda sorumlu rolün kararı
- **Simülasyon ve değerlendirme:** rastgele olaylar, puan (1000 üzerinden), görev raporu ve önceki denemeyle karşılaştırma
- **Ekstralar:** 4 zorluk seviyesi ve serbest mod, sıralama tablosu, tasarım paylaşma kodu, sözlük, iki dil, açık/koyu tema
