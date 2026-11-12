# CLAUDE.md — Görev Mimarı / Mission Architect

NASA Space Apps Challenge 2026 "Space Mission Design Game" görevi için tarayıcıda çalışan eğitsel bir uzay görevi tasarım oyunu. Oyuncu bir görev seçer, uzay aracını tasarlar (yörünge, aletler, gövde, güç, haberleşme, roket), sonra görevi ay ay uçurur ve puanlanır. Kullanıcı Türkçe konuşuyor; ona Türkçe yanıt ver.

## Klasörler
- `mission-game/` → **Türkçe sürüm (ana sürüm)**
- `mission-game-en/` → İngilizce sürüm (jüri ve proje teslimi için). Kod aynı, sadece metinler İngilizce.
- `index.html` + `loader.js` (kök) → **site girişi**. Tam meta etiketleri (açıklama, Open Graph/Twitter, CSP, manifest, simgeler). `loader.js`: `localStorage['ma_lang']` (yoksa `data-default-lang`) → `mission-game/js/*` ya da `mission-game-en/js/*` dosyalarını sırayla yükler, `window.MA_LOADER = true`; `ma_theme`'i (yoksa koyu) sayfa çizilmeden uygular; https'te (localhost hariç) `sw.js` kaydeder. CSS her iki dilde `mission-game/css/style.css`.
- **CSP** (`index.html` meta + `_headers`): `script-src 'self'` → index.html'e satır içi `<script>` ekleme, `loader.js`'e koy. Yeni bir dış kaynak (CDN, API) eklersen CSP'nin iki yerine de ekle.
- `publish/tr/index.html`, `publish/en/index.html` → Artifact kabukları (doctype/html/head/body yok, satır içi yükleyici; Artifact'in kendi CSP'si var). Tek fark varsayılan dil.
- `mission-game/index.html`, `mission-game-en/index.html` → tek dilli eski girişler; hâlâ çalışır, dil düğmesi bunlarda diğer klasöre gider.
- Site dosyaları: `sw.js` (çevrimdışı önbellek, `CORE` listesi; yeni JS/CSS dosyası eklersen buraya da ekle), `site.webmanifest`, `robots.txt`, `sitemap.xml`, `404.html`, `_headers`, `netlify.toml`, `.github/workflows/deploy-pages.yml`, `assets/` (simgeler + `og-image.png`).
- `scripts/build_site.py --url https://.../` → `dist/` (sadece site dosyaları; `%SITE_URL%`, `%BASE_PATH%`, `%BUILD_ID%`, `%BUILD_DATE%` doldurulur). Yeni bir site dosyası/klasörü eklersen `FILES`/`DIRS` listesine ekle. `scripts/make_assets.py` → `assets/` (Pillow).
- `.claude/launch.json` (git'e girmez) → `mission-game`: proje kökü, port 8765. `site-dist`: `dist/` klasörü, port 8770 (yayın öncesi son kontrol; önce build_site.py çalıştır).
- Proje klasörü: masaüstünde `gorev-mimari` (OneDrive ile eşitlenen masaüstü).

## Dil seçimi
- Her ekranın üstünde TR/EN düğmesi (`langSwitch()` in ui.js; `LANG` sabiti her ui.js'in başında). Dil değişince `switchLang()` seçimi localStorage'a, o anki tasarımı (senaryo, zorluk, ekip, isimler, tasarım, adım) `sessionStorage['ma_carry']`'ya yazar ve sayfayı yeniden yükler; `restoreCarry()` açılışta geri yükler. Uçuş sürüyorsa uçuş kaybolur, tasarım incelemesine dönülür.
- Yeni bir durum alanı eklersen ve dil değişiminde korunması gerekiyorsa `switchLang`/`restoreCarry` içine de ekle.

## Mimari (derleme adımı yok, saf HTML/CSS/JS)
Scriptler klasik `<script>` olarak bu sırayla yüklenir ve global değişkenler paylaşır (ES module yok, `file://` ile de açılsın diye):
1. `js/icons.js` — Lucide v0.460.0 SVG simgeleri. MutationObserver, ekrandaki metinlerdeki emojileri işler: `KEEP_ICONS` (⭐ ☆ ✅ ❌ ⚠ ⛔) her yerde SVG'ye çevrilir, diğer emojiler sadece `data-icons` özniteliği olan kapların içinde (alet listesi, rapordaki alet karşılaştırması) çizilir; başka yerlerde silinir.
2. `js/data.js` — tüm oyun verisi ve sayılar: ROLES, DIFFICULTY, INSTRUMENTS, TIER, ORBITS, SCENARIOS, PARTS, LAUNCHERS, STEPS, LEARN, GLOSSARY.
3. `js/model.js` — `computeDesign(sc, design, diff)`: kütle, Δv/yakıt (roket denklemi), güç, veri bağlantısı (ters-kare), takvim, maliyet, radyasyon bütçeleri, hedef yeterliliği ve tasarım sorunları (`issues`: error/warn/good + rol).
4. `js/sim.js` — `createSim`, `simStep` (aylık adım: launch → cruise → arrival → ops), `EVENTS` (sorumlu rolün karar verdiği olaylar), `finalScore`, `buildLessons`.
5. `js/viz.js` — `craftSVG` (seçilen parçalara göre gerçekçi yan görünüş çizimi: MLI altın folyo, panel hücreleri, çanak, her aletin kendi biçimi), `bodyTexture`/`planetImage` (3B gürültü + sol-üstten ışıkla hesaplanan gerçekçi gezegenler; başlangıç kartlarında da kullanılır), `drawFlight` (fırlatma rampası sahnesi, yolculuk, yörünge; gezegen görüş hattını kesince veri çizgisi gizlenir), `sparkline`. Dil metinleri dosyanın başındaki `VIZ_TXT` içinde.
6. `js/ui.js` — global durum `S`, ekranlar (title → design → sim → report), `data-act` ile tek bir tıklama dinleyicisi, pencereler, paylaşım kodu, sıralama tablosu (localStorage `ma_board_tr`; İngilizce sürümde `ma_board`).

## Görsel tasarım (kullanıcının isteği: sade, her yaşa uygun)
- Kullanıcı önceki tasarımı "çok yapay zekâ gibi" buldu. **Geri dönme:** geçişli (gradient) renkler, parlama/glow, mor tonlar, Space Grotesk, her yerde süs simgesi yok.
- **Koyu tema varsayılan** (kullanıcı beyaz açılmasını istemedi). Sağ üstte Açık/Koyu düğmesi (`themeSwitch()`/`setTheme()` in ui.js), seçim `localStorage['ma_theme']`, `<html data-theme>` ile uygulanır. Tüm renkler `css/style.css` başındaki token'lardan (açık değerler `:root`, koyu değerler `[data-theme="dark"]` ve sistem koyu). Rol renkleri `var(--role-mm)` vb.
- Yazı tipi: Atkinson Hyperlegible Next (okunabilirlik için tasarlandı), temel boyut 17px. Sayılar `tabular-nums` ile hizalı.
- Tek vurgu: mavi (`--accent`) seçimler için, roket turuncusu (`--cta`) sadece "Görevi fırlat" için.
- Uçuş ekranı ve araç önizlemesi her temada koyu uzay zemininde (`--space`).
- Yeni ekran/öğe eklerken kalabalık yapma: önce metin ve sayı, simge sadece anlam taşıyorsa.

## Kurallar
- **İki sürümü senkron tut.** Mantık, CSS veya veri sayısı değişikliğini hem `mission-game/` hem `mission-game-en/` içine uygula. Metin değişikliğinde iki dilde de karşılığını yaz.
- `sc.body` mantık için İngilizce kalır ('Earth', 'Moon', 'Mars', 'Europa'); ekranda Türkçe için `sc.bodyTr` kullan.
- **Emoji kuralı.** Verideki emojiler çoğunlukla ekranda silinir (bkz. icons.js). Simge görünmesi gereken yeni bir yer varsa kabına `data-icons` ekle ve emojiyi `ICONS` haritasına koy. Sadece simgeden oluşan düğme yapma (silinince boş kalır); düğmede her zaman metin olsun. ✓ ✗ ✕ → gibi metin işaretleri bilerek bırakıldı.
- Canvas ve `<svg>` içindeki metinlere emoji koyma (simgeye çevrilmezler).
- **Yayın ortamı kısıtları** (Artifact görüntüleyici): `confirm()`/`alert()`/`prompt()` çalışmaz → `askConfirm()` kullan. `window.print()` çalışmaz. Hash'te sadece `#isim` geçer → tasarım paylaşımı kodla yapılır. Dış kaynak sadece Google Fonts; başka CDN/fetch ekleme. localStorage erişimini her zaman try/catch ile sar.
- Erişilebilirlik korunmalı: görünür `:focus-visible`, `prefers-reduced-motion` (CSS + `REDUCED_MOTION` in viz.js), dokunmatikte 44px hedefler, durumu sadece renkle anlatma, pencerelerde odak yönetimi.
- Metin kontrastı ≥ 4.5:1 (renk token'ları `css/style.css` başında).

## Denge (balance) notları
- Bütçeler: Dünya $200M, Ay $290M, Mars $600M, Europa $1.100M (zorluk çarpanı uygulanır).
- Puan en fazla 1000: bilim 600 + başarı 150 + verimlilik 150 + takım 100 + bonus (en fazla 100), toplam 1000'de kesilir.
- Veri cezası `Math.pow(dataFraction, 0.7)`; uzatılmış görev en fazla 2 kez.
- Sayı değiştirdikten sonra her senaryo için örnek bir tasarımı tarayıcı konsolunda ~100 kez `createSim/simStep` ile uçurup medyan puana bak; iyi bir tasarım 850–950, kötü tasarım belirgin şekilde düşük olmalı.

## Test
- Sunucuyu `mission-game` adıyla preview_start ile başlat (http://localhost:8765, kök yükleyici). Dili test etmek için `localStorage.setItem('ma_lang','en')` + yeniden yükle. Dosya değişince tarayıcı önbelleğini aşmak için `fetch(dosya, {cache:'reload'})` sonra `location.reload()`.
- Yayın öncesi: `python scripts/build_site.py --url https://ornek.github.io/gorev-mimari/`, sonra `site-dist` sunucusunda konsolda CSP hatası olmadığını, iki temanın ve iki dilin açıldığını kontrol et.
- Kontrol listesi: konsolda hata yok; 4 senaryo × 8 tasarım adımı açılıyor; bir uçuş rapora kadar gidiyor; 375px genişlikte yatay kaydırma yok.
- Test sonunda `saveBoard([])` ile test skorlarını temizle.

## Yayınlama
### Site (GitHub Pages) — ana yayın
- Depo: https://github.com/grkm2802/oyun (herkese açık; yerel klasör adı gorev-mimari), dal `main`.
- Site: https://grkm2802.github.io/oyun/
- `main`'e her gönderim (push) `.github/workflows/deploy-pages.yml` ile siteyi kurar ve 1–2 dakikada yayınlar. Pages açık (kaynak: GitHub Actions; 2026-11-12'de `gh api` ile açıldı). İlk canlı kontrol: sayfa, tüm dosyalar, 404, service worker ve konsol temiz.
- **Kullanıcı kuralı:** değişiklikleri kendiliğinden gönderme. Kullanıcı "yayınla" deyince:
  1. commit + `git push`
  2. `"/c/Program Files/GitHub CLI/gh.exe" run watch $(gh run list -R grkm2802/oyun -L 1 --json databaseId --jq '.[0].databaseId') -R grkm2802/oyun --exit-status` ile çalışmanın bitmesini bekle
  3. siteyi aç, konsolda hata olmadığını kontrol et; Artifact'leri de güncelle.
- GitHub CLI kurulu: `C:\Program Files\GitHub CLI\gh.exe` (Bash'te PATH'te olmayabilir, tam yolu kullan), `grkm2802` hesabıyla giriş yapılmış. Git girişi: Git Credential Manager. Kullanıcının şifresini/anahtarını asla isteme, okuma ya da yazdırma.
- Kullanıcının hesabında yeni depo oluşturmak gibi işler otomatik izin denetiminde reddedilebilir; öyle olursa ne yapmak istediğini söyle ve kullanıcının onayını/elle yapmasını iste.
- Actions uyarısı (zararsız): Node.js 20 kullanan action'lar Node 24'e zorlanıyor. Action sürümlerini yükseltmek istenirse resmi sürüm notlarından doğrula.
- Commit kimliği depoya yerel: `grkm2802 <grkm2802@users.noreply.github.com>` (gerçek e-posta kullanılmaz).
- Sitede bir şey değiştiğinde claude.ai Artifact'lerini de güncelle (aşağıda).

### claude.ai Artifact'leri (özel önizleme)
- Türkçe açılan: https://claude.ai/artifact/Fdp1bqmQLCqpMrSKUp9Nsa
- İngilizce açılan: https://claude.ai/artifact/WZHoZtcnkZVffxZTXuHChw
- İkisi de iki dili içerir (dil düğmesiyle geçilir). Güncellemek için **ikisini de** yayınla: `file_path` = `publish/tr/index.html` / `publish/en/index.html`, `files` haritası yayın yolu = kaynak yolu olacak şekilde: `mission-game/css/style.css`, `mission-game/js/{icons,data,model,sim,viz,ui}.js`, `mission-game-en/js/{icons,data,model,sim,viz,ui}.js`. Bu oturumdan değilse `url` parametresiyle yayınla; yeni bağlantı oluşturma.
- Bağlantılar özel; paylaşımı kullanıcı sayfanın Paylaş menüsünden açar.

## Harici araçlar
- UI/UX tasarım önerileri için `~/.claude/skills/ui-ux-pro-max` yüklü. `${CLAUDE_PLUGIN_ROOT}` boş olduğu için betiği tam yoluyla çağır:
  `python "$HOME/.claude/skills/ui-ux-pro-max/scripts/search.py" "<sorgu>" --domain ux`
- Lisanslar: Lucide (ISC), Atkinson Hyperlegible Next (SIL OFL). README.md'de listeli.

## Açık konular
- Space Apps kurallarında yapay zekâ kullanımı / önceden hazırlanmış kod durumu doğrulanmadı; kullanıcıya teslim öncesi kontrol etmesi söylendi.
- Takım modu aynı cihazda sırayla oynanıyor (ağ üzerinden çok oyunculu değil).
