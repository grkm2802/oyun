"""Site simgelerini ve sosyal medya önizleme görselini üretir (assets/ klasörüne).
Çalıştırma:  python scripts/make_assets.py
Gereken: Pillow (pip install pillow). Yazı tipi olarak Windows'taki Segoe UI kullanılır,
bulunamazsa Pillow'un varsayılan yazı tipine düşer.
"""
import math
import os
import random
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets")
os.makedirs(OUT, exist_ok=True)

BG = (15, 21, 28)          # --bg (koyu tema)
ACCENT = (127, 176, 255)   # --accent (koyu tema)
CTA = (255, 138, 76)       # --cta (koyu tema)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def planet(size, seed=3):
    """Sol-üstten aydınlatılmış Mars benzeri gezegen (RGBA)."""
    rnd = random.Random(seed)
    blobs = [(rnd.uniform(-0.8, 0.8), rnd.uniform(-0.7, 0.7), rnd.uniform(0.12, 0.35)) for _ in range(9)]
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    R = size / 2 - 1
    L = (-0.75, -0.35, 0.56)
    m = math.sqrt(sum(v * v for v in L))
    L = tuple(v / m for v in L)
    for y in range(size):
        for x in range(size):
            nx = (x - size / 2 + 0.5) / R
            ny = (y - size / 2 + 0.5) / R
            rr = nx * nx + ny * ny
            if rr > 1:
                continue
            nz = math.sqrt(1 - rr)
            col = lerp((196, 102, 58), (222, 140, 90), 0.5 + 0.35 * math.sin(nx * 5 + ny * 3))
            for bx, by, br in blobs:
                d = math.hypot(nx - bx, ny - by)
                if d < br:
                    col = lerp(col, (110, 58, 38), 0.55 * (1 - d / br))
            if ny < -0.86:
                col = lerp(col, (240, 236, 230), smooth(-0.86, -0.92, ny))
            ndl = nx * L[0] + ny * L[1] + nz * L[2]
            light = 0.04 + 0.96 * smooth(-0.12, 0.35, ndl) * (0.55 + 0.45 * max(0.0, ndl))
            limb = 0.75 + 0.25 * nz
            rim = (1 - nz) ** 3 * smooth(-0.2, 0.4, ndl)
            c = [min(255, int(col[i] * light * limb + (235, 170, 130)[i] * rim * 0.8)) for i in range(3)]
            edge = max(0.0, min(1.0, (1 - math.sqrt(rr)) * R))
            px[x, y] = (c[0], c[1], c[2], int(255 * edge))
    return img


def orbit_layers(W, H, cx, cy, a, b, tilt_deg, color, width):
    """Eğik yörünge elipsini arka (gezegenin arkasında) ve ön yarı olarak iki katmanda döndürür."""
    full = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(full).ellipse([cx - a, cy - b, cx + a, cy + b], outline=color, width=width)
    front_mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(front_mask).rectangle([0, cy, W, H], fill=255)  # dönmeden önce alt yarı = ön taraf
    front = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    front.paste(full, (0, 0), front_mask)
    back = full.rotate(tilt_deg, resample=Image.BICUBIC, center=(cx, cy))
    front = front.rotate(tilt_deg, resample=Image.BICUBIC, center=(cx, cy))
    return back, front


def orbit_point(cx, cy, a, b, tilt_deg, t_deg):
    """Elips üzerindeki noktanın, PIL rotate(tilt_deg) sonrası konumu."""
    t = math.radians(t_deg)
    dx, dy = a * math.cos(t), b * math.sin(t)
    th = math.radians(-tilt_deg)  # PIL pozitif açıyı saat yönünün tersine döndürür (y aşağı)
    return cx + dx * math.cos(th) - dy * math.sin(th), cy + dx * math.sin(th) + dy * math.cos(th)


def satellite(d, x, y, w):
    d.rectangle([x - w * 3, y - w * 0.7, x + w * 3, y + w * 0.7], fill=(42, 70, 119, 255))
    d.rectangle([x - w, y - w, x + w, y + w], fill=(214, 166, 74, 255))


def icon(size, pad=0.0, rounded=True):
    """Koyu kare üzerinde gezegen + yörünge + uydu."""
    S = size * 4  # kenar yumuşatma için büyük çiz, sonra küçült
    img = Image.new("RGBA", (S, S), BG + (255,) if not rounded else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=BG + (255,))
    inner = S * (1 - 2 * pad)
    off = S * pad
    cx = cy = S / 2
    a, b = inner * 0.44, inner * 0.16
    back, front = orbit_layers(S, S, cx, cy, a, b, -22, ACCENT + (235,), max(2, int(S * 0.018)))
    img.alpha_composite(back)
    p = planet(int(inner * 0.62))
    img.alpha_composite(p, (int(off + inner * 0.19), int(off + inner * 0.19)))
    img.alpha_composite(front)
    sx, sy = orbit_point(cx, cy, a, b, -22, 35)
    satellite(ImageDraw.Draw(img), sx, sy, S * 0.035)
    return img.resize((size, size), Image.LANCZOS)


def font(size, bold=True):
    for name in (["segoeuib.ttf", "seguisb.ttf"] if bold else ["segoeui.ttf"]):
        path = os.path.join(os.environ.get("WINDIR", "C:/Windows"), "Fonts", name)
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def og_image():
    W, H = 1200, 630
    img = Image.new("RGBA", (W, H), BG + (255,))
    d = ImageDraw.Draw(img)
    rnd = random.Random(42)
    for _ in range(220):
        x, y, b = rnd.random() * W, rnd.random() * H, rnd.random()
        a = int(40 + b * 150)
        r = 1 if b < 0.9 else 2
        d.ellipse([x, y, x + r, y + r], fill=(255, 255, 255, a))
    cx, cy = W - 40 - 235, H // 2
    back, front = orbit_layers(W, H, cx, cy, 330, 110, -18, ACCENT + (180,), 3)
    img.alpha_composite(back)
    p = planet(470, seed=7)
    img.alpha_composite(p, (W - 470 - 40, (H - 470) // 2))
    img.alpha_composite(front)
    d = ImageDraw.Draw(img)
    sx, sy = orbit_point(cx, cy, 330, 110, -18, 125)
    satellite(d, sx, sy, 9)
    # metin
    x0 = 70
    d.text((x0, 150), "UZAY GÖREVİ TASARIM OYUNU", font=font(26), fill=(166, 179, 192, 255))
    d.text((x0, 190), "Görev Mimarı", font=font(84), fill=(230, 235, 240, 255))
    d.text((x0, 290), "Mission Architect", font=font(46, bold=False), fill=(166, 179, 192, 255))
    d.text((x0, 380), "Tasarla · Fırlat · Keşfet", font=font(34), fill=CTA + (255,))
    d.text((x0, 430), "Design · Launch · Discover", font=font(28, bold=False), fill=(166, 179, 192, 255))
    d.text((x0, 540), "NASA Space Apps Challenge 2026", font=font(22, bold=False), fill=(143, 157, 171, 255))
    return img.convert("RGB")


if __name__ == "__main__":
    icon(180, pad=0.04, rounded=False).convert("RGB").save(os.path.join(OUT, "apple-touch-icon.png"))
    icon(192).save(os.path.join(OUT, "icon-192.png"))
    icon(512).save(os.path.join(OUT, "icon-512.png"))
    icon(512, pad=0.12, rounded=False).save(os.path.join(OUT, "icon-maskable-512.png"))
    icon(32).save(os.path.join(OUT, "favicon-32.png"))
    og_image().save(os.path.join(OUT, "og-image.png"), optimize=True)
    print("assets/ hazır:", sorted(os.listdir(OUT)))
