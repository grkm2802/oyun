# Görev Mimarı / Mission Architect

NASA Space Apps Challenge 2026 — *Space Mission Design Game* görevi için tarayıcıda çalışan, Türkçe ve İngilizce eğitsel bir uzay görevi tasarım oyunu. Oyuncu bir görev seçer, uzay aracını tasarlar, fırlatır ve sonucun nedenlerini öğrenir.

## Yerelde çalıştırma
Kurulum gerekmez. Proje klasöründe bir web sunucusu başlat:

```bash
python -m http.server 8765
```

Ardından tarayıcıda `http://localhost:8765` adresini aç. Sağ üstteki düğmelerle tema (Açık/Koyu) ve dil (TR/EN) değiştirilir.

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
