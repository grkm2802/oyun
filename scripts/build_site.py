"""Yayına hazır site klasörünü (dist/) oluşturur.

Kullanım:
    python scripts/build_site.py --url https://kullanici.github.io/gorev-mimari/
    python scripts/build_site.py            # adres yoksa SITE_URL ya da Netlify'ın URL ortam değişkeni denenir

Yaptıkları:
  - Sadece sitenin ihtiyaç duyduğu dosyaları dist/ içine kopyalar (CLAUDE.md, publish/ gibi geliştirme dosyaları girmez).
  - %SITE_URL%, %BASE_PATH%, %BUILD_ID%, %BUILD_DATE% yer tutucularını doldurur.
  - Adres verilmezse paylaşım ve arama motoru satırlarındaki mutlak adresleri çıkarır ve uyarır.
Sadece Python standart kütüphanesi kullanılır.
"""
import argparse
import os
import re
import shutil
import sys
from datetime import datetime, timezone
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")

FILES = ["index.html", "loader.js", "firebase-config.js", "sw.js", "404.html", "site.webmanifest", "robots.txt", "sitemap.xml", "_headers"]
DIRS = {
    "assets": None,
    "mission-game": ["css", "js", "vendor", "textures", "models"],
    "mission-game-en": ["js"],
}
TEXT_EXT = {".html", ".js", ".css", ".xml", ".txt", ".webmanifest", ""}


def main():
    ap = argparse.ArgumentParser(description="Görev Mimarı sitesini dist/ klasörüne hazırlar.")
    ap.add_argument("--url", help="Sitenin tam adresi, sonunda / ile (örn. https://ornek.com/oyun/)")
    args = ap.parse_args()

    url = args.url or os.environ.get("SITE_URL") or os.environ.get("URL") or ""
    if url and not url.endswith("/"):
        url += "/"
    if url and not re.match(r"^https?://", url):
        sys.exit("Hata: --url http:// ya da https:// ile başlamalı.")
    base_path = urlparse(url).path if url else "/"
    build_id = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    build_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if os.path.isdir(DIST):
        shutil.rmtree(DIST)
    os.makedirs(DIST)

    for f in FILES:
        shutil.copy2(os.path.join(ROOT, f), os.path.join(DIST, f))
    for d, subs in DIRS.items():
        if subs is None:
            shutil.copytree(os.path.join(ROOT, d), os.path.join(DIST, d))
        else:
            for sub in subs:
                shutil.copytree(os.path.join(ROOT, d, sub), os.path.join(DIST, d, sub))
    open(os.path.join(DIST, ".nojekyll"), "w").close()  # GitHub Pages dosyaları olduğu gibi sunsun

    for dirpath, _, names in os.walk(DIST):
        for n in names:
            p = os.path.join(dirpath, n)
            if os.path.splitext(n)[1] not in TEXT_EXT:
                continue
            with open(p, encoding="utf-8") as fh:
                s = fh.read()
            # sadece yer tutucu içeren dosyalara dokun (ör. vendor/three.min.js olduğu gibi kalsın)
            if not any(k in s for k in ("%SITE_URL%", "%BASE_PATH%", "%BUILD_ID%", "%BUILD_DATE%")):
                continue
            if not url:
                # mutlak adres gerektiren satırları çıkar
                s = re.sub(r'\n\s*<link rel="canonical"[^>]*>', "", s)
                s = re.sub(r'\n\s*<meta (property|name)="(og:url|og:image|twitter:image)"[^>]*>', "", s)
                s = s.replace("Sitemap: %SITE_URL%sitemap.xml\n", "")
                s = s.replace("%SITE_URL%", "./")
            s = (s.replace("%SITE_URL%", url).replace("%BASE_PATH%", base_path)
                  .replace("%BUILD_ID%", build_id).replace("%BUILD_DATE%", build_date))
            with open(p, "w", encoding="utf-8") as fh:
                fh.write(s)

    if not url:
        os.remove(os.path.join(DIST, "sitemap.xml"))
        print("Uyarı: site adresi verilmedi. Paylaşım önizlemesi ve site haritası için --url ile tekrar çalıştırın.")
    total = sum(os.path.getsize(os.path.join(dp, n)) for dp, _, ns in os.walk(DIST) for n in ns)
    print(f"dist/ hazır ({total // 1024} KB) · adres: {url or '(yok)'} · sürüm: {build_id}")


if __name__ == "__main__":
    main()
